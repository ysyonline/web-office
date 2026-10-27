/**
 * collab 模块（openapi tags=collab，2 个操作）。
 *
 * 依赖方向：`files → collab`（快照端点复用权威 Y.Doc），反向不存在；模块图机检
 * （scripts/check-module-graph.mjs）从「10 模块 / 0 依赖」变为「10 模块 / 1 依赖」。
 * `CollabCoreService` 是唯一对外导出的能力；WS 接入层与其依赖的 `WoDb` 留在模块内，
 * 避免 files 绕过核心直接碰库。
 */
import { Module } from '@nestjs/common';

import { WoDb } from '../../db/wo-db';
import { CollabCoreService } from './collab-core.service';
import { CollabController } from './collab.controller';
import { CollabWsService } from './collab-ws.service';

@Module({
  controllers: [CollabController],
  providers: [WoDb, CollabCoreService, CollabWsService],
  exports: [CollabCoreService],
})
export class CollabModule {}
