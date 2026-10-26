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

/**
 * 视口滚动状态。
 *
 * 字段与 Univer `IScrollState` 同名，但只保留本包需要的四个——把引擎类型挡在句柄边界外，
 * 存储层（`view-state.ts`）因此不依赖 Univer。
 */
export interface SheetScrollState {
  offsetX: number;
  offsetY: number;
  sheetViewStartRow: number;
  sheetViewStartColumn: number;
}

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
  /**
   * 用一份新快照**整体替换**当前工作簿内容（V2.1）。
   *
   * 实现是「销毁旧单元 + 建新单元」，不是原地改数据——因为 1.2.0 的 `FWorkbook`
   * 没有 `setWorkbookData` 一类方法，只有 `save()` 导出。
   *
   * 实测（2026-10-26，Edge 122，四条判据见 V2.1 任务卡）：替换后 canvas 渲染根不受影响、
   * 无未捕获异常、新快照的公式照常计算。**这正是 V2.1 敢让 `load` 异步的原因**——
   * 界面可以先以空表同步立起来，数据后来的代价只是换一次单元，不需要重建实例。
   *
   * 所有取值器必须读 `current` 而非闭包里的初始 `workbook`，否则换单元后会静默读到旧单元。
   */
  replaceDoc: (doc: Partial<IWorkbookData>) => void;
  /**
   * 导出当前工作簿的完整快照（V2.2 自动保存的数据来源）。
   *
   * 用 `FWorkbook.save()` 而非自己拼结构：它是引擎给出的**唯一对外序列化口径**，
   * 与 `createWorkbook` 的入参同构，因此「存进去的」与「读出来的」天然一致。
   * 自己拼结构会在引擎升级时静默丢字段。
   */
  getSnapshot: () => Partial<IWorkbookData>;
  /**
   * 订阅「工作簿内容被命令改动」。
   *
   * 语义是**可能多次、可能空报**：选区变化、纯重算也会触发命令。
   * 调用方不能假定「收到一次 = 内容变了一次」，去重由调用方按快照哈希做
   * （见 `autosave.ts`）。这样本方法不必维护命令白名单——白名单漏一条就丢一次保存。
   *
   * 换单元（`replaceDoc`）后监听会自动重新挂到新单元上；调用方无需重新订阅。
   *
   * @returns 取消订阅。幂等。
   */
  onChange: (listener: () => void) => () => void;
  /**
   * 当前视口滚动状态（起始行列 + 像素偏移）。
   *
   * 视图未就绪时返回 `null`：`getScrollState()` 依赖 render unit，首帧前调用会抛错。
   * 调用方（含探针）必须把 `null` 当「还没有视口」，不能当「滚到 0」。
   */
  getScrollState: () => SheetScrollState | null;
  /**
   * 把视口滚到指定状态。
   *
   * 用 `sheet.command.scroll-view` 而非公开的 `scrollToCell`：后者把 offset 强制归零，
   * 只能恢复到行/列粒度。命令在 render unit 尚未注册时返回 `false`，调用方需重试。
   */
  applyScrollState: (state: SheetScrollState) => Promise<boolean>;
  /**
   * 订阅视口滚动。回调给出滚动后的完整状态（引擎事件本身只给像素偏移）。
   *
   * @returns 取消订阅。幂等。
   */
  onScroll: (listener: (state: SheetScrollState) => void) => () => void;
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

  // 换单元会替换工作簿对象，故所有取值器都经由 `current` 间接访问——
  // 直接闭包捕获初始 `workbook` 会在 replaceDoc 后静默读到已销毁的旧单元。
  let current = workbook;

  /**
   * 改动监听：命令回调挂在**当前单元**上，换单元时必须拆旧挂新。
   * 漏了重新挂的后果是「编辑照样发生、自动保存再也不触发」——从界面上完全看不出来。
   */
  const changeListeners = new Set<() => void>();
  let commandSub: { dispose: () => void } | null = null;

  const wireChange = (target: typeof current): void => {
    commandSub?.dispose();
    commandSub = target.onCommandExecuted(() => {
      for (const listener of changeListeners) listener();
    });
  };

  wireChange(current);

  /**
   * 读视口状态。
   *
   * `getScrollState()` 内部要取 render unit + scroll manager；换单元后的首帧这些服务
   * 可能尚未注册，会抛错而非返回 0。捕获后返回 `null`，让调用方区分「未就绪」与「在原点」。
   */
  const readScrollState = (): SheetScrollState | null => {
    try {
      const state = current.getActiveSheet().getScrollState();
      return {
        offsetX: state.offsetX,
        offsetY: state.offsetY,
        sheetViewStartRow: state.sheetViewStartRow,
        sheetViewStartColumn: state.sheetViewStartColumn,
      };
    } catch {
      return null;
    }
  };

  const scrollListeners = new Set<(state: SheetScrollState) => void>();
  let scrollSub: { dispose: () => void } | null = null;

  /** 第一次有人订阅时才挂引擎事件；实例级事件，换单元不需要重挂。 */
  const ensureScrollSubscription = (): void => {
    if (scrollSub) return;
    scrollSub = univerAPI.addEvent(univerAPI.Event.Scroll, () => {
      const state = readScrollState();
      if (!state) return;
      for (const listener of scrollListeners) listener(state);
    });
  };

  const handle: SheetHandle = {
    dispose: () => {
      // 先拆监听再销毁实例：销毁过程中引擎还会发命令，此时回调若仍挂着，
      // 会对着已销毁的单元取快照（抛错或读到空文档）。
      commandSub?.dispose();
      commandSub = null;
      scrollSub?.dispose();
      scrollSub = null;
      changeListeners.clear();
      scrollListeners.clear();
      univer.dispose();
    },
    getValueByA1: (a1) => current.getActiveSheet().getRange(a1).getValue(),
    getFormulaByA1: (a1) => current.getActiveSheet().getRange(a1).getFormula(),
    setValueByA1: (a1, value) => {
      current.getActiveSheet().getRange(a1).setValue(value);
    },
    getDisplayByA1: (a1) => current.getActiveSheet().getRange(a1).getDisplayValue(),
    getRawValueByA1: (a1) => current.getActiveSheet().getRange(a1).getRawValue(),
    getStyleByA1: (a1) => current.getActiveSheet().getRange(a1).getCellStyleData(),
    getMergedRanges: () =>
      current
        .getActiveSheet()
        .getMergeData()
        .map((range) => range.getRange()),
    replaceDoc: (doc) => {
      // 旧单元必须先销毁：同 id 重复 createWorkbook 会留下两个单元，且 getActiveWorkbook 指向不确定。
      commandSub?.dispose();
      commandSub = null;
      univerAPI.disposeUnit(current.getId());
      current = univerAPI.createWorkbook(doc);
      // 换单元后重新挂监听，否则后续编辑不会触发自动保存（界面看不出异常）。
      wireChange(current);
    },
    getSnapshot: () => current.save() as Partial<IWorkbookData>,
    onChange: (listener) => {
      changeListeners.add(listener);
      return () => {
        changeListeners.delete(listener);
      };
    },
    getScrollState: readScrollState,
    applyScrollState: async (state) => {
      const sheet = current.getActiveSheet();
      return univerAPI.executeCommand<Record<string, string | number>, boolean>(
        'sheet.command.scroll-view',
        {
          unitId: current.getId(),
          sheetId: sheet.getSheetId(),
          ...state,
        },
      );
    },
    onScroll: (listener) => {
      ensureScrollSubscription();
      scrollListeners.add(listener);
      return () => {
        scrollListeners.delete(listener);
      };
    },
  };

  // dev-only：给 scripts/probe-web.mjs 经 CDP 读取的断言入口。
  // 生产构建 `import.meta.env.DEV === false`，此分支被静态剔除，不暴露任何运行时句柄。
  if (import.meta.env.DEV) {
    (window as DevWindow).__woSheet = handle;
  }

  return handle;
}
