# ADR-005: 采用 pnpm 11.28.6，否决 Rust 重写的 pnpm 12 与 npm / Yarn

## Status

Accepted（2026-10-22，P3-001 工程化基线评审；架构师终审正文已到，本版为终审后修订版）

**修订说明**：v1 曾由 team-lead 代行裁定落盘（架构师正文未送达）。架构师终审正文到达后，本 v2 作两处实质修订：① 版本取 **11.28.6**（`latest-11` 稳定通道），不再取 v1 的 11.28.7（`next-11` 通道）；② 纠正 team-lead 误按 pnpm 10 习惯写的配置模型——**pnpm 11 起非「注册源/认证」设置不再从 `.npmrc` 读取**，`onlyBuiltDependencies` 亦已被 `allowBuilds` 取代。撤销代行裁定注记，改由架构师主裁。

## Background

本项目为信创私有化离线交付（verdaccio 私有源 + Docker buildx 多架构 amd64/arm64），交付环境无外网，运行时网络白名单为空（Spec AC-12）。在这种环境下，**包管理器自身不得在安装过程中产生网络请求**。

registry 实测（2026-10-22）：

| 版本 | dist-tag | bin 实现 | optionalDependencies | engines |
|---|---|---|---|---|
| 12.14.0 | `latest` | Rust 原生 shim（找不到二进制即 *downloads one*） | 14 个 `@pnpm/exe.*` 平台原生包 | — |
| **11.28.6** | `latest-11` | Node 脚本 `bin/pnpm.mjs` | 0 | `>=22.13` |
| 11.28.7 | `next-11` | Node 脚本 `bin/pnpm.mjs` | 0 | `>=22.13` |

11.28.6 与 11.28.7 二者 bin 同为 Node 脚本、optionalDependencies 同为 0、engines 相同，**无原生差异**；取 11.28.6 的理由只是交付锁稳定通道（`latest-11`），不取 `next-11`。

同时 Phase 2 文档只锁定了核心框架与引擎，**包管理器、monorepo 结构、代码规范工具全部零命中**（OPEN-DECISIONS「工程化基线 7 项缺口」），而这些是 B1 批次 25 个包的前置。

## Decision

锁定 **pnpm 11.28.6**（精确版本，无 `^`），配套四件：

1. root `package.json` 写 `"packageManager": "pnpm@11.28.6"` + `"engines": { "node": ">=22.13 <23" }`
2. **`pnpm-workspace.yaml` 承载全部非注册源设置**（pnpm 11 配置模型变更，† 见「配置模型」小节）：
   - `packages: [apps/*, packages/*]`
   - `pmOnFail: error`（默认值为 download，**离线环境等于无声联网**，最易漏的一条）
   - `nodeLinker: isolated`、`saveExact: true`
   - `autoInstallPeers: false`（**必须关掉**：否则 `@nestjs/swagger` 的 peer 会把 `class-validator`/`class-transformer` 静默装回依赖树，直接击穿 ADR「zod 单一 schema 源」）
   - `strictDepBuilds: true`
   - `allowBuilds: { esbuild: true, "@scarf/scarf": false }`（取代 pnpm 10 的 `onlyBuiltDependencies`。esbuild 带 postinstall，pnpm 10+ 默认不跑未批准包的脚本，漏配导致二进制未落地；`@scarf/scarf` 显式关，屏蔽 `swagger-ui-dist` 传递依赖 Scarf 遥测的 postinstall 外联——一个机制解决两处）
   - `minimumReleaseAge: 1440`（供应链基线：镜像时只取发布满 24 小时的版本，规避当日投毒版）
   - `engineStrict: true`
   - `supportedArchitectures`（linux/win32/darwin × x64/arm64 × glibc），使单一 lockfile 含两套架构的原生包
   - `catalog` 先只管 `@univerjs/*`（直击 Spec §11 已列坑「版本不一致导致运行时错乱」）
3. `.npmrc` **只留注册源与认证**（交付期由 `PNPM_CONFIG_REGISTRY` 注入 registry，避免内网地址被人误用到联网环境，**不提交 registry 行**）。其余设置在 pnpm 11 下写进 `.npmrc` 不生效。
4. CI 必须显式传 `--frozen-lockfile`，不依赖 `CI=true` 的隐式推断；全仓库只存在一份 `pnpm-lock.yaml`

† **配置模型变更（pnpm 11）**：非「注册源/认证」类设置一律迁至 `pnpm-workspace.yaml`（camelCase）；`.npmrc` 保留项仅剩 registry / token 一类；环境变量前缀统一 `pnpm_config_*`（如 `pnpm_config_pmOnFail=error`）。这是 pnpm 11 的破坏性变更，按 pnpm 10 习惯写配置会**静默失效**——不报错、不警告，只是设置不生效，属典型「沉默逻辑错误」。

否决：pnpm 12.14.0（离线下载行为无 Node 侧兜底）、npm 12.2.0（无 per-package 构建脚本批准、无 catalog、monorepo 治理弱，装不出「禁第二图标来源」这类可机检的依赖面约束）、yarn classic（停维）与 Yarn Berry（PnP 改变 node_modules 物理形态，与 Vite/Tailwind content 扫描、Playwright、verdaccio 的组合无验证预算）。

## Consequences

**正面**
- 包管理器本身零原生二进制、架构无关，离线 `install --offline` 链路最短
- `pmOnFail: error` 把「版本不符」变成明确失败而非静默联网
- `saveExact` 把「版本锚定」从文档纪律升级为包管理器行为
- `allowBuilds` 白名单 + `strictDepBuilds` 把「哪些包允许跑构建脚本」变成可机检的显式清单，顺带屏蔽 Scarf 遥测外联
- `autoInstallPeers: false` 使依赖树只含显式声明项，是 zod 单一 schema 源在依赖面的强制手段
- catalog 把 `@univerjs/*` 同版约束从「人工核对 lockfile」升级为「包管理器单一口径」

**负面**
- 停留在 11 线，无法使用 pnpm 12 的性能改进；补丁支持窗口随 12 成为默认会逐步收窄
- Docker 各阶段必须各自 install，**禁止跨阶段 `COPY node_modules`**；Windows 开发机需开启开发者模式（符号链接）
- `autoInstallPeers: false` 后每个 peer 缺失都会显式报错，前期会有一次性的依赖补全工作量

**约束与回退**
- 若未来出现「跨阶段 COPY node_modules 或 zip 制品往返」需求，切换 `nodeLinker=hoisted` 并登记 OPEN
- 迁移 pnpm 12 的前置：四象限实跑 `pnpm --version` + `pnpm install --offline` 通过，且 `@pnpm/exe.*` 14 个平台包已全部入 verdaccio 镜像；否则维持 11 线
- esbuild 二进制在麒麟 V10 / 统信 UOS × x86_64 / aarch64 的 glibc 下限未实测，需在 P3-019 镜像构建阶段四象限各跑一次并回填

## Related ADRs

ADR-002（TypeORM 信创数据层，同为「离线优先 + 版本锚定」口径）、ADR-006（Tailwind 3.4.19）、ADR-007（自研原子组件）；OPEN-DECISIONS「esbuild postinstall 离线行为」「pnpm 12 迁移前提」。
