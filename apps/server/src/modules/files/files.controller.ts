/**
 * files 组控制器（openapi tags=files，6 个操作）。
 *
 * 本卡（V3.2）落快照两操作；其余 4 个仍不声明——「能返回 200 的假端点比不存在的端点
 * 更难被发现」（V3.1 骨架的同一理由）。
 *
 * 快照只能由服务端从权威 Y.Doc 物化（openapi POST 描述：客户端无上传通道），故两个
 * 端点都不接受请求体。`id` 走与 WS 路径同一个形状（`common/doc-id.ts`），避免
 * 「能连不能存快照」的组合偏差。
 *
 * 404 走 `NotFoundException` → `AllExceptionsFilter` 透传状态并回 9001 业务码——这是
 * 骨架期的已知不一致（status→code 逐码映射归 P3-012-04），不在本文件就地编一个 404 码。
 */
import { Controller, Get, Inject, NotFoundException, Param, Post } from '@nestjs/common';
import { z } from 'zod';

import { DOC_ID_REGEX } from '../../common/doc-id';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { SnapshotPayload } from '../collab/collab-core.service';
import { CollabCoreService } from '../collab/collab-core.service';

/** path 段校验：失败落 7004（D1-13 ④）。 */
const DocIdParam = new ZodValidationPipe(z.string().regex(DOC_ID_REGEX), { source: 'path' });

@Controller('files')
export class FilesController {
  constructor(@Inject(CollabCoreService) private readonly collab: CollabCoreService) {}

  /** `POST /files/:id/snapshot`：显式物化，返回 `{version, baseSeq}`（openapi 201）。 */
  @Post(':id/snapshot')
  materialize(@Param('id', DocIdParam) id: string): { version: number; baseSeq: number } {
    return this.collab.materialize(id);
  }

  /** `GET /files/:id/snapshot`：最新快照（Yjs state update 经 gzip 的 Base64）。 */
  @Get(':id/snapshot')
  read(@Param('id', DocIdParam) id: string): SnapshotPayload {
    const snapshot = this.collab.readSnapshot(id);
    if (snapshot === null) throw new NotFoundException(`文件 ${id} 尚无物化快照`);
    return snapshot;
  }
}
