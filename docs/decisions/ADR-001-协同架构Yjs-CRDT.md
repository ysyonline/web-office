# ADR-001: 协同架构采用「Univer Mutation 拦截 → Yjs CRDT 双通道 → Command API 回放」

## Status: Accepted (2026-10-21)

## Background

实时协同是本项目四大核心能力之一，也是唯一可能迫使架构返工的风险项。候选方案：Yjs CRDT 自建 / ShareDB OT / Univer Pro 采购。Univer OSS（Apache-2.0）不含协同（Pro 收费），必须自建同步层。

## Decision

采用 **Yjs 13.6 CRDT 双通道方案**：
1. **内容通道**：单元格值/公式经 commandService.onCommandExecuted 拦截 MUTATION → 映射为 Y.Map<地址,{v,f}> 幂等绝对赋值 → 远端以 {onlyLocal:true, fromCollab:true} 执行选项走 Command API 对账式回放
2. **结构通道**：行列结构操作不幂等，走服务端定序 oplog，按 (client,opId) 去重并跳过自己
3. **awareness**：多人光标/选区走 y-protocols awareness 独立通道
4. 服务端用 Univer 无头模式做权威重算与快照落库——只同步原始输入，计算值由确定性引擎本地推导，输入收敛则结果必然收敛

## Consequences

- 正面：离线容忍强（CRDT 天然合并）；撤销栈零污染（回放 mutation 不入 undo 栈）；架构师 spike 32/32 断言实机验证通过（spike/collab-spike/REPORT.md）
- 负面：撤销远端操作 MVP 不支持（业界默认行为）；并发结构操作幽灵键残留需服务端定序缓解（OPEN-1，Phase 3 落实）
- 否决项：ShareDB OT（断线丢编辑）、Univer Pro（商业授权，能力握在别人手里）、oplog+跳过已应用 op 写法（spike T4c 实证发散）

## Related ADRs

ADR-002（TypeORM 信创数据层）、ADR-003（Univer OSS 选型）

## 修订记录

> 版本说明：v1.0 为本 ADR 主体；v1.1/v1.2/v1.3/v1.4 为审查修订增补（见下方分节），Status 行的 Accepted 日期为 v1.0 定稿日。

### v1.1（2026-10-21，用户对抗式审查打回后修订）

**快照归属权澄清（P0-2）**：原表述「服务端用 Univer 无头模式做权威重算与快照落库」与 openapi 早期版本「客户端上传 snapshot」并存构成矛盾——已裁决：**快照只能由服务端从权威 Yjs doc 物化生成**，客户端无快照上传通道（openapi POST /files/:id/snapshot 已改为无请求体的「触发物化」，响应含 {version, baseSeq}）。本 ADR 的 Decision 第 4 条语义不变，本修订消除其与 API 契约的表述歧义。

**物化水位线（P0-4）**：快照物化必须与水位线（base_seq，物化时已消费的 yjs_updates 最大 seq）**同一数据库事务**记录；加载协议固化为「snapshot@base_seq + updates WHERE seq > base_seq」，消除物化与增量写入并发时的边界丢失。落点：schema.md 3.4、openapi x-websocket.handshake。

**seq 单写者约束（P0-3）**：yjs_updates 的 seq 分配仅单实例协同服务执行（MVP 单实例），(file_id, seq) 唯一索引为最后防线；多实例扩容方案移交 OPEN-DECISIONS（技术备注已补入 schema.md 3.5：候选 a 按 fileId 哈希分片 / 候选 b Redis INCR 发号，扩容触发条件单实例活跃文档 >500 或 CPU >70%）。

**公式收敛前提的显式化（P1-5）**：「输入收敛则结果必然收敛」的前提是公式确定性求值。volatile 函数（NOW/TODAY/RAND/RANDBETWEEN 静态化、OFFSET/INDIRECT 白名单排除）处理规则已显式落于 docs/formula/function-whitelist.md——该文件是本 ADR 收敛根基的组成部分。

**快照体积口径（P0-1）**：快照落库与传输一律 gzip(6)，上限 gzip 后 32MB（100 万格实测最差 ~4.7MB，依据 spike REPORT 附录 A）。

### v1.2（2026-10-21，第三轮审查 P1-2/P2-c 修订）

**协同广播组件澄清（P2-c）**：MVP 协同服务为单实例进程内广播——`CollabBus`（EventEmitter 封装，应用内接口隔离），**Redis 不进 MVP 运行时**；Redis pub/sub 仅在 ADR-004 多实例扩容时引入（ioredis 平替 TongRDS 的信创兼容路线不变）。openapi x-websocket server-responsibilities 已同步。

**服务端重算成本模型细化（替换原「权威重算」模糊表述）**：
- 重算模型：**增量依赖图脏区重算**——非全簿全量重算。服务端 headless Univer 维护每 doc 的公式依赖图，UPDATE 到达只把受影响单元格子图标脏并重算该子图（Univer 公式引擎内建脏区计算）；周期性全量重算仅保留为**日维护任务或显式触发**（如怀疑脏区追踪遗漏时人工触发），不进在线链路。
- **资源预算（MVP 单实例硬上限）**：同时活跃协同 doc 上限 **100**（活跃=有至少一条在线 WS 连接；LRU 淘汰无连接且已物化的 doc 释放内存）；单 doc headless 内存核算——实测 100 万格快照解压后 JSON ~19-30MB，加载进引擎态估计 ~60-120MB（含依赖图），按均值 90MB 计，100 doc 峰值 ~9GB + Node 基线 ~0.5GB，**要求部署内存 >= 16GB**（Spec 部署规格同步）；超限行为：达上限时拒新 WS 连接（close 4412 + 提示），既有连接不中断——先保护在线用户。
- 席位判定口径（P0-3 ③）：席位 = 并发协同用户数（userId 去重，多标签页/多文件计 1 席）；4410「同账号同文件 >=3 连接」是防滥用上限，独立于席位判定。已写入 openapi x-websocket。

### v1.3（2026-10-21，外部评审 Q1 修订：持久化时序与 RPO 显式化）

**增量持久化时序裁决**：每条 UPDATE 的落库语义为 **write-through——先事务提交 yjs_updates、后广播/确认**（loading 协议 snapshot@base_seq + seq > base_seq 增量回放的必然要求：广播的增量必须已持久化，否则重启/LRU 淘汰后无法重建 doc）。允许 group-commit 合并提交，**攒批刷新上界 ≤ 1 秒或 ≤ 50 条（先到为准）**——该上界即 kill -9/OOM 场景的 RPO 上界，禁止实现为无上界内存攒批。seq 取号允许单事务号段预分配（≤ 1000/段），崩溃丢弃未用号段无害（seq 严格递增 + 唯一即可，不要求连续），uq_yjs_updates_file_seq 唯一索引防线不变。

**RPO 口径（首次显式）**：SIGTERM/SIGINT 优雅关闭 → RPO = 0（拒新连接 → 存量广播排空 → 最后一次 flush → WS close 1000，drain 预算 ≤ 30 秒）；kill -9/OOM → RPO ≤ 攒批上界（M3 默认 ≤ 1 秒增量）。**优雅关闭不强制物化快照**：增量已 write-through 持久化，重启按加载协议无损重建；物化是 update 日志压缩，不是持久化边界。澄清：Spec §10 的 30min/500 条/显式保存点是**物化节流参数，不是数据丢失窗口**。

**可替换接口硬约束（P0-3 升格）**：seq 分配（SeqAllocator）、席位计量（SeatMeter）、协同广播（CollabBus）三组件以 TS interface 发包，MVP 默认进程内实现（号段事务分配 / Map 计量 / EventEmitter）——ADR-004 多实例演进时按 OPEN-DECISIONS 候选路径（a 按 fileId 哈希分片 / b Redis INCR 发号）只换实现不换调用方。原 v1.2 的 CollabBus 接口隔离表述升格为 Phase 3 架构硬门槛。

**验证口径**：Spec §9 AC-15（优雅关闭时序断言 + kill -9 重启零丢失自动化用例 + 先持久化后传播时序断言）。落点：schema.md 3.5（v1.5）、openapi x-websocket server-responsibilities、OPEN-DECISIONS（RPO 条目就地 RESOLVED）。

### v1.4（2026-10-21，外部评审 Q2 修订：服务端重算实证缺口闭环）

**Decision 4「服务端用 Univer 无头模式做权威重算」实证裁决（缺口登记后闭环）**：外部评审指出该链路缺少实证（当时仅有「无头可运行」的探针，无「无头可重算」的证据）；架构师以 `spike/collab-spike/src/runtime-calc-probe.mjs`（14/14 断言 PASS，断言汇总见 spike REPORT 附录 B）完成闭环——

1. **无头重算能力成立，不降级**：`commandService.executeCommand('formula.mutation.set-trigger-formula-calculation-start', { forceCalculation: true, ... })`（全量）与 `{ dirtyRanges: [...] }`（增量脏区）在 Node 22 无头环境均实测可用，链路完整：TriggerService 去抖调度 -> CalculateController._calculate -> CalculateFormulaService.execute -> SetFormulaCalculationResultMutation -> sheets CalculateResultApplyController -> SetRangeValuesMutation 回投数据层（源码行号与事件序列见探针头注）。结构操作后服务端权威重算并重发全量单元格状态（REPORT §3 第 3 条）的实施路径成立；
2. **时序约束（硬性）**：重算经 `CALCULATION_DEBOUNCE_TIME = 10ms` 的 setTimeout 去抖异步执行——服务端触发重算后**必须等待完成信号（FormulaCalculationNotification 终态事件）或保守 sleep >= 100ms 再读值/物化/重发**；评审人「无头不触发重算」的观察系同步读回的时序假象（探针 A2a/A2b：同步 B1=3，500ms 后 B1=7）；
3. **回放抑制确认**：协同回放携带 `onlyLocal: true` 时 `ActiveDirtyController.shouldTrigger` 返回 false（sheets-formula index.js:2398-2401）——远端回放不触发接收端重算，与「只同步输入、各端本地重算」的收敛模型一致，无双重重算放大；
4. **对 AC-04/AC-05 的影响**：无口径变更。AC-04 自动重算与 AC-05 重算性能（x86_64 < 200ms / ARM 分片）本就以浏览器端 Univer 为断言主体；服务端重算用于结构操作定序后的权威回发（低频路径），其 10ms 去抖与异步性不进入用户交互关键路径。

**白名单外公式「冻结值」表述的同步修正**：本 ADR「只同步原始输入，计算值由确定性引擎本地推导」的原则不变，但导入的白名单外公式经实证不满足「引擎可推导」前提（引擎未实现 -> #NAME? 且级联）——其载体改为「剥 f 进公式档案」（Spec §10、function-whitelist.md v1.3、import-export/plan.md WI-5 方案 C）：引擎数据层只有值、档案保公式文本，协同同步的「原始输入」对这类格而言就是纯值 + 档案条目，收敛模型闭合。

### v1.5（2026-10-21，外部评审 Q3 修订：档案坐标错位 P0 补丁）

**问题（评审人实证，team-lead 复现确认）**：公式档案以 `formula-archive:{sheetId}:{row}:{col}` 坐标为键，但结构操作（插行/删行/插列/删列/排序/移动剪切粘贴）只作用于 Univer cellData，档案键不随动——插行后缓存值下移、档案键停在原位指向别人的格子，导出时 f 被静默写错格（不报错、不进降级说明、AC-07/AC-08 双破）。该失败模式与 OFFSET/INDIRECT 的白名单排除理由（结构操作后静默偏移）正面撞车：档案侧车把被排除函数的失败模式搬了回来且后果升级。

**裁决：采评审人推荐方案 B（值校验 + 结构 op 同步迁移），迁移为主、校验为兜底**：

1. **主防线——结构 mutation 拦截迁移**：应用层迁移器经 `commandService.onCommandExecuted`（本 ADR 内容通道既有基建）拦截六类结构 MUTATION（`sheet.mutation.insert-row / remove-row / remove-rows / insert-col / remove-col / remove-cols / move-range`），按与 cellMatrix 同构的确定性坐标变换迁移档案键，Y.Doc 单事务完成（一次结构 op 恰好一个 update 帧，spike archive-migration-probe M3 实证）；
2. **undo/redo 同事务反向迁移**：undo 触发 `remove-rows`（复数形态，与 remove-row 不同 id——迁移器须两形态都收录，M4 实证）反向迁移档案键，与 cellData 回退一致；评审人陷阱用例「插入后撤销坐标碰巧重新对齐」由「迁移器捕获 remove-rows」断言排除碰巧性；
3. **双通道生效顺序（定死）**：本地发起——先 Univer cellData 后档案迁移（同一命令执行栈）；远端回放——结构 mutation 回放完成后立即应用同源档案迁移，迁移器对 `{onlyLocal, fromCollab}` 回放不二次迁移（防多重应用——M4 调试期曾因三重应用错位，实证抑制必要）；物化——resources 侧车从权威 Y.Map 整表重写，顺序无歧义；
4. **兜底闸门——导出还原前置值校验**：档案条目补存导入时 v；WI-6 还原 f 前校验「目标格当前 v === 档案 v」，不等即丢弃条目 + 降级说明（可审计）。数据安全优先于文本保真：迁移失效时丢一条公式文本，绝不静默写错格；
5. **主次裁定理由**：迁移保住「公式随格走」的正常体验（结构操作是 Spec §2 P0 内置能力，对含档案文件禁用是方案 C 自身的排除理由复刻）；校验只覆盖迁移器不认识的未知路径（如未来新增结构 op），是闸门不是常态路径。

**实证**：spike/collab-spike/src/archive-migration-probe.mjs 13/13 断言 PASS（M1 拦截与参数完备 / M2 键值对齐 / M3 单事务单帧 / V1 校验正反例 / M4 undo 反向迁移）。附带两个无头坑实证：undo 前须 `focusUnit`（否则静默 false）；undo 触发 remove-rows 复数 mutation。落盘：Spec §10 导入公式策略行、plan.md WI-5 v1.4（规则六至九 + 结构操作族验收用例）、OPEN-DECISIONS（错位 P0 RESOLVED）。变更分类：小改（迁移器为应用层拦截器，无新表新列新端点）。

### v1.6（2026-10-21，PM 桶 I 裁决简注：引擎可用区差分导入对收敛模型的影响）

PM 裁决桶 I 为「引擎可用区差分导入」（方案 b）：导入时对白名单外、引擎可用区（E = I − W − X，393 个）公式做重算值 vs xlsx 缓存值差分，一致则 f 保留参与计算。**对本 ADR 收敛模型的影响：零新增风险**——差分通过的格与白名单公式走完全相同的收敛路径（只同步 f 输入、各端确定性重算，§3.2 等价性论证五环同构）；差分不一致的格降级为方案 C 冻结（纯值+档案），同样在本 v1.5 已闭合的模型内。排除集 X（8：V4 + RANDARRAY + OFFSET/INDIRECT/ANCHORARRAY）以「相同输入必须产生相同输出」为准则机器断言（check_formula_buckets.py G9 非确定性源扫描——引擎产物 Math.random/new Date 调用点全落 X 内）。另：白名单内 volatile 函数（NOW/TODAY/RAND/RANDBETWEEN）导入路径同样静态化（值取 xlsx 缓存值）——防双端加载时刻不同导致的 v 发散（本 ADR Background 收敛前提的导入侧补全）。技术细节落 function-whitelist.md v1.5 §3.3、plan.md WI-5 v1.5 规则 12。

### v1.7（2026-10-21，外部评审分支 E 修订：资源预算模型修正 + 主线程/Worker 裁决）

**背景（评审人三硬事实，team-lead 机器复现全部成立）**：100 万格/99,828 公式单一档下——首编→重算收敛 5,474ms、二次编辑→重算 5,422ms（≈首次，每次编辑都付、非一次性建图成本）；initialCalc=-1（无头加载后不触发全量重算，懒触发，等第一次编辑才引爆）；rss 1,457MB/heap 882MB（序列化体积 22MB 是数据的 1/65，heap 才是真内存成本）。评审人原数据 3,851/3,947ms、1,572/1,465MB heap，数值略高但结论一致（机器负载差异）。

**裁决 1——重算时延红线拆档（出 Spec §9）**：全表 `forceCalculation` 与「编辑→增量脏区重算收敛」时延完全不同，禁混写单一数字。四档：**L0 交互实时档**（≤20 万格、含公式格 ≤2 万，增量脏区子图重算收敛 <200ms P95，主线程同步可接受）；**L1 万行实时档**（100 万格红线场景，可见窗口单格编辑增量重算 <500ms P95，主线程异步）；**L2 全量重算档**（100 万格/10 万公式，forceCalculation ≤10s P95 且不阻塞 UI，异步+进度提示）；**L2b 坏编辑档**（编辑高入度根格被海量公式共同引用、增量脏区退化为近全表子图，与 L2 同档）。原「全表重算 <200ms」在 100 万格档被击穿约 20 倍，根因是**把非实时场景塞进实时档的口径错误**，非引擎能力缺陷。

**裁决 2——AC-04/AC-05 口径闭合**：AC-04 只断言公式正确性（求值 + 依赖变更自动重算），不内嵌任何性能数字；性能数字唯一出处收敛到 AC-05 三档表 + R0/R1/R2 EARS 断言；「编辑→重算收敛时延」进 AC-05（不新增 AC）。消除原「AC-04 断正确性却引用 AC-05 数字、AC-05 断 FPS 却写着全表 <200ms」的实质割裂。

**裁决 3——资源预算模型重写（修正 v1.2 的「序列化体积当内存占用」硬伤）**：v1.2 写「单 doc 60-120MB、活跃 doc 100 上限、部署 ≥16GB」与实测冲突——100 万格序列化仅 22MB/4.1MB，但引擎态 heap 是 1.4GB+；按 16GB 部署 100 个活跃 doc = 150GB，实际只能撑 8~10 个。改为**内存总量预算 + LRU 驱逐**：单 doc 运行时内存 ≈ 200MB 框架基线 + 1.5KB/格（RSS 口径，含公式依赖图 + 值缓存；100 万格 ≈ 1.7GB，对齐实测 1.46-1.57GB 并留上浮余量）。**序列化体积只作落库存储体积（file_snapshots bytea），永久不作为运行时内存预算依据**。16GB 部署 Node heap 硬顶 ~12GB（OS/缓冲预留 ~4GB）、LRU 驱逐触发水位 80%（~9.6GB），100 万格 doc 活跃上限约 5 个、20 万格 doc（~350MB）约 27 个——**政企 MVP 典型负载（万行级 ≤20 万格）16GB 足够，不支持 100 个百万格 doc 同时活跃**。close 4412 触发条件由「doc 个数 ≥100」改为「内存水位超 LRU 硬上限时先驱逐最久未活跃已物化 doc、仍超限才拒新 WS；单个 doc 自身超单 doc 预留预算（如百万格 1.7GB）时拒开该 doc 协同并提示文档过大建议只读/拆分」。

**裁决 4——主线程 vs Worker**：**MVP 采「主线程增量脏区重算 + 异步化 + 进度提示」；Worker 为 P1 高压档终态。**理由：① 常规编辑（单格依赖子图）增量重算时延为 ms 级，白屏根因是「全表/近全表脏区同步重算」而非线程归属——异步化 + 进度提示即消白屏，无需先解决线程问题 ② @univerjs/rpc 1.0.2 确有 `WebWorkerRemoteInstanceService` + `UniverRPCMainThreadPlugin`/`UniverRPCWorkerThreadPlugin`（lib/ 源码已核实），且 `DataSyncPrimaryController` 官方注释明示「只有 spreadsheet 默认同步到 worker」——但该机制语义是**整表引擎态在 worker 再建一份**（`createInstance(snapshot)` + mutation 双相同步 + 结果 mutation 回投），100 万格档 worker 再吃 ~1.4GB、主线程+worker 双份内存翻倍——**放大冲突二而非缓解**，故 MVP 不实装 ③ worker 工程面（worker.ts 构建、公式引擎插件 worker 注册、mutation 双向同步 + 错值/时序回传、协同双端 × worker 的 RPC 一致性盐测）是协同模块之后的一整块独立工作，MVP P0 不背。**架构软约束**：重算触发点收敛到可替换 `CalcDispatcher` 接口（MVP 默认主线程增量实现，P1 换 Worker 只换实现不改调用方）——与 seq 分配/席位计量/协同广播三组件「可替换接口升格」同构，防 Phase 3 把主线程同步重算写死为不可迁移实现。

**实证与排期**：runtime-calc-probe 已证 dirtyRanges 增量 API 无头可用（v1.4）；「单格依赖子图增量重算时延 vs 全表」的定量探针登记为 formula-runtime-spike TASK.md Q5（headless，复用 collab-spike 无头环境），用于复核 L0/L1 档 200/500ms 阈值（当前阈值为评审人实测 + 万行级外推的工程估计，QA 真机基准需复核）。排期影响：Worker 不入 MVP，工期不增；CalcDispatcher 接口占位是既有组件封装工作的自然延伸，不加人日。

### v1.8（2026-10-22，P3-002 spike 实测回填：L0/L1 档位边界修订——team-lead 代行裁定，待架构师复核）

**背景**：formula-runtime-spike 完成（REPORT.md §4）：B1-B10 浏览器探针 16/16 PASS（WI-3/WI-5 门禁放行）；B11/B12 时延拆档与 B11a 拐点曲线（calc-latency-curve.mjs，4 档 × 3 轮）证明 v1.7 裁决 1 的 L0/L1 档位边界与实测不自洽。

**实证（全部 E1，Node v22.22.2 headless，事件计时挂 executionCompleteListener$，形态 10% 公式密度每行 10 个 SUM）**：

- B11a 拐点曲线中位：5k 公式/5 万格 **89ms** → 10k/10 万格 **258ms** → 20k/20 万格 **596ms** → 50k/50 万格 **1175ms**，近似线性 ~24ms/千公式
- v1.7 L0 边界点（2 万公式/20 万格 / 200ms）实测 596ms，**击穿约 3 倍**；L1（10 万公式档 500ms）实测 2404ms，**击穿约 5 倍**
- 机理确认：progress 证实各档单格编辑均只重算 10 个公式——**脏区识别是增量的，时延不是**；瓶颈在 FormulaDependencyGenerator.generate() 每轮对全表公式重建依赖树，单次编辑成本 = O(全文档公式总数)。Univer 1.0.2 无依赖图缓存（clearDependencyTreeCache 机制存在但每轮重建）
- B11c 全表 5227ms ≤ 10s（L2 达标）；B12 高入度根格 3285ms / 99,990 公式（L2b 退化成立）——两档不动

**裁决（候选 c 双轴联动）**：

1. **档位规模边界主轴改公式格数**（格数上限保留作内存预算口径）：时延驱动因子是公式总数而非格数，v1.7 用「格数 + 公式格上限」双限表达掩盖了真实驱动因子。
2. **L0：公式格 ≤ 5,000，200ms P95 不变**（5 千档实测 88/89/159ms，P95≈160ms，余量 1.25 倍；收紧边界而非放宽阈值——200ms 是交互体感锚点，放宽到 600ms 会让「打字即显」退化可感知）。
3. **L1：公式格 ≤ 10,000，500ms P95 不变**（1 万档实测 247/258/274ms，P95≈274ms，余量 1.8 倍）。
4. **新增 L1b 公式密集档（10,001~20,000 公式）：行为承诺不设毫秒值**（2 万档实测 519/596/895ms——500ms 与 800ms 数字承诺均不成立，诚实归行为档；异步 + 进度提示 + 不阻塞）。
5. **越界降级**：公式 >2 万按 L2b 行为承诺 + WI-3 导入时提示文档拆分；**引擎依赖图缓存登记 P1 优化项**（消除 O(全表公式数) 固定成本，Univer 未实现不得作为 MVP 承诺依据）。
6. **政企真实负载判断**：真实文档公式密度通常远低于 10% 合成最坏值（全表公式化属极端场景），L0 5 千公式对万行级典型政企文档仍宽裕；公式密集文档由 L1b 行为承诺 + 导入提示兜底，不牺牲典型场景体验诚实性。

**落盘**：Spec §9 AC-05 档位明细 v1.1（L0/L1/L1b/L2/L2b 五档）+ §10 性能目标行 + §13 变更行；promise-tiering.md（对外口径补公式密度前提）；OPEN-DECISIONS「L0/L1 档位边界不自洽」RESOLVED。

**备注**：本 v1.8 由 team-lead 代行裁定落盘——架构师两次派发均被会话中断且零落盘，为不阻塞后续批次（B5 导入导出消费 AC-05 口径）按其原始任务书的依据与候选方向执行；**待架构师复核**，若推翻则回滚本节与 Spec §9 v1.1。
