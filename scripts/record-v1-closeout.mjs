/**
 * V1「能编」收口录屏（D4 收口动作，ROADMAP §5「版本收口标志」）。
 *
 * 收口标志原文：**录一段屏——打开页面、改 A1 的数字、A3 的求和当场变。**
 * 本脚本就是那一段屏的产出方式，固化成命令，避免每次手工 OBS。
 *
 * ## 为什么不用 OBS / 屏幕录制，而用 CDP 定时截图
 *
 * 1. 无头浏览器不开窗，屏幕录制抓到的是空桌面，必须在渲染层内部取帧。
 * 2. `Page.startScreencast` 更省，但 headless 下支持性未验，且 ack 节流失败会静默丢帧。
 *    `Page.captureScreenshot` 是确定可用的路径，牺牲帧率换确定性——本演示是慢节奏操作
 *    （等待载入 → 选中 → 输入 → 观察重算），8fps 足够还原，且每帧都是完整画面。
 * 3. 帧率固定不等于时间轴固定：截图本身耗时（DPR=2 时每帧 40~80ms）会让实际间隔漂移。
 *    故每帧都记 `Date.now()`，合成时按**真实间隔**给 duration，视频时长与操作时长一致。
 *    若直接用 `-framerate 8` 喂固定帧率，视频会「快进」，作为证据的时间完整性就失真了。
 *
 * ## 为什么坚持真实鼠标键盘，而不用 facade 写值
 *
 * `probe-web.mjs --set` 走 `setValueByA1`（facade 命令链），证明力在「值能变」，但画面上是
 * **凭空变化**——视频里看不到任何人操作，等于自证。收口录屏要的是「人在用」的观感，故：
 * - 输入侧只用 `Input.dispatchMouseEvent` / `Input.dispatchKeyEvent` / `Input.insertText`；
 * - 读取侧只用 `getValueByA1` / `getFormulaByA1`（只读，全程不写）。
 * 写入路径与用户手打完全一致，这是本视频区别于 `--set` 断言的地方。
 *
 * ## 两条实测教训（重录一次 30 秒，但定错判据会产出假视频）
 *
 * 1. **`document.querySelector('canvas')` 拿到的不是主网格。** 页面有 3 个 canvas：
 *    公式栏 `1200x27 @ (204,141)`、单元格层 `88x24 @ (62,189)`、主网格 `1408x678 @ (16,169)`。
 *    取第一个会把点击打到公式栏，编辑框内容为空，录出来「什么都没发生」。必须取**面积最大**者。
 * 2. **编辑态不能用 `[contenteditable="true"]` 是否存在来判断。** 未进编辑态时该元素也在，
 *    只是宽度为 0；进编辑态后 Univer 仍以 0 宽元素承载输入（文本绘制在 canvas 上）。
 *    故本脚本**不判定编辑态**，改为判「输入后回车，A1 与 A3 是否按预期变」——结果导向，
 *    无法被伪装的中间态欺骗。
 *
 * ## 三条防伪校验（缺一即判失败，退出码非 0）
 *
 * 1. **基线对**：载入后 A1=1、A2=2、A3=3（A3 只给 f 不给 v，3 只能由引擎算出）。
 * 2. **值变化发生在回车之后**：输入 5 后、Enter 前再读一次 A1，应仍为 1（编辑内容尚未提交）。
 *    若此时已是 5，说明存在绕过编辑态的直写路径，视频结论不成立。
 * 3. **页面未重载 + 公式未变**：写入前在 window 打随机标记并全程校验（刷新会丢失）；
 *    A3 的公式文本前后必须逐字相同——值变而公式不变才是重算，公式变空则是被覆写成常量。
 *
 * 前置：vite 已起（5173）；无头 Edge 已起在独立端口（默认 9333，**不能是 9222**，
 * 那是 WorkBuddy 自身 Electron 的端口，会连到宿主窗口采到假画面）。
 *
 * 用法：
 *   node scripts/record-v1-closeout.mjs
 *   node scripts/record-v1-closeout.mjs --dpr=1        # 降采样（默认 2，超采样后缩放）
 *   node scripts/record-v1-closeout.mjs --out=C:/tmp/wo-video
 *
 * 产出：`<out>/v1-closeout.mp4` + 三张关键帧 PNG + `closeout-log.txt`（读数序列）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const CDP = argOf('port', '9333');
const PAGE_URL = argOf('url', 'http://127.0.0.1:5173/');
const OUT_DIR = path.resolve(argOf('out', 'docs/phase3/evidence'));
const DPR = Number(argOf('dpr', '2'));
const FPS = Number(argOf('fps', '8'));
const FRAME_MS = Math.round(1000 / FPS);
const VIEW_W = 1440;
const VIEW_H = 900;

/**
 * 网格几何（CSS px，2026-10-26 在本机 1440x900 下实测）。
 *
 * 主网格 canvas 在 (16,169)，A 列起始 x=62、A 行起始 y=189，单元格 88x24。
 * 故行头宽 = 62-16 = 46，列头高 = 189-169 = 20。
 * **坐标只负责「视觉上点到 A1」**，正确性由随后的 `Ctrl+Home` 归位保证——
 * 若点击偏到别的格，Ctrl+Home 会把活动格拉回 A1，所以几何漂移不会导致录错单元格。
 */
const HEADER_W = 46;
const HEADER_H = 20;
const COL_W = 88;
const ROW_H = 24;
const A1_X = HEADER_W + COL_W / 2;
const A1_Y = HEADER_H + ROW_H / 2;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 录屏过程中的全部结论都收在这里，最后一次性写盘并决定退出码。 */
const logLines = [];
const say = (...parts) => {
  const line = parts.join(' ');
  logLines.push(line);
  console.log(line);
};

/* ------------------------------------------------------------------ CDP 连接 */

const targets = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
const target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
if (!target) {
  console.error(`CDP 端口 ${CDP} 下没有可用页面目标。先确认无头浏览器已常驻在 9333。`);
  process.exit(1);
}

// UA 自检：9222 会连到 WorkBuddy 宿主，采到的是编辑器窗口而非我们的页面。
const version = await (await fetch(`http://127.0.0.1:${CDP}/json/version`)).json();
if (!/Edg\//.test(version['User-Agent'] ?? '')) {
  console.error(
    `端口 ${CDP} 上的 UA 不含 Edg/，很可能连到了 WorkBuddy 宿主窗口：\n  ${version['User-Agent']}`,
  );
  process.exit(1);
}
say(`[环境] CDP ${CDP}｜${version.Browser}`);

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = () => reject(new Error('CDP WebSocket 连接失败'));
});

let seq = 0;
const pending = new Map();
const consoleErrors = [];
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
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    consoleErrors.push(
      msg.params.args
        .map((a) => a.value ?? a.description ?? a.type)
        .join(' ')
        .slice(0, 200),
    );
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    exceptions.push((d.exception?.description ?? d.text).slice(0, 200));
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
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
};

/* ---------------------------------------------------- 录制循环（与主流程并发） */

const frames = [];
let recording = false;
let captureFailures = 0;

/**
 * 定时截图循环。与主流程共用同一条 ws：CDP 按 id 多路复用，并发安全。
 * 单帧失败不中断录制（偶发 `Target closed` 会自愈），但会计数——最终帧数不足会报错。
 */
const captureLoop = async () => {
  while (recording) {
    const started = Date.now();
    try {
      const { data } = await send('Page.captureScreenshot', {
        format: 'jpeg',
        quality: 82,
        optimizeForSpeed: true,
      });
      frames.push({ t: started, data });
    } catch {
      captureFailures += 1;
    }
    const spent = Date.now() - started;
    await sleep(Math.max(0, FRAME_MS - spent));
  }
};

/* ------------------------------------------------------------------ 环境准备 */

await send('Runtime.enable');
await send('Page.enable');
// 超采样：DPR=2 让表格里的 11px 数字在视频里依然锐利；坐标仍是 CSS px，不受影响。
await send('Emulation.setDeviceMetricsOverride', {
  width: VIEW_W,
  height: VIEW_H,
  deviceScaleFactor: DPR,
  mobile: false,
});

const shootPng = async (file) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(file, Buffer.from(data, 'base64'));
  return file;
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const frameDir = path.join(OUT_DIR, 'frames');
fs.rmSync(frameDir, { recursive: true, force: true });
fs.mkdirSync(frameDir, { recursive: true });

const bail = async (msg) => {
  recording = false;
  await loopDone;
  console.error(msg);
  process.exit(1);
};

/* ------------------------------------------------------------------ 正式录制 */

recording = true;
const loopDone = captureLoop();
const t0 = Date.now();

say('[录制] 开始');
await send('Page.navigate', { url: PAGE_URL });

// 等主网格（面积最大的 canvas）出现。与 probe 一致给 20s 上限。
let mainBox = null;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  mainBox = await evaluate(`(() => {
    const cs = [...document.querySelectorAll('canvas')]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.width > 400 && r.height > 200);
    if (!cs.length) return null;
    const r = cs.sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return { left: r.left, top: r.top, w: r.width, h: r.height };
  })()`);
  if (mainBox) break;
}
if (!mainBox) await bail('20s 内没有出现主网格 canvas：页面没渲染出来，录制中止（不产出视频）。');
say(
  `[主网格] ${Math.round(mainBox.w)}x${Math.round(mainBox.h)} @ (${Math.round(mainBox.left)},${Math.round(mainBox.top)})`,
);

/** 读数：只读，走 facade。`f` 用来区分「重算」与「被覆写成常量」。 */
const readCells = (refs) =>
  evaluate(`(() => {
    const h = window.__woSheet;
    if (!h) return { __missing: true };
    const out = {};
    for (const ref of ${JSON.stringify(refs)}) {
      try {
        out[ref] = { v: h.getValueByA1(ref), f: h.getFormulaByA1(ref) };
      } catch (e) {
        out[ref] = { v: '__throw__', f: '__throw__' };
      }
    }
    return out;
  })()`);

// A3 只有 f 没有 v，首次算出的时机在 preset 装配下未验，故轮询而非固定 sleep（V1.2.2 判据）。
const base = {};
for (let i = 0; i < 30; i++) {
  const snap = await readCells(['A1', 'A2', 'A3']);
  if (snap && snap.__missing)
    await bail('window.__woSheet 不存在：dev 句柄未挂，无法断言。录制中止。');
  Object.assign(base, snap);
  if (base.A3?.v !== null && base.A3?.v !== undefined) break;
  await sleep(200);
}
say(
  `[载入态] A1=${JSON.stringify(base.A1?.v)} A2=${JSON.stringify(base.A2?.v)} A3=${JSON.stringify(base.A3?.v)}｜A3 公式 ${JSON.stringify(base.A3?.f)}`,
);
if (base.A1?.v !== 1 || base.A3?.v !== 3) {
  await bail(
    `基线不对：期望 A1=1 / A3=3，实得 A1=${JSON.stringify(base.A1?.v)} / A3=${JSON.stringify(base.A3?.v)}。录制中止。`,
  );
}
say(`[关键帧] ${await shootPng(path.join(OUT_DIR, '01-loaded.png'))}`);

// 停留：让画面上的 A1=1 / A2=2 / A3=3 在视频里看得清（不做后期加速，证据保持原速）
await sleep(2000);

const click = async (x, y, clickCount) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount,
  });
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount,
  });
};

const pressKey = async (key, code, vk, modifiers = 0) => {
  for (const type of ['keyDown', 'keyUp']) {
    await send('Input.dispatchKeyEvent', {
      type,
      key,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      modifiers,
    });
  }
};

// ① 鼠标点一下 A1：视觉上的「选中」动作，让观者看到交互发生
const ax = Math.round(mainBox.left + A1_X);
const ay = Math.round(mainBox.top + A1_Y);
await click(ax, ay, 1);
await sleep(400);
// ② Ctrl+Home 归位：保证活动格确实是 A1（几何漂移的兜底，幂等）
await pressKey('Home', 'Home', 36, 2);
await sleep(700);
say(`[选中] 点击 (${ax}, ${ay}) 后 Ctrl+Home 归位 A1`);

// ③ 键入 5：选中态直接打字，Excel 语义（替换原内容）
await send('Input.insertText', { text: '5' });
await sleep(1200);

// 防伪校验 2：此刻尚未回车，A1 应仍为 1（编辑内容未提交）
const midway = await readCells(['A1', 'A3']);
say(
  `[回车前] A1=${JSON.stringify(midway.A1?.v)} A3=${JSON.stringify(midway.A3?.v)}（编辑未提交，应仍为 1 / 3）`,
);
if (midway.A1?.v !== 1) {
  await bail(
    `回车前 A1 已变成 ${JSON.stringify(midway.A1?.v)}：说明值绕过编辑态被直写，本视频不能作为「用户编辑」证据。中止。`,
  );
}
say(`[关键帧] ${await shootPng(path.join(OUT_DIR, '02-editing.png'))}`);

// 防伪校验 3（前半）：写入前打标记，刷新会丢失
const mark = `closeout-${Date.now()}`;
await evaluate(`(() => { window.__woMark = ${JSON.stringify(mark)}; return true; })()`);

// ④ 回车提交 —— 重算由命令链下游触发，本脚本不调任何重算接口
await pressKey('Enter', 'Enter', 13);

/** 采样 A3：记录值跃迁，直至成为 7，同时持续校验标记（未重载）。 */
const series = [{ t: 0, v: base.A3?.v }];
const start = Date.now();
let alive = true;
let finalA3;
const deadline = start + 6000;
while (Date.now() < deadline) {
  const snap = await evaluate(`(() => {
    const h = window.__woSheet;
    return { mark: window.__woMark, a3: h ? h.getValueByA1('A3') : '__no_handle__' };
  })()`);
  alive = snap.mark === mark;
  if (!alive) break;
  finalA3 = snap.a3;
  if (series[series.length - 1].v !== snap.a3) {
    series.push({ t: Date.now() - start, v: snap.a3 });
  }
  if (typeof snap.a3 === 'number' && Math.abs(snap.a3 - 7) < 1e-9) break;
  await sleep(80);
}
say(
  `[重算序列] A3: ${series.map((s) => `${JSON.stringify(s.v)}${s.t ? `@+${s.t}ms` : ''}`).join(' → ')}`,
);
say(`[未重载] ${alive ? 'OK 页面标记存活，值不是刷新来的' : 'BAD 标记丢失，中途发生重载'}`);

const after = await readCells(['A1', 'A2', 'A3']);
say(
  `[编辑后] A1=${JSON.stringify(after.A1?.v)} A2=${JSON.stringify(after.A2?.v)} A3=${JSON.stringify(after.A3?.v)}｜A3 公式 ${JSON.stringify(after.A3?.f)}`,
);
say(
  `[公式未变] ${after.A3?.f === base.A3?.f ? 'OK 值变而公式未变 = 重算，不是覆写成常量' : 'BAD 公式被改动'}`,
);

// 停留：让 A3=7 在视频里定住，观者有时间确认
await sleep(2500);
say(`[关键帧] ${await shootPng(path.join(OUT_DIR, '03-recomputed.png'))}`);

recording = false;
await loopDone;
say(
  `[录制] 结束｜有效帧 ${frames.length}｜截图失败 ${captureFailures}｜时长 ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);

/* ------------------------------------------------------------------ 帧落盘 */

if (frames.length < 20) {
  console.error(`只采到 ${frames.length} 帧，不足以合成视频。检查 CDP 是否被阻塞。`);
  process.exit(1);
}

frames.forEach((f, i) => {
  fs.writeFileSync(
    path.join(frameDir, `f${String(i).padStart(5, '0')}.jpg`),
    Buffer.from(f.data, 'base64'),
  );
});

/**
 * concat 清单按**真实间隔**给 duration，而不是固定 1/fps。
 * 截图本身有耗时，实际间隔会漂移；若按固定帧率喂给 ffmpeg，视频会相对真实操作「快进」，
 * 时间完整性失真。末帧写两次是 concat demuxer 的已知要求（最后一行的 file 不带 duration）。
 */
const concatPath = path.join(frameDir, 'list.ffconcat');
const lines = ['ffconcat version 1.0'];
for (let i = 0; i < frames.length; i++) {
  const next = frames[i + 1];
  const raw = next ? (next.t - frames[i].t) / 1000 : 1.2;
  const d = Math.min(3, Math.max(0.02, raw));
  lines.push(`file 'f${String(i).padStart(5, '0')}.jpg'`);
  lines.push(`duration ${d.toFixed(4)}`);
}
lines.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
fs.writeFileSync(concatPath, lines.join('\n'), 'utf8');

/* ------------------------------------------------------------------ 合成视频 */

const outVideo = path.join(OUT_DIR, 'v1-closeout.mp4');
// 输出 1920 宽（DPR=2 采样后缩放，等效抗锯齿），x264 + yuv420p 保证各播放器可开
const ff = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatPath,
    '-fps_mode',
    'cfr',
    '-r',
    '20',
    '-vf',
    'scale=1920:-2:flags=lanczos,format=yuv420p',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-movflags',
    '+faststart',
    outVideo,
  ],
  { encoding: 'utf8' },
);

if (ff.status !== 0) {
  console.error('ffmpeg 合成失败：\n' + (ff.stderr ?? '').slice(-1200));
  process.exit(1);
}
const sizeMb = (fs.statSync(outVideo).size / 1024 / 1024).toFixed(2);
say(`[视频] ${outVideo}｜${sizeMb} MB`);
fs.rmSync(frameDir, { recursive: true, force: true });

/* ------------------------------------------------------------------ 结论 */

const passRecompute = typeof finalA3 === 'number' && Math.abs(finalA3 - 7) < 1e-9;
const formulaKept = after.A3?.f === base.A3?.f;
const a1Written = after.A1?.v === 5;
const noConsoleNoise = consoleErrors.length === 0 && exceptions.length === 0;
say(
  `[控制台] error=${consoleErrors.length} exception=${exceptions.length}${consoleErrors.length ? '｜' + consoleErrors.slice(0, 3).join(' ｜ ') : ''}`,
);

const pass =
  passRecompute && a1Written && alive && formulaKept && noConsoleNoise && frames.length >= 20;
say(
  pass
    ? '[结论] V1 收口录屏达标：真实点击选中 + 键盘输入把 A1 改成 5，回车后 A3 由 3 重算为 7，公式未变、页面未重载、控制台干净。'
    : '[结论] 未达标，逐条看上面对应行。',
);

fs.writeFileSync(path.join(OUT_DIR, 'closeout-log.txt'), logLines.join('\n') + '\n', 'utf8');
ws.close();
process.exit(pass ? 0 : 1);
