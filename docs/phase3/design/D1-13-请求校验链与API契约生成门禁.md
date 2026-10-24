# D1-13 请求校验链与 API 契约生成门禁

> 卡号：D1-13 | 工时 2.4h（2 包 × 1.2h）| 泳道 BE | 里程碑 M1 | 需求域 R7 设计层
> 消费方（首包）：**P3-011**（自研 ZodValidationPipe 落点）、**P3-012**（7xxx 错误码入表）、**P3-037**（CI G1 contract-diff）；设计意图覆盖 P3-011/012/037（共 23 包——补对账入口（U-2 评估，2026-10-23）：原卡头无枚举无总数，§3.1 行值 23 无法自证；三项包数机读 7+7+9 = 23，与 §3.1 一致）
> 主要出处：`docs/phase3/P3-001-工程化基线裁决记录.md` §2.2 / §4 / §5.4、Spec §4、ADR-005、openapi.yaml（**7xxx 已于 2026-10-22 放行落盘**）
> 状态：**v1.14**（拆卡轮：E-CV ②③ 样本清单 → 附录件 `D1-13-A`、① 栏 5 行实施级口径 → 附录件 `D1-13-B`，决策结论全留卡、语义未变｜v1.13：① 类遍历口径 requestBody 实况 11 个非 9 个 + multipart inline 各 2 样本）| 沿革见 REVIEW-INDEX 线程段

---

## ① 接口 / 数据结构

| 项 | 定义 | 出处 |
|---|---|---|
| schema 落点 | `packages/shared/src/schemas/`；命名**逐字对齐** openapi `components.schemas`，不自造 | P3-001 §5.4-1 |
| 契约 schema（**22，v1.8 订正**） | **请求侧 9**：`LoginRequest` / `RefreshRequest` / `UserCreateRequest` / `UserUpdateRequest` / `SsoCallbackRequest` / `SsoConfig` / `FileCreateRequest` / `FileRenameRequest` / `ShareCreateRequest`；**响应侧 13（v1.8 补落点，原 ① 栏只列请求侧 9 个，13 个响应侧无落点；下列为 `components.schemas` 机读实况逐字照抄，共 22 = 9 + 13）**：`Error` / `ValidationErrorDetail` / `ValidationErrorItem` / `LoginResponse` / `RefreshResponse` / `UserResponse` / `UserAdminResponse` / `FileResponse` / `FileListResponse` / `SnapshotResponse` / `ImportTaskStatus` / `ShareResponse` / `AuditLogListResponse`——**命名逐字对齐 `components.schemas`**（不自造；`Error`/`ValidationErrorDetail`/`ValidationErrorItem` 归本栏，随 `x-detail-variants` 引用故非孤儿），只声明方向不写实现，落 `packages/shared/src/schemas/`（与请求侧同目录，不分 internal）。**G1 比对范围 = 22 全集**（见 ② 栏口径澄清表与 ④ G1 行）——裁子集则「类型面全等」名不副实、孤儿规则同时名存实亡 | P3-001 §5.4-1（按 schema 名 grep 定位，不写行号——yaml 活跃变更下行号必漂移）+ **本卡 v1.8 补**（响应侧 13 个落点，Q7 裁决） |
| 非契约 schema | `FileListQuery` / `UserListQuery` / `AuditLogQuery` / `ExportQuery` / PathParams / `PasswordRules` → **统一放 `src/schemas/internal/`**；**G1 不比对 internal 目录**（顶层契约 22 个才是比对面），**目录即分类**。`components.parameters`（uuid/范围约束）的 yaml 值与 internal schema 的一致性**不进 G1**，由 E-CV 按 yaml 约束生成样本做行为级兜底（见 ④ E-CV） | P3-001 §5.4-1 |
| 实施级口径（coerce / `field` / `rule` / message 模板 / `schemaOf`） | 5 行逐字迁至附录件 `design/appendix/D1-13-B-校验链实施级口径.md`（v1.14 拆卡，语义未变，实施期照抄该件）；本栏只留决策结论——22 schema 全集与落点、strict 必开、契约事实源、错误响应形状、refine 显式 path、夹具约束 | 本卡 v1.14 |
| strict 语义 | 新建用 `z.strictObject()`；`.extend()` 后再补 `.strict()`（**v1.8 复核补正**：`z.strictObject().extend()` 实测**继承** strict 性，`z.object().extend()` 不继承——故「extend 后再补 `.strict()`」在 strictObject 路径下**冗余但无害**，保留作防御写法）。**理由订正（v1.8，P1-3）**：`z.strictObject()` 与 `z.object()` 的 `toJSONSchema` 产物**字节级相同**（均 `additionalProperties:false`，实测）——故原「与 toJSONSchema 输出矛盾」的理由**不成立**；真实理由 = **`z.object()` 默认 strip（静默剥离未知键）**，与契约声明的 `additionalProperties:false` 语义不符：契约说不允许、运行时却静默吞掉请求方传来的字段，**调用方无感知**。**G1 对 strict 原理性盲区**（见 ② 栏口径澄清表新增行），唯一防线 = ④ A-STRICT 源码级断言 | P3-001 §2.2（后端纠偏）+ **本卡 v1.8 订正**（理由改写 + extend 继承性补正） |
| 后端管道 | 自研 `ZodValidationPipe`（`apps/server/src/common/pipes/`，约 30 行，零新依赖），**逐参数挂载** `@Body(new ZodValidationPipe(LoginSchema))`。**不能全局注册** → 漏挂即该端点零校验且不报错 | P3-001 §2.2 |
| 前端消费 | react-hook-form 7.90.0 + `@hookform/resolvers` 6.0.0 `zodResolver`；类型用 `z.infer` | P3-001 §2.2 |
| 契约事实源 | **openapi.yaml 手写件为唯一事实源（(a) 不变）**；zod 只是校验规则单一源；装饰器产物从属；两者由 CI G1 contract-diff 在**类型面**强制相等（归一化比对，P3-001 §2.4 G1/G2/G3 三段口径）。散文与 x-\* 扩展面**不设「等」的比对**——见 ② 节口径澄清。**不改 (c)，不重开冻结窗口** | P3-001 §2.2 / §2.4 |
| 错误响应形状 | `{ code, message, detail: { errors: [{ field, rule, message }] } }`；9001 的 `detail` 固定为 `{ requestId }` | P3-001 §4 第 2/5 项 |
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
| E-CV | `validation-coverage.e2e-spec.ts`：按样本类型分流断言期望码——① requestBody 非法样本（错类型/未知键/required 缺失/content-type 非法）→ **7001/7003**（**① 类遍历口径（v1.11 补 / v1.13 订正；全文与逐 schema 样本见附录件 §①）**：9 个 `$ref` JSON schema 各出「错类型 + 未知键」双样本（**未知键必含**，否则 A-STRICT 判据 2 零测试面）、2 个 multipart inline 各出「required 缺失 → 400 / content-type 非法 → 7003」双样本——**requestBody 操作实况 11 个非 9 个**）；② query 越界样本 → **7002**（**样本清单见附录件 §②**）；③ path 参数非法样本 → **7004**（**样本清单见附录件 §③**：13 操作 = 12 uuid + 1 enum，4 个只能靠 path 级继承展开发现，样本值按类型分别取）。遍历口径 = 带 requestBody/query/path 的操作，**parameters 须合并 op 级与 path 级两处来源**（openapi 有 6 个操作的参数定义在 path 级：`GET/PATCH /users/{id}`、`PATCH/DELETE /files/{id}`、`GET/POST /files/{id}/snapshot`）。另含 POST snapshot 空 body 的**反断言**（200/2005，**不得** 7001）。带参但未挂 400 的操作已 **0 个**（挂 400 操作 22/30，余 8 个全为 no-param；`check_openapi_contract.py` v1.2 已把「带参未挂 400」升为 FAIL 断言），E-CV 遍历口径 = 契约实况 22 个操作，**不私扩样本集**（样本集只取自 yaml 既有约束，为凑覆盖率臆造约束即违约）。**④ 契约反向断言（v1.8 增，Q6）**：`/api/v1/auth/refresh` 端点的 **423 + 1002** 与 **403 + 1005** 两出口**已显式挂载于契约**（判据 = 该端点 responses 含 423/403 键且 example.code 分别为 1002/1005）——**契约补丁已于 2026-10-24 解冻窗口落盘**（OPEN 64 RESOLVED），本条转正式 CI 门禁（过渡态解除） | P3-037 |
| A-PATH | refine 显式传 path：喂必失败样本后，所有 issue 满足 `path.length > 0 \|\| code === 'unrecognized_keys'`。**v1.8 补**：`unrecognized_keys` 分支虽使 `field` 恒为 `(root)`，但**该 code 的 `message` 必须含未知键名**（见 ① 栏该行），否则多未知键信息整体丢失——A-PATH 判据维持不变，message 含键名由 V-S2 的文案断言与本节一并核 | P3-011 |
| A-STRICT | 所有 request schema 为 `z.strictObject()` 或 `.strict()`；未知键样本必须返回 400 而非静默剥离。**判据落地载体（v1.11 补，条 H）**：判据 1 = P3-011 工作项收口断言（backlog 包面同轮落）+ 实现期以 ESLint 自定义规则强制（request schema 裸 `z.object(` 即 error）；判据 2 = ④ E-CV ① 类遍历口径（见该行 v1.11 补）。**本条是 strict 语义的唯一防线（v1.8 注）**——G1 对 strict 原理性盲区（见 ② 栏口径澄清表 strict 行），放松本条即无替代 | P3-011 |

### E-CV 样本清单（②③ 两节已拆至附录件）

样本清单（② query 越界 4 操作 / 5 声明 / 逐参数行；③ path 非法 13 操作 = 12 uuid + 1 enum，含 `$ref` 双口径计数）见 `design/appendix/D1-13-A-ECV样本清单.md`；**实施按该件逐行落、不私扩**（v1.14 拆卡，DESIGN-LAYER §2.2 条 1）。


---

## 卡内待办（不属四栏，供派单参考）

1. 7xxx 已放行（2026-10-22，P3-001 §4），本卡各节按放行后口径执行。
2. `SnapshotSaveRequest` 已删除（随 7xxx 放行落盘，原位留注释），G1 孤儿规则已可启用。
3. 本卡与 D1-05 错误码矩阵的关系：**码段事实源 = openapi `x-error-code-registry` 已放行实况**（1xxx 认证与用户 / 2xxx 文件域 / 3xxx 导入 / 4xxx 协同与连接 / 5xxx License / 6xxx SSO / 7xxx 请求校验 / 9xxx 兜底）；D1-05 只定**四层对照与同语义多出口一致**，无权重分段。若 D1-05 任务书与 registry 冲突，**以 registry 为准并开 OPEN-DECISIONS，不得以 D1-05 回改本卡或 registry**。
4. G1 归一化规则表由 P3-037 实施期产出并回填本卡 G1 行——**结构性依赖**：卡定稿时点 G1 断言不可执行，验收实质转移至 P3-037；义务已挂 P3-037 工作项收口断言，**派发 P3-037 时核回填**。
