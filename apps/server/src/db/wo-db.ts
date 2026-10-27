/**
 * V3.2 验证期数据库（任务卡 `docs/phase3/tasks/V3.2.md` §4.2）。
 *
 * 两张表：`yjs_updates`（协同增量，write-through）与 `file_snapshots`（显式物化的
 * Yjs state，`snapshot@base_seq + updates WHERE seq > base_seq` 的加载协议载体）。
 * 不是交付轨模型——没有 TypeORM、实体与迁移（归 P3-014）。
 *
 * 三处刻意的选择：
 * - `WO_DB_URL` 按普通文件路径解释，相对路径以**仓库根**为基准。`pnpm --filter
 *   @wo/server start` 的 cwd 是 `apps/server`，按 cwd 解析会把库静默建到包目录，
 *   表现为「两个库、内容消失」。带 `://` 的值当场拒绝。
 * - 表用 `STRICT`：列类型写错当场报错，而不是被 SQLite 的弱类型静默存进去。
 * - seq 只由本类在单事务内 `max+1` 分配（单写者），`(doc_id, seq)` 主键兼作撞号防线；
 *   号段预分配与 group-commit 是交付轨优化，本卡不做（§6 欠账 5）。
 *
 * `node:sqlite` 在 Node 22 仍是 experimental，启动会打 `ExperimentalWarning`；交付轨
 * 换 TypeORM 时只换本文件实现。
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';

export interface UpdateRow {
  seq: number;
  update: Uint8Array;
}

export interface SnapshotRow {
  version: number;
  baseSeq: number;
  snapshot: Uint8Array;
}

export type UpdateOrigin = 'client' | 'server';

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
      throw new Error('[WoDb] V3.2 只支持 SQLite 文件路径，不支持 URL');
    }
    const file = isAbsolute(raw) ? raw : resolve(findRepoRoot(process.cwd()), raw);
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA synchronous = NORMAL');
    this.db.exec('PRAGMA busy_timeout = 5000');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS yjs_updates (
        doc_id      TEXT    NOT NULL,
        seq         INTEGER NOT NULL,
        update_blob BLOB    NOT NULL,
        origin      TEXT    NOT NULL,
        created_by  TEXT    NOT NULL,
        created_at  INTEGER NOT NULL,
        PRIMARY KEY (doc_id, seq)
      ) STRICT;

      CREATE TABLE IF NOT EXISTS file_snapshots (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        doc_id     TEXT    NOT NULL,
        version    INTEGER NOT NULL,
        base_seq   INTEGER NOT NULL,
        snapshot   BLOB    NOT NULL,
        created_by TEXT    NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE (doc_id, version)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_yjs_updates_doc_seq
        ON yjs_updates(doc_id, seq);
      CREATE INDEX IF NOT EXISTS idx_file_snapshots_doc_version
        ON file_snapshots(doc_id, version);
    `);
  }

  /**
   * 单事务写入一条增量：`seq = max(seq)+1` 与 INSERT 同一事务，返回分配的 seq。
   *
   * `BEGIN IMMEDIATE` 而不是默认的 deferred：本进程是唯一写者，但 WAL 下 deferred
   * 事务要等到第一条写语句才升级锁，升级失败会在提交时才暴露。提前拿写锁让冲突在
   * `BEGIN` 处失败，行为更可预测。
   */
  appendUpdate(docId: string, update: Uint8Array, origin: UpdateOrigin, createdBy: string): number {
    const at = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const seq = this.nextSeq(docId);
      this.db
        .prepare(
          `INSERT INTO yjs_updates (doc_id, seq, update_blob, origin, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(docId, seq, update, origin, createdBy, at);
      this.db.exec('COMMIT');
      return seq;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** `seq > baseSeq` 的增量，按 seq 升序。 */
  updatesSince(docId: string, baseSeq: number): UpdateRow[] {
    const rows = this.db
      .prepare(
        `SELECT seq, update_blob FROM yjs_updates
         WHERE doc_id = ? AND seq > ? ORDER BY seq ASC`,
      )
      .all(docId, baseSeq);
    return rows.map((row) => ({
      seq: Number(row.seq),
      update: toUint8Array(row.update_blob),
    }));
  }

  /** 最大 version 的快照；没有则 null。 */
  latestSnapshot(docId: string): SnapshotRow | null {
    const row = this.db
      .prepare(
        `SELECT version, base_seq, snapshot FROM file_snapshots
         WHERE doc_id = ? ORDER BY version DESC LIMIT 1`,
      )
      .get(docId);
    if (row === undefined) return null;
    return {
      version: Number(row.version),
      baseSeq: Number(row.base_seq),
      snapshot: toUint8Array(row.snapshot),
    };
  }

  /**
   * 物化：同一事务内取 `baseSeq = max(seq)`、`version = max(version)+1`、INSERT。
   *
   * 事务持有写锁期间新的 update 会等待，落库后 seq 必大于本 baseSeq，因此
   * 「快照与水位线同一事务」即「边界增量不丢」。
   */
  materialize(docId: string, snapshot: Uint8Array, createdBy: string): SnapshotRow {
    const at = Date.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const baseSeq = this.maxSeq(docId);
      const versionRow = this.db
        .prepare(
          'SELECT COALESCE(MAX(version), 0) + 1 AS next FROM file_snapshots WHERE doc_id = ?',
        )
        .get(docId);
      const version = Number(versionRow?.next ?? 1);
      this.db
        .prepare(
          `INSERT INTO file_snapshots (doc_id, version, base_seq, snapshot, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(docId, version, baseSeq, snapshot, createdBy, at);
      this.db.exec('COMMIT');
      return { version, baseSeq, snapshot };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** 该 doc 的最大 seq；无增量为 0。 */
  maxSeq(docId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) AS maxSeq FROM yjs_updates WHERE doc_id = ?')
      .get(docId);
    return Number(row?.maxSeq ?? 0);
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

  private nextSeq(docId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM yjs_updates WHERE doc_id = ?')
      .get(docId);
    const seq = Number(row?.next ?? 1);
    if (!Number.isSafeInteger(seq)) {
      throw new Error('[WoDb] seq 超出安全整数范围');
    }
    return seq;
  }
}

/** `node:sqlite` 的 BLOB 读回是 Uint8Array；这里只做一次显式收口，避免上层拿到 Buffer。 */
function toUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  throw new Error(`[WoDb] BLOB 列读回类型异常：${typeof value}`);
}
