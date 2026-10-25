#!/usr/bin/env node
/**
 * 错误码表漂移断言（P3-012-01 交付）：`packages/shared/src/errors/codes.ts` 的
 * `ERROR_CODE_MESSAGES` 与 `docs/api/openapi.yaml` 的 `x-error-code-registry.codes`
 * **键集合双向相等 + 文案逐字相等**。
 *
 * 为什么需要这道门禁：码表在仓库里必然有两份形态——契约（yaml，唯一事实源）与代码
 * （TS 常量，执行面）。转录件没有门禁就是漂移温床，且**最难自查**：码还在、文案被
 * 悄悄改掉（「超席」改「满席」这类语义微调），编译器和类型检查都看不见，只有人读
 * 两份文件才可能发现。这与 P3-011-06 抓到的两条「纸面防线」同类——差别在于那两条是
 * 「文档说有、脚本没有」，这条是「有转录、无对账」。
 *
 * 为什么文案也要比：只比键集合的话，`5001: 'License 缺失/过期/超席（只读降级）'` 改成
 * `'License 无效'` 也能绿，而这句话会直接进用户可见的错误体 `message`（Spec §10）。
 *
 * 四条防假绿：
 *  - openapi 段解析出 0 条 → FAIL（YAML 结构变了而脚本没跟上，会伪装成「零漂移」）
 *  - codes.ts 解析出 0 条 → FAIL（同上）
 *  - 任一侧出现重复码 → FAIL（正则逐行解析时重复键会静默覆盖，比缺键更隐蔽）
 *  - 文件不存在 → FAIL
 *
 * 零依赖运行：不引 YAML 库、不动 TS 编译器，两侧都按行正则取。口径与
 * `check-schema-names.mjs` 一致（同为「两侧名单对账」类断言）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = join(ROOT, 'docs/api/openapi.yaml');
const CODES_TS = join(ROOT, 'packages/shared/src/errors/codes.ts');

const failures = [];

if (!existsSync(OPENAPI)) failures.push(`openapi.yaml 不存在：${OPENAPI}`);
if (!existsSync(CODES_TS)) failures.push(`码表文件不存在：${CODES_TS}`);

/**
 * 解析 openapi 的 `x-error-code-registry.codes`。
 * 结构：顶层键 `x-error-code-registry:` → 2 空格 `codes:` → 6 空格 `'1001': 文案`。
 * 以 `codes:` 之后的缩进层级判定，遇「缩进 ≤ 2 且非空」的行即视为段结束。
 */
function readOpenapiCodes() {
  const raw = readFileSync(OPENAPI, 'utf8');
  const lines = raw.split(/\r?\n/);
  const entries = [];
  const dupes = [];
  let inRegistry = false;
  let inCodes = false;
  for (const line of lines) {
    if (/^x-error-code-registry:\s*$/.test(line)) {
      inRegistry = true;
      continue;
    }
    if (inRegistry && /^ {2}codes:\s*$/.test(line)) {
      inCodes = true;
      continue;
    }
    if (inCodes) {
      if (/^\s*$/.test(line)) continue;
      const m = /^ {6}'(\d{4})':\s*(.+?)\s*$/.exec(line);
      if (m) {
        entries.push({ code: m[1], message: m[2] });
        continue;
      }
      // 非码行的注释（`# ---- 7xxx ...`）放过；其余缩进回退即段结束
      if (/^ {6}#/.test(line)) continue;
      break;
    }
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.code)) dupes.push(e.code);
    seen.add(e.code);
  }
  return { entries, dupes };
}

/** 解析 codes.ts 的 `ERROR_CODE_MESSAGES`：2 空格缩进的 `1001: '文案',` 行。 */
function readTsCodes() {
  const raw = readFileSync(CODES_TS, 'utf8');
  const lines = raw.split(/\r?\n/);
  const entries = [];
  const dupes = [];
  let inTable = false;
  for (const line of lines) {
    if (/^export const ERROR_CODE_MESSAGES = \{\s*$/.test(line)) {
      inTable = true;
      continue;
    }
    if (inTable) {
      if (/^\}\s*as const;\s*$/.test(line)) break;
      const m = /^ {2}(\d{4}):\s*'(.+)',\s*$/.exec(line);
      if (m) entries.push({ code: m[1], message: m[2] });
      continue;
    }
  }
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.code)) dupes.push(e.code);
    seen.add(e.code);
  }
  return { entries, dupes };
}

const openapi = existsSync(OPENAPI) ? readOpenapiCodes() : { entries: [], dupes: [] };
const ts = existsSync(CODES_TS) ? readTsCodes() : { entries: [], dupes: [] };

if (openapi.entries.length === 0)
  failures.push('openapi x-error-code-registry.codes 解析出 0 条（YAML 结构变了？）');
if (ts.entries.length === 0)
  failures.push('codes.ts 的 ERROR_CODE_MESSAGES 解析出 0 条（文件结构变了？）');
if (openapi.dupes.length > 0) failures.push(`openapi 码表重复码：${openapi.dupes.join(', ')}`);
if (ts.dupes.length > 0) failures.push(`codes.ts 码表重复码：${ts.dupes.join(', ')}`);

const openapiMap = new Map(openapi.entries.map((e) => [e.code, e.message]));
const tsMap = new Map(ts.entries.map((e) => [e.code, e.message]));

const onlyInOpenapi = [...openapiMap.keys()].filter((c) => !tsMap.has(c)).sort();
const onlyInTs = [...tsMap.keys()].filter((c) => !openapiMap.has(c)).sort();
if (onlyInOpenapi.length > 0)
  failures.push(`openapi 有、codes.ts 无（${onlyInOpenapi.length}）：${onlyInOpenapi.join(', ')}`);
if (onlyInTs.length > 0)
  failures.push(`codes.ts 有、openapi 无（${onlyInTs.length}）：${onlyInTs.join(', ')}`);

const textDrift = [];
for (const [code, message] of tsMap) {
  const expected = openapiMap.get(code);
  if (expected !== undefined && expected !== message) {
    textDrift.push(`${code}\n      openapi: ${expected}\n      codes.ts: ${message}`);
  }
}
if (textDrift.length > 0) {
  failures.push(`同码文案不一致（${textDrift.length}）：\n      ` + textDrift.join('\n      '));
}

if (failures.length > 0) {
  console.error('FAIL 错误码表漂移断言：');
  for (const f of failures) console.error('  - ' + f);
  console.error(`（openapi ${openapi.entries.length} 条 vs codes.ts ${ts.entries.length} 条）`);
  process.exit(1);
}

console.log(
  `错误码表双向逐字一致：${openapi.entries.length} 条 = ${ts.entries.length} 条（键与文案均相等）`,
);
