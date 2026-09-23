import * as React from 'react';

/**
 * Bivane 底部弹层「下拉关闭」手势
 *
 * 只在 H5 形态使用（PC 是居中模态，没有拖拽语义），因此调用方应按模式传 enabled。
 * 选择原生 pointer 事件而非 @use-gesture：
 *  1. 需求只有「竖直拖拽 + 阈值/速度判定 + 回弹」，@use-gesture 的惯性/多点能力用不上；
 *  2. 模式 B 组件是单文件，引入手势库会进所有模式的包体（违背 §6.3）；
 *  3. 纯逻辑可抽成纯函数单测，比测手势库行为更可靠。
 * @use-gesture 预留给 P2 的滚轮 Picker（真正需要惯性与吸附）。
 */

export interface DragMetrics {
  /** 当前位移（px，向下为正） */
  offset: number;
  /** 释放瞬间速度（px/ms，向下为正） */
  velocity: number;
  /** 面板高度（px），用于计算拖过比例 */
  height: number;
  closeDistance: number;
  closeVelocity: number;
  /** 速度判定所需的最小位移，低于该值时忽略速度（滤掉手指抖动） */
  velocityMinOffset?: number;
}

export type DragOutcome = 'close' | 'reset';

/**
 * 速度判定的最小位移护栏。
 * 没有它的话，一次 4px 的抖动只要发生在 1ms 内，瞬时速度就会超过阈值而误关闭
 * —— 实测在单测里立刻复现（见 tests/drag-to-dismiss.test.ts）。
 */
export const DRAG_VELOCITY_MIN_OFFSET = 16;

/**
 * 拖拽结果判定（纯函数，单测覆盖）
 * 优先级：向上拖 → 回弹；向上甩动 → 回弹；向下甩动（且位移过护栏）→ 关闭；
 *        拖过距离阈值 → 关闭；拖过面板 40% → 关闭
 */
export function resolveDragOutcome({
  offset,
  velocity,
  height,
  closeDistance,
  closeVelocity,
  velocityMinOffset = DRAG_VELOCITY_MIN_OFFSET,
}: DragMetrics): DragOutcome {
  if (offset <= 0) return 'reset';
  if (velocity < -closeVelocity) return 'reset';
  if (offset >= velocityMinOffset && velocity > closeVelocity) return 'close';
  if (offset >= closeDistance) return 'close';
  if (height > 0 && offset >= height * 0.4) return 'close';
  return 'reset';
}

export interface UseDragToDismissOptions {
  enabled: boolean;
  /** 判定为关闭时调用 */
  onDismiss: () => void;
  /** 面板高度读取器（默认取根元素 offsetHeight） */
  getHeight?: () => number;
  /** 内部滚动位置读取器：已滚动时不接管手势，避免和内容滚动打架 */
  getScrollTop?: () => number;
  closeDistance?: number;
  closeVelocity?: number;
}

export interface DragToDismissResult {
  /** 绑到面板根元素：hook 会在此元素上监听 pointerdown */
  rootRef: React.RefObject<HTMLElement | null>;
  /** 实时位移，调用方用于 translateY */
  offset: number;
  dragging: boolean;
}

/** 拖拽区域标记：只有落在标记者内部才起拖（通常是顶部标题区 + 指示条） */
export const DRAG_REGION_ATTR = 'data-bv-drag-region';

/** 判定拖拽起点是否落在拖拽区内 */
function shouldStartDrag(target: EventTarget | null): boolean {
  // 事件直接打在面板根元素（无 target 元素）时按起拖处理
  if (!(target instanceof Element)) return true;
  return target.closest(`[${DRAG_REGION_ATTR}]`) !== null;
}

export function useDragToDismiss({
  enabled,
  onDismiss,
  getHeight,
  getScrollTop,
  closeDistance = 80,
  closeVelocity = 0.5,
}: UseDragToDismissOptions): DragToDismissResult {
  const rootRef = React.useRef<HTMLElement | null>(null);
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  // 用 ref 保存手势现场，避免 pointermove 高频 setState 之外的闭包失效
  const gesture = React.useRef({ startY: 0, startedAt: 0, active: false, offset: 0 });

  // 回调统一走 ref：调用方常传内联函数，直接进依赖会导致每帧重绑监听
  const dismissRef = React.useRef(onDismiss);
  dismissRef.current = onDismiss;
  const getHeightRef = React.useRef(getHeight);
  getHeightRef.current = getHeight;
  const getScrollTopRef = React.useRef(getScrollTop);
  getScrollTopRef.current = getScrollTop;

  React.useEffect(() => {
    if (!enabled) return undefined;

    const root = rootRef.current;
    if (!root) return undefined;

    const reset = () => {
      gesture.current.active = false;
      setDragging(false);
      setOffset(0);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (!shouldStartDrag(event.target)) return;
      // 内容已经滚下去了就不接管，让用户先滚回顶部
      if ((getScrollTopRef.current?.() ?? 0) > 0) return;

      gesture.current = {
        startY: event.clientY,
        startedAt: Date.now(),
        active: true,
        offset: 0,
      };
      setDragging(true);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!gesture.current.active) return;
      const raw = event.clientY - gesture.current.startY;
      const next = raw > 0 ? raw : 0;
      gesture.current.offset = next;
      setOffset(next);
    };

    const onPointerUp = () => {
      if (!gesture.current.active) return;
      const { offset: finalOffset, startedAt } = gesture.current;
      const elapsed = Math.max(1, Date.now() - startedAt);
      const velocity = finalOffset / elapsed;
      const height = getHeightRef.current?.() ?? root.offsetHeight ?? 0;

      const outcome = resolveDragOutcome({
        offset: finalOffset,
        velocity,
        height,
        closeDistance,
        closeVelocity,
      });

      reset();
      if (outcome === 'close') dismissRef.current();
    };

    root.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    return () => {
      root.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [enabled, closeDistance, closeVelocity]);

  // 外部关闭（或降级到 PC）时复位，避免下次打开带着残留位移
  React.useEffect(() => {
    if (enabled) return;
    setOffset(0);
    setDragging(false);
  }, [enabled]);

  return { rootRef, offset, dragging };
}
