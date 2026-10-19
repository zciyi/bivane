import * as React from "react";

/**
 * Bivane Rate · 值逻辑（对齐 Vant 4 rate/index.tsx）
 *
 * 只做值语义：把连续指针坐标换算成星级、半星落点、0~count 夹紧、clearable 清零。
 * 所有可单测的逻辑都收敛为纯函数；React 绑定只薄薄一层（与 Switch / InputNumber 同一原则）。
 */

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

export interface UseRateOptions {
    value?: number;
    defaultValue?: number;
    /** 星数，默认 5 */
    count: number;
    /** 允许半星选择，默认 false */
    allowHalf: boolean;
    disabled: boolean;
    readonly: boolean;
    /** 再次点击当前分值时清零（Vant 4 clearable），默认 false */
    clearable: boolean;
    onChange?: (value: number) => void;
}

/* ------------------------------------------------------------------ */
/* 纯函数                                                              */
/* ------------------------------------------------------------------ */

/** 把任意输入夹紧到合法星级：allowHalf 时对 0.5 取整，否则对整数取整，再夹 0~count */
export function clampRateValue(
    value: number,
    count: number,
    allowHalf: boolean,
): number {
    let v = Number.isFinite(value) ? value : 0;
    if (allowHalf) {
        v = Math.round(v * 2) / 2;
    } else {
        v = Math.round(v);
    }
    if (v < 0) v = 0;
    if (v > count) v = count;
    return v;
}

/**
 * 第 index（0 起）颗星被填充的比例，0~1。
 * 用于半星叠层：void 星之上盖一层按比例裁切的 full 星。
 */
export function resolveStarFraction(value: number, index: number): number {
    return Math.max(0, Math.min(1, value - index));
}

/**
 * 根据落点算目标分值：index 为 0 起星序，half 表示落在左半（仅 allowHalf 有效）。
 */
export function selectRateTarget(
    index: number,
    half: boolean,
    allowHalf: boolean,
): number {
    return half && allowHalf ? index + 0.5 : index + 1;
}

/** 一条命中区：分数 + 该分数生效的 x 下界（闭区间到下一条的 left） */
export interface RateHitRange {
    left: number;
    score: number;
}

/**
 * 由每颗星的**真实矩形**切出命中区间（对齐 Vant 4 rate的 `updateRanges`）。
 *
 * ⚠️ 为什么不能靠「热区 + elementFromPoint」：
 * Vant 根本没有 44px 热区，它用坐标算分。本库先前给每颗星加
 * `rate-hit` 伪元素外扩 `--bv-rate-touch-expand`(12px) 想凑 44px，
 * 但星间距只有 `size + gutter` = 24px —— **44px 热区互相重叠 20px**，
 * 后一颗的兄弟节点在 DOM 顺序上靠后、赢者通吃，于是**每颗星的右半 10px
 * 都会选中下一颗**（实测：点第 1 颗的 x=55 / 右边缘 59.5 → 命中 star#2）。
 * 视觉上完全看不出（星星还是星星），只有真机坐标探针能量出来。
 *
 * 所以：**不做热区叠加，改成按坐标切分**。每颗星建一条区间；
 * `allowHalf` 时该星再拆成两条（左半 `index+0.5`、右半 `index+1`）。
 */
export function buildRateHitRanges(
    rects: ReadonlyArray<{ left: number; width: number }>,
    allowHalf: boolean,
): RateHitRange[] {
    const ranges: RateHitRange[] = [];
    rects.forEach((rect, index) => {
        if (allowHalf) {
            ranges.push({ left: rect.left, score: index + 0.5 });
            ranges.push({
                left: rect.left + rect.width / 2,
                score: index + 1,
            });
        } else {
            ranges.push({ left: rect.left, score: index + 1 });
        }
    });
    return ranges;
}

/**
 * 由落点坐标反查分数（对齐 Vant 4 rate 的 `getScoreByPosition`）。
 *
 * **从后往前扫 + 严格 `>`**：这样落在两颗星之间的空隙里时，靠前那颗星
 * 胜出（与 Vant 一致），点击永远落在「用户认为的那颗星」上。
 * 返回 null 表示 x 在第一颗星左侧（此时调用方按 allowHalf 兜底到0.5 / 1）。
 */
export function rateScoreFromX(
    x: number,
    ranges: ReadonlyArray<RateHitRange>,
): number | null {
    for (let i = ranges.length - 1; i >= 0; i--) {
        if (x > ranges[i].left) return ranges[i].score;
    }
    return null;
}

/* ------------------------------------------------------------------ */
/* React 绑定                                                          */
/* ------------------------------------------------------------------ */

export interface RateValueBinding {
    current: number;
    /** 选某颗星（已含 clearable 同值清零逻辑），readonly/disabled 下空操作 */
    selectStar: (target: number) => void;
    /** 直接提交（hover 预览不在此列——预览是纯本地态，不进本函数） */
    commit: (value: number) => void;
}

export function useRateValue(options: UseRateOptions): RateValueBinding {
    const {
        value: valueProp,
        defaultValue = 0,
        count,
        allowHalf,
        disabled,
        readonly,
        clearable,
        onChange,
    } = options;

    const isControlled = valueProp !== undefined;
    const [inner, setInner] = React.useState(() =>
        clampRateValue(valueProp ?? defaultValue, count, allowHalf),
    );
    const current = isControlled
        ? clampRateValue(valueProp as number, count, allowHalf)
        : inner;

    const commit = React.useCallback(
        (next: number) => {
            const quantized = clampRateValue(next, count, allowHalf);
            if (!isControlled) setInner(quantized);
            onChange?.(quantized);
        },
        [isControlled, count, allowHalf, onChange],
    );

    const selectStar = React.useCallback(
        (target: number) => {
            if (disabled || readonly) return;
            if (clearable && current === target) {
                commit(0);
            } else {
                commit(target);
            }
        },
        [disabled, readonly, clearable, current, commit],
    );

    return { current, selectStar, commit };
}
