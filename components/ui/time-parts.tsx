import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";
import {
    TIME_RANGE_SEPARATOR,
    buildColumnValues,
    pad2,
    type TimeColumnKey,
    type TimeParts,
    type TimePickerType,
} from "@/hooks/use-time-value";
import {
    WHEEL_ITEM_HEIGHT,
    WHEEL_VISIBLE_ROWS,
    alignOffset,
    usePickerColumn,
    wheelPadding,
} from "@/hooks/use-picker-column";

/**
 * Bivane TimePicker · 跨模式共用零件（两端的「共享展示」那一层）
 *
 * 两端共用：触发器、区间端点切换条、**滚轮行（含滚轮列）**。
 * 差异只在外壳与落点：H5 是底部弹层里的通栏滚轮行 + 顶部工具条（取消 · 标题 · 确定）；
 * PC 是锚定浮层里定宽的滚轮行 + 底部「取消 / 确定」条。
 * 换句话说，TimePicker 走的是**同一套「拖动滚轮 + 吸附对齐」交互范式**，
 * 两端只换容器（架构 §6.5 规则 4：TimePicker 由 C 改判 B）。
 *
 * 本文件里没有 bv-h5: / bv-pc: 变体：
 * 那两个变体的选择器是 `[data-mode='x'] &`（后代选择器），要求元素是某个
 * `[data-mode]` 容器的后代。触发器渲染在用户页面里，未必有 data-mode 祖先，
 * 因此改用显式 JS 分支 —— 与 Popup 的 panelShapeClass、date-parts 同一套做法（契约 17）。
 */

/* ------------------------------------------------------------------ *
 * 外壳形态
 * ------------------------------------------------------------------ */

function triggerShellClass(mode: DeviceMode): string {
    if (mode === "mobile") {
        return cn(
            "relative flex w-full box-border items-center",
            // 内边距走轴前缀（架构 §3.4①）
            "px-[var(--bv-time-picker-padding-x)] py-[var(--bv-time-picker-padding-y)]",
            "bg-bv-surface",
            "bv-hairline bv-hairline--bottom",
        );
    }
    return cn(
        "relative flex w-full box-border items-center",
        "h-[var(--bv-time-picker-pc-trigger-height)]",
        "px-[var(--bv-time-picker-padding-x)] py-0",
        "bg-bv-surface border border-[var(--bv-time-picker-pc-trigger-border-color)]",
        "rounded-[var(--bv-time-picker-pc-trigger-radius)]",
        "transition-colors duration-[var(--bv-duration-fast)]",
        "hover:border-bv-primary",
        // 可输入形态下焦点落在内部 input 上，因此 focus-within 与 focus-visible 都要给
        "focus-within:border-bv-primary focus-within:ring-1 focus-within:ring-bv-primary",
        "focus-visible:border-bv-primary focus-visible:outline-none",
    );
}

/* ------------------------------------------------------------------ *
 * 面板契约
 * ------------------------------------------------------------------ */

export interface TimePanelProps {
    /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
    mode: DeviceMode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: TimePickerType;
    /** 参与展示的时间列，恒为「时→分→秒」的子序列 */
    columns: TimeColumnKey[];
    format: string;
    /** 已解析的可选范围（分发层算一次，避免两份实现各解析一遍） */
    minParts: TimeParts;
    maxParts: TimeParts;
    /** H5 面板标题；PC 不渲染标题（浮层由触发器说明自己是什么） */
    title?: React.ReactNode;
    placeholder?: React.ReactNode;
    disabled: boolean;
    clearable: boolean;
    /** 已提交值（触发器回显用） */
    selected: string[];
    /** 草稿（面板高亮用），区间模式下可能是半截 */
    draft: string[];
    /** 改了草稿但尚未提交（滚轮滚动、换列 / 换端） */
    onDraftChange: (next: string[]) => void;
    /** 要求提交并关闭（两端的「确定」；PC 的 Enter 走同一条） */
    onSubmit: (next: string[]) => void;
    /** 关闭并丢弃草稿 */
    onCancel: () => void;
    /** 清空**已提交**的值（触发器上的清除按钮）。与「取消草稿」是两件事 */
    onClear: () => void;
    confirmText?: React.ReactNode;
    cancelText?: React.ReactNode;
    className?: string;
    /** 无障碍名称；没有可见 label 时应当传入 */
    ariaLabel?: string;
    id?: string;
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

export interface TimeTriggerProps extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    "children"
> {
    mode: DeviceMode;
    /** 已格式化的回显文案（未选时为空串） */
    text: string;
    placeholder?: React.ReactNode;
    filled?: boolean;
    clearable?: boolean;
    onClear?: () => void;
    disabled?: boolean;
    open?: boolean;
    /** Enter / Space / 点击触发 */
    onActivate?: () => void;
    onArrowKey?: (direction: "up" | "down") => void;
    /** 无障碍名称；没有可见 label 时应当传入 */
    "aria-label"?: string;
}

export const TimeTrigger = React.forwardRef<HTMLDivElement, TimeTriggerProps>(
    function TimeTrigger(
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
        // 两个处理器都必须显式取出并组合：直接写在 JSX 上再 {...props} 展开，
        // 调用方传的 onClick / onKeyDown 会把组件的展开逻辑整个覆盖掉（静默失去交互）。
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
                    "gap-[var(--bv-time-picker-gap)]",
                    disabled
                        ? "cursor-not-allowed opacity-[var(--bv-time-picker-disabled-opacity)]"
                        : "cursor-pointer",
                    className,
                )}
                {...props}
                data-slot="time-picker-trigger"
            >
                <span
                    data-slot="time-picker-trigger-value"
                    className={cn(
                        "min-w-0 flex-1 truncate",
                        filled
                            ? "text-[var(--bv-time-picker-text-color)]"
                            : "text-[var(--bv-time-picker-placeholder-color)]",
                    )}
                >
                    {filled ? text : placeholder}
                </span>

                {clearable && filled && !disabled ? (
                    <button
                        type="button"
                        data-slot="time-picker-trigger-clear"
                        aria-label="清除"
                        tabIndex={-1}
                        onClick={(event) => {
                            event.stopPropagation();
                            onClear?.();
                        }}
                        className={cn(
                            "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
                            "text-[length:var(--bv-time-picker-icon-size)] text-[var(--bv-time-picker-icon-color)]",
                            "hover:text-bv-text-2",
                        )}
                    >
                        <Icon name="cross" />
                    </button>
                ) : null}

                <span
                    data-slot="time-picker-trigger-indicator"
                    className={cn(
                        "flex shrink-0 items-center justify-center",
                        "text-[length:var(--bv-time-picker-icon-size)] text-[var(--bv-time-picker-icon-color)]",
                        "transition-transform duration-[var(--bv-duration-fast)]",
                        open && "rotate-180",
                    )}
                >
                    <Icon name="arrow-down" />
                </span>
            </div>
        );
    },
);

/* ------------------------------------------------------------------ *
 * 两端共享：区间端点切换
 * ------------------------------------------------------------------ */

export type TimeRangeEnd = "start" | "end";

export interface TimeRangeTabsProps {
    mode: DeviceMode;
    active: TimeRangeEnd;
    onChange: (end: TimeRangeEnd) => void;
    /** 已选端点文案，未选时给占位符 */
    startText: string;
    endText: string;
    placeholder?: React.ReactNode;
}

/**
 * 区间模式的两段式入口，两端共用（H5 在工具条下方，PC 在滚轮行上方）。
 *
 * 为什么需要它：三列滚轮一次只能表达「一个时间」，而区间是两个。可选做法有三：
 * ① 两组滚轮并排（6 列，宽度塞不下）；② 连续两次「确定」（用户不知道现在选的是哪一端）；
 * ③ 显式标出当前在改哪一端 —— 本组件走 ③。它替代了「PC 并排双列」在触屏上的位置，
 * 属于**能力等价**（矩阵原则），不是功能降级。
 */
export const TimeRangeTabs = React.forwardRef<
    HTMLDivElement,
    TimeRangeTabsProps
>(function TimeRangeTabs(
    { mode, active, onChange, startText, endText, placeholder = "请选择" },
    ref,
) {
    const items: { key: TimeRangeEnd; label: string; text: string }[] = [
        { key: "start", label: "开始时间", text: startText },
        { key: "end", label: "结束时间", text: endText },
    ];

    return (
        <div
            ref={ref}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            role="tablist"
            aria-label="区间端点"
            className={cn(
                "flex w-full shrink-0 items-center",
                "gap-[var(--bv-time-picker-range-tabs-gap)]",
                "px-[var(--bv-time-picker-padding-x)]",
                "py-[var(--bv-time-picker-range-tabs-padding-y)]",
                "bg-bv-surface",
                "bv-hairline bv-hairline--bottom",
            )}
            data-slot="time-picker-range-tabs"
        >
            {items.map((item) => {
                const selected = item.key === active;
                return (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-label={item.label}
                        data-slot="time-picker-range-tab"
                        data-active={selected ? "true" : undefined}
                        onClick={() => onChange(item.key)}
                        className={cn(
                            "flex min-w-0 flex-1 cursor-pointer flex-col items-start border-0 text-left",
                            "rounded-[var(--bv-time-picker-range-tab-radius)]",
                            "px-[var(--bv-time-picker-range-tab-padding-x)]",
                            "py-[var(--bv-time-picker-range-tab-padding-y)]",
                            "text-bv-md leading-[var(--bv-time-picker-range-tab-line-height)]",
                            selected
                                ? "bg-[var(--bv-time-picker-range-tab-active-background)] text-[var(--bv-time-picker-range-tab-active-color)]"
                                : "bg-transparent text-[var(--bv-time-picker-text-2-color)]",
                        )}
                    >
                        <span
                            data-slot="time-picker-range-tab-label"
                            className="text-bv-xs leading-[var(--bv-time-picker-range-tab-hint-line-height)] opacity-70"
                        >
                            {item.label}
                        </span>
                        <span
                            data-slot="time-picker-range-tab-value"
                            className="w-full truncate"
                        >
                            {item.text || placeholder}
                        </span>
                    </button>
                );
            })}
        </div>
    );
});

/* ------------------------------------------------------------------ *
 * 两端共享：滚轮列 / 滚轮行
 * ------------------------------------------------------------------ */

export interface TimeWheelColumnProps {
    mode: DeviceMode;
    /** 无障碍名称，如「时」 */
    label: string;
    /** 本列可选值（已按 min/max 裁剪） */
    values: number[];
    /** 当前值 */
    value: number;
    /** 每项的展示文案；不传则直接渲染数值 */
    formatValue?: (value: number) => React.ReactNode;
    disabled?: boolean;
    /**
     * 是否键盘光标所在列。只有 PC 传 —— 触屏没有「方向键正在驾驶哪一列」这回事。
     * 现统一只用居中上下双线指示当前值，不再叠底色。
     */
    active?: boolean;
    onValueChange: (value: number) => void;
}

export const TimeWheelColumn = React.forwardRef<
    HTMLDivElement,
    TimeWheelColumnProps
>(function TimeWheelColumn(
    {
        mode,
        label,
        values,
        value,
        formatValue,
        disabled = false,
        active = false,
        onValueChange,
    },
    ref,
) {
    const index = React.useMemo(() => {
        const found = values.indexOf(value);
        return found >= 0 ? found : 0;
    }, [values, value]);

    /**
     * 行高以**实测**为准（token 才是唯一事实源），拿不到布局时回落常量。
     * jsdom 的 offsetHeight 恒为 0，此时滚轮的滚动行为本来也不会触发，
     * 回落到常量只影响滚动偏移的计算，不影响点击选值。
     */
    const [itemHeight, setItemHeight] = React.useState(WHEEL_ITEM_HEIGHT);

    const handleIndexChange = React.useCallback(
        (next: number) => {
            const nextValue = values[next];
            if (nextValue === undefined || nextValue === value) return;
            onValueChange(nextValue);
        },
        [values, value, onValueChange],
    );

    const { containerRef, onScroll, scrollToIndex } = usePickerColumn({
        index,
        count: values.length,
        itemHeight,
        onIndexChange: handleIndexChange,
    });

    React.useLayoutEffect(() => {
        const node = containerRef.current?.querySelector(
            '[data-slot="time-picker-wheel-item"]',
        );
        const measured = node instanceof HTMLElement ? node.offsetHeight : 0;
        if (measured > 0)
            setItemHeight((prev) => (prev === measured ? prev : measured));
    }, [values.length, containerRef]);

    const padding = wheelPadding(itemHeight, WHEEL_VISIBLE_ROWS);

    return (
        <div
            ref={ref}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            role="listbox"
            aria-label={label}
            data-slot="time-picker-wheel"
            data-active={active ? "true" : undefined}
            className="relative min-w-0 flex-1 overflow-hidden"
            style={{ height: alignOffset(WHEEL_VISIBLE_ROWS, itemHeight) }}
        >
            <div
                aria-hidden="true"
                data-slot="time-picker-wheel-indicator"
                className={cn(
                    // z-0：选中指示线必须**画在数字下面**，保持居中两条线、不填充背景。
                    "pointer-events-none absolute inset-x-0 z-0",
                    "border-y border-[var(--bv-time-picker-wheel-line-color)]",
                )}
                style={{ top: alignOffset(2, itemHeight), height: itemHeight }}
            />

            <div
                ref={containerRef}
                onScroll={onScroll}
                data-bv-scroll-container=""
                data-slot="time-picker-wheel-scroller"
                className={cn(
                    // relative z-[1]：滚动容器本身透明，压在高亮带之上，
                    // 于是「带子的底色」能透出来、「数字」也不会被盖住
                    "relative z-[1] h-full w-full overflow-y-auto overscroll-contain",
                    "snap-y snap-mandatory",
                )}
                style={{ paddingTop: padding, paddingBottom: padding }}
            >
                {values.map((item, itemIndex) => {
                    const selected = itemIndex === index;
                    // tabIndex=-1：滚轮项不进 Tab 流。Tab 逐个走过 60 个数字没有意义（选择面在外层），
                    // 而且这样「能被聚焦到的项」恒等于当前值 —— PC 面板级 Enter 提交的行为才可预期。
                    return (
                        <button
                            key={item}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            disabled={disabled}
                            tabIndex={-1}
                            data-slot="time-picker-wheel-item"
                            data-selected={selected ? "true" : undefined}
                            onClick={() => {
                                if (disabled) return;
                                // 值没变也要上报：区间空草稿播种「此刻」时，用户点中播种的
                                // 那个值代表「这一端就选它」；若直接吞掉，该端会一直算未选、
                                // 确定钮不解禁。滚动对齐只在真的换到别的项时才需要。
                                if (!selected) scrollToIndex(itemIndex);
                                onValueChange(item);
                            }}
                            className={cn(
                                "flex w-full cursor-pointer snap-center items-center justify-center",
                                "border-0 bg-transparent",
                                "h-[var(--bv-time-picker-wheel-item-height)]",
                                "text-bv-md leading-[var(--bv-time-picker-wheel-item-line-height)]",
                                selected
                                    ? "font-bold text-[var(--bv-time-picker-wheel-selected-color)]"
                                    : "text-[var(--bv-time-picker-wheel-color)]",
                                disabled && "cursor-not-allowed",
                            )}
                        >
                            {formatValue ? formatValue(item) : item}
                        </button>
                    );
                })}
            </div>

            <div
                aria-hidden="true"
                data-slot="time-picker-wheel-mask"
                data-mask="top"
                className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
                style={{ height: alignOffset(2, itemHeight) }}
            />
            <div
                aria-hidden="true"
                data-slot="time-picker-wheel-mask"
                data-mask="bottom"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rotate-180"
                style={{ height: alignOffset(2, itemHeight) }}
            />
        </div>
    );
});

/**
 * 滚轮行：把「要展示哪几列」摊平成 N 个 `TimeWheelColumn`。
 *
 * 抽出来的理由不只是少写一遍 map —— 两端的外壳不同（H5 通栏贴在弹层里、
 * PC 定宽嵌在浮层里），但**列与列的排列、列名、补零、值→列的裁剪基准**必须逐字一致，
 * 否则「两端同范式」这句话就没有事实源。差异全部交给 `className`。
 *
 * `cursor` 是各列的取值基准：由草稿派生（未选时回落到「现在」），
 * 它一变，滚轮的 `value` 就变，`usePickerColumn` 会把对应行滚到中央。
 */
export interface TimeWheelRowProps {
    mode: DeviceMode;
    /** 参与展示的时间列，恒为「时→分→秒」的子序列 */
    columnKeys: TimeColumnKey[];
    /** 各列取值基准（草稿派生的光标时间） */
    cursor: TimeParts;
    minParts: TimeParts;
    maxParts: TimeParts;
    disabled?: boolean;
    /** 键盘光标所在列下标；H5 不传 */
    activeColumnIndex?: number;
    /** 某一列选到了新值（滚轮吸附停下、或点了某一项） */
    onColumnChange: (key: TimeColumnKey, value: number) => void;
    className?: string;
}

const WHEEL_COLUMN_LABELS: Record<TimeColumnKey, string> = {
    hour: "时",
    minute: "分",
    second: "秒",
};

export const TimeWheelRow = React.forwardRef<HTMLDivElement, TimeWheelRowProps>(
    function TimeWheelRow(
        {
            mode,
            columnKeys,
            cursor,
            minParts,
            maxParts,
            disabled = false,
            activeColumnIndex,
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
                data-slot="time-picker-wheels"
                className={cn("flex items-center", className)}
            >
                {columns.map((column, index) => (
                    <TimeWheelColumn
                        key={column.key}
                        mode={mode}
                        label={column.label}
                        values={column.values}
                        value={column.value}
                        formatValue={pad2}
                        disabled={disabled}
                        active={index === activeColumnIndex}
                        onValueChange={(item) =>
                            onColumnChange(column.key, item)
                        }
                    />
                ))}
            </div>
        );
    },
);

/** 区间文案连接符由本文件统一暴露，避免两份实现各拼一次（漂移了就两端不一致） */
export const TIME_RANGE_JOIN = TIME_RANGE_SEPARATOR;
