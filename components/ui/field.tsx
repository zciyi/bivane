import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import {
    clampNumericValue,
    validateFieldRules,
    type FieldAutosizeConfig,
    type FieldClearTrigger,
    type FieldFormatTrigger,
    type FieldRule,
    type FieldTextAlign,
    type FieldType,
    type FieldValidateTrigger,
} from "@/hooks/use-field-state";

/**
 * Bivane Field · 对齐 Vant <van-field>（模式 A，Cell 行外壳）
 *
 * 结构与 Vant 一致：Cell 骨架 + 左 label（必填星/冒号）+ body（控件行、错误文案、
 * 字数）。控件本体复用 ui/input.tsx 的 Input/Textarea；数字过滤在子件完成，
 * 本文件负责格式化串接、失焦夹紧、rules 校验、清除图标与聚焦态。
 *
 * 双模式差异只有 CSS 层：PC 键盘焦点环由子件的 .bv-focus-ring 按指针能力给出，
 * PC 边框盒由 field-box 在 pointer:fine 下呈现，本文件不做模式判定（矩阵 §3.13）。
 */

export type {
    FieldAutosizeConfig,
    FieldClearTrigger,
    FieldFormatTrigger,
    FieldRule,
    FieldTextAlign,
    FieldType,
    FieldValidateTrigger,
};

/** ref 实例方法（逐字对齐 Vant Field 实例方法，另加表单聚合用的校验入口） */
export interface FieldInstance {
    focus: () => void;
    blur: () => void;
    validate: () => Promise<boolean>;
    resetValidation: () => void;
}

export interface FieldProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "children" | "defaultValue" | "onChange" | "onClick" | "onFocus" | "onBlur"
> {
    /** 输入值（受控）；number 会归一化为字符串展示 */
    value?: string | number;
    /** 非受控初值 */
    defaultValue?: string | number;
    /** 值变更回调（已完成数字过滤与 formatter） */
    onChange?: (value: string) => void;
    /** 类型；textarea 渲染多行控件，digit 为纯数字键盘输入 */
    type?: FieldType | "textarea";
    /** 左侧标题 */
    label?: React.ReactNode;
    /** label 宽度，默认 6.2em（Vant 值） */
    labelWidth?: number | string;
    /** label 对齐；top 时标题独占一行 */
    labelAlign?: FieldTextAlign | "top";
    /** label 后展示冒号 */
    colon?: boolean;
    /** 只画必填红星（校验语义归 rules） */
    required?: boolean;
    /** label 自定义类名 */
    labelClassName?: string;
    /** 输入内容对齐 */
    inputAlign?: FieldTextAlign;
    /** 占位文案 */
    placeholder?: string;
    /** 原生 name（表单提交标识） */
    name?: string;
    /** 控件 id；不传时用 useId 自动生成并关联 label */
    id?: string;
    /** 最大字符数，同时透传原生 maxlength */
    maxlength?: number | string;
    /** number/digit 专用：失焦夹紧下界 */
    min?: number;
    /** number/digit 专用：失焦夹紧上界 */
    max?: number;
    /** textarea 可见行数 */
    rows?: number;
    /** textarea 自适应高度 */
    autosize?: boolean | FieldAutosizeConfig;
    /** 禁用：不可聚焦、不可键入 */
    disabled?: boolean;
    /** 只读：不可键入，仍可聚焦/复制；常配合 arrowDirection 做选择器入口 */
    readOnly?: boolean;
    /** 垂直居中（默认 true，对齐 Vant） */
    center?: boolean;
    /** 是否展示下边框（默认 true；PC 下底线让位给边框盒） */
    border?: boolean;
    /** 大号行（同 Cell large：纵向 12px、字号 16px） */
    size?: "large" | "normal";
    /** 右侧箭头方向（配合 readOnly 做选择器入口） */
    arrowDirection?: "left" | "up" | "down" | "right";
    /** 展示右侧箭头 */
    isLink?: boolean;
    /** 行按压反馈（readOnly 选择器入口时用） */
    clickable?: boolean;
    /** 可清空 */
    clearable?: boolean;
    /** 清除图标出现时机：聚焦（默认）/ 常显 */
    clearTrigger?: FieldClearTrigger;
    /** 自定义清除图标 */
    clearIcon?: React.ReactNode;
    /** 左侧图标 */
    leftIcon?: React.ReactNode;
    /** 右侧图标 */
    rightIcon?: React.ReactNode;
    /** 值格式化器 */
    formatter?: (value: string) => string;
    /** 格式化时机 */
    formatTrigger?: FieldFormatTrigger;
    /** 受控错误态（优先级高于 rules 校验结果） */
    error?: boolean;
    /** 受控错误文案（不传时展示 rules 产生的文案） */
    errorMessage?: React.ReactNode;
    /** 错误文案对齐 */
    errorMessageAlign?: FieldTextAlign;
    /** 校验规则 */
    rules?: readonly FieldRule[];
    /** 校验时机，默认失焦 */
    validateTrigger?: FieldValidateTrigger;
    /** 配合 maxlength 展示「n/max」字数 */
    showWordLimit?: boolean;
    /** 右侧动作区（Vant #button 插槽，如「发送验证码」），PC 下留在边框盒外 */
    action?: React.ReactNode;
    /**
     * 自定义控件体：传入后不再渲染原生输入框（Vant #input 插槽语义），
     * 用于 readOnly Field 内嵌选择器触发器；rules 仍按 value 字符串校验。
     */
    children?: React.ReactNode;
    /** 整行点击 */
    onClick?: React.MouseEventHandler<HTMLDivElement>;
    /** 控件区域点击（自定义控件体场景下等价于 Vant click-input） */
    onClickInput?: React.MouseEventHandler<HTMLDivElement>;
    /** 点左图标 */
    onClickLeftIcon?: React.MouseEventHandler<HTMLElement>;
    /** 点右图标 */
    onClickRightIcon?: React.MouseEventHandler<HTMLElement>;
    /** 点清除图标 */
    onClear?: React.MouseEventHandler<HTMLButtonElement>;
    /** 原生 focus 事件（透传给内部控件） */
    onFocus?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    /** 原生 blur 事件（透传给内部控件） */
    onBlur?: React.FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    /** 透传给原生控件的常用属性 */
    autoComplete?: string;
    /** 初始渲染后自动聚焦 */
    autoFocus?: boolean;
    /** 移动端输入法确认键样式（透传原生 enterkeyhint） */
    enterKeyHint?: React.InputHTMLAttributes<HTMLInputElement>["enterKeyHint"];
    /** 拼写检查（透传原生 spellcheck） */
    spellCheck?: boolean;
    /** 自动大写（透传原生 autocapitalize） */
    autoCapitalize?: string;
    /** 自动纠正（透传原生 autocorrect） */
    autoCorrect?: string;
}

const ARROW_ICON: Record<
    NonNullable<FieldProps["arrowDirection"]>,
    IconName
> = {
    right: "arrow",
    left: "arrow-left",
    down: "arrow-down",
    up: "arrow-down",
};

function alignClass(align: FieldTextAlign | undefined): string {
    if (align === "center") return "text-center";
    if (align === "right") return "text-right";
    return "text-left";
}

export const Field = React.forwardRef<FieldInstance, FieldProps>(function Field(
    {
        value,
        defaultValue,
        onChange,
        type = "text",
        label,
        labelWidth,
        labelAlign = "left",
        colon = false,
        required = false,
        labelClassName,
        inputAlign,
        placeholder,
        name,
        id,
        maxlength,
        min,
        max,
        rows,
        autosize = false,
        disabled = false,
        readOnly = false,
        center = true,
        border = true,
        size = "normal",
        arrowDirection = "right",
        isLink = false,
        clickable,
        clearable = false,
        clearTrigger = "focus",
        clearIcon,
        leftIcon,
        rightIcon,
        formatter,
        formatTrigger = "onChange",
        error,
        errorMessage,
        errorMessageAlign = "left",
        rules,
        validateTrigger = "onBlur",
        showWordLimit = false,
        action,
        children,
        onClick,
        onClickInput,
        onClickLeftIcon,
        onClickRightIcon,
        onClear,
        onFocus,
        onBlur,
        autoComplete,
        autoFocus,
        enterKeyHint,
        spellCheck,
        autoCapitalize,
        autoCorrect,
        className,
        ...rest
    },
    ref,
) {
    const isTextarea = type === "textarea";
    const controlType: FieldType = isTextarea ? "text" : type;
    const isControlled = value !== undefined;
    const [innerValue, setInnerValue] = React.useState(() =>
        String(defaultValue ?? ""),
    );
    const currentValue = isControlled ? String(value) : innerValue;

    const [focused, setFocused] = React.useState(false);
    const [ruleMessage, setRuleMessage] = React.useState<string | null>(null);
    const validationSeq = React.useRef(0);

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const reactId = React.useId();
    const inputId = id ?? `bv-field-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    const large = size === "large";

    // 受控错误优先：显式 error/errorMessage 时不被 rules 结果覆盖
    const hasControlledError = error !== undefined;
    const invalid = hasControlledError ? error : ruleMessage !== null;
    const errorText = errorMessage !== undefined ? errorMessage : ruleMessage;

    const commit = React.useCallback(
        (next: string) => {
            if (!isControlled) setInnerValue(next);
            onChange?.(next);
        },
        [isControlled, onChange],
    );

    const runValidation = React.useCallback(
        async (nextValue: string, trigger?: FieldValidateTrigger) => {
            const seq = ++validationSeq.current;
            const result = await validateFieldRules(nextValue, rules, trigger);
            // 只采纳最新一次校验结果，避免慢规则回来覆盖新状态
            if (seq !== validationSeq.current) return result.valid;
            setRuleMessage(result.valid ? null : (result.message ?? null));
            return result.valid;
        },
        [rules],
    );

    React.useImperativeHandle(
        ref,
        () => ({
            focus: () => {
                inputRef.current?.focus();
                textareaRef.current?.focus();
            },
            blur: () => {
                inputRef.current?.blur();
                textareaRef.current?.blur();
            },
            validate: async () => runValidation(currentValue, undefined),
            resetValidation: () => {
                validationSeq.current += 1;
                setRuleMessage(null);
            },
        }),
        [runValidation, currentValue],
    );

    const handleFocus = (
        event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setFocused(true);
        onFocus?.(event);
    };

    const handleBlur = (
        event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setFocused(false);

        // 失焦三件事，顺序固定：min/max 夹紧 → onBlur 格式化 → 校验，均以最终值为准
        let next = currentValue;
        const clamped = clampNumericValue(next, {
            type: controlType,
            min,
            max,
        });
        if (clamped !== null && clamped !== next) {
            next = clamped;
            commit(next);
        }
        if (formatTrigger === "onBlur" && formatter) {
            const formatted = formatter(next);
            if (formatted !== next) {
                next = formatted;
                commit(next);
            }
        }
        void runValidation(next, "onBlur");
        onBlur?.(event);
    };

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        // 数字按键过滤已在 Input 子件完成，这里只串接 onChange 时机的 formatter
        let next = event.target.value;
        if (formatTrigger === "onChange" && formatter) next = formatter(next);
        commit(next);
        if (validateTrigger === "onChange")
            void runValidation(next, "onChange");
    };

    const showClear =
        clearable &&
        !disabled &&
        !readOnly &&
        children === undefined &&
        currentValue !== "" &&
        (clearTrigger === "always" || focused);

    const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        commit("");
        onClear?.(event);
        inputRef.current?.focus();
        textareaRef.current?.focus();
    };

    const isRowClickable = clickable ?? (isLink || Boolean(onClick));
    const labelOnTop = labelAlign === "top";
    const wordCount = currentValue.length;
    const wordLimit = maxlength !== undefined ? Number(maxlength) : NaN;
    const wordLimitFull = Number.isFinite(wordLimit) && wordCount > wordLimit;

    const sharedControlProps = {
        id: inputId,
        name,
        value: currentValue,
        disabled,
        readOnly,
        placeholder,
        maxLength: maxlength as
            | React.InputHTMLAttributes<HTMLInputElement>["maxLength"]
            | undefined,
        autoComplete,
        autoFocus,
        enterKeyHint,
        spellCheck,
        autoCapitalize,
        autoCorrect,
        invalid: Boolean(invalid),
        onFocus: handleFocus,
        onBlur: handleBlur,
        onChange: handleChange,
    };

    const renderControl = () => {
        if (children !== undefined) return children;
        if (isTextarea) {
            return (
                <Textarea
                    ref={textareaRef}
                    rows={rows}
                    autosize={autosize}
                    className={alignClass(inputAlign)}
                    {...sharedControlProps}
                />
            );
        }
        return (
            <Input
                ref={inputRef}
                type={controlType}
                min={min}
                max={max}
                className={cn("flex-1", alignClass(inputAlign))}
                {...sharedControlProps}
            />
        );
    };

    const clearButton = showClear ? (
        <button
            key="clear"
            type="button"
            data-slot="field-clear"
            aria-label="清除"
            // mousedown 拦截：否则焦点先离开控件，清除后还要重新抢焦点
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleClear}
            className={cn(
                "shrink-0 cursor-pointer border-0 bg-transparent p-[var(--bv-padding-base)] leading-none text-[length:var(--bv-field-clear-icon-size)] text-[var(--bv-field-clear-icon-color)]",
                isTextarea
                    ? "absolute bottom-0 right-0"
                    : "ml-[var(--bv-field-icon-gap)]",
            )}
        >
            {clearIcon ?? <Icon name="cross" />}
        </button>
    ) : null;

    const rightIconClass =
        "ml-[var(--bv-field-icon-gap)] shrink-0 self-center text-[length:var(--bv-field-icon-size)] leading-[var(--bv-field-input-line-height)] text-[var(--bv-field-right-icon-color)]";

    const linkIcon = isLink ? (
        <span
            data-slot="field-right-icon"
            onClick={onClickRightIcon}
            className={cn(rightIconClass, onClickRightIcon && "cursor-pointer")}
        >
            <Icon
                name={ARROW_ICON[arrowDirection]}
                className={arrowDirection === "up" ? "rotate-180" : undefined}
            />
        </span>
    ) : null;

    const customRightIcon =
        !isLink && rightIcon !== undefined ? (
            <span
                data-slot="field-right-icon"
                onClick={onClickRightIcon}
                className={cn(
                    rightIconClass,
                    onClickRightIcon && "cursor-pointer",
                )}
            >
                {rightIcon}
            </span>
        ) : null;

    const actionNode =
        action !== undefined ? (
            <span
                data-slot="field-action"
                className="ml-[var(--bv-field-icon-gap)] shrink-0 self-center"
            >
                {action}
            </span>
        ) : null;

    return (
        <div
            data-slot="field"
            data-focused={focused ? "true" : undefined}
            data-error={invalid ? "true" : undefined}
            data-disabled={disabled ? "true" : undefined}
            data-label-align={labelAlign}
            data-size={large ? "large" : undefined}
            onClick={onClick}
            className={cn(
                "relative box-border flex w-full bg-bv-surface text-bv-md text-bv-text",
                "px-[var(--bv-cell-horizontal-padding)] py-[var(--bv-cell-vertical-padding)]",
                "leading-[var(--bv-cell-line-height)]",
                labelOnTop && "flex-col",
                border &&
                    "bv-hairline bv-hairline--bottom [--bv-hairline-inset-left:var(--bv-padding-md)] [--bv-hairline-inset-right:var(--bv-padding-md)]",
                // large：行节奏与字号对齐 Cell large；子控件字号用后代选择器提升特异性
                large &&
                    "py-[var(--bv-cell-large-vertical-padding)] text-bv-lg [&_[data-slot=field-label]]:text-bv-lg [&_[data-slot=input]]:text-bv-lg [&_[data-slot=textarea]]:text-bv-lg",
                isRowClickable &&
                    "cursor-pointer transition-colors active:bg-bv-active",
                className,
            )}
            {...rest}
        >
            {leftIcon !== undefined ? (
                <span
                    data-slot="field-left-icon"
                    onClick={onClickLeftIcon}
                    className={cn(
                        "mr-[var(--bv-field-icon-gap)] shrink-0 self-center text-[length:var(--bv-field-icon-size)] leading-[var(--bv-field-input-line-height)]",
                        onClickLeftIcon && "cursor-pointer",
                    )}
                >
                    {leftIcon}
                </span>
            ) : null}

            {label !== undefined && label !== null ? (
                <label
                    data-slot="field-label"
                    htmlFor={children === undefined ? inputId : undefined}
                    className={cn(
                        "shrink-0 text-[length:var(--bv-field-label-font)] leading-[var(--bv-field-label-line-height)] text-[var(--bv-field-label-color)]",
                        labelOnTop
                            ? "mb-[var(--bv-field-label-top-margin-bottom)] w-auto"
                            : "mr-[var(--bv-field-label-margin-right)] w-[var(--bv-field-label-width)]",
                        !labelOnTop && alignClass(labelAlign),
                        labelClassName,
                    )}
                    style={
                        labelWidth !== undefined && !labelOnTop
                            ? {
                                  width:
                                      typeof labelWidth === "number"
                                          ? `${labelWidth}px`
                                          : labelWidth,
                              }
                            : undefined
                    }
                >
                    {required ? (
                        <span
                            aria-hidden
                            className="mr-0.5 text-[var(--bv-field-required-mark-color)]"
                        >
                            *
                        </span>
                    ) : null}
                    {label}
                    {colon ? <span className="text-bv-text-2">:</span> : null}
                </label>
            ) : null}

            <div
                data-slot="field-body"
                className="flex min-w-0 flex-1 flex-col"
            >
                <div
                    data-slot="field-control"
                    onClick={onClickInput}
                    className={cn("flex min-w-0", isTextarea && "flex-col")}
                >
                    {/* field-box：H5 下纯几何容器（无框无 padding）；PC 下由 utilities.css
              变成边框盒，框住输入区 + 清除 + 右箭头，action 留在盒外与 Select 触发器对齐 */}
                    <div
                        data-slot="field-box"
                        data-textarea={isTextarea ? "true" : undefined}
                        className={cn(
                            "relative min-w-0 flex-1",
                            isTextarea
                                ? "flex flex-col"
                                : cn(
                                      "flex",
                                      center ? "items-center" : "items-start",
                                  ),
                            onClickInput && "cursor-pointer",
                        )}
                    >
                        {renderControl()}
                        {clearButton}
                        {customRightIcon}
                        {linkIcon}
                    </div>
                    {actionNode}
                </div>

                {errorText !== undefined &&
                errorText !== null &&
                errorText !== "" ? (
                    <div
                        data-slot="field-error"
                        className={cn(
                            "mt-[var(--bv-field-error-message-margin-top)] text-[length:var(--bv-field-error-message-font)] leading-[var(--bv-field-error-message-line-height)] text-[var(--bv-field-error-message-color)]",
                            alignClass(errorMessageAlign),
                        )}
                    >
                        {errorText}
                    </div>
                ) : null}

                {showWordLimit && maxlength !== undefined ? (
                    <div
                        data-slot="field-word-limit"
                        className={cn(
                            "mt-[var(--bv-field-word-limit-margin-top)] text-right text-[length:var(--bv-field-word-limit-font)] leading-[var(--bv-field-word-limit-line-height)]",
                            wordLimitFull
                                ? "text-[var(--bv-field-word-limit-full-color)]"
                                : "text-[var(--bv-field-word-limit-color)]",
                        )}
                    >
                        <span data-slot="field-word-num">{wordCount}</span>/
                        {wordLimit}
                    </div>
                ) : null}
            </div>
        </div>
    );
});
