/**
 * @wo/shared 出口（骨架）。
 *
 * 定位（P3-001 §5.3）：DTO 类型、zod schema、错误码常量、纯函数。
 * 禁止：React / Nest / univer / yjs 相关 import、原生依赖、side-effect。
 *
 * 当前承载：fnv1a32（协同配色/光标）、国密 SM2 签验口径、SHARED_PACKAGE_NAME、
 * 22 个契约 schema（src/schemas/，D1-13 卡 ①）、业务错误码表与错误体类型
 * （src/errors/，P3-012-01 落，D1-05 卡 ① 码段的代码侧转录件）。
 */
export { fnv1a32 } from './utils/fnv1a32.js';

// 业务错误码表（P3-012-01）：30 条码逐字对齐 openapi `x-error-code-registry`，
// 机检见 scripts/check-error-codes.mjs（verify 第十四段）。
// 四层矩阵（HTTP / WS close / UI 档位）在本文件只落**形状**，取值归 P3-012-04。
export {
  ERROR_BODY_MATCHES_SCHEMA,
  ERROR_CODE_MESSAGES,
  errorCodeSegment,
  errorMessage,
  isErrorCode,
} from './errors/codes.js';
export type {
  ErrorBody,
  ErrorBodyMatchesSchema,
  ErrorCode,
  ErrorCodeSegment,
  ErrorLayerRow,
  ErrorUiTier,
} from './errors/codes.js';

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

// 22 个契约 schema（P3-011-03）：命名与 openapi components.schemas 双向逐字相等，
// 机检见 scripts/check-schema-names.mjs；口径见 src/schemas/common.ts。
export {
  AuditLogListResponse,
  Error,
  FileCreateRequest,
  FileListResponse,
  FileRenameRequest,
  FileResponse,
  ImportTaskStatus,
  LoginRequest,
  LoginResponse,
  RefreshRequest,
  RefreshResponse,
  ShareCreateRequest,
  ShareResponse,
  SnapshotResponse,
  SsoCallbackRequest,
  SsoConfig,
  UserAdminResponse,
  UserCreateRequest,
  UserResponse,
  UserUpdateRequest,
  ValidationErrorDetail,
  ValidationErrorItem,
} from './schemas/index.js';
