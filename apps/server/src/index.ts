/**
 * @wo/server 入口骨架（P3-010-03 主路径 1/2）。
 *
 * 本包此刻只承担一件事：证明 `@wo/shared` 能在 **CJS 侧**被消费。
 * Nest 引导、模块划分、国密启动断言三级链由 P3-011 接管，故这里
 * 不 import `@nestjs/*`、不读配置、不连库——骨架包不带运行期副作用。
 *
 * 类型解析口径（见 ANCHORS §2 的 P3-010-03 行）：tsconfig 用 `paths` 指向
 * `packages/shared/src`，不用包的 `exports.types`——后者指向 `dist/esm/index.d.ts`，
 * 而 `dist/` 是构建产物且未入库，干净 clone 上 `pnpm typecheck` 会因缺 `.d.ts` 报 TS2307。
 * 真实产物面由 P3-010-01 的 dist 结构断言 + 本包的双端加载断言兜住。
 */
import { SHARED_PACKAGE_NAME, fnv1a32 } from '@wo/shared';

/**
 * 启动指纹：前后端各算一次，同值即证明两端加载的是同一份 shared 实现。
 * 用 `fnv1a32` 而不取随机值，是因为它本身就是 shared 的导出物——自证不引外部量。
 */
export const SERVER_BOOT_FINGERPRINT: number = fnv1a32(SHARED_PACKAGE_NAME);

/** 骨架期唯一的对外形状。P3-011 接管为 `GET /api/v1/health` 的回显体。 */
export interface BootIdentity {
  readonly packageName: string;
  readonly fingerprint: number;
}

export const SERVER_BOOT_IDENTITY: BootIdentity = {
  packageName: SHARED_PACKAGE_NAME,
  fingerprint: SERVER_BOOT_FINGERPRINT,
};
