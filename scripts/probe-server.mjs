#!/usr/bin/env node
/**
 * V3.1 单进程服务探针（`docs/phase3/tasks/V3.1.md` §4.6）。
 *
 * 只用 Node 22 自带能力：`node:sqlite` 旁路直读库、全局 `WebSocket` 当客户端、
 * `fetch` 校验 health。不引入测试框架——本卡的判据是端到端事实，不是单测覆盖。
 *
 * 判据设计的两条底线（§5.2）：
 * - 持久化必须绕过应用代码直读库，否则「消息在内存里对」会被误当成入库。
 * - 负向断言必须配正向对照：⑦ 里 D 收不到之前，B/C 必须收到同一条消息；
 *   否则「没发消息」也能让「D 收不到」恒真。
 *
 * 失败时保留库文件与进程输出，便于定位；成功时清掉 `var/wo.probe.db*`。
 */
import { spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = join(ROOT, 'apps/server');
const MAIN = join(SERVER_DIR, 'dist/main.js');
const DB_PATH = join(ROOT, 'var/wo.probe.db');
const DB_FILES = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
const HOST = '127.0.0.1';
const PORT = 3100;
const BASE = `http://${HOST}:${PORT}`;
const WS_BASE = `ws://${HOST}:${PORT}/ws/collab`;
const NEGATIVE_WINDOW_MS = 300;
const WAIT_MS = 3000;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

class Client {
  constructor(name, ws) {
    this.name = name;
    this.ws = ws;
    this.frames = [];
    this.closeInfo = null;
    ws.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        this.frames.push({ __binary: true });
        return;
      }
      try {
        this.frames.push(JSON.parse(event.data));
      } catch {
        this.frames.push({ __unparsed: event.data });
      }
    });
    ws.addEventListener('close', (event) => {
      this.closeInfo = { code: event.code, reason: event.reason };
    });
  }

  static async connect(name, docId) {
    const ws = new WebSocket(`${WS_BASE}/${encodeURIComponent(docId)}`);
    const client = new Client(name, ws);
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

  sendJson(payload) {
    this.ws.send(JSON.stringify(payload));
  }

  sendRaw(text) {
    this.ws.send(text);
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* 已关闭 */
    }
  }
}

async function waitForFrame(client, predicate, label, timeoutMs = WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const index = client.frames.findIndex(predicate);
    if (index !== -1) return client.frames.splice(index, 1)[0];
    if (client.closeInfo !== null) {
      throw new Error(
        `${label}：${client.name} 已关闭 code=${client.closeInfo.code}，已收帧=${JSON.stringify(client.frames)}`,
      );
    }
    if (Date.now() >= deadline) {
      throw new Error(
        `${label}：等待超时（${timeoutMs}ms），${client.name} 已收帧=${JSON.stringify(client.frames)}`,
      );
    }
    await sleep(20);
  }
}

async function expectNoFrame(client, predicate, label) {
  await sleep(NEGATIVE_WINDOW_MS);
  const hit = client.frames.find(predicate);
  if (hit !== undefined) {
    throw new Error(`${label}：${client.name} 不应收到却收到了 ${JSON.stringify(hit)}`);
  }
}

async function waitClosed(client, label, timeoutMs = WAIT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (client.closeInfo === null) {
    if (Date.now() >= deadline) {
      throw new Error(`${label}：等待 ${client.name} 关闭超时`);
    }
    await sleep(20);
  }
  return client.closeInfo;
}

function expectEqual(actual, expected, label) {
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

async function assertHealth() {
  const res = await fetch(`${BASE}/api/v1/health`, { signal: AbortSignal.timeout(2000) });
  if (res.status !== 200) throw new Error(`health status=${res.status}`);
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(`health content-type=${contentType}（疑似端口被别的服务占用）`);
  }
  const body = await res.json();
  if (body === null || typeof body !== 'object')
    throw new Error(`health body=${JSON.stringify(body)}`);
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
    console.error(`[服务] 本探针需要 Node 22.22.2，当前 ${process.versions.node}`);
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
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      WO_JWT_SECRET: 'probe',
      WO_DB_URL: 'var/wo.probe.db',
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

  async function waitReady(timeoutMs = 20000) {
    const deadline = Date.now() + timeoutMs;
    let lastError = null;
    for (;;) {
      if (exited) throw new Error(`服务进程启动时退出 code=${child.exitCode}`);
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

  let A;
  let B;
  let C;
  let D;
  let E;
  let F;

  try {
    await check('P0', 'health 是 JSON 且 body 精确为 {status:ok}', async () => {
      await waitReady();
      await assertHealth();
    });

    await check('P1', '库落在仓库根 var/，包目录下没有 var/', () => {
      if (!existsSync(DB_PATH)) throw new Error(`缺少 ${DB_PATH}`);
      if (existsSync(join(SERVER_DIR, 'var'))) {
        throw new Error(`库被建到了包目录：${join(SERVER_DIR, 'var')}`);
      }
    });

    await check('①', 'A/B 连 doc-a，ready 的 docId 与空历史正确', async () => {
      A = await Client.connect('A', 'doc-a');
      B = await Client.connect('B', 'doc-a');
      for (const [client, name] of [
        [A, 'A'],
        [B, 'B'],
      ]) {
        const ready = await waitForFrame(client, (f) => f.type === 'ready', `${name} ready`);
        expectEqual(ready.docId, 'doc-a', `${name} ready.docId`);
        expectEqual(ready.messages, [], `${name} ready.messages`);
      }
    });

    await check('②', 'A 发消息：A 只收 ack，B 收到广播', async () => {
      if (!A || !B) throw new Error('A/B 未连接，前置判据失败');
      A.sendJson({ type: 'message', text: 'hello-from-A' });
      const ack = await waitForFrame(A, (f) => f.type === 'ack', 'A ack');
      if (ack.seq !== 1) throw new Error(`A ack.seq=${ack.seq}，期望 1`);
      if (typeof ack.at !== 'number') throw new Error(`A ack.at=${ack.at}`);
      await expectNoFrame(A, (f) => f.type === 'message' && f.seq === 1, '发送者只允许收 ack');
      const broadcast = await waitForFrame(
        B,
        (f) => f.type === 'message' && f.seq === 1,
        'B 收到 A 的广播',
      );
      expectEqual(broadcast.text, 'hello-from-A', 'B 广播文本');
      expectEqual(broadcast.docId, 'doc-a', 'B 广播 docId');
    });

    await check('③', 'B 发消息：B 收 ack，A 收到广播（反向）', async () => {
      if (!A || !B) throw new Error('A/B 未连接，前置判据失败');
      B.sendJson({ type: 'message', text: 'hello-from-B' });
      const ack = await waitForFrame(B, (f) => f.type === 'ack', 'B ack');
      if (ack.seq !== 2) throw new Error(`B ack.seq=${ack.seq}，期望 2`);
      const broadcast = await waitForFrame(
        A,
        (f) => f.type === 'message' && f.seq === 2,
        'A 收到 B 的广播',
      );
      expectEqual(broadcast.text, 'hello-from-B', 'A 广播文本');
    });

    await check('④', '旁路直读库：doc-a 恰两行且顺序正确', () => {
      const rows = readDb((db) =>
        db
          .prepare('SELECT seq, text FROM collab_messages WHERE doc_id = ? ORDER BY seq ASC')
          .all('doc-a'),
      );
      expectEqual(
        rows.map((row) => row.text),
        ['hello-from-A', 'hello-from-B'],
        'doc-a 文本与顺序',
      );
      if (Number(rows[0].seq) >= Number(rows[1].seq)) {
        throw new Error(`seq 未严格递增：${rows[0].seq} -> ${rows[1].seq}`);
      }
    });

    await check('⑤', '表清单与列形状精确匹配', () => {
      const tables = readDb((db) =>
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          )
          .all(),
      ).map((row) => row.name);
      expectEqual(tables, ['collab_messages'], '业务表清单');

      const columns = readDb((db) => db.prepare('PRAGMA table_info(collab_messages)').all());
      expectEqual(
        columns.map((column) => column.name),
        ['seq', 'doc_id', 'text', 'created_at'],
        '列清单',
      );
      expectEqual(
        columns.map((column) => column.type),
        ['INTEGER', 'TEXT', 'TEXT', 'INTEGER'],
        '列类型',
      );
    });

    await check('⑥', 'C 迟到进房，history 来自库且升序', async () => {
      C = await Client.connect('C', 'doc-a');
      const ready = await waitForFrame(C, (f) => f.type === 'ready', 'C ready');
      expectEqual(ready.docId, 'doc-a', 'C ready.docId');
      expectEqual(
        ready.messages.map((message) => message.text),
        ['hello-from-A', 'hello-from-B'],
        'C 历史文本与顺序',
      );
      const seqs = ready.messages.map((message) => message.seq);
      if (!(seqs[0] < seqs[1])) throw new Error(`C 历史 seq 未升序：${JSON.stringify(seqs)}`);
    });

    await check('⑦', 'doc-b 隔离：D 收不到 doc-a 的新消息（B/C 必须收到）', async () => {
      if (!A || !B || !C) throw new Error('A/B/C 未连接，前置判据失败');
      D = await Client.connect('D', 'doc-b');
      const ready = await waitForFrame(D, (f) => f.type === 'ready', 'D ready');
      expectEqual(ready.messages, [], 'D ready.messages');

      A.sendJson({ type: 'message', text: 'isolation-ping' });
      const ack = await waitForFrame(A, (f) => f.type === 'ack', 'A isolation ack');
      if (ack.seq !== 3) throw new Error(`A isolation ack.seq=${ack.seq}，期望 3`);
      for (const client of [B, C]) {
        const broadcast = await waitForFrame(
          client,
          (f) => f.type === 'message' && f.seq === 3,
          `${client.name} 收到正向对照消息`,
        );
        expectEqual(broadcast.text, 'isolation-ping', `${client.name} 对照文本`);
      }
      await expectNoFrame(D, (f) => f.type === 'message', 'D 不应跨房收到消息');
    });

    await check('⑧', '坏帧关闭码 1003/1008，服务仍存活', async () => {
      if (!D) throw new Error('D 未连接，前置判据失败');
      D.sendRaw('not-json');
      const dClose = await waitClosed(D, 'D 非 JSON');
      if (dClose.code !== 1003) throw new Error(`D 关闭码=${dClose.code}，期望 1003`);

      E = await Client.connect('E', 'doc-b');
      await waitForFrame(E, (f) => f.type === 'ready', 'E ready');
      E.sendJson({ type: 'nope' });
      const eClose = await waitClosed(E, 'E 未知 type');
      if (eClose.code !== 1008) throw new Error(`E 关闭码=${eClose.code}，期望 1008`);

      F = await Client.connect('F', 'doc-b');
      await waitForFrame(F, (f) => f.type === 'ready', 'F ready');
      F.sendJson({ type: 'message', text: 'survivor' });
      const ack = await waitForFrame(F, (f) => f.type === 'ack', 'F ack');
      if (ack.seq !== 4) throw new Error(`F ack.seq=${ack.seq}，期望 4`);

      await assertHealth();
    });

    await check('⑨', '强杀进程后重开库：已 ack 的消息仍在', async () => {
      for (const client of [A, B, C, D, E, F]) client?.close();
      if (!exited) {
        child.kill();
        const deadline = Date.now() + 5000;
        while (!exited && Date.now() < deadline) await sleep(50);
      }
      if (!exited) throw new Error('强杀后进程仍未退出');

      const docA = readDb((db) =>
        db
          .prepare('SELECT seq, text FROM collab_messages WHERE doc_id = ? ORDER BY seq ASC')
          .all('doc-a'),
      );
      const docB = readDb((db) =>
        db
          .prepare('SELECT seq, text FROM collab_messages WHERE doc_id = ? ORDER BY seq ASC')
          .all('doc-b'),
      );
      expectEqual(
        docA.map((row) => row.text),
        ['hello-from-A', 'hello-from-B', 'isolation-ping'],
        '杀进程后 doc-a 文本',
      );
      expectEqual(
        docA.map((row) => Number(row.seq)),
        [1, 2, 3],
        '杀进程后 doc-a seq',
      );
      expectEqual(
        docB.map((row) => row.text),
        ['survivor'],
        '杀进程后 doc-b 文本',
      );
      expectEqual(
        docB.map((row) => Number(row.seq)),
        [4],
        '杀进程后 doc-b seq',
      );
    });
  } finally {
    for (const client of [A, B, C, D, E, F]) client?.close();
    if (!exited) {
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
  console.log('\n[服务] 11 条判据全部通过');
}

await main();
