# xlsx/csv 导入导出转换层拆解计划 plan.md

> 产出人：高见远（首席架构师） | 依据：Spec-web-office-v1.md 第 2 章 P0 导入导出（10MB 上限、后端任务队列）+ AC-07/AC-08
> 版本锚定：SheetJS CE 0.20.3（**cdn.sheetjs.com tarball**，npm 0.18.5 含 CVE 禁用；交付前入 verdaccio）/ ExcelJS 4.4.0 / PapaParse 5.4.x
> 运行位置：NestJS 任务队列（import_tasks 表驱动），不阻塞主线程；Univer 无头模式仅用于快照校验
> 修订：v1.3（2026-10-21 第二轮外部评审）——WI-3 验收改突变测试（原断言构造性恒真）；WI-5 白名单外公式载体改判「公式档案侧车（方案 C）」；范例 IRR 换 OFFSET（IRR 在 119 白名单内，原举例失实）；新增无头重算时序/覆盖/级联三条实证坑
> 修订：v1.4（2026-10-21 第三轮外部评审分支 C）——**档案坐标错位 P0 补丁**：档案条目补存 v + 导出还原前置值校验（兜底）+ 结构 op 同步迁移档案键（主防线，方案 B）；WI-5 锁定规则新增四条硬规则（补存 v/迁移/双通道顺序/值校验）；验收表新增结构操作族用例（含评审人陷阱用例「插入后不撤销即导出」）；已知坑新增三条（错位机理/undo 触发 remove-rows 复数 mutation/无头 undo 须 focusUnit）；实证探针 archive-migration-probe.mjs 13/13 PASS
> 修订：v1.5（2026-10-21 PM 桶 I 裁决，方案 b）——WI-5 新增规则 12 引擎可用区差分导入（E=I−W−X 共 393 个，一致保留 f 同权/不一致自动降级方案 C）；验收表新增差分导入用例五条（新 fixture usable-zone-diff.xlsx）；错位防线对差分降级格一体生效；排期 WI-5 再增 2 人日（差分管线）+ WI-1 增 0.5 人日（桶判定器），合计 16 人日；CI 门禁 check_formula_buckets.py 升级 v2（G9 非确定性源扫描 + G6b/G7b/G8b 引擎可用区减法断言）

---

## 1. 总体架构：五段流水线 + 中间模型（IR）

```
导入：  xlsx 文件 --(SheetJS 0.20.3)--> 原始工作簿 --(WI-1)--> IR 中间模型 --(WI-3/WI-4/WI-5)--> Univer snapshot --(WI-6 校验)--> file_snapshots
导出：  Univer snapshot --(WI-6)--> IR 中间模型 --(ExcelJS 4.4.0)--> xlsx 流 / --(PapaParse)--> csv
```

为什么要 IR 中间模型（而不是 SheetJS 直转 Univer）：
1. 导入导出双向复用同一模型，保证「导入再导出」往返保真（round-trip 断言的前提）；
2. 隔离三方库（SheetJS/ExcelJS）API 演进，锁定版本的替换成本最小（架构选型风险 3）；
3. Univer snapshot 与 xlsx 各自的字段语义差异（样式索引、数字格式代码）集中在一处处理。

IR 定义（`src/import-export/ir.ts`，工作项 WI-2 的交付物）：

```typescript
interface IRWorkbook {
  sheets: IRSheet[];
}
interface IRSheet {
  name: string;                    // sheet 名（<=31 字符，重名加序号后缀）
  rows: Map<number, IRRow>;        // 行号从 0 起
  colWidths: Map<number, number>;  // 像素
  rowHeights: Map<number, number>;
  merges: string[];                // "A1:C3" 区域列表
  frozen: { rows: number; cols: number };
}
interface IRRow {
  cells: Map<number, IRCell>;      // 列号从 0 起
}
interface IRCell {
  type: 'number' | 'string' | 'boolean' | 'date' | 'formula' | 'error' | 'empty';
  value?: number | string | boolean;
  formula?: string;                // 以 "=" 开头的 A1 引用公式文本（只保真文本，不计算）
  style?: IRStyle;                 // 见 WI-4
}
interface IRStyle {
  bold?: boolean; italic?: boolean;
  fontSize?: number; fontFamily?: string;
  fgColor?: string; bgColor?: string;   // #RRGGBB
  hAlign?: 'left' | 'center' | 'right';
  numFmt?: string;                       // Excel 数字格式代码，如 "0.00%"、"yyyy-mm-dd"
  border?: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
  wrap?: boolean;
}
```

## 2. 工作项拆解（6 项，各自独立验收）

### WI-1 导入解析层：xlsx/csv 文件 -> IR

范围：SheetJS 读文件（SAX/流式，10MB 上限与拒收）、csv 用 PapaParse；类型识别（数字/字符串/布尔/日期按单元格格式判定）；错误归类（格式不支持/结构损坏/超限）。

**CSV 编码探测链（第三轮 P1-4 补充，政企场景硬需求）**：中文 Windows Excel 另存 CSV 默认 ANSI/GBK（非 UTF-8），直读乱码。固定探测顺序：
1. BOM 判定：EF BB BF -> UTF-8、FF FE -> UTF-16LE、FE FF -> UTF-16BE（带 BOM 文件零猜测）；
2. 无 BOM -> jschardet 对首 64KB 采样检测（置信度 >= 0.7 采纳）；
3. 兜底回退链：UTF-8 严格解码尝试（失败即弃）-> GB18030（覆盖 GBK/GB2312 超集）-> Latin-1（最后保底不丢字节）；
4. 探测结果与最终编码写入 import_tasks.detail 字段（降级说明的一部分），乱码投诉可追溯。

明确不做：.xls 旧二进制格式（Spec 锁定 .xlsx/.csv）、图表/透视表/条件格式解析（遇之忽略并记入降级说明）。

验收用例（fixtures 放 `test/fixtures/import/`，以下每个文件为一项断言）：

| 用例文件 | 内容规格 | 断言 |
|---|---|---|
| `basic-types.xlsx` | A1=整数 123，B1=小数 1.5，C1=文本 "abc"，D1=TRUE，E1=日期 2026-01-31（单元格格式 yyyy-mm-dd） | IR 中 type 依次为 number/number/string/boolean/date，值全等 |
| `text-look-like-number.xlsx` | A1="0012"（文本格式） | IR type=string 且 value="0012"，**不得**被转成 12 |
| `empty-sheet.xlsx` | 1 个空 sheet | IR.sheets 长度 1，rows 空，不抛错 |
| `multi-sheet.xlsx` | 3 个 sheet，名含中文「汇总/明细/备份」 | sheet 名按序保真 |
| `oversize.csv` | 11MB csv | 拒收，import_tasks.status=failed，error=3001 语义（openapi 错误码） |
| `broken.xlsx` | 随机字节改名 .xlsx | status=failed，error 归类「格式损坏」，进程不崩（队列继续消费） |
| `gbk-csv.csv`（GBK 编码、含中文表头+数据，无 BOM） | 编码探测链走 jschardet -> GB18030 分支，IR 中文内容零乱码，detail 记录最终编码 |
| `utf8-bom-csv.csv`（UTF-8 带 BOM） | BOM 分支命中，不走采样，BOM 剥离后内容正确 |

### WI-2 IR 中间模型定义 + 类型系统

范围：IR 类型定义、序列化（IR <-> JSON）、类型转换规则表（xlsx 单元格类型 t/s/b/e/date 与 IR 类型的双向映射表，含错误值 #DIV/0! 的处理：type=error 且 value 保留原文）。
验收用例：

| 用例 | 断言 |
|---|---|
| IR -> JSON -> IR 往返 | 全量字段深度相等 |
| 映射规则表单测 | xlsx `t:'s'`/`t:'n'`/`t:'b'`/`t:'e'` 四类各一例，映射结果符合规则表 |
| 公式单元格 | SheetJS 读出 `f: "SUM(A1:A2)"` 的单元格 -> IR type=formula，formula="=SUM(A1:A2)"，**不计算值** |

### WI-3 IR -> Univer snapshot 结构映射

范围：sheet/行列/cellData 结构生成、Univer 单元格对象 `{v, t, p?}` 构造（t: 1=string/2=number/3=boolean）、行列号边界（Univer rowCount/columnCount 计算 = 最大非空行列 + 缓冲）、冻结行列映射（xlsx pane -> snapshot freeze）。

> **验收方法学约束（2026-10-21 第二轮外部评审修订）**：原验收「无头 createUnit(snapshot) 后逐格读值与 IR 全等」被判定为**构造性恒真断言**——无头初算只算脏区、载入时无脏区（探针 A1 实证：载入后 500ms 缓存值原样保留），读回的 v 就是写入的 v，映射写错多离谱都会通过，鉴别力为零。本验收改写为**带反例的突变测试**（见下表末行），并要求断言读取发生在重算去抖窗口之后（`await >= 100ms`，重算去抖 10ms，见 spike/collab-spike/src/runtime-calc-probe.mjs A2a/A2b）。

验收用例：

| 用例文件/操作 | 断言 |
|---|---|
| `basic-types.xlsx` 导入生成 snapshot | 无头 Univer `createUnit(snapshot)`，**等待 >= 100ms（重算去抖窗口后）**逐格读值与 IR 全等（AC-07「值保真」）；同步读与去抖后读**双时点一致**（防时序假象进回归集） |
| `sparse.xlsx`（A1 与 Z100 各一值） | rowCount/columnCount 正确（>=100 行 26 列），中间空行列不膨胀存储 |
| `frozen-pane.xlsx`（冻结前 2 行 1 列） | snapshot.freeze 与 xlsx pane 一致，前端渲染冻结生效 |
| 快照规模 | 10MB xlsx（约 80 万格）解析 + snapshot 生成 < 30s（后端队列时限，CI 计时断言） |
| **突变测试（反例）**：CI 中对同一 IR 注入两种故意错误——①行列映射偏移 +1（`mapCol(c)=c+1`）② t 类型映射对调（string/number 互换）——各自生成 snapshot 后走同一「去抖后读回比对」流程，**必须**检出不一致（读回值 != IR 期望值），否则本组验收判 FAIL。证明比对流程有鉴别力，杜绝恒真 |

### WI-4 样式映射（导入方向 + IR 内表达）

范围：加粗/斜体/字号/字体色/背景色/水平对齐/边框/换行/数字格式代码/列宽/行高/合并单元格。样式经 xlsx styles.xml 的 xf 索引解析为 IRStyle；颜色统一 #RRGGBB（主题色 theme 索引 + tint 的换算取 ExcelJS 同款算法）。
明确降级（记入 import_tasks.error 的降级说明，不失败）：渐变填充、条件格式图标集、富文本分段（取首段纯文本）。

验收用例：

| 用例文件 | 断言 |
|---|---|
| `style-basic.xlsx`：A1 加粗红字、B1 黄底、C1 右对齐、D1 =0.00% 格式的 0.1234 | IRStyle 四项全等；snapshot styles 索引可还原 |
| `merge-cells.xlsx`：A1:C3 合并，A1="M" | IR.merges 含 "A1:C3"；snapshot mergeData 正确；导出回 xlsx 后 Excel 打开仍显示合并 |
| `borders.xlsx`：A1 四边框、B1 仅右边框 | 边框布尔四象限正确 |
| `numfmt.xlsx`：日期列 yyyy-mm-dd、金额列 #,##0.00 | numFmt 代码字符串原样保真（AC-07「常用样式保真」） |
| 降级用例 `gradient-fill.xlsx` | 导入成功 + error 字段含「渐变填充不支持已忽略」 |

### WI-5 公式与坐标保真

范围：公式文本 A1 引用风格的存取（xlsx 内部公式为不带 = 的文本，IR/univer 统一加 =）；跨 sheet 引用（`Sheet2!A1`）保持原文本；共享公式（sharedFormula）展开为独立单元格公式文本；**白名单外公式的导入策略（v1.3，载体改判：公式档案侧车）**。

白名单外公式处理（依据 docs/formula/function-whitelist.md §3，119 名单；**2026-10-21 第二轮评审后策略从「v+f 并存冻结」改判为「公式档案侧车（方案 C）」**）：

> **改判依据（实证，非推断）**：spike/collab-spike/src/runtime-calc-probe.mjs 14/14 断言——
> 1. ICellData 无「冻结值/不参与重算」字段（typedef.d.ts:239-281 字段全集 p/s/v/t/f/ft/fd/ref/xf/si/custom；唯一逃生口 custom 官方注释「not recommended for external use」）——「冻结值」在数据模型里没有载体；
> 2. 载入时缓存值确实保留（初算只算脏区，A1 断言），**但任何使依赖变脏的编辑都会把缓存值冲掉**：B1 SUM 缓存 3 被覆盖为 7、白名单外 OFFSET 缓存 0.087 被覆盖为 2（A2b/A5 断言）——「不参与重算」承诺不成立；
> 3. 引擎未实现的函数重算后 v 变 `#NAME?`、缓存值丢失，且**级联传播**：引用它的空白名单公式 `=A5*2` 也变 `#NAME?`（A6/A7 断言）——UI 只处理「正常冻结」而无级联错误路径的缺口被证实；
> 4. Univer 引擎眼里只要看得见 f，就存在重算覆盖与级联 `#NAME?` 两条破坏路径——结论：**让引擎看不见公式**。

**方案 C（公式档案侧车）锁定规则（v1.4：九条生命周期规则——原五条 + 补存 v/结构迁移/双通道顺序/值校验四条硬规则，另含 UI 口径与降级统计两项既有条款）**：

1. **导入时剥 f 只留 v**：白名单外公式格进入 Univer snapshot 的形态为纯值格 `{v: 缓存值, t}`，**不含 f 字段**——引擎依赖图里没有该公式节点，无从重算、无从 `#NAME?`、无从级联；引用它的白名单公式（`=C1*2`）把 C1 当普通值正常计算。**级联错误在 C 下结构性不存在**（本条为 C 对 A/B 的决胜论据）。**例外（v1.5，规则 12 差分通过格）**：引擎可用区差分一致的格保留 f 参与计算——引擎依赖图有该节点但函数已实现且确定性，无 #NAME? 路径（whitelist.md §3.2 等价性论证）。**白名单内 volatile 函数的导入例外（v1.5，whitelist.md §1.2 补遗）**：NOW/TODAY/RAND/RANDBETWEEN 虽在 119 名单内，但导入路径不走「f 照常进 snapshot」——按 §1.2 静态化处理：v 取 xlsx 缓存值、f 剥除进档案（来源 import-static），防双端加载时刻不同导致 v 发散；
2. **原始公式文本存公式档案**（formula archive）：Univer 之外的映射结构 `{sheetId, row, col, f 原文, v 导入时值, 来源: import}`，**随 snapshot 生命周期一体持久化**——载体为 snapshot 的 `resources` 字段（IResources 数组，插件级侧车，@univerjs/core 官方快照结构，非 custom 字段），resource name 固定 `SHEET_FORMULA_ARCHIVE_PLUGIN`。**不做新表、不加列**（变更分类：小改，见 Spec §13 变更记录）；
3. **档案条目失效规则（防导出旧公式覆盖新值）**：用户编辑已剥 f 的格子（SetRangeValuesCommand 命中档案条目所在格）时，应用层拦截器**删除对应档案条目**——用户输入的新内容（值或白名单内公式）成为该格唯一事实；档案只保留「自导入起未被人工触碰」的条目。白名单内的新公式照常进 Univer 数据层参与重算；
4. **协同链路广播**：档案条目的增删经既有内容通道同步——Y.Map 键 `formula-archive:{sheetId}:{row}:{col}`，值 `{f, v}` 或删除；snapshot 物化时档案随 `resources` 一体写入（与 base_seq 同事务，复用既有物化协议，无新协议帧）；
5. **导出还原 f 的时机与口径**：导出层（WI-6）从「snapshot cellData + 公式档案」合并视图构造 IR——档案条目命中的格子 `type=formula, formula=f 原文, value=当前 v`；AC-08 断言口径不变：导出件 Excel 打开该格仍是公式、且其缓存的计算结果与快照 v 一致（Excel 打开后重算由 Excel 自己做）；
6. **补存 v（v1.4 P0 补丁）**：档案条目值结构补 `{v: 导入时缓存值}`（resources 与 Y.Map 两侧一致）——这是结构操作错位检测的比对基准，也是「迁移缺失时不写错格」的唯一判据；
7. **结构操作同步迁移档案键（v1.4 P0 补丁，主防线）**：六类结构操作——插行/删行/插列/删列/排序/移动剪切粘贴——在应用层迁移器内同步变换档案键坐标（与 Univer cellMatrix 同构的确定性变换：`r >= startRow` 则 `r + n`；`startRow <= r <= endRow` 则丢弃；move-range 按 from->to 映射）。**主次裁定：迁移为主、校验为辅**——理由：迁移保住「公式原文随格走」的正常体验（六类结构操作是 Spec §2 P0「表格编辑核心」的内置能力，对含档案文件禁用或丢弃是伤害主路径）；校验只是迁移失效时的最后闸门（丢一条公式文本可审计，写错格不可审计）。挂载点：`commandService.onCommandExecuted` 拦截结构 MUTATION（`sheet.mutation.insert-row / remove-row(s) / insert-col / remove-col(s) / move-range`，spike 已有该基建），迁移在 Y.Doc 单事务内完成（一次结构 op = 恰好一个 update 帧，archive-migration-probe M3 实证）；undo/redo 由 undo 拦截点做**反向变换**（undo 触发 `remove-rows` 复数 mutation，同样被拦截器捕获自动迁移，M4 实证）；
8. **双通道生效顺序（v1.4 定死）**：本地发起的结构 op——先 Univer cellData（mutation handler）后档案迁移（onCommandExecuted 回调），两者在同一命令执行栈内先后完成，Y.Map 档案更新在单事务内 emit；远端回放——结构 op 经 oplog 定序回放时，回放器在 `syncExecuteCommand(结构 mutation)` 返回后**立即**以 `{onlyLocal:true, fromCollab:true}` 语义应用同源档案迁移（迁移器对 `onlyLocal && fromCollab` 不再二次迁移，防多重应用——M4 探针曾因三重应用失败，实证该抑制必要）；物化——resources 侧车从权威 Y.Map 档案整表重写（物化点单读 Y.Map，不读增量），顺序天然无歧义；
9. **导出还原前置值校验（v1.4 P0 补丁，兜底闸门）**：WI-6 合并视图还原 f 前，对每条档案条目校验「目标格当前 v === 档案 v」——相等才还原 f；不等（迁移缺失/未知路径错位）则**丢弃该条目 + 降级说明记录「N 条公式因结构变更无法定位原格已不导出」**（import_tasks 口径）。设计容忍性：值碰撞（用户恰好在错位格输入了同值）在 0.087 类浮点/文本混合场景概率可忽略，且即便碰撞，写回的是「值相同公式」——不产生数据破坏，只损失可审计性，风险等级从「静默写错格」降为「可忽略的边角」。
10. **UI 口径（v1.5 更新文案与触发范围）**：文件级一次性提示条——触发范围 = 桶 II/桶 III 冻结格 + 差分降级格合计数 N（差分通过格与白名单公式同权，无角标不计入）；文案（PM 定稿）：「本文件含 N 个暂不支持自动重算的公式，其值已按导入时结果保留；点击单元格右上角标记可查看原公式，导出时公式将完整还原」；档案命中格右上角 AlertCircle 标记（lucide，12px，琥珀色，点击显示档案中的原公式）+ 选中时公式栏灰态只读展示档案 f；因引擎已看不见 f，用户编辑该格走普通值/白名单校验路径，**不存在「改了缓存值但公式还在偷偷重算」的状态**；
11. 降级统计（数量+函数名列表）写 import_tasks（v1.4 起含校验丢弃条目追加计数；v1.5 起含差分降级原因码）。
12. **引擎可用区差分导入（v1.5，PM 方案 b）**：白名单外但属引擎可用区（E = I − W − X，393 个，定义见 whitelist.md §3.1，CI 机器生成）的公式格走**差分路径**——导入时无头重算 f 与依赖值，比对 xlsx 缓存值（数值 1e-10 相对容差、文本/布尔严格相等、错误值按错误码）：一致 -> f 保留进 snapshot 参与计算（与白名单公式同权：无角标、不计入提示条 N、后续编辑/协同/结构操作走既有引擎路径——f 在引擎内引用随结构 op 自动变换，不产生档案错位问题）；不一致 -> **自动降级方案 C**（剥 f 只留缓存值 + 档案条目 + 角标 + 计入 N + import_tasks 记「差分不一致」原因码）。工程细则（判定顺序/多函数格级判定/重算时序须等完成信号或 >= 100ms/差分格数 <= 10000 上限超限走冻结）见 whitelist.md §3.3。**注意**：差分降级格与桶 II/III 冻结格进入同一档案体系——错位防线（规则 7/8/9 的迁移与值校验）对两者一体生效，无新增失效面。

白名单内公式（119 名单）不受此约束：f 照常进 snapshot 参与引擎重算（这是产品主路径）。

验收用例：

| 用例 | 断言 |
|---|---|
| `formulas.xlsx`：A1=1，A2=2，B1="=SUM(A1:A2)"，C1="=Sheet2!A1*2" | IR formula 文本逐字相等（含 = 前缀与跨 sheet 引用）；snapshot 内白名单公式格 f 保留 |
| 共享公式行（10 行同一 =A 列公式） | 10 个单元格公式文本独立展开，非引用首行 |
| `whitelist-foreign.xlsx`：含 =OFFSET(A1,1,0)（名单外，引擎已实现）与缓存值 2 | snapshot 该格**只有 v=2 无 f**；公式档案含该条目；编辑 A1 后该格**仍为 2**（引擎无此公式，不被重算波及）；导出后 Excel 打开该格是公式 `=OFFSET(A1,1,0)`（AC-08 公式文本不丢失）；Excel 重算得新值与产品内「删除档案重新导入才更新」的口径写入用户提示文案 |
| `whitelist-foreign-cascade.xlsx`：E5=引擎未实现函数+缓存 42，F5="=E5*2"，G5='=IFERROR(E5,"err")' | 导入后三格均为纯值（42 / 84 / "ok"）+ 两条档案（E5、F5、G5 视 PM 口径，至少 E5）；编辑任何格子**不会**使 F5/G5 变 #NAME?（C 方案级联结构性不存在的正向断言）；对照探针 A6/A7（不剥 f 时 F5 必变 #NAME?）作为反例写入测试注释 |
| 档案失效：用户编辑已剥 f 格（输入新值） | 档案条目删除（导出不再还原旧 f）；Yjs 对端档案同步删除；再次导出该格为纯值 |
| 导入 -> 导出往返 | Excel 打开导出件，B1 显示公式且计算结果为 3（AC-08） |

**结构操作族用例（v1.4 P0 补丁，与 whitelist-foreign-cascade 共用 fixture：E5 剥 f 格 + 档案条目）**——迁移主防线 + 校验兜底的双层断言：

| 用例（操作序列） | 断言 |
|---|---|
| **陷阱用例：E5 上方插一行后不撤销、立即导出** | 档案键已迁移到 E6（与缓存值同格）；导出件 E6 是公式、E5 是别人的值——**严禁**出现「E5 被写上公式」的静默错位（archive-shift-probe 反例为对照写入测试注释：不迁移时档案键停在 E5） |
| 插行后撤销（undo）再导出 | undo 触发 remove-rows 反向迁移，档案键回到 E5；导出件 E5 是公式（评审人指出「碰巧对齐」陷阱：断言依据是档案键与 cellData 同步回退，不是坐标数值碰巧相等——用例须同时断言迁移器捕获了 remove-rows mutation） |
| 删行错位：删除 E5 上方一行后导出 | 档案键上移到 E4；导出件 E4 是公式；被删行若含档案条目则该条目丢弃（transformRemoveRow 丢弃语义）+ 降级说明计数 +1 |
| 排序（sort range 含 E5）后导出 | 档案条目按排序映射迁移或（无法确定映射时）走值校验丢弃路径——断言二选一命中且导出件**无错位**；此用例同时验证值校验兜底在「迁移器不认识的 op」上的行为 |
| 剪切粘贴/移动（move-range from 含 E5）后导出 | 档案键按 from->to 映射迁移；导出件目标格是公式、原格无残留公式 |
| **值校验兜底反例**：模拟迁移器失效（测试钩子关闭迁移器）后插行再导出 | 导出拒绝还原 f（目标格 v !== 档案 v），该格导出纯值 + import_tasks 降级说明含「1 条公式因结构变更无法定位」——断言**不写错格**优先于文本保真 |

**差分导入用例（v1.5，PM 方案 b；fixture 新增 `usable-zone-diff.xlsx`：AGGREGATE 格 x2 + 桶 III 对照格）**：

| 用例 | 断言 |
|---|---|
| `usable-zone-diff.xlsx`：B2="=AGGREGATE(1,6,B10:B19)" 缓存值正确 | 差分通过：snapshot 该格 {v: 缓存值, f}——f 保留参与计算；**无角标、不计入提示条 N**；编辑 B10 后该格正常重算（引擎路径）；导出后该格是公式（AC-08） |
| 同文件 B3="=AGGREGATE(1,6,B10:B19)" 缓存值被篡改（与重算值不一致） | 差分降级：该格纯值（v=篡改后缓存值）+ 角标 + 档案条目 + 计入 N + import_tasks 含「差分不一致」原因码；提示条 N=冻结格+降级格合计 |
| 桶 III 对照：C2="=OFFSET(A1,1,0)" + 缓存值 | 恒走冻结（不入差分域）：纯值 + 角标 + 档案；编辑 A1 后 C2 不变 |
| volatile 导入：D2="=NOW()" + xlsx 缓存时刻 | 导入静态化：v=缓存时刻、f 进档案（来源 import-static）、无角标；双端加载后该格值一致（whitelist §1.2 v1.5） |
| 差分超限：构造 10001 个 AGGREGATE 格 | 第 10001 格起直接走冻结路径 + import_tasks 记「差分校验超限」——队列不雪崩，任务时限内完成 |

### WI-6 导出层：snapshot -> IR -> xlsx/csv 流

范围：snapshot 反向转 IR（同一模型的逆映射）；ExcelJS 写 xlsx（样式/合并/列宽/冻结/数字格式）；csv 用 PapaParse（仅值与公式文本，= 前缀保留，无样式——csv 格式本身无样式，需在文件名或提示中说明）；响应为文件流（openapi /export）。
验收用例：

| 用例 | 断言 |
|---|---|
| 导入 `style-basic.xlsx` -> 立即导出 -> SheetJS 重读 | IR 深度相等（round-trip 断言，AC-07/AC-08 核心验收） |
| 导出文件用真实 Excel（或 LibreOffice 校验引擎）打开 | 无修复提示弹窗，合并/冻结/样式可见（AC-08「Excel 可正常打开」） |
| csv 导出：number/string/formula 混合 | 字段含逗号/引号/换行正确转义；公式保持 "=..." 文本 |
| 中文本例 | UTF-8 BOM（保证 Windows Excel 中文不乱码） |

## 3. 依赖关系与排期建议

```
WI-2 (IR 定义) ──> WI-1 (导入解析) ──> WI-3 (结构映射) ──> WI-6 (导出)
                        └────────────> WI-4 (样式) ──────┘
                                     └> WI-5 (公式) ─────┘
```

- WI-2 先行（0.5d 纯类型定义）；WI-1/WI-4/WI-5 可并行；WI-3 依赖 WI-1；WI-6 收口。
- 前置门禁：spike/formula-runtime-spike（运行时双向 spike，见其 TASK.md）PASS 后 WI-3/WI-5 方可开工。
- 总量预估：WI-1 2.5d（v1.5 +0.5：桶判定器）、WI-2 1d、WI-3 2d（含突变测试）、WI-4 3d、WI-5 5d（v1.4 结构迁移器六类 op + undo/redo 反向；v1.5 +2：差分管线——无头重算比对/容差判定/降级路径/超限保护）、WI-6 2.5d（含档案还原合并视图+值校验门禁），合计约 **16 人日**（单人）+ 前置 spike 1.5 人日。QA 增量（v1.5）：差分导入用例族 1.5 人日 + 引擎可用区抽样冒烟（生成式脚本，oracle=fixture 缓存值，进 CI）1 人日——工程口径合计开发增量约 4.5 人日（PM 预估开发 3-4 + QA 6-7，QA 侧含真实模板差分 L3 与降级反例 L4 的全量回归轮，架构师核对无异议，见回传）。
- fixtures 测试资产在 WI-1 时一次性建全（约 16 个样例文件，新增 `whitelist-foreign-cascade.xlsx` 与 `usable-zone-diff.xlsx`），后续每项复用；v1.4 结构操作族用例复用 cascade fixture（同一剥 f 格跑六类 op），不新增文件。

## 4. 已知坑（内嵌，实现时规避）

| 坑 | 来源 | 规避 |
|---|---|---|
| SheetJS npm 版冻结 0.18.5 含 CVE | Spec 第 11 章 | 依赖声明用 tarball URL（`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`），交付前入 verdaccio；CI 加「xlsx 版本不得为 0.18.5」断言 |
| ExcelJS 4.4.0 停止维护 | 架构选型风险 3 | 全部调用集中在 WI-6 一个模块内，接口薄封装 |
| 文本格式的数字被强转 | 常见 | WI-1 用 SheetJS `raw: true` + cellText 判定，禁止 valueOf 隐式转换（用例 `text-look-like-number` 防回归） |
| 日期时区偏移 | SheetJS 默认 UTC | IR 统一存 ISO 日期字符串 + 显式 numFmt，禁用本地时区 Date 构造 |
| 大文件内存峰值 | 10MB xlsx 解压后数倍 | SheetJS dense 模式 + 逐 sheet 流转 IR；队列单任务内存上限 512MB，超限 fail-fast |
| csv 无样式语义 | 格式本身 | 导出 csv 仅保值与公式文本，产品文案明确「样式仅 xlsx 保留」 |
| **无头重算为 10ms 去抖异步**（探针 A2a/A2b） | univer 1.0.2 实证（engine-formula CALCULATION_DEBOUNCE_TIME=10，_scheduleFlush 经 setTimeout） | 任何「执行后读值」的测试断言必须 `await >= 100ms` 或显式等待重算完成信号；同步读回是时序假象（评审人事实 2 的成因） |
| **v+f 并存格在依赖变脏后缓存值被重算覆盖**（探针 A2b/A5：0.087 被覆盖为 2） | univer 1.0.2 实证 | 白名单外公式一律剥 f 进档案（WI-5 方案 C），不留 v+f 并存形态 |
| **引擎未实现函数重算后 #NAME? 且级联**（探针 A6/A7：=A5*2 也变 #NAME?） | univer 1.0.2 实证 | 同上——引擎看不见 f 即无此路径；IFERROR 可捕获（A8）但不应依赖用户自救 |
| **档案坐标键不随结构操作迁移（错位比丢失更糟）**：插行后缓存值下移、档案键原地不动，导出时 f 静默写到别人格子——不报错、不进降级说明、AC-07/AC-08 双破 | 第三轮评审 archive-shift-probe 实证（InsertRowCommand 已 await，非时序假象） | v1.4 P0 补丁双防线：结构 op 同步迁移档案键（主，onCommandExecuted 拦截 + Y.Doc 单事务）+ 导出还原前值校验（兜底，v 不等即丢弃+降级说明）；见 WI-5 规则 7/9 |
| **undo 触发的 mutation 是 remove-rows（复数）而非 remove-row**：迁移器若只盯单数形态 id，undo 路径漏迁移 | archive-migration-probe M4 实机观察（univer 1.0.2） | 结构 mutation id 白名单同时收录 insert-row/remove-row/remove-rows/insert-col/remove-col(s)/move-range 两形态；回归用例「插入后 undo 再导出」必测 |
| **无头环境执行 univer.command.undo 前必须 focusUnit**：不聚焦则 undo 恒返回 false（不抛错，静默失败） | archive-migration-probe 调试实证（最小复现：focusUnit 前后 undo false/true） | 后端无头校验链路（含未来「导入后无头往返断言」）执行 undo 前先 `instanceService.focusUnit(unitId)`；服务端回放路径同理 |

## 5. 不做什么（Out-of-Scope，与 Spec 第 3 章对齐）

- .xls/.xlsm(含宏)/.ods 旧格式导入；
- 图表/透视表/条件格式/数据验证的导入导出（v2.0）；
- 导入时公式白名单校验与批量重算（公式合法性由前端 Univer 编辑时校验）；
- 打印排版相关（页面设置/页眉页脚）保真。
