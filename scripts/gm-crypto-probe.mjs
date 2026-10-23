#!/usr/bin/env node
/**
 * 国密能力自检探针（评审人产出，已固化进 CI；v1.3 按 Q1 拍板扩为 G1~G8）。
 *
 * 目的：License 验签（SM2 + SM3）与口令派生（PBKDF2-HMAC-SM3）均依赖 Node 的
 *      OpenSSL 版本。发行版 Node 若链 OpenSSL 1.1.1 或裁剪版，算法可能缺失，
 *      表现为「启动不报错、激活时静默失败」。本探针把失败提前到启动期。
 *
 * 检查项（tier=启动 的三级任一失败必须拒绝启动，见 D1-11 ②）：
 *   G1 摘要 sm3 可用                                            [启动]
 *   G2 椭圆曲线 SM2 可用                                        [启动]
 *   G3 固定 fixture 验签（自签向量，承担**自洽**）                [启动]
 *   G4 对称算法 sm4 可用（License 文件可选加密，非 MVP 必需）     [CI]
 *   G5 PBKDF2-HMAC-SM3 可用（口令派生，与 License 同依赖）        [CI]
 *   G6 userId（distid）口径锁定：正确值验过、错值验不过           [CI]
 *   G7 DER 编码一致性：首字节 0x30 + 本仓解码器可解 + 重编码还原  [CI]
 *   G8 跨实现一致性：本仓签名可被 OpenSSL CLI 以标准 distid 验过  [CI，需 openssl CLI ≥3.x]
 *
 * 为什么 G3 从「自签自验」改为「固定 fixture 验签」（P0-1 教训）：
 *   自签自验只测自洽性不测互通性——Node 原生 crypto 的自签自验恒过，
 *   但与 GM/T 标准口径（含 ZA）完全不互通，正是它让 P0-1 假阳性。
 *
 * G3 / G8 的分工必须诚实（2026-10-23 第五轮审核 P1-3）：
 *   fixture 由本仓 issue-license.mjs 生成，属**自签向量**——G3 承担「自洽」
 *   （四口径没漂移、篡改必拒），**互通性由 G8 独家承担**（外部实现 OpenSSL CLI 验过）。
 *   不要把 G3 描述成「标准向量」，那等于把自洽证据当成互通证据，与 P0-1 同类。
 *
 * 运行：node scripts/gm-crypto-probe.mjs
 * 退出码：0 全通过（SKIP 不计失败） / 1 有失败项
 */
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import {
  SM2_DEFAULT_USER_ID,
  sm2VerifyOptions,
} from '../packages/shared/src/license/sm2-constants.ts';
import {
  decodeDerSignature,
  encodeDerSignature,
  issueLicense,
  publicKeyHexToPem,
} from './issue-license.mjs';

const require = createRequire(import.meta.url);
const { sm2 } = require('sm-crypto');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'scripts/fixtures/sm2-standard-vector.json');

const results = [];
/**
 * @param {string} id
 * @param {string} name
 * @param {boolean} pass
 * @param {string} [detail]
 * @param {'启动' | 'CI'} [tier]
 */
function record(id, name, pass, detail = '', tier = 'CI') {
  results.push({ id, name, pass, tier });
  console.log(
    `  [${pass ? 'PASS' : 'FAIL'}] ${id} ${name} [${tier}]${detail ? ` -- ${detail}` : ''}`,
  );
}

/** @param {string} id @param {string} name @param {string} detail */
function recordSkip(id, name, detail) {
  results.push({ id, name, pass: true, tier: 'CI', skipped: true });
  console.log(`  [SKIP] ${id} ${name} [CI] -- ${detail}`);
}

console.log(
  `Node ${process.version} / OpenSSL ${process.versions.openssl} / ${process.platform}-${process.arch}\n`,
);

// G1 sm3
const hasSm3 = crypto.getHashes().includes('sm3');
record('G1', 'digest sm3 可用', hasSm3, '', '启动');

// G2 SM2 curve
const hasSm2Curve = crypto.getCurves().includes('SM2');
record('G2', 'curve SM2 可用（仅登记；SM2 签验改走 sm-crypto）', hasSm2Curve, '', '启动');

// G3 标准向量验签（fixture 由 scripts/issue-license.mjs --gen-fixture 生成）
if (!existsSync(FIXTURE)) {
  record(
    'G3',
    '标准向量验签',
    false,
    `缺少 fixture ${FIXTURE}；先跑 node scripts/issue-license.mjs --gen-fixture`,
    '启动',
  );
} else {
  /** @type {{ publicKey: string, payload: string, signatureDerHex: string, userId: string }} */
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  let g3 = false;
  let g3Detail = '';
  try {
    const bytes = new TextEncoder().encode(fx.payload);
    g3 = sm2.doVerifySignature(bytes, fx.signatureDerHex, fx.publicKey, sm2VerifyOptions());
    g3Detail = `userId=${fx.userId} sigLen=${fx.signatureDerHex.length / 2}B`;
  } catch (e) {
    g3Detail = e.message.split('\n')[0];
  }
  record('G3', '固定 fixture 验签（自签向量，承担自洽）', g3, g3Detail, '启动');

  // 反断言（V-GM ①）：篡改 1 字节必须验不过，防 G3 退化成「只检查文件存在」
  if (g3) {
    const tampered = tamperHex(fx.signatureDerHex);
    const neg = sm2.doVerifySignature(
      new TextEncoder().encode(fx.payload),
      tampered,
      fx.publicKey,
      sm2VerifyOptions(),
    );
    record('G3-', 'fixture 验签反断言（篡改 1 字节必 FAIL）', neg === false, '负向用例', '启动');
  }
}

// G4 sm4
const sm4 = crypto.getCiphers().filter((c) => /^sm4/.test(c));
record('G4', 'cipher sm4 可用', sm4.length > 0, sm4.join(','));

// G5 PBKDF2-HMAC-SM3
let g5 = false;
let g5Detail = '';
try {
  const t0 = Date.now();
  const dk = crypto.pbkdf2Sync('probe-password', 'probe-salt', 100000, 32, 'sm3');
  g5 = dk.length === 32;
  g5Detail = `${Date.now() - t0}ms @100000轮`;
} catch (e) {
  g5Detail = e.message.split('\n')[0];
}
record('G5', 'PBKDF2-HMAC-SM3 可用', g5, g5Detail);

// G6 userId（distid）口径锁定：正确值验过、其他值验不过
if (existsSync(FIXTURE)) {
  /** @type {{ publicKey: string, payload: string, signatureDerHex: string }} */
  const fx = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const bytes = new TextEncoder().encode(fx.payload);
  const ok = sm2.doVerifySignature(bytes, fx.signatureDerHex, fx.publicKey, sm2VerifyOptions());
  const wrong = sm2.doVerifySignature(bytes, fx.signatureDerHex, fx.publicKey, {
    ...sm2VerifyOptions(),
    userId: `${SM2_DEFAULT_USER_ID.slice(0, 15)}9`,
  });
  record('G6', 'userId 口径锁定（正确验过）', ok === true, `userId=${SM2_DEFAULT_USER_ID}`);
  record('G6-', 'userId 口径锁定反断言（错值验不过）', wrong === false, '负向用例');
}

// G7 DER 编码一致性
try {
  const kp = sm2.generateKeyPairHex();
  const issued = issueLicense({ probe: 'der', n: 1 }, kp.privateKey);
  const firstByteOk = issued.signatureDerHex.startsWith('30');
  const { r, s } = decodeDerSignature(issued.signatureDerHex);
  const roundtrip = encodeDerSignature(r, s) === issued.signatureDerHex;
  record(
    'G7',
    'DER 一致性（首字节 0x30 + 解码器可解 + 重编码还原）',
    firstByteOk && roundtrip,
    `firstByte=${issued.signatureDerHex.slice(0, 2)} roundtrip=${roundtrip}`,
  );
  // 负向用例：手写拼接的 r‖s（128 字符 hex）不是 DER，解码器必须拒绝
  let rejected = false;
  try {
    decodeDerSignature(`${'0'.repeat(64)}${'1'.repeat(64)}`);
  } catch {
    rejected = true;
  }
  record('G7-', 'DER 一致性反断言（非 DER 产物被拒）', rejected, '负向用例');
} catch (e) {
  record('G7', 'DER 一致性', false, e.message.split('\n')[0]);
}

// G8 跨实现一致性。
//
// SKIP 判定必须是**能力探测**而非「命令是否存在」（2026-10-23 第五轮审核 P1-2）：
// `-rawin` 是 OpenSSL 3.x 才有的参数。信创基础镜像常带 1.1.1，若只判「openssl 能不能执行」，
// G8 不会 SKIP 而是走验签并必红，把「CI 可选项」变成「必红项」，误伤整条流水线。
const openssl = spawnSync('openssl', ['version'], { encoding: 'utf8' });
const opensslOut = `${openssl.stdout ?? ''}${openssl.stderr ?? ''}`.trim();
const majorMatch = /OpenSSL\s+(\d+)\./i.exec(opensslOut);
const opensslMajor = majorMatch ? Number(majorMatch[1]) : null;

if (openssl.status !== 0 || opensslMajor === null) {
  recordSkip('G8', 'OpenSSL CLI 交叉验签', '未检测到 openssl CLI（CI 可选项，互通性证据缺失）');
} else if (opensslMajor < 3) {
  recordSkip(
    'G8',
    'OpenSSL CLI 交叉验签',
    `${opensslOut}：-rawin 需 OpenSSL >= 3.0，1.1.1 走验签必红，故按能力探测 SKIP（CI 应固定 OpenSSL 3.x 以获得互通性证据）`,
  );
} else {
  try {
    const kp = sm2.generateKeyPairHex();
    const payload = { probe: 'cross-impl', n: 2 };
    const issued = issueLicense(payload, kp.privateKey);
    const dir = mkdtempSync(join(tmpdir(), 'wo-sm2-'));
    const msgFile = join(dir, 'msg.bin');
    const sigFile = join(dir, 'sig.der');
    const pubFile = join(dir, 'pub.pem');
    writeFileSync(msgFile, new TextEncoder().encode(issued.payload));
    writeFileSync(sigFile, Buffer.from(issued.signatureDerHex, 'hex'));
    writeFileSync(pubFile, publicKeyHexToPem(issued.publicKey));

    /**
     * 交叉验签。distid 传 **ASCII 原文**（OpenSSL 3.5 实测：传 hex 编码反而验不过）——
     * 它只是 CLI 侧的编码形式，四口径常量 SM2_DEFAULT_USER_ID 仍是 ASCII 字符串本身。
     * @param {string} sigHex
     */
    const verifyWithOpenssl = (sigHex) => {
      writeFileSync(sigFile, Buffer.from(sigHex, 'hex'));
      const res = spawnSync(
        'openssl',
        [
          'pkeyutl',
          '-verify',
          '-pubin',
          '-inkey',
          pubFile,
          '-rawin',
          '-digest',
          'sm3',
          '-pkeyopt',
          `distid:${SM2_DEFAULT_USER_ID}`,
          '-in',
          msgFile,
          '-sigfile',
          sigFile,
        ],
        { encoding: 'utf8' },
      );
      return {
        ok: res.status === 0,
        err: `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n')[0],
      };
    };

    const pos = verifyWithOpenssl(issued.signatureDerHex);
    record('G8', 'OpenSSL CLI 以标准 distid 验过本仓签名', pos.ok, pos.ok ? opensslOut : pos.err);
    // 负向断言必须以正向成功为前置（2026-10-23 第五轮审核 P1-1）：
    // openssl 因参数错误退出时 status 同样 != 0，负向会「恒真」——实证注入 OpenSSL 1.1.1k 时
    // 出现 G8 FAIL 而 G8- PASS 的荒谬组合，负向完全失去判别力。
    const neg = verifyWithOpenssl(tamperHex(issued.signatureDerHex));
    const g8NegPass = pos.ok && neg.ok === false;
    record(
      'G8-',
      'OpenSSL CLI 反断言（篡改签名验不过）',
      g8NegPass,
      g8NegPass
        ? '负向用例'
        : `正向未通过（${pos.err || '详见 G8'}）——负向断言无判别力，openssl 参数错误同样 status != 0`,
    );
  } catch (e) {
    record('G8', 'OpenSSL CLI 交叉验签', false, e.message.split('\n')[0]);
  }
}

/** @param {string} hex @returns {string} */
function tamperHex(hex) {
  const at = Math.floor(hex.length / 2);
  const flip = hex[at] === '0' ? '1' : '0';
  return `${hex.slice(0, at)}${flip}${hex.slice(at + 1)}`;
}

const failed = results.filter((r) => !r.pass);
const startupFailed = failed.filter((r) => r.tier === '启动');
const skipped = results.filter((r) => r.skipped);
console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项，跳过 ${skipped.length} 项`);
if (failed.length) {
  console.log('失败项：' + failed.map((f) => f.id).join(', '));
  if (startupFailed.length) {
    console.log('启动断言应中止进程：' + startupFailed.map((f) => f.id).join(', '));
  }
  process.exit(1);
}
console.log('国密能力自检全通过');
