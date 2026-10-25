/**
 * 错误码执行面（P3-012-01 骨架，D1-05 ②③④ 的服务端入口）。
 *
 * 三件事的分工（避免下游各自造轮子）：
 * 1. **码表来源**：一律从 `@wo/shared` 取（`ERROR_CODE_MESSAGES` / `ErrorCode`），本文件
 *    不重写字面量。服务端与前端读同一份表，才有「同语义多出口一致」的前提（D1-05 ③）。
 * 2. **四层矩阵**：`ERROR_LAYER_MATRIX` 是形状占位，**取值为空**——逐码的 HTTP 映射与
 *    UI 档位是 D1-05 卡裁决内容，归 P3-012-04。本包不填：填一份猜的矩阵会让下游
 *    （-02 的响应封装、前端错误呈现）按假映射实现，比空着更坏。
 * 3. **错误体封装**：`buildErrorBody` 是唯一的出站拼装点（P3-012-03）——文案默认取
 *    码表，`detail` 恒存在（缺省补 `null`）。三个 HTTP 出口（校验 / HttpException /
 *    未知异常）都经它出站，因此「响应体形状一致」不是靠三处各写一遍对齐来的。
 *
 * 与 `validation-codes.ts` 的关系：那份文件是 7xxx 的**管道/过滤器执行面**（P3-011-04
 * 已落地并在运行），本文件是**全码表**的公共面。二者合并的口径：7xxx 字面量留在原处
 * （它在管道里是热点、且已被单测覆盖），但用 `satisfies Record<string, ErrorCode>` 与
 * 本表绑定，因此「管道写了码表外的数字」在编译期就红——不搬家也不允许重复漂移。
 */
import {
  ERROR_CODE_MESSAGES,
  errorMessage,
  type ErrorBody,
  type ErrorCode,
  type ErrorLayerRow,
} from '@wo/shared';

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
 * `code` 由类型层锁在码表内（`ErrorCode` 是 30 个字面量联合），因此「响应里出现码表
 * 外的数字」在编译期即被挡住——不需要运行期白名单。
 *
 * 三条约定，各有原因：
 *
 * 1. **`message` 默认取码表文案**，允许调用方覆盖。覆盖不是逃生门而是**责任转移**：
 *    校验类错误要带逐字段明细、文案由管道给（它知道是哪一段 body/query/path 失败），
 *    HttpException 的 message 是框架/业务抛出的既有信息——这两类覆盖有据；其余一律
 *    吃表内文案，避免各出口各写一份中文。**没有第三个来源**：码表之外的字面量就是漂移。
 * 2. **`detail` 恒存在**：`detail ?? null`。不是「顺手补个默认值」——`JSON.stringify`
 *    会把 `undefined` 值的键整个丢掉，若透传 `undefined`，响应体就变成 `{code,message}`，
 *    「三出口形状一致」当场破功，而 tsc 看不见（`detail?: unknown` 允许缺席）。
 *    用 `null` 而不是空对象：契约 `Error.detail` 声明为 nullable，空对象会多出契约
 *    没有的结构。
 * 3. **空串 `message` 不兜底**：`''` 是调用方的明确取值，按原样输出（与 -02 配置层
 *    「空串等同未设置」刻意不同）。配置空串是**部署形态产物**（compose 的 `- FOO=`），
 *    静默吞掉会让必填键带着空口令启动；而错误文案空串是**代码缺陷**，兜底反而把它
 *    藏起来。两处选择相反，是因为要处理的错误来源不同。
 */
export function buildErrorBody(code: ErrorCode, detail?: unknown, message?: string): ErrorBody {
  return {
    code,
    message: message ?? errorMessage(code),
    detail: detail ?? null,
  };
}
