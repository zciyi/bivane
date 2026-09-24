import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";
import {
    buildColumnValues,
    pad2,
    type DateTimeColumnKey,
    type DateTimeParts,
} from "@/hooks/use-datetime-value";
import {
    WHEEL_ITEM_HEIGHT,
    WHEEL_VISIBLE_ROWS,
    alignOffset,
    clampIndex,
    usePickerColumn,
    usePressRepeat,
    wheelPadding,
} from "@/hooks/use-picker-column";

/**
 * Bivane DateTimePicker · 跨模式共用零件
 *
 * 两端共用：触发器 + **时间滚轮行（时/分/秒，含滚轮列）**。
 * H5 的年/月/日也是滚轮（整条 4~6 列铺在底部弹层）；PC 的日期段则是独立月历
 * （见 components/pc/datetime-picker.tsx），这里的滚轮行只渲染时间列、用 solid 观感。
 * 因此组件归属与 DatePicker 同族的**模式 C**：时间段同范式（只换选中观感），日期段换范式。
 *
 * 本文件不使用 bv-h5:/bv-pc: 变体：变体编译成后代选择器，触发器渲染在用户页面里、
 * 未必有 data-mode 祖先。外壳差异走显式 JS 分支（架构契约 17，与 time-parts 同做法）。
 */

/* ------------------------------------------------------------------ *
 * 面板契约（单值：对齐 Vant DatetimePicker，不做区间）
 * ------------------------------------------------------------------ */

export interface DateTimePanelProps {
    /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
    mode: DeviceMode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 参与展示的列，恒为「年→月→日→时→分→秒」的前缀（年日月必在） */
    columns: DateTimeColumnKey[];
    format: string;
    /** 已解析的可选范围（分发层算一次，两端不重复解析） */
    minParts: DateTimeParts;
    maxParts: DateTimeParts;
    /** H5 面板标题；PC 不渲染标题 */
    title?: React.ReactNode;
    placeholder?: React.ReactNode;
    disabled: boolean;
    clearable: boolean;
    /** 已提交值（触发器回显用） */
    selected: string[];
    /** 草稿（滚轮滚动只改它，确定才提交） */
    draft: string[];
    onDraftChange: (next: string[]) => void;
    /** 要求提交并关闭 */
    onSubmit: (next: string[]) => void;
    /** 关闭并丢弃草稿 */
    onCancel: () => void;
    /** 清空已提交值（触发器上的清除按钮） */
    onClear: () => void;
    confirmText?: React.ReactNode;
    cancelText?: React.ReactNode;
    className?: string;
    ariaLabel?: string;
    id?: string;
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

function triggerShellClass(mode: DeviceMode): string {
    if (mode === "mobile") {
        return cn(
            "relative box-border flex w-full items-center",
            "px-[var(--bv-datetime-picker-padding-x)] py-[var(--bv-datetime-picker-padding-y)]",
            "bg-bv-surface",
            "bv-hairline bv-hairline--bottom",
        );
    }
    return cn(
        "relative box-border flex w-full items-center",
        "h-[var(--bv-datetime-picker-pc-trigger-height)]",
        "px-[var(--bv-datetime-picker-padding-x)] py-0",
        "rounded-[var(--bv-datetime-picker-pc-trigger-radius)] border border-[var(--bv-datetime-picker-pc-trigger-border-color)] bg-bv-surface",
        "transition-colors duration-[var(--bv-duration-fast)]",
        "hover:border-bv-primary",
        "focus-within:border-bv-primary focus-within:ring-1 focus-within:ring-bv-primary",
        "focus-visible:border-bv-primary focus-visible:outline-none",
    );
}

export interface DateTimeTriggerProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "children"
> {
    mode: DeviceMode;
    text: string;
    placeholder?: React.ReactNode;
    filled?: boolean;
    clearable?: boolean;
    onClear?: () => void;
    disabled?: boolean;
    open?: boolean;
    onActivate?: () => void;
    onArrowKey?: (direction: "up" | "down") => void;
    "aria-label"?: string;
}

export const DateTimeTrigger = React.forwardRef<
    HTMLDivElement,
    DateTimeTriggerProps
>(function DateTimeTrigger(
    {
        mode,
        text,
        placeholder,
        filled = false,
        clearable = false,
        onClear,
        disabled = false,
        open = false,
        onActivate,
        onArrowKey,
        className,
        onClick,
        onKeyDown,
        "aria-label": ariaLabel,
        ...props
    },
    ref,
) {
    // 显式取出并组合处理器，避免调用方传入的同名回调把组件的展开逻辑覆盖（time-parts 同款坑）
    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onActivate?.();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate?.();
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            onArrowKey?.("down");
            return;
        }
        if (event.key === "ArrowUp") {
            event.preventDefault();
            onArrowKey?.("up");
        }
    };

    return (
        <div
            ref={ref}
            role="combobox"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-disabled={disabled || undefined}
            aria-label={ariaLabel}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            data-state={open ? "open" : "closed"}
            data-filled={filled ? "true" : undefined}
            tabIndex={disabled ? undefined : 0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
                triggerShellClass(mode),
                "gap-[var(--bv-datetime-picker-gap)]",
                disabled
                    ? "cursor-not-allowed opacity-[var(--bv-datetime-picker-disabled-opacity)]"
                    : "cursor-pointer",
                className,
            )}
            {...props}
            data-slot="datetime-picker-trigger"
        >
            <span
                data-slot="datetime-picker-trigger-value"
                className={cn(
                    "min-w-0 flex-1 truncate",
                    filled
                        ? "text-[var(--bv-datetime-picker-text-color)]"
                        : "text-[var(--bv-datetime-picker-placeholder-color)]",
                )}
            >
                {filled ? text : placeholder}
            </span>

            {clearable && filled && !disabled ? (
                <button
                    type="button"
                    data-slot="datetime-picker-trigger-clear"
                    aria-label="清除"
                    tabIndex={-1}
                    onClick={(event) => {
                        event.stopPropagation();
                        onClear?.();
                    }}
                    className={cn(
                        "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
                        "text-[length:var(--bv-datetime-picker-icon-size)] text-[var(--bv-datetime-picker-icon-color)]",
                        "hover:text-bv-text-2",
                    )}
                >
                    <Icon name="cross" />
                </button>
            ) : null}

            <span
                data-slot="datetime-picker-trigger-indicator"
                className={cn(
                    "flex shrink-0 items-center justify-center",
                    "text-[length:var(--bv-datetime-picker-icon-size)] text-[var(--bv-datetime-picker-icon-color)]",
                    "transition-transform duration-[var(--bv-duration-fast)]",
                    open && "rotate-180",
                )}
            >
                <Icon name="arrow-down" />
            </span>
        </div>
    );
});

/* ------------------------------------------------------------------ *
 * 滚轮列 / 滚轮行
 * ------------------------------------------------------------------ */

const WHEEL_COLUMN_LABELS: Record<DateTimeColumnKey, string> = {
    year: "年",
    month: "月",
    day: "日",
    hour: "时",
    minute: "分",
    second: "秒",
};

/** 年份按 4 位显示，其余列补零两位 */
function formatColumnValue(key: DateTimeColumnKey, value: number): string {
    return key === "year" ? String(value) : pad2(value);
}

/**
 * 选中态观感：
 *  - band：滚轮居中上下双线指示，不填充背景（H5 与 PC 时间列当前样式）；
 *  - solid：当前值独立实心色块（保留实现，当前无消费者使用）。
 */
export type WheelSelectionStyle = "band" | "solid";

export interface DateTimeWheelColumnProps {
    mode: DeviceMode;
    /** 无障碍名称，如「年」 */
    label: string;
    /** 本列当前值在可选值数组中的位置 */
    values: number[];
    value: number;
    columnKey: DateTimeColumnKey;
    disabled?: boolean;
    /** 键盘光标所在列（仅 PC 传）：原点亮高亮带，现统一只用上下双线指示 */
    active?: boolean;
    selectionStyle?: WheelSelectionStyle;
    /** solid 下列左侧的发丝分隔线（由行按「非首列」传入，首列左边贴着月历边框） */
    divider?: boolean;
    onValueChange: (value: number) => void;
}

/**
 * solid 时间列顶/尾的微调钮（▲ / ▼）：单击 ±1，**按住连发**（usePressRepeat）。
 * 到可选区间端点时隐藏（disabled:invisible，绝对定位无布局位移）。
 * 只响应主键 pointerdown，不进 Tab 流 —— 键盘驾驶由面板统一处理，避免双路步进。
 */
function WheelStepButton({
    direction,
    disabled,
    onStep,
}: {
    direction: "up" | "down";
    disabled: boolean;
    onStep: () => void;
}) {
    const { start, stop } = usePressRepeat(onStep);
    const isUp = direction === "up";
    return (
        <button
            type="button"
            tabIndex={-1}
            aria-label={isUp ? "上一项" : "下一项"}
            aria-hidden={disabled || undefined}
            data-slot="datetime-picker-wheel-step"
            data-direction={direction}
            disabled={disabled}
            onPointerDown={(event) => {
                if (event.button !== 0 || disabled) return;
                // 阻止焦点落到钮上与长按选中文本
                event.preventDefault();
                start();
            }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onPointerLeave={stop}
            className={cn(
                "absolute inset-x-0 z-[3] flex h-5 touch-none select-none items-center justify-center border-0 p-0",
                "cursor-pointer text-[var(--bv-date-picker-pc-nav-color)] hover:text-bv-primary",
                "disabled:invisible disabled:cursor-default",
                isUp
                    ? "top-0 [background:linear-gradient(to_bottom,var(--bv-surface)_70%,transparent)]"
                    : "bottom-0 [background:linear-gradient(to_top,var(--bv-surface)_70%,transparent)]",
            )}
        >
            <Icon
                name="arrow-down"
                className={cn("text-[10px]", isUp && "rotate-180")}
            />
        </button>
    );
}

export const DateTimeWheelColumn = React.forwardRef<
    HTMLDivElement,
    DateTimeWheelColumnProps
>(function DateTimeWheelColumn(
    {
        mode,
        label,
        values,
        value,
        columnKey,
        disabled = false,
        active = false,
        selectionStyle = "band",
        divider = false,
        onValueChange,
    },
    ref,
) {
    const solid = selectionStyle === "solid";
    const index = React.useMemo(() => {
        const found = values.indexOf(value);
        return found >= 0 ? found : 0;
    }, [values, value]);

    // 行高以实测为准（token 是事实源），jsdom 拿不到布局时回落常量，只影响滚动偏移
    const [itemHeight, setItemHeight] = React.useState(WHEEL_ITEM_HEIGHT);

    const handleIndexChange = React.useCallback(
        (next: number) => {
            const nextValue = values[next];
            if (nextValue === undefined || nextValue === value) return;
            onValueChange(nextValue);
        },
        [values, value, onValueChange],
    );

    /** ▲/▼ 与按住连发：在当前可选区间内移动一格，越界即停（父层级联夹紧） */
    const stepBy = React.useCallback(
        (delta: number) => {
            const nextIndex = clampIndex(index + delta, values.length);
            const nextValue = values[nextIndex];
            if (nextValue === undefined || nextValue === value) return;
            onValueChange(nextValue);
        },
        [index, values, value, onValueChange],
    );

    const { containerRef, onScroll, scrollToIndex } = usePickerColumn({
        index,
        count: values.length,
        itemHeight,
        onIndexChange: handleIndexChange,
    });

    React.useLayoutEffect(() => {
        const node = containerRef.current?.querySelector(
            '[data-slot="datetime-picker-wheel-item"]',
        );
        const measured = node instanceof HTMLElement ? node.offsetHeight : 0;
        if (measured > 0) {
            setItemHeight((prev) => (prev === measured ? prev : measured));
        }
    }, [values.length, containerRef]);

    // solid 是顶对齐的普通滚动列表（选中项吸顶），不要居中滚轮的上下补位
    const padding = solid ? 0 : wheelPadding(itemHeight, WHEEL_VISIBLE_ROWS);

    return (
        <div
            ref={ref}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            role="listbox"
            aria-label={label}
            data-slot="datetime-picker-wheel"
            data-variant={solid ? "solid" : "band"}
            data-active={active ? "true" : undefined}
            className={cn(
                "relative min-w-0 flex-1 overflow-hidden",
                divider && "border-l border-bv-border",
            )}
            style={{ height: alignOffset(WHEEL_VISIBLE_ROWS, itemHeight) }}
        >
            {solid ? null : (
                <div
                    aria-hidden="true"
                    data-slot="datetime-picker-wheel-indicator"
                    className={cn(
                        // z-0：选中指示线画在数字下面，保持居中两条线、不填充背景
                        "pointer-events-none absolute inset-x-0 z-0",
                        "border-y border-[var(--bv-datetime-picker-wheel-line-color)]",
                    )}
                    style={{
                        top: alignOffset(2, itemHeight),
                        height: itemHeight,
                    }}
                />
            )}

            <div
                ref={containerRef}
                onScroll={onScroll}
                data-bv-scroll-container=""
                data-slot="datetime-picker-wheel-scroller"
                className={cn(
                    "relative z-[1] h-full w-full overflow-y-auto overscroll-contain",
                    !solid && "snap-y snap-mandatory",
                )}
                style={{ paddingTop: padding, paddingBottom: padding }}
            >
                {values.map((item, itemIndex) => {
                    const selected = itemIndex === index;
                    // tabIndex=-1：滚轮项不进 Tab 流（选择面是整个浮层），与 TimePicker 同
                    return (
                        <button
                            key={item}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={disabled}
                            tabIndex={-1}
                            data-slot="datetime-picker-wheel-item"
                            data-selected={selected ? "true" : undefined}
                            onClick={() => {
                                if (disabled || selected) return;
                                scrollToIndex(itemIndex);
                                onValueChange(item);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center justify-center border-0 bg-transparent",
                                "h-[var(--bv-datetime-picker-wheel-item-height)]",
                                "text-bv-md leading-[var(--bv-datetime-picker-wheel-item-line-height)]",
                                solid
                                    ? cn(
                                          "mx-1 box-border w-[calc(100%-0.5rem)] snap-start rounded-[var(--bv-datetime-picker-pc-wheel-radius)]",
                                          selected
                                              ? "bg-[var(--bv-datetime-picker-pc-wheel-selected-background)] font-bold text-[var(--bv-datetime-picker-pc-wheel-selected-color)]"
                                              : "text-[var(--bv-datetime-picker-wheel-color)] hover:bg-[var(--bv-datetime-picker-pc-cell-hover-background)]",
                                      )
                                    : cn(
                                          "snap-center",
                                          selected
                                              ? "font-bold text-[var(--bv-datetime-picker-wheel-selected-color)]"
                                              : "text-[var(--bv-datetime-picker-wheel-color)]",
                                      ),
                                disabled && "cursor-not-allowed",
                            )}
                        >
                            {formatColumnValue(columnKey, item)}
                        </button>
                    );
                })}
            </div>

            {solid ? null : (
                <>
                    <div
                        aria-hidden="true"
                        data-slot="datetime-picker-wheel-mask"
                        data-mask="top"
                        className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
                        style={{ height: alignOffset(2, itemHeight) }}
                    />
                    <div
                        aria-hidden="true"
                        data-slot="datetime-picker-wheel-mask"
                        data-mask="bottom"
                        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rotate-180"
                        style={{ height: alignOffset(2, itemHeight) }}
                    />
                </>
            )}

            {/* solid（PC）：列顶/列尾微调钮，按住可连发 */}
            {solid && (
                <>
                    <WheelStepButton
                        direction="up"
                        disabled={disabled || index <= 0}
                        onStep={() => stepBy(-1)}
                    />
                    <WheelStepButton
                        direction="down"
                        disabled={disabled || index >= values.length - 1}
                        onStep={() => stepBy(1)}
                    />
                </>
            )}
        </div>
    );
});

export interface DateTimeWheelRowProps {
    mode: DeviceMode;
    columnKeys: DateTimeColumnKey[];
    cursor: DateTimeParts;
    minParts: DateTimeParts;
    maxParts: DateTimeParts;
    disabled?: boolean;
    /** 键盘光标所在列下标；H5 不传 */
    activeColumnIndex?: number;
    /** 选中态观感，默认居中高亮带；PC 月历旁的时间列传 'solid' */
    selectionStyle?: WheelSelectionStyle;
    onColumnChange: (key: DateTimeColumnKey, value: number) => void;
    className?: string;
}

/**
 * 滚轮行：把「展示哪几列」摊平成 N 个 DateTimeWheelColumn（4/5/6 列）。
 * 列序、列名、年份 4 位 / 其余补零、按 min-max 裁剪都在这一层固定，
 * 两端任何一处都不另写一份列映射。
 */
export const DateTimeWheelRow = React.forwardRef<
    HTMLDivElement,
    DateTimeWheelRowProps
>(function DateTimeWheelRow(
    {
        mode,
        columnKeys,
        cursor,
        minParts,
        maxParts,
        disabled = false,
        activeColumnIndex,
        selectionStyle = "band",
        onColumnChange,
        className,
    },
    ref,
) {
    const columns = React.useMemo(
        () =>
            columnKeys.map((key) => ({
                key,
                label: WHEEL_COLUMN_LABELS[key],
                values: buildColumnValues(key, cursor, minParts, maxParts),
                value: cursor[key],
            })),
        [columnKeys, cursor, minParts, maxParts],
    );

    return (
        <div
            ref={ref}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            data-slot="datetime-picker-wheels"
            className={cn("flex items-center", className)}
        >
            {columns.map((column, index) => (
                <DateTimeWheelColumn
                    key={column.key}
                    mode={mode}
                    columnKey={column.key}
                    label={column.label}
                    values={column.values}
                    value={column.value}
                    disabled={disabled}
                    active={index === activeColumnIndex}
                    selectionStyle={selectionStyle}
                    // solid 下非首列画左侧发丝线（截图里时/分/秒列之间的竖线）
                    divider={selectionStyle === "solid" && index > 0}
                    onValueChange={(item) => onColumnChange(column.key, item)}
                />
            ))}
        </div>
    );
});
