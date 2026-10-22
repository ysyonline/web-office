# 公式函数白名单（119 函数场景集）与 volatile 处理规则

> 版本：v1.6（修订记录见文末）
> 产出人：高见远（首席架构师） | 依据：PM 场景集名单（2026-10-21 商务定稿）+ Spec §2 公式引擎行「场景必备集 80-120」+ ADR-001「输入收敛则结果收敛」+ PM 桶 I 裁决（2026-10-21 方案 b 差分导入）
> 作用：显式函数清单；volatile 函数的静态化规则——若不闭环，ADR-001 的收敛根基（相同输入必产生相同计算结果）被 volatile 函数破坏

---

## 1. volatile 函数处理规则（先于清单，这是收敛根基）

### 1.1 危害机理

ADR-001：协同只同步原始输入，计算值由各端公式引擎本地重算推导，输入收敛则结果收敛。volatile 函数违背此前提：
- `NOW()/TODAY()`：同一输入在不同时刻求值结果不同——两端重算时刻不同即发散；
- `RAND()/RANDBETWEEN()`：每次求值随机——同一端两次重算都不同；
- `OFFSET()/INDIRECT()`：引用目标在协同结构操作（插行/删行）后发生静默偏移，依赖图不感知，两端可因结构操作应用顺序不同而指向不同区域。

### 1.2 处理规则（MVP 锁定）

| 类别 | 函数 | 规则 |
|---|---|---|
| 时刻类 | NOW, TODAY | **静态化**：编辑确认（写入 f 字段）时立即求值，**以值+求值时间戳固化**（cell: { v: 计算值, f: 原文, t }, 时间戳进 cell 扩展字段 p.frozenAt）。此后不参与重算——依赖它的下游公式引用其固化值。重算触发仅一种：用户手动重新编辑该单元格 |
| 随机类 | RAND, RANDBETWEEN | **静态化**（同上）：编辑确认时固化一次随机结果，不再随重算变化。需要重新抽样 = 重新编辑该格 |
| 间接引用类 | OFFSET, INDIRECT | **不在名单内**（PM 119 名单未收录，天然排除；若未来加回需先解决动态引用在结构操作下的语义一致性，另立评估） |

静态化实现要点：编辑确认时求值一次，随后该格按「档案形态」处理——v 固化进数据层、f 移入公式档案（同 §3 载体，避免引擎重算再次求值）；固化时间戳经 Yjs 同步，两端一致的 v 值即收敛。**v1.3 修订说明**：原「引擎侧标记为非重算节点（脏标记不入队）」无数据模型载体（ICellData 无该字段，探针实证 v+f 并存会被重算覆盖），静态化的落点从引擎标记改为「编辑确认时求值后剥 f 进档案」——固化语义不变，载体落地方式变更。

**v1.5 导入路径补遗（PM 口径）**：NOW/TODAY/RAND/RANDBETWEEN 的**导入路径**与编辑路径对齐——导入时同样固化：值取 xlsx 缓存值（v=缓存值，f 剥除进公式档案，来源标 import-static），不触发引擎重算。机理：若导入时按公式进引擎，双端加载时刻不同则 NOW/TODAY 求值不同、RAND 每次重算不同——违反 §1.1 收敛前提（ADR-001 §1.1 机理）；xlsx 缓存值是 Excel 上次保存时的确定值，取它即两端天然一致。导入后用户重新编辑该格 = 重新静态化（走编辑路径）。

## 2. 119 函数白名单（PM 场景集，显式清单）

按 PM 名单分八组。**计数口径：每个函数名计 1 个名额**（RANK 与 RANK.EQ 是两个函数）。白名单外函数编辑侧拒绝输入（提示「函数不在支持列表」）；导入侧策略见 §3（禁静默转文本）。
文末「规范化数组清单」是 whitelist.ts 的唯一生成源（正文分组仅作人读说明，冲突时以数组为准）。

### 数学（20）
SUM, SUMIF, SUMIFS, SUMPRODUCT, SUBTOTAL, PRODUCT, ABS, ROUND, ROUNDUP, ROUNDDOWN, TRUNC, INT, MOD, SQRT, EXP, LN, LOG, CEILING, RAND, RANDBETWEEN

（RAND/RANDBETWEEN 在名单内但受 §1.2 静态化规则约束）

### 统计（19）
AVERAGE, AVERAGEIF, AVERAGEIFS, COUNT, COUNTA, COUNTBLANK, COUNTIF, COUNTIFS, MAX, MIN, LARGE, SMALL, MEDIAN, STDEV, STDEVP, VAR, VARP, RANK, RANK.EQ

### 逻辑（7）
IF, IFS, AND, OR, NOT, IFERROR, IFNA

### 文本（19）
LEFT, RIGHT, MID, LEN, LENB, FIND, SEARCH, REPLACE, SUBSTITUTE, TRIM, CLEAN, UPPER, LOWER, PROPER, CONCAT, TEXTJOIN, TEXT, VALUE, EXACT

### 日期（20）
TODAY, NOW, DATE, TIME, YEAR, MONTH, DAY, HOUR, MINUTE, SECOND, WEEKDAY, WEEKNUM, EDATE, EOMONTH, DATEDIF, DAYS, NETWORKDAYS, WORKDAY, DATEVALUE, TIMEVALUE

（TODAY/NOW 在名单内但受 §1.2 静态化规则约束）

### 查找引用（13）
VLOOKUP, HLOOKUP, XLOOKUP, INDEX, MATCH, XMATCH, LOOKUP, CHOOSE, ROW, COLUMN, ROWS, COLUMNS, TRANSPOSE

### 财务（15）
PMT, IPMT, PPMT, RATE, NPER, PV, FV, NPV, IRR, XNPV, XIRR, SLN, DDB, SYD, DB

### 信息校验（6）
ISBLANK, ISERROR, ISNA, ISNUMBER, ISTEXT, N

计数核对：20+19+7+19+20+13+15+6 = **119**（与数组清单逐行一致，机器可核）。

## 3. 导入侧策略（v1.3 改写：禁静默转文本 + 载体改判「公式档案侧车」；v1.4 增补三桶技术定义）

xlsx 解析（import-export WI-5）遇白名单外公式的处理：

1. **公式文本不丢**（AC-07/AC-08 的保真对象）：原始 f 文本存入**公式档案**（formula archive，snapshot `resources` 侧车，见 WI-5 方案 C），导出时从档案还原 f——round-trip 后 Excel 打开仍是公式；
2. **Univer snapshot 内剥 f 只留 v**：该格进入引擎的形态为纯值格 `{v: xlsx 缓存值, t}`。**改判依据（实证）**：ICellData 无「冻结值/不参与重算」字段（typedef.d.ts:239-281，唯一逃生口 custom 官方注明不建议外部使用）；v+f 并存形态下，任何使依赖变脏的编辑都会让重算覆盖缓存值（探针 A2b/A5：缓存 0.087 被覆盖为 2）、引擎未实现函数变 #NAME? 且级联污染引用它的空白名单公式（探针 A6/A7）。剥 f 后引擎依赖图中无该节点——**级联错误结构性不存在**，引用它的 `=C1*2` 按普通值正常计算；
3. **UI 口径（PM 定；v1.5 文案与触发范围更新）**：文件级一次性提示条，非逐格弹窗——**触发范围 = 桶 II/桶 III 冻结格 + 桶 I 差分降级格的合计数 N**（桶 I 差分通过的格不计入、不加角标——与白名单公式同权）；文案（PM 定稿）：「本文件含 N 个暂不支持自动重算的公式，其值已按导入时结果保留；点击单元格右上角标记可查看原公式，导出时公式将完整还原」；档案命中格**右上角**加 SVG 标记图标（lucide **AlertCircle，12px，琥珀色**——语义为「注意」而非「错误」，与 Token warn 色一致），点击显示档案中的原公式文本；选中该格时**公式栏灰态只读**展示原公式（可复制、不可编辑）；编辑侧拒绝文案与粘贴豁免政策（表内流转放行/外源按 119 校验）以 PM 裁决原文为准；
4. 用户重新编辑该格输入新公式时按白名单校验，同时**删除档案条目**（防导出时旧 f 覆盖新值）；档案增删经 Yjs 内容通道同步对端、随 snapshot resources 一体物化；**v1.4 增补**：档案条目补存导入时 v，结构操作（插/删行列、排序、移动剪切粘贴）同步迁移档案键，导出还原前值校验（详见 plan.md WI-5 规则 6/7/8/9）；
5. 降级统计写入 import_tasks（数量 + 函数名列表 + v1.5 起差分降级原因码），可追溯。

禁令（Spec §10 已同步）：**禁止静默转纯文本**——丢公式文本会破坏 AC-07「公式文本保真」的验收；档案侧车即「文本保真」的载体，与「引擎不参与重算」的隔离是两件事，不可混同。

### 3.1 三桶技术定义（v1.4 建立；v1.5 依 PM 裁决桶 I 改判「引擎可用区（导入保真集）」）

记号：**I** = Univer 引擎实现集（宽松提取 542 = 评审人口径；严格提取 516 = 注册表工程真值，差异为 arabicToRomanMap/CONVERT 单位表等数据表伪影 26 条）；**W** = 119 白名单；**U** = xlsx 全函数宇宙；**V** = 引擎 volatile 金名单（4：RAND/RANDBETWEEN/NOW/TODAY）；**X** = 排除集（8：V + RANDARRAY + OFFSET/INDIRECT/ANCHORARRAY，判定准则：相同输入必须产生相同输出，volatile 类与动态引用类一律排除）。

| 桶 | 定义 | 技术判定 | 导入处理（v1.5 PM 裁决后） |
|---|---|---|---|
| 桶 I = 引擎可用区 E | I − W − X（严格提取 **393 个**，CI 定数，机器生成禁手抄） | 引擎已实现 + 协同安全 + 仅不在场景集——与 W 内函数技术等价（§3.2 论证） | **差分导入（方案 b）**：引擎重算值 vs xlsx 缓存值一致 -> f 保留参与计算（与白名单公式同权，无角标无提示条）；不一致 -> 自动降级为方案 C 冻结（缓存值+档案+角标+降级统计） |
| 桶 II | U − I（引擎未实现） | 重算必 #NAME? 且级联（探针 A6/A7），无载体可算 | 冻结（方案 C 正解）：剥 f 进档案 |
| 桶 III | X 内已实现者 F3 = I ∩ X（6 个）+ 引擎可用区外的 RANDARRAY 同理 | volatile 重算发散 / 引用类结构操作后静默偏移——协同不安全 | 冻结有理；其中 RAND/RANDBETWEEN/NOW/TODAY 在 W 内但受 §1.2 静态化约束（v1.5 起含导入路径）；RANDARRAY/OFFSET/INDIRECT/ANCHORARRAY 剥 f 进档案 |

**排除集 X 的实证依据（1.0.2 产物实读）**：
1. V（4）来自 `FORCED_RECALCULATION_FUNCTION_NAME` 数组字面量（行 810-815）；
2. RANDARRAY：实现体内 Math.random()（行 35531/35532）——随机数组，每次求值不同；
3. OFFSET/INDIRECT：动态引用（whitelist §1.1 既有排除理由——结构操作后静默偏移）；
4. ANCHORARRAY：needsReferenceObject 动态引用语义（溢出区域锚定引用，目标由运行态布局决定——非相同输入相同输出）；
5. **G9 非确定性源扫描**：引擎产物中 Math.random() 仅 6 处调用点（RAND/RANDARRAY/RANDBETWEEN 实现体内）、new Date() 仅 2 处（NOW/TODAY）——全部落在 X 内，无漏网非确定函数（引擎升级引入新源时 CI 强制 FAIL 重估）。

**提取法（CI 固化）**：函数注册表条目形态 `[ClassIdentifier, "NAME"]`（类名可含 $ 后缀，数字键条目是 arabicToRomanMap 等数据表，排除）——严格提取 516 为工程真值；v1 的宽松提取 542（含 26 伪影：罗马数字 21 + LTON + 数字键双计入等）保留在 G8 作历史口径基线，差分导入域一律用严格集。

### 3.2 桶 I（引擎可用区）与白名单的技术等价性论证

**结论：等价。** 引擎可用区函数与 W 内函数在「协同收敛模型」下的行为完全同构，论证按 ADR-001 的收敛链路逐环比对：

1. **输入同步**：协同只同步 f 文本（原始输入），两域的 f 都是不带副作用的确定性文本——Y.Map 值收敛路径无差别；
2. **本地重算**：两域函数都在引擎实现集内——AST 解析、依赖图构建、脏区重算走同一代码路径（同一 BaseFunction 子类体系，仅 minParams/maxParams/calculate 实现不同）；
3. **确定性**：引擎可用区 = I − W − X，已排除 V（volatile——重算时刻/随机数导致两端发散）与 OFFSET/INDIRECT/ANCHORARRAY（动态引用——结构操作后引用静默偏移）与 RANDARRAY（随机数组）——排除法下与 SUM/IF 等同为纯函数：相同输入必产生相同输出；
4. **结构操作**：引擎可用区函数的引用经引擎依赖图追踪，插删行列时 Univer 自身会改写 f 中的引用（引擎内建 ref 变换，与 W 内 VLOOKUP 等引用函数同一机制）——不存在「档案侧车不随结构迁移」的错位类风险（那是不进引擎的档案才有的问题）；
5. **#NAME? 级联**：引擎可用区已实现，无此路径（桶 II 专属）。

**残余差异不在协同层，在值语义层与 QA 覆盖面**：① W 的 119 个每个都有 §5.5 逐函数冒烟，393 个没有——差分导入天然以「xlsx 缓存值」为 oracle 校验每个格的值正确性（不一致即降级），比抽采样更严格；② 引擎实现与 Excel 的值语义差异（舍入/边界/文本比较规则）由差分校验兜底，不会静默出错值。**PM 已裁决采纳（方案 b），见 OPEN-DECISIONS 桶 I 条目 RESOLVED。**

### 3.3 差分导入规则（v1.5，PM 方案 b 的工程落点）

导入管线对白名单外、引擎可用区内的公式格（393 域）执行：

1. **判定顺序**：f 解析出的顶层函数名 ∈ W -> 白名单路径（照常）；∈ X -> 桶 III 冻结路径（剥 f 进档案）；∉ I（引擎未实现）-> 桶 II 冻结路径；否则（∈ 引擎可用区）-> 差分路径；**顶层函数集为空（`=A1+B2` 类纯算式，无函数名）-> 按引擎可用区走差分**（v1.6 补丁：四分支对空集全 vacuous，算式确定性、引擎原生实现，差分一致即保留 f 同权——2026-10-22 B5 评审随 D1-03 v1.1 落地）；
2. **差分执行**：无头 Univer 加载该格 f + 依赖格值，触发重算（`set-trigger-formula-calculation-start`，已实证可用；须等重算完成信号或 >= 100ms，同步读是时序假象——探针 A2a/A2b），读引擎重算值 vs xlsx 缓存值；
3. **一致判定**：数值按浮点容差（1e-10 相对误差，吸收 Excel/引擎双端 IEEE754 舍入差）；文本/布尔严格相等；错误值按错误码字符串相等（#DIV/0! 等）；
4. **一致 -> f 保留**：该格以 {v: 缓存值, f} 进 snapshot 参与引擎计算——与白名单公式同权：无角标、无提示条计入、后续编辑/协同/结构操作全部走既有白名单路径（f 在引擎内，引用随结构 op 自动变换，无档案错位问题）；
5. **不一致 -> 自动降级方案 C**：剥 f 只留缓存值 + 档案条目（含 v）+ 角标 + 计入降级统计（函数名 + 「差分校验不一致」原因码）——用户口径与既有桶 II/III 降级完全一致；
6. **多函数格**：f 含多个函数时，全部 ∈ 引擎可用区才走差分；任一函数 ∈ 桶 II/III -> 整格冻结（保守粒度：格级判定，不做函数级混合）；
7. **性能**：差分在导入任务队列内做（NestJS 队列，10MB 上限内），重算由引擎增量依赖图承载（仅该格及其依赖子图）；上限定为差分格数 <= 10000/文件，超限部分直接走冻结路径 + 降级统计标注「差分校验超限」——防极端文件的队列雪崩。

## 4. 白名单的技术落点

1. **前端**：编辑器公式输入校验（Univer FormulaEditor 或应用层拦截 set-range-values 的 f 字段），白名单来自本文件「规范化数组清单」生成的常量（`src/formula/whitelist.ts`，**从下述数组单向生成，禁手抄漂移**；CI 门禁 `scripts/check_formula_whitelist.py` 校验清单与 Univer 引擎实现集的子集关系）；
2. **后端导入**：按 §3 策略（剥 f 进档案 + 缓存 v + 提示条 + 标记图标）；
3. **协同**：白名单外公式不进 Yjs 编辑路径（编辑侧拦截）；导入路径进入的是纯值格 + 档案侧车（引擎无公式节点，无重算分歧），档案增删随内容通道同步，两端一致；
4. **volatile 闸**：NOW/TODAY/RAND/RANDBETWEEN 编辑确认走静态化路径。

## 5. 验收要点（供 QA）

1. 输入 =SUM(A1:A10) 正常求值；输入 =OFFSET(A1,1,0)（不在名单）被拒并提示；
2. 输入 =NOW() 后值固化（v=当时时刻），等待 1 分钟后两端该格值一致；下游 =YEAR(NOW 所在格) 引用固化值；
3. =RAND() 编辑确认后不再变化；重新编辑该格重新抽样；
4. 名单外三函数导入（v1.5 更新为差分口径）：**=AGGREGATE(...)（引擎可用区内）**走差分——重算值与缓存值一致时该格保留 f 参与计算（无角标、不计入提示条 N）、编辑其依赖格该格**正常重算**；不一致时自动降级（纯值+角标+档案+计入 N）。**=OFFSET(...) / =INDIRECT(...)（桶 III）**恒走冻结：该格为纯值（v=缓存值）+ 右上角 AlertCircle（12px 琥珀）标记、点击见档案中的公式原文、选中时公式栏灰态只读、文件级提示条出现（PM 新文案）、import_tasks 记录函数名列表；编辑其依赖格该格值**不变**（引擎无此公式）；round-trip 导出后 Excel 打开仍是公式（**公式文本不丢失**，AC-08）；注：**=IRR(...) 在 119 白名单内（财务组），不是「名单外」范例**——v1.2 时期的该行示例为举例失实，2026-10-21 评审后换用 OFFSET/INDIRECT/AGGREGATE；
5. 白名单 119 函数逐个冒烟（值正确性断言，进回归集；RANK.EQ 点号函数单独覆盖解析路径）；
6. （v1.5 增）volatile 导入静态化：xlsx 含 =NOW()/=RAND() + 缓存值 -> 导入后该格 v=缓存值、f 进档案（来源 import-static）、无角标（白名单内静态化路径与编辑路径 UI 一致）；双端加载后该格值一致；
7. （v1.5 增）差分降级反例：构造 =AGGREGATE(1,6,B1:B9) 格但篡改缓存值（与引擎重算值故意不一致）-> 导入后该格走冻结形态（纯值=篡改后缓存值 + 角标 + 档案 + 计入 N + import_tasks 含「差分不一致」原因码）。

## 规范化数组清单（whitelist.ts 唯一生成源）

> 每行恰好一个函数名，全大写（点号为函数名组成部分，RANK.EQ 合法）；无注释无分隔符；共 119 行。本数组是 `src/formula/whitelist.ts` 的唯一生成源——正文分组仅作人读说明，两者冲突时以本数组为准。

```text
SUM
SUMIF
SUMIFS
SUMPRODUCT
SUBTOTAL
PRODUCT
ABS
ROUND
ROUNDUP
ROUNDDOWN
TRUNC
INT
MOD
SQRT
EXP
LN
LOG
CEILING
RAND
RANDBETWEEN
AVERAGE
AVERAGEIF
AVERAGEIFS
COUNT
COUNTA
COUNTBLANK
COUNTIF
COUNTIFS
MAX
MIN
LARGE
SMALL
MEDIAN
STDEV
STDEVP
VAR
VARP
RANK
RANK.EQ
IF
IFS
AND
OR
NOT
IFERROR
IFNA
LEFT
RIGHT
MID
LEN
LENB
FIND
SEARCH
REPLACE
SUBSTITUTE
TRIM
CLEAN
UPPER
LOWER
PROPER
CONCAT
TEXTJOIN
TEXT
VALUE
EXACT
TODAY
NOW
DATE
TIME
YEAR
MONTH
DAY
HOUR
MINUTE
SECOND
WEEKDAY
WEEKNUM
EDATE
EOMONTH
DATEDIF
DAYS
NETWORKDAYS
WORKDAY
DATEVALUE
TIMEVALUE
VLOOKUP
HLOOKUP
XLOOKUP
INDEX
MATCH
XMATCH
LOOKUP
CHOOSE
ROW
COLUMN
ROWS
COLUMNS
TRANSPOSE
PMT
IPMT
PPMT
RATE
NPER
PV
FV
NPV
IRR
XNPV
XIRR
SLN
DDB
SYD
DB
ISBLANK
ISERROR
ISNA
ISNUMBER
ISTEXT
N
```

## 修订记录

| 版本 | 日期 | 变更 | 依据 |
|---|---|---|---|
| v1.0 | 2026-10-21 | 首版（50 函数清单 + volatile 处理规则） | 用户审查 P1-5 |
| v1.1 | 2026-10-21 | 打回 3 修复：计数口径统一为「每函数名 1 名额」，删除 CONCATENATE/RANK/LARGE 补齐恰好 50；新增「规范化数组清单」作为 whitelist.ts 唯一生成源（机器校验：50 行、全大写、无重复、与正文分组一致） | 用户复审打回 |
| v1.2 | 2026-10-21 | PM 名单定稿：全文重写为 119 函数场景集（八组）；§3 导入策略改写——白名单外公式保留公式文本 + 缓存计算值 + 文件级提示条 + 单元格右上角 AlertCircle（12px 琥珀）标记 + 公式栏灰态只读 + 导出保留原文本，禁静默转文本；OFFSET/INDIRECT 天然排除（不在名单）；数组清单重生成 119 行（机器校验通过） | PM 119 名单 + Spec §2「场景必备集 80-120」+ Spec §10 禁令 |
| v1.3 | 2026-10-21 | 第二轮外部评审（B 分支引擎能力边界）修订：① §3 载体改判「公式档案侧车（方案 C）」——Univer snapshot 内剥 f 只留 v、原始 f 存 snapshot resources 侧车、导出还原；依据探针实证（ICellData 无冻结字段、缓存值被重算覆盖、#NAME? 级联）② §1.2 静态化落点从「引擎侧标记非重算节点」改为「求值后剥 f 进档案」（载体一致性）③ §5 验收范例 IRR 换 OFFSET/INDIRECT/AGGREGATE——IRR 在 119 白名单财务组内，原「名单外」举例失实（引擎 542 实现集含三者，白名单均未收录）④ §4 补 CI 门禁引用（scripts/check_formula_whitelist.py） | 第二轮外部评审 + runtime-calc-probe 14/14 断言 + 评审人 542 提取法独立复现 |
| v1.4 | 2026-10-21 | 第三轮外部评审（分支 C 白名单边界）修订：① 新增 §3.1 三桶技术定义（桶 I = 引擎已实现 ∩ 名单外 ∩ 非冻结，421 个定数；桶 II = 引擎未实现；桶 III = F3 冻结集 6 个）+ §3.2 桶 I 与白名单的技术等价性论证（输入同步/本地重算/确定性/结构操作/级联五环逐环同构，残余差异仅在 QA 覆盖面）② 桶 III 机器生成法固化：引擎 volatile 锚点 = FORCED_RECALCULATION_FUNCTION_NAME 数组字面量（1.0.2 行 810-815）+ OFFSET/INDIRECT 语义名单，落 scripts/check_formula_buckets.py（G6/G7/G8 断言）③ §3 第 4 条增补档案 v 补存 + 结构迁移 + 值校验引用（错位 P0 补丁，详见 plan.md WI-5 v1.4）④ 桶划分的政策采用（桶 I 是否允许计算）登记 OPEN-DECISIONS 归 PM | 第三轮外部评审 + check_formula_buckets.py G6-G8 实跑 PASS（引擎 542 / 白名单 119 / F3 6 / 桶 I 421） |
| v1.6 | 2026-10-22 | §3.3 规则 1 补「顶层函数集为空（纯算式）按引擎可用区走差分」分支——原四分支（∈W/∈X/∉I/∈E）对空函数集全 vacuous，`=A1+B2` 类无归属；随 D1-03 v1.1（B5 挑刺审查）落地 | B5 三卡挑刺审查（D1-03 P1：短路序分支空档，机读发现） |
| v1.5 | 2026-10-21 | PM 桶 I 裁决落地（方案 b：引擎可用区差分导入）：① §3.1 桶 I 改判「引擎可用区（导入保真集）」E = I − W − X，**393 个**（严格提取 516 为工程真值；v1 宽松 542 含 26 伪影——arabicToRomanMap 罗马数字数据表/CONVERT 单位表 LTON 等，提取法修正为注册表条目形态 [Class, "NAME"]）② 新增 §3.3 差分导入规则（判定顺序/差分执行/浮点容差/一致保留 f 同权/不一致自动降级方案 C/多函数格级判定/万格上限）③ §1.2 补 volatile 导入路径静态化（值取 xlsx 缓存值，防双端加载时刻发散）④ §3 提示条触发口径改「桶 II/III + 差分降级格」、文案换 PM 定稿（「…点击单元格右上角标记可查看原公式，导出时公式将完整还原」）⑤ §5.4 范例拆分（AGGREGATE 走差分、OFFSET/INDIRECT 恒冻结）+ 新增 §5.6/§5.7 用例 ⑥ CI 门禁升级：G9 非确定性源扫描（Math.random 6 处/new Date 2 处全落 X 内）+ G6b/G7b/G8b 引擎可用区减法断言（393 定数、排除集 X 8 个、与 W 零重叠） | PM 桶 I 裁决（方案 b）+ check_formula_buckets.py v2 实跑 ALL PASS（G6-G9 + G6b/G7b/G8b） |
