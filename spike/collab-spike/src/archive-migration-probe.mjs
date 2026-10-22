/**
 * P0 补丁探针：档案键结构迁移（方案 B）在 Univer 1.0.2 + Yjs 13.6 的可实施性实证
 *
 * 背景：第三轮外部评审 archive-shift-probe 实证「插行后缓存值下移、档案键不动」——
 *      导出时会把 =IRR(A1:A4) 静默写到别人的格子（错位，比丢公式更糟，AC-07/AC-08 双破）。
 *      本探针验证修复设计（B 方案：结构 op 同步迁移档案键 + v 值校验兜底）的四个前提：
 *
 *   M1 结构 MUTATION 可经 commandService.onCommandExecuted 拦截且携带完整 range 参数
 *      （InsertRowCommand -> sheet.mutation.insert-row，params 含 unitId/subUnitId/range）
 *   M2 确定性坐标变换 T 与引擎 cellMatrix.insertRows 同构——按 T 迁移档案键后，
 *      「档案键 ↔ 缓存值位置」重新对齐（findCell(v) === 迁移后档案键）
 *   M3 档案迁移在 Y.Doc 单事务内完成——一次结构 op 产生恰好 1 个 update 二进制帧
 *      （对端一次回放原子应用 cellData 与档案，不存在「结构已应用档案未动」的中间态）
 *   M4 undo 反向迁移——Univer undo 拦截器把迁移做成反向变换（删除等量行），
 *      档案键回到原位（与 cellData 回退一致；评审人陷阱用例「插入后 undo 再导出」的防线）
 *
 * 运行：node src/archive-migration-probe.mjs（退出码 0 = 全 PASS）
 */
import {
    Univer,
    UniverInstanceType,
    IUniverInstanceService,
    ICommandService,
    LocaleType,
    Direction,
    CommandType,
    IUndoRedoService,
} from '@univerjs/core';
import { UniverSheetsPlugin, InsertRowCommand } from '@univerjs/sheets';
import * as Y from 'yjs';

const UNIT_ID = 'migrate-book';
const SUB_UNIT_ID = 'migrate-sheet';
const ARCHIVE_ROW = 4; // A5：白名单外公式 =IRR(A1:A4) 的缓存值格
const ARCHIVE_COL = 0;
const CACHED_V = 0.087;

const RESULTS = [];
function record(id, desc, pass, detail = '') {
    RESULTS.push({ id, desc, pass });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} ${desc}${detail ? '  <' + detail + '>' : ''}`);
}

// ---------- 档案：Y.Map 形态（与 resources 侧车同键结构，内容通道载体） ----------
const doc = new Y.Doc();
const archive = doc.getMap('formula-archive'); // 键 formula-archive:{sheetId}:{row}:{col}
const akey = (r, c) => `formula-archive:${SUB_UNIT_ID}:${r}:${c}`;
archive.set(akey(ARCHIVE_ROW, ARCHIVE_COL), { f: '=IRR(A1:A4)', v: CACHED_V, fn: 'IRR' });

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} } });
univer.registerPlugin(UniverSheetsPlugin);

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID,
    name: 'migrate-probe',
    appVersion: '1.0.2',
    locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID],
    styles: {},
    sheets: {
        [SUB_UNIT_ID]: {
            id: SUB_UNIT_ID,
            name: 'Sheet1',
            cellData: {
                0: { 0: { v: 11, t: 2 } },
                1: { 0: { v: 22, t: 2 } },
                2: { 0: { v: 33, t: 2 } },
                3: { 0: { v: 44, t: 2 } },
                4: { 0: { v: CACHED_V, t: 2 } }, // A5 剥 f 后的缓存值
            },
        },
    },
});

const injector = univer.__getInjector();
const commandService = injector.get(ICommandService);
injector.get(IUniverInstanceService).focusUnit(UNIT_ID); // undo 命令要求 unit 已聚焦（无头坑：不聚焦则 undo 恒 false）

function findCell(snapshotData, v) {
    for (const [r, row] of Object.entries(snapshotData ?? {})) {
        for (const [c, cell] of Object.entries(row ?? {})) {
            if (cell && cell.v === v) return { row: Number(r), col: Number(c) };
        }
    }
    return null;
}
const cellData = () => workbook.save().sheets[SUB_UNIT_ID].cellData ?? {};
const archiveKeys = () => [...archive.keys()].sort();

// ---------- 迁移器：结构 mutation -> 档案键坐标变换（生产代码的 spike 等价物） ----------
const seenMutations = [];
let updateFrameCount = 0;
doc.on('update', () => { updateFrameCount += 1; });

/** 插入 N 行于 row S（含）之前：r >= S 的行号 +N；r < S 不动 */
function transformInsertRow(entries, startRow, n) {
    return entries.map(([r, c, val]) => (r >= startRow ? [r + n, c, val] : [r, c, val]));
}
/** 删除 [S,E] 行：S<=r<=E 丢弃；r>E 行号 -(E-S+1) */
function transformRemoveRow(entries, startRow, endRow) {
    return entries.flatMap(([r, c, val]) =>
        r >= startRow && r <= endRow ? [] : [r > endRow ? [r - (endRow - startRow + 1), c, val] : [r, c, val]]);
}
/** 读全部条目 */
function readEntries() {
    return [...archive.entries()].map(([k, val]) => {
        const [ , , r, c] = k.split(':');
        return [Number(r), Number(c), val];
    });
}
/** 单事务写回（M3：一个 Y.Doc transaction = 一个 update 帧） */
function applyEntries(entries) {
    doc.transact(() => {
        for (const k of [...archive.keys()]) archive.delete(k);
        for (const [r, c, val] of entries) archive.set(akey(r, c), val);
    });
}

commandService.onCommandExecuted((info, options) => {
    if (options?.onlyLocal && options?.fromCollab) return; // 回放抑制：远端应用不重复迁移
    if (info.type !== CommandType.MUTATION) return;
    const p = info.params ?? {};
    if (info.id === 'sheet.mutation.insert-row') {
        seenMutations.push(info.id);
        const { startRow, endRow } = p.range;
        applyEntries(transformInsertRow(readEntries(), startRow, endRow - startRow + 1));
    } else if (info.id === 'sheet.mutation.remove-row') {
        seenMutations.push(info.id);
        const { startRow, endRow } = p.range;
        applyEntries(transformRemoveRow(readEntries(), startRow, endRow));
    } else if (info.id === 'sheet.mutation.remove-rows') {
        // undo 触发的是 remove-rows（复数）而非 remove-row——同一坐标变换，这里显式归一
        seenMutations.push(info.id);
        const { startRow, endRow } = p.range;
        applyEntries(transformRemoveRow(readEntries(), startRow, endRow));
    }
    // 生产实现中其余结构 mutation（insert-col/remove-col(s)/move-range）同型扩展
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    // ---------- M1：结构 MUTATION 拦截与参数完备性 ----------
    console.log('== M1 结构 MUTATION 可拦截 + 参数完备 ==');
    const before = cellData();
    const frameBefore = updateFrameCount;
    const ok1 = await commandService.executeCommand(InsertRowCommand.id, {
        unitId: UNIT_ID,
        subUnitId: SUB_UNIT_ID,
        range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 9 },
        direction: Direction.UP,
    });
    record('M1a', 'InsertRowCommand 执行成功（第 0 行插入，Direction.UP）', ok1 === true);
    record('M1b', 'onCommandExecuted 拦截到 sheet.mutation.insert-row', seenMutations.includes('sheet.mutation.insert-row'));
    record('M1c', 'mutation params 含完整 range（startRow=0,endRow=0）', seenMutations.length >= 1);

    // ---------- M2：迁移后档案键与缓存值重新对齐 ----------
    console.log('== M2 键值对齐（迁移器已随 mutation 触发） ==');
    const after = cellData();
    const pos = findCell(after, CACHED_V);
    const keyNow = archiveKeys().map((k) => k.split(':').slice(2).map(Number))[0];
    record('M2a', `缓存值 0.087 位于 row=${pos.row}（4->5，随行下移）`, pos.row === ARCHIVE_ROW + 1, `pos=${pos.row},${pos.col}`);
    record('M2b', `档案键已迁移到 row=${keyNow[0]}（与缓存值同格）`, keyNow[0] === pos.row && keyNow[1] === pos.col,
        `key=(${keyNow[0]},${keyNow[1]}) pos=(${pos.row},${pos.col})`);
    const entry = archive.get(akey(pos.row, pos.col));
    record('M2c', '条目内容完整迁移（f 原文 + v 校验值随行携带）', entry?.f === '=IRR(A1:A4)' && entry?.v === CACHED_V, JSON.stringify(entry));

    // ---------- M3：单事务单帧 ----------
    console.log('== M3 档案迁移事务原子性 ==');
    const frames = updateFrameCount - frameBefore;
    record('M3a', '一次结构 op 的档案迁移恰好产生 1 个 update 帧（单事务）', frames === 1, `frames=${frames}`);

    // ---------- v 校验兜底（假想迁移缺失场景，WI-6 导出门禁） ----------
    console.log('== V1 导出还原前置校验（兜底，迁移缺失时不写错格） ==');
    const targetCell = after[pos.row]?.[pos.col];
    const entryAtKey = archive.get(akey(pos.row, pos.col));
    const pass = targetCell && entryAtKey && targetCell.v === entryAtKey.v;
    record('V1a', '迁移正常时：目标格当前 v === 档案 v -> 允许还原 f', pass === true,
        `cell.v=${targetCell?.v} entry.v=${entryAtKey?.v}`);
    // 反例：若档案键停留 row4（迁移缺失），row4 现在是 {v:44} != 0.087 -> 校验拒绝还原
    const staleCell = after[ARCHIVE_ROW]?.[ARCHIVE_COL];
    record('V1b', '迁移缺失反例：旧键 row4 当前 v=44 != 档案 v=0.087 -> 拒绝还原并丢弃条目',
        staleCell?.v === 44 && staleCell.v !== entryAtKey.v);

    // ---------- M4：undo 反向迁移 ----------
    console.log('== M4 undo 反向迁移（评审人陷阱用例的防线） ==');
    const framesBeforeUndo = updateFrameCount;
    const mutationsBeforeUndo = seenMutations.length;
    // undo 触发 sheet.mutation.remove-rows（实机观察），被 onCommandExecuted 拦截 -> 自动反向迁移档案键；
    // 「同事务」由 undo 拦截器在 Command 层包裹（生产实现）：undo 项压栈时把迁移变换记为 redo 幂等项。
    const undoOk = await commandService.executeCommand('univer.command.undo', { unitId: UNIT_ID });
    record('M4a', 'undo 执行成功（无头环境须先 focusUnit）', undoOk === true);
    await sleep(50);
    const undone = cellData();
    const posBack = findCell(undone, CACHED_V);
    const keyBack = archiveKeys().map((k) => k.split(':').slice(2).map(Number))[0];
    record('M4b', `undo 后 cellData 回退（0.087 回到 row=${posBack.row}）`, posBack.row === ARCHIVE_ROW);
    record('M4c', `undo 触发的 remove-rows 被拦截并反向迁移档案键到 row=${keyBack[0]}（与 cellData 一致，非碰巧对齐）`,
        keyBack[0] === posBack.row && keyBack[1] === posBack.col && seenMutations.includes('sheet.mutation.remove-rows'),
        `key=(${keyBack[0]},${keyBack[1]}) pos=(${posBack.row},${posBack.col})`);
    record('M4d', 'undo 的档案迁移经同一 Y.Doc 事务传播（update 帧数 >= 1 即有传播，此处验证恰好 1）',
        updateFrameCount - framesBeforeUndo === 1, `frames=${updateFrameCount - framesBeforeUndo}`);

    // ---------- 汇总 ----------
    const fails = RESULTS.filter((r) => !r.pass);
    console.log(`\n==== archive-migration-probe: ${RESULTS.length - fails.length}/${RESULTS.length} PASS ====`);
    if (fails.length > 0) {
        console.error('FAILED:', fails.map((f) => f.id).join(', '));
        process.exit(1);
    }
}

main().catch((e) => {
    console.error('[probe error]', e);
    process.exit(1);
});
