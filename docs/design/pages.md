# web-office 页面设计提示词（Phase 2）

> 设计师：颜好看 | 版本 1.0.0 | 基于：Spec §7 页面清单 + DESIGN.md + design-tokens.css
> 交付对象：前端实现。所有尺寸/颜色必须引用 Token，禁止裸 hex、禁止 emoji 图标（图标一律 lucide-react 图标名）。
> 通用约定：
> - 图标尺寸：工具栏/行内 16px，按钮内 20px，空态/向导独立图标 24px
> - 所有 hover/选中过渡 `var(--motion-fast)` + `var(--ease-standard)`
> - 所有可点击元素必须有 `:focus-visible { box-shadow: var(--focus-ring) }`
> - 每个列表/表单/网格必须有 Loading / Empty / Error / Populated / Edge 五态

---

## 页面 1：`/login` 登录页

### 1.1 布局结构

```
┌─────────────────────────────────────────────────────────┐
│                 页面底 --color-bg (#F9FAFB)              │
│                                                          │
│              ┌────────────────────────┐                  │
│              │  品牌区（居中，宽 400）  │                  │
│              ├────────────────────────┤                  │
│              │  表单卡（400px）        │                  │
│              │  · 用户名              │                  │
│              │  · 密码                │                  │
│              │  · 记住本机（可选）     │                  │
│              │  · [登录] Primary 满宽  │                  │
│              │  ── 或 ──              │                  │
│              │  · SSO 三个入口        │                  │
│              └────────────────────────┘                  │
│                                                          │
│              页脚（12px --color-meta，居中）              │
└─────────────────────────────────────────────────────────┘
```

- 页面：`min-height: 100vh` · `background: var(--color-bg)` · 内容垂直居中（顶部偏移 `padding-top: 80px`，**不**做垂直居中的 Hero 式排布）
- 品牌区：`Table` 图标 24px（`--color-accent`）+ 产品名「web-office 电子表格」14px/590，间距 8px；下方 12px `--color-muted` 副文案「信创私有化部署 · 数据不出内网」
- 表单卡：宽 400px · `--color-surface` 底 · 1px `--color-border` · `radius: var(--radius-lg)` · `padding: var(--space-6)` · `--shadow-xs`
- 页脚：`position: fixed; bottom: 24px` · 12px `--color-meta` · 行间距 4px

### 1.2 表单细节

| 字段 | 规范 |
|------|------|
| 用户名 | Label「用户名 / 工号」12px `--color-muted`；Input 32px；placeholder「请输入统一身份认证账号」；左侧可加 16px `User` 图标（图标与文字间距 8px） |
| 密码 | Label「密码」；Input type=password；右侧 16px `Eye` / `EyeOff` 切换按钮；CapsLock 开启时下方 12px `--color-warn` 提示「大写锁定已开启」 |
| 登录按钮 | Primary 变体，**满宽** `width: 100%`，`height: 32px`（登录页唯一 Primary，占用本屏强调色配额 1） |

按钮文案：**「登录」**（禁止 "Sign in today" / "Get Started" 之类）。

### 1.3 SSO 入口

分隔线：1px `--color-border-soft`，中间 12px `--color-meta` 文字「或使用统一身份认证」。

三个 Secondary 变体按钮，**纵向堆叠**间距 8px，满宽，左对齐：

| 顺序 | 图标 | 文案 |
|------|------|------|
| 1 | `Network`（LDAP 目录） | 使用 LDAP 目录账号登录 |
| 2 | `KeyRound` | 使用 OAuth2 统一认证登录 |
| 3 | `ShieldCheck` | 使用 CAS 单点登录 |

- 未配置的协议：按钮 Disabled（`--btn-disabled-bg`）+ 右侧 12px `--color-meta` 「未配置」（管理后台启用后自动恢复可用）
- 点击后跳转 `/api/v1/sso/{type}/callback` 流程；跳转期间按钮进入 Loading（`Loader2` 旋转）并禁用其余入口（防重复提交）

### 1.4 交互态与错误提示

| 场景 | 表现 | 位置 |
|------|------|------|
| 必填校验 | 字段边框 `--input-error-border` + 字段下方 12px `--color-danger`「请输入用户名」 | 贴近字段 |
| 凭证错误 | 字段不清空，表单顶部 14px `--color-danger` + 16px `XCircle`：「用户名或密码不正确」；**不清空密码框**，保留用户名 | 表单顶部（认证类错误例外） |
| 连续失败计数 | 第 3 次失败起在错误文案后追加：「连续失败 3 次，累计 5 次将锁定账号 15 分钟」 | 同上 |
| 账号锁定（AC-02） | 整个表单禁用，表单卡顶部插入 `--color-danger-bg` 底提示条（1px 下边框 `--color-danger`，**非左边框**）：`Lock` 图标 16px + 13px `--color-red-700`「账号已锁定，剩余 14:32」倒计时每秒刷新（`role="timer"`）；倒计时归零后表单恢复 | 表单顶部 |
| 网络不可达 | `--color-danger` 文案「无法连接认证服务，请检查内网网络」+ Ghost 按钮「重试」 | 表单顶部 |
| 提交中 | 登录按钮 Loading，其余输入框 `readOnly` | — |
| 已登录访问 | 直接重定向 `/files`，不渲染本页 | — |

### 1.5 页脚（政企部署语境）

```
web-office v1.0.0（构建 20261021） · 适配银河麒麟 V10 / 统信 UOS · amd64 / arm64
本系统运行于政务内网，运行时无外网依赖；所有操作留痕，可审计追溯
```

字体 12px `--color-meta`；两行，行距 4px。第二行前可加 12px `ShieldCheck` 图标（图标色同 meta）。

### 1.6 无障碍要点

- 表单用 `<form>` + 回车提交；label 与 input 通过 `htmlFor/id` 绑定
- 错误提示 `role="alert"`；锁定倒计时 `aria-live="polite"` 但**每秒不朗读**（仅 `role="timer"`，避免刷屏）
- 密码框 autocomplete=`current-password`

---

## 页面 2：`/files` 文档列表页

### 2.1 布局结构

```
┌──────────────────────────────────────────────────────────┐
│ 顶栏 56px：品牌 | 搜索框(320px) | 用户菜单                │
├──────────────────────────────────────────────────────────┤
│ 内容区 max-width 1200px，居中，padding 24px               │
│  操作行 32px：[新建 ▾] [导入]        右侧：排序下拉       │
│  ─────────────────────────────────────────────────────   │
│  表头行 40px：文件名 | 所有者 | 更新时间 | 状态 | 操作    │
│  ─────────────────────────────────────────────────────   │
│  文件行 40px × N（1px 分隔线，无卡片盒子）                │
└──────────────────────────────────────────────────────────┘
```

- **顶栏 56px**：`--color-surface` 底 + 1px 下边框 `--color-border`；左侧 `Table` 图标 20px（accent）+ 「web-office」14px/590；中间搜索框（宽 320px，32px 高，前置 16px `Search` 图标，placeholder「搜索文档名称」）；右侧：用户 Avatar 24px + 14px 显示名，点击展开下拉（个人设置 / 管理后台（仅 admin 可见）/ 退出登录）
- **操作行**：Primary 按钮「新建」（配 `Plus` 图标 16px，本屏强调色配额 1）；Primary 带下拉箭头可拆分为「新建空白表格 / 从模板新建（如可用）」；Secondary 按钮「导入」（`Upload` 图标 16px）；右侧 Ghost 下拉「排序：最近更新 / 名称 / 创建时间」
- **导入提示**：导入按钮下方或在触发的文件选择对话框内 12px `--color-meta`「支持 .xlsx / .csv，单个文件 ≤ 10MB」

### 2.2 列表表格

| 列 | 宽度 | 内容规范 |
|----|------|----------|
| 文件名 | flex-1（最小 320px） | 16px `FileSpreadsheet` 图标（`--color-muted`）+ 8px 间距 + 14px/510 文件名；超长单行截断 + Tooltip 全名 |
| 所有者 | 120px | 14px `--color-muted` |
| 更新时间 | 160px | 13px `--color-muted`，格式「2026-10-21 14:32」；<1 分钟显示「刚刚」 |
| 状态 | 100px | 见下方状态列规范 |
| 操作 | 48px | Ghost 图标按钮 `MoreHorizontal` 20px；hover 底 `--color-neutral-100` |

- 行高 40px · `border-bottom: 1px solid var(--color-border)` · hover 底 `--table-row-hover` · 点击行主体打开 `/file/:id`
- 选中行（键盘/多选时）：`--color-accent-subtle` 底（本屏强调色配额 2）

**状态列规范**：

| 状态 | 表现 |
|------|------|
| 正常（默认不显示） | 空白，避免噪音 |
| 导入解析中 | `--color-accent` 文字 12px + `Loader2` 12px 旋转 + 「解析中」；行不可点击打开 |
| 导入失败 | `--color-danger` 12px + `XCircle` 12px + 「解析失败」，点击弹出错误详情（如「文件 12.4MB 超过 10MB 上限」「不支持的文件格式：.et」）+ Ghost「重新上传」 |
| 保存失败 | `--color-warn` 12px「上次保存未完成」 |

### 2.3 行操作菜单（右键 + MoreHorizontal 共用一套）

| 项 | 图标 | 说明 |
|----|------|------|
| 打开 | `ExternalLink` | 新标签页打开 |
| 重命名 | `Pencil` | 打开重命名对话框（输入框预填原名并全选） |
| 导出为 .xlsx | `Download` | 触发 `/export?format=xlsx` |
| 导出为 .csv | `Download` | 同上 csv |
| 复制文件副本 | `Copy` | 名称自动加「副本」后缀 |
| 删除 | `Trash2` | 危险项，红色文字，点击弹出确认对话框 |

- 菜单项自上而下顺序：打开 / 重命名 / 导出为 .xlsx / 导出为 .csv / 复制文件副本 / 删除（危险项置底，上方加 1px `--color-border-soft` 分隔）
- **【P1 预留位 · 本期不实现】** 分享（`Share2`）：P1 分享权限功能上线时，插在「复制文件副本」与删除分隔线之间，点击打开分享权限面板（查看 / 编辑权限）。本期**不渲染该项**。

- 删除确认对话框：标题「删除「{文件名}」？」16px/590；正文 14px「删除后文件不再出现在列表中，操作将记入审计日志（数据保留，可追溯）。」；操作区 [取消 Secondary] [删除 Danger]
- 重命名对话框：标题「重命名」；Input label「文件名」；校验：非空、≤120 字符、禁止 `/ \ : * ? " < > |`；重名不阻断（允许同名）但 Toast 提示「已存在同名文档」

### 2.4 示例数据（政企语境，用于前端 mock / 空态引导）

| 文件名 | 所有者 | 更新时间 | 备注 |
|--------|--------|----------|------|
| 2026年度预算汇总表.xlsx | 张建国 | 2026-10-21 14:32 | |
| 部门快报-第十期.xlsx | 李慧敏 | 2026-10-20 09:07 | |
| 固定资产台账（信息中心）.xlsx | 王振宇 | 2026-10-18 16:45 | |
| 专项经费执行进度表.xlsx | 陈丽 | 2026-10-17 11:20 | |
| 人员编制统计表.csv | 赵鹏 | 2026-10-15 08:52 | |
| 会议纪要登记簿.xlsx | 周雅 | 2026-10-11 17:30 | |

导入任务行示例（状态列=解析中）：`2026年第三季度决算表.xlsx`（上传者：张建国，已用 4s）

### 2.5 五态

| 状态 | 表现 |
|------|------|
| Loading | 6 行骨架：每行 40px，左侧 16×16 灰块 + 220px 灰条 + 右侧 120px 灰条，底色 `--color-neutral-100`，1.5s 微光扫过；reduced-motion 下静态 |
| Empty（无文件） | 内容区垂直居中偏上：`FileSpreadsheet` 图标 24px `--color-neutral-300` + 14px「还没有文档」+ 13px `--color-muted`「新建空白表格，或导入 .xlsx / .csv（单个 ≤10MB）」+ Primary「新建表格」 |
| Empty（搜索无结果） | 13px `--color-muted`「未找到匹配「预算」的文档」+ Ghost「清除搜索」 |
| Error（列表加载失败） | `AlertTriangle` 16px `--color-danger` + 14px「文档列表加载失败」+ 13px `--color-meta` 错误码 + Secondary「重试」 |
| Edge | 文件名超长截断 + Tooltip；>100 文件时分页（20/页，底部分页器 32px 高，页码按钮 28px） |

---

## 页面 3：`/file/:id` 表格编辑器（核心页）

### 3.1 整体骨架（7 区域，尺寸硬约束）

```
┌──────────────────────────────────────────────────────────┐
│ ① 标题栏                                          44px   │
├──────────────────────────────────────────────────────────┤
│ ② 工具栏（单行，分组 1px 竖线分隔）                40px   │
├──────────────────────────────────────────────────────────┤
│ ③ 公式栏：名称框 | fx | 编辑区                     32px   │
├──────────────────────────────────────────────────────────┤
│ ④ 列头（高 24px，宽 64px/列）                            │
│ ④ 行头（宽 44px） ⑤ 网格区（Canvas，铺满剩余视口）       │
├──────────────────────────────────────────────────────────┤
│ ⑥ Sheet 标签栏                                     36px   │
├──────────────────────────────────────────────────────────┤
│ ⑦ 状态栏                                           28px   │
└──────────────────────────────────────────────────────────┘
顶部区域总高 44+40+32 = 116px（硬上限 120px，任何新增行必须挤占网格区，不得增加总高）
```

网格区高度 = `100vh - 116px - 36px - 28px` = `calc(100vh - 180px)`（状态栏可隐藏时按 `calc(100vh - 152px)`）；License 只读提示条出现时（见 3.10，挂载于应用布局根、标题栏之上）按 `calc(100vh - 212px)`。

### 3.2 ① 标题栏（44px）

- 底 `--color-surface` + 1px 下边框 `--color-border`；`padding: 0 var(--space-3)`
- **左**：
  1. Ghost 图标按钮 `ArrowLeft` 20px（返回 `/files`，`aria-label="返回文档列表"`）
  2. 文件名 14px/510 `--color-fg`，最大宽 320px 截断；hover 时右侧浮现 14px `Pencil` 图标，点击就地编辑（Inline Input，Enter 提交 / Esc 取消）
  3. 保存状态指示：4px 状态点 + 12px 文字，间距 4px
     - 已保存：`--save-saved-dot` 绿点 + 「已保存」
     - 保存中：`Loader2` 12px 旋转 + 「保存中」
     - 离线：`--save-offline-color` 琥珀点 + 「离线，待同步」（点击弹出「重试 / 导出本地副本」）
     - 失败：`--color-danger` 点 + 「保存失败」（点击弹出「重试 / 导出本地副本」）
- **右**（从右到左排列，间距 8px）：
  1. 协同头像堆叠（见 3.8）
  2. Ghost 图标按钮 `MoreHorizontal` 20px → 菜单：导出为 .xlsx / 导出为 .csv / 版本历史（P1，本期不渲染）/ 打印（本期不渲染）
  3. **【P1 预留位 · 本期不实现】** 分享按钮：P1 分享权限功能上线时，在此处（头像堆叠左侧）插入 Primary 按钮「分享」（`Share2` 16px + 文字），占用本屏强调色配额 1。本期**不渲染任何分享入口**，不留禁用态按钮、不留 Tooltip 提示——后端无 `/api/v1/files/:id/share` 支持，可见但不可用的入口属于无效视觉负担。

### 3.3 ② 工具栏（40px）

- 底 `--color-surface` + 1px 下边框 `--color-border`；`padding: 0 var(--space-2)`；按钮 28×28（`--toolbar-btn-size`），图标 16px，间距 4px
- 分组之间 1px 竖分隔线：高 16px、宽 1px、色 `--color-border`、垂直居中、两侧各 4px 间距

| 组 | 控件（Lucide 图标） |
|----|---------------------|
| 历史 | `Undo2` / `Redo2`（无历史时 Disabled，文字色 `--toolbar-btn-text-disabled`） |
| 分隔线 | — |
| 字号 | 下拉（默认 13px，选项 12/13/14/16/20），宽 64px，触发区显示当前值 |
| 字重样式 | `Bold` / `Italic` / `Underline`（Toggle 态：底 `--toolbar-btn-bg-toggled` + 图标色 `--toolbar-btn-text-toggled`） |
| 颜色 | `Baseline`（文字色，图标下方 2px 色条显示当前色）/ `PaintBucket`（填充色）|
| 分隔线 | — |
| 对齐 | `AlignLeft` / `AlignCenter` / `AlignRight` / `AlignVerticalJustifyCenter` |
| 分隔线 | — |
| 数字格式 | 下拉，宽 96px，选项：常规 / 数值 / 货币 / 百分比 / 日期 / 文本 |
| 分隔线 | — |
| 结构 | `TableCellsMerge`（合并）/ `Snowflake`（冻结） |
| 分隔线 | — |
| 公式 | `Sigma`（插入函数，点击展开函数面板：搜索框 + 50 个白名单函数列表 + 12px 说明） |
| 分隔线 | — |
| 溢出 | `MoreHorizontal`（收纳：插入行 / 插入列 / 删除行 / 删除列 / 清除格式 / 查找替换） |

- 收起态（视口 <1024px）：保留 历史 / 字号 / B I U / 对齐 / 合并 五组，其余全部进入溢出菜单
- 只读模式（License 降级）：全部按钮 Disabled，应用布局根、标题栏之上插入只读提示条（见 3.10）

### 3.4 ③ 公式栏（32px）

三段式，底 `--color-surface` + 1px 下边框 `--color-border`：

1. **名称框**：宽 84px · 等宽字体 13px · 显示当前坐标「B7」；可输入坐标（如 `B7`、`B7:D12`）回车跳转；hover 时 1px `--color-border` 边框浮出
2. **1px 竖分隔线**（高 16px）
3. **fx 按钮**：`Sigma` 图标 16px，宽 28px，点击展开函数面板；编辑中等宽高亮为 `--color-accent`
4. **编辑区**：flex-1 · 13px `--font-mono` · `padding: 0 var(--space-2)`；非编辑态显示当前单元格原值/公式；点击进入编辑态，focus 时 2px `--color-accent` 内描边（`inset`），**不加外发光**
5. **公式着色**（编辑态）：函数名 `--color-accent`（如 `SUM`）· 单元格引用 `--color-blue-600`（如 `B2:B13`）· 字符串 `--color-amber-700` · 数字默认 `--color-fg` · 运算符 `--color-muted`
6. **引用联动**：编辑含引用的公式时，网格中被引用的区域用 2px `--color-blue-600` 虚线框标记（Univer 内置 `refRange` 高亮，颜色按 Token 覆盖）

### 3.5 ④ 行列头

| 元素 | 尺寸 | 规范 |
|------|------|------|
| 列头 | 高 24px · 默认宽 64px（可拖拽 40-800px） | 底 `--grid-header-bg` · 文字 12px `--grid-header-text` · 居中 · 右侧 1px `--color-border` |
| 行头 | 宽 44px · 高 = 行高（默认 24px，可拖拽） | 同上；数字用 12px `--font-mono` |
| 左上角全选块 | 44×24 | 底 `--grid-header-bg`，边框 `--color-border`；点击全选 |

状态：
- Hover：整行/整列头底 `--grid-header-hover-bg`，且网格中对应行列无背景变化（避免干扰数据阅读）
- 选中：底 `--grid-header-selected-bg` + 文字 `--grid-header-selected-text`（本屏强调色配额 2，与单元格选中描边同属一组）
- 拖拽调宽：显示 1px `--grid-resize-guide` 参考线 + 12px Tooltip「宽度：128 像素」；拖拽期间相邻列头不变形
- 冻结：冻结线为 1px `--color-neutral-400` 实线（比网格线重一档），冻结区右侧/下方带 2px `--shadow-xs` 投影（功能性投影，允许）

### 3.6 ⑤ 网格区

- 底 `--color-surface`；网格线 1px `--grid-line`（`#E2E8F0`）
- 单元格：13px `--font-mono` · 默认左对齐（文本）/ 右对齐（数值、日期）· 内边距左右 4px · 行高默认 24px
- **本地选中态**：2px `--grid-selection-border` 描边（含内部行列头联动高亮）+ `rgba(5,150,105,0.06)` 填充；右下角 6×6 `--grid-fill-handle` 实心方块（hover 时 `cursor: crosshair`）
- **多选区**：外框 2px 主色，内部填充同上；行列头整行/整列选中时对应头底色 `--grid-header-selected-bg`
- **编辑态单元格**：2px `--color-accent` 描边 + 内部 caret；Esc 取消、Enter 提交并下移、Tab 提交并右移
- **协同光标/选区**：见 3.8
- **右键菜单**（网格区 / 行头 / 列头 / Sheet 标签 四套）：

| 触发区 | 菜单项 |
|--------|--------|
| 单元格 | 剪切(`Scissors`) / 复制(`Copy`) / 粘贴(`ClipboardPaste`) / 仅粘贴值 — 分隔 — 插入行 / 插入列 / 删除行 / 删除列 — 分隔 — 清除内容 / 清除格式 — 分隔 — 数字格式 ▸ / 冻结至此行 ▸ |
| 行头 | 插入行（上方/下方）/ 删除行 / 行高（输入像素）/ 隐藏行 / 取消隐藏 |
| 列头 | 插入列（左/右）/ 删除列 / 列宽（输入像素）/ 隐藏列 / 取消隐藏 — 分隔 — 升序排序 / 降序排序 / 筛选（P1） |
| Sheet 标签 | 重命名(`Pencil`) / 复制(`Copy`) / 删除(`Trash2`) / 移动或复制 ▸ / 标签颜色 ▸（8 色，取自 `--grid-line` 外的中性/低饱和色板） |

- **禁用**：网格区禁止套卡片容器、禁止区块阴影、禁止单元格内 emoji

### 3.7 ⑥ Sheet 标签栏（36px）

- 固定在网格区下方：底 `--color-surface` + 1px 上边框 `--color-border`；`padding: 0 var(--space-2)`
- 左侧：`Plus` 图标按钮 24px（新建 Sheet，恒在标签末尾之外，位于标签序列最左或最右均可，**位置固定不随滚动移动**——取最左，符合国内习惯）
- 标签：高 36px · `padding: 0 12px` · 13px `--sheet-tab-text`；hover `--sheet-tab-hover-bg`；激活态 `--sheet-tab-active-bg` 底 + `--sheet-tab-active-text` 文字 + 底部 2px `--sheet-tab-active-underline` 下划线
- 标签名示例：「汇总」「一季度」「二季度」「明细-人员经费」
- 标签过多时：左右 `ChevronLeft` / `ChevronRight` 图标按钮（24px）滚动；`tabindex` 保证键盘可达
- 拖拽排序：拖拽中显示 2px `--color-accent` 插入指示线

### 3.8 协同可视化（AC-06）

| 元素 | 规范 |
|------|------|
| 光标 | 2px 竖线，高 = 行高（24px），色 = `--color-collab-N`；顶部名字标签 12px 白字 + 光标色底 + `radius: var(--radius-sm)` + `padding: 1px 4px` |
| 名字标签显隐 | 在线 ≤4 人：全部显示名字；≥5 人：**隐藏全部名字标签，仅保留彩色光标**，hover 光标时 Tooltip 显示该用户姓名 |
| 选区 | 2px 同色边框 + 该色 10% 透明填充（`--collab-selection-fill-opacity`）；不渲染填充柄 |
| 本地优先 | 本地选中永远绘制在最上层，用 `--color-accent`，不与协作者色混用 |
| 头像堆叠 | 标题栏右侧，24px 圆形，重叠 `-6px`，外圈 2px `--color-surface`；当前用户排最右（底 `--color-accent-subtle` + `--color-accent` 文字） |
| 头像折叠 | ≤4 人全展示；≥5 人展示前 3 + 「+N」圆标（24px，`--color-neutral-200` 底，12px/510 `--color-fg-2`）；点击展开 200px 浮层列出全部在线者（14px 姓名 + 12px `--color-meta` 账号 + 8px 该用户光标色点） |
| 掉线 | 3 秒无心跳 → 头像 40% 透明 + 右下 8px `--color-neutral-400` 点，其光标/选区移除（不留幽灵） |
| 动效上限 | 仅两处：光标位移 `transform 120ms linear`；名字标签首次出现 150ms 淡入。禁止脉冲/弹跳/光晕 |

### 3.9 ⑦ 状态栏（28px）

- 底 `--color-surface` + 1px 上边框 `--color-border`；`padding: 0 var(--space-3)`；12px
- **左**：`Sheet3 个数据表` 13px `--color-muted` + 缩放控件（`-` 图标按钮 24px / 百分比下拉（50/75/100/125/150，默认 100%）/ `+` 图标按钮 24px）
- **右**：选中区域快速统计，12px `--font-mono`，项间 12px 间距，格式：
  `求和：¥1,284,600.00` · `平均值：¥107,050.00` · `计数：12`
  - 仅在不小于 2 个数值单元格时显示；无选中时显示 `就绪`
  - 重算 >500ms 时显示 `Loader2` 12px（避免闪烁）
  - 货币格式跟随单元格数字格式

### 3.10 License 到期 / 只读提示条

- 位置：**挂在应用布局根、标题栏（①）之上**（条件渲染，高度 32px）——不属于 116px 标题栏栈，Spec §8 的「工具栏总高 ≤120px」按常驻态断言，banner 为临时状态条不吃预算。完整层级从上到下：`[banner 32 条件渲染] → [标题栏 44 / 工具栏 40 / 公式栏 32] → [公式提示条 32 条件渲染，见 3.10bis] → [网格区] → [Sheet 栏 36] → [状态栏 28]`
- 出现时网格区高度从 `calc(100vh - 180px)` 收缩为 `calc(100vh - 212px)`，Sheet 栏/状态栏位置不变；公式提示条同时出现时见 3.10bis 叠加规则
- 样式：`--readonly-banner-bg` 底 + **1px 下边框** `--readonly-banner-border`（**禁止彩色左边框**）+ 文字 13px `--readonly-banner-text`
- 内容：`AlertTriangle` 16px + 文案 + 右侧操作
  - 未激活：「当前未安装 License，文档为只读模式」+ Ghost 文字按钮「前往管理后台激活」
  - 已过期：「License 已于 2026-09-30 到期，文档为只读模式」+ Ghost「前往管理后台更新」
  - 即将到期（≤30 天）：「License 将在 12 天后到期（2026-11-02），请及时续期」+ `X` 14px 可关闭（会话内记住）
  - 超席：「已用席位 52 / 50，超出授权席位数，新增用户为只读」+ Ghost「前往管理后台」
- 只读态下的联动：工具栏全部 Disabled、公式栏 `readOnly`、单元格点击不进编辑态（光标 `default`）、首次点击弹出 Toast「当前为只读模式」、`MoreHorizontal` 中「导出」仍可用（导出不受只读影响）
- **防线层级说明**（设计侧只负责第三层）：①命令层守卫（`beforeCommandExecuted` 拦截 License 无效时的非远端 MUTATION）→ ②服务端（写操作 402 / WS close 4409）→ ③本条 UI 视觉反馈。前端不得只实现 UI 层——详见 `docs/frontend/theme-font-collab-integration.md` 第 4 节

### 3.10bis 白名单外函数提示条与缓存值角标

> 背景：公式白名单扩为场景集 119 个后，导入的白名单外公式不再静默转文本，改为「保留公式文本 + 显示导入时缓存的计算值」。
> **技术标注（2026-10-21 PM 桶 I 裁决方案 b + team-lead 收尾裁定，v1.5——版式不动，仅口径与文案更新）**：白名单外公式导入分域处理——引擎可用区（393 个）走差分校验，**通过差分的格子保留公式参与计算、无角标、不计入提示条 N（与白名单公式同权）**；只有桶 II（引擎未实现）/桶 III（volatile 与动态引用排除集）/差分不一致降级格进入「无法自动重算」冻结形态。本节以下角标与提示条规范**语义范围随之收窄**为该冻结格集合。

**A. 文件级提示条（一次性）**

- 位置：**公式栏（③）之下、网格区（⑤）之上**（条件渲染，高度 32px）——与只读 banner（3.10，标题栏之上）分层挂载、互不嵌套，两条同时出现时视觉顺序为：`[只读 banner] → [标题栏/工具栏/公式栏 116px] → [公式提示条] → [网格区]`。选择该挂载点的理由：此提示条描述的是**网格内容**状态，语义上应贴近网格区；只读 banner 描述的是**整个文档**权限状态，故挂在更高层。两条件均出现时网格区高度 = `calc(100vh - 244px)`（180 + 32 + 32），单条出现时 = `calc(100vh - 212px)`
- 出现条件：打开的文件含 ≥1 处**无法自动重算的公式格**（= 桶 II 冻结格 ∪ 桶 III 冻结格 ∪ 差分不一致降级格；v1.5 起差分通过格与白名单公式不计入）时自动出现一次；点击关闭后同文件会话内不再出现（关闭状态存内存，刷新页面后若文件仍含此类格子则重新出现一次——不做 localStorage 持久化，避免文件更新后用户永远看不到提示）
- 样式：`--color-info-bg` 底（info 蓝系浅底，区别于只读 banner 的 warn 琥珀系——两色系区分让用户一眼分辨「权限问题」与「内容兼容性问题」）+ 1px 下边框 `--color-info`（禁止彩色左边框）+ 文字 13px `--color-fg-2`
- 内容：`Info` 图标 16px（`--color-info`）+ 文案（**v1.5 PM 定稿原文替换**）「本文件含 N 个暂不支持自动重算的公式，其值已按导入时结果保留；点击单元格右上角标记可查看原公式，导出时公式将完整还原」+ 右侧 `X` 14px Ghost 关闭按钮（`aria-label="关闭提示"`）
- N 为真实统计值（导入解析层产出 = 冻结格 + 差分降级格合计），禁止写死示例值；N=0 时不渲染整条
- `role="status"` + `aria-live="polite"`（进入页面时屏幕阅读器播报一次）
- **导入报告新增条目（v1.5 PM 口径，落 import_tasks.detail，列表页 2.2 状态列「导入解析中→正常」转态后可在任务详情查看）**：差分通过格的正面反馈条目——「兼容函数集命中：M 个公式，涉及函数 ...——已与导入结果逐格核对一致」（M 为差分通过格数，函数列表去重展示；该条目不进提示条、不进角标，仅导入报告留档）

**B. 缓存值单元格角标**

- 位置：**无法自动重算的公式格**（= 桶 II/桶 III 冻结格 + 差分降级格；v1.5 起差分通过格与白名单公式**不加角标**）**右上角**，尺寸 12×12px，`AlertCircle` 图标（Lucide 同库、stroke 1.5px 缩放适配），色 `--color-warn`
  - 图标选择理由：`AlertCircle` 语义为「该单元格有需注意的异常」而非「已出错」（缓存值仍可读，非错误值），比 `Info` 更能提示用户「此值不会随依赖重算」；与 3.11 五态中公式错误右下角 6×6 `--color-danger` 三角标（真错误）在**位置与颜色**双维度区分——右上琥珀圆标=缓存值可用但冻结，右下红三角=计算出错
  - 渲染层：角标绘制在 Canvas 单元格层（非 DOM 覆盖层），随网格滚动/缩放同步，不单独监听 scroll
- 交互：
  - hover：浮出 Tooltip（复用 DESIGN.md §4.7 Tooltip 规范：深灰底白字 12px，延迟 400ms，150ms 淡入），内容两行——第一行 12px 白字「暂不支持函数，显示为导入时缓存值」；第二行 13px `--font-mono` 等宽显示原公式文本（如 `=WEBSERVICE("http://…")`），超长 60 字符截断加省略号
  - 点击：单元格进入选中态（正常选中行为，不进编辑态——公式不可编辑重算），公式栏显示原公式文本 + 角标语义提示；键盘用户 Tab/方向键选中该单元格时公式栏同样可见完整公式（无障碍兜底，不依赖 hover）
- 不渲染场景：单元格选中编辑态（描边已表达焦点，角标避免视觉重叠）、打印预览（P2，届时按打印白名单过滤）、导出 xlsx/csv（导出保留公式文本本身，无角标概念）
- Token 引用：角标色 `--color-warn`、Tooltip 复用既有规范，**零新增 Token、零裸 hex**；如前端需在 Canvas 层取色，走 tokens.ts 生成产物（同 §11 已知坑表 grid-line 引用规则）

### 3.11 五态

| 状态 | 表现 |
|------|------|
| Loading | 顶部 2px `--color-accent` 进度条（indeterminate）+ 网格区中心 13px `--color-muted`「正在加载「2026年度预算汇总表」」；骨架期网格区底 `--color-surface`（不放占位网格，避免闪烁） |
| Empty | **不显示空态插画**：新建文件即为 1 个空白 Sheet（1000 行 × 26 列的可见网格），仅在状态栏显示「就绪」。空态插画只用于「文件不存在/无权限」场景 |
| Error（快照加载失败） | 网格区中心面板：`AlertTriangle` 24px `--color-danger` + 14px「文档加载失败」+ 13px `--color-meta` 错误码 + Secondary「重试」+ Ghost「返回文档列表」 |
| Error（无权限/已删除） | 同上面板，文案「文档不存在或你没有访问权限」+ Primary「返回文档列表」 |
| Edge | 公式错误单元格右下 6×6 `--color-danger` 三角标 + Tooltip 显示 `#REF!` / `#DIV/0!`（与 3.10bis 缓存值右上角琥珀角标并存时，两角标位置/颜色互不冲突）；超长文本溢出到相邻空单元格（Excel 行为），相邻非空则截断；5 万行滚动：虚拟渲染，滚动条 8px `--color-neutral-300`，hover `--color-neutral-400` |

---

## 页面 4：`/admin` 管理后台

### 4.1 整体布局

```
┌───────────────┬──────────────────────────────────────────┐
│ 左侧导航      │ 内容区（max-width 1200，padding 24）      │
│ 200px         │  标题 16px/590 + 副文案 12px              │
│ 用户管理      │  ─────────────────────────────────        │
│ SSO 配置      │  各 Tab 内容                              │
│ License 管理  │                                            │
│ 审计日志      │                                            │
└───────────────┴──────────────────────────────────────────┘
```

- 左侧导航：宽 `--width-admin-sidebar` 固定 · 底 `--color-bg` + 1px 右边框 `--color-border`；项高 32px · `padding: 0 12px` · 13px
  - 默认：`--color-muted`；Hover：`--color-fg-2` + 底 `--color-neutral-100`
  - **激活项：底 `--color-accent-subtle` + 文字 `--color-accent` + `radius: var(--radius-md)`**（本屏强调色配额 1；**禁止用彩色左边框标记激活项**）
  - 项左前置 16px 图标：`Users` / `KeyRound` / `BadgeCheck` / `ScrollText`
  - 顶部「返回文档列表」Ghost 文字按钮（12px，带 `ArrowLeft` 14px），底部 12px `--color-meta` 可显示当前登录管理员
- 顶部仍复用 `/files` 的 56px 顶栏（品牌 + 用户菜单），保证全局一致

### 4.2 Tab 1 — 用户管理

**操作行**：搜索框（240px，`Search` 图标，placeholder「搜索用户名或姓名」）+ 角色筛选下拉（全部 / 管理员 / 普通用户）+ 状态筛选（全部 / 启用 / 禁用）+ Primary「新建用户」（`UserPlus` 16px，本屏强调色配额 2）

**表格**（行高 40px，1px 分隔线）：

| 列 | 宽 | 内容 |
|----|----|------|
| 用户名 | 160px | 14px/510，mono |
| 显示名 | 160px | 14px |
| 角色 | 100px | Badge：`ADMIN`（`--color-accent-subtle` 底 + `--color-accent` 字，12px，`letter-spacing: 0.06em`）；普通用户不显示 Badge（避免噪音） |
| 来源 | 100px | 13px `--color-muted`：`本地` / `LDAP` / `OAuth2` |
| 状态 | 80px | 13px：启用（`--color-success`）/ 已禁用（`--color-muted`） |
| 最后登录 | 160px | 13px mono `--color-muted`：「2026-10-21 09:12」/ 从未登录显示 `—` |
| 操作 | 48px | `MoreHorizontal` → 重置密码 / 编辑信息 / 禁用（或启用）/ 删除 |

**新建用户对话框**（480px）：字段 用户名（必填，3-32 字符，字母数字下划线）、显示名（必填）、初始密码（必填 + 显示强度条）、角色（单选：普通用户 / 管理员）；下方 12px `--color-muted` 口令策略提示：「口令至少 8 位，需包含大小写字母与数字，90 天后到期更换，以 SM3 加盐存储」

**重置密码对话框**：字段 新密码 + 确认新密码；正文提示「重置后该用户所有已签发 token 立即失效，需重新登录」

**禁用/删除确认**：删除为**最高危操作**，对话框标题「删除用户「赵鹏（zhaopeng）」？」正文「删除后该用户无法登录，其历史操作仍保留在审计日志中。」操作区 [取消] [删除 Danger]

**五态**：Loading（6 行骨架）/ Empty（「暂无用户」+ Primary「新建用户」）/ Empty-搜索无结果（「未找到匹配「zhang」的用户」+ Ghost「清除筛选」）/ Error（加载失败 + 重试）/ Edge（超 100 用户分页 20/页）

### 4.3 Tab 2 — SSO 配置

三个协议**分区块纵向排列**（不是卡片网格），每块结构：

```
协议名 14px/510 + 右侧 启用开关（Switch）
1px 分隔线
字段栅格（2 列，列间距 16px，字段垂直间距 16px）
[保存并测试连接]  Secondary    测试结果提示行
```

| 协议 | 字段（Label + 控件） |
|------|---------------------|
| LDAP（图标 `Network`） | 服务器地址（如 `ldap://10.20.31.5:389`）、Bind DN（如 `cn=admin,dc=xx,dc=gov,dc=cn`）、Bind 密码（password 类型 + `Eye` 切换，保存后显示为 `••••••••` + 「已设置」）、用户基准 DN（如 `ou=users,dc=xx,dc=gov,dc=cn`）、登录属性（默认 `uid`）、是否启用 TLCP 连接（Switch） |
| OAuth2（图标 `KeyRound`） | 授权端点 URL、Token 端点 URL、Client ID、Client Secret（password + `Eye`）、Scope（默认 `openid profile`）、回调地址（**只读**，`--input-disabled-bg` 底 + 右侧 `Copy` 14px 图标按钮，点击 Toast「回调地址已复制」） |
| CAS（图标 `ShieldCheck`） | CAS 服务地址、登录前缀、票据校验路径 |

- **启用开关**：宽 36px 高 20px 轨道；关闭态 `--color-neutral-300`，开启态 `--color-accent`；开启时下方追加 12px `--color-muted`「启用后，登录页将显示该认证入口，本地账号密码登录仍保留」
- **保存并测试连接**：点击后按钮 Loading；结果行显示于按钮下方 12px：
  - 成功：`CheckCircle2` 14px `--color-success` + 「连接成功，检索到 128 个账户」
  - 失败：`XCircle` 14px `--color-danger` + 具体错误（如「无法连接 LDAP 服务器：连接超时（10s）」「Bind DN 或密码校验失败」）
- 未保存修改离开页面：Secondary 对话框「有未保存的更改」+ [放弃更改 Danger] [继续编辑 Secondary]
- **五态**：配置读取 Loading（字段骨架）/ 空配置（字段留空 + 12px `--color-muted`「尚未配置」）/ 保存失败（字段下方 12px `--color-danger` 具体原因）/ 测试超时（按钮恢复 + 结果行提示）/ Edge（超长 URL 输入框内横向滚动，不截断）

### 4.4 Tab 3 — License 管理

**状态区块**（1px `--color-border` 底？—— 用 1px 上下分隔线分组，不用卡片）：

| 项 | 值 | 表现 |
|----|-----|------|
| 状态 | Badge | 有效（`--color-success-bg` 底 + `--color-green-700` 字）/ 未激活 / 已过期 / 超出席位（`--color-warn-bg` + `--color-amber-700`）/ 已过期（danger 色） |
| 机器指纹 | `KX7F-9A2C-4E81-B0D6-3F52` | 13px `--font-mono` + 右侧 `Copy` 14px |
| 席位 | 已用 47 / 授权 50 | 进度条：轨道 4px `--color-neutral-200`，填充 `--color-accent`（未超席）/ `--color-danger`（超席）；右侧 13px mono「47 / 50」 |
| 有效期 | 2027-03-31（剩余 161 天） | 13px；≤30 天时文字转 `--color-warn` 并在下方追加 13px「License 即将到期，请及时续期」 |
| 签发对象 | 某某单位信息中心 | 13px `--color-muted` |

**激活流程（两步向导，纵向 Stepper，不用横向 1-2-3 圆点套路）**：

1. **步骤 1 · 生成激活申请码**
   - 说明 13px `--color-muted`：「点击生成后，将申请码通过离线方式提交给供应商，获取 License 文件。」
   - Primary 按钮「生成激活申请码」（`BadgeCheck` 16px，本屏强调色配额 2）
   - 生成后：只读文本框（mono 13px，`--input-disabled-bg` 底，自动换行，`radius: var(--radius-md)`）显示申请码 + 右侧 `Copy` 图标按钮 + 下方 12px `--color-meta`「申请码包含本机机器指纹，不含任何业务数据」
2. **步骤 2 · 安装 License 文件**
   - 拖拽上传区：`height: 120px` · 1px **虚线** `--color-neutral-300` · `radius: var(--radius-lg)` · 居中：`Upload` 图标 24px `--color-neutral-400` + 14px「将 .lic 文件拖拽到此处，或点击选择文件」+ 12px `--color-meta`「文件大小通常小于 4KB」
   - 选中文件后：显示文件行（16px `FileKey` 图标 + 文件名 13px + 大小 12px + `X` 移除）+ Primary「安装 License」
   - 安装中：按钮 Loading + 13px「正在验签…」
   - 成功：全宽提示行 `--color-success-bg` 底 + `CheckCircle2` 16px + 13px `--color-green-700`「License 安装成功，SM2 验签通过。有效期至 2027-03-31，授权席位 50。」下方追加「部分限制需重新登录后生效」+ Ghost「立即重新登录」
   - 失败：提示行 `--color-danger-bg` 底 + `XCircle` 16px + 13px `--color-red-700` 具体原因：
     - 「SM2 验签未通过：License 与本机机器指纹不匹配」
     - 「License 已过期（2026-09-30）」
     - 「License 文件解析失败：格式不正确」
     - 下方 Ghost「重新选择文件」

- 未激活状态下，顶部复用 3.10 的只读提示条样式（warn 底）提示「当前未安装 License，系统处于只读模式」
- **五态**：状态 Loading（骨架）/ 未激活（状态 Badge = 未激活 + 向导完整可用）/ 生成中（按钮 Loading）/ 安装失败（如上）/ Edge（席位已达上限时的超席提示）

### 4.5 Tab 4 — 审计日志

**筛选行**（高度 32px，间距 8px）：操作人输入（160px）、操作类型下拉（`file.create` `file.rename` `file.delete` `file.import` `file.export` `auth.login` `auth.login.fail` `user.create` `license.install` `sso.config.update`）、时间范围（`Calendar` 图标 + 快捷项：今日 / 近 7 天 / 近 30 天 / 自定义）、关键词输入（200px）、右侧 Secondary「导出当前筛选结果」（`Download` 16px）+ Ghost「重置筛选」

**表格**（行高 40px）：

| 列 | 宽 | 内容 |
|----|----|------|
| 时间 | 160px | 12px mono `--color-muted`：「2026-10-21 14:32:07」 |
| 操作人 | 140px | 13px（显示名）+ 12px `--color-meta`（用户名） |
| 操作类型 | 160px | 13px mono；`auth.login.fail` 与 `file.delete` 文字转 `--color-danger`，`license.install` 转 `--color-accent` |
| 对象 | flex-1 | 13px，如「2026年度预算汇总表.xlsx」；超长截断 + Tooltip |
| 来源 IP | 120px | 12px mono `--color-muted`：「10.20.31.88」 |
| 展开 | 32px | `ChevronRight` 16px；点击展开详情行 |

**详情展开行**：`--color-surface-warm` 底（`--color-neutral-100`）+ `radius: var(--radius-sm)` + `padding: 8px 12px`；内容 12px `--font-mono`，展示 detail JSON（格式化缩进），如：

```
{ "oldName": "部门快报-第九期.xlsx", "newName": "部门快报-第十期.xlsx", "clientIp": "10.20.31.88" }
```

- 分页：20 条/页；底部分页器同 2.5
- 只读性声明：表格上方 12px `--color-meta`「审计日志仅追加，不可编辑或删除」（配 `ShieldCheck` 12px 图标）
- **五态**：Loading（8 行骨架）/ Empty（「当前筛选条件下没有审计记录」+ Ghost「重置筛选」）/ Error（加载失败 + 重试）/ Edge（结果超 1 万条时提示「仅展示最近 10000 条，请缩小时间范围」）/ 导出中（按钮 Loading）

---

## 附录 A：图标清单（lucide-react，全项目唯一来源）

| 用途 | 图标名 | 尺寸 |
|------|--------|------|
| 导航/返回 | `ArrowLeft` | 16/20 |
| 新建 | `Plus` | 16 |
| 导入/上传 | `Upload` | 16/24 |
| 导出/下载 | `Download` | 16 |
| 搜索 | `Search` | 16 |
| 重命名 | `Pencil` | 14/16 |
| 删除 | `Trash2` | 16 |
| 更多 | `MoreHorizontal` | 16/20 |
| 复制 | `Copy` | 14/16 |
| 分享（P1 预留，本期不实现） | `Share2` | 16 |
| 撤销/重做 | `Undo2` / `Redo2` | 16 |
| 加粗/斜体/下划线 | `Bold` / `Italic` / `Underline` | 16 |
| 文字色/填充色 | `Baseline` / `PaintBucket` | 16 |
| 对齐 | `AlignLeft` / `AlignCenter` / `AlignRight` / `AlignVerticalJustifyCenter` | 16 |
| 合并/冻结 | `TableCellsMerge` / `Snowflake` | 16 |
| 函数 | `Sigma` | 16 |
| 表格/文件 | `Table` / `FileSpreadsheet` / `FileKey` | 16/20/24 |
| 状态 | `CheckCircle2` / `AlertTriangle` / `XCircle` / `Loader2` / `Lock` | 12/14/16 |
| 用户/权限 | `User` / `Users` / `UserPlus` / `KeyRound` / `ShieldCheck` / `BadgeCheck` / `Network` | 16/20 |
| 密码可见性 | `Eye` / `EyeOff` | 16 |
| 日志/时间 | `ScrollText` / `Calendar` | 16 |
| 折叠/展开 | `ChevronLeft` / `ChevronRight` | 16/24 |
| 剪贴板 | `Scissors` / `ClipboardPaste` | 16 |
| 清空 | `X` | 14/16 |

> 禁止任何 emoji 出现在 UI 中（含空态、Toast、按钮、标签）。空缺语义优先在同库近似图标中选取，其次按 24×24 网格 + 2px stroke 自绘 SVG 补齐。

## 附录 B：文案基调（政企信创语境）

- **Do**：具体、可核验：「2026年度预算汇总表」「席位已用 47 / 50」「License 将于 2027-03-31 到期」「运行时无外网依赖」
- **Do**：动作导向：按钮写「生成激活申请码」「保存并测试连接」「导出为 .xlsx」
- **Don't**：禁止「欢迎使用 web-office」「开启高效协作新体验」「一键轻松上手」「赋能数字化转型」
- **Don't**：禁止虚构指标：「99.9% 可用」「服务 10,000+ 政企客户」
- **Don't**：禁止装饰性党政风：红旗、金色渐变标题、红色党政横幅（视觉方向仍是冷静精准的驾驶舱）
