/**
 * @wo/server 引导入口（P3-011-02）。
 *
 * 本包只做两件事：装配根模块、把服务拉起来并保证 `GET /api/v1/health` 回 `status:ok`。
 * 刻意不做的事（越界即返工，见 ANCHORS §3.1 三处定界）：
 * - 不装载配置：端口、日志级别、国密开关的配置键三分类归 P3-016（D1-11 ①），
 *   此处只读 `PORT` 环境变量兜底 3000，不引 ConfigModule、不读 .env、不设默认值表。
 * - 不连库：DataSource 归 P3-014（TypeORM 数据源与 10 表实体）。
 * - 不做启动断言链：三级国密校验 / License 公钥校验归 P3-016（D1-11 ②）。
 *
 * 全局前缀 `/api/v1` 与 `openapi.paths` 一致；`/ws/collab/{id}` 是 WebSocket 握手端点
 * （P3-070），不经 HTTP 路由层，故不受该前缀管辖——此处不需要 exclude 表。
 */
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

/** 端口兜底值。环境变量读取在此仅为「可换端口自测」，正式配置装载归 P3-016。 */
const PORT = Number(process.env['PORT'] ?? 3000);

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  await app.listen(PORT);
  Logger.log(`HTTP 已就绪：http://127.0.0.1:${PORT}/api/v1/health`, 'Bootstrap');
}

void bootstrap().catch((err: unknown) => {
  Logger.error(
    'bootstrap 失败',
    err instanceof Error ? (err.stack ?? err.message) : String(err),
    'Bootstrap',
  );
  process.exitCode = 1;
});
