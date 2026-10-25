/**
 * 业务错误码表（P3-012-01，D1-05 ① 码段的 shared 侧单一来源）。
 *
 * ## 事实源
 *
 * `docs/api/openapi.yaml` 的 `x-error-code-registry.codes` 是码表的**唯一事实源**；
 * 本文件是它在代码里的转录件，`scripts/check-error-codes.mjs` 对二者做**键集合双向
 * 相等 + 文案逐字相等**的机检（verify 第十四段）。转录件没有门禁就是漂移温床——
 * 尤其文案：码还在、语义被悄悄改掉，编译器和类型系统都看不见。
 *
 * 段划分（DESIGN-LAYER §3.2 D1-05 条 1，以 registry 放行实况为准，本卡无权重分配）：
 * 1xxx 认证与用户 / 2xxx 文件域 / 3xxx 导入 / 4xxx 协同与连接 / 5xxx License /
 * 6xxx SSO / 7xxx 请求校验 / 9xxx 兜底。
 *
 * ## 本文件只做三件事
 *
 * 1. 码 → 中文文案（逐字，供错误体 `message` 兜底）；
 * 2. `ErrorCode` 联合类型（编译期锁住「写了码表里没有的数字」，见
 *    `apps/server/src/common/errors/validation-codes.ts` 的 `satisfies` 用法）；
 * 3. 四层矩阵的**类型形状**（HTTP status / WS close / UI 档位）。
 *
 * **不含四层矩阵的取值**：逐码的 HTTP 映射与 UI 档位是 D1-05 ②③④ 的裁决内容，
 * 属 P3-012-04（边界与错误）的交付面。本包只定形状不定值——先填一份猜的矩阵，
 * 等于给下游一份看起来权威的假契约。
 */
import type { z } from 'zod';

import type { ErrorSchema as ErrorSchemaRef } from '../schemas/error.js';

/**
 * 码表（30 条，逐字对齐 registry）。键为数字字面量，故 `ErrorCode` 直接是
 * `1001 | 1002 | ...` 的联合，`ERROR_CODE_MESSAGES[7001]` 取到的是字面量文案。
 */
export const ERROR_CODE_MESSAGES = {
  1001: '凭证错误（含剩余尝试次数）',
  1002: '账号锁定（等保：5 次失败锁 15 分钟）',
  1003: 'refresh token 无效/过期/已吊销',
  1004: '未认证或 access token 过期',
  1005: '无权限（角色不足）',
  1006: '用户名已存在',
  1007: '用户不存在',
  1008: '非法用户操作（禁用/降级最后一个 admin）',
  1009: '账号未锁定（解锁无意义）',
  2001: '文件不存在',
  2002: '文件名冲突或非法',
  2003: '快照超过上限（gzip 后 32MB）',
  2004: '分享已存在',
  2005: '快照物化进行中（幂等保护）',
  3001: '导入文件超 10MB',
  3002: '导入格式不支持',
  3003: '解析失败（xlsx 结构异常）',
  4001: '协同连接未认证（WS close 4401 对应）',
  4002: '协同无编辑权限（WS close 4403 对应）',
  5001: 'License 缺失/过期/超席（只读降级）',
  5002: 'License 验签失败/指纹不匹配',
  6001: 'SSO 票据/凭证校验失败',
  6002: 'SSO 协议未启用',
  6003: 'SSO 配置校验失败',
  7001: '请求体/参数校验失败（detail.errors[] 逐字段）',
  7002: '查询参数越界（分页/排序/筛选条件非法）',
  7003: 'JSON / multipart 载荷非法（解析失败或 Content-Type 不匹配）',
  7004: '路径参数格式非法（如 id 非 uuid）',
  9001: '服务端内部错误',
  9002: '依赖不可用（数据库/Redis）',
} as const;

/** 全码表的数字联合类型（30 个字面量）。 */
export type ErrorCode = keyof typeof ERROR_CODE_MESSAGES;

/** 码段归属（DESIGN-LAYER §3.2 D1-05 条 1）。 */
export type ErrorCodeSegment =
  'auth' | 'file' | 'import' | 'collab' | 'license' | 'sso' | 'validation' | 'fallback';

/** 千百位 → 段归属（与 registry 的段划分逐字对应）。 */
const SEGMENT_BY_THOUSANDS: Readonly<Record<number, ErrorCodeSegment>> = {
  1: 'auth',
  2: 'file',
  3: 'import',
  4: 'collab',
  5: 'license',
  6: 'sso',
  7: 'validation',
  9: 'fallback',
};

/**
 * 码段归属。`noUncheckedIndexedAccess` 下索引取值可能 undefined——`ErrorCode` 已由
 * 码表键集合限定，理论上不可达，故取不到时抛而不是返回兜底值：静默兜底会让「码表
 * 加了 8xxx 段但忘了登记段归属」变成无声的误分类。
 */
export function errorCodeSegment(code: ErrorCode): ErrorCodeSegment {
  const segment = SEGMENT_BY_THOUSANDS[Math.floor(code / 1000)];
  if (segment === undefined) {
    throw new RangeError(`错误码 ${String(code)} 无段归属（SEGMENT_BY_THOUSANDS 缺项）`);
  }
  return segment;
}

/** 运行期判据：任意数字是否属码表（用于「外部传入的 code 不得透传」类校验）。 */
export function isErrorCode(value: number): value is ErrorCode {
  return Object.hasOwn(ERROR_CODE_MESSAGES, value);
}

/** 码 → 中文文案（逐字取码表，不做拼接/兜底）。 */
export function errorMessage(code: ErrorCode): string {
  return ERROR_CODE_MESSAGES[code];
}

/**
 * UI 呈现三档（DESIGN-LAYER §3.2 D1-05 条 4）：
 * `toast` 可继续 / `inline` 页内态（阻断单操作）/ `fullscreen` 全屏阻断（会话失效）。
 */
export type ErrorUiTier = 'toast' | 'inline' | 'fullscreen';

/**
 * 四层矩阵的一行：HTTP status / 业务 code / WS close / 前端呈现档位（D1-05 条 2）。
 *
 * - `httpStatus`：该码在 HTTP 出口应回的状态码；无 HTTP 出口（纯 WS 码，如 4001/4002）
 *   为 `null`——用 null 而不是 0，避免「0 是不是合法状态码」这类歧义。
 * - `wsClose`：同一语义在 WS 侧对应的 close 码集合；无 WS 出口为空数组（不是 null：
 *   集合语义天然可为空，空数组与缺字段在类型上等价，但缺字段会让「忘了填」与
 *   「确无 WS 出口」无法区分）。
 * - `uiTier`：前端呈现档位，唯一来源（D1-07 条 3 的「单一事实源」在错误侧的对应）。
 */
export interface ErrorLayerRow {
  readonly httpStatus: number | null;
  readonly wsClose: readonly number[];
  readonly uiTier: ErrorUiTier;
}

/**
 * 统一错误响应体（Spec §10「错误响应统一结构 {code,message,detail}」）。
 *
 * 与 `schemas/error.ts` 的 `ErrorSchema` 是同一条契约的两个面：`ErrorSchema` 是
 * **校验面**（响应体出站/入站校验用，宽松 `z.object`），本接口是**构造面**（拼装用，
 * 字段只读）。二者字段集必须一致，但类型不可互相替代——`detail` 在契约里无 type
 * 声明（对象/字符串/null 三态），构造面用 `unknown` 承接。
 */
export interface ErrorBody {
  readonly code: number;
  readonly message: string;
  readonly detail?: unknown;
}

/**
 * `ErrorBody` 与 `ErrorSchema` 的字段集一致性断言（编译期）。
 *
 * 为什么需要它：契约加了字段（比如未来给 Error 加 `traceId`），`ErrorSchema` 会跟着
 * 改，而本文件手写的接口不会——两处并存就必然分叉。
 *
 * **两重判据，缺一不可**（这是本断言唯一的坑，实测过）：
 * 1. **键集合双向相等**（`KeysEqual`）：单靠「双向可赋值」抓不到「多一个可选字段」——
 *    给 `ErrorBody` 加 `traceId?: string` 而不改契约，两个方向都仍然可赋值
 *    （多出的可选属性不破坏结构兼容），断言会假绿。键集合比对才抓得住。实测：
 *    只留可赋值判据时该探针静默通过，加上键集判据后 tsc 报 TS2322。
 * 2. **双向可赋值**：抓「同名但类型不兼容」（如 `detail` 被收成 `Record<string,string>`）。
 *
 * `detail`：`ErrorSchema` 是 `unknown().nullable().optional()`、本接口是 `unknown`
 * 可选，键与类型都相容，故不构成差异。
 */
type SchemaErrorFields = z.infer<typeof ErrorSchemaRef>;
type KeysEqual<X, Y> = keyof X extends keyof Y ? (keyof Y extends keyof X ? true : false) : false;
export type ErrorBodyMatchesSchema =
  KeysEqual<ErrorBody, SchemaErrorFields> extends true
    ? ErrorBody extends SchemaErrorFields
      ? SchemaErrorFields extends ErrorBody
        ? true
        : false
      : false
    : false;

/** 类型断言辅助：让上面的条件类型真的被 tsc 检查（值层面永远为 true，不参与运行期）。 */
export const ERROR_BODY_MATCHES_SCHEMA: ErrorBodyMatchesSchema = true;
