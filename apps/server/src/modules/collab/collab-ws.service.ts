/**
 * 协同 WebSocket 接入层（V3.2 任务卡 `docs/phase3/tasks/V3.2.md` §4.3）。
 *
 * 与 HTTP 同进程同端口：在 Nest 的 HTTP server 上挂 `upgrade`，不另起监听。本层只做
 * 「路径解析 + 帧搬运 + 连接生命周期」，协议语义全部在 `CollabCoreService`——
 * 拆开的理由是关闭码的判定要读协议状态（caught-up、seq），放在同一文件里会和接入细节
 * 互相缠住，反向对照 R1/R2/R3 也就没法只改一处。
 *
 * 仍不做 ticket 鉴权（§6 欠账 1）、不实现 awareness/PING/重连（欠账 3）；`ticket` 查询
 * 参数即便出现也不校验——伪鉴权比无鉴权危险。
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
import { WebSocketServer, type RawData, type WebSocket } from 'ws';

import { DOC_ID_REGEX } from '../../common/doc-id';
import { CollabCoreService } from './collab-core.service';

const DOC_PATH = /^\/ws\/collab\/([^/]+)$/;

/** 只接受 `/ws/collab/{id}`，ID 解码后须匹配形状；其余一律 null。 */
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
  return DOC_ID_REGEX.test(decoded) ? decoded : null;
}

/** ws 的 RawData 三种形态收口成连续字节（不转字符串：V3.2 全是二进制）。 */
function rawToBytes(data: RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return Buffer.concat(data);
}

@Injectable()
export class CollabWsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(CollabWsService.name);
  private wss: WebSocketServer | undefined;
  private httpServer: HttpServer | undefined;
  private upgradeHandler:
    ((req: IncomingMessage, socket: Duplex, head: Buffer) => void) | undefined;

  constructor(
    // 显式 @Inject：这两个类只出现在类型位置，若改成 `import type`，
    // emitDecoratorMetadata 会退化成 Object，Nest 注入会在启动时才失败。
    @Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost,
    @Inject(CollabCoreService) private readonly core: CollabCoreService,
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
    this.wss?.close();
    this.wss = undefined;
  }

  private attach(ws: WebSocket, docId: string): void {
    // 先挂 error：读库失败时也会 close，未挂 error 的 socket 出错会冒泡成进程级异常。
    ws.on('error', (err) => {
      this.logger.warn(`[${docId}] 连接错误：${err.message}`);
      this.core.detach(ws, docId);
    });
    ws.on('close', (code) => {
      this.core.detach(ws, docId);
      this.logger.log(`[${docId}] 连接关闭 code=${code}`);
    });

    try {
      this.core.attach(ws, docId);
    } catch (err) {
      this.logger.error(`[${docId}] 加载失败，关闭 1011：${describeError(err)}`);
      closeQuietly(ws, 1011, 'load failed');
      return;
    }

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        closeQuietly(ws, 1008, 'text frames not supported');
        return;
      }
      this.core.receive(ws, docId, rawToBytes(data));
    });
  }
}

function closeQuietly(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    ws.terminate();
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
