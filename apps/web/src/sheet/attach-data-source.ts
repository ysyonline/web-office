/**
 * 文档装配层（V2.1）：把 `DataSource` 接到表格引擎上。
 *
 * ## 本文件的全部内容只为回答一个问题
 *
 * V1.2.1 的 `SheetHost` 是**同步**装配：effect 里直接 `mountSheet(同步数据)`，并以
 * 「effect 不卸载 + WeakMap 复用实例」绕开 StrictMode 的双次 effect（原因见 mount-sheet.ts 头）。
 *
 * V2.1 引入了 `DataSource.load()`——它是 **Promise**。交接件把这件事列为「本包最大结构风险」：
 * 一旦 `mountSheet` 要等 Promise，effect 就无法同步建实例，而 WeakMap 记不住「正在建的 Promise」，
 * 双次 effect 会并发建出两张表。
 *
 * ## 实测结论：不采用「等 load 完再挂载」
 *
 * 2026-10-26 在 Edge 122 上实测（四条判据全过，含截图取证）：
 * Univer **实例**（`createUniver`，持有 canvas 渲染根）与**工作簿单元**（`createWorkbook`，
 * 持有数据）是两层生命周期。同一实例内 `univerAPI.disposeUnit(id)` + `univerAPI.createWorkbook(data)`
 * 可以整体替换数据，**渲染根不受影响**（canvas 仍在、无异常、新快照的公式照常计算：A1=777/A2=8 → A3=785）。
 *
 * 注意 `FWorkbook` **没有** `setWorkbookData` 这类「原地覆盖」方法（1.2.0 只有 `save()` 导出），
 * 所以「数据后灌」只能走「换单元」而非「改单元」。
 *
 * 因此装配顺序定为：
 * 1. **同步**建实例、同步挂一张空表——与 V1.2.1 完全同构，StrictMode 的问题不会复活；
 * 2. `load()` 在 Promise 里跑，回来后**换单元**灌入真实数据；
 * 3. 期间界面是空表而非白屏，且这张空表本身就是 V2.3「读失败降级空白表」的默认形态。
 *
 * 这样 `WeakMap` 仍然只需要记「已建好的实例」，`load` 的并发问题被绕开——
 * 因为同一宿主节点的第二个 effect 命中 WeakMap 后直接 return，只有一个 `load` 在跑。
 *
 * ## 竞态防护：`load` 回来时组件可能已经卸载
 *
 * 第 2 步的回调里必须再查一次「这个环境是否还活着」，用 `disposed` 标志：
 * `detach()` 置位，回调见到即丢弃结果。丢结果不等于丢数据——
 * 数据已由 `DataSource` 持有，下次挂载重新 `load` 即可。
 *
 * 曾写过 `generation` 计数器做「第几轮装配」的比对，但本包只有一个装配入口、
 * 一个 detach 点，两者恒同时变化，该判据永远不可能独立生效——是死代码，已删。
 * 将来真出现「同一容器换文档」时才需要它，那时再引入。
 */
import type { IWorkbookData } from '@univerjs/presets';
import type { DataSource } from '@wo/shared';

import { createAutosave, type AutosaveEventKind, type AutosaveState } from './autosave';
import { mountSheet, type SheetHandle, type SheetScrollState } from './mount-sheet';
import { clearViewState, createViewStateWriter, readViewState } from './view-state';

/** web 侧把泛型填实为 Univer 快照。规则 H 要求这个具体类型只能出现在 web 里。 */
export type WorkbookDoc = Partial<IWorkbookData>;

/** 装配一份文档所需的全部输入。 */
export interface AttachOptions {
  /** 数据源实现（V2.2 由 IndexedDB 提供，V2.1 用内存桩做验证） */
  dataSource: DataSource<WorkbookDoc>;
  /** 文档标识 */
  docId: string;
  /**
   * `load` 返回 `null`（文档不存在）时的初始快照。
   *
   * 用途：新文档第一次打开时不该是「一张连列宽都没有的原始空表」，
   * 而应带上默认行列数与表名——这份数据由调用方给，装配层不猜。
   */
  emptyDoc: () => WorkbookDoc;
  /**
   * `load` 返回 `null`（文档不存在）时，要写进库并显示的初始内容（V2.2）。
   *
   * 与 `emptyDoc` 的分工：`emptyDoc` 是**加载中**的占位骨架，只在界面存在几百毫秒，
   * 从不落盘；`seedDoc` 是**新文档的真正初始内容**，会写进 `DataSource`。
   * 二者不能合并——若让 `emptyDoc` 也落盘，那么「读失败」降级出的空表就会被当成
   * 新文档写回库，把用户原有的数据覆盖掉。
   */
  seedDoc?: () => WorkbookDoc;
  /** 自动保存节流：静默时长（ms），默认 400 */
  autosaveDebounceMs?: number;
  /** 自动保存节流：最迟落盘时长（ms），默认 1500 */
  autosaveMaxWaitMs?: number;
  /** 每次保存成功后的回调（显示「已保存 hh:mm」之类） */
  onSaved?: (info: { savedAt: number; bytes?: number | undefined }) => void;
  /**
   * `load` 抛错时的处理。
   *
   * 默认行为是**吞掉并保留空表**（V2.3 要求「读失败降级空白表而非白屏」），
   * 但要留下可观测痕迹：`onLoadError` 存在时交给它，否则打 `console.error`。
   * 刻意不向上抛——抛进 effect 会让 React 卸载整棵子树，那正是白屏。
   */
  onLoadError?: (error: unknown) => void;
}

/** 装配结果：句柄 + 就绪信号 + 拆解函数。 */
export interface SheetAttachment {
  /** 底层引擎句柄，取值/写值都走它 */
  handle: SheetHandle;
  /**
   * 真实数据是否已灌入。
   *
   * 存在的理由：调用方（含探针）需要区分「空表挂好了」与「数据到了」——
   * 只看 `handle` 有没有值，会把「空表的 null」误判成「加载失败」。
   */
  isLoaded: () => boolean;
  /**
   * 立刻把当前内容落盘并等它完成（V2.2）。
   *
   * 用途：`pagehide` 兜底、显式的「保存」按钮、以及探针断言。
   * 注意**不是**「保存节流的替代」：正常路径靠自动保存，这里只是关页面前的最后一脚。
   */
  saveNow: () => Promise<void>;
  /** 自动保存状态（脏、在飞、上次保存时刻），供状态栏与探针读取。 */
  autosaveState: () => AutosaveState;
  /** 拆掉实例。V2.1 不在组件卸载时调用（沿用 V1.2.1 结论），留给多文档场景。 */
  detach: () => void;
}

/**
 * dev-only 装配轨迹（`window.__woAttachTrace`）。
 *
 * 为什么需要它：V2.1 的判据是「数据确实经 `DataSource` 流入」，而这句话**无法从界面看出来**——
 * 直接把 demo 数据传给 `mountSheet` 也能得到一模一样的画面。若只断言「A1=1」，就等于
 * 用「结果相同」去证明「路径相同」，是假绿。
 *
 * 轨迹只记**事实与时刻**（何时开始 load、何时替换单元、换了哪个 docId），不记数据内容，
 * 也不参与任何业务判断。生产构建下 `import.meta.env.DEV === false`，整段被静态剔除。
 */
interface AttachTraceEvent {
  /**
   * `mount` = 空表挂好；`load:start` / `load:end` / `load:null` / `load:error`；`replace`；
   * `save:start` / `save:end` / `save:skip` / `save:error`（V2.2 自动保存）。
   */
  kind:
    | 'mount'
    | 'load:start'
    | 'load:end'
    | 'load:null'
    | 'load:error'
    | 'replace'
    | 'view:restore'
    | AutosaveEventKind;
  docId: string;
  /** `performance.now()` 时刻，用于证明「空表先于数据」而非同批完成 */
  at: number;
  /** replace 时记录被替换掉的单元 id，用于证明换单元真的发生过 */
  detail?: string | undefined;
}

type TraceWindow = Window & { __woAttachTrace?: AttachTraceEvent[] };

function trace(event: Omit<AttachTraceEvent, 'at'>): void {
  if (!import.meta.env.DEV) return;
  const w = window as TraceWindow;
  w.__woAttachTrace ??= [];
  w.__woAttachTrace.push({ ...event, at: Math.round(performance.now()) });
}

/**
 * 把一个 `DataSource` 接到 `container` 上的表格实例。
 *
 * 同步返回：实例与空表在这一刻就已就绪；真实数据随后异步灌入。
 */
export function attachDataSource(container: HTMLElement, options: AttachOptions): SheetAttachment {
  const { dataSource, docId, emptyDoc, seedDoc, onLoadError, onSaved } = options;

  // 第 1 步：同步建实例 + 同步挂空表（与 V1.2.1 同构）。
  const handle = mountSheet(container, emptyDoc());
  trace({ kind: 'mount', docId });

  let loaded = false;
  let disposed = false;

  const reportError = (error: unknown): void => {
    if (onLoadError) {
      onLoadError(error);
      return;
    }
    console.error('[attachDataSource] load 失败，已降级为空表', error);
  };

  const autosave = createAutosave<WorkbookDoc>({
    dataSource,
    docId,
    getSnapshot: () => handle.getSnapshot(),
    debounceMs: options.autosaveDebounceMs,
    maxWaitMs: options.autosaveMaxWaitMs,
    onSaved: (result) => {
      onSaved?.({ savedAt: result.savedAt, bytes: result.bytes });
    },
    onError: (error) => {
      // 保存失败不像读失败那样能降级：数据还在内存里，只是没落盘。
      // 这里只留痕（trace + console），不弹窗、不阻断编辑——下一次改动会再试。
      console.error('[attachDataSource] 自动保存失败，改动仍在内存中', error);
    },
    onEvent: (kind, detail) => {
      trace({ kind, docId, detail });
    },
  });

  const viewWriter = createViewStateWriter(docId);
  let unsubscribeScroll: (() => void) | null = null;

  /** 恢复完成后才开始订阅：避免恢复动作自己触发一次无意义的落盘。 */
  const startViewPersistence = (): void => {
    if (unsubscribeScroll !== null || disposed) return;
    unsubscribeScroll = handle.onScroll((state) => viewWriter.schedule(state));
  };

  const sameViewState = (a: SheetScrollState, b: SheetScrollState): boolean =>
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.sheetViewStartRow === b.sheetViewStartRow &&
    a.sheetViewStartColumn === b.sheetViewStartColumn;

  /**
   * 恢复视口（V2.3）。
   *
   * 必须在真实数据 `replaceDoc` 之后：新单元可能换了 sheetId，且 render unit 要等挂载完成。
   * `applyScrollState` 在 render unit 未注册时返回 `false`，故重试约 600ms。
   * **失败只放弃视口，不影响内容**——视口是可丢的 UI 状态，绝不能因此让表格白屏。
   */
  const restoreViewState = async (): Promise<void> => {
    const saved = readViewState(docId);
    if (saved === null) {
      startViewPersistence();
      return;
    }

    const maxAttempts = 30;
    const retryMs = 20;
    let attempts = 0;
    let matched = false;

    while (attempts < maxAttempts && !disposed) {
      attempts += 1;
      let applied = false;
      try {
        applied = await handle.applyScrollState(saved);
      } catch {
        applied = false;
      }
      if (disposed) return;

      // 命令是同步派发的，但 render/scroll manager 的提交要等下一拍。
      await new Promise<void>((resolve) => {
        setTimeout(resolve, retryMs);
      });
      if (disposed) return;

      const now = handle.getScrollState();
      if (applied && now !== null && sameViewState(now, saved)) {
        matched = true;
        break;
      }
    }

    trace({
      kind: 'view:restore',
      docId,
      detail: matched ? `ok attempts=${attempts}` : `give-up attempts=${attempts}`,
    });
    startViewPersistence();
  };

  /**
   * 编辑 → 自动保存的唯一入口。
   *
   * `if (!loaded) return` 是**必须的**，不是保守：空表先挂起来、真实数据还没回来时，
   * 引擎自己就会发一批命令（初始化、选区、格式）。若此时自动保存生效，就会把
   * **空表**写进库，把用户原有数据直接覆盖掉——这是本包最危险的一处竞态。
   */
  const unsubscribeChange = handle.onChange(() => {
    if (!loaded) return;
    autosave.notifyChange();
  });

  /** 关页面/切后台的最后一脚。失败只留痕——此时已经没有界面可以提示了。 */
  const flushOnHide = (): void => {
    // 视口是同步写，先落它；保存失败也只是「这次没存上」，不能挡住视口。
    viewWriter.flush();
    if (!loaded) return;
    void autosave.flush().catch((error: unknown) => {
      console.error('[attachDataSource] 页面隐藏前保存失败', error);
    });
  };
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') flushOnHide();
  };
  window.addEventListener('pagehide', flushOnHide);
  document.addEventListener('visibilitychange', onVisibilityChange);

  // 第 2 步：异步灌真实数据。
  void (async () => {
    try {
      trace({ kind: 'load:start', docId });
      const doc = await dataSource.load(docId);

      // 守卫：已 detach 就丢弃结果。此时数据仍安全存在 DataSource 里，下次挂载重新 load 即可。
      if (disposed) return;

      // `null` = 文档不存在（新文档）。空表已经是正确形态，不必再灌一次。
      if (doc === null) {
        trace({ kind: 'load:null', docId });
        if (seedDoc) {
          // 新文档：写入初始内容并显示。先 replaceDoc 再 save——
          // 反过来的话，save 期间界面还是空表，用户看到的是「闪一下空表」。
          const seed = seedDoc();
          handle.replaceDoc(seed);
          trace({ kind: 'replace', docId, detail: 'seed' });
          const result = await dataSource.save(docId, seed);
          trace({ kind: 'save:end', docId, detail: `seed bytes=${result.bytes ?? '?'}` });
        }
        loaded = true;
        // prime 必须放在 loaded 之后：它把「当前快照」记为基线，
        // 拦掉载入时刻引擎自发命令引起的假改动。
        autosave.prime();
        // 新文档没有历史视口；清掉同 id 的残留，避免把种子表滚到奇怪位置。
        clearViewState(docId);
        startViewPersistence();
        return;
      }

      trace({ kind: 'load:end', docId });
      handle.replaceDoc(doc);
      trace({ kind: 'replace', docId });
      loaded = true;
      autosave.prime();
      void restoreViewState();
    } catch (error) {
      // 读失败：空表保留，不让异常冒进 effect（那会卸载整棵子树 = 白屏）。
      // 注意此时**不**设 loaded：读失败后自动保存必须保持关闭，
      // 否则用户随手改一格就会把空表写进库，覆盖掉可能只是暂时读不出的原数据。
      if (disposed) return;
      trace({ kind: 'load:error', docId, detail: String(error) });
      reportError(error);
    }
  })();

  return {
    handle,
    isLoaded: () => loaded,
    saveNow: () => autosave.flush(),
    autosaveState: () => autosave.state(),
    detach: () => {
      disposed = true;
      window.removeEventListener('pagehide', flushOnHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeChange();
      unsubscribeScroll?.();
      unsubscribeScroll = null;
      viewWriter.stop();
      autosave.stop();
      handle.dispose();
    },
  };
}
