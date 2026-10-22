# 协同技术 Spike 报告（collab-spike）

> 执行人：高见远（首席架构师） | 日期：2026-10-21 | 结论：**PASS（32/32 断言通过，退出码 0）**
> 对应：Spec AC-14 / 架构选型风险 1（全项目唯一 P0 级验证项）
> 环境：Windows x86_64，Node v22.22.2，npm 10.9.7，@univerjs/core|sheets|engine-formula|engine-render|protocol|rpc 均 1.0.2（npm ls 核对全包同版本），yjs 13.6.x

---

## 1. 结论

**Univer Command/Mutation 层到 Yjs CRDT 的映射验证通过，可进入协同功能开发，无需启动降级方案。**

核心断言结果（`node src/spike.mjs` 可复现）：

| 测试组 | 内容 | 结果 |
|---|---|---|
| T1 | A 写入 -> Yjs -> B 经 Command API 回放，双端快照一致；无回声放大 | 6/6 PASS |
| T2 | 顶层 COMMAND（SetRangeValuesCommand）被 Univer 自动分解为 MUTATION，协作钩子捕获的正是 mutation（粒度正确） | 3/3 PASS |
| T3 | 离线并发编辑不同单元格，重连后双向收敛 | 2/2 PASS |
| T4 | 离线并发编辑**同一单元格**，单元格状态模型收敛为单一值（Yjs 内在 LWW，可复现） | 2/2 PASS |
| T4b | 操作日志模型（全量按 Yjs 全序回放）同格并发亦收敛 | 1/1 PASS |
| T4c | 反例：oplog + 跳过"已应用 op"在同格并发下**必然发散**（A/B 各持一词，发散被证实，该写法禁用） | 1/1 PASS |
| T5 | A 端撤销不崩溃；撤销后双端一致；收到远端更新后连续 undo 不崩溃 | 5/5 PASS |
| T6 | **远端回放不污染本地 undo 栈**（B 收到 2 条远端后 undos 1->1）；B 撤销自身编辑不误伤 A 的远端编辑 | 4/4 PASS |
| T7 | 结构操作（插入行）同步 + 权威端重发状态后双端一致；结构操作撤销不崩溃且双端一致 | 4/4 PASS |
| T7b | 并发结构操作探测：双端收敛、rowCount 正确（开放项 OPEN-1，见 4.3） | 探测项 |
| T8 | 公式文本（=SUM...）作为原始输入同步，双端一致（验证"只同步输入、本地重算"路线） | 2/2 PASS |
| T9 | 10x2 轮多写往返：出站 mutation 数 = 实际写次数（无放大），快照一致 | 3/3 PASS |

## 2. 已验证的关键 API（Univer 1.0.2 实测）

全部为实机验证，非文档推断：

| 能力 | API | 验证结论 |
|---|---|---|
| mutation 级监听 | `commandService.onCommandExecuted((info, options) => ...)` + `info.type === CommandType.MUTATION` 过滤 | 可用。COMMAND 被拆解后以 mutation 再进钩子（T2 实证），OPERATION（滚动/侧栏）被 type 过滤天然排除 |
| 官方协作专用钩子 | `commandService.onMutationExecutedForCollab(listener)` | 存在且可用（probe 实证），语义为"仅 mutation 且需要同步时触发（含 syncOnly）"；本 spike 用 onCommandExecuted + type 过滤等价实现，生产可二选一 |
| 执行选项 | `IExecutionOptions { onlyLocal, fromCollab, fromChangeset, syncOnly }` | `fromCollab: true` 传给监听器用于抑制回声（T1.6 实证）；`onlyLocal: true` 表示仅本机执行不外发 |
| 远端回放 | `commandService.syncExecuteCommand(mutationId, params, { onlyLocal: true, fromCollab: true })` | 回放走 Command API，严禁直接改数据层（Spec 第 11 章坑 5 的约束可执行） |
| 快照读取 | `workbook.save()` 返回 IWorkbookData（含 cellData/rowCount 等） | 可用，双端一致性断言的比对源 |
| undo 栈探测 | `injector.get(IUndoRedoService).getUndoRedoStatus(unitId)` | 可用，T6 用它证明远端回放不入 undo 栈 |
| 无头运行 | `new Univer({ locale, locales: { zhCN: {} } })` + `registerPlugin(UniverSheetsPlugin)` + `createUnit(...)` | Node 22 下无需 DOM/canvas 即可运行（未引 UI/render 插件）；服务端权威重算路线成立 |

关键代码路径：`src/spike.mjs` 中 `CollabClient._bindOutbound()`（出站拦截）、`_replay()` / `_replayCellState()`（入站回放）、`Link`（可离线的内存直连链路）。

## 3. 推荐的协同数据通道设计（spike 实证收敛的写法）

**双通道模型**（Phase 3 协同模块的实现基线）：

1. **单元格内容通道（高频）**：`Y.Map<地址"row:col", {v,f}>` —— 绝对赋值幂等，同格冲突由 Yjs 内在 LWW 收敛（T4）；回放为"对账式"：设置 map 中全部键 + 显式清空本地存在而 map 中已删除的键（坑 3）。
2. **结构操作通道（低频）**：`Y.Array` 有序操作日志，每条 op 带 `{opId, client, kind:'struct'}` —— 结构操作不幂等，回放必须按 (client, opId) 去重且跳过自己发出的 op（坑 4）；生产实现中该通道由服务端定序串行化（OPEN-1）。
3. 回放顺序：先结构通道、后内容通道；结构操作发生后由权威端（服务端 headless Univer）重算并重发全量单元格状态（含删除失效键）。
4. 禁用写法（T4c 反例）：oplog + "跳过已应用 op"。发散机理：本地已应用的 op 在 Yjs 合并后可能排到远端 op 之前，跳过导致两端应用序列不同。

## 4. 发现的坑（全部已实证，写入 Spec 第 11 章候选）

### 4.1 无头模式必须显式注入 locales
执行顶层 COMMAND 时 `SheetPermissionCheckController` 会调 `localeService.t()`，未注入 locales 抛 `[LocaleService]: Locale not initialized`。修法：`new Univer({ locale: 'zhCN', locales: { zhCN: {} } })`。

### 4.2 InsertRowCommand 在第 0 行插入必须传 Direction.UP
`InsertRowByRangeCommand` 的 anchorRow = (direction === UP ? startRow : startRow - 1)，不传 direction 时在第 0 行插入 anchorRow = -1，抛 `Anchor row is out of bounds`。

### 4.3 并发结构操作存在残留风险（OPEN-1，不阻塞）
T7b 并发插行：双端收敛、rowCount 正确，但单元格状态通道可能残留"幽灵键"（客户端各自基于本地旧位置重发状态，Yjs 对并发 set/delete 的解析可能保留失效键）。**缓解（Phase 3 落实）**：结构操作不本地立即广播，统一发服务端；服务端按到达顺序定序后广播，并在合并完所有 pending 结构 op 后由服务端（headless Univer 权威端）统一重发单元格状态——客户端不做位置修正推算。政企场景结构操作低频，该串行化无感知。

### 4.4 直接执行 MUTATION 不产生 undo 项（重要语义）
undo 项由顶层 COMMAND 的 handler（经拦截器）压栈。含义：远端回放 mutation 恰好因此**不污染本地 undo 栈**（这是期望行为，T6 实证）；副作用是"撤销远端操作"在 MVP 不支持（业界同为默认行为）。注意：测试/脚本直接执行 mutation 会发现 undo 不可用，须走 COMMAND 路径。

### 4.5 回声抑制依赖执行选项
远端回放必须携带 `{ onlyLocal: true, fromCollab: true }`：`fromCollab` 让出站监听器识别"这是远端来的"从而不再出站（否则无限回声放大）；`onlyLocal` 语义上标记仅本机执行。两个选项均已实测有效。

### 4.6 其他记录
- `@univerjs/sheets` 在无 DOM 的 Node 进程可独立运行（不依赖 engine-render 实例化），公式引擎插件未在本 spike 启用（公式文本同步已验证，计算收敛留待 Phase 3 前后端同构验证）。
- 多人光标/选区（awareness）不经过 mutation 通道，走 y-protocols awareness 独立通道，属常规前端集成，无技术风险，Phase 3 验证。
- 本 spike 为同进程内存直连（符合任务定义）；真实 ws 传输层（y-websocket 协议帧）在 Phase 3 联调，二进制帧协议已在 openapi.yaml 中约定。

## 5. 降级方案启动条件（未触发）

按架构选型风险 1 的预案：仅当出现以下情况才启动降级（自研轻量 OT 或评估 Univer Pro）：
- Phase 3 真实 ws 环境下出现无法在 2 周内修复的收敛失败或渲染错位；
- 5 万行规模下 mutation 拦截/回放的性能实测不达标（AC-05 联合验证时）。

本次 spike 全部断言通过，**降级方案不启动**。

## 6. 交付物清单

| 文件 | 说明 |
|---|---|
| `spike/collab-spike/src/spike.mjs` | 主 PoC：双 Univer 实例 + Yjs + 9 组 32 项断言（`node src/spike.mjs`） |
| `spike/collab-spike/src/probe.mjs` | API 探针：无头启动 + mutation 执行 + 协作钩子冒烟 |
| `spike/collab-spike/src/runtime-calc-probe.mjs` | 无头重算能力探针：14/14 断言（2026-10-21 第二轮外部评审 B 分支裁决依据，断言汇总见文末附录 B） |
| `spike/collab-spike/src/resources-probe.mjs` | 档案侧车载体探针：resources 往返存活 + 剥 f 不长回（2026-10-21 第三轮外部评审 C 分支，附录 C） |
| `spike/collab-spike/src/archive-shift-probe.mjs` | 档案坐标错位反例探针：插行后档案键不动、导出写错格（评审人提供，附录 C） |
| `spike/collab-spike/src/archive-migration-probe.mjs` | 档案迁移设计探针：13/13 断言（2026-10-21 第三轮 P0 补丁裁决依据，附录 D） |
| `spike/collab-spike/package.json` | 依赖锁定（@univerjs/* 1.0.2 全包同版本 + yjs ^13.6） |
| `spike/collab-spike/REPORT.md` | 本报告 |

依赖安装记录：npm 默认源，66 包，28s，无网络阻塞。

---

## 附录 A：快照体积实测（P0-1 修订依据，2026-10-21 补充）

> 工具：`src/size-probe.mjs`（Node v22.22.2，gzip level 6）；数据构成按真实业务模拟。
> 结论先行：**快照落库与传输一律 gzip；上限按 gzip 后体积定为 32MB**（100 万格实测最差 ~4.7MB，32MB 留 ~7 倍余量覆盖超长文本/多 sheet 等极端但合法的快照形态）。

### A.1 混合内容场景（60% 数字 / 20% 中文文本 / 10% 日期 / 10% 公式，20 列宽）

| 规模 | JSON 原始 | gzip(6) | 压缩比 |
|---|---|---|---|
| 10 万格（5 千行 x 20 列） | 1.88MB | 484.4KB | 4.0x |
| 100 万格（5 万行 x 20 列） | 19.01MB | 4.72MB | 4.0x |
| 200 万格（10 万行 x 20 列） | 38.08MB | 9.45MB | 4.0x |
| 500 万格（25 万行 x 20 列） | 96.00MB | 23.64MB | 4.1x |

线性度验证：体积与格数严格线性（每格 JSON ~19 字节），推算可信。

### A.2 极端场景：全中文文本格（每格约 12-16 字符）

| 规模 | JSON 原始 | gzip(6) | 压缩比 |
|---|---|---|---|
| 100 万格 | 30.40MB | 4.13MB | 7.4x |

中文重复内容压缩率反而更高，最差场景 gzip 体积不劣于混合场景。### A.3 原审查矛盾的澄清

- Spec「单 sheet 100 万格上限」与 openapi 原快照上限 20MB（JSON 口径）矛盾属实：100 万格 JSON 原始体积 19~30MB，恰好踩线，合法数据可触发 413。
- 修订：**快照落库（file_snapshots.snapshot）与传输（GET/WS 初始加载）一律 gzip 压缩**；上限统一为 **gzip 后 32MB**。DB 列 text 存 gzip 后 Base64 或列改 bytea 存 gzip 二进制（schema.md 已同步：采用 bytea 存 gzip 二进制，见该文件修订记录）。
- 原 AC-07 导入 10MB xlsx → 解析后快照 gzip 后典型 < 5MB，413 风险关闭。

### A.4 复现命令

A.1 与 A.2 两个场景均由同一脚本产出（全中文场景已并入 size-probe.mjs 为独立档位）：

```bash
cd spike/collab-spike && node --max-old-space-size=4096 src/size-probe.mjs
```

固定随机种子（A.1 seed=42 / A.2 seed=7），多次运行数值逐字节一致；2026-10-21 复审轮已实跑复核，与本附录数值相同。

---

## 附录 B：无头重算能力实证（2026-10-21 第二轮外部评审 B 分支裁决依据）

> 工具：`src/runtime-calc-probe.mjs`（Node v22.22.2，@univerjs/core|sheets|engine-formula|sheets-formula 1.0.2）；**14/14 断言 PASS**。
> 缘起：外部评审人断言「无头环境不触发重算」（其探针 executeCommand 后同步读回 B1=3）；team-lead 复现后提出时序疑点。本探针裁决如下。

### B.1 四项裁决结论

| 裁决项 | 结论 | 断言依据 |
|---|---|---|
| 「无头不触发重算」 | **时序假象**——重算经 `CALCULATION_DEBOUNCE_TIME = 10ms` 的 setTimeout 去抖异步执行（engine-formula es/index.js:43675/43728）；同步读回（A2a）与去抖后读回（A2b：B1 3->7）双时点实证 | A2a/A2b |
| 服务端强制重算（ADR-001 Decision 4） | **成立不降级**——`formula.mutation.set-trigger-formula-calculation-start` 的 `forceCalculation: true`（全量）与 `dirtyRanges`（增量）无头可用，链路完整（事件序列实证：trigger -> calculation-start -> notifications -> calculation-result -> 数据层回投） | A3/A4 |
| v+f 并存「冻结值」 | **被证伪**——任何使依赖变脏的编辑都会覆盖缓存值（A2b 的 B1、A5 的 OFFSET 0.087->2）；引擎未实现函数变 #NAME? 且缓存值丢失（A6）；级联污染引用它的空白名单公式（A7：=A5*2 -> #NAME?） | A2b/A5/A6/A7 |
| 方案 C（剥 f 进档案） | **机制成立**——剥 f 格在强制全量重算后纹丝不动（A9：0.087 保持），下游白名单公式按普通值正常计算（0.174 保持）；级联覆盖结构性不存在 | A9/A9a |

### B.2 关键源码坐标（@univerjs/* 1.0.2 lib/es，实读行号）

| 文件 | 行号 | 内容 |
|---|---|---|
| engine-formula/index.js | 43675 | `CALCULATION_DEBOUNCE_TIME = 10`（重算去抖常量） |
| engine-formula/index.js | 43728-43731 | `_scheduleFlush` 经 `setTimeout` 调度（异步根因） |
| engine-formula/index.js | 43896-43905 | `FormulaCalculationTriggerController`：Node 环境立即 start，浏览器等 Rendered 生命周期 |
| engine-formula/index.js | 15046-15102 | `CalculateController._calculate`（计算入口） |
| sheets/index.js | 17799-17840 | `CalculateResultApplyController`：计算结果回投数据层（SetRangeValuesMutation + applyFormulaCalculationResult） |
| sheets-formula/index.js | 2384-2406 | `ActiveDirtyController`：SetRangeValuesMutation -> dirtyRanges；`onlyLocal: true` 不触发（协同回放抑制点，2398-2401） |
| sheets-formula/index.js | 384-548 | `TriggerCalculationController`：载入/添加 workbook 时按 initialFormulaComputing（默认 1=仅脏区）初算 |
| core lib/types/sheets/typedef.d.ts | 239-281 | ICellData 字段全集（无冻结值字段；custom 注释不建议外部使用） |
| core lib/types/services/resource-manager/type.d.ts | 19-23 | IResources（snapshot resources 侧车载体，方案 C 档案落点） |

### B.3 复现命令

```bash
cd spike/collab-spike && node src/runtime-calc-probe.mjs   # 退出码 0 = 全 PASS
```

---

## 附录 C：档案侧车载体 + 坐标错位（2026-10-21 第三轮外部评审 C 分支）

> 工具：`src/resources-probe.mjs`（架构师）与 `src/archive-shift-probe.mjs`（评审人提供、team-lead 复现）。

### C.1 载体结论（resources-probe）

1. 未注册 resource hook 的自定义 resources 条目随 `save()` 原样读出——侧车载体成立；
2. 「物化 -> 加载 -> 再物化」往返后条目存活，`=IRR(A1:A4)` 原文逐字保留；
3. 剥 f 格往返后不会长回 f（`{v:0.087,t:2}` 不变）——引擎看不见公式的前提在持久化层成立。

### C.2 错位反例（archive-shift-probe，P0）

第 0 行插入一行后（InsertRowCommand 已 await，非时序假象）：缓存值 0.087 实际位置 row4->row5，**档案键停在 row4 不动**，row4 现在是别人的 `{v:44}`。导出时 WI-6 会把 `=IRR(A1:A4)` 写到 row4——静默写错格（不报错、不进降级说明、AC-07/AC-08 双破）。评审人陷阱用例：插行后立刻撤销，坐标「碰巧」重新对齐（cellData 回退、档案没动过）——回归用例必须覆盖「插入后不撤销即导出」。

---

## 附录 D：档案迁移设计实证（2026-10-21 第三轮 P0 补丁裁决依据）

> 工具：`src/archive-migration-probe.mjs`（Node v22.22.2，@univerjs/core|sheets 1.0.2 + yjs 13.6）；**13/13 断言 PASS**。

### D.1 裁决结论

| 裁决项 | 结论 | 断言依据 |
|---|---|---|
| 结构 MUTATION 可拦截 | `sheet.mutation.insert-row` 经 onCommandExecuted 捕获，params 含完整 range——迁移器挂载点成立 | M1a/M1b/M1c |
| 确定性坐标变换对齐 | 插行后缓存值 row4->5，档案键同步迁移到 row5，键值同格；条目内容（f 原文 + v）完整随行 | M2a/M2b/M2c |
| 单事务原子性 | 一次结构 op 的档案迁移恰产生 1 个 Y update 帧（Y.Doc transact 包裹）——对端一次回放原子应用 | M3a |
| 值校验正反例 | 迁移正常：目标格 v === 档案 v 放行；迁移缺失反例：旧键 row4 当前 v=44 != 0.087 拒绝还原 | V1a/V1b |
| undo 反向迁移 | undo 触发 `sheet.mutation.remove-rows`（复数）被同一拦截器捕获，档案键回到 row4 与 cellData 回退一致（非碰巧对齐） | M4a-M4d |

### D.2 新发现的无头坑（已入 Spec §11 / plan.md §4）

1. **undo 触发的 mutation 是 `remove-rows`（复数）而非 `remove-row`**——迁移器 id 白名单必须双形态收录，否则 undo 路径漏迁移；
2. **无头环境执行 `univer.command.undo` 前必须 `focusUnit`**——不聚焦则 undo 恒返回 false 且不抛错（静默失败）；
3. 迁移器对远端回放（`{onlyLocal, fromCollab}`）必须抑制二次迁移——调试期三重应用实证错位（本地迁移 + 回放迁移 + 手动模拟叠加）。

### D.3 复现命令

```bash
cd spike/collab-spike && node src/archive-migration-probe.mjs   # 退出码 0 = 全 PASS
```
