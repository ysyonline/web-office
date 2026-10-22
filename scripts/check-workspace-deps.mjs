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
const sharedSrc = join(ROOT, 'packages/shared/src');
const FORBIDDEN_IMPORT =
  /from\s+['"](?:react|react-dom|@nestjs\/[^'"]+|@univerjs\/[^'"]+|yjs|y-protocols[^'"]*)['"]/;
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

if (failures.length) {
  process.stderr.write(`workspace 依赖面断言失败（${failures.length} 条）：\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}

process.stdout.write(
  `workspace 依赖面断言通过：${pkgs.length} 个包（${pkgs.map((p) => p.name).join(', ')}）\n`,
);
