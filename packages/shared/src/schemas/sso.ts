/**
 * SSO 域契约 schema：SsoCallbackRequest / SsoConfig。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

/**
 * 协议相关凭证（ldap 为服务端代理绑定验证后直接调用；oauth2 为 code+state；cas 为 ticket+service）。
 * 三协议字段互斥性（如 oauth2 必有 code）由服务端按 type 分流校验，契约层不建跨字段约束。
 */
export const SsoCallbackRequest = z.strictObject({
  /** oauth2 授权码 */
  code: z.string().optional(),
  state: z.string().optional(),
  /** CAS 票据 */
  ticket: z.string().optional(),
});

export const SsoConfig = z.strictObject({
  type: z.enum(['ldap', 'oauth2', 'cas']),
  enabled: z.boolean(),
  /** JSON 字符串（禁用 PG 专有特性，text 列存储）；结构按协议定义，服务端 schema 校验 */
  config: z.string().optional(),
});
