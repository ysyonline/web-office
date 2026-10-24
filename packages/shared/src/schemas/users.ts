/**
 * 用户域契约 schema：UserResponse / UserAdminResponse / UserCreateRequest / UserUpdateRequest。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

export const UserResponse = z.object({
  id: z.uuid().optional(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'member']).optional(),
  ssoProvider: z.string().nullable().optional(),
});

/** 管理端用户视图（比自助视图多状态与安全字段） */
export const UserAdminResponse = z.object({
  id: z.uuid().optional(),
  username: z.string().optional(),
  displayName: z.string().optional(),
  role: z.enum(['admin', 'member']).optional(),
  status: z.enum(['active', 'locked', 'disabled']).optional(),
  lockedUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  failedAttempts: z.number().int().optional(),
  ssoProvider: z.string().nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  /** 最近一次资料/角色/状态变更时间（与 schema.md §3.1 users.updated_at 对齐） */
  updatedAt: z.iso.datetime({ offset: true }).optional(),
});

export const UserCreateRequest = z.strictObject({
  username: z.string().min(3).max(64),
  displayName: z.string().max(128),
  role: z.enum(['admin', 'member']),
  /**
   * 可选；缺省时服务端生成随机一次性初始口令并在响应后不再可见
   * （等保口令策略：首次登录强制改密）。
   * 契约字段名为 initialPassword（避免与登录口令语义混淆），服务端映射到
   * Spec §5 建号请求体的 password；前端禁止以 password 为键发请求（x-field-mapping）。
   */
  initialPassword: z.string().min(8).max(128).optional(),
});

/** 部分更新；不提供 username 修改与物理删除 */
export const UserUpdateRequest = z.strictObject({
  displayName: z.string().max(128).optional(),
  role: z.enum(['admin', 'member']).optional(),
  /** 禁用即等保意义上的账号停用；不可在此解锁（解锁走 /users/:id/unlock） */
  status: z.enum(['active', 'disabled']).optional(),
});
