#!/usr/bin/env node
/**
 * 端点分组断言（P3-011-02 交付）：模块目录 与 `openapi.tags` 双向逐一对应。
 *
 * 判据基座为什么是 tags 而不是 Spec §5：Spec §5 表没有「分组」列，且缺
 * `GET /api/v1/health/ready`（该端点归 P3-016）——用它做基座会让「10 个模块」永远对不齐。
 * 2026-10-24 用户裁决「判据基座 = openapi.tags 10 组」，本脚本即该裁决的执行面。
 *
 * 三条断言：
 *  A 目录有、tags 无 → 多一组（凭空造模块）
 *  B tags 有、目录无 → 缺一组（漏建模块）
 *  C 两侧数量不等即 fail（A/B 已覆盖，此处保留为汇总口径）
 *
 * 两条防假绿：
 *  - tags 解析出 0 条 → FAIL（YAML 结构变了而脚本没跟上，会伪装成「零缺失」）
 *  - 模块目录 0 个 → FAIL（同上）
 *
 * 零依赖运行：不引 YAML 库，只按缩进读 tags 段（与 scripts/check-workspace-deps.mjs 同风格）。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = join(ROOT, 'docs/api/openapi.yaml');
const MODULES_DIR = join(ROOT, 'apps/server/src/modules');

const unquote = (s) => s.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');

/** 读 openapi 顶层 tags 段里的 name 列表。 */
function readOpenapiTags() {
  const raw = readFileSync(OPENAPI, 'utf8');
  /** @type {string[]} */
  const tags = [];
  let inTags = false;
  for (const line of raw.split(/\r?\n/)) {
    if (/^tags:\s*$/.test(line)) {
      inTags = true;
      continue;
    }
    if (!inTags) continue;
    if (line.trim() !== '' && /^\S/.test(line)) break; // 下一个顶层键
    const m = /^ {2}- name:\s*(\S+)\s*$/.exec(line);
    if (m) tags.push(unquote(m[1]));
  }
  return tags;
}

const failures = [];

if (!existsSync(OPENAPI)) {
  failures.push(`openapi.yaml 不存在：${OPENAPI}`);
}
if (!existsSync(MODULES_DIR)) {
  failures.push(`模块目录不存在：${MODULES_DIR}（P3-011-02 应先落 10 个 tag 模块）`);
}

const tags = existsSync(OPENAPI) ? readOpenapiTags() : [];
const dirs = existsSync(MODULES_DIR)
  ? readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  : [];

// 防假绿：解析为空不等于「零缺失」
if (tags.length === 0) failures.push('openapi tags 解析结果为 0 条——基座失效，判据不可用');
if (dirs.length === 0) failures.push('模块目录下 0 个子目录——装配未落地，判据不可用');

const tagSet = new Set(tags);
const dirSet = new Set(dirs);

const extraDirs = dirs.filter((d) => !tagSet.has(d));
const missingDirs = tags.filter((t) => !dirSet.has(t));

for (const d of extraDirs)
  failures.push(`多一组：模块目录 "${d}" 在 openapi.tags 中无对应组（凭空造模块）`);
for (const t of missingDirs)
  failures.push(`缺一组：openapi.tags 的 "${t}" 没有对应模块目录（漏建模块）`);

if (tags.length !== dirs.length)
  failures.push(`数量不等：openapi.tags ${tags.length} 组 / 模块目录 ${dirs.length} 个`);

if (failures.length) {
  process.stderr.write(`端点分组断言失败（${failures.length} 条）：\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}

process.stdout.write(`端点分组断言通过：${tags.length} 组双向一致（${tags.join(', ')}）\n`);
