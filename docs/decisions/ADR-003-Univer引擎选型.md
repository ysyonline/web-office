# ADR-003: 表格引擎采用 Univer OSS 1.0.2（渲染/编辑/公式），协同与导入导出自建

## Status: Accepted (2026-10-21)

## Background

渲染路线候选：完全自研 Canvas / DOM+虚拟滚动 / Univer OSS / Luckysheet / Fortune-sheet / Handsontable 商业版。用户明确表示听架构师的。

## Decision

采用 **Univer OSS v1.0.2（@univerjs/* 全包同版本，Apache-2.0）**：Canvas 自绘渲染 + 500+ 函数公式引擎 + Node 无头模式，覆盖渲染/编辑/公式三大块。

**边界决策**：实时协同、xlsx 导入导出、编辑历史、图表均属 Univer Pro 商业版（未授权限 3 人协同/导入 1MB）——协同自建（ADR-001）、导入导出用 SheetJS 0.20.3 读 + ExcelJS 4.4.0 写 + 自研 snapshot 转换层（docs/import-export/plan.md）。

## Consequences

- 正面：开发成本最低的强性能路线（官方基准 600 万格 50-60FPS，满足 5 万行×20 列性能红线）；公式引擎与数据层同语言可服务端权威重算；Apache-2.0 无传染可商用
- 负面：包体约 1.8MB gz（用 Preset 按需 + 路由懒加载缓解）；商业化开源/Pro 边界可能变动（锁 1.0.2 + 协同/导入导出握在自己手里对冲）；必须遵守其数据层纪律（一律走 Command API，禁直改 snapshot）
- 否决项：完全自研（6-12 个月 MVP 不可承受）、Luckysheet（2025-10 已归档）、Fortune-sheet（弱维护）、Handsontable（商业收费且不含公式引擎）、DOM 路线（10 万格性能天花板）

## Related ADRs

ADR-001（协同架构）、ADR-002（数据层）
