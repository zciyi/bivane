import * as React from "react";
import { cn } from "@/lib/utils";
import { RateStar, type RateRenderProps } from "@/components/ui/rate-parts";
import {
    buildRateHitRanges,
    rateScoreFromX,
    resolveStarFraction,
} from "@/hooks/use-rate-state";

/**
 * Bivane Rate · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 点击/手指横向滑动连续选值：**按坐标算分**，不靠 `elementFromPoint` 找 DOM
 * （对齐 Vant 4 rate 的 `getScoreByPosition`）。滑动时用当前布局的星矩形
 * 现算命中区间；allowHalf 时按落点在星的左/右半判定半星。
 * 不锁页面纵向滚动，故不写 touch-action:none。
 *
 * ⚠️ 不要为了「44px 触屏热区」给每颗星加外扩伪元素：星间距只有
 * `size + gutter` = 24px，44px 热区会互相重叠 20px，后一颗抢走前一颗的右半，
 * 表现为「点第1 颗却选了第 2 颗」。坐标算分天然就没有这个问题。
 */
export const H5Rate = React.forwardRef<HTMLDivElement, RateRenderProps>(
    function H5Rate(
        {
            current,
            count,
            allowHalf,
            readonly,
            disabled,
            size,
            gutter,
            color,
            voidColor,
            disabledColor,
            icon,
            voidIcon,
            className,
            style,
            id,
            ariaLabel,
            onSelect,
            touchable,
        },
        ref,
    ) {
        const pxSize = typeof size === "number" ? `${size}px` : size;
        const pxGutter = typeof gutter === "number" ? `${gutter}px` : gutter;
        const draggingRef = React.useRef(false);
        // 自持一个 ref 而不是只依赖 forwardRef 传来的那个：
        // 命中计算要读容器，而回调可能早于外部 ref 赋值被调用。
        const rootRef = React.useRef<HTMLDivElement | null>(null);
        const setRoot = React.useCallback(
            (node: HTMLDivElement | null) => {
                rootRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref) {
                    (
                        ref as React.RefObject<HTMLDivElement | null>
                    ).current = node;
                }
            },
            [ref],
        );

        /**
         * 落点 → 目标分值。用**当前布局**的星矩形现算区间，
         * 所以窗口尺寸变化 / count 变化后不需要缓存失效。
         *
         * 返回 null 表示「没有可用布局」：容器隐藏（display:none 祖先）
         * 或 jsdom 这类不做布局的环境下所有矩形都是 0 宽。此时由调用方
         * 按事件所在的星序兜底，绝不能返回一个「算出来的」错分值。
         */
        const scoreFromClientX = React.useCallback(
            (clientX: number): number | null => {
                const root = rootRef.current;
                if (!root) return null;
                const items = root.querySelectorAll('[data-slot="rate-item"]');
                const rects = Array.from(items).map((el) => {
                    const r = el.getBoundingClientRect();
                    return { left: r.left, width: r.width };
                });
                if (rects.length === 0) return null;
                if (!rects.some((r) => r.width > 0)) return null;
                const ranges = buildRateHitRanges(rects, allowHalf);
                return rateScoreFromX(clientX, ranges);
            },
            [allowHalf],
        );

        // 滑动选值（不阻止原生滚动：只在 touchable 且已按下时改值）
        React.useEffect(() => {
            if (!touchable || disabled || readonly) return undefined;
            const onMove = (event: PointerEvent) => {
                if (!draggingRef.current) return;
                const score = scoreFromClientX(event.clientX);
                if (score !== null) onSelect(score);
            };
            const onUp = () => {
                draggingRef.current = false;
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
            return () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
            };
        }, [onSelect, scoreFromClientX, touchable, disabled, readonly]);

        const handleItemPointerDown =
            (index: number) => (event: React.PointerEvent<HTMLSpanElement>) => {
                if (disabled || readonly || !touchable) return;
                draggingRef.current = true;
                const score = scoreFromClientX(event.clientX);
                if (score !== null) onSelect(score);
                else onSelect(allowHalf ? index + 0.5 : index + 1);
            };

        const handleItemClick = () => {
            if (disabled || readonly) return;
            // 拖拽范式：选择已在 pointerdown/move 完成，click 不再重复处理
            if (touchable) return;
        };

        return (
            <div
                ref={setRoot}
                id={id}
                data-mode="h5"
                data-slot="rate"
                data-disabled={disabled || undefined}
                data-readonly={readonly || undefined}
                role="slider"
                aria-label={ariaLabel ?? "评分"}
                aria-valuenow={current}
                aria-valuemin={0}
                aria-valuemax={count}
                aria-valuetext={`${current} / ${count}`}
                aria-disabled={disabled || undefined}
                aria-readonly={readonly || undefined}
                className={cn(
                    "relative inline-flex select-none items-center",
                    disabled && "cursor-not-allowed",
                    className,
                )}
                style={{ gap: pxGutter, ...style }}
                onClick={handleItemClick}
            >
                {Array.from({ length: count }, (_, index) => (
                    <span
                        key={index}
                        data-slot="rate-item"
                        data-index={index}
                        className={cn(
                            "relative inline-flex",
                            disabled || readonly
                                ? "cursor-default"
                                : "cursor-pointer",
                        )}
                        style={{ width: pxSize, height: pxSize }}
                        onPointerDown={handleItemPointerDown(index)}
                    >
                        <RateStar
                            fraction={resolveStarFraction(current, index)}
                            size={size}
                            color={color}
                            voidColor={voidColor}
                            disabledColor={disabledColor}
                            disabled={disabled}
                            icon={icon}
                            voidIcon={voidIcon}
                        />
                    </span>
                ))}
            </div>
        );
    },
);