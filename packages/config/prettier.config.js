/**
 * Prettier 单一配置（P3-001 §5.2）。
 * packages/config 是唯一落点，根目录 prettier.config.js 只做再导出。
 *
 * @type {import('prettier').Config}
 */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [{ files: '*.md', options: { proseWrap: 'preserve' } }],
};
