# ADR-006: 采用 Tailwind CSS 3.4.19，否决 Tailwind v4

## Status

Accepted（2026-10-22，P3-001 工程化基线评审）
**注**：本条由 team-lead 代行裁定落盘（架构师裁决正文未送达，沿用 ADR-001 v1.8 先例，待架构师复核）。技术证据（版本、浏览器下限、原生件可得性）由前端专家实测并由 team-lead 独立复核。

## Background

`docs/design/DESIGN.md` §11 已存在一段完整的 `tailwind.config.ts` 映射片段（colors / fontFamily / fontSize / spacing / borderRadius / boxShadow 全部指向 CSS 变量），但**全项目从未正式裁决是否采用 Tailwind**——设计侧事实上已按 Tailwind 写，工程侧零命中（OPEN-DECISIONS「工程化基线 7 项缺口」第 ① 项）。

同时 Spec §10 明确浏览器下限为 Chromium 内核 100+，且「国产浏览器内核版本普查」仍是 OPEN 项。

## Decision

采用 **Tailwind CSS 3.4.19**（PostCSS 模式）+ postcss 8.5.31 + autoprefixer 10.6.1，设计侧 §11 的映射片段继续有效、零返工。

**否决 Tailwind 4.3.3，两条理由，主次分明：**
1. **（决定性）官方 browser-support 明示 v4 面向 Chrome 111 / Safari 16.4 / Firefox 128**（依赖 @property、color-mix()、CSS 嵌套），**高于本项目的 Chromium 100+ 下限**，国产浏览器普查未完成前不得把下限抬到 111
2. （次要）`@tailwindcss/vite` → `@tailwindcss/node` → **lightningcss（MPL-2.0 + 原生平台包）**，另有 `@tailwindcss/oxide`（Rust 原生），同时踩「许可证标注」与「最小化原生二进制面」两条硬约束

并强制三条与 Univer 共存的硬约束（详见 DESIGN.md §12.4）：`corePlugins.preflight = false`、自写 `.wo-shell` 作用域 reset（包在 `:where()` 内使特异性为 0）、`content` 必须排除 node_modules。

## Consequences

**正面**
- 3.4.19 实测 optionalDependencies 为空，纯 JS PostCSS 路线，信创四象限零原生编译链风险
- npm 有官方 `v3-lts` dist-tag（3.4.19），长期有补丁
- 产物为常规 CSS，天然满足 Chromium 100；设计文档零返工

**负面**
- Tailwind 3 已进入维护态，生态插件会逐步要求 v4；升级窗口被浏览器普查结论锁住
- 必须额外维护一份 `.wo-shell` 作用域 reset 与四条验证断言（V1-V4），这是「关掉 preflight」的代价

**关键纪律**
> 「信创原生二进制不可得」**不能**作为否决理由。实测 `@tailwindcss/oxide@4.3.3` 的 aarch64 产物存在且 glibc 下限仅 2.17（麒麟 V10 的 2.17/2.28、统信 UOS 的 2.28 全满足），esbuild / rollup / rolldown / lightningcss 的 aarch64 产物同样全部可得且下限同为 2.17。本轮该论据已被两次证伪；**真实否决理由只有浏览器下限**。若用站不住的论据否决，后续有人拿实测数据翻案时会把正确结论一起推翻。

**重评触发器**
国产浏览器内核普查结论明确下限 ≥ Chrome 111，或客户书面确认浏览器基线高于此 → 重新评估 4.x（届时仍需处理 lightningcss 的 MPL-2.0 标注）。

## Related ADRs

ADR-005（pnpm **11.28.6**，同为「离线/原生二进制最小化」口径）、ADR-007（自研原子组件，Tailwind 提供样式承载）、ADR-003（Univer 引擎选型，样式隔离的对手方）。
