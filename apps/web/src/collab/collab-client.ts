/**
 * 浏览器协同客户端（V3.2，任务卡 §4.5）。
 *
 * 只负责「一条 WebSocket + 一个 Y.Doc + 一张 `Y.Map`」这三件事：
 *
 * - 与服务端的帧协议（`0x00 SYNC` / `0x03 LOAD` / `0x04 CONTROL`）全部在这里编解码；
 * - 单元格内容的唯一真值是 `Y.Map<A1, {v, f}>`，键是**绝对地址**，值是绝对赋值——
 *   没有相对操作、没有时间戳，两端写同一组键才能收敛（§5.2 风险 3）；
 * - 引擎的接线不在这里（见 `attach-collab.ts`），本文件对 Univer 零依赖。
 *
 * ## 三个非显然的时序决定
 *
 * 1. **`caught-up` 之前不出站**：本地编辑先进 `pendingQueue`，不进 `Y.Map`。
 *    若提前写进去，握手用的 `SYNC_STEP2` 会把本地内容当「客户端已有状态」上送，
 *    服务端先行落库并广播——那就没有「先看完整历史再合入」这一步了。
 * 2. **帧处理串行**：`LOAD` 要解 gzip（异步），而 `SYNC_STEP1` 必须排在它后面。
 *    网页消息本身有序，但异步解压会把顺序打乱，故用一个 Promise 链把处理排成队。
 * 3. **`applyingRemote` 在引擎层**（`mount-sheet.ts`）：服务端的 update 回放经
 *    `Y.applyUpdate(..., 'remote')` 后转为命令执行，`fromCollab` 不会穿透到下游 mutation
 *    （闸门 2 实测），只靠执行选项挡不住回声环。
 */
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as Y from 'yjs';

import type { CellPatch } from '../sheet/mount-sheet';

const FRAME_SYNC = 0x00;
const FRAME_LOAD = 0x03;
const FRAME_CONTROL = 0x04;

const SYNC_STEP1 = 0;
const SYNC_STEP2 = 1;
const SYNC_UPDATE = 2;

/** Y.Map 在 doc 里的名字。两端（以及将来的其它客户端）必须一致。 */
export const CELL_MAP_NAME = 'cells';

/** V1 的 3×3 种子。两端写同一组绝对赋值，谁先谁后都收敛。 */
const SEED_CELLS: CellPatch[] = [
  { ref: 'A1', v: 1, f: '' },
  { ref: 'A2', v: 2, f: '' },
  { ref: 'A3', v: null, f: '=SUM(A1:A2)' },
];

/** 事务来源。只有 `local` 会被发往服务端，其余一律当作入站。 */
const LOCAL_ORIGIN = 'local';
const REMOTE_ORIGIN = 'remote';
const LOAD_ORIGIN = 'load';

export type CollabStatus = 'connecting' | 'loading' | 'ready' | 'closed' | 'error';

export interface CollabStats {
  status: CollabStatus;
  loadVersion: number;
  baseSeq: number;
  /** 已发往服务端的帧数（只含真实内容 update，不含握手 step2）。 */
  sentUpdates: number;
  /** 已应用的入站 update 帧数（含握手回放）。 */
  receivedUpdates: number;
  /** 应用进引擎的批次/格数（含 caught-up 时的整表核对）。 */
  remoteBatches: number;
  remoteCells: number;
  /** 本地写进 Y.Map 的批次/格数（含播种）。回声环会让它无限增长。 */
  localBatches: number;
  localCells: number;
  /** caught-up 之前被缓存的本地编辑格数。 */
  queuedLocal: number;
  /** Y.Map 当前格数。 */
  cells: number;
}

export interface CollabClientOptions {
  docId: string;
  /** 默认 `'/ws/collab/<docId>'`（Vite 代理到 3100）。探针可换绝对地址。 */
  url?: string;
  /** 把远端/加载得到的内容交给引擎。`full=true` 表示整表核对（caught-up 时）。 */
  onCells: (cells: CellPatch[], full: boolean) => void;
}

export interface CollabClient {
  readonly docId: string;
  readonly ydoc: Y.Doc;
  status: () => CollabStatus;
  stats: () => CollabStats;
  /** 引擎侧的用户编辑 → `Y.Map`。未就绪时只排队，不发。 */
  applyLocalCells: (cells: CellPatch[]) => void;
  close: () => void;
}

/** Y.Map 里存的值：只有内容，没有地址（地址就是键）。 */
type StoredCell = Pick<CellPatch, 'v' | 'f'>;

/**
 * 把引擎给的单元格补丁规整成协议值。
 *
 * `v` 允许 `null`（公式格的结果在两端各自算），`f` 缺省为空串（常量格）。
 * 两者的组合就是「这一格的完整内容」——不要带别的字段进来，否则 Y.Map 会存进
 * 无法跨端比较的东西，收敛断言就没法做了。
 */
function normalizePatch(ref: string, value: StoredCell | undefined): CellPatch {
  if (value === undefined) return { ref, v: null, f: '' };
  return {
    ref,
    v: value.v ?? null,
    f: typeof value.f === 'string' ? value.f : '',
  };
}

/** 值签名：只用于「和上次应用进引擎的相比有没有变」，不参与业务判断。 */
function signature(patch: CellPatch): string {
  return JSON.stringify([patch.v, patch.f]);
}

/** LOAD 帧的 snapshot 是 gzip 的 Base64（闸门 1 裁决），浏览器解压后才是 Yjs update。 */
async function gunzipBase64(base64: string): Promise<Uint8Array> {
  if (base64 === '') return new Uint8Array([0, 0]);
  const binary = atob(base64);
  const compressed = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) compressed[i] = binary.charCodeAt(i);
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * 把相对路径解析成绝对 `ws(s)://`。
 *
 * `WebSocket` 构造函数**不接受**相对地址（实测 Edge 122 抛
 * `Failed to construct 'WebSocket': The URL '/ws/collab/x' is invalid`），
 * 而 `fetch` 接受——这是任务卡 §4.5 没写清的一处，浏览器同源写法必须先经过 `URL`。
 * 协议随页面走：https 页面要连 wss，否则连接会被浏览器直接拒绝。
 */
function resolveWsUrl(path: string): string {
  const url = new URL(path, window.location.href);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.href;
}

export function createCollabClient(options: CollabClientOptions): CollabClient {
  const { docId, onCells } = options;
  const url = resolveWsUrl(options.url ?? `/ws/collab/${encodeURIComponent(docId)}`);

  const ydoc = new Y.Doc();
  const cells = ydoc.getMap<StoredCell>(CELL_MAP_NAME);

  let status: CollabStatus = 'connecting';
  let disposed = false;
  let pendingQueue: CellPatch[] = [];
  let loadVersion = 0;
  let baseSeq = 0;
  const counters = {
    sentUpdates: 0,
    receivedUpdates: 0,
    remoteBatches: 0,
    remoteCells: 0,
    localBatches: 0,
    localCells: 0,
  };
  /** ref → 上次应用进引擎的签名。避免重复下发同一格，也让 W5 的计数有上界。 */
  const applied = new Map<string, string>();

  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  const setStatus = (next: CollabStatus): void => {
    if (disposed) return;
    status = next;
  };

  const sendFrame = (subtype: number, payload: Uint8Array): void => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_SYNC);
    encoding.writeVarUint(encoder, subtype);
    encoding.writeVarUint8Array(encoder, payload);
    ws.send(encoding.toUint8Array(encoder));
  };

  /** 本地事务 → 服务端。只有 `local` 来源会走到这里。 */
  ydoc.on('update', (update, origin, _doc, transaction) => {
    if (origin === LOCAL_ORIGIN) {
      counters.localBatches += 1;
      // 播种发生在 ready 之后；这里再判一次 status 是防「ready 之前有代码违规直写」。
      if (status === 'ready') {
        sendFrame(SYNC_UPDATE, update);
        counters.sentUpdates += 1;
      }
      return;
    }

    // `transaction.changed` 的键被 Yjs 标成协变类型，带泛型的 Map 传不进去；这里只按键读，
    // 键的运行时形态就是 `Y.Map` 的字符串键。
    const changedByType = transaction.changed as unknown as Map<unknown, Set<string | number>>;
    const changed = changedByType.get(cells);
    if (changed === undefined || changed.size === 0) return;

    const patches: CellPatch[] = [];
    for (const ref of changed) {
      if (typeof ref !== 'string') continue;
      const patch = normalizePatch(ref, cells.get(ref));
      const sig = signature(patch);
      if (applied.get(ref) === sig) continue;
      applied.set(ref, sig);
      patches.push(patch);
    }
    if (patches.length === 0) return;

    counters.remoteBatches += 1;
    counters.remoteCells += patches.length;
    onCells(patches, false);
  });

  /**
   * 整表核对。
   *
   * caught-up 时**不看 `applied` 缓存**：缓存只在「收到增量」时可信，而握手期间
   * 可能已经有本地编辑被应用到引擎（用户手快）。整表重放一遍是幂等的，代价是几条命令。
   */
  const reconcileAll = (): void => {
    const patches: CellPatch[] = [];
    const seen = new Set<string>();
    cells.forEach((value, ref) => {
      const patch = normalizePatch(ref, value);
      seen.add(ref);
      applied.set(ref, signature(patch));
      patches.push(patch);
    });
    for (const ref of [...applied.keys()]) {
      if (!seen.has(ref)) applied.delete(ref);
    }
    counters.remoteBatches += 1;
    counters.remoteCells += patches.length;
    onCells(patches, true);
  };

  const writeCells = (patches: CellPatch[]): void => {
    ydoc.transact(() => {
      for (const patch of patches) {
        const prev = cells.get(patch.ref);
        if (prev !== undefined && prev.v === patch.v && (prev.f ?? '') === patch.f) continue;
        cells.set(patch.ref, { v: patch.v, f: patch.f });
      }
    }, LOCAL_ORIGIN);
    counters.localCells += patches.length;
  };

  const onCaughtUp = (): void => {
    if (disposed) return;
    setStatus('ready');
    // 两端同时进房时都会看到空 Map，都写同一组值：幂等（§4.5）。
    if (cells.size === 0) writeCells(SEED_CELLS);
    if (pendingQueue.length > 0) {
      writeCells(pendingQueue);
      pendingQueue = [];
    }
    reconcileAll();
  };

  const handleLoad = async (json: string): Promise<void> => {
    const payload = JSON.parse(json) as {
      version?: unknown;
      baseSeq?: unknown;
      snapshot?: unknown;
    };
    loadVersion = typeof payload.version === 'number' ? payload.version : 0;
    baseSeq = typeof payload.baseSeq === 'number' ? payload.baseSeq : 0;
    const snapshot = typeof payload.snapshot === 'string' ? payload.snapshot : '';
    const state = await gunzipBase64(snapshot);
    if (disposed) return;
    setStatus('loading');
    Y.applyUpdate(ydoc, state, LOAD_ORIGIN);
  };

  const handleControl = (json: string): void => {
    const payload = JSON.parse(json) as { type?: unknown };
    if (payload.type === 'caught-up') onCaughtUp();
  };

  const handleSync = (decoder: decoding.Decoder): void => {
    const subtype = decoding.readVarUint(decoder);
    if (subtype === SYNC_STEP1) {
      const stateVector = decoding.readVarUint8Array(decoder);
      // 空 step2 也要发：服务端靠「收到 step2」推进握手（`finishHandshake`）。
      sendFrame(SYNC_STEP2, Y.encodeStateAsUpdate(ydoc, stateVector));
      return;
    }
    if (subtype === SYNC_STEP2 || subtype === SYNC_UPDATE) {
      const update = decoding.readVarUint8Array(decoder);
      Y.applyUpdate(ydoc, update, REMOTE_ORIGIN);
      counters.receivedUpdates += 1;
      return;
    }
    throw new Error(`未知 sync 子类型 ${subtype}`);
  };

  const handleFrame = async (bytes: Uint8Array): Promise<void> => {
    const decoder = decoding.createDecoder(bytes);
    const frame = decoding.readVarUint(decoder);
    if (frame === FRAME_SYNC) {
      handleSync(decoder);
      return;
    }
    if (frame === FRAME_LOAD) {
      await handleLoad(decoding.readVarString(decoder));
      return;
    }
    if (frame === FRAME_CONTROL) {
      handleControl(decoding.readVarString(decoder));
      return;
    }
    throw new Error(`未知帧类型 ${frame}`);
  };

  /**
   * 串行处理队列。
   *
   * 失败只留痕（console.error）并断开：客户端已经无法保证 `Y.Doc` 与服务端一致，
   * 继续装正常比断开更危险。W5 的「无 error」判据要求正常路径下这里一条都不出现。
   */
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): void => {
    chain = chain.then(task).catch((error: unknown) => {
      if (disposed) return;
      console.error('[collab] 帧处理失败，连接将关闭', error);
      setStatus('error');
      try {
        ws.close();
      } catch {
        // 已关闭
      }
    });
  };

  ws.onmessage = (event) => {
    if (!(event.data instanceof ArrayBuffer)) {
      enqueue(async () => {
        throw new Error('收到非二进制帧');
      });
      return;
    }
    const bytes = new Uint8Array(event.data);
    enqueue(() => handleFrame(bytes));
  };

  ws.onerror = () => {
    if (disposed) return;
    setStatus('error');
  };

  ws.onclose = () => {
    if (disposed) return;
    if (status !== 'error') setStatus('closed');
    pendingQueue = [];
  };

  const applyLocalCells = (patches: CellPatch[]): void => {
    if (disposed || status === 'closed' || status === 'error') return;
    if (patches.length === 0) return;
    if (status !== 'ready') {
      pendingQueue.push(...patches);
      return;
    }
    writeCells(patches);
  };

  const stats = (): CollabStats => ({
    status,
    loadVersion,
    baseSeq,
    ...counters,
    queuedLocal: pendingQueue.length,
    cells: cells.size,
  });

  const close = (): void => {
    if (disposed) return;
    disposed = true;
    status = 'closed';
    pendingQueue = [];
    applied.clear();
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    try {
      ws.close();
    } catch {
      // 已关闭
    }
    ydoc.destroy();
  };

  return {
    docId,
    ydoc,
    status: () => status,
    stats,
    applyLocalCells,
    close,
  };
}
