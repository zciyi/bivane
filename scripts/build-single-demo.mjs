/**
 * Bivane 单文件 demo 打包脚本
 *
 * 把 dist/ 的构建产物（当前是 1 个 JS chunk + 1 个 CSS chunk）内联进单个 HTML，
 * 产出仓库根目录的 bivane-demo.html —— 双击即可在浏览器打开：
 * - 不需要 dev server / preview server
 * - 不受 file:// 下「外部 module 脚本被 CORS 拦截」的影响（内联脚本不发跨源请求）
 *
 * 前提：dist/ 已由 `vite build` 生成。`npm run demo:single` 已把两步串起来。
 *
 * 用法：npm run demo:single
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const DIST_HTML = join(DIST, 'index.html');
const OUT = join(ROOT, 'bivane-demo.html');

/** 只内联构建产物自身的资源引用，外部 URL（CDN 等）一律原样保留 */
const isLocalAsset = (ref) => /^(?:\/|\.\/)?assets\//.test(ref);

const kb = (bytes) => `${(bytes / 1024).toFixed(1)}kB`;

/** 把资源引用（/assets/x.js）解析成 dist 下的绝对路径并读出来 */
async function readAsset(ref) {
  const rel = ref.replace(/^(?:\/|\.\/)/, '');
  const file = join(DIST, rel);
  try {
    return await readFile(file, 'utf8');
  } catch {
    throw new Error(
      `[demo:single] 资源不存在：dist/${rel}\n` +
        `  dist/ 可能是旧的（引用了已被删除的 hash 文件名）。先跑一次 vite build。`,
    );
  }
}

/** 内联脚本里出现 `</script` 会把宿主标签提前闭合，必须转义 */
const escapeForScript = (code) => code.replace(/<\/script/gi, '<\\/script');

/** 支持 await 的 String.replace */
async function replaceAsync(input, pattern, replacer) {
  const jobs = [];
  input.replace(pattern, (...args) => {
    jobs.push(replacer(...args).then((text) => ({ args, text })));
    return '';
  });
  const done = await Promise.all(jobs);
  let out = input;
  // 逐个用「原始匹配串」做一次字面量替换，避免正则里带 g 标志的 lastIndex 干扰
  for (const { args, text } of done) {
    const [match] = args;
    out = out.replace(match, () => text);
  }
  return out;
}

async function main() {
  let html;
  try {
    html = await readFile(DIST_HTML, 'utf8');
  } catch {
    throw new Error('[demo:single] 找不到 dist/index.html，先跑 `npx vite build`');
  }

  const inlined = [];
  let jsBytes = 0;
  let cssBytes = 0;

  // <script ... src="/assets/index-xxx.js"></script>
  html = await replaceAsync(
    html,
    /<script\b[^>]*\bsrc="([^"]+)"[^>]*>\s*<\/script>/g,
    async (tag, src) => {
      if (!isLocalAsset(src)) return tag;
      const code = await readAsset(src);
      jsBytes += Buffer.byteLength(code, 'utf8');
      inlined.push(src);
      return `<script type="module">\n${escapeForScript(code)}\n</script>`;
    },
  );

  // <link rel="stylesheet" crossorigin href="/assets/index-xxx.css">
  html = await replaceAsync(
    html,
    /<link\b[^>]*\brel="stylesheet"[^>]*>/g,
    async (tag) => {
      const href = /\bhref="([^"]+)"/.exec(tag)?.[1];
      if (!href || !isLocalAsset(href)) return tag;
      const css = await readAsset(href);
      if (/<\/style/i.test(css)) throw new Error('[demo:single] CSS 里出现 `</style`，需转义');
      cssBytes += Buffer.byteLength(css, 'utf8');
      inlined.push(href);
      return `<style>\n${css}\n</style>`;
    },
  );

  const banner =
    '<!-- 由 scripts/build-single-demo.mjs 从 dist/ 内联生成，请勿手改；' +
    '要改内容请改 src/ 后重跑 `npm run demo:single` -->';

  html = html.replace(/<!doctype html>/i, `<!doctype html>\n${banner}`);

  // 自检：内联必须彻底，否则双击打开时 file:// 会静默白屏
  const leftovers = html.match(/(?:src|href)="[^"]*\/assets\//g);
  if (leftovers) {
    throw new Error(`[demo:single] 仍有未内联的资源引用：${leftovers.join(', ')}`);
  }
  if (jsBytes === 0) throw new Error('[demo:single] 没有内联到任何 JS，index.html 结构可能变了');
  if (!html.includes('id="root"')) throw new Error('[demo:single] 产物里找不到 #root 挂载点');

  await writeFile(OUT, html, 'utf8');

  console.log(`[demo:single] ✓ bivane-demo.html`);
  console.log(
    `  内联 ${inlined.length} 个资源：JS ${kb(jsBytes)} + CSS ${kb(cssBytes)}` +
      ` -> 单文件 ${kb(Buffer.byteLength(html, 'utf8'))}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
