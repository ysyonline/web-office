# 包级锚点台账（产出物路径 / 检查命令 / 通过判据）

> 版本：**v1.3**（2026-10-22 起用；v1.1 补「接口签名表」；v1.2 补依赖/版本控制纪律两条、自检升六段；v1.3 补登记/编辑纪律两条）｜ 依据 `TASKS.md` §4bis 派单四件套：每包必须带**锚点三项**，同段内不得重叠。
>
> 为什么单独成表：锚点三项原先只写在包级验收断言里（「本包须填锚点三项」），但**没有载体**——填在哪、谁来核，都没定义。本表就是那个载体：一包一行，写死路径与可复制执行的命令。
>
> 填表规则：① 只填**已交付**的包，不预填未做的包（预填的锚点等于没写，因为没人验证过）；② 检查命令必须能直接复制执行、exit=0 即过；③ 同一段内多包的锚点路径不得重叠——重叠即视为拆分不成立，退回重拆。

## 0. 执行环境（本机）

本机 `pnpm` 的 PATH shim 由 corepack 提供，绑定的 Node 版本随 nvm 当前指针漂移（实测先后解析到 Node 16 / 20），一旦不是被 corepack 认可的那支就报 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`。**这不是代码问题，是 shim 问题**——所以自检入口绕开 pnpm：

```
node scripts/verify.mjs      # 六段，逐段 PASS/FAIL + 耗时，exit=0 即过
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
4. **门禁三连**（每轮收口即跑，缺一不可）：`node scripts/verify.mjs`（六段自检）→ `python -X utf8 scripts/check_openapi_contract.py`（openapi 契约门禁）→ `python -X utf8 scripts/gen_status_panel.py`（面板刷新 + 三口径校验带）。三条全 exit=0 才算收口。

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

段划分（本工作项 11 包，按「接口与骨架 → 主路径 → 边界与错误 → 测试与自检 → 联调与收口」切，锚点互不重叠）：

| 包ID | 段 | 产出物路径 | 检查命令 | 通过判据 |
|---|---|---|---|---|
| **P3-010-01**（已完成） | 接口与骨架 1/2 | `package.json`、`pnpm-workspace.yaml`、`.npmrc`、`.nvmrc`、`.editorconfig`、`.gitignore`、`.prettierignore`、`eslint.config.mjs`、`prettier.config.js`、`packages/config/{package.json,tsconfig.base.json,tsconfig.web.json,tsconfig.server.json,eslint-preset.js,prettier.config.js}`、`packages/shared/{package.json,tsconfig.json,tsconfig.build.esm.json,tsconfig.build.cjs.json,scripts/postbuild.mjs,src/index.ts,src/utils/fnv1a32.ts}` | `pnpm install --frozen-lockfile && node scripts/verify.mjs && pnpm build` | 三条命令全 exit=0；`packages/shared/dist` 下同时存在 `esm/index.js`+`index.d.ts` 与 `cjs/index.js`，两份目录各有 `package.json` 模块类型标记；CJS 与 ESM 分别加载 `fnv1a32` 结果相同（实测 `[6543148, 956401659]`） |
| **P3-010-02**（已完成） | 接口与骨架 2/2 | `packages/config/rules/{index.js,no-emoji.js,no-hardcoded-color.js,no-emoji.test.ts,no-hardcoded-color.test.ts}`、`scripts/check-workspace-deps.mjs` | `node scripts/verify.mjs`（内含 lint / 规则测试 / 依赖面断言三段） | 全 exit=0；lint 段带 `--max-warnings=0`；每条规则 `invalid`/`valid` 段各至少 1 例；依赖面断言覆盖 A~H 八项；**反向验证已做**（见下） |

### 反向验证记录（断言非恒真）

| 断言 | 破坏方式 | 结果 |
|---|---|---|
| `wo/no-hardcoded-color` | 在 `packages/shared/src/__probe.ts` 写入 `"background: #ff0000"` | `lint exit=1`，报 `硬编码色值「#ff0000」`；删除后 `exit=0` |
| `wo/no-emoji` | 规则自身在测试文件里抓到真 emoji（U+1F680/U+1F4BE 两条） | 说明规则对「源码里的真字符」有效；测试改用 `String.fromCodePoint()` 运行时构造 |
| 依赖面断言 G / D | 给 `@wo/shared` 临时加 `react-icons` 与 `lodash` | `check:deps exit=1`，报「第二图标源」+「dependencies 只允许 zod」；还原后 `exit=0` |
| 规则测试本身 | RuleTester `invalid` 段断言精确条数（2 处 emoji 必须报 2 条） | 首轮特意写错时测试确实红过，证明不是空跑 |
