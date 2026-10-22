# D1-10 License 判定链与时钟

> 卡号：D1-10 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M3→B6 前置 | 需求域 R7 设计层
> 消费方（首包）：**P3-122**（SM2 验签与 License 解析，依赖 `P3-121-05|D1-10-02`）；设计意图覆盖 P3-120/123/124/125（共 29 包）
> 主要出处：license/design.md §2.4（时钟三层）/§2.5（断言三级）/§2.1-c（路线 A + 拷卷即过承认）/§3（换绑四步）/§4-bis（席位计量）/§6-bis（商务披露）、Spec §10 License 定位行与 AC-09、openapi /license/* 端点与 registry 5001/5002、D1-05（三出口等价约束 + ③ 档位 D）、D1-08（SeatMeter/席位口径/peak_concurrent）、D1-11（启动断言链 ② 步 + WO_LICENSE_PUBLIC_KEY）
> 状态：v1.0 已完成（D1-10-01/02 收口 2026-10-22）

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| 判定器签名 | `evaluateLicense(): { state: 'valid' \| 'readonly-license' \| 'readonly-grace' \| 'invalid', reason?, seatsTotal, seatsUsed, expiresAt, graceUntil? }`——单例服务，出口供三防线消费；**invalid（验签失败）≠ readonly（降级）**，语义分层 | 本卡新定（依据 AC-09 + 5001/5002 分码） |
| 判定输入三源 | ① License 文件（SM2 验签后的载荷：席位/有效期/指纹快照）② `licenses` 表（status/max_seen_at/peak_concurrent）③ SeatMeter.current()（D1-08 四操作，判定链只读不占不释放——占席在连接网关） | license §2.2/§2.4 + D1-08 |
| 时钟口径 | **判定基准 now() ≡ max(系统时钟, max_seen_at)**；`max_seen_at` 每次判定成功即更新（应用层，licenses 表）；回拨检测：`系统时钟 < max_seen_at − 24h` → 审计告警（license.clock-rollback，detail 含偏差量）+ 后台状态提示，**不拒绝服务**；偏差 ≤24h 视为正常校时静默容忍 | license §2.4 机制三层 |
| 宽限期 | `expiresAt < now()` → 只读 + 7 天宽限（graceUntil = expiresAt + 7d，同样按 max 口径算）；宽限内提示「已过期，宽限期至 X 日，联系供应商续期」；**超 7 天仍只读不锁死**（登录/查看可用、编辑禁用）——不存在锁死态 | license §2.4 第 3 层 + AC-09 |
| 三层只读防线 | 服务端 HTTP 402+5001（写端点过滤器）/ WS 4409（新 edit 首连与 ROLE_UPGRADE）/ Command 守卫（beforeCommandExecuted 写类拦截）+ UI 只读 banner（pages.md §3.10 三态文案）——**四出口（含 UI）语义必须一致，实现锚点归 D1-05 三出口等价约束，本卡不重复定义** | D1-05 ② + AC-09 + DESIGN-LAYER 任务书条 4 |
| 防拷贝口径 | License = 授权计量与合规凭证，**不承诺防拷贝**（拷卷即过显式承认）；技术侧不做与 §6-bis 矛盾的实现（不搞在线心跳/外呼验证——离线形态无通道且属虚假承诺配套） | license §2.1-c/§6-bis + Spec §10 |

## ② 判定链（短路序，定死）

```
evaluateLicense() 按序短路：
① 验签：SM2 公钥验签 License 文件 → 失败 → state=invalid（5002 语义：拒绝激活/安装，
   既有 active License 不受影响——invalid 只发生在激活与启动装载时，不在线上判定路径）
② 载荷解析：席位/有效期/指纹快照 → 解析失败同 invalid
③ 指纹匹配：分数 ≥0.70 + 关键项（容器形态=卷级盐必过；直装=主板或磁盘至少一项）
   → 不匹配 → 换绑流程（§3 四步），不是降级
④ 到期：now() = max(时钟, max_seen_at) ≥ expiresAt？
   → 否 → 走 ⑤；是 → 宽限判定：now() ≤ graceUntil → readonly-grace（提示含倒计时）
                                              → 超宽限 → readonly-license（仍不锁死）
⑤ 席位：seatsUsed < seatsTotal？ → valid；超 → 三防线只对「新编辑请求」生效
   （HTTP 402 写端点 / WS 4409 新 edit 首连 / Command 守卫），既有编辑会话不中断
成功路径收尾：max_seen_at ← max(时钟, max_seen_at) 持久化
```

**重判触发点（枚举，遗漏即防线漏洞）**：启动装载、激活/换绑安装、登录、WS 握手、60s 周期 re-validate（D1-09）、写端点过滤器逐请求（缓存判定结果 ≤5s，防逐请求全量验签——**缓存是性能优化，TTL 内状态变化由事件主动失效**：激活/换绑/席位跨越时即时刷新）。**回拨告警的检测时机 = 每次判定取 now() 时**（非独立定时器）。

**失败分支**：① licenses 表不可达 → 判定链按 invalid 处理？**否**——按 readonly 处理并告警（DB 故障不是客户的 License 问题，误拒编辑不可接受；与 D1-11 readiness 503+9002 语义联动）；② 验签异常（非失败，如文件损坏）→ 同 invalid；③ 指纹采集异常 → absent 语义（§2.1 不入分母），不打断判定。

## ③ 错误码映射

| 边界 | code | 出口 | 语义 | 出处 |
|---|---|---|---|---|
| 写端点降级 | 5001 | HTTP 402 | 只读降级（过滤器层统一出口） | registry + D1-05 |
| 降级后写操作 | 5001 | HTTP 403 | AC-09 措辞 | D1-05 ① |
| 新 edit 首连/升级 | — | WS 4409 | 只读降级（既有编辑不中断） | D1-05/D1-08 |
| 验签失败/指纹不匹配 | 5002 | HTTP 422（激活/安装端点） | 拒绝，不降级 | registry |
| 回拨 >24h | — | 审计 + 后台提示 | 告警不误杀 | license §2.4 |
| 宽限/超宽限提示 | — | UI banner（状态区分 readonly-grace / readonly-license） | 提示语义差异，行为同只读 | license §2.4 + pages §3.10 |

> 本卡零新增 registry 码；5001/5002 与三防线出口全部既有，本卡只锁**判定链到出口的映射完整性**（state×出口全表 = D1-05 V-3 断言分解）。

## ④ 验收断言补充

| # | 断言 | 落点包 |
|---|---|---|
| V-CHAIN | 判定链短路序：构造 ① 验签坏 ② 载荷坏 ③ 指纹不匹配 ④ 过期宽限内 ⑤ 过期超宽限 ⑥ 超席 六态文件/环境 → 六态出口逐态断言（含 invalid 不出现在线上路径、超宽限不锁死） | P3-122 / P3-123 |
| V-CLOCK | 时钟三层：回拨 48h → 服务不拒 + 审计含偏差 + 判定按 max_seen_at（改时间无法续期实证）；回拨 12h → 静默；前跳至 expiresAt+8d → readonly-grace 提示宽限语义（license §5 用例 10 行为化） | P3-123 |
| V-GATE | 重判触发全覆盖：六触发点逐一注入状态变化 → 防线在 TTL 外即时生效；TTL 内席位跨越 → 主动失效即时刷新（缓存不成为漏洞） | P3-123 / P3-124 |
| V-DBFAIL | licenses 表停 → 判定按 readonly + 告警（非 invalid）；DB 恢复 → 自动回 valid（不要求重启） | P3-123 |
| V-4EXIT | 四出口一致：同一超席态下 HTTP 402 / WS 4409 / Command 守卫 / UI banner 同时可观测且文案状态一致（grace 与 license 态 banner 文案区分断言） | P3-124 / P3-125 |

---

## 卡内待办（不属四栏，供派单参考）

1. 判定结果缓存 TTL 5s 是本卡新定的工程参数（平衡逐请求验签成本与状态即时性）——P3-123 实现时实测验签耗时后可调，回填本卡 ② 栏该行。
2. 换绑四步流程（requestCode 线下交付/旧指纹 revoke/active 应用层唯一性校验）契约已在 license §3 + openapi 完整定义，本卡不重复；P3-125 管理 Tab 消费。
3. `readonly-grace` 与 `readonly-license` 两态在前端 banner 文案区分（宽限倒计时）归 pages.md §3.10 + P3-125；本卡只锁判定链产出 graceUntil 字段。
