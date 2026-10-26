/**
 * 演示工作簿数据（V1.2.2 建，V1.3.1 扩三格式）。
 *
 * 只负责「造一份可验证引擎行为的最小数据」，不含任何挂载逻辑——挂载在 `mount-sheet.ts`。
 *
 * ## 布局（改动必须同步 `scripts/probe-web.mjs` 的 `--formats` 断言）
 *
 * | 区域 | 坐标 | 内容 | 本包要证的事 |
 * |---|---|---|---|
 * | 公式块 | A1 / A2 / A3 | 1 / 2 / `=SUM(A1:A2)` | 加了格式之后公式仍然算出 3 |
 * | 合并区 | A5:B6 | 「合并区」，水平垂直居中 | 跨行列合并后显示正常、只占一个逻辑格 |
 * | 加粗底色 | A8 | 「重点」，`bl=1` + `--color-amber-50` 底色 | 底色来自设计令牌，不是硬编码 |
 * | 货币 | C1 | 1234.5，格式 `¥#,##0.00` | 显示 `¥1,234.50`，值仍是数字 1234.5 |
 *
 * ## 判据设计：A3 为什么只有 `f`、没有 `v`（V1.2.2 的核心，勿「顺手补全」）
 *
 * `spike/formula-runtime-spike/REPORT.md` §1 的 B1/B2 已实证：**浏览器端载入时初算不冲缓存值**
 * ——`v` 与 `f` 并存时，载入后 1s 观察窗内缓存值逐字节保留。
 *
 * 因此：
 * - 若 A3 写成 `{ v: 3, f: '=SUM(A1:A2)' }`，「A3 显示 3」无法证明引擎算过，只是把缓存值显示出来；
 * - 故意写错的缓存（`v: 99`）同样不会被自动纠正（无脏区），「给错值看会不会被改对」也不是有效断言。
 *
 * 结论：**A3 只给 `f`，不给 `v`**。这样 `getValue()` 的任何非 null 返回值都只能由公式引擎产生，
 * 「null → 3」的跃迁本身就是引擎已计算的直接证据（探针采这个跃迁，见 `scripts/probe-web.mjs`）。
 *
 * 反向对照（2026-10-26 实测，不只是引用 spike）：把 A3 临时改成 `{ v: 99, t: 2, f: '=SUM(A1:A2)' }`，
 * preset 装配下 `getValue('A3')` 返回 **99**——引擎**没有**在载入时纠正缓存。
 * 即：若按「顺手补全」的直觉写 `v: 3`，「A3 显示 3」是一条**假绿**判据。
 * 该对照验证后已回退，勿再改回带 `v` 的形态。
 *
 * ## 三格式为什么放在数据里而不是挂载后调 API
 *
 * V1.3.1 要验的是「载入后三种格式共存且互不破坏」。写进 `IWorksheetData` 走的是快照路径，
 * 与 V4 导入真实 xlsx 的路径同构（同样是从数据进、由引擎还原格式）；挂载后再逐一调
 * `merge()` / `setFontWeight()` 验的是另一条链路。前者更接近真实场景，也有利于 V4 复用。
 */
import {
  BooleanNumber,
  CellValueType,
  HorizontalAlign,
  LocaleType,
  VerticalAlign,
  type IWorkbookData,
} from '@univerjs/presets';

/** 子表 id。与 `sheetOrder` 必须逐字一致，否则 `Workbook` 构造会丢掉这张表。 */
export const DEMO_SHEET_ID = 'wo-demo-sheet';

/** 工作簿 id。单文档期固定值；多文档（V2）时由文档标识替换。 */
export const DEMO_WORKBOOK_ID = 'wo-demo-book';

/** 三格式的坐标与期望值（探针 `--formats` 的断言依据，改布局必须同步改那边）。 */
export const DEMO_LAYOUT = {
  /** 合并区左上格与其覆盖范围（行列均从 0 起，闭区间） */
  merge: { ref: 'A5', startRow: 4, startColumn: 0, endRow: 5, endColumn: 1 },
  /** 合并区文本 */
  mergeText: '合并区',
  /** 加粗 + 底色格 */
  emphasis: { ref: 'A8', text: '重点', tokenVar: '--color-amber-50' },
  /** 货币格 */
  currency: { ref: 'C1', value: 1234.5, pattern: '¥#,##0.00', display: '¥1,234.50' },
} as const;

/**
 * 边界三例的坐标与**Excel 侧的对照值**（V1.3.2）。
 *
 * 期望值不是「跑出来多少记多少」，而是先在 Excel 语义下定死，再由探针比对：
 * 1. 空单元格参与 SUM：空值按 0 计 → 10 + (空) + 20 = 30；
 * 2. 文本参与 SUM：区域内文本一律忽略（连 `'5'` 这种看着像数字的也不折算）→ 0 + 0 + 7 = 7；
 * 3. 跨合并区求和：合并区只有左上格存值，其余三格为空 → 3。
 */
export const DEMO_BOUNDARIES = {
  /** ① 空单元格 */
  empty: { input: 'A10:A12', formula: 'B10', expected: 30, inputs: [10, null, 20] },
  /** ② 文本（含像数字的文本） */
  text: { input: 'A14:A16', formula: 'B14', expected: 7, inputs: ['abc', '5', 7] },
  /** ③ 跨合并区（数值型合并区，只为测语义，另加一处不影响 ① ②） */
  mergeSum: {
    range: { startRow: 17, startColumn: 0, endRow: 18, endColumn: 1 },
    topLeft: 'A18',
    value: 3,
    formula: 'C18',
    expected: 3,
  },
} as const;

/** 建数据时的外部输入。底色由调用方按设计令牌解析后传入，本函数不碰 DOM。 */
export interface DemoWorkbookOptions {
  /** 加粗格的底色，应来自 `readTokenColor('--color-amber-50')` 之类的令牌读取 */
  emphasisBg: string;
}

/**
 * 3×3 公式演示 + 三格式演示。
 *
 * 行列下标从 0 起（`cellData[0][0]` 即 A1）。
 * `appVersion` / `locale` / `styles` 三个顶层字段按 `spike` 的实证形态给齐：顶层虽是 `Partial`，
 * 但 `Workbook` 构造会读它们，省掉属于未验证路径（任务卡已列为未核实点，不赌）。
 * `styles` 非空之后顺带验证了「样式表 → 单元格 `s` 引用」这条快照路径。
 */
export function createDemoWorkbookData(options: DemoWorkbookOptions): Partial<IWorkbookData> {
  const { emphasisBg } = options;

  return {
    id: DEMO_WORKBOOK_ID,
    name: '演示工作簿',
    appVersion: '1.2.0',
    locale: LocaleType.ZH_CN,
    styles: {
      // 货币：只给数字格式，不动值本身（值是 1234.5，显示 ¥1,234.50）
      'style-currency': { n: { pattern: DEMO_LAYOUT.currency.pattern } },
      // 合并区文字居中，否则合并后默认左下对齐，视觉上「像没合上」
      'style-merge': {
        ht: HorizontalAlign.CENTER,
        vt: VerticalAlign.MIDDLE,
      },
      // 加粗 + 底色：底色必须是设计令牌解析后的值
      'style-emphasis': { bl: BooleanNumber.TRUE, bg: { rgb: emphasisBg } },
    },
    sheetOrder: [DEMO_SHEET_ID],
    sheets: {
      [DEMO_SHEET_ID]: {
        id: DEMO_SHEET_ID,
        name: 'Sheet1',
        rowCount: 24,
        columnCount: 15,
        mergeData: [
          {
            startRow: DEMO_LAYOUT.merge.startRow,
            startColumn: DEMO_LAYOUT.merge.startColumn,
            endRow: DEMO_LAYOUT.merge.endRow,
            endColumn: DEMO_LAYOUT.merge.endColumn,
          },
          // 边界三例 ③ 用：数值型合并区（A18:B19），左上格存 3，其余三格为空
          {
            startRow: DEMO_BOUNDARIES.mergeSum.range.startRow,
            startColumn: DEMO_BOUNDARIES.mergeSum.range.startColumn,
            endRow: DEMO_BOUNDARIES.mergeSum.range.endRow,
            endColumn: DEMO_BOUNDARIES.mergeSum.range.endColumn,
          },
        ],
        cellData: {
          0: {
            // A1 = 1（常量，带类型）
            0: { v: 1, t: CellValueType.NUMBER },
            // C1 = 1234.5，货币格式
            2: { v: DEMO_LAYOUT.currency.value, t: CellValueType.NUMBER, s: 'style-currency' },
          },
          // A2 = 2（常量，带类型）
          1: { 0: { v: 2, t: CellValueType.NUMBER } },
          // A3 = SUM(A1:A2)：**只给 f，不给 v / t**，见文件头「判据设计」
          2: { 0: { f: '=SUM(A1:A2)' } },
          // 合并区 A5:B6：值只写在左上格
          4: { 0: { v: DEMO_LAYOUT.mergeText, t: CellValueType.STRING, s: 'style-merge' } },
          // A8：加粗 + 底色
          7: {
            0: { v: DEMO_LAYOUT.emphasis.text, t: CellValueType.STRING, s: 'style-emphasis' },
          },
          // ① 空单元格参与 SUM：A10=10、A11 空、A12=20 → B10 应为 30
          9: {
            0: { v: 10, t: CellValueType.NUMBER },
            1: { f: '=SUM(A10:A12)' },
          },
          11: { 0: { v: 20, t: CellValueType.NUMBER } },
          // ② 文本参与 SUM：A14='abc'、A15='5'（文本形态的数字）、A16=7 → B14 应为 7
          13: {
            0: { v: 'abc', t: CellValueType.STRING },
            1: { f: '=SUM(A14:A16)' },
          },
          14: { 0: { v: '5', t: CellValueType.STRING } },
          15: { 0: { v: 7, t: CellValueType.NUMBER } },
          // ③ 跨合并区求和：A18:B19 是合并区，左上 A18=3 → C18 应为 3（其余三格为空，不重复计）
          17: {
            0: { v: DEMO_BOUNDARIES.mergeSum.value, t: CellValueType.NUMBER },
            2: { f: '=SUM(A18:B19)' },
          },
        },
      },
    },
  };
}
