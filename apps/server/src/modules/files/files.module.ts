/**
 * files 模块（openapi tags=files，6 个操作）。
 *
 * 本卡（V3.2）只落快照两操作：`GET/POST /api/v1/files/{id}/snapshot`。其余 4 个操作
 * 仍不声明——理由同 V3.1 的骨架注释：能返回 200 的假端点比不存在的端点更难被发现。
 *
 * 快照端点依赖 collab 的权威 Y.Doc，故 imports `CollabModule`；依赖方向单向
 * （`files → collab`），模块图机检仍零环。
 */
import { Module } from '@nestjs/common';

import { CollabModule } from '../collab/collab.module';
import { FilesController } from './files.controller';

@Module({
  imports: [CollabModule],
  controllers: [FilesController],
})
export class FilesModule {}
