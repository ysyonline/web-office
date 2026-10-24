# D1-13 请求校验链与 API 契约生成门禁

> 卡号：D1-13 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M1 | 需求域 R7 设计层
> 消费方（首包）：**P3-011**（自研 ZodValidationPipe 落点）、**P3-012**（7xxx 错误码入表）、**P3-037**（CI G1 contract-diff）；设计意图覆盖 P3-011/012/037（共 23 包——补对账入口（U-2 评估，2026-10-23）：原卡头无枚举无总数，§3.1 行值 23 无法自证；三项包数机读 7+7+9 = 23，与 §3.1 一致）
> 主要出处：`docs/phase3/P3-001-工程化基线裁决记录.md` §2.2 / §4 / §5.4、Spec §4、ADR-005、openapi.yaml（**7xxx 已于 2026-10-22 放行落盘**）
> 状态：**v1.13**（grill 挑刺轮订正：E-CV ① 类遍历口径——requestBody 操作实况 **11 个**非 9 个（import、license/install 系 multipart inline，两端点行为级校验防线原为空）；补 multipart inline 各 2 样本（required 缺失→400 / content-type 非法→7003）｜v1.12（解冻批：E-CV ④ 转正式 CI 门禁（OPEN 64 RESOLVED）、挂 400 计 22/30、②/③ 改 `{id}`））| 沿革见 REVIEW-INDEX 线程段

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| schema 落点 | `packages/shared/src/schemas/`；命名**逐字对齐** openapi `components.schemas`，不自造 | P3-001 §5.4-1 |
| 契约 schema（**22，v1.8 订正**） | **请求侧 9**：`LoginRequest` / `RefreshRequest` / `UserCreateRequest` / `UserUpdateRequest` / `SsoCallbackRequest` / `SsoConfig` / `FileCreateRequest` / `FileRenameRequest` / `ShareCreateRequest`；**响应侧 13（v1.8 补落点，原 ① 栏只列请求侧 9 个，13 个响应侧无落点；下列为 `components.schemas` 机读实况逐字照抄，共 22 = 9 + 13）**：`Error` / `ValidationErrorDetail` / `ValidationErrorItem` / `LoginResponse` / `RefreshResponse` / `UserResponse` / `UserAdminResponse` / `FileResponse` / `FileListResponse` / `SnapshotResponse` / `ImportTaskStatus` / `ShareResponse` / `AuditLogListResponse`——**命名逐字对齐 `components.schemas`**（不自造；`Error`/`ValidationErrorDetail`/`ValidationErrorItem` 归本栏，随 `x-detail-variants` 引用故非孤儿），只声明方向不写实现，落 `packages/shared/src/schemas/`（与请求侧同目录，不分 internal）。**G1 比对范围 = 22 全集**（见 ② 栏口径澄清表与 ④ G1 行）——裁子集则「类型面全等」名不副实、孤儿规则同时名存实亡 | P3-001 §5.4-1（按 schema 名 grep 定位，不写行号——yaml 活跃变更下行号必漂移）+ **本卡 v1.8 补**（响应侧 13 个落点，Q7 裁决） |
| 非契约 schema | `FileListQuery` / `UserListQuery` / `AuditLogQuery` / `ExportQuery` / PathParams / `PasswordRules` → **统一放 `src/schemas/internal/`**；**G1 不比对 internal 目录**（顶层契约 22 个才是比对面），**目录即分类**。`components.parameters`（uuid/范围约束）的 yaml 值与 internal schema 的一致性**不进 G1**，由 E-CV 按 yaml 约束生成样本做行为级兜底（见 ④ E-CV） | P3-001 §5.4-1 |
| query/path 前置 | query/path 到达 schema 时均为 string → 涉及数字/布尔的 schema **必须 coerce 前置**，形态 = **`z.coerce.number().int().min(1).max(100)`**（**v1.8 补 `.min(1)`，P1-6**）。**约束须与 yaml 逐项对齐**（`Limit` = `minimum:1` + `maximum:100`、`Page` = `minimum:1`）：原形态只有 `.int().max(100)` 缺 `.min(1)`，实测 `limit=0` 与 `limit=''`（→coerce 成 0）**均通过返回 200**，`minimum:1` 在代码侧无任何防线；E-CV 的 `limit=0` 样本是**该缺陷的唯一探测器**（见 ④ E-CV ②）。无 coerce 则 `?limit=200` 走 `invalid_type` → 7001，**7002「查询参数越界」将无产生路径** | 本卡新定 + **v1.8 补**（`.min(1)` 与 yaml 逐项对齐） |
| strict 语义 | 新建用 `z.strictObject()`；`.extend()` 后再补 `.strict()`（**v1.8 复核补正**：`z.strictObject().extend()` 实测**继承** strict 性，`z.object().extend()` 不继承——故「extend 后再补 `.strict()`」在 strictObject 路径下**冗余但无害**，保留作防御写法）。**理由订正（v1.8，P1-3）**：`z.strictObject()` 与 `z.object()` 的 `toJSONSchema` 产物**字节级相同**（均 `additionalProperties:false`，实测）——故原「与 toJSONSchema 输出矛盾」的理由**不成立**；真实理由 = **`z.object()` 默认 strip（静默剥离未知键）**，与契约声明的 `additionalProperties:false` 语义不符：契约说不允许、运行时却静默吞掉请求方传来的字段，**调用方无感知**。**G1 对 strict 原理性盲区**（见 ② 栏口径澄清表新增行），唯一防线 = ④ A-STRICT 源码级断言 | P3-001 §2.2（后端纠偏）+ **本卡 v1.8 订正**（理由改写 + extend 继承性补正） |
| 后端管道 | 自研 `ZodValidationPipe`（`apps/server/src/common/pipes/`，约 30 行，零新依赖），**逐参数挂载** `@Body(new ZodValidationPipe(LoginSchema))`。**不能全局注册** → 漏挂即该端点零校验且不报错 | P3-001 §2.2 |
| 前端消费 | react-hook-form 7.90.0 + `@hookform/resolvers` 6.0.0 `zodResolver`；类型用 `z.infer` | P3-001 §2.2 |
| OpenAPI schema 生成 | `schemaOf(s) = z.toJSONSchema(s, { target: 'openapi-3.0' })`（zod 4.6.7 内置，实测输出无 `$schema` / `$defs`，`nullable` 用 OpenAPI 写法，int→integer，默认 `additionalProperties:false`），喂 `@ApiBody` / `@ApiResponse` | P3-001 §2.2 |
| 契约事实源 | **openapi.yaml 手写件为唯一事实源（(a) 不变）**；zod 只是校验规则单一源；装饰器产物从属；两者由 CI G1 contract-diff 在**类型面**强制相等（归一化比对，P3-001 §2.4 G1/G2/G3 三段口径）。散文与 x-\* 扩展面**不设「等」的比对**——见 ② 节口径澄清。**不改 (c)，不重开冻结窗口** | P3-001 §2.2 / §2.4 |
| 错误响应形状 | `{ code, message, detail: { errors: [{ field, rule, message }] } }`；9001 的 `detail` 固定为 `{ requestId }` | P3-001 §4 第 2/5 项 |
| `field` 取值 | `field = z.core.toDotPath(issue.path) \|\| '(root)'`。① 弃 `join('.')`（`['rows',1,'cells',0]` → `rows[1].cells[0]`，RHF 才认得）；② **根级 issue 一律 `(root)` 不区分 code**（`invalid_type` 的 body 类型错 path 同样是空数组）。**连字符键实测形态（v1.8 补，P1-4）**：`toDotPath(['a-b'])` 实测返回 **`["a-b"]`（带 JSON 双引号）**，卡内原「连字符键无歧义」的判断与实况不符——该形态下 RHF 7.90 的 `setError("[\"a-b\"]")` 消费行为**未核验**；策略：shared 层 schema 的键名**优先避免连字符**，确需连字符键时前端映射表须以 `["a-b"]` 实测形态为准（P3-011 落地时核验并回填本行） | P3-001 §5.4-2 + **本卡 v1.8 补**（连字符键实测形态） |
| `rule` 取值 | 取 `issue.code`（zod 4.6.7 issue code 共 **11 个**字面量），不依赖 field 约定。**措辞订正（v1.8，P1-5）**：清单在 `zod/v4/core/errors.d.cts`，**运行时不存在 `$ZodIssueCode` 枚举导出**（`z.core.$ZodIssueCode` 实测 `undefined`，是纯类型别名）——原括注「`$ZodIssueCode` 共 11 个」有诱导实现者去运行时 import 该符号之虞；实现只按字符串字面量比对 | P3-001 §5.4-2 + **本卡 v1.8 订正** |
| refine 规约 | shared 层所有 `.refine()` / `.superRefine()` **必须显式传 `path`**（否则 path 为空 → field 空 → 前端 `setError("")` 无效、用户零反馈；口令复杂度规则正踩此坑） | P3-001 §2.2 坑 2 |
| `unrecognized_keys` 的 message 模板（v1.8 补，P3-5） | `unrecognized_keys` 的 issue 实测为 `path=[]`、`keys=['b']`——**`keys` 数组不被 `detail.errors[]` 承载**（detail 只有 `field`/`rule`/`message` 三字段），故**多个未知键的信息会整体丢失**。强制要求：该 code 的 **`message` 模板必须内联未知键名**（如「未知字段：b」或「未知字段：b, c」），**禁止**使用不含键名的泛化文案（如「请求含未知字段」）——否则 A-PATH 的 `|| code === 'unrecognized_keys'` 分支虽然必要（`path=[]` 时 `field` 恒为 `(root)`），用户仍拿不到是哪个键错了 | **本卡 v1.8 新定**（P3-5 实测澄清） |
| 夹具 | 边界样本落 `packages/shared/validation-fixtures/*.json`，由 `scripts/fixtures-run.mjs` **零依赖纯 node 脚本**执行，前后端 CI 跑同一条命令。后端不得装 vitest（peer `vite ^6.4\|\|^7\|\|^8` 会把 esbuild/rollup 原生二进制拉进后端依赖树） | P3-001 §5.4-3 |

## ② 时序 / 状态机

**请求校验链（服务端）**

```
HTTP 请求
  → 路由命中（无全局 pipe）
  → JSON body 解析（Nest body-parser 层）
       └─ 解析失败 / Content-Type 不匹配 → 统一异常过滤器 → 400 + 7003
          （7003 的产生点在 pipe 之前，自研 pipe 抛不出它，由全局 filter 捕获 parser 错误映射——禁全局 pipe 不禁全局 filter）
  → [已挂 pipe] ZodValidationPipe.transform(value, metadata)   ← query/path 值先经 schema 内 coerce 前置
       ├─ parse 成功 → 放行（strip 不会发生：schema 已 .strict()）
       └─ parse 失败 → 抛 BadRequestException-like
            → 统一异常过滤器 → 400 + code(7001|7002|7003|7004)
            → detail.errors[] = issues.map(i => ({ field: toDotPath(i.path)||'(root)', rule: i.code, message: i.message }))
  → [未挂 pipe] 直通 → 端点自行处理（**静默漏挂，唯一防线是 e2e 遍历**）
```

**7xxx 分流表（参数位置 × issue.code → 码，v1.8 补，P1-6 / Q5；实现者按本表逐项落，不可自行归并）**

| 参数位置 \ issue.code | `too_big` `too_small` `invalid_value` | `invalid_format` `invalid_type` | 其余 issue（`unrecognized_keys` 等） |
|---|---|---|---|
| **path 参数** | 7004 | **7004** | 7004 |
| **query 参数** | **7002** | **7002**（coerce 前置后残余的格式/类型错，仍归 query 越界语义） | 7002 |
| **body（requestBody）** | 7001 | 7001 | 7001 |
| **parser 层（pipe 之前）** | — | — | **7003**（既有口径，产生点在 pipe 之前，全局过滤器承接） |

- **判据说明**：`invalid_type` 跨参数位置有歧义（同一个 code 在 path/query/body 三处含义不同），**必须按参数位置分流**，只按 code 分流会把 query 的 `invalid_type` 错归 7001；
- **coerce 前置的关系**：query 侧数字/布尔经 coerce 后，`invalid_type` 基本不再出现（值都被强转），残余的走 7002；**若 coerce 缺失**（`?limit=abc` → `invalid_type`）仍按本表归 **7002**（query 位置优先），不得掉回 7001；
- 本表与 E-CV 的关系：E-CV 是**行为级**校验源，本表是**实现级**分流规约，两者须一致——E-CV 某样本期望码与本表冲突即以本表为准改样本（样本写错）或开 OPEN（本表错）。

**契约生成与门禁时序（CI）**

```
packages/shared schema (单一源)
  ├─ schemaOf() → @ApiBody/@ApiResponse 装饰器
  │    → @nestjs/swagger 11.4.7 生成 openapi.gen.yaml
  │    → G1 contract-diff(openapi.yaml, openapi.gen.yaml)：**类型面归一化比对**
  │         （paths/parameters/requestBody/responses/components.schemas，$ref 不内联，DTO 类名 ≡ schema 键名）
  │         不等即 fail、无 warn 档；**散文与 x-* 扩展不参与「等」比对**，由 G2（文档面覆盖率）
  │         + G3（错误码常量集 ↔ x-error-code-registry 键集、WS close code 与帧类型逐一相等）分守
  └─ fixtures-run.mjs：边界样本 → 断言错误码与 field/rule/message 三者齐全
```

**失败分支与回滚点**：G1 不等时的处置顺序 = ① 判是谁错（schema 改了还是装饰器漏挂）→ ② **以 openapi.yaml 为准**改代码，**不得改 yaml 迁就代码**（事实源纪律）→ ③ 若确有契约缺陷 → 开 OPEN-DECISIONS 条目，走解冻流程，**不得私改**。

**口径澄清**

「以 openapi.yaml 为准改代码」这条仲裁规则的领土 = **代码产物有对应物的面**：

| 面 | 防线 | 比对方式 |
|---|---|---|
| 类型面（paths/parameters/requestBody/responses/components.schemas） | G1 | 归一化后**全等**，不等即 fail |
| 类型面·parameters（`components.parameters` 的 uuid/范围约束） | **不进 G1** | internal schema 与 yaml 的一致性由 E-CV 按 yaml 约束生成越界样本做**行为级**兜底 |
| **strict 语义（`z.strictObject()` vs `z.object()`）** | **不进 G1（v1.8 新增行，P1-3 / Q8）** | `toJSONSchema` 对两者产物**字节级相同**（均 `additionalProperties:false`，实测），G1 对 strict **原理性盲区**且无低成本替代；**唯一防线 = ④ A-STRICT 源码级断言**（断言 request schema 均为 strictObject/.strict() + 未知键样本返 400）。此行入表是为防止后来者误以为 G1 覆盖 strict 而放松 A-STRICT |
| 文档面（summary / 响应 description） | G2 | 覆盖率（非空），非全等 |
| 扩展面可机检键集（错误码常量、WS close code、帧类型） | G3 | 键集**逐一相等**（代码常量 ↔ yaml 键集双向） |
| 散文面（x-websocket 五段散文、registry 逐码描述、per-code 前端呈现文字） | **不设「等」的比对** | 无代码对应物、全工程仅 yaml 一份，**结构性无第二副本即无漂移对象**；实际防线 = check_openapi_contract.py 结构断言 + 冻结/解冻流程与变更记录 |

裁决依据：P3-001 §2.4 否决 (b) 的原话——装饰器产不出 x-websocket 五段散文与 x-error-code-registry，让代码侧补齐 x-\* 生成路径 = 把 1381 行散文复制成第二副本。**已知残余风险（诚实登记）**：散文语义被单独改写而代码行为未同步时，CI 无从发现（G3 只锁键集不锁键的描述）。接受此残余，因唯一替代方案（装饰器生成散文）比病更重。

## ③ 错误码映射

| 边界 | code | HTTP | WS | 前端呈现 | 出处 |
|---|---|---|---|---|---|
| 请求体/参数校验失败 | **7001** | 400 | — | 取 `detail.errors[]` 按 `field` 映射到字段下方；`'(root)'` → Toast | P3-001 §4 第 1 项 |
| 查询参数越界 | **7002** | 400 | — | 列表页「筛选条件无效」+ **重置筛选** | 同上 |
| JSON / multipart 非法 | **7003** | 400 | — | Toast 错误类，5000ms | 同上 |
| 路径参数格式非法 | **7004** | 400 | — | 跳 404 | 同上 |
| 未预期服务端异常（兜底） | **9001** | 500 | — | 显示 `detail.requestId`（等宽字体独立成行、可选中复制） | P3-001 §4 第 5 项 |

> 码段说明：7xxx 由本卡四条码占用（2026-10-22 放行落盘），8xxx 仍空闲留作后续段；不用 0xxx 是因为 `Error.code` 是 integer，`0001` 会被序列化成 `1`（P3-001 §4 第 1 项）。x-error-code-registry 键集与代码常量的双向一致由 G3 锁定。

## ④ 验收断言补充

| # | 断言 | 落点包 |
|---|---|---|
| V-S1 | schema 单一落点：① `apps/**` 内出现 `export const .*Schema = z.` 即 FAIL；② 所有 `ZodValidationPipe(XxxSchema)` / `zodResolver(XxxSchema)` 的 `XxxSchema` 必须解析到 `@wo/shared` 导出 | P3-011 |
| V-S2 | 中文文案兜底：每个 schema 喂必失败样本，断言 issue 的 `message` **不含 zod 默认英文特征**（判据 = 黑名单正则匹配 `Expected \|invalid_type\|Too small\|Too big\|Invalid \|recognized\|Unrecognized` 等 zod 内置 message 模板——**不判「无 ASCII 字母」**：合法中文文案含「SSO/LDAP/URL/API」即误伤） | P3-011 |
| V-S3 | 快照端点：`apps/web/src/**` 内对 `/api/v1/files/*/snapshot` 的调用**不得带 body**（POST 空 body 触发服务端物化本身合法；被封死的是客户端上传快照） | P3-011 / 前端包 |
| G1 | contract-diff 类型面归一化全等。**比对范围 = `components.schemas` 22 个全集（v1.8 订正，Q7）**——含响应侧 13 个（`Error`/`ValidationErrorDetail`/`ValidationErrorItem`/`LoginResponse`/`RefreshResponse`/`UserResponse`/`UserAdminResponse`/`FileResponse`/`FileListResponse`/`SnapshotResponse`/`ImportTaskStatus`/`ShareResponse`/`AuditLogListResponse`），原「只比对 9 个请求侧」使「类型面全等」名不副实且孤儿规则名存实亡。**孤儿 schema（无任何端点 `$ref` 的 components.schemas）一律 fail，不留 warn 档**（`SnapshotSaveRequest` 已随 7xxx 放行落盘删除，原位留注释）。归一化算法规约（format/pattern/enum 是否参与、`example` 不参与、`required` 数组与 `properties` 键序归一、`nullable` vs `type:[x,'null']` 归一）由 **P3-037 实施期产出 `contract-diff.mjs` 内置规则表并回填本行**（义务已挂 P3-037 工作项收口断言），P3-011 的 `schemaOf()` 复用同一份 | P3-037 / P3-011 |
| E-CV | `validation-coverage.e2e-spec.ts`：按样本类型分流断言期望码——① requestBody 非法样本（错类型/未知键/required 缺失/content-type 非法）→ **7001/7003**（**① 类遍历口径（v1.11 补，条 H；v1.13 订正，grill 轮 ①：契约实况 requestBody 操作 = 11 个非 9 个——`POST /files/{id}/import` 与 `POST /license/install` 系 multipart inline，v1.11 口径下这两端点的「漏挂 pipe 零校验」行为级防线为空**）：9 个 `$ref` JSON schema 逐 schema 各一条错类型 + 一条未知键样本（如 `{"__probe_unknown__":1}`），**未知键必含、不得只写错类型**——否则 A-STRICT 判据 2 零测试面（G1 对 strict 盲区）；**2 个 multipart inline 各 2 样本**：required 字段缺失（样本取 yaml `required` 既有约束，非私扩）→ 400、content-type 非法（JSON body 打 multipart 端点）→ 7003）；② query 越界样本 → **7002**（**样本清单见本节末「E-CV ② 样本清单」表，v1.8 立**）；③ path 参数非法样本 → **7004**（**样本清单见本节末「E-CV ③ 样本清单」表，v1.9 立 / v1.10 订正**：**13 个操作**，其中 4 个只能靠 path 级继承展开发现；**12 个为 uuid 型、1 个为 enum 型**，样本值按类型分别取）。遍历口径 = 带 requestBody/query/path 的操作，**parameters 须合并 op 级与 path 级两处来源**（openapi 有 6 个操作的参数定义在 path 级：`GET/PATCH /users/{id}`、`PATCH/DELETE /files/{id}`、`GET/POST /files/{id}/snapshot`）。另含 POST snapshot 空 body 的**反断言**（200/2005，**不得** 7001）。带参但未挂 400 的操作已 **0 个**（挂 400 操作 22/30，余 8 个全为 no-param；`check_openapi_contract.py` v1.2 已把「带参未挂 400」升为 FAIL 断言），E-CV 遍历口径 = 契约实况 22 个操作，**不私扩样本集**（样本集只取自 yaml 既有约束，为凑覆盖率臆造约束即违约）。**④ 契约反向断言（v1.8 增，Q6）**：`/api/v1/auth/refresh` 端点的 **423 + 1002** 与 **403 + 1005** 两出口**已显式挂载于契约**（判据 = 该端点 responses 含 423/403 键且 example.code 分别为 1002/1005）——**契约补丁已于 2026-10-24 解冻窗口落盘**（OPEN 64 RESOLVED），本条转正式 CI 门禁（过渡态解除） | P3-037 |
| A-PATH | refine 显式传 path：喂必失败样本后，所有 issue 满足 `path.length > 0 \|\| code === 'unrecognized_keys'`。**v1.8 补**：`unrecognized_keys` 分支虽使 `field` 恒为 `(root)`，但**该 code 的 `message` 必须含未知键名**（见 ① 栏该行），否则多未知键信息整体丢失——A-PATH 判据维持不变，message 含键名由 V-S2 的文案断言与本节一并核 | P3-011 |
| A-STRICT | 所有 request schema 为 `z.strictObject()` 或 `.strict()`；未知键样本必须返回 400 而非静默剥离。**判据落地载体（v1.11 补，条 H）**：判据 1 = P3-011 工作项收口断言（backlog 包面同轮落）+ 实现期以 ESLint 自定义规则强制（request schema 裸 `z.object(` 即 error）；判据 2 = ④ E-CV ① 类遍历口径（见该行 v1.11 补）。**本条是 strict 语义的唯一防线（v1.8 注）**——G1 对 strict 原理性盲区（见 ② 栏口径澄清表 strict 行），放松本条即无替代 | P3-011 |

### E-CV ② 样本清单（v1.8 立，Q5 / §5 A1~A3；实现者按本表逐行落，**不私扩**）

**口径裁定（写在表前，防二次解释）**：

- **样本操作 = 4 个**（`GET /users`、`GET /files`、`GET /audit-logs`、`GET /files/{id}/export`）——这 4 个是契约中 **query 参数带边界约束**的全部操作（约束来源 = yaml 实测：`keyword` maxLength、`status`/`format` enum、`userId` format:uuid、`from`/`to` format:date-time、`Page`/`Limit` minimum:1 + maximum:100）；
- **表内按「参数」逐行覆盖，不是按「操作」点到为止**（v1.9 补，修 v1.8 自相矛盾）：同一操作内**凡带约束的参数都必须出样本**——v1.8 表只列了 `limit`/`page`/`status`/`format`，漏了 `keyword`（`GET /users` 64、`GET /files` 100）与 `userId`（uuid）、`from`/`to`（date-time），与「确有边界约束的全部」这句说法直接冲突；**`action`（`GET /audit-logs`）只有 `type: string`、无边界约束**，与 `ticket` 同属「造不出越界样本」，二者**同列排除声明**，不得为凑覆盖率臆造约束（A3）；
- **声明涉及操作 = 5 个**：上述 4 个 + **`GET /ws/collab/{id}` 单列并显式声明「其 `ticket` 无任何约束，不进 ② 样本集」**——单列的目的是**防止实施者为凑覆盖率给 `ticket` 硬编一个不存在的约束**（那正是 P1-2 担心的「私扩样本集」）。**「5」是声明数、「4」是 ② 类样本操作数**，二者不可混写；
- **`$ref` 展开说明（遍历口径注释，机读实况；v1.8 订正——第三轮挑刺报告写「`$ref` 挂在 path 级 `parameters` 下」**与实况不符**，按本行执行）**：
  - **`Page` / `Limit` 的 `$ref` 挂在 operation 级**（`GET /users`、`GET /files`、`GET /audit-logs` 三处各一，各 3 次），`in=query`；
  - **`FileId` 的 `$ref` 同时在两处（下列为**字面**次数）**：path 级 2 次（`/files/{id}`、`/files/{id}/snapshot`）+ operation 级 4 次（`POST /files/{id}/import`、`GET /files/{id}/export`、`POST /files/{id}/share`、`GET /ws/collab/{id}`）= **6 次**；`/users/{id}` 的 `id` 是**内联** path 参数不走 `$ref`；
  - 内联 query 参数（`keyword`/`status`/`format`/`userId`/`action`/`from`/`to`/`ticket`）亦在 operation 级；
  - 结论：**遍历时 path 级与 operation 级两处来源必须合并**（`$ref` 只是把定义抽到 `components.parameters`，不改变挂载层级）；样本定位按 **`$ref` 展开后的 `parameter.name`**（`limit` / `page` / `id`），**不是组件名**（`Limit` / `Page` / `FileId`）。
  - **`$ref` 计数（双口径，机读实测；v1.9 订正——**两个数字都对，指的不是同一件事，混写即错**）**：
    - **字面出现次数** = **12** 次（`Page` 3 + `Limit` 3 + **`FileId` 6**）：yaml 里实际写出的 `$ref` 行数；
    - **展开到操作后的有效挂载数** = **14** 次（`Page` 3 + `Limit` 3 + **`FileId` 8**）：差在 path 级——`/files/{id}`（PATCH/DELETE）与 `/files/{id}/snapshot`（GET/POST）**各 1 处声明被 2 个操作继承**，2 处声明 → 4 次挂载（字面只算 2 次），operation 级另有 4 次，合计 8；
    - **用法（写卡/写码前先看这一行）**：论「yaml 写了几个 `$ref`」用 **6 / 12**；论「E-CV 遍历会命中几个操作」用 **8 / 14**——**E-CV 是操作级遍历，一律按 8 / 14**。
    - **v1.8 的订正是反向订正，作废**：v1.8 判第三轮挑刺报告的 `FileId` 8 / 总 14 为「误计」并写「本卡一律写 6 / 12」，在展开口径下该数字**正确**；教训 = 计数类结论的订正必须回到 openapi 重算并**先分清口径**，否则会把对的改成错的。
- **`GET /ws/collab/{id}` 的排除范围要精确**：排除的是它的 **query 参数 `ticket`**（无约束、造不出 ② 类越界样本）；**它的 path 参数 `id`（`FileId`，format:uuid）不排除**，仍按 E-CV ③ 产生 **7004** 样本——不得整条操作排除出 E-CV。

| 操作 | 参数名（展开后） | 越界样本值 | 约束来源 | 期望码 |
|---|---|---|---|---|
| `GET /api/v1/users` | `limit` | **`limit=101`**（maximum:100 +1）／**`limit=0`**（minimum:1 −1） | `$ref` Limit（operation 级） | 7002 |
| | `page` | **`page=0`**（minimum:1 −1） | `$ref` Page（operation 级） | 7002 |
| | `status` | `status=bogus`（enum 外） | operation 级内联 | 7002 |
| | `keyword` | `keyword=` + **65 字符**（maxLength:64 +1） | operation 级内联 | 7002 |
| `GET /api/v1/files` | `limit` | `limit=101` ／ `limit=0` | `$ref` Limit（operation 级） | 7002 |
| | `page` | `page=0` | `$ref` Page（operation 级） | 7002 |
| | `keyword` | `keyword=` + **101 字符**（maxLength:100 +1） | operation 级内联 | 7002 |
| `GET /api/v1/audit-logs` | `limit` | `limit=101` ／ `limit=0` | `$ref` Limit（operation 级） | 7002 |
| | `page` | `page=0` | `$ref` Page（operation 级） | 7002 |
| | `userId` | `userId=not-a-uuid`（format:uuid 违例） | operation 级内联 | 7002 |
| | `from` | `from=2026-13-01T99:99:99Z`（format:date-time 违例） | operation 级内联 | 7002 |
| | `to` | `to=2026-13-01T99:99:99Z`（同上） | operation 级内联 | 7002 |
| | `action` | **无（不进 ② 样本集）** | 仅 `type: string`，无边界约束（与 `ticket` 同类） | —（显式声明排除） |
| `GET /api/v1/files/{id}/export` | `format` | `format=pdf`（enum xlsx/csv 外） | operation 级内联 | 7002 |
| `GET /ws/collab/{id}` | `ticket` | **无（不进 ② 样本集）** | 无约束 | —（显式声明排除） |

**`limit=0` / `page=0` 是必须项（A2，不得省略）**：实测 `z.coerce.number().int().max(100)` 形态下 `limit=0` 与 `limit=''`（coerce → 0）**均返回 200**（缺 `.min(1)`）——**这两条样本是「coerce 形态漏 `.min(1)`」的唯一探测器**；只取 `limit=101` 会漏掉单侧（下界）放松，P1-6 复发无人察觉。机理同「贴边取样」：`maximum:100` 若被放松成 `max(200)`，取 `limit=999` 仍 fail 会漏放行，只有 `limit=101` 能抓获。

### E-CV ③ 样本清单（v1.9 立；path 参数非法 → 7004）

**为什么单列一张表**：E-CV 遍历若只看 operation 级 `parameters`，会**整条漏掉声明在 path 级的参数**——`/files/{id}` 的 PATCH/DELETE 与 `/files/{id}/snapshot` 的 GET/POST 这 **4 个操作**的 `FileId` 全在 path 级（2 处声明被 4 个操作继承；字面算 2 次、展开算 4 次，见 ② 栏双口径）。它们是 7004 的**隐性来源**，漏掉即 7004 无样本而无告警。

**口径声明（v1.10 补，防二次解释）**：

- **全集 = 13 个操作**（`docs/api/openapi.yaml` 机读重算，含 path 参数的操作去重到 operation），**不是 12**；
- **按 path 参数类型分两类，样本值不得混写**：**uuid 型 12 个** → 样本 `=not-a-uuid`；**enum 型 1 个**（`POST /api/v1/sso/{type}/callback` 的 `type`，枚举 `ldap`/`oauth2`/`cas`）→ 样本 `type=bogus`（**枚举外取值**）。v1.9 未声明此分类，导致该 enum 型参数被整条漏掉——它造不出 `not-a-uuid` 类样本，照 v1.9 表实施会漏掉该端点的 path 校验；
- **挂载层级一律按机读实况**（path 级 / operation 级分属不同来源，合并时不可想当然）。

| 操作 | 参数（展开后） | 挂载层级 | 样本值 | 期望码 |
|---|---|---|---|---|
| `GET /api/v1/users/{id}` | `id` | path 级**内联**（非 `$ref`） | `id=not-a-uuid` | 7004 |
| `PATCH /api/v1/users/{id}` | `id` | path 级内联 | 同上 | 7004 |
| `POST /api/v1/users/{id}/unlock` | `id` | operation 级内联 | 同上 | 7004 |
| **`POST /api/v1/sso/{type}/callback`（v1.10 补漏）** | `type` | operation 级内联 | **`type=bogus`**（enum 外，非 uuid 型） | 7004 |
| **`PATCH /api/v1/files/{id}`** | `id`（`FileId`） | **path 级 `$ref`（继承）** | 同上 | 7004 |
| **`DELETE /api/v1/files/{id}`** | `id`（`FileId`） | **path 级 `$ref`（继承）** | 同上 | 7004 |
| **`GET /api/v1/files/{id}/snapshot`** | `id`（`FileId`） | **path 级 `$ref`（继承）** | 同上 | 7004 |
| **`POST /api/v1/files/{id}/snapshot`** | `id`（`FileId`） | **path 级 `$ref`（继承）** | 同上（另有空 body 反断言 200/2005，二者不冲突） | 7004 |
| `POST /api/v1/files/{id}/import` | `id`（`FileId`） | operation 级 `$ref` | 同上 | 7004 |
| `GET /api/v1/files/{id}/export` | `id`（`FileId`） | operation 级 `$ref` | 同上（该操作另有 ② 类 `format` 样本） | 7004 |
| `POST /api/v1/files/{id}/share` | `id`（`FileId`） | operation 级 `$ref` | 同上 | 7004 |
| `GET /api/v1/import/{taskId}` | `taskId` | **operation 级**内联（v1.10 订正：该 path 的 path 级 `parameters` 为 None，参数挂在 get 下，v1.9 写「path 级」与实况不符） | `taskId=not-a-uuid` | 7004 |
| `GET /ws/collab/{id}` | `id`（`FileId` 组件，`name: id`） | operation 级 `$ref` | **`id=not-a-uuid`**（v1.10 订正：样本值按**展开后的参数名 `id`** 取，v1.9 写 `fileId=not-a-uuid` 与本行参数名列自相矛盾）。**该行另登记一处契约缺陷**：路径模板占位符是 `fileId`，但 `FileId` 组件的 `name` 是 `id`——**占位符与参数名不匹配**，违反 OpenAPI 规范（全仓唯一一处，机读实况）。缺陷本体**不私改 yaml**，开 OPEN-DECISIONS 走解冻流程（见 ② 栏「失败分支与回滚点」第 ③ 步）；E-CV 遍历按**路径实际占位符**发请求，故 7004 样本仍可产出，不受该缺陷阻塞 | 7004 |

合计 **13 个操作**（v1.10 订正，原写 12 漏 enum 型一项）；其中 **加粗的 4 个**只能靠「path 级声明 + 继承展开」发现——**遍历实现必须先合并 path 级与 operation 级两处来源再枚举操作**（同 ④ 栏 E-CV 行既有口径，本表把它落成可逐行核对的清单）。**第 5 项（`sso/{type}/callback`）另是「uuid 口径」之外的唯一例外**：若遍历实现只按 uuid 格式生成非法样本（自然的偷懒写法），该项会被静默跳过——这正是 ③ 表要按类型分两类的原因。

---

## 卡内待办（不属四栏，供派单参考）

1. 7xxx 已放行（2026-10-22，P3-001 §4），本卡各节按放行后口径执行。
2. `SnapshotSaveRequest` 已删除（随 7xxx 放行落盘，原位留注释），G1 孤儿规则已可启用。
3. 本卡与 D1-05 错误码矩阵的关系：**码段事实源 = openapi `x-error-code-registry` 已放行实况**（1xxx 认证与用户 / 2xxx 文件域 / 3xxx 导入 / 4xxx 协同与连接 / 5xxx License / 6xxx SSO / 7xxx 请求校验 / 9xxx 兜底）；D1-05 只定**四层对照与同语义多出口一致**，无权重分段。若 D1-05 任务书与 registry 冲突，**以 registry 为准并开 OPEN-DECISIONS，不得以 D1-05 回改本卡或 registry**。
4. G1 归一化规则表由 P3-037 实施期产出并回填本卡 G1 行——**结构性依赖**：卡定稿时点 G1 断言不可执行，验收实质转移至 P3-037；义务已挂 P3-037 工作项收口断言，**派发 P3-037 时核回填**。
