/**
 * 配置类型面（P3-012-01 骨架，D1-11 ① 三分类的类型化）。
 *
 * ## 为什么要 discriminated union 而不是「一个接口 + 可选字段」
 *
 * D1-11 ① 的三分类不是标签，是**互斥约束**：
 * - 必填类的语义是「缺失即启动失败」——所以它**不能有默认值**，有默认值就不是必填；
 * - 可选类的语义是「缺失即显式降级」——它**必须有默认值**，否则降级降到哪里；
 * - 派生类的语义是「不读环境变量、由其他键推导」——它**不能声明 env**。
 *
 * 写成 `{ class, defaultValue?, env? }` 这种宽接口，三条约束全靠注释和 review 守；
 * 写成联合类型则**编译期就守住了**：给必填键写 `defaultValue` 直接 tsc 报错。
 * 这一层正是本包（接口与骨架）该交付的东西——约束是形状的一部分。
 *
 * ## 键清单的边界（-01 留空、-02 补齐必填三键）
 *
 * 必填类与派生类的**具体键**由 D1-11 卡裁决，而该卡在 Security Center 拦读名单内。
 * -01 只落机制与既有事实键（`PORT` / `LOG_LEVEL`）；-02 从**卡外可机读的旁证**补齐
 * 必填三键（`.workbuddy/memory/2026-10-22.md` 的 D1-11 交付记录逐字写明「必填 3：
 * WO_JWT_SECRET/WO_DB_URL/WO_LICENSE_PUBLIC_KEY」，且 openapi readiness 段独立印证
 * 「License 公钥已装载（WO_LICENSE_PUBLIC_KEY 已解析）」）——**键名有据、非编造**。
 * 17 个可选键与 2 个派生键（`heapHardLimit` / `isReadonlyMode`）的确切键名与默认值
 * 只在卡内，本文件仍不猜，随卡可读或 -07 收口时补入。
 */

/** 三分类（D1-11 ①：必填 / 可选有默认 / 派生）。 */
export type ConfigKeyClass = 'required' | 'optional' | 'derived';

/**
 * 取值的形态（装载器据它做类型转换）。
 *
 * 这不是「业务校验」：`integer` 只保证是十进制非负整数，`logLevel` 只保证落在四个
 * 级别名内。**具体键的取值范围与形态约束（端口 1~65535、DB URL 可解析、License
 * 公钥 130 位 hex 且 `04` 开头）归 P3-012-04 的逐键语义校验**——那里会按 kind 挂
 * 校验器，本包只交付「值能类型正确地进到配置对象里」。
 *
 * 缺省 = `string`（不为每个字符串键重复写一遍）。
 */
export type ConfigValueKind = 'string' | 'integer' | 'logLevel';

/** 三类共有的字段。 */
interface ConfigKeyBase {
  /** 代码内引用名（camelCase），也是 `ServerConfig` 的字段名。 */
  readonly key: string;
  /** 人读说明，出现在启动日志与错误文案里。 */
  readonly description: string;
  /** 敏感值（口令/私钥）：日志与错误文案必须脱敏，不得回显取值。 */
  readonly secret?: boolean;
  /** 取值形态（见 `ConfigValueKind`）；缺省 `string`。 */
  readonly kind?: ConfigValueKind;
}

/** 必填：缺失 = 启动失败并指名该键；**不得**有默认值。 */
export interface RequiredConfigKey extends ConfigKeyBase {
  readonly class: 'required';
  /** 环境变量名（容器与裸机两形态同名，差异只在值的来源）。 */
  readonly env: string;
}

/** 可选有默认：缺失 = 显式降级日志 + 取默认值；**必须**有默认值。 */
export interface OptionalConfigKey extends ConfigKeyBase {
  readonly class: 'optional';
  readonly env: string;
  /** 默认值（字符串形态，类型转换归装载器）。 */
  readonly defaultValue: string;
}

/** 派生：不读环境变量，由其他键推导；**不得**声明 env。 */
export interface DerivedConfigKey extends ConfigKeyBase {
  readonly class: 'derived';
  /** 推导来源的键名（必须是同一张键表里的键，运行期由装载器校验，见 P3-012-03）。 */
  readonly derivedFrom: readonly string[];
}

/** 键表元素（三分类的判别联合）。 */
export type ConfigKeySpec = RequiredConfigKey | OptionalConfigKey | DerivedConfigKey;

/**
 * 「有取值」的键（必填 + 可选）——即需要从环境变量读一个值的那些键。
 *
 * 派生键没有 `env`，所以装载器里凡是「读值 / 转换 / 脱敏」的函数都用这个类型而不是
 * `ConfigKeySpec`：拿 `spec.env` 前先由判别联合收窄，而不是运行期 `as`。
 */
export type ValuedConfigKey = RequiredConfigKey | OptionalConfigKey;

/** 日志级别（`LOG_LEVEL` 的取值域；与 Nest Logger 的级别名对齐）。 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * 装载后的强类型配置（`loadConfig` 的产物）。
 *
 * 键集合**只增不改名**：下游包按字段名引用，改名即跨包破坏性变更，须走 ANCHORS §1
 * 签名表同步 + 全库 grep 传导（同 P3-010 的「签名」纪律）。
 */
export interface ServerConfig {
  /** HTTP 监听端口（`PORT`）。 */
  readonly port: number;
  /** 日志级别（`LOG_LEVEL`）。 */
  readonly logLevel: LogLevel;
  /** JWT 签名口令（`WO_JWT_SECRET`，**敏感**：日志与错误文案一律脱敏）。 */
  readonly jwtSecret: string;
  readonly dbUrl: string;
  /** 数据库连接串（`WO_DB_URL`，TypeORM 原生吃 URL，不拆零散主机/端口键）。 */
  /** License 验签公钥（`WO_LICENSE_PUBLIC_KEY`，裸点 hex 130 字符前缀 `04`）。 */
  readonly licensePublicKey: string;
}
