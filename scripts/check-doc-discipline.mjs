#!/usr/bin/env node
/**
 * 文档纪律机检（2026-10-24 条 Q ③ + 条 S① 代码批上线，用户指令「继续」放行）。
 *
 * 三块断言：
 *  ① 卡体量（DESIGN-LAYER §2.2 条 1 正式阈值，2026-10-24 立法取代冻结令）：
 *     设计卡逐卡字符数——warn ≥ 8,000（黄告警，不拦收口）/ fail > 12,000（红，拦收口）。
 *     口径 = 字符数（UTF-16 码元），与立法度量口径 python len() 同基准；禁字节口径（§2.2 条 1 S5）。
 *  ② 状态行：卡头「> 状态：」行 ≤ 400 字符（同条立法）；该行缺失即结构性违规。
 *  ③ 措辞族传导（条 Q ③，把处置轮人肉「措辞族全量 grep」固化）：curated 不变式短语表，
 *     每条短语在其登记的全部活载体中必须可命中（≥1 次）——任一载体缺失即分歧，非零退出。
 *     表只增不改语义；新短语 / 新载体入表 = 有意识登记行为（防「改了 A 处忘了 B 处」型漂移）。
 *
 * 读取兜底：Security Center 对设计卡逐文件 deny 直接 fs 读（评审侧实况，R-6 定性）——
 * fs 失败时经 `git show HEAD:<path>` 读取并打印 [git-fallback]（读到的是 HEAD 版本；
 * 工作区存在未入库卡修订时本脚本读数滞后，收口顺序 = 先提交卡修订再跑门禁）。
 *
 * 存量登记水位制（2026-10-24 立法同日设，先例 = RETAINED.md 白名单 + PLACEHOLDER_EXEMPT
 * 「显式豁免式、缺席式不豁免、打印可见」）：阈值立法时点已超限的存量卡逐卡登记 ceiling
 * （登记时点实测值）——存量 ≤ ceiling 只打印不拦（限期净减，方案另裁），> ceiling 即 fail
 * （存量只许减不许增，冻结令精神保留）；达标后条目应摘除，未摘除打印提醒。未登记的新违规
 * 一律硬 fail——登记制不是新违规的后门。
 *
 * 退出码：0 = 无 fail 级违规（warn 与已登记存量只打印不拦）；1 = 未登记的卡体量 fail /
 * 状态行超限 / 存量超登记水位增长 / 措辞族分歧。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN_DIR = 'docs/phase3/design';

const WARN_CHARS = 8000;
const FAIL_CHARS = 12000;
const STATUS_MAX = 400;
const MIN_CARDS = 13;

/**
 * 存量登记（2026-10-24 阈值立法时点实测，HEAD f46bd5a；度量口径 = 字符数）。
 * 摘除条件：对应卡达标（字符数 < 8,000 / 状态行 ≤ 400）后随手删行，未摘除打印提醒。
 */
const REGISTERED_STOCK = [
  {
    card: 'D1-13',
    metric: 'size',
    ceiling: 11598,
    reason:
      'v1.14 拆卡后余量（E-CV ②③ → D1-13-A、① 栏 5 行实施级口径 → D1-13-B）；> warn 线部分系决策本体，不再净减',
  },
  {
    card: 'D1-03',
    metric: 'status',
    ceiling: 451,
    reason: '状态行存量，随下次内容落盘配平（明细移交 REVIEW-INDEX 线程段）',
  },
  {
    card: 'D1-04',
    metric: 'status',
    ceiling: 496,
    reason: '状态行存量，随下次内容落盘配平（明细移交 REVIEW-INDEX 线程段）',
  },
  {
    card: 'D1-10',
    metric: 'status',
    ceiling: 441,
    reason: '状态行存量，随下次内容落盘配平（明细移交 REVIEW-INDEX 线程段）',
  },
  {
    card: 'D1-12',
    metric: 'status',
    ceiling: 473,
    reason: '状态行存量，随下次内容落盘配平（明细移交 REVIEW-INDEX 线程段）',
  },
];

const textCache = new Map();

function readRepoFile(rel) {
  const key = rel.split('\\').join('/');
  if (textCache.has(key)) return textCache.get(key);
  let text;
  try {
    text = readFileSync(join(ROOT, key), 'utf8');
  } catch {
    const git = spawnSync('git', ['show', `HEAD:${key}`], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (git.status === 0 && typeof git.stdout === 'string') {
      process.stdout.write(`[git-fallback] ${key}：fs 直读被拦，按 HEAD 版本核验\n`);
      text = git.stdout;
    } else {
      process.stdout.write(`\nFAIL 读不了 ${key}：fs 被拦且 git show 失败\n`);
      process.exit(1);
    }
  }
  textCache.set(key, text);
  return text;
}

const cardFiles = readdirSync(join(ROOT, DESIGN_DIR))
  .filter((n) => /^D1-\d{2}-.+\.md$/.test(n))
  .sort();

function loadCarrier(spec) {
  const rel = spec.startsWith('D1-')
    ? `${DESIGN_DIR}/${cardFiles.find((n) => n.startsWith(`${spec}-`)) ?? ''}`
    : spec;
  if (rel.endsWith('/')) return null;
  return { rel, text: readRepoFile(rel) };
}

/**
 * curated 不变式短语表（条 Q ③）。每族 = 一条已裁决不变量 + 它必须在场的活载体。
 * 载体写法：`D1-xx` = 设计卡（按文件名前缀解析）；其余 = 仓库相对路径。
 * 短语含历史措辞变体的（如「属本码 / 归本码」）以多短语任一命中判定。
 */
const PHRASE_FAMILIES = [
  {
    id: '4409 触发集 = License 无效/缺失/过期全域（条 K 裁决）',
    phrases: ['无效/缺失/过期'],
    carriers: [
      'docs/api/openapi.yaml',
      'docs/phase3/DESIGN-LAYER.md',
      'D1-05',
      'D1-07',
      'D1-08',
      'D1-10',
    ],
  },
  {
    id: '席位满不属 4409（分域注；「属/归」两种历史措辞均认）',
    phrases: ['席位满不属本码', '席位满不归本码'],
    carriers: ['docs/api/openapi.yaml', 'D1-05', 'D1-08', 'D1-10'],
  },
  {
    id: 'ROLE_UPGRADE 判席 + 判权（6-A 裁决）',
    phrases: ['判权'],
    carriers: ['docs/api/openapi.yaml', 'D1-08', 'docs/phase3/DESIGN-LAYER.md'],
  },
  {
    id: 're-validate 校验面含文件级权限（6-A 裁决）',
    phrases: ['文件级权限', '文件级访问/编辑权限'],
    carriers: ['D1-09', 'docs/api/openapi.yaml'],
  },
  {
    id: '导入互斥「广播先于拒帧」不变量（X-3）',
    phrases: ['广播先于拒帧'],
    carriers: ['D1-01', 'D1-07'],
  },
  {
    id: '互斥窗口拒帧前必先派发 doc-rebuild 帧的契约面时序句（X-3）',
    phrases: ['派发 [CONTROL] doc-rebuild'],
    carriers: ['docs/api/openapi.yaml'],
  },
  {
    id: '加载就绪判据 = caught-up 帧（X-6）',
    phrases: ['caught-up'],
    carriers: ['docs/api/openapi.yaml', 'D1-06', 'docs/phase3/DESIGN-LAYER.md'],
  },
  {
    id: 'doc-rebuild 后首个快照 base_seq = 物化时刻 max(seq)、非 0（Q3/X-1）——契约面公式',
    phrases: ['物化时刻 max(seq)'],
    carriers: ['docs/api/openapi.yaml'],
  },
  {
    id: 'base_seq 水位承载断裂语义（Q3）——卡面与任务书',
    phrases: ['base_seq'],
    carriers: ['D1-06', 'docs/phase3/DESIGN-LAYER.md'],
  },
  {
    id: 'seq 全程不归零（Q3）',
    phrases: ['不归零'],
    carriers: ['docs/api/openapi.yaml', 'D1-06'],
  },
  {
    id: '4412 双触发 = LRU 硬上限先驱逐 + 单 doc 预算（ADR-001 v1.7）',
    phrases: ['双触发'],
    carriers: ['docs/api/openapi.yaml', 'D1-05', 'D1-08'],
  },
  {
    id: '4412 内存水位口径（同族）',
    phrases: ['内存水位'],
    carriers: ['docs/api/openapi.yaml', 'D1-05', 'docs/phase3/DESIGN-LAYER.md'],
  },
  {
    id: '详设附录件不计卡体量（DESIGN-LAYER v1.17 立法）',
    phrases: ['附录件不计卡体量', '不计卡体量'],
    carriers: [
      'docs/phase3/DESIGN-LAYER.md',
      'docs/phase3/design/appendix/D1-13-A-ECV样本清单.md',
      'docs/phase3/design/appendix/D1-13-B-校验链实施级口径.md',
    ],
  },
];

const failures = [];
const stockPrints = [];
const stockStale = [];

process.stdout.write(`设计卡：${cardFiles.length} 张（立法口径 ≥ ${MIN_CARDS}）\n`);
if (cardFiles.length < MIN_CARDS) {
  failures.push(
    `设计卡 ${cardFiles.length} 张 < ${MIN_CARDS}（DESIGN-LAYER §3 立法口径）——卡被移走或改名？`,
  );
}

const sizeFail = [];
const sizeWarnList = [];
const statusFail = [];
for (const name of cardFiles) {
  const text = readRepoFile(`${DESIGN_DIR}/${name}`);
  const id = name.slice(0, 5);
  const chars = text.length;
  if (chars > FAIL_CHARS) {
    sizeFail.push(`${id} ${chars} 字符 > fail 线 ${FAIL_CHARS}（拆卡或瘦身，方案待用户裁）`);
  } else if (chars >= WARN_CHARS) {
    sizeWarnList.push(`[体量 warn] ${id} ${chars} 字符 ≥ warn 线 ${WARN_CHARS}（限期净减）`);
  }
  const head = text.split(/\r?\n/).slice(0, 15);
  const status = head.find((l) => l.startsWith('> 状态：'));
  if (!status) {
    statusFail.push(`${id} 卡头 15 行内无「> 状态：」行（结构性违规）`);
  } else if (status.length > STATUS_MAX) {
    statusFail.push(
      `${id} 状态行 ${status.length} 字符 > ${STATUS_MAX}（配平：明细移交 REVIEW-INDEX 线程段）`,
    );
  }
}

// 存量水位核验：登记条目只拦「超水位增长」，未登记违规一律硬 fail。
for (const reg of REGISTERED_STOCK) {
  const name = cardFiles.find((n) => n.startsWith(`${reg.card}-`));
  if (!name) {
    stockStale.push(`${reg.card} 登记条目指向的卡已不存在（达标移卡后未删行？）`);
    continue;
  }
  const text = readRepoFile(`${DESIGN_DIR}/${name}`);
  const actual =
    reg.metric === 'size'
      ? text.length
      : (
          text
            .split(/\r?\n/)
            .slice(0, 15)
            .find((l) => l.startsWith('> 状态：')) ?? ''
        ).length;
  if (actual <= reg.ceiling) {
    if (actual <= (reg.metric === 'size' ? WARN_CHARS : STATUS_MAX)) {
      stockStale.push(`${reg.card} 已达标（${actual}），登记条目应摘除`);
    } else {
      stockPrints.push(
        `[存量在册] ${reg.card} ${reg.metric === 'size' ? '体量' : '状态行'} ${actual}/${reg.ceiling}（限期净减：${reg.reason}）`,
      );
    }
  } else {
    failures.push(
      `存量超水位：${reg.card} ${reg.metric === 'size' ? '体量' : '状态行'} ${actual} > 登记水位 ${reg.ceiling}（存量只许减不许增）`,
    );
  }
}

const unregisteredSize = sizeFail.filter(
  (s) => !REGISTERED_STOCK.some((r) => s.startsWith(r.card) && r.metric === 'size'),
);
const unregisteredStatus = statusFail.filter(
  (s) => !REGISTERED_STOCK.some((r) => s.startsWith(r.card) && r.metric === 'status'),
);

let phraseMissing = 0;
for (const fam of PHRASE_FAMILIES) {
  const missing = [];
  for (const spec of fam.carriers) {
    const c = loadCarrier(spec);
    if (!c) {
      missing.push(`${spec}（文件不存在）`);
      continue;
    }
    if (!fam.phrases.some((p) => c.text.includes(p))) missing.push(c.rel);
  }
  if (missing.length > 0) {
    phraseMissing += missing.length;
    failures.push(
      `措辞族分歧：${fam.id} —— 缺失载体：${missing.join('、')}（登记短语：${fam.phrases.join(' / ')}）`,
    );
  }
}

if (unregisteredSize.length > 0) {
  failures.push(...unregisteredSize.map((s) => `卡体量 fail（未登记存量）：${s}`));
}
if (unregisteredStatus.length > 0) {
  failures.push(...unregisteredStatus.map((s) => `状态行超限（未登记存量）：${s}`));
}

process.stdout.write(
  `卡体量（warn ≥ ${WARN_CHARS} / fail > ${FAIL_CHARS}）：fail ${sizeFail.length}（未登记 ${unregisteredSize.length}）/ warn ${sizeWarnList.length} / 共 ${cardFiles.length} 卡\n`,
);
for (const w of sizeWarnList) process.stdout.write(`  ${w}\n`);
process.stdout.write(
  `状态行（≤ ${STATUS_MAX}）：超限 ${statusFail.length} 张（未登记 ${unregisteredStatus.length}）\n`,
);
for (const p of stockPrints) process.stdout.write(`  ${p}\n`);
for (const s of stockStale) process.stdout.write(`  [登记提醒] ${s}\n`);
process.stdout.write(
  `措辞族（条 Q ③）：${PHRASE_FAMILIES.length} 族 × ${PHRASE_FAMILIES.reduce((a, f) => a + f.carriers.length, 0)} 载体，分歧 ${phraseMissing} 处\n`,
);

if (failures.length > 0) {
  process.stdout.write(`\nFAIL 文档纪律机检（${failures.length} 项）：\n`);
  for (const f of failures) process.stdout.write(`  - ${f}\n`);
  process.exit(1);
}
process.stdout.write('\nPASS 文档纪律机检（卡体量 / 状态行 / 措辞族）\n');
