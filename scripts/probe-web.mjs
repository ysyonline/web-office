/**
 * 前端真机渲染探针（D1/V1.2.1 首次落地，后续 V1.x 复用）。
 *
 * 存在的理由：`verify.mjs` 只能证明「编译过、类型对」，证明不了「浏览器里真的画出来了」。
 * 本项目要求验收必须真跑一次（ROADMAP §7 硬规则 3），而 canvas 渲染的表格无法用
 * DOM 断言判断对错，必须截图 + 控制台取证。本脚本把这件事固化成一条命令。
 *
 * 前置：`pnpm --filter @wo/web dev` 已起；一个**独立端口**的无头浏览器已起，例如
 *   msedge.exe --headless=new --remote-debugging-port=9333 \
 *     --user-data-dir=C:/tmp/wo-edge --window-size=1440,900 about:blank
 *
 * 用法：
 *   node scripts/probe-web.mjs                     # 只检查渲染与报错
 *   node scripts/probe-web.mjs --edit              # 额外双击单元格并输入文本
 *   node scripts/probe-web.mjs --assert=A1=1,A2=2,A3=3   # 按 A1 取值断言（走 dev 句柄）
 *   node scripts/probe-web.mjs --port=9333 --url=http://127.0.0.1:5173/
 *
 * 退出码：0 表示 canvas 已出现且无 console error / 未捕获异常（给了 `--assert` 时还要求断言全过）；
 * 1 表示不满足。
 *
 * ## 断言为什么必须「轮询 + 记跃迁」（V1.2.2 的判据核心，别改成 sleep 固定值）
 * `spike/formula-runtime-spike/REPORT.md` §1 B1/B2 已实证：浏览器端载入时**初算不冲缓存值**。
 * 演示数据里 A3 只给 `f` 不给 `v`，因此 `null → 数字` 的跃迁本身就证明公式引擎算过；
 * 若改成固定 sleep，就分不清「引擎算完了」和「还没算但碰巧读到了别的值」。
 * 首次计算时机在 preset 装配下未验，故轮询上限给 6s（任务卡写的 3s 是单格预算，三格留余量）。
 *
 * ## 另外两条踩过的坑（别重犯）
 * 1. **端口不能选 9222**：WorkBuddy 自身 Electron 就占着它，`bind()` 会失败，探针会连到
 *    编辑器自己的窗口，采到的全是宿主日志（ServiceProxy / wbscrash），得出一份假报告。
 *    判断依据是 `/json/version` 的 UA：真 Edge 显示 `Edg/`，宿主显示 `WorkBuddy/`。
 * 2. **无头浏览器必须以受管后台进程常驻**：用 `&` 挂到普通 shell 后面，shell 结束就被回收，
 *    探针会报「CDP 目标未就绪」。
 */
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const CDP = argOf('port', '9333');
const PAGE_URL = argOf('url', 'http://127.0.0.1:5173/');
const DO_EDIT = args.includes('--edit');
const ASSERT = argOf('assert', '');
const OUT_DIR = argOf('out', 'C:/tmp');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!target) {
  console.error(`CDP 端口 ${CDP} 下没有可用页面目标。先确认无头浏览器已常驻。`);
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error('CDP WebSocket 连接失败'));
});

let seq = 0;
const pending = new Map();
const logs = [];
const exceptions = [];

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push({
      type: msg.params.type,
      text: msg.params.args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ')
        .slice(0, 300),
    });
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    exceptions.push((d.exception?.description ?? d.text).slice(0, 400));
  }
};

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result.value;
};

const shoot = async (file) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const fs = await import('node:fs');
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
};

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: PAGE_URL });

// Univer 首帧是异步的（引擎初始化 + canvas 挂载），轮询到 canvas 出现为止，最多 20s。
let canvasCount = 0;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  canvasCount = await evaluate(`document.querySelectorAll('canvas').length`);
  if (canvasCount > 0) break;
}
await sleep(1500);

const structure = await evaluate(`(() => {
  const host = document.querySelector('.sheet-host');
  const canvases = [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  return {
    host: host ? { w: host.clientWidth, h: host.clientHeight } : null,
    canvasCount: canvases.length,
    canvases: canvases.slice(0, 6),
    univerNodes: document.querySelectorAll('[class*="univer-"]').length,
    bodyText: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 160),
  };
})()`);

console.log('[渲染结构]', JSON.stringify(structure, null, 2));
console.log('[截图]', await shoot(`${OUT_DIR}/probe-render.png`));

/**
 * 按 A1 取值断言：轮询 dev 句柄直到「全部非 null」或超时，再与期望值逐字比较。
 * 返回 { pass, results }，results 里带「第几次轮询首次非 null」，作为引擎确实算过的证据。
 */
const runAssertions = async (spec) => {
  const checks = spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [ref, raw] = pair.split('=');
      return { ref: ref.trim(), raw: (raw ?? '').trim(), expected: Number(raw) };
    });
  const refs = checks.map((c) => c.ref);
  const deadline = Date.now() + 6000;
  const seen = new Map(checks.map((c) => [c.ref, { value: undefined, poll: 0 }]));
  let poll = 0;
  let missing = false;

  while (Date.now() < deadline) {
    poll += 1;
    const snap = await evaluate(`(() => {
      const h = window.__woSheet;
      if (!h) return { __missing: true };
      const out = {};
      for (const ref of ${JSON.stringify(refs)}) {
        try { out[ref] = h.getValueByA1(ref); }
        catch (e) { out[ref] = '__throw__' + (e && e.message ? ':' + e.message : ''); }
      }
      return out;
    })()`);

    if (snap && snap.__missing) {
      missing = true;
      break;
    }

    let pending = 0;
    for (const { ref } of checks) {
      const slot = seen.get(ref);
      const v = snap?.[ref];
      if (slot.value === undefined || slot.value === null) {
        slot.value = v;
        slot.poll = poll;
      }
      if (slot.value === null || slot.value === undefined) pending += 1;
    }
    if (pending === 0) break;
    await sleep(200);
  }

  const results = checks.map(({ ref, raw, expected }) => {
    const slot = seen.get(ref);
    const value = slot.value;
    const isNumber = typeof value === 'number';
    const ok = isNumber && Math.abs(value - expected) < 1e-9;
    return { ref, raw, expected, value, type: typeof value, poll: slot.poll, ok };
  });

  for (const r of results) {
    const mark = r.ok ? 'OK ' : 'BAD';
    console.log(
      `[断言] ${mark} ${r.ref} 期望 ${r.raw}（number）｜实得 ${JSON.stringify(r.value)}（${r.type}）｜首次非 null 于第 ${r.poll} 次轮询`,
    );
  }
  if (missing) {
    console.log(
      '[断言] window.__woSheet 不存在：dev 句柄未挂。检查 mountSheet 的 import.meta.env.DEV 分支，或当前跑的是生产构建。',
    );
  }
  return { pass: !missing && results.every((r) => r.ok), results };
};

let assertPass = true;
if (ASSERT) {
  const { pass } = await runAssertions(ASSERT);
  assertPass = pass;
  console.log('[断言后截图]', await shoot(`${OUT_DIR}/probe-asserted.png`));
}

if (DO_EDIT) {
  // canvas 内的格子无法用选择器定位，只能按几何偏移点。列头高约 46、行头宽约 46。
  const box = await evaluate(`(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top };
  })()`);

  if (box) {
    const x = Math.round(box.left + 46 + 40);
    const y = Math.round(box.top + 46 + 20);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 2,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 2,
    });
    await sleep(700);
    await send('Input.insertText', { text: 'D1-OK' });
    await sleep(300);
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
      });
    }
    await sleep(900);
    console.log('[编辑后截图]', await shoot(`${OUT_DIR}/probe-edited.png`));
  }
}

const errors = logs.filter((l) => l.type === 'error');
console.log(
  `[控制台] error=${errors.length} warning=${logs.filter((l) => l.type === 'warning').length} exception=${exceptions.length}`,
);
errors.slice(0, 8).forEach((e, i) => console.log(`  E${i + 1} ${e.text}`));
exceptions.slice(0, 5).forEach((e, i) => console.log(`  X${i + 1} ${e}`));

ws.close();

const pass =
  structure.canvasCount > 0 && errors.length === 0 && exceptions.length === 0 && assertPass;
console.log(
  pass
    ? `\n探针通过：canvas 已渲染，无 error / 无未捕获异常${ASSERT ? '，取值断言全过' : ''}。`
    : '\n探针未通过。',
);
process.exit(pass ? 0 : 1);
