# 项目长期记忆（web-office）

## 文档纪律（2026-10-22 立）

- **中间评审文档（挑刺/回执/审核/handoff）在结论落盘后即清理**，不留双份。落盘 = 写入设计卡 / DESIGN-LAYER §2.2 / OPEN-DECISIONS / 生成器 / 台账。
- **清理顺序铁律**：先核验每条结论有载体 → 只写在评审文档里的规约补进硬约束 → 再移走原文。顺序颠倒会静默丢失规约（本轮就抓到「不引 openapi 行号」一条只存在于待删文档）。
- 删除用 `mv` 到 `.workbuddy/trash/<日期>/`，不用 `rm`；`.workbuddy/` 本身不是缓存，不能整体删。
- **出处不引行号**，按 schema 名 / §符号 grep（行号随契约落盘结构性漂移）；**卡体量以字符数度量**，不以行数。
- 保留件：`docs/REVIEW-INDEX.md`（统一入口 + 线程段 + 归档表）、`docs/phase3/P3-001-工程化基线裁决记录.md`（卡内出处引用本体）、`docs/decisions/REVIEW-CLOSING.md`（档一/档二门禁）。

## 状态面板（2026-10-22 立）

- `docs/status-panel.html` = 需求/设计/评审/拆分单文件面板；**唯一刷新方式** `python -X utf8 scripts/gen_status_panel.py`，禁止手改 HTML。
- 面板自带口径校验带：解析 DESIGN-LAYER「去重后 N 工作项 / M 包 / H h」并与机读值比对，不一致转红。改卡表后必须先刷面板看这条是否变红。
- 判定口径：需求评审看 REVIEW-INDEX 线程段；设计文档看 DESIGN-LAYER §3.1 覆盖列 + 卡文件是否存在；卡评审只认 REVIEW-INDEX 里的卡号线程段；未决数按 OPEN-DECISIONS 中 OPEN 行提及的工作项ID 计。

## B1 代码基线（2026-10-22 立，P3-010）

- 骨架：root `package.json`（packageManager pnpm@11.28.6、engines >=22.13 <23）+ `pnpm-workspace.yaml`（pnpm 11 配置模型：`pmOnFail: error` / `engineStrict` / `saveExact` / `autoInstallPeers: false` / `allowBuilds`）+ `packages/config`（tsconfig 三段 + flat preset + rules）+ `packages/shared`（双构建 esm/cjs，deps 只允许 zod）。
- **自检唯一入口**：`pnpm verify`（格式→lint --max-warnings=0→tsc→规则测试→依赖面断言）。根 scripts **不嵌套调 pnpm**（本机 shim 绑 Node 20 会崩）；本机跑法见 `docs/phase3/ANCHORS.md §0`。
- 三条 P0 一律 error：`wo/no-emoji`（扫解码值+注释）、`wo/no-hardcoded-color`、`no-restricted-imports`（10 个第二图标源）。规则测试必须 valid+invalid 双向，且**测试文件里不写真 emoji**（用 `String.fromCodePoint`）。
- 坑：块注释内不写 glob（`**/` 会提前闭合注释）；`node --test <目录>` 在 Windows 不递归 `.ts`，要显式列文件。
- 包级锚点台账 = `docs/phase3/ANCHORS.md`（一包一行：产出物路径/检查命令/通过判据），派单前先填这里。
- **仓库尚未 git init**（2026-10-22 状态）；按用户纪律只提交不推送。
