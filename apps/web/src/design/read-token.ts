/**
 * 设计令牌读取（V1.3.1 起）。
 *
 * 为什么需要它：`wo/no-hardcoded-color` 禁止 TS 里出现 `#hex` / `rgb()` 字面量，而 Univer 的
 * 单元格样式要的是**具体色值字符串**，不是 CSS 变量名。两侧夹击下只有三条路：
 * ① 用 `'yellow'` 这类具名色绕过规则——规则字母上放过，精神上正是它要防的事，不取；
 * ② 在 TS 里复制一份色板——两处真源，必然漂移，不取；
 * ③ **运行时从 `design-tokens.css` 的 CSS 变量取值**——唯一真源仍是令牌文件，取这条。
 *
 * 缺令牌时**抛错而非回退**：静默回退到透明会让「底色没生效」看起来像「本来就没这需求」。
 */

/** 读取 `:root` 上的设计令牌值（如 `--color-amber-50`）。令牌缺失即抛错。 */
export function readTokenColor(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!value) {
    throw new Error(`设计令牌 ${name} 未定义：检查 design-tokens.css 是否在入口最早处引入`);
  }
  return value;
}
