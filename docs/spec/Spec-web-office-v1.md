# Spec - web-office（信创私有化在线电子表格）v1.0.0

> 生成日期：2026-10-21
> 基于：PRD Phase 1（含信创增补）+ 架构技术选型（含信创增补）+ UIUX 设计方向
> 状态：**已确认**（用户 2026-10-21 确认三文档并补充信创约束后自动生成）

---

## 1. 产品定义

- **一句话描述**：信创全栈适配的私有化在线电子表格：数据不出内网、Excel 无损互通、万行不卡、协同留痕可审计。
- **目标用户**：政府机构、央国企（信息中心决策采购，财务/办公室日常使用）；次要为有信创改造需求的国企科技子公司。
- **核心问题**：政企内网无法使用 SaaS 协同表格，Excel 邮件来回传版本失控，现有信创目录内产品表格能力弱。

## 2. MVP 范围（锁定——不在此列表的功能一律不做）

| 优先级 | 功能 | 验收标准摘要 | RICE 评分 |
|--------|------|-------------|-----------|
| P0 | 账户体系（登录/登出/用户管理，PBKDF2-HMAC-SM3 口令哈希，RBAC: admin/member） | 合法凭证登录返回 JWT；口令仅存 PBKDF2-HMAC-SM3（≥10 万轮+盐） | 10.0 |
| P0 | 文件管理（创建/重命名/删除/列表/云端保存 Univer snapshot） | 全流程可用，删除为软删除 | 10.0 |
| P0 | 表格编辑核心（单元格编辑/选择/复制粘贴/行列操作/撤销重做/多Sheet/冻结） | Univer 内置能力全部开放且走 Command API | 10.0 |
| P0 | 公式引擎（场景必备函数白名单，80-120 个，名单锁定于 docs/formula/function-whitelist.md） | =SUM 等正确求值；依赖变更自动重算（口径同 AC-05） | 6.0 |
| P0 | .xlsx/.csv 导入导出（10MB 上限，后端任务队列解析） | 值+常用样式+公式文本保真；Excel 可开 | 7.2 |
| P0 | 实时协同（Yjs CRDT：多人光标/选区/自动合并 + yjs_updates 留痕） | 双端并发编辑最终一致（spike 已验证，见 AC-14） | 3.2 |
| P0 | License 授权管理（离线激活、SM2 验签、席位/到期控制） | 过期或超席降级只读并提示 | 商业闭环 |
| P0 | SSO 统一身份认证（LDAP/OAuth2/CAS） | 三种协议至少 LDAP+OAuth2 可用，CAS 尽力 | 废标风险 |
| P0 | 等保 2.0 三级基线（审计日志/口令策略/登录锁定/TLCP 网关/备份） | 会话级/文件级/管理级事件留痕可查（口径见 AC-11） | 合规门槛 |
| P0 | 离线部署交付（amd64/arm64 镜像 + 离线安装包，麒麟V10/统信UOS） | 运行时网络白名单=空，断外网全功能 | 交付形态 |
| P1 | 筛选/排序 | 列头菜单可用 | 6.4 |
| P1 | 单元格样式面板（加粗/颜色/数字格式） | 工具栏面板可用 | 2.8 |
| P1 | 分享链接权限（查看/编辑） | 链接可控权限 | 5.6 |
| P1 | 版本历史/回滚（快照列表+恢复） | 可回退到任一快照 | 3.2 |

## 3. 明确不做（Out-of-Scope — 锁定）

| 不做的功能 | 原因 | 何时考虑 |
|------------|------|----------|
| 图表/透视表/条件格式 | MVP 聚焦「快、稳、不丢数据」；竞品差评证明非刚需 | v2.0 |
| 移动端 | 政企主战场是桌面内网 | v2.0 |
| VBA/宏 | 安全审查复杂度极高，信创场景无强需求 | 有客户需求后评估 |
| 打印排版 | 非核心闭环 | v2.0 |
| loongarch64（龙芯）支持 | Node 无官方构建，Loongnix 版本滞后 | 有客户硬件需求时启用 |
| 密评全套/SM4 落盘加密 | 客户侧行为，列为交付项（实施期改造） | 按客户合同启动 |
| 直播多人语音/评论批注 | 非表格核心 | v2.0 |

## 4. 技术架构（锁定 — 版本锚定）

| 层 | 技术 | 实际版本 | 锁定原因 |
|----|------|----------|----------|
| 前端框架 | React + TypeScript + Vite | React 18.3.x / TS 5.x | Univer 官方 UI 层即 React |
| 表格引擎 | Univer OSS（@univerjs/* 全部同版本） | v1.0.2 | Canvas 渲染+500函数公式引擎，Apache-2.0；协同/导入导出为 Pro 收费故自建 |
| 协同 | Yjs CRDT + 自建 ws 服务 | Yjs 13.6.x / ws 8.x | 离线容忍强，MIT |
| 前端状态 | zustand + immer | zustand 5.x | 轻量；表格数据模型由 Univer 数据层托管，必须走 Command API |
| 图标 | lucide-react | lockfile 锁定 | ISC 协议，全项目唯一图标来源，禁用其他来源。**边界（P3-001 裁定）**：红线只约束自研代码——Univer 引擎内置图标（`@univerjs/icons@1.43.1`，随 `@univerjs/sheets-ui@1.0.2` 硬依赖引入，不可替换）属第三方渲染产物，不在红线范围内；但自研组件中禁止 import `@univerjs/icons` |
| 后端框架 | NestJS | 11.x | 与前端同语言；Univer 无头引擎可跑 Node |
| ORM | TypeORM（信创唯一可行） | 0.3.x | Prisma 不支持国产库；TypeORM 有 dmdb/opengauss 方言 |
| 数据库（主） | KingbaseES V8 R6（备选 openGauss 5.x；开发期 PostgreSQL 16 兼容） | — | 信创目录 + PG 血统迁移成本最低；**禁用 PG 专有特性**（无 pgvector，JSONB 降级为 JSON 字符串） |
| 缓存 | **MVP 无外置缓存**——协同 pub/sub 为单实例进程内实现（EventEmitter 封装 CollabBus 接口）；Redis 推迟至多实例扩容（ADR-004）时引入，届时评估信创目录平替（TongRDS 协议兼容） | — | 信创离线交付面最小化：单实例下 Redis 无实际功能，目录外组件不进交付包 |
| 网关 | Nginx + Tongsuo（TLCP 国密终结） | — | Node 不支持 TLCP，国密 HTTPS 必须网关终结 |
| 导入解析 | SheetJS CE（**cdn.sheetjs.com tarball，交付前入 verdaccio**；npm 0.18.5 含 CVE 禁用） | 0.20.3 | 读格式最全 |
| 导出 | ExcelJS | 4.4.0 | 样式写出，MIT |
| CSV | PapaParse | 5.4.x | — |
| 国密算法 | sm-crypto + Node crypto（SM2 验签；口令 PBKDF2-HMAC-SM3 ≥10 万轮） | latest 锁定 | 等保三级基线；存储格式带算法标识支持升级迁移 |
| 认证 | JWT 15min access + 7d refresh；SSO: LDAP/OAuth2/CAS | — | — |
| 部署 | Docker buildx 多架构（amd64/arm64）+ verdaccio 离线源 + 离线安装包 | 麒麟 V10 / 统信 UOS | 信创交付形态 |
| 运行时 | Node.js（`engines.node` 写**精确值 22.22.2** 而非区间；`.nvmrc` = 22.22.2；Dockerfile `node:22.22.2-bookworm-slim`） | 22.22.2 | Univer headless 要求 ≥22；精确锚 patch 使 Docker 镜像与 CI 环境复现一致。jsdom 30.1.3 的 engines 精确卡 `^22.22.2`，Node 浮动会导致安装失败；回退位 jsdom 29.0.0（engines `^20.19\|\|^22.13\|\|>=24`） |
| 包管理器 | pnpm（**11 线**，否决 Rust 重写的 12 线） | **11.28.6**（`latest-11` 稳定通道；`next-11` 为 11.28.7，交付不取 next 通道） | 11 线 bin 仍为 Node 脚本（`bin/pnpm.mjs`）、optionalDependencies 为空、零原生二进制；pnpm 12 的 bin shim 原文写明找不到二进制即 *downloads one*，离线环境直接失败且无 Node 侧兜底。否决 npm（无 per-package 构建脚本批准、无 catalog、monorepo 治理弱）与 Yarn Berry（PnP 改变 node_modules 物理形态，与 Vite/Tailwind content 扫描、Playwright、verdaccio 组合无验证预算）。须显式 `pmOnFail: error`（默认值 download 在离线环境等于无声联网）。**pnpm 11 配置模型变更**：非「注册源/认证」设置一律只能写 `pnpm-workspace.yaml`，写进 `.npmrc` 不生效 |
| 构建脚本治理 | pnpm `allowBuilds`（pnpm 11 起取代 `onlyBuiltDependencies` / `neverBuiltDependencies`）+ `strictDepBuilds: true` | — | `esbuild: true`（0.28.2 带 postinstall，未批准则二进制不落地、Vite 构建失败）；**`@scarf/scarf: false`**（swagger-ui-dist 5.32.13 的传递依赖，postinstall 硬编码 scarf.sh 遥测，属信创外联红线）。`strictDepBuilds: true` 使任何新出现的带脚本依赖在安装期报错而非静默跳过，须逐个显式裁决后入库 |
| peer 处理 | pnpm `autoInstallPeers: false` | — | **必须显式关掉**：`@nestjs/swagger` 11.4.7 的 peer 含 `class-validator` 与 `class-transformer`（值均为 `*`），开启自动补齐会把这两个已裁定不进依赖树的包装回来，与 ② 的单一 schema 源裁决直接冲突。改为显式声明 + 警告 |
| 供应链基线 | pnpm `minimumReleaseAge: 1440`（默认值，显式化） | — | 新发布不足 1 天的包不解析；零成本的供应链投毒保护，离线交付场景保留 |
| monorepo 编排 | pnpm workspace 内置 recursive / filter / parallel（**不引入 turbo / Nx**） | — | 包数 ≤4、CI 全量构建，任务级增量缓存收益≈0。turbo 的 `@turbo/linux-arm64-musl` 实测不存在（arm64 仅 glibc 一支）；Nx 引入项目图/插件/缓存/daemon 概念面，收益不抵。复评触发器：workspace 包数 >8 或 CI 单次构建 >10 分钟或出现包级依赖图环 |
| 前端构建 | Vite + @vitejs/plugin-react（**7 线**，否决 8 线） | vite 7.3.7 / plugin-react 5.2.0 | plugin-react 5.2.0 的 vite peer 为 `^4.2\|^5\|^6\|^7\|^8`，6.0.0 起只支持 vite ^8。**否决 Vite 8**：依赖 rolldown 与 lightningcss（**MPL-2.0**）两组必需路径且无 JS fallback，4 页面项目不为此付许可证标注与四象限核验成本。`build.target: 'es2020'` + browserslist `chrome >= 100` 兜国产浏览器下限 |
| 样式层 | Tailwind CSS + PostCSS + Autoprefixer（**3 线**，否决 4 线）；`corePlugins.preflight = false`、`prefix: 'wo-'` | tailwindcss 3.4.19 / postcss 8.5.31 / autoprefixer 10.6.1 | 3.4.19 实测 optionalDependencies 为空，纯 JS PostCSS 路线，信创四象限零原生编译链风险，npm 有官方 `v3-lts` dist-tag。**否决 4.x**：官方 browser-support 下限 Chrome 111 / Safari 16.4 / Firefox 128，击穿本 Spec §10 的 Chromium 100+ 下限；且 v4 经 @tailwindcss/node 引入 lightningcss（MPL-2.0 + 原生）。**preflight 必须关闭**：Univer 1.0.2 三份 CSS（实测 1738 条规则）无 html/body 重置、裸元素选择器仅 2 条 `*`、box-sizing 只在类选择器上，全局 reset 会在盒模型/表单 padding/ul 菜单三处与 Univer 对撞 |
| 组件策略 | 自研外壳原子 + Radix 无样式行为原语（**不引入大而全组件库**） | @radix-ui/react-dialog 1.3.1 / dropdown-menu 2.2.1 / context-menu 2.4.1 / tooltip 1.4.1 / toast 1.3.1 / avatar 1.3.1 / tabs 1.2.1 / progress 1.2.1 / popover 1.3.1 | DESIGN.md §4.1-4.7 需求约 14 个原子 × 9 态；Radix 不含图标、不含调色板、不含 CDN 资源，只借焦点 trap / ARIA / 键盘导航 / 视口翻转。否决 antd 5/6（hard dependency `@ant-design/icons` 第二图标源 + cssinjs 运行时 + 46MB）、Semi（拖入 @tiptap/* 约 20 包 + semi-icons，58.2MB）、Arco（自带 color/icon 子包）、**Mantine 9.7.3（peer react `^19.2.0`，与已锁 React 18.3.x 硬冲突）**；否决 shadcn CLI（需联网拉 registry，且默认 Tailwind v4 + React 19 路径不适用），改为手工采纳其「源码入仓 + Radix」做法。**Radix 各包主版本独立，无「同代」概念**，CI 断言版本逐一相等 |
| 组件变体工具 | class-variance-authority + tailwind-merge + clsx | 0.7.1 / 3.7.0 / 2.1.1 | cva 承载 DESIGN.md §4 的 9 态变体矩阵；tailwind-merge 解决 className 覆盖冲突 |
| 表单 | react-hook-form | 7.90.0 | 零直接依赖、MIT、peer 覆盖 React 18.3；非受控模型在 Univer 同进程下 re-render 成本最低。否决 formik（受控重渲染 + 校验规则无法给后端复用） |
| 校验（前后端单一源） | zod（schema 落 `packages/shared`，前后端共同 import） | 4.6.7 | 零依赖、MIT。**单一 schema 源结构性消除「前端过了后端形态不同」这一沉默逻辑错误高发区**。class-validator / class-transformer / nestjs-zod 三者均不进依赖树；后端走自研 ZodValidationPipe（约 30 行），OpenAPI schema 由 zod 内置 `z.toJSONSchema(schema, { target: 'openapi-3.0' })` 产出。所有 request schema 一律 `.strict()`（`z.object()` 运行时默认 strip，与 `z.toJSONSchema` 输出的 `additionalProperties: false` 语义矛盾，属静默吞错） |
| 表单-校验桥 | @hookform/resolvers | 6.0.0 | peer `{ zod: ^3.25.0\|\|^4.0.0, react-hook-form: ^7.55.0 }`，三方兼容已实证 |
| 前端单元测试 | Vitest + jsdom + Testing Library + @vitest/coverage-v8 | vitest 5.0.5 / jsdom 30.1.3（回退位 29.0.0）/ @testing-library/react 16.3.3 / dom 10.4.2 / jest-dom 7.0.1 / user-event 14.6.8 / coverage-v8 5.0.5 | 复用 Vite 配置与既有 esbuild 转译，不额外引入原生二进制。coverage-v8 的 peer 精确锁 `{ vitest: 5.0.5 }`。否决 Jest 于前端（需 ts-jest/babel 第二套转译链 + 独立 moduleNameMapper）。**Univer 编辑器页不上 jsdom**（需真实 Canvas 2D 与字体度量，补 node-canvas 要原生编译），全部上推 Playwright |
| 后端单元测试 | Jest + ts-jest + @nestjs/testing（e2e 用 supertest） | jest 30.5.2 / ts-jest 29.4.15 / @nestjs/testing 11.2.7 / supertest 7.3.1 | 后端 DI 依赖 `emitDecoratorMetadata`，须由 tsc 产出；ts-jest 纯 JS 无原生依赖。后端不装 vitest（其 peer `vite ^6.4\|^7\|^8` 会把 esbuild/rollup 原生二进制拉进后端依赖树，触发信创四象限核验） |
| E2E / 性能验收 | Playwright | 1.64.1 | AC-05 五档性能验收既定。**浏览器二进制必须随离线包交付或 `PLAYWRIGHT_DOWNLOAD_HOST` 指向内网镜像**（默认 Microsoft CDN，信创离线不可达），交付验证用 `playwright install --dry-run` 断言 |
| 后端 API 文档 | @nestjs/swagger（**降级为开发期浏览件 + openapi.yaml 交叉校验源**） | 11.4.7 | peer 严格 `@nestjs/core ^11.0.1`；8.x 仅支持 Nest 9/10，12.0.2 需 Nest 12。**openapi.yaml 仍为契约唯一事实源**（装饰器产不出 x-websocket 五段散文与 x-error-code-registry）。Swagger UI 必须 `swaggerOptions: { validatorUrl: null }`（默认指向 validator.swagger.io，撞 AC-12 运行时零外链），生产默认关闭 |
| 契约校验工具（CI） | 自写归一化 diff（P0）+ @apidevtools/swagger-parser（P1） | js-yaml 5.5.0 / swagger-parser 13.1.0 | swagger-cli 4.0.4 已 deprecated；@redocly/cli 依赖体量过大不适合离线镜像。G1 类型面 / G2 文档面 / G3 扩展面三段门禁；G1 须对「无任何端点 $ref 的孤儿 components.schemas」单独报警 |
| 语言与编译器 | TypeScript（**写死 5.9.3**，禁 `^`、禁升 7.x） | 5.9.3 | typescript-eslint 8.72.0 的 peer 为 `>=4.8.4 <6.1.0`；npm latest 已是 TS 7.0.2，浮动即 peer 破裂 |
| 代码规范 | ESLint flat config + Prettier | eslint 9.39.5 / @eslint/js 9.39.5 / typescript-eslint 8.72.0 / eslint-plugin-react 7.37.5 / eslint-plugin-react-hooks 7.1.1 / eslint-config-prettier 10.1.8 / globals 17.13.0 / prettier 3.9.10 | **否决 ESLint 10**：eslint-plugin-react 最新 7.37.5 的 peer 上限为 `^9.7`，且 v10 移除了 `context.getSourceCode()` 等自定义规则 API，而本项目**必须**写自定义规则。flat config 是唯一可得形态（ESLint 9 起默认，10 起旧格式彻底移除） |
| P0 规则落点（工具层） | 自定义 ESLint 规则（普通目录 `packages/config/rules/`，非 npm 包）+ `no-restricted-imports` | — | `wo/no-emoji`（P0-1，覆盖 Literal / TemplateElement / JSXText / JSXAttribute / 注释）与 `wo/no-hardcoded-color`（P0-3，hex 与 rgb/hsl 函数，例外仅 #fff/#000，白名单为 tokens 生成物）；图标源拦截用核心规则 `no-restricted-imports`。**规则自带 RuleTester 单测**——规则自己写错是最致命的失效模式。不引入 stylelint（第二套配置与依赖树，既有裸 hex 脚本已覆盖实际风险面） |
| 文档 / 样式补充约束 | `scripts/check-docs-constraints.mjs` + `scripts/check-style-constraints.mjs` | — | 补 ESLint 覆盖不到的面：docs 侧 emoji 与 AI 模板味文案词表（复读 DESIGN.md §9 第 6 条，保证同源不漂移）、产物裸 hex 白名单（从 tokens.ts 派生）、产物外链 grep + CSP `font-src/img-src 'self'` |

## 5. API 端点清单（锁定——开发时以此为唯一依据）

> 架构师 Phase 2 必须同时产出 `openapi.yaml`（OpenAPI 3.0）。

| Method | Path | 功能 | 认证 | 请求体 | 响应体 |
|--------|------|------|------|--------|--------|
| POST | /api/v1/auth/login | 登录（PBKDF2-HMAC-SM3 校验） | 公开 | {username,password} | {accessToken,refreshToken,user} |
| POST | /api/v1/auth/refresh | 刷新 token | refresh token | {refreshToken} | {accessToken} |
| POST | /api/v1/auth/logout | 登出（吊销 refresh） | JWT | - | 204 |
| GET | /api/v1/auth/me | 当前用户信息 | JWT | - | {user} |
| POST | /api/v1/sso/{type}/callback | SSO 回调（ldap/oauth2/cas） | 会话/票据 | 协议相关 | 同 login |
| GET/PUT | /api/v1/sso/config | SSO 配置读写（admin） | JWT+admin | {type,config} | {config} |
| GET | /api/v1/files | 文件列表 | JWT | query: page/keyword | {items,total} |
| POST | /api/v1/files | 新建文件 | JWT | {name} | {file} |
| PATCH | /api/v1/files/:id | 重命名 | JWT | {name} | {file} |
| DELETE | /api/v1/files/:id | 软删除 | JWT | - | 204 |
| GET | /api/v1/files/:id/snapshot | 取最新服务端物化快照（gzip，含水位线） | JWT | - | {snapshot(gzip),version,baseSeq} |
| POST | /api/v1/files/:id/snapshot | 触发服务端物化快照点（无请求体，快照仅由服务端生成） | JWT | - | {version,baseSeq}（物化进行中 409/2005） |
| POST | /api/v1/files/:id/import | 上传 xlsx/csv（≤10MB）触发后端解析任务 | JWT | multipart | {taskId} |
| GET | /api/v1/import/:taskId | 解析任务状态/结果 | JWT | - | {status,error?,fileId?} |
| GET | /api/v1/files/:id/export?format=xlsx\|csv | 导出下载 | JWT | - | 文件流 |
| POST | /api/v1/files/:id/share | 创建分享权限（P1） | JWT | {userId,perm} | {share} |
| GET | /api/v1/users | 用户列表（admin，分页+关键字） | JWT+admin | query | {items,total} |
| POST | /api/v1/users | 建号（admin，初始口令 PBKDF2 格式；不提供物理删除，账号可追溯） | JWT+admin | {username,displayName,role,password?} | {user} |
| GET | /api/v1/users/:id | 用户详情（含 status/locked 状态） | JWT+admin | - | {user} |
| PATCH | /api/v1/users/:id | 改 display_name/角色/status(active\|disabled) | JWT+admin | {displayName?,role?,status?} | {user} |
| POST | /api/v1/users/:id/unlock | 解锁（locked_until/failed_attempts 清零） | JWT+admin | - | {user} |
| POST | /api/v1/ws/ticket | WS 握手票据（JWT 换 5 秒一次性 ticket；**query token 方案废弃**） | JWT | - | {ticket} |
| GET | /api/v1/audit-logs | 审计日志查询（admin，分页+过滤） | JWT+admin | query | {items,total} |
| POST | /api/v1/license/activate-request | 生成激活申请码（机器指纹） | 公开 | - | {requestCode} |
| POST | /api/v1/license/install | 安装 License 文件（SM2 验签） | 公开 | {licenseFile} | {status} |
| GET | /api/v1/license/status | License 状态（席位/到期） | JWT | - | {seats,used,expiresAt,valid} |
| WS | /ws/collab/:fileId | Yjs 同步（LOAD 0x03/UPDATE/AWARENESS/CONTROL 0x04 doc-rebuild；加载协议 snapshot@base_seq + seq>base_seq） | JWT | Yjs binary | Yjs binary |
| GET | /api/v1/health | 健康检查 | 公开 | - | {status} |

## 6. 数据库表清单（锁定）

| 表名 | 核心字段 | 索引 | 关联 |
|------|----------|------|------|
| users | id, username, display_name, password_hash(PBKDF2-HMAC-SM3，格式串含盐为唯一事实源，无独立 salt 列), role(admin/member), locked_until, failed_attempts, sso_provider?, sso_id?, status, created_at | unique(username), (sso_provider,sso_id) | — |
| refresh_tokens | id, user_id, token_hash, expires_at, revoked_at | (user_id) | users |
| files | id, name, owner_id, version, created_at, updated_at, deleted_at | (owner_id,updated_at) | users |
| file_snapshots | id, file_id, version, base_seq(非空,物化水位线,与快照同事务写入), snapshot(bytea,gzip), created_by, created_at | unique(file_id,version) | files,users |
| yjs_updates | id, file_id, seq, update(bytea), origin, created_by, created_at | **unique(file_id,seq)**（单写者+唯一索引双防线） | files |
| audit_logs | id, user_id, action, target_type, target_id, detail(JSON字符串), ip, created_at | (user_id,created_at),(action,created_at) | users |
| licenses | id, machine_fingerprint, fingerprint_items, rebind_count, seats, expires_at, license_file, status, activated_at | 索引见 docs/license/design.md（active 唯一性应用层校验，不用 DB 唯一索引） | — |
| sso_configs | id, type(ldap/oauth2/cas), config(JSON字符串), enabled | unique(type) | — |
| import_tasks | id, file_id, status(pending/parsing/done/failed), error?, created_by, created_at | (created_by,created_at) | files,users |
| share_permissions（P1） | id, file_id, user_id, perm(view/edit), created_at | unique(file_id,user_id) | files,users |

> 字段类型遵循「禁用 PG 专有特性」：JSON 一律 text/varchar 存 JSON 字符串；无 array 类型字段；无 JSONB/pgvector。

## 7. 页面清单（锁定）

| 页面 | 路由 | 核心组件 | 对应 API | 设计 Token 主题 |
|------|------|----------|----------|-----------------|
| 登录页 | /login | 登录表单 + SSO 入口 | auth/login, sso/* | surface 浅色 |
| 文档列表（首页） | /files | 新建/导入/搜索/重命名/删除 | files/*, import/* | surface 浅色 |
| 表格编辑器 | /file/:id | 标题栏/工具栏/公式栏/Univer 工作区/Sheet标签栏/状态栏/协同头像 | snapshot, WS collab, export | surface 浅色（Density 7） |
| 管理后台 | /admin | 用户管理/SSO 配置/License 管理/审计日志 4 个 Tab | users, sso, license, audit-logs | surface 浅色 |

## 8. 设计 Token（锁定）

> 设计师 Phase 2 必须同时产出 `design-tokens.json` + `design-tokens.css`，前端 import 引用。
- **主色**：Emerald Green `#059669`（品类心智色；强调色每屏 ≤2 处）
- **中性色**：bg `#F9FAFB` / surface `#FFF` / border `#E5E7EB` / fg `#111827`；网格线 `#E2E8F0`；表头底 `#F1F5F9`
- **语义色**：success `#16A34A` / warn `#D97706` / danger `#DC2626`；协同光标 8 色高可辨识度调色板
- **字体**：UI = Inter + Noto Sans SC；公式栏/单元格数据 = JetBrains Mono（全部 OFL 本地打包）
- **图标库**：lucide-react（全项目唯一，禁用其他来源），尺寸 16/20/24px
- **主题**：浅色；工具栏总高（标题栏44+工具栏40+公式栏32）≤120px
- **对标**：Google Sheets（结构）+ Linear（视觉）+ 腾讯文档（习惯）；Density 7 驾驶舱模式
- **禁止**：紫粉渐变、渐变文字、彩色左边框、纯黑纯白直出、装饰性动效、emoji 图标

## 9. 验收标准（锁定——QA 以此为唯一依据，EARS 格式）

| 编号 | 功能 | EARS 验收标准 | 优先级 |
|------|------|---------------|--------|
| AC-01 | 登录 | When 用户提交合法凭证，系统**必须**返回 JWT（15min access + 7d refresh）且口令以 **PBKDF2-HMAC-SM3（≥10 万轮+盐）**校验 | P0 |
| AC-02 | 登录安全 | If 连续 5 次登录失败，系统**必须**锁定该账号 15 分钟并记录审计日志 | P0 |
| AC-03 | 编辑 | When 单元格输入确认，系统**必须**走 Univer Command API 更新且可撤销重做 | P0 |
| AC-04 | 公式 | When 输入 =SUM(A1:A10)，系统**必须**正确求值且依赖变更触发自动重算（正确性口径：值断言 + 依赖格变更后其值随之更新；性能数字不内嵌于本条，唯一出处为 AC-05 档位明细） | P0 |
| AC-05 | 性能 | While 打开及编辑工作簿，系统**必须**满足下方「AC-05 性能档位明细」的帧率与重算收敛时延断言（x86_64 参考档：Intel i5-12500/16GB/SSD 同级，Chrome 120+；鲲鹏 ARM 低配档：Kunpeng 920 4 核/8GB 虚机 + 麒麟 V10）。验收工具：Playwright 帧率采样 + Univer API 读值 + 重算收敛时延计时（ARM 档阈值需 QA 真机基准复核） | P0 |
| AC-06 | 协同 | When 两用户并发编辑同一单元格，系统**必须**经 CRDT 自动合并且双端最终一致；协作者光标/选区**必须**可见 | P0 |
| AC-07 | 导入 | When 上传 ≤10MB 的 xlsx，系统**必须**后端解析为 Univer 快照（值/常用样式/公式文本保真）；>10MB **必须**拒绝 | P0 |
| AC-08 | 导出 | When 导出 xlsx/csv，产物**必须**可被 Excel 正常打开且公式文本保留 | P0 |
| AC-09 | License | If License 缺失/过期/超席，系统**必须**降级只读并提示（三层防线分别断言：服务端 402 → Command 层 beforeCommandExecuted 守卫 → UI Disabled + 只读 banner；WS 侧出口按触发分域——License 无效/过期时新编辑首连 close 4409；超席时新编辑连接降级 view 角色且连接存活、ROLE_UPGRADE 满席回 role-upgrade-reject 帧，**超席无 close 码**，与 §10「超席时新编辑请求降级只读（不拒入）」同口径）；合法 License **必须**通过 SM2 公钥验签 | P0 |
| AC-10 | SSO | When 用户经已配置的 LDAP/OAuth2 完成认证，系统**必须**建立本地会话并映射用户 | P0 |
| AC-11 | 审计 | When 会话级/文件级/管理事件发生（登录登出、文件增删改名、导入导出、License 操作、SSO 事件、用户管理），系统**必须**记录含用户/动作/对象/IP/时间的审计日志且可分页查询；协同单元格级明细留痕由 yjs_updates.created_by 承担，不逐格写审计表 | P0 |
| AC-12 | 离线 | While 断开外网运行，系统**必须**全功能可用（运行时网络白名单=空断言） | P0 |
| AC-13 | 环境 | While 部署于麒麟 V10/统信 UOS（x86_64/aarch64），系统**必须**正常安装运行 | P0 |
| AC-14 | 协同 spike | When Univer Mutation 映射为 Yjs 更新并远端回放，两端快照**必须**一致（spike 通过才可进入协同开发） | P0 |
| AC-15 | 崩溃恢复 | When 协同服务进程以 SIGTERM/SIGINT 终止，系统**必须**按序完成（拒新连接 → 存量帧排空 → 在途增量 flush → WS close 1000）且总时长 ≤ 30s；When 服务以 kill -9/OOM 终止后重启，已提交 yjs_updates **必须**零丢失（重启后按加载协议重建 doc，应用以 L 秒速率持续写入 ≥ 5 分钟的自动化用例验证，L ≤ 1s）；When 单条 UPDATE 到达，系统**必须**在落库提交后才广播/确认（先持久化后传播时序断言） | P0 |

### AC-05 性能档位明细（重算时延 + 帧率，唯一性能口径出处）

> 原则：全表重算（`forceCalculation`）与「编辑→增量脏区重算收敛」是两类时延，**禁混写单一数字**；每个档位以「规模 × 重算类型」划分，并给出可测试的 P95 EARS 断言。**本表 v1.1（2026-10-22）依据 P3-002 spike 实测修订**：B11a 拐点曲线（`spike/formula-runtime-spike/src/calc-latency-curve.mjs`，4 档 × 3 轮）证明单格增量重算时延由**全文档公式总数**线性驱动（~24ms/千公式，机理 = FormulaDependencyGenerator 每轮全表重建依赖树，与脏区大小无关，progress 证实各档均只重算 10 个公式），**档位规模边界由「格数」改用「公式格数」为主轴**（格数上限仍保留，作内存预算口径）。ARM 档阈值仍需 QA 真机基准复核（见 ADR-001 v1.8）。

| 档位 | 规模边界 | 重算类型 | 时延断言（EARS） | 线程/交互 |
|------|----------|----------|------------------|-----------|
| L0 交互实时档 | 单 sheet ≤ 20 万格（内存预算口径）**且含公式格 ≤ 5,000** | 单格编辑触发增量脏区子图重算收敛 | **R0**：When 编辑一个「被 ≤ 50 个公式直接引用」的基础值格，系统**必须**在 200ms P95 内完成依赖子图重算收敛（从编辑确认到受依赖公式格读值更新）。依据：5 千公式档实测中位 89ms / 单轮最差 159ms（E1，calc-latency-curve.mjs），P95 余量约 1.25 倍，QA 真机复核须含 GC 干扰轮 | 主线程同步可接受 |
| L1 万行实时档 | ≤ 100 万格（红线场景）**且含公式格 ≤ 10,000** | 可见窗口内单格编辑触发增量重算 | **R1**：While 打开符合条件的文档并编辑可见窗口内一个「被 ≤ 50 个公式直接引用」的基础值格，系统**必须**在 500ms P95 内完成该子图重算收敛且不阻塞 UI 帧（主线程异步 + 状态栏重算进度提示）。依据：1 万公式档实测 247/258/274ms（E1，calc-latency-curve.mjs），P95 余量约 1.8 倍 | 主线程异步 + 进度提示 |
| L1b 公式密集档 | ≤ 100 万格 且公式格 10,001 ~ 20,000 | 单格编辑增量重算（时延被依赖生成固定成本支配） | **行为承诺，不设毫秒值**：**R1b**：While 打开公式密集文档并编辑，系统**必须**异步完成重算 + 状态栏进度提示 + 滚动与输入不被计算阻塞。依据：2 万公式档实测中位 596ms / 单轮最差 895ms（E1）——500ms 与 800ms 数字承诺均不成立，诚实归行为档 | 主线程异步 + 进度提示 |
| L2 全量重算档 | 100 万格 / 10 万公式 | `forceCalculation` 全表重算 | **R2**：When 显式触发全表重算，系统**必须**在 10s P95 内完成且全程不阻塞 UI（异步执行 + 状态栏进度提示）。依据：实测 5,227ms（E1，calc-latency-probe.mjs B11c） | 主线程异步 + 进度提示 |
| L2b 坏编辑档 | 100 万格，编辑「高入度根格」（被 ≥ 1 万公式共同引用） | 增量脏区退化为近全表子图 | 按 L2 档断言（10s P95 异步）；**不得**误入 L0/L1 期望 200/500ms。依据：实测 3,285ms / 99,990 公式重算（E1，B12） | 主线程异步 + 进度提示 |

> 越界降级规则：公式格 > 20,000 的文档，编辑重算一律按 L2b 行为承诺（异步 + 进度 + 不阻塞），并在导入时按 WI-3 提示文档拆分；引擎侧依赖图缓存（消除 O(全表公式数) 固定成本）登记为 P1 优化项（Univer 1.0.2 未实现，`clearDependencyTreeCache` 机制存在但每轮重建，不得作为 MVP 承诺依据）。

帧率断言（保持原 AC-05 帧率口径，仅拆分独立成行）：

| 档位 | 帧率断言（EARS） |
|------|------------------|
| F-x86 | While 打开 5 万行×20 列工作簿滚动，x86_64 参考档（Intel i5-12500/16GB/SSD 同级，Chrome 120+）P95 帧率**必须** ≥ 50FPS |
| F-arm | While 打开 5 万行×20 列工作簿滚动，鲲鹏 ARM 低配档（Kunpeng 920 4 核/8GB 虚机 + 麒麟 V10）P95 帧率**必须** ≥ 45FPS |

## 10. 边界与约束

- 浏览器：Chrome/Edge 100+、奇安信/360/统信浏览器等 Chromium 内核；不支持 IE
- 单 sheet 规模上限：100 万单元格；导入上限 10MB（规模红线裁决 2026-10-21 分支 E：**维持 100 万格，不向竞品 1000 万格对齐**——竞品 1000 万格是云分布式多机容量，信创私有化单实例 Node 内存成本 1.5KB/格 RSS，1000 万格单 doc ≈14GB 击穿 16GB 部署预算；1000 万格属容量红线非交互红线，登记为 P1 随 Worker/分片终态再评估）
- 数据层禁用 PG 专有特性（信创数据库兼容硬约束）
- 性能目标：AC-05（AC-04 仅断公式正确性，性能数字唯一出处为 AC-05 档位明细 L0/L1/L1b/L2/L2b + F-x86/F-arm；全表重算与编辑→增量重算时延分离断言，禁混写；**档位规模边界以公式格数为主轴**——v1.1 修订依据 P3-002 spike 实测，单格增量重算时延由全文档公式总数线性驱动 ~24ms/千公式，2 万公式档实测 596ms 击穿原「公式格 ≤2 万 / 200ms」边界 3 倍）
- API 风格：REST /api/v1 + WS /ws/collab；错误响应统一结构 {code,message,detail}
- 安全：口令 **PBKDF2-HMAC-SM3（迭代 ≥100,000 轮 + 随机盐）**；JWT 短期+refresh；TLCP 网关终结；审计日志不可删改（仅追加）
- 协同持久化约束：快照**仅由服务端**从 Yjs doc 物化（客户端只能触发快照点）；yjs_updates (file_id,seq) 唯一索引；**MVP 协同服务为单写者（seq 分配仅单实例执行）**，多实例扩容另立 ADR；快照物化与 base_seq 水位记录必须同事务；加载协议 = snapshot@base_seq + updates WHERE seq > base_seq
- 导入与协同互斥：导入任务完成回写前，若目标文件存在活跃协同连接，服务端先物化快照并经结构通道广播 doc-rebuild，客户端断开后走标准加载协议重建
- WS 协同安全：握手必须用一次性 ticket（5 秒有效、单次使用，POST /ws/ticket 以 JWT 换取），禁止 query 传 JWT（防 access log 泄漏）；用户登出/锁定/禁用时服务端向其全部活跃 WS 发 session-invalidated 并 close 4411，协同服务每 60s re-validate 会话；**席位 = 并发协同编辑用户数（user_id 去重，同用户多标签/多文件计 1 席；只读会话不占席）**；**防绕过：view→edit 转换瞬间占席，满席时拒绝转编辑并保持只读（明确提示）**；超席时新编辑请求降级只读、已有编辑会话不中断；60s 断线宽限防席位闪烁；viewer 走同一 WS 通道、服务端按角色过滤上行（仅收 update 流与 awareness，支撑他人光标可见）；席位计量为进程内实现（单写者单实例，ADR-004 多实例时演进）；4410（同账号同文件 ≥3 连接）为防滥用上限、独立于席位判定；单实例内存水位超 LRU 硬上限时先驱逐最久未活跃已物化 doc、仍超限才拒新 WS（close 4412），单个 doc 自身超单 doc 预留预算时拒开该 doc 协同并提示过大（close 4412 + 超限语义）
- 快照物化节奏：三类有意义版本（30min 间隔 / 累计 500 updates / 显式保存点），禁止「短空闲即物化」；保留策略与 P1 版本历史同一定稿（见 OPEN-DECISIONS）
- **增量持久化时序（M3 硬约束）**：每条 UPDATE 必须「先落库 yjs_updates 提交、后广播/确认」；服务端允许 group-commit 合并事务，但**攒批刷新上界 ≤ 1 秒或 ≤ 50 条（先到为准）**——此上界同时就是 SIGKILL/OOM 下的 RPO 上界。禁止 Phase 3 实现为无上界内存攒批。
- **RPO 口径（显式化）**：SIGTERM/SIGINT 优雅关闭 → RPO = 0；kill -9/OOM → RPO ≤ 攒批上界（M3 默认 ≤ 1 秒增量，约数十次按键）。**优雅关闭不做强制快照物化**——增量已 write-through 持久化于 yjs_updates，重启按加载协议（snapshot@base_seq + seq > base_seq 增量回放）无损重建 doc，物化只是压缩 update 日志，缺失物化不影响数据完整性。30min/500 条是**物化节流参数，不是数据丢失窗口**——任何文档与交付口径不得混用两者。
- **优雅关闭序列（M3 硬约束）**：SIGTERM/SIGINT 触发（拒新 WS/HTTP 连接 → 存量帧广播排空 → 攒批最后一次 flush → WS close 1000），总 drain 预算 ≤ 30 秒，超时强制退出。部署编排（systemd/docker compose）停止超时须 ≥ 30 秒。**seq 分配、席位计量、协同广播三个组件必须以可替换接口（TS interface）发包**（MVP 默认进程内实现：max+1 事务分配 / Map 计量 / EventEmitter）——ADR-004 多实例演进时只换实现不换调用方，此约束为 Phase 3 架构硬门槛，实现可用进程内 Map，但形状不可写死。
- 导入公式策略（2026-10-21 第二轮评审修订；第三轮增补坐标错位防线与差分导入）：白名单外公式分域处理——**引擎可用区（E = 引擎实现集 − 119 白名单 − 排除集 X，393 个，CI 机器生成）走差分导入**：无头重算值与 xlsx 缓存值一致则 f 保留参与计算（与白名单公式同权、无角标不计提示条），不一致自动降级冻结；**桶 II（引擎未实现）/桶 III（排除集 X：volatile + 动态引用 OFFSET/INDIRECT/ANCHORARRAY/RANDARRAY）/差分降级格**剥 f 只留缓存值进 Univer snapshot，原始公式文本存公式档案（snapshot `resources` 侧车，插件级官方载体），导出时从档案还原 f；前端打开时提示（PM 定稿文案）——禁止静默转文本（档案即「文本保真」载体）。白名单内 volatile 函数（NOW/TODAY/RAND/RANDBETWEEN）导入路径同样静态化（值取 xlsx 缓存值，防双端加载时刻发散）。依据：ICellData 无冻结值字段、v+f 并存形态会被重算覆盖并 #NAME? 级联（spike runtime-calc-probe 14/14 实证）；差分等价性论证见 function-whitelist.md §3.2。**第三轮 P0 增补（档案坐标错位防线）**：档案条目补存导入时 v；六类结构操作（插/删行列、排序、移动剪切粘贴）经结构 mutation 拦截**同步迁移档案键**（Y.Doc 单事务，undo/redo 反向迁移，双通道生效顺序定死：本地先 cellData 后档案、远端回放后档案、物化整表重写）；导出还原 f 前置**值校验**（目标格当前 v !== 档案 v 即丢弃条目+降级说明）——迁移为主、校验为兜底，静默写错格被结构性排除（spike archive-migration-probe 13/13 实证）；差分降级格与冻结格共用同一档案体系，防线一体生效
- 服务端重算（2026-10-21 实证补强）：增量依赖图脏区重算（非全簿全量）；周期性全量重算仅作为日维护任务或显式触发。无头触发 API 已实证可用：`formula.mutation.set-trigger-formula-calculation-start`（`forceCalculation: true` 全量 / `dirtyRanges` 增量），重算经 10ms 去抖异步执行——服务端调用后**必须等待重算完成信号或 >= 100ms 再读值/物化**，同步读回是时序假象；ADR-001 Decision 4 成立，无需降级
- 重算线程归属 & 性能（分支 E 裁决）：MVP 浏览器端重算走**主线程增量脏区重算 + 异步化 + 进度提示**，不把 3.8-5.4s 的同步全表/近全表重算跑主线程；`@univerjs/rpc` 的 `WebWorkerRemoteInstanceService` 为 P1 高压档终态（MVP 不实装——官方语义是整表引擎态再建一份、100 万格档内存翻倍，放大资源压力而非缓解）。重算触发点收敛为可替换 `CalcDispatcher` 接口（MVP 默认主线程增量实现，P1 换 Worker 只换实现不改调用方），与 seq 分配/席位计量/协同广播三组件「可替换接口」同构；此接口为 Phase 3 架构硬门槛
- 运行时：Node 官方二进制（OpenSSL 3.x），启动断言**三级国密自检**（G1 digest sm3 存在 + G2 曲线 SM2 存在 + G3 固定 fixture 验签——自洽断言，fixture 系本仓签发 CLI 产出的自签向量，证四口径未漂移与篡改必拒，互通性由探针 G8 独家承担；任一失败拒绝启动；探针 scripts/gm-crypto-probe.mjs 固化，G4 sm4/G5 PBKDF2 进 CI 不进启动断言）——发行版 Node 链 OpenSSL 1.1.1 时症状是「启动不报错、激活时静默失败」，断言把失败提前到启动期；鲲鹏 aarch64 复测（含 PBKDF2-HMAC-SM3 延迟，x86 实测 10 万轮约 55-60ms）列 Phase 3 首迭代
- License 防拷贝定位（分支 D 修订）：License 为**授权计量与合规凭证**，不承诺防拷贝——容器形态「拷卷即过」显式承认（卷级盐唯一关键项随卷复制，席位并发兜底对跨实例克隆结构性失效并废止）；配套三件事：商务强制披露（允许/禁止表述与标准应答句见 license/design.md §6-bis，投标写「一机一码/防拷贝」属虚假承诺）、时钟回拨检测（licenses.max_seen_at 持久化已见最大时间戳，有效期判定取 max(系统时钟, max_seen_at)，回拨 >24h 审计告警不误杀）+ 过期宽限 7 天（只读不锁死，提示含续期引导）、SM2 启动断言三级（见运行时行）；换绑维持统一 2 次/自然年（合同侧上浮，vMotion 不消耗）
- 部署资源下限：内存 ≥16GB（依据 ADR-001 v1.7 内存总量预算：单 doc 运行时 ≈ 200MB 框架基线 + 1.5KB/格 RSS 口径；Node heap 硬顶 ~12GB、LRU 驱逐触发水位 80% ≈ 9.6GB。**序列化体积只作落库存储体积，不作运行时内存预算依据**——16GB 支撑政企典型万行级负载，不支持 100 个百万格 doc 同时活跃；close 4412 按内存水位触发，见 ADR-001 v1.7）
- 浏览器：Chrome/Edge 100+；统信 UOS/奇安信等国产浏览器实际内核版本普查列为交付前 gate（见 OPEN-DECISIONS）
- 快照体积上限：落库与传输一律 gzip(6)，上限 **gzip 后 32MB**（依据 spike 实测：100 万格 gzip 最差 ~4.7MB，中文极端场景 4.13MB，留 ~7 倍余量；实测数据见 spike REPORT 附录 A）
- CI 必须双跑 PostgreSQL 16 + KingbaseES 兼容用例（注：KingbaseES 无公开 Docker 镜像，CI 实际以 openGauss 替代，兼容漂移风险见 OPEN-DECISIONS）
- **国产库真机验证锚点（2026-10-21 外部评审分支 F 裁决）**：冻结 schema（§6 十表）的金仓真机验证分两层——① **Phase 3 M1 脚手架期契约冒烟**：10 表 DDL + 每表 repository CRUD + information_schema 反查 + 敏感点断言（bytea/timestamptz/NULL 唯一索引/TypeORM 自动 RETURNING），断言清单与 TypeORM version() 解析静态核对结论见 schema.md §7；冒烟失败即触发契约回溯（schema → Spec §6 → openapi → ADR-002），回溯项登记 OPEN-DECISIONS。② **Phase 4 交付前金仓全量回归**（既有承诺不变）。金仓进 CI 否决（license 人工获取不满足 CI 自动化前提）。环境获取：架构师发起官网 license 申请（流程 3-5 工作日），商务协助；达梦 PoC 排金仓冒烟之后（主库契约优先于次优先适配，共用环境获取窗口，见 dameng-poc-plan.md 排序裁决）

## 11. 内嵌已知坑（新项目首版，来自调研结论）

| 坑 | 技术栈指纹 | 根因 | 修法 |
|----|------------|------|------|
| npm 上的 SheetJS 冻结 0.18.5 含 CVE | sheetjs | 官方只经 cdn.sheetjs.com 发新版本 | 用 CDN tarball 锁 0.20.3，交付前入 verdaccio |
| @univerjs/* 包版本不一致导致运行时错乱 | univer 1.0.2 | 官方强制全包同版本 | lockfile 中逐包核对面版本 |
| 误以为 Univer OSS 含协同/xlsx 导入导出 | univer pro 边界 | 协同/导入导出/历史是 Pro 收费能力 | 协同走自建 Yjs，导入导出走 SheetJS+ExcelJS 自研转换层 |
| Node 无法直接跑 TLCP 国密 HTTPS | node-tls | Node TLS 不支持国密双证书协议 | 网关层 Nginx+Tongsuo 终结，内网标准 TLS |
| 表格数据被外部直改导致 Undo/协同断裂 | univer data-layer | Univer 数据必须经 Command API | 严禁从外部直接改 snapshot |
| 无头模式抛 "Locale not initialized" | univer headless（spike 实证） | 顶层 COMMAND 执行需 locale 已初始化 | 显式注入 locales |
| InsertRowCommand 第 0 行插入抛 "Anchor row is out of bounds" | univer 1.0.2（spike 实证） | anchorRow=-1 越界 | 第 0 行插入必须传 Direction.UP |
| Y.Map 删键不清 Univer 数据层 | univer+yjs（spike 实证） | Y.Map 删除不会级联到 Univer | 回放必须「对账式」：显式清空失效单元格 |
| oplog+跳过已应用 op 的同格并发写法发散 | 协同（spike T4c 反例） | 同格并发下跳过逻辑必然各持一词 | 该写法禁用；单元格内容走 Y.Map 幂等绝对赋值，结构操作走服务端定序 |
| 回放携带错误 ExecutionOptions 造成回声放大 | univer+yjs（spike 实证） | 回放入 redo/undo 栈或触发再广播 | 回放携带 {onlyLocal:true, fromCollab:true} |
| 协同光标按 Yjs clientId 取模配色 | yjs awareness（架构师实证） | clientId 是连接级随机值，用户刷新即变色锁不住 | 禁用该写法；改为 fnv1a32(userId) % 8 确定性哈希，发送端在 awareness 自带 color 字段，协议级保证全端一致 |
| Univer 挂载早于字体就绪导致列宽度量错位 | univer+@fontsource | Canvas 首帧字体未加载完成，列宽按回退字体计算错位 | await document.fonts.load 先于 Univer 挂载 |

## 12. 端到端验证步骤（核心成功流 + 关键错误流）

```bash
# 1. 离线安装（模拟客户内网）：docker compose 离线加载镜像 + verdaccio 离线源
docker compose up -d   # 麒麟 V10 / 统信 UOS, amd64 与 arm64 各验证一次

# 2. License 激活流
curl -X POST https://<内网网关>/api/v1/license/activate-request   # 断言：返回机器指纹申请码
# （线下签发 License 文件后）
curl -X POST .../api/v1/license/install -F licenseFile=@lic.key     # 断言：SM2 验签通过 200

# 3. 核心成功流
curl -X POST .../api/v1/auth/login -d '{...}'                       # 断言：200 + JWT
curl -X POST .../api/v1/files -H "Auth: Bearer ..."                 # 断言：201 + fileId
# 浏览器双开两会话编辑同一文件 → 断言：并发编辑 CRDT 合并一致、光标互见
curl -X POST .../api/v1/files/:id/import -F file=test.xlsx          # 断言：解析成功且公式/样式保真
curl .../api/v1/files/:id/export?format=xlsx -o out.xlsx             # 断言：Excel 可打开

# 4. 关键错误流
curl -X POST .../api/v1/files/:id/import -F file=huge.xlsx          # 断言：413 拒绝（>10MB）
curl .../api/v1/files -H "Auth: Bearer 过期token"                    # 断言：401
# 移除 License → 断言：所有写操作降级只读 403 + 提示
```

## 13. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-10-21 | v1.0.0 首版发布 | 用户确认三文档 + 信创约束补充 | 全部 |
| 2026-10-21 | 工具栏总高验收口径澄清：「常驻顶部 ≤120px」；License 只读降级条为临时状态条不计入常驻预算（Phase 2 设计门禁裁决） | 设计师提出降级条与 120px 上限冲突 | §8、AC-09；QA 断言按常驻态执行 |
| 2026-10-21 | 分享按钮本期从编辑器标题栏移除，标注 P1 预留位（Phase 2 设计门禁裁决） | 分享为 P1，禁用态入口属无效视觉负担 | §7 编辑器页面；P1 时随 share API 一并恢复 |
| 2026-10-21 | Schema 备案：users 新增 locked_until/failed_attempts 两列（AC-02 登录锁定落库）、files 新增 version 冗余列；仍为 10 张表 | Phase 2 架构师差异申报，PM 备案通过 | §6 表结构 |
| 2026-10-21 | §11 新增 5 条 spike 实证坑（locale 注入/Direction.UP/对账式回放/oplog 禁用/回声规避）；AC-14 协同 spike 已验证通过（32/32） | 协同 spike PASS，Yjs CRDT 主路线成立 | §9 AC-14、§11、协同模块开发约束 |
| 2026-10-21 | 设计-架构集成契约冻结：① 协同配色算法改 fnv1a32(userId) % 8（clientId 取模禁用，已入 §11）② 只读 banner 挂应用布局根、不入 116px 常驻栈，出现时网格 calc(100vh-212px) ③ 字体经 @fontsource 本地打包 + CI 裸 hex 白名单 ④ AC-09 补三层防线断言口径 ⑤ Univer Canvas 只读主题经 tokens.ts 桥接、表头底色授权 | Phase 2 收口，设计-架构文档对齐（DESIGN.md v1.0.4 / theme-font-collab-integration.md） | §8/§9/§10/§11、docs/frontend/ 集成契约 |
| 2026-10-21 | **用户对抗式审查修订（P0 四条 + P1 六条）**：① §10 新增快照体积条款（gzip 口径，数值待架构师实测回填）② 快照归属权改「仅服务端从 Yjs doc 物化」，客户端端点降级为触发快照点（§5 对应行）③ yjs_updates (file_id,seq) 改唯一索引 + MVP 协同服务单写者约束（§6/§10）④ file_snapshots 增加 base_seq 水位列，物化与记水位同事务，加载协议 = snapshot@base_seq + seq>base_seq 增量（§5/§6）⑤ AC-11 改会话级/文件级事件留痕，协同明细由 yjs_updates.created_by 承担 ⑥ 认证改 PBKDF2-HMAC-SM3（≥10 万轮，§4）⑦ AC-05 补硬件基线与帧率阈值（两档机型，数值待回填）⑧ License 指纹多源加权+换绑流程（docs/license/design.md）⑨ 公式 50 函数白名单显式清单，volatile 函数排除或静态化（docs/formula/function-whitelist.md）⑩ 导入与活跃协同互斥协议（导入回写前物化+广播 doc-rebuild） | 用户审查发现协同持久化链路 4 个 P0 缺陷（spike 未覆盖落库恢复），修法经用户裁决 | §4/§5/§6/§9/§10、openapi.yaml、schema.md、ADR-001、新增 docs/license、docs/formula |
| 2026-10-21 | **Spec 主体同步修订（复审打回项 1）**：§2/§4/§5/§6/§9 AC-01 与新契约全面对齐——快照端点改触发语义（无请求体）、GET 含 baseSeq+gzip、users/files/file_snapshots/yjs_updates/licenses 表字段与索引同步（bytea/base_seq/唯一索引/PBKDF2/License 新列）、AC-01 改 PBKDF2 断言口径、协同行改「spike 已验证」；licenses 索引改「active 唯一性应用层校验」（同步架构师 license/design.md 换绑修复，见下一条） | 用户复审发现 Spec 主体未同步（此前变更记录声称已改实未改），文档纪律整改 | §2/§4/§5/§6/§9 |
| 2026-10-21 | **复审打回项 2/3/4/5 修复**：license/design.md 换绑唯一索引冲突修复（active 唯一性改应用层校验）+ 部署盐表述降级；function-whitelist.md 计数口径统一（附规范化数组清单作为 whitelist.ts 唯一生成源）；size-probe.mjs 补 A.2 全中文场景 + 修正头注释；schema.md 3.7 实体代码块并入 fingerprint_items/rebind_count 两列 | 用户复审发现 2 处逻辑缺陷 + 2 处可复现性缺口 | docs/license、docs/formula、spike、schema.md |
| 2026-10-21 | **用户第三轮审查（3 P0 + 6 P1 + 7 P2）**：① 补用户管理 5 端点（§5），禁用走 PATCH 状态机不物理删除 ② License 容器形态专用权重表（卷级盐主权重，方案②），宿主机 agent 列为增强路径（license v1.2）③ WS 安全三洞：ticket 握手替代 query token、session-invalidated 广播 + 60s 复验 + close 4411、席位=并发协同用户数（多标签去重 1 席）与 4410 脱钩 ④ 公式白名单改「场景必备集 80-120」（PM 定名单）；导入白名单外公式保留公式文本+缓存值+提示，禁静默转文本 ⑤ 快照物化改节流（30min/500 updates/显式保存点）⑥ 服务端重算改增量脏区 + 资源预算（活跃 doc 上限、close 4412）⑦ AC-04 引用 AC-05 口径表 ⑧ CSV 编码探测（BOM+jschardet+GB18030 回退）⑨ 达梦 PoC 补 ORM 实跑+information_schema 反查 ⑩ Redis 移出 MVP 运行时（CollabBus 进程内封装，ADR-004 时引入）⑪ salt 单一事实源=格式串，独立列删除 ⑫ Node 官方二进制锚定 + sm3 启动断言；等保配套五项与浏览器普查登记 OPEN | 用户以信创交付四硬事实（环境可信/合规可过/现场可激活/断网可用）为基准的第三轮审查 | §2/§4/§5/§6/§9/§10、openapi、schema、license、ADR-001、whitelist、dameng-poc、import-export |
| 2026-10-21 | **外部评审 Q1（分支 A 数据丢失窗口）修订**：① §10 显式 RPO 口径——增量 write-through（先提交后广播），group-commit 攒批上界 ≤1s/≤50 条即 kill -9 RPO 上界，SIGTERM 优雅关闭 RPO=0（drain 预算 ≤30s，不强制物化）；澄清 30min/500 条是物化节流参数而非数据丢失窗口 ② §10 新增优雅关闭序列 + seq 分配/席位计量/协同广播三组件可替换接口硬约束（MVP 默认进程内实现，ADR-004 演进只换实现不换调用方）③ §9 新增 AC-15（崩溃恢复 EARS：优雅关闭时序 + kill -9 零丢失 + 先持久化后传播断言，含自动化测试口径）④ schema.md 3.5 补 seq 号段批量预分配 + 攒批上界约束（v1.5）⑤ ADR-001 v1.3 增补持久化时序与 RPO 口径 ⑥ openapi x-websocket server-responsibilities 补 UPDATE 落库时序与优雅关闭语义 ⑦ OPEN-DECISIONS 新增条目就地 RESOLVED（可替换接口升格为 Phase 3 硬约束）。小改口径：不加端点、不加表、不改核心流程，不打回 Phase 0 | 外部评审 Q1：30 分钟数据丢失窗口质询（评审人混淆物化节流与增量落库节奏；RPO 从未显式写出的批评成立）；team-lead 事实核查 + 架构师裁决（裁决：pass） | §9 AC-15、§10、§13；schema.md v1.5、ADR-001 v1.3、openapi x-websocket、OPEN-DECISIONS |
| 2026-10-21 | **外部评审 Q2（分支 B 引擎能力边界）修订**：① §10 导入公式策略行改判——白名单外公式剥 f 进「公式档案侧车」（snapshot resources 载体，Univer 官方快照结构，非 custom 字段），导出还原 f；原「v+f 并存冻结值」策略被探针证伪（无数据模型载体 + 缓存值被重算覆盖 + #NAME? 级联污染下游白名单公式）② §10 服务端重算行实证补强——无头触发 API `set-trigger-formula-calculation-start`（forceCalculation/dirtyRanges）可用，重算 10ms 去抖异步，服务端读值须等完成信号；ADR-001 Decision 4（服务端权威重算）成立不降级；评审人「无头不触发重算」系同步读回时序假象 ③ import-export/plan.md：WI-3 验收改带反例的突变测试（原断言构造性恒真、鉴别力为零）；WI-5 载体条款全量改写（档案生命周期五规则）；已知坑新增重算时序/覆盖/级联三条；WI-3/WI-5 开工前置 formula-runtime-spike 门禁 ④ function-whitelist.md v1.3：§3 载体改判、§1.2 静态化落点修正、§5 范例 IRR（白名单内，举例失实）换 OFFSET/INDIRECT/AGGREGATE（引擎已实现、白名单未收录）⑤ ADR-001 v1.4：服务端重算实证缺口登记 + 无头重算时序约束 ⑥ OPEN-DECISIONS：载体裁决 RESOLVED + 运行时双向 spike OPEN ⑦ 新增 scripts/check_formula_whitelist.py CI 门禁（119 ⊆ 542 子集断言，评审人提取法固化）。**变更分类：小改**——不加端点、不加表、不加列（档案走 snapshot resources 既有 JSON 结构）、不改核心流程；依据 §13 变更流程「列/元数据级 = 小改走变更记录」口径，snapshot 内嵌 resources 属快照元数据，未触 schema | 外部评审 Q2：四条硬事实（team-lead 全部机器复现属实）+ 两个判定（WI-3 恒真断言、WI-5 无载体）+ 载体方案建议；架构师 runtime-calc-probe 14/14 断言实证（时序假象裁决 + 级联行为裁决 + 重算 API 裁决） | §10、§13；import-export/plan.md v1.3、function-whitelist.md v1.3、ADR-001 v1.4、OPEN-DECISIONS、spike/、scripts/ |
| 2026-10-21 | **外部评审 Q3（分支 C 档案坐标错位 + 白名单边界）修订**：① §10 导入公式策略行增补错位防线——档案条目补存 v、六类结构操作同步迁移档案键（结构 mutation 拦截 + Y.Doc 单事务 + undo/redo 反向 + 双通道生效顺序定死）、导出还原前置值校验（迁移为主校验为兜底），静默写错格被结构性排除（spike archive-migration-probe 13/13 实证）② import-export/plan.md v1.4：WI-5 锁定规则扩至十一条（补 v/迁移/顺序/校验四条硬规则）、验收表新增结构操作族六用例（含评审人陷阱用例「插入后不撤销即导出」与迁移器失效反例）、已知坑新增三条（错位机理/undo 触发 remove-rows 复数 mutation/无头 undo 须 focusUnit）、总量 12→13.5 人日 ③ function-whitelist.md v1.4：§3.1 三桶技术定义（桶 I 421/桶 II 引擎未实现/桶 III 冻结 6）+ §3.2 桶 I 与白名单技术等价性论证（五环同构，残余差异仅 QA 覆盖面——桶 I「允许计算」技术上无阻塞，政策归 PM 登记 OPEN）④ 新增 scripts/check_formula_buckets.py CI 门禁（G6 volatile 锚点 FORCED_RECALCULATION_FUNCTION_NAME 提取/G7 F3 冻结集与静态化名单零漂移/G8 桶 I 定数 421）⑤ ADR-001 v1.5：档案生命周期六规则（迁移与回放抑制）⑥ OPEN-DECISIONS：错位 P0 RESOLVED + 桶 I 政策 OPEN。**变更分类：小改**——不加端点、不加表、不加列（迁移器为应用层拦截器，档案仍在 resources 既有 JSON 内）、不改核心流程；排期增 1.5 人日属工作项内估计修正，不打回 Phase 0 | 外部评审 Q3：档案坐标错位（插行后档案键不动、导出写错格、AC-07/AC-08 双破、与 OFFSET/INDIRECT 排除理由撞车）+ 白名单是政策边界非引擎边界（542 实现中 423 名单外）；team-lead 已机器复现属实；架构师 archive-migration-probe 13/13 + check_formula_buckets G6-G8 实证 | §10、§13；import-export/plan.md v1.4、function-whitelist.md v1.4、ADR-001 v1.5、OPEN-DECISIONS、spike/、scripts/ |
| 2026-10-21 | **PM 桶 I 裁决落地（方案 b：引擎可用区差分导入）**：① §10 导入公式策略行改写为分域处理——引擎可用区（E = I − W − X，393 个，严格提取法：v1 宽松 542 含 26 伪影——arabicToRomanMap 罗马数字数据表/CONVERT 单位表，提取法修正为注册表条目形态）走差分导入（重算值 vs 缓存值一致保留 f 同权、不一致自动降级冻结）；桶 II/III/差分降级格维持方案 C；白名单内 volatile 函数导入路径静态化（值取 xlsx 缓存值，防双端加载时刻发散——ADR-001 §1.1 机理）；提示条文案换 PM 定稿、触发范围 = 冻结格+降级格合计 ② function-whitelist.md v1.5：§1.2 导入静态化补遗、§3.1 桶 I 改判引擎可用区 + 排除集 X 8 个实证依据（G9 非确定性源扫描：Math.random 6 处/new Date 2 处全落 X 内）、§3.3 差分导入规则七条（判定顺序/容差/同权/降级/多函数格级/万格上限）、§5 用例更新 ③ import-export/plan.md v1.5：WI-5 规则 12 差分导入 + 验收用例五条（新 fixture usable-zone-diff.xlsx）+ 排期 13.5→16 人日（差分管线 2 + 桶判定器 0.5）④ check_formula_buckets.py v2：G9 非确定性源扫描 + G6b/G7b/G8b 引擎可用区减法断言（393 定数、X 8 个、与 W 零重叠）⑤ OPEN-DECISIONS 桶 I 条目 RESOLVED（PM 方案 b）。**变更分类：小改上限边界内（口径分层扩大导入管线复杂度）**——不加端点、不加表、不加列、页面影响编辑器+文件详情两处、用户主流程不变；但导入管线内部行为分层（判定器+差分管线+降级路径）已显著扩大，PM 判「中改（涉及导入管线）」与 §13 四条标准形式上小改并存，如实记录不打回 Phase 0 | PM 桶 I 政策裁决（2026-10-21 定稿）+ 架构师排除集实证（非确定性源扫描/提取法伪影修正）+ check_formula_buckets.py v2 实跑 ALL PASS | §10、§13；function-whitelist.md v1.5、import-export/plan.md v1.5、scripts/check_formula_buckets.py v2、OPEN-DECISIONS |
| 2026-10-21 | **外部评审分支 D（License 指纹）修订**（team-lead 代 PM 裁决路线，PM 复核待限额恢复）：① 路线裁 A——License 定位「授权计量与合规凭证」不承诺防拷贝；容器「拷卷即过」显式承认（卷级盐唯一关键项随卷复制），席位并发兜底对跨实例克隆结构性失效并**废止**（license/design.md §2.1-c）；B 宿主 agent 性价比为负否决（鲲鹏+麒麟双架构 systemd 四象限维护成本），C 并入 A 配套③ ② §10 运行时行改三级国密启动断言（sm3/SM2 曲线/自签自验真跑，gm-crypto-probe.mjs 5/5 实证收编固化；G4 sm4/G5 PBKDF2 进 CI 不进启动）③ §10 新增 License 防拷贝定位行（商务强制披露/时钟回拨检测 max_seen_at/过期宽限 7 天/换绑统一 2 次·vMotion 不消耗）④ license/design.md v1.4：§2.4 时钟三层机制（回拨告警不误杀/前跳宽限/防续期）、§2.5 断言三级、§6-bis 商务披露（允许写/禁止写/标准应答句）+ §5 验收 +4 条 ⑤ schema.md v1.6：licenses 加 max_seen_at 列。**变更分类：小改**（加列不加表不加端点，10 表边界不变） | 外部评审分支 D：gm-crypto-probe 5/5（team-lead 复跑）+ 拷卷推理链（design.md 条款逐条属实）+ 时钟零覆盖 + 换绑额度质疑 | §10 运行时行/License 定位行、§13；license/design.md v1.4、schema.md v1.6、scripts/gm-crypto-probe.mjs、OPEN-DECISIONS |
| 2026-10-21 | **外部评审分支 E（性能红线）修订**：① §9 AC-04/AC-05 拆档——AC-04 只断公式正确性，移除内嵌性能数字；AC-05 新增「性能档位明细」表（L0 交互实时档 <200ms / L1 万行实时档 <500ms / L2 全量重算 ≤10s 异步 / L2b 坏编辑退化为近全表同 L2）区分全表 forceCalculation 与编辑→增量脏区重算收敛——原「全表 <200ms」在 100 万格/99,828 公式档被击穿约 20 倍（实测 5,474/5,422ms），根因为非实时场景塞进实时档的口径错误 ② §10 资源预算行改写——序列化体积只作落库存储、不作运行时内存预算（以 100 万格实测 heap 1.4GB+ 为基准，非序列化 22MB）；部署改内存总量预算 + LRU 驱逐（单 doc ≈200MB + 1.5KB/格 RSS 口径），close 4412 改内存水位触发；**规模红线裁决：单 sheet 上限维持 100 万格，不向竞品 1000 万格对齐**（1000 万格单 doc ≈14GB 击穿 16GB 部署预算；1000 万格属容量红线非交互红线，登记 P1 随 Worker/分片再评估）③ §10 新增重算线程归属行——MVP 主线程增量脏区重算 + 异步 + 进度提示；Worker 为 P1 终态（@univerjs/rpc WebWorkerRemoteInstanceService 源码已核实——官方整表引擎态同步语义致内存翻倍，MVP 不实装）；新增 CalcDispatcher 可替换接口硬约束 ④ ADR-001 v1.7：资源预算模型修正 + Worker 裁决 + 四档时延表 ⑤ OPEN-DECISIONS：分支 E RESOLVED ⑥ formula-runtime-spike TASK.md 追加密闭探针 B11/B12（单格依赖子图增量重算时延 vs 全表 / 高入度根格回退 L2b 定量阈值）。**变更分类：小改**——不加端点、不加表、不加列；性能断言分层不影响用户功能路径；排期不增（CalcDispatcher 接口占位是既有组件封装的自然延伸） | 外部评审分支 E：三硬事实全部成立（team-lead 机器复现：首编重算 5,474ms / heap 1.4GB 非序列化 22MB / 同步无头触发 5s+ 白屏）；三个数量级冲突均为文档层面口径分裂或模型错误非引擎能力缺陷；架构师查证 @univerjs/rpc 1.0.2 lib/ 源码裁决 | §9 AC-04/AC-05、§9 性能档位明细、§10 资源预算行/重算线程行、§13；ADR-001 v1.7、OPEN-DECISIONS、formula-runtime-spike TASK.md |
| 2026-10-21 | **外部评审分支 F（国产库真机验证）修订**：① §10 新增「国产库真机验证锚点」行——金仓验证分两层：Phase 3 M1 脚手架期契约冒烟（10 表 DDL + repository CRUD + information_schema 反查 + 敏感点断言）+ Phase 4 全量回归（既有承诺不变）；冒烟失败触发契约回溯流程（schema → Spec §6 → openapi → ADR-002）；金仓进 CI 否决（license 人工获取不满足自动化前提）② schema.md v1.7 新增 §7：三层验证状态 + 冒烟断言五条 + TypeORM 0.3.27 version() 解析静态核对（金仓串整串入 driver.version、isGeneratedColumnsSupported 误判 false 但零消费方零影响、无需补丁）+ 环境获取路径责任方 + CI 否决论证 ③ dameng-poc-plan.md：dmdb v1.0.52452 纯 JS 实证写入 §2（原 node-gyp 顾虑关闭，§6 风险表同步降级）+ 头部排序裁决（金仓先行、达梦随后，共用环境获取窗口）④ OPEN-DECISIONS：金仓 CI 替代条目升格（M1 冒烟锚点 + license 申请 action）+ 达梦 PoC 条目更新（排序与实证补强）+ 新增 TypeORM 自动 RETURNING 待真机验证条目。**变更分类：小改**——不加端点、不加表、不加列、不改主流程；验证排期前移属工程纪律修正（「冻结契约未在目标库验证」顺序倒置被评审人指出成立），M1 冒烟约 1 人日从 M1 脚手架预算内吸收 | 外部评审分支 F：评审人质询「金仓真机验证放在哪」+ team-lead 事实核查（本机无 Docker、金仓镜像三路获取全超时/404；dmdb npm 实查纯 JS）；架构师源码核对 typeorm@0.3.27 | §10、§13；schema.md v1.7、dameng-poc-plan.md、OPEN-DECISIONS、ADR-002 |
| 2026-10-22 | **P3-002 公式运行时 spike 数值回填（L0/L1 边界修订，AC-05 档位表 v1.1）**：① 档位规模边界**主轴由格数改为公式格数**——B11a 拐点曲线实证（E1，calc-latency-curve.mjs，4 档 × 3 轮中位 89/258/596/1175ms 对应 5k/10k/20k/50k 公式）单格增量重算时延由全文档公式总数线性驱动（~24ms/千公式），机理 = FormulaDependencyGenerator 每轮全表重建依赖树（progress 证实各档均只重算 10 个公式，脏区识别增量、时延非增量）② **L0 公式边界 2 万→5 千**（200ms 阈值保持；5 千档实测 P95≈160ms，1.25 倍余量）③ **L1 公式边界收紧至 1 万**（500ms 阈值保持；实测 P95≈274ms，1.8 倍余量）④ **新增 L1b 公式密集档**（1 万~2 万公式，行为承诺不设毫秒值；2 万档实测 P95≈895ms，500/800ms 数字承诺均不成立）⑤ 越界降级规则：公式 >2 万按 L2b 行为承诺 + WI-3 导入提示拆分；引擎依赖图缓存登记 P1 ⑥ §10 性能目标行同步（口径主轴变更）。**变更分类：小改**——不加端点、不加表、不改核心流程；对外口径 promise-tiering.md 同步修订（档 1/档 2 承诺补公式密度前提）。**注：本次修订由 team-lead 代行裁定落盘（架构师派发两次被会话中断零落盘），依据与候选方向按其原始任务书执行，标注待架构师复核** | P3-002 formula-runtime-spike REPORT §4.2/§4.3（B11/B12 主探针 + B11a 拐点曲线补测）；OPEN-DECISIONS 2026-10-22「L0/L1 档位边界不自洽」条目收口 | §9 AC-05 档位明细（v1.1）、§10 性能目标行、§13；ADR-001 v1.8、promise-tiering.md、OPEN-DECISIONS |
| 2026-10-23 | **AC-09 措辞统一（架构师裁决，OPEN-DECISIONS 第 63 条收口依据）**：AC-09 的 WS 侧出口按触发分域改写——License 无效/过期 → 新编辑首连 close 4409；超席 → 新编辑连接降级 view 角色且连接存活、ROLE_UPGRADE 满席回 reject 帧，**无 close 码**。裁决理由：§10「超席时新编辑请求降级只读（不拒入）」是 PM/商务已备案的行为定死口径，不可改行为迎合验收措辞；原 AC-09 字面把「超席」与「WS close 4409」并列，会使 QA 对超席项判 FAIL。分域结论（D1-05 v1.2 立、D1-08 v1.1 执行）升格为权威口径 | 架构师裁决（2026-10-23，用户授权「下一轮开发任务开始前解答」）；D1-05/D1-08/D1-10 分域结论不变 | §9 AC-09；D1-05 v1.3、D1-09 v1.3、D1-10 v1.3 同步标注；QA 断言（P3-135-08，经 D1-10 V-4EXIT 分解）按新措辞执行，D1-12 V-EARS 逐字比对自动跟随 |
| 2026-10-24 | **§10 运行时行 G3 措辞诚实化传导（勘误级，无行为变更）**：「G3 SM2 自签自验真跑一次」改为「G3 固定 fixture 验签——自洽断言（fixture 系本仓签发 CLI 产出的自签向量，证四口径未漂移与篡改必拒，互通性由探针 G8 独家承担）」。原措辞系第三轮挑刺 P0-1 定性为假阳性来源的废弃口径（Node 原生自签自验恒过、与 GM/T 不互通）；第五/六轮诚实化裁决（OPEN-DECISIONS 2026-10-23 Q1 条）只传导了 D1-11/D1-10 卡面与探针头注释，本行系漏网活载体（条 J B2 前置实读 #45 G-2 查出）。**变更分类：勘误**——探针/启动断言的实际行为早已是 fixture 验签，仅文档措辞对齐已裁决口径 | 第五轮审核 P1-1b + 第六轮 D1-11 v1.4 诚实化裁决（口径在案，本次为传导执行）；条 J 实读 #45 G-2 | §10 运行时行、§13；D1-11 v1.5、REVIEW-CLOSING 档二、DESIGN-LAYER §3.2 D1-11 条 2、license/design.md §2.5 同批传导 |
| 2026-10-22 | **P3-001 工程化基线评审（7 项缺口裁决落盘）**：① §4 技术栈表补全 19 行——包管理器 **pnpm 11.28.6（`latest-11` 稳定通道；11.28.7 属 `next-11` 通道，交付不取。两版 bin 同为 Node 脚本、optionalDependencies 同为 0、无原生差异，仅 `packageManager` 一处不同）**（否决 Rust 重写的 pnpm 12.14.0：bin shim 找不到二进制即 downloads one、14 个 `@pnpm/exe.*` 原生包 / npm / Yarn Berry）；**pnpm 11 配置模型变更：非「注册源/认证」设置一律迁 `pnpm-workspace.yaml`（`.npmrc` 只留 registry 与 token），`onlyBuiltDependencies` 已由 `allowBuilds` 取代，`autoInstallPeers` 必须 false**（否则 @nestjs/swagger peer 会把 class-validator/class-transformer 静默装回，击穿 zod 单一 schema 源）、monorepo 编排用 pnpm workspace 内置（否决 turbo/Nx）、Vite 7.3.7 + plugin-react 5.2.0（否决 Vite 8：rolldown + lightningcss MPL-2.0 无 JS fallback）、Tailwind 3.4.19（**否决 v4：官方下限 Chrome 111 击穿 §10 的 Chromium 100+**）、组件策略「自研外壳原子 + Radix 无样式行为原语」（否决 antd/Semi/Arco 的第二图标源；否决 Mantine 9.7.3 的 react `^19.2.0` peer）、react-hook-form 7.90.0 + zod 4.6.7 单一 schema 源、Vitest 5.0.5（前端）/ Jest 30.5.2 + ts-jest（后端）、Playwright 1.64.1、@nestjs/swagger 11.4.7 降级为校验源、TypeScript 写死 5.9.3、ESLint 9.39.5 flat config + Prettier 3.9.10、P0 规则工具层落点 ② **§4 运行时行改 Node 精确锚 22.22.2**（`.nvmrc` + `engine-strict=true`；jsdom 30.1.3 的 engines 精确卡 `^22.22.2`，回退位 29.0.0）③ **§4 图标行补红线边界**：红线只约束自研代码，Univer 引擎内置 `@univerjs/icons` 属第三方渲染产物不在红线内，但自研组件禁止 import ④ §4 新增 Tailwind 与 Univer 的样式隔离硬约束（**preflight 必须关闭**；本机实测 Univer 1.0.2 三份 CSS 共 1738 条规则，裸元素选择器仅 2 条 `*`，无 html/body 重置，box-sizing 只在类选择器上，确有 4 条 `>ul:not(:last-child)` 菜单规则——全局 reset 会在盒模型/表单 padding/ul 菜单三处对撞）⑤ 新增 ADR-005（pnpm 11）/ ADR-006（Tailwind 3.4）/ ADR-007（自研原子组件）；OPEN-DECISIONS「工程化基线 7 项缺口」条目就地关闭。⑥ **配置口径一并按 pnpm 11 模型纠正**：`pnpm-workspace.yaml` 承载 `nodeLinker=isolated` / `saveExact=true` / `autoInstallPeers=false` / `strictDepBuilds=true` / `engineStrict=true` / `pmOnFail=error` / `allowBuilds={esbuild:true,'@scarf/scarf':false}` / `minimumReleaseAge: 1440`；`.npmrc` 不提交 registry 行（交付期由 `PNPM_CONFIG_REGISTRY` 注入）。**变更分类：小改**——不加端点、不加表、不加列、不改核心用户流程；仅锁定此前为零命中的外围工程化依赖与工具链。**注：⑤⑥⑦ 初版由 team-lead 代行裁定落盘（架构师正文未送达），后架构师终审正文到达并作三处实质修订——pnpm 版本由 11.28.7 改 11.28.6（稳定通道）、纠正 team-lead 误按 pnpm 10 写的配置模型（`.npmrc` 全设置项在 pnpm 11 已不生效）、Tailwind 否决 v4 的理由改为主次分明（决定性理由 = 浏览器下限击穿；「氧化物原生不可得」论据已作废不再作为理由）；ADR-005 已重写为 v2 撤销代行注记**；①②③④ 为前端/后端专家产出并经 team-lead 独立复验版本矩阵 | P3-001 评审会：前端实测（Univer CSS 1738 规则 / Radix 版本 / zod 4.6.7 三个静默坑 / Tailwind v4 浏览器下限）+ 后端实测（@nestjs/swagger peer 演进 / swagger-ui-dist 外链 / zod toJSONSchema openapi-3.0 target）+ team-lead 独立复验（registry 实测 pnpm 11.28.6/11.28.7 双通道与 12.14.0 的 optDeps 对比、vite 7.3.7、jsdom 29/30 engines、eslint 9.39.5、typescript-eslint peer、@mantine/react ^19.2.0、nestjs-zod peer、verdaccio 6.10.6）+ 架构师终审（pnpm 11 配置模型纠正、11.28.6 通道裁定、Tailwind 否决理由主次重排）+ 本机 Univer CSS 解析复核 | §4（技术栈表 + 运行时行 + 图标行 + 样式隔离约束）、§13；docs/design/DESIGN.md 新增「组件来源与工程化基线」章节、docs/decisions/ADR-005·006·007、docs/phase3/P3-001-工程化基线裁决记录.md、OPEN-DECISIONS |
| 2026-10-22 | **openapi.yaml 放行窗口（P3-001 裁决产生的 8 项契约改动，用户裁「全部一次放行」并已落盘）**：① x-error-code-registry 新增 **7xxx 段**——7001 请求体/参数校验失败、7002 查询参数越界、7003 JSON·multipart 非法、7004 路径参数格式非法（**均 → HTTP 400**；不用 0xxx 是因 `Error.code` 为 integer，0001 会被序列化成 1）② 新增 `components.responses.BadRequest`（400 + code 7001 + `detail.errors[]` + `X-Request-Id` 头）并挂到 **18 个**带 requestBody/query/path 参数的操作上；logout / POST snapshot / license activate-request / license status / ws ticket 无参可校，正确排除 ③ 9 个 Request schema 补 `additionalProperties: false`（与 zod `.strict()` 配套；原「契约允许、运行时拒绝」的口径分裂被消除）④ 6003（SSO 配置校验失败）的 `detail` 由 `{ field: url }` 对齐为 `{ errors: [{field,rule,message}] }`⑤ Error 组件补 detail 形态声明（`x-detail-variants`），新增 `ValidationErrorDetail` / `ValidationErrorItem` 两个 schema 使 7xxx 结构可机检；9001 的 `detail` 固定为 `{ requestId }`⑥ info.description 补「**本文件为 API 契约唯一事实源**，装饰器产物从属，改动须先改本文件再同步代码并经 G1 contract-diff」⑦ **孤儿 schema `SnapshotSaveRequest` 删除**（契约已写明不得接受客户端快照上传；保留会误导实现期照它写 DTO）⑧ Unauthorized/Forbidden/NotFound/BadRequest 四个共享响应均带 `X-Request-Id`。机器复核：YAML 解析通过、孤儿 schema 0、悬空 `$ref` 0、孤儿 response 0。**变更分类：小改**——全部为新增/补充/删除孤儿定义，**不改现有端点语义**；7xxx 是「新增码段」非「改码义」。前端区间兜底条款（`7000<=code<8000` + 9001 兜底）随放行作废，改按逐码实现 | 用户裁决「全部 8 项一次放行」（P3-001 裁决记录 §4）；不放行第 1 项的后果是校验失败只能用 9001 兜底 = 把 400 静默升成 500，违反「无裸 500、无静默吞错」 | openapi.yaml（7xxx 段 / BadRequest / 9 个 Request schema / Error / info / 删除 SnapshotSaveRequest）；P3-001 裁决记录 §4、OPEN-DECISIONS（7xxx 与孤儿 schema 两条 RESOLVED）、REVIEW-INDEX |
