# web-office 文档审核索引

> 生成：2026-10-21 | 更新：2026-10-22（**P3-001 工程化基线评审完成轮 + openapi 8 项放行落盘**；P3-002 已于凌晨完成；**D1-13 卡 v1.7 已完成；P3-010-01/02 已交付 monorepo 与 ESLint/Prettier 基线（19/722 包）**，B1 派发前沿 8 包；**仓库已 git init 并完成首提交 5c1d433，156 文件 / 22051 行，无远端未推送**；4 份中间评审文档已归档清理）| 用途：用户统一审核入口 | 状态：Phase 2 完成 + 四轮审查修订 + 外部评审分支 A~F 全部闭环，Phase 3 已放行；**M0 门禁 P3-001 / P3-002 已完成，P3-003 待金仓 license**；**openapi 冻结窗口已解冻并回封，7xxx 段已入契约**

## 审核建议顺序

1. **Spec（规格契约）** —— 全部开发的唯一依据，14 条验收标准 + 12 条内嵌已知坑 + §13 变更记录 **20 行**（含 v1.0.0 首版发布）
2. **三大决策记录（ADR）** —— 协同架构 / 数据层 / 引擎选型，每条附否决理由
2bis. **ADR-005 / 006 / 007（本轮新增）** —— 包管理器 / Tailwind 3 选型 / 自研原子组件，P3-001 七项缺口的④⑥①三项落点
3. **openapi.yaml** —— 18 REST 端点 + WS 帧协议 + 错误码分段
4. **db/schema.md** —— 10 表 TypeORM 契约 + KingbaseES 兼容核对清单
5. **import-export/plan.md** —— xlsx 转换层 6 工作项 + 15 fixtures
6. **design/ 四文件** —— Token 体系 + 组件规范 + 四页面提示词
7. **frontend/theme-font-collab-integration.md** —— 设计-架构集成契约 v1.1
8. **license/design.md + formula/function-whitelist.md** —— 复审新增两份专项设计
9. **spike 报告（含附录 A 实测）+ Phase 1 三文档 + OPEN-DECISIONS** —— 溯源材料，可略读

## 文档清单

| # | 路径 | 版本/状态 | 说明 |
|---|------|-----------|------|
| 1 | docs/spec/Spec-web-office-v1.md | v1.0.0 + §13 变更记录 **20 行**（含首版发布行，主体已同步修订轮） | 规格契约：MVP 范围/技术栈版本锚定（**本轮补全 19 行**）/21 API/10 表/4 页面/15 EARS 验收（含 AC-15 崩溃恢复）/12 内嵌坑 |
| 2 | docs/decisions/ADR-001-协同架构Yjs-CRDT.md | Accepted（v1.1/v1.2/v1.3 三轮修订） | Mutation 拦截→Yjs 双通道→Command API 回放（spike 32/32 实证）；v1.3 增持久化时序与 RPO 口径 |
| 3 | docs/decisions/ADR-002-TypeORM信创数据层.md | Accepted | TypeORM + KingbaseES/openGauss，禁 PG 专有特性 |
| 4 | docs/decisions/ADR-003-Univer引擎选型.md | Accepted | Univer OSS 1.0.2；协同/导入导出因 Pro 收费自建 |
| 5 | docs/api/openapi.yaml | 校验通过（**23 path / 22 schema / 4 response**；**2026-10-22 放行窗口已落 8 项并回封**） | REST + WS 契约；1xxx~6xxx + **7xxx 请求校验（7001-7004 → 400）** + 9xxx 错误码分段；doc-rebuild/LOAD 帧；9 个 Request schema 全部 `additionalProperties: false`；共享错误响应带 `X-Request-Id`；**孤儿 schema 0 / 悬空 $ref 0 / 孤儿 response 0** |
| 6 | docs/db/schema.md | v1.5 | TypeORM entity 契约 + ER 图 + 兼容核对清单 + CI 双跑策略 + 单写者约束 + seq 号段/落库时序 |
| 7 | docs/db/dameng-poc-plan.md | 定稿 | 达梦 PoC 一页计划（1 周 5 人日，通过 gate 5 条） |
| 8 | docs/import-export/plan.md | v1.5 定稿 | 6 工作项/**16 人日**/fixtures；WI-3 突变测试验收 + WI-5 公式档案侧车九规则 + 差分导入（规则 12）+ 结构操作族六用例（陷阱用例置顶）；**WI-3/WI-5 开工前置 formula-runtime-spike 门禁** |
| 9 | docs/design/design-tokens.json | v1.0.2 | 四层 Token（A1/A2/B/C），Univer Canvas 层直接读取 |
| 10 | docs/design/design-tokens.css | 同步 v1.0.2 | CSS custom properties，DOM 层 import |
| 11 | docs/design/DESIGN.md | v1.0.4 冻结（**本轮新增 §12 组件来源与工程化基线**） | 设计系统说明书：原则/组件规范/协同可视化/状态矩阵/前端实现指南/走查清单；§12 含组件来源四分法、外壳原子 14 个清单、与 Univer 样式隔离边界五条（V1-V4 断言）、版本锚定清单 |
| 12 | docs/design/pages.md | 定稿 | 登录/列表/编辑器/管理后台四页实现级提示词 + 政企文案基调 |
| 13 | docs/frontend/theme-font-collab-integration.md | v1.1 定稿 | 集成契约：Canvas 主题注入/字体打包/协同色一致性/banner 挂载点/产物引用白名单（§7）/版本仲裁机制（§8） |
| 14 | docs/license/design.md | v1.4 | License 6 源加权指纹 + 容器权重表 + 换绑流程 + 席位口径 + §2.1-c 拷卷承认（路线 A）+ §2.4 时钟回拨/宽限 + §2.5 国密断言三级 + §6-bis 商务披露；licenses 表增量（active 应用层校验 + max_seen_at） |
| 15 | docs/formula/function-whitelist.md | v1.5 | 119 函数场景集白名单 + 三桶定义（引擎可用区 393/桶 II/桶 III 排除集 X 8 个）+ 差分导入规则七条 + volatile 导入静态化 + 名单外范例锚点；双 CI 门禁（check_formula_whitelist.py G1-G5 + check_formula_buckets.py G6-G9b） |
| 16 | spike/collab-spike/REPORT.md | PASS 定稿（含附录 A 实测） | 协同 spike 32/32 断言报告 + 7 坑 + 降级条件 + 快照体积实测 |
| 17 | docs/decisions/OPEN-DECISIONS.md | **32 OPEN / 21 RESOLVED**（2026-10-22 14:40 机器统计；口径改为「状态单元格以 OPEN/RESOLVED 开头」——旧口径精确匹配 `| OPEN |` 漏掉 1 条写成 `**OPEN**（说明）` 的变体行，故此前各处报 31 均少算 1） | 未决项登记册（均不阻塞开发）。**「工程化基线 7 项缺口」条目已就地 RESOLVED**；**「7xxx 未进 openapi」与「孤儿 SnapshotSaveRequest 待删除」两条已随放行窗口 RESOLVED**；新增 10 条 OPEN（Playwright 离线承载、Tailwind 产物体积、Node 精确锚与信创机一致性、pnpm 12 迁移前提、esbuild postinstall 离线行为、turbo/Nx 复评、type-checked lint 耗时、许可证清单自动化、openapi 代码生成器、G1 方言豁免） |
| 25 | docs/phase3/P3-001-工程化基线裁决记录.md | **本轮新增（P3-001 完成）** | 七项缺口逐项裁决：五问准入判据 + ①②③④ 明细 + 专家冲突裁定 + **openapi 放行清单 8 项（已全部落盘）** + ⑤⑥⑦（pnpm 11.28.6 / ESLint 9 flat / monorepo）+ 定稿补遗五处 |
| 26 | docs/decisions/ADR-005-pnpm包管理器.md | **Accepted v2（本轮新增）** | pnpm **11.28.6**（`latest-11`）；否决 Rust 重写的 pnpm 12.14.0 / npm / Yarn Berry；**pnpm 11 配置模型**：设置迁 `pnpm-workspace.yaml`、`allowBuilds` 取代 `onlyBuiltDependencies`、`autoInstallPeers: false` |
| 27 | docs/decisions/ADR-006-Tailwind3选型.md | **Accepted（本轮新增）** | Tailwind 3.4.19；否决 v4 的**决定性理由**是官方下限 Chrome 111/Safari 16.4/Firefox 128 击穿 Chromium 100+（「氧化物原生不可得」论据已作废，不作理由） |
| 28 | docs/decisions/ADR-007-自研原子组件.md | **Accepted（本轮新增）** | 自研外壳原子 14 个 + Radix 9 个无样式原语（精确版本）；否决 antd/Semi/Arco/Mantine（`^19.2.0` peer 硬冲突）/shadcn CLI；成本对比 7~9 人日（一次性）vs 3~5 人日（持续） |
| 29 | docs/phase3/design/D1-13-请求校验链与API契约生成门禁.md | **v1.7 已完成**（D1-13-01/02 收口 2026-10-22） | 第 13 张设计卡：zod 单一源 → 自研 ZodValidationPipe → 7xxx 码段 → G1 contract-diff；四栏齐全，阻断 P3-011 / P3-012 / P3-037 共 22 包 |
| 30 | scripts/check_openapi_contract.py | **v1.2，实跑 PASS（退出码 0）** | openapi 契约门禁：YAML 可解析 / 7xxx 四码在位 / 孤儿 schema·response = 0 / 悬空 `$ref` = 0 / 9 个 Request schema 均 `additionalProperties:false` / `SnapshotSaveRequest` 已删除。P3-037 的 G1 直接调用 |
| 31 | （已归档清理）D1-13 挑刺审查链 4 份中间文档 | 2026-10-22 清理 | 首轮问题清单 / 二轮回执审核 / 三轮回执 / 四轮审核：结论已全部落盘（卡 v1.7、DESIGN-LAYER v1.4 §2.2、OPEN-DECISIONS），原文移至 `.workbuddy/trash/2026-10-22/`。逐份结论落点见「D1-13 挑刺审查线程」段末归档表 |
| 32 | docs/status-panel.html | **2026-10-22 新增（约 440 KB 自包含单文件）** | 需求/设计/评审/拆分状态面板：101 工作项 × 11 列 + 722 包下钻 + 8 域汇总 + 13 卡写卡/评审状态；自带「文档声明 vs 机读复算」口径校验带；搜索/筛选/排序全前端，无外部依赖 |
| 33 | scripts/gen_status_panel.py | **2026-10-22 新增** | 面板数据聚合器：backlog.csv + DESIGN-LAYER §3.1 + D1-*.md 状态行 + REVIEW-INDEX 线程段 + OPEN-DECISIONS → 单文件 HTML；重跑即刷新，不手填数字 |
| 34 | docs/phase3/ANCHORS.md | **2026-10-22 新增 v1.1** | 包级锚点台账：一包一行写死「产出物路径 / 检查命令 / 通过判据」，含 P3-010 接口签名表与本轮反向验证记录。锚点三项此前**无载体**（只写在包级断言里「本包须填」），此表就是那个载体 |
| 35 | 仓库根（monorepo 骨架） | **2026-10-22 新增，`pnpm verify` exit=0** | `package.json` / `pnpm-workspace.yaml`（pnpm 11 配置模型：`pmOnFail: error`、`allowBuilds`、`autoInstallPeers: false`）/ `.npmrc` / tsconfig 三段 / flat ESLint preset + 两条 P0 规则 / Prettier / `packages/shared` 双构建 / `scripts/check-workspace-deps.mjs`。269 个包、版本精确锚定（pnpm 11.28.6 / TS 5.9.3 / eslint 9.39.5 / prettier 3.9.10） |
| 36 | `.gitattributes` + `.gitignore` | **2026-10-22 新增（仓库纳入版本控制）** | `.gitattributes` 统一 LF（`* text=auto eol=lf`，不随各机 `core.autocrlf` 漂移）；`spike/**/src/vendor/**` 标 `-text -diff` 保持字节原样；`.gitignore` 新增 `.workbuddy/trash/`（本地回收站不入库） |
| 37 | docs/handoff-20261022-144008.md | **临时交接件（2026-10-22 14:40）** | 下次会话优先做 D1-05 设计卡；含「卡不是详设」的口径澄清、D1-05 三包步骤、事实源与硬约束、五个实测坑。结论落盘后按文档纪律移入 `.workbuddy/trash/` |
| 18 | docs/phase1/（三文档） | 含信创增补；**已加「溯源材料非契约」置顶提示 + 过期项就地标注（2026-10-21 晚）** | PRD / 架构选型 / UIUX 方向（溯源材料）。架构选型 §5 Prisma+Redis、§10 技术栈总图、§11「重算<200ms」三处已就地标注为修订/作废，并补当前有效口径；PRD 与 UIUX 加「与 Spec/design 冲突时以后者为准」提示 |
| 19 | docs/performance/promise-tiering.md | v1.0 | 性能承诺分级口径（分支 E PM 裁决）：三级承诺/竞品锚/禁用语/规格承诺表，对外唯一口径出处 |
| 20 | spike/collab-spike/src/perf-scale-probe.mjs | 定稿 | 分支 E 规模-耗时-体积曲线探针（5 档 + 单档隔离），数源：100 万格三硬事实 |
| 21 | docs/phase3/TASKS.md | **v1.4** | **Phase 3 任务拆分与派发计划**：8 需求域 / **101 工作项（含 13 张 D1 设计卡）** / **722 派发包**（每包 1.0-1.2h）；工时总账 **808.0h（101.0 人日）**，其中设计层 42.0h（5.2%）；里程碑 M0-M3 + 7 批次（设计卡随批次前置，**D1-13 排 B1 最前**）；依赖主干（含卡→消费方边）与派单四件套；工时置信度分级 + D1 回填锚点 k_D1（首张实测样本改由 D1-13 提供） |
| 22 | docs/phase3/backlog.csv | **722 行** × 16 列（生成器已加**状态继承**，重跑不抹进度；v1.3 起**首包自动含前置设计卡号**，19 个） | 派发包全量台账（脚本 `scripts/gen_phase3_backlog.py` v1.1 生成，可重算、依赖悬挂即报错）：**包级交付物/包级验收断言**（每包独有，同段多包强制锚点三项）与**工作项交付物/工作项收口断言**分层；生成器自检「包级断言全同的工作项 = 0」；**进度：P3-001 四包 + P3-002 十一包 + D1-13 两包 = 已完成（17/722）** |
| 23 | docs/phase3/DESIGN-LAYER.md | **v1.4** | **开发设计层（D1 设计卡）规范**：回答「开发流程有无设计环节」——v1.0 只有包内「接口与骨架」纪律，跨包决策无载体；裁定按「设计缝」出 **13 张卡（42.0h，覆盖 47 工作项 / 402 包 / 55.7%）**；四栏模板 + 六条硬约束 + 与 Spec/ADR/schema/openapi 的边界 + 反漂移检查；附 backlog 包级断言缺陷修复说明与诚实局限 |
| 24 | spike/formula-runtime-spike/REPORT.md | **P3-002 完成（2026-10-22）** |公式运行时 spike 报告：B1-B10 浏览器探针 16/16 PASS（真渲染栈，载入不冲缓存值/白名单外函数运行时值正确/#NAME? 级联同构/档案侧车端到端全链）——**WI-3/WI-5 开工门禁放行**；B11/B12 时延拆档 + §4.3 B11a 拐点曲线（5k/10k/20k/50k 公式档中位 89/258/596/1175ms，~24ms/千公式线性，依赖生成 O(全表公式数) 固定成本）；10 条工程坑；API 清单。L0/L1 边界修订由架构师裁定回填（进行中） |

## 本轮（等待审核前的）最后修订汇总

### 用户对抗式审查修订轮（2026-10-21 下午，P0×4 + P1×6 + P2×4）

| 项 | 修订内容 | 落盘位置 |
|----|----------|----------|
| P0-1 快照体积 | gzip 实测定上限 32MB（100 万格实测 gzip 4.72MB，7 倍余量）；snapshot 列 text→bytea | openapi.yaml 2003、schema.md、REPORT 附录 A、Spec §10 |
| P0-2 归属权 | 快照仅服务端物化；POST snapshot 改无请求体触发语义，+409/2005 | openapi.yaml、ADR-001 v1.1、Spec §5 |
| P0-3 seq 竞态 | (file_id,seq) 唯一索引 + MVP 单写者约束；多实例候选方案（分片/INCR） | schema.md v1.1、OPEN-DECISIONS、Spec §10 |
| P0-4 水位线 | file_snapshots.base_seq 同事务物化；加载协议 snapshot@base_seq + seq>base_seq；WS 0x03 LOAD 帧 + 重连协议 | openapi.yaml x-websocket、schema.md |
| P1-1 口令 | PBKDF2-HMAC-SM3 ≥10 万轮，存储格式带算法标识支持迁移 | schema.md、Spec §4/§10 |
| P1-2 性能基线 | x86_64 档（i5-12500 级）P95≥50FPS；鲲鹏 ARM 低配档（Kunpeng 920 4C/8G）P95≥45FPS + 分片重算降级口径 | Spec AC-05 |
| P1-3 License | 6 源加权指纹（阈值 0.70+关键项）+ 离线换绑（2 次/年）+ licenses 表 +2 列 | docs/license/design.md（新） |
| P1-4 审计口径 | audit_logs 只记会话级/文件级/管理级；协同明细由 yjs_updates.created_by 承担 | Spec AC-11、schema.md 3.5 |
| P1-5 公式白名单 | 50 函数显式清单；NOW/TODAY/RAND 静态化固化；OFFSET/INDIRECT 排除 | docs/formula/function-whitelist.md（新） |
| P1-6 导入互斥 | doc-rebuild 协议（物化→广播→断开重载，互斥窗拒收 UPDATE） | openapi.yaml import 端点 |
| P2 四条 | 金仓 CI 替代、席位口径、快照保留策略、SheetJS integrity hash | OPEN-DECISIONS（+6 行） |

### 复审打回修复轮（2026-10-21，用户逐项复审 + 实跑 size-probe.mjs 复现附录 A 数据）

| # | 打回项 | 修复 |
|---|--------|------|
| 1 | Spec 主体未同步新契约（§2/§4/§5/§6/AC-01 仍旧文） | Spec 主体全面同步：快照端点触发语义+gzip+baseSeq、表字段/索引（bytea/base_seq/唯一索引/PBKDF2/License 新列）、AC-01 改 PBKDF2 断言口径；变更记录补第 9 条如实记录 |
| 2 | license/design.md 换绑撞唯一索引 + 部署盐表述过强 | DB 唯一索引改普通索引 + active 唯一性应用层事务内校验（禁部分唯一索引）；新增「换回旧机器不被 revoked 历史阻断」验收场景；盐表述降级（design.md v1.1） |
| 3 | function-whitelist.md 计数自相矛盾（52 vs 50）+ 生成源缺解析规则 | 口径统一每函数计 1；删 CONCATENATE/RANK/LARGE 修齐 50；文末规范化数组清单为 whitelist.ts 唯一生成源（v1.1） |
| 4 | 附录 A.2 场景不可复现 + 脚本头注释过时 | 全中文场景并入 size-probe.mjs（seed=7 固定），头注释改实测口径；架构师实跑两遍 A.1/A.2 数值与已发布一致 |
| 5 | schema.md 3.7 实体代码块缺新两列 | fingerprint_items/rebind_count 并入实体代码块，索引改 idx_licenses_fingerprint（schema v1.2） |
| 6 | REVIEW-INDEX 过期（计数/新文档/变更记录数） | 本文件全量刷新（18 项清单、11 OPEN/3 RESOLVED） |

**门禁复检结果（终版）：PASS**——11 项机器校验全过（数组恰 50/全大写/无重复、license 应用层校验+盐降级+换回场景、schema 实体两列+普通索引、probe A.2 档位+固定种子+复现命令），Spec 主体同步项人工逐行核对完成。

### 第三轮审查闭环轮（2026-10-21 下午，用户放行 Phase 3 + 3 P0 首批前闭环，现已全部闭环）

| 项 | 闭环结果 |
|----|----------|
| P0-1 用户管理 API | openapi 补 5 端点（一次性口令/首登改密/最后 admin 保护 1008/不物理删除）；x-error-code-registry 修复缩进缺陷上提根级（原会被解析器丢弃）；Spec §5 同步 |
| P0-2 License×Docker | license v1.2 容器专用权重表（卷级盐 0.40 主权重/.dockerenv 自动切换/hostname 剔除）；宿主机 agent 列 v2；验收 7/8（Docker 默认模式激活成功率/容器重建指纹不漂移） |
| P0-3 WS 三洞 | ticket 换票（query token 废弃）；session-invalidated+4411+60s 复验；席位=并发编辑用户去重（查看不占席/ROLE_UPGRADE 0x05 帧升级瞬间占席/60s 宽限/进程内计量/4410 双口径互不替代） |
| P1 六项 | whitelist v1.2 场景集 119 函数（PM 名单，机器校验逐项一致）；导入保留公式文本+缓存值+提示条+角标（禁静默转文本，WI-5 加 whitelist-foreign 用例）；快照节流三类；增量脏区重算+资源预算（部署 ≥16GB/4412）；CSV 编码探测链；达梦 PoC 假绿防护 |
| P2 七项 | salt 列删除（格式串唯一事实源）；3.6 悬空引用修正；Redis 移出 MVP（CollabBus 进程内）；Node 官方二进制+sm3 启动断言；等保配套五项/浏览器普查/文件移交登记 OPEN；席位口径 RESOLVED（三方定稿） |
| 设计同步 | DESIGN.md v1.0.5 + pages.md §3.10bis（公式提示条 info 蓝系/AlertCircle 角标右上琥珀/与错误标双维区分） |

**终版机器门禁：17/17 全过**（YAML 解析/registry 根级/users 5 操作/ws ticket/ROLE_UPGRADE 帧/session-invalidated/4410 双口径/license 六字段/whitelist 119 无重复全大写/volatile 规则/schema peak_concurrent/Docker 权重表/商务备注；初版 5 项 FAIL 复核确认均为检查脚本编码误报）。**Phase 3 放行。**

### 外部评审分支 A 闭环轮（2026-10-21 下午，Q1 数据丢失窗口质询）

| 项 | 闭环结果 |
|----|----------|
| 前提裁决 | 「30 分钟丢失窗口」不成立——评审人混淆快照**物化节流**（30min/500 条）与增量**落库节奏**（yjs_updates write-through，加载协议倒逼）；但「RPO 从未显式写出」批评成立，已落盘为硬口径 |
| RPO 硬口径 | 优雅关闭（SIGTERM）RPO=0（drain ≤30s）；kill -9/OOM RPO ≤ 攒批上界 **≤1s / ≤50 条先到为准**；禁止无上界内存攒批；优雅关闭不强制物化（增量已持久化，物化仅日志压缩） |
| 吞吐联动定案 | seq 单事务号段预分配（≤1000/段，崩溃丢段无害）+ group-commit——RPO 上界与吞吐参数一体设计 |
| 接口形状升格 | SeqAllocator / SeatMeter / CollabBus 三组件可替换接口（TS interface 发包）升格为 **Phase 3 架构硬约束**（MVP 默认进程内实现，ADR-004 演进只换实现不换调用方） |
| 落盘七处 | Spec §9 AC-15（崩溃恢复 EARS + kill -9 自动化用例）、§10 三条新约束、§13 变更记录第 11 条；schema.md 3.5 两条落库约束（v1.5）；ADR-001 v1.3；openapi x-websocket 落库时序 + 优雅关闭语义；OPEN-DECISIONS Q1 条目 RESOLVED（11 OPEN/4 RESOLVED） |
| 商务口径（PM） | RPO 写进销售物料与招标应答（行业 SLA 层均无 RPO 数字、WPS 365 营销层抢跑「秒级 RPO」——写成可现场断电演练的验收承诺是差异化）；对外保守档 RPO ≤ 60s（实测 ≤1s，留余量），三层口径原文已备、数字待压测定稿 |

### 外部评审分支 B 闭环轮（2026-10-21 下午，Q2 引擎能力边界实证质询）

| 项 | 闭环结果 |
|----|----------|
| 四条硬事实 | team-lead 逐一机器复现属实：无头可用 / 「同步读回不重算」（后被架构师翻案为时序假象）/ ICellData 无冻结字段（typedef.d.ts:239-281）/ 119 ⊆ 542 缺失 0 |
| **时序翻案** | 架构师 runtime-calc-probe 14/14：重算经 CALCULATION_DEBOUNCE_TIME=10ms setTimeout 去抖异步执行——同步读 B1=3，500ms 后 B1=7。「无头不触发重算」是同步读回的时序假象；但评审人两个判定反而**更严重成立**（重算真会发生，缓存值真会被覆盖） |
| 判定闭环 | WI-3「恒真断言」→ 改写带反例突变测试（两种故意错误注入，必须检出）；WI-5「无载体」→ **方案 C 公式档案侧车**（剥 f 只留 v，公式文本存 snapshot resources 官方侧车结构，Yjs 内容通道同步，编辑命中格删条目，导出合并视图还原 f）；级联错误在 C 下结构性不存在（探针 A6/A7 反例 + A9 正例） |
| 服务端重算 | ADR-001 Decision 4 成立不降级：无头可强制重算（set-trigger-formula-calculation-start，forceCalculation/dirtyRanges），硬性时序约束（等完成信号或 ≥100ms）；onlyLocal 回放不触发接收端重算（收敛模型无双重重算） |
| P1 实锤 | IRR 范例失实（白名单内 vs 文档称名单外）→ 换 OFFSET/INDIRECT/AGGREGATE 锚点（引擎已实现+白名单未收录，CI G4 断言固化） |
| CI 门禁 | scripts/check_formula_whitelist.py 五断言（G1-G5 实跑全 PASS）：119 清单规范 / 542 提取法等价 / 子集断言 / 范例锚点 / 分组计数 |
| 开工门禁 | formula-runtime-spike（四问任务书 spike/formula-runtime-spike/TASK.md，1.5 人日，Playwright 主环境+jsdom 烟雾）PASS 才准 WI-3/WI-5 开工 |
| 落盘七处 | plan.md WI-3/WI-5 v1.3、function-whitelist.md v1.3、Spec §10/§13（变更分类：小改）、ADR-001 v1.4、OPEN-DECISIONS（载体 RESOLVED + spike OPEN 12 OPEN/4 RESOLVED）、REPORT 附录 B、CI 脚本 |

### 外部评审分支 C 闭环轮（2026-10-21 下午，Q3 无损互通 + 方案 C 后续验证）

| 项 | 闭环结果 |
|----|----------|
| 复现确认 | resources-probe（save 往返存活/剥 f 不长回）+ archive-shift-probe（插行后值走 row5 档案键停 row4，:91 确认已 await 非时序假象）——team-lead 全部机器复现属实；plan.md 零结构迁移约定属实 |
| 错位 P0 修复 | **方案 B：迁移为主 + 校验为兜底**（评审人推荐路线）——档案条目补存 v；六类结构操作（插/删行列/排序/移动剪切粘贴）经 onCommandExecuted 拦截结构 MUTATION 同步迁移键（Y.Doc 单事务）；undo/redo 反向迁移（undo 实测触发 remove-rows 复数形态）；双通道生效顺序定死；导出前置值校验（v !== 档案 v 即丢弃+降级说明）。archive-migration-probe **13/13**（team-lead 实跑复现） |
| 测试陷阱固化 | 「插入后立即 undo 会碰巧对齐」陷阱用例置顶（断言迁移器捕获 remove-rows，非坐标数值碰巧相等） |
| 桶 I 政策 | PM 裁决**方案 b 引擎可用区差分导入**（team-lead 裁定 RESOLVED 终结双专家分歧）：导入时引擎重算值 vs xlsx 缓存值差分——一致 f 保留参与计算（白名单同权无角标）、不一致自动降级方案 C 冻结；(b) 严格不劣于 (c)；重评触发器 = L5 遥测占比 <5% |
| 伪影修正 | 架构师发现提取法把罗马数字数据表/CONVERT 单位表误收为函数——542 宽松口径含 26 假函数，严格真值 **516**；引擎可用区实为 **393**（= 516 − 119 − X8） |
| 排除集 X | 8 个全部源码级实证：V4 volatile + **RANDARRAY**（Math.random 源扫描新发现）+ OFFSET/INDIRECT + **ANCHORARRAY**（动态锚定引用）；G9 非确定性源扫描机制性防漏（Math.random 6 处/new Date 2 处全落 X 内，引擎升级强制 FAIL 重估） |
| CI 门禁 | check_formula_buckets.py v2：G9/G6b/G7b/G8b（393 定数/X 8 个/与 W 零重叠）+ 既有 G1-G5 回归，全绿（team-lead 实跑） |
| volatile 导入补遗 | 白名单内 NOW/TODAY/RAND/RANDBETWEEN 导入路径同样静态化（xlsx 缓存值固化，防双端加载时刻发散——ADR-001 §1.1 机理导入侧补全） |
| 排期影响 | 12 → 13.5（错位修复）→ **16 人日**（差分管线 2 + 桶判定器 0.5 + 用例 1.5 + CI 0.5）；QA 分两档 L1 生成式 CI 化可压 6-7 → 4-6 人日 |
| 落盘清单 | plan.md v1.4+v1.5、whitelist.md v1.4+v1.5（§3.1 三桶/§3.2 等价性/§3.3 差分七条）、Spec §10/§13（Q3 变更行 + PM 裁决行，小改上限边界内如实记录）、ADR-001 v1.5+v1.6、OPEN-DECISIONS（错位 RESOLVED + 桶 I RESOLVED）、REPORT 附录 C/D、CI 脚本 v2 |

### 外部评审分支 D 闭环轮（2026-10-21 傍晚，Q4 License 指纹；429 限额下 team-lead 亲自裁决落盘，PM 复核待 19:38 后）

| 项 | 闭环结果 |
|----|----------|
| 复现确认 | gm-crypto-probe 5/5（team-lead 实跑：sm3/SM2 曲线/自签自验 70B/sm4 六模式/PBKDF2 58ms）+ design.md 条款逐条属实（卷级盐 0.40 唯一关键项/席位兜底进程内单实例/自认不防整盘克隆/时钟 141 行零覆盖） |
| 拷卷 P0 | **推理链成立**：复制数据卷=复制 License；席位并发兜底对跨实例克隆结构性失效（独立进程/独立库/独立 Map 互不可见）——兜底承诺**废止** |
| 路线裁决 | **A：接受「技术不防克隆」**——License 定位「授权计量与合规凭证」；B 否决（宿主 agent 麒麟+统信×x86+ARM 四象限 systemd 成本，破坏容器交付简易性）；C 并入 A（离线无上报通道，审计导出比对即「集中」） |
| 配套①商务披露 | §6-bis：允许写（离线授权/SM2 防篡改/席位计量/换绑流程）/ 禁止写（一机一码/防拷贝/防克隆——虚假承诺可追责）/ 标准应答句（技术不拦+审计层显形） |
| 配套②时钟 | §2.4 三层：max_seen_at 持久化（回拨改时间无法续期）+ 回拨 >24h 审计告警不误杀（政企时钟事故常见）+ 过期宽限 7 天（只读不锁死+续期引导，AC-09 降级语义不变） |
| 配套③SM2 断言 | §2.5 三级（sm3/SM2 曲线/自签自验真跑，失败拒绝启动）；G4 sm4/G5 PBKDF2 进 CI 不进启动；探针收编固化；鲲鹏复测列 Phase 3 首迭代 |
| 换绑口径 | 维持统一 2 次/年（合同侧上浮；不分演练/更换双额度——申请码层面不可区分）；vMotion 不消耗（指纹不变）；72h 临时授权不做 |
| 落盘 | license/design.md v1.4（§2.1-c/§2.4/§2.5/§6-bis/§5 验收+4 条/废止标注）、schema.md v1.6（max_seen_at 列）、Spec §10 运行时行+License 定位行、§13 变更行、OPEN-DECISIONS 分支 D 行 RESOLVED（待 PM 复核）、gm-crypto-probe.mjs 收编；变更分类小改 |

1. Spec §9 AC-09：License 只读三层防线断言口径（服务端 402/WS 4409 → Command 层守卫 → UI Disabled+banner）
2. Spec §11 新增 2 坑：协同配色 clientId 取模禁用（改 fnv1a32(userId) 哈希）、Univer 挂载早于字体就绪列宽错位（fonts.load 先行）
3. Spec §13 变更记录 +2 条（spike 实证坑回写、设计-架构集成契约冻结）
4. OPEN-DECISIONS：spike/协同深度/xlsx 拆解 3 项 RESOLVED；新增幽灵键（OPEN-1）、awareness 待联调 2 项
5. design 四文件对齐（协同色算法/readonly 三层/banner 挂载点/字体时序，DESIGN.md v1.0.4 冻结）
6. 集成契约文档升级 v1.1（架构师执行中，回传后本表第 13 行改「定稿」）

### 外部评审分支 E 闭环轮（2026-10-21 晚，Q5 性能红线；team-lead 机器复现 + 架构师技术裁决 + PM 商务分级）

| 项 | 闭环结果 |
|----|----------|
| 三硬事实复现 | team-lead 单跑 100 万格（SCALES=1000000 隔离）：首编重算 5,474ms / 二次编辑 5,422ms（≈首次，非一次性建图成本）；initialCalc=-1（懒触发；与分支 B 10ms 去抖一致）；rss 1,457MB / heap 882MB vs 序列化 22.39MB / gzip 4.10MB（差异 40~65 倍）。评审人原数据 3,851/3,947ms、1,572/1,465MB，数值略高但结论一致 |
| 冲突一（重算 200ms 击穿 20 倍） | **口径错误非引擎缺陷**：原「全表重算 <200ms」把非实时场景塞进实时档。架构师裁决拆四档——L0 交互实时（≤20 万格增量脏区 <200ms）/ L1 万行实时（100 万格可见窗口增量 <500ms）/ L2 全量（forceCalculation ≤10s 异步不阻塞 UI）/ L2b 坏编辑（高入度根格近全表退化为 L2）。全表与增量分离断言 |
| 冲突一（AC-04/AC-05 分裂） | AC-04 只断公式正确性（移除内嵌性能数字）；性能数字唯一出处收敛 AC-05 档位明细 + R0/R1/R2 EARS；「编辑→重算收敛时延」进 AC-05 不新增 AC |
| 冲突二（序列化当内存预算） | ADR-001 v1.2「单 doc 60-120MB、活跃 100 上限、≥16GB」证伪（序列化 22MB 但 heap 1.4GB+，16GB 撑 100 doc 实际只能撑 8~10）。改**内存总量预算 + LRU 驱逐**：单 doc ≈200MB + 1.5KB/格 RSS 口径；序列化体积只作落库存储（file_snapshots）；16GB 支撑政企典型万行级负载、不支持 100 个百万格 doc；close 4412 改内存水位触发 |
| 冲突三（3.8s 主线程白屏 + Worker 未明确） | 源码核实 `@univerjs/rpc` 1.0.2 确有 `WebWorkerRemoteInstanceService` + 双插件，但官方语义是**整表引擎态 worker 再建一份**（100 万格内存翻倍，放大冲突二）。裁决：**MVP 主线程增量脏区重算 + 异步 + 进度提示**（白屏根因是全量同步重算非线程归属）；Worker 为 P1 高压档终态；重算触发点收敛 `CalcDispatcher` 可替换接口（Phase 3 硬门槛） |
| PM 商务分级 | 废除「重算 <200ms」单一承诺 → **三级承诺**（≤1 万行 <300ms / 1~5 万行 <800ms / >5 万行只承诺行为）；竞品锚（腾讯/Google/WPS/Excel Online 均无全表重算 SLA）；禁用语清单；信创国标 5s/20s 合规护城河。落盘 docs/performance/promise-tiering.md（唯一对外口径） |
| 待回填 | 规模硬上限已由架构师定稿（维持 100 万格，不向竞品 1000 万格对齐——1000 万格单 doc ≈14GB 击穿 16GB 预算，属容量红线登记 P1）；L0/L1 阈值真机复核随 formula-runtime-spike Q5 + Phase 3 性能验证 |
| 落盘清单 | Spec §9（AC-04/AC-05 拆档 + 性能档位明细表 P0/P1/P2/P2b + F-x86/F-arm）、§10（资源预算行/重算线程员归属行/close 4412 语义）、§13 变更行；ADR-001 v1.7（资源预算模型修正 + Worker 裁决 + 四档时延表）；OPEN-DECISIONS 分支 E RESOLVED；formula-runtime-spike TASK.md 补 Q5（单格依赖子图增量重算时延 vs 全表 + 高入度根格回退定量）；docs/performance/promise-tiering.md（新）；perf-scale-probe.mjs 收编固化 |

> 变更分类：小改（不加端点、不加表、不加列；性能断言分层不影响功能路径；CalcDispatcher 接口占位为既有组件封装自然延伸，排期不增）。

### 外部评审分支 F 闭环轮（2026-10-21 晚，Q6 国产库；team-lead npm/镜像路径复现 + 架构师裁决落盘）

| 项 | 闭环结果 |
|----|----------|
| 驱动实证 | team-lead 复现 npm registry 实查：`dmdb` v1.0.52452 官方包（maintainer dameng_database@dameng.com，2026-07-22 更新）、依赖仅 iconv-lite、peerDeps snappy/snappyjs 均 optional、无 install 脚本 = **纯 JS 无 node-gyp 编译链**；`dm8`/`dameng` 404。dameng-poc-plan.md §2 前置顾虑划掉改「已实证」，§6 node-gyp 风险行证伪降级 |
| 主问题裁决（金仓真机验证放哪） | **方案 b 提前锚点**：Phase 3 M1 脚手架期金仓真机「契约冒烟」（10 表 DDL + 每表 repository CRUD + information_schema 反查 + 敏感点断言，约 1 人日，不跑全量），Phase 4 全量回归维持；金仓进 CI 否决（无公开镜像 + license 人工流程不满足自动化前提，schema.md §7.5 论证）。排序依据：回溯成本不对称——金仓是主库契约验证（爆雷回溯 schema→Spec §6→openapi→ADR-002 全链），达梦是次优先适配（爆雷只改方言层），故**金仓先行、达梦 PoC 随后共用环境获取窗口** |
| version() 解析（评审人未查到项） | 架构师静态核对 typeorm@0.3.27 源码：金仓版本串（KingbaseES 开头）不命中 `/^PostgreSQL ([\d.]+).*$/` 正则，整串进 driver.version，isGeneratedColumnsSupported 误判 false（保守侧）——但该 flag 全包零消费方、项目未用 generated columns/identity，**实际影响零、无需打补丁** |
| 附带新发现 | **TypeORM 自动 RETURNING 旁路**（评审人与项目此前均未核对）：@CreateDateColumn 触发 getInsertionReturningColumns，repository.save() 每条 INSERT 无条件自动带 RETURNING（isReturningSqlSupported 恒 true 无版本门控）——§4.2「禁 RETURNING」此前只管手写 SQL。金仓 PG 模式兼容性静态无法判定，列 M1 冒烟断言 5，不兼容则方言层 save 后显式回查；OPEN-DECISIONS 新条目登记 |
| 环境获取 | 本机实测三路全失败（无 Docker / harbor.kingbase.com 超时 / 官网授权页 404）= 流程性硬约束；action：架构师立即发起官网 license 申请（不等 M1 开工，3-5 工作日），商务协助；路径与责任方落 schema.md §7.4 |
| 落盘清单 | schema.md v1.7 新增 §7（三层验证状态/冒烟断言五条/version() 静态核对/环境获取路径/CI 否决论证）；dameng-poc-plan.md（排序裁决段 + dmdb 实证 + 风险表）；OPEN-DECISIONS（金仓 CI 条目升格方案 b + 达梦条目更新 + 分支 F RETURNING 新条目 OPEN）；Spec §10 国产库验证锚点行 + §13 变更行；ADR-002 Decision 5 + Decision 2 实证补强 |

> 变更分类：小改（M1 冒烟 1 人日从脚手架预算内吸收；不加端点不加表）。评审人核心判定「契约冻结顺序倒置」成立并已修正——冻结语义改为「冻结于 PG 血统语义，金仓真机锚点 M1 期收口」。

### 收尾评审轮（2026-10-21 晚，六分支总结：三档开工清单 + 证据分级 + 契约纪律）

| 项 | 闭环结果 |
|----|----------|
| 三档开工清单 | 档一（阻塞 Phase 3 首批）：公式运行时 spike 1.5 人日（B/C 结论的唯一依据，非「验证」）> 金仓契约冒烟 1 人日（license 申请已发起，**指定开发版 365 天**）> 档案键迁移落码（依赖 spike）。档二（开发期硬约束）：四可替换接口（SeqAllocator/SeatMeter/CollabBus/CalcDispatcher 形状不可写死）+ SM2 三级断言 + 白名单 CI 门禁 + WI-3 突变测试 + 陷阱用例置顶。档三（可延后）：席位跨实例/Worker/达梦 PoC/金仓 CI/等保配套。落盘 docs/decisions/REVIEW-CLOSING.md |
| 证据分级 | 实测 5 条（可复现可引用）vs 评审人判断 4 条（鲲鹏 45FPS/10% 公式密度/克隆高频/桶 I 降级率——**不得当事实引用**，Phase 3 真实数据复核）vs 残余开放（鲲鹏 aarch64 零实测/金仓零真机/全部数据出自 x86 Windows 单机） |
| 契约纪律 | **「这条是实测还是推定」成为 Phase 3 起每条契约的必填字段**——E1 实测/E2 静态/E3 推定三级标注，E3 必须带升 E1 的验证锚点；存量条款首次触碰时回溯补标。回应评审人总判断：「契约写得太满、支撑实证太少」是本版系统性风险 |
| 金仓获取线索 | 下载试用入口（产品与方案→通用型数据库→下载试用，手机号+验证码）、**开发版 365 天** vs 标准/企业 90 天（申请指定开发版）、官方 Docker 镜像介质可申请下载（内置 90 天授权，可入私有 registry）、热线 400-601-1188；schema.md §7.4 已同步、§7.5 措辞修正（「无公开镜像」→「无公共 registry 镜像 + 官方提供可申请介质」，CI 重评口扩为三条件），v1.7.1 |
| 评审人自述 | 写过 4 个探针、被翻案两次（时序假象/542→516）、翻过我们两次（档案错位/内存预算）——对抗式评审双向纠错机制有效 |

### P3-002 公式运行时 spike 完成轮（2026-10-22 凌晨，M0 门禁第一项闭环）

| 项 | 结果 |
|----|------|
| B1-B10 浏览器探针 | **16/16 全 PASS**（Playwright Chromium 真渲染栈，UI 全链 9 插件）：载入时初算不冲缓存值（Rendered ~560ms 后 1s 观察窗逐字节保留）；OFFSET/AGGREGATE/INDIRECT（含 R1C1）运行时值正确；#NAME? 级联 + IFERROR 捕获同构；saveUnit 往返档案零丢失；双端 Yjs 同步 + 服务端物化一致。**WI-3/WI-5 开工门禁放行** |
| B11/B12 时延拆档 | 低入度单格编辑 2404ms（progress 证实只重算 10 公式——脏区识别增量、时延非增量，瓶颈在依赖生成全表重建）；全表 5227ms；高入度根格 3285ms（L2b 成立）；星型依赖图初算值稳定 113.9s（异常发现，已登记 OPEN） |
| B11a 拐点曲线（§4.3 补测） | 5k/10k/20k/50k 公式档中位 89/258/596/1175ms——**现行 L0 边界点（2 万公式/20 万格）实测 596ms 击穿 200ms 断言约 3 倍**；时延 ~24ms/千公式线性（O(全表公式数) 固定成本）；L1（500ms@10 万公式档）同样击穿约 5 倍 |
| 工程坑 10 条 | 双 React 三种内联形态去重 / 双 redi 实例（bundle 内联副本必须手写 shim）/ import map 自指 / resolveBare EISDIR / createPortal / token 对象查找 / getRenderAll 返回 Map / Playwright 镜像 / import map 注入时机 / node:v8 ESM 导入——随 P3-001 工程化基线评审归档 |
| 遗留移交 | ① L0/L1/L2b 边界修订：已随 Spec §9 v1.1 档位表落定（L0 公式 2 万→5 千、L1 收紧至 1 万、新增 L1b）② 星型依赖图 OPEN 已登记（WI-3 导入层需识别高入度根格形态加保护）③ ~~P3-001 工程化基线评审等用户主持~~ **已于 2026-10-22 完成** ④ P3-003 金仓冒烟等 license（申请中 3-5 工作日） |

### P3-001 工程化基线评审完成轮（2026-10-22，M0 门禁第二项闭环；B1 批次唯一前置）

| 项 | 结果 |
|----|------|
| 七项裁决 | ① 组件库：**自研外壳原子 14 个 + Radix 9 个无样式原语 + Tailwind 3.4.19**（否决 antd/Semi/Arco/Mantine `^19.2.0` peer 硬冲突/shadcn CLI）② 表单校验：**react-hook-form 7.90.0 + zod 4.6.7 单一 schema 源落 `packages/shared`**，后端自研 `ZodValidationPipe`，class-validator/class-transformer/nestjs-zod 不进依赖树 ③ 测试：**Vitest 5.0.5（前端）/ Jest 30.5.2 + ts-jest（后端）**，编辑器页不上 jsdom 全推 Playwright ④ API 文档：**@nestjs/swagger 11.4.7 降级为校验源**，openapi.yaml 仍为契约唯一事实源，CI G1 contract-diff 强制相等 ⑤ 包管理器：**pnpm 11.28.6**，`pnpm-workspace.yaml` 承载配置（pnpm 11 模型变更） ⑥ 规范：**ESLint 9.39.5 flat config + Prettier 3.9.10** + 两条自定义 P0 规则 ⑦ monorepo：**pnpm workspace 内置，不引入 turbo/Nx** |
| 五问判据 | npm 可取 / 无固定 CDN 外链 / 无原生编译链（有则过四象限）/ 许可证（MPL 标注，GPL·AGPL·SSPL 红线）/ 版本矩阵无冲突 |
| 纪律纠偏 | 「信创原生二进制不可得」两度被证伪（esbuild/rollup/rolldown/lightningcss/@tailwindcss/oxide 的 aarch64 产物**全部存在**，glibc 下限均 2.17）。真实否决理由必须写准——Tailwind v4 是浏览器下限 Chrome 111 击穿 Chromium 100+；Vite 8 是 rolldown + lightningcss（MPL-2.0）双必需路径无 JS fallback。另有一条「DNS 缓存」建议因**无出处**被撤回，已记为纪律实例 |
| 专家冲突裁定 | ② 项前端 v1.1「双写 + 共享夹具」vs 后端 v2「单一源」→ **采纳单一源**。理由：前端撤回前提（须改 (c) 重开冻结）不成立（openapi 仍是契约事实源，zod 只是校验规则源），且双写即便配夹具也留静默区 |
| 冲突二（pnpm 版本） | 我误按 pnpm 10 习惯写配置，架构师终审纠正：pnpm 11 非注册源设置**不再从 `.npmrc` 读取**，`onlyBuiltDependencies` 已由 `allowBuilds` 取代；版本取 `latest-11` 的 **11.28.6**（不取 `next-11` 的 11.28.7）。ADR-005 已重写 v2 |
| **你已裁决（已执行）** | ~~openapi.yaml 待放行清单 8 项~~ → **你选「全部 8 项一次放行」，当日已落盘并机器复核**：① 7xxx 段四码（7001 请求体 / 7002 查询越界 / 7003 JSON·multipart / 7004 路径参数，均 → 400）② `components.responses.BadRequest` 新增并挂到 18 个操作 ③ 9 个 Request schema 补 `additionalProperties: false` ④ 6003 detail 对齐 `errors[]` ⑤ Error 补 detail 形态声明 ⑥ info.description 补「契约事实源声明」⑦ 孤儿 `SnapshotSaveRequest` 删除 ⑧ 四个共享错误响应带 `X-Request-Id`。复核：YAML 解析通过、孤儿 0、悬空 0 |
| 落盘清单 | Spec §4（+19 行技术栈 + Node 精确锚 22.22.2 + 图标红线边界 + Tailwind×Univer 样式隔离约束）、§13 变更记录（+2 行）；DESIGN.md 新增 §12；**ADR-005 / 006 / 007（新）**；OPEN-DECISIONS「工程化基线 7 项缺口」RESOLVED + 新增 10 条 OPEN；**DESIGN-LAYER.md v1.2（12→13 张卡）** + **D1-13 设计卡（新）**；TASKS.md v1.2；backlog.csv 重算 722 包 / 808.0h；**openapi.yaml 8 项放行 + `scripts/check_openapi_contract.py`（新，常驻门禁）** |
| 排期影响 | +2.4h / +2 包（D1-13，B1 最前）；P3-001 四包状态改「已完成」，**D1-13 与 P3-010 已解除阻塞** |

### D1-13 挑刺审查线程（2026-10-22 10:43-12:33，B1 派发前最后一道设计评审）

| 项 | 结果 |
|----|------|
| 线程结构 | 挑刺问题清单（10:43）→ 技术团队回执 → 二轮回执审核（11:14）→ 三轮回执致团队（11:52）→ 回执后核验勘误（12:33，N-1/N-2/N-3） |
| 问题总量 | 首轮 13 项 + 二轮新 P0（4 端点 400 覆盖假通过 + 门禁只打印不断言）+ P0-3 第三状态 + 三轮纪律审计 3 项 + 回执后核验 3 项 |
| 核心沉淀 | ① G1 门禁三段口径（类型面归一化全等 / 文档面覆盖率 / 扩展面键集；散文面无「等」比对，权威靠独占成立）② 码段事实源倒转（registry 实况 > D1-05 任务书）③ 核数必须核数的理由与断言强度（打印行 ≠ 机检结论）④ 一页上限的对偶义务：变更史属回执文档不属卡；度量卡体量用字符数（E-CV 行实测 739 字符）⑤ 双源坑第三形态：手工改 CSV 必须同步生成器并重跑 diff 验证 ⑥ 出处不引行号（活跃变更文件按 schema 名/§符号 grep，行号结构性漂移）|
| 派发基准 | **D1-13 卡 v1.7（已定稿并收口）**；P3-011 / P3-012 / P3-037 首包以它为准；P3-037 九包收口已挂「contract-diff.mjs 归一化规则表产出并回填」义务（生成器已同步，重跑 diff 已验证一致） |
| 仍开口 | ① 4 端点补挂 BadRequest（停用户裁决）② 400 覆盖升机检（从动于 ①）③ P3-033 组件工时重估（B1 派 P3-033 前定稿）④ pnpm 行为级验证 / 版本时效重验 / jsdom 回退执行人（P3-010 末包）⑤ 垃圾文件清理（停用户确认） |

#### 中间评审文档归档（2026-10-22 14:00 清理，用户指令「已落盘就不要保留」）

| 原文件（已删除，原文在 `.workbuddy/trash/2026-10-22/`） | 结论落点（逐条核验过） |
|---|---|
| `D1-13-挑刺审查-20261022.md`（首轮 P0×3 / P1×5 / P2×5） | 7xxx 放行对齐 → 卡 ③ 节；D1-05 码段倒转 → DESIGN-LAYER §3.2 条 1；coerce/7003/V-S2 → 卡 ①③；P0-3 组件工时 → OPEN 第 55 行；P2-1/P2-2/P2-4 → OPEN 在册；P2-5 垃圾文件 → 已清理 |
| `D1-13-挑刺审查-二轮回执审核-20261022.md` | 贴边取样缺口 → **卡 ④ 栏 E-CV 行**「按 yaml 边界值 ±1 贴边生成，禁止远离边界」；OK1 假通过 → P3-001 §4 勘误块 |
| `D1-13-挑刺审查-三轮回执-20261022.md` | N-1 伪出处 → **卡 ① 栏 query/path 前置行**出处＝「本卡新定」；N-2 → **生成器 ITEMS 的 P3-037 条目** contract-diff 回填句；N-3 → 本索引；P3-037 九包收口义务 → CSV + 生成器双源一致 |
| `D1-13-挑刺审查-四轮审核-20261022.md` | N-1/N-2/N-3 同上；N-4 字符数度量 → **DESIGN-LAYER §2.2 条 1**；「不引 openapi 行号」→ **§2.2 条 7**（本轮新补） |
| `handoff-20261021-192535.md` | 「外部评审分支 A~D 闭环轮」四段 |
| `handoff-20261021-223521.md` | 「收尾评审轮」段 + TASKS v1.2 / DESIGN-LAYER D1 设计层 |
| `handoff-20261022-062016.md` | 「P3-002 公式运行时 spike」「P3-001 工程化基线评审完成轮」两段 |
| `handoff-20261022-131219.md` | 本段（D1-13 挑刺审查线程） |

**清理纪律（本轮立）**：中间评审文档可删的前提是**结论已落到卡 / 设计层 / OPEN / 生成器 / 台账**；只写在评审文档里的规约，先补进 `DESIGN-LAYER §2.2` 硬约束，再删原文。删除采用移入 `.workbuddy/trash/<日期>/` 而非 `rm`，可恢复。

### 状态面板上线 + 覆盖口径勘误（2026-10-22 14:00，用户「要一个面板」）

| 项 | 结果 |
|----|------|
| 交付 | `docs/status-panel.html`（约 440 KB 自包含，双击即开）：KPI 7 项 → 口径校验带 → 四问卡片 → 8 域汇总 → 13 卡写卡/评审表 → 101 工作项明细（可搜索/按域·泳道·设计状态·评审状态筛选/点列排序/点行展开 722 包清单） |
| 数据链 | 全部机读：`backlog.csv`（101 项 / 722 包 / 807.5h / 17 已完成）+ `DESIGN-LAYER §3.1`（卡覆盖）+ `D1-*.md` 状态行 + `REVIEW-INDEX` 线程段（判定「是否评审」）+ `OPEN-DECISIONS`（未决计数）。生成器 `scripts/gen_status_panel.py`，重跑即刷新 |
| 四问答案 | ① 需求评审：6 域有专项评审线程，**R2 仅基线覆盖（无专项记录）** ② 设计文档：13 卡全部立项，**只有 1 张（D1-13）写出卡文件**，覆盖 49 工作项 / 418 包 ③ 卡评审：**1/13**（D1-13 四轮闭环），其余 12 张连卡都没有 ④ 拆分：101/101 全拆完，722 包，当前可立即派发 8 包 |
| **新发现 D-4（P2，已修）** | **DESIGN-LAYER 的覆盖总数是 D1-13 补入前的口径**：文档写 47 工作项 / 402 包 / 446h，机读复算 49 / 418 / 463.9h。差值恰好 = P3-011（7 包 7.98h）+ P3-037（9 包 9.99h）= 16 包 17.97h（P3-012 同时被 D1-11 覆盖未重复计）。即 D1-13 新增了两个此前无卡覆盖的工作项，但总数没跟着加。已改 DESIGN-LAYER（3 处）+ TASKS（4 处 402→418），面板口径校验带现显示「✓ 一致」；口径未变，只是数字对齐 |
| 面板自带防线 | 生成器会解析 DESIGN-LAYER「去重后 N 个工作项 / M 包 / H h」并与机读值比对，不一致时校验带直接转红——把「改了卡表忘改总数」这类漂移变成页面上的红条，而不是靠人记得去核 |

### B1 派发前沿盘点（2026-10-22 13:32-13:50，卡号贯通修复）

| 项 | 结果 |
|----|------|
| 触发 | 用户「继续」——上一份交接（2026-10-22 13:12，已归档清理）的 next steps 3（B1 派发启动） |
| 机器盘点 | 已完成 15 包（P3-001×4 + P3-002×11）；**可立即派发 9 包**：P3-003-01（等金仓 license，环境未到位）、P3-010-01、D1-13-01、D1-05-01、D1-09-01、D1-07-01、D1-01-01、D1-08-01、D1-12-01 |
| 新发现 D-1（P1，已修） | **消费方首包「本包范围」全库零卡号引用**（0/722）→ TASKS §4bis 派发校验「未引用卡号即退回」对 402 个受卡覆盖的包**全部不可满足**；D1-13-02 收口断言（消费方首包已引用卡号）永不可能通过。修法：生成器从 ITEMS 的 `deps` 列派生卡号写入首包范围（单一来源，不另设映射表），重跑后 19 个首包含卡号（13 开发工作项 + 6 卡间依赖），差异面 20 个字段、其余 702 包逐字段不变 |
| 新发现 D-2（P1，已修） | **P3-037 → D1-13 依赖边缺失**：卡「消费方（首包）」行、TASKS §3 依赖主干、DESIGN-LAYER §3.1 三处均声明 P3-037 消费 D1-13，生成器 ITEMS 只写了 P3-011 / P3-012 → 文档声明 3 处、台账 0 处。已补，P3-037-01 依赖变为 `P3-010-11\|P3-036-07\|D1-13-02` |
| 新发现 D-3（P2，已裁决关闭） | DESIGN-LAYER「覆盖 47 工作项 / 402 包」在台账层只有 13 个工作项有载体（另 6 个卡间依赖）；D1-05 标称「720 全量引用」机检只能查 4 个直接消费方 → **用户裁决「暂按 13 工作项门禁」**：DESIGN-LAYER v1.4 覆盖口径拆两栏（设计意图覆盖 47/402 vs 门禁覆盖 13/19），派发校验只对后一栏成立 |
| 用户裁决（14:00 执行完毕） | ① **4 端点补挂 BadRequest** → 挂 400 操作 18→**22/29**，余 7 个全 no-param；脚本 v1.2 把「带参未挂 400」升为 FAIL 断言（反向验证 exit=0↔1）② **垃圾文件全部清理** → 根目录 5 个 0 字节误产物 + `gm-probe-out.txt`（GBK 乱码，实测结论已在 license design 留档）已删，根目录只剩 docs/scripts/spike/.workbuddy ③ **覆盖口径暂按 13 工作项门禁** → DESIGN-LAYER v1.4 两栏、D1-13 卡 v1.7 |
| 终态核验 | 722 行 / 807.5h（包级四舍五入累计，工作项口径仍 808.0h）/ 状态：707 待派发 + 15 已完成（继承未丢）/ `check_openapi_contract.py` **v1.2 exit=0（带 FAIL 断言）** / OPEN **31** / RESOLVED 22 |
| 仍停用户裁决 | 无（上升为 B1 派发执行：D1-13 两包已置「已完成」，可立即派发 8 包；P3-011-01 / P3-012-01 / P3-037-01 仍分别等 P3-010-11 / P3-011-07 / P3-036-07）|

### k_D1 实测重估（2026-10-22 13:50，用户「重估」）

| 项 | 结果 |
|----|------|
| 测量口径 | 会话录像 `~/.workbuddy/projects/d-code-web-office/*.jsonl` 毫秒时间戳；跨会话并行区间取**并集**；相邻消息间隔 >20min 视为中断不计。首次用该口径（此前估时靠回忆） |
| 实测 | D1-13 并集活跃 **3.68h**，其中归属 D1-13 **2.66h**（7599b883 与 P3-001 共享按提及比例 0.23 → 0.31h / 1fa4bcd4 0.10h / bd4dff1e 0.88h / 07bcee24 1.38h）；读数由新脚本 `scripts/session-effort.py` 复现 |
| 系数 | **k_D1 = 2.66 / 2.4 = 1.11**；敏感度区间 [0.98, 1.19]（初稿归属 0~0.5h），全在 1.5 阈值内 |
| 处置 | **不乘系数**：其余 12 卡 39.6h 维持原估，总账仍 808.0h / 722 包。若按上限 1.19 全域重估 = +7.5h（0.9%），需连带重算全部派生数字，收益低于估算自身误差 → 不做 |
| 构成实测 | 2.4h 里「起草 + 落盘」仅 ≈0.4h，**审查/挑刺/回执 ≈2.25h（85%）**——原估算把这部分隐含在「冲突消解」段未明说。余下 12 卡按「起草 0.4h + 审查 2.0h」分配；再撞历史包袱（D1-05 码段、openapi 400 类）则**单卡 +1.2h**，不开全局乘数 |
| 自我更正 | **上一轮「k 会显著 >1.5、须重估 12 卡」是印象读数，已被实测推翻**（真实 1.11）。同源教训：2026-10-22 上午「计数必须从机器输出读数」——工时同理 |
| 样本偏差登记 | D1-13 是**最脏的一张卡**（同日撞 7xxx 放行未传导 / registry 码段撞车 / openapi 400 缺口三件历史包袱），k=1.11 是**上限值**；k ≤ 1.5 只能证明「不需要全局乘数」，**不能反推其余 12 卡一定够用** |
| 落盘 | `docs/phase3/TASKS.md` §7bis（表 + 敏感度 + 处置四则）、v1.3→v1.4；`scripts/session-effort.py`（新，测量口径固化）；`backlog.csv` D1-13-01/02 → 已完成（重跑继承 17 条，722 包 / 808.0h 不变） |

### B1 代码基线落地：P3-010-01/02（2026-10-22 14:20，用户「继续推进项目进度」）

| 项 | 结果 |
|----|------|
| 交付 | monorepo 骨架 + TS/ESLint/Prettier 基线；自检入口 `node scripts/verify.mjs`（= `pnpm verify`）**5/5 段通过、exit=0**：格式 → eslint `--max-warnings=0` → tsc → 规则测试 → 依赖面断言，逐段打印耗时 |
| 版本锚定 | 按 P3-001 §5.1/§5.2 逐项精确锁定并**实测可装**：pnpm 11.28.6 / TS 5.9.3 / eslint 9.39.5 / typescript-eslint 8.72.0 / prettier 3.9.10 / @types/node 22.20.5 / zod 4.6.7。装完 269 个包 |
| pnpm 11 配置模型 | `.npmrc` 只留 registry；`pmOnFail: error`（默认 download＝离线环境无声联网）、`engineStrict`、`saveExact`、`autoInstallPeers: false`（否则 swagger peer 把 class-validator 装回来，击穿 zod 单一源）、`allowBuilds`（esbuild true / `@scarf/scarf` false）全在 `pnpm-workspace.yaml` |
| 三条 P0 可机检 | `wo/no-emoji`、`wo/no-hardcoded-color`、`no-restricted-imports`（10 个第二图标源）→ 均 error 级；`pnpm lint` 带 `--max-warnings=0`；RuleTester 用例 valid/invalid 双向覆盖 |
| shared 双构建 | tsc 两遍产 `dist/esm` + `dist/cjs`，postbuild 写两份模块类型标记；实测 CJS `require` 与 ESM `import` 取 `fnv1a32` 结果一致（`[6543148, 956401659]`），中文输入同值 |
| **工程坑（本轮新增 4 条）** | ① **块注释里写 glob 会提前结束注释**——`星号星号斜杠` 就是 `*/`，`no-hardcoded-color.js` 首次写就踩到，整文件语法错误；② **`node --test <目录>` 在 Windows 不递归 `*.test.ts`**，只报 1 个空子测试（exit=0 的假绿），必须显式列文件；③ **RuleTester 只扫源码原文会漏掉 `\u{1F600}` 转义写法**——改为扫解码后的字面量值 + 注释原文；④ **pnpm shim 会崩且伪装成代码红**（corepack 绑定的 Node 随 nvm 指针漂移，实测先后落到 16/20 报 `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`）→ 根 scripts 不嵌套 pnpm，并新增 `scripts/verify.mjs` 用 `spawnSync` 直连各工具 JS 入口，失败时打印该段输出 |
| 反向验证（断言非恒真） | 硬编码色探针 → `lint exit=1`，删除后 `exit=0`；给 shared 临时加 `react-icons`+`lodash` → `check:deps exit=1` 报 2 条，还原后 `exit=0`；规则测试首轮真红过（不是空跑） |
| 纪律增量 | **P0 规则会抓自己的测试文件**：测试里放真 emoji 与 no-emoji 天然冲突，正确解是 `String.fromCodePoint()` 运行时构造，而不是给测试加 eslint-disable |
| 待用户裁决（新增 1 条） | **仓库不在版本控制下**（`git status` → not a repository）。monorepo 基线已产出 269 包 + 30 余份代码文件，无 VCS 意味着任何一次误改无法回滚。建议 `git init` + 首次提交（按既有纪律**只提交不推送**），需用户点头 |
| 派发前沿 | 19/722 已完成；可立即派发 8 包：P3-010-03（本工作项主路径）、P3-003-01（等金仓 license）、D1-05/09/07/01/08/12-01（6 张设计卡首包） |

### 仓库纳入版本控制（2026-10-22 14:36，用户「执行」）

| 项 | 结果 |
|----|------|
| 提交 | `5c1d433`（main 分支首提交）：**156 文件 / 22051 行**，`.git` 4.0 MB，工作区 clean。**无远端、未推送**（按既有纪律：只提交不推送） |
| 入仓范围 | 工程基线（`package.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / tsconfig 三段 / ESLint preset + 2 条 P0 规则 / `packages/shared` 双构建 / `verify.mjs`）+ 需求与设计文档（spec、phase1~3、decisions、DESIGN-LAYER、openapi、13 卡立项口径）+ Phase 3 台账（backlog.csv、生成器、状态面板、ANCHORS）+ `.workbuddy/memory`（项目决策日志） |
| 排除 | `node_modules/`（含 spike 下两份共 13M）、`dist/`、`.workbuddy/trash/`（本地回收站，8 份已归档评审原文仍在盘上可恢复，不入库） |
| 换行符 | 本机全局 `core.autocrlf=true`，不处理会让同一文件在不同机器上反复整文件 diff。新增 `.gitattributes`（`* text=auto eol=lf`）+ 本仓库 `core.autocrlf=false` 锁定；`git ls-files --eol` 实测全部 `i/lf w/lf`，`git add` 零换行告警 |
| vendor 处理 | `spike/**/src/vendor/**` 是 spike 期一次性 bundle（单文件最大 1.3 MB，无权威来源可重建）→ 标 `-text -diff` 按二进制入库，避免换行改写与整文件 diff |
| 提交前门禁 | `node scripts/verify.mjs` **5/5 PASS、exit=0**——提交只在绿态做，不把红的基线钉进第一个提交 |
| 遗留 | 无远端。将来接远端时按用户纪律只推明确要求的分支 |
