# D1-13 请求校验链与 API 契约生成门禁

> 卡号：D1-13 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M1 | 需求域 R7 设计层
> 消费方（首包）：**P3-011**（自研 ZodValidationPipe 落点）、**P3-012**（7xxx 错误码入表）、**P3-037**（CI G1 contract-diff）
> 主要出处：`docs/phase3/P3-001-工程化基线裁决记录.md` §2.2 / §4 / §5.4、Spec §4、ADR-005、openapi.yaml（**7xxx 已于 2026-10-22 放行落盘**）
> 状态：v1.7 **已完成**（D1-13-01/02 收口 2026-10-22；消费方首包 P3-011-01 / P3-012-01 / P3-037-01 的「本包范围」已由生成器写入卡号）。卡内只保留最新口径；历次修订史与挑刺回执的过程记录见 `docs/REVIEW-INDEX.md`「D1-13 挑刺审查线程」段（四份中间评审文档已于 2026-10-22 归档清理，结论全部落在本卡 / DESIGN-LAYER §2.2 / OPEN-DECISIONS）（v1.7 仅改 ④ 栏 E-CV 的契约实况：4 端点已补挂 400）

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| schema 落点 | `packages/shared/src/schemas/`；命名**逐字对齐** openapi `components.schemas`，不自造 | P3-001 §5.4-1 |
| 契约 schema（9） | `LoginRequest` / `RefreshRequest` / `UserCreateRequest` / `UserUpdateRequest` / `SsoCallbackRequest` / `SsoConfig` / `FileCreateRequest` / `FileRenameRequest` / `ShareCreateRequest` | P3-001 §5.4-1（按 schema 名 grep 定位，不写行号——yaml 活跃变更下行号必漂移） |
| 非契约 schema | `FileListQuery` / `UserListQuery` / `AuditLogQuery` / `ExportQuery` / PathParams / `PasswordRules` → **统一放 `src/schemas/internal/`**；G1 只比对顶层契约层，**目录即分类**。`components.parameters`（uuid/范围约束）的 yaml 值与 internal schema 的一致性**不进 G1**，由 E-CV 按 yaml 约束生成样本做行为级兜底（见 ④ E-CV） | P3-001 §5.4-1 |
| query/path 前置 | query/path 到达 schema 时均为 string → 涉及数字/布尔的 schema **必须 coerce 前置**（`z.coerce.number().int().max(100)` 形态）。无 coerce 则 `?limit=200` 走 `invalid_type` → 7001，**7002「查询参数越界」将无产生路径** | 本卡新定 |
| strict 语义 | 新建用 `z.strictObject()`；`.extend()` 后再补 `.strict()`。理由：`z.object()` 默认 **strip**（静默剥离未知键），与 `z.toJSONSchema` 输出的 `additionalProperties:false` 矛盾——文档说不允许、运行时却静默吞 | P3-001 §2.2（后端纠偏） |
| 后端管道 | 自研 `ZodValidationPipe`（`apps/server/src/common/pipes/`，约 30 行，零新依赖），**逐参数挂载** `@Body(new ZodValidationPipe(LoginSchema))`。**不能全局注册** → 漏挂即该端点零校验且不报错 | P3-001 §2.2 |
| 前端消费 | react-hook-form 7.90.0 + `@hookform/resolvers` 6.0.0 `zodResolver`；类型用 `z.infer` | P3-001 §2.2 |
| OpenAPI schema 生成 | `schemaOf(s) = z.toJSONSchema(s, { target: 'openapi-3.0' })`（zod 4.6.7 内置，实测输出无 `$schema` / `$defs`，`nullable` 用 OpenAPI 写法，int→integer，默认 `additionalProperties:false`），喂 `@ApiBody` / `@ApiResponse` | P3-001 §2.2 |
| 契约事实源 | **openapi.yaml 手写件为唯一事实源（(a) 不变）**；zod 只是校验规则单一源；装饰器产物从属；两者由 CI G1 contract-diff 在**类型面**强制相等（归一化比对，P3-001 §2.4 G1/G2/G3 三段口径）。散文与 x-\* 扩展面**不设「等」的比对**——见 ② 节口径澄清。**不改 (c)，不重开冻结窗口** | P3-001 §2.2 / §2.4 |
| 错误响应形状 | `{ code, message, detail: { errors: [{ field, rule, message }] } }`；9001 的 `detail` 固定为 `{ requestId }` | P3-001 §4 第 2/5 项 |
| `field` 取值 | `field = z.core.toDotPath(issue.path) \|\| '(root)'`。① 弃 `join('.')`（`['rows',1,'cells',0]` → `rows[1].cells[0]`，RHF 才认得；连字符键无歧义）；② **根级 issue 一律 `(root)` 不区分 code**（`invalid_type` 的 body 类型错 path 同样是空数组） | P3-001 §5.4-2 |
| `rule` 取值 | 取 `issue.code`（zod 4.6.7 `$ZodIssueCode` 共 **11 个**字面量），不依赖 field 约定 | P3-001 §5.4-2 |
| refine 规约 | shared 层所有 `.refine()` / `.superRefine()` **必须显式传 `path`**（否则 path 为空 → field 空 → 前端 `setError("")` 无效、用户零反馈；口令复杂度规则正踩此坑） | P3-001 §2.2 坑 2 |
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
| G1 | contract-diff 类型面归一化全等；**孤儿 schema（无任何端点 `$ref` 的 components.schemas）一律 fail，不留 warn 档**（`SnapshotSaveRequest` 已随 7xxx 放行落盘删除，原位留注释）。归一化算法规约（format/pattern/enum 是否参与、`example` 不参与、`required` 数组与 `properties` 键序归一、`nullable` vs `type:[x,'null']` 归一）由 **P3-037 实施期产出 `contract-diff.mjs` 内置规则表并回填本行**（义务已挂 P3-037 工作项收口断言），P3-011 的 `schemaOf()` 复用同一份 | P3-037 / P3-011 |
| E-CV | `validation-coverage.e2e-spec.ts`：按样本类型分流断言期望码——① requestBody 非法样本（错类型/未知键）→ **7001**；② query 越界样本（**按 yaml 边界值 ±1 贴边生成，禁止远离边界的取样**：`Limit` maximum:100 → `limit=101`、minimum:1 → `limit=0`；`Page` minimum:1 → `page=0`；`FileId` format:uuid → 格式错值。机理：maximum:100 的实现若被放松成 `max(200)`，取 `limit=999` 仍 fail 会漏放行，只有 `limit=101` 能抓获单侧放松）→ **7002**；③ path 参数非法样本（非 uuid id）→ **7004**。遍历口径 = 带 requestBody/query/path 的操作，**parameters 须合并 op 级与 path 级两处来源**（openapi 有 6 个操作的参数定义在 path 级：`GET/PATCH /users/{id}`、`PATCH/DELETE /files/{id}`、`GET/POST /files/{id}/snapshot`）。另含 POST snapshot 空 body 的**反断言**（200/2005，**不得** 7001）。带参但未挂 400 的操作已 **0 个**（2026-10-22 用户裁决「补挂」并落盘：4 个 path 级参数端点已补 `BadRequest`，挂 400 操作 22/29，余 7 个全为 no-param；`check_openapi_contract.py` v1.2 已把「带参未挂 400」升为 FAIL 断言），E-CV 遍历口径 = 契约实况 22 个操作，**不私扩样本集** | P3-037 |
| A-PATH | refine 显式传 path：喂必失败样本后，所有 issue 满足 `path.length > 0 \|\| code === 'unrecognized_keys'` | P3-011 |
| A-STRICT | 所有 request schema 为 `z.strictObject()` 或 `.strict()`；未知键样本必须返回 400 而非静默剥离 | P3-011 |

---

## 卡内待办（不属四栏，供派单参考）

1. 7xxx 已放行（2026-10-22，P3-001 §4），本卡各节按放行后口径执行。
2. `SnapshotSaveRequest` 已删除（随 7xxx 放行落盘，原位留注释），G1 孤儿规则已可启用。
3. 本卡与 D1-05 错误码矩阵的关系：**码段事实源 = openapi `x-error-code-registry` 已放行实况**（1xxx 认证与用户 / 2xxx 文件域 / 3xxx 导入 / 4xxx 协同与连接 / 5xxx License / 6xxx SSO / 7xxx 请求校验 / 9xxx 兜底）；D1-05 只定**四层对照与同语义多出口一致**，无权重分段。若 D1-05 任务书与 registry 冲突，**以 registry 为准并开 OPEN-DECISIONS，不得以 D1-05 回改本卡或 registry**。
4. G1 归一化规则表由 P3-037 实施期产出并回填本卡 G1 行——**结构性依赖**：卡定稿时点 G1 断言不可执行，验收实质转移至 P3-037；义务已挂 P3-037 工作项收口断言，**派发 P3-037 时核回填**。
