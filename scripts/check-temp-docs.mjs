#!/usr/bin/env node
/**
 * 临时文件回收门禁（2026-10-22 立，用户指令「凡是临时文件，用完需要回收」）。
 *
 * 纪律：docs/ 只放长期载体（契约、ADR、设计卡、台账、索引、面板）。
 * 交接件、中间评审件（挑刺/回执/审核）、一次性探针输出属「用完即回收」——
 * 结论落盘后必须 mv 到 .workbuddy/trash/<日期>/，不留在 docs/。
 *
 * 为什么要机检：这条纪律 2026-10-22 前一轮已用文字写进 REVIEW-INDEX，
 * 同日仍残留一份 handoff —— 纯文字纪律没有 fail 条件，等于没立。
 *
 * 退出码：0 = docs/ 无临时件；1 = 存在未回收临时件。
 */
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = join(ROOT, 'docs');

/**
 * 临时件特征：匹配文件名（不含路径），不区分大小写。
 * 新增例外只能改本清单并注明理由，不允许「这次先留着」。
 */
const TEMP_PATTERNS = [
  /handoff/i,
  /(^|[-_.])tmp([-_.]|$)/i,
  /draft/i,
  /(^|[-_.])wip([-_.]|$)/i,
  /挑刺/,
  /回执/,
  /审核/,
  /草稿/,
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const hits = walk(DOCS)
  .map((p) => relative(ROOT, p).split('\\').join('/'))
  .filter((rel) => {
    const base = rel.split('/').pop() ?? rel;
    // Office 锁文件以 ~$ 开头，属同类一次性产物
    return base.startsWith('~$') || TEMP_PATTERNS.some((re) => re.test(base));
  });

if (hits.length === 0) {
  process.stdout.write('docs/ 临时件 0 件（纪律：落盘后即移入 .workbuddy/trash/<日期>/）\n');
  process.exit(0);
}

process.stdout.write(`docs/ 存在未回收临时件 ${hits.length} 件：\n`);
for (const h of hits) process.stdout.write(`  - ${h}\n`);
process.stdout.write(
  '\n回收顺序（不可颠倒）：① 核验每条结论已在卡 / DESIGN-LAYER §2.2 / OPEN-DECISIONS / ' +
    '台账 / 生成器有载体；② 只写在原文里的规约先补进硬约束；③ mv 到 ' +
    '.workbuddy/trash/<日期>/；④ REVIEW-INDEX 登记行标注「已归档」。\n',
);
process.exit(1);
