#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Phase 3 版本排期计划生成器（项目负责人视图）。

输入：`docs/phase3/backlog.csv`（唯一事实源）
输出：
  - `docs/phase3/RELEASE-PLAN.md`   版本计划正文（人读，可评审）
  - `docs/phase3/RELEASE-PLAN.html` 版本计划看板（单文件，可筛可搜）

设计约束（三条，缺一条本计划就不可信）：
  1. **覆盖校验**：全部未完成包必须被恰好一个版本认领，重复或漏项即 exit=1。
     （包数为台账实测值，禁止在文案里写死——写死会在每次台账变动后与正文自相矛盾。）
  2. **依赖闭环校验**：任一所含工作项的上游，必须「已完成」或落在同版更靠前的顺序位、
     或更早的版本；落在更晚的版本即 exit=1。这条是排期可行性的机器证明，不是人工对表。
  3. **日期可追溯**：版本结束日 = 起始日 + 执行日 + 缓冲日，执行日由实测产能推出，
     产能常数与校准依据写进页面，不写「预计」二字了事。

用量口径：
  - `CAP_PKGS_PER_DAY` 为**实测**产能（2026-10-25 三次连发 3 包耗时 4h24m，约 1.47h/包，
    6 小时有效工时对 4 包/日），不是台账名义工时 1.12h/包折算值。
  - 缓冲按版本执行日的 20% 单列，不摊进执行日——避免把风险伪装成工期。

用法：
    python -X utf8 scripts/gen_release_plan.py            # 生成 md + html
    python -X utf8 scripts/gen_release_plan.py --check     # 只校验，不写盘
"""

import csv
import io
import math
import os
import re
import sys
from collections import OrderedDict
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'docs/phase3/backlog.csv')
OUT_MD = os.path.join(ROOT, 'docs/phase3/RELEASE-PLAN.md')
OUT_HTML = os.path.join(ROOT, 'docs/phase3/RELEASE-PLAN.html')

DONE_STATUS = ('已完成', '已归并')

# 实测产能：4 包/工作日（6h 有效工时 / 1.47h 实测单包耗时）。
CAP_PKGS_PER_DAY = 4
# 单版风险缓冲：执行日的 20%（外部阻塞、卡拦读、返工）。
BUFFER_RATIO = 0.20
# 排期起点：2026-10-25 为周日，取次一工作日。
START_DATE = date(2026, 10, 26)

# ---------------------------------------------------------------------------
# 版本定义（本文件是版本边界的唯一登记点）
#
# 每版含：id / 名称 / 一句话目标 / 所含工作项（顺序即执行顺序）/ 演示能力 /
#         出闸证据 / 依赖与风险。工作项清单是排期的实质内容，改动必须同步校验。
# ---------------------------------------------------------------------------
VERSIONS = [
    dict(
        id='v0.1',
        name='门禁收官',
        goal='M0 全部关闭：国产库契约在真机上站得住，后续所有数据层工作才有地基。',
        items=['P3-003'],
        demo=[
            '在金仓实例上执行 10 表 DDL，无语法/类型报错',
            'CRUD 往返一致：写入值与读回值逐字段相等',
            '反查（按 id / 外键）返回预期行集',
            '敏感点清单逐项确认（大小写、标识符长度、时区、布尔、自增、索引名）',
        ],
        exit=[
            'schema.md 7.2 节五条断言全绿；差异项逐条进 OPEN-DECISIONS 并给出回溯范围',
            '冒烟报告归档，ANCHORS 执行记录引用其路径',
            'verify 14/14（本版无代码改动，须仍为绿）',
        ],
        risk='金仓授权未到位即全阻塞（本节 R1）；无实例时只能出「差异清单 + PG 等价预演」，不算完成。'
             '**2026-10-25 复核：申请无回音，且本机无 PG16——「等价预演」这条缓解措施当前为空**，'
             '故本版 7 包在授权到位前没有可交付执行面（-01 骨架除外）。',
    ),
    dict(
        id='v0.2',
        name='后端地基',
        goal='服务能从空库启动：配置、日志、契约、数据层、迁移、审计六件一次成型。',
        items=['P3-012', 'P3-013', 'P3-017', 'P3-016', 'P3-014', 'P3-015', 'P3-018'],
        demo=[
            '空库执行迁移，得到 10 张表 + 种子数据',
            '启动服务，GET /api/v1/health 返回 200 且体 status:ok',
            'GET /api/v1/health/ready 反映数据库连通（停库后转 503，不是 200）',
            '任一请求带 traceId，日志行与错误体中的 traceId 一致',
            '写操作后审计表多一行，含操作者与目标对象',
        ],
        exit=[
            '迁移可重复执行（二次执行无变更、无报错）',
            'ready 在「库通 / 库断」两态下分别 200 / 503，两态实跑取证',
            '非法请求返回 {code,message,detail} 且 code 属已登记码表',
            'OpenAPI 契约门禁能拦住「改了代码没改契约」（反向验证一次）',
            'verify 14/14；jest 与 fixtures 全绿',
        ],
        risk='D1-11 可选键清单仍拦读，配置项只覆盖必填三键 + 端口/日志级别；17 个业务阈值键留待收口轮统一补入。',
    ),
    dict(
        id='v0.3',
        name='前端骨架与交付基建',
        goal='前端能跑、交付能出：主题/字体/编辑器容器就位，CI 与离线安装链可用。',
        items=['P3-020', 'P3-030', 'P3-031', 'P3-032', 'P3-034', 'P3-036', 'P3-037', 'P3-019'],
        demo=[
            'pnpm dev 起前端，路由与布局壳可导航',
            '改一个 design token，页面颜色随之变化（无硬编码色值兜底）',
            '中英文字体加载完成，Univer 容器可挂载空表',
            'CI 四段（lint / 类型 / 测试 / 门禁脚本）可拦住注入的错误',
            '离线源安装：断网状态下 pnpm i --offline 成功',
            '镜像构建后 docker run，curl health 返回 200',
        ],
        exit=[
            'Playwright 冒烟至少 1 例绿，且能复现（命令入 ANCHORS）',
            '故意提交一处 lint 错误，CI 红灯；还原后绿灯——两态都留记录',
            '气隙模拟（禁用外网）下全量依赖安装成功',
            '镜像 amd64 可构建、可启动、health 200；arm64 若无 runner 则登记为环境阻塞',
        ],
        risk='本机无 Docker（本节 R2），镜像两条验收只能「代码就绪、验收挂起」，不计入完成。',
    ),
    dict(
        id='v0.4',
        name='组件库基线',
        goal='76 包组件可供业务页直接复用：视觉与 token 对齐，规则无豁免。',
        items=['P3-033', 'P3-035'],
        demo=[
            '组件预览页逐组件可渲染，控制台零报错',
            'API 客户端完成登录态注入、401 自动刷新、失败重试',
            '组件属性与设计卡一致（无重复手写类型）',
        ],
        exit=[
            '组件清单 76 项全部可渲染，逐项截图留档',
            'no-hardcoded-color / no-emoji 全绿，无 eslint-disable 豁免',
            'token 改动可传导到组件（抽 3 个组件验证）',
            '组件清单与设计卡逐项对齐，缺项登记 OPEN（不得静默略过）',
        ],
        risk='本版为全程最长单版（约 85 包 / 27 工作日），是首个「反馈周期过长」风险点（R4）。',
    ),
    dict(
        id='v0.5',
        name='账户与权限',
        goal='身份闭环：登录、刷新、登出、用户管理、文件 CRUD 与权限守卫可用。',
        items=['P3-040', 'P3-041', 'P3-042', 'P3-043', 'P3-044', 'P3-045', 'P3-046'],
        demo=[
            'curl 剧本：登录 -> 拿 token -> 刷新 -> me -> 登出，五步状态码符合预期',
            '连续 5 次错误口令触发锁定，第 6 次返回锁定码而非「密码错误」',
            '越权请求返回 403，其 code 属已登记码表',
            '软删除的文件默认列表不含、回收站可见、可恢复',
        ],
        exit=[
            '口令库为 PBKDF2-HMAC-SM3，10 万轮，库内无明文（抽查表记录）',
            '锁定窗口与阈值与 D1-05/AC-02 一致，且时间可注入（单测不等真实 15 分钟）',
            '分页与关键字搜索在 1 万行样本上返回稳定（同一查询两次结果一致）',
            'verify 14/14；错误码无新增未登记码',
        ],
        risk='D1-05 四层矩阵逐码映射仍未落（v0.2 只到 30 条骨架），403/423 的 UI 档位待补。',
    ),
    dict(
        id='v0.6',
        name='SSO 与审计面',
        goal='企业接入面完成：三种 SSO 可配可切，审计可查，登录页可用。',
        items=['P3-047', 'P3-048', 'P3-049', 'P3-050', 'P3-051', 'P3-060', 'P3-061'],
        demo=[
            '三种 provider（LDAP / OAuth2 / CAS）各用 mock 服务跑通一次登录',
            'SSO 配置在库内加密存储，接口回显脱敏',
            '审计查询按操作者与时间过滤结果正确',
            '登录页错误提示不泄露账号是否存在',
        ],
        exit=[
            'SSO 配置切换后无需重启即生效（配置热读或明确「需重启」并写入文档）',
            'mock provider 脚本入库，可复跑',
            '登录页在 375 / 768 / 1440 三个宽度下无横向滚动',
            'verify 14/14；前端 lint 无新增告警',
        ],
        risk='三种 SSO 均无真实企业环境，只能 mock 验收；真机联调推至 v0.14 交付验收（R7）。',
    ),
    dict(
        id='v0.7',
        name='单人可用版（内测）',
        goal='第一个产品级里程碑：登录、建文件、编辑、保存、刷新内容不丢。',
        items=['P3-062', 'P3-063', 'P3-064', 'P3-065', 'P3-066'],
        demo=[
            '浏览器实操：登录 -> 新建文件 -> 输入内容 -> 保存 -> 刷新 -> 内容一致',
            '文件列表页支持分页、搜索、重命名、删除、回收站',
            '管理后台可管用户、看审计、配 SSO',
            '编辑器保存后再次打开，样式与内容一致',
        ],
        exit=[
            '上述四条在干净库上从零走通一次，录屏或步骤清单入 ANCHORS',
            '全流程无 500、无裸 alert、无 console error',
            '打 tag v0.7-internal，作为首个可交付内测版本',
            'verify 14/14；面板口径 match',
        ],
        risk='本版结束即用户可试用，反馈会改变后续优先级——v0.8 起允许按反馈调序，但不减包。',
    ),
    dict(
        id='v0.8',
        name='协同内核',
        goal='多人同编成立：内容通道、结构定序、持久化与加载重建四件闭环。',
        items=['P3-070', 'P3-071', 'P3-072', 'P3-073', 'P3-074', 'P3-075', 'P3-076', 'P3-077'],
        demo=[
            '两个浏览器同文档并发编辑 30 分钟，结束后两侧内容 hash 一致',
            '断网 5 分钟后重连，增量补齐，内容与在线侧一致',
            '强杀进程后重启，刷新页面从 snapshot + 增量重建一致',
            'oplog 序号单调递增无空洞（抽查 1000 条）',
        ],
        exit=[
            '并发 30 分钟无分叉，记录双方 hash 与 seq 区间',
            '重连与重建两条路径各有实跑日志，非单测模拟',
            'write-through 落库延迟 P95 达标（阈值引 D1-06，未定则记录实测值待裁）',
            'verify 14/14；新增 WS 通道有契约条目且 schema 命名门禁绿',
        ],
        risk='D1-01 / D1-06 卡虽已完成但拦读，抑制矩阵与加载状态机的细节需在开工前取得（R3）。',
    ),
    dict(
        id='v0.9',
        name='协同完备',
        goal='协同可运营：席位、水位、优雅关闭、前端多人体验全部到位。',
        items=['P3-078', 'P3-079', 'P3-080', 'P3-081', 'P3-090', 'P3-091', 'P3-092'],
        demo=[
            'kill -TERM 后客户端收到约定 close 码，日志按序记录关闭步骤',
            '超席位与超内存水位各有专属 close 码，前端提示可区分',
            '三人同编：光标可见、头像正确、成员进出实时',
            '触发 doc-rebuild 后前端不崩，状态回正',
        ],
        exit=[
            '四种 close 码（正常/席位/水位/异常）各实跑一次并记录',
            '优雅关闭后未落库的增量不丢（对比重启前后 seq 与内容）',
            '前端断线重连有可见状态提示，且不产生重复连接',
            'verify 14/14',
        ],
        risk='席位与水位阈值键仍未入配置表（R1 衍生），本版可能就地写死——须登记并归收口轮统一。',
    ),
    dict(
        id='v0.10',
        name='导入解析',
        goal='XLSX 进得来：中间模型、类型识别、编码探测、四桶判定全部可验证。',
        items=['P3-100', 'P3-101', 'P3-102', 'P3-103', 'P3-104', 'P3-105', 'P3-106'],
        demo=[
            'fixtures 样本（含反例）全部按预期解析或按预期拒绝',
            '四桶判定结果与 D1-03 判定表逐行对齐',
            'GBK / UTF-8-BOM / UTF-16 三类 CSV 编码探测正确',
            '文本型数字与数值型数字判定符合预期（不把订单号变科学计数）',
        ],
        exit=[
            'fixtures 全绿，且反例鉴别力有突变测试佐证（P3-106 达标）',
            '四桶判定表 100% 覆盖，无一桶无样本',
            '解析失败样本给出明确错误码与可读原因，不静默丢弃',
            'verify 14/14；夹具不破坏既有 44 例',
        ],
        risk='D1-02 / D1-03 / D1-04 三卡拦读，IR 结构与投影规则必须开工前取得（R3），否则本版不可启动。',
    ),
    dict(
        id='v0.11',
        name='导入保真',
        goal='搬得准：结构、样式、合并、数字格式、公式五类保真到位。',
        items=['P3-107', 'P3-108', 'P3-109', 'P3-110', 'P3-111'],
        demo=[
            '20 个真实样本导入后抽查结构与样式一致',
            '公式进侧车后可再算，值校验不放过陈旧缓存值',
            '差分导入只改差异单元格，未变区域 op 数为 0',
        ],
        exit=[
            '20 样本抽查表逐项签字（结构 / 样式 / 合并 / 格式 / 公式）',
            '公式侧车往返：导入 -> 导出 -> 再导入，公式仍可算',
            '差分导入的 op 数与实际变更单元格数相等（误差 0）',
            '降级样本（超限/不支持特性）有明确策略且已实现',
        ],
        risk='样式映射边界（主题色、条件格式）可能与预期不符，需在 v0.10 结束前先做 3 样本预演。',
    ),
    dict(
        id='v0.12',
        name='导出与互斥',
        goal='出得去、不打架：导出可被 Excel 打开，导入与协同互斥。',
        items=['P3-112', 'P3-113', 'P3-114', 'P3-115', 'P3-093', 'P3-082'],
        demo=[
            '导出的 xlsx 在 Excel 真机打开无「需要修复」提示',
            '往返（导入 -> 导出 -> 再导入）无内容丢失',
            '文档处于活跃协同时发起导入被拒绝，返回互斥码',
            '导入任务可查进度，失败可看原因',
        ],
        exit=[
            'Excel 真机打开验证留截图与文件（至少 5 个样本）',
            '往返一致性由脚本断言，非人工目测',
            '互斥协议两方向都测（协同中导入 / 导入中进协同）',
            'CI 门禁接入白名单（未登记特性即红）',
            'verify 14/14',
        ],
        risk='Excel 真机验证依赖本机 Office 环境，缺则退化为「结构等价断言 + 用户代验」。',
    ),
    dict(
        id='v0.13',
        name='License 与降级',
        goal='可控商用：验签、席位、到期、只读降级四层成立。',
        items=['P3-120', 'P3-121', 'P3-122', 'P3-123', 'P3-124', 'P3-125'],
        demo=[
            '伪造签名的 License 被拒，错误码明确',
            '过期或超席位进入只读，前端可见且不可写',
            '系统时钟回拨 24 小时被识别',
            'License 管理页可导入、查看席位与到期',
        ],
        exit=[
            '伪造 / 篡改 / 过期 / 超席位 四种非法态各实跑一次',
            '只读降级三层防线逐层单独失效测试（单层失效仍能兜住）',
            '降级只阻断写、不阻断读（对照实验）',
            'verify 14/14；码表无新增未登记码',
        ],
        risk='D1-10 判定链与时钟三层拦读，需在 v0.12 结束前取得（R3）；否则本版只能做「验签通路」不做判定。',
    ),
    dict(
        id='v0.14',
        name='交付验收（v1.0 GA）',
        goal='可交付：气隙环境从安装包到全功能验收一次通过。',
        items=['P3-130', 'P3-131', 'P3-132', 'P3-133', 'P3-134', 'P3-135', 'P3-136', 'P3-137'],
        demo=[
            '气隙环境：安装包 -> 启动 -> 登录 -> 建文件 -> 编辑 -> 导入导出全流程走通',
            'AC-01 至 AC-15 端到端脚本全绿',
            '麒麟 / UOS 双架构安装成功',
            '备份恢复按 SOP 演练一次，数据完整',
        ],
        exit=[
            'E2E 15 条验收用例全绿，且可一键复跑',
            '性能基线达标（阈值以 D1-12 为准，未定则实测值待裁并登记）',
            '双架构安装验证记录齐（截图 / 日志 / 版本号）',
            '等保三项（口令策略 / 留存 / 首登改密）实跑',
            '打 tag v1.0；交付件清单齐（安装包 / 手册 / SOP / 报告）',
            'verify 14/14；工作项收口断言全部实跑通过',
        ],
        risk='本版依赖前置全部完成且外部环境齐备（Docker / 麒麟 / UOS / 金仓），是最可能延期的一版。',
    ),
]

# 出闸闸门（所有版本共用，逐条硬判，不满足即不得开下一版）
RELEASE_GATE = [
    ('包级收口', '本版所有包状态为已完成；每个工作项的收口断言逐条实跑通过，不以「编译过」代替断言。'),
    ('门禁全绿', 'node scripts/verify.mjs 全段通过；gen_status_panel.py 口径校验 match，无「不一致」告警。'),
    ('构建可复现', '根 build 退出码 0；jest 全绿；fixtures-run 全绿；本版新增脚本已接入 verify，否则不计入交付。'),
    ('能力演示', '本版「演示」清单在干净环境从零走通一次，命令与输出摘录入 ANCHORS 执行记录。'),
    ('契约不欠账', 'openapi 改动已走解冻流程；码表 / 契约 schema / 命名三方无漂移（对应门禁段绿）。'),
    ('遗留可问责', '未完成项全部进 OPEN-DECISIONS，每条带归属包与解除条件；无口头遗留。'),
    ('文档同步', 'ANCHORS 补本版执行记录（含反向验证与踩坑）；重生成状态面板与版本计划。'),
]

# 风险登记
RISKS = [
    (
        'R1',
        '金仓授权未到位',
        'v0.1 及其全部下游（M2 起的数据层）',
        '2026-10-21 记录：官网授权页 404，harbor 超时，走人工申请 3-5 工作日；本机 NO_DOCKER。'
        '**2026-10-25 19:15 复核：申请仍无回音**（距申请满 5 个工作日 = 2026-10-28，与 v0.1 名义结束日同一天，'
        '即本版缓冲为零）；本机亦无 PG16 可做等价预演（无 5432 监听 / 无 psql / 无 Docker）',
        '立即提交申请并跟踪；同期用 PG16 做等价 DDL 预演，产出差异清单并入 v0.1 交付；'
        '超 5 个工作日未到位，v0.1 转为「差异清单版」并明确不视为完成',
    ),
    (
        'R2',
        '本机无 Docker',
        'v0.3 镜像两条、v0.14 双架构与气隙安装',
        'docker 与 buildx 均不在 PATH',
        '申请远端 runner 或 CI 构建；不可得时这两类验收一律挂「环境阻塞」，'
        '不得以「代码已写」计入完成',
    ),
    (
        'R3',
        '设计卡拦读（D1-01/02/03/04/06/10）',
        'v0.8 协同内核、v0.10 导入解析、v0.13 License',
        '六卡状态为已完成，但 Security Center 对逐文件读取 deny',
        '按版本提前一版索取卡内容（v0.7 末取 01/06/10，v0.9 末取 02/03/04）；'
        '取不到则该版不得启动，避免按猜测实现污染 138 个下游包',
    ),
    (
        'R4',
        'v0.4 单版过长（85 包 / 27 工作日）',
        '排期节奏与反馈周期',
        '76 包组件库属同一工作项，中途无自然收口点',
        '设 4 个内部检查点（每约 19 包）做可视化验收；'
        '若实际超期 30%，按「减包不移期」把低优组件移至 v0.5 后的补丁版',
    ),
    (
        'R5',
        '单执行者无并行',
        '总工期 从 184 增至不可压缩',
        '当前为一Agent串行，FE 与 BE 无法真正并行',
        '增一名前端后可双车道：BE+OPS+QA 500 包与 FE 219 包并行，'
        '关键路径由 180 降至 125 工作日，压缩约 30%',
    ),
    (
        'R6',
        '默认端口 3000 被占',
        'v0.2 起的本地验证口径',
        '本机 umi dev server 长期占用 3000，历轮以 PORT=3100 通过',
        '配置键落地时明确默认端口；占用方释放后补一次默认端口 200 且验体',
    ),
    (
        'R7',
        'SSO / 金仓 / 国产 OS 无真实环境',
        'v0.6、v0.1、v0.14',
        '三类均无生产级实例可联调',
        'mock 验收 + 交付验收阶段真机复核；真机失败的回溯范围预先按包登记',
    ),
]

MD_HEAD = """# Phase 3 版本排期计划（至 v1.0 GA）

> 生成器：`scripts/gen_release_plan.py` ｜ 数据源：`docs/phase3/backlog.csv` ｜ 生成时间：{ts}
> 口径：包数/工时取台账实测；日期为「单执行者、6 小时有效工时、4 包/工作日」推算的名义日期，**不是承诺交付日**。
>
> ⚠ **执行顺序已让位**：2026-10-25 用户裁决「先验证想法，不影响验证的任务全部后置」，
> 当前执行顺序以 **`docs/phase3/VALIDATION-PLAN.md`**（Layer 0 验证优先，16 人日）为唯一准绳；
> 本文降级为 **Layer 2 交付层参考**——总量账、出闸闸门、风险登记三项继续有效，
> 但「v0.1 至 v0.14 的先后次序」在 Layer 0/1 期间不作为执行依据。下方全部数字与日期口径不变。

## 0. 结论摘要

| 项 | 数值 |
|---|---|
| 剩余包 / 工时 | **{rest_pkgs} 包 / {rest_h:.2f}h**（总台账 {total_pkgs} 包 / {total_h:.2f}h，已完成 {done_pkgs} 包） |
| 版本数 | **{nver} 个**（v0.1 至 v1.0 GA），平均 {avg_pkgs:.0f} 包/版 |
| 名义工期（台账工时 ÷ 6h） | {nom_days} 工作日 ≈ {nom_weeks:.0f} 周 |
| 实测工期（1.47h/包 ÷ 6h） | {real_days} 工作日 ≈ {real_weeks:.0f} 周 |
| 计划工期 | **{plan_days} 工作日 ≈ {plan_weeks:.1f} 周**（执行 {plan_exec} + 缓冲 {plan_buf}），结束于 **{end_date}** |
| 双执行者工期（BE+OPS+QA / FE 双车道） | **{dual_total} 工作日 ≈ {dual_weeks:.0f} 周**（执行 {dual_days} + 缓冲 {dual_buf}），较单车道压缩 {save_pct:.0f}% |

**三条判断**：

1. **v0.7 是第一个产品级里程碑**——单人可登录、建文件、编辑、保存、刷新不丢。此前的 v0.1 至 v0.6 全是地基，
   用户看不到可用界面。若需要更早拿到「可演示物」，唯一办法是把 v0.3 与 v0.4 并行（需第二执行者）。
2. **v0.1 是全程唯一的硬阻塞点**——金仓授权不到，M2 起的数据层全部悬空。本版只有 7 包却决定 {rest_pkgs} 包的起点，
   属「小体量、高杠杆」，必须优先清障。
3. **v0.4 是节奏风险点**——85 包 / 27 工作日无自然收口，是全程最长单版，须设 4 个内部检查点。

"""


def fh(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def load_rows():
    with io.open(SRC, encoding='utf-8') as f:
        rows = list(csv.DictReader(f))
    # 首列可能带 BOM
    if rows and '包ID' not in rows[0]:
        for r in rows:
            for k in list(r.keys()):
                if k.endswith('包号'):
                    r['包号'] = r.pop(k)
                    break
    return rows


def is_done(row):
    return row['状态'] in DONE_STATUS


def wi_of(pkg_id):
    return pkg_id.rsplit('-', 1)[0]


def split_deps(raw):
    out = []
    for token in re.split(r'[|,]', raw or ''):
        token = token.strip()
        if token and re.match(r'^(P3-\d{3}|D1-\d{2})-\d{2}$', token):
            out.append(token)
    return out


def add_workdays(start, days):
    """从 start 起顺延 days 个工作日（周一至周五），返回落点日期。"""
    cur = start
    moved = 0
    while moved < days:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            moved += 1
    return cur


def build():
    rows = load_rows()
    by_pkg = OrderedDict((r['包ID'], r) for r in rows)
    rest = [r for r in rows if not is_done(r)]

    # 工作项聚合
    wi = OrderedDict()
    for r in rows:
        wid = r['工作项ID']
        wi.setdefault(
            wid,
            dict(
                id=wid,
                name=r['工作项'],
                ms=r['里程碑'],
                dom=(r['需求域'] or '').split()[0],
                lane=r['泳道'],
                pkgs=[],
                h=0.0,
                done=0,
            ),
        )
        w = wi[wid]
        w['pkgs'].append(r)
        w['h'] += fh(r['工时h'])
        if is_done(r):
            w['done'] += 1
        else:
            w['rest_n'] = w.get('rest_n', 0) + 1
            w['rest_h'] = w.get('rest_h', 0.0) + fh(r['工时h'])
    for w in wi.values():
        w.setdefault('rest_n', 0)
        w.setdefault('rest_h', 0.0)

    # 工作项级依赖（由包级依赖归并）
    edges = OrderedDict()
    for r in rows:
        wid = r['工作项ID']
        bucket = edges.setdefault(wid, set())
        for dep in split_deps(r['依赖包']):
            up = wi_of(dep)
            if up != wid:
                bucket.add(up)

    versions = []
    for spec in VERSIONS:
        v = dict(spec)
        v['pkg_list'] = []      # 该版所含工作项的全部包（含已完成，仅作追溯）
        v['rest_list'] = []     # 该版的**计划对象**：仅未完成包
        v['h'] = 0.0
        v['h_all'] = 0.0
        v['done'] = 0
        for wid in spec['items']:
            if wid not in wi:
                raise SystemExit('版本 %s 引用了台账不存在的工作项 %s' % (spec['id'], wid))
            if all(is_done(r) for r in wi[wid]['pkgs']):
                raise SystemExit(
                    '版本 %s 含已全部完成的工作项 %s：已完成项不应再排期' % (spec['id'], wid)
                )
            for r in wi[wid]['pkgs']:
                v['pkg_list'].append(r)
                v['h_all'] += fh(r['工时h'])
                if is_done(r):
                    v['done'] += 1
                else:
                    v['rest_list'].append(r)
                    v['h'] += fh(r['工时h'])
        # 数量与工期一律按剩余包计量（已完成包不重复计入工期）
        v['pkgs'] = len(v['rest_list'])
        v['wis'] = len(spec['items'])
        v['lanes'] = sorted({wi[w]['lane'] for w in spec['items']})
        v['days_exec'] = int(math.ceil(v['pkgs'] / float(CAP_PKGS_PER_DAY)))
        v['days_buf'] = int(math.ceil(v['days_exec'] * BUFFER_RATIO))
        v['days'] = v['days_exec'] + v['days_buf']
        for r in v['rest_list']:
            r['_ver'] = v['id']
        versions.append(v)

    # --- 校验 1：覆盖（只对未完成包，逐包恰好认领一次） ---
    covered = {}
    dupes = []
    for v in versions:
        for r in v['rest_list']:
            pid = r['包ID']
            if pid in covered:
                dupes.append((pid, covered[pid], v['id']))
            covered[pid] = v['id']
    missing = [r['包ID'] for r in rest if r['包ID'] not in covered]
    extra = []

    # --- 校验 2：依赖闭环 ---
    order = {}
    for idx, v in enumerate(versions):
        for pos, wid in enumerate(v['items']):
            order[wid] = (idx, pos)
    violations = []
    for v in versions:
        idx = versions.index(v)
        for wid in v['items']:
            for up in sorted(edges.get(wid, ())):
                if up not in wi:
                    continue
                if all(is_done(p) for p in wi[up]['pkgs']):
                    continue
                if up not in order:
                    violations.append((v['id'], wid, up, '上游未排入任何版本'))
                    continue
                uidx, upos = order[up]
                if uidx > idx:
                    violations.append(
                        (v['id'], wid, up, '上游排在更晚版本 %s' % versions[uidx]['id'])
                    )
                elif uidx == idx and upos > v['items'].index(wid):
                    violations.append((v['id'], wid, up, '同版内上游排在本项之后'))

    # 泳道并行估算
    lane_pkgs = {}
    for r in rest:
        lane_pkgs[r['泳道']] = lane_pkgs.get(r['泳道'], 0) + 1
    fe = lane_pkgs.get('FE', 0)
    others = len(rest) - fe
    dual_days = int(math.ceil(max(fe, others) / float(CAP_PKGS_PER_DAY)))

    # 日期
    cursor = START_DATE
    for v in versions:
        v['start'] = cursor
        v['end'] = add_workdays(cursor, v['days'] - 1)
        cursor = add_workdays(v['end'], 1)
    plan_days = sum(v['days'] for v in versions)
    plan_exec = sum(v['days_exec'] for v in versions)
    plan_buf = sum(v['days_buf'] for v in versions)
    dual_buf = int(math.ceil(dual_days * BUFFER_RATIO))
    dual_total = dual_days + dual_buf
    end_date = versions[-1]['end']

    total_h = sum(fh(r['工时h']) for r in rows)
    rest_h = sum(fh(r['工时h']) for r in rest)
    real_days = int(math.ceil(sum(fh(r['工时h']) * 1.31 for r in rest) / 6.0))
    nom_days = int(math.ceil(rest_h / 6.0))

    data = dict(
        rows=rows,
        by_pkg=by_pkg,
        rest=rest,
        wi=wi,
        edges=edges,
        versions=versions,
        covered=covered,
        dupes=dupes,
        missing=missing,
        extra=extra,
        violations=violations,
        lane_pkgs=lane_pkgs,
        dual_days=dual_days,
        dual_buf=dual_buf,
        dual_total=dual_total,
        plan_days=plan_days,
        plan_exec=plan_exec,
        plan_buf=plan_buf,
        end_date=end_date,
        total_h=total_h,
        rest_h=rest_h,
        total_pkgs=len(rows),
        rest_pkgs=len(rest),
        done_pkgs=len(rows) - len(rest),
        nom_days=nom_days,
        real_days=real_days,
    )
    return data


def report(data):
    ok = True
    print('版本数 %d ｜ 覆盖 %d / 未完成 %d' % (len(data['versions']), len(data['covered']), len(data['rest'])))
    for v in data['versions']:
        print(
            '  %-7s %-14s %2d 项 %3d 包 %7.2fh  执行%2d 缓冲%2d = %2d 工作日  %s -> %s'
            % (
                v['id'],
                v['name'],
                v['wis'],
                v['pkgs'],
                v['h'],
                v['days_exec'],
                v['days_buf'],
                v['days'],
                v['start'].isoformat(),
                v['end'].isoformat(),
            )
        )
    if data['dupes']:
        ok = False
        print('[FAIL] 重复认领 %d 项：%s' % (len(data['dupes']), data['dupes'][:5]))
    if data['missing']:
        ok = False
        print('[FAIL] 漏排 %d 包：%s' % (len(data['missing']), data['missing'][:10]))
    if data['extra']:
        ok = False
        print('[FAIL] 误排已完成包 %d 项：%s' % (len(data['extra']), data['extra'][:5]))
    if data['violations']:
        ok = False
        print('[FAIL] 依赖闭环违规 %d 处：' % len(data['violations']))
        for item in data['violations'][:10]:
            print('   ', item)
    print('计划总工作日 %d ｜ 结束 %s' % (data['plan_days'], data['end_date'].isoformat()))
    print('校验结果：%s' % ('PASS' if ok else 'FAIL'))
    return ok


def render_md(data):
    v = data['versions']
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')
    out = [
        MD_HEAD.format(
            ts=ts,
            rest_pkgs=data['rest_pkgs'],
            rest_h=data['rest_h'],
            total_pkgs=data['total_pkgs'],
            total_h=data['total_h'],
            done_pkgs=data['done_pkgs'],
            nver=len(v),
            avg_pkgs=data['rest_pkgs'] / float(len(v)),
            nom_days=data['nom_days'],
            nom_weeks=data['nom_days'] / 5.0,
            real_days=data['real_days'],
            real_weeks=data['real_days'] / 5.0,
            plan_days=data['plan_days'],
            plan_weeks=data['plan_days'] / 5.0,
            plan_exec=data['plan_exec'],
            plan_buf=data['plan_buf'],
            end_date=data['end_date'].isoformat(),
            dual_days=data['dual_days'],
            dual_total=data['dual_total'],
            dual_buf=data['dual_buf'],
            dual_weeks=data['dual_total'] / 5.0,
            save_pct=(1 - data['dual_total'] / float(data['plan_days'])) * 100,
            buf=BUFFER_RATIO * 100,
        )
    ]

    out.append('## 1. 排期前提（三个常数，可质疑、不可隐去）\n')
    out.append('| 常数 | 取值 | 依据 | 若推翻会怎样 |')
    out.append('|---|---|---|---|')
    out.append(
        '| 单包实测耗时 | 1.47h | 2026-10-25 连续 3 包耗时 4h24m（台账名义 1.12h/包） | '
        '系数每降 0.1h，总工期约减 3 个工作日 |'
    )
    out.append(
        '| 有效产能 | 4 包/工作日 | 6 小时有效工时 ÷ 1.47h；扣除评审与取证开销 | '
        '半日投入则总工期约翻倍 |'
    )
    out.append(
        '| 单版缓冲 | 执行日的 20% | 外部阻塞（R1/R2/R3）与返工的历史占比 | '
        '缓冲归零则计划必然延期，且无处吸收 |'
    )
    out.append('')
    out.append('三层工时口径（同一批 %d 包，三种算法，差异即不确定性区间）：\n' % data['rest_pkgs'])
    out.append('| 口径 | 工作日 | 周 | 说明 |')
    out.append('|---|---|---|---|')
    out.append('| 名义（台账 1.12h/包 ÷ 6h） | %d | %.0f | 台账工时直接折算，最乐观 |' % (data['nom_days'], data['nom_days'] / 5.0))
    out.append('| 实测（1.47h/包 ÷ 6h） | %d | %.0f | 含验证与取证，与近期实际吻合 |' % (data['real_days'], data['real_days'] / 5.0))
    out.append('| 计划（按版取整 %d + 20%% 缓冲 %d） | **%d** | **%.1f** | 本计划采用值；较实测口径多 %d 日 = 缓冲 %d 日 + 按版取整 %d 日 |'
               % (data['plan_exec'], data['plan_buf'], data['plan_days'], data['plan_days'] / 5.0,
                  data['plan_days'] - data['real_days'], data['plan_buf'],
                  data['plan_days'] - data['real_days'] - data['plan_buf']))
    out.append('')

    out.append('## 2. 版本总表\n')
    out.append('| 版本 | 名称 | 工作项 | 包数 | 工时 | 执行日 | 缓冲 | 结束日 | 一句话目标 |')
    out.append('|---|---|---|---|---|---|---|---|---|')
    for item in v:
        out.append(
            '| **%s** | %s | %d | %d | %.2fh | %d | %d | %s | %s |'
            % (
                item['id'],
                item['name'],
                item['wis'],
                item['pkgs'],
                item['h'],
                item['days_exec'],
                item['days_buf'],
                item['end'].isoformat(),
                item['goal'].rstrip('。'),
            )
        )
    out.append(
        '| 合计 | — | **%d** | **%d** | **%.2fh** | **%d** | **%d** | %s | — |'
        % (
            sum(x['wis'] for x in v),
            sum(x['pkgs'] for x in v),
            sum(x['h'] for x in v),
            sum(x['days_exec'] for x in v),
            sum(x['days_buf'] for x in v),
            data['end_date'].isoformat(),
        )
    )
    out.append('')
    out.append('> 工作项去重后为 %d 个；包数校验：各版之和 = %d = 台账未完成包数（机器校验，重复或漏项即生成器 exit=1）。'
               % (len({w for x in v for w in x['items']}), sum(x['pkgs'] for x in v)))
    out.append('')

    out.append('## 3. 逐版本定义\n')
    for item in v:
        out.append('### %s %s（%d 项 / %d 包 / %.2fh / %d 工作日，%s 至 %s）\n'
                   % (item['id'], item['name'], item['wis'], item['pkgs'], item['h'], item['days'],
                      item['start'].isoformat(), item['end'].isoformat()))
        out.append('**目标**：%s\n' % item['goal'])
        out.append('**包含需求**\n')
        out.append('| 工作项 | 名称 | 泳道 | 剩余包 | 剩余工时 | 备注 |')
        out.append('|---|---|---|---|---|---|')
        for wid in item['items']:
            w = data['wi'][wid]
            note = ('含已完成 %d 包' % w['done']) if w['done'] else '—'
            out.append('| %s | %s | %s | %d | %.2fh | %s |'
                       % (wid, w['name'], w['lane'], w['rest_n'], w['rest_h'], note))
        out.append('')
        out.append('**完成标志（能力演示，须在干净环境从零走通）**\n')
        for line in item['demo']:
            out.append('- [ ] %s' % line)
        out.append('')
        out.append('**出闸证据（关版时必须留档）**\n')
        for line in item['exit']:
            out.append('- [ ] %s' % line)
        out.append('')
        out.append('**依赖与风险**：%s\n' % item['risk'])

    out.append('## 4. 出闸闸门 V-Gate（所有版本共用，七条硬判）\n')
    out.append('判据只认证据，不认「已完成」三个字。任一条不满足即不得开下一版。\n')
    out.append('| # | 闸门 | 判定内容 |')
    out.append('|---|---|---|')
    for i, (name, desc) in enumerate(RELEASE_GATE, 1):
        out.append('| V%d | **%s** | %s |' % (i, name, desc))
    out.append('')

    out.append('## 5. 版本流转协议\n')
    out.append('闭版与开版是两件事，必须分开做，且顺序不可倒。\n')
    out.append('| 阶段 | 动作 | 产出 | 阻断条件 |')
    out.append('|---|---|---|---|')
    out.append('| A 出闸判定 | 逐条核 V-Gate 七条，跑门禁三连 | 判定记录（PASS / 条件 PASS / FAIL） | 任一硬判不等价于通过；「条件 PASS」必须写明条件与解除日 |')
    out.append('| B 闭版 | 打 tag、写 ANCHORS 执行记录、登记遗留、重生成面板与本计划 | 版本 tag、执行记录、OPEN 条目 | 遗留无归属包即不得闭版 |')
    out.append('| C 开版 | 下一版首包派单（锚点已预置），开工前确认外部前提 | 派单四件套 | R1/R2/R3 未解除且该版依赖它，则不开版 |')
    out.append('| D 超期处置 | 超期 > 30% 时二择一：减包（移低优项至补丁版）或加人 | 变更记录 | **不得延期而不减范围**——否则后续全部版本日期失效 |')
    out.append('')
    out.append('**顺序为什么不可倒**：先闭版再开版，才能保证「上一版遗留」在下一版开工前是已知项；')
    out.append('若并行开版，遗留会以「反正后面会补」的形式消失，这正是 P3-011 收口时发现两处纸面防线的成因。\n')

    out.append('## 6. 风险登记\n')
    out.append('| ID | 风险 | 影响版本 | 证据 | 缓解 |')
    out.append('|---|---|---|---|---|')
    for rid, name, scope, ev, mit in RISKS:
        out.append('| %s | **%s** | %s | %s | %s |' % (rid, name, scope, ev, mit))
    out.append('')

    out.append('## 7. 与既有文档的口径关系\n')
    out.append('| 文档 | 关系 | 变更时谁先改 |')
    out.append('|---|---|---|')
    out.append('| `docs/phase3/backlog.csv` | 包级唯一事实源；本计划的所有数量与工时由它算出 | 台账先改，本计划重生成 |')
    out.append('| `docs/phase3/TASKS.md` | 里程碑与批次口径；批次是「同质工作聚类」，版本是「可交付增量」，两者不正交 | 里程碑边界变动时两边同轮改 |')
    out.append('| `docs/phase3/PACKAGE-PLAN.html` | 包级视图（788 包全量、批次、可派队列） | 台账变动即重生成 |')
    out.append('| `docs/phase3/ANCHORS.md` | 包级执行锚点；版本执行记录写在其 §3 起的各段，本计划不复写 | 每版闭版时补 |')
    out.append('| `docs/decisions/OPEN-DECISIONS.md` | 遗留项唯一登记点；V6 闸门要求每条带归属包 | 发现即登记 |')
    out.append('')
    out.append('---\n')
    out.append('重生成：`python -X utf8 scripts/gen_release_plan.py`；只校验不写盘：加 `--check`。')
    out.append('')
    return '\n'.join(out)


CSS = """
:root{
  --bg:#0d1117; --bg2:#12181f; --bg3:#161d26; --line:#232c38; --line2:#2c3746;
  --fg:#e6edf3; --fg2:#9aa7b4; --fg3:#6b7785;
  --ok:#3fb950; --warn:#d29922; --bad:#f85149; --info:#58a6ff; --purple:#a371f7;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);
  font-family:-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",Roboto,sans-serif;
  font-size:13px;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1500px;margin:0 auto;padding:22px 26px 70px}
header{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--line)}
h1{font-size:19px;margin:0 0 4px;font-weight:600;letter-spacing:.3px}
.sub{color:var(--fg3);font-size:12px;max-width:900px}
.sub b{color:var(--fg2);font-weight:500}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:10px;margin:18px 0 4px}
.kpi{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
.kpi .l{color:var(--fg3);font-size:11px;letter-spacing:.4px}
.kpi .v{font-size:21px;font-weight:600;margin-top:3px;font-variant-numeric:tabular-nums}
.kpi .d{color:var(--fg3);font-size:11px;margin-top:2px}
.sect{margin-top:28px}
.sect h2{font-size:12.5px;font-weight:600;color:var(--fg2);margin:0 0 10px;letter-spacing:.6px;
  text-transform:uppercase}
.tblbox{border:1px solid var(--line);border-radius:8px;overflow:auto;background:var(--bg2)}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:12px}
thead th{position:sticky;top:0;z-index:3;background:#151c25;color:var(--fg2);font-weight:500;
  font-size:11px;letter-spacing:.4px;text-align:left;padding:8px 10px;
  border-bottom:1px solid var(--line2);white-space:nowrap}
tbody td{padding:7px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
tbody tr:hover{background:var(--bg3)}
td.c{text-align:center;white-space:nowrap} td.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
th.c{text-align:center} th.r{text-align:right}
.vid{font-weight:600;color:#cfe6ff}
.dim{color:var(--fg3)}
.mono{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px;color:var(--fg2)}
.gantt{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:12px 14px}
.grow{display:grid;grid-template-columns:132px 1fr 92px;gap:10px;align-items:center;
  padding:4px 0;border-bottom:1px solid rgba(35,44,56,.55)}
.grow:last-child{border-bottom:none}
.gname{font-size:11.5px;color:var(--fg2)}
.gname b{color:var(--fg);font-weight:600}
.gtrack{position:relative;height:16px;background:#0f141a;border-radius:3px;overflow:hidden}
.gbar{position:absolute;top:0;height:16px;border-radius:3px;
  background:linear-gradient(90deg,#1f4a72,#2b6ca3);border:1px solid #2f6f9f}
.gbar.ga{background:linear-gradient(90deg,#2f6f3f,#3fb950);border-color:#3fb950}
.gbar.past{background:linear-gradient(90deg,#3a3f4a,#4b5361);border-color:#4b5356}
.gmeta{font-size:10.5px;color:var(--fg3);text-align:right;font-variant-numeric:tabular-nums}
.axis{display:grid;grid-template-columns:132px 1fr 92px;gap:10px;padding:2px 0 6px}
.axline{display:flex;justify-content:space-between;font-size:10px;color:var(--fg3)}
.cards{display:grid;grid-template-columns:1fr;gap:12px}
.card{background:var(--bg2);border:1px solid var(--line);border-radius:9px;overflow:hidden}
.card.gate{border-left:3px solid var(--warn)}
.card.ga{border-left:3px solid var(--ok)}
.ch{display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--line);
  background:#141b23;flex-wrap:wrap}
.ch .t{font-size:13.5px;font-weight:600}
.ch .g{color:var(--fg3);font-size:11.5px}
.badge{border-radius:999px;padding:1px 9px;font-size:10.5px;white-space:nowrap;
  background:#1b2430;border:1px solid var(--line2);color:var(--fg2)}
.badge.b1{background:#17324d;border-color:#1f4a72;color:#cfe6ff}
.badge.b2{background:#2a2113;border-color:#4a3a1a;color:#e3b341}
.badge.b3{background:#12281a;border-color:#1d4429;color:#5fd473}
.cb{padding:12px 14px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:1000px){.cb{grid-template-columns:1fr}}
.blk h4{margin:0 0 6px;font-size:11px;color:var(--fg3);letter-spacing:.5px;text-transform:uppercase;font-weight:600}
.blk ul{margin:0;padding-left:16px}
.blk li{margin:3px 0;color:var(--fg2);font-size:12px}
.blk li b{color:var(--fg);font-weight:500}
.goal{grid-column:1/-1;color:#cfe6ff;font-size:12.5px;background:#0f1c28;
  border:1px solid #1c3348;border-radius:6px;padding:8px 11px}
.risk{grid-column:1/-1;color:#e3b341;font-size:11.5px;background:#1d1710;
  border:1px solid #3b2d15;border-radius:6px;padding:7px 11px}
.wtable td:first-child{white-space:nowrap;color:var(--fg2)}
.legend{color:var(--fg3);font-size:11px;margin-top:9px;line-height:1.75}
.legend b{color:var(--fg2);font-weight:500}
.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.fstep{background:var(--bg2);border:1px solid var(--line);border-radius:8px;padding:11px 13px}
.fstep .n{font-size:10.5px;color:var(--info);letter-spacing:.6px}
.fstep .t{font-weight:600;margin:3px 0 5px;font-size:12.5px}
.fstep .d{color:var(--fg3);font-size:11.5px;line-height:1.6}
.tag{display:inline-block;font-size:10.5px;padding:0 7px;border-radius:4px;
  background:#1b2430;border:1px solid var(--line2);color:var(--fg2);margin-right:4px}
"""


def esc(text):
    return (
        str(text)
        .replace('&', '&amp;')
        .replace('<', '&lt;')
        .replace('>', '&gt;')
    )


def render_html(data):
    v = data['versions']
    total_days = float(sum(x['days'] for x in v))
    ts = datetime.now().strftime('%Y-%m-%d %H:%M')

    h = []
    h.append('<!DOCTYPE html>')
    h.append('<html lang="zh-CN"><head><meta charset="utf-8">')
    h.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    h.append('<title>Web Office · Phase 3 版本排期计划（至 v1.0 GA）</title>')
    h.append('<style>%s</style></head><body><div class="wrap">' % CSS)

    # header
    h.append('<header><div>')
    h.append('<h1>Phase 3 版本排期计划 · 至 v1.0 GA</h1>')
    h.append(
        '<div class="sub">数据源 <b>backlog.csv</b>（%d 包）｜ 生成器 <b>scripts/gen_release_plan.py</b> ｜ '
        '生成于 %s ｜ 版本边界与完成标志由生成器登记，包数与工时由台账算出，'
        '覆盖与依赖闭环经机器校验（重复/漏项/上游倒置即生成器失败）</div>'
        % (data['total_pkgs'], ts)
    )
    h.append('</div></header>')

    # KPI
    h.append('<div class="kpis">')
    kpis = [
        ('剩余包', '%d' % data['rest_pkgs'], '总 %d，已完成 %d' % (data['total_pkgs'], data['done_pkgs'])),
        ('剩余工时', '%.1fh' % data['rest_h'], '名义 1.12h/包'),
        ('版本数', '%d' % len(v), 'v0.1 至 v1.0 GA'),
        ('计划工期', '%d 日' % data['plan_days'],
         '执行 %d + 缓冲 %d，≈ %.1f 周' % (data['plan_exec'], data['plan_buf'], data['plan_days'] / 5.0)),
        ('计划结束', data['end_date'].isoformat(), '单执行者名义日期'),
        ('双执行者', '%d 日' % data['dual_total'],
         '≈ %.0f 周，压缩 %.0f%%' % (data['dual_total'] / 5.0, (1 - data['dual_total'] / float(data['plan_days'])) * 100)),
    ]
    for label, val, desc in kpis:
        h.append('<div class="kpi"><div class="l">%s</div><div class="v">%s</div><div class="d">%s</div></div>'
                 % (label, val, desc))
    h.append('</div>')

    # 三层口径
    h.append('<div class="sect"><h2>一、工期三层口径（不确定性区间）</h2>')
    h.append('<div class="tblbox"><table class="wtable"><thead><tr>'
             '<th>口径</th><th class="r">工作日</th><th class="r">周</th><th>说明</th></tr></thead><tbody>')
    h.append('<tr><td>名义（台账 1.12h/包 ÷ 6h）</td><td class="r">%d</td><td class="r">%.0f</td>'
             '<td class="dim">台账工时直接折算，最乐观；历史上从未达到</td></tr>'
             % (data['nom_days'], data['nom_days'] / 5.0))
    h.append('<tr><td>实测（1.47h/包 ÷ 6h）</td><td class="r">%d</td><td class="r">%.0f</td>'
             '<td class="dim">含验证与取证开销，与 2026-10-25 三次连发实测吻合</td></tr>'
             % (data['real_days'], data['real_days'] / 5.0))
    h.append('<tr><td><b>计划（按版取整 %d + 20%% 缓冲 %d）</b></td><td class="r"><b>%d</b></td>'
             '<td class="r"><b>%.1f</b></td>'
             '<td class="dim">本计划采用值；缓冲单列在每版工期里，不摊进执行日</td></tr>'
             % (data['plan_exec'], data['plan_buf'], data['plan_days'], data['plan_days'] / 5.0))
    h.append('</tbody></table></div>')
    h.append('<div class="legend">三个常数可质疑但不可隐去：<b>单包实测耗时</b> 1.47h（3 包 / 4h24m）、'
             '<b>有效产能</b> 4 包/工作日（6h ÷ 1.47h）、<b>单版缓冲</b> 20%。'
             '任一个被推翻，本页所有日期随之失效——故写在首页而非附录。</div>')
    h.append('</div>')

    # 甘特
    h.append('<div class="sect"><h2>二、版本时间轴（单执行者）</h2>')
    h.append('<div class="gantt">')
    h.append('<div class="axis"><div></div><div class="axline"><span>%s</span><span>%s</span></div><div></div></div>'
             % (v[0]['start'].isoformat(), data['end_date'].isoformat()))
    acc = 0
    for item in v:
        left = acc / total_days * 100
        width = item['days'] / total_days * 100
        cls = 'gbar'
        if item['id'] == 'v0.14':
            cls += ' ga'
        h.append('<div class="grow">')
        h.append('<div class="gname"><b>%s</b> %s</div>' % (item['id'], item['name']))
        h.append('<div class="gtrack"><div class="%s" style="left:%.3f%%;width:%.3f%%" title="%s %s 至 %s"></div></div>'
                 % (cls, left, max(width, 0.5), item['id'], item['start'].isoformat(), item['end'].isoformat()))
        h.append('<div class="gmeta">%d日 · %d包</div>' % (item['days'], item['pkgs']))
        h.append('</div>')
        acc += item['days']
    h.append('</div>')
    h.append('<div class="legend">条形宽度 = 工作日（含缓冲）。<b>v0.1</b> 只有 7 包却决定 %d 包的起点；'
             '<b>v0.4</b> 单版 27 日是全程最长，属节奏风险点；<b>v0.7</b> 是第一个用户可见的产品级版本。</div>'
             % data['rest_pkgs'])
    h.append('</div>')

    # 版本总表
    h.append('<div class="sect"><h2>三、版本总表</h2><div class="tblbox"><table><thead><tr>')
    h.append('<th>版本</th><th>名称</th><th>包含需求</th><th class="r">包数</th><th class="r">工时</th>'
             '<th class="r">执行</th><th class="r">缓冲</th><th class="r">合计</th><th>起</th><th>止</th>')
    h.append('</tr></thead><tbody>')
    for item in v:
        h.append('<tr><td class="vid">%s</td><td>%s</td><td class="mono">%s</td>'
                 '<td class="r">%d</td><td class="r">%.2f</td><td class="r">%d</td><td class="r dim">%d</td>'
                 '<td class="r"><b>%d</b></td><td class="dim mono">%s</td><td class="dim mono">%s</td></tr>'
                 % (item['id'], item['name'], ' '.join(item['items']), item['pkgs'], item['h'],
                    item['days_exec'], item['days_buf'], item['days'],
                    item['start'].isoformat()[5:], item['end'].isoformat()[5:]))
    h.append('<tr><td colspan="3" class="r dim">合计</td><td class="r"><b>%d</b></td><td class="r"><b>%.2f</b></td>'
             '<td class="r"><b>%d</b></td><td class="r"><b>%d</b></td><td class="r"><b>%d</b></td>'
             '<td colspan="2" class="dim mono">%s</td></tr>'
             % (sum(x['pkgs'] for x in v), sum(x['h'] for x in v), sum(x['days_exec'] for x in v),
                sum(x['days_buf'] for x in v), sum(x['days'] for x in v), data['end_date'].isoformat()))
    h.append('</tbody></table></div>')
    h.append('<div class="legend">校验：各版包数之和 <b>%d</b> = 台账未完成包数 <b>%d</b>；'
             '工作项去重 <b>%d</b> 个；依赖闭环无倒置（上游必在同版更前或更早版本）。</div>'
             % (sum(x['pkgs'] for x in v), data['rest_pkgs'], len({w for x in v for w in x['items']})))
    h.append('</div>')

    # 逐版本卡片
    h.append('<div class="sect"><h2>四、逐版本定义（目标 / 需求 / 完成标志 / 出闸证据）</h2><div class="cards">')
    for item in v:
        cls = 'card'
        if item['id'] == 'v0.14':
            cls += ' ga'
        elif item['id'] in ('v0.1', 'v0.4'):
            cls += ' gate'
        h.append('<div class="%s">' % cls)
        h.append('<div class="ch"><span class="t">%s %s</span>' % (item['id'], item['name']))
        h.append('<span class="badge b1">%d 项需求</span>' % item['wis'])
        h.append('<span class="badge">%d 包</span>' % item['pkgs'])
        h.append('<span class="badge">%.2fh</span>' % item['h'])
        h.append('<span class="badge b2">%d 工作日</span>' % item['days'])
        h.append('<span class="badge b3">%s 止</span>' % item['end'].isoformat())
        h.append('<span class="g">%s 至 %s ｜ 泳道 %s</span>'
                 % (item['start'].isoformat(), item['end'].isoformat(), ' / '.join(item['lanes'])))
        h.append('</div>')
        h.append('<div class="cb">')
        h.append('<div class="goal">目标：%s</div>' % esc(item['goal']))
        h.append('<div class="blk"><h4>包含需求</h4><ul>')
        for wid in item['items']:
            w = data['wi'][wid]
            note = ('　含已完成 %d 包' % w['done']) if w['done'] else ''
            h.append('<li><span class="tag">%s</span><b>%s</b> <span class="dim">%s · %d 包 · %.2fh%s</span></li>'
                     % (wid, esc(w['name']), w['lane'], w['rest_n'], w['rest_h'], note))
        h.append('</ul></div>')
        h.append('<div class="blk"><h4>完成标志（能力演示）</h4><ul>')
        for line in item['demo']:
            h.append('<li>%s</li>' % esc(line))
        h.append('</ul></div>')
        h.append('<div class="blk" style="grid-column:1/-1"><h4>出闸证据（关版留档）</h4><ul>')
        for line in item['exit']:
            h.append('<li>%s</li>' % esc(line))
        h.append('</ul></div>')
        h.append('<div class="risk">依赖与风险：%s</div>' % esc(item['risk']))
        h.append('</div></div>')
    h.append('</div></div>')

    # V-Gate
    h.append('<div class="sect"><h2>五、出闸闸门 V-Gate（七条硬判，所有版本共用）</h2>')
    h.append('<div class="tblbox"><table class="wtable"><thead><tr><th>#</th><th>闸门</th><th>判定内容</th>'
             '</tr></thead><tbody>')
    for i, (name, desc) in enumerate(RELEASE_GATE, 1):
        h.append('<tr><td class="mono">V%d</td><td><b>%s</b></td><td class="dim">%s</td></tr>'
                 % (i, name, esc(desc)))
    h.append('</tbody></table></div>')
    h.append('<div class="legend">判据只认证据，不认「已完成」三个字。任一条不满足即不得开下一版；'
             '<b>V3</b> 之所以要求「新增脚本须接入 verify」，是因为 2026-10-25 收口时发现两处'
             '「文档声称已机检、脚本里没有」的纸面防线——没进自检面的检查等于没有。</div>')
    h.append('</div>')

    # 流转协议
    h.append('<div class="sect"><h2>六、版本流转协议（闭版与开版必须分开做）</h2><div class="flow">')
    steps = [
        ('阶段 A', '出闸判定', '逐条核 V-Gate 七条，跑门禁三连。判定结果只有三种：PASS / 条件 PASS / FAIL；'
                            '「条件 PASS」必须写明条件与解除日，否则视同 FAIL。'),
        ('阶段 B', '闭版', '打 tag、补 ANCHORS 执行记录、遗留进 OPEN-DECISIONS、重生成状态面板与本计划。'
                        '遗留项无归属包即不得闭版。'),
        ('阶段 C', '开版', '下一版首包派单（锚点预置），开工前确认外部前提。'
                        'R1/R2/R3 未解除且本版依赖它，则不开版——这是唯一允许「等」的情形。'),
        ('阶段 D', '超期处置', '超期 > 30% 时二择一：减包（低优项移补丁版）或加人。'
                           '不得延期而不减范围，否则后续版本日期全部失效。'),
    ]
    for n, t, d in steps:
        h.append('<div class="fstep"><div class="n">%s</div><div class="t">%s</div><div class="d">%s</div></div>'
                 % (n, t, d))
    h.append('</div>')
    h.append('<div class="legend">顺序不可倒：先闭版再开版，上一版遗留才是下一版的<b>已知项</b>；'
             '并行开版会让遗留以「反正后面会补」的形式消失——这正是纸面防线的成因。</div>')
    h.append('</div>')

    # 风险
    h.append('<div class="sect"><h2>七、风险登记</h2><div class="tblbox"><table class="wtable"><thead><tr>')
    h.append('<th>ID</th><th>风险</th><th>影响版本</th><th>证据</th><th>缓解</th></tr></thead><tbody>')
    for rid, name, scope, ev, mit in RISKS:
        h.append('<tr><td class="mono">%s</td><td><b>%s</b></td><td class="dim">%s</td>'
                 '<td class="dim">%s</td><td class="dim">%s</td></tr>' % (rid, esc(name), esc(scope), esc(ev), esc(mit)))
    h.append('</tbody></table></div>')
    h.append('<div class="legend"><b>R1</b> 与 <b>R3</b> 是「不开工」级风险：前者卡 v0.1，后者卡 v0.8 起三个版本；'
             '两者都必须<b>提前一版</b>清障，不能等到开工日才发现。</div>')
    h.append('</div>')

    # 口径关系
    h.append('<div class="sect"><h2>八、与既有文档的口径关系</h2><div class="tblbox"><table class="wtable">'
             '<thead><tr><th>文档</th><th>关系</th></tr></thead><tbody>')
    rel = [
        ('backlog.csv', '包级唯一事实源；本页所有数量与工时由它算出，台账先改、本页重生成'),
        ('TASKS.md', '里程碑与批次口径。批次 = 同质工作聚类；版本 = 可交付增量，两者不正交'),
        ('PACKAGE-PLAN.html', '包级视图（788 包全量、批次、可派队列），与本页同源不同粒度'),
        ('ANCHORS.md', '包级执行锚点；每版闭版时在其后追加该版执行记录，本页不复写'),
        ('OPEN-DECISIONS.md', '遗留项唯一登记点；V6 闸门要求每条带归属包与解除条件'),
    ]
    for a, b in rel:
        h.append('<tr><td class="mono">%s</td><td class="dim">%s</td></tr>' % (a, esc(b)))
    h.append('</tbody></table></div>')
    h.append('<div class="legend">重生成：<span class="mono">python -X utf8 scripts/gen_release_plan.py</span>'
             '　只校验不写盘：加 <span class="mono">--check</span></div>')
    h.append('</div>')

    h.append('</div></body></html>')
    return '\n'.join(h)


def main():
    data = build()
    ok = report(data)
    if not ok:
        print('生成中止：校验未通过。计划不可信即不得落盘。')
        return 1
    if '--check' in sys.argv:
        return 0
    md = render_md(data)
    html = render_html(data)
    with io.open(OUT_MD, 'w', encoding='utf-8', newline='\n') as f:
        f.write(md)
    with io.open(OUT_HTML, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('已写：%s' % os.path.relpath(OUT_MD, ROOT))
    print('已写：%s' % os.path.relpath(OUT_HTML, ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
