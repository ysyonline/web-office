# D1-13-A E-CV 样本清单（附录件）

> 属主卡：**D1-13 请求校验链与 API 契约生成门禁**（v1.14 拆出）| 泳道 BE | 消费方同主卡（P3-037 实施期按本件逐行落样本）
> 性质：**详设件（E-CV 遍历口径 + 逐行样本清单），不计卡体量**（DESIGN-LAYER §2.2 条 1，v1.17 立）；主卡保留分流结论与指针，本件承载可逐行核对的实施清单
> 沿革：①②③ 类口径与样本清单系 D1-13 v1.8~v1.13 历轮挑刺裁决产物，**逐字迁移、不改动语义**；轮次明细见 REVIEW-INDEX 线程段
> 纪律：实施者按本表**逐行落，不私扩**——样本集只取自 `docs/api/openapi.yaml` 既有约束，为凑覆盖率臆造约束即违约（§5 A3）

---

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

---

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

## 附：④ 栏 E-CV 行原内联口径（v1.14 迁移前原文，逐字保留）

> 说明：下列两段原嵌在 D1-13 ④ 栏 E-CV 行的括注内，v1.14 拆卡时整段迁出、主卡原位改为指针。保留原文形态以便与 REVIEW-INDEX 线程段的历轮裁决逐字对齐。

- **① 类**（原 ④ E-CV 行内联）：**① 类遍历口径（v1.11 补，条 H；v1.13 订正，grill 轮 ①：契约实况 requestBody 操作 = 11 个非 9 个——`POST /files/{id}/import` 与 `POST /license/install` 系 multipart inline，v1.11 口径下这两端点的「漏挂 pipe 零校验」行为级防线为空**）：9 个 `$ref` JSON schema 逐 schema 各一条错类型 + 一条未知键样本（如 `{"__probe_unknown__":1}`），**未知键必含、不得只写错类型**——否则 A-STRICT 判据 2 零测试面（G1 对 strict 盲区）；**2 个 multipart inline 各 2 样本**：required 字段缺失（样本取 yaml `required` 既有约束，非私扩）→ 400、content-type 非法（JSON body 打 multipart 端点）→ 7003）
- **③ 类**（原 ④ E-CV 行内联）：③ path 参数非法样本 → **7004**（**样本清单见本节末「E-CV ③ 样本清单」表，v1.9 立 / v1.10 订正**：**13 个操作**，其中 4 个只能靠 path 级继承展开发现；**12 个为 uuid 型、1 个为 enum 型**，样本值按类型分别取）。遍历口径 = 带 requestBody/query/path 的操作，**parameters 须合并 op 级与 path 级两处来源**（openapi 有 6 个操作的参数定义在 path 级：`GET/PATCH /users/{id}`、`PATCH/DELETE /files/{id}`、`GET/POST /files/{id}/snapshot`）
