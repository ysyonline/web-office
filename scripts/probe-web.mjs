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
 *   node scripts/probe-web.mjs --assert=A1=1,A2=2,A3=3 --set=A1=5 --after=A1=5,A3=7
 *                                                  # 写值 + 验证重算（V1.2.3 判据）
 *   node scripts/probe-web.mjs --assert=A1=1,A2=2,A3=3 --formats
 *                                                  # 三格式共存断言（V1.3.1 判据）
 *   node scripts/probe-web.mjs --boundaries        # 边界三例断言（V1.3.2 判据）
 *   node scripts/probe-web.mjs --data-source       # 数据源装配断言（V2.1 判据）
 *   node scripts/probe-web.mjs --persist           # 持久化断言：编辑→落盘→重载后还在（V2.2 判据）
 *   node scripts/probe-web.mjs --restore           # 视口断言：滚动→localStorage→重载后精确恢复（V2.3 判据）
 *   node scripts/probe-web.mjs --degrade           # 降级断言：写坏库→重载不白屏且不覆盖原数据（V2.3 判据）
 *                                                  # 默认每次运行先清空 IndexedDB + localStorage，加 --keep-storage 可保留
 *   node scripts/probe-web.mjs --port=9333 --url=http://127.0.0.1:5173/
 *
 * 退出码：0 表示 canvas 已出现且无 console error / 未捕获异常（给了 `--assert` 时还要求断言全过，
 * 给了 `--set` 时还要求重算达标且页面未重载）；1 表示不满足。
 *
 * ## 断言为什么必须「轮询 + 记跃迁」（V1.2.2 的判据核心，别改成 sleep 固定值）
 * `spike/formula-runtime-spike/REPORT.md` §1 B1/B2 已实证：浏览器端载入时**初算不冲缓存值**。
 * 演示数据里 A3 只给 `f` 不给 `v`，因此 `null → 数字` 的跃迁本身就证明公式引擎算过；
 * 若改成固定 sleep，就分不清「引擎算完了」和「还没算但碰巧读到了别的值」。
 * 首次计算时机在 preset 装配下未验，故轮询上限给 6s（任务卡写的 3s 是单格预算，三格留余量）。
 *
 * ## `--set` 为什么还要打「未重载」标记（V1.2.3 的判据核心）
 * 「改 A1 后 A3 变 7」有两种达成方式：引擎真重算，或刷新页面重新载入（后者载入时就带新值）。
 * 故写入前在 window 上打随机标记，整段采样期间反复校验——标记存活才排除了「靠刷新蒙对」。
 * 同时写入只走 `setValue`（facade 命令链），不调任何重算接口，值变化只能来自编辑事件驱动。
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
const SET_SPEC = argOf('set', '');
const AFTER_SPEC = argOf('after', '');
const DO_FORMATS = args.includes('--formats');
const DO_BOUNDARIES = args.includes('--boundaries');
const DO_DATA_SOURCE = args.includes('--data-source');
const DO_PERSIST = args.includes('--persist');
const DO_RESTORE = args.includes('--restore');
const DO_DEGRADE = args.includes('--degrade');
const OUT_DIR = argOf('out', 'C:/tmp');

/**
 * 预期内的 console error 前缀（V2.3 降级段）。
 *
 * 降级判据**故意**制造一次读失败，`SheetHost.onLoadError` 会打一条 error。
 * 它不能算进「全程零 error」，但也不能因此放宽整个探针——只过滤逐字匹配的前缀，
 * 其余任何 error 仍会让最终判定变红。
 */
const EXPECTED_ERROR_PREFIXES = [];

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

/**
 * 会话建立的墙钟时刻（epoch ms）。
 *
 * `Runtime.enable` 会把当前页面**历史** console 消息一并重放（带原始时间戳）——
 * 那是上一次探针运行留在页面控制台里的条目，不是本次的失败。实测：`--degrade`
 * 只真发生 1 次读失败，却收到 2 条文本相同的 error，两者时间戳相差 81s，
 * 且页面轨迹 `__woAttachTrace` 只有 1 条 `load:error`。
 *
 * 故最终统计只认时间戳不早于此刻的条目；`runDegrade` 内部按 `logs.length` 切片，
 * 重放条目都在切片之前，天然不受影响。
 */
const PROBE_STARTED_AT = Date.now();

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
      /** CDP 时间戳（epoch ms）：排查「同一条错误是重放还是真发生两次」时唯一的区分依据。 */
      at: msg.params.timestamp,
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

/**
 * 每次运行先清空 IndexedDB + localStorage（V2.2 起文档跨运行持久，V2.3 起视口也是；
 * 不清就会互相污染）。
 *
 * 为什么不在页面里 `indexedDB.deleteDatabase` 后再刷新：页面一加载就打开了连接，
 * deleteDatabase 会一直停在 `blocked` 上（连接不关，删除就排队），探针会卡死。
 * `Storage.clearDataForOrigin` 是浏览器层面的清除，不受页面连接影响。
 *
 * 注意它**不影响判据的有效性**：`--persist` / `--restore` 证明的是「同一次运行内，
 * 编辑/滚动 → 落盘 → 重载后还在」，清库只发生在运行开始之前。
 */
const ORIGIN = new URL(PAGE_URL).origin;
if (!args.includes('--keep-storage')) {
  await send('Storage.clearDataForOrigin', {
    origin: ORIGIN,
    storageTypes: 'indexeddb,local_storage',
  });
}

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

/** `A1=1,A3=3` → [{ ref, raw, expected }]；期望值一律按数字比较（本探针不比对文本）。 */
const parseChecks = (spec) =>
  spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [ref, raw] = pair.split('=');
      return { ref: ref.trim(), raw: (raw ?? '').trim(), expected: Number(raw) };
    });

/** 一次批量读取；`__missing` 表示 dev 句柄不存在（生产构建或未挂）。 */
const readCells = async (refs) =>
  evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const out = {};
    for (const ref of ${JSON.stringify(refs)}) {
      try { out[ref] = h.getValueByA1(ref); }
      catch (e) { out[ref] = '__throw__' + (e && e.message ? ':' + e.message : ''); }
    }
    return out;
  })()`);

/**
 * 读取公式文本。用途是把「值变了」定性：值变而公式未变 = 重算；公式没了 = 被覆写成常量。
 * 只看 `getValue` 时这两种情况的结果完全一样。
 */
const readFormulas = async (refs) =>
  evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const out = {};
    for (const ref of ${JSON.stringify(refs)}) {
      try { out[ref] = h.getFormulaByA1(ref); }
      catch (e) { out[ref] = '__throw__'; }
    }
    return out;
  })()`);

/**
 * 按 A1 取值断言：轮询直到「全部非 null」或超时，再与期望值逐字比较。
 * 返回 { pass, results }，results 里带「第几次轮询首次非 null」，作为引擎确实算过的证据。
 */
const runAssertions = async (spec, label = '') => {
  const checks = parseChecks(spec);
  const refs = checks.map((c) => c.ref);
  const deadline = Date.now() + 6000;
  const seen = new Map(checks.map((c) => [c.ref, { value: undefined, poll: 0 }]));
  let poll = 0;
  let missing = false;

  while (Date.now() < deadline) {
    poll += 1;
    const snap = await readCells(refs);

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

  const tag = label ? `[断言·${label}]` : '[断言]';
  for (const r of results) {
    const mark = r.ok ? 'OK ' : 'BAD';
    console.log(
      `${tag} ${mark} ${r.ref} 期望 ${r.raw}（number）｜实得 ${JSON.stringify(r.value)}（${r.type}）｜首次非 null 于第 ${r.poll} 次轮询`,
    );
  }
  if (missing) {
    console.log(
      `${tag} window.__woSheet 不存在：dev 句柄未挂。检查 mountSheet 的 import.meta.env.DEV 分支，或当前跑的是生产构建。`,
    );
  }
  return { pass: !missing && results.every((r) => r.ok), results };
};

/**
 * 写入并验证重算（V1.2.3）。
 *
 * 与纯读取断言的区别在于「必须先证明这不是刷新页面得来的」：
 * - 写入前在 window 上打一道随机标记，整段采样期间反复校验标记仍在——标记存活即页面未重载；
 * - 写入只调 `setValueByA1`（facade 命令链），**不调任何重算接口**，故值变化只能由编辑事件驱动；
 * - 采样序列含写入前的基线值，因此打印出来形如 `A3: 3 → 7`，跃迁本身即证据。
 */
const runWriteStep = async (setSpec, afterSpec) => {
  const writes = setSpec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((pair) => {
      const [ref, raw] = pair.split('=');
      return { ref: ref.trim(), value: Number((raw ?? '').trim()) };
    });
  const checks = parseChecks(afterSpec || setSpec);
  const refs = [...new Set([...writes.map((w) => w.ref), ...checks.map((c) => c.ref)])];

  const before = await readCells(refs);
  if (before && before.__missing) {
    console.log('[写入] window.__woSheet 不存在，无法写入。先排查 dev 句柄。');
    return { pass: false };
  }
  const formulasBefore = await readFormulas(refs);

  const mark = `probe-${Date.now()}`;
  await evaluate(`(() => {
    window.__woProbeMark = ${JSON.stringify(mark)};
    const h = window.__woSheet;
    if (!h) throw new Error('dev 句柄未挂');
    ${writes.map((w) => `h.setValueByA1(${JSON.stringify(w.ref)}, ${JSON.stringify(w.value)});`).join('\n    ')}
    return true;
  })()`);
  console.log(
    `[写入] ${writes.map((w) => `${w.ref}=${w.value}`).join(',')}｜走 facade setValue，未调用任何重算接口`,
  );

  const samples = new Map(refs.map((r) => [r, [before[r]]]));
  const deadline = Date.now() + 6000;
  let alive = true;
  let satisfied = false;
  let snap = before;

  while (Date.now() < deadline) {
    snap = await evaluate(`(() => {
      const h = window.__woSheet;
      const out = { __mark: window.__woProbeMark };
      if (!h) return out;
      for (const ref of ${JSON.stringify(refs)}) {
        try { out[ref] = h.getValueByA1(ref); }
        catch (e) { out[ref] = '__throw__'; }
      }
      return out;
    })()`);
    alive = snap.__mark === mark;
    if (!alive) break;
    for (const r of refs) {
      const arr = samples.get(r);
      const v = snap[r];
      if (arr[arr.length - 1] !== v) arr.push(v);
    }
    satisfied = checks.every((c) => {
      const v = snap[c.ref];
      return typeof v === 'number' && Math.abs(v - c.expected) < 1e-9;
    });
    if (satisfied) break;
    await sleep(100);
  }

  for (const r of refs) {
    console.log(
      `[序列] ${r}: ${samples
        .get(r)
        .map((v) => JSON.stringify(v))
        .join(' → ')}`,
    );
  }
  let ok = true;
  for (const c of checks) {
    const v = snap[c.ref];
    const hit = typeof v === 'number' && Math.abs(v - c.expected) < 1e-9;
    ok = ok && hit;
    console.log(
      `[重算] ${hit ? 'OK ' : 'BAD'} ${c.ref} 期望 ${c.raw}（number）｜实得 ${JSON.stringify(v)}（${typeof v}）`,
    );
  }
  console.log(
    `[未重载] ${alive ? 'OK  页面标记存活，值变化不是刷新得来的' : 'BAD 页面标记已丢失：中途发生了重载，结论无效'}`,
  );

  const formulasAfter = await readFormulas(refs);
  let formulaSame = true;
  for (const r of refs) {
    const b = (formulasBefore && formulasBefore[r]) || '';
    const a = (formulasAfter && formulasAfter[r]) || '';
    const same = a === b;
    formulaSame = formulaSame && same;
    if (b || a) {
      console.log(
        `[公式] ${same ? 'OK ' : 'BAD'} ${r} '${b}' → '${a}'${same ? '（未变）' : '（被改动）'}`,
      );
    }
  }
  return { pass: ok && alive && formulaSame };
};

let assertPass = true;
if (ASSERT) {
  const { pass } = await runAssertions(ASSERT, '写入前');
  assertPass = pass;
  console.log('[断言后截图]', await shoot(`${OUT_DIR}/probe-asserted.png`));
}

/**
 * 三格式共存断言（V1.3.1）。
 *
 * 期望值在这里**重复写一份**（`demo-workbook.ts` 的 `DEMO_LAYOUT` 是另一份）：探针刻意不 import
 * TS 源码——若从同一份常量取期望，就是「用被测对象证明被测对象」。代价是改布局要同步两处，
 * 故 `DEMO_LAYOUT` 的注释里也写了「改布局必须同步本文件」。
 *
 * 断言四条，对应「三者互不破坏」：
 * 1. 合并区只有一个，且正好是 A5:B6——不是「有一个合并区」就算过；
 * 2. 合并区非左上格不存值（B6 为空），否则是「看着像合并、其实是四个格都写了字」；
 * 3. 货币格显示 `¥1,234.50` 而值仍是 1234.5——格式生效且没有把值改成文本；
 * 4. 加粗格 `bl=1` 且底色等于设计令牌当前值——底色真来自令牌，不是硬编码；
 * 5. 兜底：A3 仍算出 3，格式没有破坏公式。
 */
const runFormats = async () => {
  const state = await evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const token = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-amber-50')
      .trim();
    return {
      token,
      merges: h.getMergedRanges(),
      a3: h.getValueByA1('A3'),
      currency: {
        value: h.getValueByA1('C1'),
        raw: h.getRawValueByA1('C1'),
        display: h.getDisplayByA1('C1'),
        style: h.getStyleByA1('C1'),
      },
      emphasis: h.getStyleByA1('A8'),
      mergeTopLeft: h.getValueByA1('A5'),
      mergeInner: h.getValueByA1('B6'),
    };
  })()`);

  if (state && state.__missing) {
    console.log('[格式] window.__woSheet 不存在，无法断言。先排查 dev 句柄。');
    return { pass: false };
  }

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const merges = state.merges ?? [];
  const key = (r) => `${r.startRow},${r.startColumn},${r.endRow},${r.endColumn}`;
  const got = merges.map(key).sort();
  const wantKeys = ['4,0,5,1', '17,0,18,1'].sort();
  const mergeOk = got.length === wantKeys.length && got.every((k, i) => k === wantKeys[i]);
  add('合并区恰为 A5:B6 与 A18:B19', mergeOk, JSON.stringify(merges));

  const innerEmpty = state.mergeInner === null || state.mergeInner === '' || state.mergeInner === 0;
  add('合并区非左上格不存值', innerEmpty, `B6 = ${JSON.stringify(state.mergeInner)}`);

  const cur = state.currency ?? {};
  // 断言取 raw 而非 getValue：实测（V1.3.1）带数字格式的格子上
  //   getValue → '¥1,234.50'（格式化文本）   getRawValue → 1234.5（数值）
  // 若断言 getValue === 1234.5，永远红；若断言 getValue === '¥1,234.50'，等于把
  // 「读数口径」写死成一个将来可能变的实现细节。故断言「数值没被改 + 显示已格式化」。
  const curOk = cur.raw === 1234.5 && cur.display === '¥1,234.50';
  add(
    '货币格数值与显示',
    curOk,
    `getRawValue ${JSON.stringify(cur.raw)}｜显示 '${cur.display}'｜getValue ${JSON.stringify(cur.value)}（格式化文本，见卡 §3 实测）`,
  );
  add(
    '货币格数字格式',
    cur.style?.n?.pattern === '¥#,##0.00',
    `n.pattern = ${JSON.stringify(cur.style?.n?.pattern)}`,
  );

  const em = state.emphasis ?? {};
  add('加粗格 bl=1', em.bl === 1, `bl = ${JSON.stringify(em.bl)}`);
  const bg = (em.bg?.rgb ?? '').toLowerCase();
  add(
    '加粗格底色来自设计令牌',
    !!state.token && bg === state.token.toLowerCase(),
    `bg = ${JSON.stringify(em.bg?.rgb)}｜令牌 ${JSON.stringify(state.token)}`,
  );

  add('公式未被格式破坏', state.a3 === 3, `A3 = ${JSON.stringify(state.a3)}`);

  for (const c of checks) console.log(`[格式] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  return { pass: checks.every((c) => c.ok) };
};

let formatPass = true;
if (DO_FORMATS) {
  const { pass } = await runFormats();
  formatPass = pass;
  console.log('[格式截图]', await shoot(`${OUT_DIR}/probe-formats.png`));
}

/**
 * 数据源装配断言（V2.1）。
 *
 * 本段要防的假绿很具体：**「A1=1」既可以是「数据经 DataSource 流入」，也可以是
 * 「demo 数据被直接塞给 mountSheet」**——两种实现画面完全一样。故判据不能只看值，
 * 必须看装配轨迹（`__woAttachTrace`），它由装配层自己记录，业务代码无法伪造出
 * 「先 mount 空表、后 replaceDoc」这个顺序。
 *
 * 四条判据：
 * ① 轨迹必须含 `mount` 且**先于** `replace` —— 证明是「空表先立、数据后灌」，
 *    而不是「等数据好了再挂」（后者正是交接件警告的结构风险，会撞碎 V1.2.1 的方案 C）；
 * ② 轨迹必须含 `load:end` 与 `replace` —— 证明数据真的走了一次 `load` 并触发了换单元；
 *    若只有 `load:null`，说明种子没进数据源，本段等于没测到主路径；
 * ③ 换单元后 A3 仍为 3 —— 证明新快照的公式照常计算，不是把值当常量搬过去；
 * ④ 全程 canvas 数 > 0 且无异常 —— 证明换单元没有拆掉渲染根（这是「不白屏」的机器判据）。
 */
const runDataSource = async () => {
  /**
   * 先确保页面走的是「文档已存在」的主路径。
   *
   * 每次运行都清库，所以**首次载入必然是 `load:null` → 种种子**——此时判据②要断言的
   * 「load 流入真实数据」根本没发生，报红是判据自己没准备好，不是装配有问题。
   * 这里重载一次：库里已有种子，第二遍载入就会走 `load:end` → `replace`。
   *
   * 顺带这也验证了一件正事：**重载后确实从库里读回了内容**（否则第二遍还是 load:null）。
   */
  const sawLoadEnd = await evaluate(
    `(window.__woAttachTrace || []).some((e) => e.kind === 'load:end')`,
  );
  if (!sawLoadEnd) {
    await send('Page.reload');
    const deadline0 = Date.now() + 12000;
    while (Date.now() < deadline0) {
      const ok = await evaluate(
        `(window.__woAttachTrace || []).some((e) => e.kind === 'load:end')`,
      );
      if (ok) break;
      await sleep(200);
    }
  }

  const traceInfo = await evaluate(`(() => {
    const t = window.__woAttachTrace;
    if (!t) return { __missing: true };
    return { events: t, canvases: [...document.querySelectorAll('canvas')].length };
  })()`);

  if (traceInfo.__missing) {
    console.log('[数据源] window.__woAttachTrace 不存在，无法断言装配路径。先排查 dev 构建。');
    return { pass: false };
  }

  const ev = traceInfo.events;
  const idx = (kind) => ev.findIndex((e) => e.kind === kind);
  const mountAt = idx('mount');
  const loadStart = idx('load:start');
  const loadEnd = idx('load:end');
  const replace = idx('replace');

  // 换单元后重新取值（不是复用载入态的快照）。
  let a3 = null;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    a3 = await evaluate(`window.__woSheet ? window.__woSheet.getValueByA1('A3') : '__noHandle__'`);
    if (a3 !== null && a3 !== '__noHandle__') break;
    await sleep(200);
  }

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add(
    '① 空表先挂、数据后灌（mount 早于 replace）',
    mountAt >= 0 && replace > mountAt,
    `mount@${ev[mountAt]?.at ?? '-'}ms｜replace@${ev[replace]?.at ?? '-'}ms`,
  );
  add(
    '② 数据经 load 流入并触发换单元',
    loadStart >= 0 && loadEnd >= 0 && replace > loadEnd,
    `轨迹 ${ev.map((e) => e.kind).join(' → ')}`,
  );
  add('③ 换单元后公式照常计算', a3 === 3, `A3=${JSON.stringify(a3)}｜期望 3`);
  add(
    '④ 换单元未拆渲染根',
    traceInfo.canvases > 0,
    `canvas=${traceInfo.canvases}｜装配期异常已由末行控制台断言覆盖`,
  );

  for (const c of checks) console.log(`[数据源] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);

  /**
   * 接口语义断（V2.1 的「接口定稿」判据）。
   *
   * 为什么必须真调：`--data-source` 前四条只证明「装配走了 DataSource」，证明不了
   * **这个接口好不好用**。而 V2.1 的判据就是「接口定稿」——若 `save`/`subscribe` 的语义
   * 写错了，V2.2 写 IndexedDB 实现时才会发现，那时返工成本是现在的数倍。
   *
   * 全部在**独立 docId** 上做，不碰页面正在显示的文档：
   * ① load 不存在的文档必须返回 null（不是抛错、不是空文档）——这是 V2.3「新文档降级空白表」的依据；
   * ② save 后 load 能读回等价内容；
   * ③ load 返回的是**副本**：改返回值不得影响已存的数据（否则 V2.2 反序列化后会行为突变）；
   * ④ subscribe 能收到 save 事件，且 origin 为 local-save；
   * ⑤ 取消订阅后不再收到事件；
   * ⑥ 取消订阅幂等（重复调用不抛错）。
   */
  const contract = await evaluate(`(async () => {
    const ds = window.__woDataSource;
    if (!ds) return { __missing: true };
    const id = 'probe-contract-' + Date.now();
    const out = {};

    // ① 不存在 → null
    out.missingIsNull = (await ds.load(id)) === null;

    // ② save → load 读回
    const doc = { id, name: 'probe', sheets: {} };
    const wr = await ds.save(id, doc);
    out.saveReturnsTime = typeof wr.savedAt === 'number' && wr.savedAt > 0;
    const back = await ds.load(id);
    out.roundTrip = back && back.id === id && back.name === 'probe';

    // ③ 返回值是副本：改它不影响存储
    back.name = 'MUTATED';
    const again = await ds.load(id);
    out.isCopy = again.name === 'probe';

    // ④ subscribe 收 local-save
    const seen = [];
    const off = ds.subscribe((c) => seen.push({ origin: c.origin, docId: c.docId }));
    await ds.save(id, { id, name: 'second', sheets: {} });
    out.gotEvent = seen.length === 1 && seen[0].origin === 'local-save' && seen[0].docId === id;

    // ⑤ 取消后不再收
    off();
    await ds.save(id, { id, name: 'third', sheets: {} });
    out.noEventAfterOff = seen.length === 1;

    // ⑥ 取消幂等
    let idempotent = true;
    try { off(); off(); } catch { idempotent = false; }
    out.offIdempotent = idempotent;

    return out;
  })()`);

  if (contract.__missing) {
    console.log('[数据源·接口] window.__woDataSource 不存在，无法验接口语义。');
    return { pass: false };
  }

  const c2 = [];
  const add2 = (name, ok, detail) => c2.push({ name, ok, detail });

  add2(
    '接口① load 不存在返回 null',
    contract.missingIsNull === true,
    `得 ${contract.missingIsNull}`,
  );
  add2(
    '接口② save→load 往返一致',
    contract.roundTrip === true && contract.saveReturnsTime === true,
    `往返 ${contract.roundTrip}｜savedAt 有效 ${contract.saveReturnsTime}`,
  );
  add2('接口③ load 返回副本（改它不污染存储）', contract.isCopy === true, `得 ${contract.isCopy}`);
  add2(
    '接口④ subscribe 收到 local-save',
    contract.gotEvent === true,
    `origin/docId 匹配 ${contract.gotEvent}`,
  );
  add2(
    '接口⑤ 取消订阅后不再收事件',
    contract.noEventAfterOff === true,
    `得 ${contract.noEventAfterOff}`,
  );
  add2(
    '接口⑥ 取消订阅幂等',
    contract.offIdempotent === true,
    `重复调用不抛错 ${contract.offIdempotent}`,
  );

  for (const c of c2) console.log(`[数据源·接口] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  return { pass: checks.every((c) => c.ok) && c2.every((c) => c.ok) };
};

let dataSourcePass = true;
if (DO_DATA_SOURCE) {
  const { pass } = await runDataSource();
  dataSourcePass = pass;
  console.log('[数据源截图]', await shoot(`${OUT_DIR}/probe-data-source.png`));
}

/**
 * 边界三例断言（V1.3.2）。
 *
 * 期望值在 Excel 语义下先定死，再由探针比对——「跑出多少记多少」正是本包要防的事
 * （ROADMAP §5：不许「看起来对」）。三例各自的 Excel 判据：
 * ① 空单元格参与 SUM → 空按 0 计，10 + (空) + 20 = 30；
 * ② 文本参与 SUM → 区域内文本一律忽略，连 `'5'` 也不折算，0 + 0 + 7 = 7；
 * ③ 跨合并区求和 → 合并区只左上格存值，其余为空，SUM(A18:B19) = 3。
 *
 * 另加两条旁证，防止「结果碰巧对」：`'5'` 必须以**字符串**形态存着（被强转成数字就说明
 * ② 的输入条件没成立，7 便不能归功于「忽略文本」）；合并区内部的 B19 必须为空
 * （四格都写了 3 也会得到 3，但那是完全不同的语义）。
 */
const runBoundaries = async () => {
  const refs = ['B10', 'B14', 'C18'];
  let computed = {};
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const snap = await readCells(refs);
    if (snap && snap.__missing) {
      console.log('[边界] window.__woSheet 不存在，无法断言。先排查 dev 句柄。');
      return { pass: false };
    }
    computed = snap;
    if (refs.every((r) => computed[r] !== null && computed[r] !== undefined)) break;
    await sleep(200);
  }

  const extra = await evaluate(`(() => {
    const h = window.__woSheet;
    return { a15: h.getValueByA1('A15'), b19: h.getValueByA1('B19'), a18: h.getValueByA1('A18') };
  })()`);

  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  add(
    '① 空单元格参与 SUM',
    computed.B10 === 30,
    `B10=${JSON.stringify(computed.B10)}｜Excel 期望 30`,
  );
  add('② 文本参与 SUM', computed.B14 === 7, `B14=${JSON.stringify(computed.B14)}｜Excel 期望 7`);
  add('③ 跨合并区求和', computed.C18 === 3, `C18=${JSON.stringify(computed.C18)}｜Excel 期望 3`);

  // 旁证不作 pass 依据的替代，而是与主断言并列：条件不成立时主断言的结果无法归因。
  add(
    '旁证：文本格仍以字符串存值',
    typeof extra.a15 === 'string' && extra.a15 === '5',
    `A15=${JSON.stringify(extra.a15)}（${typeof extra.a15}）`,
  );
  add(
    '旁证：合并区内部为空',
    extra.b19 === null || extra.b19 === '' || extra.b19 === undefined,
    `B19=${JSON.stringify(extra.b19)}`,
  );

  for (const c of checks) console.log(`[边界] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  return { pass: checks.every((c) => c.ok) };
};

let boundaryPass = true;
if (DO_BOUNDARIES) {
  const { pass } = await runBoundaries();
  boundaryPass = pass;
  console.log('[边界截图]', await shoot(`${OUT_DIR}/probe-boundaries.png`));
}

/**
 * 写值重算（V1.2.3）放在格式/边界之后。
 *
 * 执行顺序是有意的：本段会**改动页面状态**（A1 从 1 变 5、A3 随之变 7），而
 * `--formats` / `--boundaries` 断言的是「载入态」。实测踩过：两者组合运行时，格式段的
 * 「公式未被破坏 A3=3」变红——不是真有 bug，而是 A3 已被本段重算成 7。
 */
let writePass = true;
if (SET_SPEC) {
  const { pass } = await runWriteStep(SET_SPEC, AFTER_SPEC);
  writePass = pass;
  console.log('[重算后截图]', await shoot(`${OUT_DIR}/probe-recomputed.png`));
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

/**
 * 持久化断言（V2.2 判据）：编辑 → 自动保存 → **重载页面** → 内容还在。
 *
 * ## 为什么必须重载
 *
 * 「A1 变成 42」这件事，只在内存里也能成立（V1 就是这样）。H2 假设要的是「关掉再打开
 * 还在」，所以唯一的证据是**把页面整个重新载入**，再从引擎读数。载入路径不经过内存里的
 * 任何变量，只能来自 IndexedDB。
 *
 * ## 三个子判据，各自防一种假绿
 *
 * ① **落盘发生在节流窗口之后，且确实发生过**：等 `save:end` 轨迹，而不是等固定时间。
 *    只看「A1=42」无法区分「存了」和「还没存但界面已经是 42」。
 * ② **库里真有这份字节**：绕过应用代码直接 `indexedDB.open` 读记录，证明数据到了存储层，
 *    而不是停在内存桩里。
 * ③ **连打两下只存一次，且存的是最后一次**：两次改动间隔 120ms（小于 debounce 400ms），
 *    应只见 1 次 `save:end`；重载后必须是最新那一下的值。这条同时证明节流生效
 *    与「最后一次必落盘」，二者缺一都会露馅（前者会看到 2 次保存，后者会停在旧值）。
 */
const PERSIST_DB = 'wo-office';
const PERSIST_STORE = 'docs';
const PERSIST_DOC = 'wo-demo-book';

const runPersist = async () => {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const readCell = (ref) =>
    evaluate(`(() => {
      const h = window.__woSheet;
      if (!h) return { __missing: true };
      return { v: h.getValueByA1(${JSON.stringify(ref)}), f: h.getFormulaByA1(${JSON.stringify(ref)}) };
    })()`);

  const traceCount = (kind) =>
    evaluate(
      `(window.__woAttachTrace || []).filter((e) => e.kind === ${JSON.stringify(kind)}).length`,
    );

  const autosaveState = () =>
    evaluate(`(() => {
      const a = window.__woAttach;
      return a ? a.autosaveState() : null;
    })()`);

  /**
   * 等到「自动保存彻底静默」：dirty=false 且 saving=false，且期间至少新增过一次落盘。
   *
   * **不能只看第一个 `save:end` 就返回**——那是本包实际踩过的坑：
   * 首笔落盘常常发生在第二笔输入的过程中，此时立刻 reload 会把第二笔直接截断，
   * 于是「最后一次改动必落盘」看起来像失败了，其实是判据自己抢跑。
   */
  const waitSaved = async (prevSaves, ms) => {
    const deadline = Date.now() + ms;
    let saves = prevSaves;
    while (Date.now() < deadline) {
      saves = await traceCount('save:end');
      const st = await autosaveState();
      if (saves > prevSaves && st && !st.dirty && !st.saving) return { saves, state: st };
      await sleep(120);
    }
    return { saves, state: null };
  };

  const waitCanvas = async () => {
    for (let i = 0; i < 40; i += 1) {
      const n = await evaluate(`document.querySelectorAll('canvas').length`);
      if (n > 0) return true;
      await sleep(500);
    }
    return false;
  };

  const pollCell = async (ref, expect, ms) => {
    const deadline = Date.now() + ms;
    let last = null;
    while (Date.now() < deadline) {
      const c = await readCell(ref);
      last = c;
      if (c && !c.__missing && c.v === expect) return c;
      await sleep(150);
    }
    return last;
  };

  const key = async (k, code, vk, modifiers = 0) => {
    for (const type of ['keyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', {
        type,
        key: k,
        code,
        windowsVirtualKeyCode: vk,
        nativeVirtualKeyCode: vk,
        modifiers,
      });
    }
  };

  /** 点 A1 + Ctrl+Home 归位。坐标只负责视觉选中，正确性由归位保证。 */
  const focusA1 = async () => {
    const geom = await evaluate(`(() => {
      const cs = [...document.querySelectorAll('canvas')]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 400 && r.height > 200);
      if (!cs.length) return null;
      const r = cs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
      return { left: r.left, top: r.top };
    })()`);
    if (!geom) return false;
    const x = Math.round(geom.left + 90);
    const y = Math.round(geom.top + 32);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x,
      y,
      button: 'left',
      clickCount: 1,
    });
    await sleep(250);
    await key('Home', 'Home', 36, 2);
    await sleep(350);
    return true;
  };

  const commit = async () => {
    await sleep(150);
    await key('Enter', 'Enter', 13);
  };

  /** 绕过应用代码直接读库：证明字节真的到了存储层。 */
  const readStored = () =>
    evaluate(`(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(${JSON.stringify(PERSIST_DB)});
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const rec = await new Promise((res, rej) => {
        const r = db.transaction(${JSON.stringify(PERSIST_STORE)}, 'readonly')
          .objectStore(${JSON.stringify(PERSIST_STORE)})
          .get(${JSON.stringify(PERSIST_DOC)});
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => rej(r.error);
      });
      db.close();
      if (!rec) return { found: false };
      const doc = JSON.parse(rec.doc);
      const sid = (doc.sheetOrder && doc.sheetOrder[0]) || null;
      const sheet = sid && doc.sheets ? doc.sheets[sid] : null;
      const row = sheet && sheet.cellData ? sheet.cellData[0] : null;
      const cell = row ? row[0] : null;
      return {
        found: true,
        savedAt: rec.savedAt,
        bytes: rec.bytes,
        a1v: cell ? cell.v : null,
        a1f: cell ? cell.f : null,
      };
    })()`);

  // ---- 基线：种子数据必须先落库，否则后面的「编辑后还在」无法归因 -------------
  const base = await pollCell('A1', 1, 12000);
  add(
    '前置：新库种出演示数据（A1=1）',
    base && base.v === 1,
    `A1=${JSON.stringify(base && base.v)}`,
  );
  const seeded = await readStored();
  add(
    '前置：种子已写入 IndexedDB',
    seeded.found === true && seeded.bytes > 0,
    seeded.found ? `bytes=${seeded.bytes} savedAt=${seeded.savedAt}` : '库里没有记录',
  );

  // ---- ① 编辑一次 → 等保存静默 → 值落地 ---------------------------------------
  if (!(await focusA1())) {
    add('前置：能定位主网格', false, '没有面积足够大的 canvas');
    for (const c of checks) console.log(`[持久化] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
    return { pass: false };
  }
  const baseSaves = await traceCount('save:end');
  await send('Input.insertText', { text: '42' });
  await commit();
  const first = await waitSaved(baseSaves, 10000);
  const editedCell = await pollCell('A1', 42, 3000);
  add(
    '① 编辑后自动保存（节流窗口后落盘一次）',
    first.saves - baseSaves === 1 && editedCell && editedCell.v === 42,
    `save:end +${first.saves - baseSaves}｜A1=${JSON.stringify(editedCell && editedCell.v)}`,
  );

  // ---- ② 库里确有这份内容 ------------------------------------------------------
  const stored = await readStored();
  add(
    '② 库中记录已更新为 42',
    stored.found === true && stored.a1v === 42,
    stored.found ? `a1.v=${JSON.stringify(stored.a1v)} bytes=${stored.bytes}` : '库里没有记录',
  );

  // ---- ③④ 重载：内容与公式都要还在（H2 的唯一证据） ---------------------------
  await send('Page.reload');
  const canvasBack = await waitCanvas();
  const reloaded = await pollCell('A1', 42, 12000);
  const reloadedA3 = await pollCell('A3', 44, 6000);
  add(
    '③ 重载后 A1 仍为 42（内容真的跨过页面生命周期）',
    canvasBack && reloaded && reloaded.v === 42,
    `A1=${JSON.stringify(reloaded && reloaded.v)}`,
  );
  add(
    '④ 重载后 A3 由公式算出 44（公式随内容一起存活）',
    reloadedA3 && reloadedA3.v === 44 && reloadedA3.f === '=SUM(A1:A2)',
    `A3=${JSON.stringify(reloadedA3 && reloadedA3.v)}｜f=${JSON.stringify(reloadedA3 && reloadedA3.f)}`,
  );

  // ---- ⑤ 快速连打：只落盘一次，且落的是最后一次 -------------------------------
  // 关键在「同一格内两个字符间隔 120ms」——这才是真实输入节奏。
  // 若拿两次独立的「点击+输入+回车」当快速连打，两次之间已经隔了 ~750ms，
  // 首笔落盘必然在第二次输入过程中发生，测到 2 次是应该的，不是节流失效。
  await focusA1();
  const base2 = await traceCount('save:end');
  // 用命令链连打两次，而不是两次 insertText：后者实测有竞态（第二次注入偶尔丢失，
  // 只进去一个字符），会让判据变成偶发红——**偶发红的判据等于没有判据**。
  // setValue 同样走 Univer 命令链、同样触发 onCommandExecuted，
  // 而本子判据要验的正是「相距 120ms 的两条命令会不会被合并成一次保存」。
  await evaluate(`window.__woSheet.setValueByA1('A1', 43)`);
  await sleep(120);
  await evaluate(`window.__woSheet.setValueByA1('A1', 44)`);
  const second = await waitSaved(base2, 10000);
  const typed = await pollCell('A1', 44, 3000);
  add(
    '⑤ 相邻两次改动只落盘一次（节流真的在合并）',
    second.saves - base2 === 1,
    `save:end +${second.saves - base2}（期望 1）｜A1=${JSON.stringify(typed && typed.v)}`,
  );

  // ---- ⑥ 重载后必须是最新值 ---------------------------------------------------
  await send('Page.reload');
  await waitCanvas();
  const lastWrite = await pollCell('A1', 44, 12000);
  add(
    '⑥ 重载后为最新值 44（最后一次改动必落盘）',
    lastWrite && lastWrite.v === 44,
    `A1=${JSON.stringify(lastWrite && lastWrite.v)}（若为 43/4 则是尾部丢失）`,
  );

  const errs = await traceCount('save:error');
  add('⑦ 全程无保存失败', errs === 0, `save:error ${errs} 次`);

  for (const c of checks) console.log(`[持久化] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  console.log('[持久化截图]', await shoot(`${OUT_DIR}/probe-persist.png`));
  return { pass: checks.every((c) => c.ok) };
};

/**
 * 视口恢复断言（V2.3 判据）：滚动 → localStorage → **重载** → 精确恢复。
 *
 * ## 为什么用真实滚轮而不是直接调 `applyScrollState`
 *
 * 程序化 `scroll-view` 命令实测**不触发** `Event.Scroll`（V2.3 spike：events=0），
 * 而持久化正是挂在滚动事件上的。直接调命令只能证明「恢复能滚」，证明不了
 * 「用户滚动会被记住」。故本段用 CDP 发滚轮事件走完整链路；`getScrollState()`
 * 在滚动后现读，期望值不硬编码（避免不同视口尺寸导致偶发红）。
 *
 * ## 三条防假绿
 *
 * ① 滚动后的视口必须非零，否则「恢复到 0,0」也会绿；
 * ② 必须绕过应用代码直接读 localStorage，证明状态真的到了存储层；
 * ③ 重载后逐字段比对，不能只比「行号相同」——offset 正是本包选精确像素的理由。
 */
const runRestore = async () => {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  const readCell = (ref) =>
    evaluate(`(() => {
      const h = window.__woSheet;
      if (!h) return { __missing: true };
      return { v: h.getValueByA1(${JSON.stringify(ref)}), f: h.getFormulaByA1(${JSON.stringify(ref)}) };
    })()`);

  const autosaveState = () =>
    evaluate(`(() => {
      const a = window.__woAttach;
      return a ? a.autosaveState() : null;
    })()`);

  const readView = () =>
    evaluate(`(() => {
      const h = window.__woSheet;
      return h ? h.getScrollState() : null;
    })()`);

  const readSavedView = () =>
    evaluate(`(() => {
      const raw = localStorage.getItem(${JSON.stringify(`wo.view.${PERSIST_DOC}`)});
      if (raw === null) return null;
      try { return JSON.parse(raw); } catch { return '__broken__'; }
    })()`);

  const sameView = (a, b) =>
    !!a &&
    !!b &&
    a.offsetX === b.offsetX &&
    a.offsetY === b.offsetY &&
    a.sheetViewStartRow === b.sheetViewStartRow &&
    a.sheetViewStartColumn === b.sheetViewStartColumn;

  const waitCanvas = async () => {
    for (let i = 0; i < 40; i += 1) {
      const n = await evaluate(`document.querySelectorAll('canvas').length`);
      if (n > 0) return true;
      await sleep(500);
    }
    return false;
  };

  const waitLoaded = async (ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const ok = await evaluate(
        `!!window.__woSheet && !!window.__woAttach && window.__woAttach.isLoaded()`,
      );
      if (ok) return true;
      await sleep(150);
    }
    return false;
  };

  const waitSaveQuiet = async (ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      const st = await autosaveState();
      if (st && !st.dirty && !st.saving) return st;
      await sleep(120);
    }
    return null;
  };

  const pollCell = async (ref, expect, ms) => {
    const deadline = Date.now() + ms;
    let last = null;
    while (Date.now() < deadline) {
      last = await readCell(ref);
      if (last && !last.__missing && last.v === expect) return last;
      await sleep(150);
    }
    return last;
  };

  const pollView = async (expect, ms) => {
    const deadline = Date.now() + ms;
    let last = null;
    while (Date.now() < deadline) {
      last = await readView();
      if (sameView(last, expect)) return last;
      await sleep(150);
    }
    return last;
  };

  const wheel = async (geom, deltaX, deltaY, modifiers = 0) => {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: geom.x,
      y: geom.y,
      deltaX,
      deltaY,
      modifiers,
    });
  };

  // ---- 前置：内容与视口都从零开始，避免上一段/上一轮的残留 ---------------------
  await waitLoaded(15000);
  await sleep(500);
  await evaluate(`localStorage.removeItem(${JSON.stringify(`wo.view.${PERSIST_DOC}`)})`);

  await evaluate(`window.__woSheet.setValueByA1('A1', 42)`);
  const quiet = await waitSaveQuiet(10000);
  const a1Before = await pollCell('A1', 42, 5000);
  add(
    '前置：内容已落盘（A1=42）',
    quiet !== null && a1Before && a1Before.v === 42,
    `A1=${JSON.stringify(a1Before && a1Before.v)}｜dirty/saving=${quiet ? `${quiet.dirty}/${quiet.saving}` : 'null'}`,
  );

  const geom = await evaluate(`(() => {
    const cs = [...document.querySelectorAll('canvas')]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 400 && r.height > 200);
    if (!cs.length) return null;
    const r = cs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!geom) {
    add('前置：能定位主网格', false, '没有面积足够大的 canvas');
    for (const c of checks) console.log(`[恢复] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
    return { pass: false };
  }

  // ---- ① 真实滚轮：纵向 + 小偏移 + Shift 横向 --------------------------------
  for (let i = 0; i < 8; i += 1) {
    await wheel(geom, 0, 120);
    await sleep(80);
  }
  for (let i = 0; i < 2; i += 1) {
    await wheel(geom, 0, 7);
    await sleep(80);
  }
  for (let i = 0; i < 4; i += 1) {
    await wheel(geom, 0, 120, 8);
    await sleep(80);
  }

  // 等滚动动画/惯性停稳：连续两次读数一致才算稳定。
  let view = await readView();
  for (let i = 0; i < 20; i += 1) {
    await sleep(200);
    const next = await readView();
    if (sameView(next, view)) break;
    view = next;
  }
  add(
    '① 真实滚轮后视口非零（行/列/偏移都动过）',
    !!view && view.sheetViewStartRow > 0 && view.sheetViewStartColumn > 0,
    view
      ? `row=${view.sheetViewStartRow} col=${view.sheetViewStartColumn} offset=${view.offsetX},${view.offsetY}`
      : '视口不可读',
  );

  // ---- ② localStorage 里确有同一份视图状态 -----------------------------------
  let saved = null;
  for (let i = 0; i < 30; i += 1) {
    saved = await readSavedView();
    if (sameView(saved, view)) break;
    await sleep(100);
  }
  add(
    '② 视口已写入 localStorage（防抖窗口后，逐字段相等）',
    sameView(saved, view),
    `saved=${JSON.stringify(saved)}`,
  );

  // ---- ③④⑤ 重载：内容、公式、视口同时跨过页面生命周期 -----------------------
  const beforeShot = await shoot(`${OUT_DIR}/probe-restore-before.png`);
  await send('Page.reload');
  const canvasBack = await waitCanvas();
  const loadedBack = await waitLoaded(20000);
  const a1Back = await pollCell('A1', 42, 12000);
  const viewBack = await pollView(saved, 12000);
  const a3Back = await pollCell('A3', 44, 6000);

  add(
    '③ 重载后 A1 仍为 42（内容跨过页面生命周期）',
    canvasBack && loadedBack && a1Back && a1Back.v === 42,
    `A1=${JSON.stringify(a1Back && a1Back.v)}｜loaded=${loadedBack}`,
  );
  add(
    '④ 重载后视口逐字段相等（精确像素）',
    sameView(viewBack, saved),
    `got=${JSON.stringify(viewBack)}｜want=${JSON.stringify(saved)}`,
  );
  add(
    '⑤ 重载后 A3 由公式算出 44（快照完整）',
    a3Back && a3Back.v === 44 && a3Back.f === '=SUM(A1:A2)',
    `A3=${JSON.stringify(a3Back && a3Back.v)}｜f=${JSON.stringify(a3Back && a3Back.f)}`,
  );

  for (const c of checks) console.log(`[恢复] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  console.log('[恢复截图]', beforeShot, await shoot(`${OUT_DIR}/probe-restore.png`));
  return { pass: checks.every((c) => c.ok) };
};

/**
 * 读失败降级断言（V2.3 判据）：绕过应用写坏库记录 → 重载 → 不白屏、不覆盖。
 *
 * ## 为什么必须写坏库，而不是 mock `load` 抛错
 *
 * 「读失败降级」的真实路径是「库里有字节，但解析不了」。mock 掉 `load` 只能证明
 * 调用方 try/catch 写得对，证明不了：① 损坏数据真的会走到 error 分支；
 * ② 读失败后自动保存确实被 `loaded` 守卫关掉。后者是**最危险的一条**——
 * 守卫一旦失守，用户随手改一格就会把仅存的损坏字节覆盖成空文档。
 */
const runDegrade = async () => {
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  EXPECTED_ERROR_PREFIXES.push('[SheetHost] 数据源读取失败');

  const traceCount = (kind) =>
    evaluate(
      `(window.__woAttachTrace || []).filter((e) => e.kind === ${JSON.stringify(kind)}).length`,
    );

  const waitTrace = async (kind, ms) => {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if ((await traceCount(kind)) > 0) return true;
      await sleep(150);
    }
    return false;
  };

  const waitCanvas = async () => {
    for (let i = 0; i < 40; i += 1) {
      const n = await evaluate(`document.querySelectorAll('canvas').length`);
      if (n > 0) return true;
      await sleep(500);
    }
    return false;
  };

  const readStored = () =>
    evaluate(`(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open(${JSON.stringify(PERSIST_DB)});
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const rec = await new Promise((res, rej) => {
        const r = db.transaction(${JSON.stringify(PERSIST_STORE)}, 'readonly')
          .objectStore(${JSON.stringify(PERSIST_STORE)})
          .get(${JSON.stringify(PERSIST_DOC)});
        r.onsuccess = () => res(r.result || null);
        r.onerror = () => rej(r.error);
      });
      db.close();
      return rec ? { found: true, doc: rec.doc, bytes: rec.bytes } : { found: false };
    })()`);

  const readState = () =>
    evaluate(`(() => {
      const h = window.__woSheet;
      const host = document.querySelector('.sheet-host');
      return {
        hasHandle: !!h,
        loaded: window.__woAttach ? window.__woAttach.isLoaded() : null,
        a1: h ? h.getValueByA1('A1') : '__no_handle__',
        view: h ? h.getScrollState() : null,
        canvases: document.querySelectorAll('canvas').length,
        host: host ? { w: host.clientWidth, h: host.clientHeight } : null,
      };
    })()`);

  // ---- 前置：先有一份可读记录，再把 doc 字段写成非法 JSON ---------------------
  const before = await readStored();
  add(
    '前置：库中已有可读记录',
    before.found === true && typeof before.doc === 'string',
    before.found ? `bytes=${before.bytes}` : '库里没有记录',
  );

  const corruptDoc = '{"broken":';
  const bad = await evaluate(`(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(${JSON.stringify(PERSIST_DB)});
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rec = await new Promise((res, rej) => {
      const r = db.transaction(${JSON.stringify(PERSIST_STORE)}, 'readonly')
        .objectStore(${JSON.stringify(PERSIST_STORE)})
        .get(${JSON.stringify(PERSIST_DOC)});
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
    if (!rec) { db.close(); return { ok: false }; }
    const badRec = {
      ...rec,
      doc: ${JSON.stringify(corruptDoc)},
      bytes: ${new TextEncoder().encode(corruptDoc).length},
      savedAt: Date.now(),
      tabId: 'probe-degrade',
    };
    await new Promise((res, rej) => {
      const tx = db.transaction(${JSON.stringify(PERSIST_STORE)}, 'readwrite');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.objectStore(${JSON.stringify(PERSIST_STORE)}).put(badRec, ${JSON.stringify(PERSIST_DOC)});
    });
    db.close();
    return { ok: true, doc: badRec.doc, bytes: badRec.bytes };
  })()`);
  add(
    '前置：记录已写坏（doc 为非法 JSON）',
    bad.ok === true && bad.doc === corruptDoc,
    `bytes=${bad.bytes}`,
  );

  const logsBefore = logs.length;
  const exceptionsBefore = exceptions.length;

  // ---- 重载：读失败必须降级为空白表，而不是白屏 -----------------------------
  await send('Page.reload');
  const canvasBack = await waitCanvas();
  const errSeen = await waitTrace('load:error', 15000);
  await sleep(800);
  const state = await readState();
  const replaceCount = await traceCount('replace');

  add(
    '① 载入失败但 canvas 仍在（不白屏）',
    canvasBack && state && state.canvases > 0 && state.host && state.host.w > 0 && state.host.h > 0,
    state
      ? `canvas=${state.canvases} host=${state.host ? `${state.host.w}x${state.host.h}` : 'null'}`
      : '页面状态不可读',
  );
  add(
    '② isLoaded=false 且 A1 为空（降级为空白表）',
    errSeen &&
      state &&
      state.loaded === false &&
      (state.a1 === null || state.a1 === undefined || state.a1 === ''),
    state ? `loaded=${state.loaded} A1=${JSON.stringify(state.a1)}` : '页面状态不可读',
  );
  add(
    '③ 读失败不恢复视口（保持左上角）',
    state &&
      state.view &&
      state.view.sheetViewStartRow === 0 &&
      state.view.sheetViewStartColumn === 0,
    `view=${JSON.stringify(state && state.view)}`,
  );
  add(
    '④ 读失败未触发 replace（空表是占位，不是新文档）',
    replaceCount === 0,
    `replace=${replaceCount}`,
  );

  // ---- 最危险的一条：此时编辑，自动保存必须保持关闭 -------------------------
  // 基线必须在重载之后取：`__woAttachTrace` 随页面重建，旧页面的计数不能拿来比。
  const savesBefore = await traceCount('save:end');
  await evaluate(`window.__woSheet.setValueByA1('A1', 99)`);
  await sleep(2500);
  const savesAfter = await traceCount('save:end');
  const auto = await evaluate(`(() => {
    const a = window.__woAttach;
    return a ? a.autosaveState() : null;
  })()`);
  const after = await readStored();

  add(
    '⑤ 自动保存保持关闭（改格后无新落盘）',
    savesAfter === savesBefore && auto && !auto.dirty && !auto.saving,
    `save:end +${savesAfter - savesBefore}｜dirty/saving=${auto ? `${auto.dirty}/${auto.saving}` : 'null'}`,
  );
  add(
    '⑥ 原始损坏字节未被覆盖（逐字相等）',
    after.found === true && after.doc === corruptDoc && after.bytes === bad.bytes,
    after.found ? `doc=${JSON.stringify(after.doc)} bytes=${after.bytes}` : '记录消失',
  );

  const newErrors = logs.slice(logsBefore).filter((l) => l.type === 'error');
  const expectedErrors = newErrors.filter((e) =>
    EXPECTED_ERROR_PREFIXES.some((prefix) => e.text.includes(prefix)),
  );
  const unexpectedErrors = newErrors.filter(
    (e) => !EXPECTED_ERROR_PREFIXES.some((prefix) => e.text.includes(prefix)),
  );
  add(
    '⑦ 只出现一条预期读错误（无额外 error）',
    expectedErrors.length === 1 && unexpectedErrors.length === 0,
    `expected=${expectedErrors.length} unexpected=${unexpectedErrors.length}`,
  );
  add(
    '⑧ 无未捕获异常',
    exceptions.length === exceptionsBefore,
    `新增 exception=${exceptions.length - exceptionsBefore}`,
  );

  for (const c of checks) console.log(`[降级] ${c.ok ? 'OK ' : 'BAD'} ${c.name}｜${c.detail}`);
  console.log('[降级截图]', await shoot(`${OUT_DIR}/probe-degrade.png`));
  return { pass: checks.every((c) => c.ok) };
};

let persistPass = true;
if (DO_PERSIST) {
  const { pass } = await runPersist();
  persistPass = pass;
}

let restorePass = true;
if (DO_RESTORE) {
  const { pass } = await runRestore();
  restorePass = pass;
}

let degradePass = true;
if (DO_DEGRADE) {
  const { pass } = await runDegrade();
  degradePass = pass;
}

const errors = logs.filter((l) => l.type === 'error' && l.at >= PROBE_STARTED_AT);
const unexpectedErrors = errors.filter(
  (e) => !EXPECTED_ERROR_PREFIXES.some((prefix) => e.text.includes(prefix)),
);
const expectedErrors = errors.filter((e) =>
  EXPECTED_ERROR_PREFIXES.some((prefix) => e.text.includes(prefix)),
);
console.log(
  `[控制台] error=${errors.length}（预期 ${expectedErrors.length} / 意外 ${unexpectedErrors.length}）warning=${logs.filter((l) => l.type === 'warning').length} exception=${exceptions.length}`,
);
expectedErrors
  .slice(0, 4)
  .forEach((e) =>
    console.log(`  （预期）@${new Date(e.at).toISOString().slice(11, 23)} ${e.text.slice(0, 120)}`),
  );
unexpectedErrors.slice(0, 8).forEach((e, i) => console.log(`  E${i + 1} ${e.text}`));
exceptions.slice(0, 5).forEach((e, i) => console.log(`  X${i + 1} ${e}`));

ws.close();

const pass =
  structure.canvasCount > 0 &&
  unexpectedErrors.length === 0 &&
  exceptions.length === 0 &&
  assertPass &&
  writePass &&
  formatPass &&
  boundaryPass &&
  dataSourcePass &&
  persistPass &&
  restorePass &&
  degradePass;
const did = [
  ASSERT ? '取值断言全过' : '',
  SET_SPEC ? '写值后重算达标' : '',
  DO_FORMATS ? '三格式共存达标' : '',
  DO_BOUNDARIES ? '边界三例达标' : '',
  DO_DATA_SOURCE ? '数据源装配达标' : '',
  DO_PERSIST ? '持久化达标' : '',
  DO_RESTORE ? '视口精确恢复达标' : '',
  DO_DEGRADE ? '读失败降级达标' : '',
]
  .filter(Boolean)
  .join('，');
console.log(
  pass
    ? `\n探针通过：canvas 已渲染，无 error / 无未捕获异常${did ? `，${did}` : ''}。`
    : '\n探针未通过。',
);
process.exit(pass ? 0 : 1);
