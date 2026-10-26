/**
 * 表格宿主组件（V1.2.1 建宿主，V1.2.2 载演示数据）。
 *
 * 职责边界：提供一个具备确定尺寸的 DOM 宿主，把引擎生命周期交给 React effect 管，
 * 并把演示数据交给挂载函数。数据内容本身在 `demo-workbook.ts`，本组件不构造单元格。
 *
 * ## 生命周期取舍（实测取证，2026-10-25，Edge 122）
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
 * 欠账：路由化 / 多文档切换时需要有确定的销毁时机，届时改成显式 `disposeSheet(host)`
 * 并在路由离开钩子里调用。归属 V2（一文档一实例）与 V3（多端协同）。
 */
import { useEffect, useRef } from 'react';

import { createDemoWorkbookData } from './demo-workbook';
import { mountSheet, type SheetHandle } from './mount-sheet';

/** 宿主节点 → 实例。StrictMode 二次挂载靠它命中复用，不重复创建。 */
const instances = new WeakMap<HTMLElement, SheetHandle>();

export function SheetHost(): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    // 宿主缺失属于装配错误（JSX 结构被改坏），不该静默跳过。
    if (!host) {
      throw new Error('表格宿主节点未挂载：检查 SheetHost 的 ref 绑定');
    }

    // StrictMode 二次挂载 / HMR 重跑：已有实例直接复用。
    if (instances.has(host)) return;

    const mountPoint = document.createElement('div');
    mountPoint.className = 'sheet-mount';
    host.appendChild(mountPoint);

    instances.set(host, mountSheet(mountPoint, createDemoWorkbookData()));
  }, []);

  return <div className="sheet-host" ref={hostRef} />;
}
