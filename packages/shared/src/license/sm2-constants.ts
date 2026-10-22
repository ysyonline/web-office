/**
 * 国密 SM2 签验口径的唯一定义点。
 *
 * 出处：D1-11 ①「国密依赖面」表 + license/design.md §3.0「License 签发口径」四口径表
 *      + OPEN-DECISIONS 2026-10-23「Q2 拍板」条。
 *
 * 为什么必须是单一定义点：签发侧（scripts/issue-license.mjs）与验签侧
 * （服务端 evaluateLicense，D1-10 ② 判定链第②步）若各写一遍字面量，
 * 任一侧改口径另一侧**不会报错**，只会表现为「客户拿到的 License 全线验签失败」——
 * 这正是第三轮挑刺 P0-2 的形态。两侧一律 import 本文件，禁止在别处再写字面量。
 *
 * 本文件所在包 @wo/shared 的定位是「纯函数 + 常量」，无 React/Nest/univer/yjs 依赖；
 * canonical JSON 与常量均属纯逻辑，放这里可以让签验两侧共用同一份实现。
 */

/**
 * GM/T 0003.2 标准 userId（即 distid）。
 *
 * 注意 sm-crypto 的参数名是 **userId** 不是 id（0.5.x API 命名，写错会静默走默认值）。
 * 默认值恰好与本常量相同，但**必须显式传**：依赖库默认值等于把口径交给了上游。
 */
export const SM2_DEFAULT_USER_ID = '1234567812345678' as const;

/**
 * 摘要开关：true = SM2-with-SM3，且摘要含 ZA（GM/T 0003.2 的 Z = hash(ENTL ‖ userId ‖ a ‖ b ‖ Gx ‖ Gy ‖ Px ‖ Py)）。
 *
 * 关掉即退化为不含 ZA 的普通 ECDSA——那正是 Node 原生 crypto 的死法
 * （自签自验恒过，与 GM/T 标准口径完全不互通，P0-1 的假阳性来源）。禁止关闭。
 */
export const SM2_SIGN_HASH = true as const;

/**
 * 签名编码：标准 DER（SEQUENCE { INTEGER r, INTEGER s }）。
 *
 * 用 sm-crypto 内建 { der: true } 产出，**禁止手写 ASN.1 编码**。
 */
export const SM2_SIGN_DER = true as const;

/** 签名侧选项（sm-crypto doSignature 第三参）。 */
export function sm2SignOptions(): { hash: boolean; der: boolean; userId: string } {
  return { hash: SM2_SIGN_HASH, der: SM2_SIGN_DER, userId: SM2_DEFAULT_USER_ID };
}

/** 验签侧选项（sm-crypto doVerifySignature 第四参）。与签名侧同源，不得分叉。 */
export function sm2VerifyOptions(): { hash: boolean; der: boolean; userId: string } {
  return { hash: SM2_SIGN_HASH, der: SM2_SIGN_DER, userId: SM2_DEFAULT_USER_ID };
}

/**
 * canonical JSON 序列化（四口径第④条）。
 *
 * 规则：对象键按字典序递归排序；数组保序；**禁止浮点**（席位/有效期一律用整数 + ISO 字符串）；
 * NaN/Infinity 直接抛错。UTF-8 输出。
 *
 * 为什么不是可选的锦上添花：实测「同内容不同键序 → 验签失败」（键序进摘要），
 * 只要签发侧与验签侧的序列化顺序有半点不同，线上就是一次全线验签失败。
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

/** canonical JSON 的 UTF-8 字节序列。签名/验签一律以**字节**入参，避免 utf8ToHex 二次编码。 */
export function canonicalJsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJsonStringify(value));
}

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeCanonical(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) {
        throw new TypeError(
          `canonical JSON 禁止浮点（席位/有效期用整数 + ISO 字符串）：收到 ${String(value)}`,
        );
      }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => normalizeCanonical(item));
  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    out[key] = normalizeCanonical(source[key]);
  }
  return out;
}
