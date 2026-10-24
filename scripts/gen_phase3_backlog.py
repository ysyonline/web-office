#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phase 3 派发包生成器
输入：内嵌的工作项表（需求域 / 工作项 / 工时 / 泳道 / 里程碑 / 依赖 / 交付物 / 验收断言）
输出：
  1. docs/phase3/backlog.csv  全量派发包（每包 1.0-1.2h）
  2. stdout 汇总（工时汇总 / 包数统计 / 泳道统计），供 TASKS.md 引用
拆分规则：
  包数 n = round(hours / 1.1)，并强制 hours/n 落在 [1.0, 1.2]；不足则微调 n。
  包内分段标签：接口与骨架 -> 主路径实现 -> 边界与错误 -> 测试与自检 -> 联调与收口。
"""
import csv
import os
import sys
from collections import OrderedDict, defaultdict

# (id, 需求域, 工作项, 工时h, 泳道, 里程碑, 依赖, 交付物, 验收断言)
ITEMS = [
    # ---------------- M0 开工门禁 ----------------
    ("P3-001", "R0 门禁", "工程化基线评审与落盘", 4, "DOC", "M0", "",
     "七项缺口裁决结论 + Spec §4 技术栈表补全 + DESIGN.md 组件来源章节",
     "七项逐条有结论且可追溯到文档；OPEN-DECISIONS 对应条目关闭"),
    ("P3-002", "R0 门禁", "公式运行时 spike（四问 + B11/B12 探针）", 12, "FE", "M0", "",
     "spike REPORT：浏览器真实路径四问结论 + 增量重算 vs 全表时延对照",
     "四问逐条有 PASS/FAIL 与断言输出；B11/B12 探针可复现；FAIL 则产出载体修订建议"),
    ("P3-003", "R0 门禁", "金仓契约冒烟（10 表 DDL/CRUD/反查/敏感点）", 8, "BE", "M0", "",
     "冒烟报告：五条断言结果 + 失败项回溯清单",
     "schema.md §7.2 五条断言全绿；失败项已登记 OPEN-DECISIONS 并给出回溯范围"),

    # ---------------- M1 脚手架 · 后端 ----------------
    ("P3-010", "R1 工程基建", "pnpm workspace 与 TS/ESLint/Prettier 基线", 12, "BE", "M1", "P3-001",
     "monorepo 目录（apps/web、apps/server、packages/shared）+ lint 规则 + lockfile",
     "pnpm i 后 lint/typecheck 在空工程跑通；shared 包可被前后端同时引用"),
    # ---------------- M1 设计层 · D1-13 排在 B1 最前（阻断 P3-011 pipe 落点 / P3-012 7xxx 入表） ----------------
    # 见 docs/phase3/DESIGN-LAYER.md v1.2 与 docs/phase3/design/D1-13-*.md
    ("D1-13", "R7 设计层", "设计卡：请求校验链与 API 契约生成门禁", 2.4, "BE", "M1", "P3-001",
     "D1-13 设计卡 v1（zod 单一源 → 自研 ZodValidationPipe → 7xxx 码段 → G1 contract-diff 门禁）",
     "四栏齐全且每条决策有出处；7xxx 四条码与前端呈现档位一一对应；漏挂 pipe 与孤儿 schema 各有可机检的断言"),
    ("P3-011", "R1 工程基建", "NestJS 应用骨架与模块划分", 8, "BE", "M1", "P3-010,D1-13",
     "Nest 引导 + 模块骨架（auth/files/collab/license/audit/sso）+ 22 个契约 schema 的 zod 定义落 packages/shared/src/schemas/（请求侧 9 + 响应侧 13，D1-13 ① 栏）",
     "启动 200 /api/v1/health；模块依赖无环；目录与 Spec §5 端点分组一致；全部 request schema 为 z.strictObject()/.strict()、未知键样本返回 400 不静默剥离（D1-13 A-STRICT）"),
    # ---------------- M1 设计层（D1 设计卡，见 docs/phase3/DESIGN-LAYER.md） ----------------
    ("D1-05", "R7 设计层", "设计卡：错误码与降级四层矩阵", 3.6, "BE", "M1", "",
     "D1-05 设计卡 v1（错误码分段 + HTTP status↔code↔WS close 4409-4412↔前端文案 四层对照）",
     "四层对照表覆盖 M1~M3 全部错误出口；同语义多出口（License 402 / WS 4409 / Command 守卫）口径一致"),
    ("D1-11", "R7 设计层", "设计卡：配置装载与启动断言链", 2.4, "BE", "M1", "D1-05",
     "D1-11 设计卡 v1（配置键分类 + 三级国密断言 + 容器/裸机形态差异 + 健康检查分级）",
     "每个开关与必填键有失败模式定义（启动失败 vs 降级）；离线包形态的跳过开关不引入安全后门"),
    ("P3-012", "R1 工程基建", "配置 / 环境变量 / 统一错误码基线", 8, "BE", "M1", "P3-011,D1-05,D1-11,D1-13",
     "配置装载（校验启动即失败）+ 错误码表 + {code,message,detail} 响应封装",
     "缺必填配置时启动失败并指明键名；错误响应结构与 Spec §10 一致"),
    ("P3-013", "R1 工程基建", "日志与请求上下文（traceId）", 6, "BE", "M1", "P3-012",
     "结构化日志 + traceId 贯穿 + 脱敏规则",
     "单请求全链路同一 traceId；口令/token 字段不出现在日志"),
    ("P3-014", "R1 工程基建", "TypeORM 数据源与 10 表实体", 14, "BE", "M1", "P3-003,P3-012",
     "DataSource（金仓/opengauss/pg 三方言）+ 10 表实体",
     "实体与 schema.md §6 逐字段一致；禁用 PG 专有类型（无 jsonb/array）"),
    ("P3-015", "R1 工程基建", "迁移脚本与种子数据", 8, "BE", "M1", "P3-014",
     "初始迁移（10 表 + 索引）+ admin 种子 + 回滚脚本",
     "空库 migrate 一次成功、rollback 一次干净；索引与 schema.md 一致"),
    ("P3-016", "R1 工程基建", "启动断言三级国密与健康检查", 6, "BE", "M1", "P3-013",
     "G1 sm3 / G2 SM2 曲线 / G3 固定 fixture 验签（自洽） 三级断言 + health 探针",
     "任一断言失败拒绝启动且退出码非 0；三级全绿时 health 返回 status=ok"),
    ("P3-017", "R1 工程基建", "OpenAPI 契约校验与类型生成", 8, "BE", "M1", "P3-012",
     "openapi.yaml 与实现的契约测试 + 前端类型生成脚本",
     "契约测试能检出端点/字段漂移；生成的类型可直接被 apps/web 引用"),
    ("P3-018", "R1 工程基建", "审计写入中间件", 6, "BE", "M1", "P3-014",
     "审计落库中间件（会话级/文件级/管理级事件钩子）",
     "登录/文件增删改名事件各产生一条 audit_logs；写失败不阻断主流程但留错误日志"),
    ("P3-019", "R1 工程基建", "Docker 多架构镜像（amd64/arm64）", 10, "OPS", "M1", "P3-011",
     "buildx 多架构 Dockerfile + compose 编排",
     "两架构镜像均可构建并启动；镜像内无外网依赖"),
    ("P3-020", "R1 工程基建", "verdaccio 离线源与依赖入库", 8, "OPS", "M1", "P3-010",
     "离线 registry + 依赖全量入库脚本 + 安装验证",
     "断网环境下 pnpm i 从离线源成功；SheetJS 走 CDN tarball 且版本断言 =0.20.3"),

    # ---------------- M1 脚手架 · 前端 ----------------
    ("P3-030", "R1 工程基建", "Vite+React 骨架与目录约定", 8, "FE", "M1", "P3-010",
     "前端骨架 + 路径别名 + env 装载",
     "dev/build 均可跑通；目录与 monorepo 约定一致"),
    ("P3-031", "R1 工程基建", "design-tokens 接入与 Canvas 主题桥接", 10, "FE", "M1", "P3-030",
     "CSS 变量接入（DOM 层）+ tokens.json 注入 Univer theme（Canvas 层）",
     "页面无裸 hex；Univer 网格线/表头底色与 design-tokens.json 一致"),
    ("P3-032", "R1 工程基建", "字体就绪与 Univer 挂载骨架", 10, "FE", "M1", "P3-031",
     "字体预加载 + Univer 实例挂载/卸载",
     "document.fonts 就绪后才挂载；列宽度量无错位（对照 Spec §11 坑表）"),
    ("P3-033", "R1 工程基建", "组件库基线与基础组件", 84, "FE", "M1", "P3-031",
     "11 个通用件（Button/Input/Dropdown/ContextMenu/Dialog/Toast/Tabs/Badge/Avatar/Tooltip/Popover）+ 组件库基线（cva 变体骨架 + L3 测试模板 + 9 态断言范式）",
     "每个通用件具备 DESIGN §12.2 九态与键盘可达性、aria 标注、focus ring 用 token、L3 覆盖率 ≥80%；业务复合件（表格行/头像堆叠/Progress）归 P3-062/090/093 随用随建，强制复用本产物模板与红线"),
    ("P3-034", "R1 工程基建", "路由与布局壳", 8, "FE", "M1", "P3-030",
     "路由表（/login、/files、/file/:id、/admin）+ 布局壳",
     "四个路由可达；未登录访问受保护路由重定向 /login"),
    ("D1-09", "R7 设计层", "设计卡：认证与 token 生命周期", 2.4, "BE", "M1", "",
     "D1-09 设计卡 v1（access 15min/refresh 7d 刷新时序 + 失效传播 + WS ticket 5s 边界 + 锁定交互）",
     "并发刷新去重与失效传播各有时序图；锁定/禁用期间既有 access 的放行口径唯一且可实现"),
    ("P3-035", "R1 工程基建", "API 客户端与 token 刷新", 10, "FE", "M1", "P3-030,P3-017,D1-09",
     "fetch 封装 + 401 自动刷新 + 并发刷新去重",
     "access 过期后单次自动刷新并重放请求；刷新失败清会话跳登录"),
    ("P3-036", "R1 工程基建", "Vitest 与 Playwright 基线", 8, "QA", "M1", "P3-030",
     "单元测试与 E2E 双栈配置 + 首个冒烟用例",
     "vitest run 与 playwright test 在 CI 均通过；E2E 能截帧供性能采样"),
    ("P3-037", "R1 工程基建", "CI 流水线（lint/type/test/门禁脚本）", 10, "OPS", "M1", "P3-010,P3-036,D1-13",
     "CI 四段流水线 + 门禁脚本挂载点",
     "PR 触发 lint/type/test 全绿；门禁脚本失败即阻断；contract-diff.mjs 归一化规则表已产出并回填 D1-13 卡 G1 行"),

    # ---------------- M2 账户 / 文件 / 编辑器 · 后端 ----------------
    ("P3-040", "R2 账户与文件", "PBKDF2-HMAC-SM3 口令服务", 6, "BE", "M2", "P3-016,D1-09",
     "哈希/校验服务（≥10 万轮 + 随机盐，格式串为唯一事实源）",
     "同一口令两次哈希不同盐；校验通过率 100%；格式串可解析升级标识"),
    ("P3-041", "R2 账户与文件", "auth 登录/刷新/登出/me 四端点", 10, "BE", "M2", "P3-040,P3-015",
     "四端点 + JWT 签发（15min/7d）+ refresh 轮换",
     "AC-01 通过；登出后 refresh 失效；me 返回当前用户角色"),
    ("P3-042", "R2 账户与文件", "登录失败锁定 AC-02", 4, "BE", "M2", "P3-041",
     "failed_attempts/locked_until 状态机 + 审计",
     "连续 5 次失败锁定 15 分钟并记审计；锁定期内正确口令亦拒绝"),
    ("P3-043", "R2 账户与文件", "RBAC 守卫与请求用户上下文", 4, "BE", "M2", "P3-041",
     "admin/member 守卫 + 当前用户注入",
     "member 访问 admin 端点返回 403；守卫不依赖控制器内手写判断"),
    ("P3-044", "R2 账户与文件", "用户管理 5 端点", 10, "BE", "M2", "P3-043",
     "列表/建号/详情/改属性/解锁 + 禁用状态机",
     "不提供物理删除；禁用后该用户 refresh 与 WS 均失效"),
    ("P3-045", "R2 账户与文件", "文件 CRUD 与软删除", 8, "BE", "M2", "P3-043",
     "创建/重命名/删除/详情 + 软删除过滤",
     "软删文件不出现在列表但库内仍在；重命名写审计"),
    ("P3-046", "R2 账户与文件", "文件列表分页与关键字搜索", 4, "BE", "M2", "P3-045",
     "分页 + keyword 过滤 + 排序",
     "1000 条数据下分页稳定；keyword 命中名称且大小写不敏感"),
    ("P3-047", "R2 账户与文件", "SSO 配置端点与加密存储", 6, "BE", "M2", "P3-043",
     "GET/PUT sso/config + config 字段加密落库",
     "LDAP 口令等敏感字段不以明文入库；未配置协议返回 enabled=false"),
    ("P3-048", "R2 账户与文件", "LDAP 认证适配", 10, "BE", "M2", "P3-047",
     "LDAP bind + 用户映射 + 首次登录建档",
     "AC-10 的 LDAP 分支通过；目录账号首次登录自动建本地用户"),
    ("P3-049", "R2 账户与文件", "OAuth2 认证适配", 10, "BE", "M2", "P3-047",
     "授权码流程 + state 校验 + 用户映射",
     "AC-10 的 OAuth2 分支通过；state 不匹配拒绝回调"),
    ("P3-050", "R2 账户与文件", "CAS 认证适配", 8, "BE", "M2", "P3-047",
     "CAS ticket 校验 + 用户映射",
     "ticket 一次性校验通过；失败回登录页带明确错误"),
    ("P3-051", "R2 账户与文件", "审计查询端点与过滤", 6, "BE", "M2", "P3-018",
     "分页 + 用户/动作/时间区间过滤",
     "AC-11 查询口径通过；审计表无 update/delete 路径"),

    # ---------------- M2 前端 ----------------
    ("D1-07", "R7 设计层", "设计卡：前端状态分层与乐观更新", 3.6, "FE", "M2", "",
     "D1-07 设计卡 v1（zustand store 边界 vs Univer 内部态 + 乐观更新回滚点 + 只读单一事实源）",
     "哪些状态不得双写有明确清单；每个乐观更新有回滚点；只读降级只有一个事实源"),
    ("P3-060", "R2 账户与文件", "登录页", 12, "FE", "M2", "P3-033,P3-035,D1-07",
     "登录表单 + 校验 + 错误态 + 锁定倒计时",
     "pages.md §1 各态实现；AC-02 锁定倒计时每秒刷新并归零恢复"),
    ("P3-061", "R2 账户与文件", "SSO 入口与回跳处理", 6, "FE", "M2", "P3-060,P3-047",
     "三协议入口 + 未配置禁用态 + 回跳落地",
     "未配置协议按钮禁用并显示「未配置」；回跳后正确落 /files"),
    ("P3-062", "R2 账户与文件", "文件列表页", 14, "FE", "M2", "P3-035,P3-046",
     "列表/新建/导入/搜索/重命名/删除 + 五态",
     "五态齐全；删除为软删且列表即时移除；空态有主行动"),
    ("P3-063", "R2 账户与文件", "编辑器页面壳", 16, "FE", "M2", "P3-032",
     "标题栏/工具栏/公式栏/Sheet 标签/状态栏 + 120px 常驻高度",
     "常驻栈总高 ≤120px；只读 banner 出现时网格高度按 calc 收缩"),
    ("P3-064", "R2 账户与文件", "快照加载与保存联调", 8, "FE", "M2", "P3-063",
     "GET snapshot 加载 + 保存触发 + 失败提示",
     "打开已有文件渲染正确；保存后重新打开内容一致"),
    ("P3-065", "R2 账户与文件", "管理后台壳与用户管理 Tab", 12, "FE", "M2", "P3-034,P3-044",
     "四 Tab 壳 + 用户列表/建号/改属性/解锁",
     "admin 可完成建号到解锁全流程；member 访问 403 有兜底页"),
    ("P3-066", "R2 账户与文件", "管理后台 SSO 与审计 Tab", 8, "FE", "M2", "P3-065",
     "SSO 配置表单 + 审计日志查询表",
     "SSO 配置保存后登录页入口即时可用；审计表支持时间与用户过滤"),

    # ---------------- M3 协同 · 后端 ----------------
    ("D1-01", "R7 设计层", "设计卡：协同三通道时序与抑制矩阵", 4.8, "BE", "M3", "",
     "D1-01 设计卡 v1（cellData→档案→oplog 先后 + onlyLocal/fromCollab/undo 抑制矩阵 + doc-rebuild 期写入语义）",
     "抑制矩阵六个应用点逐格有取值；一 op 一 update 帧的合并边界明确；回声放大防线可指到代码位置"),
    ("P3-070", "R3 协同与持久化", "WS ticket 握手", 6, "BE", "M3", "P3-043",
     "POST /ws/ticket + 一次性票据校验",
     "query 传 JWT 被拒；票据 5 秒过期、二次使用拒绝"),
    ("P3-071", "R3 协同与持久化", "Yjs 服务端接入与 LOAD 帧", 10, "BE", "M3", "P3-070,D1-01",
     "ws 服务 + LOAD 0x03 + 二进制协议封装",
     "双端连同一 fileId 收到同一 doc 状态；非法帧不崩连接"),
    ("P3-072", "R3 协同与持久化", "内容通道 Y.Map 双向同步", 12, "BE", "M3", "P3-071",
     "单元格内容 Y.Map 幂等赋值 + 回放抑制",
     "AC-06 两端最终一致；回放带 onlyLocal+fromCollab 无回声放大"),
    ("P3-073", "R3 协同与持久化", "结构操作服务端定序 oplog", 12, "BE", "M3", "P3-071",
     "结构 mutation 定序 + seq 分配（SeqAllocator 接口）",
     "(file_id,seq) 唯一索引无冲突；同格并发不产生发散"),
    ("P3-074", "R3 协同与持久化", "awareness 光标通道", 8, "BE", "M3", "P3-071",
     "awareness 广播 + 服务端着色字段透传",
     "双端光标互见；刷新后同一用户颜色不变（fnv1a32 确定性）"),
    ("P3-075", "R3 协同与持久化", "write-through 与 group-commit", 12, "BE", "M3", "P3-073",
     "先落库后广播 + 攒批 ≤1s 或 ≤50 条",
     "AC-15 先持久化后传播断言通过；kill -9 后已提交 update 零丢失"),
    ("D1-06", "R7 设计层", "设计卡：快照物化与加载状态机", 3.6, "BE", "M3", "D1-01",
     "D1-06 设计卡 v1（doc 生命周期状态机 + base_seq 事务边界 + LRU 驱逐互斥 + 加载就绪信号 + drain 关系）",
     "状态机覆盖物化/驱逐/重建全部迁移且无悬挂态；驱逐与写入的互斥用引用计数明确；重放幂等有断言"),
    ("P3-076", "R3 协同与持久化", "快照物化与 base_seq 事务", 10, "BE", "M3", "P3-075,D1-06",
     "三类节流物化 + 同事务写 base_seq + gzip",
     "快照与 base_seq 同事务；物化后 gzip 体积在 32MB 上限内"),
    ("P3-077", "R3 协同与持久化", "加载协议重建（snapshot + 增量）", 8, "BE", "M3", "P3-076",
     "snapshot@base_seq + seq>base_seq 回放",
     "重建后 doc 与物化前一致（哈希比对）；无重复应用"),
    ("P3-078", "R3 协同与持久化", "优雅关闭序列 AC-15", 6, "BE", "M3", "P3-075",
     "SIGTERM 五步 drain + 30s 预算",
     "优雅关闭 RPO=0；总时长 ≤30s；超时强制退出有日志"),
    ("D1-08", "R7 设计层", "设计卡：连接与席位状态机", 2.4, "BE", "M3", "",
     "D1-08 设计卡 v1（连接状态机 + 同账号多连接席位归属 + 满席转只读 vs 拒入 + 宽限期边界）",
     "状态机与 close 码一一对应（4409/4410/4411/4412 无歧义）；宽限期语义只在本卡定义一次"),
    ("P3-079", "R3 协同与持久化", "席位计量与 close 码", 10, "BE", "M3", "P3-072,D1-08",
     "SeatMeter 接口 + view/edit 占席 + 4409/4410/4411",
     "满席转编辑被拒且保持只读；同账号第 4 连接 4410；登出广播 4411"),
    ("P3-080", "R3 协同与持久化", "内存水位 LRU 与 close 4412", 6, "BE", "M3", "P3-079",
     "LRU 驱逐 + 水位触发 4412",
     "水位超 80% 先驱逐最久未活跃已物化 doc；单 doc 超预算拒开带超限语义"),
    ("P3-081", "R3 协同与持久化", "四个可替换接口抽象", 8, "BE", "M3", "P3-071",
     "SeqAllocator/SeatMeter/CollabBus/CalcDispatcher 四个 TS interface + 进程内实现",
     "四个接口形状固化且调用方只依赖接口；替换实现不需要改调用方"),
    ("P3-082", "R3 协同与持久化", "导入与活跃协同互斥协议", 6, "BE", "M3", "P3-077,P3-114",
     "导入回写前物化 + 结构通道广播 doc-rebuild",
     "活跃协同中导入不产生双写；客户端收到 doc-rebuild 后重建成功"),

    # ---------------- M3 协同 · 前端 ----------------
    ("P3-090", "R3 协同与持久化", "协同接入与 doc-rebuild 处理", 12, "FE", "M3", "P3-064,P3-072",
     "WS 连接 + update 收发 + doc-rebuild 重建",
     "双端并发编辑一致；收到 doc-rebuild 后无残留脏格"),
    ("P3-091", "R3 协同与持久化", "多人光标与协同头像", 6, "FE", "M3", "P3-090,P3-074",
     "他人光标/选区渲染 + 头像组",
     "光标位置与对端一致；8 色板内颜色确定性"),
    ("P3-092", "R3 协同与持久化", "断线重连与状态提示", 6, "FE", "M3", "P3-090",
     "重连退避 + 离线态提示",
     "断网 30s 后恢复能自动重连并按加载协议补齐"),
    ("P3-093", "R4 导入导出", "导入导出 UI 与任务状态", 8, "FE", "M3", "P3-062,P3-114",
     "上传/进度/失败态 + 导出下载 + 降级提示条",
     "提示条 N 计数正确；失败态给出可操作原因，不吞错误"),

    # ---------------- M3 导入导出（WI-1..WI-6，合计 128h） ----------------
    ("D1-04", "R7 设计层", "设计卡：IR↔snapshot 双向投影规则表", 3.6, "BE", "M3", "D1-05",
     "D1-04 设计卡 v1（类型矩阵 + 样式矩阵 + numFmt 保真 + 不可表达项降级清单）",
     "每条投影有双向判据；不可表达项有降级去向；round-trip 差异清单可枚举而非事后发现"),
    ("D1-03", "R7 设计层", "设计卡：导入四桶判定与降级政策", 3.6, "BE", "M3", "D1-04",
     "D1-03 设计卡 v1（W→X→桶 II→差分 判定顺序 + 每类 snapshot 表达 + 降级原因码枚举 + 报告计数口径）",
     "判定顺序短路规则唯一；每个原因码对应一条用户可见文案；提示条 N 的计数口径与 UI 一致"),
    ("D1-02", "R7 设计层", "设计卡：档案坐标键生命周期与迁移", 4.8, "BE", "M3", "D1-03",
     "D1-02 设计卡 v1（键形态与 sheet 生命周期 + 六类结构 op 迁移公式 + undo 反向 + v 校验丢弃 + 事务边界）",
     "六类 op × 正反向逐格给出目标键；迁移器未知路径的丢弃与降级路径明确；陷阱用例（插行不撤销即导出）入卡"),
    ("P3-100", "R4 导入导出", "WI-2 IR 中间模型与类型系统", 8, "BE", "M3", "P3-002,D1-02,D1-03,D1-04",
     "ir.ts 类型定义 + 序列化 + 类型映射规则表",
     "IR→JSON→IR 深度相等；错误值 #DIV/0! 保原文；公式不计算"),
    ("P3-101", "R4 导入导出", "WI-1 解析骨架与 fixtures", 8, "BE", "M3", "P3-100",
     "SheetJS 流式读取 + 10MB 拒收 + 全套 fixtures",
     "16 个 fixture 就位；>10MB 拒收并置 failed + 3001 语义"),
    ("P3-102", "R4 导入导出", "WI-1 类型识别与文本数字判定", 4, "BE", "M3", "P3-101",
     "raw:true 类型判定（禁止隐式 valueOf）",
     "text-look-like-number 的 0012 保持字符串；日期不随本机时区偏移"),
    ("P3-103", "R4 导入导出", "WI-1 CSV 编码探测链", 4, "BE", "M3", "P3-101",
     "BOM 判定 + jschardet + GB18030 回退 + 编码落 detail",
     "GBK 中文表头零乱码；UTF-8 BOM 分支不走采样"),
    ("P3-104", "R4 导入导出", "WI-1 桶判定器", 4, "BE", "M3", "P3-101",
     "白名单/引擎可用区/排除集三桶判定",
     "119/393/X=8 判定与 whitelist.md 一致；CI 定数断言通过"),
    ("P3-105", "R4 导入导出", "WI-3 结构映射", 10, "BE", "M3", "P3-102",
     "IR→snapshot 结构生成 + 边界行列 + 冻结映射",
     "去抖后读值与 IR 全等；sparse 用例行列数正确且不膨胀存储"),
    ("P3-106", "R4 导入导出", "WI-3 突变测试（反例鉴别力）", 6, "QA", "M3", "P3-105",
     "两种故意错误注入（列偏移 / t 类型对调）的检出测试",
     "两种注入均被检出；未检出即判 FAIL（杜绝恒真断言）"),
    ("P3-107", "R4 导入导出", "WI-4 样式基础映射", 12, "BE", "M3", "P3-105",
     "字重/字号/字体色/底色/对齐/换行映射 + theme 色换算",
     "style-basic 五断言全等；渐变填充走降级说明不失败"),
    ("P3-108", "R4 导入导出", "WI-4 合并/边框/数字格式", 12, "BE", "M3", "P3-107",
     "合并单元格 / 四象限边框 / numFmt 代码保真 / 行列宽高",
     "合并导出回 xlsx 后 Excel 仍显示合并；numFmt 字符串原样"),
    ("P3-109", "R4 导入导出", "WI-5 公式档案侧车", 16, "BE", "M3", "P3-105",
     "剥 f 存 resources 侧车 + 编辑失效规则 + 协同同步",
     "white-list-foreign 格只有 v 无 f；编辑 A1 后该格不被重算波及"),
    ("P3-110", "R4 导入导出", "WI-5 结构迁移器与值校验", 12, "BE", "M3", "P3-109",
     "六类结构 op 迁移 + undo 反向 + 导出前置值校验",
     "陷阱用例（插行不撤销即导出）无错位；迁移器失效时走丢弃路径"),
    ("P3-111", "R4 导入导出", "WI-5 差分导入管线", 12, "BE", "M3", "P3-110",
     "引擎可用区差分重算比对 + 容差 + 降级",
     "一致格保留 f 同权；不一致格降级且有原因码；万格上限保护生效"),
    ("P3-112", "R4 导入导出", "WI-6 导出层", 16, "BE", "M3", "P3-108",
     "snapshot→IR→xlsx/csv 流 + 样式/合并/冻结写出",
     "round-trip IR 深度相等；csv 转义正确且公式保留 = 前缀"),
    ("P3-113", "R4 导入导出", "WI-6 往返校验与 Excel 打开验证", 4, "QA", "M3", "P3-112",
     "真实 Excel/LibreOffice 打开校验 + 中文 BOM",
     "AC-08 通过：无修复弹窗、中文不乱码、公式文本保留"),
    ("P3-114", "R4 导入导出", "导入任务队列与状态端点", 10, "BE", "M3", "P3-105",
     "import_tasks 表驱动队列 + 状态查询 + 单任务 512MB 上限",
     "任务四态流转正确；坏文件不阻塞队列；超限 fail-fast"),
    ("P3-115", "R4 导入导出", "CI 门禁接入（白名单/桶/版本）", 4, "OPS", "M3", "P3-037",
     "check_formula_whitelist.py + check_formula_buckets.py + xlsx 版本断言",
     "门禁失败阻断合并；393/X=8/119 定数任何漂移即红"),

    # ---------------- M3 License ----------------
    ("P3-120", "R5 License", "机器指纹采集", 8, "BE", "M3", "P3-016",
     "多源加权指纹 + fingerprint_items 落库",
     "同机多次采集稳定；容器卷级盐权重符合 license/design.md"),
    ("P3-121", "R5 License", "激活申请码与安装端点", 6, "BE", "M3", "P3-120",
     "activate-request 生成申请码 + install 接收 License",
     "申请码可被签发侧解析；安装成功后 status 即时有效"),
    ("D1-10", "R7 设计层", "设计卡：License 判定链与时钟", 2.4, "BE", "M3", "D1-05",
     "D1-10 设计卡 v1（判定链顺序 + max_seen_at 更新时机与三档阈值 + 宽限能力边界 + 三层降级一致）",
     "判定链顺序唯一且短路；回拨 24h 与宽限 7 天的语义不在别处重复定义；三层防线出口一致"),
    ("P3-122", "R5 License", "SM2 验签与 License 解析", 6, "BE", "M3", "P3-121,D1-10",
     "公钥验签 + 载荷解析 + 篡改拒绝",
     "篡改任一字节验签失败且不改动现有 License"),
    ("P3-123", "R5 License", "席位与到期判定 + 时钟三层", 6, "BE", "M3", "P3-122",
     "席位/到期判定 + max_seen_at + 回拨告警 + 7 天宽限",
     "回拨 >24h 仅告警不误杀；过期进宽限只读并提示续期"),
    ("P3-124", "R5 License", "只读降级三层防线", 8, "BE", "M3", "P3-123",
     "服务端 402 / WS 4409 / Command 守卫 / UI 只读 banner",
     "AC-09 三层分别断言通过；降级后写操作全部拒绝且提示明确"),
    ("P3-125", "R5 License", "License 管理 Tab", 6, "FE", "M3", "P3-066,P3-123",
     "状态展示 / 激活导入 / 席位用量 / 换绑入口",
     "过期与超席两态可见且引导清晰；换绑次数受 2 次/年约束"),

    # ---------------- M3 交付与验收 ----------------
    ("D1-12", "R7 设计层", "设计卡：AC↔用例↔环境追溯矩阵", 2.4, "QA", "M3", "",
     "D1-12 设计卡 v1（AC-01~15 → 脚本/环境/fixture 追溯表 + AC-05 采样口径 + 失败定位 + 手工证据模板）",
     "15 条 AC 每条有归属与执行环境；不可自动化项有替代证据模板；失败可定位到 AC 编号 + 断言行"),
    ("P3-130", "R6 交付验收", "Nginx+Tongsuo TLCP 网关", 12, "OPS", "M3", "P3-019",
     "国密双证书终结配置 + 内网标准 TLS 回源",
     "国密浏览器 HTTPS 打通；Node 侧只跑标准 TLS"),
    ("P3-131", "R6 交付验收", "离线安装包与安装脚本", 12, "OPS", "M3", "P3-019,P3-020",
     "离线包结构 + install.sh + 卸载脚本",
     "断网机器一次安装成功；重装幂等；卸载不残留数据目录"),
    ("P3-132", "R6 交付验收", "备份恢复脚本与 SOP", 8, "OPS", "M3", "P3-015",
     "库+快照备份脚本 + 恢复演练 SOP",
     "备份后恢复演练数据一致；SOP 步骤可被第三方照做"),
    ("P3-133", "R6 交付验收", "麒麟/UOS 双架构安装验证", 10, "QA", "M3", "P3-131",
     "x86_64 与 aarch64 各一次全新安装记录",
     "AC-13 通过；记录内核/依赖差异与处置"),
    ("P3-134", "R6 交付验收", "AC-05 性能基线与真机复核", 12, "QA", "M3", "P3-090,D1-12",
     "帧率采样 + L0/L1 收敛时延 + ARM 档复核",
     "F-x86 ≥50FPS 达标；L0/L1 阈值有真机数据回填 AC-05"),
    ("P3-135", "R6 交付验收", "E2E 验收脚本 AC-01~15", 16, "QA", "M3", "P3-124,D1-12",
     "15 条 AC 的自动化验收脚本集",
     "全量脚本可一键跑；失败定位到 AC 编号与断言行"),
    ("P3-136", "R6 交付验收", "气隙断网全功能验证 AC-12", 6, "QA", "M3", "P3-131",
     "断网全功能走查 + 网络白名单为空断言",
     "AC-12 通过；抓包无任何外网请求"),
    ("P3-137", "R6 交付验收", "等保配套三项（口令策略/留存/首登改密）", 8, "BE", "M3", "P3-042",
     "口令复杂度校验 + 审计留存 ≥6 个月 + 初始强制改密",
     "弱口令被拒；首次登录强制改密；留存策略有配置与验证"),
]

SEGMENTS = ["接口与骨架", "主路径实现", "边界与错误", "测试与自检", "联调与收口"]

# 段级「交付物 / 验收断言」：包级可独立验收的唯一依据（v1.1 修：v1.0 每包复制工作项文本，
# 88 个多包工作项的 687 个包断言全同，包级无法验收）。{t} = 工作项标题。
SEG_META = {
    "接口与骨架": (
        "{t} 的接口/类型/路由/表结构骨架（可空实现）",
        "签名表落定且编译/类型检查通过；下游包按此接口引用且无重复手写类型；接口改动已回写 packages/shared",
    ),
    "主路径实现": (
        "{t} 主路径实现（一条 happy path 贯通）",
        "happy path 手工跑通一次并留可复现记录（命令 + 输出）",
    ),
    "边界与错误": (
        "{t} 边界与错误分支（含错误码映射）",
        "本段边界逐条有断言或手工验证记录；每条错误分支映射到 P3 错误码表，无裸 500、无静默吞错",
    ),
    "测试与自检": (
        "{t} 该段单元测试/断言脚本",
        "测试跑绿；断言非恒真（至少一条「错误输入必须失败」的用例存在且通过）",
    ),
    "联调与收口": (
        "{t} 联调收口与遗留登记",
        "上下游包引用本包产物无异常；遗留项已登记 OPEN-DECISIONS；工作项收口断言（末包强制）全过",
    ),
}

# 设计卡（R7 设计层）专用段名，按包数取用；设计与开发是不同性质的工作，不能套五段。
DESIGN_SEG = {
    2: ["决策盘点与四栏起草", "冲突消解与落盘对齐"],
    3: ["决策盘点与出处核对", "四栏正文起草", "冲突消解与落盘对齐"],
    4: ["决策盘点与出处核对", "四栏正文起草", "冲突消解与评审", "落盘与消费方对齐"],
}

DESIGN_META = {
    "决策盘点与出处核对": (
        "待定决策清单（逐条标 Spec/ADR/schema/plan 行号）",
        "清单每条有唯一出处；无出处项标「本卡待定」并写明裁决人",
    ),
    "决策盘点与四栏起草": (
        "待定决策清单 + 四栏初稿（≤1 页）",
        "清单每条有出处；四栏无空栏（不涉及的栏写明「本卡不涉及」及理由）",
    ),
    "四栏正文起草": (
        "四栏正文：接口/数据结构｜时序或状态机｜错误码映射｜验收断言补充",
        "四栏均可被消费方直接引用；时序/状态机为可执行描述且含失败分支与回滚点",
    ),
    "冲突消解与评审": (
        "冲突清单 + 裁决记录 + 卡片 v1 定稿",
        "与 Spec/ADR/schema 逐条对照无矛盾；有矛盾处已开 OPEN-DECISIONS 条目，不私改契约",
    ),
    "冲突消解与落盘对齐": (
        "冲突裁决 + 卡片定稿 + 消费方首包引用回写",
        "卡片落 docs/phase3/design/；消费方首包「本包范围」已引用卡号，未引用即视为未完成",
    ),
    "落盘与消费方对齐": (
        "卡片落盘 + 消费方首包引用回写",
        "卡片路径与卡号在 backlog 可追溯；消费方包已引用卡号，未引用即视为未完成",
    ),
}


def packet_count(hours: float) -> int:
    n = max(1, round(hours / 1.1))
    for _ in range(200):
        per = hours / n
        if per > 1.2:
            n += 1
        elif per < 1.0 and n > 1:
            n -= 1
        else:
            break
    return n


def seg_labels(req: str, n: int) -> list:
    """返回 n 个段名。v1.1 修：v1.0 在 n<5 时直接丢段（n=4 丢「测试与自检」），
    且 n>5 用「增量实现」这种不承载纪律的空标签。改为按比例归入五段。"""
    if req.startswith("R7"):
        return DESIGN_SEG[n]
    if n == 1:
        return ["全量（五段合并）"]
    if n < 5:
        return SEGMENTS[:n - 1] + ["＋".join(SEGMENTS[n - 1:])]
    bounds = [round(i * n / 5) for i in range(6)]
    out = []
    for k in range(n):
        for i in range(5):
            if bounds[i] <= k < bounds[i + 1]:
                out.append(SEGMENTS[i])
                break
        else:
            out.append(SEGMENTS[-1])
    return out


def seg_meta(label: str, title: str):
    """段级交付物/断言；合并段（含「＋」）按序拼接。"""
    if label in SEG_META:
        d, a = SEG_META[label]
    elif label in DESIGN_META:
        d, a = DESIGN_META[label]
    else:
        parts = label.split("＋")
        d = "｜".join(SEG_META[p][0].replace("{t} ", "") for p in parts)
        a = "；".join(SEG_META[p][1] for p in parts)
    return d.replace("{t}", title), a


def main() -> None:
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs", "phase3")
    os.makedirs(out_dir, exist_ok=True)
    csv_path = os.path.join(out_dir, "backlog.csv")

    # 状态保留：重跑生成器不得抹掉既有进度（按 包ID 继承，新增包默认 待派发）
    prev_status = {}
    if os.path.exists(csv_path):
        with open(csv_path, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f):
                if r.get("包ID"):
                    prev_status[r["包ID"]] = r.get("状态", "待派发")
    if prev_status:
        done = sum(1 for v in prev_status.values() if v == "已完成")
        print("继承既有状态 %d 条（已完成 %d 条）" % (len(prev_status), done), file=sys.stderr)

    rows = []
    total_hours = 0.0
    pkt_seq = 0
    item_stats = OrderedDict()

    hours_by_req = defaultdict(float)
    hours_by_lane = defaultdict(float)
    hours_by_ms = defaultdict(float)
    pkts_by_req = defaultdict(int)
    pkts_by_lane = defaultdict(int)
    pkts_by_ms = defaultdict(int)

    # 两段式：先算每个工作项的包数（依赖可指向任意工作项，不再依赖 ITEMS 书写顺序）
    n_of = OrderedDict((it[0], packet_count(it[3])) for it in ITEMS)
    last_of = {iid: "%s-%02d" % (iid, n) for iid, n in n_of.items()}

    # 依赖悬挂校验：写错 id 必须立刻报错，不能静默丢边
    dangling = []
    for (iid, _req, _t, _h, _l, _m, deps, _d, _a) in ITEMS:
        for d in [x.strip() for x in deps.split(",") if x.strip()]:
            if d not in last_of:
                dangling.append((iid, d))
    if dangling:
        for iid, d in dangling:
            print("DANGLING DEP: %s -> %s" % (iid, d), file=sys.stderr)
        raise SystemExit("依赖悬挂 %d 处，已中止" % len(dangling))

    for (iid, req, title, hours, lane, ms, deps, deliverable, accept) in ITEMS:
        n = n_of[iid]
        per = round(hours / n, 2)
        total_hours += hours
        hours_by_req[req] += hours
        hours_by_lane[lane] += hours
        hours_by_ms[ms] += hours
        pkts_by_req[req] += n
        pkts_by_lane[lane] += n
        pkts_by_ms[ms] += n
        item_stats[iid] = (req, title, hours, n, per, lane, ms)

        dep_first = "|".join(last_of[d.strip()] for d in deps.split(",") if d.strip())
        # 设计卡引用：消费方首包「本包范围」必须含卡号（DESIGN-LAYER §5 派发校验；
        # 卡末包 D1-xx-0n 断言「消费方首包已引用卡号，未引用即视为未完成」）。
        # 单一来源 = ITEMS 的 deps 列，不另设映射表，避免「台账说有、依赖没有」的双源。
        card_deps = [d.strip() for d in deps.split(",") if d.strip().startswith("D1-")]
        labels = seg_labels(req, n)
        seg_total = defaultdict(int)
        for lb in labels:
            seg_total[lb] += 1
        seg_seen = defaultdict(int)
        prev = ""
        for k in range(n):
            pkt_seq += 1
            pid = "%s-%02d" % (iid, k + 1)
            seg = labels[k]
            scope = "%s（%d/%d）：%s" % (title, k + 1, n, seg)
            if k == 0 and card_deps:
                scope += "｜前置设计卡：%s（docs/phase3/design/）" % "、".join(card_deps)
            pkt_deliverable, pkt_accept = seg_meta(seg, title)
            seg_seen[seg] += 1
            if seg_total[seg] > 1:
                # 同段多包：断言必须落到包级锚点，否则仍无法独立验收
                tag = "（本段第 %d/%d 包）" % (seg_seen[seg], seg_total[seg])
                pkt_deliverable += tag
                pkt_accept += ("；本包须填锚点三项——产出物路径 / 检查命令 / 通过判据，"
                               "且与本段其他包的锚点不重叠" + tag)
            dep = dep_first if k == 0 else prev
            rows.append([
                "P3-%04d" % pkt_seq, pid, ms, req, iid, title, lane,
                "%d/%d" % (k + 1, n), "%.2f" % per, scope,
                pkt_deliverable, pkt_accept, deliverable, accept, dep,
                prev_status.get(pid, "待派发"),
            ])
            prev = pid

    header = ["包号", "包ID", "里程碑", "需求域", "工作项ID", "工作项", "泳道",
              "包序", "工时h", "本包范围", "包级交付物", "包级验收断言",
              "工作项交付物", "工作项收口断言", "依赖包", "状态"]
    with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)

    # 自检：包级断言必须逐包可辨（同工作项内不得全同）
    same = 0
    by_item = defaultdict(list)
    for r in rows:
        by_item[r[4]].append(r[11])
    for iid, accs in by_item.items():
        if n_of[iid] > 1 and len(set(accs)) == 1:
            same += 1

    print("CSV:", csv_path)
    print("items=%d packets=%d total_hours=%.1f total_person_days=%.1f avg_packet=%.3f"
          % (len(ITEMS), len(rows), total_hours, total_hours / 8, total_hours / len(rows)))
    print("check: 包级断言全同的多包工作项 = %d（应为 0）；依赖悬挂 = %d" % (same, len(dangling)))

    print("\n--- by milestone ---")
    for ms in ["M0", "M1", "M2", "M3"]:
        print("%s hours=%.1f packets=%d person_days=%.1f" % (ms, hours_by_ms[ms], pkts_by_ms[ms], hours_by_ms[ms] / 8))

    print("\n--- by lane ---")
    for lane in sorted(hours_by_lane, key=lambda x: -hours_by_lane[x]):
        print("%s hours=%.1f packets=%d" % (lane, hours_by_lane[lane], pkts_by_lane[lane]))

    print("\n--- by requirement ---")
    for req in sorted(hours_by_req, key=lambda x: x):
        print("%s hours=%.1f packets=%d person_days=%.2f" % (req, hours_by_req[req], pkts_by_req[req], hours_by_req[req] / 8))

    print("\n--- item table ---")
    for iid, (req, title, hours, n, per, lane, ms) in item_stats.items():
        print("%s\t%s\t%s\t%.1fh\t%d包×%.2fh\t%s" % (iid, ms, title, hours, n, per, lane))


if __name__ == "__main__":
    main()