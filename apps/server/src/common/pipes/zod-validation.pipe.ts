/**
 * ZodValidationPipe（P3-011-04，D1-13 卡 ④ 栏的执行面）。
 *
 * 为什么自研而不用 nestjs-zod / class-validator：P3-001 裁决「zod 单一 schema 源」——
 * 22 个契约 schema 已在 @wo/shared/src/schemas/（-03），本管道只做「schema 校验 +
 * issue → 400+7xxx 错误体」这一件事，不引入第二套校验体系。
 *
 * **刻意不全局注册**（D1-13 决议）：漏挂 pipe 的端点将「零校验」静默通过，这正是
 * P3-037 的 E-CV ① 类遍历门禁要抓的缺陷——若在本包 useGlobalPipes 一挂了之，
 * 那条防线就永久失效。挂载由各端点用 @UsePipes(ZodValidationPipe) 显式声明。
 *
 * 分流依据（D1-13 ④ 栏）：
 * - body 校验失败 → 7001（detail.errors[] 逐字段）
 * - query 校验失败 → 7002（schema 必须 coerce 前置，否则 `?limit=200` 走
 *   invalid_type 误报 7001——coerce 形态见 @wo/shared 后续 query schema，口径在
 *   D1-13-B「query/path 前置」行：z.coerce.number().int().min(1).max(100)）
 * - path 校验失败 → 7004
 *
 * 错误体形状照抄契约 components.responses/BadRequest：
 * `{code, message, detail: {errors: [{field, rule, message}]}}`。
 * - field = z.core.toDotPath(issue.path) || '(root)'（根级 issue 恒 (root)，不区分 code）
 * - rule = issue.code（zod issue code 字面量，只按字符串比对，不 import $ZodIssueCode
 *   ——它是纯类型别名，运行时不存在，D1-13-B「rule 取值」行实测订正）
 * - message 必须中文：schema 侧全局 z.config(z.locales.zhCN())（见本目录 zhLocale.ts）；
 *   unrecognized_keys 的默认文案含键名（「出现未知的键(key): "zz"」），满足 D1-13-B
 *   「message 模板必须内联未知键名」的强制要求，不覆盖。
 *
 * ZodValidationException 抛出后由 AllExceptionsFilter 统一转 400 JSON 响应——
 * 管道不直接操作 response（保持管道可单测、无 HTTP 依赖）。
 */
import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

// $ZodIssue 是 core 层类型（zod/v4/core/index.d.ts re-export）；顶层 'zod' 只在
// classic/schemas 的方法签名里间接引用它，未做具名 re-export——按 core 子路径导入。
import type { $ZodIssue } from 'zod/v4/core';

import {
  ValidationCode,
  type ValidationCodeValue,
  type ValidationErrorItem,
} from '../errors/validation-codes';

/** 校验来源段——决定失败时落哪个 7xxx 码。 */
export type ValidationSource = 'body' | 'query' | 'path';

/** 供 AllExceptionsFilter 识别「这是校验类异常」的类型标记（instanceof 跨包不可靠，用标记位）。 */
export const VALIDATION_ERROR_TAG = 'WO_VALIDATION_ERROR' as const;

/** 携带 7xxx 码与逐字段明细的异常；过滤器按 tag 识别并转 400。 */
export class ZodValidationException extends BadRequestException {
  readonly [VALIDATION_ERROR_TAG] = true as const;
  readonly validationCode: ValidationCodeValue;
  readonly items: ValidationErrorItem[];

  constructor(code: ValidationCodeValue, items: ValidationErrorItem[]) {
    super({ code, message: messageFor(code), detail: { errors: items } });
    this.validationCode = code;
    this.items = items;
  }
}

/** code → message 的单一映射（中文文案照抄契约 BadRequest example 的口径）。 */
function messageFor(code: ValidationCodeValue): string {
  switch (code) {
    case ValidationCode.Body:
      return '请求参数校验失败';
    case ValidationCode.Query:
      return '查询参数越界';
    case ValidationCode.Path:
      return '路径参数格式非法';
    default:
      return '请求参数校验失败';
  }
}

/** zod issue → 契约明细项（field/rule/message 三字段，形状见 components.schemas/ValidationErrorItem）。 */
export function toItem(issue: $ZodIssue): ValidationErrorItem {
  return {
    field: zodFieldOf(issue),
    rule: issue.code,
    message: issue.message,
  };
}

/**
 * field = z.core.toDotPath(issue.path) || '(root)'（D1-13-B「field 取值」行）。
 * toDotPath 在 path 为空数组时返回 ''，此时一律 (root)——不区分 issue.code。
 */
function zodFieldOf(issue: $ZodIssue): string {
  const dot = z.core.toDotPath(issue.path);
  return dot === '' ? '(root)' : dot;
}

export interface ZodValidationOptions {
  /** 校验来源段（默认 body → 7001）；query → 7002；path → 7004。 */
  source?: ValidationSource;
}

/**
 * 用法：`@UsePipes(new ZodValidationPipe(LoginRequest))`（body）
 * 或 `new ZodValidationPipe(PageQuerySchema, { source: 'query' })`（query）。
 * 管道拿到的是 zod schema 本身（safeParse），不做任何类型转换。
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform<unknown, unknown> {
  constructor(
    private readonly schema: {
      safeParse: (input: unknown) => { success: boolean; error?: { issues: $ZodIssue[] } };
      parse: (input: unknown) => unknown;
    },
    private readonly options: ZodValidationOptions = {},
  ) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return value;

    const source: ValidationSource = this.options.source ?? 'body';
    const code: ValidationCodeValue =
      source === 'query'
        ? ValidationCode.Query
        : source === 'path'
          ? ValidationCode.Path
          : ValidationCode.Body;

    const items = (result.error?.issues ?? []).map(toItem);
    throw new ZodValidationException(code, items);
  }
}
