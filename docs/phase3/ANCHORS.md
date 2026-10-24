# 包级锚点台账（产出物路径 / 检查命令 / 通过判据）

> 版本：**v1.7**（2026-10-24 补 P3-011-01/-02 执行记录；v1.5 补 §3「P3-011 六包派发锚点」｜2026-10-22 起用；v1.1 补「接口签名表」；v1.2 补依赖/版本控制纪律两条、自检升六段；v1.3 补登记/编辑纪律两条；v1.4（2026-10-24）P3-010-03 落地 + `-04~11` 归并收口登记 + 类型段拆三 project）｜ 依据 `TASKS.md` §4bis 派单四件套：每包必须带**锚点三项**，同段内不得重叠。
>
> 为什么单独成表：锚点三项原先只写在包级验收断言里（「本包须填锚点三项」），但**没有载体**——填在哪、谁来核，都没定义。本表就是那个载体：一包一行，写死路径与可复制执行的命令。
>
> 填表规则：① 只填**已交付**的包，不预填未做的包（预填的锚点等于没写，因为没人验证过）；② 检查命令必须能直接复制执行、exit=0 即过；③ 同一段内多包的锚点路径不得重叠——重叠即视为拆分不成立，退回重拆。

## 0. 执行环境（本机）

本机 `pnpm` 的 PATH shim 由 corepack 提供，绑定的 Node 版本随 nvm 当前指针漂移（实测先后解析到 Node 16 / 20），一旦不是被 corepack 认可的那支就报 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`。**这不是代码问题，是 shim 问题**——所以自检入口绕开 pnpm：

```
node scripts/verify.mjs      # 逐段 PASS/FAIL + 耗时，exit=0 即过（段数随批次增删，以末行「N/M 段通过」为准）
```

`pnpm verify` 只是它的别名（`scripts.verify = node scripts/verify.mjs`）。装依赖仍需 pnpm，可用显式入口：

```
N22="C:/Users/user3667/.workbuddy/binaries/node/versions/22.22.2-6/node.exe"
PN="C:/Program Files/nodejs/node_modules/corepack/dist/pnpm.js"
"$N22" "$PN" install
```

**为什么要多写一个 `verify.mjs`**：`a && b && c` 式的长串只在第一个失败处停，看不到「哪些段其实过了」；而 pnpm shim 崩掉时会伪装成「代码红了」。`verify.mjs` 用 `spawnSync(process.execPath, …)` 直连各工具的 JS 入口，与 pnpm/PATH 解耦，失败时还会把该段输出打出来。

**两条依赖 / 版本控制纪律**（2026-10-22 从交接件回填，此前无正式载体）：

1. `pnpm-lock.yaml` 是依赖的**唯一真相**：加依赖必须同时更新 lock，版本精确（`saveExact` 已开）；验收跑 `install --frozen-lockfile` 才算数。
2. `.gitignore` 对**已暂存**文件不生效：把已入库路径移出版本控制必须 `git rm -r --cached <path>`，只改 `.gitignore` 不生效（`.workbuddy/trash/` 踩过这一步）。

**两条登记 / 编辑纪律**（2026-10-22 从交接件回填，此前无正式载体）：

3. REVIEW-INDEX / OPEN-DECISIONS / 日志的**长表格行追加或锚点替换一律用 python 按行检测操作，不用 Edit 长串匹配**——Edit 工具对含表格线与全角字符的长行匹配不稳定（2026-10-22 实测失败两次，含 D1-06 卡表格行）。
4. **门禁三连**（每轮收口即跑，缺一不可）：`node scripts/verify.mjs`（**十段自检**，2026-10-24 条 Q ③ + 条 S① 代码批起已含 openapi 契约门禁与文档纪律段，`check_openapi_contract.py` 不再需要单独跑；同日后半段 P3-010-03 把类型段由 1 段拆为 shared/server/web 3 段 → 8→10 段）→ `python -X utf8 scripts/gen_status_panel.py`（面板刷新 + 三口径校验带）。两条全 exit=0 才算收口；面板生成器若被 Security Center 拦截转用户侧实跑（R-6 口径不变）。

## 1. 接口签名表（P3-010 的「签名」，下游按此引用）

| 符号 | 位置 | 签名 / 形态 | 消费方 |
|---|---|---|---|
| `woPreset` | `packages/config/eslint-preset.js` | `woPreset({ typeAware?: boolean, withReact?: boolean, tsconfigRootDir?: string }) => LintConfig[]` | 根 `eslint.config.mjs`；后续 apps/* 若需独立 config 也复用 |
| `BANNED_ICON_SOURCES` | 同上 | `readonly string[]`（10 个第二图标源） | `scripts/check-workspace-deps.mjs` 同源维护 |
| `woPlugin` / `WO_RULE_NAMES` | `packages/config/rules/index.js` | `{ meta, rules }` / `['no-emoji','no-hardcoded-color']` | preset；新增规则必须同步登记 |
| tsconfig 三段 | `packages/config/tsconfig.{base,web,server}.json` | base＝ES2023 strict 全开；web＝DOM+react-jsx+noEmit；server＝CommonJS+装饰器+node 类型 | `packages/shared`、后续 `apps/*` |
| `@wo/shared` 出口 | `packages/shared/package.json` | `exports["."] = { types: dist/esm/index.d.ts, import: dist/esm/index.js, require: dist/cjs/index.js }` | 前后端（ESM/CJS 各取一支） |
| `fnv1a32` | `packages/shared/src/utils/fnv1a32.ts` | `(input: string) => number`（UTF-8 字节、FNV-1a、返回 uint32） | 协同配色/光标（前后端必须同值） |

## 2. P3-010 pnpm workspace 与 TS/ESLint/Prettier 基线

段划分（本工作项 11 包，按「接口与骨架 → 主路径 → 边界与错误 → 测试与自检 → 联调与收口」切，锚点互不重叠）。**2026-10-24 用户裁决「收口」**：`-04~11`（8 包）为配置型工作项的模板化切分，无独立实体内容，已归并随 `-03` 收口（`backlog.csv` 状态 = `已归并`），实际交付 = `-01`/`-02`/`-03` 三包 + 收口动作：

| 包ID | 段 | 产出物路径 | 检查命令 | 通过判据 |
|---|---|---|---|---|
| **P3-010-01**（已完成） | 接口与骨架 1/2 | `package.json`、`pnpm-workspace.yaml`、`.npmrc`、`.nvmrc`、`.editorconfig`、`.gitignore`、`.prettierignore`、`eslint.config.mjs`、`prettier.config.js`、`packages/config/{package.json,tsconfig.base.json,tsconfig.web.json,tsconfig.server.json,eslint-preset.js,prettier.config.js}`、`packages/shared/{package.json,tsconfig.json,tsconfig.build.esm.json,tsconfig.build.cjs.json,scripts/postbuild.mjs,src/index.ts,src/utils/fnv1a32.ts}` | `pnpm install --frozen-lockfile && node scripts/verify.mjs && pnpm build` | 三条命令全 exit=0；`packages/shared/dist` 下同时存在 `esm/index.js`+`index.d.ts` 与 `cjs/index.js`，两份目录各有 `package.json` 模块类型标记；CJS 与 ESM 分别加载 `fnv1a32` 结果相同（实测 `[6543148, 956401659]`） |
| **P3-010-02**（已完成） | 接口与骨架 2/2 | `packages/config/rules/{index.js,no-emoji.js,no-hardcoded-color.js,no-emoji.test.ts,no-hardcoded-color.test.ts}`、`scripts/check-workspace-deps.mjs` | `node scripts/verify.mjs`（内含 lint / 规则测试 / 依赖面断言三段） | 全 exit=0；lint 段带 `--max-warnings=0`；每条规则 `invalid`/`valid` 段各至少 1 例；依赖面断言覆盖 A~H 八项；**反向验证已做**（见下） |
| **P3-010-03**（已完成） | 主路径 1/2 | `apps/server/{package.json,tsconfig.json,src/index.ts}`、`apps/web/{package.json,tsconfig.json,src/index.ts}`（两个骨架包，各至少一处 `import ... from "@wo/shared"`）；根 `package.json` 的 `typecheck` 脚本由「只覆盖 packages/shared」扩为 workspace 级（`pnpm -r typecheck` 或等价显式枚举） | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint` | 三条命令全 exit=0；两个 app 的 tsconfig 均继承 `packages/config` 对应段（server→server 段 / web→web 段）且对 `@wo/shared` 的模块解析无 TS2307；CJS 侧（server）与 ESM 侧（web）各加载一次 `fnv1a32` 结果一致（工作项收口断言「shared 可被前后端同时引用」的最小机读体现）；新增 apps 依赖已同步 `pnpm-lock.yaml`（frozen-lockfile 即校验）；与 -01（root+config+shared 骨架）、-02（rules+依赖面脚本）锚点不重叠 |

### P3-010-03 执行记录（2026-10-24，用户裁决「收口」后落地）

**归并裁决**：`P3-010-04~11`（8 包）在 `backlog.csv` 置为 **`已归并`** —— 配置型工作项（pnpm workspace / TS / ESLint / Prettier 基线）不存在「边界与错误分支」「该段单元测试」的实体内容，其包级交付物/断言原为生成器段级模板句，`ANCHORS` 亦从未登记其锚点。归并后 `P3-010` 的实际交付 = `-01` / `-02` / `-03` 三包 + 本收口动作。**台账口径**：`已完成包` 只数真实交付（`-03` 计入）；`已归并` 单独计数，但**在阻塞判定上与已完成等价** —— 否则 `P3-011` / `P3-030` 的 `dep: P3-010-11` 永远解不开（`gen_status_panel.py` 的 `done` 集合已按此口径实现）。

**产出物**：`apps/server/{package.json,tsconfig.json,src/index.ts}`、`apps/web/{package.json,tsconfig.json,src/index.ts}`；根 `package.json` 的 `typecheck` 改为**显式枚举三 project**（不嵌套 pnpm，沿用 §0）；`scripts/verify.mjs` 类型段由 1 段拆为 3 段（shared / server / web），与 `typecheck` 脚本逐字对应。

**两条解析口径（各带反向验证）**

| 项 | 决定 | 理由 | 反向验证 |
|---|---|---|---|
| `@wo/shared` 类型解析 | 两个 app 的 tsconfig 用 `paths` → `packages/shared/src/index.ts` | 包的 `exports.types` 指向 `dist/esm/index.d.ts`，而 `dist/` 未入库；检查命令里没有 build 步，干净 clone 上必报 TS2307 | 摘掉 `paths` 后 `tsc -p` → `error TS2307`，且 TS 自述「There are types at .../dist/esm/index.d.ts, but this result could not be resolved under your current 'moduleResolution' setting」（server 段是 Node10，不认 `exports`）；还原 → exit=0 |
| `apps/web` 的 `types` | 覆写为 `[]` | web 段内置 `types: ["vite/client"]`，而 vite 要到 P3-030 才进依赖树，保留即 `TS2688`（找不到类型定义文件） | 类型错误注入见下行 |

**实测证据（2026-10-24 20:37，HEAD `9a44d08` + 本包未提交工作区）**

- 锚点检查命令三条逐条实跑：`pnpm install --frozen-lockfile` → `Already up to date`（Scope: all 5 workspace projects）／`pnpm typecheck` → exit=0（三 project 串行）／`pnpm lint` → exit=0
- `node scripts/verify.mjs` → **10/10 段通过**（格式 / lint / tsc shared / tsc server / tsc web / RuleTester / 依赖面 A~I / 临时件 / 文档纪律 / openapi 契约）
- `pnpm install` 后 lockfile 新增 `apps/server` / `apps/web` 两个 importer，两包 `node_modules/@wo/shared` 软链到位（`check-workspace-deps.mjs` 的 I 段 A~I 断言通过）
- **双端加载同值**：CJS 侧（`apps/server` 下 `require('@wo/shared')`）解析到 `dist/cjs/index.js`，ESM 侧（`apps/web` 下 `import('@wo/shared')`）解析到 `dist/esm/index.js`，`fnv1a32('@wo/shared')` 两侧同为 **2148397571**
- **类型段非恒真**：在 `apps/web/src/__probe.ts` 写 `export const probe: number = "not-a-number";` → `tsc -p apps/web` exit=2（`TS2322`）；删除后 exit=0

### 反向验证记录（断言非恒真）

| 断言 | 破坏方式 | 结果 |
|---|---|---|
| `wo/no-hardcoded-color` | 在 `packages/shared/src/__probe.ts` 写入 `"background: #ff0000"` | `lint exit=1`，报 `硬编码色值「#ff0000」`；删除后 `exit=0` |
| `wo/no-emoji` | 规则自身在测试文件里抓到真 emoji（U+1F680/U+1F4BE 两条） | 说明规则对「源码里的真字符」有效；测试改用 `String.fromCodePoint()` 运行时构造 |
| 依赖面断言 G / D | 给 `@wo/shared` 临时加 `react-icons` 与 `lodash` | `check:deps exit=1`，报「第二图标源」+「dependencies 只允许 zod」；还原后 `exit=0` |
| 规则测试本身 | RuleTester `invalid` 段断言精确条数（2 处 emoji 必须报 2 条） | 首轮特意写错时测试确实红过，证明不是空跑 |

## 3. P3-011 NestJS 应用骨架与模块划分（六包，按实体内容切分）

**切分口径（2026-10-24 用户裁决「按建议」）**：原 7 包中 `-02`≡`-03`、`-05`≡`-06` 去掉序号后缀后逐字相同，属模板二分；收口为 **5 个实体单元 + 1 个收口包**。工时 1.0 / 1.2 / 2.0 / 1.4 / 1.4 / 1.0（和 **8.0h**，与工作项工时一致）；其中三行越 1.0~1.2h 带，已在 `scripts/gen_phase3_backlog.py` 的 `BAND_EXCEPTIONS` 显式登记理由——**再拆回带内即回到模板切分**，故登记例外而非继续劈包。

**判据基座（同轮裁定）**：端点分组以 `openapi.tags`（10 组 / 30 operation）为准，不以 Spec §5 为准——Spec §5 表**无「分组」列**，且缺 `GET /api/v1/health/ready`（该端点归 P3-016，见 §3.1 边界）。

**填表状态说明**：下表是**派发前置**锚点（`TASKS §4` 派单四件套 ② 要求随单给出锚点三项），与本文 §0 填表规则 ①「不预填未交付包」分属两件事——规则 ① 约束的是**执行记录**（交付后才写实测与反向验证），不是派发锚点。六包逐包交付后在此补执行记录并标「已完成」。

| 包ID | 段 | 产出物路径 | 检查命令 | 通过判据 |
|---|---|---|---|---|
| **P3-011-01**（已完成） | 依赖与工具链落位 | `apps/server/package.json`、`apps/server/jest.config.cjs`、`pnpm-workspace.yaml`（`allowBuilds`）、`pnpm-lock.yaml` | `pnpm install --frozen-lockfile && node scripts/check-workspace-deps.mjs && pnpm --filter @wo/server exec jest --listTests` | 三条 exit=0；lock 可解析 `@nestjs/core@11` / `jest@30.5.2` / `ts-jest` / `@nestjs/testing` / `supertest`；`jest --listTests` 输出 0 用例仍 exit=0（装配成立而非空跑） |
| **P3-011-02**（已完成） | 引导与模块骨架 | `apps/server/src/main.ts`、`app.module.ts`、`src/modules/<tag>/`（10 个 tag 各一）、`scripts/check-module-graph.mjs`、`scripts/check-endpoint-groups.mjs` | `pnpm --filter @wo/server build` → 起服务 → `curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:3000/api/v1/health` → `node scripts/check-module-graph.mjs` → `node scripts/check-endpoint-groups.mjs` | health=200 且体为 `status:ok`；模块图零环；模块目录与 `openapi.tags` 10 组**逐一对应**（缺一组或多一组即 fail） |
| **P3-011-03**（待派发） | 契约 schema 定义 | `packages/shared/src/schemas/`（22 个契约 schema + `internal/`）、`scripts/check-schema-names.mjs` | `node scripts/check-schema-names.mjs && pnpm typecheck` | 22 个导出名与 `components.schemas` **双向逐字相等**（改名/多一/少一即 fail）；每个 schema 的 `z.toJSONSchema` 产物含 `additionalProperties:false`；shared 类型检查 exit=0 |
| **P3-011-04**（待派发） | 校验管道与错误映射 | `apps/server/src/common/pipes/zod-validation.pipe.ts`、`filters/all-exceptions.filter.ts`、`errors/validation-codes.ts` + 管道单测 | `pnpm --filter @wo/server test -- zod-validation` | 四例全绿：body 未知键/错类型→400+7001、query 越界→400+7002、path 非法→400+7004、非法 JSON→400+7003；**断言非恒真**（摘掉 pipe 挂载后该组必红）；错误体形状 `{code,message,detail:{errors:[{field,rule,message}]}}` |
| **P3-011-05**（待派发） | 断言与夹具 | `packages/shared/validation-fixtures/*.json`、`scripts/fixtures-run.mjs`、`packages/config/rules/request-schema-strict.js` | `node scripts/fixtures-run.mjs && pnpm test:rules && pnpm lint` | 夹具逐样本断言 `code`/`field`/`rule`/`message` 四者齐全；V-S2 黑名单正则命中即 fail；A-PATH 每条 issue 满足 `path.length>0` 或 `code==='unrecognized_keys'`；规则对 `apps/` 内裸 `z.object(` 报 error，RuleTester 红/绿各一例 |
| **P3-011-06**（待派发） | 联调与收口 | 本文件 §3 六行执行记录 + 三条新脚本纳入 `verify.mjs` + `OPEN-DECISIONS` 遗留登记 | `node scripts/verify.mjs && python -X utf8 scripts/gen_status_panel.py` | verify 全段 exit=0（含本工作项新增三段）；面板口径校验带无「不一致」；遗留项已登记且带归属包 |

**执行记录（P3-011-01，2026-10-24 交付）**

- **三条派发断言实测**：`install --frozen-lockfile` exit=0（pnpm 11.28.6 / Node 22.22.2，显式入口见 §0）；`check-workspace-deps.mjs` exit=0（4 包全过）；`jest --listTests` 输出 0 用例、exit=0。`apps/server` importer 锁定 `@nestjs/core@11.2.7` / `@nestjs/common@11.2.7` / `@nestjs/platform-express@11.2.7` / `@nestjs/testing@11.2.7` / `jest@30.5.2` / `ts-jest@29.4.15` / `supertest@7.3.1` / `@nestjs/swagger@11.4.7`。
- **装配非空跑的补证（包级断言不覆盖处）**：`--listTests` 只证明 jest 自身能启动，不证明 ts-jest 与 Nest 可加载——这是「自洽不证互通」的同型缺口。另跑一次性探针（`Test.createTestingModule({}).compile()` + `expect`）实测 PASS（总 1.35s，用例 11ms），跑后即删，工作区无残留，证明「ts-jest 转换 + Nest DI 容器 + tsconfig 装饰器」三者装配成立。
- **反向验证（断言非恒真）**：R1 摘 `jest` 声明 → `check-workspace-deps` exit=1，报「lock 残留已删除的依赖 jest」；R2 移走 `apps/server/node_modules/@nestjs/core` → exit=1，报「包内 node_modules 缺 @nestjs/core」。两条均精准命中，已还原并复跑 exit=0。
- **版本裁决理由**：Nest 四件套统一 **11.2.7**——`@nestjs/core` 的 11 系天花板即 11.2.7（dist-tag `legacy`；`11.2.8` 在 registry 实为 404，而 `@nestjs/common` 存在 11.2.8，混用即跨包漂移）；`@nestjs/swagger` 锁 **11.4.7**——12.x 的 peer 要求 `@nestjs/core ^12`，与 Nest 11 不兼容（此为实测拦截，非推断）；`typescript@5.9.3` 显式进本包 devDeps——pnpm isolated 布局下 ts-jest 的 peer 需在本包可解析。
- **allowBuilds 裁决**：jest 30 引入两个带构建脚本的原生传递依赖（`@parcel/watcher` ← `jest-haste-map`、`unrs-resolver` ← `jest-resolve`），显式登记 `false` 而非放行。三条依据：平台预编译 binding 已成对落盘（`@parcel/watcher-win32-x64@2.6.0` / `@unrs/resolver-binding-win32-x64-msvc@1.12.2`）；实测忽略构建下 jest 可启动且真实用例跑绿；放行会把 node-gyp 与网络下载面带入信创/离线环境（ADR-005 最小构建面）。**换到无预编译包的平台须改判 `true` 并重测**。
- **已知遗留（非缺陷）**：`autoInstallPeers: false` 下 `@nestjs/swagger` 的 `class-validator` / `class-transformer` peer 缺席——二者在 swagger 11 的 `peerDependenciesMeta` 中均为 optional，缺席正是 P3-001 裁决 ②「zod 单一 schema 源」的预期结果，`install` 不报错。

**执行记录（P3-011-02，2026-10-24 交付）**

- **交付面**：`apps/server/src/{main.ts,app.module.ts}`、`apps/server/src/modules/<tag>/` 10 组共 20 个文件、`apps/server/tsconfig.build.json`、`package.json` 的 `build`/`start`、两个门禁脚本（`check-endpoint-groups.mjs` / `check-module-graph.mjs`）。
- **实测**：`tsc -p tsconfig.build.json` exit=0（22 个 js 产物 = main + app.module + 10 module + 10 controller）；`check-endpoint-groups.mjs` exit=0（10 组双向一致）；`check-module-graph.mjs` exit=0（10 模块 / 0 条边 / 零环 / 根模块全量注册）；`curl` 健康检查返回 **200 且体为 `{"status":"ok"}`**。
- **端口口径偏离（环境所致，非代码）**：本机 3000 被 `D://code//yun//4.x//corpadmin` 的 umi dev server（PID 10900）占用，实测改用 `PORT=3100` 同口径通过。**该占用服务对 `/api/v1/health` 同样返回 200（HTML 页面）**——只查状态码会假绿，这反向印证判据中「体为 `status:ok`」不可省。3000 原始口径待该进程释放后复核。
- **边界实测（防过度实现）**：`/api/v1/auth` 返回 404（占位控制器确实没伪造路由）；`/api/v1/health/ready` 返回 404（readiness 归 P3-016，未提前落）。
- **反向验证**：R1 注入 `auth` 与 `users` 互相 import，模块图 exit=1 并打出环路径 `AuthModule -> UsersModule -> AuthModule`；R2 移走 `modules/share`，分组断言 exit=1（缺一组 share + 10 组对 9 目录）、模块图 exit=1（根模块注册了不存在的 ShareModule）。两条均已还原并复跑 exit=0。
- **踩坑与防线（影响 P3-011-03，必须传承）**：`tsconfig.build.json` 初版用 `rootDir: src` 且未收敛编译面，而 `tsconfig.json` 的 `paths` 把 `@wo/shared` 指向 `packages/shared/src`，tsc 报 TS6059 并把跨包的 `shared/src/*.ts` **原地 emit 成 `.js`/`.js.map`**——污染源码树 6 个未跟踪文件（已清理），verify 的 lint 段因此一度 44 errors。现版显式排除 `src/index.ts`（P3-010-03 的双端消费骨架，不在 `main.ts` 依赖闭包内）后收敛。**该配置只在「运行期闭包不含 `@wo/shared`」时成立**：P3-011-03 把 22 个契约 schema 放进 `packages/shared/src/schemas/` 后必然打破它，届时须改为「先 build shared、build 期解析其 `dist` 类型」或等价单源方案，**不得**让 server 的 build 再次跨包编译。
- **产物入库**：`apps/server/dist/` 被 `.gitignore` 的 `dist/` 覆盖，构建产物不入库。

### 3.1 与相邻工作项的边界（本段三处越界已定界）

| 越界项 | 归属裁定 | 依据 |
|---|---|---|
| 「表结构骨架」 | **P3-014**（TypeORM 数据源与 10 表实体，14h / 13 包） | 原 `-01` 包级交付物模板句含此项，与 P3-014 重复；且 P3-014 依赖 `P3-003`（金仓冒烟，M0 唯一未完项），P3-011 先做即逆依赖顺序。本段六包一律不产出表结构。 |
| happy path（health 200） | liveness 归本段 `-02`；**readiness 归 P3-016** | `GET /api/v1/health/ready` 由 D1-11 ③ 新定、2026-10-24 解冻窗口落盘，属 P3-016「启动断言三级国密与健康检查」；业务 happy path（login）归 P3-041。 |
| A-STRICT 判据 1 的 ESLint 规则 | 规则文件落本段 `-05`；**`WO_RULE_NAMES` 登记回写 P3-010-02** | 规则目录 `packages/config/rules/` 是 P3-010-02 的产出物，而该批 `-04~11` 已于 2026-10-24 归并收口。回写动作挂在 `-05` 的通过判据内，并在 `-06` 收口时核对 §1「新增规则必须同步登记 `WO_RULE_NAMES`」。 |

