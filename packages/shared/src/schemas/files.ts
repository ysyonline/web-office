/**
 * 文件域契约 schema：FileCreateRequest / FileRenameRequest / FileResponse / FileListResponse /
 * SnapshotResponse / ImportTaskStatus。
 * 出处：docs/api/openapi.yaml `components.schemas` 同名条目；口径见 ./common.ts。
 */
import { z } from 'zod';

export const FileCreateRequest = z.strictObject({
  name: z.string().min(1).max(200),
});

export const FileRenameRequest = z.strictObject({
  name: z.string().min(1).max(200),
});

export const FileResponse = z.object({
  id: z.uuid().optional(),
  name: z.string().optional(),
  ownerId: z.uuid().optional(),
  createdAt: z.iso.datetime({ offset: true }).optional(),
  updatedAt: z.iso.datetime({ offset: true }).optional(),
  /** 最新快照版本号 */
  version: z.number().int().optional(),
});

export const FileListResponse = z.object({
  items: z.array(FileResponse).optional(),
  total: z.number().int().optional(),
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  hasMore: z.boolean().optional(),
});

/**
 * Univer IWorkbookData 经 gzip 压缩再 Base64 的字符串（服务端物化产物；上限 gzip 后 32MB，
 * 体积依据见 spike REPORT 附录 A）。
 */
export const SnapshotResponse = z.object({
  snapshot: z.string().optional(),
  version: z.number().int().optional(),
  /** 水位线——物化该快照时已消费的 yjs_updates 最大 seq；加载协议据此回放 seq > baseSeq 的增量 */
  baseSeq: z.number().int().optional(),
});

export const ImportTaskStatus = z.object({
  status: z.enum(['pending', 'parsing', 'done', 'failed']).optional(),
  /** failed 时的原因（如样式不支持的降级说明） */
  error: z.string().nullable().optional(),
  /** done 时解析产物归属的文件 id */
  fileId: z.uuid().nullable().optional(),
});
