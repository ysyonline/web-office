# 前端主题/字体/协同色集成契约（Univer x Design Token）

> 版本：v1.1（变更记录见文末）
> 产出人：高见远（首席架构师） | 依据：design-tokens.json v1.0.2（设计师 Phase 2 交付）+ Spec §8
> 状态：Phase 2 集成契约（已冻结，实现期变更走 §8 版本管理与冲突仲裁机制）；标注【已验证】的条目均在 spike 环境（@univerjs/* 1.0.2 实机源码级核查）确认，标注【V 项】的为前端首个迭代内 0.5 天级验证项（含兜底方案，不阻塞排期）

---

## 1. Token 注入 Univer：构建时生成 tokens.ts + 自定义 Theme

### 1.1 构建期流水线（不引入运行时解析）

```
docs/design/design-tokens.json
  └─(构建脚本 scripts/gen-tokens.mjs，vite build 前置)
      ├─ src/styles/tokens.ts        # 扁平化 TS 常量（DOM 层组件也复用，替代 CSS var 解析）
      ├─ src/styles/tokens.css       # 现有 design-tokens.css 原样拷贝（DOM 层 CSS 变量）
      └─ src/univer/theme.ts         # Univer Theme 对象（见 1.2）
```

- `tokens.ts` 生成规则：仅展开 `A1_primitive` + `A2_semantic` + `C_extension` + `layout` 中被代码消费的键，输出 `as const` 字面量类型（编译期防拼写错误）；`{A1_primitive.color.neutral.250}` 引用语法在生成脚本内解析为 `#E2E8F0`。
- JSON 是唯一事实源：改 Token 只改 JSON，重新构建即全链路生效；`tokens.ts`/`theme.ts` 生成物进 `.gitignore`（或进仓库但 CI 校验一致性，二选一，前端迭代定）。

### 1.2 Univer Theme 映射表【已验证】

Univer 1.0.2 的 theme 对象结构（`@univerjs/themes` 的 `Theme` 类型）与映射：

| Univer Theme 键 | design-tokens.json 来源 | 说明 |
|---|---|---|
| `primary.50..900` | `A1_primitive.color.emerald.50..900` | 品牌主色阶完整搬入（选中态/强调按钮取 primary.600=#059669） |
| `gray.0..1000` | `A1_primitive.color.neutral.*`（gray.0=neutral.0，其余对位；gray.1000=neutral.900） | 关键：**网格线颜色由 gray 派生**（见 1.3） |
| `loop-color.1..8` | `A1_primitive.color.collab.1..8` | 协同光标 8 色（见第 3 节） |
| `red/amber/green/blue` | 同名 primitive 色阶 | 语义色兜底 |
| 其余键（orange/yellow/purple/pink/jiqing/indigo/highlight） | 保留 defaultTheme 原值 | 本项目不消费，不篡改 |

注入方式【已验证】：`new Univer({ locale, locales, theme: officeTheme })`；运行时切换走 `injector.get(ThemeService).setTheme(theme)`（MVP 浅色单主题，预留接口不实现切换 UI）。

### 1.3 Canvas 网格线/表头取色机制【已验证 + 1 个 V 项】

- 网格线：渲染层 `Spreadsheet` 订阅 `themeService.currentTheme$`，默认网格线色 = `ColorKit.mix(gray200, gray900, 0.07)` —— 即**由 theme.gray 色阶自动推导**，随主题注入生效。代入我们的 neutral 色阶（200=#E5E7EB, 900=#111827）算得约 #DCDEE2，与 Token `--grid-line`(#E2E8F0) 存在轻微偏差。
- **精确对齐手段**：Univer 提供 worksheet 级 `set-gridlines-color` mutation（源码级确认存在），建文件/加载快照时显式设为 `#E2E8F0`，偏差问题关闭。
- 表头底色/表头文字：由渲染层 stylesheet 默认值绘制（`IHeaderStyleCfg: fontFamily/fontColor/fontSize/borderColor`）。**V 项**：确认 1.0.2 中该 cfg 的配置入口（worksheet 配置或 spreadsheet 组件 stylesheet 参数）。兜底方案：theme.gray 已生效部分（表头边线等）接受推导值；表头底若无法精确 #F1F5F9，用自定义 header 渲染扩展（engine-render 支持组件扩展）覆盖 —— 影响面仅视觉微差，不阻塞。
- 单元格默认字体：快照默认样式设 `fontFamily: 'JetBrains Mono' + fontSize 13`（走 workbook/snapshot 默认样式而非逐格设置）。**V 项**：确认默认样式注入点（snapshot styles.defaultStyle 或 worksheet 默认样式配置）；兜底为应用层在创建快照时写入全表默认样式记录。

## 2. 字体本地打包（离线交付，运行时网络白名单 = 空）

### 2.1 选型：@fontsource npm 包（不手工管理字体文件）

| 字体 | npm 包 | 交付体积（估） | 说明 |
|---|---|---|---|
| Inter | `@fontsource/inter`（400/510/590 权重） | ~300KB woff2 | 权重对应 Token fontWeight regular/medium/semibold |
| Noto Sans SC | `@fontsource/noto-sans-sc`（同三权重） | ~2-4MB/权重（CJK 按 unicode-range 切 ~100 个子集文件，浏览器按需加载，**本地静态资源非 CDN**，断外网无影响） | 中文字形主力 |
| JetBrains Mono | `@fontsource/jetbrains-mono`（400 即可，单元格数据不强调粗体） | ~100KB | 公式栏/单元格 |

理由：字体作为 npm 依赖进 lockfile，**自然进入 verdaccio 离线源清单**（Spec §4 部署行），无需在安装包里单独维护字体目录；离线安装包体积增量约 5-10MB，可接受（对比：镜像本身含 Node 运行时 ~100MB 级）。

### 2.2 加载顺序契约（Canvas 度量正确性）

Canvas 引擎在首帧测量列宽/行高时若字体未就绪，会按回退字体度量导致列宽错位。契约：

1. `index.html` 对三款字体的 latin 子集做 `<link rel="preload" as="font">`（仅 latin 核心 + mono，CJK 子集量大走懒加载）；
2. Univer 挂载前 `await document.fonts.load('13px "JetBrains Mono"')` + `document.fonts.ready`（编辑器路由组件内 await，不在全局阻塞首屏）；
3. 编辑器路由为懒加载 chunk（Phase 1 选型第 9.5 条），字体资源随编辑器 chunk 预取。

### 2.3 禁外链断言（进 CI）

- 构建产物扫描：`grep -r "fonts.googleapis\|fonts.gstatic\|cdn\." dist/` 必须零命中；
- index.html CSP 头（Nginx 交付配置）：`font-src 'self'`；
- 依赖审计：`@fontsource/*` 三个包必须出现在 verdaccio 离线同步清单（交付脚本 `offline-manifest.txt`）。

## 3. 协同光标 8 色分配（一处更正 + 确定性算法）

### 3.1 对设计师方案的更正：不能按 clientId 取模

Yjs 的 `clientId` 是**每次创建 Doc 连接时随机生成的会话值**——同一用户刷新页面后 clientId 变化。按 clientId 取模无法满足「同一用户刷新不变」。**分配键必须用 userId（业务身份，稳定）**。

### 3.2 确定性分配算法（各端独立计算，结果全端一致，零协商）

```typescript
// src/collab/color.ts —— 唯一实现点，前端 awareness 初始化处统一调用
import { collabPalette } from '@/styles/tokens'; // ['#2563EB','#E11D48',...]

/** FNV-1a 32 位哈希：稳定、无依赖、跨端一致 */
function fnv1a32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 颜色索引 = 哈希(userId) 对 8 取模。纯函数 -> 所有客户端算出同一结果 */
export function collabColorIndex(userId: string): number {
  return fnv1a32(userId) % collabPalette.length;
}
```

- 每个客户端在 awareness 状态里**自带** `color` 字段（`setLocalStateField('user', { userId, name, color })`），不依赖接收端计算——从协议上消除各端不一致的可能；
- 碰撞（两个用户同色）概率 1/8，接受（Gmail Sheets 同策略）；席位 ≤50 时平均 ~6 对同色，不影响可辨识度主指标；
- 头像/名字标签渲染（DOM 层）直接读 awareness 里的 color；若后续引入 Univer 原生远程光标渲染，`theme.loop-color.1..8` 已按同序注入（1.2 表），两侧色值同源。
- 顺序约定：调色板索引以 `design-tokens.json A1_primitive.color.collab.1..8` 的**数字序**为准，`collabPalette` 由构建脚本生成，禁止手工排序。

## 4. 只读态提示条挂载点（回复设计师 3.10 节）

设计方案的 32px 提示条 + 工具栏 Disabled + 公式栏 readOnly 认可，挂载点约定：

1. **挂载位置：应用布局根（TitleBar 之上）的条件行**，不属于 116px 标题栏栈——`headerTotal: 116px` 是 Spec §8 硬上限，提示条若插入标题栏栈内部会吃掉上限预算。布局为：
   ```
   [readonlyBanner 32px]   ← 条件渲染（License 无效时）
   [titleBar 44px]
   [toolbar 40px]
   [formulaBar 32px]
   [grid ...]               ← 高度 = 100vh - 116 - 36(sheetBar) - 28(statusBar) - (banner 存在时 32)
   [sheetBar 36px]
   [statusBar 28px]
   ```
   即 grid 高度基础值 `calc(100vh - 180px)`（设计师公式确认），banner 出现时 `calc(100vh - 212px)`。
2. **三层只读强制**（UI 只是最后一层）：
   - 后端：写 API 返回 402/错误码 5001（openapi.yaml 已定义），WS 写操作以 close code 4409 断开；
   - 前端命令层：`commandService.beforeCommandExecuted` 拦截所有 `CommandType.MUTATION` 且非 `fromCollab` 的命令返回 false（License 无效时）——比逐个禁用按钮更可靠，工具栏 Disabled 为视觉反馈而非防线；
   - UI 层：banner + 工具栏 Disabled + 公式栏 readOnly（设计方案）。
3. banner 用 `--color-warnBg/#FFFBEB + 1px 下边框 #D97706`（Token `C_extension.readonlyBanner`），状态来源：`GET /api/v1/license/status` 轮询（60s）+ 写操作收到 5001 时立即刷新。

## 5. 落地任务清单（前端首个迭代认领）

| # | 任务 | 量级 | 依赖 |
|---|---|---|---|
| F1 | `scripts/gen-tokens.mjs` 生成 tokens.ts/theme.ts（含引用语法解析与 FNV 色板导出） | 1d | 无 |
| F2 | `src/collab/color.ts` + awareness user state 注入（含单测：同一 userId 各端同色） | 0.5d | F1 |
| F3 | 【V 项】表头样式配置入口 + 单元格默认字体注入点验证（兜底方案见 1.3） | 0.5d | F1 |
| F4 | @fontsource 三包接入 + preload/`document.fonts.load` 时序 + CI 禁外链断言 | 0.5d | 无 |
| F5 | 只读三层强制（beforeCommandExecuted 守卫 + banner 挂载 + 布局公式） | 1d | F1 |

F1-F5 合计 3.5 人日，归入 Phase 3 前端首迭代；F3 为唯一验证项且带兜底，不构成排期风险。

## 6. 补充约束（2026-10-21 与设计师 v1.0.2 对齐后追加）

1. **F3 表头底色微调授权边界**（设计师已确认）：若自定义 header 渲染扩展兜底后仍有视觉微差，仅允许 neutral.150(#F1F5F9) 与 neutral.200(#E5E7EB) 两档二选一；微调必须以「V 项验证结论」回报（含截图对比与原因）并同步修改 design-tokens.json 的 `--grid-header-bg` 后重新生成 tokens.ts。三步缺一不可。
2. **禁裸 hex 字面量**：网格线/表头色等 Canvas 显式值（如 set-gridlines-color 的入参）必须引用 tokens.ts 生成产物，源码禁止出现 Token 覆盖色域的 hex 字面量——否则 theme 推导值与显式值在 Token 变更时会漂移。CI 校验与禁外链断言同一脚本：白名单由 tokens.ts 生成物自动派生，非手工维护。
3. banner 高度引用 Token `--height-readonly-banner`（v1.0.2 新增），布局代码不写裸 32px。

## 7. 产物引用与 hex 白名单（v1.1 新增）

**可引用产物（合法取色来源，穷举）**：源代码/组件中的颜色与尺寸值只允许从以下四类产物引用：

| 产物 | 用途 | 引用方式 |
|---|---|---|
| `design-tokens.css` | DOM 层 CSS 变量 | `var(--color-*)` / `var(--height-*)` |
| `design-tokens.json` | 唯一事实源（构建输入） | 仅构建脚本消费，业务代码不直接 import |
| `src/styles/tokens.ts` | TS 常量（构建生成） | `import { grid } from '@/styles/tokens'` |
| `src/univer/theme.ts` | Univer Theme（构建生成） | `new Univer({ theme })` |

**裸 hex 白名单规则**：源代码中出现裸 hex 颜色字面量时，lint 按以下规则判定：

1. **白名单范围**：`A1_primitive` 语义色阶（emerald/neutral/red/amber/green/blue/collab）与结构性颜色变量（A2_semantic、C_extension 派生值）中已在 tokens.ts 生成产物内的 hex 值——白名单文件由构建脚本从 tokens.ts 生成物自动派生（第 6.2 条），非手工维护；
2. **白名单命中**：允许（等价于引用生成产物的内联写法，lint 不报错；评审仍优先要求改引用）；
3. **白名单未命中**（即 4 类产物命名空间以外的 hex）：走 lint 白名单流程——提交 PR 时必须附「新增 hex 值的 Token 归属说明」，经设计走查确认后先入 design-tokens.json 再生成，禁止直接把 hex 加进白名单文件；
4. **豁免范围**：设计文档类 `.md` 文件中的 hex 示例（如 DESIGN.md/pages.md 的色值标注）不计入 lint；`index.html`/`manifest` 等非 TS/CSS 构建产物按 3 同流程人工审。

## 8. 版本管理与冲突仲裁（v1.1 新增）

本文件与设计侧 DESIGN.md 为姊妹契约（同一事实源的两个视图）。实现期变更遵循双向机制：

1. **设计侧变更**：DESIGN.md 的变更记录（v1.0.x 迭代）优先，本文件受影响时在下一版本就地补章同步，保持两文件对同一规则无冲突表述；
2. **架构侧变更**：本文件升级补章（版本号递增 + 变更记录），设计侧 DESIGN.md 受影响时由设计侧同步（参照本次 v1.0.2 → v1.0.4 的同步路径）；
3. **两处矛盾时**：暂停相关编码，先仲裁——**谁先动谁改**（后动一方回撤至先动方的版本，或双方协商出一致版本后再恢复编码），仲裁结论回写双方文档并同步 Spec 变更记录（若触及 Spec 锁定项）；
4. **走查基线**：Phase 3 设计走查（DESIGN.md §13）以「走查当日两文件的最新一致版本」为基线。

## 变更记录

| 版本 | 日期 | 变更 | 原因 |
|---|---|---|---|
| v1.0 | 2026-10-21 | 首版：主题注入/字体离线/协同色算法/只读态四块集成契约 + F1-F5 任务 | 设计 Token 交付后架构认领 |
| v1.0.1 | 2026-10-21 | 新增 §6 补充约束（F3 微调授权边界、禁裸 hex、banner 高度 Token 引用） | 与设计师 v1.0.2 对齐 |
| v1.1 | 2026-10-21 | 新增 §7 产物引用与 hex 白名单、§8 版本管理与冲突仲裁；文档头部加版本号与状态更新 | Phase 3 前统一送审，消息中的两条增量并入文档 |
