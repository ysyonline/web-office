#!/usr/bin/env node
/**
 * V3.2 浏览器双窗口协同探针（`docs/phase3/tasks/V3.2.md` §4.6 B，W1~W5）。
 *
 * 判据只认三样东西，缺一不可：
 * 1. **两个（以及三个）真实标签页**：不是两个 iframe，也不是同一页面切状态；
 * 2. **页面未刷新**：每次写值前在目标页打随机 marker，采样期间反复校验；
 * 3. **引擎的最终值**：走 `window.__woSheet.getValueByA1` 读，不读我们的 Y.Map 镜像——
 *    只比 Y.Map 的话，即使引擎一个字都没应用也会绿。
 *
 * 服务端由本脚本自己拉起（独立库 `var/wo.web.probe.db`），因为 Vite 把 `/ws/collab`
 * 代理到固定 3100；探针不杀未知进程，3100 被占就直接报错退出。
 *
 * 前置：Vite 5173 与无头 Edge 9333 常驻（起法见 `scripts/probe-web.mjs` 头）。
 *
 * 用法：
 *   node scripts/probe-collab-web.mjs [--port=9333] [--url=http://127.0.0.1:5173/] [--out=C:/tmp]
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = join(ROOT, 'apps/server');
const MAIN = join(SERVER_DIR, 'dist/main.js');
const DB_PATH = join(ROOT, 'var/wo.web.probe.db');
const DB_FILES = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
const HOST = '127.0.0.1';
const PORT = 3100;
const BASE = `http://${HOST}:${PORT}`;

const CDP = argOf('port', '9333');
const PAGE_BASE = argOf('url', 'http://127.0.0.1:5173/');
const OUT_DIR = argOf('out', 'C:/tmp');
const DOC = 'e2e-a';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

class CheckError extends Error {}

function expect(condition, message) {
  if (!condition) throw new CheckError(message);
}

function expectEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new CheckError(`${label}：实际 ${a}，期望 ${e}`);
}

async function assertHealth() {
  const res = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
  if (res.status !== 200) throw new Error(`health status=${res.status}`);
  const body = await res.json();
  expectEqual(body, { status: 'ok' }, 'health body');
}

async function portBusy() {
  try {
    await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(800) });
    return true;
  } catch {
    return false;
  }
}

/** 一条 CDP 连接（浏览器级或页面级共用）。 */
function connectCdp(url, onEvent) {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(url);
    const pending = new Map();
    let seq = 0;
    ws.addEventListener('open', () => {
      resolvePromise({
        send(method, params = {}) {
          return new Promise((res, rej) => {
            const id = ++seq;
            pending.set(id, { res, rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          try {
            ws.close();
          } catch {
            /* 已关闭 */
          }
        },
      });
    });
    ws.addEventListener('error', () => reject(new Error(`CDP 连接失败：${url}`)));
    /**
     * 连接断掉时必须把挂起的请求逐个拒绝。
     *
     * 实测（2026-10-27）：页面渲染进程崩掉后，页面级 CDP WebSocket 会静默关闭，
     * 而 `send()` 返回的 Promise 没有任何人 settle——探针表现为「打完 W5 明细后
     * 永久无输出、进程常驻」。它不是断言失败，是脚本自己挂死，必须转成显式错误。
     */
    ws.addEventListener('close', () => {
      for (const { rej } of pending.values()) rej(new Error(`CDP 连接已关闭：${url}`));
      pending.clear();
    });
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error)));
        else res(msg.result);
        return;
      }
      if (msg.method && onEvent) onEvent(msg.method, msg.params);
    });
  });
}

class Page {
  constructor(name, targetId, cdp) {
    this.name = name;
    this.targetId = targetId;
    this.cdp = cdp;
    this.browser = null;
    this.logs = [];
    this.exceptions = [];
  }

  static async open(browser, name) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
    const wsUrl = await waitTargetWs(targetId);
    const page = new Page(name, targetId, null);
    page.browser = browser;
    page.cdp = await connectCdp(wsUrl, (method, params) => {
      if (method === 'Runtime.consoleAPICalled') {
        page.logs.push({
          type: params.type,
          text: params.args
            .map((a) => a.value ?? a.description ?? a.type)
            .join(' ')
            .slice(0, 300),
        });
      }
      if (method === 'Runtime.exceptionThrown') {
        const d = params.exceptionDetails;
        page.exceptions.push((d.exception?.description ?? d.text).slice(0, 400));
      }
    });
    await page.cdp.send('Runtime.enable');
    await page.cdp.send('Page.enable');
    return page;
  }

  async evaluate(expression) {
    const r = await this.cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
    return r.result.value;
  }

  async goto(url) {
    await this.cdp.send('Page.navigate', { url });
  }

  errors() {
    return this.logs.filter((l) => l.type === 'error');
  }

  async screenshot(file) {
    /**
     * 截图前必须先激活该标签页。
     *
     * 实测（2026-10-27，Edge 122 headless=new）：非激活标签页的 `Page.captureScreenshot`
     * 会**永久不返回**（不是报错），三次探测全在 6s 上限触发；`Target.activateTarget`
     * 之后同一请求 111ms 返回。这解释了「W1~W5 全绿但脚本挂死、截图一张没有」。
     * 截图发生在全部判据之后，激活顺序不影响任何断言。
     */
    await this.browser?.send('Target.activateTarget', { targetId: this.targetId });
    // 截图是证据不是判据，但也不能让脚本无限等待：渲染进程忙/崩时给 15s 上限。
    const shot = await Promise.race([
      this.cdp.send('Page.captureScreenshot', { format: 'png' }),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`截图超时：${file}`)), 15000)),
    ]);
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
  }
}

async function waitTargetWs(targetId) {
  const deadline = Date.now() + 5000;
  for (;;) {
    const list = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
    const target = list.find((t) => t.id === targetId && t.webSocketDebuggerUrl);
    if (target) return target.webSocketDebuggerUrl;
    if (Date.now() >= deadline) throw new Error('新标签页未出现在 /json/list');
    await sleep(100);
  }
}

/** 轮询直到谓词成立；返回最后一次读到的值。 */
async function poll(read, predicate, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = await read();
    if (predicate(last)) return last;
    if (Date.now() >= deadline) {
      throw new CheckError(
        `${label}：等待超时（${timeoutMs}ms），最后一次=${JSON.stringify(last)}`,
      );
    }
    await sleep(100);
  }
}

const readCells = (page, refs) =>
  page.evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const out = {};
    for (const ref of ${JSON.stringify(refs)}) {
      try { out[ref] = h.getValueByA1(ref); }
      catch (e) { out[ref] = '__throw__' + (e && e.message ? ':' + e.message : ''); }
    }
    return out;
  })()`);

const readFormulas = (page, refs) =>
  page.evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const out = {};
    for (const ref of ${JSON.stringify(refs)}) {
      try { out[ref] = h.getFormulaByA1(ref); }
      catch (e) { out[ref] = '__throw__'; }
    }
    return out;
  })()`);

const waitReady = (page, label, timeoutMs = 20000) =>
  poll(
    () =>
      page.evaluate(`(() => {
        const c = window.__woCollab;
        return { status: c ? c.status() : null, hasSheet: !!window.__woSheet };
      })()`),
    (s) => s && s.status === 'ready' && s.hasSheet,
    timeoutMs,
    `${label} 就绪`,
  );

const readStats = (page) => page.evaluate(`window.__woCollab ? window.__woCollab.stats() : null`);

const setValue = (page, ref, value) =>
  page.evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) throw new Error('dev 句柄未挂');
    h.setValueByA1(${JSON.stringify(ref)}, ${JSON.stringify(value)});
    return true;
  })()`);

const waitCells = (page, expected, label, timeoutMs = 5000) =>
  poll(
    () => readCells(page, Object.keys(expected)),
    (snap) =>
      snap && !snap.__missing && Object.entries(expected).every(([ref, v]) => snap[ref] === v),
    timeoutMs,
    label,
  );

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 22) {
    console.error(`[协同] 本探针需要 Node 22.22.2，当前 ${process.versions.node}`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(MAIN)) {
    console.error(`[协同] 找不到 ${MAIN}，先跑 corepack pnpm --filter @wo/server build`);
    process.exitCode = 1;
    return;
  }

  // 浏览器侧前置先查，避免把服务端拉起来才发现没有页面目标。
  let browserWsUrl;
  try {
    const version = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
    browserWsUrl = version.webSocketDebuggerUrl;
    if (!browserWsUrl) throw new Error('无 webSocketDebuggerUrl');
  } catch (err) {
    console.error(
      `[协同] CDP 端口 ${CDP} 不可用：${err instanceof Error ? err.message : err}。先起无头浏览器。`,
    );
    process.exitCode = 1;
    return;
  }
  try {
    const page = await fetch(PAGE_BASE, { signal: AbortSignal.timeout(2000) });
    if (!page.ok) throw new Error(`status=${page.status}`);
  } catch (err) {
    console.error(
      `[协同] Vite ${PAGE_BASE} 不可用：${err instanceof Error ? err.message : err}。先起前端 dev server。`,
    );
    process.exitCode = 1;
    return;
  }

  for (const file of DB_FILES) rmSync(file, { force: true });
  if (await portBusy()) {
    console.error(`[协同] 端口 ${PORT} 已被占用，先停旧服务（本探针不杀未知进程）`);
    process.exitCode = 1;
    return;
  }

  let stdout = '';
  let stderr = '';
  let exited = false;
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      WO_JWT_SECRET: 'probe',
      WO_DB_URL: 'var/wo.web.probe.db',
      WO_LICENSE_PUBLIC_KEY: 'probe',
      PORT: String(PORT),
      LOG_LEVEL: 'warn',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });
  child.on('exit', () => {
    exited = true;
  });

  const pages = [];
  let browser = null;
  const failures = [];

  async function check(id, title, fn) {
    try {
      await fn();
      console.log(`[协同] OK ${id} ${title}`);
    } catch (err) {
      failures.push({ id, title, message: err instanceof Error ? err.message : String(err) });
      console.log(`[协同] FAIL ${id} ${title} :: ${failures.at(-1).message}`);
    }
  }

  try {
    // 服务端就绪
    const readyDeadline = Date.now() + 20000;
    for (;;) {
      if (exited) throw new Error(`服务进程启动时退出 code=${child.exitCode}`);
      try {
        await assertHealth();
        break;
      } catch (err) {
        if (Date.now() >= readyDeadline) {
          throw new Error(`等待服务就绪超时：${err instanceof Error ? err.message : err}`);
        }
      }
      await sleep(100);
    }

    browser = await connectCdp(browserWsUrl);

    let page1;
    let page2;
    let page3;
    const url = new URL(`?collab=${encodeURIComponent(DOC)}`, PAGE_BASE).href;

    await check('W0', '两个独立标签页打开 ?collab=e2e-a 并进入 ready', async () => {
      page1 = await Page.open(browser, '页1');
      page2 = await Page.open(browser, '页2');
      pages.push(page1, page2);
      await Promise.all([page1.goto(url), page2.goto(url)]);
      await Promise.all([waitReady(page1, '页1'), waitReady(page2, '页2')]);
      const [s1, s2] = await Promise.all([readStats(page1), readStats(page2)]);
      expect(s1 && s2, '任一页 __woCollab 不存在');
    });

    await check('W1', '两页都显示 3×3 播种（A1=1、A3=3）', async () => {
      const [c1, c2] = await Promise.all([
        waitCells(page1, { A1: 1, A2: 2, A3: 3 }, '页1 播种'),
        waitCells(page2, { A1: 1, A2: 2, A3: 3 }, '页2 播种'),
      ]);
      const [f1, f2] = await Promise.all([
        readFormulas(page1, ['A3']),
        readFormulas(page2, ['A3']),
      ]);
      expectEqual(f1.A3, '=SUM(A1:A2)', '页1 A3 公式');
      expectEqual(f2.A3, '=SUM(A1:A2)', '页2 A3 公式');
      console.log(`[协同] W1 明细：页1=${JSON.stringify(c1)} 页2=${JSON.stringify(c2)}`);
    });

    await check('W2', '页1 改 A1=5 → 页2 的 A3 在 3s 内变 7（且页2 未刷新）', async () => {
      const mark = `w2-${Date.now()}`;
      await page2.evaluate(`window.__woProbeMark = ${JSON.stringify(mark)}`);
      const startedAt = Date.now();
      await setValue(page1, 'A1', 5);
      const snap = await poll(
        () => readCells(page2, ['A1', 'A3']),
        (s) => s && !s.__missing && s.A1 === 5 && s.A3 === 7,
        3000,
        '页2 收到 A1=5',
      );
      const elapsed = Date.now() - startedAt;
      const alive = await page2.evaluate(`window.__woProbeMark === ${JSON.stringify(mark)}`);
      expect(alive, '页2 的 marker 丢失：中途发生了刷新');
      console.log(`[协同] W2 明细：页2=${JSON.stringify(snap)}｜耗时 ${elapsed}ms｜marker 存活`);
    });

    await check('W3', '页2 改 A1=9 → 页1 的 A3 变 11（反向上行）', async () => {
      const mark = `w3-${Date.now()}`;
      await page1.evaluate(`window.__woProbeMark = ${JSON.stringify(mark)}`);
      const startedAt = Date.now();
      await setValue(page2, 'A1', 9);
      const snap = await poll(
        () => readCells(page1, ['A1', 'A3']),
        (s) => s && !s.__missing && s.A1 === 9 && s.A3 === 11,
        3000,
        '页1 收到 A1=9',
      );
      const elapsed = Date.now() - startedAt;
      const alive = await page1.evaluate(`window.__woProbeMark === ${JSON.stringify(mark)}`);
      expect(alive, '页1 的 marker 丢失：中途发生了刷新');
      console.log(`[协同] W3 明细：页1=${JSON.stringify(snap)}｜耗时 ${elapsed}ms｜marker 存活`);
    });

    await check('W4', '页3 迟到进房：直接看到 A1=9、A3=11（历史回放）', async () => {
      page3 = await Page.open(browser, '页3');
      pages.push(page3);
      await page3.goto(url);
      await waitReady(page3, '页3');
      const snap = await waitCells(page3, { A1: 9, A3: 11 }, '页3 历史回放', 15000);
      const stats = await readStats(page3);
      expectEqual(stats.loadVersion, 0, '页3 LOAD.version（未物化时应为 0）');
      expectEqual(stats.baseSeq, 0, '页3 LOAD.baseSeq');
      expect(stats.receivedUpdates > 0, `页3 未收到回放帧：${JSON.stringify(stats)}`);
      expect(
        stats.localCells === 0,
        `页3 不该有本地写入（会与「从历史恢复」混淆）：${stats.localCells}`,
      );
      console.log(`[协同] W4 明细：页3=${JSON.stringify(snap)}｜stats=${JSON.stringify(stats)}`);
    });

    await check('W5', '静置后无回声环、无 error、命令次数有上界', async () => {
      await Promise.all([setValue(page1, 'B1', 101), setValue(page2, 'B2', 202)]);
      await waitCells(page2, { B1: 101 }, '页2 收到页1 的 B1');
      await waitCells(page1, { B2: 202 }, '页1 收到页2 的 B2');

      await sleep(2000);
      const [a1, a2] = await Promise.all([readStats(page1), readStats(page2)]);
      await sleep(1000);
      const [b1, b2] = await Promise.all([readStats(page1), readStats(page2)]);

      const stable = (a, b, label) => {
        expectEqual(
          [a.sentUpdates, a.localCells, a.remoteCells],
          [b.sentUpdates, b.localCells, b.remoteCells],
          `${label} 静置期间计数漂移（疑似回声环）`,
        );
      };
      stable(a1, b1, '页1');
      stable(a2, b2, '页2');

      const bounded = (s, label) => {
        expect(s.localCells <= 20, `${label} localCells=${s.localCells} 超上界 20`);
        expect(s.remoteCells <= 60, `${label} remoteCells=${s.remoteCells} 超上界 60`);
        expect(s.remoteBatches <= 30, `${label} remoteBatches=${s.remoteBatches} 超上界 30`);
      };
      bounded(a1, '页1');
      bounded(a2, '页2');

      for (const page of pages) {
        expectEqual(page.exceptions.length, 0, `${page.name} 未捕获异常`);
        expectEqual(
          page.errors().map((e) => e.text),
          [],
          `${page.name} 控制台 error`,
        );
      }
      console.log(
        `[协同] W5 明细：页1=${JSON.stringify(a1)} 页2=${JSON.stringify(a2)}｜静置 2s+1s 计数稳定`,
      );
    });

    await page1.screenshot(`${OUT_DIR}/probe-collab-page1.png`);
    await page2.screenshot(`${OUT_DIR}/probe-collab-page2.png`);
    if (page3) await page3.screenshot(`${OUT_DIR}/probe-collab-page3.png`);
  } finally {
    for (const page of pages) {
      try {
        await browser?.send('Target.closeTarget', { targetId: page.targetId });
      } catch {
        /* 目标已关闭 */
      }
      page.cdp.close();
    }
    browser?.close();
    if (!exited) {
      child.kill();
      const deadline = Date.now() + 3000;
      while (!exited && Date.now() < deadline) await sleep(50);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[协同] ${failures.length} 条判据失败；库文件保留在 ${DB_PATH}`);
    console.error(`[协同] 服务端 stdout 尾部：\n${stdout.slice(-2000)}`);
    console.error(`[协同] 服务端 stderr 尾部：\n${stderr.slice(-2000)}`);
    process.exitCode = 1;
    return;
  }

  for (const file of DB_FILES) rmSync(file, { force: true });
  console.log('\n[协同] 6 条判据全部通过（W0 就绪 + W1~W5）');
}

await main();
