import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bivane Radio / RadioGroup · 对齐 Vant <van-radio>（模式 A）
 *
 * 纯 ui 件：状态视觉在 utilities.css，触屏整行 ≥44px 热区，PC 焦点环画在
 * 图标盒上，组件不做模式判定。
 *
 * 键盘交互直接复用原生 radio：组内所有 input 共享同一个 name，浏览器自带
 * 「空格选中、方向键在组内轮换」契约，不需要自造键盘状态机。
 */

export type RadioName = string | number;
export type RadioLabelPosition = "left" | "right";
/** 组排列方向；与 checkbox 的同名类型保持同义（copy-paste 分发不互相依赖） */
export type RadioDirection = "vertical" | "horizontal";

// ---------------------------------------------------------------------------
// Group 上下文
// ---------------------------------------------------------------------------

interface RadioGroupContextValue {
    /** 原生 input 共享的 name，决定浏览器方向键轮换范围 */
    groupName: string;
    selected: RadioName | undefined;
    disabled: boolean;
    iconSize: number | string | undefined;
    checkedColor: string | undefined;
    select: (name: RadioName) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
    null,
);

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export interface RadioGroupProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "defaultValue" | "onChange"
> {
    /** 当前选中的 name（受控） */
    value?: RadioName;
    /** 初始选中的 name（非受控） */
    defaultValue?: RadioName;
    onChange?: (name: RadioName) => void;
    /** 排列方向，默认竖排 */
    direction?: RadioDirection;
    /** 整组禁用并向子项透传 */
    disabled?: boolean;
    iconSize?: number | string;
    checkedColor?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
    function RadioGroup(
        {
            value,
            defaultValue,
            onChange,
            direction = "vertical",
            disabled = false,
            iconSize,
            checkedColor,
            className,
            children,
            ...rest
        },
        ref,
    ) {
        const isControlled = value !== undefined;
        const [innerValue, setInnerValue] = React.useState<
            RadioName | undefined
        >(defaultValue);
        const selected = value !== undefined ? value : innerValue;

        // useId 稳定且不与页面上其他单选组串台
        const groupName = `bv-radio-${React.useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

        const select = React.useCallback(
            (name: RadioName) => {
                if (!isControlled) setInnerValue(name);
                onChange?.(name);
            },
            [isControlled, onChange],
        );

        const contextValue = React.useMemo<RadioGroupContextValue>(
            () => ({
                groupName,
                selected,
                disabled,
                iconSize,
                checkedColor,
                select,
            }),
            [groupName, selected, disabled, iconSize, checkedColor, select],
        );

        return (
            <RadioGroupContext.Provider value={contextValue}>
                <div
                    ref={ref}
                    role="radiogroup"
                    data-slot="radio-group"
                    data-direction={direction}
                    data-disabled={disabled ? "true" : undefined}
                    className={cn(className)}
                    {...rest}
                >
                    {children}
                </div>
            </RadioGroupContext.Provider>
        );
    },
);

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

export interface RadioProps {
    /** 在组内的唯一标识（Vant name） */
    name?: RadioName;
    /** 独立使用时的选中态（受控） */
    checked?: boolean;
    /** 独立使用时的初始选中态（非受控） */
    defaultChecked?: boolean;
    disabled?: boolean;
    /** 文字不可点，只有图标可点（Vant label-disabled） */
    labelDisabled?: boolean;
    /** 文字位置，默认右侧 */
    labelPosition?: RadioLabelPosition;
    /** 图标尺寸，默认 20px */
    iconSize?: number | string;
    /** 选中色，默认 primary */
    checkedColor?: string;
    /** 无文字（如嵌在 Cell 行内）时给原生 input 的无障碍名 */
    ariaLabel?: string;
    /** 独立使用（无 Group）时的变更回调 */
    onChange?: (checked: boolean) => void;
    className?: string;
    /** 文案；为空时只渲染图标 */
    children?: React.ReactNode;
}

function toCssSize(size: number | string): string {
    return typeof size === "number" ? `${size}px` : size;
}

export function Radio({
    name,
    checked,
    defaultChecked = false,
    disabled = false,
    labelDisabled = false,
    labelPosition = "right",
    iconSize,
    checkedColor,
    ariaLabel,
    onChange,
    className,
    children,
}: RadioProps) {
    const group = React.useContext(RadioGroupContext);
    const autoName = React.useId();
    const resolvedName = name ?? autoName;

    const isControlled = checked !== undefined;
    const [innerChecked, setInnerChecked] = React.useState(defaultChecked);
    const standaloneChecked = isControlled ? checked : innerChecked;
    const isChecked = group
        ? group.selected === resolvedName
        : (standaloneChecked ?? false);

    const isDisabled = disabled || group?.disabled || false;
    const resolvedIconSize = iconSize ?? group?.iconSize;
    const resolvedCheckedColor = checkedColor ?? group?.checkedColor;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (group) {
            group.select(resolvedName);
        } else if (!isControlled) {
            setInnerChecked(event.target.checked);
        }
        onChange?.(event.target.checked);
    };

    const handleLabelTextClick = (event: React.MouseEvent<HTMLSpanElement>) => {
        if (labelDisabled) event.preventDefault();
    };

    const iconStyle: React.CSSProperties = {
        ...(resolvedIconSize !== undefined
            ? { fontSize: toCssSize(resolvedIconSize) }
            : {}),
        ...(isChecked && !isDisabled && resolvedCheckedColor !== undefined
            ? { borderColor: resolvedCheckedColor }
            : {}),
    };
    const dotStyle: React.CSSProperties =
        isChecked && !isDisabled && resolvedCheckedColor !== undefined
            ? { backgroundColor: resolvedCheckedColor }
            : {};

    const labelText =
        children !== undefined && children !== null ? (
            <span data-slot="radio-label" onClick={handleLabelTextClick}>
                {children}
            </span>
        ) : null;

    return (
        <label
            data-slot="radio"
            data-checked={isChecked ? "true" : undefined}
            data-disabled={isDisabled ? "true" : undefined}
            data-label-position={labelPosition}
            className={cn(className)}
        >
            {labelPosition === "left" ? labelText : null}
            <input
                type="radio"
                data-slot="radio-input"
                className="sr-only"
                name={group ? group.groupName : String(resolvedName)}
                checked={isChecked}
                disabled={isDisabled}
                aria-label={ariaLabel}
                onChange={handleChange}
            />
            <span data-slot="radio-icon" style={iconStyle}>
                <span data-slot="radio-dot" style={dotStyle} />
            </span>
            {labelPosition === "right" ? labelText : null}
        </label>
    );
}
