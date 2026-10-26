/**
 * 内存 `DataSource` 实现（V2.1 验证桩，V2.2 由 IndexedDB 实现取代）。
 *
 * ## 它为什么必须存在，而不是「等 V2.2 直接用 IndexedDB 验」
 *
 * V2.1 的判据是「接口定稿」。接口能不能定稿，只有**写过一份实现**才知道：
 * 只写 interface 不写实现，定出来的是想象；写实现时才会暴露「这个方法缺参数」
 * 「这个返回值没法用」这类只能在调用侧发现的问题。
 *
 * 但它是**内存**的，不声称持久化——V2 的 H2 假设（关掉浏览器内容还在）由 V2.2/V2.3 验，
 * 本包不碰。文件头写死这件事，是为了防止后来者误以为「存内存也算能存」。
 *
 * ## 两处刻意的行为设计（都是为了让上层不被实现细节绑住）
 *
 * 1. **`load` / `save` 都做真克隆**（`structuredClone`），不是返回同一引用。
 *    理由：V2.2 的 IndexedDB 实现必然反序列化出新对象。若桩返回引用，上层会不知不觉
 *    依赖「改返回值等于改存储」，到 V2.2 才炸。桩在这里**故意比实现更严格**，
 *    让错误在 V2.1 就暴露。
 *
 * 2. **`subscribe` 连本端 save 也推**（`origin: 'local-save'`）：与接口注释一致。
 *    V2.3 回灌编辑器时靠 origin 过滤，若桩不推 local-save，那段逻辑在 V2.1 无从验证。
 */

import type {
  DataSource,
  DataSourceChange,
  DataSourceUnsubscribe,
  DataSourceWriteResult,
} from '@wo/shared';

/** 内存数据源。生命周期 = 页面生命周期，刷新即丢——**这不是持久化**。 */
export class MemoryDataSource<TDoc> implements DataSource<TDoc> {
  private readonly store = new Map<string, TDoc>();
  private readonly listeners = new Set<(change: DataSourceChange<TDoc>) => void>();

  constructor(seed?: Record<string, TDoc>) {
    if (seed) {
      for (const [id, doc] of Object.entries(seed)) this.store.set(id, doc);
    }
  }

  async load(docId: string): Promise<TDoc | null> {
    const hit = this.store.get(docId);
    if (hit === undefined) return null;
    // 克隆后返回：上层拿到的永远是独立副本。V2.2 的 IndexedDB 实现同样会反序列化出新对象，
    // 所以这里刻意保持「返回副本」这一语义，避免上层在 V2.2 时才发现引用语义变了。
    return structuredClone(hit);
  }

  async save(docId: string, doc: TDoc): Promise<DataSourceWriteResult> {
    const copy = structuredClone(doc);
    this.store.set(docId, copy);

    const savedAt = Date.now();
    // 先落盘再生效，再通知——顺序反了会出现「监听到变更但读不到」。
    for (const listener of this.listeners) {
      listener({ docId, doc: structuredClone(copy), origin: 'local-save', changedAt: savedAt });
    }

    return { savedAt, bytes: new TextEncoder().encode(JSON.stringify(copy)).length };
  }

  subscribe(listener: (change: DataSourceChange<TDoc>) => void): DataSourceUnsubscribe {
    this.listeners.add(listener);
    // 幂等：重复调用不抛错（接口约定）。
    return () => {
      this.listeners.delete(listener);
    };
  }
}
