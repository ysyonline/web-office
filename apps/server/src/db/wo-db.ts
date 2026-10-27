/**
 * V3.1 验证期数据库（任务卡 `docs/phase3/tasks/V3.1.md` §4.2）。
 *
 * 一个文件、一个类、一张表：`node:sqlite` 打开 `WO_DB_URL` 指向的本地文件，供协同
 * 消息先入库再 ack。不是交付轨模型——没有 TypeORM、实体与迁移（归 P3-014）。
 *
 * 两处刻意的选择：
 * - `WO_DB_URL` 按普通文件路径解释，相对路径以**仓库根**为基准。`pnpm --filter
 *   @wo/server start` 的 cwd 是 `apps/server`，按 cwd 解析会把库静默建到包目录，
 *   表现为「两个库、内容消失」。带 `://` 的值当场拒绝，避免误配 `postgres://` 后
 *   建出一个名为 `postgres:` 的怪文件。
 * - 表用 `STRICT`：列类型写错当场报错，而不是被 SQLite 的弱类型静默存进去。
 *
 * `node:sqlite` 在 Node 22 仍是 experimental，启动会打 `ExperimentalWarning`；这是
 * 本卡接受的成本，交付轨换 TypeORM 时只换本文件实现。
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';

export interface CollabMessageRow {
  seq: number;
  text: string;
  at: number;
}

/** 从 `start` 逐级向上找 `pnpm-workspace.yaml`；找不到就报错并打印起始目录。 */
function findRepoRoot(start: string): string {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(`[WoDb] 从 ${start} 向上未找到 pnpm-workspace.yaml，无法定位仓库根`);
    }
    dir = parent;
  }
}

@Injectable()
export class WoDb implements OnApplicationShutdown {
  private readonly db: DatabaseSync;
  private closed = false;

  constructor() {
    const raw = process.env.WO_DB_URL?.trim();
    if (!raw) throw new Error('[WoDb] WO_DB_URL 为空');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
      throw new Error('[WoDb] V3.1 只支持 SQLite 文件路径，不支持 URL');
    }
    const file = isAbsolute(raw) ? raw : resolve(findRepoRoot(process.cwd()), raw);
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS collab_messages (
        seq        INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id     TEXT NOT NULL,
        text       TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_collab_messages_doc_seq
        ON collab_messages(doc_id, seq);
    `);
  }

  append(docId: string, text: string): { seq: number; at: number } {
    const at = Date.now();
    const result = this.db
      .prepare('INSERT INTO collab_messages (doc_id, text, created_at) VALUES (?, ?, ?)')
      .run(docId, text, at);
    const seq = Number(result.lastInsertRowid);
    if (!Number.isSafeInteger(seq)) {
      throw new Error('[WoDb] lastInsertRowid 超出安全整数范围');
    }
    return { seq, at };
  }

  /** 最近 `limit` 条，按 seq 升序返回（迟到者按发送顺序看到历史）。 */
  history(docId: string, limit = 100): CollabMessageRow[] {
    const rows = this.db
      .prepare(
        `SELECT seq, text, created_at AS at FROM (
           SELECT seq, text, created_at FROM collab_messages
           WHERE doc_id = ? ORDER BY seq DESC LIMIT ?
         ) ORDER BY seq ASC`,
      )
      .all(docId, limit);
    return rows.map((row) => ({
      seq: Number(row.seq),
      text: String(row.text),
      at: Number(row.at),
    }));
  }

  /** 幂等关闭；`OnApplicationShutdown` 调用。 */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }

  onApplicationShutdown(): void {
    this.close();
  }
}
