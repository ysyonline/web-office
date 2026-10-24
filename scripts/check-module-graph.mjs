#!/usr/bin/env node
/**
 * 模块图断言（P3-011-02 交付）：零环 + 根模块覆盖全部模块 + 一目录一模块文件。
 *
 * 为什么现在就要零环断言：骨架期 10 个模块之间确实没有依赖，零环是「天花板已封顶」——
 * 它约束的是**后续包**：任何新加的跨模块依赖都必须让本脚本仍然零环，
 * 否则等到 P3-012 起模块开始互相 import 时，环会以「启动期依赖注入解析顺序」
 * 这种极难定位的形态暴露。现在立断言，成本是一次解析；那时立，成本是一次重构。
 *
 * 三条断言：
 *  A 模块图零环（DFS 三色，命中即打印环路径）
 *  B app.module.ts 的 imports 覆盖全部模块类，且不含未定义的模块类（双向）
 *  C 每个模块目录恰好一个 `*.module.ts`（0 个 = 漏建；>1 个 = 一个目录塞了两模块，图会失真）
 *
 * 零依赖运行：只做文本解析，不 import TS 编译器。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'apps/server/src');
const MODULES_DIR = join(SRC, 'modules');
const APP_MODULE = join(SRC, 'app.module.ts');

const failures = [];

/** 从 `@Module({ ... })` 块里取出 `imports: [...]` 的标识符（只认 *Module）。 */
function readImports(text) {
  const block = /@Module\(\{([\s\S]*?)\n\}\)/.exec(text);
  if (!block) return [];
  const arr = /imports:\s*\[([\s\S]*?)\]/.exec(block[1]);
  if (!arr) return [];
  return [...arr[1].matchAll(/\b([A-Za-z_]\w*Module)\b/g)].map((m) => m[1]);
}

/** 从文件里取导出的模块类名。 */
function readModuleClass(text) {
  const m = /export\s+class\s+([A-Za-z_]\w*Module)\b/.exec(text);
  return m ? m[1] : null;
}

if (!existsSync(MODULES_DIR)) failures.push(`模块目录不存在：${MODULES_DIR}`);
if (!existsSync(APP_MODULE)) failures.push(`根模块不存在：${APP_MODULE}`);

const dirs = existsSync(MODULES_DIR)
  ? readdirSync(MODULES_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
  : [];

/** @type {Map<string, {file: string, deps: string[]}>} */
const graph = new Map();

for (const d of dirs) {
  const dirAbs = join(MODULES_DIR, d);
  const modFiles = readdirSync(dirAbs).filter((f) => f.endsWith('.module.ts'));
  if (modFiles.length !== 1) {
    failures.push(`目录 ${d} 有 ${modFiles.length} 个 *.module.ts（应恰为 1 个）`);
    if (modFiles.length === 0) continue;
  }
  const file = join(dirAbs, modFiles[0]);
  const text = readFileSync(file, 'utf8');
  const cls = readModuleClass(text);
  if (!cls) {
    failures.push(`${d}/${modFiles[0]} 未导出 *Module 类`);
    continue;
  }
  graph.set(cls, { file: `apps/server/src/modules/${d}/${modFiles[0]}`, deps: readImports(text) });
}

// A 零环（DFS 三色）
const WHITE = 0;
const GRAY = 1;
const BLACK = 2;
/** @type {Map<string, number>} */
const color = new Map([...graph.keys()].map((k) => [k, WHITE]));
/** @type {string[]} */
const stack = [];
const cycles = [];

/** @param {string} node */
function dfs(node) {
  color.set(node, GRAY);
  stack.push(node);
  const deps = graph.get(node)?.deps ?? [];
  for (const dep of deps) {
    if (!graph.has(dep)) continue; // 跨组依赖不属本图，B 断言会报未注册
    const c = color.get(dep);
    if (c === GRAY) {
      const at = stack.indexOf(dep);
      cycles.push([...stack.slice(at), dep].join(' -> '));
    } else if (c === WHITE) {
      dfs(dep);
    }
  }
  stack.pop();
  color.set(node, BLACK);
}

for (const node of graph.keys()) if (color.get(node) === WHITE) dfs(node);
for (const c of cycles) failures.push(`模块图存在环：${c}`);

// B 与根模块双向对齐
const appText = existsSync(APP_MODULE) ? readFileSync(APP_MODULE, 'utf8') : '';
const appImports = readImports(appText);
const declared = new Set(graph.keys());
const appSet = new Set(appImports);

for (const cls of declared) if (!appSet.has(cls)) failures.push(`根模块未注册：${cls}`);
for (const cls of appSet) if (!declared.has(cls)) failures.push(`根模块注册了不存在的模块：${cls}`);
if (appImports.length !== appSet.size)
  failures.push(`根模块 imports 有重复项（${appImports.length} 项 / ${appSet.size} 个唯一）`);

const edgeCount = [...graph.values()].reduce((n, v) => n + v.deps.length, 0);

if (failures.length) {
  process.stderr.write(`模块图断言失败（${failures.length} 条）：\n`);
  for (const f of failures) process.stderr.write(`  - ${f}\n`);
  process.exit(1);
}

process.stdout.write(
  `模块图断言通过：${graph.size} 个模块 / ${edgeCount} 条模块间依赖 / 零环 / 根模块全量注册\n`,
);
