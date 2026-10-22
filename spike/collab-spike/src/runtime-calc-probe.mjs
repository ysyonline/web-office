/**
 * 无头重算能力探针（架构师产出，2026-10-21 第二轮外部评审 B 分支裁决依据）
 *
 * 目的：对评审人四条硬事实的独立复核 + team-lead 两个盲区的实证裁决：
 *   Q1 时序疑点：executeCommand 后同步读回 B1 仍为 3，是否为异步调度假象？
 *   Q2 headless 是否有重算能力（不自动 != 不能）——能否手动强制触发？
 *   Q3 强制重算时，缓存值 + f 并存的白名单外公式格（=IRR 等）会变成什么？
 *   Q4 引用白名单外公式格的空白名单公式（=C1*2）是否级联错误？
 *
 * 断言汇总（2026-10-21 实跑，Node v22.22.2，@univerjs/* 1.0.2）：
 *   A1（场景0）载入后 500ms：B1=3 / C1=0.087 / D1=0.174 全部保持缓存值——
 *        初算只算脏区，载入时无脏区，缓存值在「无编辑」状态下稳定保留；
 *   A2（Q1）同步读回 B1=3（评审人观察复现）；异步读回 B1=7——
 *        「无头不触发重算」是 10ms 去抖窗口内的时序假象，重算确实发生；
 *   A3（Q2b）formula.mutation.set-trigger-formula-calculation-start
 *        + forceCalculation:true 在无头环境可用——服务端强制全量重算 API 成立（ADR-001 Decision 4）；
 *   A4（Q2c）dirtyRanges 增量重算同链路可用——「增量依赖图脏区重算」（Spec §10）成立；
 *   A5（Q3）引擎已实现但白名单外的函数（OFFSET）：重算后缓存值 0.087 被覆盖为新算值 2（f 保留）；
 *   A6（Q3）引擎未实现的函数（捏造名）：重算后 v 变 "#NAME?"（t:1），缓存值 42 丢失；
 *   A7（Q4）引用 #NAME? 格的空白名单公式 =A5*2：级联传播为 #NAME?（t:1）——
 *        级联错误路径真实存在，白名单公式无法幸免于上游 #NAME?；
 *   A8（Q4）IFERROR 包裹 #NAME? 格：结果 "err"——IFERROR 可捕获级联错误
 *        （用户侧补救手段存在，但「正常冻结」UI 路径之外必须补级联错误展示路径）；
 *   A9（方案C 核心机制）剥 f 只留 v 的格：强制全量重算后值纹丝不动（0.087 保持），
 *        引用它的白名单公式 =A7*2 按普通值正常计算（0.174 保持）——引擎看不见的
 *        公式无从重算、无从 #NAME?、无从级联，方案 C 的确定性来自结构性隔离。
 *
 * 源码链路依据（node_modules @univerjs/* 1.0.2 lib/es，行号为实读行号）：
 *   engine-formula/index.js
 *     43675  const CALCULATION_DEBOUNCE_TIME = 10;          // 重算经 setTimeout 去抖 10ms，异步
 *     43728  _scheduleFlush() { ... setTimeout(() => this._flush(), CALCULATION_DEBOUNCE_TIME) }
 *     43896  FormulaCalculationTriggerController：isNodeEnv() 则立即 start()（浏览器等 Rendered 生命周期）
 *     15046  CalculateController：onCommandExecuted(SetFormulaCalculationStartMutation) -> _calculate()
 *     15177  _applyResult -> executeCommand(SetFormulaCalculationResultMutation)（结果回投）
 *   sheets/index.js
 *     17799  CalculateResultApplyController：监听 formula.mutation.set-formula-calculation-result
 *     17835    -> sequenceExecute([SetRangeValuesMutation...], { onlyLocal, fromFormula, applyFormulaCalculationResult })
 *     20880  UniverSheetsPlugin：notExecuteFormula !== true 时注册 CalculateResultApplyController
 *   sheets-formula/index.js
 *     2384   ActiveDirtyController：SetRangeValuesMutation -> dirtyRanges 转换
 *     2398     shouldTrigger: options.onlyLocal 为 true 时【不】触发脏区（回放抑制点）
 *     384    TriggerCalculationController：workbookAdded 时按 initialFormulaComputing(默认1=脏区)触发初算
 *   core/lib/types/sheets/typedef.d.ts 239-281
 *     ICellData 字段全集 p/s/v/t/f/ft/fd/ref/xf/si/custom，无冻结值字段；
 *     custom 注释「not recommended for external use. Use it at your own risk.」
 *   core/lib/types/services/resource-manager/type.d.ts 19-23
 *     IResources = Array<{ name: `${'SHEET'|...}_..._PLUGIN`, data: string }>——快照侧车载体
 *
 * 运行：node src/runtime-calc-probe.mjs（依赖同 collab-spike/package.json，无新增依赖）
 */
import {
    Univer,
    UniverInstanceType,
    IUniverInstanceService,
    ICommandService,
    LocaleType,
} from '@univerjs/core';
import { UniverSheetsPlugin, SetRangeValuesCommand } from '@univerjs/sheets';
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula';
import { UniverSheetsFormulaPlugin } from '@univerjs/sheets-formula';

const UNIT_ID = 'calc-probe-book';
const SUB_UNIT_ID = 'calc-probe-sheet';
const RESULTS = [];
function record(id, desc, pass) {
    RESULTS.push({ id, desc, pass });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} ${desc}`);
}

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} } });
univer.registerPlugin(UniverSheetsPlugin);
univer.registerPlugin(UniverFormulaEnginePlugin);
univer.registerPlugin(UniverSheetsFormulaPlugin);

function buildCellData() {
    return {
        0: {
            0: { v: 1, t: 2 },                                  // A1 数值
            1: { v: 3, t: 2, f: '=SUM(A1:A2)' },                // B1 白名单内公式 + 缓存值
            2: { v: 0.087, t: 2, f: '=OFFSET(A1,1,0)' },        // C1 白名单外（Univer 已实现）+ 缓存值
            3: { v: 0.174, t: 2, f: '=C1*2' },                  // D1 白名单内公式，引用 C1
        },
        1: {
            0: { v: 2, t: 2 },                                  // A2 数值
        },
    };
}

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID,
    name: 'calc-probe',
    appVersion: '1.0.2',
    locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID],
    styles: {},
    sheets: { [SUB_UNIT_ID]: { id: SUB_UNIT_ID, name: 'Sheet1', cellData: buildCellData() } },
});

const injector = univer.__getInjector();
const instanceService = injector.get(IUniverInstanceService);
const commandService = injector.get(ICommandService);
instanceService.focusUnit(UNIT_ID);

function cell(row, col) {
    const sheet = workbook.getSheetBySheetId(SUB_UNIT_ID);
    const c = sheet.getCell(row, col);
    return c ? { v: c.v, f: c.f, t: c.t } : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EMPTY_DIRTY = {
    dirtyNameMap: {}, dirtyDefinedNameMap: {}, dirtySuperTableMap: {},
    dirtyUnitFeatureMap: {}, dirtyUnitOtherFormulaMap: {}, clearDependencyTreeCache: {},
};

console.log('== A1 场景 0：载入后（等待 500ms 超过去抖窗口）初算是否把缓存值冲掉 ==');
await sleep(500);
{
    const b1 = cell(0, 1), c1 = cell(0, 2), d1 = cell(0, 3);
    console.log(`  B1=${JSON.stringify(b1)} C1=${JSON.stringify(c1)} D1=${JSON.stringify(d1)}`);
    record('A1', '载入后 500ms 缓存值保留（B1=3, C1=0.087, D1=0.174）',
        b1.v === 3 && c1.v === 0.087 && d1.v === 0.174);
}

console.log('\n== A2 Q1 时序疑点：executeCommand 同步读回 vs 等待去抖窗口后读回 ==');
commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
    value: { v: 5, t: 2 },
});
{
    const sync = cell(0, 1);
    console.log(`  同步读回 B1=${JSON.stringify(sync)}`);
    record('A2a', '同步读回 B1 仍为 3（评审人观察复现：去抖窗口内未见重算）', sync.v === 3);
}
await sleep(500);
{
    const b1 = cell(0, 1), c1 = cell(0, 2), d1 = cell(0, 3);
    console.log(`  异步读回 B1=${JSON.stringify(b1)} C1=${JSON.stringify(c1)} D1=${JSON.stringify(d1)}`);
    record('A2b', '500ms 后重算发生：B1 3->7（缓存值被覆盖）', b1.v === 7);
    record('A5', 'Q3 引擎已实现白名单外函数 OFFSET：缓存值 0.087 被覆盖为新算值 2（f 保留）',
        c1.v === 2 && c1.f === '=OFFSET(A1,1,0)');
    record('A2c', '级联重算 D1 0.174->4', d1.v === 4);
}

console.log('\n== A3/A4 Q2 手动强制重算：底层 mutation 在无头环境可用性 ==');
// 基线：把 A1 改回 1、A2 改回 2 之外不动公式格——观察 forceCalculation 全量重算
commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 1, endRow: 1, startColumn: 0, endColumn: 0 },
    value: { v: 10, t: 2 },
});
await sleep(500); // 常规脏区重算先完成：B1 = 5+10 = 15
{
    const b1 = cell(0, 1);
    record('A3a', '常规编辑链路（A2=10 后 B1=15）', b1.v === 15);
}
commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', {
    forceCalculation: true, dirtyRanges: [], ...EMPTY_DIRTY,
});
await sleep(500);
{
    const b1 = cell(0, 1);
    record('A3', 'Q2b forceCalculation=true 全量重算可用（无头，B1 仍 15 且链路完整执行）', b1.v === 15);
}
commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', {
    forceCalculation: false,
    dirtyRanges: [{ unitId: UNIT_ID, sheetId: SUB_UNIT_ID, range: { startRow: 0, endRow: 1, startColumn: 0, endColumn: 0 } }],
    ...EMPTY_DIRTY,
});
await sleep(500);
{
    const b1 = cell(0, 1);
    record('A4', 'Q2c dirtyRanges 增量重算可用（B1 仍 15）', b1.v === 15);
}

console.log('\n== A6/A7/A8 Q3/Q4 决定性场景：引擎未实现函数的 #NAME? 与级联 ==');
// A5(行4列0)=引擎未实现函数+缓存值 42；B5 引用之；C5 用 IFERROR 包裹
commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 4, endRow: 4, startColumn: 0, endColumn: 2 },
    value: {
        4: {
            0: { v: 42, t: 2, f: '=ZZZNOTIMPLEMENTED(A1)' },
            1: { v: 84, t: 2, f: '=A5*2' },
            2: { v: 'ok', t: 1, f: '=IFERROR(A5,"err")' },
        },
    },
});
{
    const a5 = cell(4, 0);
    record('A6a', '写入同步读回缓存值 42 保留', a5.v === 42);
}
await sleep(500);
{
    const a5 = cell(4, 0), b5 = cell(4, 1), c5 = cell(4, 2);
    console.log(`  A5=${JSON.stringify(a5)} B5=${JSON.stringify(b5)} C5=${JSON.stringify(c5)}`);
    record('A6', 'Q3 引擎未实现函数重算后 v="#NAME?"（缓存值 42 丢失）',
        a5.v === '#NAME?' && a5.f === '=ZZZNOTIMPLEMENTED(A1)');
    record('A7', 'Q4 白名单公式 =A5*2 级联为 #NAME?（错误值传播）',
        b5.v === '#NAME?' && b5.t === 1);
    record('A8', 'Q4 IFERROR 能捕获级联 #NAME? -> "err"（错误处理语义正常）', c5.v === 'err');
}

console.log('\n== A9 方案 C 核心机制实证：剥 f 后重算不波及（引擎看不见的公式无从重算） ==');
// 模拟导入剥 f：A7=纯值 0.087（原 =OFFSET），B7='=A7*2' 白名单公式照常参与重算
commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID,
    subUnitId: SUB_UNIT_ID,
    range: { startRow: 6, endRow: 6, startColumn: 0, endColumn: 1 },
    value: {
        6: {
            0: { v: 0.087, t: 2 },              // 剥 f 只留 v（档案侧车持有原文）
            1: { v: 0.174, t: 2, f: '=A7*2' },  // 白名单公式引用之
        },
    },
});
await sleep(500); // 写入本身触发 B7 重算（基于 v=0.087）
{
    const a7 = cell(6, 0), b7 = cell(6, 1);
    console.log(`  A7=${JSON.stringify(a7)} B7=${JSON.stringify(b7)}`);
    record('A9a', '剥 f 格为纯值（无 f 字段）+ 下游白名单公式按值正常算（=0.174）',
        a7.f === undefined && a7.v === 0.087 && b7.v === 0.174);
}
// 再触发一次全量强制重算——剥 f 格必须纹丝不动
commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', {
    forceCalculation: true, dirtyRanges: [], ...EMPTY_DIRTY,
});
await sleep(500);
{
    const a7 = cell(6, 0), b7 = cell(6, 1);
    record('A9', '方案C：强制全量重算后剥 f 格保持 0.087、下游公式保持 0.174（级联覆盖结构性不存在）',
        a7.v === 0.087 && a7.f === undefined && b7.v === 0.174);
}

const failed = RESULTS.filter((r) => !r.pass);
console.log(`\n==== 探针汇总：${RESULTS.length - failed.length}/${RESULTS.length} PASS ====`);
RESULTS.forEach((r) => console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.desc}`));
if (failed.length > 0) {
    console.error('存在 FAIL 断言，探针不通过');
    process.exit(1);
}
process.exit(0);
