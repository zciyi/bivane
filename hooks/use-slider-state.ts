import * as React from "react";

/**
 * Bivane Slider · 值逻辑（对齐 Vant 4 slider/index.tsx）
 *
 * 把指针比例 ↔ 数值互相换算、按 step 量化、min/max 夹紧、range 双拇指保序。
 * 纯函数全部可单测；React 绑定只薄薄一层（与 Rate / InputNumber 同一原则）。
 */

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export type SliderValue = number | [number, number];

export interface UseSliderValueOptions {
    value?: SliderValue;
    defaultValue?: SliderValue;
    min: number;
    max: number;
    step: number;
    /** 双拇指区间，默认 false */
    range: boolean;
    disabled: boolean;
    readonly: boolean;
    onChange?: (value: SliderValue) => void;
}

/* ------------------------------------------------------------------ */
/* 纯函数                                                              */
/* ------------------------------------------------------------------ */

function clampNumber(value: number, min: number, max: number): number {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function clampRatio(ratio: number): number {
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
}

/** 按 step 量化到 min 基准的整数倍，再做浮点修正与夹紧（移植 Vant format） */
export function quantizeValue(
    value: number,
    min: number,
    max: number,
    step: number,
): number {
    if (step <= 0) return clampNumber(value, min, max);
    const steps = Math.round((value - min) / step);
    let next = min + steps * step;
    // 浮点尾差校正：0.1+0.2 类误差导致的 0.30000000000000004
    next = Math.round(next * 1e10) / 1e10;
    return clampNumber(next, min, max);
}

/** 单值 → 比例（0~1） */
export function valueToRatio(
    value: number,
    min: number,
    max: number,
): number {
    if (max === min) return 0;
    return clampRatio((value - min) / (max - min));
}

/** 比例 → 量化后的单值 */
export function ratioToValue(
    ratio: number,
    min: number,
    max: number,
    step: number,
): number {
    return quantizeValue(min + ratio * (max - min), min, max, step);
}

/** range 双值保序（lo ≤ hi）并各自量化 */
export function normalizeRange(
    value: [number, number],
    min: number,
    max: number,
    step: number,
): [number, number] {
    let lo = quantizeValue(value[0], min, max, step);
    let hi = quantizeValue(value[1], min, max, step);
    if (lo > hi) [lo, hi] = [hi, lo];
    return [lo, hi];
}

/* ------------------------------------------------------------------ */
/* React 绑定                                                          */
/* ------------------------------------------------------------------ */

export interface SliderValueBinding {
    current: SliderValue;
    /** 提交新值（单值或区间），受控/非受控统一入口 */
    apply: (next: SliderValue) => void;
}

export function useSliderValue(
    options: UseSliderValueOptions,
): SliderValueBinding {
    const {
        value,
        defaultValue,
        min,
        max,
        step,
        range,
        disabled,
        readonly,
        onChange,
    } = options;

    const isControlled = value !== undefined;

    const initial = React.useCallback((): SliderValue => {
        const d = defaultValue ?? (range ? [min, max] : min);
        return range
            ? normalizeRange(d as [number, number], min, max, step)
            : quantizeValue(d as number, min, max, step);
    }, [defaultValue, min, max, step, range]);

    const [inner, setInner] = React.useState<SliderValue>(initial);
    const current = isControlled
        ? range
            ? normalizeRange(value as [number, number], min, max, step)
            : quantizeValue(value as number, min, max, step)
        : inner;

    const apply = React.useCallback(
        (next: SliderValue) => {
            if (disabled || readonly) return;
            const quantized = range
                ? normalizeRange(next as [number, number], min, max, step)
                : quantizeValue(next as number, min, max, step);
            if (!isControlled) setInner(quantized);
            onChange?.(quantized);
        },
        [isControlled, min, max, step, range, disabled, readonly, onChange],
    );

    // 非受控下边界变化要重夹（Vant 有同名 watch）
    React.useEffect(() => {
        if (isControlled) return;
        const next = range
            ? normalizeRange(inner as [number, number], min, max, step)
            : quantizeValue(inner as number, min, max, step);
        if (next !== inner) setInner(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [min, max, step, range]);

    return { current, apply };
}
