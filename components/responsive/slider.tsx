import * as React from "react";
import { H5Slider } from "@/components/h5/slider";
import { PcSlider } from "@/components/pc/slider";
import type { SliderRenderProps } from "@/components/ui/slider-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import { useSliderValue, type SliderValue } from "@/hooks/use-slider-state";

/**
 * Bivane Slider · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 触摸拖拽（touch-action:none），热区 44px，不进 Tab 流
 * └ PC ── 点轨跳转 + 鼠标拖拽 + 键盘方向键（±step / Home/End / PgUp·PgDn）
 *
 * 值语义（量化、夹紧、range 保序、拖拽手势）在 hooks/use-slider-state 与
 * use-slider-drag，两端同义 → 本层。滑块钮视觉与轨道两端共用（slider-parts）。
 * 颜色走 props（var token），不新增工具类（无需改 theme.css / BV_COLORS）。
 */
export interface SliderProps {
    /** 受控值；range 时为 [number, number] */
    value?: SliderValue;
    /** 初始值，默认 0（range 默认 [min, max]） */
    defaultValue?: SliderValue;
    /** 最小值，默认 0 */
    min?: number;
    /** 最大值，默认 100 */
    max?: number;
    /** 步长，默认 1 */
    step?: number;
    /** 轨道/填充条厚度，数字按 px，默认 2 */
    barHeight?: number | string;
    /** 滑块钮边长，数字按 px，默认 24 */
    buttonSize?: number | string;
    /** 填充条颜色，默认 primary token */
    activeColor?: string;
    /** 轨道底色，默认 gray-3 token */
    inactiveColor?: string;
    /** 双拇指区间，默认 false */
    range?: boolean;
    /** 反向（右/上为最小值），默认 false */
    reverse?: boolean;
    /** 竖直滑块，默认 false */
    vertical?: boolean;
    /** 禁用：不可拖动 */
    disabled?: boolean;
    /** 只读：不可拖动（不置灰，区别于 disabled） */
    readonly?: boolean;
    /** 值变化回调 */
    onChange?: (value: SliderValue) => void;
    /** 拖拽开始（受控值变更前触发） */
    onDragStart?: (value: SliderValue) => void;
    /** 拖拽结束 */
    onDragEnd?: (value: SliderValue) => void;
    /** 无障碍标签（渲染到每个滑块钮上），与全库其余组件一致用 ariaLabel */
    ariaLabel?: string;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 自定义内联样式（透传到根元素） */
    style?: React.CSSProperties;
    /** 根元素 id */
    id?: string;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

function toPx(size: number | string | undefined, fallback: string): string {
    if (size === undefined) return fallback;
    return typeof size === "number" ? `${size}px` : size;
}

export const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
    function Slider(
        {
            value,
            defaultValue,
            min = 0,
            max = 100,
            step = 1,
            barHeight = 2,
            buttonSize = 24,
            activeColor = "var(--bv-slider-active-background)",
            inactiveColor = "var(--bv-slider-inactive-background)",
            range = false,
            reverse = false,
            vertical = false,
            disabled = false,
            readonly = false,
            onChange,
            onDragStart,
            onDragEnd,
            ariaLabel,
            className,
            style,
            id,
            forceMode,
        },
        ref,
    ) {
        const mode = useDeviceMode(forceMode);
        const { current, apply } = useSliderValue({
            value,
            defaultValue,
            min,
            max,
            step,
            range,
            disabled,
            readonly,
            onChange,
        });

        const common: SliderRenderProps = {
            current,
            min,
            max,
            step,
            range,
            reverse,
            vertical,
            disabled,
            readonly,
            barHeightPx: toPx(barHeight, "2px"),
            buttonSizePx: toPx(buttonSize, "24px"),
            activeColor,
            inactiveColor,
            ariaLabel,
            className,
            style,
            id,
            onApply: apply,
            onDragStart,
            onDragEnd,
        };

        return mode === "mobile" ? (
            <H5Slider ref={ref} {...common} />
        ) : (
            <PcSlider ref={ref} {...common} />
        );
    },
);
