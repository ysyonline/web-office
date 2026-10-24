/**
 * 错误域契约 schema：Error / ValidationErrorDetail / ValidationErrorItem。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 *
 * Error 的 detail（结构化补充）在契约中无 type 声明（对象/字符串/null 三态，形态随
 * code 变化：7001/6003 固定为 ValidationErrorDetail 形态、9001 固定为 { requestId }），
 * 故 zod 侧用 `z.unknown().nullable()` 照抄——不收紧成 union（union 引入契约没有的
 * additionalProperties: false 语义，属私改契约）；code 与 detail 的 形态的绑定校验归
 * P3-011-04 的错误过滤器实现，不属于 schema 层。
 */
import { z } from 'zod';

export const ValidationErrorItem = z.strictObject({
  /** 字段点路径；根级或请求体整体类型错误为字面量 (root) */
  field: z.string(),
  /** 校验规则标识（zod issue code） */
  rule: z.string(),
  /** 中文可读描述，直接呈现给用户 */
  message: z.string(),
});

/** 校验类错误的 detail 形态（7001 / 6003） */
export const ValidationErrorDetail = z.strictObject({
  /** 逐字段错误明细；前端按 field 映射到字段下方，field === '(root)' 走 Toast */
  errors: z.array(ValidationErrorItem),
});

/** 统一错误结构（Spec 第 10 章：{code,message,detail}） */
export const ErrorSchema = z.object({
  /** 业务错误码（非 HTTP 状态码）；0 表示成功不出现在错误体中 */
  code: z.number().int(),
  /** 人类可读描述（中文） */
  message: z.string(),
  /**
   * 结构化补充信息，类型不固定（对象/字符串/null）。
   * 契约无 type 声明，照抄为 unknown+nullable；形态随 code 变化见文件头注。
   */
  detail: z.unknown().nullable().optional(),
});
