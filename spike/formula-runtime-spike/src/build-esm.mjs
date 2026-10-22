/**
 * build-esm.mjs —— 预构建浏览器可用的 ESM 依赖包
 *
 * 问题：react/react-dom/rxjs 只有 CJS 构建，浏览器 <script type="module"> 不能直接加载。
 * 方案：esbuild 打包为单文件 ESM，输出到 src/vendor/，由 import map 直接指向。
 * Univer 各包本身是 ESM（lib/es），无需处理。
 *
 * 运行：node src/build-esm.mjs（依赖变更后重跑）
 */
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SPIKE_ROOT = join(__dirname, '..');
const OUT = join(SPIKE_ROOT, 'src/vendor');

await mkdir(OUT, { recursive: true });

const TARGETS = [
    { name: 'react', entry: 'react', out: 'react.mjs' },
    { name: 'react/jsx-runtime', entry: 'react/jsx-runtime', out: 'react-jsx-runtime.mjs' },
    { name: 'react-dom/client', entry: 'react-dom/client', out: 'react-dom-client.mjs' },
    { name: 'react-dom', entry: 'react-dom', out: 'react-dom-client.mjs' },
    { name: '@wendellhu/redi/react-bindings', entry: '@wendellhu/redi/react-bindings', out: 'redi-react-bindings.mjs' },
    { name: 'lodash-es', entry: 'lodash-es/lodash.js', out: 'lodash-es.mjs' },
    { name: 'decimal.js', entry: 'decimal.js', out: 'decimal-js.mjs' },
    { name: 'async-lock', entry: 'async-lock', out: 'async-lock.mjs' },
    { name: 'fast-diff', entry: 'fast-diff', out: 'fast-diff.mjs' },
    { name: 'ot-json1', entry: 'ot-json1', out: 'ot-json1-raw.mjs' },
    { name: 'franc-min', entry: 'franc-min', out: 'franc-min.mjs' },
    { name: 'kdbush', entry: 'kdbush', out: 'kdbush.mjs' },
    { name: 'rbush', entry: 'rbush', out: 'rbush.mjs' },
    { name: 'class-variance-authority', entry: 'class-variance-authority', out: 'class-variance-authority.mjs' },
    { name: 'cmdk', entry: 'cmdk', out: 'cmdk.mjs' },
    { name: 'sonner', entry: 'sonner', out: 'sonner.mjs' },
    { name: '@flatten-js/interval-tree', entry: '@flatten-js/interval-tree', out: 'flatten-interval-tree.mjs' },
    { name: '@floating-ui/dom', entry: '@floating-ui/dom', out: 'floating-ui-dom.mjs' },
    { name: '@floating-ui/utils', entry: '@floating-ui/utils', out: 'floating-ui-utils.mjs' },
    { name: '@floating-ui/utils/dom', entry: '@floating-ui/utils/dom', out: 'floating-ui-utils-dom.mjs' },
    { name: '@radix-ui/react-dialog', entry: '@radix-ui/react-dialog', out: 'radix-react-dialog.mjs' },
    { name: '@radix-ui/react-direction', entry: '@radix-ui/react-direction', out: 'radix-react-direction.mjs' },
    { name: '@radix-ui/react-dropdown-menu', entry: '@radix-ui/react-dropdown-menu', out: 'radix-react-dropdown-menu.mjs' },
    { name: '@radix-ui/react-hover-card', entry: '@radix-ui/react-hover-card', out: 'radix-react-hover-card.mjs' },
    { name: '@radix-ui/react-popover', entry: '@radix-ui/react-popover', out: 'radix-react-popover.mjs' },
    { name: '@radix-ui/react-separator', entry: '@radix-ui/react-separator', out: 'radix-react-separator.mjs' },
    { name: '@radix-ui/react-slot', entry: '@radix-ui/react-slot', out: 'radix-react-slot.mjs' },
    // lib0（yjs 依赖）：ESM 但子路径多，bundle 成单文件
    { name: 'lib0', entry: 'lib0', out: 'lib0.mjs' },
    // lib0 子路径（yjs 依赖全集：any/array/binary/buffer/decoding/encoding/environment/error/function/
    // iterator/logging/map/math/object/observable/promise/random/set/string/time）
    { name: 'lib0/observable', entry: 'lib0/observable', out: 'lib0-observable.mjs' },
    { name: 'lib0/encoding', entry: 'lib0/encoding', out: 'lib0-encoding.mjs' },
    { name: 'lib0/decoding', entry: 'lib0/decoding', out: 'lib0-decoding.mjs' },
    { name: 'lib0/binary', entry: 'lib0/binary', out: 'lib0-binary.mjs' },
    { name: 'lib0/time', entry: 'lib0/time', out: 'lib0-time.mjs' },
    { name: 'lib0/mutex', entry: 'lib0/mutex', out: 'lib0-mutex.mjs' },
    { name: 'lib0/random', entry: 'lib0/random', out: 'lib0-random.mjs' },
    { name: 'lib0/error', entry: 'lib0/error', out: 'lib0-error.mjs' },
    { name: 'lib0/environment', entry: 'lib0/environment', out: 'lib0-environment.mjs' },
    { name: 'lib0/diff', entry: 'lib0/diff', out: 'lib0-diff.mjs' },
    { name: 'lib0/broadcastchannel', entry: 'lib0/broadcastchannel', out: 'lib0-broadcastchannel.mjs' },
    { name: 'lib0/websocket', entry: 'lib0/websocket', out: 'lib0-websocket.mjs' },
    { name: 'lib0/storage', entry: 'lib0/storage', out: 'lib0-storage.mjs' },
    { name: 'lib0/url', entry: 'lib0/url', out: 'lib0-url.mjs' },
    { name: 'lib0/array', entry: 'lib0/array', out: 'lib0-array.mjs' },
    { name: 'lib0/buffer', entry: 'lib0/buffer', out: 'lib0-buffer.mjs' },
    { name: 'lib0/function', entry: 'lib0/function', out: 'lib0-function.mjs' },
    { name: 'lib0/iterator', entry: 'lib0/iterator', out: 'lib0-iterator.mjs' },
    { name: 'lib0/logging', entry: 'lib0/logging', out: 'lib0-logging.mjs' },
    { name: 'lib0/map', entry: 'lib0/map', out: 'lib0-map.mjs' },
    { name: 'lib0/math', entry: 'lib0/math', out: 'lib0-math.mjs' },
    { name: 'lib0/object', entry: 'lib0/object', out: 'lib0-object.mjs' },
    { name: 'lib0/promise', entry: 'lib0/promise', out: 'lib0-promise.mjs' },
    { name: 'lib0/set', entry: 'lib0/set', out: 'lib0-set.mjs' },
    { name: 'lib0/string', entry: 'lib0/string', out: 'lib0-string.mjs' },
    { name: 'lib0/prng', entry: 'lib0/prng', out: 'lib0-prng.mjs' },
];

for (const t of TARGETS) {
    // react 系目标跳过——由下方 shim 阶段统一构建（保证单 React 实例 + 命名导出）；
    // univer-icons 也跳过——依赖 react，由 REACT_DEPS 阶段统一构建 + 去重
    if (t.out === 'react.mjs' || t.out === 'react-dom-client.mjs' || t.out === 'react-jsx-runtime.mjs'
        || t.out === 'univer-icons.mjs') continue;
    await build({
        entryPoints: [t.entry],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2020',
        outfile: join(OUT, t.out),
        logLevel: 'warning',
    });
    console.log(`[build-esm] ${t.name} -> src/vendor/${t.out}`);
}

// ---- 第 1 步：先构建 react.mjs（所有其他包的 alias 目标）----
const V = (f) => join(OUT, f).replaceAll('\\', '/');
{
    const reactKeys = ['Children', 'Component', 'Fragment', 'Profiler', 'PureComponent',
        'StrictMode', 'Suspense', '__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED',
        'cloneElement', 'createContext', 'createElement', 'createFactory', 'createRef',
        'forwardRef', 'isValidElement', 'lazy', 'memo', 'startTransition', 'unstable_act',
        'useCallback', 'useContext', 'useDebugValue', 'useDeferredValue', 'useEffect',
        'useId', 'useImperativeHandle', 'useInsertionEffect', 'useLayoutEffect',
        'useMemo', 'useReducer', 'useRef', 'useState', 'useSyncExternalStore',
        'useTransition', 'version', 'cache', 'useOptimistic'];
    const code = `import * as __cjs from 'react';\n` +
        reactKeys.map((k) => `export const ${k} = __cjs[${JSON.stringify(k)}];`).join('\n') +
        `\nexport default __cjs;`;
    await build({
        stdin: { contents: code, resolveDir: SPIKE_ROOT, loader: 'js' },
        bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
        outfile: join(OUT, 'react.mjs'), logLevel: 'warning',
    });
    console.log('[build-esm] shim react.mjs');
}

// ---- 第 2 步：所有依赖 react 的 vendor 包统一「alias + post-build 去重」----
// esbuild alias 会把 react.mjs 内联成副本（init_react），浏览器里与独立 react.mjs 是两份实例。
// 通用修复：构建后把 `var React = (init_react(), __toCommonJS(react_exports));` 替换为
// 顶部 `import * as __reactSingleton from '/src/vendor/react.mjs'` 的单例引用。
const REACT_DEPS = [
    'react-jsx-runtime.mjs', 'react-dom-client.mjs', 'redi-react-bindings.mjs',
    'cmdk.mjs', 'sonner.mjs', 'radix-react-dialog.mjs', 'radix-react-direction.mjs',
    'radix-react-dropdown-menu.mjs', 'radix-react-hover-card.mjs', 'radix-react-popover.mjs',
    'radix-react-separator.mjs', 'radix-react-slot.mjs',
    // @univerjs/icons 也依赖 react（IconBase 用 useId/useRef/useLayoutEffect）——必须同链去重
    'univer-icons.mjs',
];
const { readFile, writeFile } = await import('node:fs/promises');

// ---- redi-react-bindings.mjs：手写 shim（不走 esbuild）----
// ⚠️ 不能 bundle！bundle 会内联一份完整 redi 副本，与 @univerjs/core 走 import map 加载的
// 独立 redi 形成双实例（REDI_GLOBAL_LOCK 警告 + createIdentifier token 不相等 ->
// injector.get 找不到注册项）。必须 re-export 同一份 redi。
// 也不能用包名 import——import map 把 '@wendellhu/redi/react-bindings' 指到本文件（自指死循环）。
// 直接用绝对 URL '/__bare/@wendellhu/redi/react-bindings' 绕过 import map，
// 指向服务器路由（与 @univerjs/core 的 redi 同一份 ESM）。
{
    const rediKeys = ['RediConsumer', 'RediContext', 'RediProvider', 'WithDependency', 'connectDependencies',
        'connectInjector', 'useDependency', 'useInjector', 'useObservable', 'useUpdateBinder'];
    const shim = `// 手写 shim：re-export 同一份 redi（见 build-esm.mjs 注释）\n`
        + `import * as __redi from '/__bare/@wendellhu/redi/react-bindings';\n`
        + rediKeys.map((k) => `export const ${k} = __redi[${JSON.stringify(k)}];`).join('\n')
        + `\nexport default __redi;\n`;
    await writeFile(join(OUT, 'redi-react-bindings.mjs'), shim);
    console.log('[build-esm] hand-written shim redi-react-bindings.mjs');
}

for (const file of REACT_DEPS) {
    // redi-react-bindings 已由上方手写 shim 产出，跳过 esbuild 阶段
    if (file === 'redi-react-bindings.mjs') continue;
    // react-jsx-runtime 特殊：不能 import 自身包名（alias 前缀自指）——直接 import CJS 文件
    const isJsx = file === 'react-jsx-runtime.mjs';
    const entry = isJsx
        ? join(SPIKE_ROOT, 'node_modules/react/jsx-runtime.js').replaceAll('\\', '/')
        : file === 'react-dom-client.mjs' ? 'react-dom/client'
        : file === 'react-jsx-runtime.mjs' ? 'react/jsx-runtime'
        : file === 'redi-react-bindings.mjs' ? '@wendellhu/redi/react-bindings'
        : file === 'cmdk.mjs' ? 'cmdk'
        : file === 'sonner.mjs' ? 'sonner'
        : file === 'radix-react-dialog.mjs' ? '@radix-ui/react-dialog'
        : file === 'radix-react-direction.mjs' ? '@radix-ui/react-direction'
        : file === 'radix-react-dropdown-menu.mjs' ? '@radix-ui/react-dropdown-menu'
        : file === 'radix-react-hover-card.mjs' ? '@radix-ui/react-hover-card'
        : file === 'radix-react-popover.mjs' ? '@radix-ui/react-popover'
        : file === 'radix-react-separator.mjs' ? '@radix-ui/react-separator'
        : file === 'univer-icons.mjs'
            ? './node_modules/@univerjs/design/node_modules/@univerjs/icons/dist/esm/index.js'
        : '@radix-ui/react-slot';
    const keys = isJsx ? ['Fragment', 'jsx', 'jsxs', 'jsxDEV']
        : file === 'react-dom-client.mjs'
            // 同时覆盖 react-dom（根：createPortal/flushSync/...）与 react-dom/client（createRoot/hydrateRoot）——
            // import map 把两个 spec 都指向本文件
            ? ['createPortal', 'flushSync', 'unstable_batchedUpdates', 'unstable_renderSubtreeIntoContainer',
                'unstable_runWithPriority', 'createRoot', 'hydrateRoot', 'version', 'render', 'unmountComponentAtNode',
                'findDOMNode', 'unstable_act', 'createServerRoot', 'formState']
        : file === 'redi-react-bindings.mjs'
            // ⚠️ 不能 bundle！bundle 会内联一份完整 redi 副本，与 @univerjs/core 走 import map 加载的
            // 独立 redi 形成双实例（REDI_GLOBAL_LOCK 警告 + createIdentifier token 不相等 ->
            // injector.get 找不到注册项）。必须 re-export 同一份 redi。
            ? ['RediConsumer', 'RediContext', 'RediProvider', 'WithDependency', 'connectDependencies',
                'connectInjector', 'useDependency', 'useInjector', 'useObservable', 'useUpdateBinder']
        : null; // 其余包直接 bundle（保留原导出），只做去重
    const code = keys
        ? `import * as __cjs from '${isJsx
            ? join(SPIKE_ROOT, 'node_modules/react/jsx-runtime.js').replaceAll('\\', '/')
            : file === 'react-dom-client.mjs' ? 'react-dom'
            // ⚠️ 不能用包名——import map 把 '@wendellhu/redi/react-bindings' 指到本 shim 自身（自指死循环）。
            // 直接用绝对 URL 绕过 import map，指向服务器路由 /__bare/@wendellhu/redi/react-bindings
            // （与 @univerjs/core 的 redi 同一份 ESM）。
            : '/__bare/@wendellhu/redi/react-bindings'}';\n` + keys.map((k) => `export const ${k} = __cjs[${JSON.stringify(k)}];`).join('\n') + `\nexport default __cjs;`
        : null;

    await build({
        ...(code
            ? { stdin: { contents: code, resolveDir: SPIKE_ROOT, loader: 'js' } }
            : { entryPoints: [entry] }),
        bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
        outfile: join(OUT, file),
        alias: { 'react': V('react.mjs'), 'react/jsx-runtime': V('react-jsx-runtime.mjs') },
        // redi-react-bindings shim：@wendellhu/redi 必须保持 external（浏览器经 import map
        // 解析到 /__bare/@wendellhu/redi——与 @univerjs/core 用同一份，保证 token 相等）
        ...(file === 'redi-react-bindings.mjs' ? { external: ['@wendellhu/redi'] } : {}),
        logLevel: 'warning',
    });
    console.log(`[build-esm] react-dep ${file}`);

    // post-build 去重（三种内联形态）：
    // A) var React = (init_react(), __toCommonJS(react_exports));
    // B) var React = react_exports;（redi 等 ESM 依赖链的形态）
    // C) 扁平形态（radix-slot/icons 等 ESM 源内联 shim）：无 init_react 包装，直接
    //    `var __cjs = __toESM(require_react());` / `var import_reactN = __toESM(require_react(), 1);`
    //    —— require_react() 激活内联的 require_react_development 死副本
    let src = await readFile(join(OUT, file), 'utf-8');
    const hasDeadCopy = src.includes('init_react()')
        || /var React = react_exports;/.test(src)
        || /__toESM2?\(require_react\(\)/.test(src)
        || /react_exports\[" use "\]/.test(src);
    if (hasDeadCopy) {
        // 用相对路径 './react.mjs'（同目录），浏览器按 URL 解析到 /src/vendor/react.mjs
        src = `import * as __reactSingleton from './react.mjs';\n` + src;
        src = src.replace(/var React = \(init_react\(\), __toCommonJS\(react_exports\)\);/g,
            'var React = __reactSingleton;');
        src = src.replace(/var React = react_exports;/g, 'var React = __reactSingleton;');
        // CJS interop 的 require('react') 副本也指向单例
        src = src.replace(/__cjs2? = __toESM2?\(require_react\(\)\);/g, '__cjs = __reactSingleton;');
        src = src.replace(/__cjs2 = react_exports;/g, '__cjs2 = __reactSingleton;');
        // 扁平形态：__toESM(require_react()) / __toESM(require_react(), 1)（含 import_reactN 变体）
        src = src.replace(/__toESM\(require_react\(\)(, 1)?\)/g, '__reactSingleton');
        // slot 的 `use = react_exports[" use ".trim().toString()]`（react 18 无 use，取 undefined 即可）
        src = src.replace(/react_exports\[" use "\.trim\(\)\.toString\(\)\]/g, 'undefined');
        await writeFile(join(OUT, file), src);
        console.log(`[build-esm] dedupe ${file}`);
    }
}
console.log('[build-esm] done');
