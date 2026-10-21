/**
 * Bivane · 计算样式探针（质量门第 5 门）
 *
 * 用途：读取真实浏览器里的 computed style，验证 token 是否**真的生效**。
 * 为什么需要它：这类问题（token 写对了但没落到样式上）在单元测试里是隐形的——
 * jsdom 不做 CSS 级联，`toHaveClass('px-[...]')` 只能证明类名在，证明不了它没被覆盖。
 * 已经靠它抓到过两例：
 *   1. `p-0` 覆盖 `[padding:...]` 导致按钮左右内边距归零；
 *   2. `text-bv-*` 写在 `leading-*` 之后，行高被 tailwind-merge 删除。
 *
 * 用法：
 *   node scripts/measure.mjs                    # 自带静态服务器指向 dist，PC + H5 各测一次
 *   node scripts/measure.mjs http://localhost:5173          # 指向 dev server，仍测两个宽度
 *   node scripts/measure.mjs http://localhost:5173 390      # 只测一个宽度
 *
 * ⚠️ 两个曾经的坑，改这个脚本时务必守住：
 *   a. **不能依赖「外部先起一个 server」**：外部起的 preview 进程会在工具调用结束时被回收，
 *      下一个调用就 404；而页面 404 时探针**照样返回一份空结果并 EXIT 0** ——
 *      这就是「本门在无服务器时空跑通过」的由来，比报错更危险。所以静态服务器写进本文件，
 *      并且**页面必须真的加载出来**（探到 `[data-mode]`）否则 EXIT 1。
 *   b. **默认必须 PC / H5 各测一次**：token 在两端的取值本来就不同（行高 44 vs 32 等），
 *      只测一个宽度会把半数差异漏掉，而 `npm run measure` 的调用方不会记得传两次。
 *
 * 前置：npm run build（自带服务器只服务 dist，不负责构建）
 * 环境变量：CHROME_PATH 可覆盖 Chrome 可执行文件路径；CDP_PORT 换端口
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import { existsSync, createReadStream, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const URL_ARG = process.argv[2] ?? null;
const WIDTH_ARG = process.argv[3] ?? 'all';
const WIDTHS = WIDTH_ARG === 'all' ? [1200, 390] : [Number(WIDTH_ARG)];
const PORT = Number(process.env.CDP_PORT ?? 9223);
const WEB_PORT = Number(process.env.WEB_PORT ?? 4318);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);

const chromePath = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chromePath) {
  console.error('[measure] 未找到 Chrome / Edge，可用 CHROME_PATH 环境变量指定');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

// ---- 静态服务器（仅在没给 url 时启用；必须在同一进程内，见文件头 a 条） ----
let server = null;
if (!URL_ARG) {
  if (!existsSync(path.join(DIST, 'index.html'))) {
    console.error('[measure] dist/index.html 不存在，先跑 npm run build');
    process.exit(1);
  }
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html'); // SPA fallback
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(WEB_PORT, '127.0.0.1', r));
}
const TARGET = URL_ARG ?? `http://localhost:${WEB_PORT}/`;

/** 探针表达式：只读计算样式与类名，不修改页面 */
const PROBE = `(() => {
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;
  const cls = (el, re) => (el?.className || '').split(/\\s+/).filter((c) => re.test(c));
  const out = {
    viewport: window.innerWidth,
    mode: document.querySelector('[data-mode]')?.getAttribute('data-mode') ?? null,
  };

  const btns = [...document.querySelectorAll('[data-slot="button"]')];
  out.buttons = btns.slice(0, 8).map((b) => {
    const cs = getComputedStyle(b);
    return {
      text: (b.textContent || '').trim().slice(0, 8),
      w: px(cs.width),
      h: px(cs.height),
      padL: px(cs.paddingLeft),
      padR: px(cs.paddingRight),
      fontSize: px(cs.fontSize),
    };
  });

  out.tags = [...document.querySelectorAll('[data-slot="tag"]')].slice(0, 12).map((t) => {
    const cs = getComputedStyle(t);
    return { text: (t.textContent || '').trim().slice(0, 6), w: px(cs.width), h: px(cs.height), padL: px(cs.paddingLeft), padT: px(cs.paddingTop) };
  });

  const badge = document.querySelector('[data-slot="badge"]');
  if (badge) {
    const cs = getComputedStyle(badge);
    out.badge = { w: px(cs.width), h: px(cs.height), padL: px(cs.paddingLeft) };
  }

  // 行高是否存活（tailwind-merge 会把先出现的 leading-* 删掉，这里是唯一的检查点）
  const leadingOf = (sel) => cls(document.querySelector(sel), /^leading-/);
  out.leading = {
    button: leadingOf('[data-slot="button"]'),
    tag: leadingOf('[data-slot="tag"]'),
    badge: leadingOf('[data-slot="badge"]'),
    cell: leadingOf('[data-slot="cell"]'),
    cellLabel: leadingOf('[data-slot="cell-label"]'),
    cellGroupTitle: leadingOf('[data-slot="cell-group-title"]'),
  };

  // DatePicker：触发器高（H5 44 / PC 32）与字号行高必须来自 token 而不是偶然值
  out.datePicker = [...document.querySelectorAll('[data-slot="date-picker-trigger"]')].map((t) => {
    const cs = getComputedStyle(t);
    return {
      ariaLabel: t.getAttribute('aria-label'),
      mode: t.dataset.mode,
      w: px(cs.width),
      h: px(cs.height),
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      radius: cs.borderTopLeftRadius,
      // H5 的下边线走 bv-hairline 伪元素，元素自身 border 恒为 0
      hairlineBottom: getComputedStyle(t, '::after').borderBottomWidth,
    };
  });

  // 页面骨架间距
  const row = btns[0]?.parentElement;
  const block = row?.parentElement;
  if (row && block) {
    out.layout = {
      rowGap: getComputedStyle(row).gap,
      blockPadL: px(getComputedStyle(block).paddingLeft),
      blockPadT: px(getComputedStyle(block).paddingTop),
    };
  }

  // TimePicker：触发器高（H5 44 / PC 32）与字号行高必须来自 token 而不是偶然值
  out.timePicker = [...document.querySelectorAll('[data-slot="time-picker-trigger"]')].map((t) => {
    const cs = getComputedStyle(t);
    return {
      ariaLabel: t.getAttribute('aria-label'),
      mode: t.dataset.mode,
      w: px(cs.width),
      h: px(cs.height),
      fontSize: cs.fontSize,
      lineHeight: cs.lineHeight,
      radius: cs.borderTopLeftRadius,
      // H5 的下边线走 bv-hairline 伪元素，元素自身 border 恒为 0
      hairlineBottom: getComputedStyle(t, '::after').borderBottomWidth,
    };
  });

  // Tabs / NavBar / Tabbar：模式 B / B / C。
  // 判据是「token 真的落到盒子上」：标签条 44px、栏高 46px、
  // H5 底栏项高 50px / PC 40px；NavBar 标题落位 H5 居中 / PC 左对齐。
  out.tabs = [...document.querySelectorAll('[data-slot="tabs-nav"]')].map((nav) => {
    const cs = getComputedStyle(nav);
    const active = nav.querySelector('[data-slot="tabs-tab"][data-active="true"]');
    const line = nav.querySelector('[data-slot="tabs-line"]');
    return {
      mode: nav.closest('[data-slot="tabs"]')?.getAttribute('data-mode') ?? null,
      h: px(cs.height),
      overflowX: cs.overflowX,
      activeFontSize: active ? getComputedStyle(active).fontSize : null,
      lineHeight: line ? px(getComputedStyle(line).height) : null,
    };
  });

  out.navBar = [...document.querySelectorAll('[data-slot="nav-bar-bar"]')].map((bar) => {
    const center = bar.querySelector('[data-slot="nav-bar-center"]');
    const title = bar.querySelector('[data-slot="nav-bar-title"]');
    return {
      mode: bar.closest('[data-slot="nav-bar"]')?.getAttribute('data-mode') ?? null,
      h: px(getComputedStyle(bar).height),
      titleAlign: center ? getComputedStyle(center).textAlign : null,
      titleFontSize: title ? getComputedStyle(title).fontSize : null,
    };
  });

  out.tabbar = [...document.querySelectorAll('[data-slot="tabbar"]')].map((bar) => {
    const item = bar.querySelector('[data-slot="tabbar-item"], [data-slot="tabbar-pc-item"]');
    return {
      mode: bar.getAttribute('data-mode'),
      variant: bar.getAttribute('data-variant'),
      itemH: item ? px(getComputedStyle(item).height) : null,
      itemFontSize: item ? getComputedStyle(item).fontSize : null,
    };
  });

  // Tabbar 角标几何：角标应「挂在图标右上角、大半露在图标外」。
  // dx/dy = 角标中心相对图标右上角的偏移（外探为正），
  // overlap*Ratio = 角标盖住图标的面积比例（太大 = 图标被糊掉）。
  out.tabbarBadges = [...document.querySelectorAll('[data-slot="tabbar"]')].map((bar) =>
    [...bar.querySelectorAll('[data-slot="tabbar-item"], [data-slot="tabbar-pc-item"]')]
      .map((item) => {
        const icon = item.querySelector(
          '[data-slot="tabbar-item-icon"], [data-slot="tabbar-pc-item-icon"]',
        );
        const badge = icon ? icon.querySelector('[data-slot="badge"]') : null;
        if (!icon || !badge) return null;
        const ir = icon.getBoundingClientRect();
        const br = badge.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(br.right, ir.right) - Math.max(br.left, ir.left));
        const overlapY = Math.max(0, Math.min(br.bottom, ir.bottom) - Math.max(br.top, ir.top));
        return {
          variant: bar.getAttribute('data-variant'),
          dot: badge.getAttribute('data-dot') === 'true',
          iconW: px(ir.width),
          badgeW: px(br.width),
          badgeH: px(br.height),
          dx: px(br.left + br.width / 2 - ir.right),
          dy: px(br.top + br.height / 2 - ir.top),
          overlapXRatio: px(overlapX / Math.max(1, ir.width)),
          overlapYRatio: px(overlapY / Math.max(1, ir.height)),
        };
      })
      .filter(Boolean),
  );

  // List / Table：模式 C / 模式 C。
  // 判据是「token 真的落到盒子上」：List 行高 H5 48 / PC 36；
  // Table 卡片 gap 与 PC 表头行高，以及排序/筛选控件是否真渲染。
  out.list = [...document.querySelectorAll('[data-slot="list"]')].map((root) => {
    const item = root.querySelector('[data-slot="list-item"], [data-slot="list-pc-item"]');
    const scroll = root.querySelector('[data-slot="list-scroll"]');
    return {
      mode: root.getAttribute('data-mode'),
      virtual: root.getAttribute('data-virtual'),
      itemH: item ? px(getComputedStyle(item).height) : null,
      itemFontSize: item ? getComputedStyle(item).fontSize : null,
      scrollOverflowY: scroll ? getComputedStyle(scroll).overflowY : null,
      hasRefresh: Boolean(root.querySelector('[data-slot="list-pc-refresh"]')),
      renderedItems: root.querySelectorAll('[data-slot="list-item"], [data-slot="list-pc-item"]')
        .length,
    };
  });

  out.table = [...document.querySelectorAll('[data-slot="table"]')].map((root) => {
    const card = root.querySelector('[data-slot="table-card"]');
    const headCell = root.querySelector('[data-slot="table-pc-cell"]');
    return {
      mode: root.getAttribute('data-mode'),
      isTable: Boolean(root.querySelector('table')),
      cardGap: card
        ? px(getComputedStyle(card.parentElement).rowGap || getComputedStyle(card.parentElement).gap)
        : null,
      cardTitleFontSize: card
        ? getComputedStyle(card.querySelector('[data-slot="table-card-title"]')).fontSize
        : null,
      headCellH: headCell ? px(getComputedStyle(headCell).height) : null,
      hasSort: Boolean(
        root.querySelector('[data-slot="table-pc-sort"], [data-slot="table-card-sort-button"]'),
      ),
      hasFilter: Boolean(root.querySelector('[data-slot="table-pc-filter-trigger"]')),
      hasSelect: Boolean(root.querySelector('[role="checkbox"]')),
    };
  });

  const root = getComputedStyle(document.documentElement);
  out.tokens = {
    'padding-md': root.getPropertyValue('--bv-padding-md').trim(),
    'button-normal-padding-x': root.getPropertyValue('--bv-button-normal-padding-x').trim(),
    'tag-line-height': root.getPropertyValue('--bv-tag-line-height').trim(),
    'date-picker-wheel-item-height': root.getPropertyValue('--bv-date-picker-wheel-item-height').trim(),
    'date-picker-pc-cell-height': root.getPropertyValue('--bv-date-picker-pc-cell-height').trim(),
    'date-picker-pc-trigger-height': root.getPropertyValue('--bv-date-picker-pc-trigger-height').trim(),
    'panel-header-breadcrumb-height': root.getPropertyValue('--bv-panel-header-breadcrumb-height').trim(),
    'time-picker-wheel-item-height': root.getPropertyValue('--bv-time-picker-wheel-item-height').trim(),
    'time-picker-pc-panel-width': root.getPropertyValue('--bv-time-picker-pc-panel-width').trim(),
    'time-picker-pc-trigger-height': root.getPropertyValue('--bv-time-picker-pc-trigger-height').trim(),
    'tabs-height': root.getPropertyValue('--bv-tabs-height').trim(),
    'tabs-bottom-bar-height': root.getPropertyValue('--bv-tabs-bottom-bar-height').trim(),
    'nav-bar-height': root.getPropertyValue('--bv-nav-bar-height').trim(),
    'tabbar-height': root.getPropertyValue('--bv-tabbar-height').trim(),
    'tabbar-pc-item-height': root.getPropertyValue('--bv-tabbar-pc-item-height').trim(),
    'list-item-min-height': root.getPropertyValue('--bv-list-item-min-height').trim(),
    'list-pc-item-height': root.getPropertyValue('--bv-list-pc-item-height').trim(),
    'list-status-min-height': root.getPropertyValue('--bv-list-status-min-height').trim(),
    'table-card-gap': root.getPropertyValue('--bv-table-card-gap').trim(),
    'table-pc-cell-padding-x': root.getPropertyValue('--bv-table-pc-cell-padding-x').trim(),
  };
  return JSON.stringify(out);
})()`;

async function findTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* 等 Chrome 起来 */
    }
    await sleep(250);
  }
  throw new Error('CDP target 未就绪');
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const task = pending.get(msg.id);
      if (!task) return;
      pending.delete(msg.id);
      if (msg.error) {
        task.fail(new Error(JSON.stringify(msg.error)));
      } else {
        task.ok(msg.result);
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((ok, fail) => {
            const mid = ++id;
            pending.set(mid, { ok, fail });
            ws.send(JSON.stringify({ id: mid, method, params }));
          }),
        close: () => ws.close(),
      }),
    );
  });
}

async function main() {
  const profile = mkdtempSync(path.join(tmpdir(), 'bivane-cdp-'));
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let failed = false;
  try {
    const client = await connect(await findTarget());
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    for (const width of WIDTHS) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      // 换宽度后必须重新导航：媒体查询/模式判定只在加载时跑一次
      // （ResponsiveProvider 会监听 resize，但重载更接近「用户真的用这个宽度打开」）
      await client.send('Page.navigate', { url: TARGET });
      await sleep(2500);

      const res = await client.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
      const data = JSON.parse(res.result.value);
      console.log(`\n==== ${width}px ====`);
      console.log(JSON.stringify(data, null, 2));

      // 页面没加载出来时探针返回的是「空壳」——必须显式失败，不能让它冒充通过
      if (!data.mode) {
        console.error(`[measure] ${width}px 下探不到 [data-mode]，页面可能没加载（URL ${TARGET}）`);
        failed = true;
      }
    }
    client.close();
  } finally {
    chrome.kill();
    // Windows 上 Chrome 退出前 profile 文件仍被占用，删不掉不影响测量结果
    await sleep(400);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {
      /* 系统临时目录，残留无副作用 */
    }
    server?.close();
  }
  if (failed) process.exit(1);
}

await main();
