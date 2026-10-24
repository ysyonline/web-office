/**
 * 认证域契约 schema：LoginRequest / LoginResponse / RefreshRequest / RefreshResponse。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

import { UserResponse } from './users.js';

export const LoginRequest = z.strictObject({
  /** 明文传输（通道由 TLCP/TLS 保护），服务端 SM3+盐校验 */
  username: z.string().min(3).max(64),
  password: z.string().min(8).max(128),
});

export const LoginResponse = z.object({
  /** JWT，15min 有效 */
  accessToken: z.string().optional(),
  /** 7d 有效，服务端存 hash 可吊销 */
  refreshToken: z.string().optional(),
  user: UserResponse.optional(),
});

export const RefreshRequest = z.strictObject({
  refreshToken: z.string(),
});

export const RefreshResponse = z.object({
  accessToken: z.string().optional(),
});
