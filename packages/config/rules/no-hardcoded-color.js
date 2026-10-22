/**
 * P0 规则：禁硬编码色值（P3-001 §5.2 ⑥）。
 *
 * 唯一色值真源是 `apps/web/src/design/tokens.ts` + `design-tokens.css`；
 * 源码里出现 #hex / rgb() / rgba() / hsl() / hsla() 即视为绕过设计令牌。
 * 本规则只扫字符串字面量与模板字符串片段；.css 不走 ESLint（CSS 侧由 tokens 文件自身承载）。
 *
 * 例外由 preset 以 files 级关闭：design/tokens.ts、测试文件（.test.ts）、fixture 目录。
 * 注意：块注释里不能写 glob——`星号星号斜杠` 会被当成注释结束符，本文件首次写就踩过一次。
 */

const HEX = /(^|[^\w&])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/;
const FUNC = /\b(?:rgba?|hsla?)\s*\(/;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止硬编码颜色值，必须使用设计令牌',
      recommended: true,
    },
    schema: [],
    messages: {
      color:
        '硬编码色值「{{value}}」必须改为设计令牌（apps/web/src/design/tokens.ts 或 design-tokens.css 的 CSS 变量）。',
    },
  },

  create(context) {
    /** @param {any} node @param {string} text */
    function check(node, text) {
      const hex = text.match(HEX);
      const fn = text.match(FUNC);
      const hit = fn ? fn[0].trim() : hex ? hex[0].trim().replace(/^[^\w#]+/, '') : null;
      if (!hit) return;
      // 透明与继承语义不是色值。
      if (/^transparent$|^currentcolor$/i.test(hit)) return;
      context.report({ node, messageId: 'color', data: { value: hit } });
    }

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

export default rule;
