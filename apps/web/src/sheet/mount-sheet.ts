/**
 * Univer 表格引擎挂载（V1.2.1 建实例，V1.2.2 载数据 + 取值句柄）。
 *
 * 只做「把一个工作簿挂进给定 DOM 容器、给出销毁手段与按 A1 取值的手段」。
 * 不含 React——组件侧只负责在 effect 里调 `mountSheet`。
 *
 * 三条设计取舍（实测依据见任务卡 V1.2.1 §2 订正段、V1.2.2 §3）：
 *
 * 1. **不配 `workerURL`**：preset 内部按 `useWorker = !!workerURL` 分流，不传时公式引擎
 *    走主线程（`notExecuteFormula: false`），公式照常计算；一旦传了 `workerURL` 却没同时
 *    把 `UniverSheetsCoreWorkerPreset` 起在 worker 里，公式反而会静默不算。
 *    当前是单表演示量级，主线程足够；worker 化等数据量或协同需求出现再做（归 V3）。
 *
 * 2. **`container` 传 HTMLElement 而非 id 字符串**：`bootstrap` 里字符串分支走
 *    `document.getElementById`，查不到时会 `createElement` 出一个游离节点（不 append），
 *    表现为「实例建成功、界面不出现」。传元素可绕开这条静默失败路径。
 *
 * 3. **取值只走 facade，不读内部快照**：`fRange.getValue()` 是「当前已算出的值」的唯一对外口径。
 *    直接翻 `Worksheet.getCellMatrix()` 会绕过公式结果层，读到的是缓存而非计算结果——
 *    在「初算不冲缓存值」的前提下，那等于自证。
 */
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import zhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import {
  createUniver,
  LocaleType,
  mergeLocales,
  type CellValue,
  type IStyleData,
  type IWorkbookData,
} from '@univerjs/presets';

/** 挂载句柄：销毁 + 按 A1 取值。业务代码仍拿不到 engine 内部实例。 */
export interface SheetHandle {
  dispose: () => void;
  /**
   * 按 A1 记法取当前单元格值（如 `'A3'`）。
   *
   * 值由公式引擎产出；**公式尚未算完时返回 `null`**，调用方须轮询而非假定即时可得
   * （preset 装配下的首次计算时机未验，见 V1.2.2 §3.3）。
   */
  getValueByA1: (a1: string) => CellValue | null;
  /**
   * 按 A1 记法取单元格公式文本（如 `'=SUM(A1:A2)'`），常量格返回空串。
   *
   * 用途是给「值变了」这件事定性：值变而公式未变 → 是重算；公式被写成常量 → 是覆写。
   * 两者在只看 `getValue` 时无法区分。
   */
  getFormulaByA1: (a1: string) => string;
  /**
   * 按 A1 记法写入一个标量值（数字 / 布尔 / 字符串 / 公式），走 Univer 命令链而非直接改快照，
   * 因此会**触发依赖重算**。
   *
   * 返回后**不代表已算完**：重算是命令链下游的异步动作（V1.2.3 实测序列见任务卡），
   * 调用方须轮询目标格而不是「写完立刻读」。
   */
  setValueByA1: (a1: string, value: CellValue) => void;
  /**
   * 格式化的显示文本（如货币格返回 `'¥1,234.50'`）。
   *
   * 与 `getValue` 的区别就是「格式有没有被引擎还原」：值 1234.5 两种读法都拿得到，
   * 只有显示文本能证明数字格式真的生效了。
   */
  getDisplayByA1: (a1: string) => string;
  /**
   * 未经格式化的原始值。
   *
   * 存在理由：带数字格式的格子上，`getValue` 与 `getRawValue` 会给出**不同的东西**
   * （V1.3.1 实测：货币格 `getValue` 得 `'¥1,234.50'`，`getRawValue` 得 `1234.5`）。
   * 需要判断「格式是否把值本身改了」时，必须两读对比，只读一个会得出相反结论。
   */
  getRawValueByA1: (a1: string) => CellValue | null | undefined | void;
  /**
   * 单元格样式原始数据（`bl` / `bg` / `n` 等）。
   *
   * 读原始 `IStyleData` 而非格式化后的 `TextStyleValue`：后者是富文本样式对象，
   * 对单元格级 `bg` / `n` 的呈现不直观，断言「底色是不是那个令牌值」会绕。
   */
  getStyleByA1: (a1: string) => IStyleData | null;
  /** 当前表全部合并区，行列下标从 0 起、闭区间。 */
  getMergedRanges: () => Array<{
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  }>;
}

/** dev-only 全局句柄的形状。生产构建不会挂，故用局部类型而非全局 declare。 */
type DevWindow = Window & { __woSheet?: SheetHandle };

/**
 * 在 `container` 内创建并挂载一个工作簿。
 *
 * @param data 工作簿数据。省略时 `Workbook` 构造函数会补一张默认空表
 *   （`_parseWorksheetSnapshots` 的 `isEmptyObject(sheets)` 分支），即 V1.2.1 的空表行为。
 */
export function mountSheet(container: HTMLElement, data?: Partial<IWorkbookData>): SheetHandle {
  const { univer, univerAPI } = createUniver({
    locale: LocaleType.ZH_CN,
    locales: {
      [LocaleType.ZH_CN]: mergeLocales(zhCN),
    },
    presets: [UniverSheetsCorePreset({ container })],
  });

  const workbook = univerAPI.createWorkbook(data ?? {});

  const handle: SheetHandle = {
    dispose: () => {
      univer.dispose();
    },
    getValueByA1: (a1) => workbook.getActiveSheet().getRange(a1).getValue(),
    getFormulaByA1: (a1) => workbook.getActiveSheet().getRange(a1).getFormula(),
    setValueByA1: (a1, value) => {
      workbook.getActiveSheet().getRange(a1).setValue(value);
    },
    getDisplayByA1: (a1) => workbook.getActiveSheet().getRange(a1).getDisplayValue(),
    getRawValueByA1: (a1) => workbook.getActiveSheet().getRange(a1).getRawValue(),
    getStyleByA1: (a1) => workbook.getActiveSheet().getRange(a1).getCellStyleData(),
    getMergedRanges: () =>
      workbook
        .getActiveSheet()
        .getMergeData()
        .map((range) => range.getRange()),
  };

  // dev-only：给 scripts/probe-web.mjs 经 CDP 读取的断言入口。
  // 生产构建 `import.meta.env.DEV === false`，此分支被静态剔除，不暴露任何运行时句柄。
  if (import.meta.env.DEV) {
    (window as DevWindow).__woSheet = handle;
  }

  return handle;
}
