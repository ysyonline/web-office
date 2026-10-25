/**
 * @wo/server 引导入口（P3-011-02 立、P3-012-02 接线配置装载）。
 *
 * 本文件只做三件事：装载配置、装配根模块、把服务拉起来并保证 `GET /api/v1/health`
 * 回 `status:ok`。刻意不做的事（越界即返工，见 ANCHORS §3.1 / §4 三处定界）：
 * - 不连库：DataSource 归 P3-014（TypeORM 数据源与 10 表实体）。`WO_DB_URL` 只做
 *   「必填即装载」，**不据此建连接**——readiness 的 `SELECT 1` 归 P3-016。
 * - 不做启动断言链：三级国密校验 / License 公钥验签归 P3-016（D1-11 ②）。本文件只
 *   保证 `WO_LICENSE_PUBLIC_KEY` 非空（-02 的形态转换边界），形态与验签在 -04 / P3-016。
 *
 * 配置装载在 `NestFactory.create` **之前**（P3-012-02）：配置错了就不该起进程，更不该
 * 在端口已监听的情况下起进程。装载失败走 `process.exit(1)` 而非 `process.exitCode = 1`
 * ——**对照实验做过**：本包两个失败面（必填缺失 / EADDRINUSE）两种写法实测都给出
 * exit=1，差异不在当下而在将来——一旦 catch 路径上出现存活句柄（P3-014 起的 DataSource
 * 连接池就是典型），`exitCode` 写法会从「退 1」退化成「不退出」。取确定性写法，也让
 * 后续包没有理由把它当等价物改回去。
 *
 * 全局前缀 `/api/v1` 与 `openapi.paths` 一致；`/ws/collab/{id}` 是 WebSocket 握手端点
 * （P3-070），不经 HTTP 路由层，故不受该前缀管辖——此处不需要 exclude 表。
 */
import 'reflect-metadata';
import { Logger, type LogLevel as NestLogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import type { LogLevel } from './config/config.types';
import { ConfigLoadError, loadConfig } from './config/config.loader';

/**
 * 四档日志级别 → Nest LoggerService 的级别名集合（Nest 的 info 档正式名是 `log`）。
 *
 * 为什么在这里而不用一个 `LOG_LEVEL` 字符串透传：Nest 的 `logger` 选项要的是**级别
 * 集合**，不是单一档位。映射表放在入口（唯一消费点），不塞进配置层——配置层只负责
 * 「值合法」，不负责「框架怎么用这个值」。
 */
const NEST_LOGGER_LEVELS: Record<LogLevel, NestLogLevel[]> = {
  debug: ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'],
  info: ['log', 'error', 'warn', 'fatal'],
  warn: ['warn', 'error', 'fatal'],
  error: ['error', 'fatal'],
};

async function bootstrap(): Promise<void> {
  const { config, degradations } = loadConfig(process.env);
  const app = await NestFactory.create(AppModule, {
    logger: NEST_LOGGER_LEVELS[config.logLevel],
  });
  for (const line of degradations) {
    Logger.warn(`配置降级：${line}`, 'Config');
  }
  app.setGlobalPrefix('api/v1');
  await app.listen(config.port);
  Logger.log(`HTTP 已就绪：http://127.0.0.1:${config.port}/api/v1/health`, 'Bootstrap');
}

void bootstrap().catch((err: unknown) => {
  if (err instanceof ConfigLoadError) {
    // 结构化字段优先于文案：reason/key/env 直接进日志，便于编排器与运维脚本按字段抓取。
    Logger.error(
      `${err.message}（reason=${err.reason}, env=${err.env}, key=${err.key}）`,
      err.stack,
      'Config',
    );
  } else {
    Logger.error(
      'bootstrap 失败',
      err instanceof Error ? (err.stack ?? err.message) : String(err),
      'Bootstrap',
    );
  }
  process.exit(1);
});
