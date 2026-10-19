import * as React from "react";

/**
 * Bivane InputNumber · 值逻辑（对齐 Vant 4 stepper/Stepper.tsx）
 *
 * 命名说明：组件名避开「步骤条 Steps」的歧义，值语义仍是 van-stepper——
 * 离散数量录入，输入框 + 加减控件。
 *
 * 与选择类组件同一组织原则：过滤、量化、夹紧全部写成纯函数（输入中间态
 * 「1.」「-」边界 DOM 测不出来），React 绑定只薄薄一层，异步 beforeChange
 * 与 Switch 同一套兜底（异常按拒绝处理）。
 */

/* ------------------------------------------------------------------ */
/* 类型                                                                */
/* ------------------------------------------------------------------ */

/** 空值语义：allowEmpty 时清空输入框得到 null（对应 Vant 的 ''） */
export type InputNumberValue = number | null;

export type InputNumberDirection = "plus" | "minus";

export interface InputNumberFormatOptions {
    min: number;
    max: number;
    /** 仅允许非负整数（Vant integer：键盘与过滤都禁小数点） */
    integer: boolean;
    /** 允许清空：清空后值为 null，失焦不回填 */
    allowEmpty: boolean;
    /** 固定小数位；传入后失焦/步进结果 toFixed(n) */
    decimalLength?: number;
}

export interface UseInputNumberOptions extends InputNumberFormatOptions {
    value?: InputNumberValue;
    defaultValue?: InputNumberValue;
    step: number;
    /** 失焦时是否夹紧到 min/max（Vant autoFixed）；键入过程永不夹紧 */
    autoFixed: boolean;
    disabled: boolean;
    disablePlus: boolean;
    disableMinus: boolean;
    beforeChange?: (value: InputNumberValue) => boolean | Promise<boolean>;
    onChange?: (value: InputNumberValue) => void;
    onOverlimit?: (direction: InputNumberDirection) => void;
    onPlus?: () => void;
    onMinus?: () => void;
}

/* ------------------------------------------------------------------ */
/* 纯函数                                                              */
/* ------------------------------------------------------------------ */

/**
 * 按键级过滤（移植 Vant formatNumber）。
 * 只剔非法字符，不做区间夹紧——中间态必须保留。
 * 小数点只允许第一个生效，后续点号丢弃（不能等失焦再纠正，否则会跳到别的值）。
 */
export function formatNumericInput(raw: string, allowDecimal: boolean): string {
    let next = String(raw).replace(/[^\d.]/g, "");
    if (!allowDecimal) {
        next = next.replace(/\./g, "");
        return next;
    }
    const firstDot = next.indexOf(".");
    if (firstDot === -1) return next;
    return (
        next.slice(0, firstDot + 1) +
        next.slice(firstDot + 1).replace(/\./g, "")
    );
}

/** 小数部分超长截断到指定位数（Vant onInput 的 decimalLength 分支） */
export function limitDecimalDigits(raw: string, decimalLength: number): string {
    if (!raw.includes(".")) return raw;
    const [intPart, frac = ""] = raw.split(".");
    return `${intPart}.${frac.slice(0, decimalLength)}`;
}

/**
 * 浮点安全相加（移植 Vant addNumber）：
 * 0.1+0.2 先放大 1e10 取整再缩回，规避二进制尾差导致的越界误判。
 */
export function addNumber(a: number, b: number): number {
    const cardinal = 10 ** 10;
    return Math.round((a + b) * cardinal) / cardinal;
}

/** 最终展示文本：decimalLength 存在时补零定位（1 → "1.0"） */
export function toDisplayText(
    value: InputNumberValue,
    decimalLength?: number,
): string {
    if (value === null) return "";
    return decimalLength !== undefined
        ? value.toFixed(decimalLength)
        : String(value);
}

/**
 * 规范化任意输入为「可用值」（移植 Vant format）。
 * @returns number；allowEmpty 且原始为空时返回 null
 */
export function normalizeValue(
    raw: number | string | null | undefined,
    opts: InputNumberFormatOptions,
    autoFixed = true,
): InputNumberValue {
    const { min, max, allowEmpty, integer, decimalLength } = opts;

    if (allowEmpty && (raw === "" || raw === null || raw === undefined)) {
        return null;
    }

    let text: string;
    if (typeof raw === "number") {
        // 科学计数法（1e-8）先展开为定点字符串，否则正则会丢掉 e
        text = String(raw).includes("e")
            ? raw.toFixed(decimalLength ?? 17)
            : String(raw);
    } else {
        text = String(raw ?? "");
    }

    text = formatNumericInput(text, !integer);
    let value = text === "" ? 0 : Number(text);
    if (Number.isNaN(value)) value = min;
    if (autoFixed) value = Math.max(Math.min(max, value), min);

    return decimalLength !== undefined ? Number(value.toFixed(decimalLength)) : value;
}

/* ------------------------------------------------------------------ */
/* React 绑定                                                          */
/* ------------------------------------------------------------------ */

export interface InputNumberState {
    /** 输入框实时文本（键入中间态可能与 current 不同，如 "1."） */
    text: string;
    /** 已提交值；allowEmpty 清空时为 null */
    current: InputNumberValue;
    minusDisabled: boolean;
    plusDisabled: boolean;
    /** beforeChange 异步进行中：控件整体锁定，防重复点按 */
    pending: boolean;
    /** 键入处理：返回应写进输入框的文本（已过滤/截位） */
    handleTyping: (raw: string) => string;
    /** 失焦收口：按 autoFixed 决定是否夹紧并回写文本 */
    handleBlur: () => void;
    /** 加/减一档；越界只报 onOverlimit，不改值 */
    stepFrom: (direction: InputNumberDirection) => void;
    /** 直达某值（PC 键盘 Home/End），同样过 beforeChange 与夹紧 */
    commitValue: (value: number) => void;
    handleFocus: () => void;
}

export function useInputNumberState(
    options: UseInputNumberOptions,
): InputNumberState {
    const {
        value: valueProp,
        defaultValue,
        min,
        max,
        step,
        integer,
        allowEmpty,
        decimalLength,
        autoFixed,
        disabled,
        disablePlus,
        disableMinus,
        beforeChange,
        onChange,
        onOverlimit,
        onPlus,
        onMinus,
    } = options;

    // useMemo 稳定引用：各回调以 formatOpts 整体入依赖，不必再展开五成员
    const formatOpts = React.useMemo<InputNumberFormatOptions>(
        () => ({ min, max, integer, allowEmpty, decimalLength }),
        [min, max, integer, allowEmpty, decimalLength],
    );

    const isControlled = valueProp !== undefined;
    const [innerValue, setInnerValue] = React.useState<InputNumberValue>(
        () => normalizeValue(valueProp ?? defaultValue ?? null, formatOpts),
    );
    const current = isControlled ? (valueProp as InputNumberValue) : innerValue;

    const [text, setText] = React.useState(() =>
        toDisplayText(
            normalizeValue(valueProp ?? defaultValue ?? null, formatOpts),
            decimalLength,
        ),
    );
    const focusedRef = React.useRef(false);
    const [pending, setPending] = React.useState(false);

    // 最新值引用：长按连发的定时器回调里拿到的始终是最新边界与拦截器
    const currentRef = React.useRef(current);
    currentRef.current = current;

    const commit = React.useCallback(
        (next: InputNumberValue) => {
            if (!isControlled) setInnerValue(next);
            onChange?.(next);
        },
        [isControlled, onChange],
    );

    /** 过 beforeChange 闸门；拒绝/异常都保持现值 */
    const commitGuarded = React.useCallback(
        (next: InputNumberValue): boolean => {
            if (!beforeChange) {
                commit(next);
                return true;
            }
            // 同步返回 false 时不进入 pending，点击像没发生过
            let allowed: boolean | Promise<boolean>;
            try {
                allowed = beforeChange(next);
            } catch {
                return false;
            }
            if (typeof allowed === "boolean") {
                if (allowed) commit(next);
                return allowed;
            }
            setPending(true);
            allowed
                .catch(() => false)
                .then((ok) => {
                    setPending(false);
                    if (ok) commit(next);
                });
            return true;
        },
        [beforeChange, commit],
    );

    /* 外部值/边界变化：失焦中无条件同步文本，聚焦中只收口数值不抢用户输入。
     * 非受控下边界（min/max/integer/decimalLength）变动要重夹——Vant 有同名 watch。 */
    React.useEffect(() => {
        if (isControlled) {
            if (valueProp === undefined) return;
            if (!focusedRef.current) {
                setText(
                    toDisplayText(
                        normalizeValue(valueProp, formatOpts),
                        decimalLength,
                    ),
                );
            }
            return;
        }
        const next = normalizeValue(currentRef.current, formatOpts);
        if (next !== currentRef.current) {
            setInnerValue(next);
            onChange?.(next);
        }
        if (!focusedRef.current) {
            setText(toDisplayText(next, decimalLength));
        }
    }, [valueProp, formatOpts, decimalLength, isControlled, onChange]);

    const handleFocus = React.useCallback(() => {
        focusedRef.current = true;
    }, []);

    const handleTyping = React.useCallback(
        (raw: string) => {
            let formatted = formatNumericInput(raw, !integer);
            if (decimalLength !== undefined && formatted.includes(".")) {
                formatted = limitDecimalDigits(formatted, decimalLength);
            }
            setText(formatted);

            // 只在文本构成完整数字时提交；"" / "." / "1." 这类中间态仅更新文本，
            // 收口交给失焦（对齐 Vant：isNumeric 为假时保留原文，不提前夹到 0）
            if (formatted === "") {
                if (allowEmpty) commitGuarded(null);
            } else if (Number.isFinite(Number(formatted))) {
                commitGuarded(Number(formatted));
            }
            return formatted;
        },
        [integer, decimalLength, allowEmpty, commitGuarded],
    );

    const handleBlur = React.useCallback(() => {
        focusedRef.current = false;
        // 以输入框文本为准（对齐 Vant 读 input.value）：用户清空时 current
        // 还停在旧值，用旧值会让「清空→失焦回填 min」失效
        const next = normalizeValue(text, formatOpts, autoFixed);
        if (next !== currentRef.current) commitGuarded(next);
        setText(toDisplayText(next, decimalLength));
    }, [text, autoFixed, formatOpts, decimalLength, commitGuarded]);

    const stepFrom = React.useCallback(
        (direction: InputNumberDirection) => {
            const base = currentRef.current ?? 0;
            if (direction === "minus") {
                if (disabled || disableMinus || base <= min) {
                    onOverlimit?.("minus");
                    return;
                }
            } else if (disabled || disablePlus || base >= max) {
                onOverlimit?.("plus");
                return;
            }

            const diff = direction === "minus" ? -step : step;
            const next = normalizeValue(
                addNumber(base, diff),
                formatOpts,
            );
            if (commitGuarded(next)) {
                setText(toDisplayText(next, decimalLength));
                if (direction === "minus") onMinus?.();
                else onPlus?.();
            }
        },
        [
            disabled,
            disableMinus,
            disablePlus,
            min,
            max,
            step,
            formatOpts,
            decimalLength,
            onOverlimit,
            onPlus,
            onMinus,
            commitGuarded,
        ],
    );

    const commitValue = React.useCallback(
        (value: number) => {
            if (disabled) return;
            const next = normalizeValue(value, formatOpts);
            if (next !== null && commitGuarded(next)) {
                setText(toDisplayText(next, decimalLength));
            }
        },
        [disabled, formatOpts, decimalLength, commitGuarded],
    );

    const numericForBound = current ?? 0;
    return {
        text,
        current,
        minusDisabled: disabled || disableMinus || numericForBound <= min,
        plusDisabled: disabled || disablePlus || numericForBound >= max,
        pending,
        handleTyping,
        handleBlur,
        stepFrom,
        commitValue,
        handleFocus,
    };
}
