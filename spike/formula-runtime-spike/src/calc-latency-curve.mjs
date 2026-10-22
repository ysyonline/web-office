/**
 * calc-latency-curve.mjs —— B11a 规模拐点曲线补测（P3-002 移交项 ①）
 *
 * 缘起（REPORT.md §4.2）：B11a 在 10 万公式档实测 2404ms，L0 <200ms 未达。
 * 架构师裁定 L0/L1 边界前需要「单格增量重算时延 vs 公式数」的拐点曲线。
 * 本探针在 5 千 / 1 万 / 2 万 / 5 万公式四档测 B11a（低入度单格编辑，事件计时），
 * 其中 2 万公式档恰为现行 L0 边界点（≤20 万格且公式格 ≤2 万）。
 *
 * 形态对齐 calc-latency-probe.mjs（10% 公式密度，每行 10 个 SUM 各引用同行 A..J 10 格）：
 *   公式数 = ROWS × 10；ROWS ∈ {500, 1000, 2000, 5000} → 格数 ∈ {5万, 10万, 20万, 50万}
 * 每档独立 Univer 实例（防跨档缓存污染），B11a 编辑 A{ROWS/2+1}（被同行 10 个公式引用）。
 * 每档跑 3 轮取中位数（B11a 原探针只跑 1 轮；多轮可区分「首次编辑建图」与「稳态」）。
 *
 * 运行：node --max-old-space-size=8192 src/calc-latency-curve.mjs
 */
import {
    Univer, UniverInstanceType, LocaleType,
    ICommandService, IUniverInstanceService,
} from '@univerjs/core';
import { UniverSheetsPlugin, SetRangeValuesCommand } from '@univerjs/sheets';
import { UniverFormulaEnginePlugin, ICalculateFormulaService } from '@univerjs/engine-formula';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';
import { getHeapStatistics } from 'node:v8';

const SUB_UNIT_ID = 'sheet-1';
const COLS = 100;          // 100 列：前 90 列基础值 + 后 10 列公式（10% 密度）
const ROWS_LIST = [500, 1000, 2000, 5000];   // 公式数 = ROWS × 10
const ROUNDS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const heapMB = () => (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);

console.log('== B11a 规模拐点曲线（低入度单格编辑，事件计时，3 轮取中位数） ==');
console.log('Node:', process.version, '| heap limit MB:', (getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(0));
console.log(`形态：${COLS} 列 × 每行 10 个 SUM(同行 A..J) | 档位：${ROWS_LIST.map(r => `${r * 10} 公式/${(r * COLS / 10000).toFixed(0)}万格`).join(' / ')}`);

// 计时门控（与 calc-latency-probe.mjs 同口径：挂 executionCompleteListener$）
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
    const subProgress = calc.executionInProgressListener$.subscribe((st) => { lastProgress = st; });

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
        dispose() { subDone.unsubscribe(); subProgress.unsubscribe(); },
    };
}

function buildCellData(rows) {
    const cellData = {};
    for (let r = 0; r < rows; r++) {
        const row = {};
        for (let c = 0; c < 90; c++) row[c] = { v: (c % 90) + 1, t: 2 };
        for (let k = 0; k < 10; k++) {
            row[90 + k] = { v: 55, t: 2, f: `=SUM(A${r + 1}:J${r + 1})` };
        }
        cellData[r] = row;
    }
    return cellData;
}

const results = [];

for (const ROWS of ROWS_LIST) {
    const UNIT_ID = `curve-book-${ROWS}`;
    const formulas = ROWS * 10;
    const cells = ROWS * COLS;

    const univer = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} }, logLevel: 0 });
    univer.registerPlugin(UniverSheetsPlugin);
    univer.registerPlugin(UniverFormulaEnginePlugin);
    univer.registerPlugin(UniverSheetsFormulaPlugin);

    const tBuild = Date.now();
    const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
        id: UNIT_ID, name: `curve-${ROWS}`, appVersion: '1.0.2', locale: 'zhCN',
        sheetOrder: [SUB_UNIT_ID], styles: {},
        sheets: { [SUB_UNIT_ID]: { id: SUB_UNIT_ID, name: 'Sheet1', cellData: buildCellData(ROWS) } },
    });
    const injector = univer.__getInjector();
    injector.get(IUniverInstanceService).focusUnit(UNIT_ID);
    const commandService = injector.get(ICommandService);
    const gate = makeCalcGate(univer);

    // 初算收敛（值门控：CK1 = SUM(A1:J1) = 55）
    {
        let stable = 0, last = null;
        for (let i = 0; i < 2400; i++) {
            await sleep(25);
            const c = workbook.getSheetBySheetId(SUB_UNIT_ID).getCell(0, 90);
            const v = c ? c.v : null;
            if (v === last && v === 55) { stable++; if (stable >= 5) break; } else { stable = 0; last = v; }
        }
    }

    // B11a：编辑 A{ROWS/2+1}（低入度，被同行 10 个公式引用），3 轮
    const editRow = Math.floor(ROWS / 2);
    const dts = [];
    let progressStr = '';
    for (let round = 0; round < ROUNDS; round++) {
        const newVal = 100 + round; // 每轮换值，防引擎跳过无变化编辑
        gate.arm();
        await commandService.executeCommand(SetRangeValuesCommand.id, {
            unitId: UNIT_ID, subUnitId: SUB_UNIT_ID,
            range: { startRow: editRow, endRow: editRow, startColumn: 0, endColumn: 0 },
            value: { v: newVal, t: 2 },
        });
        const { dt, state, progress } = await gate.waitDone(120_000);
        dts.push(dt);
        progressStr = JSON.stringify(progress);
        const c = workbook.getSheetBySheetId(SUB_UNIT_ID).getCell(editRow, 90);
        const expect = newVal + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10;
        if (!c || c.v !== expect) console.log(`  [警告] ${formulas} 公式档第 ${round + 1} 轮值不符：CK=${c?.v} 期望 ${expect}`);
    }
    const median = dts.sort((a, b) => a - b)[Math.floor(ROUNDS / 2)];
    console.log(`  ${String(formulas).padStart(6)} 公式 / ${String(cells / 10000).padStart(3)}万格 | 构建 ${Date.now() - tBuild}ms | B11a 3轮 ${dts.join('/')}ms 中位 ${median}ms | progress=${progressStr} | heap=${heapMB()}MB`);
    results.push({ formulas, cells, dts, median });

    gate.dispose();
    univer.dispose();
    await sleep(200);
}

// ---------------------------------------------------------------- 汇总

console.log('\n==== B11a 拐点曲线汇总（回填 Spec §9 / ADR-001 v1.7 裁决依据） ====');
console.log('  公式数 |   格数 | 3轮时延(ms) | 中位(ms) | L0<200ms | L1<500ms');
for (const r of results) {
    const l0 = r.median < 200 ? '达标' : '未达';
    const l1 = r.median < 500 ? '达标' : '未达';
    console.log(`  ${String(r.formulas).padStart(6)} | ${String(r.cells / 10000).padStart(4)}万 | ${r.dts.join('/').padEnd(12)} | ${String(r.median).padStart(6)} | ${l0.padEnd(8)} | ${l1}`);
}
console.log('\n[done] 数据交架构师裁定 L0/L1 边界；2 万公式档 = 现行 L0 边界点（≤20 万格且公式格 ≤2 万）。');
process.exit(0);
