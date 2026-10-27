/**
 * 协同模式宿主（V3.2）：`?collab=<docId>` 时替代 V2 的 `SheetHost`。
 *
 * 与 V2 宿主的唯一结构差别是 WeakMap 里存的东西：V2 存 `SheetAttachment`（带自动保存），
 * 这里存 `CollabAttachment`（带 WebSocket）。两者**不能共用一张表**——同一个页面只可能
 * 走其中一条路径，但共用会让「V2 复用实例」的语义悄悄变成「复用协同连接」。
 *
 * StrictMode 的处理与 V2 完全一致：以宿主节点为键复用，第二次 effect 直接返回，
 * 不建第二个 Univer 实例，也不会开第二条 WebSocket。
 */
import { useEffect, useRef } from 'react';

import { attachCollab, type CollabAttachment } from './attach-collab';

const attachments = new WeakMap<HTMLElement, CollabAttachment>();

/** 从当前地址读协同文档 id；无参数或空串视为「不是协同模式」。 */
export function readCollabDocId(): string | null {
  const raw = new URLSearchParams(window.location.search).get('collab');
  if (raw === null) return null;
  const docId = raw.trim();
  return docId === '' ? null : docId;
}

export function CollabHost({ docId }: { docId: string }): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      throw new Error('协同表格宿主节点未挂载：检查 CollabHost 的 ref 绑定');
    }

    if (attachments.has(host)) return;

    const mountPoint = document.createElement('div');
    mountPoint.className = 'sheet-mount';
    host.appendChild(mountPoint);

    attachments.set(host, attachCollab(mountPoint, docId));
  }, [docId]);

  return <div className="sheet-host" ref={hostRef} />;
}
