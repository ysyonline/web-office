/**
 * 协同技术 spike：Univer Command/Mutation 层 -> Yjs CRDT -> 远端 Command API 回放
 *
 * 目标（Spec AC-14 / 架构选型风险 1）：
 *   1. 验证 Univer 1.0.2 是否暴露可拦截的 mutation 级钩子
 *   2. 验证 mutation -> Yjs 更新 -> 远端经 Command API 回放后两端快照一致
 *   3. 验证本地撤销不与远端更新冲突崩溃、是否污染 undo 栈
 *
 * 运行：node src/spike.mjs
 */
import {
    Univer,
    UniverInstanceType,
    ICommandService,
    IUniverInstanceService,
    IUndoRedoService,
    CommandType,
    Direction,
} from '@univerjs/core';
import {
    UniverSheetsPlugin,
    SetRangeValuesMutation,
    SetRangeValuesCommand,
    InsertRowCommand,
} from '@univerjs/sheets';
import * as Y from 'yjs';

const UNIT_ID = 'book-spike';
const SUB_UNIT_ID = 'sheet-1';
const REMOTE_ORIGIN = 'remote';
const UNDO_COMMAND_ID = 'univer.command.undo';

// ---------------------------------------------------------------- 断言框架

const results = [];
function record(name, pass, detail) {
    results.push({ name, pass, detail });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` -- ${detail}` : ''}`);
}
function eq(name, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    record(name, a === b, a === b ? '' : `\n    actual  : ${a}\n    expected: ${b}`);
}

// ---------------------------------------------------------------- Univer 无头实例

function buildWorkbookData(id) {
    return {
        id,
        name: 'spike',
        appVersion: '1.0.2',
        locale: 'zhCN',
        sheetOrder: [SUB_UNIT_ID],
        styles: {},
        sheets: {
            [SUB_UNIT_ID]: {
                id: SUB_UNIT_ID,
                name: 'Sheet1',
                cellData: {},
                rowCount: 20,
                columnCount: 10,
                defaultColumnWidth: 90,
                defaultRowHeight: 24,
                mergeData: [],
                rowData: {},
                columnData: {},
                status: 1,
            },
        },
    };
}

/**
 * 一个协同端：持有独立 Univer 实例 + 独立 Yjs Doc。
 * 入站：Y.Doc 变更 -> 经 Command API 回放（严禁直接改数据层）
 * 出站：Command 层 mutation -> 写入 Y.Doc
 */
class CollabClient {
    /**
     * @param {string} name
     * @param {'cellstate'|'oplog'|'oplog-naive'} model 映射模型
     */
    constructor(name, model = 'cellstate') {
        this.name = name;
        this.model = model;

        // 坑 1：无头模式必须显式注入 locales，否则执行顶层 COMMAND 时
        //      SheetPermissionCheckController 抛 "[LocaleService]: Locale not initialized"
        this.univer = new Univer({ locale: 'zhCN', locales: { zhCN: {} }, logLevel: 0 });
        this.univer.registerPlugin(UniverSheetsPlugin);
        this.workbook = this.univer.createUnit(UniverInstanceType.UNIVER_SHEET, buildWorkbookData(UNIT_ID));

        const injector = this.univer.__getInjector();
        this.injector = injector;
        this.commandService = injector.get(ICommandService);
        this.undoRedoService = injector.get(IUndoRedoService);
        injector.get(IUniverInstanceService).focusUnit(UNIT_ID);

        this.doc = new Y.Doc();
        this.ops = this.doc.getArray('ops');   // 操作日志模型 / 结构类操作
        this.cells = this.doc.getMap('cells'); // 单元格状态模型（key: "row:col"）
        this.appliedOpIds = new Set();
        this.replaying = false;

        this.captured = []; // 出站捕获到的 mutation（id + params + CommandType）
        this.replayed = 0;  // 回放执行次数（用于检测回声放大）

        this._bindOutbound();
        this._bindInbound();
    }

    // ---- 出站：Univer mutation -> Yjs ----
    _bindOutbound() {
        this.commandService.onCommandExecuted((info, options) => {
            // 远端回放进来的 mutation 不再出站（否则无限回声放大）
            if (options?.fromCollab) return;
            if (options?.onlyLocal) return;
            if (options?.fromChangeset) return;
            // 只要 mutation：OPERATION（滚动/侧栏）不进快照；COMMAND 会被拆成 mutation 后再进
            if (info.type !== CommandType.MUTATION) return;

            this.captured.push({ id: info.id, params: info.params, type: info.type });
            this._writeToY(info);
        });
    }

    _writeToY(info) {
        if (this.model === 'cellstate' && info.id === SetRangeValuesMutation.id) {
            const { cellValue } = info.params ?? {};
            for (const [row, cols] of Object.entries(cellValue ?? {})) {
                for (const [col, cell] of Object.entries(cols ?? {})) {
                    const payload = {};
                    if ('v' in (cell ?? {})) payload.v = cell.v;
                    if ('f' in (cell ?? {})) payload.f = cell.f;
                    this.cells.set(`${row}:${col}`, JSON.stringify(payload));
                }
            }
            return;
        }
        const opId = `${this.name}-${this.ops.length}`;
        // oplog-naive：本地写入时就把自己的 op 标记为已应用（工程上最直觉的写法）
        if (this.model === 'oplog-naive') this.appliedOpIds.add(opId);
        // 区分幂等与不幂等操作：绝对赋值幂等，结构操作（插入/删除行列）不幂等
        const kind = info.id === SetRangeValuesMutation.id ? 'value' : 'struct';
        this.ops.push([JSON.stringify({ opId, client: this.name, kind, id: info.id, params: info.params })]);
    }

    // ---- 入站：Yjs 变更 -> Command API 回放 ----
    _bindInbound() {
        const onRemote = (_update, origin) => {
            if (origin !== REMOTE_ORIGIN) return;
            this._replay();
        };
        this.doc.on('update', onRemote);
    }

    _replay() {
        if (this.replaying) return;
        this.replaying = true;
        try {
            // 顺序：先回放结构类操作（服务端定序），再回放单元格状态（权威端已按新位置重发）
            this._replayOpLog();
            if (this.model === 'cellstate') this._replayCellState();
        } finally {
            this.replaying = false;
        }
    }

    /**
     * 结构操作发生后，由权威端（服务端 headless Univer）按新位置重算并重发单元格状态。
     * 这是「绝对地址键 + 结构操作」的位移修正手段。
     */
    republishCellState() {
        const target = new Map();
        for (const [row, cols] of Object.entries(this.snapshot())) {
            for (const [col, cell] of Object.entries(cols ?? {})) {
                const payload = {};
                if ('v' in cell) payload.v = cell.v;
                if ('f' in cell) payload.f = cell.f;
                target.set(`${row}:${col}`, JSON.stringify(payload));
            }
        }
        // 失效键必须显式删除：结构操作会让旧的绝对地址键失效，只 set 不 delete 会留下幽灵单元格
        for (const key of [...this.cells.keys()]) {
            if (!target.has(key)) this.cells.delete(key);
        }
        for (const [key, value] of target) this.cells.set(key, value);
    }

    /** 单元格状态模型：把 Y.Map 最新状态幂等写回 Univer（绝对赋值 + 失效键清空） */
    _replayCellState() {
        const target = new Map();
        for (const [key, raw] of this.cells.entries()) {
            target.set(key, JSON.parse(raw));
        }
        // 坑 3：Y.Map 里被删除的键不会自动从 Univer 数据层消失，必须显式清空（对账式回放）
        const stale = [];
        for (const [row, cols] of Object.entries(this.snapshot())) {
            for (const col of Object.keys(cols ?? {})) {
                if (!target.has(`${row}:${col}`)) stale.push([row, col]);
            }
        }
        const cellValue = {};
        for (const [key, payload] of target) {
            const [row, col] = key.split(':');
            cellValue[row] ??= {};
            cellValue[row][col] = payload;
        }
        for (const [row, col] of stale) {
            cellValue[row] ??= {};
            cellValue[row][col] = { v: null };
        }
        if (Object.keys(cellValue).length === 0) return;
        this.commandService.syncExecuteCommand(
            SetRangeValuesMutation.id,
            { unitId: UNIT_ID, subUnitId: SUB_UNIT_ID, cellValue },
            { onlyLocal: true, fromCollab: true }
        );
        this.replayed++;
    }

    /** 操作日志模型：按 Yjs 全序回放未应用过的 op */
    _replayOpLog() {
        for (const raw of this.ops.toArray()) {
            const op = JSON.parse(raw);
            if (this.appliedOpIds.has(op.opId)) continue;
            this.appliedOpIds.add(op.opId);
            // 坑 4：结构操作（插入/删除行）不幂等，必须跳过自己发出的 op，否则被应用两次
            if (op.kind === 'struct' && op.client === this.name) continue;
            this.commandService.syncExecuteCommand(op.id, op.params, { onlyLocal: true, fromCollab: true });
            this.replayed++;
        }
    }

    // ---- 业务动作 ----
    /** 直接执行 mutation（生产环境由顶层 COMMAND 触发，此处用于精确控制） */
    setCell(row, col, value) {
        return this.commandService.syncExecuteCommand(SetRangeValuesMutation.id, {
            unitId: UNIT_ID,
            subUnitId: SUB_UNIT_ID,
            cellValue: { [row]: { [col]: { v: value } } },
        });
    }

    setFormula(row, col, formula) {
        return this.commandService.syncExecuteCommand(SetRangeValuesMutation.id, {
            unitId: UNIT_ID,
            subUnitId: SUB_UNIT_ID,
            cellValue: { [row]: { [col]: { f: formula } } },
        });
    }

    /** 走顶层 COMMAND（Univer 会拆成 mutation），等价于真实 UI 输入路径 */
    async setCellViaCommand(row, col, value) {
        return this.commandService.executeCommand(SetRangeValuesCommand.id, {
            unitId: UNIT_ID,
            subUnitId: SUB_UNIT_ID,
            range: { startRow: row, endRow: row, startColumn: col, endColumn: col },
            value: { v: value },
        });
    }

    async undo() {
        return this.commandService.executeCommand(UNDO_COMMAND_ID);
    }

    async insertRowAt(rowIndex) {
        // 坑 2：InsertRowByRangeCommand 的 anchorRow = (direction === UP ? startRow : startRow - 1)，
        //       在第 0 行插入若不显式传 Direction.UP，anchorRow = -1 会抛
        //       "Anchor row is out of bounds in InsertRowByRangeCommand"
        return this.commandService.executeCommand(InsertRowCommand.id, {
            unitId: UNIT_ID,
            subUnitId: SUB_UNIT_ID,
            range: { startRow: rowIndex, endRow: rowIndex, startColumn: 0, endColumn: 9 },
            direction: Direction.UP,
        });
    }

    // ---- 快照读取 ----
    snapshot() {
        return this.workbook.save().sheets[SUB_UNIT_ID].cellData ?? {};
    }
    rowCount() {
        return this.workbook.save().sheets[SUB_UNIT_ID].rowCount;
    }
    /** 归一化为 {"row:col": value}，公式显示为 "=f" */
    flat() {
        const out = {};
        for (const [row, cols] of Object.entries(this.snapshot())) {
            for (const [col, cell] of Object.entries(cols ?? {})) {
                if (!cell) continue;
                if ('f' in cell) out[`${row}:${col}`] = `=${cell.f}`;
                else if (cell.v !== null && cell.v !== undefined) out[`${row}:${col}`] = cell.v;
            }
        }
        return out;
    }
    undoStatus() {
        return this.undoRedoService.getUndoRedoStatus(UNIT_ID);
    }
}

// ---------------------------------------------------------------- 网络链路（可模拟离线）

class Link {
    constructor(a, b) {
        this.a = a;
        this.b = b;
        this.online = true;
        this.pending = [];
        a.doc.on('update', (u, origin) => this._send(u, origin, 'A'));
        b.doc.on('update', (u, origin) => this._send(u, origin, 'B'));
    }
    _send(update, origin, from) {
        if (origin === REMOTE_ORIGIN) return;
        if (!this.online) {
            this.pending.push({ update, from });
            return;
        }
        this._deliver(update, from);
    }
    _deliver(update, from) {
        const target = from === 'A' ? this.b : this.a;
        Y.applyUpdate(target.doc, update, REMOTE_ORIGIN);
    }
    goOffline() {
        this.online = false;
    }
    /** 双向 flush：离线期间积攒的更新交叉送达 + 全量状态兜底（等价真实 ws 的 sync step） */
    flush() {
        const queued = this.pending;
        this.pending = [];
        for (const { update, from } of queued) this._deliver(update, from);
        Y.applyUpdate(this.b.doc, Y.encodeStateAsUpdate(this.a.doc), REMOTE_ORIGIN);
        Y.applyUpdate(this.a.doc, Y.encodeStateAsUpdate(this.b.doc), REMOTE_ORIGIN);
    }
}

// ---------------------------------------------------------------- 测试用例

async function main() {
    console.log('\n=== 环境 ===');
    console.log('Node:', process.version);
    console.log('SetRangeValuesMutation.id =', SetRangeValuesMutation.id);
    console.log('SetRangeValuesCommand.id  =', SetRangeValuesCommand.id);

    // T1 单向同步
    console.log('\n=== T1 单向同步：A 写 -> Yjs -> B 经 Command API 回放 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        new Link(a, b);

        a.setCell(0, 0, 'hello-A');
        a.setCell(1, 1, 42);
        eq('T1.1 A 本地写入生效', a.flat(), { '0:0': 'hello-A', '1:1': 42 });
        eq('T1.2 B 回放后与 A 快照一致', b.flat(), a.flat());
        eq('T1.3 A 出站捕获到 2 条 mutation', a.captured.length, 2);
        eq('T1.4 捕获类型均为 MUTATION', [...new Set(a.captured.map((c) => c.type))], [CommandType.MUTATION]);
        eq('T1.5 无回声放大（A 未回放自己的操作）', a.replayed, 0);
        eq('T1.6 B 未把远端回放再出站', b.captured.length, 0);
        console.log(`  [info] B 回放次数 = ${b.replayed}`);
    }

    // T2 顶层 COMMAND 分解
    console.log('\n=== T2 顶层 COMMAND 分解验证 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        new Link(a, b);

        await a.setCellViaCommand(2, 2, 'via-command');
        const ids = a.captured.map((c) => c.id);
        console.log('  [info] 执行 SetRangeValuesCommand 后捕获 id =', ids);
        record('T2.1 顶层 COMMAND 被分解为 MUTATION（协作粒度正确）', ids.includes(SetRangeValuesMutation.id), ids.join(','));
        eq('T2.2 B 端一致', b.flat(), a.flat());
        eq('T2.3 B 单元格值正确', b.flat()['2:2'], 'via-command');
        console.log(`  [info] 走 COMMAND 路径后 A undo 栈 = ${JSON.stringify(a.undoStatus())}`);
    }

    // T3 离线并发不同单元格
    console.log('\n=== T3 离线并发（不同单元格）-> 恢复连接收敛 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        link.goOffline();
        a.setCell(0, 0, 'from-A');
        b.setCell(5, 5, 'from-B');
        link.flush();
        eq('T3.1 双向收敛', a.flat(), b.flat());
        eq('T3.2 保留双方编辑', a.flat(), { '0:0': 'from-A', '5:5': 'from-B' });
    }

    // T4 同格冲突（单元格状态模型）
    console.log('\n=== T4 离线并发（同一单元格）-> 单元格状态模型收敛 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        link.goOffline();
        a.setCell(3, 3, 'from-A');
        b.setCell(3, 3, 'from-B');
        link.flush();
        eq('T4.1 同格写冲突后两端一致', a.flat(), b.flat());
        console.log(`  [info] 收敛结果 = ${JSON.stringify(a.flat())}（Yjs 内在 LWW 决定，可复现）`);
        record('T4.2 结果为单一值（无撕裂）', Object.keys(a.flat()).length === 1, JSON.stringify(a.flat()));
    }

    // T4b 操作日志模型（全量按 Yjs 全序回放）
    console.log('\n=== T4b 操作日志模型（oplog，全量按 Yjs 全序回退）同格并发 ===');
    {
        const a = new CollabClient('A', 'oplog');
        const b = new CollabClient('B', 'oplog');
        const link = new Link(a, b);

        link.goOffline();
        a.setCell(3, 3, 'from-A');
        b.setCell(3, 3, 'from-B');
        link.flush();
        console.log(`  [info] A = ${JSON.stringify(a.flat())} / B = ${JSON.stringify(b.flat())}`);
        eq('T4b.1 oplog 全量回放同格并发收敛', a.flat(), b.flat());
    }

    // T4c 反例：oplog + 本地 op 标记已应用（跳过）-> 发散
    console.log('\n=== T4c 反例：oplog 且本地 op 标记已应用（跳过回放）===');
    {
        const a = new CollabClient('A', 'oplog-naive');
        const b = new CollabClient('B', 'oplog-naive');
        const link = new Link(a, b);

        link.goOffline();
        a.setCell(3, 3, 'from-A');
        b.setCell(3, 3, 'from-B');
        link.flush();
        const diverged = JSON.stringify(a.flat()) !== JSON.stringify(b.flat());
        console.log(`  [info] A = ${JSON.stringify(a.flat())} / B = ${JSON.stringify(b.flat())}`);
        record(
            'T4c 反例证实：oplog + 跳过「已应用 op」在同格并发下必然发散（发散即证明，据此禁用该写法）',
            diverged,
            `A=${JSON.stringify(a.flat())} B=${JSON.stringify(b.flat())}`
        );
    }

    // T5 撤销 x 远端更新（走顶层 COMMAND，保证 undo 栈有内容）
    console.log('\n=== T5 A 端撤销不与远端更新冲突（COMMAND 路径，undo 栈非空）===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        await a.setCellViaCommand(4, 0, 'v1');
        await a.setCellViaCommand(4, 0, 'v2');
        const undoBefore = { ...a.undoStatus() };
        console.log(`  [info] A 写两次后 undo 栈 = ${JSON.stringify(undoBefore)}，值 = ${JSON.stringify(a.flat())}`);
        record('T5.0 COMMAND 路径使 undo 栈非空（撤销可用）', undoBefore.undos > 0, JSON.stringify(undoBefore));

        let crashed = null;
        try {
            await a.undo();
        } catch (e) {
            crashed = e.message;
        }
        record('T5.1 A 端 undo 不崩溃', crashed === null, crashed ?? '');
        console.log(`  [info] A undo 后 = ${JSON.stringify(a.flat())}，undo 栈 = ${JSON.stringify(a.undoStatus())}`);
        link.flush();
        eq('T5.2 撤销后 A/B 一致', a.flat(), b.flat());

        // 远端编辑到达后再撤销：不得崩溃
        await b.setCellViaCommand(6, 0, 'remote-edit');
        link.flush();
        let crashed2 = null;
        try {
            await a.undo();
            await a.undo();
            await a.undo();
        } catch (e) {
            crashed2 = e.message;
        }
        record('T5.3 收到远端更新后连续 undo 不崩溃', crashed2 === null, crashed2 ?? '');
        console.log(`  [info] T5 结束 A = ${JSON.stringify(a.flat())}`);
        console.log(`  [info] T5 结束 B = ${JSON.stringify(b.flat())}`);
    }

    // T6 undo 栈污染
    console.log('\n=== T6 远端回放对 undo 栈的污染检测 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        await b.setCellViaCommand(8, 8, 'b-own');
        const before = { ...b.undoStatus() };
        await a.setCellViaCommand(7, 0, 'remote-1');
        await a.setCellViaCommand(7, 1, 'remote-2');
        const after = { ...b.undoStatus() };
        console.log(`  [info] B undo 栈：自写后=${JSON.stringify(before)}，收到 2 条远端后=${JSON.stringify(after)}`);
        record('T6.1 远端回放不写入 B 的 undo 栈', after.undos === before.undos, `${before.undos} -> ${after.undos}`);
        record('T6.2 B 自身操作仍可撤销（undo 栈可用）', before.undos > 0, JSON.stringify(before));

        // B 撤销自己的编辑，不应把 A 的远端编辑一起撤掉
        await b.undo();
        link.flush();
        console.log(`  [info] B undo 自身后 A = ${JSON.stringify(a.flat())}`);
        console.log(`  [info] B undo 自身后 B = ${JSON.stringify(b.flat())}`);
        record('T6.3 B 撤销自身编辑后 A 的远端编辑仍在', a.flat()['7:0'] === 'remote-1', JSON.stringify(a.flat()));
        eq('T6.4 B 撤销后两端最终一致', a.flat(), b.flat());
    }

    // T7 结构操作
    console.log('\n=== T7 结构操作：插入行同步 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        await a.setCellViaCommand(0, 0, 'row0');
        await a.setCellViaCommand(1, 0, 'row1');
        link.flush();
        const rowsBefore = a.rowCount();
        await a.insertRowAt(0);
        // 结构操作会改变单元格绝对地址：由权威端按新位置重算并重发单元格状态
        a.republishCellState();
        link.flush();
        console.log(`  [info] 插入行后 A rowCount = ${a.rowCount()}（原 ${rowsBefore}）`);
        console.log(`  [info] A = ${JSON.stringify(a.flat())}`);
        console.log(`  [info] B = ${JSON.stringify(b.flat())}`);
        eq('T7.1 插入行 + 权威端重发状态后 A/B 一致', a.flat(), b.flat());
        record('T7.2 原 A1 下移到 A2（结构语义正确）', a.flat()['1:0'] === 'row0', JSON.stringify(a.flat()));

        let crashed = null;
        try {
            await a.undo();
        } catch (e) {
            crashed = e.message;
        }
        record('T7.3 结构操作撤销不崩溃', crashed === null, crashed ?? '');
        a.republishCellState();
        link.flush();
        console.log(`  [info] 撤销插入行后 A = ${JSON.stringify(a.flat())}`);
        console.log(`  [info] 撤销插入行后 B = ${JSON.stringify(b.flat())}`);
        eq('T7.4 结构操作撤销后两端一致', a.flat(), b.flat());
    }

    // T7b 并发结构操作（开放项：需服务端定序）
    console.log('\n=== T7b 并发结构操作（开放项探测，非通过标准）===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        const link = new Link(a, b);

        await a.setCellViaCommand(0, 0, 'A0');
        await b.setCellViaCommand(1, 0, 'B1');
        link.flush();
        link.goOffline();
        await a.insertRowAt(0);
        await b.insertRowAt(2);
        a.republishCellState();
        b.republishCellState();
        link.flush();
        console.log(`  [info] 并发插行后 A = ${JSON.stringify(a.flat())} rowCount=${a.rowCount()}`);
        console.log(`  [info] 并发插行后 B = ${JSON.stringify(b.flat())} rowCount=${b.rowCount()}`);
        const converged = JSON.stringify(a.flat()) === JSON.stringify(b.flat());
        console.log(`  [info] 并发结构操作收敛 = ${converged}（不收敛则需服务端定序串行化，见报告 OPEN-1）`);
    }

    // T8 公式文本同步（只同步原始输入）
    console.log('\n=== T8 公式文本同步（同步原始输入，不同步计算值）===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        new Link(a, b);

        await a.setCellViaCommand(0, 0, 10);
        await a.setCellViaCommand(0, 1, 20);
        a.setFormula(0, 2, 'SUM(A1:B1)');
        console.log(`  [info] A = ${JSON.stringify(a.flat())}`);
        console.log(`  [info] B = ${JSON.stringify(b.flat())}`);
        eq('T8.1 公式文本同步到 B', b.flat()['0:2'], '=SUM(A1:B1)');
        eq('T8.2 两端一致', a.flat(), b.flat());
    }

    // T9 多轮往返稳定性
    console.log('\n=== T9 多轮往返：无回声放大 ===');
    {
        const a = new CollabClient('A', 'cellstate');
        const b = new CollabClient('B', 'cellstate');
        new Link(a, b);

        for (let i = 0; i < 10; i++) {
            a.setCell(i, 0, `A${i}`);
            b.setCell(i, 1, `B${i}`);
        }
        console.log(`  [info] Y.Map 条目 A=${a.cells.size} B=${b.cells.size}，A 出站=${a.captured.length} B 出站=${b.captured.length}`);
        eq('T9.1 两端 Yjs 状态条目一致', a.cells.size, b.cells.size);
        eq('T9.2 出站 mutation 数 = 实际写次数（无放大）', a.captured.length, 10);
        eq('T9.3 最终快照一致', a.flat(), b.flat());
    }

    // 汇总
    const failed = results.filter((r) => !r.pass);
    console.log('\n=== 汇总 ===');
    console.log(`总计 ${results.length} 项，通过 ${results.length - failed.length}，失败 ${failed.length}`);
    for (const f of failed) console.log(`  FAIL: ${f.name} ${f.detail ?? ''}`);
    process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
    console.error('\n[spike 运行异常]', e);
    process.exit(2);
});
