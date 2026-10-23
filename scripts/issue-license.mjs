#!/usr/bin/env node
/**
 * License 离线签发 CLI（四口径锁定，与验签侧同源）。
 *
 * 出处：license/design.md §3.0「License 签发口径」+ OPEN-DECISIONS 2026-10-23「Q2 拍板」
 *      + D1-11 ①「国密依赖面」。四口径常量一律 import 自
 *      packages/shared/src/license/sm2-constants.ts（单一定义点，禁止本文件再写字面量）。
 *
 * 四口径（签发与验签两侧必须完全一致）：
 *   ① 算法    SM2-with-SM3 且摘要含 ZA（sm-crypto doSignature 的 hash 开关不得关）
 *   ② userId  1234567812345678（GM/T 0003.2 标准值；sm-crypto 参数名 userId 不是 id）
 *   ③ 编码    标准 DER（由 sm-crypto 内建 { der: true } 产出，禁止手写 ASN.1 编码）
 *   ④ 载荷    canonical JSON（键字典序递归排序、UTF-8、禁浮点）
 *
 * 用法：
 *   node scripts/issue-license.mjs --payload-file license.json --out license.issued.json
 *   node scripts/issue-license.mjs --payload '{"seats":50}' --key-file /secure/vendor.key
 *   node scripts/issue-license.mjs --gen-fixture            # 生成 G3 固定向量 fixture（临时密钥）
 *   node scripts/issue-license.mjs --gen-keypair --out-key-file /secure/vendor.key
 *
 * 私钥来源（按优先级）：--key-file <path> > 环境变量 WO_LICENSE_PRIVATE_KEY。
 * 私钥不入库、不进镜像、不进 CI 日志；本脚本默认**拒绝**把私钥打印到 stdout/stderr
 * （R1 强制约束：检测到私钥内容出现在输出流即退出码 2 且不产出任何内容）。
 *
 * 退出码：0 成功 / 1 用法或校验失败 / 2 私钥泄漏拦截。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

import {
  SM2_DEFAULT_USER_ID,
  canonicalJsonBytes,
  canonicalJsonStringify,
  sm2SignOptions,
} from '../packages/shared/src/license/sm2-constants.ts';

const require = createRequire(import.meta.url);
const { sm2 } = require('sm-crypto');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FIXTURE = resolve(ROOT, 'scripts/fixtures/sm2-standard-vector.json');

/** @type {string | null} 当前会话的私钥（仅用于输出流泄漏自检，不参与输出）。 */
let ACTIVE_PRIVATE_KEY = null;

/**
 * 输出流守卫（R1）：私钥一旦出现在 stdout/stderr 就拒绝执行。
 * @param {string} text
 */
function emit(text) {
  if (ACTIVE_PRIVATE_KEY && text.includes(ACTIVE_PRIVATE_KEY)) {
    process.stderr.write(
      '[license] 拒绝执行：待输出内容包含私钥（R1：私钥不得进日志/终端）。已中止，未产出任何内容\n',
    );
    process.exit(2);
  }
  process.stdout.write(text);
}

/** @param {string} hex @returns {number[]} */
export function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error(`hex 长度必须为偶数：${hex.length}`);
  const out = [];
  for (let i = 0; i < hex.length; i += 2) out.push(Number.parseInt(hex.slice(i, i + 2), 16));
  return out;
}

/** @param {number[]} bytes @returns {string} */
export function bytesToHex(bytes) {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * DER 长度域解析（严格：禁止 indefinite 长度与非最小编码的长形式）。
 * @param {number[]} b
 * @param {number} pos
 * @returns {{ length: number, next: number }}
 */
function readDerLength(b, pos) {
  if (pos >= b.length) throw new Error('DER 长度域越界');
  const first = b[pos];
  if (first < 0x80) return { length: first, next: pos + 1 };
  if (first === 0x80) throw new Error('DER 不允许 indefinite 长度（0x80）');
  const count = first & 0x7f;
  if (count > 2) throw new Error(`DER 长度域过长（${count} 字节）`);
  if (pos + 1 + count > b.length) throw new Error('DER 长度域越界');
  let length = 0;
  for (let i = 1; i <= count; i += 1) length = length * 256 + b[pos + i];
  if (length < 0x80) throw new Error('DER 长形式不得用于可短形式表示的长度');
  return { length, next: pos + 1 + count };
}

/**
 * 解码 SM2 签名 DER（SEQUENCE { INTEGER r, INTEGER s }）。
 *
 * 用途：G7「DER 编码一致性」断言——本仓签发产物必须能被本解码器严格解开。
 * 注意本函数只做**校验侧**解码与重编码比对；签名产物一律由 sm-crypto {der:true} 产出。
 *
 * @param {string} derHex
 * @returns {{ r: bigint, s: bigint }}
 */
export function decodeDerSignature(derHex) {
  const b = hexToBytes(derHex);
  let pos = 0;
  if (b[pos] !== 0x30)
    throw new Error(`DER 首字节应为 0x30（SEQUENCE），实为 0x${b[0].toString(16)}`);
  const outer = readDerLength(b, pos + 1);
  pos = outer.next;
  if (outer.length !== b.length - pos) throw new Error('DER SEQUENCE 长度与实际内容长度不一致');

  /** @returns {bigint} */
  const readInteger = () => {
    if (pos >= b.length) throw new Error('DER 缺少 INTEGER 成员');
    if (b[pos] !== 0x02)
      throw new Error(`DER INTEGER tag 应为 0x02，实为 0x${b[pos].toString(16)}`);
    const len = readDerLength(b, pos + 1);
    const start = len.next;
    const end = start + len.length;
    if (end > b.length) throw new Error('DER INTEGER 越界');
    const content = b.slice(start, end);
    if (content.length === 0) throw new Error('DER INTEGER 内容为空');
    if (content[0] === 0x00 && (content.length === 1 || content[1] < 0x80)) {
      throw new Error('DER INTEGER 存在非最小编码的多余前导 0x00');
    }
    if (content[0] & 0x80) throw new Error('DER INTEGER 为负数（r/s 必须为正）');
    pos = end;
    return BigInt(`0x${bytesToHex(content)}`);
  };

  const r = readInteger();
  const s = readInteger();
  if (pos !== b.length) throw new Error('DER 尾部存在多余字节');
  return { r, s };
}

/**
 * 把 r/s 重新编码为 DER（**仅用于 G7 的解码-重编码一致性校验**）。
 * @param {bigint} r
 * @param {bigint} s
 * @returns {string}
 */
export function encodeDerSignature(r, s) {
  /** @param {bigint} v @returns {number[]} */
  const integer = (v) => {
    let hex = v.toString(16);
    if (hex.length % 2 !== 0) hex = `0${hex}`;
    let content = hexToBytes(hex);
    if (content[0] & 0x80) content = [0x00, ...content];
    return [0x02, content.length, ...content];
  };
  const body = [...integer(r), ...integer(s)];
  const lengthBytes = body.length < 0x80 ? [body.length] : [0x81, body.length];
  return bytesToHex([0x30, ...lengthBytes, ...body]);
}

/**
 * 裸点 hex 公钥（130 字符、04 前缀）→ SPKI PEM（供 OpenSSL CLI 验签，G8 用）。
 *
 * 这里拼的是 SubjectPublicKeyInfo 包装（id-ecPublicKey + SM2 曲线 OID + BIT STRING），
 * 不涉及签名编码；四口径第③条的「禁止手写 ASN.1」约束对象是**签名** DER。
 *
 * @param {string} publicKeyHex
 * @returns {string}
 */
export function publicKeyHexToPem(publicKeyHex) {
  if (!/^04[0-9a-fA-F]{128}$/.test(publicKeyHex)) {
    throw new Error('公钥必须是 130 字符裸点 hex 且以 04 开头');
  }
  const algId = [
    0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x81, 0x1c,
    0xcf, 0x55, 0x01, 0x82, 0x2d,
  ];
  const point = hexToBytes(publicKeyHex);
  // BIT STRING 内容 = 1 字节 unused-bits(0x00) + 65 字节未压缩点 = 66（0x42）
  const bitString = [0x03, 0x42, 0x00, ...point];
  const spki = [0x30, 0x59, ...algId, ...bitString];
  const b64 = Buffer.from(spki).toString('base64');
  const wrapped = b64.match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----\n`;
}

/**
 * 签发：canonical JSON 载荷 → SM2 签名（DER，base64 落盘）。
 * @param {unknown} payload
 * @param {string} privateKeyHex
 * @returns {{ alg: string, userId: string, payload: string, signature: string, signatureDerHex: string, publicKey: string }}
 */
export function issueLicense(payload, privateKeyHex) {
  const canonical = canonicalJsonStringify(payload);
  const bytes = canonicalJsonBytes(payload);
  const publicKey = sm2.getPublicKeyFromPrivateKey(privateKeyHex);
  const derHex = sm2.doSignature(bytes, privateKeyHex, sm2SignOptions());
  if (typeof derHex !== 'string' || !derHex.startsWith('30')) {
    throw new Error(`签名产物不是标准 DER（首字节应 30）：${String(derHex).slice(0, 16)}`);
  }
  // 自检：产物必须能被本仓 DER 解码器严格解开，且解码-重编码可还原同一串
  const { r, s } = decodeDerSignature(derHex);
  const reencoded = encodeDerSignature(r, s);
  if (reencoded !== derHex) throw new Error('DER 重编码与产物不一致（编码非规范）');

  return {
    alg: 'SM2-with-SM3(ZA)/DER',
    userId: SM2_DEFAULT_USER_ID,
    payload: canonical,
    signature: Buffer.from(derHex, 'hex').toString('base64'),
    signatureDerHex: derHex,
    publicKey,
  };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

/** @param {string} message */
function usageError(message) {
  process.stderr.write(`[license] ${message}\n`);
  process.stderr.write('用法见 scripts/issue-license.mjs 头部注释\n');
  process.exit(1);
}

/**
 * @param {string} privateKeyHex
 * @returns {void}
 */
function assertPrivateKeyShape(privateKeyHex) {
  if (!/^[0-9a-fA-F]{64}$/.test(privateKeyHex)) {
    usageError('私钥必须是 64 字符 hex（SM2 私钥 32 字节）');
  }
}

/** @param {string[]} argv */
function main(argv) {
  const args = parseArgs(argv);

  if (args['gen-keypair']) {
    const kp = sm2.generateKeyPairHex();
    // 私钥一生成就进入泄漏自检范围：任何把它写进 stdout/stderr 的尝试都会被 emit() 拦下（R1）
    ACTIVE_PRIVATE_KEY = kp.privateKey;

    // --out-key-file：私钥落文件而非输出流（2026-10-23 第五轮审核 P2 修复）。
    // 原设计只留了 --print-private-key，而该分支必然被 R1 拦成 exit 2 —— 等于「能生成密钥但拿不到私钥」，
    // 签发者只能绕开本脚本。落文件既满足 R1（不进日志/终端），又让工具真正可用。
    if (args['out-key-file']) {
      const keyFile = resolve(ROOT, args['out-key-file']);
      mkdirSync(dirname(keyFile), { recursive: true });
      // mode 在 Windows 下不生效，仅 POSIX 有效；两侧都不依赖它作为唯一防线。
      writeFileSync(keyFile, `${kp.privateKey}\n`, { encoding: 'utf8', mode: 0o600 });
      emit(
        `${JSON.stringify(
          {
            publicKey: kp.publicKey,
            privateKeyFile: relative(ROOT, keyFile) || keyFile,
          },
          null,
          2,
        )}\n`,
      );
      emit(
        `私钥已写入文件（POSIX 下权限 600），**未进输出流**（R1 通过）。` +
          `该文件严禁入库：确认其路径被 .gitignore 覆盖，生产私钥一律走 --key-file。\n`,
      );
      return;
    }

    emit(`${JSON.stringify({ publicKey: kp.publicKey }, null, 2)}\n`);
    if (args['print-private-key'] === 'true') {
      // 故意走到这里会被守卫拦下并 exit 2——保留该分支就是为了让 R1 断言有可演示的 fail 条件
      emit(`${kp.privateKey}\n`);
    }
    emit(
      '私钥未打印（需要私钥请加 --out-key-file <path> 落文件；生产私钥一律走 --key-file；' +
        '强行打印会触发 R1 泄漏拦截并 exit 2）\n',
    );
    return;
  }

  if (args['gen-fixture']) {
    // G3 标准向量：临时密钥现场生成，私钥不出进程、不入 fixture。
    const kp = sm2.generateKeyPairHex();
    ACTIVE_PRIVATE_KEY = kp.privateKey;
    const payload = {
      licenseId: 'fixture-0001',
      machineFingerprint: 'fixture-fingerprint-hex',
      seats: 50,
      issuedAt: '2026-10-23T00:00:00.000Z',
      expiresAt: '2027-10-23T00:00:00.000Z',
      rebindLimit: 2,
    };
    const issued = issueLicense(payload, kp.privateKey);
    const fixture = {
      note: 'G3 标准向量 fixture：由 scripts/issue-license.mjs --gen-fixture 生成，仅用于验签断言，不可用于生产',
      generatedBy: 'scripts/issue-license.mjs',
      alg: issued.alg,
      userId: issued.userId,
      publicKey: issued.publicKey,
      payload: issued.payload,
      signatureDerHex: issued.signatureDerHex,
    };
    const out = args.out ? resolve(ROOT, args.out) : DEFAULT_FIXTURE;
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
    emit(`fixture 已写入 ${out}（公钥 ${issued.publicKey.slice(0, 10)}...，私钥未落盘）\n`);
    return;
  }

  // 正常签发
  let privateKeyHex = '';
  if (args['key-file']) {
    privateKeyHex = readFileSync(resolve(ROOT, args['key-file']), 'utf8').trim();
  } else if (process.env.WO_LICENSE_PRIVATE_KEY) {
    privateKeyHex = process.env.WO_LICENSE_PRIVATE_KEY.trim();
  } else {
    usageError('缺少私钥：用 --key-file <path> 或环境变量 WO_LICENSE_PRIVATE_KEY 提供');
  }
  assertPrivateKeyShape(privateKeyHex);
  ACTIVE_PRIVATE_KEY = privateKeyHex;

  let payload;
  if (args['payload-file']) {
    payload = JSON.parse(readFileSync(resolve(ROOT, args['payload-file']), 'utf8'));
  } else if (args.payload) {
    payload = JSON.parse(args.payload);
  } else {
    usageError('缺少载荷：用 --payload-file <path> 或 --payload <json> 提供');
  }

  const issued = issueLicense(payload, privateKeyHex);
  const text = `${JSON.stringify(issued, null, 2)}\n`;
  if (args.out) {
    const out = resolve(ROOT, args.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text, 'utf8');
    emit(`已签发并写入 ${out}\n`);
    return;
  }
  emit(text);
}

const invoked = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (invoked && import.meta.url === invoked) {
  main(process.argv.slice(2));
}
