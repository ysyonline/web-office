/**
 * 表格宿主组件（V1.2.1 建宿主 → V1.2.2 载演示数据 → V2.1 接 DataSource）。
 *
 * 职责边界：提供一个具备确定尺寸的 DOM 宿主，把**装配**交给 `attachDataSource`，
 * 把**数据从哪来**交给 `DataSource`。本组件既不构造单元格，也不碰存储。
 *
 * ## 生命周期取舍（实测取证，2026-10-25，Edge 122；V2.1 复核后仍成立）
 *
 * 失败方案 A：effect 内 `mountSheet(host)` + cleanup 内同步 `dispose()`。
 * → dev 下表格**完全不出栅格**（canvas=0，仅零星菜单节点）。Univer 的 `dispose()` 内部同步
 *   调用 `ReactDOM.root.unmount()`，而 StrictMode 的双次 effect 让 cleanup 仍处在本轮提交批内，
 *   控制台报 `Attempted to synchronously unmount a root while React was already rendering`。
 *
 * 失败方案 B：独立子容器 + `setTimeout(dispose, 0)` 延后卸载。
 * → 栅格能出来了，但转为 `NotFoundError: removeChild` 未捕获异常：React 卸载引擎内部 root 时
 *   其容器已被挪动。**这是把竞态换了个位置，不是根治。**
 *
 * 采用方案 C：**以宿主节点为键复用实例，effect 不做卸载**。
 * - StrictMode 的第二次 effect 命中 WeakMap 直接返回，不会建出第二个实例（不会两表叠加）；
 * - 不调用 `dispose()`，从根上避开与 React 卸载期的冲突；
 * - 与 Univer 官方 React 示例（只在 effect 里 create、不写 cleanup）一致。
 *
 * ## V2.1 为什么没有把方案 C 拆掉
 *
 * `DataSource.load()` 是 Promise，看起来必须「等数据到了再挂载」——交接件据此把
 * 「异步 load 撞碎同步装配」列为本包最大结构风险。实测结论是不必等：
 * Univer 实例与工作簿单元是两层生命周期，**实例先同步立起来挂空表，数据回来后只换单元**
 * （`disposeUnit` + `createWorkbook`，渲染根不受影响，见 `attach-data-source.ts` 文件头）。
 *
 * 于是 WeakMap 仍然只记「已建好的实例」，`load` 不会因双次 effect 跑两遍，
 * 方案 C 的全部前提原样保留。**这是本包唯一一处「不改结构就解掉了结构风险」的地方，
 * 也是为什么本组件看起来几乎没变。**
 *
 * 欠账：路由化 / 多文档切换时需要有确定的销毁时机，届时改成显式 `detach()`
 * 并在路由离开钩子里调用。归属 V2（一文档一实例）与 V3（多端协同）。
 */
import { useEffect, useRef } from 'react';

import { IndexedDbDataSource } from '../data/indexeddb-data-source';
import { readTokenColor } from '../design/read-token';
import { attachDataSource, type SheetAttachment, type WorkbookDoc } from './attach-data-source';
import { createDemoWorkbookData, DEMO_LAYOUT, DEMO_WORKBOOK_ID } from './demo-workbook';

/** 宿主节点 → 装配结果。StrictMode 二次挂载靠它命中复用，不重复创建。 */
const attachments = new WeakMap<HTMLElement, SheetAttachment>();

/**
 * 演示用数据源（V2.2 起是 IndexedDB，刷新与关标签页都不丢）。
 *
 * 与 V2.1 的内存桩相比只剩一处语义差别，但那处差别正是 H2 假设的全部：
 * **数据在页面之外**。因此这里不再需要「构造时同步写入种子」——
 * 库为空时由 `seedDoc` 在 `load` 返回 `null` 之后写入（见 `attach-data-source.ts`），
 * 那是唯一能区分「新文档」与「读失败」的时机。
 */
let sharedSource: IndexedDbDataSource<WorkbookDoc> | null = null;

function getDataSource(): IndexedDbDataSource<WorkbookDoc> {
  sharedSource ??= new IndexedDbDataSource<WorkbookDoc>();

  // dev-only：给 `probe-web.mjs --data-source` 直接验 load/save/subscribe 三个方法的语义。
  // 生产构建整段被静态剔除。挂实例而非快照——探针要**调**它，不是读它。
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__woDataSource = sharedSource;
  }

  return sharedSource;
}

export function SheetHost(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    // 宿主缺失属于装配错误（JSX 结构被改坏），不该静默跳过。
    if (!host) {
      throw new Error('表格宿主节点未挂载：检查 SheetHost 的 ref 绑定');
    }

    // StrictMode 二次挂载 / HMR 重跑：已有装配直接复用。
    if (attachments.has(host)) return;

    const mountPoint = document.createElement('div');
    mountPoint.className = 'sheet-mount';
    host.appendChild(mountPoint);

    const attachment = attachDataSource(mountPoint, {
      dataSource: getDataSource(),
      docId: DEMO_WORKBOOK_ID,
      /**
       * `load` 尚未回来时立起来的那张表。
       *
       * 刻意**不带演示单元格**：若这里就填 demo 数据，「加载成功」与「降级空表」的界面
       * 会一模一样，V2.3 的降级判据就失去区分能力。这里只给最小骨架，
       * 让「空表 → 有数」这一步在画面上真的发生过。
       */
      emptyDoc: () => ({ id: DEMO_WORKBOOK_ID, name: '未命名' }),
      /** 库为空（新文档）时才写入的初始内容。读失败不走这条路，否则会覆盖原数据。 */
      seedDoc: () =>
        createDemoWorkbookData({
          // 底色从设计令牌取，不写字面量；令牌缺失会直接抛错（见 read-token.ts）
          emphasisBg: readTokenColor(DEMO_LAYOUT.emphasis.tokenVar),
        }),
      onLoadError: (error) => {
        console.error('[SheetHost] 数据源读取失败，已降级为空表', error);
      },
    });

    attachments.set(host, attachment);

    // dev-only：探针要主动触发保存/读状态（`--persist` 段），生产构建静态剔除。
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__woAttach = attachment;
    }
  }, []);

  return <div className="sheet-host" ref={hostRef} />;
}
