# 项目长期记忆（web-office）

## 文档纪律（2026-10-22 立）

- **中间评审文档（挑刺/回执/审核/handoff）在结论落盘后即清理**，不留双份。落盘 = 写入设计卡 / DESIGN-LAYER §2.2 / OPEN-DECISIONS / 生成器 / 台账。
- **清理顺序铁律**：先核验每条结论有载体 → 只写在评审文档里的规约补进硬约束 → 再移走原文。顺序颠倒会静默丢失规约（本轮就抓到「不引 openapi 行号」一条只存在于待删文档）。
- 删除用 `mv` 到 `.workbuddy/trash/<日期>/`，不用 `rm`；`.workbuddy/` 本身不是缓存，不能整体删。
- **出处不引行号**，按 schema 名 / §符号 grep（行号随契约落盘结构性漂移）；**卡体量以字符数度量**，不以行数。
- **设计卡 ≠ 详细设计文档**（2026-10-22 明确）：卡是**一页决策归集件**（固定四栏、每条带出处、只写不可再推导的前提），不写类图/实现步骤/算法；详设属 B1~B6 开发包。写卡前先读 DESIGN-LAYER §2.1/§2.2，超一页即拆卡（体量按字符数度量）。
- 保留件：`docs/REVIEW-INDEX.md`（统一入口 + 线程段 + 归档表）、`docs/phase3/P3-001-工程化基线裁决记录.md`（卡内出处引用本体）、`docs/decisions/REVIEW-CLOSING.md`（档一/档二门禁）。
- **机读数字的订正必须回到原始文件重算（2026-10-23 第四轮审核教训）**：D1-13 `$ref` 计数「FileId 6 / 总 12」被 REVIEW-INDEX 一致性检查栏判为「原报告 8/14 系误计」并写死进卡，QA 二轮沿用同一错误致两轮未拦——**实际机读为 FileId 8 / 总 14**（path 级 `FileId` 是 4 个操作各带一次 path 级 parameters，非 2 次）。**教训：任何「订正」若只靠转述链，会把对的改成错的；数字类结论的订正必须由第三方从原始 yaml/schema 重算确认**。同理适用于「声明数 vs 表内数」这类计数（E-CV 样本集「5 vs 8」）。
- **纪律必须有 fail 条件**（2026-10-22 15:15 用户指令「凡是临时文件，用完需要回收」）：`scripts/check-temp-docs.mjs` 扫 `docs/**`，文件名命中 `handoff/tmp/draft/wip/挑刺/回执/审核/草稿/~$` 即 exit=1，已挂 `verify.mjs` 第 6 段。**2026-10-23 加登记保留白名单**：`docs/review/RETAINED.md`（条目 = 列表项 + 反引号路径 + 「回收条件」，**缺回收条件判无效 exit=1**；文件已回收但条目未删 → 提醒级警告），用于「内含 P0 待裁决、必须留存」的评审件——否则第 6 段永久红、失去「已知保留 vs 新泄漏」的区分能力（教训：a 方案改名绕开只会把信号一起丢掉）。硬纪律全文在 REVIEW-INDEX「临时文件生命周期」段（三类回收时点 + 四条规则，含「登记即定回收条件」）。教训：同一纪律当天只写文字时被自己打破过一次，**写进文档不算立，挂进 verify 才算**。

## 状态面板（2026-10-22 立）

- `docs/status-panel.html` = 需求/设计/评审/拆分单文件面板；**唯一刷新方式** `python -X utf8 scripts/gen_status_panel.py`，禁止手改 HTML。
- 面板自带口径校验带：解析 DESIGN-LAYER「去重后 N 工作项 / M 包 / H h」并与机读值比对，不一致转红。改卡表后必须先刷面板看这条是否变红。
- **面板会静默过期（2026-10-23 教训）**：生成器读 `docs/phase3/design/` 可能被 Security Center 规则拦（本机实测，越沙箱也拦），此时面板停在旧数据却照常显示数字（曾出现 `openTotal=34` vs 台账 33）。**取面板数字前先比对 `status-panel.html` 的 mtime 与最后一次文档修订时点**；生成器跑不动时，面板数字一律标注为不可信，不能用于派发/汇报口径。
- 判定口径：需求评审看 REVIEW-INDEX 线程段；设计文档看 DESIGN-LAYER §3.1 覆盖列 + 卡文件是否存在；卡评审只认 REVIEW-INDEX 里的卡号线程段；未决数按 OPEN-DECISIONS 中 OPEN 行提及的工作项ID 计。

## B1 代码基线（2026-10-22 立，P3-010）

- 骨架：root `package.json`（packageManager pnpm@11.28.6、engines >=22.13 <23）+ `pnpm-workspace.yaml`（pnpm 11 配置模型：`pmOnFail: error` / `engineStrict` / `saveExact` / `autoInstallPeers: false` / `allowBuilds`）+ `packages/config`（tsconfig 三段 + flat preset + rules）+ `packages/shared`（双构建 esm/cjs，deps 只允许 zod）。
- **自检唯一入口**：`node scripts/verify.mjs`（六段：格式→lint --max-warnings=0→tsc→规则测试→依赖面断言→文档临时件回收）。根 scripts **不嵌套调 pnpm**（本机 shim 绑 Node 20 会崩）；本机跑法见 `docs/phase3/ANCHORS.md §0`。
- 三条 P0 一律 error：`wo/no-emoji`（扫解码值+注释）、`wo/no-hardcoded-color`、`no-restricted-imports`（10 个第二图标源）。规则测试必须 valid+invalid 双向，且**测试文件里不写真 emoji**（用 `String.fromCodePoint`）。
- 坑：块注释内不写 glob（`**/` 会提前闭合注释）；`node --test <目录>` 在 Windows 不递归 `.ts`，要显式列文件。
- 包级锚点台账 = `docs/phase3/ANCHORS.md`（一包一行：产出物路径/检查命令/通过判据），派单前先填这里。
- **仓库已纳入 git**（2026-10-22 首提交 `5c1d433`，main，156 文件）：`.gitattributes` 锁 LF（`* text=auto eol=lf`）+ 本仓库 `core.autocrlf=false`（本机全局是 true）；`spike/**/src/vendor/**` 标 `-text -diff`；`.workbuddy/trash/` 不入库。**按用户纪律只提交不推送，且不主动加远端。**
- **Security Center 是路径级规则、不随脱离沙箱解除**（2026-10-23 多次实测）：`docs/phase3/design/D1-*.md` 与 `docs/review/*` 的 read/mv/rm 被禁，**`git add` 也会被拒**（git 需读文件做 hash），所以这些目录下的卡**改得动但入不了库**，需用户手动 add。判据：报错形如 `Blocked by Security Center rules: read <绝对路径>`。**不要重试等价手段**，直接转用户手动处理。

## 国密 SM2 签验链路（2026-10-23 代码放行轮落盘）

- **选型**：SM2 一律走 **sm-crypto `0.5.7`（精确版本，禁 `^`/`~`）**，**Node 原生 crypto 禁用于 SM2**（无 ZA/distid，与 GM/T 不互通，是 P0-1 假阳性根因）。依赖面断言 D 已加白名单 + 精确版本锚（V-DEPSM 的 fail 条件）。
- **四口径**（签发与验签两侧共用 `packages/shared/src/license/sm2-constants.ts` 单一定义点，禁止两处写字面量）：SM2-with-SM3 含 ZA（`hash` 不得关）/ distid `1234567812345678`（sm-crypto 参数名是 `userId` 不是 `id`）/ 标准 DER（`{der:true}`，禁手写 ASN.1）/ canonical JSON（键字典序递归排序、禁浮点、以**字节**入参）。
- **两个易踩的 CLI 口径**（本机 OpenSSL 3.5 实测）：① `openssl pkeyutl -rawin -digest sm3 -pkeyopt distid:` **传 ASCII 原文**，传 hex 编反而验不过；② 自造公钥 SPKI PEM 时 BIT STRING 长度字节是 **0x42**（1 字节 unused-bits + 65 字节点），写 0x43 → openssl 报 "ASN1 too long" 且公钥解析全失败。
- **断言链**：`node scripts/gm-crypto-probe.mjs` = G1~G8（G1/G2/G3 是启动断言，G4~G8 CI 级），**12/12 PASS**。G3 必须是「标准向量验签 + 篡改反断言」而非自签自验；G8 实证 sm-crypto ↔ OpenSSL 标准路径互通（Q1 选型从判断升级为 CI 可复跑断言）。
- **签发**：`scripts/issue-license.mjs`（离线 CLI，`--key-file` 或 `WO_LICENSE_PRIVATE_KEY`；R1 私钥泄漏拦截已挂 fail 条件：输出流含私钥即 exit 2）。`--gen-fixture` 产出 G3 fixture 入 `scripts/fixtures/sm2-standard-vector.json`（私钥不出进程）。
- **环境**：Node 22.22.2 可直接 `import .ts`（type stripping 默认开）→ 脚本能直接 import shared 的 TS 常量，无需先 build，这是「单一定义点」能落地的前提。Windows 下 file URL 必须带盘符冒号（`file:///D:/...`）。
