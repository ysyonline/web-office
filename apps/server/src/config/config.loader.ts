/**
 * 配置装载器（P3-012-01 骨架，D1-11 ① 的执行面签名）。
 *
 * ## 本包只落签名与失败语义的类型，不落装载逻辑
 *
 * 装载逻辑（读 env → 按三分类判缺失/取默认/推导 → 类型转换 → 脱敏降级日志）是
 * 主路径，归 P3-012-02 / -03（两包各贯通一条 happy path）。此处 `loadConfig` 抛
 * `NotImplementedError`：**不接线**（`main.ts` 仍走自己的 PORT 兜底），因此抛不出去。
 *
 * ## 失败语义（类型先行）
 *
 * D1-11 ① 要求「必填缺失 = 启动失败并**指名键**」，D1-11 ② 要求启动断言失败时
 * **退出码非 0**。二者都是「装载器的错误必须携带键名」，故 `ConfigLoadError` 把
 * `key` 与 `reason` 提升为**结构化字段**而不是只拼进 message——下游（-02 的启动
 * 断言链、-05 的单测）要按字段断言，按 message 正则断言等于把文案当契约。
 *
 * `reason` 三值对应三类失败面：缺失（missing）/ 取值非法（invalid，如 PORT 非数字）/
 * 派生源缺失（unresolved，派生类引用了不存在的键）。不含「验签失败」一类——
 * 三级国密断言属 P3-016（D1-11 ②），不在装载器职责内。
 */
import { NotImplementedError } from '../common/not-implemented.js';
import type { ConfigKeySpec, ServerConfig } from './config.types.js';

/** 装载失败的原因（结构化字段，禁止只用 message 表达）。 */
export type ConfigLoadFailure = 'missing' | 'invalid' | 'unresolved';

/** 配置装载失败：`key` 必须是键表里的键名（或环境变量名，见 `env` 字段）。 */
export class ConfigLoadError extends Error {
  /** 出问题的配置键（键表 `key` 字段，如 `port`）。 */
  readonly key: string;
  /** 出问题的环境变量名（派生类失败时为其推导来源键的环境变量名）。 */
  readonly env: string;
  /** 失败原因（结构化，供下游按原因分支）。 */
  readonly reason: ConfigLoadFailure;

  constructor(key: string, env: string, reason: ConfigLoadFailure, detail: string) {
    super(`配置装载失败：${env}（${key}）${detail}`);
    this.name = 'ConfigLoadError';
    this.key = key;
    this.env = env;
    this.reason = reason;
  }
}

/** 装载产物：强类型配置 + 降级记录（可选键缺失时逐条留痕，便于启动日志回显）。 */
export interface LoadedConfig {
  /** 装载并转换后的配置。 */
  readonly config: ServerConfig;
  /** 降级记录（每条形如 `PORT 未设置，取默认值 3000`），按键表顺序。 */
  readonly degradations: readonly string[];
}

/**
 * 按键表装载配置。
 *
 * @param _env 进程环境变量（显式入参而非直接读 `process.env`——单测可注入，不必改全局）
 * @param _keys 键表；默认取 `CONFIG_KEYS`（唯一登记点）
 * @throws `ConfigLoadError` 必填缺失 / 取值非法 / 派生源缺失
 * @throws `NotImplementedError` 本包（P3-012-01）为骨架期占位，未实现
 */
export function loadConfig(
  _env: NodeJS.ProcessEnv,
  _keys?: readonly ConfigKeySpec[],
): LoadedConfig {
  throw new NotImplementedError('apps/server/src/config/config.loader.ts#loadConfig');
}
