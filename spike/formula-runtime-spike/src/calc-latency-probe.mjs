/**
 * calc-latency-probe.mjs —— B11/B12 重算时延拆档探针（分支 E 追加，headless）
 *
 * 缘起（TASK.md §6）：外部评审分支 E 实测「100 万格/99,828 公式档首编→重算收敛 5,474ms、次编 5,422ms」
 * 是全表/近全表脏区成本。L0/L1 档阈值（<200ms / <500ms）需要「单格增量 vs 全表」分离的定量证据。
 *
 * 断言（定量记录 + 阈值复核，非 PASS/FAIL 二进制）：
 *   B11：100 万格、10% 公式（SUM 10 格）下，dirtyRanges 只标脏「单个被引用基础值格」的
 *        增量重算收敛时延 vs forceCalculation 全表重算时延——预期增量 ms 级、全表秒级，分离清晰。
 *   B12：同文档构造「高入度根格」——全部 SUM 共同引用同一根格，编辑该根格后的增量重算时延
 *        （预期退化为接近全表，命中 L2b 档）。
 *
 * 计时口径（v3，经引擎源码校准）：
 *   引擎执行链是「分片异步」：CalculateFormulaService.execute 每 intervalCount（默认 500）棵
 *   依赖树让出主线程一次（requestImmediateMacroTask），所以不能用「主线程阻塞时长」近似计算时长。
 *   本探针挂 executionCompleteListener$（计算完成事件）做精确门控：
 *     t_start = 触发命令发出时刻；t_done = 完成事件到达时刻；时延 = t_done - t_start。
 *   另挂 executionInProgressListener$ 记录进度（completedFormulasCount / totalFormulasToCalculate），
 *   用于区分「依赖生成阶段」与「公式执行阶段」。
 *
 * 运行：node --max-old-space-size=8192 src/calc-latency-probe.mjs
 *   （100 万格档实测 heap ~1.5GB，8192 起步；本机 15.7GB 物理内存）
 */
import {
    Univer, UniverInstanceType, LocaleType,
    ICommandService, IUniverInstanceService,
} from '@univerjs/core';
import { UniverSheetsPlugin, SetRangeValuesCommand } from '@univerjs/sheets';
import { UniverFormulaEnginePlugin, ICalculateFormulaService } from '@univerjs/engine-formula';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { getHeapStatistics } from 'node:v8';

const UNIT_ID = 'latency-probe-book';
const SUB_UNIT_ID = 'sheet-1';

// ---------------------------------------------------------------- 参数

// 100 万格 = 10,000 行 × 100 列；10% 公式密度 = 100,000 个 SUM（每行 10 个公式，各引用同行 A..J 10 格）
// 形态对齐分支 E 评审（SUM 10 格，99,828 公式档）。
const ROWS = 10_000;
const COLS = 100;
const EMPTY_DIRTY = {
    dirtyNameMap: {}, dirtyDefinedNameMap: {}, dirtySuperTableMap: {},
    dirtyUnitFeatureMap: {}, dirtyUnitOtherFormulaMap: {}, clearDependencyTreeCache: {},
};

console.log('== 环境 ==');
console.log('Node:', process.version, '| heap limit MB:', (getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(0));
console.log(`规模：${ROWS} 行 × ${COLS} 列 = ${(ROWS * COLS / 10000).toFixed(0)} 万格`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rssMB = () => (process.memoryUsage().rss / 1024 / 1024).toFixed(0);
const heapMB = () => (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);

// ---------------------------------------------------------------- 计时工具：挂引擎事件

/**
 * 给一个 Univer 实例挂「计算完成」门控。
 * 返回 waitDone(timeoutMs)：Promise<{dt, state, progress}>——dt 从 startTs 起算。
 * 用法：先 arm()（记录起始时刻并准备监听），触发命令，然后 await waitDone()。
 */
function makeCalcGate(univer) {
    const injector = univer.__getInjector();
    const calc = injector.get(ICalculateFormulaService);
    let doneResolve = null;
    let donePromise = null;
    let lastProgress = null;
    let startTs = 0;
    let armed = false;

    const subDone = calc.executionCompleteListener$.subscribe((data) => {
        if (!armed || !doneResolve) return;
        const dt = Date.now() - startTs;
        const resolve = doneResolve;
        doneResolve = null;
        armed = false;
        resolve({ dt, state: data?.functionsExecutedState, progress: lastProgress });
    });
    const subProgress = calc.executionInProgressListener$.subscribe((st) => {
        lastProgress = st;
    });

    return {
        arm() {
            startTs = Date.now();
            armed = true;
            donePromise = new Promise((resolve) => { doneResolve = resolve; });
        },
        async waitDone(timeoutMs = 120_000) {
            const timeout = new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs));
            const result = await Promise.race([donePromise, timeout]);
            if (!result) {
                armed = false;
                return { dt: timeoutMs, state: 'TIMEOUT', progress: lastProgress };
            }
            return result;
        },
        dispose() {
            subDone.unsubscribe();
            subProgress.unsubscribe();
        },
    };
}

// ---------------------------------------------------------------- 构建

const t0 = Date.now();
function buildCellDataFixed() {
    const cellData = {};
    for (let r = 0; r < ROWS; r++) {
        const row = {};
        for (let c = 0; c < 90; c++) row[c] = { v: (c % 90) + 1, t: 2 };
        for (let k = 0; k < 10; k++) {
            // 90..99 列：每个公式引用同行 A..J（10 格）范围
            row[90 + k] = { v: 55, t: 2, f: `=SUM(A${r + 1}:J${r + 1})` };
        }
        cellData[r] = row;
    }
    return cellData;
}

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} }, logLevel: 0 });
univer.registerPlugin(UniverSheetsPlugin);
univer.registerPlugin(UniverFormulaEnginePlugin);
univer.registerPlugin(UniverSheetsFormulaPlugin);

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID, name: 'latency-probe', appVersion: '1.0.2', locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID], styles: {},
    sheets: { [SUB_UNIT_ID]: { id: SUB_UNIT_ID, name: 'Sheet1', cellData: buildCellDataFixed() } },
});
const injector = univer.__getInjector();
injector.get(IUniverInstanceService).focusUnit(UNIT_ID);
const commandService = injector.get(ICommandService);
console.log(`构建耗时：${Date.now() - t0}ms | 公式数：${ROWS * 10}`);

const cell = (row, col) => {
    const c = workbook.getSheetBySheetId(SUB_UNIT_ID).getCell(row, col);
    return c ? { v: c.v, f: c.f } : null;
};

// 初算收敛门控：挂事件等「计算完成」（载入即触发全量初算）
const gate = makeCalcGate(univer);
{
    gate.arm(); // createUnit 已触发初算（isNodeEnv 立即 start）——若已完成则事件已错过，兜底轮询值
    const expectCK = 55; // SUM(A1:J1)
    let stable = 0, last = null;
    for (let i = 0; i < 2400; i++) {
        await sleep(25);
        const v = cell(0, 90)?.v;
        if (v === last && v === expectCK) { stable++; if (stable >= 5) break; } else { stable = 0; last = v; }
    }
    console.log(`初算收敛（值门控）：CK1=${cell(0, 90)?.v}（期望 ${expectCK}）`);
}
console.log(`载入后稳定态：rss=${rssMB()}MB heap=${heapMB()}MB`);

// ---------------------------------------------------------------- B11：单格增量 vs 全表

console.log('\n== B11 单格增量重算 vs 全表重算（事件计时） ==');

// 11a：编辑一个「仅被同行 10 个公式引用」的基础值格（低入度）——常规编辑链路（自动脏区）
{
    gate.arm();
    await commandService.executeCommand(SetRangeValuesCommand.id, {
        unitId: UNIT_ID, subUnitId: SUB_UNIT_ID,
        range: { startRow: 5000, endRow: 5000, startColumn: 0, endColumn: 0 }, // A5001
        value: { v: 999, t: 2 },
    });
    const { dt, state, progress } = await gate.waitDone(120_000);
    const b1 = cell(5000, 90); // CK5001 = SUM(A5001:J5001)
    const expect = 999 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10; // 1053
    console.log(`  [B11a] 低入度单格编辑（A5001，被 10 公式引用）：${dt}ms | state=${state} | CK5001=${b1.v}（期望 ${expect}）| progress=${JSON.stringify(progress)}`);
    globalThis.__B11a = { dt, value: b1.v, expect, state };
}

// 11b：dirtyRanges 显式标脏单格 -> 增量重算（服务端可控路径）
{
    // 先把 A5001 改回 1，等收敛（事件门控）
    gate.arm();
    await commandService.executeCommand(SetRangeValuesCommand.id, {
        unitId: UNIT_ID, subUnitId: SUB_UNIT_ID,
        range: { startRow: 5000, endRow: 5000, startColumn: 0, endColumn: 0 },
        value: { v: 1, t: 2 },
    });
    await gate.waitDone(120_000);

    gate.arm();
    commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', {
        forceCalculation: false,
        dirtyRanges: [{ unitId: UNIT_ID, sheetId: SUB_UNIT_ID, range: { startRow: 5000, endRow: 5000, startColumn: 0, endColumn: 0 } }],
        ...EMPTY_DIRTY,
    });
    const { dt, state, progress } = await gate.waitDone(120_000);
    console.log(`  [B11b] dirtyRanges 单格增量重算（A5001）：${dt}ms | state=${state} | progress=${JSON.stringify(progress)}`);
    globalThis.__B11b = { dt, state };
}

// 11c：forceCalculation 全表重算
{
    gate.arm();
    commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', {
        forceCalculation: true, dirtyRanges: [], ...EMPTY_DIRTY,
    });
    const { dt, state, progress } = await gate.waitDone(300_000);
    console.log(`  [B11c] forceCalculation 全表重算：${dt}ms | state=${state} | progress=${JSON.stringify(progress)} | rss=${rssMB()}MB heap=${heapMB()}MB`);
    globalThis.__B11c = { dt, state, progress };
}

// ---------------------------------------------------------------- B12：高入度根格（L2b 档）

console.log('\n== B12 高入度根格：全部公式引用同一根格（L2b 档验证） ==');

{
    const univer2 = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} }, logLevel: 0 });
    univer2.registerPlugin(UniverSheetsPlugin);
    univer2.registerPlugin(UniverFormulaEnginePlugin);
    univer2.registerPlugin(UniverSheetsFormulaPlugin);

    const UNIT2 = 'latency-hub-book';
    const cellData2 = {};
    // A1 = 根格（row0 col0）；每行 10 个公式 = $A$1 + r（全部引用同一根格）
    cellData2[0] = { 0: { v: 1, t: 2 } };
    for (let r = 1; r < ROWS; r++) {
        const row = {};
        for (let k = 0; k < 10; k++) row[90 + k] = { v: r, t: 2, f: `=$A$1+${r}` };
        cellData2[r] = row;
    }
    const tBuild = Date.now();
    const wb2 = univer2.createUnit(UniverInstanceType.UNIVER_SHEET, {
        id: UNIT2, name: 'hub', appVersion: '1.0.2', locale: 'zhCN',
        sheetOrder: [SUB_UNIT_ID], styles: {},
        sheets: { [SUB_UNIT_ID]: { id: SUB_UNIT_ID, name: 'Sheet1', cellData: cellData2 } },
    });
    const inj2 = univer2.__getInjector();
    inj2.get(IUniverInstanceService).focusUnit(UNIT2);
    const cmd2 = inj2.get(ICommandService);
    const gate2 = makeCalcGate(univer2);

    // 初算收敛：事件门控 + 值门控双保险（星型依赖图初算可能极慢——这正是要测的发现之一）
    {
        gate2.arm(); // createUnit 触发初算；若事件已错过则值门控兜底
        const t = Date.now();
        const { dt } = await gate2.waitDone(180_000);
        const initCalcMs = dt < 180_000 ? dt : Date.now() - t;
        // 值门控兜底（CK5001 = $A$1+5000 = 5001）
        let stable = 0, last = null;
        for (let i = 0; i < 3600; i++) {
            await sleep(25);
            const v = wb2.getSheetBySheetId(SUB_UNIT_ID).getCell(5000, 90)?.v;
            if (v === last && v === 5001) { stable++; if (stable >= 5) break; } else { stable = 0; last = v; }
        }
        const ck = wb2.getSheetBySheetId(SUB_UNIT_ID).getCell(5000, 90)?.v;
        console.log(`  B12 初算收敛：事件 ${initCalcMs}ms | 值门控总 ${Date.now() - t}ms | CK5001=${ck}（期望 5001）`);
        globalThis.__B12init = { initCalcMs };
    }
    console.log(`  B12 工作簿就绪：10 万公式全部引用 $A$1 | rss=${rssMB()}MB heap=${heapMB()}MB`);

    // 编辑根格 A1 -> 增量重算应退化为近全表
    gate2.arm();
    await cmd2.executeCommand(SetRangeValuesCommand.id, {
        unitId: UNIT2, subUnitId: SUB_UNIT_ID,
        range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
        value: { v: 100, t: 2 },
    });
    const { dt, state, progress } = await gate2.waitDone(300_000);
    const ok = wb2.getSheetBySheetId(SUB_UNIT_ID).getCell(5000, 90)?.v === 5100;
    console.log(`  [B12] 编辑高入度根格 $A$1（被 10 万公式引用）：${dt}ms | state=${state} | CK5001=${wb2.getSheetBySheetId(SUB_UNIT_ID).getCell(5000, 90)?.v}（期望 5100）| progress=${JSON.stringify(progress)}`);
    globalThis.__B12 = { dt, ok, state };

    gate2.dispose();
    univer2.dispose();
}

gate.dispose();

// ---------------------------------------------------------------- 汇总（定量记录，非 PASS/FAIL）

const b11a = globalThis.__B11a, b11b = globalThis.__B11b, b11c = globalThis.__B11c, b12 = globalThis.__B12, b12init = globalThis.__B12init;
console.log('\n==== B11/B12 定量汇总（回填 Spec §9 档位表 / ADR-001 v1.7） ====');
console.log(`  B11a  低入度单格编辑（10 公式引用）    : ${b11a.dt}ms  （L0 档依据：预期 <200ms）`);
console.log(`  B11b  dirtyRanges 单格增量             : ${b11b.dt}ms  （服务端可控路径）`);
console.log(`  B11c  forceCalculation 全表（10万公式）: ${b11c.dt}ms  （L2 档依据：预期秒级）`);
console.log(`  B12i  星型依赖图初算（10万公式同根）    : ${b12init.initCalcMs}ms  （载入时依赖构建成本）`);
console.log(`  B12   高入度根格编辑（10万公式引用）    : ${b12.dt}ms  （L2b 档依据：预期接近全表）`);
console.log(`  分离度：全表/低入度增量 = ${(b11c.dt / Math.max(b11a.dt, 1)).toFixed(1)}x | L2b/低入度 = ${(b12.dt / Math.max(b11a.dt, 1)).toFixed(1)}x`);

const verdict = {
    L0_ok: b11a.dt < 200,
    L2_separate: b11c.dt > 1000 && b11c.dt / Math.max(b11a.dt, 1) > 5,
    L2b_degrades: b12.dt > b11a.dt * 5,
};
console.log(`  阈值复核：L0<200ms=${verdict.L0_ok ? '达标' : '未达'} | 全表/增量分离清晰=${verdict.L2_separate ? '是' : '否'} | L2b 退化成立=${verdict.L2b_degrades ? '是' : '否'}`);
console.log('\n[done] 本探针为定量记录，数值回填 Spec §9 与 ADR-001 v1.7；边界修订由架构师裁定。');
process.exit(0);
