/**
 * jsdom-smoke.mjs —— jsdom 烟雾基线（P3-002）
 *
 * 定位（TASK.md §2）：只验证「插件注册链不依赖 DOM 之外的环境差异」，**不作 PASS 依据**。
 * 对照：browser-probe.mjs（真浏览器）才是 B1-B10 的判据。
 *
 * 运行：node src/jsdom-smoke.mjs
 */
import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------- jsdom 环境垫片

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true, // requestAnimationFrame
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
try { globalThis.navigator = dom.window.navigator; } catch { /* Node 21+ navigator 只读，保留 Node 原生值 */ }
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.SVGElement = dom.window.SVGElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver ??= class { observe() {} disconnect() {} };
globalThis.IntersectionObserver ??= class { observe() {} disconnect() {} };
globalThis.localStorage ??= dom.window.localStorage ?? { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.self = globalThis.window;

// ---------------------------------------------------------------- Univer 无 UI 冒烟

const RESULTS = [];
function record(id, desc, pass, detail) {
    RESULTS.push({ id, desc, pass, detail: detail ?? '' });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} ${desc}${detail ? ` -- ${detail}` : ''}`);
}

const {
    Univer, UniverInstanceType, LocaleType,
    ICommandService, IUniverInstanceService,
} = await import('@univerjs/core');
const { UniverSheetsPlugin, SetRangeValuesCommand } = await import('@univerjs/sheets');
const { UniverFormulaEnginePlugin } = await import('@univerjs/engine-formula');
const { UniverSheetsFormulaPlugin } = await import('@univerjs/sheets-formula');

console.log('== jsdom 烟雾基线（非 PASS 依据） ==');
console.log('jsdom:', JSDOM.name, '| window:', typeof globalThis.window, '| rAF:', typeof globalThis.requestAnimationFrame);

const UNIT_ID = 'jsdom-smoke-book';
const SUB_UNIT_ID = 'sheet-1';

const univer = new Univer({ locale: LocaleType.ZH_CN, locales: { zhCN: {} }, logLevel: 0 });
univer.registerPlugin(UniverSheetsPlugin);
univer.registerPlugin(UniverFormulaEnginePlugin);
univer.registerPlugin(UniverSheetsFormulaPlugin);

const workbook = univer.createUnit(UniverInstanceType.UNIVER_SHEET, {
    id: UNIT_ID, name: 'jsdom-smoke', appVersion: '1.0.2', locale: 'zhCN',
    sheetOrder: [SUB_UNIT_ID], styles: {},
    sheets: { [SUB_UNIT_ID]: { id: SUB_UNIT_ID, name: 'Sheet1', cellData: {
        0: { 0: { v: 1, t: 2 }, 1: { v: 3, t: 2, f: '=SUM(A1:A2)' } },
        1: { 0: { v: 2, t: 2 } },
    } } },
});
const injector = univer.__getInjector();
injector.get(IUniverInstanceService).focusUnit(UNIT_ID);
const commandService = injector.get(ICommandService);

record('S1', 'jsdom 环境下 core+sheets+formula 注册链可用（无 DOM 相关异常）', true);

await commandService.executeCommand(SetRangeValuesCommand.id, {
    unitId: UNIT_ID, subUnitId: SUB_UNIT_ID,
    range: { startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 },
    value: { v: 5, t: 2 },
});
await new Promise((r) => setTimeout(r, 500));
const b1 = workbook.getSheetBySheetId(SUB_UNIT_ID).getCell(0, 1);
record('S2', 'jsdom 下编辑触发重算（B1 3->7）——与 headless 同构', b1.v === 7, `B1=${JSON.stringify({ v: b1.v, f: b1.f })}`);

const failed = RESULTS.filter((r) => !r.pass);
console.log(`\n==== jsdom 烟雾：${RESULTS.length - failed.length}/${RESULTS.length} PASS（仅烟雾基线，非门禁判据）====`);
process.exit(failed.length ? 1 : 0);
