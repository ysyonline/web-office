# D1-09 认证与 token 生命周期

> 卡号：D1-09 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M1→B2 前置 | 需求域 R7 设计层
> 消费方（首包）：**P3-035**（API 客户端 + 401 自动刷新 + 并发去重）、**P3-040**（口令服务）；设计意图覆盖 P3-035/040/041/042/044/060/070（API 客户端、口令服务、auth 四端点、锁定、用户管理、登录页、WS ticket，共 52 包——复评轮修订：原枚举 5 项 38 包 vs 总数 43（含 P3-040 漏 P3-035），与 DESIGN-LAYER §3.1 列表及机读 52 对齐）
> 主要出处：Spec §4 认证行（15min/7d）与 §10 WS 安全行、openapi（auth 三端点 + ws/ticket + x-websocket handshake/会话失效/close-codes）、schema.md §3.1/§3.2（users 状态字段、refresh_tokens 吊销制）、OPEN-DECISIONS 等保配套条（首登改密随 M3 落）
> 状态：**v1.4**（2026-10-23 第三轮挑刺裁决落盘：② 栏失效传播矩阵登出行补「HTTP 残留 ≤15min **含写端点可读写**」并交叉引用卡内待办 3／④ 栏 V-REV 补**写端点残留断言**（旧 access 调写端点同返 2xx，读/写两端行为必须一致）｜v1.3（2026-10-23 架构师裁决落地（OPEN-DECISIONS 第 62 条）：refresh 端点 locked → **423+1002（detail {unlockAt}）**、disabled → **403+1005**，挂起解除；openapi 端点显式补挂 423/403 声明已登记解冻窗口待办，契约落盘前按运行时 guard 出口实现（D1-05 过滤器层统一出口口径，不构成违约）｜v1.2：① 栏补 status guard 覆盖范围定性／② 栏 refresh 两行形态挂起；v1.1 HS256 补标「本卡新定」；v1.0 于 D1-09-01/02 收口）| 评审记录见 REVIEW-INDEX「D1-09 挑刺审查线程」段

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| token 对 | login/SSO 回调返回 `{ accessToken, refreshToken, user }`；access = JWT（**HS256**/`WO_JWT_SECRET`，claims 仅 `sub`(userId)/`role`/`iat`/`exp`，**无 jti**——access 无吊销通道，失效靠 TTL + 状态 guard；**HS256 为本卡新定**（v1.1 补标）：Spec §4 / openapi / schema 三处只写「JWT」未锚定算法，本卡显式补齐——国密 JWT（SM2/SM3）若后续入契约须走解冻流程）；refresh = 随机 256bit 不透明串，服务端只存 `SM3(token)` | openapi LoginResponse + schema.md §3.2（token_hash SM3）+ **本卡新定**（HS256） |
| **「refresh 轮换」口径（本卡核心澄清）** | 任务书与台账「refresh 轮换」的契约一致读法 = **登录边界换发 + 吊销制**：login 签发新 refresh、logout/改密吊销旧 refresh；**`/auth/refresh` 不换发新 refresh token**（契约 RefreshResponse 仅 `{accessToken}`，逐次轮换需三处契约联动改动——RefreshResponse 加字段 + refresh_tokens 加 family 列 + 重放检测语义，不在本卡私改）。附带收益：多标签页并发 refresh 用同一 token 均成功（token 不被消耗），单飞只是**优化**不是正确性前提 | 本卡澄清（依据 openapi RefreshResponse 形状） |
| refresh_tokens 语义 | 1:N（一用户多设备各持一条）；`revoked_at` 非空即失效；吊销粒度：**logout = 该用户全量吊销**（契约 logout 无请求体、仅 Bearer JWT，服务端无从区分设备——单设备登出 MVP 不做）；改密 = 全量吊销 | schema.md §3.2 + openapi logout 形状推导 |
| WS ticket | `POST /ws/ticket`（Bearer access）→ `{ticket, expiresIn:5}`；内存态、5s、单次（用后即焚，重放第二次即 close 4401）。**签发时不做隐式刷新**：access 无效直接 401+1004，客户端先走标准刷新再换 ticket——禁止服务端在 ticket 端点内静默刷新（否则握手路径绕过单飞去重，多标签页同时建连即连接风暴） | openapi ws/ticket + x-websocket handshake + DESIGN-LAYER §3.2 条 3 |
| HTTP 状态 guard | 带鉴权端点每请求校验 `users.status` + `locked_until`：locked（`locked_until > now`）→ 423+1002；disabled → 403+1005；active → 放行。实现 = 每请求主键点查（窗口 0）；若压测证明热点，允许进程内缓存 **TTL ≤ 5s**（放行窗口 ≤5s），禁止更长。**覆盖范围含 `/api/v1/auth/refresh`（v1.2 补定性）**：该端点**不校验 access**（其凭据是 refresh token，access 过期正是续期前提，若校验则续期通道自锁），但**必须校验 status**——锁定/禁用后不得续期。原「带鉴权端点」字面不含 refresh，与本卡 ② 校验链把 refresh 纳入 guard 自相矛盾，此为定性缺口 | DESIGN-LAYER §3.2 条 2「窗口写死」+ 等保口径（锁定期内已签发 access → 拒）+ **本卡新定**（refresh 覆盖定性） |

## ② 时序 / 状态机

**并发刷新单飞（前端，P3-035）**

```
请求 A → 401(1004)
  → in-flight refresh 存在？
       否 → 发起 POST /auth/refresh（单飞者）
                 ├─ 200 {accessToken} → 存 token → 重放 A
                 └─ 401(1003) → 清会话 → 跳登录页
       是 → 挂起；单飞者结果即本请求结果（失败一并传播，不二次发起）
```

**/auth/refresh 服务端校验链（固定顺序，逐步短路）**

```
{refreshToken} → SM3 查 refresh_tokens
  ├─ 无记录 / revoked_at 非空 / expires_at 过期 → 401 + 1003
  └─ 命中 → 查 users.status
      ├─ locked（locked_until > now）→ 423 + 1002（detail {unlockAt}，供 AC-02 锁定倒计时渲染）+ 广播 4411 ——**v1.3 架构师裁决落地**：与同卡 ③ 栏及 D1-05 ①「1002 → 423」映射一致；openapi 端点显式补挂 423/403 已登记解冻窗口待办（OPEN-DECISIONS 2026-10-23 条），契约落盘前本行按运行时 status guard 出口实现（D1-05 过滤器层统一出口口径，不逐操作挂载不构成违约）
      ├─ disabled → 403 + 1005 + 广播 4411 ——v1.3 同裁（1005 → 403 映射本卡 ③ 栏与 D1-05 ① 已定）
       └─ active → 签发新 access（15min）→ 200 {accessToken}   ← 不动 refresh 行
```

**失效传播矩阵（事件 × 三出口，放行窗口写死）**

| 事件 | WS 连接 | 既有 access（HTTP） | refresh token |
|---|---|---|---|
| 登出 | 全部 4411（session-invalidated 前置） | 放行至自然过期（≤15min；无状态 JWT 契约无登出吊销通道，**这是契约行为非缺陷**；即时封死属 P1 denylist 增强，MVP 不做）。**残留窗口语义补全（v1.4 补，Q11/P1-10）**：该 ≤15min 残留**明确含写端点可读写**（旧 access 在此窗口内对 `POST /files`、`PATCH /files/{id}`、`DELETE /files/{id}` 等**写端点同样放行**）——登出只保证「refresh 即死 + WS 即踢」，**不保证 HTTP 写通道即时封死**；等保审计作答口径见**卡内待办 3**（本处交叉引用，避免两处措辞分叉） | 全量吊销 → 1003 |
| 锁定（5 次失败） | 全部 4411 | **拒**：423+1002（guard 窗口 0） | 拒：423+1002（detail.unlockAt，v1.3 裁决形态） |
| 禁用 | 全部 4411 + 60s re-validate 兜底 | 拒：403+1005 | 拒：403+1005（v1.3 裁决形态） |
| 改密 / 首登改密 | 全部 4411 | 放行 ≤15min（同一用户自身凭据，可接受） | 全量吊销 → 1003 |
| WS 60s re-validate | 失配即 4411 | —（仅 WS 侧） | — |

**失败分支与回滚点**：① guard 判 locked 的依据是 `locked_until` 与当前时间比较，解锁端点（unlock）清零后立即恢复——无缓存阻塞（缓存 TTL ≤5s 的实现同样满足）；② ticket 签发后 5s 内未使用自然过期，无需回收任务；③ refresh 并发同 token 多次调用全部成功（无消耗语义）——若实现发现同 token 第二次 refresh 失败，说明误做了逐次轮换，回 ① 栏口径修正。

## ③ 错误码映射

| 边界 | code | HTTP/WS | 前端呈现 | 出处 |
|---|---|---|---|---|
| 凭证错误（含剩余次数） | 1001 | 401（login） | 字段不清空 + 顶部文案；第 3 次起追加锁定预告 | registry + pages.md §1.4 |
| 账号锁定 | 1002 | 423（login / guard / refresh——v1.3 裁决补 refresh） | 锁定倒计时（`role=timer` 不逐秒朗读）；refresh 出口的 detail.unlockAt 供跳登录页后渲染倒计时 | registry + AC-02 |
| refresh 无效/已吊销/过期 | 1003 | 401（refresh） | 清会话跳登录（D 档） | registry |
| access 过期/未认证 | 1004 | 401（任意鉴权端点） | 触发单飞刷新；刷新失败才跳登录 | registry |
| 无权限（含 disabled） | 1005 | 403（guard / refresh——v1.3 裁决补 refresh） | D 档（登出引导） | registry |
| WS ticket 失效/re-validate 失配 | — | close 4401 | 清会话回登录 | x-websocket |
| 会话失效（登出/锁定/禁用/吊销） | — | close 4411（前置 session-invalidated 帧） | 清会话回登录 | x-websocket |

> 本卡零新增码。disabled 复用 1005（身份可辨但拒绝服务）、locked 复用 1002——语义均在 registry 描述内，不私扩。

## ④ 验收断言补充

| # | 断言 | 落点包 |
|---|---|---|
| V-SF | 单飞：并发 N 个请求同时 401 → 网络层 `/auth/refresh` 调用计数 = 1；单飞失败 → 全部挂起请求失败且会话清空 | P3-035 |
| V-NOROT | `/auth/refresh` 响应体**不含** `refreshToken` 字段（契约形状断言，防实现者顺手加轮换）；同一 refresh token 连续两次 refresh 均 200 | P3-041 |
| V-REV | 登出后：该用户全部 refresh → 1003；全部 WS 收 session-invalidated + 4411；**旧 access 调 /auth/me 仍 200**（契约行为断言，防误修）；**写端点残留断言（v1.4 补，Q11）**：同一旧 access 调**写端点**（`POST /api/v1/files`、`PATCH /api/v1/files/{id}`）**同样返回 2xx**（残留窗口含写端点可读写，见 ② 栏登出行），且 15min TTL 后同一请求 → 401+1004；改密后旧 refresh → 1003。**判别力说明**：只断言 `/auth/me`（读端点）会漏掉「实现者自行给写端点加了登出拦截」这类偏离——写端点与读端点在此窗口内行为必须一致，不一致即双源 | P3-041 / P3-044 |
| V-LOCK | 锁定后：带有效 access 的任意鉴权请求 → 423+1002（等保拒）；unlock 后即恢复（缓存 ≤5s 内） | P3-042 |
| V-RFREF | refresh 的 status 出口（v1.3 裁决形态）：锁定态（refresh token 有效）调 /auth/refresh → **423+1002 且 detail.unlockAt 为未来时间戳**（供 AC-02 倒计时渲染，frontend 消费）；禁用态 → 403+1005；两者均触发该用户 WS 4411 广播 | P3-041 |
| V-DIS | 禁用后：→ 403+1005、WS 4411、refresh 拒；60s re-validate 二次兜底可观测 | P3-044 |
| V-TKT | ticket：过期 access 换 ticket → 401+1004 且**响应体无新 token**（无隐式刷新）；锁定/禁用用户 → 拒；ticket 用第二次 → WS 4401 | P3-070 |

---

## 卡内待办（不属四栏，供派单参考）

1. 首登改密的字段载体（users 加 `must_change_password` 类字段）与拦截语义归 **P3-137**（OPEN 等保配套条已登记，随 M3 落）——本卡只定其会话交互（改密成功 = 全量吊销 + 4411 + 引导重登）。
2. 若架构师评审坚持逐次刷新轮换（rotation-on-refresh）：须先走 openapi 解冻（RefreshResponse 加 refreshToken 字段）+ schema.md 加 token family 列 + 定义重放检测——三处联动另立 OPEN，本卡口径在新契约落盘前有效。
3. access 即时吊销（登出后 HTTP 侧封死）列为 P1 增强（jti denylist），MVP 明确不做——等保审计口径按「登出 = refresh 即死 + WS 即踢 + HTTP 残留 ≤15min」作答。
