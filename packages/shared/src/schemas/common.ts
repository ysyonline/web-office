/**
 * 契约 schema 公共口径（P3-011-03）。
 *
 * 本文件不导出 schema，只承载 22 个契约 schema 共同遵守的裁决与写法约束，
 * 逐文件头注引用此处，避免同一段话抄 22 遍后漂移。
 *
 * ## 事实源链（D1-13 ① 栏）
 *
 * `docs/api/openapi.yaml` 手写件是唯一契约事实源；本目录的 zod 定义是它在请求校验侧
 * 的执行面；`schemaOf()`（P3-011-04 装饰器产物）从属二者。命名与结构逐字对齐
 * `components.schemas`（22 个），对齐关系由 `scripts/check-schema-names.mjs` 双向机检。
 *
 * ## strict 口径（2026-10-25 本包裁决）
 *
 * 依据三源交叉：卡面条 3（DESIGN-LAYER §3.2「请求 schema 一律 .strict()」）+
 * 工作项收口断言（「全部 request schema 为 z.strictObject()/.strict()」）+
 * openapi 机读（显式 `additionalProperties: false` 共 11 处 = 9 个 $ref requestBody
 * schema + ValidationErrorDetail + ValidationErrorItem）。
 *
 * - **9 个请求侧 schema 一律 `z.strictObject`**：三源同口径。禁裸 `z.object` 的 ESLint
 *   规则（A-STRICT）归 P3-011-05，规则扫描面须覆盖本目录（交接件缺陷 1 的静态防线）。
 * - **响应侧 13 个用 `z.object`（strip 语义）**：卡面与收口断言均只约束请求侧；openapi
 *   对响应 schema 未声明 `additionalProperties: false`。响应收紧属契约变更，超出本包
 *   权限（「不私改 yaml」纪律），如需收紧走 OPEN-DECISIONS 解冻流程。
 * - `ValidationErrorDetail` / `ValidationErrorItem` 虽在 Error（响应侧）树内，但 openapi
 *   显式声明了 `additionalProperties: false`，照抄契约用 `z.strictObject`。
 *
 * ## 写法约束（zod 4.6.7 逐条实测）
 *
 * | openapi 形态 | zod 写法 | 实测依据 |
 * |---|---|---|
 * | `format: uuid` | `z.uuid()` | 投影还原 `format: uuid` + RFC 4122 变体 pattern |
 * | `format: date-time` | `z.iso.datetime({ offset: true })` | 无 offset 选项实测拒 `+08:00`（RFC 3339 允许数字偏移）；投影还原 `format: date-time` |
 * | `type: integer, format: int64` | `z.number().int()` | `z.int64()` 产出 bigint，`z.toJSONSchema` 直接抛错（BigInt cannot be represented in JSON Schema）；`number().int()` 投影 `type: integer` |
 * | `nullable: true` | `.nullable()` | openapi-3.0 target 输出 OpenAPI 写法 `nullable: true` |
 * | 非 `required` 字段 | `.optional()` | 投影后不进 `required` 数组 |
 * | `enum` | `z.enum([...])` | 投影还原逐值 enum |
 * | `minLength`/`maxLength`/`minimum`/`maximum` | `.min()`/`.max()` | 数值逐字对齐 |
 *
 * 相对 import 必须带 `.js` 后缀（`verbatimModuleSyntax` 原样输出 specifier，缺后缀
 * Node ESM 运行时 `ERR_MODULE_NOT_FOUND`）；`exactOptionalPropertyTypes` 与
 * `noUncheckedIndexedAccess` 由 base tsconfig 全开。
 *
 * 「请求 9 + 响应 13」的拆分口径说明（交接件缺陷 2）：22 = 仅 requestBody $ref 引用 8 +
 * paths.responses 引用 12 + Error 树内嵌引用 2（ValidationErrorDetail/Item）。原台账
 * 「请求 9 + 响应 13」把 SsoConfig 计入请求侧（它同时是 PUT /sso/config 的 requestBody），
 * 按引用方向机械复现的是 8/12/2。`check-schema-names.mjs` 只断言 22 名集合双向相等，
 * 不写死拆分数。
 */
