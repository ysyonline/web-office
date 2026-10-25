/**
 * 配置装载器（P3-012-02 主路径实现，D1-11 ① 的执行面）。
 *
 * ## 三分类各走一条分支（这就是「主路径」的全部内容）
 *
 * - **必填**：环境变量缺失（或为空串）即抛 `ConfigLoadError(reason='missing')`——
 *   启动失败并**指名键**，这是工作项收口断言的第一条。
 * - **可选**：缺失即取默认值，并往 `degradations` 里留一条可回显的记录（**降级必须
 *   可见**：静默取默认值是「配置了但不生效」类事故的常见根因）。
 * - **派生**：不读环境变量，只校验 `derivedFrom` 的来源键都在表内且已装载；来源缺失
 *   抛 `unresolved`。派生**值**由装配侧按需计算，不进 `ServerConfig`（卡内口径：
 *   `heapHardLimit` / `isReadonlyMode` 不暴露为配置键）。
 *
 * ## 空串 = 缺失（显式裁决）
 *
 * docker compose 的 `- FOO=`、K8s 的 env 值为空、`export FOO=""` 都会产出「键存在但
 * 值为空」——把它当「已配置」比当「未配置」危险得多（必填键会带着空口令启动成功）。
 * 故统一 `trim()` 后空串等同未设置。
 *
 * ## 失败语义：结构化字段优先
 *
 * `ConfigLoadError` 携带 `key` / `env` / `reason` 三个字段，下游（启动日志、-05 单测）
 * 按字段断言，不按 message 正则断言——文案会改，字段是契约。`secret` 键在任何文案里
 * 都只出现键名与变量名，不回显取值（`maskValue`）。
 *
 * ## 边界（本包不做，避免与 -04 的锚点重叠）
 *
 * 只做**形态**转换：`integer` 保证是十进制非负整数、`logLevel` 保证落在四个级别名内。
 * 逐键的**语义**约束（端口 1~65535、DB URL 可解析、License 公钥 130 位 hex 且 `04`
 * 开头、JWT 口令最短长度）归 -04 的校验器层——本包不预判卡内阈值。
 */
import type {
  ConfigKeySpec,
  ConfigValueKind,
  LogLevel,
  ServerConfig,
  ValuedConfigKey,
} from './config.types.js';

import { CONFIG_KEYS } from './config-keys.js';

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

/** `LOG_LEVEL` 的取值域（由宽到严；-04 的校验器可直接复用这份清单，别再就地写一遍）。 */
const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/** 十进制非负整数（不接 `+1` / `1e3` / ` 12 `（已 trim）/ 小数 / 负数）。 */
const NON_NEGATIVE_INTEGER = /^\d+$/;

/** 敏感值一律脱敏：文案里只允许出现键名与变量名。 */
function maskValue(spec: ValuedConfigKey, raw: string): string {
  return spec.secret === true ? '***' : raw;
}

/** 读环境变量：缺失或 trim 后空串一律视为未设置（见文件头「空串 = 缺失」）。 */
function readEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = env[name];
  if (raw === undefined) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** 按 `kind` 做形态转换；失败即 `invalid`（语义约束不在此，见文件头「边界」）。 */
function convertValue(spec: ValuedConfigKey, raw: string): unknown {
  const kind: ConfigValueKind = spec.kind ?? 'string';
  switch (kind) {
    case 'string':
      return raw;
    case 'integer': {
      if (!NON_NEGATIVE_INTEGER.test(raw)) {
        throw new ConfigLoadError(
          spec.key,
          spec.env,
          'invalid',
          `取值 ${maskValue(spec, raw)} 不是十进制非负整数`,
        );
      }
      return Number(raw);
    }
    case 'logLevel': {
      if (!LOG_LEVELS.includes(raw as LogLevel)) {
        throw new ConfigLoadError(
          spec.key,
          spec.env,
          'invalid',
          `取值 ${maskValue(spec, raw)} 不在 ${LOG_LEVELS.join('|')} 内`,
        );
      }
      return raw as LogLevel;
    }
    default: {
      // 穷尽检查：新增 kind 而忘了加分支，tsc 在此报错（不靠注释守）。
      const unknownKind: never = kind;
      throw new TypeError(`未支持的配置取值形态：${String(unknownKind)}`);
    }
  }
}

/**
 * 按键表装载配置。
 *
 * @param env 进程环境变量（显式入参而非直接读 `process.env`——单测可注入，不必改全局）
 * @param keys 键表；默认取 `CONFIG_KEYS`（唯一登记点）。传自定义表仅供机制单测，
 *   **必须自带 `ServerConfig` 的全部字段键**，否则装配阶段按 `missing` 报错
 * @throws `ConfigLoadError` 必填缺失 / 取值非法 / 派生源缺失
 */
export function loadConfig(
  env: NodeJS.ProcessEnv,
  keys: readonly ConfigKeySpec[] = CONFIG_KEYS,
): LoadedConfig {
  const specs = new Map<string, ConfigKeySpec>(keys.map((spec) => [spec.key, spec]));
  const values = new Map<string, unknown>();
  const degradations: string[] = [];

  for (const spec of keys) {
    if (spec.class === 'derived') {
      for (const source of spec.derivedFrom) {
        if (!specs.has(source) || !values.has(source)) {
          const sourceSpec = specs.get(source);
          const sourceEnv =
            sourceSpec !== undefined && sourceSpec.class !== 'derived' ? sourceSpec.env : source;
          throw new ConfigLoadError(
            spec.key,
            sourceEnv,
            'unresolved',
            `的派生来源 ${source} 未装载`,
          );
        }
      }
      continue;
    }

    const raw = readEnv(env, spec.env);
    if (raw === undefined) {
      if (spec.class === 'required') {
        throw new ConfigLoadError(spec.key, spec.env, 'missing', '未设置（必填键，拒绝启动）');
      }
      values.set(spec.key, convertValue(spec, spec.defaultValue));
      degradations.push(`${spec.env} 未设置，取默认值 ${maskValue(spec, spec.defaultValue)}`);
      continue;
    }
    values.set(spec.key, convertValue(spec, raw));
  }

  return { config: assemble(specs, values), degradations };
}

/** 取已装载的取值；键表里没有该键（自定义表漏项）时按 `missing` 报错，不静默 undefined。 */
function take<T>(
  specs: ReadonlyMap<string, ConfigKeySpec>,
  values: ReadonlyMap<string, unknown>,
  key: string,
): T {
  if (!values.has(key)) {
    const spec = specs.get(key);
    const env = spec !== undefined && spec.class !== 'derived' ? spec.env : key;
    throw new ConfigLoadError(key, env, 'missing', '未在键表登记，装载产物无法装配');
  }
  return values.get(key) as T;
}

/**
 * 装配强类型配置。
 *
 * 这一层是「动态键表 → 静态接口」的**唯一桥**：每个字段显式取一次，故 `ServerConfig`
 * 少一个字段、键表多一个键，都会在编译期被 `config-keys.ts` 的键集断言抓住（而不是
 * 运行期少一个值）。不要退化成把 `values` 直接 `as ServerConfig`——那等于放弃全部类型。
 */
function assemble(
  specs: ReadonlyMap<string, ConfigKeySpec>,
  values: ReadonlyMap<string, unknown>,
): ServerConfig {
  return {
    port: take<number>(specs, values, 'port'),
    logLevel: take<LogLevel>(specs, values, 'logLevel'),
    jwtSecret: take<string>(specs, values, 'jwtSecret'),
    dbUrl: take<string>(specs, values, 'dbUrl'),
    licensePublicKey: take<string>(specs, values, 'licensePublicKey'),
  };
}
