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
  },
};
