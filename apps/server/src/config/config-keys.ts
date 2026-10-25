/**
 * 配置键表（唯一登记点，D1-11 ① 的机读形态）。
 *
 * 本表是**唯一登记点**：装载器按它决定「读哪些环境变量、缺失时算不算致命、默认值是
 * 什么、值转成什么类型」，`ServerConfig` 的字段名由它派生。任何地方再写一个字面量
 * 环境变量名（`'PORT'`）都是重复手写——键名漂移正是「改了 A 忘了 B」的典型来源。
 *
 * ## 键的来源（逐条可追溯，不猜）
 *
 * | 键 | 出处 |
 * |---|---|
 * | `WO_JWT_SECRET` / `WO_DB_URL` / `WO_LICENSE_PUBLIC_KEY` | D1-11 ① 必填三键——卡本身拦读，但 `.workbuddy/memory/2026-10-22.md` 的 D1-11 交付记录逐字写明「必填 3：WO_JWT_SECRET/WO_DB_URL/WO_LICENSE_PUBLIC_KEY」；`WO_LICENSE_PUBLIC_KEY` 另有 `docs/license/design.md` §3 与 openapi readiness 段（「License 公钥已装载（WO_LICENSE_PUBLIC_KEY 已解析）」）双重印证 |
 * | `PORT` / `LOG_LEVEL` | `apps/server/src/main.ts` 原有事实键（P3-011-02 起就在用） |
 *
 * **仍未收的两类**：17 个可选键（TTL 15/7、锁定 5/15、快照 32MB、导入 10MB、doc 预算
 * 1792MB、LRU 80%、活跃 doc 100、攒批 1s/50、drain 30s、ticket 5s、revalidate 60s、
 * 宽限 7 天、PBKDF2 10 万轮）与 2 个派生键（`heapHardLimit` / `isReadonlyMode`）——
 * 只有卡内有确切**键名**（数值在交付记录里，名字不在），故不猜，随卡可读或 -07 补入。
 *
 * ## 「WO_ 前缀统一」的例外（已登记 OPEN）
 *
 * 卡内规则是 `WO_` 前缀统一，而 `PORT` / `LOG_LEVEL` 是 12-factor 与 docker compose
 * 的事实标准键名（历轮 health 实测命令 `PORT=3100` 即依赖它）。本包**不改名**——改名会
 * 击穿既有实测口径且属契约外变更；冲突已登记 OPEN-DECISIONS，归 -07 收口时与卡对齐。
 * 为此下面的编译期断言只约束**必填键**必须 `WO_` 前缀，不强求可选键。
 */
import type { ConfigKeySpec, ServerConfig } from './config.types.js';

/** 配置键表（唯一登记点）。 */
export const CONFIG_KEYS = [
  {
    key: 'jwtSecret',
    class: 'required',
    env: 'WO_JWT_SECRET',
    secret: true,
    description: 'JWT 签名口令；必填（缺失即启动失败），敏感值不落日志与错误文案',
  },
  {
    key: 'dbUrl',
    class: 'required',
    env: 'WO_DB_URL',
    description: '数据库连接串（TypeORM 原生吃 URL，单键不拆零散主机/端口键）；必填',
  },
  {
    key: 'licensePublicKey',
    class: 'required',
    env: 'WO_LICENSE_PUBLIC_KEY',
    description: 'License 验签公钥（裸点 hex 130 字符、前缀 04）；必填，缺失即 readiness 无法通过',
  },
  {
    key: 'port',
    class: 'optional',
    env: 'PORT',
    kind: 'integer',
    defaultValue: '3000',
    description: 'HTTP 监听端口；默认值 3000 取自裸机形态兜底，容器形态默认值待 D1-11 ③ 定稿',
  },
  {
    key: 'logLevel',
    class: 'optional',
    env: 'LOG_LEVEL',
    kind: 'logLevel',
    defaultValue: 'info',
    description: '日志级别 debug|info|warn|error；缺失即降级为 info 并打降级日志',
  },
] as const satisfies readonly ConfigKeySpec[];

/** 已登记键名的联合类型（下游引用键名时用它，不写字符串字面量）。 */
export type ConfigKeyName = (typeof CONFIG_KEYS)[number]['key'];

/** 派生键的键名（当前为空集——派生键不进 `ServerConfig`，见 `config.types.ts` 头注）。 */
type DerivedKeyName = Extract<(typeof CONFIG_KEYS)[number], { class: 'derived' }>['key'];

/** 键名双向包含（非分配式：泛型一律裹进元组，防联合类型逐支判定产生假绿）。 */
type KeysEqual<X extends PropertyKey, Y extends PropertyKey> = [X] extends [Y]
  ? [Y] extends [X]
    ? true
    : false
  : false;

/**
 * 键表与 `ServerConfig` 的字段集一致性断言（编译期）。
 *
 * 为什么需要：装载器最终要装配出一个 `ServerConfig`，键表加了键而接口没加字段（或反之）
 * 就必然分叉——分叉的表现是「配置读了但没人能用」或「字段永远 undefined」，两者都不会
 * 报错。用键集合相等把分叉变成 tsc 错误。派生键除外：按卡它们不暴露为配置字段。
 *
 * 判据只用键集不用「可赋值」——P3-012-01 已实测：单靠双向可赋值抓不到「多一个可选
 * 字段」，键集比对才抓得住（同一条坑，见 `packages/shared/src/errors/codes.ts`）。
 */
export type ServerConfigMatchesKeyTable =
  KeysEqual<Exclude<ConfigKeyName, DerivedKeyName>, keyof ServerConfig> extends true ? true : false;

/** 类型断言辅助（值层面恒为 true；键表与接口一旦漂移，tsc 在下面这行报 TS2322）。 */
export const SERVER_CONFIG_MATCHES_KEY_TABLE: ServerConfigMatchesKeyTable = true;

/**
 * 必填键的环境变量名必须 `WO_` 前缀（卡内「WO_ 前缀统一」的可机检部分）。
 *
 * 只约束必填键：可选键里的 `PORT` / `LOG_LEVEL` 是 12-factor 事实标准名，属已登记
 * OPEN 的例外（见文件头），不在此断言范围内。
 */
type RequiredEnvName = Extract<(typeof CONFIG_KEYS)[number], { class: 'required' }>['env'];
export type RequiredEnvNamesPrefixed = [RequiredEnvName] extends [`WO_${string}`] ? true : false;
export const REQUIRED_ENV_NAMES_PREFIXED: RequiredEnvNamesPrefixed = true;
