# formula-runtime-spike 任务书（运行时双向 spike）

> 产出人：高见远（首席架构师）| 日期：2026-10-21 | 状态：待执行
> 依据：第二轮外部评审 Q2（分支 B）+ team-lead 追加盲区 B + headless 探针（spike/collab-spike/src/runtime-calc-probe.mjs，12/12 PASS）遗留的浏览器端实证缺口
> 定位：**WI-3（IR -> snapshot 结构映射）与 WI-5（公式档案侧车）的开工前置门禁**——先于 12 人日导入层投入，本 spike 不 PASS 不开工

---

## 1. 背景与已确证事实（headless 侧，本 spike 不重复验证）

| 事实 | 断言 | 状态 |
|---|---|---|
| 无头重算 10ms 去抖异步 | A2a/A2b：同步读 B1=3，500ms 后 B1=7 | 已证 |
| 服务端强制重算 API 可用 | A3/A4：set-trigger-formula-calculation-start（forceCalculation / dirtyRanges） | 已证 |
| v+f 并存格缓存值被重算覆盖 | A2b/A5：OFFSET 缓存 0.087 -> 2 | 已证 |
| 引擎未实现函数 #NAME? 且级联 | A6/A7：=A5*2 变 #NAME?；IFERROR 可捕获（A8） | 已证 |
| 载入时初算只算脏区、缓存值保留 | A1：载入后 500ms 值不变 | 已证 |

**未确证（本 spike 的四个问题）——全部针对浏览器渲染栈与协同双端：**

1. **Q1 载入时重算时机（浏览器端）**：`TriggerCalculationController` 在浏览器走 `LifecycleStages.Rendered` 后启动（sheets-formula index.js:3485 `onRendered -> touchDependencies(TriggerCalculationController)`），与 headless 的 `isNodeEnv() -> 立即 start()`（engine-formula index.js:43900-43903）路径不同——浏览器端打开含 v+f 并存格的文档时，初算是否冲掉缓存值？冲掉的时机（首帧前后）？
2. **Q2 白名单外函数浏览器运行时值**：引擎已实现白名单外函数（OFFSET/INDIRECT/AGGREGATE）在真实浏览器（含 @univerjs/sheets-formula-ui 的编辑/计算触发控制器）下的运行时表现与 headless 是否同构？
3. **Q3 级联行为（浏览器端）**：#NAME? 级联、IFERROR 捕获、重算覆盖在浏览器端是否与 headless 逐项一致（错误值渲染、t 类型、公式栏展示）？
4. **Q4 档案侧车端到端（方案 C 专属）**：双端浏览器实例 + 模拟协同链路（可复用 collab-spike 的 Link 内存直连）下——A 端编辑「已剥 f 档案命中格」后，档案条目删除是否同步到 B 端；B 端该格展示（AlertCircle 消失、公式栏退出灰态）是否正确；snapshot save() 的 resources 序列化/反序列化往返档案零丢失。

## 2. 环境与依赖

- **主环境：真浏览器 Playwright（Chromium headless=new）**——Q1 的 Rendered 生命周期、Q2/Q3 的 UI 计算触发控制器、Q4 的双端视觉态断言都必须真渲染栈。jsdom 只作为**烟雾基线**（验证插件注册链不依赖 DOM 之外的环境差异），不作 PASS 依据。
- **依赖纪律（P0）**：playwright / jsdom 仅进 `spike/formula-runtime-spike/package.json`（spike 范围依赖），**不进主项目 lockfile**；@univerjs/* 锁 1.0.2 与主线一致（core/sheets/engine-formula/sheets-formula + ui 系插件按官方 preset 清单）。
- 目录：`spike/formula-runtime-spike/`（package.json / src/ / REPORT.md 独立成包，模式对齐 collab-spike）。

## 3. 断言清单（格式对齐 collab-spike REPORT 风格：编号 + 内容 + PASS/FAIL）

| 编号 | 问题 | 断言 |
|---|---|---|
| B1 | Q1 | 浏览器载入含 v+f 并存格文档，Rendered 后 1s 内缓存值保留（与 headless A1 同构）或被初算覆盖（如实记录时机）——两者取其一为**事实断言**（记录行为，不预设期望），输出载入时序描述进 REPORT |
| B2 | Q1 | B1 观察基础上，给出「浏览器打开导入文档初算策略」结论：若覆盖，方案 C 的剥 f 决策在浏览器端同样必要（佐证）；若保留，记录触发覆盖的最小操作集 |
| B3 | Q2 | =OFFSET(A1,1,0)（引擎实现、白名单外）浏览器运行时值正确（A1=1,A2=2 -> 2） |
| B4 | Q2 | =AGGREGATE(...) / =INDIRECT(...) 各一例运行时值正确 |
| B5 | Q3 | 引擎未实现函数（捏造名）浏览器端 v 变 #NAME? 且渲染为错误样式（t:1） |
| B6 | Q3 | 引用 #NAME? 格的 =A5*2 级联 #NAME?；=IFERROR(A5,"err") 得 "err"——与 headless A7/A8 同构 |
| B7 | Q4 | snapshot save() -> createUnit() 往返，resources 中档案（SHEET_FORMULA_ARCHIVE_PLUGIN）零丢失、逐字节相等 |
| B8 | Q4 | 双端（Playwright 双 page）经内存直连链路：A 端编辑档案命中格 -> B 端 1s 内档案条目删除同步（读 B 端档案状态断言） |
| B9 | Q4 | B8 后 B 端该格公式栏退出灰态、AlertCircle 标记移除（DOM 断言，若 UI 桩已具备；否则以档案状态 + 渲染回调计数替代并注明） |
| B10 | Q4 | 服务端角色（第三实例，headless）物化 snapshot 含最新档案态；重发（doc-rebuild）后双端档案一致 |

**PASS 门槛**：B3-B10 全 PASS（B1/B2 为事实记录项不判 PASS/FAIL）；任何 FAIL -> 停下分析，若属方案 C 设计缺陷，回报架构师修订载体条款（OPEN-DECISIONS 对应条目保持 OPEN），**不得带病开工 WI-3/WI-5**。

## 4. 工作量与排期

- 总量 **1.5 人日**：环境搭建（Playwright + Univer 浏览器插件栈）0.5d；B1-B6（行为断言）0.5d；B7-B10（档案端到端）0.5d。
- 执行人：前端开发（Phase 3 前端协同模块的预期承接人，顺手建立 Univer 浏览器侧调试经验）。

## 5. 交付物

| 文件 | 说明 |
|---|---|
| `spike/formula-runtime-spike/src/browser-probe.mjs` | Playwright 主探针（B1-B10 断言） |
| `spike/formula-runtime-spike/src/jsdom-smoke.mjs` | jsdom 烟雾基线 |
| `spike/formula-runtime-spike/REPORT.md` | 结论报告（对齐 collab-spike REPORT 格式：断言表 + 坑清单 + API 清单） |
| `spike/formula-runtime-spike/package.json` | spike 范围依赖（playwright/jsdom 不外溢） |

## 6. 分支 E 追加：重算时延拆档探针（headless，不占本 spike 人日）

> 缘起：外部评审分支 E 实测「100 万格/99,828 公式档首编→重算收敛 5,474ms、次编 5,422ms ≈ 首次」——该数字是**全表/近全表脏区**成本，不能代表「单格依赖子图的增量重算」时延。L0/L1 档阈值（<200ms / <500ms）需要一条定量证据链支撑，补此探针。

- **探针文件**：`spike/collab-spike/src/calc-latency-probe.mjs`（headless，复用 collab-spike 无头环境，`--max-old-space-size` 至少 4096 起）。
- **断言（定量记录 + 阈值复核，非 PASS/FAIL 二进制）**：
  - B11：100 万格、10% 公式（SUM 10 格，同评审人形态）下，`dirtyRanges` 只标脏「单个被引用基础值格」所触发的增量重算收敛时延（远端依赖子图），与 `forceCalculation: true` 全表重算时延同一脚本对照输出——预期增量「ms 级」、全表「秒级」，两者分离清晰。
  - B12：同文档，构造「高入度根格」——99,828 个 SUM 共同引用同一根格，编辑该根格后增量重算收敛时延（预期退化为接近全表，命中 L2b 档）——用于锁定 L2b 档触发条件，而非让 L2b 潜入 L0/L1 被误期望为 200ms。
- **PASS 门槛**：B11/B12 输出数值并回填 Spec §9 档位表与 ADR-001 v1.7；B11 若 >500ms 或 B12 显著小于全表，则 L0/L1/L2b 的边界需据实修订（架构师裁定，不得带病开工性能验证）。
- **归属**：随 Phase 3 首迭代性能验证执行（与本 spike 的 B1-B10 浏览器端断言互补），架构师或前端性能负责人承接，不计入本 spike 1.5 人日。
