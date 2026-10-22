# web-office DESIGN.md

> 生成日期：2026-10-21 | 设计师：颜好看 | 基于：Spec-web-office-v1.0.0 §7/§8 + Phase 1 UIUX 设计方向
> 三轴刻度：Variance=3 / Motion=3 / **Density=7（驾驶舱模式）**
> 设计寄存器：**Product 型**（设计服务数据，不是设计即产品）
> 图标库：**lucide-react**（全项目唯一来源，16/20/24px，禁止 emoji）

---

## 1. Visual Theme & Atmosphere（视觉主题与氛围）

- **视觉主题关键词**：冷静、精准、密集、可靠
- **氛围描述**：打开就像一块待填的数据面板——网格是主角，界面是透明的。灰色网格线铺满视口，工具栏压到 116px 以内，唯一的一抹绿只在「正在做什么」的地方出现（选中的单元格描边、激活的 Sheet 标签）。没有卡片盒子、没有装饰渐变、没有欢迎语。
- **对标品牌**：**Google Sheets**（结构范本：单行工具栏 + 三段式公式栏 + 底部 Sheet 条）+ **Linear**（视觉范本：1px 线分隔、克制 hover、150ms 收敛）+ **腾讯文档**（本土习惯：右键菜单、头像堆叠在右上角）
- **产品语境**：信创政企私有化部署。文案与示例数据走政企语境（「2026年度预算汇总表」「部门快报」），但视觉**不做**红色党政风、不做老气 OA 风——专业感来自密度与对齐，不来自色彩重量。

### 三条设计原则（calm density）

1. **信息占 80%，装饰占 0%**：任何像素如果不能帮助用户更快读懂数据，就该删掉。禁止卡片容器包裹网格区、禁止区块阴影、禁止空白占位插画喧宾夺主。
2. **用线分组，不用盒子分组**：Density 7 驾驶舱模式下，分组靠 1px `--color-border` 分隔线 + 间距，不靠圆角卡片 + 背景色块。列表、表单、日志一律 `border-t` / `divide-y`。
3. **一屏只有一处强调**：`--color-accent` 在一屏内可见使用 ≤2 处（表格编辑器为：选中单元格描边 + 激活 Sheet 标签下划线，同一语义组计 1 处；列表页为：新建按钮 + 选中行）。其余层级全部靠字号/字重/中性灰阶表达。

---

## 2. Color Palette & Roles（色彩与角色）

### A1 Primitive

| 色族 | 用途 | 关键值 |
|------|------|--------|
| Emerald | 品牌主色 | 50 `#ECFDF5` / 100 `#D1FAE5` / 200 `#A7F3D0` / 300 `#6EE7B7` / 400 `#34D399` / 500 `#10B981` / **600 `#059669`（基准）** / 700 `#047857` / 800 `#065F46` / 900 `#064E3B` |
| Neutral | 暖灰阶 | 0 `#FFF` / 50 `#F9FAFB` / 100 `#F3F4F6` / **150 `#F1F5F9`（表头底）** / 200 `#E5E7EB` / **250 `#E2E8F0`（网格线）** / 300 `#D1D5DB` / 400 `#9CA3AF` / 500 `#6B7280` / 600 `#64748B` / 700 `#374151` / 900 `#111827` |
| 语义源色 | — | red 50/500/600/700、amber 50/500/600/700、green 50/500/600/700、blue 50/500/600 |

### A2 Semantic（业务代码只引用这一层）

- **Surface**：`--color-bg: #F9FAFB`（页面底）· `--color-surface: #FFF`（面板/对话框/下拉底）· `--color-surface-warm: #F3F4F6`（三级面：hover 底、禁用底）
- **Foreground**：`--color-fg: #111827` · `--color-fg-2: #374151`（次级正文）· `--color-muted: #6B7280`（副文本/时间戳）· `--color-meta: #9CA3AF`（元数据/占位符）
- **Border**：`--color-border: #E5E7EB` · `--color-border-soft: #F3F4F6`（行内分隔）
- **Accent**：`--color-accent: #059669` · hover `#047857` · active `#065F46` · subtle `#ECFDF5`（浅底选中/标签）· `--color-accent-on: #FFF`
- **Semantic**：success `#16A34A` / warn `#D97706` / danger `#DC2626` / info `#2563EB`（各配 50 级浅底用于提示条背景）

### C Extension — 协同光标 8 色

`--color-collab-1..8`：`#2563EB` blue · `#E11D48` rose · `#F97316` orange · `#D97706` amber · `#8B5CF6` violet · `#0891B2` cyan · `#DB2777` pink · `#65A30D` lime

> 注意：其中紫色/粉色仅作为**分类色单点**用于协同光标与选区描边，是 8 色分类调色板的可辨识度刚需；项目中**不存在**紫→粉渐变、渐变文字或紫色发光边框。

- 选色依据：8 色在 HSL 上均匀分布，色相间距 ≥30°，明度集中在 45-55% 保证在白底网格上都能过 3:1 非文本对比度；**刻意避开 `#059669` 附近色相**（避免与品牌主色/选中态混淆）与纯语义红（避免与错误态混淆）。
- 分配规则：**按 userId 确定性哈希取模**（`colorIndex = fnv1a32(userId) % 8`），纯函数、各端独立计算结果必然一致。**禁止**用 Yjs clientId 取模——clientId 是每次连接随机生成的会话值，同一用户刷新即变，锁不住色。每个客户端在 awareness 本地状态中自带 `user.color` 字段（`setLocalStateField('user', {userId, name, color})`），接收端直接读取、不自行计算，从协议层消灭两端不一致。碰撞概率 1/8 可接受（业界同策略）。调色板索引以 `design-tokens.json` 的 `collab.1..8` 数字序为准，由构建脚本从 JSON 生成（禁止手工排序）；Univer `theme.loop-color.1..8` 按同序注入，两侧同源。

### 每屏强调色使用清单（≤2 处）

| 页面 | 强调色位置 1 | 强调色位置 2 |
|------|--------------|--------------|
| /login | 登录按钮（primary） | 输入框 focus ring |
| /files | 「新建」按钮 | 选中行浅绿底 |
| /file/:id | 选中单元格描边 + 激活 Sheet 标签下划线（同一语义组计 1 处） | （P1 预留）分享按钮 |
| /admin | 当前激活 Tab 文字 | 主操作按钮（如「生成激活申请码」） |

> 禁止：纯黑 `#000` / 纯灰 `#808080` 直出；禁止在业务代码写裸 hex（一律走 Token）；禁止紫→粉渐变、渐变文字、彩色左边框。

---

## 3. Typography（排版）

### 字体栈

```css
--font-display: 'Inter', 'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-body:    'Inter', 'Noto Sans SC', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', Consolas, monospace;
```

> 三款字体均为 OFL 协议，**必须本地打包**（离线部署：运行时网络白名单 = 空，禁止任何运行时外链字体请求）。

### 分工规则

| 场景 | 字体 | 说明 |
|------|------|------|
| 所有 UI 文案 | Inter + Noto Sans SC | 界面、按钮、菜单、日志、文件名 |
| 公式栏编辑区、单元格数据、名称框（A1）、状态栏统计数字 | JetBrains Mono | 等宽是数字列对齐刚需，也是专业感来源 |

### 字号阶梯（只有 5 级，禁止新增）

| Token | 值 | 用途 |
|-------|-----|------|
| `--font-size-xs` | 12px / 0.75rem | 行列头、辅助文字、徽章、时间戳、页脚 |
| `--font-size-sm` | 13px / 0.8125rem | **单元格默认字号**、状态栏、表格密集区 |
| `--font-size-base` | 14px / 0.875rem | 表单、按钮、列表正文、菜单项 |
| `--font-size-lg` | 16px / 1rem | 页面标题、对话框标题 |
| `--font-size-xl` | 20px / 1.25rem | 登录页主标题（全项目唯一 20px 处） |

### 字重三级

| 级别 | 值 | 用途 |
|------|-----|------|
| Regular | 400 | 正文、单元格、说明文字 |
| Medium | 510 | 按钮文字、表单 label、表头、文件名 |
| Semibold | 590 | 页面标题、对话框标题 |

### 字距与行高

- 正文/单元格：`letter-spacing: 0`
- 12-13px 小字：`letter-spacing: 0.01em`
- ALL CAPS 徽章（如 `ADMIN` `READ-ONLY`）：`letter-spacing: 0.06em`
- ≥16px 标题：`letter-spacing: -0.01em`
- 行高：正文 1.5 / 标题 1.25 / 单元格 1.4

---

## 4. Components（组件规范）

> 所有组件必须覆盖 9 态：Default / Hover / Focus / Active / Disabled / Loading / Error / Empty / Success。
> 尺寸锚点：按钮与输入框统一 32px 高（Density 7 下的紧凑尺寸，非 44px——44px 触摸规则仅用于移动端，本项目明确不做移动端）。

### 4.1 Button

| 变体 | 背景 | 文字 | 边框 | Hover | Active |
|------|------|------|------|-------|--------|
| Primary | `--color-accent` | `--color-accent-on` | 无 | `--color-accent-hover` | `--color-accent-active` |
| Secondary | `--color-surface` | `--color-fg-2` | 1px `--color-border` | `--color-surface-warm` | `--color-neutral-200` |
| Ghost | transparent | `--color-fg-2` | 无 | `--color-neutral-100` | `--color-neutral-200` |
| Danger | `--color-danger` | `#FFF` | 无 | `--color-red-700` | 更深 8% |

- 尺寸：`height: 32px` · `padding: 0 12px` · `radius: 6px` · 字号 14px · 字重 510
- 图标按钮：图标 16px + 文字间距 4px
- **Disabled**：`--btn-disabled-bg` + `--btn-disabled-text`，`cursor: not-allowed`，**不降低 opacity**（低对比不可读）
- **Loading**：按钮内文字替换为 14px Spinner（Lucide `Loader2`，旋转动画 800ms linear infinite）+ 保留原文字宽度防抖动；`prefers-reduced-motion` 下改为静态点状动画
- **Focus**：`:focus-visible` 加 `--focus-ring`，`outline: none` 仅在此前提下使用

### 4.2 Input

- 尺寸：`height: 32px` · `padding: 0 12px` · `radius: 6px` · 14px
- Default：`--input-bg` + 1px `--input-border`
- Hover：边框转 `--input-border-hover`（150ms）
- Focus：边框转 `--color-accent` + `--focus-ring`，**禁止**同时加 box-shadow 大扩散
- Error：边框 `--input-error-border` + 下方 12px `--color-danger` 错误文案（错误必须贴近字段，不放页面顶部）
- Disabled：`--input-disabled-bg` + `--input-disabled-text`
- Label：始终可见 label（12px `--color-muted`），**禁止只用 placeholder 当 label**
- Helper text：12px `--color-muted`，置于输入框下方 4px

### 4.3 Dropdown / 下拉选择

- 容器：`--dropdown-bg` + 1px `--dropdown-border` + `--shadow-raised` + `radius: 8px`，内边距 4px
- 项：`height: 32px` · `padding: 0 12px` · 14px；Hover `--dropdown-item-bg-hover`；选中项 `--dropdown-item-bg-selected` 底 + `--dropdown-item-text-selected` 文字 + 14px `Check` 图标（右对齐）
- 分组：组间 1px `--color-border-soft` 分隔线 + 4px 间距，**不**加组标题文字（工具栏空间紧张）
- 进入动画：opacity 0→1 + translateY(-2px)→0，150ms `--ease-standard`
- 键盘：↑↓ 移动、Enter 选中、Esc 关闭、焦点回到触发器

### 4.4 ContextMenu / 右键菜单

- 继承 Dropdown 全部规范；`min-width: 180px`
- 项结构：`[18px 图标槽] [文案] [右侧快捷键 12px --color-meta]`
- 危险项（删除）：文字 `--dropdown-item-text-danger`，Hover 底 `--dropdown-item-bg-danger-hover`；**永不**使用彩色左边框
- 触发：仅在网格区/行头/列头/Sheet 标签/文件行上绑定，覆盖浏览器默认菜单
- 定位：默认出现在光标右下，贴视口边缘时自动翻转方向（不出现横向滚动条）

### 4.5 Dialog / 对话框

- 遮罩：`--dialog-overlay`，点击遮罩关闭（表单已输入内容时改为二次确认）
- 容器：宽 480px（License 安装向导 560px）· `radius: 8px` · `--shadow-overlay` · `padding: 24px`
- 标题 16px/590；描述 14px `--color-muted`；正文与操作区间 1px `--color-border` 分隔
- 操作区：右对齐，Primary 在右、Secondary 在其左，间距 8px；**危险操作**（删除文件/删除 Sheet）的确认按钮用 Danger 变体
- 进入：opacity + scale(0.98)→1，200ms；Esc 关闭；焦点进入时落在第一个可聚焦元素并 trap

### 4.6 Toast

- 位置：右下角 16px，多条纵向堆叠间距 8px，最多同时 3 条（超出丢弃最旧）
- 样式：`--toast-bg` 深灰底 + 白字 + `radius: 6px` + `padding: 8px 12px` + 13px
- 语义前缀图标（14px Lucide）：success=`CheckCircle2`（绿）· warn=`AlertTriangle`（琥珀）· error=`XCircle`（红）
- 时长 3000ms（错误类 5000ms）；可手动关闭（`X` 图标 14px）
- 禁止：装饰性弹入动画、彩色左边框、进度条

### 4.7 其他原子

| 组件 | 规范 |
|------|------|
| Badge | 12px / `radius: 4px` / `padding: 2px 6px`；`ADMIN` 用 `--color-accent-subtle` 底 + `--color-accent` 字；`只读` 用 `--color-warn-bg` 底 + `--color-amber-700` 字 |
| Avatar | 24px 圆形，底 `--color-neutral-200`，文字 12px/510 `--color-fg-2`，取显示名首字（中文取姓） |
| Tooltip | 深灰底白字 12px，`radius: 4px`，延迟 400ms 出现，150ms 淡入；不承载唯一信息（键盘用户必须另有途径获得）；多行变体（如缓存值角标的说明+等宽公式两行，见 pages.md §3.10bis）行距 1.4，等宽行用 `--font-mono` 13px |
| Tabs（管理后台） | 文字 14px；默认 `--color-muted`，Hover `--color-fg-2`，激活 `--color-accent` + 2px 下划线；**禁用** pill 背景块式 Tab |

---

## 5. Layout & Spacing（布局与间距）

### 间距（4px 基准网格）

`0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48`——禁止 5/7/13/15/22/30 等非标值。
Density 7 下的常用映射：工具栏按钮间距 4px、表单字段垂直间距 16px、区块间距 24px、页面级留白 32px。

### 区域尺寸（Spec §8 锁定）

| 区域 | 高度 | 说明 |
|------|------|------|
| 标题栏 | 44px | 硬值，不可压缩 |
| 工具栏 | 40px | 单行，超宽收纳进「…」 |
| 公式栏 | 32px | 三段式 |
| **工具栏总高** | **116px** | **硬上限 120px** |
| 行头高 / 列头宽 | 24px / 64px | 列宽可拖拽，最小 40px |
| Sheet 标签栏 | 36px | 底部固定 |
| 状态栏 | 28px | 底部固定，可隐藏 |
| 管理后台左侧导航 | 200px | 固定宽 |

### 容器与栅格

- 内容区最大宽 `--container-max: 1200px`（列表页/管理后台）；表格编辑器**不设**最大宽，网格铺满视口
- 栅格：桌面 12 列 / gap 24px（管理后台表单用 8 列约束，避免输入框过长）
- 断点：`sm 640 / md 768 / lg 1024 / xl 1280`。**<1024px 仅保证可访问不保证体验**（政企内网以桌面为主，明确不做移动端）

---

## 6. Depth & Elevation（深度与阴影）

| 层级 | 值 | 使用场景 |
|------|-----|----------|
| `--shadow-none` | none | 网格区、卡片（Density 7 下默认无阴影） |
| `--shadow-xs` | `0 1px 2px rgba(17,24,39,0.05)` | 吸顶标题栏下沿 |
| `--shadow-raised` | `0 1px 2px rgba(17,24,39,0.04), 0 4px 8px rgba(17,24,39,0.06)` | 下拉、右键菜单、Tooltip |
| `--shadow-overlay` | `0 8px 24px rgba(17,24,39,0.12)` | 对话框、导入任务浮层 |

- **禁止幽灵卡片**：`1px solid` 边框与 `blur ≥16px` 阴影不得同时出现在同一元素上
- **禁止装饰性毛玻璃**：无 backdrop-filter；如需半透明（仅对话框遮罩）用纯色 rgba

### z-index 层级

`grid 10` → `grid-header 20` → `sticky 1100`（标题栏/工具栏/行列头吸顶）→ `dropdown 1200` → `context-menu 1250` → `modal 1300` → `toast 1400` → `tooltip 1500`

---

## 7. Collaboration Visual Spec（协同可视化规范）

> 对应 AC-06：协作者光标/选区必须可见。

### 7.1 光标（Caret）

- 形态：2px 竖线，高 = 单元格行高（默认 24px），颜色 = 该用户 `--color-collab-N`
- 光标顶部贴一个 12px 高名字标签：底色为光标色，文字白色，圆角 4px，`padding: 1px 4px`，字号 12px
- 标签显示规则：**同时在线 ≤4 人时全部显示名字标签**；**≥5 人时隐藏所有名字标签，仅保留彩色光标**（避免网格被标签糊满）。hover 任意光标时单独浮出该用户名字（Tooltip 形式）
- 名字标签在光标位于首行时向下偏移显示，禁止溢出网格区上边界

### 7.2 选区（Selection）

- 形态：2px 边框（同用户光标色）+ **10% 透明填充**（`--collab-selection-fill-opacity: 0.1`）
- 与本地选中态共存：本地选中永远用 `--color-accent` 2px 描边 + `rgba(5,150,105,0.06)` 填充，且本地选区绘制在最上层
- 填充柄（右下角 6×6 实心方块）只在本地选区显示，协作者选区不渲染填充柄

### 7.3 头像堆叠（标题栏右上角）

- 单个头像 24px 圆形，堆叠重叠 `-6px`（`--collab-avatar-overlap`），最右侧为当前用户（底 `--color-accent-subtle` + 绿字），顺序：当前用户 → 其他协作者（按加入顺序）
- 显示规则：**≤4 人全部展示**；**≥5 人时展示前 3 人 + 「+N」圆标**（24px，底 `--color-neutral-200`，字 12px/510 `--color-fg-2`）
- 「+N」点击 → 弹出 200px 宽浮层列出全部在线人员（姓名 14px + 12px `--color-meta` 部门/账号 + 该用户光标色 8px 色点）
- 头像外圈 2px `--color-surface` 描边，避免堆叠时糊成一片

### 7.4 离线/掉线协作者

- 该用户头像降为 40% 透明度 + 右下角 8px `--color-neutral-400` 实心点
- 其光标与选区在 3 秒无心跳后移除（不保留幽灵光标）
- 标题栏保存指示区显示 `已离线，编辑将在恢复连接后同步`（见 8.4）

### 7.5 协同引入动效（Motion 3 边界内）

只允许两处：光标移动使用 CSS `transition: transform 120ms linear`（避免瞬移跳跃感）；名字标签首次出现 150ms 淡入。**禁止**光标弹跳、脉冲、光晕。

---

## 8. Component State Matrix（关键组件 5 态）

### 8.1 文件列表

| 状态 | 表现 |
|------|------|
| Loading | 6 行骨架行（每行 40px，140px 宽浅灰条 + 右侧 80px 时间条），1.5s 循环微光扫过；`prefers-reduced-motion` 下改为静态灰条 |
| Empty（无文件） | 居中 14px `--color-muted`：「还没有文档」+ 13px 副文案「新建空白表格，或导入 .xlsx/.csv（≤10MB）」+ Primary 按钮「新建表格」 |
| Empty（搜索无结果） | 行内提示「未找到匹配「{关键词}」的文档」+ Ghost 按钮「清除筛选」 |
| Error（列表加载失败） | 整块替换：`AlertTriangle` 16px + 14px「文档列表加载失败」+ 13px `--color-muted` 错误码 + Secondary 按钮「重试」 |
| Edge | 文件名超长：单行截断 + Tooltip 显示全名；超过 100 个文件：分页（默认 20/页） |

### 8.2 导入任务

| 状态 | 表现 |
|------|------|
| pending | 列表行右侧 12px「排队中」+ `--color-muted` |
| parsing | 行内 1px 高进度条（`--color-accent`，indeterminate 滑动）+ 12px「解析中 · 已用 3s」 |
| done | 12px `--color-success` + `CheckCircle2` 14px；行自动刷新为正式文件行 |
| failed | 12px `--color-danger` + 错误文案（如「文件超过 10MB 上限」「不支持的文件格式」）+ Ghost 按钮「重新上传」 |

### 8.3 表格编辑器保存状态

| 状态 | 指示 |
|------|------|
| 已保存 | 4px `--save-saved-dot` 绿点 + 12px「已保存」 |
| 保存中 | 14px `Loader2` 旋转 + 12px「保存中」 |
| 未保存/离线 | 4px `--save-offline-color` 琥珀点 + 12px「离线，待同步」 |
| 保存失败 | 4px `--color-danger` 点 + 12px「保存失败」+ 可点击触发重试（点击展开「重试 / 导出本地副本」） |

### 8.4 单元格与公式

| 状态 | 表现 |
|------|------|
| 编辑中 | 单元格 2px `--color-accent` 描边 + 内部 caret；公式栏同步高亮，引用的单元格用对应协同色/主色虚线框标记 |
| 公式错误 | 单元格右下角 6×6 `--color-danger` 三角标；hover Tooltip 显示 `#REF!` / `#DIV/0!` 等具体错误 |
| 无法自动重算公式格（导入缓存值；v1.5 范围收窄） | 单元格**右上角** 12×12 `AlertCircle` 角标 `--color-warn`（与公式错误三角标以位置+颜色双维区分：右上琥珀=值冻结可用，右下红=计算出错）；hover Tooltip 两行（说明 + 等宽原公式）；文件级一次性提示条见 pages.md §3.10bis。**v1.5 口径（PM 桶 I 裁决方案 b）**：角标仅覆盖桶 II（引擎未实现）/桶 III（volatile 与动态引用排除集）/差分不一致降级格——引擎可用区差分通过格保留公式参与计算、**无角标无提示条计入**（与白名单公式同权） |
| 计算中 | 状态栏统计区显示 `Loader2` 12px（>500ms 才显示，避免闪烁） |
| 只读（License） | 单元格点击不进入编辑态，光标为 `default`，顶部弹出 Toast「当前为只读模式」 |

---

## 9. Do's & Don'ts

### Do（必须做）

1. 所有颜色走 Token（A2/C 层），业务代码零裸 hex（`#fff`/`#000` 亦禁止，用 `--color-surface`/`--color-fg`）
2. 分组用 1px 分隔线 + 间距，不用卡片盒子
3. 数字、公式、坐标一律 JetBrains Mono
4. 每屏强调色 ≤2 处，其余靠字重字号的灰阶层级
5. 图标全部来自 lucide-react，尺寸只用 16/20/24px
6. 所有交互 150ms 收敛，`prefers-reduced-motion` 下归零
7. 错误文案贴近出错字段，并给出下一步动作（重试/重新上传）
8. 文案与示例数据用真实政企语境（文件名、部门、金额、日期都是可信的具体值）

### Don't（禁止做）

1. **禁止 emoji 作为功能图标**（常见违规：火箭、图表、闪光、靶心、闪电等符号）——零例外，全部 Lucide
2. **禁止紫色→粉色渐变**（Purple→Pink 任意组合及发光边框、毛玻璃三位一体套路）、**禁止渐变文字**（用渐变填充文字的做法）
3. **禁止彩色左边框**（`border-left > 1px` 作强调）、**禁止装饰性毛玻璃**
4. 禁止默认靛蓝 `#6366F1` 作强调色（一眼 AI）
5. 禁止虚构指标（「99.9% 稳定运行」「10,000+ 用户信赖」）
6. 禁止空洞文案（「欢迎使用」「欢迎来到」等 Welcome-to 句式，以及 "Get started" / "Seamless" / "Next-Gen" 一类无信息量修饰词）
7. 禁止幽灵卡片（`1px border` + `blur ≥16px` 同时出现）、禁止卡片圆角 ≥12px
8. 禁止重复结构动效（每个 section 都淡入）、禁止装饰性弹跳缓动
9. 禁止纯黑 `#000` / 纯灰 `#808080` 直出
10. 禁止运行时外链字体/图标 CDN（离线部署硬约束）

---

## 10. Responsive & Accessibility

- **响应式策略**：桌面优先（政企内网主战场）。`≥1280px` 完整布局；`1024-1280px` 工具栏启用「…」溢出收纳、隐藏状态栏快速统计；`768-1024px` 隐藏工具栏低频组（图表、冻结），网格区仍全宽；`<768px` 仅保证只读可访问，不保证编辑体验（不做移动端）
- **对比度**：正文 ≥4.5:1（`--color-fg` on `--color-surface` = 15.8:1，达标；`--color-muted` on `--color-surface` = 4.8:1，达标）；非文本 UI（网格线、图标）≥3:1（`--grid-line` on white = 1.2:1 —— 网格线为装饰性非必要信息，选中态用 2px 主色保证可辨）；**禁止灰叠灰**（`--color-muted` 不得作为 `--color-surface-warm` 上的文字）
- **键盘导航**：所有交互元素可达；Tab 顺序 = 视觉顺序；下拉/右键菜单支持 ↑↓/Enter/Esc；对话框焦点 trap 且 Esc 关闭；网格区支持 ←↑↓→ 移动、Enter 进入编辑、Esc 取消、Tab 提交并右移（沿用 Univer 默认键位）
- **焦点可见**：全局 `:focus-visible { box-shadow: var(--focus-ring); outline: none }`，**永不移除 focus ring**
- **屏幕阅读器**：纯图标按钮必须有 `aria-label`；协同光标区标 `aria-live="polite"`；动态保存状态用 `role="status"`
- **不靠颜色单独传达含义**：公式错误同时有三角标 + Tooltip 文案；只读态同时有横幅文案 + 图标；状态点必有文字伴随
- **动效降级**：`prefers-reduced-motion: reduce` 下所有 transition/animation 归零
- **触摸目标**：桌面项目不做移动端，但可点击图标按钮最小命中区不低于 28×28px（工具栏图标按钮即 28px）

---

## 11. Agent Implementation Guide（前端实现指南）

### 引入方式

```ts
// src/main.tsx 最早处
import '@/design/design-tokens.css';
import tokens from '@/design/design-tokens.json';
```

- `design-tokens.json` 供 Univer 主题与 Canvas 绘制代码读取（Canvas 无法读 CSS 变量，必须走 JSON）
- `design-tokens.css` 供 React 组件层样式使用

### Tailwind 映射（tailwind.config.ts 片段）

```ts
export default {
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-warm': 'var(--color-surface-warm)',
        fg: 'var(--color-fg)',
        'fg-2': 'var(--color-fg-2)',
        muted: 'var(--color-muted)',
        meta: 'var(--color-meta)',
        border: 'var(--color-border)',
        'border-soft': 'var(--color-border-soft)',
        accent: { DEFAULT: 'var(--color-accent)', hover: 'var(--color-accent-hover)', subtle: 'var(--color-accent-subtle)' },
        success: 'var(--color-success)', warn: 'var(--color-warn)', danger: 'var(--color-danger)', info: 'var(--color-info)',
      },
      fontFamily: {
        display: 'var(--font-display)', body: 'var(--font-body)', mono: 'var(--font-mono)',
      },
      fontSize: {
        xs: 'var(--font-size-xs)', sm: 'var(--font-size-sm)', base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)', xl: 'var(--font-size-xl)',
      },
      spacing: { 1: 'var(--space-1)', 2: 'var(--space-2)', 3: 'var(--space-3)', 4: 'var(--space-4)', 6: 'var(--space-6)', 8: 'var(--space-8)' },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', pill: 'var(--radius-pill)' },
      boxShadow: { xs: 'var(--shadow-xs)', raised: 'var(--shadow-raised)', overlay: 'var(--shadow-overlay)', focus: 'var(--focus-ring)' },
      transitionDuration: { fast: '150ms', base: '200ms', slow: '300ms' },
      zIndex: { sticky: '1100', dropdown: '1200', 'context-menu': '1250', modal: '1300', toast: '1400', tooltip: '1500' },
    },
  },
};
```

### Univer 主题接入提示

- Univer Canvas 层不支持 CSS 变量，需在初始化时把 `design-tokens.json` 的 `--grid-*`、`--collab-*` 值注入 Univer theme：`grid-line` → `borderColor`、`header-bg` → `headerBackgroundColor`、单元格默认字体 `--grid-cell-font` / 字号 13px
- **严禁**从外部直接改 Univer snapshot（Spec §11 已知坑），一切变更走 Command API

### 已知坑提醒

| 坑 | 处理 |
|----|------|
| Canvas 读不到 CSS 变量 | 走 JSON Token 注入（构建生成 tokens.ts / theme.ts，JSON 为唯一事实源），CSS 变量只用于 DOM 层 |
| @univerjs/* 版本不一致导致样式/运行时错乱 | 全包锁 v1.0.2 |
| 字体外链 | 用 @fontsource/inter、@fontsource/noto-sans-sc、@fontsource/jetbrains-mono（woff2 本地静态资源，随 npm 依赖进 verdaccio 离线源）；CI 加禁外链断言（产物 grep + CSP `font-src 'self'`） |
| Canvas 首帧字体未就绪导致列宽度量错位 | Univer 挂载前 `await document.fonts.load('13px "JetBrains Mono"')` |
| 协同取色用 Yjs clientId | clientId 是连接级随机值，刷新即变锁不住色；改用 userId 确定性哈希 `fnv1a32(userId) % 8`，且 awareness 自带 `user.color` 字段，接收端直接读取 |
| 协同颜色与品牌色混淆 | 8 色板已避开 `#059669` 色相，禁止在协同层再引入绿色系 |
| 只读态只做 UI 禁用 | UI 只是第三层防线：命令层 `beforeCommandExecuted` 守卫 + 服务端 402/WS close 4409 必须同步实现（详见 docs/frontend/theme-font-collab-integration.md §4） |
| 表头底色 V 项微调漂移 | 仅允许 neutral.150（#F1F5F9）与 neutral.200（#E5E7EB）二选一，不允许任意 hex；微调须以「V 项验证结论」回报（进 F3 交付记录，含截图对比与原因），并同步改 design-tokens.json `--grid-header-bg` + 构建脚本重新生成 tokens.ts——三步缺一不可 |
| Token 改色后 grid-line 双保险分叉 | `set-gridlines-color` 等调用点统一 `import { grid } from '@/styles/tokens'` 引用生成产物；源码中禁止出现网格线/表头色的 hex 字面量（CI 裸 hex 白名单由 tokens.ts 生成物自动派生） |

---

## 12. 组件来源与工程化基线（P3-001 裁决，2026-10-22）

> 本章是 P3-001 评审会的落盘产物，回答「UI 元素从哪来」与「工程化依赖锁定在哪一版」。完整裁决过程与证据见 `docs/phase3/P3-001-工程化基线裁决记录.md`。

### 12.1 组件来源四分法：一切 UI 元素必须有唯一出处

| 层 | 来源 | 说明 | 红线 |
|----|------|------|------|
| 图标 | lucide-react（**唯一**） | 尺寸 16/20/24px；二级来源一律被 `no-restricted-imports` 拦截 | 任何第二图标包进 diff 即刻 lint fail。Univer 引擎内置 `@univerjs/icons` 属第三方渲染产物不在红线内，但自研组件禁止 import |
| 表格画布 | Univer OSS 1.0.2（Canvas） | 网格、单元格、Sheet 标签由 Univer 渲染；自研样式不进入 Canvas 区 | 严禁从外部直接改 Univer snapshot（Spec §11），一切变更走 Command API |
| 外壳原子 | 自研（14 个） | 见 §12.2 清单，每个覆盖 9 态（§4 抬头强制） | 颜色一律来自 token（`var(--color-*)` 或 Tailwind 语义类），不得出现裸 hex |
| 无障碍行为 | Radix 原语（9 个） | 仅借用焦点 trap / ARIA / 键盘导航 / 视口翻转 / 延迟；**不借用其任何视觉默认值** | 不得引入 Radix 自带样式；不得引入 `@radix-ui/react-icons`（图标只走 lucide） |

### 12.2 外壳原子组件清单

| 组件 | 行为层 | 设计依据 | 必覆盖状态 |
|------|--------|----------|-----------|
| Button | 原生 button + cva | §4.1（Primary/Secondary/Ghost/Danger 四变体） | 9 态 |
| Input | 原生 input + 自研 label/helper/error 三伴生区 | §4.2 | 9 态 |
| Dropdown | `@radix-ui/react-dropdown-menu` 2.2.1 | §4.3 | 9 态 + 键盘 ↑↓/Enter/Esc |
| ContextMenu | `@radix-ui/react-context-menu` 2.4.1 | §4.4（继承 Dropdown，min-width 180px，危险项不用彩色左边框） | 9 态 + 贴边翻转 |
| Dialog | `@radix-ui/react-dialog` 1.3.1 | §4.5（480px / License 向导 560px，焦点 trap，Esc 关闭） | 9 态 + 已输入内容时的二次确认 |
| Toast | `@radix-ui/react-toast` 1.3.1 + 自研 3 条上限队列 | §4.6（右下 16px，语义前缀图标，3000/5000ms） | 9 态（Empty = 无 toast 时不渲染容器） |
| 表格头与文件列表行 | 原生 table 语义 + role | §8.1 文件列表 5 态 | Loading / Empty / Error / Populated / 越界 |
| 头像堆叠 | `@radix-ui/react-avatar` 1.3.1 | §7.3（4 人阈值来自 token `maxVisibleAvatars`） | 0~N 人，含 +N 溢出 |
| Tabs | `@radix-ui/react-tabs` 1.2.1 | §4.7（禁用 pill 背景块式） | 9 态 |
| Progress | `@radix-ui/react-progress` 1.2.1 | §8.2 导入任务 + Spec §9 v1.1 L1b 档初算进度 | 确定态 / 不确定态 / Error / Success |
| Badge / Avatar / Tooltip | Tooltip 用 `@radix-ui/react-tooltip` 1.4.1 | §4.7 | Badge 2 变体；Tooltip 延迟 400ms + 150ms 淡入 |
| Popover（浮层基座） | `@radix-ui/react-popover` 1.3.1 | 供 Dropdown / Tooltip 的定位基座复用 | — |

> 头像堆叠与进度条是本清单相对 DESIGN.md §4.1-4.7 的**增量**：二者在 Spec 中有验收断言（§7.3 协同头像、§9 v1.1 L1b 档初算进度提示），漏了等于漏验收项。
> **Radix 各包主版本独立，无「同代」概念**——dropdown-menu 与 context-menu 在 2.x 线，其余在 1.x 线。CI 断言版本与清单逐一相等。

### 12.3 Token 消费方式

`design-tokens.json` 是唯一事实源，构建脚本生成三份产物：`tokens.ts`（Canvas 与 Univer theme 注入——**Canvas 读不到 CSS 变量，必须走 JSON**，见 §11 已知坑表）、`design-tokens.css`（React 组件层）、`tailwind-preset.ts`（Tailwind `theme.extend`，只做「语义名 → `var(--token)`」映射，**不定义任何新颜色**）。三份产物文件头标 `@generated`，CI 校验重新生成后 git diff 为空。

```tsx
// 正确：语义工具类（prefix 'wo-'）
<div className="wo-bg-surface wo-text-fg wo-border wo-rounded-md">

// 正确：Canvas / Univer theme 走生成物
import { grid } from '@/styles/tokens';
univerAPI.setTheme({ borderColor: grid.line, headerBackgroundColor: grid.headerBg });

// 错误：hex 字面量（CI 的 wo/no-hardcoded-color 拦截）
<div style={{ background: '#059669' }}>
```

### 12.4 与 Univer 的样式隔离边界（硬约束）

本机实测 Univer 1.0.2 三份 CSS（design 75.7KB / ui 52.2KB / sheets-ui 29.2KB，合计 1738 条规则）：**裸元素选择器仅 2 条**（`*` 的 CSS 变量默认值与 scrollbar 复位），**无 html/body 重置、无 preflight**，`box-sizing` 只出现在 `.univer-box-border` 等类选择器上，且确有 4 条针对 `>ul:not(:last-child)` 的菜单规则。因此 Tailwind preflight 一旦全局生效，会在盒模型、表单控件 padding、ul 菜单三处与 Univer 直接对撞。

1. `apps/web/tailwind.config.ts` 必须 `corePlugins: { preflight: false }`（不接受「先开着看看」）
2. 自写 `.wo-shell` 作用域 reset（`preflight-scoped.css`），全部包在 `:where()` 内使特异性为 0；Univer 容器 `#univer-host` **不带** `.wo-shell`，二者是兄弟节点
3. CSS 引入顺序定死：`design-tokens.css` → `preflight-scoped.css` → `tailwind.css` → `@univerjs/*/lib/index.css`（Univer 官方要求其 CSS 最后加载）
4. Tailwind `content` 限定 `apps/web/src/**` 与 `packages/ui/src/**`，**必须排除 node_modules**（否则 @univerjs 包内文本被扫进产物）
5. 四条验证断言：V1 Univer 子树 `boxSizing` 保持 `content-box`／V2 canvas 与容器尺寸差 ≤1px／V3 preflight 开-关两构建三区截图零差异／V4 产物 CSS 中 `box-sizing: border-box` 只允许出现在含 `.wo-shell` 或 `.univer-box-border` 的选择器内

### 12.5 工程化目录（唯一口径）

```
web-office/
├─ apps/web/          Vite 7.3.7 + React 18.3 SPA（src/{main,app,pages,components,features,design,lib,styles}）
├─ apps/server/       NestJS 11.2.7（src/{main,modules,common,config,db}）
├─ packages/shared/   @wo/shared：DTO 类型 + zod schema + 错误码 + 纯函数；dependencies 只允许 zod
├─ packages/config/   tsconfig.* / eslint-preset / prettier.config / rules（自定义 P0 规则与其单测）
├─ scripts/           CI 断言脚本（docs 约束 / 样式约束 / openapi 契约 / 公式桶）
├─ eslint.config.mjs  根 flat config（import packages/config/rules）
├─ .npmrc             仅注册源与认证（pnpm 11 起其余设置写在此处不生效，见下）
├─ pnpm-workspace.yaml  supportedArchitectures=[linux,win32,darwin]×[x64,arm64]×[glibc]
│                      nodeLinker=isolated / saveExact=true / autoInstallPeers=false
│                      strictDepBuilds=true / engineStrict=true / pmOnFail=error
│                      allowBuilds={esbuild:true, '@scarf/scarf':false}
└─ pnpm-lock.yaml     唯一 lockfile
```

> **pnpm 11 配置模型（易错）**：pnpm 11 起非「注册源/认证」设置**不再从 `.npmrc` 读取**，全部迁移到 `pnpm-workspace.yaml`；`onlyBuiltDependencies` 被 `allowBuilds` 取代，`strictDepBuilds: true` 使未裁决的带脚本依赖安装期报错。写错位置不报错、只是静默不生效——属必须机检的配置项。另 `autoInstallPeers` 必须显式 `false`，否则 `@nestjs/swagger` 的 peer 会把已决定不进依赖树的 `class-validator` / `class-transformer` 自动装回。

分层规则：`apps/*` 可依赖 `packages/*`；`packages/shared` 只依赖 zod；`packages/config` 零运行时依赖；**反向依赖与跨 app 依赖禁止**。

### 12.6 P0 规则的工具层落点

| 项目级规则 | 落地形式 | 覆盖 | 不覆盖的部分如何补 |
|---|---|---|---|
| P0-1 禁 emoji | 自定义规则 `wo/no-emoji`（含 variation selector / ZWJ / tag sequence） | .ts/.tsx 的字符串、模板串、JSX 文本、注释 | 文档侧由 `scripts/check-docs-constraints.mjs` 用同一正则扫 `docs/**/*.md` |
| P0-3 禁硬编码颜色（例外 #fff/#000） | 自定义规则 `wo/no-hardcoded-color`（含 Tailwind 任意值类名） | .ts/.tsx | CSS 产物层由 `scripts/check-style-constraints.mjs` 的裸 hex 白名单断言覆盖（白名单从 tokens.ts 派生）；产物外链由 grep + CSP 兜底 |
| Spec §8 lucide-react 唯一图标来源 | 核心规则 `no-restricted-imports` | .ts/.tsx | review 时看 `packages/*` 与 `apps/*` 的 dependencies diff |
| 禁 AI 模板味文案 | 不做 lint 插件（避免引入 markdown 解析器与上百条无关规则） | — | `scripts/check-docs-constraints.mjs` 复读 §9 第 6 条词表，保证工具与文档同源不漂移 |
| 禁运行时外链 | 不做 lint | — | CI 对构建产物 grep + CSP 头（§11 已知坑第 3 行同名条款），责任人钉到 P3-037 |

> 自定义规则落 `packages/config/rules/` 普通目录（非 npm 包），**自带 RuleTester 单测**——规则自己写错是最致命的失效模式（P0 悄悄漏网）。不引入 stylelint：样式值全部走 `var(--color-*)` 或 Tailwind 语义类，既有裸 hex 脚本已覆盖实际风险面，第二套配置与依赖树不划算。

### 12.7 版本锚定清单（其余表格以此为准）

| 包 | 版本 | 包 | 版本 |
|---|---|---|---|
| Node.js | 22.22.2（`engines.node` 写精确值） | pnpm | 11.28.6（`latest-11` 通道） |
| TypeScript | 5.9.3 | Vite | 7.3.7 |
| React / React DOM | 18.3.1 | @vitejs/plugin-react | 5.2.0 |
| Univer OSS（全包同版本，Catalog 约束） | 1.0.2 | lucide-react | 1.61.0 |
| @fontsource/inter / noto-sans-sc / jetbrains-mono | 5.3.0 / 5.3.1 / 5.3.0 | tailwindcss | 3.4.19 |
| postcss / autoprefixer | 8.5.31 / 10.6.1 | @radix-ui/react-dialog | 1.3.1 |
| @radix-ui/react-dropdown-menu | 2.2.1 | @radix-ui/react-context-menu | 2.4.1 |
| @radix-ui/react-tooltip / toast / avatar / tabs / progress / popover | 1.4.1 / 1.3.1 / 1.3.1 / 1.2.1 / 1.2.1 / 1.3.1 | class-variance-authority / tailwind-merge / clsx | 0.7.1 / 3.7.0 / 2.1.1 |
| react-hook-form | 7.90.0 | zod | 4.6.7 |
| @hookform/resolvers | 6.0.0 | vitest / @vitest/coverage-v8 | 5.0.5 / 5.0.5 |
| jsdom（回退位 29.0.0） | 30.1.3 | @testing-library/react / dom / jest-dom / user-event | 16.3.3 / 10.4.2 / 7.0.1 / 14.6.8 |
| @playwright/test | 1.64.1 | jest / ts-jest（后端） | 30.5.2 / 29.4.15 |
| @nestjs/swagger | 11.4.7 | NestJS 全套 | 11.2.7 |
| eslint / @eslint/js | 9.39.5 / 9.39.5 | typescript-eslint | 8.72.0 |
| eslint-plugin-react / react-hooks | 7.37.5 / 7.1.1 | eslint-config-prettier / globals | 10.1.8 / 17.13.0 |
| prettier | 3.9.10 | verdaccio（交付侧） | 6.10.6 |

新增任何依赖的前提（五问）：npm 官方源可取 + tarball 完整 + 无固定 CDN 外链 + 无原生二进制（有则先过四象限验证）+ 许可证为 MIT/ISC/Apache-2.0/BSD（MPL 须标注，GPL/AGPL/SSPL 红线）。

---

## 13. Phase 3 设计走查清单（含实现锚点）

> 前端首迭代完成后执行。锚点由架构师提供（docs/frontend/theme-font-collab-integration.md），双方文档无分叉。

| # | 核对点 | 验证方式 / 实现锚点 |
|---|--------|---------------------|
| 1 | 116px 常驻断言 | 编辑器布局组件内断言 titleBar(44)+toolbar(40)+formulaBar(32) 三容器高度常量来自 tokens.ts layout 段，非硬编码 |
| 2 | banner 212px 变体 | grid 高度公式切换逻辑在编辑器布局组件；banner 存在性来自 license status 的 zustand store；核对 `calc(100vh - 212px)` / `calc(100vh - 180px)` 两态 |
| 3 | 跨刷新锁色 | 直接跑 `src/collab/color.ts` 单测（同一 userId 多次哈希结果一致 + 多 userId 分布断言），无需手工验证 |
| 4 | 协同 4 人阈值显隐 | 前端实现必须引用 Token（design-tokens.json `C_extension.collab` 的 `maxVisibleNameTags` / `maxVisibleAvatars`），不允许散落常量 4 |
| 5 | CI 裸 hex 白名单 | 查 `scripts/` 下与禁外联断言同一脚本的源码，确认白名单生成自 tokens.ts 编译产物（F4 交付物），无手工数组 |

走查通过标准：五项全部命中锚点且实现值与 Token 一致；任何一项失配即退回前端修正，不走「代码里打补丁」路径（见 §11 已知坑表最后两行）。

---

## 14. 变更记录

| 日期 | 变更内容 | 原因 | 影响范围 |
|------|----------|------|----------|
| 2026-10-21 | v1.0.0 首版：Token 四层体系 + 组件规范 + 协同可视化规范 | 基于 Spec v1.0.0 §8 与 Phase 1 设计方向 | 全部页面 |
| 2026-10-21 | v1.0.1 微调：移除分享入口（P1 功能本期不渲染，仅在设计文档标注预留位），编辑器强调色配额改为「选中单元格描边 + 激活 Sheet 标签下划线」一组 | team-lead 裁决：分享为 P1 且后端无 API，「可见但禁用」属无效视觉负担 | pages.md §2.3 行菜单 / §3.2 标题栏 / 附录 A；DESIGN.md §1 原则 3、§2 配额表 |
| 2026-10-21 | v1.0.2 对齐架构集成契约：协同配色改为 userId 确定性哈希（fnv1a32 % 8 + awareness 自带 color 字段，弃用 clientId 取模）；只读提示条挂载点改为应用布局根、标题栏栈之外，出现时网格高度 `calc(100vh - 212px)`；已知坑表补字体就绪时序、禁外联断言、只读三层防线 | 架构师 v2 集成契约（docs/frontend/theme-font-collab-integration.md）：clientId 为连接级随机值不可锁色；116px 为 Spec §8 常驻态硬上限，banner 不得入栈 | DESIGN.md §2 协同分配规则 / §11 已知坑；pages.md §3.1 / §3.3 / §3.10 |
| 2026-10-21 | v1.0.3 已知坑表补两行闭环条款：表头底色 V 项微调授权边界（neutral.150/200 二选一 + 三步回报流程）、grid-line 调用点禁 hex 字面量（CI 白名单由 tokens.ts 派生） | 架构师确认微调授权与禁裸 hex 方案，防止 Token 改色后双保险分叉 | DESIGN.md §11 |
| 2026-10-21 | v1.0.4 新增 §13 Phase 3 设计走查清单（五核对点 + 架构师实现锚点 + 通过标准） | 活规格原则：走查口径落在文档而非聊天记录，QA/前端可直接引用 | DESIGN.md §13 |
| 2026-10-21 | v1.0.5 补白名单外函数 UI（PM 口径）：pages.md 新增 §3.10bis（文件级提示条挂公式栏之下 32px info 蓝系 + 缓存值右上角 AlertCircle 琥珀角标 + Canvas 层绘制 + 不渲染场景）；DESIGN.md §4.7 Tooltip 补多行等宽变体、§8.4 状态矩阵补缓存值行 | 公式白名单扩为 119 个场景集后，导入白名单外公式改为「保留公式文本+显示缓存值」，需文件级与单元格级双层提示 | pages.md §3.1/§3.10/§3.10bis/§3.11；DESIGN.md §4.7/§8.4 |
| 2026-10-21 | v1.0.6 技术标注（架构师落，版式零改动——设计师不返工）：§3.10bis 提示条文案换 PM 定稿原文（「本文件含 N 个暂不支持自动重算的公式，其值已按导入时结果保留；点击单元格右上角标记可查看原公式，导出时公式将完整还原」）、出现条件与角标语义范围收窄为「无法自动重算格」（桶 II/桶 III/差分降级格——引擎可用区差分通过格与白名单公式同权，无角标不计 N）；导入报告新增差分正面条目文案（「兼容函数集命中：M 个公式，涉及函数 ...——已与导入结果逐格核对一致」，落 import_tasks.detail）；DESIGN.md §8.4 缓存值行同步 v1.5 口径 | PM 桶 I 裁决（方案 b 引擎可用区差分导入）+ team-lead 收尾裁定：桶 I 政策 RESOLVED 以 PM 裁决为准，UI 口径随差分导入收窄角标范围 | pages.md §3.10bis；DESIGN.md §8.4 |
