/**
 * browser-probe.mjs —— Playwright 驱动层（P3-002 主探针）
 *
 * 职责：
 *   1. 起本地静态服务器（serve spike/node_modules + src/，支持裸导入映射）
 *   2. 启动 Chromium（headless=new），加载 browser-probe.html
 *   3. 注入 import map（@univerjs/* -> 本地 node_modules ESM）
 *   4. 收集页内探针（browser-probe-page.mjs）的 console 与 __PROBE_RESULT__
 *   5. 输出 B1~B10 断言汇总，退出码 0/1
 *
 * 运行：node src/browser-probe.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SPIKE_ROOT = join(__dirname, '..');
const NM = join(SPIKE_ROOT, 'node_modules');

const MIME = {
    '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
};

/** 裸导入解析：任意 node_modules 包 -> ESM 入口（按 package.json module/main） */
async function resolveBare(spec) {
    // 子路径形式：@univerjs/core/lib/locale/zh-CN.js
    const parts = spec.split('/');
    let pkgName, subPath;
    if (spec.startsWith('@')) {
        pkgName = parts.slice(0, 2).join('/');
        subPath = parts.slice(2).join('/');
    } else {
        pkgName = parts[0];
        subPath = parts.slice(1).join('/');
    }
    const pkgDir = join(NM, pkgName);
    if (!subPath) {
        // 读 package.json module/main
        const pj = JSON.parse(await readFile(join(pkgDir, 'package.json'), 'utf-8'));
        const entry = pj.module ?? pj.main ?? 'lib/es/index.js';
        return join(pkgDir, entry);
    }
    // 子路径：优先 lib/es（ESM），fallback dist/esm，再 fallback 原样（只认文件——目录会 EISDIR）
    const isFile = async (p) => (await stat(p).then((s) => s.isFile()).catch(() => false));
    for (const candidate of [
        join(pkgDir, 'lib/es', subPath),
        join(pkgDir, 'dist/esm', subPath),
        // 子路径目录形式（@wendellhu/redi/react-bindings -> dist/esm/react-bindings/index.js）
        join(pkgDir, 'dist/esm', subPath, 'index.js'),
        join(pkgDir, 'lib/es', subPath, 'index.js'),
        // locale 特例：部分包（core/docs）locale 在 lib/locale/ 而非 lib/es/locale/
        join(pkgDir, 'lib/locale', subPath.replace(/^locale\//, '')),
        // @univerjs/icons 特例：子路径不带扩展名（warn-double-icon.js -> dist/esm/warn-double-icon.js）
        join(pkgDir, 'dist/esm', subPath.replace(/\.js$/, '') + '.js'),
        join(pkgDir, subPath),
        join(pkgDir, subPath.replace(/\.js$/, '') + '.js'),
    ]) {
        if (await isFile(candidate)) return candidate;
    }
    return join(pkgDir, subPath);
}

const server = createServer(async (req, res) => {
    try {
        const url = decodeURIComponent(req.url.split('?')[0]);
        let filePath = null;

        if (url === '/__importmap__') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{}');
            return;
        }

        // rxjs 子路径折叠：/src/vendor/rxjs-sub/<anything> -> rxjs.mjs 全量包
        if (url.startsWith('/src/vendor/rxjs-sub/')) {
            const data = await readFile(join(SPIKE_ROOT, 'src/vendor/rxjs.mjs'));
            res.writeHead(200, { 'content-type': 'text/javascript' });
            res.end(data);
            return;
        }

        // vendor 包子路径折叠：/src/vendor-sub/<pkg>/<sub> -> 该包全量 bundle
        if (url.startsWith('/src/vendor-sub/')) {
            const spec = url.replace('/src/vendor-sub/', '');
            // 逐级匹配：先试完整 spec（@floating-ui/utils/dom -> VENDOR_MAP 直命中），
            // 再退到包名前缀（@floating-ui/utils -> ...）
            const candidates = [];
            if (spec.startsWith('@')) {
                candidates.push(spec.split('/').slice(0, 2).join('/'));
            } else {
                candidates.push(spec.split('/')[0]);
            }
            // 完整 spec 本身也可能是 VENDOR_MAP 键（如 react/jsx-runtime）
            candidates.unshift(spec);
            for (const cand of candidates) {
                const file = VENDOR_MAP[cand];
                if (file) {
                    const data = await readFile(join(SPIKE_ROOT, 'src/vendor', file));
                    res.writeHead(200, { 'content-type': 'text/javascript' });
                    res.end(data);
                    return;
                }
            }
            res.writeHead(404); res.end('vendor-sub not found: ' + spec);
            return;
        }

        // 裸导入经 import map 转发：/__bare/<pkg> 或 /__bare/<pkg>/<subpath>
        if (url.startsWith('/__bare/')) {
            const spec = url.replace('/__bare/', '');
            const resolved = await resolveBare(spec);
            if (!resolved) { res.writeHead(404); res.end('bare not found: ' + spec); return; }
            const data = await readFile(resolved);
            res.writeHead(200, { 'content-type': 'text/javascript' });
            res.end(data);
            return;
        }

        // 静态文件：/src/... 或 /node_modules/... 或页内相对引用（/browser-probe-page.mjs -> src/）
        if (url.startsWith('/src/') || url.startsWith('/node_modules/')) {
            filePath = join(SPIKE_ROOT, url.replace(/^\//, ''));
        } else if (url === '/' || url === '/browser-probe.html') {
            filePath = join(SPIKE_ROOT, 'src/browser-probe.html');
        } else if (url === '/browser-probe-page.mjs' || /^\/[a-zA-Z0-9_-]+\.(mjs|js|css|html)$/.test(url)) {
            // HTML 内相对引用（./browser-probe-page.mjs）——映射到 src/ 目录
            filePath = join(SPIKE_ROOT, 'src', url.replace(/^\//, ''));
        } else if (!url.startsWith('/')) {
            filePath = null;
        } else {
            // 裸导入（@univerjs/... / yjs / react / rxjs）
            filePath = await resolveBare(url);
        }

        if (!filePath) { res.writeHead(404); res.end('not found: ' + url); return; }
        filePath = normalize(filePath);
        if (!filePath.startsWith(normalize(SPIKE_ROOT))) { res.writeHead(403); res.end('forbidden'); return; }

        let data;
        try { data = await readFile(filePath); } catch { res.writeHead(404); res.end('read fail: ' + url); return; }
        res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
        res.end(data);
    } catch (err) {
        res.writeHead(404); res.end('not found: ' + String(err?.message ?? err));
    }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`[probe] static server on ${base}`);

// ---------------------------------------------------------------- Playwright

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

// ---------------------------------------------------------------- import map 注入
// 经 route 拦截在 HTML 响应里注入 import map（addInitScript 对 import map 时机不可靠——
// init script 在文档解析早期执行，但 import map 必须先于任何 module script 被解析）。

const BARE_PKGS = [
    '@univerjs/core', '@univerjs/design', '@univerjs/docs', '@univerjs/docs-ui',
    '@univerjs/drawing', '@univerjs/engine-formula', '@univerjs/engine-render',
    '@univerjs/protocol', '@univerjs/sheets', '@univerjs/sheets-formula',
    '@univerjs/sheets-formula-ui', '@univerjs/sheets-ui', '@univerjs/telemetry',
    '@univerjs/themes', '@univerjs/ui', 'yjs', '@wendellhu/redi', '@univerjs/rpc',
];
const importMap = { imports: {} };
for (const p of BARE_PKGS) {
    importMap.imports[p] = `/__bare/${p}`;
    importMap.imports[p + '/'] = `/__bare/${p}/`; // 子路径通配（@univerjs/core/lib/...）
}
// CJS 依赖用 esbuild 预构建的 ESM（src/vendor/，build-esm.mjs 产出）
const VENDOR_MAP = {
    'react': 'react.mjs',
    'react/jsx-runtime': 'react-jsx-runtime.mjs',
    'react-dom/client': 'react-dom-client.mjs',
    'react-dom': 'react-dom-client.mjs',
    '@wendellhu/redi/react-bindings': 'redi-react-bindings.mjs',
    // @univerjs/icons 走预构建 bundle（源码 650 个无扩展名相对导入，浏览器不能直接用）
    '@univerjs/icons': 'univer-icons.mjs',
    // lib0（yjs 依赖）bundle 成单文件 + 子模块
    'lib0': 'lib0.mjs',
    'lib0/observable': 'lib0-observable.mjs',
    'lib0/encoding': 'lib0-encoding.mjs',
    'lib0/decoding': 'lib0-decoding.mjs',
    'lib0/binary': 'lib0-binary.mjs',
    'lib0/time': 'lib0-time.mjs',
    'lib0/mutex': 'lib0-mutex.mjs',
    'lib0/random': 'lib0-random.mjs',
    'lib0/error': 'lib0-error.mjs',
    'lib0/environment': 'lib0-environment.mjs',
    'lib0/diff': 'lib0-diff.mjs',
    'lib0/broadcastchannel': 'lib0-broadcastchannel.mjs',
    'lib0/websocket': 'lib0-websocket.mjs',
    'lib0/storage': 'lib0-storage.mjs',
    'lib0/url': 'lib0-url.mjs',
    'lib0/array': 'lib0-array.mjs',
    'lib0/buffer': 'lib0-buffer.mjs',
    'lib0/function': 'lib0-function.mjs',
    'lib0/iterator': 'lib0-iterator.mjs',
    'lib0/logging': 'lib0-logging.mjs',
    'lib0/map': 'lib0-map.mjs',
    'lib0/math': 'lib0-math.mjs',
    'lib0/object': 'lib0-object.mjs',
    'lib0/promise': 'lib0-promise.mjs',
    'lib0/set': 'lib0-set.mjs',
    'lib0/string': 'lib0-string.mjs',
    'lib0/prng': 'lib0-prng.mjs',
    'rxjs': 'rxjs.mjs',
    'lodash-es': 'lodash-es.mjs',
    'decimal.js': 'decimal-js.mjs',
    'async-lock': 'async-lock.mjs',
    'fast-diff': 'fast-diff.mjs',
    'ot-json1': 'ot-json1.mjs',
    'franc-min': 'franc-min.mjs',
    'kdbush': 'kdbush.mjs',
    'rbush': 'rbush.mjs',
    'class-variance-authority': 'class-variance-authority.mjs',
    'cmdk': 'cmdk.mjs',
    'sonner': 'sonner.mjs',
    '@flatten-js/interval-tree': 'flatten-interval-tree.mjs',
    '@floating-ui/dom': 'floating-ui-dom.mjs',
    '@floating-ui/utils': 'floating-ui-utils.mjs',
    '@floating-ui/utils/dom': 'floating-ui-utils-dom.mjs',
    '@radix-ui/react-dialog': 'radix-react-dialog.mjs',
    '@radix-ui/react-direction': 'radix-react-direction.mjs',
    '@radix-ui/react-dropdown-menu': 'radix-react-dropdown-menu.mjs',
    '@radix-ui/react-hover-card': 'radix-react-hover-card.mjs',
    '@radix-ui/react-popover': 'radix-react-popover.mjs',
    '@radix-ui/react-separator': 'radix-react-separator.mjs',
    '@radix-ui/react-slot': 'radix-react-slot.mjs',
};
for (const [spec, file] of Object.entries(VENDOR_MAP)) {
    importMap.imports[spec] = `/src/vendor/${file}`;
}
// 子路径通配：vendor 包的深层导入（@floating-ui/utils/dom、@radix-ui/react-slot/index 等）
for (const spec of Object.keys(VENDOR_MAP)) {
    if (!importMap.imports[spec + '/']) {
        importMap.imports[spec + '/'] = `/src/vendor-sub/${spec}/`;
    }
}
// rxjs 子路径（rxjs/operators 等）全部折叠到全量包（esm bundle 已含全部导出）
importMap.imports['rxjs/'] = '/src/vendor/rxjs-sub/';

const importMapTag = `<script type="importmap">${JSON.stringify(importMap)}</script>`;

await page.route(`**/browser-probe.html`, async (route) => {
    const html = await readFile(join(SPIKE_ROOT, 'src/browser-probe.html'), 'utf-8');
    const injected = html.replace('<head>', `<head>${importMapTag}`);
    await route.fulfill({ contentType: 'text/html', body: injected });
});

const consoleLines = [];
const failedUrls = [];
page.on('console', (msg) => {
    const text = `[page:${msg.type()}] ${msg.text()}`;
    consoleLines.push(text);
    console.log(text);
});
page.on('pageerror', (err) => {
    consoleLines.push(`[page:error] ${err.message}`);
    console.error(`[page:error] ${err.message}`);
});
page.on('requestfailed', (req) => {
    const line = `[req:fail] ${req.url()} ${req.failure()?.errorText ?? ''}`;
    failedUrls.push(line);
    console.log(line);
});
page.on('response', (res) => {
    if (res.status() >= 400) {
        const line = `[res:${res.status()}] ${res.url()}`;
        failedUrls.push(line);
        console.log(line);
    }
});

await page.goto(`${base}/browser-probe.html`, { waitUntil: 'domcontentloaded' });

// 等待页内探针完成（最多 120s）
const deadline = Date.now() + 120_000;
let result = null;
while (Date.now() < deadline) {
    result = await page.evaluate(() => window.__PROBE_RESULT__ ?? null).catch(() => null);
    if (result) break;
    await new Promise((r) => setTimeout(r, 500));
}

if (!result) {
    console.error('\n[probe] 超时或页内探针未完成。最近 console：');
    consoleLines.slice(-40).forEach((l) => console.error('  ' + l));
    await browser.close(); server.close();
    process.exit(2);
}

console.log(`\n==== Playwright 探针汇总：${result.passed}/${result.total} PASS ====`);
for (const r of result.results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.desc}${r.detail ? '  | ' + r.detail : ''}`);
}

await browser.close();
server.close();
process.exit(result.passed === result.total ? 0 : 1);
