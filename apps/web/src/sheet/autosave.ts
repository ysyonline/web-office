/**
 * 编辑后自动保存（V2.2）：节流、串行、失败不丢。
 *
 * ## 为什么不让编辑器直接调 `save`
 *
 * 一次编辑会触发多条命令（改值、重算、选区变化），逐条保存等于把写放大到不可控。
 * 而且编辑器不知道「保存成功没有」，重试逻辑塞进编辑器就再也拿不出来。
 * 这里把「何时存」和「怎么存」收成一个控制器，编辑器只负责喊一声「变了」。
 *
 * ## 三件必须同时成立的事
 *
 * 1. **节流是 debounce + 上限**，不是纯 debounce。
 *    纯 debounce 在「持续输入」时永远不触发——用户连打一分钟，中间一次都不存；
 *    纯 throttle 又会在输入中途存下半句话。所以：静默 `debounceMs` 后触发，
 *    但首次改动起算最迟 `maxWaitMs` 必须存一次（`wait` 取两者的较小值实现）。
 *
 * 2. **保存中又有改动，最后一次必须落盘**。
 *    做法不是「排队」而是「复查」：`drain` 循环里每轮开始都把 `dirty` 清零，
 *    保存期间新来的改动重新置 `dirty`，循环于是再跑一轮。排队会存两份中间态，
 *    复查只存一份最终态。
 *
 * 3. **失败必须把 `dirty` 抬回来**。
 *    这是最容易被写错的一行：`dirty = false` 之后如果 save 抛错而不恢复，
 *    这次改动就永远不会再被尝试——用户看到的是「改了，刷新后没了」，且没有任何报错。
 *
 * ## 与 `DataSource.subscribe` 的关系：本文件**不订阅**
 *
 * 接口约定本端 save 也会推 `local-save` 事件。若这里订阅它，就会出现
 * 「保存 → 收到事件 → 认为有改动 → 再保存」的自激循环。所以自动保存只由编辑器喊单，
 * 订阅留给需要「他端改动」的上层（V2.3 的冷启动恢复 / V3 的协同回灌）。
 */

import { fnv1a32, type DataSource, type DataSourceWriteResult } from '@wo/shared';

/** 保存过程中的可观测事件，供 dev 轨迹（`__woAttachTrace`）记录。 */
export type AutosaveEventKind = 'save:start' | 'save:end' | 'save:skip' | 'save:error';

export interface AutosaveOptions<TDoc> {
  dataSource: DataSource<TDoc>;
  docId: string;
  /** 取当前文档快照。**每次保存前现取**，不缓存——缓存拿到的会是若干次编辑之前的版本。 */
  getSnapshot: () => TDoc;
  /** 静默多久后保存，默认 400ms */
  debounceMs?: number | undefined;
  /** 首次改动起算的最迟保存时刻，默认 1500ms。必须 >= `debounceMs`，否则上限失效。 */
  maxWaitMs?: number | undefined;
  onSaved?: (result: DataSourceWriteResult) => void;
  onError?: (error: unknown) => void;
  onEvent?: (kind: AutosaveEventKind, detail?: string) => void;
}

export interface AutosaveState {
  /** 有未落盘的改动 */
  dirty: boolean;
  /** 有 save 在飞 */
  saving: boolean;
  /** 最近一次成功保存的时刻（epoch ms）；从未保存过为 null */
  savedAt: number | null;
  /** 最近一次成功保存的字节数；从未保存过为 null */
  bytes: number | null;
}

export interface AutosaveController {
  /** 编辑器改动后调用。多次调用会被合并。 */
  notifyChange: () => void;
  /**
   * 把「当前快照」记作已落盘基线，**不真的写**。
   *
   * 用途：载入完成的瞬间，库里已有内容，此时若把 `lastHash` 留空，
   * 载入过程中引擎自己触发的命令会被误判成「用户改动」而回写一遍
   * （内容相同但会多一次写，且可能把载入未完成的半成品写进库）。
   */
  prime: () => void;
  /** 立刻保存并等它完成。用于 `pagehide` / 显式「保存」按钮。 */
  flush: () => Promise<void>;
  /** 停止一切后续保存（组件销毁时）。 */
  stop: () => void;
  state: () => AutosaveState;
}

/**
 * 创建一个自动保存控制器。
 *
 * @typeParam TDoc 文档快照类型，由调用方填实；本文件不关心它长什么样，只负责序列化哈希。
 */
export function createAutosave<TDoc>(options: AutosaveOptions<TDoc>): AutosaveController {
  const debounceMs = options.debounceMs ?? 400;
  const maxWaitMs = options.maxWaitMs ?? Math.max(debounceMs, 1500);

  let dirty = false;
  let stopped = false;
  let lastHash: number | null = null;
  let savedAt: number | null = null;
  let bytes: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 本轮「连续改动」的起点，用于算 maxWait 的剩余额度 */
  let firstDirtyAt = 0;
  let inFlight: Promise<void> | null = null;

  const hashOf = (doc: TDoc): number => fnv1a32(JSON.stringify(doc));

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (): void => {
    if (stopped) return;
    if (!firstDirtyAt) firstDirtyAt = Date.now();
    clearTimer();
    // debounce 与 maxWait 取较小者：静默够久就存，等太久也必须存。
    const waited = Date.now() - firstDirtyAt;
    const wait = Math.max(0, Math.min(debounceMs, maxWaitMs - waited));
    timer = setTimeout(() => {
      timer = null;
      firstDirtyAt = 0;
      void start();
    }, wait);
  };

  /**
   * 反复保存直到没有新改动。
   *
   * 循环而不是单次：保存期间用户可能又改了（`dirty` 被重新置位），
   * 此时必须再存一次，否则「最后一次改动」会留在内存里直到下次编辑。
   */
  const drain = async (): Promise<void> => {
    while (dirty && !stopped) {
      dirty = false;
      const snapshot = options.getSnapshot();
      const hash = hashOf(snapshot);

      if (hash === lastHash) {
        // 命令触发了但内容没变（例如只改了选区）。这类「假改动」必须跳过，
        // 否则每次点一下单元格都要写一次库。
        options.onEvent?.('save:skip', '内容哈希未变');
        continue;
      }

      options.onEvent?.('save:start', `hash=${hash}`);
      try {
        const result = await options.dataSource.save(options.docId, snapshot);
        lastHash = hash;
        savedAt = result.savedAt;
        bytes = result.bytes ?? null;
        options.onEvent?.(
          'save:end',
          `bytes=${result.bytes ?? '?'} savedAt=${result.savedAt} hash=${hash}`,
        );
        options.onSaved?.(result);
      } catch (error) {
        // 关键：恢复 dirty。少了这一行，这次改动就永久丢失且无声无息。
        dirty = true;
        options.onEvent?.('save:error', String(error));
        options.onError?.(error);
        // 不在错误里空转重试——交给下一次 notifyChange / flush 再试，
        // 否则存储层持续故障时会变成忙等（打满 CPU 且日志刷屏）。
        return;
      }
    }
  };

  const start = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    inFlight = drain().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const flush = async (): Promise<void> => {
    clearTimer();
    firstDirtyAt = 0;
    // 最多 4 轮：每轮等一次在飞的保存 + 一次可能的补存。存储层持续失败时
    // `drain` 会立即返回，这里不设上限就会变成死循环。
    for (let i = 0; i < 4; i += 1) {
      await start();
      if (!dirty) return;
    }
  };

  return {
    notifyChange: () => {
      if (stopped) return;
      dirty = true;
      schedule();
    },
    prime: () => {
      lastHash = hashOf(options.getSnapshot());
    },
    flush,
    stop: () => {
      stopped = true;
      clearTimer();
    },
    state: () => ({
      dirty,
      saving: inFlight !== null,
      savedAt,
      bytes,
    }),
  };
}
