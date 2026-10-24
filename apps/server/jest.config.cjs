/**
 * @wo/server 测试装配（P3-011-01 工具链落位）。
 *
 * 本文件此刻只承担一件事：让 `jest` 在本包内**可启动**（零用例亦 exit=0），
 * 证明 Nest 运行期依赖与测试四件套装配成立。用例内容归 P3-011-04（管道四条分流）
 * 与 P3-011-05（夹具），本包不写断言。
 *
 * 两处刻意选择：
 *
 * 1. `moduleNameMapper` 把 `@wo/shared` 指向 **src** 而非包 `exports`。包 `exports.require`
 *    指 `dist/cjs/index.js`，而 `dist/` 是构建产物且未入库——直接解析会在干净 clone 上
 *    报 MODULE_NOT_FOUND。此映射与 `apps/server/tsconfig.json` 的 `paths` 同源，
 *    是同一决定在两个消费面的一致表达（理由见 ANCHORS §2 的 P3-010-03 行）。
 *    第二条映射：shared 源码的相对 import 带 `.js` 后缀（verbatimModuleSyntax 要求，
 *    见 packages/shared/src/schemas/common.ts 写法约束），而本包 tsconfig 是
 *    moduleResolution Node10、jest-resolve 亦不做 `.js`→`.ts` 映射——P3-011-03 落
 *    schemas 后 jest 首次真正加载 shared 源码即爆 MODULE_NOT_FOUND
 *    （`./utils/fnv1a32.js`）。把 `(.+)\\.js$` 映到 `$1.ts` 是同一「类型走 src」决定
 *    在相对路径上的补全。
 *
 * 2. 不设 `passWithNoTests`。零用例时 `jest` 应当红——「还没写测试」是有用信号；
 *    而本包的收口断言用的是 `--listTests`（只证明装配可启动），两者职责不同。
 *
 * @type {import('jest').Config}
 */
const path = require('node:path');

module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: path.join(__dirname, 'tsconfig.json') }],
  },
  moduleNameMapper: {
    '^@wo/shared$': path.join(__dirname, '../../packages/shared/src/index.ts'),
    // 仅约束 shared 目录内的相对 .js import；全局 `^\./` 会误吞 node_modules 内部
    // 的相对导入（react-is 的 ./cjs/react-is.development.js 实测被误映射）。
    // jest-resolve 按「请求 specifier 原文」匹配（不看请求方文件位置），shared 内部
    // 的相对导入请求原文就是 `./xxx.js` —— 与 node_modules 内部无法按 specifier 区分，
    // 所以用 customExportName 不可行，改为「先映射、映射目标不存在时回退原样」：
    // jest 的 moduleNameMapper 无回退语义，故第二条用 resolver 钩子实现。
  },
  resolver: path.join(__dirname, 'jest-resolver.cjs'),
};
