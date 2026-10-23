# D1-10 License 判定链与时钟

> 卡号：D1-10 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M3→B6 前置 | 需求域 R7 设计层
> 消费方（首包）：**P3-122**（SM2 验签与 License 解析，依赖 `P3-121-05|D1-10-02`）；设计意图覆盖 P3-120/122/123/124/125（共 29 包——**v1.2 修订**：原枚举漏 P3-122（消费方首包，5 包），枚举机读和 24 ≠ 声明 29；按约定 A 补齐）
> 主要出处：license/design.md §2.4（时钟三层）/§2.5（断言三级）/§2.1-c（路线 A + 拷卷即过承认）/§3（换绑四步）/§4-bis（席位计量）/§6-bis（商务披露）、Spec §10 License 定位行与 AC-09、openapi /license/* 端点与 registry 5001/5002、D1-05（三出口等价约束 + ③ 档位 D）、D1-08（SeatMeter/席位口径/peak_concurrent）、D1-11（启动断言链 ② 步 + WO_LICENSE_PUBLIC_KEY）
> 状态：**v1.7**（2026-10-24 条 N 裁决落盘：④ 栏 V-4EXIT 出口集合改**锚定 D1-05 V-3 不独立枚举**，补 403 出口与全域触发面（OPEN 条 N）｜状态行 v1.1~v1.6 明细段压缩配平——限期净减名单卡，明细由 REVIEW-INDEX 线程段承载）｜v1.6（条 K/L：缺失态 4409 全域 + V-CHAIN fixture 落点迁 packages/shared）｜v1.5（代码放行传导 + V-CHAIN 自签向量诚实化注）｜v1.4（expiresAt 可空缺失态取 null、sm-crypto 四口径、缓存 miss 单飞 + V-SINGLEFLIGHT/V-CHAIN 正向断言）｜v1.3~v1.1（AC-09 统一措辞、席位分域修订、缺失态入判定链 ① 步、V-CHAIN 七态构造；v1.0 于 D1-10-01/02 收口）| 评审记录见 REVIEW-INDEX「D1-10 挑刺审查线程」段

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| 判定器签名 | `evaluateLicense(): { state: 'valid' \| 'readonly-license' \| 'readonly-grace' \| 'invalid', reason?, seatsTotal, seatsUsed, expiresAt: string \| null, graceUntil?: string \| null }`——单例服务，出口供三防线消费；**invalid（验签失败）≠ readonly（降级）**，语义分层。**`expiresAt` 缺失态取值定死 = `null`（v1.4 补，P3-4；不用 `undefined`——JSON 序列化会静默丢字段、前端渲染出 `Invalid Date`）**。消费方（前端 banner / `/license/status`）必须显式处理 `null` 分支（渲染为「未激活/无有效期」而非解析失败），**`graceUntil` 同规则**（未进宽限态时 = `null`） | 本卡新定（依据 AC-09 + 5001/5002 分码）+ **本卡 v1.4 补**（可空与缺失态取值） |
| 判定输入三源 | ① License 文件（SM2 验签后的载荷：席位/有效期/指纹快照）② `licenses` 表（status/max_seen_at/peak_concurrent）③ SeatMeter.current()（D1-08 四操作，判定链只读不占不释放——占席在连接网关） | license §2.2/§2.4 + D1-08 |
| 缺失态（AC-09 三触发之一） | **License 文件缺失/未安装 → state=readonly-license**（只读降级，非 invalid、非拒绝启动）——AC-09 明言「缺失/过期/超席」三触发均降级只读（**分域注 v1.2**：三触发的**降级目标**一致，但 WS 侧出口不同——「无效/缺失/过期」映射 4409、「超席」走角色降级 view、无 close 码（v1.6 条 K 扩义为全域，沿革见 REVIEW-INDEX），见 ③ 栏与 V-4EXIT；**AC-09 措辞已于 2026-10-23 架构师裁决在 Spec §9 按本分域统一（v1.3 标注）**，QA 断言以修订后 AC-09 为准），registry 5001 描述同为三触发并列；缺失态支撑私有化「先部署后激活」流程（启动不依赖 License 文件在场，激活走 /license/install） | AC-09 + registry 5001 + 本卡新定（判定链落点） |
| 时钟口径 | **判定基准 now() ≡ max(系统时钟, max_seen_at)**；`max_seen_at` 每次判定成功即更新（应用层，licenses 表）；回拨检测：`系统时钟 < max_seen_at − 24h` → 审计告警（license.clock-rollback，detail 含偏差量）+ 后台状态提示，**不拒绝服务**；偏差 ≤24h 视为正常校时静默容忍 | license §2.4 机制三层 |
| 宽限期 | `expiresAt < now()` → 只读 + 7 天宽限（graceUntil = expiresAt + 7d，同样按 max 口径算）；宽限内提示「已过期，宽限期至 X 日，联系供应商续期」；**超 7 天仍只读不锁死**（登录/查看可用、编辑禁用）——不存在锁死态 | license §2.4 第 3 层 + AC-09 |
| 三层只读防线 | 服务端 HTTP 402+5001（写端点过滤器）/ WS 4409（**License 无效/缺失/过期时的**新 edit 首连；**席位满不属本码**——满席走角色降级 view 与 role-upgrade-reject 帧，无 close，见 D1-08 v1.1）/ Command 守卫（beforeCommandExecuted 写类拦截）+ UI 只读 banner（pages.md §3.10 三态文案）——**四出口（含 UI）语义必须一致，实现锚点归 D1-05 三出口等价约束，本卡不重复定义** | D1-05 ② + AC-09 + DESIGN-LAYER 任务书条 4 |
| 防拷贝口径 | License = 授权计量与合规凭证，**不承诺防拷贝**（拷卷即过显式承认）；技术侧不做与 §6-bis 矛盾的实现（不搞在线心跳/外呼验证——离线无通道且属虚假承诺配套） | license §2.1-c/§6-bis + Spec §10 |

## ② 判定链（短路序，定死）

```
evaluateLicense() 按序短路：
① 文件在场：License 文件缺失/未安装 → 直接 readonly-license（AC-09「缺失」触发 + registry 5001 三触发并列；
   不拒绝启动——私有化先部署后激活流程；激活安装走 /license/install，v1.1 复评轮补此步）
② 验签：**sm-crypto（npm，0.5.7 精确版本，纯 JS 无原生编译）SM2 公钥验签** License 文件 → 失败 → state=invalid
   （5002 语义：拒绝激活/安装，既有 active License 不受影响——invalid 只发生在激活与启动装载时，不在线上判定路径）。
   **实现口径（v1.4 补，Q1 拍板 C1/C2）**：**Node 原生 `crypto` 不得用于 SM2 验签**——其 SM2 路径无 ZA 计算、无 distid 参数，
   与 GM/T 0003.2 不互通（实测与 OpenSSL 双向互拒、PEM 重导入丢曲线元数据），属**不可修复项**非配置问题；
   userId/distid 锁 `1234567812345678`（GM/T 标准值，单一定义点
   = `packages/shared/src/license/sm2-constants.ts` 的 `SM2_DEFAULT_USER_ID`：该文件是四口径的**唯一定义点**，签发侧（`scripts/issue-license.mjs`）与验签侧（本判定链）**两侧 import 同一常量**，禁止两处各写字面量）；
   签名编码 = 标准 DER（用 sm-crypto 内建 `{der:true}`，**禁止手写 ASN.1 编码**）；payload = canonical JSON（键字典序递归排序）。
   **Node 原生 crypto 仅保留 SM3/SM4/PBKDF2 职责**（D1-11 ② G1/G4/G5 不变）
③ 载荷解析：席位/有效期/指纹快照 → 解析失败同 invalid
④ 指纹匹配：分数 ≥0.70 + 关键项（容器形态=卷级盐必过；直装=主板或磁盘至少一项）
   → 不匹配 → 换绑流程（§3 四步），不是降级
⑤ 到期：now() = max(时钟, max_seen_at) ≥ expiresAt？
   → 否 → 走 ⑥；是 → 宽限判定：now() ≤ graceUntil → readonly-grace（提示含倒计时）
                                              → 超宽限 → readonly-license（仍不锁死）
⑥ 席位：seatsUsed < seatsTotal？ → valid；超 → 三防线只对「新编辑请求」生效
   （HTTP 402 写端点 / Command 守卫 / WS 侧 = **新 edit 首连降级 view，无 close 码**），既有编辑会话不中断
   ——**v1.2 分域修订（v1.6 条 K 扩域）**：席位满属席位域，WS 侧不出 4409（4409 属 License 无效/缺失/过期域），依据 Spec §10 与 D1-08 v1.1
成功路径收尾：max_seen_at ← max(时钟, max_seen_at) 持久化
```

**重判触发点（枚举，遗漏即防线漏洞）**：启动装载、激活/换绑安装、登录、WS 握手、60s 周期 re-validate（D1-09）、写端点过滤器逐请求（缓存判定结果 ≤5s，防逐请求全量验签——**缓存是性能优化，TTL 内状态变化由事件主动失效**：激活/换绑/席位跨越时即时刷新）。**回拨告警的检测时机 = 每次判定取 now() 时**（非独立定时器）。
**缓存 miss 的验签必须单飞（v1.4 补，Q1 拍板 C3；属架构裁决不是实现者自选）**：实测 sm-crypto 单次 SM2 验签 **≈19.4ms**。若缓存 miss 时逐请求各验一次，100 并发写请求 ≈ 2s 阻塞，直接吃掉请求预算。**口径定死**：判定结果缓存 TTL 5s 不变（④ V-GATE「TTL 内即时生效」不放松），但**缓存 miss 的验签必须走单飞**——同进程内并发的多个写请求共享一次验签，首个请求触发、其余复用其结果。**判据见 ④ V-SINGLEFLIGHT**。

**失败分支**：① licenses 表不可达 → 判定链按 invalid 处理？**否**——按 readonly 处理并告警（DB 故障非客户 License 问题、误拒编辑不可接受；与 D1-11 readiness 503+9002 语义联动）；② 验签异常（非失败，如文件损坏）→ 同 invalid；③ 指纹采集异常 → absent 语义（§2.1 不入分母），不打断判定。

## ③ 错误码映射

| 边界 | code | 出口 | 语义 | 出处 |
|---|---|---|---|---|
| 写端点降级 | 5001 | HTTP 402 | 只读降级（过滤器层统一出口） | registry + D1-05 |
| 降级后写操作 | 5001 | HTTP 403 | Spec §12 实证（D1-05 v1.1 已修出处；AC-09 只定降级未定 403 档） | D1-05 ① |
| 新 edit 首连（License 无效/缺失/过期） | — | WS 4409 | 只读降级（既有编辑不中断） | D1-05/D1-08 |
| 席位满（License 有效） | — | **无 close 码** | 新 edit 首连降级 view；ROLE_UPGRADE 满席回 reject 帧——连接均不中断 | D1-08 v1.1 + Spec §10 |
| 验签失败/指纹不匹配 | 5002 | HTTP 422（激活/安装端点） | 拒绝，不降级 | registry |
| 回拨 >24h | — | 审计 + 后台提示 | 告警不误杀 | license §2.4 |
| 宽限/超宽限提示 | — | UI banner（状态区分 readonly-grace / readonly-license） | 提示语义差异，行为同只读 | license §2.4 + pages §3.10 |

> 本卡零新增 registry 码；5001/5002 与三防线出口全部既有，本卡只锁**判定链到出口的映射完整性**（state×出口全表 = D1-05 V-3 断言分解）。

## ④ 验收断言补充

| # | 断言 | 落点包 |
|---|---|---|
| V-CHAIN | 判定链短路序：构造 ① 文件缺失/未安装 ② 验签坏 ③ 载荷坏 ④ 指纹不匹配 ⑤ 过期宽限内 ⑥ 过期超宽限 ⑦ 超席 七态文件/环境 → 七态出口逐态断言（含缺失态降级不拒启动、invalid 不出现在线上路径、超宽限不锁死）。**正向断言（v1.4 补，P0-2 原刺）**：本条七态**全为负向态**，缺少「合法 License → 验签通过 → state=valid → 激活成功（`POST /license/install` 2xx）→ 写端点放行」的**正向闭环**——补后本条为 7 负 + 1 正共八态；正向态必须由**本仓签发脚本产出的 fixture**（`scripts/issue-license.mjs`，已于 2026-10-23 落盘；`--gen-fixture` 产出 fixture——**落点 v1.6 迁 `packages/shared/src/license/fixtures/`（条 L 裁决：单一物理源模块化分发，物理迁移随代码放行批、过渡居 `scripts/fixtures/`）**）或等价标准向量驱动，**不得用「把验签 mock 掉」替代**（mock 掉即 P0-1 假阳性复发）。**诚实化注（v1.5）**：该 fixture 由本仓 sm-crypto 签发，属**自签向量**——它足以驱动本条「合法 License → valid → 激活成功」的正向闭环（本条验的是判定链自洽，不是跨实现互通），但**不得**据本条声称与 GM/T 标准实现互通；**互通性由 D1-11 ② 的 G8（OpenSSL CLI 交叉验签）独家承担** | P3-122 / P3-123 |
| V-CLOCK | 时钟三层：回拨 48h → 服务不拒 + 审计含偏差 + 判定按 max_seen_at（改时间无法续期实证）；回拨 12h → 静默；前跳至 expiresAt+8d → readonly-grace 提示宽限语义（license §5 用例 10 行为化） | P3-123 |
| V-GATE | 重判触发全覆盖：六触发点逐一注入状态变化 → 防线在 TTL 外即时生效；TTL 内席位跨越 → 主动失效即时刷新（缓存不成为漏洞）。**与 V-SINGLEFLIGHT 的分工（v1.4 注）**：本条验「状态变化的即时性」，V-SINGLEFLIGHT 验「缓存 miss 时的验签次数」，两者正交——不得用本条覆盖单飞（本条在单飞缺失时仍可通过） | P3-123 / P3-124 |
| V-DBFAIL | licenses 表停 → 判定按 readonly + 告警（非 invalid）；DB 恢复 → 自动回 valid（不要求重启） | P3-123 |
| V-SINGLEFLIGHT | 验签单飞（**v1.4 新增，Q1 拍板 C3 的可执行判据**）：清空判定结果缓存后，**同一进程内并发发起 N 个写端点请求（N ≥ 20）**，断言 **SM2 验签调用计数 = 1**（判据 = 在验签函数入口挂计数器/包一层 spy 计数；**不接受「用耗时间接推断」**——耗时判据在 CI 上不稳定）。反断言：串行发起（每请求间隔 > 验证窗）N 个请求 → 验签计数按缓存 TTL 内复用、TTL 外各 1 次，不得恒为 1（防把单飞写成「永久缓存一次」）。**门禁要求**：本条断言不落地则 ② 栏「缓存 miss 的验签必须单飞」即不可验证断言 | P3-123 |
| V-4EXIT | 四出口一致（**v1.7 条 N 分工：出口集合锚定 D1-05 V-3、本条不独立枚举**——V-3 = 服务端出口等价半部（HTTP 402 写端点 / 403 降级后写 / WS 4409 / Command 守卫），本条在其上唯一追加 UI banner 文案状态一致 + 席位满态分域对照；原「仅 HTTP 402」系枚举漏项，403 即本条落点包 P3-124 验收列「降级后写操作全部拒绝」）：**License 域降级态（无效/缺失/过期，条 K 全域口径）**下 HTTP 402/403 / WS 4409 / Command 守卫 / UI banner 全出口可观测且文案状态一致；**席位满态**下可观测出口为 HTTP 402 + Command 守卫 + UI banner + WS 侧「角色降级 view、连接存活」（无 close 码）。两态不得混用同一断言（v1.2 分域修订） | P3-124 / P3-125 |

---

## 卡内待办（不属四栏，供派单参考）

1. 判定结果缓存 TTL 5s 是本卡新定的工程参数（平衡逐请求验签成本与状态即时性）——P3-123 实现时实测验签耗时后可调，回填本卡 ② 栏该行。
2. 换绑四步流程（requestCode 线下交付/旧指纹 revoke/active 应用层唯一性校验）契约已在 license §3 + openapi 完整定义，本卡不重复；P3-125 管理 Tab 消费。
3. `readonly-grace` 与 `readonly-license` 两态在前端 banner 文案区分（宽限倒计时）归 pages.md §3.10 + P3-125；本卡只锁判定链产出 graceUntil 字段。
