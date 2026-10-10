import * as React from "react";
import { cn, composeRefs } from "@/lib/utils";
import {
  TOOLTIP_PC_OPEN_DELAY,
  TooltipBubble,
  type TipAnchor,
  type TipPoint,
} from "@/components/ui/tooltip-parts";
import type { DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane Tooltip · PC 实现
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 *   鼠标 hover 200ms 后弹出、随鼠标移动，移出即关；
 *   键盘 focus 立刻弹出（无鼠标可跟随，气泡锚定触发元素上方/下方）；
 *   Esc 关闭（矩阵明文要求）。
 *
 * hover 与 focus 是两个独立的「想要看提示」的意图：
 *   键盘聚焦的同时鼠标移出（或反之）不应误关 —— 只有两条都消失才关闭。
 * 气泡 pointer-events:none（在 parts 里），鼠标划到气泡区域不会触发 mouseleave。
 */

export interface PcTooltipProps {
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: React.ReactNode;
  bubbleId: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactElement;
}

export const PcTooltip = React.forwardRef<HTMLElement, PcTooltipProps>(
  function PcTooltip(
    {
      mode,
      open,
      onOpenChange,
      content,
      bubbleId,
      disabled = false,
      className,
      children,
    },
    ref,
  ) {
    const openTimerRef = React.useRef<number | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const pendingPointRef = React.useRef<TipPoint | null>(null);
    const hoveredRef = React.useRef(false);
    const focusedRef = React.useRef(false);

    const [anchor, setAnchor] = React.useState<TipAnchor>({
      kind: "point",
      x: 0,
      y: 0,
    });

    const clearOpenTimer = React.useCallback(() => {
      if (openTimerRef.current !== null) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    }, []);

    const flushPoint = React.useCallback(() => {
      rafRef.current = null;
      const point = pendingPointRef.current;
      pendingPointRef.current = null;
      if (point) setAnchor({ kind: "point", ...point });
    }, []);

    const requestPointUpdate = React.useCallback(
      (point: TipPoint) => {
        pendingPointRef.current = point;
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(flushPoint);
        }
      },
      [flushPoint],
    );

    React.useEffect(
      () => () => {
        clearOpenTimer();
        if (rafRef.current !== null)
          cancelAnimationFrame(rafRef.current);
      },
      [clearOpenTimer],
    );

    // Esc 关闭（监听 window：焦点停在触发器上，面板本身不可聚焦也不拦截事件）
    React.useEffect(() => {
      if (!open) return undefined;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") onOpenChange(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onOpenChange]);

    const handleMouseEnter = (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      hoveredRef.current = true;
      const point = { x: event.clientX, y: event.clientY };
      pendingPointRef.current = point;
      if (open) {
        // 从键盘锚定切到鼠标锚定：一进来就跟到鼠标位置
        setAnchor({ kind: "point", ...point });
        return;
      }
      clearOpenTimer();
      openTimerRef.current = window.setTimeout(() => {
        openTimerRef.current = null;
        setAnchor({
          kind: "point",
          ...(pendingPointRef.current ?? point),
        });
        onOpenChange(true);
      }, TOOLTIP_PC_OPEN_DELAY);
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
      if (disabled || !hoveredRef.current) return;
      if (open)
        requestPointUpdate({ x: event.clientX, y: event.clientY });
    };

    const handleMouseLeave = () => {
      hoveredRef.current = false;
      clearOpenTimer();
      // 键盘 focus 仍在时保留提示
      if (!focusedRef.current) onOpenChange(false);
    };

    const handleFocus = (event: React.FocusEvent<HTMLElement>) => {
      if (disabled) return;
      focusedRef.current = true;
      clearOpenTimer();
      if (open) return;
      // 键盘场景没有指针坐标：锚定触发元素矩形，上下翻转交给定位纯函数
      const rect = event.currentTarget.getBoundingClientRect();
      setAnchor({
        kind: "rect",
        rect: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      onOpenChange(true);
    };

    const handleBlur = () => {
      focusedRef.current = false;
      // 鼠标仍悬停时保留提示
      if (!hoveredRef.current) onOpenChange(false);
    };

    const childProps = children.props as Partial<{
      ref: React.Ref<HTMLElement>;
      className: string;
      onMouseEnter: React.MouseEventHandler<HTMLElement>;
      onMouseMove: React.MouseEventHandler<HTMLElement>;
      onMouseLeave: React.MouseEventHandler<HTMLElement>;
      onFocus: React.FocusEventHandler<HTMLElement>;
      onBlur: React.FocusEventHandler<HTMLElement>;
    }>;

    const chain =
      <E,>(
        theirs: ((event: E) => void) | undefined,
        ours: (event: E) => void,
      ) =>
      (event: E) => {
        theirs?.(event);
        ours(event);
      };

    // children 是任意元素（P 未知），断言成「可挂任意 props」的元素类型后再 clone
    const trigger = React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        ref: composeRefs(ref, childProps.ref),
        "data-slot": "tooltip-trigger",
        "data-mode": mode === "mobile" ? "h5" : "pc",
        "aria-describedby": open ? bubbleId : undefined,
        className: cn(childProps.className),
        onMouseEnter: chain(childProps.onMouseEnter, handleMouseEnter),
        onMouseMove: chain(childProps.onMouseMove, handleMouseMove),
        onMouseLeave: chain(childProps.onMouseLeave, handleMouseLeave),
        onFocus: chain(childProps.onFocus, handleFocus),
        onBlur: chain(childProps.onBlur, handleBlur),
      },
    );

    return (
      <>
        {trigger}
        <TooltipBubble
          mode={mode}
          show={open}
          anchor={anchor}
          id={bubbleId}
          className={className}
        >
          {content}
        </TooltipBubble>
      </>
    );
  },
);
