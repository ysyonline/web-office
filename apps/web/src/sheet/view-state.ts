/**
 * 视口状态持久化（V2.3）：localStorage，按 docId 一条。
 *
 * ## 为什么不是 IndexedDB / 文档快照
 *
 * 1. **视口属于设备与用户偏好，不是文档内容**。V3 协同也不应把各自的滚动位置同步给别人。
 * 2. 只有四个数字，同步写即可；`pagehide` 时能可靠落盘，不必赌异步事务。
 * 3. 文档快照里的 `scrollTop` 引擎**不会自动应用**（`getScrollLeftTopFromSnapshot()` 零调用者），
 *    用它还得整份落盘，代价与收益不匹配。
 *
 * ## 读失败一律当「没有视口状态」
 *
 * 无记录、JSON 损坏、字段非法（NaN / 负数 / 缺字段）都返回 `null`，不抛错、不阻断载入。
 * 视口是可丢的 UI 状态，绝不能因为它读不出来而让表格白屏——这正是 V2.3 降级要求的一部分。
 */
import type { SheetScrollState } from './mount-sheet';

const KEY_PREFIX = 'wo.view.';
const DEFAULT_DEBOUNCE_MS = 250;

/** localStorage 键名。导出给探针做旁证，避免两边各写一份前缀。 */
export function viewStateKey(docId: string): string {
  return `${KEY_PREFIX}${docId}`;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** 读视口状态；任何异常/非法形态都返回 `null`（理由见文件头）。 */
export function readViewState(docId: string): SheetScrollState | null {
  try {
    const raw = localStorage.getItem(viewStateKey(docId));
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const value = parsed as Record<string, unknown>;
    if (
      !isFiniteNonNegative(value.offsetX) ||
      !isFiniteNonNegative(value.offsetY) ||
      !isFiniteNonNegative(value.sheetViewStartRow) ||
      !isFiniteNonNegative(value.sheetViewStartColumn)
    ) {
      return null;
    }

    return {
      offsetX: value.offsetX,
      offsetY: value.offsetY,
      // 行列必须是整数；存储被手改成小数时按最近行处理，而不是整条丢弃。
      sheetViewStartRow: Math.round(value.sheetViewStartRow),
      sheetViewStartColumn: Math.round(value.sheetViewStartColumn),
    };
  } catch {
    return null;
  }
}

/** 写视口状态。存储不可用（隐私模式 / 配额满）时静默放弃——可丢的 UI 状态，不影响内容。 */
export function writeViewState(docId: string, state: SheetScrollState): void {
  try {
    localStorage.setItem(viewStateKey(docId), JSON.stringify(state));
  } catch {
    // 刻意不报错：视口丢失不应打断编辑。
  }
}

/** 删除视口状态。用于「新文档」：避免同 id 的旧视口把新文档滚到奇怪位置。 */
export function clearViewState(docId: string): void {
  try {
    localStorage.removeItem(viewStateKey(docId));
  } catch {
    // 同 writeViewState：可丢状态。
  }
}

export interface ViewStateWriter {
  /** 记录最新视口，防抖后落盘。 */
  schedule: (state: SheetScrollState) => void;
  /** 立刻落盘（pagehide / detach）。 */
  flush: () => void;
  /** 停止后续调度，并 flush 最后一次值。 */
  stop: () => void;
}

/**
 * 防抖写入器。
 *
 * 滚动事件很密；每次写 localStorage 会同步阻塞主线程，故攒 250ms。
 * `flush`/`stop` 必须写最后一次值，否则「滚到底就关页」会恢复成上一次的位置。
 */
export function createViewStateWriter(
  docId: string,
  debounceMs = DEFAULT_DEBOUNCE_MS,
): ViewStateWriter {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: SheetScrollState | null = null;
  let stopped = false;

  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const writePending = (): void => {
    if (pending === null) return;
    writeViewState(docId, pending);
    pending = null;
  };

  return {
    schedule: (state) => {
      if (stopped) return;
      pending = state;
      clearTimer();
      timer = setTimeout(() => {
        timer = null;
        writePending();
      }, debounceMs);
    },
    flush: () => {
      clearTimer();
      writePending();
    },
    stop: () => {
      stopped = true;
      clearTimer();
      writePending();
    },
  };
}
