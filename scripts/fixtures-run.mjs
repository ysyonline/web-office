/**
 * 契约夹具运行器（P3-011-05，D1-13 V-S2 / A-PATH 的载体）。
 *
 * 零依赖纯 node（P3-001 §5.4-3：前后端 CI 跑同一条命令 `node scripts/fixtures-run.mjs`；
 * 后端不得装 vitest）。样本定义在 `packages/shared/validation-fixtures/*.json`，
 * schema 从 `@wo/shared` 的 dist/cjs 产物加载——本脚本不读 src，是「构建产物行为断言」。
 *
 * 断言口径（D1-13 派单判据，逐样本）：
 *  1. **四者齐全**：每个 issue 映射出 code / field / rule / message 四个非空值
 *     （field = z.core.toDotPath(issue.path) || '(root)'，与 -04 管道的 toItem 同口径；
 *     本脚本刻意不 import 管道——它是 Nest 侧实现，夹具只锁 schema 层行为）。
 *  2. **V-S2 中文文案兜底**：issue.message 不得命中 zod 默认英文黑名单正则
 *     `Expected |invalid_type|Too small|Too big|Invalid |recognized|Unrecognized`。
 *     **不判「无 ASCII 字母」**：合法中文文案含 SSO/LDAP/URL/API 即误伤。
 *     本脚本自己执行 `z.config(z.locales.zhCN())`——这是 apps/server zh-locale.ts 的
 *     运行时等价物（生产入口 app.module 显式 side-effect import），若有人删掉那行，
 *     此处黑名单立刻命中（回归探测器）。
 *  3. **A-PATH**：每条 issue 满足 `path.length > 0 || code === 'unrecognized_keys'`；
 *     且 unrecognized_keys 的 message 必须内联未知键名（卡 v1.8 补：field 恒 (root) 时
 *     键名信息只可能在 message 里）。
 *  4. **unknown-key 样本必产 unrecognized_keys issue**（A-STRICT 判据 2 测试面——
 *     若 schema 被改回裸 z.object，未知键被静默剥离，此处立刻红）。
 *  5. **strip-control 对照样本必须成功且剥离探针键**（-03 裁决：响应侧保持 strip 语义；
 *     若有人把响应侧改成 strict，此处红——那是契约变更，须走解冻流程）。
 *
 * dist 新鲜度：src 任一文件比 dist/cjs/index.js 新时自动重建（防陈旧产物假绿）。
 * 退出码：任何断言失败 → 1（逐条打印）；全绿 → 0 + 汇总行。
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sharedDir = path.join(root, 'packages', 'shared');
const distEntry = path.join(sharedDir, 'dist', 'cjs', 'index.js');
const fixturesDir = path.join(sharedDir, 'validation-fixtures');

/** dist 新鲜度：src/**任一文件比 dist 产物新 → 重建（Windows 下 mtime 粒度足够）。 */
function ensureFreshDist() {
  const newestSrc = (() => {
    let newest = 0;
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = statSync(full);
        if (st.isDirectory()) walk(full);
        else if (/\.(ts|mts|cts)$/.test(name)) newest = Math.max(newest, st.mtimeMs);
      }
    };
    walk(path.join(sharedDir, 'src'));
    return newest;
  })();
  const distTime = existsSync(distEntry) ? statSync(distEntry).mtimeMs : -1;
  if (newestSrc > distTime) {
    console.log('[fixtures-run] dist 落后于 src，先重建 @wo/shared ...');
    const r = spawnSync('pnpm', ['--filter', '@wo/shared', 'run', 'build'], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (r.status !== 0) {
      console.error('[fixtures-run] @wo/shared 构建失败，无法继续');
      process.exit(1);
    }
  }
}

/**
 * V-S2 黑名单（卡面原文逐字）：zod 内置英文 message 模板特征。
 * 注意 `invalid_type` 是 issue code 不是 message——但默认英文 message 里含
 * "Invalid input: expected string, received number" 等形态，黑名单抓的是 message 面。
 */
const V_S2_BLACKLIST = /Expected |invalid_type|Too small|Too big|Invalid |recognized|Unrecognized/;
const PROBE_KEY = '__probe_unknown__';

const failures = [];
let checked = 0;

function fail(msg) {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}

ensureFreshDist();

// —— 加载：CJS 通道保证 zod 单实例（dist/cjs 与本脚本 require 到同一份 zod），
//    z.config 才能作用于 schema 的 parse 文案；ESM/CJS 双包混用会拿到两个实例。 ——
const requireFromShared = createRequire(path.join(sharedDir, 'package.json'));
const z = requireFromShared('zod');
z.config(z.locales.zhCN());
const shared = requireFromShared(distEntry);

console.log('[fixtures-run] zod 实例一致性检查 + zhCN 文案已启用');

// 逐个 fixture 文件执行
const files = readdirSync(fixturesDir)
  .filter((f) => f.endsWith('.json'))
  .sort();
for (const file of files) {
  const entries = JSON.parse(readFileSync(path.join(fixturesDir, file), 'utf8'));
  console.log(`\n[${file}]`);

  for (const entry of entries) {
    const schema = shared[entry.schema];
    if (!schema || typeof schema.safeParse !== 'function') {
      fail(`${entry.schema}: @wo/shared 未导出该 schema 或其上无 safeParse`);
      continue;
    }

    for (const sample of entry.samples ?? []) {
      checked++;
      const label = `${entry.schema} ← ${sample.name}`;
      const result = schema.safeParse(sample.input);

      if (sample.expect === 'fail') {
        if (result.success) {
          fail(`${label}: 期望失败但 safeParse 成功（strict/约束疑似被放松）`);
          continue;
        }
        const issues = result.error?.issues ?? [];
        if (issues.length === 0) {
          fail(`${label}: 失败但 issues 为空（异常形态，无法映射错误体）`);
          continue;
        }

        for (const issue of issues) {
          // 判据 1：四者齐全（与 -04 toItem 同口径映射）
          const code = typeof issue.code === 'string' ? issue.code : '';
          const field = z.core.toDotPath(issue.path) || '(root)';
          const rule = issue.code;
          const message = typeof issue.message === 'string' ? issue.message : '';
          if (!code) fail(`${label}: issue.code 非非空字符串（${JSON.stringify(issue.code)}）`);
          if (!field) fail(`${label}: field 为空（应回落 (root)）`);
          if (!rule) fail(`${label}: rule 为空`);
          if (!message.trim()) fail(`${label}: message 为空`);

          // 判据 2：V-S2 黑名单
          if (V_S2_BLACKLIST.test(message)) {
            fail(`${label}: message 命中 V-S2 黑名单（英文兜底文案）: "${message}"`);
          }

          // 判据 3：A-PATH
          if (!(issue.path.length > 0 || issue.code === 'unrecognized_keys')) {
            fail(`${label}: A-PATH 违例——path 为空且 code=${issue.code}`);
          }
          if (issue.code === 'unrecognized_keys' && !message.includes(PROBE_KEY)) {
            fail(
              `${label}: unrecognized_keys 的 message 未内联未知键名（卡 v1.8 补）: "${message}"`,
            );
          }
        }

        // 判据 4：unknown-key 样本必产 unrecognized_keys（A-STRICT 判据 2 的测试面）
        if (sample.name === 'unknown-key') {
          const codes = issues.map((i) => i.code);
          if (!codes.includes('unrecognized_keys')) {
            fail(
              `${label}: 未知键样本未产 unrecognized_keys（strict 语义丢失？）codes=${JSON.stringify(codes)}`,
            );
          }
        }
      } else if (sample.expect === 'pass-strip') {
        // 判据 5：strip 对照面
        if (!result.success) {
          fail(
            `${label}: 对照样本应成功却失败: ${JSON.stringify(result.error?.issues?.map((i) => i.message))}`,
          );
          continue;
        }
        if (result.data && typeof result.data === 'object' && PROBE_KEY in result.data) {
          fail(`${label}: 对照样本输出未剥离探针键（strip 语义丢失？）`);
        }
      } else {
        fail(`${label}: 未知 expect 值 ${JSON.stringify(sample.expect)}`);
      }
    }

    // strip-control（响应侧对照面，独立于 samples 列表）
    if (entry.stripControl ?? entry['strip-control']) {
      checked++;
      const ctrl = entry.stripControl ?? entry['strip-control'];
      const label = `${entry.schema} ← strip-control`;
      const result = schema.safeParse(ctrl.input);
      if (!result.success) {
        fail(
          `${label}: 对照样本应成功却失败: ${JSON.stringify(result.error?.issues?.map((i) => i.message))}`,
        );
      } else if (result.data && typeof result.data === 'object' && PROBE_KEY in result.data) {
        fail(`${label}: 输出未剥离探针键（响应侧 strip 语义丢失）`);
      }
    }
  }

  // 文件级收尾标记（failures 里有本文件的才打红）
  const hadFailure = failures.length > 0;
  if (!hadFailure) ok(`${file} 全部样本通过`);
}

// 汇总
console.log(`\n[fixtures-run] 共断言 ${checked} 个样本；失败 ${failures.length} 项`);
if (failures.length > 0) {
  console.error('[fixtures-run] FAILED');
  process.exit(1);
}
console.log('[fixtures-run] ALL GREEN');
