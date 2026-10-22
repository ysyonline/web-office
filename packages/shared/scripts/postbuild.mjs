/**
 * 双构建收尾：给两份产物各自打上模块类型标记。
 *
 * 为什么需要：包本身 `"type": "module"`，dist/cjs 下的 .js 若没有就近的 package.json，
 * Node 会按 ESM 解析并直接 SyntaxError。tsc 不会生成这个文件，只能构建后写。（P3-001 §5.3）
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');

const markers = [
  ['esm', { type: 'module' }],
  ['cjs', { type: 'commonjs' }],
];

for (const [dir, body] of markers) {
  const target = resolve(dist, dir, 'package.json');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  process.stdout.write(`wrote ${target}\n`);
}
