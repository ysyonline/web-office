# 包级锚点台账（产出物路径 / 检查命令 / 通过判据）

> 版本：**v1.9**（2026-10-25 P3-011-05 交付：§3 补执行记录 + 锚点表 -05 标已完成；v1.8 议题一 A 案落盘：shared 构建顺序裁决入 §2 决策表 + P3-011-02 防线解除；v1.7 补 P3-011-01/-02 执行记录；v1.5 补 §3「P3-011 六包派发锚点」｜2026-10-22 起用；v1.1 补「接口签名表」；v1.2 补依赖/版本控制纪律两条、自检升六段；v1.3 补登记/编辑纪律两条；v1.4（2026-10-24）P3-010-03 落地 + `-04~11` 归并收口登记 + 类型段拆三 project）｜ 依据 `TASKS.md` §4bis 派单四件套：每包必须带**锚点三项**，同段内不得重叠。
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

### shared 构建顺序决策（2026-10-25 议题一裁决，交接件 20261025-0535 §2）

**裁决：A 案**——build 期类型吃 `dist` 声明，顺序由脚本字面串联构造性保证，**不加新鲜度门禁脚本**。

背景：P3-011-02 执行记录预警「P3-011-03 把 schema 放进 `packages/shared/src/schemas/` 后，server build 不得再次跨包编译」。交接件四案中 C（dist 入库）/ D（打包器内联）此前已否决；本会话在当前 HEAD（`57cb263`）复测后取 A 案，E（Node16 改造）留作退路，B（`tsc -b` composite）未取（esm/cjs 双输出下 composite 只能挂一份，顺序并未消失，且与装饰器组合未实测）。

**实测证据（2026-10-25，探针在场，探针用后即删）**：

| 实验 | 配置 | 结果 |
|---|---|---|
| ① paths→src + `import @wo/shared` 探针 | 继承 `tsconfig.json` | **exit=2，TS6059×3**（`shared/src/index.ts` 等不在 `rootDir` 下）——复现交接件结论 |
| ② paths→`dist/esm/index.d.ts` + 同探针 | `tsconfig.build.json` 覆盖 | **exit=0**，真实 emit 成功 |
| ③ 运行时链路 | `require('./apps/server/dist/__probe.js')` | 输出 `probe = @wo/shared`（dist/cjs 经 exports 正确加载） |
| ④ 反向验证：改名 `dist/esm/index.d.ts` 模拟 dist 缺失 + 探针 | 同② | **exit=2，TS7016**（implicit any）——dist 陈旧/缺失必然红，还原后 exit=0。注：首轮反向验证曾误判「仍绿」，根因是探针已删、编译闭包根本不含 shared（空跑）；带探针重测才有效。**教训：反向验证必须先确认被测路径在编译闭包内** |
| ⑤ 端到端 | `PORT=3100` 起 dist 产物 | health 200 且体 `{"status":"ok"}`；`packages/shared/src` 全程零 `.js` 残留（无 TS6059 原地 emit 污染） |

**落地改动（3 文件）**：

1. `apps/server/tsconfig.build.json`：`paths` 覆盖为 `["../../packages/shared/dist/esm/index.d.ts"]`（typecheck 与 jest 仍指 `src`，开发期零 build 依赖的性质保留）。
2. 根 `package.json` 的 `build`：追加第四段 `&& tsc -p apps/server/tsconfig.build.json`（顺序 = shared esm → shared cjs → postbuild → server，字面先后即构造性保证）。
3. `apps/server/package.json` 的 `build`：同样改为四段串联——单独 filter build 也不会吃到旧 dist（交接件 §2.3-A 的代价条款落实）。

**副决策 (c)：verify 是否加 build 段——不加，理由登记**：verify 的段全部是「不产副作用的检查」（`--noEmit` 语义）；build 段会写 `dist/`，混进自检会把「检查」与「构建」两种性质搅在一起，且 build 已被收进根 `build` 脚本的字面串联里由构造保证（本裁决主旨正是「顺序问题用构造手段消灭，不靠检查追」）。代价是「verify 10/10 不证明可构建」持续为真——已在 §3 P3-011-02 执行记录实测补位（本会话实验⑤即一次可构建性实证）。若后续 CI 建立后再评估独立 build 段。

**约束（对后续包生效）**：任何让 server build 闭包新含 `@wo/shared` 引用的包，不得回改 `tsconfig.build.json` 的 paths 回 src；`@wo/shared` 新增导出后须先跑根 build（或任一 filter build）再跑 server dist 的运行期验证。

## 3. P3-011 NestJS 应用骨架与模块划分（六包，按实体内容切分）

**切分口径（2026-10-24 用户裁决「按建议」）**：原 7 包中 `-02`≡`-03`、`-05`≡`-06` 去掉序号后缀后逐字相同，属模板二分；收口为 **5 个实体单元 + 1 个收口包**。工时 1.0 / 1.2 / 2.0 / 1.4 / 1.4 / 1.0（和 **8.0h**，与工作项工时一致）；其中三行越 1.0~1.2h 带，已在 `scripts/gen_phase3_backlog.py` 的 `BAND_EXCEPTIONS` 显式登记理由——**再拆回带内即回到模板切分**，故登记例外而非继续劈包。

**判据基座（同轮裁定）**：端点分组以 `openapi.tags`（10 组 / 30 operation）为准，不以 Spec §5 为准——Spec §5 表**无「分组」列**，且缺 `GET /api/v1/health/ready`（该端点归 P3-016，见 §3.1 边界）。

**填表状态说明**：下表是**派发前置**锚点（`TASKS §4` 派单四件套 ② 要求随单给出锚点三项），与本文 §0 填表规则 ①「不预填未交付包」分属两件事——规则 ① 约束的是**执行记录**（交付后才写实测与反向验证），不是派发锚点。六包逐包交付后在此补执行记录并标「已完成」。

| 包ID | 段 | 产出物路径 | 检查命令 | 通过判据 |
|---|---|---|---|---|
| **P3-011-01**（已完成） | 依赖与工具链落位 | `apps/server/package.json`、`apps/server/jest.config.cjs`、`pnpm-workspace.yaml`（`allowBuilds`）、`pnpm-lock.yaml` | `pnpm install --frozen-lockfile && node scripts/check-workspace-deps.mjs && pnpm --filter @wo/server exec jest --listTests` | 三条 exit=0；lock 可解析 `@nestjs/core@11` / `jest@30.5.2` / `ts-jest` / `@nestjs/testing` / `supertest`；`jest --listTests` 输出 0 用例仍 exit=0（装配成立而非空跑） |
| **P3-011-02**（已完成） | 引导与模块骨架 | `apps/server/src/main.ts`、`app.module.ts`、`src/modules/<tag>/`（10 个 tag 各一）、`scripts/check-module-graph.mjs`、`scripts/check-endpoint-groups.mjs` | `pnpm --filter @wo/server build` → 起服务 → `curl -s -o /dev/null -w '%{http_code}' 127.0.0.1:3000/api/v1/health` → `node scripts/check-module-graph.mjs` → `node scripts/check-endpoint-groups.mjs` | health=200 且体为 `status:ok`；模块图零环；模块目录与 `openapi.tags` 10 组**逐一对应**（缺一组或多一组即 fail） |
| **P3-011-03**（已完成） | 契约 schema 定义 | `packages/shared/src/schemas/`（22 个契约 schema + `internal/`）、`scripts/check-schema-names.mjs` | `node scripts/check-schema-names.mjs && pnpm typecheck` | 22 个导出名与 `components.schemas` **双向逐字相等**（改名/多一/少一即 fail）；每个 schema 的 `z.toJSONSchema` 产物含 `additionalProperties:false`；shared 类型检查 exit=0 |
| **P3-011-04**（已完成） | 校验管道与错误映射 | `apps/server/src/common/pipes/zod-validation.pipe.ts`、`filters/all-exceptions.filter.ts`、`errors/validation-codes.ts` + 管道单测 | `pnpm --filter @wo/server test -- zod-validation` | 四例全绿：body 未知键/错类型→400+7001、query 越界→400+7002、path 非法→400+7004、非法 JSON→400+7003；**断言非恒真**（摘掉 pipe 挂载后该组必红）；错误体形状 `{code,message,detail:{errors:[{field,rule,message}]}}` |
| **P3-011-05**（已完成） | 断言与夹具 | `packages/shared/validation-fixtures/*.json`、`scripts/fixtures-run.mjs`、`packages/config/rules/request-schema-strict.js` | `node scripts/fixtures-run.mjs && pnpm test:rules && pnpm lint` | 夹具逐样本断言 `code`/`field`/`rule`/`message` 四者齐全；V-S2 黑名单正则命中即 fail；A-PATH 每条 issue 满足 `path.length>0` 或 `code==='unrecognized_keys'`；规则对 `apps/` 内裸 `z.object(` 报 error，RuleTester 红/绿各一例 |
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
- **踩坑与防线（影响 P3-011-03，必须传承）**：`tsconfig.build.json` 初版用 `rootDir: src` 且未收敛编译面，而 `tsconfig.json` 的 `paths` 把 `@wo/shared` 指向 `packages/shared/src`，tsc 报 TS6059 并把跨包的 `shared/src/*.ts` **原地 emit 成 `.js`/`.js.map`**——污染源码树 6 个未跟踪文件（已清理），verify 的 lint 段因此一度 44 errors。现版显式排除 `src/index.ts`（P3-010-03 的双端消费骨架，不在 `main.ts` 依赖闭包内）后收敛。**该配置只在「运行期闭包不含 `@wo/shared`」时成立**：P3-011-03 把 22 个契约 schema 放进 `packages/shared/src/schemas/` 后必然打破它，届时须改为「先 build shared、build 期解析其 `dist` 类型」或等价单源方案，**不得**让 server 的 build 再次跨包编译。**→ 防线已于 2026-10-25 解除**：见 §2「shared 构建顺序决策」——`tsconfig.build.json` 的 paths 已覆盖为 `dist/esm/index.d.ts`，build 闭包可安全含 `@wo/shared`（实测探针验证，无跨包编译、无 src 污染）。
- **产物入库**：`apps/server/dist/` 被 `.gitignore` 的 `dist/` 覆盖，构建产物不入库。

**执行记录（P3-011-03，2026-10-25 交付）**

- **交付面**：`packages/shared/src/schemas/`（7 文件：`common.ts` 口径件 + `auth/users/sso/files/share/audit/error.ts` 分域 + `index.ts` 出口）+ `schemas/internal/.gitkeep`（空目录占位，口径见文件内注）+ `scripts/check-schema-names.mjs` 门禁。
- **strict 口径裁决（本包核心决策，三源交叉）**：9 个请求侧 schema（8 个 `*Request` + `SsoConfig`）一律 `z.strictObject`（卡面条 3 + 工作项收口断言 + openapi 显式 `additionalProperties: false` 同口径）；响应侧 13 个 `z.object`（strip 语义——卡面只约束请求侧，openapi 对响应未声明 AP:false，收紧属契约变更不私改）；`ValidationErrorDetail/Item` 照抄契约显式声明用 `z.strictObject`。`Error` schema 的 `detail` 在契约中无 type 声明（对象/字符串/null 三态），照抄为 `z.unknown().nullable().optional()`，**不收紧成 union**（union 引入契约没有的 AP:false 语义）；code 与 detail 形态绑定校验归 P3-011-04 过滤器。
- **命名对齐实测**：`check-schema-names.mjs` exit=0（22 = 22 双向逐字）；`export { ErrorSchema as Error }` 解决「Error 是保留感标识符」与「导出名逐字」的冲突——机检读别名后的名字。
- **写法实测记录**（全部逐条跑过，依据写入 `schemas/common.ts`）：`z.iso.datetime({ offset: true })`——无 offset 实测拒 `+08:00`（RFC 3339 允许）；`z.number().int()` 替代 `z.int64()`——bigint 实测 `z.toJSONSchema` 直接抛错；`.optional()` 投影后不进 `required`；`.nullable()` 投影 `nullable: true`（openapi-3.0 target）。
- **jest 首次真实加载 shared 的坑（新，须传承）**：shared 源码相对 import 带 `.js` 后缀（verbatimModuleSyntax），本包 tsconfig 是 Node10 + jest-resolve 无 `.js`→`.ts` 映射，-02 之前 jest 只 `--listTests` 从未真正加载过 shared，-03 落 schemas 即爆 `MODULE_NOT_FOUND: ./utils/fnv1a32.js`。**moduleNameMapper 不可用**：全局 `^\./(.+)\.js$` 会误吞 node_modules 内部相对导入（实测 react-is 的 `./cjs/react-is.development.js` 被误映射），而 mapper 按 specifier 原文匹配拿不到请求方位置——改用自定义 resolver（`apps/server/jest-resolver.cjs`），按 `resolverOptions.basedir` 判定「请求方在 shared/src 内」才做改写，目标不存在时回退默认解析，行为无损。
- **运行时抽检（jest 临时探针，用后即删）**：22 导出名齐全；11 个 strict schema 对 `{"__probe_unknown__":1}` 全部 fail 且 issues 含 `unrecognized_keys`（注意首个 issue 可能是 invalid_type——缺 required 键与未知键同报，断言要查集合不能查首个）；全部 object schema 的 openapi-3.0 投影含 `additionalProperties:false`；`UserResponse.ssoProvider` 投影 `nullable:true`。
- **反向验证**：R1 `check-schema-names.mjs` 改名注入（`LoginRequest→LoginRequestX`）→ exit=1 双向报出；R2 删名注入（`RefreshResponse`）→ exit=1；R3 strict 注入（`LoginRequest` 临时改 `z.object`）→ 行为探针红（未知键不再失败）。三条均还原并复跑 exit=0。**R1/R2/R3 的教训：反向验证前必须先确认被测路径在编译闭包/断言集合内**（议题一实验④ 首轮误判同因）。
- **端到端**：根 build（含新第四段）exit=0；`dist/cjs/index.js` 22 导出齐全且 `LoginRequest.safeParse` 未知键拒绝（strict 在 CJS 产物成立）；dist 产物起服务 `PORT=3100` health 200 `{"status":"ok"}`。
- **台账口径注记**：「请求 9 + 响应 13」按引用方向机械复现实为 8（仅 requestBody）+ 12（responses）+ 2（Error 树内嵌），9/13 无法从 openapi 导出（SsoConfig 同时是 requestBody）；`check-schema-names.mjs` 只断言 22 集合双向相等，不写死拆分数（交接件缺陷 2 修法落地）。拆分说明已写进 `schemas/common.ts`。
- **verify**：10/10 段通过（含本包新增文件进 lint/typecheck 面）。

**执行记录（P3-011-04，2026-10-25 交付）**

- **交付面**：`apps/server/src/common/{errors/validation-codes.ts, pipes/zod-validation.pipe.ts, pipes/zh-locale.ts, filters/all-exceptions.filter.ts}` + `pipes/zod-validation.pipe.spec.ts`（四条分流 + 两条反断言，6 例全绿）+ `app.module.ts` 挂 `APP_FILTER`（全局过滤器）+ `zod@4.6.7` 显式进 server 依赖（pnpm isolated 布局不 hoist，类型/运行期都需要）。
- **分流实测**：①body 未知键/错类型→400+7001（错误体逐字段 `{field,rule,message}`，三键无第四）；②query 越界→400+7002（coerce 形态 `z.coerce.number().int().min(1).max(100)`，`limit=0`/`''`/`'101'` 三样本全拦——`limit=0` 是 D1-13-B 点名的「缺 `.min(1)` 唯一探测器」）；③path 非法→400+7004；④非法 JSON→400+7003（e2e 真实栈验证）。
- **7003 的实证弯路（必须传承）**：过滤器最初按 body-parser 的 `type='entity.parse.failed'` 判据写单测全绿，但 e2e 真实栈落 9001——**Nest core 的 `routes-resolver.js mapExternalException` 在路由层把 body-parser 的 SyntaxError 包装成 `BadRequestException(err.message)`，原始属性面已丢失**。用一次性探针过滤器抓真实异常证实（name=BadRequestException，type 属性不存在）。最终判据 = `HttpException && status===400 && message 命中解析特征词`（unexpected token / is not valid JSON / in json at position），e2e 复测 7003 成立。**教训：单测的手造异常对象必须先与真实栈核对属性面——「单测全绿」与「真实栈工作」是两件事，本包的 e2e 探针就是把这一课落成纪律。**
- **两个注册判据的分界（D1-13 决议执行）**：管道**不**全局注册（漏挂=零校验，是 P3-037 遍历门禁要抓的缺陷）；过滤器**必须**全局注册（漏挂=裸 500/Nest 默认错误体，全局兜底正是 D1-13 ④ 栏错误映射的执行前提）。`zh-locale.ts` 单独成文件由 app.module 显式 side-effect import——`z.config` 是进程级全局副作用，写进管道会让 import 即变更全局。
- **错误体中文文案**：`z.locales.zhCN()` 全局生效后 `unrecognized_keys` 默认文案自带键名（「出现未知的键(key): \"__probe_unknown__\"」），满足 D1-13-B「message 必须内联未知键名」；单测断言了「含键名 + 中文」双条件，泛化文案过不了。
- **反向验证**：R1 禁用 7003 分支（`if (false && …)`）→ e2e 回落 9001，还原后 7003；R2 管道 schema 注入 strip 语义（`z.object` 替代 `strictObject`）→ ① 用例红（未知键不再失败）；R3 ③ 的合法 uuid 注入非法尾字符 → 用例红。三条均还原并复跑全绿。
- **边界遵守**：不生成 X-Request-Id / traceId（归 P3-013）；HttpException 家族逐码映射只落 9001 骨架（完整映射归后续包）；9001 detail.requestId 未落（同归 P3-013）；`entity.too.large` 类容量越界暂落 7003 并在过滤器注释登记（3001 是导入域业务码，全局层不区分端点）。
- **verify**：10/10 段通过；`tsconfig.json` 的 `types` 补 `jest`（spec 进了编译面）；build 链 exit=0，产物含 `dist/common/`。

**执行记录（P3-011-05，2026-10-25 交付）**

- **交付面**：`packages/shared/validation-fixtures/`（7 域 JSON，22 schema 全覆盖，44 个断言样本）+ `scripts/fixtures-run.mjs`（零依赖纯 node，仅 node builtin）+ `packages/config/rules/request-schema-strict.js`（RuleTester 红绿双向 13 例）+ 根 `test:rules` 挂第三测试文件 + `WO_RULE_NAMES` 登记（§3.1 第三行回写动作，`check-workspace-deps` 复核一致）+ preset 执法面段（`wo/request-schema-strict: error`，files 圈 apps/** + schemas/**，ignores internal/**）。
- **执法面双裁（本包核心决策）**：规则内部分流——`apps/**` 任何裸 `z.object(` 即 error（派单断言原文）；`packages/shared/src/schemas/**` 只拦变量名以 `Request` 结尾的声明器内裸起造（**含嵌套层**——顶层 strictObject 挡不住嵌套 z.object 的静默剥离）。依据：schemas/ 内响应侧 11 处 `z.object` 是 -03 裁决的合法存量（「响应侧收紧属契约变更」），一刀切即 13 处误报；`*Request` 命名约定是 -03 机检名单的静态映射。响应侧/派生链/`internal/`/测试文件四类豁免各有卡面依据。
- **夹具样本纪律**：E-CV ①逐行落——每个请求侧 schema 各一条错类型 + 一条未知键（`{"__probe_unknown__":1}`），不私扩约束；22 schema 全覆盖来自 V-S2「每个 schema 喂必失败样本」（请求侧 11 strict + 响应侧 11 loose）；响应侧另加 `strip-control` 对照样本（-03 裁决的回归探测器，非 E-CV 样本，JSON 内 note 标明，防有人把响应侧改成 strict 走私契约变更）。`Error` schema 夹具引用**契约逐字名** `Error`（`export { ErrorSchema as Error }` 的别名后导出名），引用 `ErrorSchema` 常量名即落空。
- **运行器技术决策（须传承）**：① **CJS 单实例通道**——`createRequire`（以 packages/shared 为基准）解析 zod + `require(dist/cjs/index.js)`；ESM/CJS 双包混用会拿到两个 zod 实例，`z.config` 只影响其一，zhCN 断言会系统性假绿。② 运行器**自己执行** `z.config(z.locales.zhCN())`——这是 `apps/server/src/common/pipes/zh-locale.ts` 的运行时等价物（生产入口 app.module side-effect import），若有人删掉那行，此处 V-S2 黑名单立刻命中（回归探测器设计）。③ **dist 新鲜度门**——src 任一 `.ts` 比 `dist/cjs/index.js` 新即自动重建，防陈旧产物假绿。
- **实测**：`node scripts/fixtures-run.mjs` → 44 样本 ALL GREEN（四者齐全 + V-S2 + A-PATH + unrecognized_keys 内联键名 + strip 对照全过）；`corepack pnpm test:rules` → 3/3 文件全绿；`corepack pnpm lint` → 全仓 0 error（22 存量零误报）；`verify` → 10/10；`check-workspace-deps` exit=0。
- **反向验证（四条，探针全部用后即删）**：R1 毒丸——把 `UserUpdateRequest` 的 wrong-type 样本改成合法值 → runner exit=1 报「期望失败但 safeParse 成功」，还原后绿（断言链端到端咬合实证）；R2 V-S2 非死断言——无 zhCN 的 zod 实例 message 为 `"Invalid input: expected string, received number"` 命中黑名单，zhCN 为 `"无效输入：期望 string，实际接收 数字"` 不命中；R3 判据 4 咬合——全 optional schema strip 化后喂未知键 → success 且无 unrecognized_keys（runner 必红的形态实证）；R4 lint 执法面——`apps/server/src/` 造裸 `z.object` 探针 → lint exit=1 命中；`schemas/` 造 `ProbeRequest` 探针 → exit=1 命中；`schemas/internal/` 造裸 `z.object` → 豁免 PASS。
- **踩坑（影响后续规则/测试开发者）**：① **ESLint 9 flat config 对无扩展名 glob 的 `files` 段按目录语义处理**——RuleTester 用例 filename 全是 `.ts`，顶层配置必须写带扩展名的显式模式（`**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}`），否则所有用例落空且只报「No matching configuration found」（报错不指明根因，本包耗三轮定位）；② Linter/RuleTester 直呼时 filename 可能是相对路径，规则内路径正则**不能要求前导分隔符**（须 `(^|\/)apps\//` 形态，`[\\/]apps[\\/]/` 漏掉 `apps/` 开头形态导致规则静默不触发）；③ 裸 `pnpm` 命中的是系统 node 20 的另一入口，`node --test` 下报 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`——必须用 `corepack pnpm` 显式入口（§0 既有约定，本包再证）。
- **边界遵守**：不把 `fixtures-run.mjs` 纳入 verify（三条新脚本纳入 verify 是 `-06` 的交付物）；不动 P3-037 遍历门禁与 V-S1 本体（apps 面规则只是 schema 单一落点的纵深防线）；不上报 7xxx（夹具锁 schema 层行为，HTTP 层分流已有 -04 单测覆盖）。

### 3.1 与相邻工作项的边界（本段三处越界已定界）

| 越界项 | 归属裁定 | 依据 |
|---|---|---|
| 「表结构骨架」 | **P3-014**（TypeORM 数据源与 10 表实体，14h / 13 包） | 原 `-01` 包级交付物模板句含此项，与 P3-014 重复；且 P3-014 依赖 `P3-003`（金仓冒烟，M0 唯一未完项），P3-011 先做即逆依赖顺序。本段六包一律不产出表结构。 |
| happy path（health 200） | liveness 归本段 `-02`；**readiness 归 P3-016** | `GET /api/v1/health/ready` 由 D1-11 ③ 新定、2026-10-24 解冻窗口落盘，属 P3-016「启动断言三级国密与健康检查」；业务 happy path（login）归 P3-041。 |
| A-STRICT 判据 1 的 ESLint 规则 | 规则文件落本段 `-05`；**`WO_RULE_NAMES` 登记回写 P3-010-02** | 规则目录 `packages/config/rules/` 是 P3-010-02 的产出物，而该批 `-04~11` 已于 2026-10-24 归并收口。回写动作挂在 `-05` 的通过判据内，并在 `-06` 收口时核对 §1「新增规则必须同步登记 `WO_RULE_NAMES`」。 |

