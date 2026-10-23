/**
 * ESLint flat preset 单一落点（P3-001 §5.2 ⑥）。
 *
 * 接口签名（下游包按此引用，改动即视为破坏性变更）：
 *   woPreset({ typeAware?: boolean, withReact?: boolean, tsconfigRootDir?: string }) => LintConfig[]
 *   BANNED_ICON_SOURCES: readonly string[]
 *   WO_RULE_NAMES（由 ./rules/index.js 再导出）
 *
 * 设计约束：
 * - 只用 flat config（ESLint 9 起唯一可得形态；10 起旧格式彻底移除）。
 * - 三条 P0 一律 error：wo/no-emoji、wo/no-hardcoded-color、no-restricted-imports（图标唯一）。
 * - typeAware=true 时才启用需要类型信息的规则（no-floating-promises 等）——它要求被检查的
 *   文件已在某个 tsconfig 的 include 内，故由调用方按「后端骨架已就绪」的时机打开（P3-011）。
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import { woPlugin, WO_RULE_NAMES } from './rules/index.js';

export { WO_RULE_NAMES };

/** 图标唯一来源：这些包一律不得出现在 import 里（P3-001 §5.2 ⑥「图标唯一」）。 */
export const BANNED_ICON_SOURCES = Object.freeze([
  '@ant-design/icons',
  '@douyinfe/semi-icons',
  'react-icons',
  'heroicons',
  '@heroicons/react',
  'phosphor-react',
  '@phosphor-icons/react',
  '@tabler/icons',
  '@tabler/icons-react',
  '@radix-ui/react-icons',
]);

const TS_FILES = ['**/*.{ts,tsx,mts,cts}'];
const JS_FILES = ['**/*.{js,mjs,cjs,jsx}'];
const ALL_FILES = [...TS_FILES, ...JS_FILES];

const iconRule = [
  'error',
  {
    paths: [],
    patterns: [
      {
        group: BANNED_ICON_SOURCES.map((s) => `${s}*`),
        message: '图标唯一来源：不得引入第二图标库（P3-001 §5.2 ⑥）。',
      },
    ],
  },
];

const prettierOff = Array.isArray(prettierConfig) ? prettierConfig : [prettierConfig];

/** React 插件 v7 的 flat 预设，取不到时退回显式规则（避免预设形态差异导致白屏式失效）。 */
const reactFlat = react.configs?.flat?.recommended ?? {
  plugins: { react },
  rules: {
    'react/jsx-uses-vars': 'error',
    'react/jsx-key': 'error',
    'react/no-unescaped-entities': 'error',
  },
};

const reactJsxRuntime = react.configs?.flat?.['jsx-runtime'] ?? {
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
  },
};

/**
 * @param {object} [options]
 * @param {boolean} [options.typeAware] 启用需类型信息的规则（要求文件已入 tsconfig）
 * @param {boolean} [options.withReact] 启用 React 段
 * @param {string} [options.tsconfigRootDir] 类型感知时的 tsconfig 根目录，默认 process.cwd()
 * @returns {import('eslint').Linter.Config[]}
 */
export function woPreset({ typeAware = false, withReact = true, tsconfigRootDir } = {}) {
  return [
    {
      name: 'wo/ignores',
      ignores: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/.pnpm-store/**',
        '**/*.tsbuildinfo',
        'docs/**',
        'spike/**',
        '.workbuddy/**',
      ],
    },
    {
      name: 'wo/base',
      files: ALL_FILES,
      languageOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
      plugins: { wo: woPlugin },
      rules: {
        ...js.configs.recommended.rules,
        // 三条 P0（error，`pnpm lint` 带 --max-warnings=0）
        'wo/no-emoji': 'error',
        'wo/no-hardcoded-color': 'error',
        'no-restricted-imports': iconRule,
        'no-console': ['warn', { allow: ['warn', 'error'] }],
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'no-var': 'error',
        'prefer-const': 'error',
      },
    },
    {
      name: 'wo/typescript',
      files: TS_FILES,
      // parser 必须显式挂：espree 不认 TS 语法（枚举/装饰器/类型标注一律 parse error）。
      languageOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2023,
        sourceType: 'module',
      },
      plugins: { '@typescript-eslint': tseslint.plugin },
      rules: {
        ...tseslint.configs.recommended
          .filter((c) => c.rules)
          .reduce((acc, c) => ({ ...acc, ...c.rules }), {}),
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
      },
    },
    {
      name: 'wo/node-scripts',
      // 仓库脚本与构建期脚本跑在 Node 里：给 node 全局，并允许直接打印
      // （CLI 脚本的输出就是它的接口，用 no-console 限制它只会逼出 eslint-disable）。
      files: [
        'scripts/**/*.{js,mjs,cjs,ts}',
        '**/scripts/**/*.{js,mjs,cjs}',
        '**/*.config.{js,mjs,cjs,ts}',
      ],
      languageOptions: { globals: { ...globals.node } },
      rules: { 'no-console': 'off' },
    },
    {
      name: 'wo/config-package',
      files: ['packages/config/**/*.js'],
      languageOptions: { globals: { ...globals.node } },
    },
    // 设计令牌与测试夹具是色值的合法出现地：按文件关闭（不是降级为 warn）。
    {
      name: 'wo/color-token-allowlist',
      files: [
        '**/design/tokens.ts',
        '**/design-tokens.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.test.mjs',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.spec.mjs',
        '**/fixtures/**',
        '**/test/**',
      ],
      rules: { 'wo/no-hardcoded-color': 'off' },
    },
    ...(withReact
      ? [
          {
            name: 'wo/react',
            files: ['apps/web/**/*.{tsx,jsx,ts}'],
            ...reactFlat,
            plugins: { ...reactFlat.plugins, 'react-hooks': reactHooks },
            settings: { react: { version: '18.3' } },
            languageOptions: {
              ...reactFlat.languageOptions,
              globals: { ...globals.browser },
              parserOptions: { ecmaFeatures: { jsx: true } },
            },
            rules: {
              ...reactFlat.rules,
              ...reactJsxRuntime.rules,
              'react-hooks/rules-of-hooks': 'error',
              'react-hooks/exhaustive-deps': 'error',
            },
          },
          {
            name: 'wo/web-scripts',
            files: ['apps/web/**/*.{ts,tsx}'],
            languageOptions: { globals: { ...globals.browser } },
          },
        ]
      : []),
    ...(typeAware
      ? [
          {
            name: 'wo/type-aware-server',
            files: ['apps/server/**/*.ts'],
            languageOptions: {
              parserOptions: {
                projectService: true,
                tsconfigRootDir: tsconfigRootDir ?? process.cwd(),
              },
            },
            rules: {
              // WS 广播/落库 Promise 未处理是本项目高危静默缺失（P3-001 §5.2）。
              '@typescript-eslint/no-floating-promises': 'error',
              '@typescript-eslint/no-misused-promises': 'error',
            },
          },
          {
            name: 'wo/entity-dto-relax',
            files: ['apps/server/**/*.{entity,dto}.ts'],
            rules: {
              '@typescript-eslint/no-non-null-assertion': 'off',
              '@typescript-eslint/no-explicit-any': 'off',
            },
          },
        ]
      : []),
    ...prettierOff,
  ];
}

export default woPreset;
