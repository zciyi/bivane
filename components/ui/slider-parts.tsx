import * as React from "react";
import { cn } from "@/lib/utils";
import { valueToRatio, type SliderValue } from "@/hooks/use-slider-state";

/**
 * Bivane Slider · 共用视觉件（两端同形，差异只在手势/键盘，故视觉共用）
 *
 * 轨道（rail）+ 填充条（bar）+ 滑块钮（button）；方向（横/竖）由 props 决定，
 * 不写两套 CSS。颜色走 props（var token），不新增工具类。
 */

export interface SliderThumbSpec {
    /** 0 起拇指序号（range 用） */
    index: 0 | 1;
    /** 显示位置百分比 0~100（已含 reverse 处理、竖直方向已转为 top%） */
    pct: number;
    ariaValueNow: number;
    ariaLabel?: string;
    disabled: boolean;
    dragging: boolean;
    tabIndex: number;
    /** 通常不需要：拖拽手势挂在根容器上，按钮按下会冒泡上去 */
    onPointerDown?: (
        event: React.PointerEvent<HTMLButtonElement>,
    ) => void;
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export interface SliderTrackProps {
    vertical: boolean;
    /** 轨道/填充条厚度，已带单位（px） */
    barHeightPx: string;
    /** 滑块钮边长，已带单位（px） */
    buttonSizePx: string;
    activeColor: string;
    inactiveColor: string;
    /** 填充条：start=起端百分比，size=长度百分比（横：左起；竖：下起） */
    bar: { start: number; size: number };
    thumbs: SliderThumbSpec[];
}

/** 两端共用的渲染配置：值与外观，手势/键盘各自实现 */
export interface SliderRenderProps {
    current: SliderValue;
    min: number;
    max: number;
    step: number;
    range: boolean;
    reverse: boolean;
    vertical: boolean;
    disabled: boolean;
    readonly: boolean;
    barHeightPx: string;
    buttonSizePx: string;
    activeColor: string;
    inactiveColor: string;
    ariaLabel?: string;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    /** 提交值（单值或区间），来自分发层的 binding.apply */
    onApply: (next: SliderValue) => void;
    /** 拖拽开始/结束（Vant onDragStart/onDragEnd 同义） */
    onDragStart?: (value: SliderValue) => void;
    onDragEnd?: (value: SliderValue) => void;
}

export interface SliderGeometry {
    /** 填充条：start=起端百分比，size=长度百分比（横：左起；竖：下起） */
    bar: { start: number; size: number };
    /** 每个拇指的显示位置百分比（横：left%；竖：top%） */
    pcts: number[];
    /** 每个拇指的显示比例 0~1（已含 reverse） */
    dispRatios: number[];
}

/**
 * 百分比取整到 6 位小数：消除 `(1-0.2)*100` 这类浮点尾差
 * （19.999999999999996 当 top% 用无害，但会让纯函数断言退化成抄现象）。
 * 6 位小数 = 1e-6%，远低于任何可感知的亚像素误差。
 */
function roundPct(value: number): number {
    return Math.round(value * 1e6) / 1e6;
}

/**
 * 把当前值换算成布局几何：填充条起止 + 每个拇指的位置。
 * reverse 同时翻转所有比例；竖直方向把比例转成 top%（值越大越靠上）。
 *
 * 填充条永远连接「锚端」与「拇指」：
 *   - 单值：锚端是轨道零点；reverse 时零点改到对端（disp 坐标的 1）
 *   - 区间：两端就是两个拇指，与 reverse 无关
 * （早期实现用 `Math.min(...disp)` 当起端，单值时会得到 size=0 —— 填充条根本不渲染。）
 */
export function resolveSliderGeometry(
    current: SliderValue,
    min: number,
    max: number,
    range: boolean,
    reverse: boolean,
    vertical: boolean,
): SliderGeometry {
    const ratios = range
        ? [
              (current as [number, number])[0],
              (current as [number, number])[1],
          ].map((value) => valueToRatio(value, min, max))
        : [valueToRatio(current as number, min, max)];
    const dispRatios = ratios.map((ratio) => (reverse ? 1 - ratio : ratio));

    let lo: number;
    let hi: number;
    if (range) {
        lo = Math.min(...dispRatios);
        hi = Math.max(...dispRatios);
    } else if (reverse) {
        lo = dispRatios[0];
        hi = 1;
    } else {
        lo = 0;
        hi = dispRatios[0];
    }

    const start = roundPct(lo * 100);
    const size = roundPct((hi - lo) * 100);
    const pcts = dispRatios.map((d) =>
        roundPct(vertical ? (1 - d) * 100 : d * 100),
    );
    return { bar: { start, size }, pcts, dispRatios };
}

const SliderButton = React.forwardRef<
    HTMLButtonElement,
    SliderThumbSpec & { vertical: boolean; buttonSizePx: string; activeColor: string }
>(function SliderButton(
    {
        index,
        pct,
        ariaValueNow,
        ariaLabel,
        disabled,
        dragging,
        tabIndex,
        vertical,
        buttonSizePx,
        activeColor,
        onPointerDown,
        onKeyDown,
        onFocus,
        onBlur,
    },
    ref,
) {
    return (
        <button
            ref={ref}
            type="button"
            data-slot="slider-button"
            data-thumb={index}
            role="slider"
            aria-label={ariaLabel}
            aria-valuenow={ariaValueNow}
            aria-disabled={disabled || undefined}
            aria-pressed={dragging || undefined}
            tabIndex={tabIndex}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            onBlur={onBlur}
            className={cn(
                "absolute box-border -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--bv-slider-button-background)]",
                "border border-[var(--bv-slider-button-border-color)]",
                "shadow-[var(--bv-slider-button-shadow)]",
                disabled ? "cursor-not-allowed" : "cursor-grab",
                "touch-none",
                vertical ? "left-1/2" : "top-1/2",
            )}
            style={{
                width: buttonSizePx,
                height: buttonSizePx,
                ...(vertical
                    ? { top: `${pct}%` }
                    : { left: `${pct}%` }),
                // 拖拽中加粗边框呼应 Vant 按下态
                ...(dragging
                    ? { borderColor: activeColor }
                    : null),
            }}
        />
    );
});

export const SliderTrack = React.forwardRef<HTMLDivElement, SliderTrackProps>(
    function SliderTrack(
        {
            vertical,
            barHeightPx,
            buttonSizePx,
            activeColor,
            inactiveColor,
            bar,
            thumbs,
        },
        ref,
    ) {
        return (
            <div
                ref={ref}
                data-slot="slider-line"
                className="relative"
                style={{
                    height: vertical ? "100%" : barHeightPx,
                    width: vertical ? barHeightPx : "100%",
                }}
            >
                <div
                    data-slot="slider-rail"
                    className="absolute inset-0 rounded-full"
                    style={{ background: inactiveColor }}
                />
                <div
                    data-slot="slider-bar"
                    className={cn(
                        "absolute rounded-full",
                        // 厚度必须显式给：bar 是 absolute 定位，父级 `slider-line` 的
                        // 高度/宽度不会传递过来（没有 top/bottom 或 height 就是 0 高）。
                        // 只给 `width:%` 的水平形态会退化成「有宽度但不可见」——
                        // 与「有高度但零宽度」同级的静默缺陷，探针量 barH/barW 才抓到。
                        vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0",
                    )}
                    style={{
                        background: activeColor,
                        ...(vertical
                            ? {
                                  height: `${bar.size}%`,
                                  bottom: `${bar.start}%`,
                              }
                            : {
                                  width: `${bar.size}%`,
                                  left: `${bar.start}%`,
                              }),
                    }}
                />
                {thumbs.map((thumb) => (
                    <SliderButton
                        key={thumb.index}
                        {...thumb}
                        vertical={vertical}
                        buttonSizePx={buttonSizePx}
                        activeColor={activeColor}
                    />
                ))}
            </div>
        );
    },
);
