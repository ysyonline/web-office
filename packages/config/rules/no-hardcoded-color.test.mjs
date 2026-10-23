/**
 * RuleTester 用例（禁硬编码色值）。
 *
 * 反向覆盖是本文件的主要价值：`#fff` / `rgba(...)` / `hsl(...)` 三种写法都必须被抓到，
 * 否则「唯一色值真源」只是文档承诺。
 *
 * 运行：node --test packages/config/rules
 */
import { RuleTester } from 'eslint';
import rule from './no-hardcoded-color.js';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
});

ruleTester.run('no-hardcoded-color', rule, {
  valid: [
    { code: 'const color = tokens.brand.primary;' },
    { code: 'const cls = "text-primary bg-surface";' },
    { code: 'const s = "transparent";' },
    { code: 'const c = "currentColor";' },
    // 非色值的 # 用法（选择器字符串）不应被误伤
    { code: 'const sel = "#main table";' },
    { code: 'const n = 42;' },
  ],
  invalid: [
    {
      code: 'const c = "#fff";',
      errors: [{ messageId: 'color', data: { value: '#fff' } }],
    },
    {
      code: 'const c = "#1f2937";',
      errors: [{ messageId: 'color', data: { value: '#1f2937' } }],
    },
    {
      code: 'const c = `background: ${"rgba(0,0,0,.5)"}`;',
      errors: [{ messageId: 'color' }],
    },
    {
      code: 'const c = "hsl(210 40% 96%)";',
      errors: [{ messageId: 'color' }],
    },
    {
      // 一处代码里两个硬编码色值 → 两条报错
      code: 'const a = "#000"; const b = "rgb(1,2,3)";',
      errors: [{ messageId: 'color' }, { messageId: 'color' }],
    },
  ],
});
