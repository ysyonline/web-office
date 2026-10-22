#!/usr/bin/env node
/**
 * 代码基线自检（P3-010 起）：一条命令跑完六段，逐段打印耗时与退出码。
 *
 * 为什么不写成 npm script 的 `&&` 长串：
 *  ① 长串只会在第一个失败处停，看不到「哪些段其实过了」；
 *  ② 每段都要重新解析一次 pnpm 入口，而 pnpm 自身的 shim 在某些 Node 环境下会崩
 *     （corepack 的 ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING）——那是环境问题，不该冒充代码红。
 * 所以这里直接用当前 node 进程 spawn 各工具的 JS 入口，与 pnpm/PATH 解耦。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{name: string, cmd: string, args: string[]}[]} */
const STEPS = [
  { name: '格式（prettier --check）', cmd: 'prettier/bin/prettier.cjs', args: ['--check', '.'] },
  {
    name: 'lint（eslint --max-warnings=0）',
    cmd: 'eslint/bin/eslint.js',
    args: ['.', '--max-warnings=0'],
  },
  {
    name: '类型（tsc shared）',
    cmd: 'typescript/bin/tsc',
    args: ['-p', 'packages/shared/tsconfig.json'],
  },
  {
    name: '规则测试（RuleTester）',
    cmd: null,
    args: [
      '--test',
      'packages/config/rules/no-emoji.test.ts',
      'packages/config/rules/no-hardcoded-color.test.ts',
    ],
  },
  { name: '依赖面断言（A~H）', cmd: null, args: ['scripts/check-workspace-deps.mjs'] },
  // 2026-10-22 新增：临时件必须在结论落盘后回收到 .workbuddy/trash/，
  // 这条纪律此前只有文字、没有 fail 条件，同日就残留了一份 handoff。
  { name: '文档临时件回收', cmd: null, args: ['scripts/check-temp-docs.mjs'] },
];

let failed = 0;
for (const step of STEPS) {
  const started = Date.now();
  const target = step.cmd ? resolve(ROOT, 'node_modules', step.cmd) : null;
  if (target && !existsSync(target)) {
    process.stdout.write(`SKIP  ${step.name}：找不到 ${target}（先跑 pnpm install）\n`);
    failed += 1;
    continue;
  }
  const res = spawnSync(process.execPath, [...(target ? [target] : []), ...step.args], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  const ms = Date.now() - started;
  const ok = res.status === 0;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${step.name}  ${ms}ms\n`);
  if (!ok) {
    failed += 1;
    process.stdout.write(`${res.stdout ?? ''}${res.stderr ?? ''}\n`);
  }
}

process.stdout.write(`\n${STEPS.length - failed}/${STEPS.length} 段通过\n`);
process.exit(failed === 0 ? 0 : 1);
