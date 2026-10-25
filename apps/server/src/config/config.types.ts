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
 * ## 键清单的边界（本包刻意不预置）
 *
 * 必填类与派生类的**具体键**由 D1-11 卡裁决（库连接 / License 公钥 / 离线源 / 派生
 * 的 baseUrl 一类），而该卡在 Security Center 拦读名单内。猜一份键表等于给下游埋一份
 * 看起来权威的假契约——故本包只落**机制与既有事实键**（`PORT` / `LOG_LEVEL` 两键，
 * 出处 = `apps/server/src/main.ts` 头注「端口、日志级别」），必填/派生键随
 * P3-012-02 补入（届时按卡内清单逐键登记，不在此文件外另立字面量）。
 */

/** 三分类（D1-11 ①：必填 / 可选有默认 / 派生）。 */
export type ConfigKeyClass = 'required' | 'optional' | 'derived';

/** 三类共有的字段。 */
interface ConfigKeyBase {
  /** 代码内引用名（camelCase），也是 `ServerConfig` 的字段名。 */
  readonly key: string;
  /** 人读说明，出现在启动日志与错误文案里。 */
  readonly description: string;
  /** 敏感值（口令/私钥）：日志与错误文案必须脱敏，不得回显取值。 */
  readonly secret?: boolean;
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
}
