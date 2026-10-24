/**
 * @wo/web 入口骨架（P3-010-03 主路径 1/2）。
 *
 * 本包此刻只承担一件事：证明 `@wo/shared` 能在 **ESM 侧**被消费。
 * Vite 装配、路由、页面、design-tokens 引入链由 P3-030 接管，
 * 故这里不 import React、不碰 DOM——骨架包不产生渲染副作用。
 *
 * `types: []` 是本包对 web 段的一处显式覆盖：web 段内置 `types: ["vite/client"]`，
 * 而 vite 要到 P3-030 才进依赖树，此处保留会让 tsc 直接 TS2688（找不到类型定义文件）。
 * 覆盖是「等 vite 到位再恢复」，不是删掉 web 段的约束——见 ANCHORS §2 的 P3-010-03 行。
 */
import { SHARED_PACKAGE_NAME, fnv1a32 } from '@wo/shared';

/** 与 `apps/server` 同口径的启动指纹（CJS/ESM 双端同值是工作项收口断言）。 */
export const WEB_BOOT_FINGERPRINT: number = fnv1a32(SHARED_PACKAGE_NAME);

/** 骨架期唯一的对外形状。P3-030 接管为应用外壳的身份标识。 */
export interface BootIdentity {
  readonly packageName: string;
  readonly fingerprint: number;
}

export const WEB_BOOT_IDENTITY: BootIdentity = {
  packageName: SHARED_PACKAGE_NAME,
  fingerprint: WEB_BOOT_FINGERPRINT,
};
