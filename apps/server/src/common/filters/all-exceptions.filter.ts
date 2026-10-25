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
 * P3-012-03（出站口统一）：四个 `res.json(...)` 全部改为经 `buildErrorBody` 拼装，
 * 本文件**不再出现任何中文文案字面量**。改之前四处各写一份（7003 一句、9001 两句），
 * 任何一次码表订正都不会传导到响应——这正是「同语义多出口一致」要防的。真正的
 * 分歧点只剩「用哪个码」和「message 是否覆盖」，两者在调用点一眼可见。
 *
 * message 覆盖的两处依据（其余一律吃码表文案，见 `buildErrorBody` 头注）：
 * - 校验分支：文案由管道按 body/query/path 分段给出（`messageFor`），与契约 400
 *   example 的「请求参数校验失败」对齐；
 * - HttpException 分支：message 是框架/业务抛出的既有信息（404 路由不存在的原文），
 *   本包不改写——**状态码透传、业务码统一兜底 9001**，状态→业务码的逐码映射归
 *   P3-012-04 的 `ERROR_LAYER_MATRIX`。因此当前 404 会出现「404 状态 + 9001 码」，
 *   这是骨架期的已知不一致，登记在 OPEN-DECISIONS（不在此就地编一个 404 映射）。

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
import type { ErrorCode } from '@wo/shared';
import { type Response } from 'express';

import { buildErrorBody } from '../errors/error-registry';
import {
  ValidationCode,
  type ValidationErrorBody,
  VALIDATION_HTTP_STATUS,
} from '../errors/validation-codes';
import { VALIDATION_ERROR_TAG, type ZodValidationException } from '../pipes/zod-validation.pipe';

/**
 * 兜底业务码（9001）。
 *
 * `satisfies ErrorCode` 让「码表删掉 9001」在编译期就红——这一个数字是本文件唯一
 * 允许出现的码字面量，且它不是「映射」，是「暂无映射时的唯一兜底」。状态码 → 业务码
 * 的逐码映射（404 / 409 / 503 各该回哪个码）归 P3-012-04，此处不预判。
 */
const FALLBACK_ERROR_CODE = 9001 satisfies ErrorCode;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (isValidationException(exception)) {
      // detail 用 ValidationErrorBody['detail'] 定型，而不是就地写字面量：管道产出的
      // 细分形状（errors[] 三字段）在这一层仍受类型约束，不合法在编译期就红。
      // 方向说明：`{errors[]}` → `unknown` 可赋值，反之不可——所以出站体只能是契约的
      // ErrorBody，不能拿 ValidationErrorBody 去 `satisfies`（那需要 as 一把梭）。
      const detail: ValidationErrorBody['detail'] = { errors: exception.items };
      res
        .status(VALIDATION_HTTP_STATUS)
        .json(buildErrorBody(exception.validationCode, detail, exception.message));
      return;
    }

    // JSON/multipart 载荷解析失败 → 7003（载荷没到管道，这一段只有过滤器能兜）。
    // 判据依据见文件头注：Nest 路由层已把 SyntaxError 包装成 BadRequestException(400)，
    // 只能按 message 特征识别。entity.too.large 一类容量越界语义上更接近 3001
    // （超 10MB，导入域），但那是导入端点的业务码、全局层不区分端点——维持 7003
    // 并在此登记，后续若需分流按路由前缀判断。
    if (isJsonParseError(exception)) {
      res.status(VALIDATION_HTTP_STATUS).json(buildErrorBody(ValidationCode.Payload));
      return;
    }

    // Nest 体系内异常（HttpException 家族）——骨架期保留状态码透传，但错误体统一契约形状。
    // message 覆盖为异常自带文案（框架/业务既有信息，本文件不改写，见文件头注）。
    if (exception instanceof HttpException) {
      res
        .status(exception.getStatus())
        .json(buildErrorBody(FALLBACK_ERROR_CODE, null, exception.message));
      return;
    }

    // 未知异常：不裸 500，吐契约形状（message 取码表 9001，不回显内部细节）。
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(buildErrorBody(FALLBACK_ERROR_CODE));
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
