#!/usr/bin/env node
/**
 * 提交 + 推送唯一入口：`node scripts/ship.mjs -m "提交消息"`。
 *
 * ## 为什么要有这个脚本
 *
 * `git push` 在本机的失败不是一种，是三种，而它们的处置**完全相反**：
 *
 * | 失败类型 | 换路线重试有用吗 | 真实含义 |
 * |---|---|---|
 * | 通道不通（加速器没开 / 节点死了） | 有用 | 这条路走不通，换下一条 |
 * | 远端分叉（non-fast-forward） | **没用** | 历史形状冲突，得人来选 merge 还是 rebase |
 * | 认证失败（key / 凭据不对） | 换路线可能有用 | SSH 与 HTTPS 是两套凭据 |
 *
 * 把三件事混成「失败就重试」，就会在第二种上空转到超时、在第三种上刷满日志还找不到原因。
 * 所以这里先**归类**，再决定走不走下一条路线。
 *
 * ## 路线顺序由 `github-push-egress-triage` skill 规定
 *
 * SSH → 代理 HTTPS → 直连 HTTPS。用户 2026-10-26 选定「B 方案」：**不做端口探活**，
 * 直接按序试、每条 5s 连接超时，三条全失败立即停并提示加速器。故本脚本里没有任何
 * netstat / 端口扫描逻辑——这是刻意不写，不是漏写。
 *
 * ## 不采信 push 的输出
 *
 * 推送报文成功不等于远端真的收到了；反过来，报文失败也不等于没送达（服务端已更新 ref、
 * 回执在返回途中丢了也会报错）。所以成功后一律 `ls-remote` 逐字节比对 SHA，
 * 失败后也先用同一路线复核一次，避免把「其实已送达」误判成失败而重推。
 *
 * ## 刻意不做的三件事（2026-10-26 评审结论）
 *
 * 1. **不生成 commit message。** 本仓提交消息是「坑在哪 + 为什么这么定」的复盘，
 *    是仓库里最有价值的资产；机器生成会把它稀释成 `feat: update`。消息必须人给。
 * 2. **不做无差别 add。** 先跑白名单扫描（密钥 / 产物 / 超大文件），通过了才 `add -A`。
 * 3. **不自动 rebase / merge 解决分叉。** 两种历史形状不能由脚本替人选，检测到就停。
 */
import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 退出码：调用方按码分支，不要靠 grep 日志。 */
const EXIT = {
  OK: 0,
  VERIFY_FAILED: 1,
  PRECONDITION: 2,
  NO_ROUTE: 3,
  DIVERGED: 4,
  REMOTE_MISMATCH: 5,
};

/** 单文件体积上限：超过即拒绝提交（本仓最大的已跟踪文件约 1.4MB）。 */
const FILE_SIZE_FAIL = 10 * 1024 * 1024;
const FILE_SIZE_WARN = 3 * 1024 * 1024;

/**
 * 代理地址。默认 7890 是 Clash 类加速器的固定混合端口；
 * 可用 `WO_PUSH_PROXY` 覆写（换加速器时不必改脚本）。
 */
const PROXY_URL = process.env.WO_PUSH_PROXY ?? 'http://127.0.0.1:7890';

/**
 * 统一环境：清掉代理环境变量，禁掉一切交互提示。
 *
 * 清代理是必须的：本机 `http_proxy` 指向的端口**换过一次**（50976 → 49869，两次都已失效），
 * 而 git 全局配置里硬编码的是 7890。环境变量与配置各说一套时，HTTPS 路线会以
 * 「代理连不上」的形态失败，看起来像 GitHub 挂了。这里统一为「脚本显式指定」，两边都不靠猜。
 */
const BASE_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' };
for (const key of [
  'http_proxy',
  'https_proxy',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'all_proxy',
]) {
  delete BASE_ENV[key];
}

/**
 * SSH 选项。每条都必须带 `-o`：漏掉它，ssh 会把 `BatchMode=yes` 当成**主机名**，
 * 于是以 141ms「连不上 BatchMode=yes 这台机器」的形态失败，看起来像网络问题。
 */
const SSH_OPTS = [
  '-o',
  'BatchMode=yes',
  '-o',
  'ConnectTimeout=5',
  '-o',
  'ServerAliveInterval=5',
  '-o',
  'ServerAliveCountMax=3',
  '-o',
  'StrictHostKeyChecking=accept-new',
].join(' ');

/**
 * HTTPS 两条路线共用的配置。
 *
 * - `insteadOf` 把 remote 的 SSH 形态改写成 HTTPS，**不必改 `.git/config`**：
 *   改 remote 会在一次失败的尝试后留下「remote 被改过」的副作用，下次报错更难认。
 * - 必须清空 helper 再单挂 manager：全局 `credential.helper` 指向一个**不存在的绝对路径**
 *   （PortableGit 目录已变），跟着它走会在无终端时挂死。
 * - `lowSpeedLimit/Time` 是 HTTPS 侧的「死链路」判定：20s 内低于 1KB/s 即放弃，
 *   否则一条半死的 TLS 连接能安静地卡到外层超时。
 */
const HTTPS_COMMON = [
  'url.https://github.com/.insteadOf=git@github.com:',
  'credential.helper=',
  'credential.helper=manager',
  'http.lowSpeedLimit=1000',
  'http.lowSpeedTime=20',
];

const ROUTES = [
  {
    id: '1',
    label: 'SSH（走 ~/.ssh/config 里的 ProxyCommand 隧道）',
    config: [`core.sshCommand=ssh ${SSH_OPTS}`],
  },
  {
    id: '2',
    label: `代理 HTTPS（${PROXY_URL}）`,
    config: [...HTTPS_COMMON, `http.https://github.com.proxy=${PROXY_URL}`],
  },
  {
    id: '3',
    label: '直连 HTTPS（显式禁用代理）',
    config: [...HTTPS_COMMON, 'http.https://github.com.proxy='],
  },
];

/** 分叉：换路线重试一百次也不会变，必须人来决定。 */
const DIVERGED_MARKERS = [
  'non-fast-forward',
  'fetch first',
  '[rejected]',
  'updates were rejected',
  'tip of your current branch is behind',
];

/** 认证：SSH 与 HTTPS 是两套凭据，故换路线有意义，但同一条路线重试无意义。 */
const AUTH_MARKERS = [
  'permission denied (publickey)',
  'could not read username',
  'authentication failed',
  'terminal prompts disabled',
  'invalid username or password',
  'support for password authentication was removed',
  'no such identity',
];

const KIND_LABEL = {
  ok: '成功',
  landed: '已送达（回执丢失）',
  timeout: '超时',
  auth: '认证失败',
  network: '通道不通',
  diverged: '远端分叉',
  'no-route': '三条路线全失败',
};

// ---------------------------------------------------------------------------
// 基础设施
// ---------------------------------------------------------------------------

/**
 * 所有 git 调用的唯一出口：统一环境、统一超时、统一返回形状。
 *
 * 超时用 spawnSync 硬杀。外层上限是兜底，真正的快速失败靠传输层参数
 * （SSH 的 ConnectTimeout / HTTPS 的 lowSpeedTime）——硬杀一个正在传大包的连接
 * 会产生「本地认为失败、远端可能已更新」的模糊态，所以外层给得比较宽。
 */
function runGit(args, { config = [], timeout = 180000, input } = {}) {
  const full = [];
  for (const kv of config) full.push('-c', kv);
  full.push(...args);

  const res = spawnSync('git', full, {
    cwd: ROOT,
    env: BASE_ENV,
    encoding: 'utf8',
    timeout,
    input,
    maxBuffer: 64 * 1024 * 1024,
  });

  const timedOut = res.error?.code === 'ETIMEDOUT' || res.signal === 'SIGTERM';
  return {
    ok: res.status === 0 && !timedOut,
    status: res.status,
    timedOut,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
    spawnFailed: Boolean(res.error) && !timedOut,
  };
}

function textOf(res) {
  return `${res.stdout}${res.stderr}`.trim();
}

/** 取一行最像原因的输出，避免把整包日志糊在终端上。 */
function firstMeaningfulLine(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return (
    lines.find((line) => /fatal|error|denied|refused|reset|timed out|failed/i.test(line)) ??
    lines[0] ??
    ''
  );
}

function classifyPush(text) {
  const t = text.toLowerCase();
  if (DIVERGED_MARKERS.some((m) => t.includes(m))) return 'diverged';
  if (AUTH_MARKERS.some((m) => t.includes(m))) return 'auth';
  return 'network';
}

// ---------------------------------------------------------------------------
// 参数
// ---------------------------------------------------------------------------

const USAGE = `
用法：node scripts/ship.mjs -m "提交消息" [选项]

选项
  -m, --message <msg>   提交消息（有改动时必填）
  -F, --file <path>     从文件读提交消息（替代 -m）
      --no-verify       跳过 verify 门禁（不推荐）
      --no-push         只提交，不推送
      --dry-run         只打印计划，不写入仓库、不联网
      --check           通道体检：按序对各路线跑 ls-remote，不提交不推送
      --route=1|2|3     只走指定路线（诊断用；默认按 1→2→3 依次试）
      --tag <name>      推送成功后额外推送该标签
  -h, --help            显示本帮助

退出码
  0 成功   1 verify 未通过   2 前置条件不满足
  3 三条路线全失败   4 远端分叉需人工处理   5 推送后复核不一致
`.trim();

function parseArgs(argv) {
  const opts = {
    message: null,
    messageFile: null,
    verify: true,
    push: true,
    dryRun: false,
    check: false,
    route: null,
    tag: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-m' || arg === '--message') {
      opts.message = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '-F' || arg === '--file') {
      opts.messageFile = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--no-verify') {
      opts.verify = false;
    } else if (arg === '--no-push') {
      opts.push = false;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--check') {
      opts.check = true;
    } else if (arg === '--tag') {
      opts.tag = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith('--route=')) {
      opts.route = arg.slice('--route='.length);
    } else if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }

  if (opts.route !== null && !['1', '2', '3'].includes(opts.route)) {
    throw new Error(`--route 只接受 1 / 2 / 3，收到：${opts.route}`);
  }
  return opts;
}

// ---------------------------------------------------------------------------
// 改动清单与安全扫描
// ---------------------------------------------------------------------------

/** `--porcelain -z` 解析。重命名条目在 -z 形态下会多带一个原路径字段，要跳过。 */
function listChanges() {
  const res = runGit(['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    timeout: 60000,
  });
  if (!res.ok) return { ok: false, entries: [], detail: textOf(res) };

  const parts = res.stdout.split('\0').filter((part) => part.length > 0);
  const entries = [];
  for (let i = 0; i < parts.length; i += 1) {
    const entry = parts[i];
    const status = entry.slice(0, 2);
    const path = entry.slice(3);
    if (status.includes('R') || status.includes('C')) i += 1;
    entries.push({ status, path });
  }
  return { ok: true, entries, detail: '' };
}

/**
 * 路径白名单：只拦「几乎不可能该进仓库」的类别，不做通用敏感词匹配——
 * 匹配过宽会把正常的 `.env.example`、`jwk.json` 一律拦下，最后只能靠 `--no-verify`
 * 之类的后门绕过，反而更危险。
 */
function guardPath(path) {
  const base = path.split('/').pop() ?? path;

  if (/^\.env(\..*)?$/i.test(base) && !/^\.env\.(example|sample|template)$/i.test(base)) {
    return '环境变量文件常含密钥';
  }
  if (/\.(pem|key|pfx|p12|jks|keystore)$/i.test(base)) return '私钥 / 证书文件';
  if (/^id_(rsa|ed25519|ecdsa|dsa)$/i.test(base)) return 'SSH 私钥';
  if (/(^|\/)(node_modules|dist|build|coverage|\.pnpm-store|\.nx|trash)\//i.test(path)) {
    return '构建产物 / 依赖目录';
  }
  return null;
}

function fileSize(path) {
  try {
    return statSync(resolve(ROOT, path)).size;
  } catch {
    return 0;
  }
}

/** 返回 { blocked, warned }：blocked 非空即拒绝提交。 */
function scanChanges(entries) {
  const blocked = [];
  const warned = [];

  for (const entry of entries) {
    // 删除（D）没有内容可泄露，跳过内容类检查。
    if (entry.status.includes('D')) continue;

    const why = guardPath(entry.path);
    if (why) {
      blocked.push(`${entry.path}（${why}）`);
      continue;
    }

    const size = fileSize(entry.path);
    if (size > FILE_SIZE_FAIL) {
      blocked.push(`${entry.path}（${formatSize(size)}，超过 ${formatSize(FILE_SIZE_FAIL)}）`);
    } else if (size > FILE_SIZE_WARN) {
      warned.push(`${entry.path}（${formatSize(size)}）`);
    }
  }

  return { blocked, warned };
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${bytes}B`;
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

function runVerify() {
  const started = Date.now();
  const res = spawnSync(process.execPath, [resolve(ROOT, 'scripts/verify.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 30 * 60 * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });

  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`;
  const matches = [...out.matchAll(/(\d+)\/(\d+) 段通过/g)];
  const summary = matches.length > 0 ? matches[matches.length - 1][0] : '未取到段数';
  return { ok: res.status === 0, summary, out, ms: Date.now() - started };
}

// ---------------------------------------------------------------------------
// 通道
// ---------------------------------------------------------------------------

function pushOnce(route, refspec) {
  return runGit(['push', '--atomic', 'origin', refspec], {
    config: route.config,
    timeout: 180000,
  });
}

/**
 * 读远端分支 SHA。
 *
 * 刻意返回三态而不是布尔：`ok: false` 表示「读不到」（可能是网络，也可能是认证），
 * 与「读到了但不一样」是两件事。前者不能用来判定推送失败，只能判定「无法复核」。
 */
function remoteHead(route, branch) {
  const res = runGit(['ls-remote', 'origin', `refs/heads/${branch}`], {
    config: route.config,
    timeout: 30000,
  });
  if (!res.ok) return { ok: false, sha: null, detail: textOf(res) };

  const sha = res.stdout.trim().split(/\s+/)[0] ?? '';
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    return { ok: false, sha: null, detail: `ls-remote 输出无法解析：${res.stdout.trim()}` };
  }
  return { ok: true, sha, detail: '' };
}

/**
 * 通道体检：只读，不动任何 ref。用于「现在到底哪条路通」这类问题。
 * 这是本脚本里唯一与「不探活」原则表面冲突的地方——但 ls-remote 是**路线本身的
 * 真实请求**，不是额外的端口探测；铁律禁的是后者。
 */
function checkChannels(branch) {
  console.log('通道体检（只读，不改任何 ref）');
  let anyOk = false;

  for (const route of ROUTES) {
    const started = Date.now();
    const head = remoteHead(route, branch);
    const ms = Date.now() - started;

    if (head.ok) {
      anyOk = true;
      console.log(
        `  OK    路线 ${route.id}  ${route.label}  ${ms}ms  远端=${head.sha.slice(0, 8)}`,
      );
      continue;
    }

    const kind = classifyPush(head.detail);
    console.log(`  FAIL  路线 ${route.id}  ${route.label}  ${ms}ms  ${KIND_LABEL[kind]}`);
    const line = firstMeaningfulLine(head.detail);
    if (line) console.log(`        ${line}`);
  }

  if (!anyOk) {
    console.log('\n三条路线都没连上 GitHub，是不是没开加速器？');
    return EXIT.NO_ROUTE;
  }
  return EXIT.OK;
}

// ---------------------------------------------------------------------------
// 推送
// ---------------------------------------------------------------------------

function pushWithRoutes(branch, localHead, onlyRoute) {
  const refspec = `HEAD:refs/heads/${branch}`;
  const routes = onlyRoute ? ROUTES.filter((route) => route.id === onlyRoute) : ROUTES;

  for (const route of routes) {
    console.log(`  -> 路线 ${route.id}：${route.label}`);
    const res = pushOnce(route, refspec);
    const text = textOf(res);

    if (res.ok) return { ok: true, route, kind: 'ok', text };

    const kind = res.timedOut ? 'timeout' : classifyPush(text);

    // 分叉不是通道问题：换路线只会把同一件事重演三遍。立即停，交给上层报给人。
    if (kind === 'diverged') return { ok: false, route, kind, text };

    // 报文失败 ≠ 没送达。先用**同一条路线**复核，能读到且 SHA 一致就判定为已送达。
    const head = remoteHead(route, branch);
    if (head.ok && head.sha === localHead) {
      console.log('     报文失败但远端 SHA 已与本地一致：判定为已送达，不重推');
      return { ok: true, route, kind: 'landed', text };
    }

    console.log(`     失败（${KIND_LABEL[kind]}）`);
    const line = firstMeaningfulLine(text);
    if (line) console.log(`     ${line}`);
  }

  return { ok: false, kind: 'no-route', text: '' };
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n\n${USAGE}`);
    return EXIT.PRECONDITION;
  }

  if (opts.help) {
    console.log(USAGE);
    return EXIT.OK;
  }

  if (process.env.http_proxy && !process.env.http_proxy.includes(PROXY_URL.split(':').pop())) {
    console.log(
      `提示：环境变量 http_proxy=${process.env.http_proxy} 与脚本使用的 ${PROXY_URL} 不一致。` +
        '脚本已忽略环境变量，按显式指定的代理走。',
    );
  }

  // ---- 前置条件 -----------------------------------------------------------
  const top = runGit(['rev-parse', '--show-toplevel']);
  if (!top.ok) {
    console.error('当前目录不在 git 仓库内');
    return EXIT.PRECONDITION;
  }

  const branchRes = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const branch = branchRes.stdout.trim();
  if (!branchRes.ok || !branch || branch === 'HEAD') {
    console.error('无法确定当前分支（detached HEAD？先 checkout 到一个分支）');
    return EXIT.PRECONDITION;
  }

  const originRes = runGit(['remote', 'get-url', 'origin']);
  if (!originRes.ok) {
    console.error('没有名为 origin 的远程仓库');
    return EXIT.PRECONDITION;
  }

  const headRes = runGit(['rev-parse', 'HEAD']);
  const localHeadBefore = headRes.stdout.trim();

  if (opts.check) {
    return checkChannels(branch);
  }

  const changes = listChanges();
  if (!changes.ok) {
    console.error(`读取工作区状态失败：${changes.detail}`);
    return EXIT.PRECONDITION;
  }
  const changed = changes.entries.length > 0;

  // 无改动且无待推提交，直接收工，不烧 verify 的几分钟。
  const aheadRes = runGit(['rev-list', '--count', `origin/${branch}..HEAD`], { timeout: 60000 });
  const ahead = aheadRes.ok ? Number.parseInt(aheadRes.stdout.trim(), 10) || 0 : -1;
  if (!changed && ahead === 0 && !opts.tag) {
    console.log(`工作区干净，且 ${branch} 没有待推送的提交。无事可做。`);
    return EXIT.OK;
  }

  console.log(`分支 ${branch}，远程 ${originRes.stdout.trim()}`);
  console.log(`改动 ${changes.entries.length} 项，待推送提交 ${ahead < 0 ? '未知' : ahead} 个`);

  // ---- 安全扫描 -----------------------------------------------------------
  const scan = scanChanges(changes.entries);
  if (scan.warned.length > 0) {
    console.log('\n注意：以下文件偏大，确认是刻意入库：');
    for (const item of scan.warned) console.log(`  ${item}`);
  }
  if (scan.blocked.length > 0) {
    console.error('\n拒绝提交，以下路径命中安全白名单：');
    for (const item of scan.blocked) console.error(`  ${item}`);
    console.error('\n若确有需要，请手动处理（本脚本不提供绕过开关）。');
    return EXIT.PRECONDITION;
  }

  // ---- verify -------------------------------------------------------------
  if (opts.verify && (changed || ahead !== 0)) {
    console.log('\n[verify] 跑门禁（可能数分钟）');
    const verify = runVerify();
    if (!verify.ok) {
      console.error(verify.out);
      console.error(`\nverify 未通过：${verify.summary}（${verify.ms}ms）。已中止，未提交。`);
      return EXIT.VERIFY_FAILED;
    }
    console.log(`  通过：${verify.summary}（${verify.ms}ms）`);
  } else if (!opts.verify) {
    console.log('\n[verify] 已按 --no-verify 跳过');
  }

  // ---- 提交 ---------------------------------------------------------------
  const message = opts.message;

  if (opts.dryRun) {
    console.log('\n[dry-run] 计划如下，未执行任何写入：');
    if (changed) {
      console.log(`  add -A（${changes.entries.length} 项）`);
      console.log(`  commit -F -（消息${opts.message || opts.messageFile ? '已提供' : '未提供'}）`);
    }
    if (opts.push) console.log(`  push --atomic origin HEAD:refs/heads/${branch}`);
    if (opts.tag) console.log(`  push origin refs/tags/${opts.tag}`);
    return EXIT.OK;
  }

  if (changed) {
    if (!message && !opts.messageFile) {
      console.error('\n有改动但未提供提交消息。用 -m "..." 或 -F <文件>。');
      console.error('提交消息必须由人写：本仓的消息记录「坑在哪 + 为什么这么定」，不可机器生成。');
      return EXIT.PRECONDITION;
    }

    const addRes = runGit(['add', '-A'], { timeout: 120000 });
    if (!addRes.ok) {
      console.error(`git add 失败：${textOf(addRes)}`);
      return EXIT.PRECONDITION;
    }

    const commitArgs = ['commit'];
    if (opts.messageFile) {
      commitArgs.push('-F', resolve(ROOT, opts.messageFile));
    } else {
      commitArgs.push('-F', '-');
    }
    const commitRes = runGit(commitArgs, {
      timeout: 120000,
      input: opts.messageFile ? undefined : message,
    });
    if (!commitRes.ok) {
      console.error(`git commit 失败：${textOf(commitRes)}`);
      return EXIT.PRECONDITION;
    }
    const headLine = runGit(['log', '--oneline', '-1']).stdout.trim();
    console.log(`  已提交：${headLine}`);
  } else {
    console.log('\n没有新改动，跳过提交。');
  }

  const localHead = runGit(['rev-parse', 'HEAD']).stdout.trim();

  // ---- 推送 ---------------------------------------------------------------
  if (!opts.push) {
    console.log('\n已按 --no-push 跳过推送。');
    return EXIT.OK;
  }

  console.log('\n[push] 按序尝试路线');
  const result = pushWithRoutes(branch, localHead, opts.route);

  if (!result.ok) {
    if (result.kind === 'diverged') {
      console.error('\n远端有本地没有的提交（历史分叉）。换路线重试没有意义，需要人来决定：');
      console.error('  merge：git pull --no-rebase origin ' + branch + '（保留双方历史）');
      console.error('  rebase：git pull --rebase origin ' + branch + '（保持线性）');
      console.error('两种形状不可由脚本代选。处理完再跑一次本脚本。');
      const line = firstMeaningfulLine(result.text);
      if (line) console.error(`\n原始报错：${line}`);
      return EXIT.DIVERGED;
    }

    console.log('');
    if (opts.route) {
      console.error(`指定的路线 ${opts.route} 没通。去掉 --route 让它按 1→2→3 依次尝试。`);
    } else {
      console.error('三条路线都没连上 GitHub，是不是没开加速器？');
    }
    console.error('（已按 skill 铁律停止，不做进一步排查。开好加速器后重跑本脚本即可。）');
    return EXIT.NO_ROUTE;
  }

  console.log(`  推送完成（${KIND_LABEL[result.kind]}）`);

  // ---- 复核 ---------------------------------------------------------------
  const check = remoteHead(result.route, branch);
  if (!check.ok) {
    console.warn(
      `\n警告：推送报文成功，但复核读不到远端（${firstMeaningfulLine(check.detail)}）。`,
    );
    console.warn('提交大概率已送达，但本次无法证实。建议稍后单独跑 --check 复核。');
    return EXIT.REMOTE_MISMATCH;
  }
  if (check.sha !== localHead) {
    console.error(`\n复核不一致：远端 ${check.sha} ≠ 本地 ${localHead}`);
    return EXIT.REMOTE_MISMATCH;
  }
  console.log(`  复核通过：远端 ${branch} = ${check.sha.slice(0, 8)}`);

  // ---- 标签 ---------------------------------------------------------------
  if (opts.tag) {
    // `--follow-tags` 只认附注标签，轻量标签推不上去，故显式推 refs/tags/<name>。
    const tagRes = runGit(['push', 'origin', `refs/tags/${opts.tag}`], {
      config: result.route.config,
      timeout: 120000,
    });
    if (!tagRes.ok) {
      console.error(`标签 ${opts.tag} 推送失败：${firstMeaningfulLine(textOf(tagRes))}`);
      return EXIT.REMOTE_MISMATCH;
    }
    console.log(`  标签已推送：${opts.tag}`);
  }

  console.log(
    `\n完成：${branch} @ ${localHead.slice(0, 8)}（比出发时${localHeadBefore === localHead ? '未变' : '前进了 1 个提交'}）`,
  );
  return EXIT.OK;
}

process.exitCode = main();
