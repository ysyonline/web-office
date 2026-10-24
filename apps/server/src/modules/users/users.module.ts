/**
 * users 模块（openapi tags=users，5 个操作）。
 *
 * 本包（P3-011-02）对该模块只证明一件事：它能被根模块装配、且不引入跨模块依赖。
 * 依赖方向由 scripts/check-module-graph.mjs 机检（零环 + 全部注册）。
 */
import { Module } from '@nestjs/common';

import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
})
export class UsersModule {}
