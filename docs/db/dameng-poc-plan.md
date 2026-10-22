# 达梦 DM8 适配 PoC 计划

> 产出人：高见远（首席架构师） | 阶段：Phase 2 | 工期：1 周（5 人日）
> 关联：Spec-web-office-v1.md 第 4 章（数据库以 KingbaseES 为主，达梦为次优先）/ 架构技术选型 12.1
> 排序裁决（2026-10-21 外部评审分支 F）：**金仓真机验证先行，达梦 PoC 排其后**——金仓是主库契约验证（schema.md 10 表 DDL 是冻结契约，须先在目标库锚定），达梦是次优先适配（PoC 性质为「可选交付目标」评估，失败只降级不回溯契约）。两事性质不同，排序依据是回溯成本不对称：金仓爆雷改 schema → Spec §6 → openapi → ADR-002 全链回溯；达梦爆雷只改 dameng 方言层。金仓真机锚点 = Phase 3 M1 脚手架期契约冒烟（见 schema.md §7），达梦 PoC 按本计划 5 人日执行，窗口建议与金仓冒烟共用一周环境获取周期（license/安装包人工下载流程一次走完）。

---

## 1. PoC 目标与定位

KingbaseES V8 R6 是主库（PG 血统，迁移成本最低），达梦 DM8 是**次优先适配目标**：政企招标中部分客户指定达梦目录。本 PoC 的目的不是"让达梦跑起来就完事"，而是回答三个可决策的问题：

1. TypeORM 0.3.x 能否通过 `dmdb` 驱动稳定完成本项目全部 10 张表的 CRUD + 事务 + 分页查询？
2. 现有 schema 设计（禁用 PG 专有特性后）是否存在达梦方言不兼容的字段类型或 DDL 语法？
3. 若兼容，需付出的额外成本是多少（驱动补丁、方言适配、CI 增加一轮）？

**决策出口**：PoC 通过后，达梦进入"可选交付目标"清单（不阻塞 MVP）；PoC 失败，达梦降级为"按需定制交付项"，MVP 只承诺 KingbaseES/openGauss。

## 2. 环境准备（0.5 人日）

| 项 | 版本/规格 | 获取方式 | 备注 |
|---|---|---|---|
| 达梦数据库 | DM8（`dm8_2024xxxx_x86_win64.iso` 或 Linux 版） | 达梦官网试用版下载（90 天开发授权） | 优先 Linux（x86_64）Docker 部署；Windows 版备用 |
| 部署形态 | Docker 镜像 `dameng/dm8:latest`（官方未发布则需自建：基础镜像 centos7/麒麟 + DMInstall.bin 静默安装） | 手动构建 | 无官方镜像时按 `-q` 静默安装参数脚本化 |
| 实例参数 | 页大小 32、字符集 UTF-8（GB18030 会踩坑）、大小写不敏感 | 初始化时指定，初始化后不可改 | **必须 UTF-8**，否则中文文件名/审计日志乱码 |
| Node 运行时 | Node 22.22.2（与生产一致） | 本机已有 | |
| 驱动 | `dmdb`（达梦官方 Node 驱动，npm 公开） | `npm i dmdb` | **已实证纯 JS**（2026-10-21 外部评审分支 F 核查）：npm 实查 `dmdb` v1.0.52452，maintainer dameng_database@dameng.com（官方），运行时依赖仅 iconv-lite，snappy/snappyjs 均为 optional peerDeps，无原生编译链（.node/node-gyp 不需要）；`dm8`/`dameng` 包名 404，`dmdb` 为唯一官方渠道 |
| ORM | TypeORM 0.3.x + 自定义方言 | 项目内 `src/shared/db/dialect/dameng.ts` | 社区方言适配不成熟，需自研薄层 |

关键前置确认（装库前先做，避免白跑）：

- ~~`npm view dmdb versions` 与 `npm view dmdb dist` 确认包存在且有对应平台预编译产物~~ **已完成（2026-10-21）**：v1.0.52452 存在、纯 JS、无原生编译链，前置顾虑关闭；剩余待确认仅 aarch64 安装包与驱动行为两项（见下）；
- 达梦是否提供 aarch64 版本安装包（影响 AC-13 麒麟/统信 arm64 交付）；
- 达梦驱动是否支持 `RETURNING`、`LIMIT/OFFSET`（老版本用 `ROWNUM`，会影响分页与 TypeORM skip/take）。

## 3. 验证步骤（3 人日）

全部在一个独立分支 `spike/dm8` 上执行，脚本化可重跑（不手写 SQL 交互式验证）。

### Step 1：连通性与方言基线（0.5d）

- 用 `dmdb` 原生驱动直连，跑 `SELECT 1 FROM DUAL`（达梦无 `DUAL` 之外的裸 SELECT 时改用 `SELECT 1`）；
- 跑 TypeORM `createConnection` 自定义方言（driver: `postgres` 派生 or 手写 `DamengDriver`），目标：TypeORM 能建连、能执行原始 SQL 查询；
- 断言输出：连接成功 + 版本号 + 当前 schema。

### Step 2：Schema 落库（1d）

按 `docs/db/schema.md` 的 10 张表逐个建表，逐项记录差异。重点验证本项目的三类敏感点：

**假绿防护（第三轮 P1-6 补充）**：达梦默认未加引号标识符折叠为大写，而 TypeORM 默认生成双引号小写标识符——createTable 可能「建表成功但后续 CRUD 解析不到表」的假绿。因此 Step 2 不止跑 DDL，必须紧跟两条断言：
1. **TypeORM repository 实跑 CRUD**：每张表建完后立即用项目的 entity repository 执行 insert/select/update 各一轮（真实走 TypeORM SQL 生成器），全部成功才算该表通过；
2. **information_schema 反查断言**：repository CRUD 后，用原生 SQL 查 information_schema（或达梦 SYSOBJECTS 等价视图）反查该表的列名/大小写，断言与 entity 定义的蛇形小写一致——覆盖「折叠大写表列名 vs 双引号小写」的解析路径分歧。

| 敏感点 | 本项目写法 | 达梦预期表现 | 需验证的替代写法 |
|---|---|---|---|
| 主键 id | uuid（varchar(36)）或 bigint 自增 | 自增需 `IDENTITY`，uuid 用 `varchar(36)` 无问题 | 需确认 uuid 默认值能否用 `SYS_GUID()` 或应用层生成 |
| JSON 字段 | `text` 存 JSON 字符串（已按禁用 PG 特性约束） | 应无问题 | 确认超长文本走 `CLOB` 还是 `varchar(8000)`；`file_snapshots.snapshot` 可能超 8000 字符 → 必须 `CLOB` |
| 大对象 BLOB | `yjs_updates.update` | 达梦 `BLOB` 语义与 PG `bytea` 不同，需验证 Node Buffer 往返无损 | 备选：`varbinary(max)` |
| 时间戳 | `created_at` 等 | 达梦 `TIMESTAMP` 默认精度与 PG `timestamptz` 差异；**建议统一 `timestamp(6)` 且应用层写 UTC** | 确认 TypeORM `@CreateDateColumn` 是否被方言正确翻译 |
| 唯一索引 | `unique(file_id, version)` 等 | 达梦支持，但 NULL 处理与 PG 不同（多 NULL） | 确认软删除 `deleted_at` 参与复合索引时的行为 |
| 软删除 | `deleted_at` 可空 | 无差异 | — |

断言输出：10 张表全部 DDL 执行成功 + `information_schema` 反查字段类型对照表。

### Step 3：ORM 行为回归（1d）

写一个 `spike/dameng-crud.spec.ts`，复用项目的 entity 定义与 repository 调用，覆盖真实代码路径：

1. 用户注册→登录→刷新 token（写 `users`/`refresh_tokens`，含事务）；
2. 文件创建→快照写入（大 `CLOB` 写入 200KB 快照，读回做严格相等断言）；
3. Yjs update 落库（写 1 万条 `yjs_updates`，按 `(file_id, seq)` 索引范围查询，断言顺序与内容一致）；
4. 审计日志分页查询（`take/skip` + 时间范围过滤，断言总数与分页正确性）；
5. 并发写入（两个连接同时 `POST` 快照，断言 `unique(file_id,version)` 冲突被捕获为可识别错误码，而非驱动崩溃）。

### Step 4：迁移与 CI 可行性（0.5d）

- 验证 TypeORM migration（已生成的 SQL）能否在达梦直接执行；若不能，评估"用 `synchronize` 出 PG SQL 后人工转写"的工作量；
- 评估 CI 增加一轮 `docker-compose -f docker-compose.dm8.yml` 的成本与时间（累计 CI 时长）。

## 4. 通过标准（判定 gate）

| # | 标准 | 判定方式 |
|---|---|---|
| G1 | 10 张表 DDL 成功 **且每表 repository CRUD 实跑通过 + information_schema 反查列名/大小写断言一致**（第三轮 P1-6 加强：防 createTable 假绿） | Step 2 断言脚本全绿 + 字段对照表人工复核 |
| G2 | Step 3 的 5 项 ORM 回归全部通过（含 200KB CLOB 往返无损、BLOB 无损） | 断言脚本全绿 |
| G3 | 唯一约束冲突、事务回滚的错误可被识别为业务错误码（不是驱动级异常逃逸） | 断言脚本捕获特定错误类型 |
| G4 | 驱动在 x86_64 Linux（麒麟 V10 优先，否则 CentOS7）可安装运行；aarch64 有官方包或有明确替代路径 | 安装记录 |
| G5 | 额外成本（方言适配代码 + CI 一轮）≤ 3 人日一次性 + 每次 CI +8 分钟 | 工作量评估表 |

**判定规则**：G1–G3 全过 = PoC 通过（达梦进入可选交付）；任一不过 = 不通过，达梦降级为定制交付项；同时必须给出**阻塞点的具体位置**（哪张表/哪种类型/哪个驱动行为）。

## 5. 工期与交付物

| 人日 | 内容 | 交付物 |
|---|---|---|
| D1（0.5） | 环境准备 + 前置确认 | 达梦实例（可连）、驱动安装记录 |
| D1–D3（3） | Step 1–3 验证 | `spike/dameng/` 脚本 + 字段类型对照表 + 回归断言结果 |
| D4（0.5） | Step 4 迁移与 CI | CI 时长与工作量评估 |
| D5（1） | 报告与决策 | `docs/db/dameng-poc-report.md`（结论 + 对照表 + 坑清单 + 决策建议）+ 更新 Spec 第 4 章（若通过则加达梦为备选） |
| 合计 | **5 人日 = 1 周** | |

## 6. 已知风险与预判

| 风险 | 预判 | 缓解 |
|---|---|---|
| 达梦试用版授权 90 天到期 | 高 | PoC 阶段够用；正式采购需在合同中明确授权，PoC 报告中标注"授权为交付前置条件" |
| ~~`dmdb` 无预编译产物，国产 OS 上需 node-gyp 编译~~ **已证伪（2026-10-21）**：dmdb v1.0.52452 实查纯 JS、依赖仅 iconv-lite，无原生编译链 | 低（降级） | 风险关闭；仅保留「国产 OS 上 iconv-lite 纯 JS 路径回归」随 G4 一并覆盖，无需单独缓解 |
| 达梦分页语法（ROWNUM vs LIMIT）导致 TypeORM 生成的 SQL 不可用 | 中 | 需自研方言层覆盖 `LIMIT/OFFSET` 翻译；若方言层改动面过大，PoC 判不通过 |
| CLOB 读写在 Node 驱动下可能需流式处理 | 中 | 快照字段若 >8000 字符，改走流式读写封装；必要时将快照存对象存储、DB 只存引用 |
| 无官方 Docker 镜像导致环境搭建耗时超预期 | 中 | D1 上限 0.5 人日，超时立即上报，不自行延长 |
| 与金仓真机验证的窗口冲突（环境获取均需官网人工下载） | 中 | 排序已定：金仓先行（M1 期契约冒烟，schema.md §7），达梦 PoC 随后；建议共用一周环境获取周期，由架构师统一发起 license/安装包下载申请 |

## 7. 不做什么（Out-of-Scope）

- 不做达梦上的性能压测（主库是 KingbaseES，达梦只验功能兼容）；
- 不做达梦集群/主备方案验证（交由实施期按客户合同处理）；
- 不改 Spec 第 4 章的主库选型——PoC 无论成败，KingbaseES 仍是主库；
- 不做 loongarch64 上的达梦验证（LoongArch 为 P2）。
