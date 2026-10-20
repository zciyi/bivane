/**
 * 消费者实测门（第 8 门）
 *
 * 为什么需要它：`tsc` / `eslint` / `vitest` / `vite build` 全部跑在本仓库内，
 * 内部 import 靠本仓库的 tsconfig 别名就能解析；而 registry 的价值恰恰在于
 * **文件被复制到别人的项目里还能跑**。前面几门对「装出去能不能用」一无所知。
 *
 * 这个脚本在一个空白项目里真的跑一遍文档写的安装流程：
 *   起一个静态 registry 服务 → 写入 components.json 的 registries →
 *   `npx shadcn add @bivane/select` → 断言落盘文件 → tsc --noEmit → vite build
 *
 * 用法：
 *   node scripts/consumer-check.mjs                 # 默认目录 ../bivane-consumer-check
 *   node scripts/consumer-check.mjs --dir <path>    # 指定目录（会被清理重建）
 *   node scripts/consumer-check.mjs --keep          # 保留已有目录，不重装依赖
 *
 * 踩过的坑（都写进断言了）：
 *   1) registryDependencies 写成 `<name>.json` → shadcn 的 `isLocalFile()` 命中，
 *      按消费者 cwd 找文件 → ENOENT。必须是 `@bivane/<name>`。
 *   2) 裸名（`<name>`）会被兜给内置的 `@shadcn` 源 → 取到官方同名件或 404。
 *   3) files[].target 会被 `isSrcDir` 改写：项目有 src/ 就整体前缀 src/。
 *      要压在项目根必须写 `~/`。
 *   4) Windows 绝对路径不能当 registry 参数（会被当 URL，报 scheme "e" not supported）。
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_DIR = join(ROOT, 'packages/registry/r');
const NODE_DIR = 'C:\\Users\\Administrator\\.workbuddy\\binaries\\node\\versions\\22.22.2-6';
const SHADCN_VERSION = '3.6.3';

/** 必须落盘的消费者文件（相对消费者项目根） */
const EXPECTED = [
  'src/styles/bivane/vant.css',
  'src/styles/bivane/vant-dark.css',
  'src/styles/bivane/modes.css',
  'src/styles/bivane/utilities.css',
  'src/styles/bivane/theme.css',
  'src/lib/utils.ts',
  'src/lib/portal.tsx',
  'src/lib/imperative-host.tsx',
  'src/hooks/use-device-mode.ts',
  'src/hooks/use-select-state.ts',
  'src/hooks/use-virtual-window.ts',
  'src/components/providers/responsive-provider.tsx',
  'src/components/ui/icon.tsx',
  'src/components/ui/select-parts.tsx',
  'src/components/h5/select.tsx',
  'src/components/pc/select.tsx',
  'src/components/responsive/select.tsx',
  'src/hooks/use-search-state.ts',
  'src/components/ui/search-parts.tsx',
  'src/components/h5/search.tsx',
  'src/components/pc/search.tsx',
  'src/components/responsive/search.tsx',
  'src/hooks/use-time-value.ts',
  'src/components/ui/time-parts.tsx',
  'src/components/h5/time-picker.tsx',
  'src/components/pc/time-picker.tsx',
  'src/components/responsive/time-picker.tsx',
  'src/hooks/use-rate-state.ts',
  'src/components/ui/rate-parts.tsx',
  'src/components/h5/rate.tsx',
  'src/components/pc/rate.tsx',
  'src/components/responsive/rate.tsx',
  'src/hooks/use-slider-state.ts',
  'src/hooks/use-slider-drag.ts',
  'src/components/ui/slider-parts.tsx',
  'src/components/h5/slider.tsx',
  'src/components/pc/slider.tsx',
  'src/components/responsive/slider.tsx',
  'src/hooks/use-uploader-state.ts',
  'src/components/ui/uploader-parts.tsx',
  'src/components/h5/uploader.tsx',
  'src/components/pc/uploader.tsx',
  'src/components/responsive/uploader.tsx',
];

/** 消费者项目骨架：标准 src/ 布局（@/* -> ./src/*），与 shadcn 官方模板一致 */
const FIXTURE = {
  'package.json': JSON.stringify(
    {
      name: 'bivane-consumer-check',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: { typecheck: 'tsc --noEmit', build: 'vite build' },
      dependencies: { react: '^19.3.0', 'react-dom': '^19.3.0' },
      devDependencies: {
        '@tailwindcss/vite': '^4.3.3',
        '@types/react': '^19.3.0',
        '@types/react-dom': '^19.3.0',
        '@vitejs/plugin-react': '^6.1.1',
        tailwindcss: '^4.3.3',
        typescript: '^6.0.3',
        vite: '^8.3.0',
      },
    },
    null,
    2,
  ),

  'components.json': JSON.stringify(
    {
      $schema: 'https://ui.shadcn.com/schema.json',
      style: 'new-york',
      rsc: false,
      tsx: true,
      tailwind: { config: '', css: 'src/index.css', baseColor: 'neutral', cssVariables: true, prefix: '' },
      aliases: {
        components: '@/components',
        utils: '@/lib/utils',
        ui: '@/components/ui',
        lib: '@/lib',
        hooks: '@/hooks',
      },
      iconLibrary: 'lucide',
      // 注意：registries 由脚本按实际端口注入，见 writeComponentsJson
    },
    null,
    2,
  ),

  'tsconfig.json': JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        resolveJsonModule: true,
        isolatedModules: true,
        // 不要写 baseUrl：TypeScript 6 起会报 TS5101（deprecated）。
        // 现代写法就是只给 paths，解析基准是 tsconfig 所在目录。
        paths: { '@/*': ['./src/*'] },
      },
      // 只收 src：vite.config.ts 用的是 node: 内置模块，塞进同一个 program 就得
      // 额外装 @types/node。官方 react-ts 模板也是拆 tsconfig.app / tsconfig.node 两份。
      include: ['src'],
    },
    null,
    2,
  ),

  // 让 `import './index.css'` 这种副作用导入有类型（否则 TS2882）
  'src/vite-env.d.ts': `/// <reference types="vite/client" />
`,

  'vite.config.ts': `import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
});
`,

  'index.html': `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bivane 消费者实测</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

  // 与 USAGE.md 里写的五行 import 逐字一致
  'src/index.css': `@import 'tailwindcss';
@import './styles/bivane/vant.css';
@import './styles/bivane/vant-dark.css';
@import './styles/bivane/modes.css';
@import './styles/bivane/utilities.css';
@import './styles/bivane/theme.css';
`,

  'src/main.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';

import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { DialogHost } from '@/components/responsive/dialog';
import { ToastHost } from '@/components/responsive/toast';

import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResponsiveProvider breakpoint={768}>
      <App />
      <DialogHost />
      <ToastHost />
    </ResponsiveProvider>
  </React.StrictMode>,
);
`,

  'src/App.tsx': `import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cell, CellGroup } from '@/components/ui/cell';
import { Icon } from '@/components/ui/icon';
import { Tag } from '@/components/ui/tag';
import { DatePicker } from '@/components/responsive/date-picker';
import { TimePicker } from '@/components/responsive/time-picker';
import { Rate } from '@/components/responsive/rate';
import { Slider } from '@/components/responsive/slider';
import { Uploader } from '@/components/responsive/uploader';
import { Dialog, showConfirmDialog } from '@/components/responsive/dialog';
import { DropdownMenu } from '@/components/responsive/dropdown-menu';
import { Popup } from '@/components/responsive/popup';
import { Select } from '@/components/responsive/select';
import { Search } from '@/components/responsive/search';
import { showSuccessToast, showToast } from '@/components/responsive/toast';
import type { MenuItem } from '@/hooks/use-menu-state';

const MENU_ITEMS: MenuItem[] = [
  { value: 'edit', label: '编辑', shortcut: '⌘E' },
  { divider: true },
  {
    value: 'move',
    label: '移动到',
    children: [{ value: 'folder-a', label: '项目文档' }],
  },
  { value: 'delete', label: '删除', danger: true },
  { value: 'locked', label: '锁定项', disabled: true },
];

const CITY_OPTIONS = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '成都', value: 'cd', disabled: true },
];

const GROUPED_CITY_OPTIONS = [
  { group: '华北', options: [{ label: '北京', value: 'bj' }, { label: '天津', value: 'tj' }] },
  { group: '华东', options: [{ label: '上海', value: 'sh' }] },
];

export default function App() {
  const [popupOpen, setPopupOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-bv-background p-bv-lg">
      <CellGroup title="Button / Tag / Badge / Icon">
        <Cell
          title="展示"
          value={
            <div className="flex flex-wrap items-center gap-2">
              <Button type="primary" onClick={() => showToast('hi')}>主要</Button>
              <Button type="success" plain>朴素</Button>
              <Tag type="primary">标签</Tag>
              <Badge content={5} />
              <Icon name="success" size={16} />
            </div>
          }
        />
      </CellGroup>

      <CellGroup title="Search">
        <Cell
          title="静态建议"
          value={
            <Search
              ariaLabel="静态建议搜索"
              suggestions={['北京', '上海', '广州']}
              onSearch={(kw) => showToast('搜索：' + kw)}
            />
          }
        />
      </CellGroup>

      <CellGroup title="弹层">
        <Cell title="Popup" isLink onClick={() => setPopupOpen(true)} />
        <Cell title="Dialog" isLink onClick={() => setDialogOpen(true)} />
        <Cell
          title="showConfirmDialog"
          isLink
          onClick={() =>
            showConfirmDialog({
              title: '删除确认',
              message: '删除后不可恢复，确定继续吗？',
              onConfirm: () => showSuccessToast('已删除'),
            })
          }
        />
      </CellGroup>

      <CellGroup title="Select">
        <Cell title="单选" value={<Select ariaLabel="城市" placeholder="请选择城市" options={CITY_OPTIONS} />} />
        <Cell title="多选" value={<Select ariaLabel="多选城市" multiple clearable options={CITY_OPTIONS} />} />
        <Cell title="可搜索" value={<Select ariaLabel="搜索城市" searchable options={CITY_OPTIONS} />} />
        <Cell title="分组" value={<Select ariaLabel="分组城市" searchable options={GROUPED_CITY_OPTIONS} />} />
        <Cell title="禁用" value={<Select ariaLabel="禁用选择器" disabled options={CITY_OPTIONS} />} />
        <Cell
          title="暂存确认"
          value={
            <Select
              ariaLabel="暂存确认城市"
              title="选择城市"
              placeholder="请选择城市"
              confirmable
              options={CITY_OPTIONS}
              onChange={(value) => showToast('确定：' + String(value))}
            />
          }
        />
        <Cell title="逃生舱" value={<Select ariaLabel="强制桌面" forceMode="desktop" options={CITY_OPTIONS} />} />
      </CellGroup>

      <CellGroup title="DropdownMenu">
        <Cell
          title="操作菜单"
          value={
            <DropdownMenu
              ariaLabel="操作菜单"
              title="更多操作"
              trigger="更多操作"
              items={MENU_ITEMS}
              onSelect={() => showSuccessToast('已选中')}
            />
          }
        />
        <Cell
          title="禁用"
          value={<DropdownMenu ariaLabel="禁用菜单" trigger="禁用状态" items={MENU_ITEMS} disabled />}
        />
      </CellGroup>

      <CellGroup title="DatePicker">
        <Cell
          title="单值"
          value={
            <DatePicker
              ariaLabel="日期"
              placeholder="请选择日期"
              onChange={(value) => showToast('日期：' + String(value))}
            />
          }
        />
        <Cell
          title="区间"
          value={
            <DatePicker ariaLabel="日期区间" placeholder="请选择区间" type="range" clearable />
          }
        />
        <Cell
          title="列裁剪"
          value={<DatePicker ariaLabel="年月" columnsType={['year', 'month']} />}
        />
        <Cell title="禁用" value={<DatePicker ariaLabel="禁用日期" disabled />} />
      </CellGroup>

      <CellGroup title="TimePicker">
        <Cell
          title="单值"
          value={
            <TimePicker
              ariaLabel="时间"
              placeholder="请选择时间"
              onChange={(value) => showToast('时间：' + String(value))}
            />
          }
        />
        <Cell
          title="区间"
          value={
            <TimePicker ariaLabel="时间区间" placeholder="请选择区间" type="range" clearable />
          }
        />
        <Cell
          title="列裁剪"
          value={<TimePicker ariaLabel="时分" columnsType={['hour', 'minute']} />}
        />
        <Cell title="禁用" value={<TimePicker ariaLabel="禁用时间" disabled />} />

      <CellGroup title="Rate">
        <Cell
          title="基础评分"
          value={
            <Rate
              ariaLabel="基础评分"
              defaultValue={3}
              onChange={(value) => showToast('评分：' + String(value))}
            />
          }
        />
        <Cell title="半星" value={<Rate ariaLabel="半星评分" allowHalf defaultValue={2.5} />} />
        <Cell title="自定义数量" value={<Rate ariaLabel="十星评分" count={10} defaultValue={7} />} />
        <Cell title="禁用" value={<Rate ariaLabel="禁用评分" disabled defaultValue={3} />} />
      </CellGroup>

      <CellGroup title="Slider">
        <Cell
          title="单值"
          value={
            <Slider
              ariaLabel="单值滑块"
              defaultValue={40}
              onChange={(value) => showToast('滑块：' + String(value))}
            />
          }
        />
        <Cell title="区间" value={<Slider ariaLabel="区间滑块" range defaultValue={[20, 60]} />} />
        <Cell title="自定义颜色与步长" value={<Slider ariaLabel="彩色滑块" defaultValue={30} step={5} activeColor="#ee0a24" />} />
        <Cell title="禁用" value={<Slider ariaLabel="禁用滑块" disabled defaultValue={30} />} />
      </CellGroup>

      <CellGroup title="Uploader">
        <Cell title="基础（本地预览）" value={<Uploader ariaLabel="基础上传" />} />
        <Cell title="多选 + 上限" value={<Uploader ariaLabel="多选上传" multiple maxCount={3} />} />
        <Cell title="图片 + 压缩" value={<Uploader ariaLabel="图片上传" accept="image/*" compress multiple />} />
        <Cell title="App 桥回填" value={<Uploader ariaLabel="桥接" onPickRequest={(h) => { void h.addFiles(new File([], "bridge.txt")); }} />} />
        <Cell title="禁用" value={<Uploader ariaLabel="禁用上传" disabled />} />
      </CellGroup>
      </CellGroup>

      <Popup open={popupOpen} position="bottom" onOpenChange={setPopupOpen} closeable aria-label="示例弹层">
        <div className="p-bv-md">任意内容</div>
      </Popup>

      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="声明式对话框"
        message="同一份 props，H5 底部抽屉 / PC 居中模态。"
        showCancelButton
        onConfirm={() => setDialogOpen(false)}
      />
    </div>
  );
}
`,
};

/* ---------------- helpers ---------------- */

function parseArgs(argv) {
  const out = { dir: resolve(ROOT, '.consumer-check'), keep: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) out.dir = resolve(argv[i + 1]);
    if (argv[i] === '--keep') out.keep = true;
  }
  return out;
}

function run(cmd, args, cwd) {
  return new Promise((resolvePromise) => {
    const env = { ...process.env, PATH: `${NODE_DIR};${process.env.PATH ?? ''}`, CI: '1', NO_COLOR: '1' };
    const child = spawn(cmd, args, { cwd, env, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** 起一个只服务 packages/registry/r/ 的静态服务，并记录每一次请求 */
function startRegistryServer() {
  const requests = [];
  const server = createServer(async (req, res) => {
    const name = (req.url ?? '/').split('?')[0].replace(/^\//, '');
    const file = join(REGISTRY_DIR, name);
    try {
      const body = await readFile(file, 'utf8');
      requests.push({ path: req.url, status: 200, bytes: body.length });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
    } catch {
      requests.push({ path: req.url, status: 404 });
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found' }));
    }
  });
  return new Promise((resolvePromise) => {
    server.listen(0, '127.0.0.1', () => {
      resolvePromise({ server, requests, port: server.address().port });
    });
  });
}

const ok = (s) => `\u2713 ${s}`;
const bad = (s) => `\u2717 ${s}`;

/* ---------------- main ---------------- */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const failures = [];
  const notes = [];

  if (!existsSync(REGISTRY_DIR)) {
    throw new Error(`registry 产物不存在：${REGISTRY_DIR}（先跑 npm run registry:build）`);
  }

  console.log(`[consumer] 目标目录：${opts.dir}`);
  if (!opts.keep) await rm(opts.dir, { recursive: true, force: true });

  console.log('[consumer] 1/6 写入项目骨架');
  for (const [rel, content] of Object.entries(FIXTURE)) {
    const file = join(opts.dir, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }

  const { server, requests, port } = await startRegistryServer();
  const registryUrl = `http://127.0.0.1:${port}/{name}.json`;
  console.log(`[consumer] 2/6 registry 服务已起：${registryUrl}`);

  // 消费者必须在 components.json 里声明命名空间，否则 @bivane/* 依赖无法解析
  const componentsJson = JSON.parse(await readFile(join(opts.dir, 'components.json'), 'utf8'));
  componentsJson.registries = { '@bivane': registryUrl };
  await writeFile(join(opts.dir, 'components.json'), `${JSON.stringify(componentsJson, null, 2)}\n`, 'utf8');

  try {
    // 每次都跑：依赖齐了只要一两秒，但能保证新加的 devDependency（如 @types/node）
    // 不会因为 node_modules 已存在而被静默跳过。
    console.log('[consumer] 3/6 npm install（首次约 35s）');
    const inst = await run(npm, ['install', '--no-audit', '--no-fund'], opts.dir);
    if (inst.code !== 0) {
      failures.push(`npm install 失败（exit ${inst.code}）\n${inst.stderr.slice(-1500)}`);
    }

    console.log('[consumer] 4/6 npx shadcn add（两段式，与 USAGE.md 一致）');
    // 第一段照文档先装 token；第二段装组件。
    // 注意 @bivane/tokens 其实也是 select-h5 的传递依赖，这里显式装是为了
    // 同时覆盖「显式声明」与「传递解析」两条路径。
    const addTokens = await run(
      npx,
      ['--yes', `shadcn@${SHADCN_VERSION}`, 'add', '@bivane/tokens', '--yes'],
      opts.dir,
    );
    if (addTokens.code !== 0 || /Something went wrong/i.test(`${addTokens.stdout}${addTokens.stderr}`)) {
      failures.push(`shadcn add @bivane/tokens 失败（exit ${addTokens.code}）\n${`${addTokens.stdout}${addTokens.stderr}`.slice(-2000)}`);
    }

    // 夹具 App.tsx 用到的组件一并装上——真实用户也是按用到的组件装。
    const componentItems = [
      '@bivane/select',
      '@bivane/dropdown-menu',
      '@bivane/date-picker',
      '@bivane/time-picker',
      '@bivane/rate',
      '@bivane/slider',
      '@bivane/uploader',
      '@bivane/search',
      '@bivane/dialog',
      '@bivane/toast',
      '@bivane/button',
      '@bivane/cell',
      '@bivane/tag',
      '@bivane/badge',
    ];
    const add = await run(npx, ['--yes', `shadcn@${SHADCN_VERSION}`, 'add', ...componentItems, '--yes'], opts.dir);
    const addOut = `${add.stdout}\n${add.stderr}`;
    if (add.code !== 0 || /Something went wrong/i.test(addOut)) {
      failures.push(`shadcn add 失败（exit ${add.code}）\n${addOut.slice(-2500)}`);
    }

    console.log('[consumer] 5/6 断言落盘文件');
    const missing = EXPECTED.filter((rel) => !existsSync(join(opts.dir, rel)));
    if (missing.length) {
      failures.push(`缺少 ${missing.length} 个文件：\n  ${missing.join('\n  ')}`);
    }

    console.log('[consumer] 6/6 消费者侧 typecheck + build');
    const tc = await run(npm, ['run', 'typecheck'], opts.dir);
    if (tc.code !== 0) failures.push(`消费者 tsc --noEmit 失败\n${`${tc.stdout}\n${tc.stderr}`.slice(-3000)}`);

    const build = await run(npm, ['run', 'build'], opts.dir);
    if (build.code !== 0) failures.push(`消费者 vite build 失败\n${`${build.stdout}\n${build.stderr}`.slice(-3000)}`);

    // 消费者侧样式产物：主题映射真的生效了吗
    if (build.code === 0) {
      const assetsDir = join(opts.dir, 'dist/assets');
      const cssFiles = existsSync(assetsDir)
        ? (await readdir(assetsDir)).filter((f) => f.endsWith('.css'))
        : [];
      if (cssFiles.length) {
        const css = await readFile(join(assetsDir, cssFiles[0]), 'utf8');
        // 构建后 minifier 会去掉属性选择器的引号，所以探针一律用无引号形式。
        // 每上一个组件就往这里加它的槽名与既有 token：这条断言真正回答的是
        // 「组件运行期依赖的 CSS，消费者拿得到吗」——漏分发时组件会「渲染出来但没样式」。
        const probes = [
          'bg-bv-overlay',
          'data-slot=select-panel',
          '--bv-select-option-height',
          'data-slot=menu-panel',
          'data-slot=menu-subpanel',
          '--bv-menu-row-height',
          '--bv-menu-pc-row-height',
          'data-slot=date-picker-panel',
          '--bv-date-picker-wheel-item-height',
          '--bv-date-picker-pc-cell-height',
          'data-slot=time-picker-panel',
          '--bv-time-picker-wheel-item-height',
          '--bv-time-picker-pc-panel-width',
          'data-slot=rate',
          'data-slot=rate-item',
          '--bv-rate-icon-size',
          'data-slot=slider',
          // Search：search-input 被 utilities.css 的聚焦环规则引用（整块胶囊出框），
          // 故进清单；search-suggestion* / search-h5-* 只是运行期槽标记，无 CSS 选择器引用，不进
          'data-slot=search-input',
          '--bv-search-height',
          '--bv-search-radius',
          // slider-bar / slider-rail / slider-line 没有任何 CSS 选择器引用，
          // 只是运行期标记，按「只有被引用的槽名才该出现在产物里」不进清单
          'data-slot=slider-button',
          '--bv-slider-bar-height',
          // uploader 令牌：宫格/遮罩（vant.css 变量应进消费者 CSS 产物）。
          // 注意：uploader 的槽名（uploader-add / grid-item…）全是 Tailwind 工具类拼的，
          // utilities.css 里没有 [data-slot=…] 规则引用它们，故不进探针（否则造假 MISS）。
          '--bv-uploader-grid-size',
          '--bv-uploader-mask-background',
          'bv-fade-in',
        ];
        for (const probe of probes) {
          if (!css.includes(probe)) {
            failures.push(`消费者 CSS 产物缺少「${probe}」——theme.css 没被处理或组件样式没生成`);
          }
        }
      } else {
        notes.push('未找到消费者 CSS 产物，跳过样式探针');
      }
    }
  } finally {
    server.close();
  }

  console.log('\n========== registry 请求记录 ==========');
  for (const r of requests) {
    console.log(`  ${r.status === 200 ? ok('200') : bad(String(r.status))} ${r.path}${r.bytes ? ` (${r.bytes}B)` : ''}`);
  }
  const fetched = requests.filter((r) => r.status === 200).length;
  console.log(`  共 ${requests.length} 次请求，成功 ${fetched} 次`);
  if (requests.some((r) => r.status !== 200)) {
    failures.push('registry 服务返回过非 200 —— 依赖名形式仍然不对');
  }
  if (fetched < 15) {
    notes.push(`只成功拉取 ${fetched} 个 item，传递依赖可能没走全（预期 15+）`);
  }

  if (notes.length) {
    console.log('\n========== 备注 ==========');
    for (const n of notes) console.log(`  - ${n}`);
  }

  console.log('\n========== 结论 ==========');
  if (failures.length === 0) {
    console.log(ok('消费者实测通过：空白项目按文档流程装完，类型与构建均通过'));
    process.exitCode = 0;
  } else {
    for (const f of failures) console.log(bad(f));
    console.log(`\n${bad(`${failures.length} 项失败`)}`);
    process.exitCode = 1;
  }

  // 跑完就把夹具删掉（除非 --keep）：里面是 npm install 出来的 node_modules 与 dist，
  // 留着既占几百 MB，又会被仓库的 lint 当成源码扫进去（曾一次刷出上百个假错）。
  // 诊断需要现场时用 `npm run consumer:check -- --keep`。
  if (!opts.keep) {
    await rm(opts.dir, { recursive: true, force: true }).catch(() => {
      /* Windows 上偶发 EBUSY（句柄未释放），下次运行开头还会再清一次，不影响结论 */
    });
    console.log(`\n[consumer] 已清理夹具：${opts.dir}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
