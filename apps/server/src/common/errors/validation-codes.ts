/**
 * 7xxx 请求校验错误码（P3-011-04）。
 *
 * 逐字照抄 `docs/api/openapi.yaml` 的 `x-error-code-registry` 7xxx 段——那是码表的
 * 唯一事实源；本文件是它在服务端的执行面定义。D1-05 卡（错误码与降级四层矩阵）定稿
 * 后若四层对照需要更多出口（HTTP status 映射等），以卡为准回写此处，不在别处再写字面量。
 *
 * 四条码的语义边界（与管道分流的对应关系）：
 * - 7001 请求体校验失败（ZodValidationPipe 校验 body 产生）
 * - 7002 查询参数越界（同管道校验 query 产生；无 coerce 前置时 `?limit=200` 会走
 *   invalid_type 误入 7001，见 D1-13-B「query/path 前置」行）
 * - 7003 JSON/multipart 载荷非法（解析失败，非法 JSON 到不了管道——由异常过滤器兜）
 * - 7004 路径参数格式非法（如 id 非 uuid）
 */

/** 校验类错误码 → HTTP 400（openapi 各端点 400 响应统一 $ref components.responses/BadRequest）。 */
export const VALIDATION_HTTP_STATUS = 400 as const;

/** 7xxx 段四个码（与 x-error-code-registry 逐字对应）。 */
export const ValidationCode = {
  /** 请求体/参数校验失败（detail.errors[] 逐字段） */
  Body: 7001,
  /** 查询参数越界（分页/排序/筛选条件非法） */
  Query: 7002,
  /** JSON / multipart 载荷非法（解析失败或 Content-Type 不匹配） */
  Payload: 7003,
  /** 路径参数格式非法（如 id 非 uuid） */
  Path: 7004,
} as const;

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
