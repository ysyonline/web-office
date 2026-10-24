/**
 * share 组控制器（openapi tags=share，1 个操作）。
 *
 * 本类不声明任何端点——该组 N 个操作的路由与请求校验归消费该组的后续工作项。
 * 提前落半成品路由会让「模块目录 与 openapi tags 组」的机检失去判别力：
 * 一个能返回 200 的假端点，比一个不存在的端点更难被发现。
 */
import { Controller } from '@nestjs/common';

@Controller('share')
export class ShareController {}
