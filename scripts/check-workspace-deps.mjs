#!/usr/bin/env node
/**
 * workspace 依赖面断言（P3-001 §5.3 分层依赖规则）。
 *
 * 这些规则若只写在文档里，一定会在某个赶工的下午被绕过；这里把它们变成 exit != 0。
 *
 * 断言项：
 *  A 包名统一前缀 @wo/*
 *  B 反向依赖：packages/* 不得依赖 apps/*
 *  C 跨 app 依赖：apps/* 之间不得互相依赖
 *  D @wo/shared 的 dependencies 只允许 zod 与 sm-crypto（后者必须精确版本 0.5.7）
 *  E @wo/config 零 dependencies / 零 peerDependencies（它是纯配置）
 *  F 内部 @wo/* 引用必须写 workspace:*（否则可能被解析到 registry 上的同名包）
 *  G 全仓不得出现第二图标库（与 packages/config/eslint-preset.js 的 BANNED_ICON_SOURCES 同源）
 *  H @wo/shared 源码不得 import React / Nest / univer / yjs
 *  I 三面对账：package.json 声明 / pnpm-lock.yaml importer / 包内 node_modules
 *  J 规则注册表三面一致：WO_RULE_NAMES（登记表）/ woPlugin.rules（规则体）/ preset 里 error 级 `wo/*`（执法面）
 *
 * J 的存在理由（2026-10-25 P3-011-06 收口核对时发现）：ANCHORS §1 与
 * `packages/config/rules/index.js` 的文件头都写着「新增规则必须同步登记 WO_RULE_NAMES，
 * `scripts/check-workspace-deps.mjs` 会机检」——但本脚本此前只有 A~I，**这条断言是纸面承诺**：
 * P3-011-05 新增第三条规则 `request-schema-strict` 时，登记漏写不会有任何东西变红。
 * 「文档说已机检、脚本里没有」比「明说没有」更危险——它让人以为防线在。故本包补 J。
 *
 * I 的存在理由（2026-10-23 第五轮审核 P0-2）：只校验「声明面」的门禁是**假绿**——
 * 它只证明声明没写错，不证明装得上。当时 package.json 加了 sm-crypto 却没跑 pnpm install，
 * D/E 全 PASS，而 CI 克隆后 `pnpm install --frozen-lockfile` 直接 ERR_PNPM_OUTDATED_LOCKFILE，
 * 整个 B1 批次开不了工。故 lockfile 与 node_modules 两侧必须有独立 fail 条件。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/** 与 ESLint preset 同源；此处重复一份是为了让本脚本零依赖运行（不 import ESLint 生态）。 */
const BANNED_ICON_SOURCES = [
  '@ant-design/icons',
  '@douyinfe/semi-icons',
  'react-icons',
  'heroicons',
  '@heroicons/react',
  'phosphor-react',
  '@phosphor-icons/react',
  '@tabler/icons',
  '@tabler/icons-react',
  '@radix-ui/react-icons',
];

/** @param {string} dir @returns {string[]} */
function listDirs(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

/** @typedef {{ id: string, dir: string, name: string, deps: Record<string, string> }} Pkg */

/** @type {Pkg[]} */
const pkgs = [];
for (const [scope, area] of [
  ['@wo/', 'packages'],
  ['@wo/', 'apps'],
]) {
  for (const name of listDirs(area)) {
    const pj = join(ROOT, area, name, 'package.json');
    if (!existsSync(pj)) continue;
    const json = JSON.parse(readFileSync(pj, 'utf8'));
    /** @type {Record<string, string>} */
    const deps = {};
    for (const f of DEP_FIELDS) Object.assign(deps, json[f] ?? {});
    pkgs.push({ id: `${area}/${name}`, dir: `${scope}${name}`, name: json.name ?? '', deps });
  }
}

/** @type {string[]} */
const failures = [];
const fail = (id, msg) => failures.push(`${id}  ${msg}`);

if (pkgs.length === 0) {
  failures.push(
    '(root)  未发现任何 workspace 包——pnpm-workspace.yaml 的 packages 与目录结构不一致',
  );
}

for (const p of pkgs) {
  // A
  if (!p.name.startsWith('@wo/')) fail(p.id, `包名必须前缀 @wo/，实为「${p.name}」`);

  for (const [dep, spec] of Object.entries(p.deps)) {
    const isInternal = dep.startsWith('@wo/');
    // B / C
    if (isInternal) {
      const target = pkgs.find((x) => x.name === dep);
      const targetArea = target
        ? target.id.split('/')[0]
        : dep.includes('/')
          ? 'packages'
          : 'other';
      const selfArea = p.id.split('/')[0];
      if (target && targetArea === 'apps' && selfArea === 'packages') {
        fail(p.id, `反向依赖：packages 不得依赖 apps（→ ${dep}）`);
      }
      if (target && targetArea === 'apps' && selfArea === 'apps') {
        fail(p.id, `跨 app 依赖：apps 之间不得互相引用（→ ${dep}）`);
      }
      // F
      if (spec !== 'workspace:*' && !String(spec).startsWith('workspace:')) {
        fail(p.id, `内部包 ${dep} 必须写 workspace:*，实为「${spec}」`);
      }
    }
    // G
    if (BANNED_ICON_SOURCES.some((b) => dep === b || dep.startsWith(`${b}/`))) {
      fail(p.id, `第二图标源：禁止依赖 ${dep}（图标唯一，P3-001 §5.2 ⑥）`);
    }
  }

  // D
  if (p.name === '@wo/shared') {
    const sharedJson = JSON.parse(readFileSync(join(ROOT, p.id, 'package.json'), 'utf8'));
    const runtime = sharedJson.dependencies ?? {};
    // 白名单：zod（schema 单一源）+ sm-crypto（国密 SM2 签验，D1-11 ① 国密依赖面 / OPEN-DECISIONS 2026-10-23 Q1 拍板）
    const SHARED_ALLOWED = ['zod', 'sm-crypto'];
    const extra = Object.keys(runtime).filter((d) => !SHARED_ALLOWED.includes(d));
    if (extra.length)
      fail(
        p.id,
        `@wo/shared 的 dependencies 只允许 ${SHARED_ALLOWED.join(' / ')}，多出：${extra.join(', ')}`,
      );
    // V-DEPSM：sm-crypto 必须精确版本（0.5.x 有 API 命名变动，浮动版本会静默改签名）
    const smSpec = runtime['sm-crypto'];
    if (smSpec !== undefined && !/^\d+\.\d+\.\d+$/.test(String(smSpec))) {
      fail(p.id, `sm-crypto 必须精确版本（禁 ^ / ~），实为「${smSpec}」`);
    }
  }

  // E
  if (p.name === '@wo/config') {
    const json = JSON.parse(readFileSync(join(ROOT, p.id, 'package.json'), 'utf8'));
    const extra = Object.keys({ ...(json.dependencies ?? {}), ...(json.peerDependencies ?? {}) });
    if (extra.length) fail(p.id, `@wo/config 必须零运行时依赖，多出：${extra.join(', ')}`);
  }
}

// H
// 注：扫描的是**原始文本**，注释里的示例写法同样会命中（V2.1 实测：把被禁 import
// 抄进注释当作反例，结果门禁变红）。这是有意的——一条写了却不用执行的示例，
// 本质上是在教人抄它；宁可让写注释的人换一种说法。
// 捕获组必须存在：早期版本无捕获组而报错信息里写 `hit[1]`，一旦命中只会打印
// `不得 import undefined`，把「哪条规则被违反」这个最关键的信息丢掉。
const sharedSrc = join(ROOT, 'packages/shared/src');
const FORBIDDEN_IMPORT =
  /from\s+['"]((?:react|react-dom|@nestjs\/[^'"]+|@univerjs\/[^'"]+|yjs|y-protocols[^'"]*))['"]/;
if (existsSync(sharedSrc)) {
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(ts|tsx|mts|cts)$/.test(e.name)) continue;
      const hit = readFileSync(abs, 'utf8').match(FORBIDDEN_IMPORT);
      if (hit) fail('packages/shared', `${abs.slice(ROOT.length + 1)} 不得 import ${hit[1]}`);
    }
  };
  walk(sharedSrc);
}

// I
//
// I-1 解析 pnpm-lock.yaml 的 importers 段（极简缩进解析，本脚本保持零依赖，不引 YAML 库）。
const lockPath = join(ROOT, 'pnpm-lock.yaml');
/** @type {Map<string, Set<string>>} importer id -> 已锁定的依赖名 */
const lockDeps = new Map();
const unquote = (s) => s.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

if (!existsSync(lockPath)) {
  fail('(root)', 'pnpm-lock.yaml 不存在——依赖不可复现，CI `pnpm install --frozen-lockfile` 必红');
} else {
  let inImporters = false;
  let cur = null;
  let inField = false;
  for (const raw of readFileSync(lockPath, 'utf8').split(/\r?\n/)) {
    if (/^importers:\s*$/.test(raw)) {
      inImporters = true;
      continue;
    }
    if (!inImporters) continue;
    if (raw.trim() !== '' && /^\S/.test(raw)) break; // 下一个顶层键（packages: / snapshots:）
    const importer = /^ {2}(\S.*?):\s*(?:\{\s*\})?\s*$/.exec(raw);
    if (importer) {
      cur = unquote(importer[1]);
      inField = false;
      if (!lockDeps.has(cur)) lockDeps.set(cur, new Set());
      continue;
    }
    if (cur === null) continue;
    if (/^ {4}(dependencies|devDependencies|peerDependencies|optionalDependencies):/.test(raw)) {
      inField = true;
      continue;
    }
    if (/^ {4}\S/.test(raw)) {
      inField = false;
      continue;
    }
    if (inField && cur !== null) {
      const dep = /^ {6}(\S+):/.exec(raw);
      if (dep) lockDeps.get(cur).add(unquote(dep[1]));
    }
  }
}

/**
 * @param {string} id  workspace 相对路径（如 packages/shared）
 * @param {string} label
 * @param {Record<string, string>} declared  package.json 里声明的依赖（含 dev/peer/optional）
 * @param {Record<string, string>} runtime  仅 dependencies（决定 import 能否解析）
 */
const reconcile = (id, label, declared, runtime) => {
  const locked = lockDeps.get(id);
  if (locked === undefined) {
    fail(id, `pnpm-lock.yaml 的 importers 中没有 ${label}——跑一次 pnpm install`);
    return;
  }
  const declaredNames = Object.keys(declared);
  const missingInLock = declaredNames.filter((d) => !locked.has(d));
  if (missingInLock.length)
    fail(
      id,
      `package.json 声明了 ${missingInLock.join(', ')}，但 pnpm-lock.yaml 未同步` +
        `——CI 的 --frozen-lockfile 会因此红（修法：跑 pnpm install，不要手工拷 node_modules）`,
    );
  const staleInLock = [...locked].filter((d) => !declaredNames.includes(d));
  if (staleInLock.length)
    fail(
      id,
      `pnpm-lock.yaml 残留已删除的依赖 ${staleInLock.join(', ')}——lockfile 与 package.json 不一致`,
    );
  // I-2 装得上才算数：runtime 依赖必须能在包内 node_modules 解析（pnpm isolated 布局不提升）
  for (const d of Object.keys(runtime)) {
    const entry = join(ROOT, id, 'node_modules', d);
    if (!existsSync(entry))
      fail(
        id,
        `包内 node_modules 缺 ${d}——声明与 lockfile 都在但没装到位，` +
          `包内 import 会解析失败（修法：跑 pnpm install）`,
      );
  }
};

// root：仅做「声明 与 lockfile」对账（devDependencies 全在根 node_modules，无 isolated 提升问题）
const rootJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
/** @type {Record<string, string>} */
const rootDeps = {};
for (const f of DEP_FIELDS) Object.assign(rootDeps, rootJson[f] ?? {});
reconcile('.', '根 importer', rootDeps, rootJson.dependencies ?? {});

for (const p of pkgs) {
  const json = JSON.parse(readFileSync(join(ROOT, p.id, 'package.json'), 'utf8'));
  reconcile(p.id, p.id, p.deps, json.dependencies ?? {});
}

// J 规则注册表三面一致
//
// 三面：`WO_RULE_NAMES`（唯一登记点）/ `woPlugin.rules`（规则体出口）/ preset 里
// error 级的 `wo/*`（执法面）。任何一面单独漂移都不会被 ESLint 自己发现——
// preset 里多写一条不存在的规则，ESLint 会报「Definition for rule not found」（这条能兜住）；
// 但**登记表漏登记**（WO_RULE_NAMES 少一条而 plugin.rules 有）ESLint 完全不报，
// 这才是 J 要抓的那一面。故双向都断言。
const RULES_INDEX = join(ROOT, 'packages/config/rules/index.js');
const PRESET = join(ROOT, 'packages/config/eslint-preset.js');

/** 从 `X = [ 'a', 'b' ]` 形态里取字符串项。 */
const readStringArray = (text, key) => {
  const block = new RegExp(`${key}\\s*=\\s*\\[([^\\]]*)\\]`).exec(text);
  if (!block) return [];
  return [...block[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
};

/** 从 `rules: { 'a': x, ... }` 形态里取键名。 */
const readRuleKeys = (text) => {
  const block = /rules:\s*\{([\s\S]*?)\n\s*\}/.exec(text);
  if (!block) return [];
  return [...block[1].matchAll(/^\s*['"]([^'"]+)['"]\s*:/gm)].map((m) => m[1]);
};

if (!existsSync(RULES_INDEX)) {
  fail('packages/config', '规则注册表 packages/config/rules/index.js 不存在——J 段不可用');
} else if (!existsSync(PRESET)) {
  fail('packages/config', 'eslint-preset.js 不存在——J 段不可用');
} else {
  const rulesText = readFileSync(RULES_INDEX, 'utf8');
  const registered = readStringArray(rulesText, 'WO_RULE_NAMES');
  const pluginRules = readRuleKeys(rulesText);
  const presetErrors = new Set(
    [...readFileSync(PRESET, 'utf8').matchAll(/['"]wo\/([a-z0-9-]+)['"]\s*:\s*['"]error['"]/g)].map(
      (m) => m[1],
    ),
  );

  // 防假绿：三面任一解析为空即判据失效（结构变了而脚本没跟上，会伪装成「零漂移」）
  if (registered.length === 0) fail('packages/config', 'WO_RULE_NAMES 解析出 0 条——判据失效');
  if (pluginRules.length === 0) fail('packages/config', 'woPlugin.rules 解析出 0 条——判据失效');
  if (presetErrors.size === 0)
    fail('packages/config', 'preset 里 error 级 wo/* 解析出 0 条——判据失效');

  for (const n of registered) {
    if (!pluginRules.includes(n))
      fail('packages/config/rules', `WO_RULE_NAMES 登记了「${n}」，但 woPlugin.rules 没有规则体`);
    if (!presetErrors.has(n))
      fail('packages/config/rules', `WO_RULE_NAMES 登记了 wo/${n}，但 preset 未按 error 启用`);
  }
  for (const n of pluginRules) {
    if (!registered.includes(n))
      fail(
        'packages/config/rules',
        `woPlugin.rules 有「${n}」，但 WO_RULE_NAMES 未登记（登记表漂移）`,
      );
  }
  for (const n of presetErrors) {
    if (!registered.includes(n))
      fail('packages/config/rules', `preset 启用了 wo/${n}，但 WO_RULE_NAMES 未登记（登记表漂移）`);
  }
}

if (failures.length) {
  process.stderr.write(`workspace 依赖面断言失败（${failures.length} 条）：\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}

process.stdout.write(
  `workspace 依赖面断言通过：${pkgs.length} 个包（${pkgs.map((p) => p.name).join(', ')}）\n`,
);
