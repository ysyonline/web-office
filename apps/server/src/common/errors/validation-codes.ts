/**
 * 7xxx 请求校验错误码（P3-011-04 落，P3-012-01 与全码表绑定）。
 *
 * 码表事实源仍是 `docs/api/openapi.yaml` 的 `x-error-code-registry`；代码侧的转录件
 * 在 **`@wo/shared` 的 `ERROR_CODE_MESSAGES`**（30 条全码表，机检见
 * `scripts/check-error-codes.mjs`）。本文件只承载 7xxx 的**执行面**（管道分流用），
 * 不再自己声明「码表在此」——两处各存一份字面量就是漂移来源。
 *
 * P3-012-01 的绑定方式：`ValidationCode` 用 `satisfies Record<string, ErrorCode>`
 * 挂在 shared 的联合类型上。效果是**编译期就红**——管道里写个码表外的数字（比如
 * 7101）tsc 直接报错，不必等门禁。全码表的四层矩阵归
 * `apps/server/src/common/errors/error-registry.ts`。
 *
 * 四条码的语义边界（与管道分流的对应关系）：
 * - 7001 请求体校验失败（ZodValidationPipe 校验 body 产生）
 * - 7002 查询参数越界（同管道校验 query 产生；无 coerce 前置时 `?limit=200` 会走
 *   invalid_type 误入 7001，见 D1-13-B「query/path 前置」行）
 * - 7003 JSON/multipart 载荷非法（解析失败，非法 JSON 到不了管道——由异常过滤器兜）
 * - 7004 路径参数格式非法（如 id 非 uuid）
 */
import type { ErrorCode } from '@wo/shared';

/** 校验类错误码 → HTTP 400（openapi 各端点 400 响应统一 $ref components.responses/BadRequest）。 */
export const VALIDATION_HTTP_STATUS = 400 as const;

/** 7xxx 段四个码（逐字对应 registry；`satisfies` 保证每个值都在 shared 码表内）。 */
export const ValidationCode = {
  /** 请求体/参数校验失败（detail.errors[] 逐字段） */
  Body: 7001,
  /** 查询参数越界（分页/排序/筛选条件非法） */
  Query: 7002,
  /** JSON / multipart 载荷非法（解析失败或 Content-Type 不匹配） */
  Payload: 7003,
  /** 路径参数格式非法（如 id 非 uuid） */
  Path: 7004,
} as const satisfies Record<string, ErrorCode>;

export type ValidationCodeValue = (typeof ValidationCode)[keyof typeof ValidationCode];

/** 错误响应体形状（契约：components.schemas/Error + ValidationErrorDetail）。 */
export interface ValidationErrorItem {
  /** 字段点路径（z.core.toDotPath 产物）；根级/整体类型错误为字面量 (root) */
  field: string;
  /** 校验规则标识（zod issue code 字面量） */
  rule: string;
  /** 中文可读描述，直接呈现给用户 */
  message: string;
}

export interface ValidationErrorBody {
  /**
   * 契约里 code 是 integer（Error schema），全码表通用同一响应形状——
   * 这里用 number 而非 ValidationCodeValue（后者只约束管道产出的 7xxx）。
   */
  code: number;
  message: string;
  detail: { errors: ValidationErrorItem[] } | null;
}
