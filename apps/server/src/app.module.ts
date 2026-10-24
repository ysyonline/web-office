/**
 * 根模块（P3-011-02）。
 *
 * imports 的 10 项与 `openapi.tags` 的 10 组一一对应（auth / users / sso / files /
 * import-export / share / audit / license / system / collab）。这条对应关系不是靠人记：
 * `scripts/check-endpoint-groups.mjs` 双向比对目录与 tags，缺一组或多一组即 fail。
 *
 * 模块划分只做分组，不做分层——本包不引入任何 `imports:` 模块间依赖，
 * 因此 `scripts/check-module-graph.mjs` 的零环断言在骨架期是「天花板已封顶」而非「暂时为空」：
 * 后续包若要加跨模块依赖，必须先让该脚本仍然零环。
 *
 * 注意 `system` 与 `collab` 两组的 controller 路由前缀不等于 tag 名
 * （`/api/v1/health`、`/api/v1/ws/*`）——分组由 tag 定、路由由 path 定，
 * 二者在契约里本就不一致，详见这两个 controller 的首部注释。
 */
import { Module } from '@nestjs/common';

import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CollabModule } from './modules/collab/collab.module';
import { FilesModule } from './modules/files/files.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { LicenseModule } from './modules/license/license.module';
import { ShareModule } from './modules/share/share.module';
import { SsoModule } from './modules/sso/sso.module';
import { SystemModule } from './modules/system/system.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    AuditModule,
    AuthModule,
    CollabModule,
    FilesModule,
    ImportExportModule,
    LicenseModule,
    ShareModule,
    SsoModule,
    SystemModule,
    UsersModule,
  ],
})
export class AppModule {}
