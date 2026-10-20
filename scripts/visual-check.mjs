/**
 * Bivane 视觉/交互验证（质量门第 6 门）
 *
 * 为什么需要它：P1 出现过三个「全绿却错」的缺陷 ——
 * 遮罩缺 @theme 映射导致完全透明、遮罩漏带 data-mode 导致静默沿用 H5 浓度、
 * 槽名与动画选择器不一致导致动画从未运行。三者都通过了
 * tsc + eslint + 120 个 vitest 用例 + vite build。
 * 类型系统与 jsdom 都不做 CSS 级联，只有真实浏览器 + 计算样式能发现。
 *
 * 做三件事：
 *   1. 起一个内置静态服务器指向 dist（**必须在同一进程内**：外部起的 preview
 *      进程会在工具调用结束时被回收，下一个调用就 404）
 *   2. 用 CDP 驱动无头 Chrome，在 1200px / 390px 下**交互后**截图（不是静态首屏）
 *   3. 读 computed style 并打印结构化探针结果（几何、遮罩 rgba、token 是否生效）
 *
 * 覆盖场景：P1 Dialog / Popup（含 2b 宽度、2c 高度两个几何回归）/ Toast，
 *          P2 Select（展开、键盘巡航、输入过滤）、DropdownMenu（层级回显、下钻、
 *          打开即定位、面包屑切层）、DatePicker（单值展开、滚轮/键盘、区间、
 *          提交回填 —— 见 probeDate）。
 *
 * 三个已经踩过的坑，改这个脚本时务必守住：
 *   a. **按 aria-label 找 Select 触发器，不要按可见文案**。未选中时触发器显示的是
 *      placeholder（「输入可过滤」），按文案匹配会找不到而静默回退到第一个触发器 ——
 *      结果是「点了一个组件、量了另一个组件」，探针自洽但结论全错。
 *   b. **探针要取 `[aria-expanded="true"]` 的那个触发器**，页面上同一种组件有多个。
 *   c. **键盘要用 CDP Input 域发真实按键**，不要在页面里 dispatchEvent：
 *      合成事件绕过浏览器默认行为与焦点判定，而「键盘巡航是否生效」恰好取决于这两者。
 *
 * 用法：
 *   node scripts/visual-check.mjs
 *   node scripts/visual-check.mjs --url http://localhost:5173   # 指向 dev server
 *   node scripts/visual-check.mjs --out .visual --port 4321
 *
 * 前置：npm run build（脚本只服务 dist，不负责构建）
 * 环境变量：CHROME_PATH 可覆盖 Chrome 可执行文件路径
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = path.resolve(ROOT, arg('out', '.visual'));
const WEB_PORT = Number(arg('port', '4319'));
const CDP_PORT = Number(arg('cdp-port', '9333'));
const EXTERNAL_URL = arg('url', null);
const PAGE = EXTERNAL_URL ?? `http://localhost:${WEB_PORT}/`;

/** Chrome 候选路径（Windows 优先，兼容其它平台） */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('[visual-check] 找不到 Chrome。请设置 CHROME_PATH 环境变量。');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 静态服务器（仅在没有 --url 时启用） ----
let web = null;
if (!EXTERNAL_URL) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('[visual-check] dist/index.html 不存在，先跑 npm run build');
    process.exit(1);
  }
  web = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => web.listen(WEB_PORT, '127.0.0.1', r));
  console.log(`static server  -> http://localhost:${WEB_PORT} (${DIST})`);
}

fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(ROOT, '.chrome-profile');
fs.rmSync(profile, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + profile,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let ws;
let msgId = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('timeout ' + method));
      }
    }, 20000);
  });
}

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error('eval error: ' + JSON.stringify(r.result.exceptionDetails));
  }
  return r.result?.result?.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
  console.log('  shot ->', name + '.png', fs.statSync(file).size + 'B');
}

/** 按可见文本点击按钮（精确匹配优先，退化到包含匹配） */
function clickButton(text) {
  return evaluate(`(() => {
    const want = ${JSON.stringify(text)};
    const btns = [...document.querySelectorAll('button')];
    const exact = btns.find(b => b.textContent.replace(/\\s+/g, '') === want.replace(/\\s+/g, ''));
    const loose = btns.find(b => b.textContent.includes(want));
    const el = exact || loose;
    if (!el) return 'NOT_FOUND:' + want;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return 'OK';
  })()`);
}

/**
 * 按可访问名称点击 Select 触发器。
 * ⚠️ 必须按 aria-label 匹配，不能按 textContent：
 * 触发器在未选中时显示的是 placeholder（如「输入可过滤」），
 * 按文案找会匹配不到而静默回退到第一个触发器 —— 于是「点了一个组件、量了另一个组件」。
 */
function clickSelectTrigger(ariaLabel) {
  return evaluate(`(() => {
    const want = ${JSON.stringify(ariaLabel)};
    const list = [...document.querySelectorAll('[data-slot="select-trigger"]')];
    const el = list.find(t => t.getAttribute('aria-label') === want);
    if (!el) return 'NOT_FOUND:' + want + '（可选：' + list.map(t => t.getAttribute('aria-label')).join('/') + '）';
    el.scrollIntoView({ block: 'center' });
    el.click();
    return 'OK';
  })()`);
}

/**
 * 真实鼠标点击（CDP Input 域）：走 pointerdown → mousedown → mouseup → click 的完整链路。
 *
 * ⚠️ DropdownMenu 必须用它，不能在页面里 `el.click()`：Radix 的 Trigger 是在
 * **pointerdown** 上开合的（`context.onOpenToggle()`），`el.click()` 只派发 click，
 * PC 端永远打不开，而失败现象是「面板不存在」，很容易被误读成组件没渲染。
 * 这条链路同时也是 H5 的入口（菜单触发器走 onClick），所以两端共用同一个函数。
 */
async function realClickByLabel(slot, ariaLabel) {
  const raw = await evaluate(`(() => {
    const want = ${JSON.stringify(ariaLabel)};
    const list = [...document.querySelectorAll('[data-slot="${slot}"]')];
    const el = list.find(t => t.getAttribute('aria-label') === want);
    if (!el) return JSON.stringify({ error: 'NOT_FOUND:' + want + '（可选：' + list.map(t => t.getAttribute('aria-label')).join('/') + '）' });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  const base = { x: info.x, y: info.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  return `OK @${info.x},${info.y}`;
}

/** 在已展开的菜单里点击某一行（真实鼠标点击，同样为了走 pointerdown 链路） */
async function clickMenuRow(value) {
  const raw = await evaluate(`(() => {
    const el = [...document.querySelectorAll('[data-slot="menu-row"]')].find(r => r.dataset.value === ${JSON.stringify(value)});
    if (!el) return JSON.stringify({ error: 'ROW_NOT_FOUND:' + ${JSON.stringify(value)} });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  const base = { x: info.x, y: info.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  return 'OK';
}

/**
 * 在时间面板里按文案点一个滚轮项（真实鼠标点击）。
 * 优先在当前被键盘驾驶的列（`data-active`）里找，找不到再全局找 ——
 * 避免「时列」的 20 与「分/秒列」的 20 串味。
 * H5 没有 data-active（触屏没有「哪一列在接收方向键」这回事），直接全局找。
 */
async function realClickTimeOption(text) {
  const raw = await evaluate(`(() => {
    const want = ${JSON.stringify(text)};
    const active = document.querySelector('[data-slot="time-picker-wheel"][data-active="true"]');
    const scope = active || document;
    const el = [...scope.querySelectorAll('[data-slot="time-picker-wheel-item"]')].find(o => o.textContent.trim() === want);
    if (!el) return JSON.stringify({ error: 'OPT_NOT_FOUND:' + want });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  const base = { x: info.x, y: info.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  return 'OK';
}

/**
 * 按选择器真实点击（CDP Input）。用于没有 aria-label 的元素（如面包屑的祖先层）：
 * 返回 NOT_FOUND 而不抛错，好让「某一端没有这个元素」的场景（PC 没有抽屉头部）照常跑完。
 */
async function realClickSelector(selector) {
  const raw = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return JSON.stringify({ error: 'NOT_FOUND:' + ${JSON.stringify(selector)} });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  const base = { x: info.x, y: info.y, button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  return `OK @${info.x},${info.y}`;
}

/**
 * 真实按键（CDP Input 域，走浏览器完整键盘链路）。
 * 比在页面里 dispatchEvent 更有价值：合成事件绕过浏览器的默认行为与焦点判定，
 * 而「键盘巡航到底有没有生效」恰恰取决于焦点与默认行为。
 */
async function pressKey({ key, code, vk }) {
  const base = { key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
}

const KEYS = {
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  Enter: { key: 'Enter', code: 'Enter', vk: 13 },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
};

/**
 * 在某个滚动容器上发真实滚轮事件（CDP Input 域的 mouseWheel），滚过 `rows` 行。
 *
 * ⚠️ 不能改成 `el.scrollTop = n`：那样只改 DOM，
 *   ① scroll-snap 的重新吸附在程序化滚动下不保证执行；
 *   ② DatePicker 的滚轮靠「滚动停下 120ms 后回写草稿」工作，程序化改值会绕过。
 * 用真实滚轮事件，走的就是用户滚轮的那条路径。
 *
 * deltaY 按**实测行高**算（不写死 44）：行高 token 改了，这里跟着变，
 * 否则「滚 3 行」会退化成「滚 2.7 行」而吸附断言一直是假通过。
 */
async function wheelScroll(selector, rows) {
  const raw = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return JSON.stringify({ error: 'NOT_FOUND:' + ${JSON.stringify(selector)} });
    const item = el.querySelector('[data-slot$="wheel-item"]');
    const h = item ? item.getBoundingClientRect().height : 0;
    if (!(h > 0)) return JSON.stringify({ error: 'ITEM_HEIGHT_ZERO' });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      deltaY: Math.round(h * ${rows}),
    });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  await send('Input.dispatchMouseEvent', {
    type: 'mouseWheel',
    x: info.x,
    y: info.y,
    deltaX: 0,
    deltaY: info.deltaY,
    pointerType: 'mouse',
  });
  return `OK Δ${info.deltaY} (=${rows}行) @${info.x},${info.y}`;
}

function scrollToSection(title) {
  return evaluate(`(() => {
    const h = [...document.querySelectorAll('h2')].find(e => e.textContent.includes(${JSON.stringify(title)}));
    if (!h) return 'NOT_FOUND';
    h.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -60);
    return 'OK';
  })()`);
}

/**
 * 读取真正的模式判定结果 + 关键几何，避免「只看图猜」。
 * 注意 JSON.stringify 会丢掉值为 undefined 的键 —— 而这正是有用信号：
 * 某个字段消失，说明该属性确实没被设置（P1 就是这样发现遮罩漏了 data-mode）。
 */
function probe(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const q = s => document.querySelector(s);
    const modeEl = q('[data-testid="mode"]');
    const dialog = q('[data-component="dialog"]');
    const toast = q('[data-slot="toast"]');
    const out = {
      label: ${JSON.stringify(label)},
      viewport: window.innerWidth + 'x' + window.innerHeight,
      modeChip: modeEl ? modeEl.textContent.trim() : null,
      pointerCoarse: matchMedia('(pointer: coarse)').matches,
      hoverNone: matchMedia('(hover: none)').matches,
      dialog: null,
      toast: null,
    };
    if (dialog) {
      const r = dialog.getBoundingClientRect();
      const cs = getComputedStyle(dialog);
      out.dialog = {
        variant: dialog.dataset.variant,
        mode: dialog.dataset.mode,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        bottomGap: px(window.innerHeight - r.bottom),
        radius: cs.borderTopLeftRadius,
        position: cs.position,
      };
    }
    if (toast) {
      const r = toast.getBoundingClientRect();
      out.toast = {
        mode: toast.dataset.mode,
        type: toast.dataset.type,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        bg: getComputedStyle(toast.firstElementChild || toast).backgroundColor,
        radius: getComputedStyle(toast.firstElementChild || toast).borderTopLeftRadius,
      };
    }
    // 弹出层锚定位置（排除 Dialog 内部复用的 Popup，只看独立示例）
    const popup = [...document.querySelectorAll('[data-slot="popup"]')].find(
      (p) => !p.closest('[data-component="dialog"]'),
    );
    if (popup) {
      const r = popup.getBoundingClientRect();
      const leftGap = r.x;
      const rightGap = window.innerWidth - r.right;
      // 行是否被挤到折行：面板太窄时文字换行会把行撑高。
      // 用「行高最小值」自校准，不写死 48/36（不同组件行高不同，写死会误判）。
      const rows = [...popup.querySelectorAll('[data-slot="cell"]')].map(el =>
        Math.round(el.getBoundingClientRect().height),
      );
      const minRow = rows.length ? Math.min(...rows) : 0;
      // 内容超高时，面板必须封顶、多余部分交给内部滚动容器（而不是把面板撑出视口）
      const scroller = popup.querySelector('[data-bv-scroll-container]');
      out.popup = {
        resolved: popup.dataset.positionResolved,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        // 居中判据：两侧留白相等。shrink-to-fit 若按 left-1/2 收缩，rightGap 会远大于 leftGap
        leftGap: px(leftGap), rightGap: px(rightGap),
        centered: Math.abs(leftGap - rightGap) < 1,
        // 面板占视口宽度比。居中形态应按内容收缩并受 --bv-popup-center-max-width 封顶
        wPct: Math.round((r.width / window.innerWidth) * 1000) / 10,
        maxWidth: getComputedStyle(popup).maxWidth,
        maxHeight: getComputedStyle(popup).maxHeight,
        // 溢出判据：面板上下沿越出视口 —— max-height 缺失时的直接症状
        overflowTop: r.top < -0.5,
        overflowBottom: r.bottom > window.innerHeight + 0.5,
        scroll: scroller
          ? {
              clientHeight: Math.round(scroller.clientHeight),
              scrollHeight: Math.round(scroller.scrollHeight),
              scrollable: scroller.scrollHeight > scroller.clientHeight + 1,
            }
          : null,
        minRowHeight: minRow,
        rowHeights: rows,
        wrappedRows: rows.filter(h => h > minRow + 1).length,
      };
    }
    out.toastCount = document.querySelectorAll('[data-slot="toast"]').length;

    // 遮罩：验证 portal 逃出 [data-mode] 后，pc/h5 的 token 覆盖是否仍然生效
    // H5 走 Popup 的 Overlay（overlay），PC 走 Radix 遮罩（dialog-overlay）
    const ov = q('[data-slot="overlay"]') || q('[data-slot="dialog-overlay"]');
    if (ov) {
      const cs = getComputedStyle(ov);
      out.overlay = {
        mode: ov.dataset.mode,
        bg: cs.backgroundColor,
        opacity: cs.opacity,
        zIndex: cs.zIndex,
      };
    }
    // 弹层圆角/时长：同样来自 modes.css 的模式覆盖
    const pu = q('[data-slot="popup"]');
    if (pu) {
      const cs = getComputedStyle(pu);
      out.popupTokens = {
        mode: pu.dataset.mode,
        radius: cs.borderTopLeftRadius,
        duration: cs.transitionDuration,
      };
    }
    return JSON.stringify(out);
  })()`);
}

/**
 * Select 探针：验证「两套交互范式」在计算样式层面真的分开了。
 * 重点看四组对比：
 *   1. 容器：PC 出现 select-panel（锚定浮层）vs H5 出现 popup（底部弹层）
 *   2. 行高：PC 36px vs H5 48px（同一个组件、同一组 props）
 *   3. 搜索框：两端都在（12 个选项，H5 过阈值、PC 无条件给）
 *   4. 键盘：PC 按键后 data-active 前移；H5 没有 data-active 概念
 */
function probeSelect(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const q = s => document.querySelector(s);
    const out = {
      label: ${JSON.stringify(label)},
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };

    // 取「已展开」的那个触发器，而不是 DOM 里的第一个 —— 页面上有 5 个 Select
    const trg =
      q('[data-slot="select-trigger"][aria-expanded="true"]') || q('[data-slot="select-trigger"]');
    if (!trg) { out.trigger = null; return JSON.stringify(out); }
    const tr = trg.getBoundingClientRect();
    const tcs = getComputedStyle(trg);
    out.trigger = {
      mode: trg.dataset.mode,
      expanded: trg.getAttribute('aria-expanded'),
      ariaLabel: trg.getAttribute('aria-label'),
      w: px(tr.width), h: px(tr.height),
      radius: tcs.borderTopLeftRadius,
      borderWidth: tcs.borderTopWidth,
      // H5 的下边线走 bv-hairline（::after 缩放模拟 0.5px），元素自身 border 恒为 0，
      // 因此必须读伪元素才能证明这条分隔线真的画出来了
      hairlineBottom: getComputedStyle(trg, '::after').borderBottomWidth,
    };

    // 容器分野：PC 走 Radix 锚定浮层，H5 走 Popup 底部弹层
    const panel = q('[data-slot="select-panel"]');
    const popup = q('[data-slot="popup"]');
    const shell = panel || popup;
    if (shell) {
      const r = shell.getBoundingClientRect();
      const cs = getComputedStyle(shell);
      out.shell = {
        slot: panel ? 'select-panel' : 'popup',
        mode: shell.dataset.mode,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        radius: cs.borderTopLeftRadius,
        // Radix 碰撞检测的结果：side 会因视口空间不足而从 bottom 翻成 top
        side: shell.dataset.side || null,
        align: shell.dataset.align || null,
        // 浮层动画：槽名与 utilities.css 的选择器不一致时会静默变成 none
        animation: cs.animationName + ' ' + cs.animationDuration,
        // 与触发器的主轴间距（翻到上方时，面板底 距 触发器顶）
        gapBelowTrigger: px(r.top - tr.bottom),
        gapAboveTrigger: px(tr.top - r.bottom),
        gapToViewportBottom: px(window.innerHeight - r.bottom),
      };
    }

    const list = q('[data-slot="select-list"]');
    if (list) {
      const cs = getComputedStyle(list);
      out.list = { maxHeight: cs.maxHeight, clientHeight: list.clientHeight };
    }

    const search = q('[data-slot="select-search-input"]');
    out.searchBox = search ? 'present' : 'absent';

    const rows = [...document.querySelectorAll('[data-slot="select-option"]')];
    out.optionCount = rows.length;
    if (rows[0]) {
      const cs = getComputedStyle(rows[0]);
      out.optionRow = {
        mode: rows[0].dataset.mode,
        h: px(rows[0].getBoundingClientRect().height),
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      };
    }

    const active = q('[data-slot="select-option"][data-active="true"]');
    out.activeValue = active ? active.dataset.value : null;
    out.disabledRowHeight = (() => {
      const d = rows.find(r => r.disabled);
      return d ? px(d.getBoundingClientRect().height) : null;
    })();

    return JSON.stringify(out);
  })()`);
}

/**
 * DropdownMenu 探针：验证「整层推入 vs 向右展开」两套导航范式真的分开了。
 * 四组对比：
 *   1. 容器：PC 出现 menu-panel（锚定浮层）vs H5 出现 popup + menu-layer（底部抽屉）
 *   2. 行高：PC 36px vs H5 48px（同一个组件、同一组 props）
 *   3. 快捷键提示：PC 渲染成 kbd（⌘E/⌘D）vs H5 不渲染
 *   4. 下钻：H5 面板层数 +1、轨道左移一整屏、头部铺出层级链（左键是「取消」，
 *            不再有返回箭头 —— 回头靠链上点名）；PC 出现独立浮层 menu-subpanel
 *            （side=right）且父层仍在原地
 */
function probeMenu(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const q = s => document.querySelector(s);
    const out = {
      label: ${JSON.stringify(label)},
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };

    // 取「已展开」的那个触发器：页面上有 3 个菜单实例
    const trg =
      q('[data-slot="menu-trigger"][aria-expanded="true"]') || q('[data-slot="menu-trigger"]');
    if (!trg) { out.trigger = null; return JSON.stringify(out); }
    const tr = trg.getBoundingClientRect();
    const tcs = getComputedStyle(trg);
    out.trigger = {
      mode: trg.dataset.mode,
      expanded: trg.getAttribute('aria-expanded'),
      ariaLabel: trg.getAttribute('aria-label'),
      w: px(tr.width), h: px(tr.height),
      radius: tcs.borderTopLeftRadius,
      borderWidth: tcs.borderTopWidth,
      hairlineBottom: getComputedStyle(trg, '::after').borderBottomWidth,
      // 展开态箭头翻转（两端一致：表达的是展开态而非展开方向）
      indicatorTransform: getComputedStyle(q('[data-slot="menu-trigger-indicator"]')).transform,
      // 层级回显：嵌套选中时触发器必须带祖先槽与分隔符（只回填裸 label 时前者为空数组）
      pathAncestors: [...trg.querySelectorAll('[data-slot="menu-trigger-path-ancestor"]')].map(n => n.textContent),
      pathSeparators: trg.querySelectorAll('[data-slot="menu-trigger-path-separator"]').length,
      pathCurrent: trg.querySelector('[data-slot="menu-trigger-path-current"]')?.textContent ?? null,
      pathAncestorColor: (() => {
        const a = trg.querySelector('[data-slot="menu-trigger-path-ancestor"]');
        return a ? getComputedStyle(a).color : null;
      })(),
    };

    // 容器分野
    const panel = q('[data-slot="menu-panel"]');
    const popup = q('[data-slot="popup"]');
    const shell = panel || popup;
    if (shell) {
      const r = shell.getBoundingClientRect();
      const cs = getComputedStyle(shell);
      out.shell = {
        slot: panel ? 'menu-panel' : 'popup',
        mode: shell.dataset.mode,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        radius: cs.borderTopLeftRadius,
        side: shell.dataset.side || null,
        animation: cs.animationName + ' ' + cs.animationDuration,
        gapBelowTrigger: px(r.top - tr.bottom),
        gapToViewportBottom: px(window.innerHeight - r.bottom),
      };
    }

    // H5 的值栈：面板层数、当前层深度、轨道位移、头部层级行与两侧按钮
    const layers = [...document.querySelectorAll('[data-slot="menu-layer"]')];
    out.layers = layers.length;
    out.layerDepths = layers.map(l => l.dataset.depth);
    const track = q('[data-slot="menu-track"]');
    if (track) out.trackTransform = getComputedStyle(track).transform;
    // 头部是共享零件 PanelHeader（menu-title/menu-back 旧槽名已废弃）：
    // 左键 H5 菜单统一是「取消」（暂存确认时才有），back 槽不再被菜单占用
    const title = q('[data-slot="panel-header-title"]');
    out.headerTitle = title ? title.textContent : null;
    out.header = {
      back: Boolean(q('[data-slot="panel-header-back"]')),
      cancel: Boolean(q('[data-slot="panel-header-cancel"]')),
      confirm: Boolean(q('[data-slot="panel-header-confirm"]')),
    };
    // 头部层级面包屑：每层都铺 —— 根层是一格面板名，下钻后是
    // 「进来时点的那一项 → 当前层的选中项」。链上第 i 项就是第 i 层的选中值，
    // 因而**每一项都是可点的 button**（点它落回那一层），末项额外带 aria-current
    // 表示「当前落点」；只有根层那一格没有 onSelect，渲染成不可点的当前项。
    const crumbNav = q('[data-slot="panel-header-breadcrumb"]');
    const crumbNodes = crumbNav
      ? [...crumbNav.querySelectorAll('[data-slot="panel-header-crumb"], [data-slot="panel-header-crumb-current"]')]
      : [];
    out.headerCrumbs = crumbNodes.map(n => n.textContent);
    out.headerCrumbTags = crumbNodes.map(n => n.tagName.toLowerCase());
    out.headerCrumbColors = crumbNodes.map(n => getComputedStyle(n).color);
    out.headerCrumbSeparators = crumbNav
      ? crumbNav.querySelectorAll('[data-slot="panel-header-crumb-separator"]').length
      : 0;
    // 层数多或层名长时头部要能横向滚，否则当前层被挤出视野、用户反而不知道自己在哪
    out.headerCrumbScroll = crumbNav
      ? { clientWidth: px(crumbNav.clientWidth), scrollWidth: px(crumbNav.scrollWidth) }
      : null;
    // 层级行必须**独占工具栏行下方一行**、左对齐、且是紧凑的「选1/选2/当前」格式。
    // 三项症状级指标（jsdom 不做布局，只有真机能量）：
    //   belowBar  —— 行的 top 是否落在工具栏行之下（还是又和按钮挤回同一行）
    //   startsAtLeft —— 首项文案离面板左边缘的距离 = 左内边距（居中时会是半个面板宽）
    //   separatorGaps —— 分隔符与两侧文案的间隙应恒为 0（给了内边距这条链就散成几段）
    const bar = q('[data-slot="panel-header-bar"]');
    if (crumbNav && bar) {
      const barRect = bar.getBoundingClientRect();
      const navRect = crumbNav.getBoundingClientRect();
      const firstCrumb = crumbNodes[0];
      const seps = [...crumbNav.querySelectorAll('[data-slot="panel-header-crumb-separator"]')];
      const gap = (a, b) => (a && b ? px(b.getBoundingClientRect().left - a.getBoundingClientRect().right) : null);
      out.headerCrumbRow = {
        belowBar: navRect.top >= barRect.bottom - 1,
        barBottom: px(barRect.bottom), top: px(navRect.top), height: px(navRect.height),
        startsAtLeft: firstCrumb ? px(firstCrumb.getBoundingClientRect().left - navRect.left) : null,
        separatorGaps: seps.map(s => gap(s.previousElementSibling, s)),
      };
    } else {
      out.headerCrumbRow = null;
    }
    // 非当前层必须已从无障碍树摘掉，否则读屏会把看不见的那层也念出来
    out.hiddenLayers = layers.filter(l => l.getAttribute('aria-hidden') === 'true').length;

    // PC 的子菜单：独立浮层、右展、父层不动
    const sub = q('[data-slot="menu-subpanel"]');
    if (sub) {
      const sr = sub.getBoundingClientRect();
      const scs = getComputedStyle(sub);
      out.subpanel = {
        side: sub.dataset.side || null,
        x: px(sr.x), y: px(sr.y), w: px(sr.width), h: px(sr.height),
        radius: scs.borderTopLeftRadius,
        animation: scs.animationName + ' ' + scs.animationDuration,
        parentStillThere: Boolean(panel),
      };
    } else {
      out.subpanel = 'absent';
    }

    const rows = [...document.querySelectorAll('[data-slot="menu-row"]')];
    out.rowCount = rows.length;
    // 可选值场景：当前打勾的行（暂存模式下勾的是草稿，不是已提交值）
    out.selectedRow = q('[data-slot="menu-row"][data-selected="true"]')?.dataset.value ?? null;
    // 「打开即定位」：展开后是否已经停在选中项所在的那一层，且选中行落在视野里。
    // 深度两端的来源不同 —— H5 是面板栈的层序（menu-layer 的 data-depth），
    // PC 是铺开的子菜单链长度（同层只开一条，所以开着的 subpanel 数就是深度）。
    out.selectedDepth = null;
    out.selectedInView = null;
    const selRow = q('[data-slot="menu-row"][data-selected="true"]');
    if (selRow) {
      const ownerLayer = selRow.closest('[data-slot="menu-layer"]');
      out.selectedDepth = ownerLayer
        ? Number(ownerLayer.dataset.depth)
        : document.querySelectorAll('[data-slot="menu-subpanel"]').length;
      // 滚动容器：H5 是 menu-viewport，PC 是面板自身（子菜单在 Portal 里，取 subpanel）
      const scroller = selRow.closest(
        '[data-slot="menu-viewport"], [data-slot="menu-subpanel"], [data-slot="menu-panel"]',
      );
      if (scroller) {
        const rr = selRow.getBoundingClientRect();
        const cr = scroller.getBoundingClientRect();
        // 容 1px 亚像素误差：只要整行落在容器可视区内就算「看得到」
        out.selectedInView = rr.top >= cr.top - 1 && rr.bottom <= cr.bottom + 1;
      }
    }
    const current = layers.length ? layers[layers.length - 1] : panel;
    // 分隔线只算当前这一层里的：下钻后 DOM 里同时存在多层，全局数会虚高
    out.dividerCount = current
      ? current.querySelectorAll('[data-slot="menu-divider"]').length
      : document.querySelectorAll('[data-slot="menu-divider"]').length;
    if (rows[0]) {
      const cs = getComputedStyle(rows[0]);
      out.row = {
        mode: rows[0].dataset.mode,
        h: px(rows[0].getBoundingClientRect().height),
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
      };
    }
    // 危险项与禁用项：比色，别比类名（类名在，规则可能没生成）。
    // 禁用项的取法两端不同：H5 是自己的 <button disabled>，PC 是 Radix 的 div
    // （只带 data-disabled 属性，没有 .disabled 这个 DOM 属性）。
    const danger = rows.find(r => r.dataset.danger === 'true');
    out.dangerColor = danger ? getComputedStyle(danger).color : null;
    const disabled = rows.find(r => r.disabled) || rows.find(r => r.dataset.disabled !== undefined);
    out.disabledColor = disabled ? getComputedStyle(disabled).color : null;

    const shortcuts = [...document.querySelectorAll('[data-slot="menu-row-shortcut"]')].map(
      k => k.textContent,
    );
    out.shortcuts = shortcuts;
    out.submenuArrows = document.querySelectorAll('[data-slot="menu-row-submenu"]').length;

    return JSON.stringify(out);
  })()`);
}

/**
 * 触发器层级回显探针：只量**回填**，与展开态无关，因此按 aria-label 精确取目标触发器
 * （页面上有 3 个菜单实例，靠「已展开」筛选在未展开时会拿到错的那个）。
 *
 * 判据：嵌套选中（移动到 / 项目文档）必须带祖先槽与分隔符，且祖先色是弱化后的
 * --bv-text-2。只回填裸 label 时 pathAncestors 为空数组、pathSeparators 为 0 ——
 * 这条断言回答的是「选中的是哪一层里的哪一项」。两端共享同一份回填逻辑与同一组 class，
 * 所以两端的取值应当逐项一致。
 */
function probeTriggerPath(label, ariaLabel) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const trg = [...document.querySelectorAll('[data-slot="menu-trigger"]')]
      .find(t => t.getAttribute('aria-label') === ${JSON.stringify(ariaLabel)});
    if (!trg) return JSON.stringify({ label: ${JSON.stringify(label)}, trigger: null });

    const tr = trg.getBoundingClientRect();
    const ancestors = [...trg.querySelectorAll('[data-slot="menu-trigger-path-ancestor"]')];
    const separator = trg.querySelector('[data-slot="menu-trigger-path-separator"]');
    const current = trg.querySelector('[data-slot="menu-trigger-path-current"]');

    return JSON.stringify({
      label: ${JSON.stringify(label)},
      mode: trg.dataset.mode,
      text: trg.textContent,
      w: px(tr.width),
      pathAncestors: ancestors.map(n => n.textContent),
      pathSeparators: trg.querySelectorAll('[data-slot="menu-trigger-path-separator"]').length,
      pathCurrent: current ? current.textContent : null,
      ancestorColor: ancestors[0] ? getComputedStyle(ancestors[0]).color : null,
      currentColor: current ? getComputedStyle(current).color : null,
      separatorMarginX: separator ? getComputedStyle(separator).marginLeft : null,
    });
  })()`);
}

/**
 * DatePicker 探针（P2 第三种模式 C）：验证「三列滚轮 vs 月历」两套交互真的分开了。
 *
 * 五组对比，全部取**症状级**指标而不是原始尺寸：
 *   1. 容器：PC 出现 date-picker-panel（锚定浮层）vs H5 出现 popup（底部弹层，贴底）
 *   2. 触发器：PC 单值可输入（input 存在）vs H5 是纯文本；H5 触发器下边线走
 *      bv-hairline（::after 缩放，元素自身 border 恒为 0 → 必须读伪元素）
 *   3. 选择器：PC 一个/两个 6×7 月历网格（range 并排双月）vs H5 N 列滚轮
 *      （每列 5 行制：容器高 = 5×行高、上下各留 2 行 padding、吸附类型 y mandatory）
 *   4. 区间入口：H5 多一条「开始/结束」两段式切换 vs PC 靠并排双月
 *   5. 键盘：PC 有 data-active 光标（方向键移动）；H5 没有这个概念
 *
 * 行高一律用**实测最小值自校准**（不要写死 44/32）：token 改了值之后，
 * 探针如果还按旧值断言「对齐」，就会从「发现回归」退化成「永远通过」。
 */
function probeDate(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const q = s => document.querySelector(s);
    const all = s => [...document.querySelectorAll(s)];
    const out = {
      label: ${JSON.stringify(label)},
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };

    // 取「已展开」的那个触发器：页面上有 3 个 DatePicker，按第一份量会串味（与 Select 同一条教训）
    const trg =
      q('[data-slot="date-picker-trigger"][aria-expanded="true"]') || q('[data-slot="date-picker-trigger"]');
    if (!trg) { out.trigger = null; return JSON.stringify(out); }

    const tr = trg.getBoundingClientRect();
    const tcs = getComputedStyle(trg);
    const indicator = trg.querySelector('[data-slot="date-picker-trigger-indicator"]');
    out.trigger = {
      mode: trg.dataset.mode,
      expanded: trg.getAttribute('aria-expanded'),
      ariaLabel: trg.getAttribute('aria-label'),
      text: trg.textContent,
      w: px(tr.width), h: px(tr.height),
      radius: tcs.borderTopLeftRadius,
      borderWidth: tcs.borderTopWidth,
      hairlineBottom: getComputedStyle(trg, '::after').borderBottomWidth,
      editable: !!trg.querySelector('[data-slot="date-picker-trigger-input"]'),
      // 可输入形态（PC 单值）的值在 input.value 上，textContent 恒为空字符串 +
      // 清除按钮 + 指示图标 —— 只看 textContent 会把「已提交」误判成「没值」
      inputValue: (() => {
        const i = trg.querySelector('[data-slot="date-picker-trigger-input"]');
        return i ? i.value : null;
      })(),
      clearBtn: !!trg.querySelector('[data-slot="date-picker-trigger-clear"]'),
      // 展开时翻转 180°，断言的是 transform 里出现了旋转矩阵（rotate-180）
      indicatorTransform: indicator ? getComputedStyle(indicator).transform : null,
    };

    // 容器分野：H5 的面板嵌在 popup 里（底部弹层），PC 的面板自己就是浮层
    const panelEl = q('[data-slot="date-picker-panel"]');
    const popupEl = panelEl ? panelEl.closest('[data-slot="popup"]') : null;
    const shell = popupEl || panelEl;
    if (shell) {
      const r = shell.getBoundingClientRect();
      const cs = getComputedStyle(shell);
      out.shell = {
        slot: popupEl ? 'popup' : 'date-picker-panel',
        mode: shell.dataset.mode,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        radius: cs.borderTopLeftRadius,
        // 「贴底」是 H5 底部弹层的判据；PC 应当有明显余量
        gapToViewportBottom: px(window.innerHeight - r.bottom),
        leftGap: px(r.left),
        rightGap: px(window.innerWidth - r.right),
        centered: Math.abs(r.left - (window.innerWidth - r.right)) <= 1,
        animation: cs.animationName + ' ' + cs.animationDuration,
        gapBelowTrigger: px(r.top - tr.bottom),
      };
      const names = [
        '--bv-date-picker-wheel-item-height',
        '--bv-date-picker-pc-panel-width',
        '--bv-date-picker-pc-cell-height',
        '--bv-date-picker-pc-dual-gap',
      ];
      out.tokens = Object.fromEntries(names.map(n => [n, cs.getPropertyValue(n).trim()]));
    }

    // ---- H5：滚轮列 ----
    out.wheels = all('[data-slot="date-picker-wheel"]').map(w => {
      const scroller = w.querySelector('[data-slot="date-picker-wheel-scroller"]');
      const items = [...w.querySelectorAll('[data-slot="date-picker-wheel-item"]')];
      const heights = items.map(i => i.getBoundingClientRect().height).filter(h => h > 0);
      // 最小值自校准：不写死行高，token 改了这里跟着变
      const itemH = heights.length ? Math.min(...heights) : 0;
      const wh = w.getBoundingClientRect().height;
      const sel = items.find(i => i.dataset.selected === 'true');
      const other = items.find(i => i.dataset.selected !== 'true');
      const ind = w.querySelector('[data-slot="date-picker-wheel-indicator"]');
      const mask = w.querySelector('[data-slot="date-picker-wheel-mask"]');
      const ics = ind ? getComputedStyle(ind) : null;
      return {
        label: w.getAttribute('aria-label'),
        h: px(wh),
        itemH: px(itemH),
        // 5 行制：容器高应当正好是行高的 5 倍
        visibleRows: itemH > 0 ? px(wh / itemH) : null,
        count: items.length,
        selected: sel ? sel.textContent : null,
        selectedBold: sel ? getComputedStyle(sel).fontWeight : null,
        selectedColor: sel ? getComputedStyle(sel).color : null,
        otherColor: other ? getComputedStyle(other).color : null,
        // 吸附三件套：类名丢了不会报错，只会「滚到哪停哪」，只能这样验
        snapType: scroller ? getComputedStyle(scroller).scrollSnapType : null,
        itemSnapAlign: items[0] ? getComputedStyle(items[0]).scrollSnapAlign : null,
        padTop: scroller ? getComputedStyle(scroller).paddingTop : null,
        scrollTop: scroller ? px(scroller.scrollTop) : null,
        // 兜底对齐的判据：非 0 说明停在两行之间
        snapRemainder: scroller && itemH > 0 ? px(scroller.scrollTop % itemH) : null,
        indicatorTop: ics ? ics.top : null,
        indicatorH: ind ? px(ind.getBoundingClientRect().height) : null,
        indicatorHairline: ics ? ics.borderTopWidth : null,
        // 上下渐隐遮罩：渐变没生成时拿到的是 none
        maskGradient: mask ? getComputedStyle(mask).backgroundImage.slice(0, 56) : null,
      };
    });

    out.rangeTabs = all('[data-slot="date-picker-range-tab"]').map(t => ({
      label: t.getAttribute('aria-label'),
      active: t.dataset.active === 'true',
      text: t.querySelector('[data-slot="date-picker-range-tab-value"]').textContent,
    }));

    const confirm = q('[data-slot="panel-header-confirm"]');
    out.toolbar = confirm
      ? {
          confirmDisabled: confirm.disabled,
          confirmText: confirm.textContent,
          cancelText: (q('[data-slot="panel-header-cancel"]') || {}).textContent || null,
          title: (q('[data-slot="panel-header-title"]') || {}).textContent || null,
        }
      : null;

    // ---- PC：月历面板 ----
    out.months = all('[data-slot="date-picker-month-panel"]').map(m => {
      const rows = [...m.querySelectorAll('[data-slot="date-picker-week"]')];
      const cells = [...m.querySelectorAll('[data-slot="date-picker-cell"]')];
      const heights = cells.map(c => c.getBoundingClientRect().height).filter(h => h > 0);
      const cellH = heights.length ? Math.min(...heights) : 0;
      const activeCell = cells.find(c => c.dataset.active === 'true');
      return {
        label: m.getAttribute('aria-label'),
        title: m.querySelector('[data-slot="date-picker-month-title"]').textContent,
        w: px(m.getBoundingClientRect().width),
        rows: rows.length,
        colsPerRow: rows[0] ? rows[0].children.length : 0,
        cells: cells.length,
        cellH: px(cellH),
        cellFontSize: cells[0] ? getComputedStyle(cells[0]).fontSize : null,
        cellLineHeight: cells[0] ? getComputedStyle(cells[0]).lineHeight : null,
        weekdayCount: m.querySelectorAll('[data-slot="date-picker-weekday"]').length,
        disabledCount: cells.filter(c => c.disabled).length,
        selectedTexts: cells.filter(c => c.dataset.selected === 'true').map(c => c.textContent),
        // 区间带：中间格的底色由 data-in-range 标出（端点由 data-selected）
        inRangeCount: cells.filter(c => c.dataset.inRange === 'true').length,
        inRangeBg: (() => {
          const cell = cells.find(c => c.dataset.inRange === 'true');
          return cell ? getComputedStyle(cell).backgroundColor : null;
        })(),
        activeText: activeCell ? activeCell.textContent : null,
      };
    });
    if (out.months.length > 1) {
      // 双月之间的实际间距（token --bv-date-picker-pc-dual-gap，默认 0：两月共边框）
      const panels = all('[data-slot="date-picker-month-panel"]');
      out.dualGap = px(panels[1].getBoundingClientRect().left - panels[0].getBoundingClientRect().right);
    }

    return JSON.stringify(out);
  })()`);
}

/**
 * TimePicker 探针（与 DatePicker 同族）：验证「两端同一套滚轮交互、只换外壳」这件事真的成立。
 *
 * 五组指标，全部取**症状级**指标而不是原始尺寸：
 *   1. 容器：H5 出现 popup（底部弹层，贴底）、滚轮行嵌在它里面；PC 出现 time-picker-panel（锚定浮层，与视口底有明显余量）
 *   2. 触发器：两端都有 time-picker-trigger（data-mode/clear/indicator）；H5 触发器下边线走 bv-hairline（::after），元素自身 border 恒为 0
 *   3. 选择器：**两端都是 time-picker-wheel**（role=listbox，含 scroller + snap + 中央高亮带 + 上下渐隐遮罩）——
 *      这条是「同范式」的判据；2026-09-23 之前 PC 侧是 time-picker-list，探针会在这里报出 0 个滚轮
 *   4. 区间入口：两端都复用 time-picker-range-tab 两段式（开始/结束）—— 与 DatePicker 不同，不靠并排双列
 *   5. 键盘面：PC 有「方向键正在驾驶哪一列」的 data-active（该列高亮带叠底色），H5 没有这个概念；
 *      且滚轮项 tabIndex=-1（Tab 不去逐个走 60 个数字，键盘面归浮层）
 *   6. 高亮带的 z 序必须低于滚动容器：那一列的底气是不透明的，压在上面会把居中数字整块盖住
 *      （`bandUnderDigits`）—— 这条 DOM 结构正确、单测全绿，只有真机截图才看得出来
 *
 * 行高一律用**实测最小值自校准**（不要写死 44/32）：token 改了值之后，探针如果还按旧值断言就会退化成永远通过。
 */
function probeTime(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const q = s => document.querySelector(s);
    const all = s => [...document.querySelectorAll(s)];
    const out = {
      label: ${JSON.stringify(label)},
      viewport: window.innerWidth + 'x' + window.innerHeight,
    };

    // 取「已展开」的那个触发器：页面上有多个 TimePicker，按第一份量会串味
    const trg =
      q('[data-slot="time-picker-trigger"][aria-expanded="true"]') || q('[data-slot="time-picker-trigger"]');
    if (!trg) { out.trigger = null; return JSON.stringify(out); }

    const tr = trg.getBoundingClientRect();
    const tcs = getComputedStyle(trg);
    const indicator = trg.querySelector('[data-slot="time-picker-trigger-indicator"]');
    out.trigger = {
      mode: trg.dataset.mode,
      expanded: trg.getAttribute('aria-expanded'),
      ariaLabel: trg.getAttribute('aria-label'),
      text: trg.textContent,
      w: px(tr.width), h: px(tr.height),
      radius: tcs.borderTopLeftRadius,
      borderWidth: tcs.borderTopWidth,
      hairlineBottom: getComputedStyle(trg, '::after').borderBottomWidth,
      clearBtn: !!trg.querySelector('[data-slot="time-picker-trigger-clear"]'),
      // 展开时翻转 180°，断言的是 transform 里出现了旋转矩阵（rotate-180）
      indicatorTransform: indicator ? getComputedStyle(indicator).transform : null,
    };

    // 容器分野：H5 的滚轮行嵌在 popup 里（底部弹层），PC 的浮层自己就是容器
    const rowEl = q('[data-slot="time-picker-wheels"]');
    const popupEl = rowEl ? rowEl.closest('[data-slot="popup"]') : null;
    const panelEl = q('[data-slot="time-picker-panel"]');
    const shell = popupEl || panelEl || rowEl;
    if (shell) {
      const r = shell.getBoundingClientRect();
      const cs = getComputedStyle(shell);
      out.shell = {
        slot: popupEl ? 'popup' : 'time-picker-panel',
        mode: shell.dataset.mode,
        x: px(r.x), y: px(r.y), w: px(r.width), h: px(r.height),
        radius: cs.borderTopLeftRadius,
        // 「贴底」是 H5 底部弹层的判据；PC 应当有明显余量
        gapToViewportBottom: px(window.innerHeight - r.bottom),
        leftGap: px(r.left),
        rightGap: px(window.innerWidth - r.right),
        centered: Math.abs(r.left - (window.innerWidth - r.right)) <= 1,
        animation: cs.animationName + ' ' + cs.animationDuration,
        gapBelowTrigger: px(r.top - tr.bottom),
      };
      const names = [
        '--bv-time-picker-wheel-item-height',
        '--bv-time-picker-pc-trigger-height',
        '--bv-time-picker-pc-panel-width',
      ];
      out.tokens = Object.fromEntries(names.map(n => [n, cs.getPropertyValue(n).trim()]));
    }

    // ---- 两端的滚轮列（同范式判据）----
    out.wheels = all('[data-slot="time-picker-wheel"]').map(w => {
      const scroller = w.querySelector('[data-slot="time-picker-wheel-scroller"]');
      const items = [...w.querySelectorAll('[data-slot="time-picker-wheel-item"]')];
      const heights = items.map(i => i.getBoundingClientRect().height).filter(h => h > 0);
      // 最小值自校准：不写死行高，token 改了这里跟着变
      const itemH = heights.length ? Math.min(...heights) : 0;
      const wh = w.getBoundingClientRect().height;
      const sel = items.find(i => i.dataset.selected === 'true');
      const other = items.find(i => i.dataset.selected !== 'true');
      const ind = w.querySelector('[data-slot="time-picker-wheel-indicator"]');
      const mask = w.querySelector('[data-slot="time-picker-wheel-mask"]');
      const ics = ind ? getComputedStyle(ind) : null;
      return {
        mode: w.dataset.mode,
        label: w.getAttribute('aria-label'),
        keyboardColumn: w.dataset.active === 'true',
        h: px(wh),
        itemH: px(itemH),
        // 5 行制：容器高应当正好是行高的 5 倍
        visibleRows: itemH > 0 ? px(wh / itemH) : null,
        count: items.length,
        selected: sel ? sel.textContent : null,
        selectedBold: sel ? getComputedStyle(sel).fontWeight : null,
        selectedColor: sel ? getComputedStyle(sel).color : null,
        otherColor: other ? getComputedStyle(other).color : null,
        // 吸附三件套：类名丢了不会报错，只会「滚到哪停哪」，只能这样验
        snapType: scroller ? getComputedStyle(scroller).scrollSnapType : null,
        itemSnapAlign: items[0] ? getComputedStyle(items[0]).scrollSnapAlign : null,
        padTop: scroller ? getComputedStyle(scroller).paddingTop : null,
        scrollTop: scroller ? px(scroller.scrollTop) : null,
        // 兜底对齐的判据：非 0 说明停在两行之间
        snapRemainder: scroller && itemH > 0 ? px(scroller.scrollTop % itemH) : null,
        indicatorH: ind ? px(ind.getBoundingClientRect().height) : null,
        indicatorHairline: ics ? ics.borderTopWidth : null,
        // 键盘所在列的高亮带会叠一层底色（PC 的「方向键在驾驶这一列」提示）
        indicatorBg: ics ? ics.backgroundColor : null,
        // 带子必须画在数字**下面**：键盘所在列的底气是不透明的，一旦压在上面，
        // 该列居中的数字会被整块盖住 —— 这条只看 z 序，是唯一能用 DOM 抓到的判据
        bandZ: ics ? ics.zIndex : null,
        scrollerZ: scroller ? getComputedStyle(scroller).zIndex : null,
        bandUnderDigits: !!ics && !!scroller && Number(ics.zIndex) < Number(getComputedStyle(scroller).zIndex),
        // 上下渐隐遮罩：渐变没生成时拿到的是 none
        maskGradient: mask ? getComputedStyle(mask).backgroundImage.slice(0, 56) : null,
        // 键盘面归浮层：滚轮项不进 Tab 流
        firstItemTabIndex: items[0] ? items[0].tabIndex : null,
      };
    });

    out.rangeTabs = all('[data-slot="time-picker-range-tab"]').map(t => ({
      label: t.getAttribute('aria-label'),
      active: t.dataset.active === 'true',
      text: t.querySelector('[data-slot="time-picker-range-tab-value"]').textContent,
    }));

    // PC 底部「取消 / 确定」条：确定的存在性与可点性（单值恒可点；区间要两端都选且开始 < 结束）
    const confirmBtn = q('[data-slot="time-picker-confirm"]');
    if (confirmBtn) {
      out.confirm = {
        disabled: confirmBtn.disabled,
        hint: !!q('[data-slot="time-picker-range-hint"]'),
      };
    }

    return JSON.stringify(out);
  })()`);
}

/**
 * Rate 探针（模式 C，两端同形、差异只在交互）。
 *
 * 判据要点：
 *   - 实心星是**按比例裁切**的（`rate-star-fill` 宽度 / 星宽 = fraction），
 *     所以半星必须量到 ≈0.5 而不是「画了半个 glyph」；
 *   - `aria-valuenow` 在 PC 上跟随 **hover 预览值**（不只跟随受控值），
 *     移出后应还原 —— 这是 PC 独有的交互，两端探针输出不同属预期；
 *   - H5 的 `rate-hit` 热区应把可点区域从 20px 外扩到 ≈44px。
 */
function probeRate(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const out = { label: ${JSON.stringify(label)}, viewport: window.innerWidth + 'x' + window.innerHeight };

    // 触摸热区靠 pointer:coarse 媒体查询，而 mobile:true 只改视口宽度、
    // 不会让这条媒体查询成立 —— 不显式量出来就会「模式对、热区静默失效」。
    out.pointerCoarse = matchMedia('(pointer: coarse)').matches;

    // allowHalf 只能从渲染结果反推：半星会让某颗 fill 恰好占 0.5。
    const allowHalfOf = (items) =>
      items.some((it) => {
        const f = it.querySelector('[data-slot="rate-star-fill"]');
        const sw = it.querySelector('[data-slot="rate-star"]');
        if (!f || !sw) return false;
        const a = f.getBoundingClientRect().width;
        const b = sw.getBoundingClientRect().width;
        return b > 0 && Math.abs(a / b - 0.5) < 0.02;
      });

    out.rates = [...document.querySelectorAll('[data-slot="rate"]')].map(root => {
      const r = root.getBoundingClientRect();
      const cs = getComputedStyle(root);
      const items = [...root.querySelectorAll('[data-slot="rate-item"]')];
      return {
        mode: root.dataset.mode,
        ariaLabel: root.getAttribute('aria-label'),
        role: root.getAttribute('role'),
        valueNow: root.getAttribute('aria-valuenow'),
        valueMax: root.getAttribute('aria-valuemax'),
        valueText: root.getAttribute('aria-valuetext'),
        disabled: root.dataset.disabled === 'true',
        readonly: root.dataset.readonly === 'true',
        // 键盘面：PC 容器可聚焦，H5 不可（触屏没有键盘）
        tabIndex: root.tabIndex,
        w: px(r.width), h: px(r.height),
        gap: cs.gap,
        itemCount: items.length,
        // 每颗星的填充比例（裁切宽度 / 星宽）
        fractions: items.map(it => {
          const star = it.querySelector('[data-slot="rate-star"]');
          const fill = it.querySelector('[data-slot="rate-star-fill"]');
          if (!star || !fill) return null;
          return px(fill.getBoundingClientRect().width / star.getBoundingClientRect().width);
        }),
        // 每颗星 5 点采样（最左/左半/正中/右半/最右）各自的**期望分数**。
        // ⚠️ 2026-10-19 补的真回归：先前用 44px 热区 + elementFromPoint，
        // 星间距只有 24px → 相邻热区重叠 20px，后一颗抢走前一颗的右半
        // （实测点第 1 颗的 x=55 / 右边缘 59.5 → 命中 star#2）。
        // 现已改为按坐标算分（Vant 同款），这条把命中边界钉死。
        // 半星模式下「正中」那一像素归左半是 Vant 同款的刻意行为（标 midline），
        // 核对时按 midline 放行，别当回归。
        hitSamples: (() => {
          const half = allowHalfOf(items);
          return items.map((it, i) => {
            const star = it.querySelector('[data-slot="rate-star"]').getBoundingClientRect();
            if (!(star.width > 0)) return null;
            return {
              i,
              left: px(star.left),
              width: px(star.width),
              pts: [
                ['L', star.left + 0.5],
                ['ML', star.left + star.width * 0.25],
                ['C', star.left + star.width * 0.5],
                ['MR', star.left + star.width * 0.75],
                ['R', star.left + star.width - 0.5],
              ].map(([tag, x]) => {
                const frac = (x - star.left) / star.width;
                return {
                  tag,
                  x: px(x),
                  expect: half ? (frac < 0.5 ? i + 0.5 : i + 1) : i + 1,
                  midline: Math.abs(frac - 0.5) < 0.02,
                };
              }),
            };
          });
        })(),
        tokens: (() => {
          const s = getComputedStyle(document.documentElement);
          return {
            iconSize: s.getPropertyValue('--bv-rate-icon-size').trim(),
            gutter: s.getPropertyValue('--bv-rate-icon-gutter').trim(),
            touchExpand: s.getPropertyValue('--bv-rate-touch-expand').trim(),
          };
        })(),
      };
    });
    return JSON.stringify(out);
  })()`);
}

/**
 * Slider 探针（模式 C）。
 *
 * 判据要点：
 *   - 填充条必须**真的有宽度** —— 早期实现用 `Math.min(...disp)` 当起端，
 *     单值滑块 size 恒为 0，整条轨道看上去是空的（类型/单测/build 三门全绿）；
 *   - 填充条起端是「锚端」不是拇指：单值时锚端在轨道零点，reverse 时改到对端；
 *   - 拇指的left% 应等于 `value/max`（reverse 取 1−r，竖直取 1−r 且落成 top%）。
 */
function probeSlider(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const out = { label: ${JSON.stringify(label)}, viewport: window.innerWidth + 'x' + window.innerHeight };

    out.pointerCoarse = matchMedia('(pointer: coarse)').matches;

    out.sliders = [...document.querySelectorAll('[data-slot="slider"]')].map(root => {
      const line = root.querySelector('[data-slot="slider-line"]');
      const rail = root.querySelector('[data-slot="slider-rail"]');
      const bar = root.querySelector('[data-slot="slider-bar"]');
      const thumbs = [...root.querySelectorAll('[data-slot="slider-button"]')];
      const lr = line ? line.getBoundingClientRect() : null;
      const vertical = root.dataset.orientation === 'vertical';
      return {
        mode: root.dataset.mode,
        orientation: root.dataset.orientation,
        ariaLabel: root.getAttribute('aria-label'),
        role: root.getAttribute('role'),
        disabled: root.dataset.disabled === 'true',
        readonly: root.dataset.readonly === 'true',
        trackW: lr ? px(lr.width) : null,
        trackH: lr ? px(lr.height) : null,
        // 填充条用实测量而非读内联 style：能同时抓住「宽度算错」与「样式没落地」
        barW: bar ? px(bar.getBoundingClientRect().width) : null,
        barH: bar ? px(bar.getBoundingClientRect().height) : null,
        barVisible: bar ? bar.getBoundingClientRect().width > 0 || bar.getBoundingClientRect().height > 0 : false,
        railBg: rail ? getComputedStyle(rail).backgroundColor : null,
        barBg: bar ? getComputedStyle(bar).backgroundColor : null,
        thumbs: thumbs.map(t => {
          const cs = getComputedStyle(t);
          const tr = t.getBoundingClientRect();
          return {
            idx: t.getAttribute('data-thumb'),
            ariaLabel: t.getAttribute('aria-label'),
            valueNow: t.getAttribute('aria-valuenow'),
            tabIndex: t.tabIndex,
            w: px(tr.width), h: px(tr.height),
            // 相对轨道的归一化位置（0~1），与方向无关
            pos: lr && (vertical
              ? px(lr.height ? 1 - (tr.top + tr.height / 2 - lr.top) / lr.height : 0)
              : px(lr.width ? (tr.left + tr.width / 2 - lr.left) / lr.width : 0)),
            bg: cs.backgroundColor,
            radius: cs.borderTopLeftRadius,
            // 触屏 44px 热区靠 ::after 外扩，hover 时才量得到 content 不变
            touchAction: cs.touchAction,
          };
        }),
      };
    });
    out.tokens = (() => {
      const s = getComputedStyle(document.documentElement);
      return {
        barHeight: s.getPropertyValue('--bv-slider-bar-height').trim(),
        buttonSize: s.getPropertyValue('--bv-slider-button-size').trim(),
        touchExpand: s.getPropertyValue('--bv-slider-touch-expand').trim(),
      };
    })();
    return JSON.stringify(out);
  })()`);
}

/**
 * 真实悬停（CDP Input 的mouseMoved）。
 *
 * 为什么不能派发合成事件：Rate PC 的 hover 预览挂在 `onPointerEnter` 上，
 * 而 hover 预览的核心断言是「预览值不同于受控值、移出后还原」——
 * 合成事件走完React 事件系统但不会触发浏览器的 hover 状态链，
 * 探针会量到「预览=受控值」而看起来一切正常。
 */
/**
 * Uploader 探针（场景 12）。
 * 量的是「静止态几何」：H5 应出现「+」宫格（uploader-add），
 * PC 应出现拖拽区（uploader-dropzone，带虚线边框）。上传中的文件
 * 需要 CDP setFileInputFiles 选真文件才能造出来，这里不覆盖；
 * 队列状态机由 vitest 双模式用例覆盖，几何/样式落地由本探针覆盖。
 */
function probeUploader(label) {
  return evaluate(`(() => {
    const px = v => Math.round(parseFloat(v) * 100) / 100;
    const out = { label: ${JSON.stringify(label)}, viewport: window.innerWidth + 'x' + window.innerHeight };
    out.uploaders = [...document.querySelectorAll('[data-slot="uploader"]')].map(root => {
      const add = root.querySelector('[data-slot="uploader-add"]');
      const zone = root.querySelector('[data-slot="uploader-dropzone"]');
      const ar = add ? add.getBoundingClientRect() : null;
      const zr = zone ? zone.getBoundingClientRect() : null;
      return {
        mode: root.dataset.mode,
        disabled: root.dataset.disabled === 'true',
        hasAddTile: !!add,
        hasDropZone: !!zone,
        addW: ar ? px(ar.width) : null,
        addH: ar ? px(ar.height) : null,
        zoneW: zr ? px(zr.width) : null,
        zoneH: zr ? px(zr.height) : null,
        zoneBorder: zone ? getComputedStyle(zone).borderTopStyle : null,
        gridCount: root.querySelectorAll('[data-slot="uploader-grid-item"]').length,
        listCount: root.querySelectorAll('[data-slot="uploader-list-item"]').length,
      };
    });
    return JSON.stringify(out);
  })()`);
}

async function hoverSelector(selector, dxRatio = 0.5) {
  const raw = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return JSON.stringify({ error: 'NOT_FOUND:' + ${JSON.stringify(selector)} });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.x + r.width * ${dxRatio}),
      y: Math.round(r.y + r.height / 2),
    });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info.x, y: info.y });
  return `OK @${info.x},${info.y}`;
}

/**
 * 在轨道上按下 → 横向拖到目标比例 → 松开（真实鼠标事件）。
 * `ratio` 是相对轨道起点的 0~1 位置；竖直轨道按纵向算。
 */
async function dragOnTrack(selector, ratio, vertical = false) {
  const raw = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return JSON.stringify({ error: 'NOT_FOUND:' + ${JSON.stringify(selector)} });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      tx: Math.round(r.x + r.width * ${ratio}),
      ty: Math.round(r.y + r.height * ${ratio}),
    });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  const from = { x: info.x, y: info.y };
  const to = vertical ? { x: info.x, y: info.ty } : { x: info.tx, y: info.y };
  const base = { button: 'left', clickCount: 1 };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...from });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, ...from });
  // 分两步移动：单步直达时 React 的 pointermove 合并可能漏掉中间态
  const mid = { x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2) };
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, ...mid });
  await sleep(80);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, ...to });
  await sleep(120);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, ...to });
  return `OK ${from.x},${from.y} -> ${to.x},${to.y}`;
}

/**
 * 在**第一个月历面板**里点/悬停第 k 个「本月可用」格子（真实鼠标事件）。
 *
 * 用序号而不是日期文本：日期取决于「今天」在哪个月，脚本跑在任何月份都要能用；
 * 写死 '2026-09-20' 的脚本会在下个月静默变成 CELL_MISSING 空跑。
 * 悬停用 mouseMoved（区间预览靠 onMouseEnter，必须真的移动指针，不能派发合成事件）。
 */
async function hitDateCell(action, k) {
  const raw = await evaluate(`(() => {
    const panel = document.querySelector('[data-slot="date-picker-month-panel"]');
    if (!panel) return JSON.stringify({ error: 'NO_MONTH_PANEL' });
    const cells = [...panel.querySelectorAll('[data-slot="date-picker-cell"]')]
      .filter(c => c.dataset.outside !== 'true' && !c.disabled);
    const el = cells[${k}];
    if (!el) return JSON.stringify({ error: 'CELL#' + ${k} + '_MISSING(共' + cells.length + ')' });
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    return JSON.stringify({
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      text: el.getAttribute('aria-label'),
    });
  })()`);
  const info = JSON.parse(raw);
  if (info.error) return info.error;
  if (action === 'click') {
    const base = { x: info.x, y: info.y, button: 'left', clickCount: 1 };
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  } else {
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: info.x, y: info.y });
  }
  return `${action} ${info.text} @${info.x},${info.y}`;
}

async function setViewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile,
  });
  // ⚠️ 必须显式开触摸模拟：`mobile: true` 只改视口宽度，**不会**让
  // `matchMedia('(pointer: coarse)')` 成立。缺这一步，H5 场里所有
  // `@media (pointer: coarse)` 规则（Rate 的 rate-hit、Slider 的
  // slider-button::after 44px 热区）在真机上从未生效 —— 探针量到的
  // `pointerCoarse: false` 就是这条线索，而组件本身没任何问题。
  // 模式判定走的是视口宽度，所以缺这步时「模式对、热区错」，最难发现。
  //
  // ⚠️ 只开 `setTouchEmulationEnabled`，**不要**再叠 `setEmitTouchEventsForMouse`：
  // 后者会把后续所有 `Input.dispatchMouseEvent` 转成触摸事件，菜单那几场
  // （Radix 在 pointerdown 上开合）直接 `timeout Input.dispatchMouseEvent` 挂掉。
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    maxTouchPoints: mobile ? 5 : 0,
  });
}

async function reload() {
  await send('Page.navigate', { url: PAGE });
  await sleep(1400);
}

async function run() {
  let targets;
  for (let i = 0; i < 60; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch {
      /* not ready */
    }
    await sleep(400);
  }
  const target = targets?.find((t) => t.type === 'page');
  if (!target) throw new Error('CDP target 未就绪');

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id).resolve(m);
      pending.delete(m.id);
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  const reports = [];

  for (const cfg of [
    { name: 'pc', width: 1200, height: 900, mobile: false },
    { name: 'h5', width: 390, height: 780, mobile: true },
  ]) {
    console.log(`== ${cfg.name} (${cfg.width}px) ==`);
    await setViewport(cfg.width, cfg.height, cfg.mobile);

    // --- 1. Dialog ---
    await reload();
    console.log('  scroll:', await scrollToSection('P1 · Dialog'));
    console.log('  click :', await clickButton('声明式对话框'));
    await sleep(700);
    await shot(`${cfg.name}-1-dialog`);
    reports.push(await probe(`${cfg.name} / dialog`));

    // --- 2. Popup ---
    await reload();
    console.log('  scroll:', await scrollToSection('P1 · Popup'));
    console.log('  click :', await clickButton('bottom'));
    await sleep(700);
    await shot(`${cfg.name}-2-popup`);
    reports.push(await probe(`${cfg.name} / popup`));

    // --- 2b. Popup · center（挤扁回归：宽度必须按内容收缩并两侧等距居中） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P1 · Popup'));
    console.log('  click :', await clickButton('center'));
    await sleep(700);
    await shot(`${cfg.name}-2b-popup-center`);
    reports.push(await probe(`${cfg.name} / popup center`));

    // --- 2c. Popup · center 长内容（高度封顶回归） ---
    // Vant 把 `max-height: 100%` 放在 .van-popup 基类上，center 靠继承吃到；
    // Bivane 按 position 分支产出类名，漏掉后症状不是「没有上限」而是
    // 面板高 = 内容高 → 内部滚动容器永不滚动 + 上下溢出视口。
    // 8 行 Cell 够不到 90vh，所以验证台专门给了 40 行的长内容入口。
    await reload();
    console.log('  scroll:', await scrollToSection('P1 · Popup'));
    console.log('  click :', await clickButton('center · 长内容'));
    await sleep(700);
    await shot(`${cfg.name}-2c-popup-center-long`);
    reports.push(await probe(`${cfg.name} / popup center 长内容`));

    // --- 3. Toast 连发两条（验证单例 vs 栈） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P1 · Toast'));
    console.log('  click :', await clickButton('连发两条'));
    await sleep(400);
    await shot(`${cfg.name}-3-toast`);
    reports.push(await probe(`${cfg.name} / toast`));

    // --- 4. Select 展开（P2 核心：同一组 props，两端两套交互范式） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · Select'));
    // 用「搜索城市」这个触发器：12 个选项，既过 H5 的 >10 阈值，也带 searchable
    console.log('  click :', await clickSelectTrigger('搜索城市'));
    await sleep(500);
    await shot(`${cfg.name}-4-select`);
    reports.push(await probeSelect(`${cfg.name} / select 展开`));

    // --- 5. 键盘巡航（PC 有激活项概念，H5 没有） ---
    await pressKey(KEYS.ArrowDown);
    await pressKey(KEYS.ArrowDown);
    await sleep(250);
    await shot(`${cfg.name}-5-select-keyboard`);
    reports.push(await probeSelect(`${cfg.name} / select ↑↓×2`));

    // --- 6. 输入过滤（走真实输入链路：聚焦 + Input.insertText，而不是改 DOM value） ---
    console.log(
      '  focus :',
      await evaluate(
        `(() => { const i = document.querySelector('[data-slot="select-search-input"]'); if (!i) return 'NO_SEARCH_BOX'; i.focus(); return 'OK'; })()`,
      ),
    );
    await send('Input.insertText', { text: '杭' });
    await sleep(300);
    await shot(`${cfg.name}-6-select-filter`);
    reports.push(await probeSelect(`${cfg.name} / select 输入「杭」`));

    // --- 7. DropdownMenu 展开（P2 第二种模式 C：整层推入 vs 向右展开） ---
    // 用真实鼠标点击（CDP Input）：Radix 的 Trigger 在 pointerdown 上开合，
    // 在页面里 el.click() 只派发 click，PC 端永远打不开。
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · DropdownMenu'));
    // --- 7a. 触发器层级回显（纯回填，不展开菜单也能量）---
    // 放在点开菜单之前量：回填与展开态无关，早些量能避开「PC 点选后菜单已关闭、
    // 探针按『已展开』筛选拿到别的实例」这类测不到的情况（与 2c 那条同源的教训）。
    await shot(`${cfg.name}-7a-menu-trigger-path`);
    reports.push(await probeTriggerPath(`${cfg.name} / menu 触发器层级回显`, '位置'));
    console.log('  click :', await realClickByLabel('menu-trigger', '操作菜单'));
    await sleep(500);
    await shot(`${cfg.name}-7-menu`);
    reports.push(await probeMenu(`${cfg.name} / menu 展开`));

    // --- 7b. 键盘巡航（PC 有焦点落点，H5 没有这个概念） ---
    await pressKey(KEYS.ArrowDown);
    await sleep(200);
    await pressKey(KEYS.ArrowDown);
    await sleep(250);
    await shot(`${cfg.name}-7b-menu-keyboard`);
    reports.push(await probeMenu(`${cfg.name} / menu ↑↓×2`));

    // --- 7c. 下钻一级：H5 推入第二层面板 vs PC 向右展开子浮层（父层不动） ---
    console.log('  click :', await clickMenuRow('move'));
    await sleep(500);
    await shot(`${cfg.name}-7c-menu-submenu`);
    reports.push(await probeMenu(`${cfg.name} / menu 进入二级`));

    // --- 7d. 再进一级（demo 树有三级）：验证推入/右展都不是只支持一层 ---
    console.log('  click :', await clickMenuRow('more'));
    await sleep(500);
    await shot(`${cfg.name}-7d-menu-submenu-deep`);
    reports.push(await probeMenu(`${cfg.name} / menu 进入三级`));

    // --- 7e. 可选值 + 暂存确认（最后一个菜单实例：value + confirmable） ---
    // H5：点叶子只把勾挪过去，触发器回填不变，「确定」才提交；
    // PC：confirmable 无效，点选即生效，触发器立刻回填。
    // 先收起当前菜单（Esc 两端都收敛）
    await pressKey(KEYS.Escape);
    await sleep(400);
    await pressKey(KEYS.Escape);
    await sleep(400);
    console.log('  click :', await realClickByLabel('menu-trigger', '位置'));
    await sleep(500);
    console.log('  click :', await clickMenuRow('duplicate'));
    await sleep(400);
    await shot(`${cfg.name}-7e-menu-staged`);
    reports.push(await probeMenu(`${cfg.name} / menu 暂存点选`));

    // 确定（H5 提交草稿并回填；PC 此步无工具栏可点，evaluate 直接 no-op）
    await evaluate(`(() => {
      const b = document.querySelector('[data-slot="panel-header-confirm"]');
      if (b) b.click();
      return b ? 'CONFIRMED' : 'NO_TOOLBAR(PC)';
    })()`);
    await sleep(400);
    await shot(`${cfg.name}-7f-menu-committed`);
    reports.push(await probeMenu(`${cfg.name} / menu 提交后`));

    // --- 7g. 打开即定位：展开时直接落到选中项所在的那一层，并把它滚入视野 ---
    // '位置' 菜单的选中项（移动到 / 项目文档）埋在第二层。判据是 selectedDepth=1
    // 且 selectedInView=true —— 少了这一步，用户打开后还得自己一层层点进去，
    // 才知道当前选的是哪一条（触发器上的层级回显解决「看得到」，这条解决「打开就到位」）。
    await reload();
    await scrollToSection('P2 · DropdownMenu');
    console.log('  click :', await realClickByLabel('menu-trigger', '位置'));
    await sleep(500);
    await shot(`${cfg.name}-7g-menu-open-at-selected`);
    reports.push(await probeMenu(`${cfg.name} / menu 打开即定位`));

    // --- 7h. 头部层级面包屑：点链首那一项一步回到最上层（不必逐层按返回） ---
    // 先再下钻一层到第三层，让链变成「移动到 / 更多位置」两项 —— 7g 停在第二层时
    // 链上只有「移动到」一项，末项即当前落点，点它收敛在这一层，验不出跨层。
    // 链首「移动到」是**第一层的选中值**，点它 = 把 path 截到 0 → 面板栈清空：
    // 判据是 layers 由 3 回到 1、trackTransform 归零、面包屑缩成一格面板名
    // （headerCrumbs 剩 ["选择位置"]、headerTitle 为 null —— 根层也铺层级行）。
    // PC 没有抽屉头部，这一步会打印 NOT_FOUND 并跳过（与 7e 的「确定」同一处理）。
    console.log('  click :', await clickMenuRow('more'));
    await sleep(500);
    console.log('  click :', await realClickSelector('[data-slot="panel-header-crumb"]'));
    await sleep(500);
    await shot(`${cfg.name}-7h-menu-breadcrumb-jump`);
    reports.push(await probeMenu(`${cfg.name} / menu 面包屑切层`));

    // --- 8. DatePicker 单值展开（P2 第三种模式 C：三列滚轮 vs 月历） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · DatePicker'));
    // 按 aria-label 精确匹配触发器：同类组件有 3 个，按文本匹配会静默落到第一个
    // （H5 未选中时显示的是 placeholder「请选择日期」，与区间那个只差两个字）
    console.log('  click :', await realClickByLabel('date-picker-trigger', '日期'));
    await sleep(700);
    await shot(`${cfg.name}-8-date-picker`);
    reports.push(await probeDate(`${cfg.name} / date 单值展开`));

    // --- 8b. 一步真实交互：H5 滚轮滚 3 行 vs PC 键盘巡航 ← ↓ ---
    // H5 判据：scrollTop 落在行高整数倍上（吸附真的生效）+ 选中行文字变了（滚动回写了草稿）；
    // PC 判据：data-active 光标随方向键移动 —— H5 根本没有「光标」这个概念。
    if (cfg.mobile) {
      console.log('  wheel :', await wheelScroll('[data-slot="date-picker-wheel-scroller"]', 3));
      await sleep(700);
      await shot(`${cfg.name}-8b-date-picker-wheel`);
      reports.push(await probeDate(`${cfg.name} / date 滚轮 Δ3 行`));
    } else {
      await pressKey(KEYS.ArrowRight);
      await sleep(150);
      console.log('  key   :', await pressKey(KEYS.ArrowDown));
      await sleep(300);
      await shot(`${cfg.name}-8b-date-picker-keyboard`);
      reports.push(await probeDate(`${cfg.name} / date →↓ 键盘巡航`));
    }

    // --- 8c. 区间展开（H5 两段式入口 vs PC 并排双月） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · DatePicker'));
    console.log('  click :', await realClickByLabel('date-picker-trigger', '日期区间'));
    await sleep(700);
    await shot(`${cfg.name}-8c-date-picker-range`);
    reports.push(await probeDate(`${cfg.name} / date 区间展开`));

    // H5 专有：切到「结束日期」端。PC 用并排双月表达同一件事，没有这个入口。
    // PC 专有：点起点 → 悬停终点 → 中间格铺出区间带（`displayRange` 的
    // 「起点 + 悬停终点」分支）。只实现了「两端都定时才画带」的版本会在这里露馅：
    // 提交完的区间反而没底色，用户以为没选上。
    if (cfg.mobile) {
      console.log('  click :', await realClickByLabel('date-picker-range-tab', '结束日期'));
      await sleep(400);
      await shot(`${cfg.name}-8c2-date-picker-range-end`);
      reports.push(await probeDate(`${cfg.name} / date 区间切结束端`));
    } else {
      console.log('  click :', await hitDateCell('click', 11));
      await sleep(350);
      console.log('  hover :', await hitDateCell('hover', 21));
      await sleep(450);
      await shot(`${cfg.name}-8c2-date-picker-range-hover`);
      reports.push(await probeDate(`${cfg.name} / date 区间悬停预览`));
    }

    // --- 8d. 提交（H5 点「确定」/ PC 按 Enter）→ 面板关闭 + 触发器回填 ---
    // 判据用「aria-expanded 由 true 变 false + 触发器文本不再是 placeholder」，
    // 而不是「面板 DOM 不存在」—— Radix 的 Presence 有退场动画，节点会晚一两次提交才卸。
    await reload();
    await scrollToSection('P2 · DatePicker');
    console.log('  click :', await realClickByLabel('date-picker-trigger', '日期'));
    await sleep(600);
    if (cfg.mobile) {
      console.log('  click :', await realClickSelector('[data-slot="panel-header-confirm"]'));
    } else {
      console.log('  key   :', await pressKey(KEYS.Enter));
    }
    await sleep(600);
    await shot(`${cfg.name}-8d-date-picker-committed`);
    reports.push(await probeDate(`${cfg.name} / date 提交后`));

    // --- 9. TimePicker 单值展开（两端同一套滚轮，只换外壳） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · TimePicker'));
    // 按 aria-label 精确匹配触发器：同类组件有 4 个，按文本匹配会静默落到第一个
    console.log('  click :', await realClickByLabel('time-picker-trigger', '时间'));
    await sleep(700);
    await shot(`${cfg.name}-9-time-picker`);
    reports.push(await probeTime(`${cfg.name} / time 单值展开`));

    // --- 9b. 一步真实交互：真滚轮滚 3 行（两端都该吸附对齐），PC 再叠一次键盘驾驶 ---
    // 判据：scrollTop 落在行高整数倍上（吸附真的生效）+ 选中行文字变了（滚动回写了草稿）；
    // PC 追加：data-active 的列随 ←→ 移动、该列高亮带叠底色 —— H5 根本没有「键盘在驾驶哪一列」这个概念。
    console.log('  wheel :', await wheelScroll('[data-slot="time-picker-wheel-scroller"]', 3));
    await sleep(700);
    await shot(`${cfg.name}-9b-time-picker-wheel`);
    reports.push(await probeTime(`${cfg.name} / time 滚轮 Δ3 行`));
    if (!cfg.mobile) {
      await pressKey(KEYS.ArrowRight);
      await sleep(150);
      console.log('  key   :', await pressKey(KEYS.ArrowDown));
      await sleep(300);
      await shot(`${cfg.name}-9b2-time-picker-keyboard`);
      reports.push(await probeTime(`${cfg.name} / time →↓ 键盘驾驶列`));
    }

    // --- 9c. 区间展开（两端都复用「开始时间 / 结束时间」两段式入口） ---
    await reload();
    console.log('  scroll:', await scrollToSection('P2 · TimePicker'));
    console.log('  click :', await realClickByLabel('time-picker-trigger', '时间区间'));
    await sleep(700);
    await shot(`${cfg.name}-9c-time-picker-range`);
    reports.push(await probeTime(`${cfg.name} / time 区间展开`));

    // 两端统一：滚轮有多列（时/分/秒），不自动切端；由用户点「开始时间 / 结束时间」tab 切换。
    if (cfg.mobile) {
      console.log('  click :', await realClickByLabel('time-picker-range-tab', '结束时间'));
      await sleep(400);
      await shot(`${cfg.name}-9c2-time-picker-range-end`);
      reports.push(await probeTime(`${cfg.name} / time 区间切结束端`));
    } else {
      console.log('  click :', await realClickTimeOption('12'));
      await sleep(400);
      await shot(`${cfg.name}-9c2-time-picker-range-pc-start`);
      reports.push(await probeTime(`${cfg.name} / time 区间点起点`));
      // 选完起点手动切到「结束时间」端，再补一个结束值
      console.log('  click :', await realClickByLabel('time-picker-range-tab', '结束时间'));
      await sleep(300);
      console.log('  click :', await realClickTimeOption('20'));
      await sleep(400);
      await shot(`${cfg.name}-9c3-time-picker-range-pc-end`);
      reports.push(await probeTime(`${cfg.name} / time 区间点终点`));
      // PC 区间不「选满即关」，必须点底部「确定」才提交
      console.log('  click :', await realClickSelector('[data-slot="time-picker-confirm"]'));
      await sleep(600);
      await shot(`${cfg.name}-9d-time-picker-range-pc-committed`);
      reports.push(await probeTime(`${cfg.name} / time 区间确定后`));
    }

    // --- 9d. 提交（H5 点工具条「确定」/ PC 点底部「确定」或按 Enter）→ 浮层关闭 + 触发器回填 ---
    // 判据用「aria-expanded 由 true 变 false + 触发器文本不再是 placeholder」，
    // 而不是「面板 DOM 不存在」—— Radix 的 Presence 有退场动画，节点会晚一两次提交才卸。
    await reload();
    await scrollToSection('P2 · TimePicker');
    console.log('  click :', await realClickByLabel('time-picker-trigger', '时间'));
    await sleep(600);
    if (cfg.mobile) {
      console.log('  click :', await realClickSelector('[data-slot="panel-header-confirm"]'));
    } else {
      console.log('  key   :', await pressKey(KEYS.Enter));
    }
    await sleep(600);
    await shot(`${cfg.name}-9d-time-picker-committed`);
    reports.push(await probeTime(`${cfg.name} / time 提交后`));

    // --- 10. Rate（模式 C：H5 滑动连续选 / PC 点击 + hover 预览 + 键盘） ---
    // 判据核心是「实心星是按比例裁切的」：量rate-star-fill 宽度 / 星宽，
    // 半星必须是 ≈0.5。H5 额外的判据是 rate-hit 把 20px 撑到≈44px；
    // PC 额外的判据是 hover 时 aria-valuenow 跟随预览、移出后还原。
    await reload();
    console.log('  scroll:', await scrollToSection('P3 · Rate'));
    await shot(`${cfg.name}-10-rate`);
    reports.push(await probeRate(`${cfg.name} / rate 初始`));

    // 点第 4颗星（半星那颗，allowHalf）—— 走 pointerdown 链路，两端都吃
    console.log('  hover :', await hoverSelector('[data-slot="rate"][aria-label="基础评分"] [data-index="3"]', 0.25));
    await sleep(300);
    await shot(`${cfg.name}-10b-rate-hover`);
    reports.push(await probeRate(`${cfg.name} / rate hover 预览`));

    // 键盘：PC 容器 tabIndex=0，→ 加 1 步（半星是 0.5）；H5 tabIndex=-1，按键无效
    if (!cfg.mobile) {
      await evaluate(`(() => {
        const el = document.querySelector('[data-slot="rate"][aria-label="基础评分"]');
        el.focus();
        return el.tabIndex;
      })()`);
      await pressKey(KEYS.ArrowRight);
      await sleep(250);
      await shot(`${cfg.name}-10c-rate-keyboard`);
      reports.push(await probeRate(`${cfg.name} / rate → 键 +1`));
    }

    // --- 11. Slider（模式 C：H5 触摸拖拽 / PC 点轨 + 拖拽 + 键盘） ---
    // 最关键的一条：填充条必须有宽度。早期实现把起端算成 min(disp)，
    // 单值滑块 size 恒 0 —— 类型、单测、build 三门全绿，轨道看上去是空的。
    await reload();
    console.log('  scroll:', await scrollToSection('P3 · Slider'));
    await shot(`${cfg.name}-11-slider`);
    reports.push(await probeSlider(`${cfg.name} / slider 初始`));

    // 单值拖到 ~70%：两端都走 pointerdown/move/up
    console.log('  drag  :', await dragOnTrack('[data-slot="slider"][aria-label="基础滑块"] [data-slot="slider-line"]', 0.7));
    await sleep(300);
    await shot(`${cfg.name}-11b-slider-dragged`);
    reports.push(await probeSlider(`${cfg.name} / slider 拖到 70%`));

    // 区间：两端拇指 + 填充条夹在中间
    console.log('  drag  :', await dragOnTrack('[data-slot="slider"][aria-label="区间滑块"] [data-slot="slider-line"]', 0.8));
    await sleep(300);
    await shot(`${cfg.name}-11c-slider-range`);
    reports.push(await probeSlider(`${cfg.name} / slider 区间拖到 80%`));

    // 竖直：thumb 位置应落成 top%，轨道高度由容器给
    reports.push(await probeSlider(`${cfg.name} / slider 竖直`));

    // PC 键盘：聚焦拇指后 → 加一个 step
    if (!cfg.mobile) {
      await evaluate(`(() => {
        const b = document.querySelector('[data-slot="slider"][aria-label="基础滑块"] [data-slot="slider-button"]');
        b.focus();
        return b.getAttribute('aria-valuenow');
      })()`);
      await pressKey(KEYS.ArrowRight);
      await sleep(250);
      await shot(`${cfg.name}-11d-slider-keyboard`);
      reports.push(await probeSlider(`${cfg.name} / slider → 键 +step`));
    }

    // --- 12. Uploader（模式 C：H5 宫格 + 相机 / PC 拖拽区 + 列表 + 粘贴） ---
    // 静止态几何判据：H5 必须有「+」宫格（≈80px 方块），PC 必须有拖拽区
    // （虚线边框、带内边距）。上传中的遮罩/进度需要真文件选择，不在本场景覆盖。
    await reload();
    console.log('  scroll:', await scrollToSection('P3 · Uploader'));
    await shot(`${cfg.name}-12-uploader`);
    reports.push(await probeUploader(`${cfg.name} / uploader 初始`));
  }

  fs.writeFileSync(path.join(OUT, 'probe.json'), JSON.stringify(reports, null, 2), 'utf8');
  console.log('\n---- PROBE ----');
  for (const r of reports) console.log(r);
  console.log(`\n[visual-check] 截图与探针结果 -> ${OUT}`);
}

run()
  .catch((e) => {
    console.error('FAILED', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sleep(400);
      chrome.kill();
    } catch {
      /* ignore */
    }
    await sleep(600);
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* EBUSY tolerated */
    }
    try {
      web?.close();
    } catch {
      /* ignore */
    }
    process.exit(process.exitCode ?? 0);
  });
