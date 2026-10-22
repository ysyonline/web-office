/**
 * @wo/shared 出口（骨架）。
 *
 * 定位（P3-001 §5.3）：DTO 类型、zod schema、错误码常量、纯函数。
 * 禁止：React / Nest / univer / yjs 相关 import、原生依赖、side-effect。
 *
 * 当前只放 fnv1a32——它是唯一已经定稿、可脱离契约先行落地的纯函数；
 *   - 错误码常量等 D1-05 卡（错误码与降级四层矩阵）定稿后落 src/errors/
 *   - zod schema 按 openapi components.schemas 命名逐字落 src/schemas/（D1-13 卡 ①）
 */
export { fnv1a32 } from './utils/fnv1a32.js';

// 国密 SM2 签验口径（四口径单一定义点，D1-11 ① / license/design.md §3.0）：
// 签发侧 scripts/issue-license.mjs 与验签侧 evaluateLicense 共用，禁止别处再写字面量。
export {
  SM2_DEFAULT_USER_ID,
  SM2_SIGN_DER,
  SM2_SIGN_HASH,
  canonicalJsonBytes,
  canonicalJsonStringify,
  sm2SignOptions,
  sm2VerifyOptions,
} from './license/sm2-constants.js';

/** 包标识，供启动日志与健康检查回显（证明消费方加载的是构建产物而非源码）。 */
export const SHARED_PACKAGE_NAME = '@wo/shared' as const;
