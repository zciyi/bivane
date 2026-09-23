import * as React from 'react';

/**
 * Bivane 虚拟滚动窗口
 *
 * 用途：PC 的锚定下拉浮层（矩阵 §2.2 要求「虚拟滚动列表」）。
 * 只渲染视口内可见的项，用上下 padding 占位撑出真实滚动高度。
 *
 * 为什么是「固定项高 + 纯函数算窗口」：
 * 固定项高（PC 选项恒为 --bv-select-pc-option-height）让窗口计算退化成一次除法，
 * 没有测量、没有 ResizeObserver、没有二次布局，因此可以写成纯函数直接单测。
 * 若将来需要支持不定高，再换成测量式实现，调用方接口不变。
 *
 * 依赖方向：不 import 任何组件。
 */

/** 超过该条数才启用窗口化；小列表直接全量渲染，避免无谓的占位节点 */
export const VIRTUAL_THRESHOLD = 100;

export interface VirtualWindowInput {
  /** 滚动容器当前的 scrollTop */
  scrollTop: number;
  /** 滚动容器可见区高度 */
  viewportHeight: number;
  /** 单项固定高度 */
  itemHeight: number;
  /** 总项数 */
  count: number;
  /** 视口上下额外多渲染的项数，抵消快速滚动时的一帧空白 */
  overscan?: number;
}

export interface VirtualWindow {
  /** 渲染区间起点（含） */
  start: number;
  /** 渲染区间终点（不含） */
  end: number;
  /** 上方占位高度 */
  paddingTop: number;
  /** 下方占位高度 */
  paddingBottom: number;
  /** 列表总高，用于撑开滚动条 */
  totalHeight: number;
}

export function computeVirtualWindow({
  scrollTop,
  viewportHeight,
  itemHeight,
  count,
  overscan = 4,
}: VirtualWindowInput): VirtualWindow {
  const safeCount = Math.max(0, Math.floor(count));
  const totalHeight = safeCount * Math.max(0, itemHeight);

  // 参数不可用（未测量 / 空列表）时退化为「全量渲染」，绝不返回空区间，
  // 否则未测量完成的首帧会渲染成一片空白。
  if (safeCount === 0 || itemHeight <= 0 || viewportHeight <= 0) {
    return { start: 0, end: safeCount, paddingTop: 0, paddingBottom: 0, totalHeight };
  }

  const buffer = Math.max(0, Math.floor(overscan));
  const firstVisible = Math.floor(Math.max(0, scrollTop) / itemHeight);
  const start = Math.max(0, firstVisible - buffer);
  const visibleCount = Math.ceil(viewportHeight / itemHeight) + buffer * 2;
  const end = Math.min(safeCount, start + visibleCount);

  return {
    start,
    end,
    paddingTop: start * itemHeight,
    paddingBottom: Math.max(0, (safeCount - end) * itemHeight),
    totalHeight,
  };
}

export interface UseVirtualWindowOptions {
  itemHeight: number;
  count: number;
  overscan?: number;
  /** 传 false 时不做窗口化（分组列表等不定高场景），窗口恒为全量 */
  enabled?: boolean;
}

export interface UseVirtualWindowResult {
  /** 挂到滚动容器上的 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  window: VirtualWindow;
  /** 供容器同步测量视口高度（jsdom 里 clientHeight 恒为 0，因此需要可覆盖） */
  viewportHeight: number;
}

export function useVirtualWindow({
  itemHeight,
  count,
  overscan = 4,
  enabled = true,
}: UseVirtualWindowOptions): UseVirtualWindowResult {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node || !enabled) return undefined;

    const sync = () => {
      setScrollTop(node.scrollTop);
      setViewportHeight(node.clientHeight);
    };
    sync();

    node.addEventListener('scroll', sync, { passive: true });
    return () => node.removeEventListener('scroll', sync);
  }, [enabled]);

  // 项数变化（过滤后）时回到顶部，避免停留在越界位置显示一片空白。
  // 不区分 enabled：关闭窗口化时同样会因过滤而变短，也需要归零。
  React.useEffect(() => {
    const node = containerRef.current;
    if (node && node.scrollTop !== 0) {
      node.scrollTop = 0;
      setScrollTop(0);
    }
  }, [count]);

  const window = React.useMemo(
    () =>
      enabled
        ? computeVirtualWindow({ scrollTop, viewportHeight, itemHeight, count, overscan })
        : {
            start: 0,
            end: count,
            paddingTop: 0,
            paddingBottom: 0,
            totalHeight: count * itemHeight,
          },
    [enabled, scrollTop, viewportHeight, itemHeight, count, overscan],
  );

  return { containerRef, window, viewportHeight };
}
