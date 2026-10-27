/**
 * V3.2 协同权威态（任务卡 `docs/phase3/tasks/V3.2.md` §4.3）。
 *
 * 每个 doc 一个进程内 `Y.Doc`，单实例单写者：所有客户端增量先 `Y.applyUpdate` → 先落库
 * → 再广播。客户端断开只出房，不销毁 doc（本卡无 LRU/驱逐，见 §6 欠账 8）。
 *
 * 帧协议（openapi x-websocket.frame-protocol）：
 * - `0x00 SYNC`：lib0 sync 消息（0 step1 / 1 step2 / 2 update）。
 *   出站用 `y-protocols/sync` 的 writer；**入站手工拆 subtype**——`readSyncMessage` 会把
 *   update 直接应用进 doc，不暴露原始字节，等于堵死「先落库再广播」的 write-through 时序。
 * - `0x03 LOAD`（服务端下发）：`writeVarString(JSON.stringify({version, baseSeq, snapshot}))`，
 *   snapshot 是「Yjs state update 经 gzip(6)」的 Base64（闸门 1 裁决）。
 * - `0x04 CONTROL`（服务端下发）：`writeVarString(JSON.stringify({type: 'caught-up'}))`。
 *
 * 握手（§4.3，顺序是判据的一部分）：
 *   LOAD（库里的最新快照，不是内存当前态）→ SYNC_STEP1 → 客户端 SYNC_STEP2 →
 *   按 seq 升序回放 `seq > baseSeq` → 补发握手期间缓冲的广播 → CONTROL caught-up。
 * 快照只在 LOAD 里发「已物化」的那份；内存当前态与它的差由回放补齐——否则 C6 就分不清
 * 「新连接走了 snapshot@base_seq」还是「直接把内存态整份塞过去」。
 *
 * 关闭码：未知/非 SYNC 帧 → 1008；截断的 lib0 或非法 update → 1003；读库/写库失败 → 1011。
 * 上行 `0x01/0x02/0x05` 属未实现能力，按 1008 处理（不是「坏编码」，不报 1003）。
 */
import { gunzipSync, gzipSync } from 'node:zlib';

import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocket } from 'ws';
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
  writeSyncStep1,
  writeSyncStep2,
  writeUpdate,
} from 'y-protocols/sync';
import * as Y from 'yjs';

import { WoDb, type UpdateRow } from '../../db/wo-db';

/** 帧头（< 128，varUint 编码即单字节，与 openapi 的十六进制一致）。 */
export const FRAME_SYNC = 0x00;
export const FRAME_LOAD = 0x03;
export const FRAME_CONTROL = 0x04;

/** 无登录，审计字段占位（§6 欠账 9）。 */
const ANONYMOUS = 'anonymous';
const GZIP_LEVEL = 6;

export interface LoadPayload {
  version: number;
  baseSeq: number;
  /** Yjs state update 经 gzip 的 Base64。 */
  snapshot: string;
}

export interface SnapshotPayload {
  version: number;
  baseSeq: number;
  snapshot: string;
}

interface PendingUpdate {
  seq: number;
  update: Uint8Array;
}

interface ClientState {
  readonly ws: WebSocket;
  caughtUp: boolean;
  /** 本连接 LOAD 帧携带的水位线；回放从 `seq > baseSeq` 开始。 */
  readonly baseSeq: number;
  /** caught-up 之前的并发广播，按 seq 升序、在回放之后补发。 */
  readonly pending: PendingUpdate[];
}

interface DocRoom {
  readonly docId: string;
  readonly ydoc: Y.Doc;
  readonly clients: Map<WebSocket, ClientState>;
}

@Injectable()
export class CollabCoreService implements OnApplicationShutdown {
  private readonly logger = new Logger(CollabCoreService.name);
  private readonly rooms = new Map<string, DocRoom>();

  constructor(@Inject(WoDb) private readonly db: WoDb) {}

  /**
   * 挂接一个新连接：确保 doc 已从库重建，然后发 LOAD + SYNC_STEP1。
   *
   * 读库/解压失败向上抛，由 WS 层关 1011——这里不吞异常，否则客户端会停在一个永远
   * 收不到 caught-up 的连接上。
   */
  attach(ws: WebSocket, docId: string): void {
    const room = this.roomFor(docId);
    const latest = this.db.latestSnapshot(docId);
    const version = latest?.version ?? 0;
    const baseSeq = latest?.baseSeq ?? 0;
    const snapshot = Buffer.from(latest?.snapshot ?? emptySnapshot()).toString('base64');

    room.clients.set(ws, { ws, caughtUp: false, baseSeq, pending: [] });
    this.sendLoad(ws, { version, baseSeq, snapshot });
    this.sendSyncStep1(ws, room.ydoc);
  }

  /** 连接断开：只出房。doc 保留（无 LRU）。 */
  detach(ws: WebSocket, docId: string): void {
    this.rooms.get(docId)?.clients.delete(ws);
  }

  /** 上行帧入口；关闭由本方法决定，WS 层只负责搬运字节。 */
  receive(ws: WebSocket, docId: string, data: Uint8Array): void {
    const room = this.rooms.get(docId);
    const client = room?.clients.get(ws);
    if (room === undefined || client === undefined) {
      this.close(ws, 1011, 'not attached');
      return;
    }
    if (data.byteLength === 0) {
      this.close(ws, 1003, 'empty frame');
      return;
    }

    const decoder = decoding.createDecoder(data);
    let header: number;
    try {
      header = decoding.readVarUint(decoder);
    } catch {
      this.close(ws, 1003, 'invalid lib0 frame');
      return;
    }
    if (header !== FRAME_SYNC) {
      // 0x01/0x02/0x03/0x04/0x05 与未知值都在这里：前三类是本卡未实现的上行能力，
      // 后两类是服务端下发方向——方向违规，同属 1008。
      this.close(ws, 1008, `unsupported frame ${header}`);
      return;
    }

    let subtype: number;
    try {
      subtype = decoding.readVarUint(decoder);
    } catch {
      this.close(ws, 1003, 'truncated sync frame');
      return;
    }

    switch (subtype) {
      case messageYjsSyncStep1:
        this.onSyncStep1(ws, room.ydoc, decoder);
        return;
      case messageYjsSyncStep2:
        this.onClientUpdate(room, client, decoder, true);
        return;
      case messageYjsUpdate:
        this.onClientUpdate(room, client, decoder, false);
        return;
      default:
        this.close(ws, 1003, `unknown sync subtype ${subtype}`);
    }
  }

  /**
   * 物化快照：`Y.encodeStateAsUpdate` → gzip(6) → 与水位线同事务落库。
   *
   * 全程同步，故「编码时的状态」和「事务里的 max(seq)」之间没有可插入的 await——
   * 水位线不会落后于快照内容（openapi 的原子性要求）。
   */
  materialize(docId: string): { version: number; baseSeq: number } {
    const room = this.roomFor(docId);
    const state = Buffer.from(Y.encodeStateAsUpdate(room.ydoc));
    const gzipped = gzipSync(state, { level: GZIP_LEVEL });
    const row = this.db.materialize(docId, gzipped, ANONYMOUS);
    return { version: row.version, baseSeq: row.baseSeq };
  }

  /** 最新快照；无则 null（GET 端点据此回 404）。 */
  readSnapshot(docId: string): SnapshotPayload | null {
    const row = this.db.latestSnapshot(docId);
    if (row === null) return null;
    return {
      version: row.version,
      baseSeq: row.baseSeq,
      snapshot: Buffer.from(row.snapshot).toString('base64'),
    };
  }

  onApplicationShutdown(): void {
    for (const room of this.rooms.values()) {
      for (const client of room.clients.values()) {
        try {
          client.ws.terminate();
        } catch {
          // 关停期间单个坏连接不阻断其它连接
        }
      }
      room.ydoc.destroy();
    }
    this.rooms.clear();
  }

  /** 取或重建 doc：最新快照 + `seq > baseSeq` 的增量，顺序固定。 */
  private roomFor(docId: string): DocRoom {
    const existing = this.rooms.get(docId);
    if (existing !== undefined) return existing;

    const ydoc = new Y.Doc();
    const latest = this.db.latestSnapshot(docId);
    if (latest !== null) {
      let state: Uint8Array;
      try {
        state = gunzipSync(latest.snapshot);
      } catch (err) {
        throw new Error(`[CollabCore] 快照解压失败 doc=${docId}: ${describeError(err)}`);
      }
      Y.applyUpdate(ydoc, state, 'snapshot');
    }
    const baseSeq = latest?.baseSeq ?? 0;
    for (const row of this.db.updatesSince(docId, baseSeq)) {
      Y.applyUpdate(ydoc, row.update, 'replay');
    }

    const room: DocRoom = { docId, ydoc, clients: new Map() };
    this.rooms.set(docId, room);
    return room;
  }

  private onSyncStep1(ws: WebSocket, ydoc: Y.Doc, decoder: decoding.Decoder): void {
    let stateVector: Uint8Array;
    try {
      stateVector = decoding.readVarUint8Array(decoder);
    } catch {
      this.close(ws, 1003, 'truncated sync step1');
      return;
    }
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_SYNC);
    writeSyncStep2(encoder, ydoc, stateVector);
    this.sendBytes(ws, encoding.toUint8Array(encoder));
  }

  /**
   * step2 与 update 共用一条路径，差异只有「空 step2 不算内容」。
   *
   * 客户端无本地内容时 `writeSyncStep2` 产出 `[0,0]`；若把它也落库，C5 的
   * `baseSeq === 2` 会变成 3，且每次握手白涨一条 seq。UPDATE 帧不做此豁免：
   * 客户端只在真实 mutation 后发它，重复帧按协议本就该幂等落库。
   */
  private onClientUpdate(
    room: DocRoom,
    client: ClientState,
    decoder: decoding.Decoder,
    isHandshake: boolean,
  ): void {
    let update: Uint8Array;
    try {
      update = decoding.readVarUint8Array(decoder);
    } catch {
      this.close(client.ws, 1003, 'truncated update');
      return;
    }

    if (!(isHandshake && isEmptyUpdate(update))) {
      try {
        Y.applyUpdate(room.ydoc, update, 'client');
      } catch (err) {
        this.logger.warn(`[${room.docId}] 非法 update：${describeError(err)}`);
        this.close(client.ws, 1003, 'invalid update');
        return;
      }

      let seq: number;
      try {
        seq = this.db.appendUpdate(room.docId, update, 'client', ANONYMOUS);
      } catch (err) {
        // 内存已应用但库未落：不广播、关 1011。重启后这条增量丢失，属于本卡的已知
        // 失败面（RPO=0 的前提是写成功），不在此做回滚或补偿。
        this.logger.error(`[${room.docId}] 增量写入失败，关闭 1011：${describeError(err)}`);
        this.close(client.ws, 1011, 'append failed');
        return;
      }

      this.relay(room, client.ws, seq, update);
    }

    if (isHandshake && !client.caughtUp) this.finishHandshake(room, client);
  }

  /**
   * 回放 + 补发缓冲 + caught-up。
   *
   * 回放读库而不是复用内存态：新连接必须走「快照 + 库里的增量」。握手期间收到的广播
   * 按 seq 去重——回放已经覆盖的（seq ≤ maxReplayed）不再重复发送。
   */
  private finishHandshake(room: DocRoom, client: ClientState): void {
    let rows: UpdateRow[];
    try {
      rows = this.db.updatesSince(room.docId, client.baseSeq);
    } catch (err) {
      this.logger.error(`[${room.docId}] 回放读取失败，关闭 1011：${describeError(err)}`);
      this.close(client.ws, 1011, 'replay failed');
      return;
    }

    let maxReplayed = client.baseSeq;
    for (const row of rows) {
      this.sendSyncUpdate(client.ws, row.update);
      if (row.seq > maxReplayed) maxReplayed = row.seq;
    }
    for (const pending of client.pending) {
      if (pending.seq > maxReplayed) this.sendSyncUpdate(client.ws, pending.update);
    }
    client.pending.length = 0;
    client.caughtUp = true;
    this.sendControl(client.ws, 'caught-up');
  }

  private relay(room: DocRoom, sender: WebSocket, seq: number, update: Uint8Array): void {
    for (const peer of room.clients.values()) {
      if (peer.ws === sender) continue;
      if (!peer.caughtUp) {
        peer.pending.push({ seq, update });
        continue;
      }
      this.sendSyncUpdate(peer.ws, update);
    }
  }

  private sendLoad(ws: WebSocket, payload: LoadPayload): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_LOAD);
    encoding.writeVarString(encoder, JSON.stringify(payload));
    this.sendBytes(ws, encoding.toUint8Array(encoder));
  }

  private sendControl(ws: WebSocket, type: 'caught-up'): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_CONTROL);
    encoding.writeVarString(encoder, JSON.stringify({ type }));
    this.sendBytes(ws, encoding.toUint8Array(encoder));
  }

  private sendSyncStep1(ws: WebSocket, ydoc: Y.Doc): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_SYNC);
    writeSyncStep1(encoder, ydoc);
    this.sendBytes(ws, encoding.toUint8Array(encoder));
  }

  private sendSyncUpdate(ws: WebSocket, update: Uint8Array): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, FRAME_SYNC);
    writeUpdate(encoder, update);
    this.sendBytes(ws, encoding.toUint8Array(encoder));
  }

  private sendBytes(ws: WebSocket, bytes: Uint8Array): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    try {
      // Buffer.from(view) 复制一次：编码器缓冲在下次使用时会被覆盖，而 ws 的发送
      // 在背压下是异步的，直接交出视图会读到后来的字节。
      ws.send(Buffer.from(bytes));
    } catch (err) {
      this.logger.warn(`发送失败：${describeError(err)}`);
    }
  }

  private close(ws: WebSocket, code: number, reason: string): void {
    try {
      ws.close(code, reason);
    } catch {
      ws.terminate();
    }
  }
}

/** 空 doc 的 state update（`[0,0]`）经 gzip：无快照时 LOAD 仍带一份可解的载荷。 */
function emptySnapshot(): Uint8Array {
  return gzipSync(Buffer.from(Y.encodeStateAsUpdate(new Y.Doc())), { level: GZIP_LEVEL });
}

/** lib0 的空 update 恰为两字节 `[0,0]`（structs 长度 0 + delete set 长度 0）。 */
function isEmptyUpdate(update: Uint8Array): boolean {
  return update.byteLength === 2 && update[0] === 0 && update[1] === 0;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
