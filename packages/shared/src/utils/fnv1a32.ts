/**
 * fnv1a32：确定性 32 位哈希，用于协同场景下「同一 userId 恒定同色/同光标」的取值。
 *
 * 纯函数、无依赖、跨端一致（前后端必须算出同一个值，否则两端配色错位）。
 * 取舍：FNV-1a 而非 murmur（无 64 位乘法截断问题、实现 4 行、可逐位复核）。
 */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a32(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  // 按 UTF-8 字节而非 UTF-16 码元，避免同一中文 ID 在两端算出不同值。
  const bytes = new TextEncoder().encode(input);
  for (const byte of bytes) {
    hash ^= byte;
    // Math.imul 保证 32 位乘法不丢精度（普通 * 会越过 2^53 安全整数）。
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
