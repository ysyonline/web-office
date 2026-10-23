/**
 * RuleTester 用例（P3-001 §5.2 ⑥：规则自己写错是最致命的失效模式）。
 *
 * 断言方向必须是双向的：
 *  - valid 段证明「正常代码不报错」——防规则过宽把工程卡死；
 *  - invalid 段证明「确实会报错且数量/位置正确」——防规则恒真（P0 悄悄漏网）。
 *
 * 运行：node --test packages/config/rules
 */
import { RuleTester } from 'eslint';
import rule from './no-emoji.js';

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
});

ruleTester.run('no-emoji', rule, {
  valid: [
    { code: 'const label = "保存";' },
    { code: 'const ok = "PASS / FAIL";' },
    // U+FE0E 是文本呈现选择符，不构成 emoji 呈现
    { code: 'const vs = "\\uFE0E";' },
    // 中文标点与被引用的字符不算
    { code: 'const s = "「引号」与｜竖线";' },
    // 正则字面量里是模式，不是文本
    { code: 'const re = /\\u{1F600}/u;' },
  ],
  invalid: [
    {
      code: 'const s = "\\u{1F600}";',
      errors: [{ messageId: 'emoji' }],
    },
    {
      code: 'const s = "保存成功 \\u2705";',
      errors: [{ messageId: 'emoji' }],
    },
    {
      // 两处 emoji 应报两次，验证不是「只报第一处就停」
      code: 'const a = "\\u{1F600}"; const b = "\\u{1F680}";',
      errors: [{ messageId: 'emoji' }, { messageId: 'emoji' }],
    },
    {
      // 注释也在辖区内：注释里的 emoji 同样进不了 grep
      // 用运行时构造而不是把真 emoji 写进本文件：否则这条 P0 规则会抓到自己
      code: '// 完成 ' + String.fromCodePoint(0x1f680) + '\nconst x = 1;',
      errors: [{ messageId: 'emoji' }],
    },
    {
      // 模板字符串
      code: 'const t = `保存' + String.fromCodePoint(0x1f4be) + '`;',
      errors: [{ messageId: 'emoji' }],
    },
  ],
});
