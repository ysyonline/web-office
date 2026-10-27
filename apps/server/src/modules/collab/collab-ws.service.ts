/**
 * V3.1 协同 WebSocket 服务（任务卡 `docs/phase3/tasks/V3.1.md` §4.3/§4.4）。
 *
 * 与 HTTP 同进程同端口：在 Nest 的 HTTP server 上挂 `upgrade`，不另起监听。帧协议是
 * 本卡自有的 JSON，**不是** openapi 的 lib0 契约；路径沿用 `/ws/collab/{id}` 但没有
 * ticket 鉴权，这是 V3.1 的已知偏离（V3.2 迁主路径时收口）。
 *
 * 消息顺序定死：解析校验 → 入库 → 给发送者 `ack` → 给同房其它人广播。入库失败就关
 * 1011，不发 ack 也不广播——「先提交后 ack」是持久判据的前提。
 */
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';

import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WebSocket, WebSocketServer, type RawData } from 'ws';

import { WoDb, type CollabMessageRow } from '../../db/wo-db';

const DOC_PATH = /^\/ws\/collab\/([^/]+)$/;
const DOC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_TEXT_LENGTH = 4000;

/** 只接受 `/ws/collab/{id}`，ID 解码后须匹配 `[A-Za-z0-9_-]{1,64}`；其余一律 null。 */
function parseDocId(rawUrl: string): string | null {
  const match = DOC_PATH.exec(rawUrl);
  const encoded = match?.[1];
  if (encoded === undefined) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  return DOC_ID.test(decoded) ? decoded : null;
}

function rawToString(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return Buffer.concat(data).toString('utf8');
}

@Injectable()
export class CollabWsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CollabWsService.name);
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private wss: WebSocketServer | undefined;
  private httpServer: HttpServer | undefined;
  private upgradeHandler:
    ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | undefined;

  constructor(
    // 显式 @Inject：这两个类只出现在类型位置，若改成 `import type`，
    // emitDecoratorMetadata 会退化成 Object，Nest 注入会在启动时才失败。
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
    @Inject(WoDb) private readonly db: WoDb,
  ) {}

  onApplicationBootstrap(): void {
    this.httpServer = this.adapterHost.httpAdapter.getHttpServer() as HttpServer;
    const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
    this.wss = wss;
    this.upgradeHandler = (req, socket, head) => {
      const docId = parseDocId(req.url ?? '');
      if (docId === null) {
        socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => this.attach(ws, docId));
    };
    this.httpServer.on('upgrade', this.upgradeHandler);
  }

  onApplicationShutdown(): void {
    if (this.httpServer !== undefined && this.upgradeHandler !== undefined) {
      this.httpServer.off('upgrade', this.upgradeHandler);
    }
    for (const peers of this.rooms.values()) {
      for (const peer of peers) {
        try {
          peer.terminate();
        } catch {
          // 关停期间单个坏连接不阻断其余连接
        }
      }
    }
    this.rooms.clear();
    this.wss?.close();
    this.wss = undefined;
  }

  private attach(ws: WebSocket, docId: string): void {
    // 先挂 error：读库失败时也会 close，未挂 error 的 socket 出错会冒泡成进程级异常。
    ws.on('error', () => this.leave(docId, ws));
    let messages: CollabMessageRow[];
    try {
      messages = this.db.history(docId);
    } catch (err) {
      this.logger.error(`[${docId}] 读取历史失败，关闭 1011：${describeError(err)}`);
      ws.close(1011, 'history failed');
      return;
    }

    this.room(docId).add(ws);
    ws.on('close', (code) => {
      this.leave(docId, ws);
      this.logger.log(`[${docId}] 连接关闭 code=${code}`);
    });
    ws.on('message', (data, isBinary) => this.onMessage(ws, docId, data, isBinary));
    this.send(ws, { type: 'ready', docId, messages });
  }

  private onMessage(ws: WebSocket, docId: string, data: RawData, isBinary: boolean): void {
    if (isBinary) {
      this.close(ws, docId, 1003, 'binary frames not supported');
      return;
    }

    let frame: unknown;
    try {
      frame = JSON.parse(rawToString(data));
    } catch {
      this.close(ws, docId, 1003, 'invalid json');
      return;
    }

    if (typeof frame !== 'object' || frame === null) {
      this.close(ws, docId, 1008, 'invalid frame');
      return;
    }
    const candidate = frame as { type?: unknown; text?: unknown };
    if (candidate.type !== 'message') {
      this.close(ws, docId, 1008, 'unknown frame type');
      return;
    }
    if (typeof candidate.text !== 'string') {
      this.close(ws, docId, 1008, 'invalid text');
      return;
    }
    const text = candidate.text;
    if (text.length === 0 || text.length > MAX_TEXT_LENGTH) {
      this.close(ws, docId, 1008, 'invalid text length');
      return;
    }

    let row: { seq: number; at: number };
    try {
      row = this.db.append(docId, text);
    } catch (err) {
      this.logger.error(`[${docId}] 写入失败，关闭 1011：${describeError(err)}`);
      this.close(ws, docId, 1011, 'append failed');
      return;
    }

    this.send(ws, { type: 'ack', seq: row.seq, at: row.at });

    const outbound = JSON.stringify({
      type: 'message',
      docId,
      seq: row.seq,
      text,
      at: row.at,
    });
    const peers = this.rooms.get(docId);
    if (peers !== undefined) {
      for (const peer of [...peers]) {
        if (peer === ws || peer.readyState !== WebSocket.OPEN) continue;
        try {
          peer.send(outbound);
        } catch (err) {
          this.logger.warn(`[${docId}] 广播失败 seq=${row.seq}：${describeError(err)}`);
        }
      }
    }
  }

  private room(docId: string): Set<WebSocket> {
    let peers = this.rooms.get(docId);
    if (peers === undefined) {
      peers = new Set();
      this.rooms.set(docId, peers);
    }
    return peers;
  }

  private leave(docId: string, ws: WebSocket): void {
    const peers = this.rooms.get(docId);
    if (peers === undefined) return;
    peers.delete(ws);
    if (peers.size === 0) this.rooms.delete(docId);
  }

  private send(ws: WebSocket, payload: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }

  private close(ws: WebSocket, docId: string, code: number, reason: string): void {
    this.logger.log(`[${docId}] 关闭连接 code=${code}`);
    try {
      ws.close(code, reason);
    } catch {
      ws.terminate();
    }
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
