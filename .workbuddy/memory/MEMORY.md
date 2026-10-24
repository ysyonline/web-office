# 项目记忆 web-office
1 先评审后动手：任何包开工前先做需求评审（判「按 Spec 有无独立实体内容」），结论经用户确认，再一包一包做、一步一停。
2 门禁唯一入口 node scripts/verify.mjs，段数以末行「N/M 段通过」为准；面板只由 python -X utf8 scripts/gen_status_panel.py 刷新，禁手改。
3 机读数字回原始文件重算，计数带「分子/分母口径/时点(HEAD)」；冻结配平不改数。
4 每文件 deny 独立：先试一次，失败转用户终端；git 会静默失败，用 Read/Grep 实证。
5 生成物只改产物=没改：改台账必改 scripts/gen_phase3_backlog.py 源（OVERRIDES / BAND_EXCEPTIONS / MERGED_INTO 三类登记），重跑后逐行 diff 核对。
6 细节见 .workbuddy/memory/archive/ 下 slim-2026-10-24-2102 与 full-2026-10-24-2055（SM2 四口径、卡体量在册数、OPEN-DECISIONS 计数、pnpm 跑法）。
