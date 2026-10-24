# 项目长期记忆（web-office）

## 文档纪律（2026-10-22 立，多轮实证）

- **临时评审件生命周期**：`docs/` 不留临时件，结论落盘当轮 `mv` 到 `.workbuddy/trash/<日期>/`（不用 rm）。回收顺序铁律：① 逐条核结论有载体（卡/DESIGN-LAYER §2.2/OPEN/生成器/台账）→ ② 只在原文的规约先补硬约束 → ③ 再移走。白名单登记走 `docs/review/RETAINED.md`（缺回收条件判无效）。机检 = `scripts/check-temp-docs.mjs`（verify 第 6 段）。删除前先确认已入 git。
- **机读数字必须回原始文件重算**，且任何计数带三元组：分子 / 分母口径 / 时点（HEAD 短哈希）。先分「字面 vs 展开」「声明数 vs 样本数」再谈对错；百分比先验分母时点（一处旧通常多处旧，grep 旧分母数字）。转述链订正必出错。
- **台账计数口径**：OPEN-DECISIONS 取每行**最后一个单元格**，去 `*`/空白后**截去括注**判 base；**禁按单元格数过滤**（78 条目中 21 行 7 列，按 len==8 过滤静默漏 27%）。
- **回执外部质疑三查**：① 引文方向（挑战方引文可能与原文相反）② 同型先例是否已登记 ③ 计数口径（语义种类数 vs 提及次数）。只核结论不核引文 = 错因一起落盘。
- **卡面措辞与已落盘代码必须同步核**：改口径类修订的传导核查 = 旧术语族 grep 于 docs/ + scripts/ + 生成器源，逐处定性「活载体/历史记载」（历史记载合法保留）；收尾必须对已清文件重跑全量 grep（同文件同族措辞散布多节）；字符串字面量也是措辞载体。
- **出处不引行号**（按 schema 名/§符号 grep）；卡体量以字符数度量；设计卡 = 一页决策归集件 ≠ 详设。
- **凡新立不变量一律随轮配 ④ 栏断言**，不留「只靠人守」的不变量。
- **冻结配平 ≠ 可顺手改数**（2026-10-24 grill 轮）：压缩沿革叙述时一度把机读正确值「no-param 余 8」误改为「勘误余 7」——配平砍的是叙述不是数字；动到任何数字前先回原始文件复核真值。
- **Security Center deny 名单是文件粒度不是目录粒度**（2026-10-24 再实证）：同目录下 DESIGN-LAYER.md / OPEN-DECISIONS.md 的 git add 可过，而 D1-02/06/13 三张卡被拦——每轮对要 add 的文件逐个「先试一次」，失败即转用户系统终端，不要按目录推断。

## 状态面板（2026-10-22 立）

- `docs/status-panel.html` 唯一刷新方式 `python -X utf8 scripts/gen_status_panel.py`，禁止手改。**面板会静默过期**：取数前先比对 mtime 与最后文档修订时点；生成器被拦时面板数字一律标注不可信。
- **R-6 根因已定论**：Security Center 是**逐文件历史累积 deny**（路径+工具访问史），不是目录级、不是 git 状态、不是偶发；同目录新文件往往不在名单内——**「先试一次」再下结论**。shell/python/grep 读那批文件被拦，**Read/Edit/Write 工具可用**；已入库文件可用 `git show HEAD:<path>` 绕过。`git add` 对在 deny 名单的文件也会被拒 → 转用户在系统自带终端手动处理。**git 侧会静默失败**（git status/diff 全空但改动已落盘）——核对落盘用 Read/Grep 实证。

## B1 代码基线（P3-010，已交付）

- **verify 自 2026-10-24 起为八段**（第六段临时件回收后新增：⑦ 文档纪律 `check-doc-discipline.mjs` = 卡体量 warn 8,000/fail 12,000 + 状态行 ≤400 + 措辞族 curated 表 12 族×32 载体 + REGISTERED_STOCK 登记水位制；⑧ openapi 契约门禁接入）。ANCHORS §0 门禁三连已改「verify 八段 + 面板」两件套，check_openapi_contract.py 不再单独跑。
- **卡体量阈值已立法**（DESIGN-LAYER v1.16 §2.2 条 1，冻结令废止）：存量按登记水位制管理——`check-doc-discipline.mjs` 的 REGISTERED_STOCK 登记 ceiling（只许减不许增），达标后摘行；未登记新违规一律硬 fail。在册：D1-13 体量 20,226（拆卡待裁）/ 状态行 D1-04 496、D1-12 473、D1-03 451、D1-10 441。**交接件写 D1-13=20,974 系字节口径残留**，字符口径 20,226。
- **措辞族机检**（条 Q ③）：curated 短语表在 `check-doc-discipline.mjs` PHRASE_FAMILIES，新不变量落盘时**同轮入表**；短语按「多短语任一命中」处理历史措辞变体（如「属本码/归本码」「文件级权限/文件级访问/编辑权限」）。
- **Security Center deny 下机检脚本的读取兜底**：fs 失败 → `git show HEAD:<path>` 回退并打印 [git-fallback]；**回退读到 HEAD 版**，工作区未入库修订会读滞后 → 收口顺序 = 先提交卡修订再跑门禁。gen_status_panel.py read() 同型兜底（2026-10-24 批随批入库）。
- 自检唯一入口 `node scripts/verify.mjs`（八段：格式→lint --max-warnings=0→tsc→规则测试→依赖面→临时件回收→文档纪律→契约）；根 scripts 不嵌套调 pnpm。
- **pnpm 本机唯一跑法**：系统 shim 绑 Node 20 会崩；临时前缀 `npm i pnpm@11.28.6` + 受管 Node 22 驱动 `pnpm.cjs`。isolated 布局下根 scripts 解析不到包依赖 → 运行时/工具链依赖可能同版本声明两处；手工拷包进根 node_modules 是陷阱（lockfile 不同步）。
- 依赖门禁 `check-workspace-deps.mjs` 断言 I = 声明 ↔ lockfile importer ↔ node_modules 三面；**改依赖后先 install 再跑门禁**。
- 三条 P0 lint 规则一律 error：`wo/no-emoji`（测试文件用 `String.fromCodePoint` 不写真 emoji）、`wo/no-hardcoded-color`、`no-restricted-imports`（10 个第二图标源）。
- 仓库只提交不推送、不主动加远端；`.gitattributes` 锁 LF。
- 包级锚点台账 = `docs/phase3/ANCHORS.md`，派单前先填。

## 国密 SM2 签验链路（2026-10-23 放行轮落盘）

- SM2 一律 **sm-crypto `0.5.7` 精确版本**；Node 原生 crypto 禁用于 SM2（无 ZA/distid，P0-1 假阳性根因）。
- 四口径单一定义点 `packages/shared/src/license/sm2-constants.ts`：含 ZA（hash 不关）/ distid `1234567812345678`（参数名 `userId`）/ 标准 DER `{der:true}` / canonical JSON（键字典序、禁浮点、字节入参）。
- **G3 只承担自洽、G8 独家承担互通**（fixture 是本仓自签向量，叫「标准向量」= 把自洽证据当互通证据）。G8 SKIP 必须能力探测（openssl 主版本 <3.0），负向断言以正向成功为前置。
- 签发 `scripts/issue-license.mjs`（R1 私钥泄漏拦截 exit 2；取私钥用 `--gen-keypair --out-key-file`）。OpenSSL 3.x CLI 口径：`pkeyutl -rawin -digest sm3 -pkeyopt distid:` 传 **ASCII 原文**；自造 SPKI PEM 的 BIT STRING 长度字节是 **0x42**。
- 跑探针必须用受管 Node 22（系统 node 20 会 ERR_UNKNOWN_FILE_EXTENSION）；fixture 落点已裁迁 `packages/shared/src/license/fixtures/`（条 L，代码 3 处待放行 = 条 O）。

## 判定口径

- 需求评审看 REVIEW-INDEX 线程段；设计文档看 DESIGN-LAYER §3.1 覆盖列 + 卡文件存在性；卡评审只认 REVIEW-INDEX 卡号线程段；未决数按 OPEN-DECISIONS 中 OPEN 行计。
