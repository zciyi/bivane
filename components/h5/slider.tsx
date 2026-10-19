import * as React from "react";
import { cn } from "@/lib/utils";
import {
    SliderTrack,
    resolveSliderGeometry,
    type SliderRenderProps,
    type SliderThumbSpec,
} from "@/components/ui/slider-parts";
import { useSliderDrag } from "@/hooks/use-slider-drag";
import { ratioToValue } from "@/hooks/use-slider-state";

/**
 * Bivane Slider · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 触摸拖拽（轨道 touch-action:none 防拖拽时页面滚动）；点轨道任意位置跳转
 * （Vant 行为）；滑块钮不进 Tab 流（触屏惯例）。range 双拇指拖近不交叉。
 * 拖拽手势与 PC 共用 use-slider-drag（Pointer Capture 思路）。
 */
export const H5Slider = React.forwardRef<HTMLDivElement, SliderRenderProps>(
    function H5Slider(
        {
            current,
            min,
            max,
            step,
            range,
            reverse,
            vertical,
            disabled,
            readonly,
            barHeightPx,
            buttonSizePx,
            activeColor,
            inactiveColor,
            ariaLabel,
            className,
            style,
            id,
            onApply,
            onDragStart,
            onDragEnd,
        },
        ref,
    ) {
        const trackRef = React.useRef<HTMLDivElement>(null);
        const activeThumbRef = React.useRef<0 | 1>(0);

        const nearestThumb = (val: number): 0 | 1 => {
            if (!range) return 0;
            const [lo, hi] = current as [number, number];
            return Math.abs(val - lo) <= Math.abs(val - hi) ? 0 : 1;
        };

        const applyRatio = React.useCallback(
            (ratio: number) => {
                const val = ratioToValue(ratio, min, max, step);
                if (!range) {
                    onApply(val);
                    return;
                }
                const [lo, hi] = current as [number, number];
                if (activeThumbRef.current === 0) {
                    onApply([Math.min(val, hi), hi]);
                } else {
                    onApply([lo, Math.max(val, lo)]);
                }
            },
            [min, max, step, range, current, onApply],
        );

        const { beginTracking, ratioFromClient } = useSliderDrag(trackRef, {
            vertical,
            reverse,
            disabled,
            onDragStart: () => onDragStart?.(current),
            onDragEnd: () => onDragEnd?.(current),
            onDrag: applyRatio,
        });

        const handleTrackPointerDown = (
            event: React.PointerEvent<HTMLDivElement>,
        ) => {
            if (disabled || readonly) return;
            // 触屏：阻止拖拽时选中文本 / 触发原生滚动起点
            event.preventDefault();
            const buttonEl = (
                event.target as HTMLElement
            ).closest<HTMLElement>('[data-slot="slider-button"]');
            if (range && buttonEl) {
                // 抓住已有的滑块钮，不跳变
                activeThumbRef.current = Number(
                    buttonEl.getAttribute("data-thumb"),
                ) as 0 | 1;
            } else {
                const r = ratioFromClient(event.clientX, event.clientY);
                if (r === null) return;
                if (range) {
                    activeThumbRef.current = nearestThumb(
                        ratioToValue(r, min, max, step),
                    );
                }
                applyRatio(r);
            }
            beginTracking();
        };

        const geom = resolveSliderGeometry(
            current,
            min,
            max,
            range,
            reverse,
            vertical,
        );

        const thumbSpecs: SliderThumbSpec[] = (range ? [0, 1] : [0]).map(
            (i) => {
                const index = i as 0 | 1;
                const value = range
                    ? (current as [number, number])[index]
                    : (current as number);
                return {
                    index,
                    pct: geom.pcts[index],
                    ariaValueNow: value,
                    ariaLabel: ariaLabel
                        ? range
                            ? `${ariaLabel} ${index === 0 ? "起始" : "结束"}`
                            : ariaLabel
                        : undefined,
                    disabled,
                    dragging: false,
                    tabIndex: -1,
                };
            },
        );

        return (
            <div
                ref={ref}
                id={id}
                data-mode="h5"
                data-slot="slider"
                data-orientation={vertical ? "vertical" : "horizontal"}
                data-disabled={disabled || undefined}
                data-readonly={readonly || undefined}
                role="group"
                aria-label={ariaLabel}
                aria-disabled={disabled || undefined}
                className={cn(
                    "relative touch-none",
                    disabled && "cursor-not-allowed",
                    className,
                )}
                style={style}
                onPointerDown={handleTrackPointerDown}
            >
                <SliderTrack
                    ref={trackRef}
                    vertical={vertical}
                    barHeightPx={barHeightPx}
                    buttonSizePx={buttonSizePx}
                    activeColor={activeColor}
                    inactiveColor={inactiveColor}
                    bar={geom.bar}
                    thumbs={thumbSpecs}
                />
            </div>
        );
    },
);
