/**
 * 分享域契约 schema：ShareCreateRequest / ShareResponse。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

export const ShareCreateRequest = z.strictObject({
  userId: z.uuid(),
  perm: z.enum(['view', 'edit']),
});

export const ShareResponse = z.object({
  id: z.uuid().optional(),
  fileId: z.uuid().optional(),
  userId: z.uuid().optional(),
  perm: z.enum(['view', 'edit']).optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
});
