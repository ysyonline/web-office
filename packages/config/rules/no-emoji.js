/**
 * P0 规则：禁 emoji（P3-001 §5.2 ⑥）。
 *
 * 适用范围：字符串字面量（含模板字符串）与注释。项目交付界面与代码文本一律不使用 emoji——
 * 不可控的字体回退、与设计要求无关的色彩、以及日志/错误信息里出现无法 grep 的字符。
 * Markdown 与 .css 不走 ESLint（由 scripts/check-docs-constraints.mjs 覆盖，见 P3-037）。
 *
 * 实现取舍一：扫「解码后的值」而不是源码原文。
 *   `"\u{1F600}"` 在源码里是 12 个 ASCII 字符，但运行时就是 emoji。只扫原文会放过这种写法，
 *   而它恰恰是最容易被「顺手改回」的一处（正则/转义写法的 emoji 更隐蔽）。
 * 实现取舍二：逐字符报错而不是「命中即返回」——一盏红灯后面藏着 20 处待修时要修 N 轮。
 */

/**
 * 判断单个码位是否属于「呈现为 emoji」的区段。
 * @param {number} cp
 * @param {string} ch
 */
function isEmoji(cp, ch) {
  // U+FE0E 是文本呈现选择符：显式要求按文字渲染，不构成 emoji，放行。
  if (cp === 0xfe0e) return false;
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true; // 区域旗标
  return /\p{Extended_Pictographic}/u.test(ch);
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在源码字符串与注释中出现 emoji 字符',
      recommended: true,
    },
    schema: [],
    messages: {
      emoji: '源码不得使用 emoji（发现 {{char}}，U+{{code}}）；需要强调请用文字或样式表达。',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    /**
     * @param {any} node
     * @param {string} text
     */
    function scan(node, text) {
      for (let i = 0; i < text.length;) {
        const cp = text.codePointAt(i);
        if (cp === undefined) break;
        const ch = String.fromCodePoint(cp);
        const next = i + ch.length;
        if (isEmoji(cp, ch)) {
          context.report({
            node,
            messageId: 'emoji',
            data: { char: ch, code: cp.toString(16).toUpperCase().padStart(4, '0') },
          });
        }
        i = next;
      }
    }

    return {
      Literal(node) {
        // 正则字面量里的 \u{1F600} 是模式而不是文本，不在此规则辖区。
        if (node.regex) return;
        if (typeof node.value !== 'string') return;
        scan(node, node.value);
      },
      TemplateElement(node) {
        scan(node, node.value.cooked ?? node.value.raw);
      },
      'Program:exit'() {
        for (const comment of sourceCode.getAllComments()) scan(comment, comment.value);
      },
    };
  },
};

export default rule;
