# web-office

浏览器里跑的电子表格。当前阶段是**验证版**：用最小可演示的增量，逐个证伪或证实几条关键假设，而不是先堆功能。

## 现在能做什么

| 能力                                           | 状态      | 证据                                   |
| ---------------------------------------------- | --------- | -------------------------------------- |
| 打开页面出一张可编辑的表                       | ✅        | `docs/phase3/evidence/v1-closeout.mp4` |
| 改 A1，A3 的 `=SUM(A1:A2)` 当场重算            | ✅        | 同上（1→5，A3 由 3 变 7，126ms）       |
| 合并单元格 / 加粗底色 / 货币格式共存           | ✅        | `docs/phase3/tasks/V1.3.1.md`          |
| 空单元格、文本、跨合并区参与 SUM 与 Excel 一致 | ✅        | `docs/phase3/tasks/V1.3.2.md`          |
| `DataSource` 接口（`load/save/subscribe`）定稿 | ✅        | `docs/phase3/tasks/V2.1.md`            |
| 关掉浏览器再打开内容还在                       | ⬜ 进行中 | V2.2 / V2.3                            |

## 技术栈

React 18.3 + Vite 7 + TypeScript 5.9，表格引擎 [Univer](https://github.com/dream-num/univer) 1.2.0，pnpm workspace。

```
apps/web          前端 SPA（Univer 挂载、装配、数据源）
apps/server       后端（V3 起才用）
packages/shared   DTO / zod schema / 错误码 / 纯函数 / DataSource 接口
packages/config   ESLint 规则与 TS 预设
```

依赖方向是硬约束：`packages/*` 不得依赖 `apps/*`；`@wo/shared` 只允许 `zod` 与 `sm-crypto` 两个运行时依赖，且内部不得引用 React / Nest / Univer / Yjs（**连 `import type` 也不行**）。这些规则不靠自觉遵守，而是 `verify` 的检查段，违反即非零退出。

## 跑起来

```bash
pnpm install
pnpm --filter @wo/web dev      # http://127.0.0.1:5173
```

## 门禁

没有 CI 服务器，`verify` 就是 CI——一条命令跑 14 段：格式、lint、三处类型检查、规则自测、依赖面 A~J、模块图、端点分组、契约命名、错误码漂移、文档纪律、openapi 契约。

```bash
pnpm verify
```

**14/14 绿才提交**，这是硬规则。

浏览器里的行为无法靠编译证明（canvas 画的表格，DOM 断言看不见），所以另有一条探针，用 CDP 连真实 Edge 截图并取值：

```bash
node scripts/probe-web.mjs --assert=A1=1,A2=2,A3=3 --formats --boundaries --data-source
```

## 文档在哪

- `docs/phase3/ROADMAP.md` — 版本 / 需求 / 任务三层推进表，日常唯一要看的那张
- `docs/phase3/tasks/` — 每个任务的判据、实测与欠账（含踩过的坑）
- `docs/phase3/evidence/` — 收口录屏与关键帧

任务卡的写法是「先定判据，再写代码」，且要求判据能证伪——一个永远为真的断言不算判据。

## 已知欠账

- 前端主包 6.7MB / gzip 1.8MB，未做分包（V5）
- 路由化、多文档切换的实例销毁时机尚未接（V2 / V3）
- 生产环境未部署，仅本机验证
