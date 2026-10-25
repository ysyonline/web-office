/**
 * 全局异常过滤器（P3-011-04 骨架，D1-13 ④ 栏错误响应形状的执行面）。
 *
 * 本包只落三类分支（越界即返工，见 ANCHORS §3.1）：
 * 1. ZodValidationException（管道抛出）→ 400 + {code,message,detail:{errors[]}}
 * 2. body-parser 的 JSON 解析错误 → 400 + 7003。**实测（Nest core `routes-resolver.js`
 *    mapExternalException）**：Nest 在路由层把 body-parser 的原始 SyntaxError 统一
 *    包装成 `BadRequestException(err.message)` 再进过滤器——原始 type/statusCode
 *    属性面已丢失，唯一稳定判据是「400 状态 + JSON 解析特征 message」（Nest 自
 *    body-parser 语义化 message 前缀：`Unexpected token` / `is not valid JSON` /
 *    `in JSON at position`）。这比「读不到的 type 属性」诚实：误判面 = 上层业务
 *    BadRequestException 的 message 同时含特征词且状态 400，而业务侧 400 校验类
 *    错误走管道（tag 判据在前），落不到这个分支。
 * 3. 其余全部 → 500 + 9001 兜底（9002 依赖不可用、HttpException 家族逐码映射的
 *    完整实现归后续包——本骨架期唯一保证的是「不裸 500」：任何未识别异常都吐契约
 *    形状的错误体）
 *
 * 为什么用 tag 而不用 instanceof 识别校验异常：ZodValidationException 继承
 * BadRequestException，Nest 自带的 ExceptionsHandler 会把 BadRequestException 直接
 * 转成 400（无 code 无 detail）——过滤器必须抢在它之前识别。tag 标记位在跨模块/
 * 打包场景下比 instanceof 更稳（类身份只有一个来源，但 tag 是纯数据判据，
 * 单测构造假对象也能测）。
 *
 * X-Request-Id：契约 400 响应声明了该响应头（components.responses/BadRequest.headers），
 * 但 traceId 的生成与贯穿是 P3-013（日志与请求上下文）的交付物——本包不生成 id、
 * 不写响应头，避免与 P3-013 的实现口径打架。9001 的 detail.requestId 同理归后。
 */
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { type Response } from 'express';

import {
  ValidationCode,
  type ValidationErrorBody,
  VALIDATION_HTTP_STATUS,
} from '../errors/validation-codes';
import { VALIDATION_ERROR_TAG, type ZodValidationException } from '../pipes/zod-validation.pipe';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (isValidationException(exception)) {
      const body: ValidationErrorBody = {
        code: exception.validationCode,
        message: exception.message,
        detail: { errors: exception.items },
      };
      res.status(VALIDATION_HTTP_STATUS).json(body);
      return;
    }

    // JSON/multipart 载荷解析失败 → 7003（载荷没到管道，这一段只有过滤器能兜）。
    // 判据依据见文件头注：Nest 路由层已把 SyntaxError 包装成 BadRequestException(400)，
    // 只能按 message 特征识别。entity.too.large 一类容量越界语义上更接近 3001
    // （超 10MB，导入域），但那是导入端点的业务码、全局层不区分端点——维持 7003
    // 并在此登记，后续若需分流按路由前缀判断。
    if (isJsonParseError(exception)) {
      res.status(VALIDATION_HTTP_STATUS).json({
        code: ValidationCode.Payload,
        message: '请求载荷非法（JSON 解析失败或 Content-Type 不匹配）',
        detail: null,
      } satisfies ValidationErrorBody);
      return;
    }

    // Nest 体系内异常（HttpException 家族）——骨架期保留状态码透传，但错误体统一契约形状。
    if (exception instanceof HttpException) {
      res.status(exception.getStatus()).json({
        code: 9001,
        message: exception.message,
        detail: null,
      } satisfies ValidationErrorBody);
      return;
    }

    // 未知异常：不裸 500，吐契约形状（message 不回显内部细节）。
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 9001,
      message: '服务端内部错误',
      detail: null,
    } satisfies ValidationErrorBody);
  }
}

/** tag 判据（见文件头注：比 instanceof 更可测）。 */
function isValidationException(e: unknown): e is ZodValidationException {
  return (
    typeof e === 'object' &&
    e !== null &&
    VALIDATION_ERROR_TAG in e &&
    (e as Record<string, unknown>)[VALIDATION_ERROR_TAG] === true
  );
}

/** JSON 解析错误判据：body-parser 语义化 message 特征（全小写、英文、含位置/词法描述）。 */
const JSON_PARSE_MESSAGE_PATTERNS = [
  /unexpected token/i,
  /is not valid json/i,
  /in json at position/i,
  /unexpected end of json/i,
] as const;

/** 7003 判据（实测依据见文件头注）：Nest 包装后的 BadRequestException(400) + 解析特征 message。 */
function isJsonParseError(e: unknown): boolean {
  if (!(e instanceof HttpException)) return false;
  if (e.getStatus() !== 400) return false;
  if (isValidationException(e)) return false; // 校验异常已在上一分支返回，此处防重复
  const message = e.message ?? '';
  return JSON_PARSE_MESSAGE_PATTERNS.some((p) => p.test(message));
}
