/**
 * 错误码执行面（P3-012-01 骨架，D1-05 ②③④ 的服务端入口）。
 *
 * 三件事的分工（避免下游各自造轮子）：
 * 1. **码表来源**：一律从 `@wo/shared` 取（`ERROR_CODE_MESSAGES` / `ErrorCode`），本文件
 *    不重写字面量。服务端与前端读同一份表，才有「同语义多出口一致」的前提（D1-05 ③）。
 * 2. **四层矩阵**：`ERROR_LAYER_MATRIX` 是形状占位，**取值为空**——逐码的 HTTP 映射与
 *    UI 档位是 D1-05 卡裁决内容，归 P3-012-04。本包不填：填一份猜的矩阵会让下游
 *    （-02 的响应封装、前端错误呈现）按假映射实现，比空着更坏。
 * 3. **错误体封装**：`buildErrorBody` 只落签名，实现归 P3-012-03（happy path 2/2）。
 *
 * 与 `validation-codes.ts` 的关系：那份文件是 7xxx 的**管道/过滤器执行面**（P3-011-04
 * 已落地并在运行），本文件是**全码表**的公共面。二者合并的口径：7xxx 字面量留在原处
 * （它在管道里是热点、且已被单测覆盖），但用 `satisfies Record<string, ErrorCode>` 与
 * 本表绑定，因此「管道写了码表外的数字」在编译期就红——不搬家也不允许重复漂移。
 */
import {
  ERROR_CODE_MESSAGES,
  type ErrorBody,
  type ErrorCode,
  type ErrorLayerRow,
} from '@wo/shared';

import { NotImplementedError } from '../not-implemented.js';

/** 全码表（升序，30 条）。`Object.keys` 返回字符串，这里一次性转成数字并冻结。 */
export const ALL_ERROR_CODES: readonly ErrorCode[] = Object.freeze(
  Object.keys(ERROR_CODE_MESSAGES)
    .map((key) => Number(key) as ErrorCode)
    .sort((a, b) => a - b),
);

/**
 * 四层矩阵（D1-05 条 2：HTTP status / 业务 code / WS close / UI 档位）。
 *
 * **本包刻意留空**（`Partial` 就是为了让「未填」在类型上可见）：取值归 P3-012-04，
 * 届时改为 `Readonly<Record<ErrorCode, ErrorLayerRow>>`——全 30 条填满后把 `Partial`
 * 去掉，让「漏填一条」变成 tsc 错误而不是运行期 undefined。
 */
export const ERROR_LAYER_MATRIX: Readonly<Partial<Record<ErrorCode, ErrorLayerRow>>> =
  Object.freeze({});

/**
 * 组装统一错误体（Spec §10：`{code,message,detail}`）。
 *
 * 签名先定：`code` 必须是码表内的码（类型层锁住），`message` 默认取码表文案、允许
 * 调用方覆盖（校验类错误要带逐字段明细，文案由管道给），`detail` 透传。
 *
 * @throws `NotImplementedError` 本包为骨架期占位，实现归 P3-012-03
 */
export function buildErrorBody(_code: ErrorCode, _detail?: unknown, _message?: string): ErrorBody {
  throw new NotImplementedError('apps/server/src/common/errors/error-registry.ts#buildErrorBody');
}
