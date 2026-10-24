/**
 * jest 自定义 resolver（P3-011-03 引入）。
 *
 * 解决的问题：shared 源码的相对 import 带 `.js` 后缀（verbatimModuleSyntax 要求，
 * 见 packages/shared/src/schemas/common.ts 写法约束），而 jest-resolve 不做
 * `.js`→`.ts` 映射——P3-011-03 落 schemas 后 jest 首次真正加载 shared 源码即
 * MODULE_NOT_FOUND（`./utils/fnv1a32.js`）。
 *
 * 为什么不用 moduleNameMapper：全局 `^\./(.+)\.js$` 会误吞 node_modules 内部的相对
 * 导入（实测 react-is 的 `./cjs/react-is.development.js` 被误映射到 shared/src 下）；
 * 而 jest-resolve 按「请求 specifier 原文」匹配、moduleNameMapper 拿不到请求方文件
 * 位置。resolver 钩子的第二参（resolverOptions）带 `basedir`＝请求方所在目录，
 * 可精确判断「请求方在 shared/src 内」才做 `.js`→`.ts` 改写，其余全部走默认解析；
 * 改写后若目标不存在（请求的 .js 是真实 JS 文件）则回退默认解析，行为无损。
 *
 * @type {import('jest-resolve').SyncResolver}
 */
const path = require('node:path');

const SHARED_SRC = path.resolve(__dirname, '../../packages/shared/src');

function resolver(requestPath, options) {
  if (
    requestPath.endsWith('.js') &&
    requestPath.startsWith('.') &&
    typeof options?.basedir === 'string' &&
    options.basedir.startsWith(SHARED_SRC)
  ) {
    const probed = path.resolve(options.basedir, requestPath.slice(0, -3) + '.ts');
    if (require('node:fs').existsSync(probed)) {
      return options.defaultResolver(requestPath.slice(0, -3) + '.ts', options);
    }
  }
  return options.defaultResolver(requestPath, options);
}

module.exports = resolver;
