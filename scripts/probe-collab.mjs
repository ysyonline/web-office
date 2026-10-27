#!/usr/bin/env node
/**
 * V3.2.1 服务端协同探针（`docs/phase3/tasks/V3.2.md` §4.6-A）。
 *
 * 只用 Node 22 自带能力：`node:sqlite` 旁路直读库、全局 `WebSocket` 当客户端、
 * `fetch` 校验 health。Yjs 客户端**从 `apps/server` 的依赖树 require**——仓库根不是
 * pnpm 的直接依赖持有者，从 scripts/ 裸 import 'yjs' 会解析失败。
 *
 * 判据设计的底线（同 V3.1，别退化）：
 * - 持久化必须绕过应用代码直读库：C4/C5/C8 用独立 `Y.Doc` 应用库里的 `update_blob`，
 *   而不是复用服务端内存态。
 * - 「没消息」不能当隔离证据：C7 在断言 doc-b 隔离前，先要求 doc-a 的三条增量仍在、
 *   doc-b 有自己从 1 开始的 seq。
 * - 重连不能「看起来像走了快照」：C6 断言 LOAD 的 version/baseSeq 恰为快照水位，
 *   且回放帧数恰为快照之后的那 1 条（多了就是整份内存态塞过去）。
 *
 * 失败时保留库文件与进程输出，便于定位；成功时清掉 `var/wo.collab.probe.db*`。
 *
 * C9 是卡外补充：§4.3 规定了坏帧关闭码（未实现上行 1008 / 非法 lib0 1003 / 文本帧
 * 不使用），但没有对应判据；这条只验协议守门，不改变 C0~C8 的语义。
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { gunzipSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = join(ROOT, 'apps/server');
const MAIN = join(SERVER_DIR, 'dist/main.js');
const serverRequire = createRequire(join(SERVER_DIR, 'package.json'));

const Y = serverRequire('yjs');
const syncProtocol = serverRequire('y-protocols/sync');
const encoding = serverRequire('lib0/encoding');
const decoding = serverRequire('lib0/decoding');

const DB_PATH = join(ROOT, 'var/wo.collab.probe.db');
const DB_FILES = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
const HOST = '127.0.0.1';
const PORT = 3100;
const BASE = `http://${HOST}:${PORT}`;
const WS_BASE = `ws://${HOST}:${PORT}/ws/collab`;
const WAIT_MS = 3000;
const NEGATIVE_WINDOW_MS = 300;

const FRAME_SYNC = 0x00;
const FRAME_LOAD = 0x03;
const FRAME_CONTROL = 0x04;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function bytesOf(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error(`未知消息类型：${typeof data}`);
}

function encodeSyncUpdate(update) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, FRAME_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/**
 * 进程内 Yjs 客户端：自动完成 openapi 握手（回 SYNC_STEP2），把收到的帧记成事件。
 *
 * 只实现本卡需要的下行路径。`updateEvents` 是「服务端主动下发的 UPDATE 帧」计数，
 * C2 的「发送者不回显」与 C6 的「只回放快照后的增量」都靠它。
 */
class Client {
  constructor(name, ws, docId) {
    this.name = name;
    this.ws = ws;
    this.docId = docId;
    this.ydoc = new Y.Doc();
    this.cells = this.ydoc.getMap('cells');
    this.load = null;
    this.caughtUp = false;
    this.updateEvents = [];
    this.closeInfo = null;
    this.otherFrames = [];
    this.closed = new Promise((done) => {
      ws.addEventListener('close', (event) => {
        this.closeInfo = { code: event.code, reason: event.reason };
        done(this.closeInfo);
      });
    });

    ws.binaryType = 'arraybuffer';
    ws.addEventListener('message', (event) => {
      try {
        this.onFrame(bytesOf(event.data));
      } catch (err) {
        this.otherFrames.push({ kind: 'parse-error', message: String(err) });
      }
    });
  }

  static async connect(name, docId) {
    const ws = new WebSocket(`${WS_BASE}/${encodeURIComponent(docId)}`);
    const client = new Client(name, ws, docId);
    await new Promise((done, fail) => {
      const timer = setTimeout(() => fail(new Error(`${name} 连接超时`)), WAIT_MS);
      ws.addEventListener(
        'open',
        () => {
          clearTimeout(timer);
          done();
        },
        { once: true },
      );
      ws.addEventListener(
        'close',
        (event) => {
          clearTimeout(timer);
          fail(new Error(`${name} 未连上就被关闭 code=${event.code}`));
        },
        { once: true },
      );
    });
    return client;
  }

  onFrame(bytes) {
    const decoder = decoding.createDecoder(bytes);
    const header = decoding.readVarUint(decoder);

    if (header === FRAME_SYNC) {
      const subtype = decoding.readVarUint(decoder);
      if (subtype === syncProtocol.messageYjsSyncStep1) {
        const stateVector = decoding.readVarUint8Array(decoder);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, FRAME_SYNC);
        syncProtocol.writeSyncStep2(encoder, this.ydoc, stateVector);
        this.ws.send(encoding.toUint8Array(encoder));
        return;
      }
      if (subtype === syncProtocol.messageYjsSyncStep2) {
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(this.ydoc, update, 'remote');
        return;
      }
      if (subtype === syncProtocol.messageYjsUpdate) {
        const update = decoding.readVarUint8Array(decoder);
        Y.applyUpdate(this.ydoc, update, 'remote');
        this.updateEvents.push({ at: Date.now(), bytes: update.byteLength });
        return;
      }
      this.otherFrames.push({ kind: 'sync-subtype', subtype });
      return;
    }

    if (header === FRAME_LOAD) {
      const payload = JSON.parse(decoding.readVarString(decoder));
      const state = gunzipSync(new Uint8Array(Buffer.from(payload.snapshot, 'base64')));
      Y.applyUpdate(this.ydoc, new Uint8Array(state), 'load');
      this.load = { version: payload.version, baseSeq: payload.baseSeq, stateBytes: state.length };
      return;
    }

    if (header === FRAME_CONTROL) {
      const payload = JSON.parse(decoding.readVarString(decoder));
      if (payload.type === 'caught-up') {
        this.caughtUp = true;
        return;
      }
      this.otherFrames.push({ kind: 'control', payload });
      return;
    }

    this.otherFrames.push({ kind: 'header', header });
  }

  /** 写一个绝对赋值并只发送该次变更的差量（与前端内容通道同形：`{v, f}`）。 */
  writeCell(key, value) {
    const before = Y.encodeStateVector(this.ydoc);
    this.cells.set(key, value);
    const update = Y.encodeStateAsUpdate(this.ydoc, before);
    this.ws.send(encodeSyncUpdate(update));
    return update;
  }

  cell(key) {
    return this.cells.get(key);
  }

  stateVectorBase64() {
    return Buffer.from(Y.encodeStateVector(this.ydoc)).toString('base64');
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* 已关闭 */
    }
  }
}

async function waitUntil(predicate, label, timeoutMs = WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (predicate()) return;
    if (Date.now() >= deadline) throw new Error(`${label}：等待超时（${timeoutMs}ms）`);
    await sleep(20);
  }
}

async function waitCaughtUp(client) {
  await waitUntil(() => client.caughtUp || client.closeInfo !== null, `${client.name} caught-up`);
  if (client.closeInfo !== null) {
    throw new Error(
      `${client.name} 在 caught-up 前关闭 code=${client.closeInfo.code} reason=${client.closeInfo.reason}`,
    );
  }
}

function requireEqual(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}：实际 ${a}，期望 ${e}`);
}

function readDb(fn) {
  const db = new DatabaseSync(DB_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

function rowsOf(docId) {
  return readDb((db) =>
    db
      .prepare('SELECT seq, update_blob FROM yjs_updates WHERE doc_id = ? ORDER BY seq ASC')
      .all(docId),
  );
}

/** 独立重建：只用库里的字节，不碰服务端内存态。 */
function rebuildFromRows(rows) {
  const doc = new Y.Doc();
  for (const row of rows) {
    if (!(row.update_blob instanceof Uint8Array)) {
      throw new Error(`update_blob 读回类型=${typeof row.update_blob}，期望 Uint8Array`);
    }
    Y.applyUpdate(doc, row.update_blob, 'db');
  }
  return doc.getMap('cells');
}

async function assertHealth() {
  const res = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
  if (res.status !== 200) throw new Error(`health status=${res.status}`);
  const body = await res.json();
  if (Object.keys(body).length !== 1 || body.status !== 'ok') {
    throw new Error(`health body=${JSON.stringify(body)}`);
  }
}

async function portBusy() {
  try {
    await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(800) });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 22) {
    console.error(`[服务] 本探针需要 Node 22，当前 ${process.versions.node}`);
    process.exitCode = 1;
    return;
  }
  if (!existsSync(MAIN)) {
    console.error(`[服务] 找不到 ${MAIN}，先跑 corepack pnpm --filter @wo/server build`);
    process.exitCode = 1;
    return;
  }
  for (const file of DB_FILES) rmSync(file, { force: true });
  if (await portBusy()) {
    console.error(`[服务] 端口 ${PORT} 已被占用，先停旧服务（本探针不杀未知进程）`);
    process.exitCode = 1;
    return;
  }

  let stdout = '';
  let stderr = '';
  let exited = false;
  let child = null;

  async function startServer() {
    exited = false;
    child = spawn(process.execPath, ['dist/main.js'], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        WO_JWT_SECRET: 'probe',
        WO_DB_URL: 'var/wo.collab.probe.db',
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
  }

  async function stopServer() {
    if (child !== null) child.kill();
    const deadline = Date.now() + 5000;
    while (!exited && Date.now() < deadline) await sleep(50);
    if (!exited) throw new Error('强杀后进程仍未退出');
  }

  async function waitReady(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    for (;;) {
      if (exited) throw new Error(`服务进程启动时退出 code=${child?.exitCode}`);
      try {
        await assertHealth();
        return;
      } catch (err) {
        lastError = err;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `等待服务就绪超时：${lastError instanceof Error ? lastError.message : lastError}`,
        );
      }
      await sleep(100);
    }
  }

  const failures = [];
  async function check(id, title, fn) {
    try {
      await fn();
      console.log(`[服务] OK ${id} ${title}`);
    } catch (err) {
      failures.push({ id, title, message: err instanceof Error ? err.message : String(err) });
      console.log(`[服务] FAIL ${id} ${title} :: ${failures.at(-1).message}`);
    }
  }

  let A;
  let B;
  let G;
  let H;
  let I;

  try {
    await startServer();

    await check('C0', 'health 是 JSON 且 body 精确为 {status:ok}', async () => {
      await waitReady();
      await assertHealth();
    });

    await check('C1', 'A/B 首连空 doc：LOAD(0/0) + caught-up，两端 doc 为空', async () => {
      A = await Client.connect('A', 'doc-a');
      B = await Client.connect('B', 'doc-a');
      await waitCaughtUp(A);
      await waitCaughtUp(B);
      requireEqual(
        A.load && { version: A.load.version, baseSeq: A.load.baseSeq },
        { version: 0, baseSeq: 0 },
        'A LOAD',
      );
      requireEqual(
        B.load && { version: B.load.version, baseSeq: B.load.baseSeq },
        { version: 0, baseSeq: 0 },
        'B LOAD',
      );
      if (A.cells.size !== 0 || B.cells.size !== 0) {
        throw new Error(`空 doc 不为空：A=${A.cells.size} B=${B.cells.size}`);
      }
      if (A.load.stateBytes !== 2)
        throw new Error(`空快照解压后 ${A.load.stateBytes} 字节，期望 2`);
    });

    await check('C2', 'A 写 A1=5：B 收到，A 不回显', async () => {
      if (!A || !B) throw new Error('A/B 未连接，前置判据失败');
      const echoBefore = A.updateEvents.length;
      A.writeCell('A1', { v: 5, f: '' });
      await waitUntil(() => B.cell('A1')?.v === 5, 'B 收到 A1=5');
      await sleep(NEGATIVE_WINDOW_MS);
      const echoed = A.updateEvents.length - echoBefore;
      if (echoed !== 0) throw new Error(`A 收到 ${echoed} 条自己的回声，期望 0`);
      requireEqual(A.cell('A1')?.v, 5, 'A 本地 A1');
    });

    await check('C3', 'B 写 A2=7：A 收到，两端 state vector 一致', async () => {
      if (!A || !B) throw new Error('A/B 未连接，前置判据失败');
      B.writeCell('A2', { v: 7, f: '' });
      await waitUntil(() => A.cell('A2')?.v === 7, 'A 收到 A2=7');
      const a = A.stateVectorBase64();
      const b = B.stateVectorBase64();
      if (a !== b) throw new Error(`state vector 不一致：A=${a} B=${b}`);
    });

    await check('C4', '旁路直读 yjs_updates：seq=[1,2] 且可独立还原 A1/A2', () => {
      const rows = rowsOf('doc-a');
      requireEqual(
        rows.map((row) => Number(row.seq)),
        [1, 2],
        'doc-a seq',
      );
      const cells = rebuildFromRows(rows);
      requireEqual(cells.get('A1')?.v, 5, '库里 A1');
      requireEqual(cells.get('A2')?.v, 7, '库里 A2');
    });

    await check(
      'C5',
      'POST 快照 = {version:1,baseSeq:2}；GET 可解出 A1/A2；库内水位一致',
      async () => {
        const before = await fetch(`${BASE}/api/v1/files/doc-a/snapshot`);
        if (before.status !== 404)
          throw new Error(`无快照时 GET status=${before.status}，期望 404`);

        const post = await fetch(`${BASE}/api/v1/files/doc-a/snapshot`, { method: 'POST' });
        if (post.status !== 201) throw new Error(`POST status=${post.status}，期望 201`);
        const created = await post.json();
        requireEqual(created, { version: 1, baseSeq: 2 }, 'POST 响应');

        const get = await fetch(`${BASE}/api/v1/files/doc-a/snapshot`);
        if (get.status !== 200) throw new Error(`GET status=${get.status}，期望 200`);
        const body = await get.json();
        if (body.version !== 1 || body.baseSeq !== 2) {
          throw new Error(`GET version/baseSeq=${body.version}/${body.baseSeq}，期望 1/2`);
        }

        const state = new Uint8Array(
          gunzipSync(new Uint8Array(Buffer.from(body.snapshot, 'base64'))),
        );
        const doc = new Y.Doc();
        Y.applyUpdate(doc, state, 'get');
        const cells = doc.getMap('cells');
        requireEqual(cells.get('A1')?.v, 5, 'GET 快照 A1');
        requireEqual(cells.get('A2')?.v, 7, 'GET 快照 A2');

        const row = readDb((db) =>
          db
            .prepare(
              'SELECT version, base_seq, snapshot FROM file_snapshots WHERE doc_id = ? ORDER BY version DESC LIMIT 1',
            )
            .get('doc-a'),
        );
        if (row === undefined) throw new Error('库里没有 file_snapshots 行');
        requireEqual(
          { version: Number(row.version), baseSeq: Number(row.base_seq) },
          { version: 1, baseSeq: 2 },
          '库内快照水位',
        );
        const maxSeq = readDb((db) =>
          db
            .prepare('SELECT COALESCE(MAX(seq), 0) AS m FROM yjs_updates WHERE doc_id = ?')
            .get('doc-a'),
        );
        if (Number(maxSeq.m) !== Number(row.base_seq)) {
          throw new Error(`base_seq=${row.base_seq} 不等于 max(seq)=${maxSeq.m}`);
        }
        if (Buffer.compare(Buffer.from(row.snapshot), Buffer.from(body.snapshot, 'base64')) !== 0) {
          throw new Error('GET 的字节与库里 BLOB 不一致');
        }
      },
    );

    await check('C6', '再写 A3：seq=3；新连接收到 snapshot@2 + 恰 1 条增量，三方一致', async () => {
      if (!A || !B) throw new Error('A/B 未连接，前置判据失败');
      A.writeCell('A3', { v: 9, f: '' });
      await waitUntil(() => B.cell('A3')?.v === 9, 'B 收到 A3=9');
      await waitUntil(() => rowsOf('doc-a').some((row) => Number(row.seq) === 3), '库内出现 seq=3');

      G = await Client.connect('G', 'doc-a');
      await waitCaughtUp(G);
      requireEqual(
        G.load && { version: G.load.version, baseSeq: G.load.baseSeq },
        { version: 1, baseSeq: 2 },
        'G LOAD',
      );
      requireEqual(G.updateEvents.length, 1, 'G 回放帧数（只应有 seq=3）');
      requireEqual([G.cell('A1')?.v, G.cell('A2')?.v, G.cell('A3')?.v], [5, 7, 9], 'G 单元格');
      const sv = A.stateVectorBase64();
      if (B.stateVectorBase64() !== sv || G.stateVectorBase64() !== sv) {
        throw new Error(
          `state vector 不一致：A=${sv} B=${B.stateVectorBase64()} G=${G.stateVectorBase64()}`,
        );
      }
    });

    await check('C7', 'doc-b 隔离：自己从 seq=1 开始，doc-a 不被串扰', async () => {
      if (!A) throw new Error('A 未连接，前置判据失败');
      H = await Client.connect('H', 'doc-b');
      await waitCaughtUp(H);
      requireEqual(
        H.load && { version: H.load.version, baseSeq: H.load.baseSeq },
        { version: 0, baseSeq: 0 },
        'H LOAD',
      );
      H.writeCell('B1', { v: 1, f: '' });
      await waitUntil(() => H.cell('B1')?.v === 1, 'H 本地 B1=1');
      await waitUntil(() => rowsOf('doc-b').length === 1, 'doc-b 落库');

      requireEqual(
        rowsOf('doc-b').map((row) => Number(row.seq)),
        [1],
        'doc-b seq',
      );
      requireEqual(
        rowsOf('doc-a').map((row) => Number(row.seq)),
        [1, 2, 3],
        'doc-a seq',
      );

      const before = A.updateEvents.length;
      await sleep(NEGATIVE_WINDOW_MS);
      if (A.updateEvents.length !== before) throw new Error('doc-a 的连接收到了 doc-b 的增量');
      if (A.cell('B1') !== undefined) throw new Error('doc-a 的 doc 里出现了 B1');
    });

    await check(
      'C8',
      '强杀重启：库内行完整；新连接按 snapshot@2 + seq>2 重建 A1/A2/A3',
      async () => {
        for (const client of [A, B, G, H]) client?.close();
        await stopServer();

        requireEqual(
          rowsOf('doc-a').map((row) => Number(row.seq)),
          [1, 2, 3],
          '重启前 doc-a seq',
        );
        requireEqual(
          rowsOf('doc-b').map((row) => Number(row.seq)),
          [1],
          '重启前 doc-b seq',
        );

        await startServer();
        await waitReady();

        I = await Client.connect('I', 'doc-a');
        await waitCaughtUp(I);
        requireEqual(
          I.load && { version: I.load.version, baseSeq: I.load.baseSeq },
          { version: 1, baseSeq: 2 },
          'I LOAD',
        );
        requireEqual(I.updateEvents.length, 1, 'I 回放帧数（只应有 seq=3）');
        requireEqual(
          [I.cell('A1')?.v, I.cell('A2')?.v, I.cell('A3')?.v],
          [5, 7, 9],
          '重启后重建的单元格',
        );

        const cells = rebuildFromRows(rowsOf('doc-a'));
        requireEqual(
          [cells.get('A1')?.v, cells.get('A2')?.v, cells.get('A3')?.v],
          [5, 7, 9],
          '库内全量回放的单元格',
        );
      },
    );

    await check(
      'C9',
      '补充：坏帧关闭码——未实现上行 1008、非法 lib0 1003、文本帧 1008',
      async () => {
        const cases = [
          { name: '0x01 AWARENESS', frame: new Uint8Array([0x01]), code: 1008 },
          { name: '0x05 ROLE_UPGRADE', frame: new Uint8Array([0x05]), code: 1008 },
          { name: '截断的 SYNC', frame: new Uint8Array([0x00]), code: 1003 },
          { name: '未知 sync 子类型', frame: new Uint8Array([0x00, 0x05]), code: 1003 },
          { name: '空帧', frame: new Uint8Array(0), code: 1003 },
          { name: '文本帧', frame: 'text-not-allowed', code: 1008 },
        ];
        for (const testCase of cases) {
          const probe = await Client.connect(`bad-${testCase.name}`, 'doc-c');
          probe.ws.send(testCase.frame);
          const info = await Promise.race([probe.closed, sleep(WAIT_MS).then(() => null)]);
          if (info === null) {
            probe.close();
            throw new Error(`${testCase.name} 未被关闭（期望 ${testCase.code}）`);
          }
          if (info.code !== testCase.code) {
            throw new Error(`${testCase.name} 关闭码=${info.code}，期望 ${testCase.code}`);
          }
          console.log(`[服务]      ${testCase.name} → ${info.code}`);
        }
        await assertHealth();
      },
    );
  } finally {
    for (const client of [A, B, G, H, I]) client?.close();
    if (child !== null && !exited) {
      child.kill();
      const deadline = Date.now() + 3000;
      while (!exited && Date.now() < deadline) await sleep(50);
    }
  }

  if (failures.length > 0) {
    console.error(`\n[服务] ${failures.length} 条判据失败；库文件保留在 ${DB_PATH}`);
    console.error(`[服务] 服务端 stdout 尾部：\n${stdout.slice(-2000)}`);
    console.error(`[服务] 服务端 stderr 尾部：\n${stderr.slice(-2000)}`);
    process.exitCode = 1;
    return;
  }

  for (const file of DB_FILES) rmSync(file, { force: true });
  console.log('\n[服务] 10 条判据全部通过（C0~C8 + 补充 C9 坏帧关闭码）');
}

await main();
