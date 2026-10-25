/**
 * 配置键表（P3-012-01 骨架，D1-11 ① 的可机读形态）。
 *
 * 本表是**唯一登记点**：装载器按它决定「读哪些环境变量、缺失时算不算致命、默认值是
 * 什么」，`ServerConfig` 的字段名由它派生。任何地方再写一个字面量环境变量名（`'PORT'`）
 * 都是重复手写——键名漂移正是「改了 A 忘了 B」的典型来源。
 *
 * ## 当前只有两个键，且都是 optional（诚实说明原因）
 *
 * 出处 = `apps/server/src/main.ts` 头注「端口、日志级别、国密开关的配置键三分类」中
 * 已实体化的两个（国密开关的取值语义与三级断言绑定，属 P3-016 启动断言链，本表不收）。
 * 必填键（库连接 / License 公钥 / 离线源等）与派生键的清单在 D1-11 卡内，而卡被
 * Security Center 拦读——**本包不猜**，随 P3-012-02 按卡内清单逐键补入。
 *
 * `PORT` 的默认值 3000 与 `main.ts` 现状一致（`process.env['PORT'] ?? 3000`），
 * 但**「容器形态的默认值是否也是 3000」属 D1-11 ③**，P3-012-03 定稿；此处先按裸机
 * 兜底值登记，并在该键的说明里标注待定，避免把临时值写成既成事实。
 *
 * `satisfies readonly ConfigKeySpec[]` 是这一层的核心：键表本身是字面量（`as const`
 * 保留字面量类型供派生 `ConfigKeyName`），同时逐条接受三分类的互斥约束检查——
 * 给 optional 漏写默认值、给 required 误加默认值，都在这里编译失败。
 */
import type { ConfigKeySpec } from './config.types.js';

/** 配置键表（唯一登记点）。 */
export const CONFIG_KEYS = [
  {
    key: 'port',
    class: 'optional',
    env: 'PORT',
    defaultValue: '3000',
    description: 'HTTP 监听端口；默认值 3000 取自裸机形态兜底，容器形态默认值待 D1-11 ③ 定稿',
  },
  {
    key: 'logLevel',
    class: 'optional',
    env: 'LOG_LEVEL',
    defaultValue: 'info',
    description: '日志级别 debug|info|warn|error；缺失即降级为 info 并打降级日志',
  },
] as const satisfies readonly ConfigKeySpec[];

/** 已登记键名的联合类型（下游引用键名时用它，不写字符串字面量）。 */
export type ConfigKeyName = (typeof CONFIG_KEYS)[number]['key'];
