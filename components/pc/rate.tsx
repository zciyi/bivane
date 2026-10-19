import * as React from "react";
import { cn } from "@/lib/utils";
import {
    RateStar,
    type RateRenderProps,
} from "@/components/ui/rate-parts";
import { resolveStarFraction, selectRateTarget } from "@/hooks/use-rate-state";

/**
 * Bivane Rate · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 点击选择；hover 在星上临时预览（移出还原，**只改本地预览态，不动受控值**）；
 * 键盘：容器 role="slider"，←→↑↓ ±1（allowHalf 时 ±0.5）、Home/End 跳到 0/count。
 */
export const PcRate = React.forwardRef<HTMLDivElement, RateRenderProps>(
    function PcRate(
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
        },
        ref,
    ) {
        const pxSize = typeof size === "number" ? `${size}px` : size;
        const pxGutter = typeof gutter === "number" ? `${gutter}px` : gutter;
        const [preview, setPreview] = React.useState<number | null>(null);
        const display = preview ?? current;
        const step = allowHalf ? 0.5 : 1;

        const targetFromItem = (
            index: number,
            clientX: number,
            el: HTMLElement,
        ): number => {
            let half = false;
            if (allowHalf) {
                const rect = el.getBoundingClientRect();
                half = clientX - rect.left < rect.width / 2;
            }
            return selectRateTarget(index, half, allowHalf);
        };

        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (disabled || readonly) return;
            let next: number;
            switch (event.key) {
                case "ArrowLeft":
                case "ArrowDown":
                    event.preventDefault();
                    next = current - step;
                    break;
                case "ArrowRight":
                case "ArrowUp":
                    event.preventDefault();
                    next = current + step;
                    break;
                case "Home":
                    event.preventDefault();
                    next = 0;
                    break;
                case "End":
                    event.preventDefault();
                    next = count;
                    break;
                default:
                    return;
            }
            onSelect(Math.max(0, Math.min(count, next)));
        };

        return (
            <div
                ref={ref}
                id={id}
                data-mode="pc"
                data-slot="rate"
                data-disabled={disabled || undefined}
                data-readonly={readonly || undefined}
                role="slider"
                aria-label={ariaLabel ?? "评分"}
                aria-valuenow={display}
                aria-valuemin={0}
                aria-valuemax={count}
                aria-valuetext={`${display} / ${count}`}
                aria-disabled={disabled || undefined}
                aria-readonly={readonly || undefined}
                tabIndex={disabled || readonly ? -1 : 0}
                onKeyDown={handleKeyDown}
                onPointerLeave={() => setPreview(null)}
                className={cn(
                    "relative inline-flex select-none items-center outline-none",
                    disabled ? "cursor-not-allowed" : "cursor-pointer",
                    className,
                )}
                style={{ gap: pxGutter, ...style }}
            >
                {Array.from({ length: count }, (_, index) => (
                    <span
                        key={index}
                        data-slot="rate-item"
                        data-index={index}
                        className="relative inline-flex"
                        style={{ width: pxSize, height: pxSize }}
                        onPointerEnter={(event) => {
                            if (disabled || readonly) return;
                            setPreview(
                                targetFromItem(
                                    index,
                                    event.clientX,
                                    event.currentTarget,
                                ),
                            );
                        }}
                        onClick={(event) => {
                            if (disabled || readonly) return;
                            setPreview(null);
                            onSelect(
                                targetFromItem(
                                    index,
                                    event.clientX,
                                    event.currentTarget,
                                ),
                            );
                        }}
                    >
                        <RateStar
                            fraction={resolveStarFraction(display, index)}
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
