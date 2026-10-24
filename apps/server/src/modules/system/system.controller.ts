/**
 * system 组控制器（openapi tags=system，2 个操作）。
 *
 * 路由前缀取 `health` 而非 tag 名：契约路径是 `/api/v1/health`（openapi.paths 第 910 行），
 * 分组（模块归属）由 tag 定、路由前缀由 path 定，二者在 system 组上本就不一致——
 * 这是 G11「端点分组基座错位」的已知现象，不是笔误。
 * 本组 2 个操作中只有 liveness 在此实现；readiness（`/health/ready`）归 P3-016（D1-11 ③），
 * 提前落它会把「依赖可用性」的判定链抄一份到这里，而那条链的载体是配置装载与启动断言。
 */
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class SystemController {
  /**
   * liveness：进程能应答即活（D1-11 ② 与 readiness 是两个语义、不可合并）。
   * 响应体形状取自 openapi.paths./api/v1/health 的 200 inline schema —— 该响应没有命名组件，
   * 故此处不引 `@wo/shared` 的契约 schema（-03 的 22 个 schema 只覆盖命名组件）。
   */
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
