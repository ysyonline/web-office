#!/usr/bin/env node
/**
 * 代码基线自检（P3-010 起）：一条命令跑完全部门禁段，逐段打印耗时与退出码。
 * （不写死段数——段会随批次增删，写死必然过期；以末行「N/M 段通过」为准。）
 *
 * 为什么不写成 npm script 的 `&&` 长串：
 *  ① 长串只会在第一个失败处停，看不到「哪些段其实过了」；
 *  ② 每段都要重新解析一次 pnpm 入口，而 pnpm 自身的 shim 在某些 Node 环境下会崩
 *     （corepack 的 ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING）——那是环境问题，不该冒充代码红。
 * 所以这里直接用当前 node 进程 spawn 各工具的 JS 入口，与 pnpm/PATH 解耦。
 *
 * P3-011-06（2026-10-25 收官包）：把 P3-011 期间交付的三条结构断言脚本
 * （模块图零环 / 端点分组 / 契约 schema 命名）从「单独人跑」接入本自检，段数 10 → 13。
 * 三条脚本都是**只读文本检查**（不产副作用），符合 §2 副决策 (c) 的「verify 只装检查」
 * 前提——build 段仍不进 verify（会写 dist/）。此前它们只在包内验收时跑过一次，
 * 之后任何新模块/改名/聚合改动都不会被自动拦住，这是接入的真正理由。
 *
 * 第七段（2026-10-24 条 Q ③ + 条 S① 代码批，用户放行「继续」）：
 *  - check-doc-discipline.mjs：卡体量阈值（warn 8,000 / fail 12,000）+ 状态行 ≤400
 *    + 措辞族传导机检（curated 短语表）；
 *  - check_openapi_contract.py：openapi 契约门禁从「ANCHORS §0 人肉三连」接入自检，
 *    用系统 python 跑（脚本自带 -X utf8 兼容；python 不在场时 SKIP 并计失败——
 *    与「找不到 node_modules 工具」同一处理：环境缺位不冒充 PASS）。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{name: string, cmd: string|null, args: string[], runner?: 'node'|'python'}[]} */
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
  // 2026-10-24 P3-010-03：类型段从「只覆盖 shared」扩为 workspace 级，
  // 与根 `typecheck` 脚本（显式枚举三 project，不嵌套 pnpm）逐字对应。
  // 若只留 shared 一段，apps/* 的类型错误就进不了自检，门禁与脚本口径分叉。
  {
    name: '类型（tsc server）',
    cmd: 'typescript/bin/tsc',
    args: ['-p', 'apps/server/tsconfig.json'],
  },
  {
    name: '类型（tsc web）',
    cmd: 'typescript/bin/tsc',
    args: ['-p', 'apps/web/tsconfig.json'],
  },
  {
    name: '规则测试（RuleTester）',
    cmd: null,
    args: [
      '--test',
      'packages/config/rules/no-emoji.test.mjs',
      'packages/config/rules/no-hardcoded-color.test.mjs',
      // 2026-10-25 P3-011-06 收口补齐：-05 把本文件挂进了根 `test:rules`，
      // 但 verify 的规则测试段仍是两文件——门禁与脚本口径分叉（同 P3-010-03
      // 「类型段只覆盖 shared」的教训：脚本扩了、门禁没跟，等于没进自检）。
      'packages/config/rules/request-schema-strict.test.mjs',
    ],
  },
  { name: '依赖面断言（A~J）', cmd: null, args: ['scripts/check-workspace-deps.mjs'] },
  // 2026-10-25 P3-011-06：P3-011 三条结构断言进自检（段数 10 → 13）。
  // 三者都是只读文本解析、零依赖、不写盘，属于「检查」而非「构建」，故可进 verify；
  // build（会写 dist/）依旧不进（ANCHORS §2 副决策 (c)）。
  { name: '模块图（零环/根模块全量注册）', cmd: null, args: ['scripts/check-module-graph.mjs'] },
  {
    name: '端点分组（openapi.tags 10 组）',
    cmd: null,
    args: ['scripts/check-endpoint-groups.mjs'],
  },
  { name: '契约 schema 命名（双向逐字相等）', cmd: null, args: ['scripts/check-schema-names.mjs'] },
  // 2026-10-22 新增：临时件必须在结论落盘后回收到 .workbuddy/trash/，
  // 这条纪律此前只有文字、没有 fail 条件，同日就残留了一份 handoff。
  { name: '文档临时件回收', cmd: null, args: ['scripts/check-temp-docs.mjs'] },
  // 2026-10-24 新增（条 Q ③ + 条 S①）：文档纪律机检 + openapi 契约门禁接入。
  {
    name: '文档纪律（卡体量/状态行/措辞族）',
    cmd: null,
    args: ['scripts/check-doc-discipline.mjs'],
  },
  {
    name: 'openapi 契约门禁',
    cmd: null,
    args: ['-X', 'utf8', 'scripts/check_openapi_contract.py'],
    runner: 'python',
  },
];

let failed = 0;
for (const step of STEPS) {
  const started = Date.now();
  let ok = false;
  if (step.runner === 'python') {
    const res = spawnSync('python', step.args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
    ok = res.status === 0;
    if (res.error && res.error.code === 'ENOENT') {
      process.stdout.write(
        `SKIP  ${step.name}：python 不在 PATH（先装 python 或单独跑契约门禁）\n`,
      );
      failed += 1;
      continue;
    }
    if (!ok) {
      process.stdout.write(`${res.stdout ?? ''}${res.stderr ?? ''}\n`);
    }
  } else {
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
    ok = res.status === 0;
    if (!ok) {
      process.stdout.write(`${res.stdout ?? ''}${res.stderr ?? ''}\n`);
    }
  }
  const ms = Date.now() - started;
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${step.name}  ${ms}ms\n`);
  if (!ok) failed += 1;
}

process.stdout.write(`\n${STEPS.length - failed}/${STEPS.length} 段通过\n`);
process.exit(failed === 0 ? 0 : 1);
