/**
 * 契约 schema 出口（P3-011-03）。
 *
 * 22 个导出名与 `docs/api/openapi.yaml` `components.schemas` 双向逐字相等
 * （`scripts/check-schema-names.mjs` 机检：改名/多一/少一即 fail）。
 *
 * 唯一别名：openapi 的 `Error` schema 是 JS 保留字，常量名用 `ErrorSchema`，
 * 在此处重导出为逐字名 `Error`（`export { X as Error }` 是合法语法，消费方
 * `import { Error } from '@wo/shared'` 也合法——Error 只是全局标识符不是保留字）。
 * 机检走本出口的导出名，文件内常量名不参与对齐。
 *
 * 分域文件只承载分组，不参与命名对齐；非契约 schema 进 `./internal/`（目录即分类）。
 */
export { LoginRequest, LoginResponse, RefreshRequest, RefreshResponse } from './auth.js';
export { UserResponse, UserAdminResponse, UserCreateRequest, UserUpdateRequest } from './users.js';
export { SsoCallbackRequest, SsoConfig } from './sso.js';
export {
  FileCreateRequest,
  FileRenameRequest,
  FileResponse,
  FileListResponse,
  SnapshotResponse,
  ImportTaskStatus,
} from './files.js';
export { ShareCreateRequest, ShareResponse } from './share.js';
export { AuditLogListResponse } from './audit.js';
export { ErrorSchema as Error, ValidationErrorDetail, ValidationErrorItem } from './error.js';
