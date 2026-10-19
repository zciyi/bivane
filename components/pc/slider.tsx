import * as React from "react";
import { cn } from "@/lib/utils";
import {
    SliderTrack,
    resolveSliderGeometry,
    type SliderRenderProps,
    type SliderThumbSpec,
} from "@/components/ui/slider-parts";
import { useSliderDrag } from "@/hooks/use-slider-drag";
import { quantizeValue, ratioToValue } from "@/hooks/use-slider-state";

/**
 * Bivane Slider · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 点轨道跳转 + 鼠标拖拽（与 H5 共用 use-slider-drag）；滑块钮可聚焦，
 * 键盘：→/↑ +step、←/↓ -step、Home/End 到界、PgUp/PgDn 跨 10 步，焦点环。
 */
export const PcSlider = React.forwardRef<HTMLDivElement, SliderRenderProps>(
    function PcSlider(
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
        const [dragging, setDragging] = React.useState(false);

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
            onDragStart: () => {
                setDragging(true);
                onDragStart?.(current);
            },
            onDragEnd: () => {
                setDragging(false);
                onDragEnd?.(current);
            },
            onDrag: applyRatio,
        });

        const handleTrackPointerDown = (
            event: React.PointerEvent<HTMLDivElement>,
        ) => {
            if (disabled || readonly) return;
            const buttonEl = (
                event.target as HTMLElement
            ).closest<HTMLElement>('[data-slot="slider-button"]');
            if (range && buttonEl) {
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

        const moveThumb = React.useCallback(
            (thumb: 0 | 1, delta: number) => {
                if (!range) {
                    onApply(quantizeValue((current as number) + delta, min, max, step));
                    return;
                }
                const [lo, hi] = current as [number, number];
                if (thumb === 0) {
                    onApply([
                        quantizeValue(lo + delta, min, hi, step),
                        hi,
                    ]);
                } else {
                    onApply([
                        lo,
                        quantizeValue(hi + delta, lo, max, step),
                    ]);
                }
            },
            [range, current, min, max, step, onApply],
        );

        const handleThumbKeyDown =
            (thumb: 0 | 1) =>
            (event: React.KeyboardEvent<HTMLButtonElement>) => {
                if (disabled || readonly) return;
                let delta: number;
                switch (event.key) {
                    case "ArrowRight":
                    case "ArrowUp":
                        event.preventDefault();
                        delta = step;
                        break;
                    case "ArrowLeft":
                    case "ArrowDown":
                        event.preventDefault();
                        delta = -step;
                        break;
                    case "PageUp":
                        event.preventDefault();
                        delta = step * 10;
                        break;
                    case "PageDown":
                        event.preventDefault();
                        delta = -step * 10;
                        break;
                    case "Home":
                        event.preventDefault();
                        if (!range) onApply(min);
                        else if (thumb === 0)
                            onApply([min, (current as [number, number])[1]]);
                        else
                            onApply([
                                (current as [number, number])[0],
                                Math.max((current as [number, number])[0], min),
                            ]);
                        return;
                    case "End":
                        event.preventDefault();
                        if (!range) onApply(max);
                        else if (thumb === 0)
                            onApply([
                                Math.min((current as [number, number])[1], max),
                                (current as [number, number])[1],
                            ]);
                        else
                            onApply([(current as [number, number])[0], max]);
                        return;
                    default:
                        return;
                }
                moveThumb(thumb, delta);
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
                    dragging,
                    tabIndex: disabled || readonly ? -1 : 0,
                    onKeyDown: handleThumbKeyDown(index),
                };
            },
        );

        return (
            <div
                ref={ref}
                id={id}
                data-mode="pc"
                data-slot="slider"
                data-orientation={vertical ? "vertical" : "horizontal"}
                data-disabled={disabled || undefined}
                data-readonly={readonly || undefined}
                role="group"
                aria-label={ariaLabel}
                aria-disabled={disabled || undefined}
                className={cn(
                    "relative outline-none",
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
