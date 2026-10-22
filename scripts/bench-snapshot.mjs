/**
 * 验证台 DOM 快照工具（重构前后对比用）
 *
 * 用途：把验证台渲染后的 **完整 DOM** 存成文件，用来证明
 * 「把 demo 拆成多个示例组件」这个重构**没有改变验证台的任何输出**。
 *
 * 为什么需要它：拆 demo 是纯内部重构，肉眼看不出差别，
 * 但一旦 Section/Block 的层级或属性被改动，visual-check 那种
 * 「靠 h2 文本定位」的探针可能仍然通过 —— 只有逐字比对 DOM 才能钉死。
 *
 * 用法：
 *   node scripts/bench-snapshot.mjs out.html     # 快照当前 dist
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const OUT = process.argv[2] ?? path.join(ROOT, '.tmp/bench-dom.html');
const PORT = Number(process.env.WEB_PORT ?? 4329);
const CDP_PORT = Number(process.env.CDP_PORT ?? 9241);

const MIME = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
};

const CHROME_CANDIDATES = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
    console.error('未找到 Chrome/Edge');
    process.exit(1);
}

const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(DIST, p);
    if (!existsSync(f)) {
        res.writeHead(404);
        res.end('nf');
        return;
    }
    res.writeHead(200, {
        'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream',
    });
    res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const profile = path.join(ROOT, '.chrome-snapshot');
const chrome = spawn(
    chromePath,
    [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        `--remote-debugging-port=${CDP_PORT}`,
        `--user-data-dir=${profile}`,
        'about:blank',
    ],
    { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i += 1) {
    try {
        const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
        wsUrl = list.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
    } catch {
        /* 还没起来 */
    }
    if (!wsUrl) await sleep(250);
}
if (!wsUrl) {
    console.error('CDP 没连上');
    chrome.kill();
    server.close();
    process.exit(1);
}

const sock = new WebSocket(wsUrl);
await new Promise((r) => sock.addEventListener('open', r));
let id = 0;
const pending = new Map();
sock.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m);
        pending.delete(m.id);
    }
});
const send = (method, params = {}) =>
    new Promise((ok) => {
        const i = ++id;
        pending.set(i, ok);
        sock.send(JSON.stringify({ id: i, method, params }));
    });
const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
    });
    return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
});
await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
await sleep(2500);

// 确认真的渲染出来了（探不到 [data-mode] 就是空跑，必须失败）
const hasMode = await evaluate(
    `document.querySelectorAll('[data-mode]').length`,
);
if (!hasMode) {
    console.error('✗ 页面没渲染出 [data-mode] —— 快照无效');
    chrome.kill();
    server.close();
    process.exit(1);
}

const html = await evaluate('document.body.innerHTML');
writeFileSync(OUT, html ?? '', 'utf8');
console.log(
    `✓ 快照已写入 ${OUT.replace(ROOT + '\\', '')}（${(html ?? '').length} 字符）`,
);

sock.close();
chrome.kill();
server.close();
await sleep(300);
process.exit(0);
