#!/usr/bin/env node
/**
 * 契约 schema 命名断言（P3-011-03 交付）：`packages/shared/src/schemas/` 出口的
 * 22 个导出名 与 `docs/api/openapi.yaml` `components.schemas` 的键名**双向逐字相等**。
 *
 * 判据基座（D1-13 ① 栏）：openapi.yaml 手写件是唯一契约事实源，zod 定义是执行面。
 * 改名/多一/少一即 fail。
 *
 * 「请求 9 + 响应 13」的拆分口径**不做机检**（交接件缺陷 2 的修法）：按引用方向机械
 * 复现的是 8（仅 requestBody）+ 12（responses）+ 2（Error 树内嵌），9/13 无法从
 * openapi 导出；拆分数只作说明性注释，断言只认「22 名集合双向相等」。
 *
 * 四条防假绿：
 *  - schemas 段解析出 0 条 → FAIL（YAML 结构变了而脚本没跟上，会伪装成「零缺失」）
 *  - zod 出口解析出 0 条 → FAIL（同上）
 *  - openapi 文件不存在 → FAIL
 *  - schemas 出口文件不存在 → FAIL
 *
 * 零依赖运行：不引 YAML 库、不动 TS 编译器——zod 侧出口名单从 `src/schemas/index.ts`
 * 的 `export {...} from './xxx.js'` 语句按正则提取（与 check-endpoint-groups.mjs 的
 * 缩进解析同风格）；`export { ErrorSchema as Error }` 取别名后的 `Error`。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPENAPI = join(ROOT, 'docs/api/openapi.yaml');
const INDEX = join(ROOT, 'packages/shared/src/schemas/index.ts');

const failures = [];

if (!existsSync(OPENAPI)) failures.push(`openapi.yaml 不存在：${OPENAPI}`);
if (!existsSync(INDEX)) failures.push(`schemas 出口不存在：${INDEX}`);

/** 从 openapi.yaml 按 4 空格缩进提取 components.schemas 的键名。 */
function readOpenapiSchemaNames() {
  const raw = readFileSync(OPENAPI, 'utf8');
  const lines = raw.split(/\r?\n/);
  const names = [];
  let inSchemas = false;
  for (const line of lines) {
    if (/^components:\s*$/.test(line)) continue;
    if (/^ {2}schemas:\s*$/.test(line)) {
      inSchemas = true;
      continue;
    }
    if (inSchemas) {
      if (/^\S/.test(line)) break; // 下一个顶层键，schemas 段结束
      const m = /^ {4}([A-Za-z0-9_]+):\s*(#.*)?$/.exec(line);
      if (m) names.push(m[1]);
    }
  }
  return names;
}

/** 从 schemas/index.ts 提取出口导出名（含 `X as Y` 的别名 Y）。 */
function readZodExportNames() {
  const raw = readFileSync(INDEX, 'utf8');
  const names = [];
  // 逐条 export {...} from '...' 语句
  const stmts = raw.matchAll(/export\s*\{([^}]*)\}\s*from/g);
  for (const stmt of stmts) {
    for (const piece of stmt[1].split(',')) {
      const item = piece.trim();
      if (item === '') continue;
      const as = /^([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)$/.exec(item);
      names.push(as ? as[2] : item);
    }
  }
  return names;
}

const openapiNames = existsSync(OPENAPI) ? readOpenapiSchemaNames() : [];
const zodNames = existsSync(INDEX) ? readZodExportNames() : [];

if (openapiNames.length === 0)
  failures.push('openapi components.schemas 解析出 0 条（YAML 结构变了？）');
if (zodNames.length === 0) failures.push('schemas/index.ts 解析出 0 条导出（文件结构变了？）');

const openapiSet = new Set(openapiNames);
const zodSet = new Set(zodNames);

// 双向差集
const onlyInOpenapi = openapiNames.filter((n) => !zodSet.has(n));
const onlyInZod = zodNames.filter((n) => !openapiSet.has(n));

if (onlyInOpenapi.length > 0) {
  failures.push(`openapi 有、zod 出口无（${onlyInOpenapi.length}）：${onlyInOpenapi.join(', ')}`);
}
if (onlyInZod.length > 0) {
  failures.push(`zod 出口有、openapi 无（${onlyInZod.length}）：${onlyInZod.join(', ')}`);
}

// 出口内重名（两个 as 同名等）也是缺陷
const dupes = zodNames.filter((n, i) => zodNames.indexOf(n) !== i);
if (dupes.length > 0) failures.push(`zod 出口内重名：${[...new Set(dupes)].join(', ')}`);

if (failures.length > 0) {
  console.error('FAIL 契约 schema 命名断言：');
  for (const f of failures) console.error('  - ' + f);
  console.error(`（openapi ${openapiNames.length} 个 vs zod 出口 ${zodNames.length} 个）`);
  process.exit(1);
}

console.log(
  `契约 schema 命名双向相等：${openapiNames.length} 个 = ${zodNames.length} 个（逐字对齐）`,
);
