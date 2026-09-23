import * as React from 'react';

/**
 * Bivane DatePicker / Picker · 滚轮列（模式 C 的 H5 侧共享地基）
 *
 * 为什么不用手势库自研惯性：
 * 矩阵 §2.2 要求「惯性滚动 + 吸附对齐」，而这两件事浏览器都已经给了 ——
 *   · 惯性：原生 overflow 滚动在触屏上的动量（momentum scrolling）；
 *   · 吸附：CSS `scroll-snap-type: y mandatory` + 每项的 `scroll-snap-align: center`。
 * 自己写 pointer 物理既难对齐原生手感，也会和 Popup 的下拉关闭手势抢事件。
 * 所以本文件的职责只有两件：**算索引**与**兜底对齐**。
 *
 * 纯函数（clampIndex / nearestIndex / alignOffset / wheelPadding）单独导出，
 * 因为 jsdom 不做布局 —— DOM 测试里滚轮的滚动事件永远不会真的触发，
 * 「滚到哪停在哪个值」这类判定只能靠纯函数单测覆盖。
 */

/** 滚动停止多久后认为「用户松手了」，此时才回写值并兜底对齐 */
export const WHEEL_SETTLE_DELAY = 120;
/** 兜底对齐的容差：小于半个像素就不动它，避免和设备像素比打架 */
export const WHEEL_ALIGN_TOLERANCE = 0.5;
/** 可见行数：上下各留 2 行做「透视」，中间 1 行为选中行（Vant Picker 的 5 行制） */
export const WHEEL_VISIBLE_ROWS = 5;
/**
 * 单行高度兜底值。真实高度由 `--bv-date-picker-wheel-item-height` 决定，
 * 组件会实测行高并优先用它；实测拿不到（jsdom 不做布局）时才回落到这里。
 * 改 token 时同步改这里 —— 两者只在无布局环境里才会不一致。
 */
export const WHEEL_ITEM_HEIGHT = 44;

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return -1;
  return Math.min(Math.max(index, 0), count - 1);
}

/** 由滚动偏移算最近的行下标 */
export function nearestIndex(offset: number, itemHeight: number, count: number): number {
  if (itemHeight <= 0) return 0;
  return clampIndex(Math.round(offset / itemHeight), count);
}

/** 某一行对齐时的滚动偏移 */
export function alignOffset(index: number, itemHeight: number): number {
  return index * itemHeight;
}

/** 首尾各留出的空白，使第一行与最后一行都能滚到正中 */
export function wheelPadding(itemHeight: number, visibleRows: number = WHEEL_VISIBLE_ROWS): number {
  return itemHeight * Math.floor(visibleRows / 2);
}

/**
 * 判定「滚动结束后是否需要兜底对齐」。
 *
 * 加**位移守卫**（与 use-drag-to-dismiss 同一条约定）：
 * 偏移已经在容差内就直接返回 null，不要发一次 scrollTo ——
 * 原生吸附偶尔停在 ±0.5px 内，此时再滚一次会触发新的 scroll 事件，
 * 与「150ms 后回写值」形成自激循环，表现为滚轮轻微抖动。
 */
export function alignTargetIfNeeded(
  offset: number,
  itemHeight: number,
  count: number,
): number | null {
  const index = nearestIndex(offset, itemHeight, count);
  if (index < 0) return null;
  const target = alignOffset(index, itemHeight);
  return Math.abs(offset - target) > WHEEL_ALIGN_TOLERANCE ? target : null;
}

export interface UsePickerColumnOptions {
  /** 当前选中行下标（受控） */
  index: number;
  /** 行数 */
  count: number;
  /** 单行高度（px），由 token 量得或由调用方传入 */
  itemHeight: number;
  /** 滚动停下后回写新下标 */
  onIndexChange: (index: number) => void;
  settleDelay?: number;
}

export interface UsePickerColumnResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 挂到滚动容器的 onScroll 上 */
  onScroll: () => void;
  /** 主动滚到某一行（点击行、或键盘选择时用） */
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
}

export function usePickerColumn({
  index,
  count,
  itemHeight,
  onIndexChange,
  settleDelay = WHEEL_SETTLE_DELAY,
}: UsePickerColumnOptions): UsePickerColumnResult {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 记住「上一次由本列同步出去的 index」，初值 -1 表示**还没同步过**。
   * 外部 index 变化分两种来源：① 自己上报的（父组件只是把它存回去）→ 不能回滚视野，
   * 否则用户手刚松开的动量会被硬切；② 真的被外部改了（换年导致月/日列重建）→ 必须滚过去。
   * 用这个 ref 区分，比用一个 selfScrolling 布尔标记稳（后者在连续滚动里会被吃掉）。
   * 初值取 -1 而不是 index，是为了让挂载时**一定**滚到当前值上 ——
   * 否则滚轮每次都从第一行（最小年份）开始，用户以为值没生效。
   */
  const reportedRef = React.useRef(-1);

  const scrollToIndex = React.useCallback(
    (next: number, behavior: ScrollBehavior = 'smooth') => {
      const container = containerRef.current;
      if (!container || typeof container.scrollTo !== 'function') return;
      reportedRef.current = next;
      container.scrollTo({ top: alignOffset(next, itemHeight), behavior });
    },
    [itemHeight],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof container.scrollTo !== 'function') return;
    if (reportedRef.current === index) return;
    reportedRef.current = index;
    container.scrollTo({ top: alignOffset(index, itemHeight), behavior: 'auto' });
  }, [index, itemHeight]);

  const onScroll = React.useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const container = containerRef.current;
      if (!container) return;

      const target = alignTargetIfNeeded(container.scrollTop, itemHeight, count);
      if (target !== null && typeof container.scrollTo === 'function') {
        container.scrollTo({ top: target, behavior: 'smooth' });
      }

      const next = nearestIndex(container.scrollTop, itemHeight, count);
      if (next < 0 || next === reportedRef.current) return;
      reportedRef.current = next;
      onIndexChange(next);
    }, settleDelay);
  }, [count, itemHeight, onIndexChange, settleDelay]);

  React.useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  return { containerRef, onScroll, scrollToIndex };
}
