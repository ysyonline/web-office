# P3-002 formula-runtime-spike 结束报告

> 执行：前端开发（spike 承接人）| 日期：2026-10-22 | 状态：**B1-B10 全 PASS（16/16）；B11/B12 数值已测，L0/L1/L2b 边界待架构师裁定**
> 依据：TASK.md（2026-10-21）| 定位：WI-3 / WI-5 开工前置门禁——**B3-B10 全 PASS，门禁放行**（B11/B12 为定量记录项，不阻塞门禁，但边界修订须在性能验证开工前完成）

---

## 1. 结论速览

| 问题 | 结论 | 判定 |
|---|---|---|
| Q1 浏览器端载入时初算是否冲缓存值 | **不冲**。Rendered（~560ms）后 1s 观察窗内 B1/C1/D1 缓存值逐字节保留，与 headless A1 同构 | B1/B2 PASS（事实记录） |
| Q2 白名单外函数浏览器运行时值 | **同构**。OFFSET/AGGREGATE/INDIRECT（含 R1C1 形态）运行时值全部正确 | B3/B4 PASS |
| Q3 级联行为浏览器端 | **逐项一致**。#NAME? 错误值（t:1）、=A6*2 级联、IFERROR 捕获，与 headless A6/A7/A8 同构 | B5/B6 PASS |
| Q4 档案侧车端到端 | **全链可用**。saveUnit 往返零丢失、双端 Yjs 同步、服务端物化一致 | B7-B10 PASS |
| B11/B12 重算时延拆档 | 增量脏区识别正确（10 公式）但时延 2404ms——依赖生成是全表级固定成本；L2b 退化成立；星型依赖初算异常慢（113.9s 值稳定） | 定量记录（§4） |

**门禁判定：B3-B10 全 PASS（TASK.md §3 门槛），WI-3 / WI-5 可以开工。**

## 2. 断言表（B1-B10，Playwright Chromium headless 真渲染栈）

| 编号 | 断言 | 结果 | 关键数据 |
|---|---|---|---|
| B1 | 浏览器载入 v+f 并存文档，Rendered 后 1s 缓存值保留 | **PASS** | final={b1:3, c1:0.087, d1:0.174}；38 样本；renderedAt=558~574ms |
| B2 | 初算策略结论 | **PASS** | 载入时无脏区→缓存稳定保留；覆盖触发最小操作集=任何触发脏区的编辑 |
| B3 | =OFFSET(A1,1,0) 运行时值 | **PASS** | A1=5,A2=2 → 2 |
| B4a | =AGGREGATE(1,6,A3:B3) | **PASS** | = 15 |
| B4b | =INDIRECT("A3") | **PASS** | = 10 |
| B4c | =INDIRECT("R3C1",FALSE) R1C1 形态 | **PASS** | v=10（A1 引用形态同值） |
| B5 | 引擎未实现函数 → #NAME? (t:1) | **PASS** | {v:"#NAME?", t:1} |
| B6a | =A6*2 级联 #NAME? | **PASS** | {v:"#NAME?", t:1} |
| B6b | =IFERROR(A6,"err") 捕获 | **PASS** | "err" |
| B5b | 渲染单元已建立（Canvas 栈真实运行） | **PASS** | renderUnits=browser-probe-book + 2 个内部编辑器；DOM canvas=3 |
| B7a | saveUnit() resources 含档案 | **PASS** | 与 6 个内置 SHEET_* 插件并列物化 |
| B7b | 档案条目逐字节相等 | **PASS** | 3/3 条原文一致 |
| B7c | 物化→加载→再物化 往返零丢失 | **PASS** | entries=3 |
| B8 | A 端删档案 → B 端 1s 内同步 | **PASS** | Y.Map 键删除经内存直连同步 |
| B9 | B 端 UI 表现（替代口径） | **PASS** | 档案已删 + 渲染单元活跃 + DOM canvas=3；灰态/AlertCircle DOM 断言留 P3-093 |
| B10 | 服务端物化 snapshot 档案态一致 | **PASS** | serverEntries=0，A/B 端一致 |

jsdom 烟雾基线：S1/S2 PASS（插件注册链 + 编辑触发重算 B1 3→7），不作为 PASS 依据（TASK.md §2）。

## 3. 坑清单（工程化要点，回填 backlog P3-002 经验项）

| # | 坑 | 根因 | 解法 |
|---|---|---|---|
| 1 | 双 React 实例（useId null 崩溃） | esbuild alias 把 react.mjs 内联成 `init_react` 副本；**第三种扁平形态**（radix-slot/icons 的 ESM 源直接内联 shim，无 init_react 包装）逃过去重条件 | post-build 文本替换覆盖三种形态：`init_react()` / `var React = react_exports` / `__toESM(require_react())`；`univer-icons` 必须进 REACT_DEPS 名单 |
| 2 | 双 redi 实例（token 不等 → injector.get get 0） | `redi-react-bindings` bundle 内联完整 redi 副本，与 `@univerjs/core` 走 import map 的独立 redi 形成 `REDI_GLOBAL_LOCK` 双载 | **不能 bundle**——手写 13 行 shim re-export `__bare/@wendellhu/redi/react-bindings`（绝对 URL 绕过 import map 自指） |
| 3 | import map 自指死循环 | import map 把 `@wendellhu/redi/react-bindings` 指到 shim 自身 | shim 内用绝对 URL `/__bare/...` 绕过 import map |
| 4 | `resolveBare` 子路径 404 | `dist/esm/react-bindings` 是**目录**，stat 成功但 readFile EISDIR → 404 | 候选过滤只认 `isFile()`；补 `<pkg>/dist/esm/<sub>/index.js` 目录形式候选 |
| 5 | `createPortal is not a function` | react-dom shim 只从 `react-dom/client` 取键，`createPortal` 在根包 | shim 从 `react-dom` 根包取全量键（createPortal/createRoot/flushSync/...），import map 两 spec 同指 |
| 6 | `injector.get('resource-loader-service')` get 0 | 字符串与 createIdentifier token 对象不等价 | 必须 `import { IResourceLoaderService } from '@univerjs/core'` 用 token 对象 |
| 7 | `getRenderAll()` 判空误报 | 返回 **Map**，`Object.keys(map)` 恒空 | `[...units.keys()]`；旁证加 DOM `querySelectorAll('canvas')` |
| 8 | Playwright Chromium 官方 CDN 卡死 | 网络环境 | `PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright` 镜像 |
| 9 | import map 注入时机 | `addInitScript` 在文档解析早期执行，但 import map 必须先于任何 module script | 经 `page.route()` 拦截 HTML 响应注入 `<script type="importmap">` |
| 10 | ESM 里 `require('node:v8')` | ERR_AMBIGUOUS_MODULE_SYNTAX | 改 `import { getHeapStatistics } from 'node:v8'` |

## 4. B11/B12 重算时延拆档（headless，100 万格 / 10 万 SUM 公式）

> 环境：Node v22.22.2，heap limit 8240MB，本机 15.7GB 物理内存。构建 297ms，载入后 rss≈509MB。
> 计时口径：挂 `ICalculateFormulaService.executionCompleteListener$`（计算完成事件）精确门控，progress 字段记录引擎实际计算量。

| 项 | 场景 | 时延 | 引擎实际计算量（progress） | 档位依据 |
|---|---|---|---|---|
| B11a | 低入度单格编辑（A5001，被 10 公式引用） | **2404ms** | totalFormulasToCalculate=**10** | L0 档（<200ms 预期）**未达** |
| B11b | dirtyRanges 单格增量（服务端可控路径） | 2404ms | 同上（10） | 参考 |
| B11c | forceCalculation 全表（10 万公式） | **5227ms** | totalFormulasToCalculate=**100000** | L2 档（秒级）符合 |
| B12i | 星型依赖图初算（10 万公式同根） | 事件 1639ms / 值稳定 113.9s | — | **异常发现**（见下） |
| B12 | 高入度根格编辑（$A$1 被 10 万公式引用） | **3285ms** | totalFormulasToCalculate=**99990** | L2b 档（近全表）**成立** |

分离度：全表/低入度增量 = 2.2x；L2b/低入度 = 1.4x。

### 4.1 核心发现（回填 Spec §9 / ADR-001 v1.7 的裁决依据）

**发现 1：引擎「增量重算」的脏区识别是增量的，但时延不是增量的。**
B11a 编辑单格，引擎只重算 10 个公式（progress 证实），却耗时 2404ms。瓶颈在**依赖生成阶段**（`FormulaDependencyGenerator.generate()` 每轮重算都对全表公式重建依赖树/图），不在公式解释执行。10 万公式档下该固定成本 ≈2.4s，与评审人「次编 5,422ms ≈ 首次」现象同源。

**发现 2：L0 档（<200ms）在 10 万公式档不可达。**
单格编辑链路（去抖 10ms + 依赖生成 + 执行）总时延 2404ms。若产品要求 L0，需要：①降低单文档公式密度（如 ≤1 万公式时依赖生成降到 ~200ms 级，需补测）；②或引擎侧依赖图缓存/增量构建（Univer 1.0.2 未实现，`clearDependencyTreeCache` 机制存在但每轮重建）。

**发现 3：星型依赖图（高入度根格）初算收敛极慢。**
B12i 初算完成事件 1639ms 发出，但公式**值**经 113.9s 才全部稳定（值门控轮询）。推测：10 万公式同引 $A$1 时依赖树构建/拓扑排序退化为 O(n²) 级，或分片执行的事件与值应用不同步。**该形态在真实导入文档（如全表统一汇率/税率引用）可能出现，需在 WI-3 导入层设计时规避或加保护。**

**发现 4：B12 编辑根格触发近全表重算（99990 公式），L2b 档成立。**
高入度根格编辑的增量重算正确退化为近全表（3285ms），符合 L2b 档预期——L2b 不应被误期望为 200ms 级。

### 4.2 阈值复核结论（TASK.md §6 门槛）

| 复核项 | 结果 |
|---|---|
| L0 <200ms | **未达**（2404ms @10 万公式档） |
| 全表/增量分离清晰 | **否**（2.2x，因依赖生成固定成本占大头） |
| L2b 退化成立 | **是**（99990 公式重算，1.4x 于低入度） |

按 TASK.md §6：B11 >500ms，**L0/L1/L2b 边界需据实修订，架构师裁定后回填 Spec §9 与 ADR-001 v1.7**。建议补充测试点：1 万公式档 / 5 千公式档的 B11a 曲线（定位依赖生成成本的规模拐点）。

### 4.3 B11a 规模拐点曲线（补测，2026-10-22，`src/calc-latency-curve.mjs`）

> 形态与 B11a 同构（10% 公式密度，每行 10 个 SUM 引用同行 A..J）；每档独立 Univer 实例、3 轮取中位数；环境同 §4（Node v22.22.2 headless，i5-12500）。

| 公式数 | 格数 | 3 轮时延 (ms) | 中位 (ms) | L0<200ms | L1<500ms |
|---|---|---|---|---|---|
| 5,000 | 5 万 | 88/89/159 | **89** | 达标 | 达标 |
| 10,000 | 10 万 | 247/258/274 | **258** | 未达 | 达标 |
| 20,000 | 20 万 | 519/596/895 | **596** | **未达** | **未达** |
| 50,000 | 50 万 | 1167/1175/1223 | **1175** | 未达 | 未达 |

**核心结论（裁决依据）**：

1. **现行 L0 边界点被击穿约 3 倍**：Spec §9 L0 档「≤20 万格且公式格 ≤2 万 / 200ms P95」的边界点（2 万公式/20 万格）实测中位 596ms。L0 边界与阈值至少有一项必须修订。
2. **时延随公式总数近似线性**：~24ms/千公式（89→258→596→1175ms 对 5k→10k→20k→50k），R² 极高。证实发现 1 的机理——依赖生成（FormulaDependencyGenerator.generate）每轮全表重建，单次编辑成本 = O(全表公式数)，与脏区大小无关（progress 证实各档均只重算 10 个公式）。
3. **外推锚点**：按线性外推，200ms 阈值对应 ~6-7 千公式；500ms 阈值对应 ~1.8 万公式；B11a 原探针 10 万公式档 2404ms 与曲线吻合（24×100+50≈2450）。
4. **第 3 轮方差偏大**（5k 档 159ms、20k 档 895ms），疑 GC/去抖窗口影响，中位数口径稳健。
5. **对 Spec §9 现行档位的影响**：L0（200ms）仅 ≤5 千公式档达标；L1（500ms @100 万格）在 50 万格/5 万公式档已 1175ms、100 万格/10 万公式档 2404ms，**同样被击穿 ~5 倍**——L1 的「规模边界」与「阈值」也需联动修订。

## 5. API 清单（spike 实证可用，供 WI-3/WI-5 直接引用）

| API | 用途 | 实证 |
|---|---|---|
| `IResourceManagerService.registerPluginResource({pluginName, businesses, toJson, parseJson, onLoad, onUnLoad})` | 档案侧车资源钩子注册（方案 C 载体） | B7a/B7b |
| `IResourceLoaderService.saveUnit(unitId)` | 物化 snapshot（含 resources hooks） | B7a/B7c |
| `univer.createUnit(UniverInstanceType.UNIVER_SHEET, snapshot)` | 从物化 snapshot 重建（触发 resource onLoad） | B7c |
| `formula.mutation.set-trigger-formula-calculation-start`（forceCalculation / dirtyRanges） | 服务端强制重算 | B11b/B11c |
| `ICalculateFormulaService.executionCompleteListener$ / executionInProgressListener$` | 计算完成/进度事件（精确计时与计算量观测） | B11/B12 |
| `SetRangeValuesCommand` | 常规编辑链路（自动脏区 + 去抖重算） | B3-B6/B11a/B12 |
| `IRenderManagerService.getRenderAll() / getRenderUnitById(unitId)` | 渲染单元枚举（Map<unitId, RenderUnit>） | B5b/B9 |
| `Y.Doc / Y.Map + Y.applyUpdate / encodeStateAsUpdate` | 档案双端同步（内存直连模拟协同链路） | B8/B10 |
| 浏览器插件链 | RenderEngine → Docs → UI → DocsUI → Sheets → SheetsUI → FormulaEngine → SheetsFormula → SheetsFormulaUI | B1-B10 全链 |
| `LifecycleStages.Rendered`（~560ms） | 浏览器端初算触发时机（TriggerCalculationController 随 Rendered 启动） | B1/B2 |

## 6. 遗留与移交

- **B9 的灰态/AlertCircle DOM 断言**：本 spike 按替代口径（档案状态 + 渲染回调）PASS；完整 UI 桩断言留 P3-093 前端实现后补（TASK.md §3 已允许）。
- **B11/B12 数值回填**：L0/L1/L2b 边界需据实修订（§4.2/§4.3），**架构师裁定后**回填 Spec §9 档位表与 ADR-001 v1.7。拐点曲线已补测（§4.3），裁决证据齐备。
- **星型依赖图初算 113.9s**（§4.1 发现 3）：已登记 OPEN-DECISIONS（2026-10-22 条目）——导入层（WI-3）需识别高入度根格形态并加保护（拆分引用/预计算/文档拆分）。
- **工程化经验**：§3 坑清单 10 条建议随 P3-001 工程化基线评审一并归档（esbuild/import map/双实例问题在主项目构建链路同样适用）。

## 7. 复现方式

```bash
cd spike/formula-runtime-spike
npm install                                    # playwright/jsdom 仅 spike 范围依赖
npx playwright install chromium               # 或 PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright
node src/build-esm.mjs                         # 预构建 vendor ESM（react/redi 去重链）
node src/jsdom-smoke.mjs                       # S1/S2 烟雾基线
node src/browser-probe.mjs                     # B1-B10（16/16 PASS，退出码 0）
NODE_OPTIONS="--max-old-space-size=8192" node src/calc-latency-probe.mjs   # B11/B12（约 3 分钟）
NODE_OPTIONS="--max-old-space-size=8192" node src/calc-latency-curve.mjs   # B11a 拐点曲线（约 12s，4 档 × 3 轮）
```
