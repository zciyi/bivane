import '@testing-library/jest-dom/vitest';
import { beforeAll, beforeEach, vi } from 'vitest';
import { act, cleanup, configure, render } from '@testing-library/react';
import { resetMediaQueryCache } from '@/hooks/use-device-mode';
// —— React.lazy 边界预热（架构 §6.3 包体分包）：18 个 responsive 组件的两端实现 ——
import { Calendar } from '@/components/responsive/calendar';
import { Cascader, type CascaderDataItem } from '@/components/responsive/cascader';
import { DatePicker } from '@/components/responsive/date-picker';
import { DateTimePicker } from '@/components/responsive/datetime-picker';
import { DropdownMenu, type MenuItem } from '@/components/responsive/dropdown-menu';
import { Picker } from '@/components/responsive/picker';
import { Popover, type PopoverAction } from '@/components/responsive/popover';
import { Rate } from '@/components/responsive/rate';
import { Slider } from '@/components/responsive/slider';
import { TimePicker } from '@/components/responsive/time-picker';
import { Tooltip } from '@/components/responsive/tooltip';
import { Uploader } from '@/components/responsive/uploader';
import { Select } from '@/components/responsive/select';
import { List } from '@/components/responsive/list';
import { Search } from '@/components/responsive/search';
import { Table, type TableColumn } from '@/components/responsive/table';
import { Tabbar, type TabbarItem } from '@/components/responsive/tabbar';
import { Toast } from '@/components/responsive/toast';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';

// RTL 默认异步工具超时 1s：CI 并行跑动下 lazy chunk 解析偶发踩线
// （曾出现 search/select 各漂移 1-2 个用例），放宽到 5s 只提高等待上限、不改变语义
configure({ asyncUtilTimeout: 5000 });

/**
 * 测试环境：可控 viewport / 指针能力的 matchMedia 模拟
 * 用法：setViewport({ width: 375 }) → 触发变更通知；组件内 hook 会立即重算
 */

export interface ViewportState {
  width: number;
  /** pointer: coarse && hover: none —— 触屏设备 */
  touch: boolean;
}

let viewport: ViewportState = { width: 1280, touch: false };
const listeners = new Set<() => void>();

/**
 * jsdom 会在「带着焦点的子树被移除」之后补抛一个 `window` 的 `blur`。
 * 浏览器里没有这回事 —— 测试进程根本丢不掉窗口焦点。
 *
 * 这条噪声对 Radix 的浮层是致命的：`@radix-ui/react-menu` 在菜单打开期间订阅
 * window 的 blur，把它理解成「用户切走了窗口」并直接关掉菜单
 * （dist/index.mjs：`const handleBlur = () => handleOpenChange(false)`）。
 * 现象极具误导性 —— 同一个测试文件里，从**第二个用例**起菜单会「打开了又立刻被关掉」，
 * 断言看到的只是「面板不存在」，极易误诊成「触发器的 handler 在卸载后失效」。
 * （真实原因是用例一卸载时留下的焦点触发了 jsdom 的 blur，而它在下一个用例的
 *  open 之后才被派发，正好被新挂载的菜单收下。）
 *
 * 在 setup 模块作用域注册：它先于任何组件挂载，靠注册顺序抢在 Radix 之前
 * 把事件截断（window 上的 blur 是 AT_TARGET 阶段，同阶段按注册顺序调用）。
 */
window.addEventListener('blur', (event) => {
  event.stopImmediatePropagation();
});

function evaluate(query: string): boolean {
  const maxWidth = /\(max-width:\s*(\d+)px\)/.exec(query);
  if (maxWidth) return viewport.width <= Number(maxWidth[1]);

  const minWidth = /\(min-width:\s*(\d+)px\)/.exec(query);
  if (minWidth) return viewport.width >= Number(minWidth[1]);

  if (query.includes('pointer: coarse')) return viewport.touch;
  if (query.includes('pointer: fine')) return !viewport.touch;

  return false;
}

function createMql(query: string): MediaQueryList {
  const mql = {
    media: query,
    get matches() {
      return evaluate(query);
    },
    onchange: null,
    addEventListener: (_type: string, cb: EventListenerOrEventListenerObject) => {
      listeners.add(cb as () => void);
    },
    removeEventListener: (_type: string, cb: EventListenerOrEventListenerObject) => {
      listeners.delete(cb as () => void);
    },
    addListener: (cb: () => void) => listeners.add(cb),
    removeListener: (cb: () => void) => listeners.delete(cb),
    dispatchEvent: () => false,
  };
  return mql as unknown as MediaQueryList;
}

export function setViewport(next: Partial<ViewportState>): void {
  viewport = { ...viewport, ...next };
  // hook 内部缓存了 MediaQueryList，需先清缓存再广播变更
  resetMediaQueryCache();
  listeners.forEach((cb) => cb());
}

export function resetViewport(): void {
  viewport = { width: 1280, touch: false };
  resetMediaQueryCache();
}

/* ------------------------------------------------------------------ *
 * React.lazy 边界预热（架构 §6.3 包体分包）
 *
 * components/responsive/* 的 H5/PC 两套实现已拆成异步 chunk（React.lazy），
 * 首帧渲染 Suspense fallback（null）—— 同步查询风格的测试会拿到空 DOM。
 *
 * React.lazy 的 resolved 状态挂在 lazy 对象上、**跨挂载持久**。因此每个测试
 * 文件运行前：① 先把 36 个实现模块拉进模块缓存；② 挂载一次探针树把两端边界
 * 各解析一次；③ 卸载。之后该文件内所有渲染都是同步的，既有测试无需改动。
 * （模块已缓存时边界在微任务内解析，无需等待真实加载耗时。）
 *
 * 异步路径本身的行为（fallback → 解析 → 同步）由已迁移的
 * tests/{select,list,tabbar,search,table,table-pagination,toast}.test.tsx
 * 用 load() / flushPresenter() 显式覆盖，不会因预热而失去验证。
 * ------------------------------------------------------------------ */

const PROBE_OPTIONS = [{ label: '甲', value: 'a' }];
const PROBE_ITEMS: TabbarItem[] = [{ value: 'a', label: '甲' }];
const PROBE_COLUMNS: TableColumn[] = [{ key: 'a', title: '甲' }];
const PROBE_MENU: MenuItem[] = [{ value: 'edit', label: '编辑' }];
const PROBE_ACTIONS: PopoverAction[] = [{ key: 'edit', text: '编辑' }];
const PROBE_CASCADER: CascaderDataItem[] = [{ label: '甲', value: 'a' }];

function ProbeTree() {
  return (
    <>
      {/* forceMode 组件：两端各挂一次，把 H5 / PC 两个 lazy 边界都解析掉 */}
      <Calendar forceMode="mobile" />
      <Calendar forceMode="desktop" />
      <Cascader forceMode="mobile" options={PROBE_CASCADER} />
      <Cascader forceMode="desktop" options={PROBE_CASCADER} />
      <DatePicker forceMode="mobile" />
      <DatePicker forceMode="desktop" />
      <DateTimePicker forceMode="mobile" />
      <DateTimePicker forceMode="desktop" />
      <DropdownMenu forceMode="mobile" items={PROBE_MENU} trigger="操作" />
      <DropdownMenu forceMode="desktop" items={PROBE_MENU} trigger="操作" />
      <Picker forceMode="mobile" columns={[['甲', '乙']]} />
      <Picker forceMode="desktop" columns={[['甲', '乙']]} />
      <Popover forceMode="mobile" actions={PROBE_ACTIONS}>
        <button type="button">更多</button>
      </Popover>
      <Popover forceMode="desktop" actions={PROBE_ACTIONS}>
        <button type="button">更多</button>
      </Popover>
      <Rate forceMode="mobile" />
      <Rate forceMode="desktop" />
      <Slider forceMode="mobile" />
      <Slider forceMode="desktop" />
      <TimePicker forceMode="mobile" />
      <TimePicker forceMode="desktop" />
      <Tooltip forceMode="mobile" content="提示">
        <button type="button">问</button>
      </Tooltip>
      <Tooltip forceMode="desktop" content="提示">
        <button type="button">问</button>
      </Tooltip>
      <Uploader forceMode="mobile" />
      <Uploader forceMode="desktop" />
      <Select forceMode="mobile" options={PROBE_OPTIONS} />
      <Select forceMode="desktop" options={PROBE_OPTIONS} />
      <List
        forceMode="mobile"
        data={PROBE_OPTIONS}
        renderItem={(item: unknown) => <span>{(item as { label: string }).label}</span>}
      />
      <List
        forceMode="desktop"
        data={PROBE_OPTIONS}
        renderItem={(item: unknown) => <span>{(item as { label: string }).label}</span>}
      />
      <Search forceMode="mobile" />
      <Search forceMode="desktop" />
      <Table forceMode="mobile" columns={PROBE_COLUMNS} data={[{ a: '甲' }]} />
      <Table forceMode="desktop" columns={PROBE_COLUMNS} data={[{ a: '甲' }]} />
      <Tabbar forceMode="mobile" items={PROBE_ITEMS} />
      <Tabbar forceMode="desktop" items={PROBE_ITEMS} />
      {/* Toast 无 forceMode：用 Provider 强制两端；duration=0 不起自动消失计时器 */}
      <ResponsiveProvider mode="mobile">
        <Toast open message="预热" duration={0} />
      </ResponsiveProvider>
      <ResponsiveProvider mode="desktop">
        <Toast open message="预热" duration={0} />
      </ResponsiveProvider>
    </>
  );
}

function installDomStubs(): void {
  vi.stubGlobal('matchMedia', (query: string) => createMql(query));

  // jsdom 不实现 ResizeObserver，而 Radix 的浮层定位（useSize）依赖它。
  // 只要「有」这个构造器即可：jsdom 不做布局，观测回调永远不会带来有效尺寸，
  // 定位退化为按 0 尺寸计算，不影响「浮层是否渲染、键盘与选中是否正确」这类断言。
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverStub {
      observe(): void {
        /* 无需实现：测试环境不产生布局尺寸变化 */
      }
      unobserve(): void {
        /* 同上 */
      }
      disconnect(): void {
        /* 同上 */
      }
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  }

  // jsdom 同样没有 scrollIntoView；组件里已做 typeof 守卫，
  // 这里补一个空实现，让「键盘落点滚入视野」这条路径也能被真实走到
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function scrollIntoView(): void {
      /* 无布局可滚动 */
    };
  }
}

beforeAll(async () => {
  // 探针渲染前先装好 DOM stub：useDeviceMode 在挂载时就会读 matchMedia
  installDomStubs();
  resetViewport();

  // ① 预拉 36 个实现模块（18 组件 × 两端）进模块缓存
  await Promise.all([
    import('@/components/h5/calendar'),
    import('@/components/pc/calendar'),
    import('@/components/h5/cascader'),
    import('@/components/pc/cascader'),
    import('@/components/h5/date-picker'),
    import('@/components/pc/date-picker'),
    import('@/components/h5/datetime-picker'),
    import('@/components/pc/datetime-picker'),
    import('@/components/h5/menu'),
    import('@/components/pc/menu'),
    import('@/components/h5/picker'),
    import('@/components/pc/picker'),
    import('@/components/h5/popover'),
    import('@/components/pc/popover'),
    import('@/components/h5/rate'),
    import('@/components/pc/rate'),
    import('@/components/h5/slider'),
    import('@/components/pc/slider'),
    import('@/components/h5/time-picker'),
    import('@/components/pc/time-picker'),
    import('@/components/h5/tooltip'),
    import('@/components/pc/tooltip'),
    import('@/components/h5/uploader'),
    import('@/components/pc/uploader'),
    import('@/components/h5/select'),
    import('@/components/pc/select'),
    import('@/components/h5/list'),
    import('@/components/pc/list'),
    import('@/components/h5/search'),
    import('@/components/pc/search'),
    import('@/components/h5/table'),
    import('@/components/pc/table'),
    import('@/components/h5/tabbar'),
    import('@/components/pc/tabbar'),
    import('@/components/h5/toast'),
    import('@/components/pc/toast'),
  ]);

  // ② 挂载探针树：模块已缓存，lazy 边界在微任务内解析；
  //    自旋微任务兜住模块运行时的 promise 链，解析完立即卸载（状态已持久）
  render(<ProbeTree />);
  await act(async () => {
    await Promise.all(Array.from({ length: 50 }, () => Promise.resolve()));
  });
  cleanup();
});

beforeEach(() => {
  listeners.clear();
  resetViewport();
  installDomStubs();
});
