import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Bivane Checkbox / CheckboxGroup · 对齐 Vant <van-checkbox>（模式 A）
 *
 * 纯 ui 件：状态视觉在 utilities.css，触屏整行 ≥44px 热区，PC 由
 * 原生 input 的 :focus-visible 把焦点环画到图标盒上。组件不做模式判定。
 *
 * 交互语义保持 Vant：单个是受控布尔；放进 CheckboxGroup 后值模型变成
 * 「已选 name 数组」，bindGroup 可切断这层关联；max 达上限后未选项自动禁用；
 * indeterminate 只画半选视觉，不改变 checked 值。
 */

export type CheckboxName = string | number;
export type CheckboxShape = "round" | "square";
export type CheckboxLabelPosition = "left" | "right";
export type ChoiceDirection = "vertical" | "horizontal";

// ---------------------------------------------------------------------------
// Group 上下文
// ---------------------------------------------------------------------------

interface CheckboxGroupContextValue {
    /** 当前已选 name（Set 仅用于查询，顺序以组内 value 数组为准） */
    selected: ReadonlySet<CheckboxName>;
    disabled: boolean;
    shape: CheckboxShape;
    iconSize: number | string | undefined;
    checkedColor: string | undefined;
    max: number | undefined;
    /** 登记成员用于 toggleAll；返回注销函数 */
    register: (name: CheckboxName, disabled: boolean) => () => void;
    toggle: (name: CheckboxName, next: boolean) => void;
}

const CheckboxGroupContext =
    React.createContext<CheckboxGroupContextValue | null>(null);

/** 从组内值里增删一个 name，保留原顺序，新选中追加到末尾 */
function nextNames(
    selected: readonly CheckboxName[],
    name: CheckboxName,
    next: boolean,
): CheckboxName[] {
    if (next) {
        return selected.includes(name) ? [...selected] : [...selected, name];
    }
    return selected.filter((item) => item !== name);
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

export interface CheckboxGroupProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "defaultValue" | "onChange"
> {
    /** 已选 name 数组（受控） */
    value?: CheckboxName[];
    /** 初始已选 name（非受控） */
    defaultValue?: CheckboxName[];
    onChange?: (names: CheckboxName[]) => void;
    /** 最多可选数量，达上限后未选项自动禁用 */
    max?: number;
    /** 排列方向，默认竖排 */
    direction?: ChoiceDirection;
    /** 整组禁用并向子项透传 */
    disabled?: boolean;
    /** 向子项透传的形状（子项可自行覆盖） */
    shape?: CheckboxShape;
    iconSize?: number | string;
    checkedColor?: string;
}

export interface CheckboxGroupInstance {
    /**
     * 全选/全不选（Vant 同名方法）：
     * 无参 = 全选；false = 全不选；{ skipDisabled } 时跳过禁用项并保留其现状。
     */
    toggleAll: (
        options?: boolean | { checked?: boolean; skipDisabled?: boolean },
    ) => void;
}

export const CheckboxGroup = React.forwardRef<
    CheckboxGroupInstance,
    CheckboxGroupProps
>(function CheckboxGroup(
    {
        value,
        defaultValue,
        onChange,
        max,
        direction = "vertical",
        disabled = false,
        shape = "round",
        iconSize,
        checkedColor,
        className,
        children,
        ...rest
    },
    ref,
) {
    const isControlled = value !== undefined;
    const [innerValue, setInnerValue] = React.useState<CheckboxName[]>(
        defaultValue ?? [],
    );
    const current = value !== undefined ? value : innerValue;

    // toggleAll 需要遍历成员；登记 name 与实时 disabled，不随渲染重排
    const membersRef = React.useRef(
        new Map<CheckboxName, { disabled: boolean }>(),
    );

    const commit = React.useCallback(
        (next: CheckboxName[]) => {
            if (!isControlled) setInnerValue(next);
            onChange?.(next);
        },
        [isControlled, onChange],
    );

    const register = React.useCallback(
        (name: CheckboxName, memberDisabled: boolean) => {
            const members = membersRef.current;
            members.set(name, { disabled: memberDisabled });
            return () => {
                members.delete(name);
            };
        },
        [],
    );

    const toggle = React.useCallback(
        (name: CheckboxName, next: boolean) => {
            // 上限只约束「新增」，已选项永远允许取消
            if (next && max !== undefined && current.length >= max) return;
            commit(nextNames(current, name, next));
        },
        [current, max, commit],
    );

    React.useImperativeHandle(
        ref,
        () => ({
            toggleAll: (options) => {
                const targetChecked =
                    typeof options === "boolean"
                        ? options
                        : (options?.checked ?? true);
                const skipDisabled =
                    typeof options === "boolean"
                        ? false
                        : (options?.skipDisabled ?? false);

                const disabledNames = new Set<CheckboxName>();
                const enabledNames: CheckboxName[] = [];
                for (const [name, meta] of membersRef.current) {
                    if (meta.disabled) disabledNames.add(name);
                    else enabledNames.push(name);
                }

                if (targetChecked) {
                    // skipDisabled：禁用项保持现状（当前选中的保留），其余全选
                    const keptDisabled = skipDisabled
                        ? current.filter((n) => disabledNames.has(n))
                        : [];
                    commit(
                        skipDisabled
                            ? [...enabledNames, ...keptDisabled]
                            : [...enabledNames, ...disabledNames],
                    );
                } else {
                    // 全不选：skipDisabled 时禁用项若已选则保留
                    commit(
                        skipDisabled
                            ? current.filter((n) => disabledNames.has(n))
                            : [],
                    );
                }
            },
        }),
        [commit, current],
    );

    const contextValue = React.useMemo<CheckboxGroupContextValue>(
        () => ({
            selected: new Set(current),
            disabled,
            shape,
            iconSize,
            checkedColor,
            max,
            register,
            toggle,
        }),
        [
            current,
            disabled,
            shape,
            iconSize,
            checkedColor,
            max,
            register,
            toggle,
        ],
    );

    return (
        <CheckboxGroupContext.Provider value={contextValue}>
            <div
                role="group"
                data-slot="checkbox-group"
                data-direction={direction}
                data-disabled={disabled ? "true" : undefined}
                className={cn(className)}
                {...rest}
            >
                {children}
            </div>
        </CheckboxGroupContext.Provider>
    );
});

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

export interface CheckboxProps {
    /** 选中态（受控；组内时由组值派生，此值忽略） */
    checked?: boolean;
    /** 初始选中态（非受控；组内时忽略） */
    defaultChecked?: boolean;
    /** 在组内的唯一标识（Vant name） */
    name?: CheckboxName;
    /** 外形：圆（默认）/ 方 */
    shape?: CheckboxShape;
    /** 禁用该项：不可选（组禁用或达 max 上限时也会禁用） */
    disabled?: boolean;
    /** 文字不可点，只有图标可点（Vant label-disabled） */
    labelDisabled?: boolean;
    /** 文字位置，默认右侧 */
    labelPosition?: CheckboxLabelPosition;
    /** 图标尺寸，默认 20px */
    iconSize?: number | string;
    /** 选中色，默认 primary */
    checkedColor?: string;
    /** 半选态：只改图标与 aria，不改 checked 值 */
    indeterminate?: boolean;
    /** 是否与外层 CheckboxGroup 联动，默认 true */
    bindGroup?: boolean;
    /** 无文字（如嵌在 Cell 行内）时给原生 input 的无障碍名 */
    ariaLabel?: string;
    /** 选中态变化回调（组内外都触发；组内时同步改组的选中集合） */
    onChange?: (checked: boolean) => void;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 文案；为空时只渲染图标 */
    children?: React.ReactNode;
}

function toCssSize(size: number | string): string {
    return typeof size === "number" ? `${size}px` : size;
}

export function Checkbox({
    checked,
    defaultChecked = false,
    name,
    shape,
    disabled = false,
    labelDisabled = false,
    labelPosition = "right",
    iconSize,
    checkedColor,
    indeterminate = false,
    bindGroup = true,
    ariaLabel,
    onChange,
    className,
    children,
}: CheckboxProps) {
    const group = React.useContext(CheckboxGroupContext);
    const inGroup = bindGroup && group !== null;

    // name 未传也需稳定值：组内要做 key，独立使用要挂原生 name
    const autoName = React.useId();
    const resolvedName = name ?? autoName;

    const isControlled = checked !== undefined;
    const [innerChecked, setInnerChecked] = React.useState(defaultChecked);
    const standaloneChecked = isControlled ? checked : innerChecked;
    const isChecked =
        inGroup && group
            ? group.selected.has(resolvedName)
            : (standaloneChecked ?? false);

    // max 达上限后未选项自动禁用（已选项不受影响，否则永远无法取消）
    const maxReached =
        inGroup &&
        group !== null &&
        group.max !== undefined &&
        group.selected.size >= group.max &&
        !isChecked;
    const isDisabled = disabled || (inGroup && group?.disabled) || maxReached;

    const resolvedShape = shape ?? group?.shape ?? "round";
    const resolvedIconSize = iconSize ?? group?.iconSize;
    const resolvedCheckedColor = checkedColor ?? group?.checkedColor;

    React.useEffect(() => {
        if (!inGroup || !group) return;
        return group.register(resolvedName, isDisabled);
    }, [inGroup, group, resolvedName, isDisabled]);

    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useEffect(() => {
        // indeterminate 只能通过 DOM 属性设置，React 无对应 prop
        if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate, isChecked]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const next = event.target.checked;
        if (inGroup && group) {
            group.toggle(resolvedName, next);
        } else if (!isControlled) {
            setInnerChecked(next);
        }
        onChange?.(next);
    };

    // 点文字：labelDisabled 时拦截 label 的激活行为，input 不被触发
    const handleLabelTextClick = (event: React.MouseEvent<HTMLSpanElement>) => {
        if (labelDisabled) event.preventDefault();
    };

    const active = isChecked || indeterminate;
    const iconStyle: React.CSSProperties = {
        ...(resolvedIconSize !== undefined
            ? { fontSize: toCssSize(resolvedIconSize) }
            : {}),
        // 禁用态颜色由 CSS token 接管，这里不能写内联覆盖
        ...(active && !isDisabled && resolvedCheckedColor !== undefined
            ? {
                  backgroundColor: resolvedCheckedColor,
                  borderColor: resolvedCheckedColor,
              }
            : {}),
    };

    const labelText =
        children !== undefined && children !== null ? (
            <span data-slot="checkbox-label" onClick={handleLabelTextClick}>
                {children}
            </span>
        ) : null;

    return (
        <label
            data-slot="checkbox"
            data-checked={isChecked ? "true" : undefined}
            data-disabled={isDisabled ? "true" : undefined}
            data-indeterminate={indeterminate ? "true" : undefined}
            data-shape={resolvedShape}
            data-label-position={labelPosition}
            className={cn(className)}
        >
            {labelPosition === "left" ? labelText : null}
            <input
                ref={inputRef}
                type="checkbox"
                data-slot="checkbox-input"
                className="sr-only"
                name={String(resolvedName)}
                checked={isChecked}
                disabled={isDisabled}
                aria-label={ariaLabel}
                aria-checked={indeterminate ? "mixed" : undefined}
                onChange={handleChange}
            />
            <span data-slot="checkbox-icon" style={iconStyle}>
                <Icon
                    name={indeterminate ? "minus" : "check"}
                    size="var(--bv-checkbox-glyph-size)"
                />
            </span>
            {labelPosition === "right" ? labelText : null}
        </label>
    );
}
