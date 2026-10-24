/**
 * 审计域契约 schema：AuditLogListResponse。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

export const AuditLogListResponse = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid().optional(),
        userId: z.uuid().optional(),
        action: z.string().optional(),
        targetType: z.string().optional(),
        targetId: z.string().optional(),
        /** JSON 字符串（text 列存储） */
        detail: z.string().optional(),
        ip: z.string().optional(),
        createdAt: z.iso.datetime({ offset: true }).optional(),
      }),
    )
    .optional(),
  total: z.number().int().optional(),
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  hasMore: z.boolean().optional(),
});
