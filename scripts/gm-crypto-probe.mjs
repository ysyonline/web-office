/**
 * 国密能力启动自检探针（评审人产出，建议固化进应用启动断言与 CI）
 *
 * 目的：License 验签（SM2 + SM3）与口令派生（PBKDF2-HMAC-SM3）均依赖 Node 的
 *      OpenSSL 版本。发行版 Node 若链 OpenSSL 1.1.1 或裁剪版，算法可能缺失，
 *      表现为「启动不报错、激活时静默失败」。本探针把失败提前到启动期。
 *
 * 检查项：
 *   G1 摘要 sm3 可用
 *   G2 椭圆曲线 SM2 可用
 *   G3 SM2 自签自验通过（真跑一次签名+验签，非仅查表）
 *   G4 对称算法 sm4 可用（License 文件可选加密，非 MVP 必需，仅登记）
 *   G5 PBKDF2-HMAC-SM3 可用（口令派生，与 License 同一 OpenSSL 依赖）
 *
 * 运行：node scripts/gm-crypto-probe.mjs
 * 退出码：0 全通过 / 1 有失败项
 */
import crypto from 'node:crypto';

const results = [];
function record(id, name, pass, detail = '') {
  results.push({ id, name, pass });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${id} ${name}${detail ? ` -- ${detail}` : ''}`);
}

console.log(
  `Node ${process.version} / OpenSSL ${process.versions.openssl} / ${process.platform}-${process.arch}\n`,
);

// G1 sm3
const hasSm3 = crypto.getHashes().includes('sm3');
record('G1', 'digest sm3 可用', hasSm3);

// G2 SM2 curve
const hasSm2Curve = crypto.getCurves().includes('SM2');
record('G2', 'curve SM2 可用', hasSm2Curve);

// G3 SM2 自签自验
let g3 = false;
let g3Detail = '';
try {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'SM2' });
  const payload = Buffer.from('license-payload-probe');
  const sig = crypto.createSign('sm3').update(payload).sign(privateKey);
  g3 = crypto.createVerify('sm3').update(payload).verify(publicKey, sig);
  g3Detail = `sig=${sig.length}B`;
} catch (e) {
  g3Detail = e.message.split('\n')[0];
}
record('G3', 'SM2 自签自验通过', g3, g3Detail);

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

const failed = results.filter((r) => !r.pass);
console.log(`\n合计 ${results.length} 项，失败 ${failed.length} 项`);
if (failed.length) {
  console.log('启动断言应中止进程：' + failed.map((f) => f.id).join(', '));
  process.exit(1);
}
console.log('国密能力自检全通过');
