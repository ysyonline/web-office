/**
 * IndexedDB 版 `DataSource` 实现（V2.2，取代 V2.1 的内存桩）。
 *
 * 与内存桩的唯一实质差别：**数据在页面之外**。刷新、关标签页、重启浏览器都不影响它，
 * 这是 H2 假设（「关掉浏览器再打开，内容还在」）的唯一实现基础。
 *
 * ## 为什么存 JSON 字符串，而不直接存对象
 *
 * IndexedDB 本身能存结构化克隆对象，看起来可以省掉序列化。不用它的三个理由：
 * 1. **字节数**：`bytes` 要报给上层显示体积，字符串 `TextEncoder` 一次就得到精确字节；
 *    对象只能靠 `JSON.stringify` 估算，多一步反而绕。
 * 2. **V3 的同一份快照要走 HTTP/WS**，那条路上必然是 JSON 文本。现在存文本，
 *    序列化边界只有一处，不会出现「浏览器里能存、发到服务端就变样」。
 * 3. **反序列化失败必须显形**：文档损坏时 JSON.parse 抛错，能被上层捕获并降级；
 *    存对象则由浏览器自动修复，损坏是静默的。
 *
 * 代价是每次读写都要 stringify/parse。单表演示量级（数十 KB）可忽略；数据量大到
 * 需要优化时，优化点是「增量存储」而不是「省掉序列化」。
 *
 * ## 并发写：按 docId 串行
 *
 * 接口要求「同一 docId 的并发 save 不会交错写坏」。做法是每个 docId 一条 Promise 链：
 * 后一次写入排队等前一次结束。注意链上必须 `catch` 掉前一次的失败——
 * 否则一次失败的 save 会让该 docId 之后的所有写入永远拒绝（Promise 链中毒）。
 *
 * 跨 docId 不串行：接口不要求，串行反而会让两个文档互相拖慢。
 *
 * ## 跨标签页：BroadcastChannel 只用来「通知」，不用来传数据
 *
 * 别的标签页写完后广播一条只有元数据的消息（docId / tabId / savedAt），
 * 收到消息的一方**自己回库里读**。不直接把文档塞进消息里，因为：
 * 消息体积等于文档体积，多标签页时是纯浪费；而且「消息里的内容」与「库里的内容」
 * 会形成两个真相来源，一旦不一致就无法判断该信谁。
 */

import type {
  DataSource,
  DataSourceChange,
  DataSourceUnsubscribe,
  DataSourceWriteResult,
} from '@wo/shared';

/** 库名与仓库名导出为常量：探针要独立打开同一个库做旁证，不能各写一份字面量。 */
export const WO_DB_NAME = 'wo-office';
/** 对象仓库（相当于表）名 */
export const WO_STORE_NAME = 'docs';
/** 版本号：`onupgradeneeded` 只在版本变化时触发，改结构必须升版本。 */
const WO_DB_VERSION = 1;

/** 落盘形态。字段名短且固定，因为它是「存储契约」而不是业务类型。 */
interface StoredRecord {
  /** 文档 JSON 文本 */
  doc: string;
  /** 写入完成时刻（epoch ms） */
  savedAt: number;
  /** JSON 的 UTF-8 字节数 */
  bytes: number;
  /** 写入方标签页标识，用于区分本端与他人 */
  tabId: string;
}

/** 广播消息：只有元数据，不含文档本体（理由见文件头最后一段）。 */
interface BroadcastPayload {
  docId: string;
  savedAt: number;
  tabId: string;
}

export interface IndexedDbDataSourceOptions {
  /** 库名，默认 `wo-office` */
  dbName?: string;
  /** 对象仓库名，默认 `docs` */
  storeName?: string;
  /**
   * 是否启用跨标签页广播，默认启用。
   *
   * 关掉的用途：测试里跑多个实例时避免互相干扰；以及不支持 BroadcastChannel 的环境。
   */
  crossTab?: boolean;
}

/** 把一次事务包装成 Promise。事务的成功/失败边界比单个 request 更可靠。 */
function runTransaction(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB 事务失败'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 事务被中断'));
    action(tx.objectStore(storeName));
  });
}

/** IndexedDB 实现。生命周期内共用一个连接，`close()` 用于显式释放。 */
export class IndexedDbDataSource<TDoc> implements DataSource<TDoc> {
  private readonly dbName: string;
  private readonly storeName: string;
  /** 本实例标识。同页多实例也各自不同——「别人写的」判定只看它是否等于自己。 */
  private readonly tabId = `tab-${Math.random().toString(36).slice(2, 10)}`;
  private readonly listeners = new Set<(change: DataSourceChange<TDoc>) => void>();
  /** 每个 docId 一条串行链（理由见文件头「并发写」）。 */
  private readonly chains = new Map<string, Promise<unknown>>();
  private dbPromise: Promise<IDBDatabase> | null = null;
  private channel: BroadcastChannel | null = null;
  private closed = false;

  constructor(options: IndexedDbDataSourceOptions = {}) {
    this.dbName = options.dbName ?? WO_DB_NAME;
    this.storeName = options.storeName ?? WO_STORE_NAME;

    if (options.crossTab !== false && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(this.dbName);
      this.channel.onmessage = (event: MessageEvent<BroadcastPayload>) => {
        void this.handleExternal(event.data);
      };
    }
  }

  async load(docId: string): Promise<TDoc | null> {
    const record = await this.readRecord(docId);
    // 不存在 → null（不是空文档、不抛错）。接口把「不存在」与「读失败」严格分开，
    // 上层据此决定「新文档走空白表」还是「读失败报错」。
    if (record === null) return null;

    try {
      return JSON.parse(record.doc) as TDoc;
    } catch (error) {
      // 反序列化失败属于「数据损坏」，必须抛出去，不能降级成空文档——
      // 那会让上层在损坏时静默用空表覆盖掉用户仅存的原始字节。
      throw new Error(
        `[IndexedDbDataSource] 文档 ${docId} 反序列化失败（库中数据可能损坏）: ${String(error)}`,
      );
    }
  }

  save(docId: string, doc: TDoc): Promise<DataSourceWriteResult> {
    const previous = this.chains.get(docId) ?? Promise.resolve();
    // 前一次失败不能污染链：先 catch 掉，再排本次。抛给调用方的仍是本次的结果。
    const next = previous.catch(() => undefined).then(() => this.write(docId, doc));
    this.chains.set(docId, next);
    return next;
  }

  subscribe(listener: (change: DataSourceChange<TDoc>) => void): DataSourceUnsubscribe {
    this.listeners.add(listener);
    // 幂等：重复调用不抛错（接口约定）。
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 释放连接与广播通道。重复调用安全。 */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel?.close();
    this.channel = null;
    const dbp = this.dbPromise;
    this.dbPromise = null;
    if (dbp) void dbp.then((db) => db.close()).catch(() => undefined);
  }

  private async write(docId: string, doc: TDoc): Promise<DataSourceWriteResult> {
    const json = JSON.stringify(doc);
    if (typeof json !== 'string') {
      // JSON.stringify(undefined) 返回 undefined 而非字符串。这类输入必须在写入前拦下，
      // 否则会在库里留下一个 `undefined`，读出来时是「文档损坏」，而真正的原因早已消失。
      throw new Error(`[IndexedDbDataSource] 文档 ${docId} 无法序列化（值为 undefined？）`);
    }

    const bytes = new TextEncoder().encode(json).length;
    const savedAt = Date.now();
    const record: StoredRecord = { doc: json, savedAt, bytes, tabId: this.tabId };

    const db = await this.openDb();
    await runTransaction(db, this.storeName, 'readwrite', (store) => {
      store.put(record, docId);
    });

    // 顺序：落盘成功 → 通知本地监听方 → 广播他端。
    // 反过来会出现「监听到变更但读库还是旧值」，V2.1 的桩特意踩过这个顺序。
    this.emit({ docId, doc: JSON.parse(json) as TDoc, origin: 'local-save', changedAt: savedAt });
    this.channel?.postMessage({ docId, savedAt, tabId: this.tabId } satisfies BroadcastPayload);

    return { savedAt, bytes };
  }

  /** 收到他端写入：回库读最新内容再通知，不使用消息里的数据（理由见文件头）。 */
  private async handleExternal(payload: BroadcastPayload): Promise<void> {
    if (this.closed || !payload || payload.tabId === this.tabId) return;
    const record = await this.readRecord(payload.docId);
    if (record === null) return;
    let doc: TDoc;
    try {
      doc = JSON.parse(record.doc) as TDoc;
    } catch {
      // 他端写入的内容坏了：不通知（通知了上层也无法使用），留给下次 load 报错。
      return;
    }
    this.emit({ docId: payload.docId, doc, origin: 'external', changedAt: record.savedAt });
  }

  private emit(change: DataSourceChange<TDoc>): void {
    for (const listener of this.listeners) listener(change);
  }

  private async readRecord(docId: string): Promise<StoredRecord | null> {
    const db = await this.openDb();
    return new Promise<StoredRecord | null>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const request = tx.objectStore(this.storeName).get(docId);
      request.onsuccess = () => resolve((request.result as StoredRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 读取失败'));
    });
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.closed) return Promise.reject(new Error('[IndexedDbDataSource] 已 close()'));
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('[IndexedDbDataSource] 当前环境没有 indexedDB'));
    }
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, WO_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          // 不建索引：只有「按 docId 取整份文档」一种访问方式，主键足够。
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
      request.onblocked = () =>
        reject(new Error('[IndexedDbDataSource] 打开被阻塞：别的标签页仍持有旧版本连接'));
    });
    return this.dbPromise;
  }
}
