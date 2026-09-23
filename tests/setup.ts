import '@testing-library/jest-dom/vitest';
import { beforeEach, vi } from 'vitest';
import { resetMediaQueryCache } from '@/hooks/use-device-mode';

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

beforeEach(() => {
  listeners.clear();
  resetViewport();
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
});
