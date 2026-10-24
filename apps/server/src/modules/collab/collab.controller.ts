/**
 * collab 组控制器（openapi tags=collab，2 个操作）。
 *
 * 路由前缀取 `ws` 而非 tag 名：契约中该组两个操作是 `POST /api/v1/ws/ticket` 与
 * `GET /ws/collab/{id}`，均不在 `/collab` 下。与 system 同属 G11 的已知错位。
 * 本类不声明路由：WS 握手与 ticket 签发归 P3-070，提前落半成品会让模块图与路由表脱节。
 */
import { Controller } from '@nestjs/common';

@Controller('ws')
export class CollabController {}
