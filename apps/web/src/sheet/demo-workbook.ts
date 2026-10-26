/**
 * 演示工作簿数据（V1.2.2）。
 *
 * 只负责「造一份可验证引擎真在算的最小数据」，不含任何挂载逻辑——挂载在 `mount-sheet.ts`。
 * V1.3 的三格式（合并 / 加粗底色 / 货币格式）会在此文件继续长，故与挂载分离。
 *
 * ## 判据设计：A3 为什么只有 `f`、没有 `v`（本文件的核心，勿「顺手补全」）
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
 * 同理，A3 也不给 `t`：类型应由引擎按计算结果写入，预先写 `t: NUMBER` 等于提前替引擎下结论。
 */
import { CellValueType, LocaleType, type IWorkbookData } from '@univerjs/presets';

/** 子表 id。与 `sheetOrder` 必须逐字一致，否则 `Workbook` 构造会丢掉这张表。 */
export const DEMO_SHEET_ID = 'wo-demo-sheet';

/** 工作簿 id。单文档期固定值；多文档（V2）时由文档标识替换。 */
export const DEMO_WORKBOOK_ID = 'wo-demo-book';

/**
 * 3×3 演示数据：A1=1、A2=2、A3=`=SUM(A1:A2)`。
 *
 * 行列下标从 0 起（`cellData[0][0]` 即 A1）。
 * `appVersion` / `locale` / `styles` 三个顶层字段按 `spike` 的实证形态给齐：顶层虽是 `Partial`，
 * 但 `Workbook` 构造会读它们，省掉属于未验证路径（任务卡已列为未核实点，不赌）。
 */
export function createDemoWorkbookData(): Partial<IWorkbookData> {
  return {
    id: DEMO_WORKBOOK_ID,
    name: '演示工作簿',
    appVersion: '1.2.0',
    locale: LocaleType.ZH_CN,
    styles: {},
    sheetOrder: [DEMO_SHEET_ID],
    sheets: {
      [DEMO_SHEET_ID]: {
        id: DEMO_SHEET_ID,
        name: 'Sheet1',
        rowCount: 24,
        columnCount: 15,
        cellData: {
          // A1 = 1（常量，带类型）
          0: { 0: { v: 1, t: CellValueType.NUMBER } },
          // A2 = 2（常量，带类型）
          1: { 0: { v: 2, t: CellValueType.NUMBER } },
          // A3 = SUM(A1:A2)：**只给 f，不给 v / t**，见文件头「判据设计」
          2: { 0: { f: '=SUM(A1:A2)' } },
        },
      },
    },
  };
}
