/**
 * 协同装配层（V3.2）：把 `CollabClient` 接到表格引擎上。
 *
 * 与 V2 的 `attachDataSource` 是**两条互斥路径**：协同模式下没有 IndexedDB、
 * 没有自动保存、没有视口持久化（§4.5）。数据真值只在服务端的 Y.Doc，本地只是缓存。
 *
 * 接线只有两个方向：
 * - 引擎用户编辑 → `handle.onCellMutation` → `client.applyLocalCells`；
 * - 客户端内容（LOAD / 远端 / caught-up 整表核对）→ `handle.applyRemoteCells`。
 *
 * 方向为什么不能反过来调用：`applyRemoteCells` 自带 `applyingRemote` 守卫，
 * 但它只保护「执行命令期间」，保护不了「帧处理链」——客户端的 origin 过滤
 * （`local` / `remote` / `load`）才是第一道闸。
 */
import { mountSheet, type SheetHandle } from '../sheet/mount-sheet';

import { createCollabClient, type CollabClient } from './collab-client';

export interface CollabAttachment {
  handle: SheetHandle;
  client: CollabClient;
  detach: () => void;
}

/** dev-only 全局句柄的形状（`window.__woCollab`），生产构建不会挂。 */
type DevWindow = Window & {
  __woCollab?: {
    docId: string;
    status: () => string;
    stats: () => unknown;
  };
};

/**
 * 在 `container` 内挂一张空表，并连上与 `docId` 对应的协同会话。
 *
 * 空表先立（同步），内容后到（异步）——与 V2.1 同一条理由：Univer 实例与工作簿
 * 单元是两层生命周期，不必等网络。协同模式下也不会换单元：内容按格子灌入同一张表。
 */
export function attachCollab(container: HTMLElement, docId: string): CollabAttachment {
  const handle = mountSheet(container, { id: docId, name: docId });

  const client = createCollabClient({
    docId,
    onCells: (cells) => {
      handle.applyRemoteCells(cells);
    },
  });

  const unsubscribe = handle.onCellMutation((cells) => {
    client.applyLocalCells(cells);
  });

  if (import.meta.env.DEV) {
    (window as DevWindow).__woCollab = {
      docId,
      status: client.status,
      stats: client.stats,
    };
  }

  return {
    handle,
    client,
    detach: () => {
      unsubscribe();
      client.close();
      handle.dispose();
    },
  };
}
