import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import {
    useDeviceMode,
    useDeviceModeAttrs,
    type DeviceMode,
} from "@/hooks/use-device-mode";
import {
    useInputNumberState,
    type InputNumberDirection,
    type InputNumberValue,
} from "@/hooks/use-input-number-state";

/**
 * Bivane InputNumber · 数量步进器（模式 B：同一值模型，两端换壳）
 * 交互定义见 bivane-responsive-matrix.md §2.2；值语义逐字对齐 Vant 4 van-stepper。
 *
 * 命名避开「步骤条 Steps」的歧义——这是「− 输入框 ＋」的离散数量录入件。
 *
 * ┌ H5 ── 横排 [−][输入框][＋]：数字键盘，28px 视觉按钮外扩 44px 热区，
 * │        长按 400ms 起连发（200ms/步）
 * └ PC ── [输入框][▲▼竖排微调列]：鼠标点箭头，焦点在输入框时
 *          ↑/↓ 微调、Home/End 直达边界
 *
 * 外壳差异走 JS 分支（契约 17）：H5 控件包在 input-number-h5-controls 内
 * （display:contents，不产生盒子），PC 渲染 input-number-spin 竖列；
 * 同一份值逻辑在 hooks/use-input-number-state，两个壳都是受控展示。
 */

export type { InputNumberValue, InputNumberDirection };

const LONG_PRESS_START_MS = 400;
const LONG_PRESS_INTERVAL_MS = 200;

export type InputNumberTheme = "default" | "round";

export interface InputNumberProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    | "value"
    | "defaultValue"
    | "size"
    | "onChange"
    | "onFocus"
    | "onBlur"
    | "inputMode"
    | "type"
    | "role"
> {
    /** 受控值；allowEmpty 时清空得到 null */
    value?: InputNumberValue;
    /** 初始值，默认 min（Vant defaultValue=1） */
    defaultValue?: InputNumberValue;
    /** 值变化（键入完整数字、加减、失焦收口都会触发） */
    onChange?: (value: InputNumberValue) => void;
    /** 最小值，默认 1 */
    min?: number;
    /** 最大值，默认 Infinity */
    max?: number;
    /** 步长，默认 1（浮点安全：0.1 连加不出 0.30000000004） */
    step?: number;
    /** 输入框宽，数字按 px；默认 32px */
    inputWidth?: number | string;
    /** 控件高 / 按钮尺寸，数字按 px；默认 28px */
    buttonSize?: number | string;
    /** 固定小数位；传入后失焦与步进结果补零定位（如 1 → "1.00"） */
    decimalLength?: number;
    /** 圆角风格：default 连体方块 / round 圆形独立按钮（仅 H5 壳生效） */
    theme?: InputNumberTheme;
    /** 禁用整个控件（加减与输入都不可用） */
    disabled?: boolean;
    /** 禁止键入（输入框只读，仍可点加减；焦点会被弹回，对齐 Vant） */
    disableInput?: boolean;
    /** 禁用加按钮（键入仍可） */
    disablePlus?: boolean;
    /** 禁用减按钮（键入仍可） */
    disableMinus?: boolean;
    /** 是否展示加按钮，默认 true */
    showPlus?: boolean;
    /** 是否展示减按钮，默认 true */
    showMinus?: boolean;
    /** 是否展示输入框，默认 true */
    showInput?: boolean;
    /** 只允许非负整数，默认 false（唤起不带小数点的数字键盘） */
    integer?: boolean;
    /** 允许清空：清空后值为 null、失焦不回填，默认 false */
    allowEmpty?: boolean;
    /** 长按加减按钮连发，默认 true（触屏连发，鼠标按住同样生效） */
    longPress?: boolean;
    /** 失焦时是否夹回 min/max，默认 true；关掉后允许暂留越界值 */
    autoFixed?: boolean;
    /**
     * 变更前闸门：返回 false / Promise<false> / 抛异常都放弃本次变更，
     * 异步等待期间控件锁定（与 Switch.beforeChange 同一套兜底）。
     */
    beforeChange?: (value: InputNumberValue) => boolean | Promise<boolean>;
    /** 已在边界仍点同方向时触发（可用于抖动提示） */
    onOverlimit?: (direction: InputNumberDirection) => void;
    /** 点加按钮（值已变化后触发） */
    onPlus?: () => void;
    /** 点减按钮（值已变化后触发） */
    onMinus?: () => void;
    /** 输入框聚焦 */
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
    /** 输入框失焦（此时做越界收口） */
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

function addCssUnit(size: number | string): string {
    return typeof size === "number" ? `${size}px` : size;
}

export const InputNumber = React.forwardRef<HTMLDivElement, InputNumberProps>(
    function InputNumber(props, ref) {
        const {
            value,
            defaultValue,
            min = 1,
            max = Infinity,
            step = 1,
            inputWidth,
            buttonSize,
            decimalLength,
            theme = "default",
            disabled = false,
            disableInput = false,
            disablePlus = false,
            disableMinus = false,
            showPlus = true,
            showMinus = true,
            showInput = true,
            integer = false,
            allowEmpty = false,
            longPress = true,
            autoFixed = true,
            beforeChange,
            onChange,
            onOverlimit,
            onPlus,
            onMinus,
            onFocus,
            onBlur,
            className,
            style,
            placeholder,
            forceMode,
            id,
            name,
            "aria-label": ariaLabel,
            ...rest
        } = props;

        const mode = useDeviceMode(forceMode);
        const modeAttrs = useDeviceModeAttrs(forceMode);
        const state = useInputNumberState({
            value,
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
        });

        /* ---------- 长按连发（pointer 统一触摸与鼠标）---------- */

        const timersRef = React.useRef<{
            start?: ReturnType<typeof setTimeout>;
            interval?: ReturnType<typeof setTimeout>;
        }>({});
        const longPressedRef = React.useRef(false);

        const clearTimers = React.useCallback(() => {
            if (timersRef.current.start !== undefined) {
                clearTimeout(timersRef.current.start);
                timersRef.current.start = undefined;
            }
            if (timersRef.current.interval !== undefined) {
                clearTimeout(timersRef.current.interval);
                timersRef.current.interval = undefined;
            }
        }, []);

        React.useEffect(() => clearTimers, [clearTimers]);

        const beginPress = React.useCallback(
            (direction: InputNumberDirection) => {
                if (!longPress) return;
                clearTimers();
                longPressedRef.current = false;
                timersRef.current.start = setTimeout(() => {
                    longPressedRef.current = true;
                    state.stepFrom(direction);
                    const loop = () => {
                        timersRef.current.interval = setTimeout(() => {
                            state.stepFrom(direction);
                            loop();
                        }, LONG_PRESS_INTERVAL_MS);
                    };
                    loop();
                }, LONG_PRESS_START_MS);
            },
            [longPress, clearTimers, state],
        );

        const endPress = React.useCallback(() => {
            clearTimers();
        }, [clearTimers]);

        // 长按结束后的 click 是长按的合成尾巴，吞掉它避免多发一档
        const handleClick = React.useCallback(
            (direction: InputNumberDirection) => {
                if (longPressedRef.current) {
                    longPressedRef.current = false;
                    return;
                }
                state.stepFrom(direction);
            },
            [state],
        );

        /* ---------- 输入框 ---------- */

        const handleKeyDown = React.useCallback(
            (event: React.KeyboardEvent<HTMLInputElement>) => {
                if (disableInput || disabled || state.pending) return;
                switch (event.key) {
                    case "ArrowUp":
                        event.preventDefault();
                        state.stepFrom("plus");
                        break;
                    case "ArrowDown":
                        event.preventDefault();
                        state.stepFrom("minus");
                        break;
                    case "Home":
                        if (Number.isFinite(min)) {
                            event.preventDefault();
                            state.commitValue(min);
                        }
                        break;
                    case "End":
                        if (Number.isFinite(max)) {
                            event.preventDefault();
                            state.commitValue(max);
                        }
                        break;
                    default:
                }
            },
            [disableInput, disabled, state, min, max],
        );

        const locked = disabled || state.pending;

        const inputEl = showInput ? (
            <Input
                {...rest}
                id={id}
                name={name}
                data-slot="input-number-input"
                type="text"
                inputMode={integer ? "numeric" : "decimal"}
                role="spinbutton"
                aria-label={ariaLabel}
                aria-valuenow={state.current ?? undefined}
                aria-valuemin={Number.isFinite(min) ? min : undefined}
                aria-valuemax={Number.isFinite(max) ? max : undefined}
                autoComplete="off"
                value={state.text}
                placeholder={placeholder}
                disabled={locked}
                readOnly={disableInput}
                onChange={(event) => state.handleTyping(event.target.value)}
                onFocus={(event) => {
                    // disableInput 下 Vant 直接 blur：只读输入框不允许真正聚焦
                    if (disableInput) event.currentTarget.blur();
                    else {
                        state.handleFocus();
                        onFocus?.(event);
                    }
                }}
                onBlur={(event) => {
                    state.handleBlur();
                    onBlur?.(event);
                }}
                onKeyDown={handleKeyDown}
                className="shrink-0 flex-none rounded-none border-0"
            />
        ) : null;

        /* ---------- 按钮（H5 横排 / PC 竖列共用同一事件模型）---------- */

        const renderButton = (
            direction: InputNumberDirection,
            extra?: React.ReactNode,
        ) => {
            const dirDisabled =
                direction === "minus"
                    ? state.minusDisabled
                    : state.plusDisabled;
            return (
                <button
                    key={direction}
                    type="button"
                    tabIndex={-1}
                    data-slot={
                        direction === "minus"
                            ? "input-number-minus"
                            : "input-number-plus"
                    }
                    data-disabled={dirDisabled ? "true" : undefined}
                    aria-disabled={dirDisabled || undefined}
                    // 不挂 disabled：边界点击仍要派发 onOverlimit（对齐 Vant）
                    onPointerDown={(event) => {
                        event.preventDefault();
                        beginPress(direction);
                    }}
                    onPointerUp={endPress}
                    onPointerCancel={endPress}
                    onPointerLeave={endPress}
                    onClick={(event) => {
                        event.preventDefault();
                        handleClick(direction);
                    }}
                >
                    {extra}
                    {/* 触屏热区外扩元素（仅 coarse 媒体查询里获得尺寸） */}
                    <span aria-hidden data-slot="input-number-hit" />
                </button>
            );
        };

        const cssVars = {
            ...(inputWidth !== undefined
                ? {
                      "--bv-input-number-input-width": addCssUnit(inputWidth),
                  }
                : null),
            ...(buttonSize !== undefined
                ? {
                      "--bv-input-number-input-height": addCssUnit(buttonSize),
                  }
                : null),
        } as React.CSSProperties;

        return (
            <div
                ref={ref}
                role="group"
                data-slot="input-number"
                data-theme={theme}
                data-disabled={locked ? "true" : undefined}
                {...modeAttrs}
                className={cn(
                    "inline-flex select-none items-stretch align-middle",
                    className,
                )}
                style={{ ...style, ...cssVars }}
            >
                {mode === "mobile" ? (
                    <span
                        data-slot="input-number-h5-controls"
                        className="contents"
                    >
                        {showMinus ? renderButton("minus") : null}
                        {inputEl}
                        {showPlus ? renderButton("plus") : null}
                    </span>
                ) : (
                    <>
                        {inputEl}
                        <span data-slot="input-number-pc-spin">
                            {showPlus
                                ? renderButton("plus", <Icon name="arrow-up" />)
                                : null}
                            {showMinus
                                ? renderButton(
                                      "minus",
                                      <Icon name="arrow-down" />,
                                  )
                                : null}
                        </span>
                    </>
                )}
            </div>
        );
    },
);
