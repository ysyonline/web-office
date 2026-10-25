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
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
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
// 中文错误文案的全局配置（z.config 进程级，单一 side-effect 入口，见文件头注）。
import './common/pipes/zh-locale';

@Module({
  providers: [
    // 异常过滤器是「任何异常都必须吐契约形状」的兜底，全局注册是它的本意——
    // 与 D1-13「自研 pipe 不能全局注册」不冲突：漏挂的是校验（管道），漏挂后端点
    // 收到的非法载荷不抛异常、直接进服务层，那是 P3-037 遍历门禁要抓的缺陷；
    // 而过滤器漏挂的后果是裸 500 / Nest 默认错误体，全局兜住恰恰是 D1-13 ④ 栏
    // 「错误码映射」的执行前提。
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
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
