import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
    DayPicker,
    type ClassNames,
    type CustomComponents,
    type DayButtonProps,
    type MonthCaptionProps,
    type MonthProps,
    type NextMonthButtonProps,
    type PreviousMonthButtonProps,
    type RootProps,
    type WeekdayProps,
    type WeekProps,
} from "react-day-picker";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { DateTrigger, type DatePanelProps } from "@/components/ui/date-parts";
import {
    DEFAULT_DATE_FORMAT,
    addDays,
    addMonths,
    clampParts,
    compareParts,
    daysInMonth,
    formatParts,
    isWithinBounds,
    pad2,
    parseDateTextForColumns,
    resolveCursor,
    toParts,
    todayParts,
    weekBounds,
    type DateColumnKey,
    type DateParts,
} from "@/hooks/use-date-value";

/**
 * Bivane DatePicker · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：锚定触发器的浮层；完整日期使用月历（区间并排双月），年月使用双年月份网格，
 *       纯年份使用十二年网格。三种面板都支持键盘巡航、直接输入和 Esc 关闭。
 *
 * ── 日期网格为什么交给 react-day-picker ──────────────────────────────
 * 月历网格是「纯日期推理 + 无障碍表格语义」的重活，规模不大但边界极多：
 * 跨月补位、闰年、6 行定高、区间中间日判定、禁用日匹配、双月对齐……
 * 自研版本（buildMonthGrid + collectInRange + 补位格）能跑，但每一处边界都得自己兜。
 * 这里改用 react-day-picker（下称 rdp）当**日期引擎**：它负责「哪一天属于哪个格子、
 * 处于什么状态」，我们只负责**渲染成 Vant 的样子**。
 *
 * 为什么是「换渲染层」而不是「直接用它的默认皮肤」：
 *   rdp 的默认 DOM 与类名（.rdp-*）自带 Material 无关但同样不是 Vant 的观感，
 *   而本库的硬约束是 Vant 保真 + 样式只走 token。rdp 正好为此提供了
 *   `components` / `classNames` 扩展点，于是 Month / MonthCaption / Week /
 *   Weekday / DayButton / 前后月按钮全部换成自己的实现 —— **旧版的 data-slot 槽名、
 *   data-* 断言、token 名字一个都没动**，第 5 门（CSS 产物核对）、第 6 门（measure）
 *   与第 7 门（visual-check）因此不需要为新组件重写。
 *
 * 值语义仍归本项目：rdp 的 `selected` 是受控的（由 draft / displayRange 推出），
 * 它算出的区间结果我们**不采用** —— 只取 `onDayClick` 里的那一天，
 * 再走本项目自己的 handleSelect（区间「两段式 + 再点即重选」的语义在那里）。
 *
 * 键盘为什么自己留着：
 *   rdp 内置了方向键巡航（在日期格上派发 keydown → moveFocus），但它的前提是
 *   **焦点落在某个日期格上**；而本组件的触发器是可输入框（PC 单值形态），
 *   打开面板后焦点必须留给输入框，否则用户没法直接打字。于是这里把日期格
 *   全部置为 tabIndex=-1 并在 mousedown 上 preventDefault（点击不抢焦点），
 *   键盘巡航统一由面板级 handleKeyDown 驱动，光标是面板自己的 state。
 *
 * 用 Radix Popover 而非 Popover 的 Trigger：
 *   触发器是跨模式共用的 DateTrigger（自带点击/键盘语义），挂在 Trigger 上
 *   会让 Slot 把 Radix 的 onClick 与组件自身的都保留下来 —— 一次点击 toggle 两次，
 *   表现为「点开立刻又关」。改用 Anchor 只取定位能力，交互自己掌控。
 *
 * 翻转与位移防溢出交给 Radix Popper（矩阵 §2.2「翻转防溢出」），不自写锚点计算。
 *
 * 为什么日期格是「矩形热区」而不是圆点：
 *   区间高亮要连成一条带，圆角只在两端各切一次；中间用圆点会在视觉上断成一串珠子。
 *   这也是 `--bv-date-picker-pc-cell-radius` 只在端点生效的原因。
 */

/** 与 Vant Calendar 的 first-day-of-week 默认值一致（周日为首） */
const PC_WEEK_START = 0;
/** 面板与触发器之间的主轴间距，走 token 语义（与 Select / DropdownMenu 同为 4px） */
const SIDE_OFFSET = 4;
/** 中文单字星期表头。与 H5 滚轮列同款，不跟 rdp 的 locale 漂移 */
const WEEKDAY_CHARS = ["日", "一", "二", "三", "四", "五", "六"];
/** 自定义修饰符名：把「键盘光标」交给 rdp 按天匹配，省得每格自己比日期文本 */
const ACTIVE_MODIFIER = "bvActive";

/** Date -> 'YYYY-MM-DD'（rdp 的 day.isoDate 同口径，两边必须逐字一致） */
const isoOfDate = (date: Date): string =>
    formatParts(toParts(date), DEFAULT_DATE_FORMAT);
/** 按实际列配置把值还原成本地 Date，不走 UTC，避免跨时区差一天。 */
const dateOfText = (
    text: string | null | undefined,
    columns: DateColumnKey[],
): Date | undefined => {
    const parts = text ? parseDateTextForColumns(text, columns) : null;
    return parts ? new Date(parts.year, parts.month - 1, parts.day) : undefined;
};
const dateOfParts = (parts: DateParts | null): Date | undefined =>
    parts ? new Date(parts.year, parts.month - 1, parts.day) : undefined;
const titleOfMonth = (date: Date): string =>
    `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;

/* ------------------------------------------------------------------ *
 * rdp 扩展点：把 rdp 的状态映射回本库的槽名、data-* 与 token
 *
 * 这些组件必须是**模块级常量**：写在组件体内会让每次 render 都产生新引用，
 * rdp 内部的 useMemo（dateLib / components / classNames / labels）会因此全量重算。
 * ------------------------------------------------------------------ */

/** 面板外壳。rdp 的 data-mode 是 single/range，这里覆盖成 pc（架构契约 13：基础件接收已解析 mode） */
function RdpRoot({ rootRef, className, children, ...rest }: RootProps) {
    return (
        <div
            {...rest}
            ref={rootRef}
            data-mode="pc"
            data-slot="date-picker-grid"
            className={cn(className, "box-border")}
        >
            {children}
        </div>
    );
}

function RdpMonth({
    calendarMonth,
    displayIndex: _displayIndex,
    className,
    children,
    ...rest
}: MonthProps) {
    return (
        <div
            {...rest}
            data-mode="pc"
            data-slot="date-picker-month-panel"
            aria-label={titleOfMonth(calendarMonth.date)}
            className={cn(
                className,
                "relative flex w-[var(--bv-date-picker-pc-panel-width)] flex-col",
                "px-[var(--bv-date-picker-pc-padding-x)]",
            )}
        >
            {children}
        </div>
    );
}

/** 月份标题行。rdp 默认塞的是英文 CaptionLabel，这里整行换掉 */
function RdpMonthCaption({
    calendarMonth,
    displayIndex: _displayIndex,
    className,
    children: _children,
    ...rest
}: MonthCaptionProps) {
    return (
        <div
            {...rest}
            data-slot="date-picker-month-header"
            className={cn(
                className,
                "flex items-center justify-center",
                "h-[var(--bv-date-picker-pc-nav-height)]",
            )}
        >
            <span
                data-slot="date-picker-month-title"
                className={cn(
                    "text-bv-md leading-[var(--bv-date-picker-line-height)] font-bold",
                    "text-bv-text",
                )}
            >
                {titleOfMonth(calendarMonth.date)}
            </span>
        </div>
    );
}

function RdpWeek({ week: _week, className, children, ...rest }: WeekProps) {
    return (
        <tr {...rest} data-slot="date-picker-week" className={cn(className)}>
            {children}
        </tr>
    );
}

function RdpWeekday({ className, children, ...rest }: WeekdayProps) {
    return (
        <th
            {...rest}
            data-slot="date-picker-weekday"
            className={cn(
                className,
                "h-[var(--bv-date-picker-pc-weekday-height)] text-center align-middle",
                "text-bv-sm leading-[var(--bv-date-picker-pc-weekday-line-height)] font-normal",
                "text-[var(--bv-date-picker-pc-weekday-color)]",
            )}
        >
            {children}
        </th>
    );
}

/**
 * 日期格。
 *
 * rdp 把**修饰符**算好递进来，我们只做两件事：套上 Vant 的观感、把状态写成 data-*。
 * 注意 `selected` 在 range 模式下对「区间内」也为真（内含判定），所以端点要
 * 额外排掉 range_middle —— 只写 selected 会让整条带都变成端点色。
 */
function RdpDayButton({
    day,
    modifiers,
    className,
    children,
    ...rest
}: DayButtonProps) {
    const isMiddle = modifiers.range_middle === true;
    const isSelected = modifiers.selected === true && !isMiddle;
    const isOutside = modifiers.outside === true;
    const isDisabled = modifiers.disabled === true;
    const isActive = modifiers[ACTIVE_MODIFIER] === true;

    return (
        <button
            {...rest}
            type="button"
            // 键盘巡航由面板级 handleKeyDown 统一接管，格子不进 Tab 流：
            // 42 个格子各占一个 Tab 停靠点会把键盘用户困在日历里
            tabIndex={-1}
            // 点击不抢焦点：本组件的触发器是可输入框，焦点一旦被日期格拿走，
            // 用户就没法接着打字；顺带避免 rdp 自己的键盘处理被激活（两套光标打架）
            onMouseDown={(event) => event.preventDefault()}
            aria-label={day.isoDate}
            data-slot="date-picker-cell"
            data-selected={isSelected ? "true" : undefined}
            data-in-range={isMiddle ? "true" : undefined}
            data-outside={isOutside ? "true" : undefined}
            data-active={isActive ? "true" : undefined}
            className={cn(
                "flex w-full cursor-pointer items-center justify-center border-0",
                "h-[var(--bv-date-picker-pc-cell-height)]",
                "text-bv-sm leading-[var(--bv-date-picker-pc-cell-line-height)]",
                // 矩形热区（不是圆点）：区间高亮需要连成一条带，
                // 圆角只在两端各切一次，中间保持方角才不出现锯齿缝
                isMiddle &&
                    "bg-[var(--bv-date-picker-pc-cell-in-range-background)] text-[var(--bv-date-picker-text-color)]",
                isSelected &&
                    "rounded-[var(--bv-date-picker-pc-cell-radius)] bg-[var(--bv-date-picker-pc-cell-selected-background)] text-[var(--bv-date-picker-pc-cell-selected-color)]",
                !isSelected &&
                    !isMiddle &&
                    (isOutside
                        ? "bg-transparent text-[var(--bv-date-picker-text-3-color)]"
                        : "bg-transparent text-[var(--bv-date-picker-text-color)]"),
                !isSelected &&
                    !isDisabled &&
                    "hover:bg-[var(--bv-date-picker-pc-cell-hover-background)]",
                isActive && "ring-1 ring-bv-primary",
                isDisabled &&
                    "cursor-not-allowed text-[var(--bv-date-picker-text-3-color)] opacity-[var(--bv-date-picker-pc-cell-disabled-opacity)]",
                className,
            )}
        >
            {children}
        </button>
    );
}

/** 上下月按钮的公共壳：绝对定位到月份标题行左右两端，标题保持居中 */
const NAV_BUTTON_CLASS = cn(
    "absolute top-0 z-[1] flex cursor-pointer items-center justify-center border-0 bg-transparent p-0",
    "h-[var(--bv-date-picker-pc-nav-height)] w-[var(--bv-date-picker-pc-nav-height)]",
    "text-[length:var(--bv-date-picker-icon-size)] text-[var(--bv-date-picker-pc-nav-color)]",
    "hover:text-bv-primary",
);

function RdpPreviousButton({
    className,
    children: _children,
    ...rest
}: PreviousMonthButtonProps) {
    return (
        <button
            {...rest}
            data-slot="date-picker-month-prev"
            className={cn(
                NAV_BUTTON_CLASS,
                "left-[var(--bv-date-picker-pc-padding-x)]",
                className,
            )}
        >
            <Icon name="arrow-left" />
        </button>
    );
}

function RdpNextButton({
    className,
    children: _children,
    ...rest
}: NextMonthButtonProps) {
    return (
        <button
            {...rest}
            data-slot="date-picker-month-next"
            className={cn(
                NAV_BUTTON_CLASS,
                "right-[var(--bv-date-picker-pc-padding-x)]",
                className,
            )}
        >
            <Icon name="arrow" />
        </button>
    );
}

const RDP_COMPONENTS: Partial<CustomComponents> = {
    Root: RdpRoot,
    Month: RdpMonth,
    MonthCaption: RdpMonthCaption,
    Week: RdpWeek,
    Weekday: RdpWeekday,
    DayButton: RdpDayButton,
    PreviousMonthButton: RdpPreviousButton,
    NextMonthButton: RdpNextButton,
};

/**
 * 只给「没有自定义组件」的元素挂类名：月份容器 / 表格 / 行 / 单元格。
 *
 * 全部写成字面量：Tailwind v4 是扫源码文本生成类的，拼字符串会静默丢样式。
 */
const RDP_CLASS_NAMES: Partial<ClassNames> = {
    // 双月的实际间距（--bv-date-picker-pc-dual-gap 默认 0：两月共边框）
    months: "flex items-stretch gap-[var(--bv-date-picker-pc-dual-gap)]",
    month_grid: "w-full table-fixed border-collapse",
    // 单元格自身不留内边距：区间色带要无缝，靠格子（按钮）自己铺满
    day: "p-0 align-middle",
    week: "",
    weeks: "",
    weekdays: "",
    weekday: "",
};

/** 中文表头与中文无障碍标签。rdp 默认全英文，这里逐项换掉 */
const RDP_FORMATTERS = {
    formatWeekdayName: (weekday: Date) => WEEKDAY_CHARS[weekday.getDay()] ?? "",
};

const RDP_LABELS = {
    labelNav: () => "月份导航",
    labelGrid: (date: Date) => titleOfMonth(date),
    labelGridcell: (date: Date) => isoOfDate(date),
    labelDayButton: (date: Date) => isoOfDate(date),
    labelWeekday: (weekday: Date) =>
        `星期${WEEKDAY_CHARS[weekday.getDay()] ?? ""}`,
    labelPrevious: () => "上个月",
    labelNext: () => "下个月",
};

/**
 * 把 rdp 拨到**受控**侧的空实现。
 *
 * `useSingle` / `useRange` 内部都是同一行：
 *     const selected = !onSelect ? internallySelected : initiallySelected;
 * 即：**不传 `onSelect` 时 rdp 走非受控分支** —— 它把 `selected` 当初始值 useState
 * 存一份，之后自己维护，再也不看 prop。于是我们这边更新 `selected` 完全没反应
 * （悬停预览不动、第二次点选错位），而且不报任何错，属于静默失效。
 *
 * 这里给个空实现只为把开关拨到受控侧；真正的选值语义由 `onDayClick` 负责。
 */
const RDP_NOOP_SELECT = () => {};

type CoarsePrecision = "year" | "month";

function periodBounds(
    parts: DateParts,
    precision: CoarsePrecision,
): [DateParts, DateParts] {
    if (precision === "year") {
        return [
            { year: parts.year, month: 1, day: 1 },
            { year: parts.year, month: 12, day: 31 },
        ];
    }
    return [
        { year: parts.year, month: parts.month, day: 1 },
        {
            year: parts.year,
            month: parts.month,
            day: daysInMonth(parts.year, parts.month),
        },
    ];
}

function isPeriodSelectable(
    parts: DateParts,
    precision: CoarsePrecision,
    min: DateParts,
    max: DateParts,
): boolean {
    const [start, end] = periodBounds(parts, precision);
    return compareParts(end, min) >= 0 && compareParts(start, max) <= 0;
}

function samePeriod(
    a: DateParts,
    b: DateParts,
    precision: CoarsePrecision,
): boolean {
    return a.year === b.year && (precision === "year" || a.month === b.month);
}

interface CoarseGridProps {
    columns: DateColumnKey[];
    viewYear: number;
    minParts: DateParts;
    maxParts: DateParts;
    activeParts: DateParts;
    draft: string[];
    displayRange: { from: DateParts | null; to: DateParts | null };
    format: string;
    onViewYearChange: (year: number) => void;
    onSelect: (text: string) => void;
}

/** 日列被裁剪时不再伪装成月历：年月用双年月份网格，纯年份用十二年网格。 */
function CoarseDateGrid({
    columns,
    viewYear,
    minParts,
    maxParts,
    activeParts,
    draft,
    displayRange,
    format,
    onViewYearChange,
    onSelect,
}: CoarseGridProps) {
    const precision: CoarsePrecision = columns.includes("month")
        ? "month"
        : "year";
    const includesYear = columns.includes("year");
    const selectedParts = draft
        .map((text) => parseDateTextForColumns(text, columns))
        .filter((parts): parts is DateParts => parts !== null);

    const isInRange = (parts: DateParts) => {
        if (!displayRange.from || !displayRange.to) return false;
        const [from, to] =
            compareParts(displayRange.from, displayRange.to) <= 0
                ? [displayRange.from, displayRange.to]
                : [displayRange.to, displayRange.from];
        return compareParts(parts, from) >= 0 && compareParts(parts, to) <= 0;
    };

    const renderOption = (
        parts: DateParts,
        label: React.ReactNode,
        ariaLabel: string,
    ) => {
        const selectable = isPeriodSelectable(
            parts,
            precision,
            minParts,
            maxParts,
        );
        const selected = selectedParts.some((item) =>
            samePeriod(item, parts, precision),
        );
        const active = samePeriod(activeParts, parts, precision);
        const inRange = isInRange(parts) && !selected;

        return (
            <button
                key={ariaLabel}
                type="button"
                aria-label={ariaLabel}
                aria-pressed={selected}
                disabled={!selectable}
                data-slot={
                    precision === "month"
                        ? "date-picker-month-option"
                        : "date-picker-year-option"
                }
                data-selected={selected ? "true" : undefined}
                data-in-range={inRange ? "true" : undefined}
                data-active={active ? "true" : undefined}
                onClick={() => onSelect(formatParts(parts, format))}
                className={cn(
                    "flex h-[var(--bv-date-picker-pc-cell-height)] items-center justify-center border-0",
                    "rounded-[var(--bv-date-picker-pc-cell-radius)] bg-transparent px-bv-xs",
                    "text-bv-sm text-[var(--bv-date-picker-text-color)]",
                    selected &&
                        "bg-[var(--bv-date-picker-pc-cell-selected-background)] text-[var(--bv-date-picker-pc-cell-selected-color)]",
                    inRange &&
                        "bg-[var(--bv-date-picker-pc-cell-in-range-background)]",
                    !selected &&
                        selectable &&
                        "cursor-pointer hover:bg-[var(--bv-date-picker-pc-cell-hover-background)]",
                    active && "ring-1 ring-bv-primary",
                    !selectable &&
                        "cursor-not-allowed text-[var(--bv-date-picker-text-3-color)] opacity-[var(--bv-date-picker-pc-cell-disabled-opacity)]",
                )}
            >
                {label}
            </button>
        );
    };

    if (precision === "month") {
        const viewStart =
            includesYear && maxParts.year > minParts.year
                ? Math.min(viewYear, maxParts.year - 1)
                : viewYear;
        const years = includesYear
            ? [viewStart, viewStart + 1].filter((year) => year <= maxParts.year)
            : [activeParts.year];
        const canPrevious = includesYear && viewStart > minParts.year;
        const canNext = includesYear && years[years.length - 1] < maxParts.year;

        return (
            <div
                data-slot="date-picker-year-month-grid"
                className="relative flex items-stretch"
            >
                {includesYear ? (
                    <>
                        <button
                            type="button"
                            aria-label="上一组年份"
                            disabled={!canPrevious}
                            onClick={() =>
                                onViewYearChange(
                                    Math.max(minParts.year, viewStart - 2),
                                )
                            }
                            className={cn(
                                NAV_BUTTON_CLASS,
                                "left-[var(--bv-date-picker-pc-padding-x)]",
                                !canPrevious && "opacity-30",
                            )}
                        >
                            <Icon name="arrow-left" />
                        </button>
                        <button
                            type="button"
                            aria-label="下一组年份"
                            disabled={!canNext}
                            onClick={() =>
                                onViewYearChange(
                                    Math.min(
                                        Math.max(
                                            minParts.year,
                                            maxParts.year - 1,
                                        ),
                                        viewStart + 2,
                                    ),
                                )
                            }
                            className={cn(
                                NAV_BUTTON_CLASS,
                                "right-[var(--bv-date-picker-pc-padding-x)]",
                                !canNext && "opacity-30",
                            )}
                        >
                            <Icon name="arrow" />
                        </button>
                    </>
                ) : null}

                {years.map((year) => (
                    <div
                        key={year}
                        data-slot="date-picker-year-panel"
                        className="flex w-[var(--bv-date-picker-pc-panel-width)] flex-col px-[var(--bv-date-picker-pc-padding-x)]"
                    >
                        <div className="flex h-[var(--bv-date-picker-pc-nav-height)] items-center justify-center">
                            <span
                                data-slot="date-picker-year-title"
                                className="text-bv-md font-bold text-bv-text"
                            >
                                {includesYear ? `${year} 年` : "月份"}
                            </span>
                        </div>
                        <div
                            role="grid"
                            className="grid grid-cols-3 gap-x-bv-xs gap-y-bv-sm py-bv-xs"
                        >
                            {Array.from({ length: 12 }, (_, index) => {
                                const month = index + 1;
                                return renderOption(
                                    { year, month, day: 1 },
                                    `${month}月`,
                                    `${year}-${pad2(month)}`,
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const pageStart =
        minParts.year + Math.floor((viewYear - minParts.year) / 12) * 12;
    const pageEnd = Math.min(maxParts.year, pageStart + 11);
    const canPrevious = pageStart > minParts.year;
    const canNext = pageEnd < maxParts.year;

    return (
        <div
            data-slot="date-picker-year-grid"
            className="relative w-[var(--bv-date-picker-pc-panel-width)] px-[var(--bv-date-picker-pc-padding-x)]"
        >
            <button
                type="button"
                aria-label="上一组年份"
                disabled={!canPrevious}
                onClick={() =>
                    onViewYearChange(Math.max(minParts.year, pageStart - 12))
                }
                className={cn(
                    NAV_BUTTON_CLASS,
                    "left-[var(--bv-date-picker-pc-padding-x)]",
                    !canPrevious && "opacity-30",
                )}
            >
                <Icon name="arrow-left" />
            </button>
            <button
                type="button"
                aria-label="下一组年份"
                disabled={!canNext}
                onClick={() =>
                    onViewYearChange(Math.min(maxParts.year, pageStart + 12))
                }
                className={cn(
                    NAV_BUTTON_CLASS,
                    "right-[var(--bv-date-picker-pc-padding-x)]",
                    !canNext && "opacity-30",
                )}
            >
                <Icon name="arrow" />
            </button>
            <div className="flex h-[var(--bv-date-picker-pc-nav-height)] items-center justify-center">
                <span
                    data-slot="date-picker-year-title"
                    className="text-bv-md font-bold text-bv-text"
                >
                    {pageStart} - {pageEnd}
                </span>
            </div>
            <div
                role="grid"
                className="grid grid-cols-3 gap-x-bv-xs gap-y-bv-sm py-bv-xs"
            >
                {Array.from({ length: pageEnd - pageStart + 1 }, (_, index) => {
                    const year = pageStart + index;
                    return renderOption(
                        { year, month: 1, day: 1 },
                        `${year}年`,
                        String(year),
                    );
                })}
            </div>
        </div>
    );
}

export const PcDatePicker = React.forwardRef<HTMLDivElement, DatePanelProps>(
    function PcDatePicker(
        {
            mode,
            open,
            onOpenChange,
            type,
            columns,
            format,
            minParts,
            maxParts,
            placeholder,
            disabled,
            clearable,
            selected,
            draft,
            onDraftChange,
            onSubmit,
            onClear,
            className,
            ariaLabel,
            id,
        },
        ref,
    ) {
        const triggerRef = React.useRef<HTMLDivElement | null>(null);
        const panelRef = React.useRef<HTMLDivElement | null>(null);
        const suppressNextEditableFocusRef = React.useRef(false);
        const skipCloseAutoFocusRef = React.useRef(false);

        const triggerMergedRef = React.useCallback(
            (node: HTMLDivElement | null) => {
                triggerRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref)
                    (
                        ref as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
            },
            [ref],
        );

        /** 区间草稿允许半截：只有开始端时，下一次点选补的是结束端 */
        const rangeStart = type === "range" ? draft[0] || null : null;
        const rangeEnd = type === "range" ? draft[1] || null : null;
        const hasDay = columns.includes("day");
        const coarsePrecision: CoarsePrecision = columns.includes("month")
            ? "month"
            : "year";

        const [view, setView] = React.useState<{ year: number; month: number }>(
            () => ({
                year: todayParts().year,
                month: todayParts().month,
            }),
        );
        const [active, setActive] = React.useState("");
        const [hoverText, setHoverText] = React.useState<string | null>(null);

        const triggerText = React.useMemo(
            () =>
                type === "range" ? selected.join(" ~ ") : (selected[0] ?? ""),
            [type, selected],
        );

        /**
         * 打开那一刻落位：光标落在「最后一个已选端点」，没有则落在今天；
         * 月份跟着光标走，于是「打开即定位」不依赖任何外部状态。
         * 只在 open 翻转时执行 —— 否则用户翻到别的月份会被立刻拽回来。
         */
        const wasOpenRef = React.useRef(false);
        /** 由「触发器上的方向键直接唤起」时置位：那一次落位已经算好了，不能再被这里重置 */
        const skipResetRef = React.useRef(false);
        React.useEffect(() => {
            const opened = open && !wasOpenRef.current;
            wasOpenRef.current = open;
            if (!open) {
                setHoverText(null);
                return;
            }
            if (!opened) return;
            if (skipResetRef.current) {
                skipResetRef.current = false;
                return;
            }

            const anchorText = rangeEnd ?? rangeStart ?? selected[0];
            const cursor = resolveCursor(
                anchorText ?? undefined,
                columns,
                minParts,
                maxParts,
            );
            setActive(formatParts(cursor, format));
            setView({ year: cursor.year, month: cursor.month });
        }, [
            open,
            rangeStart,
            rangeEnd,
            selected,
            columns,
            format,
            minParts,
            maxParts,
        ]);

        const activeParts = React.useMemo(
            () =>
                parseDateTextForColumns(active, columns) ??
                resolveCursor(undefined, columns, minParts, maxParts),
            [active, columns, minParts, maxParts],
        );

        /** 移动光标时同步翻月，光标永远留在可见的那一屏里 */
        const moveActive = React.useCallback(
            (next: DateParts) => {
                const clamped = clampParts(next, minParts, maxParts);
                setActive(formatParts(clamped, format));
                setView((prev) =>
                    prev.year === clamped.year && prev.month === clamped.month
                        ? prev
                        : { year: clamped.year, month: clamped.month },
                );
            },
            [format, minParts, maxParts],
        );

        /**
         * 区间高亮的两个来源：
         *   ① 两端都定了 → 画整条已选区间的带（不只是预览才有带）；
         *   ② 只定了起点 → 用悬停日作临时终点（矩阵 §2.2「区间悬停预览」），
         *      没有悬停时退化为键盘光标，这样纯键盘操作也能看到带。
         * 只写 ② 是很容易犯的错误：提交完的区间反而没有底色，用户会以为没选上。
         */
        const displayRange = React.useMemo((): {
            from: DateParts | null;
            to: DateParts | null;
        } => {
            if (type !== "range") return { from: null, to: null };
            if (rangeStart && rangeEnd) {
                return {
                    from: parseDateTextForColumns(rangeStart, columns),
                    to: parseDateTextForColumns(rangeEnd, columns),
                };
            }
            if (rangeStart) {
                const hovered = hoverText
                    ? parseDateTextForColumns(hoverText, columns)
                    : null;
                return {
                    from: parseDateTextForColumns(rangeStart, columns),
                    to: hovered ?? activeParts,
                };
            }
            return { from: null, to: null };
        }, [type, rangeStart, rangeEnd, hoverText, activeParts, columns]);

        const handleSelect = React.useCallback(
            (text: string) => {
                if (type === "single") {
                    onSubmit([text]);
                    return;
                }
                if (rangeStart === null || rangeEnd !== null) {
                    // 开始新一段区间：把草稿清成「只有起点」，等第二次点选来补终点
                    setHoverText(null);
                    onDraftChange([text, ""]);
                    return;
                }
                onSubmit([rangeStart, text]);
            },
            [type, rangeStart, rangeEnd, onSubmit, onDraftChange],
        );

        /**
         * rdp 只用来「告诉我点了哪一天」：它自己算出的区间结果（addToRange 那套
         * 「在已选区间上调整」的语义）与 Vant 的「再点即重选」不同，所以不复用。
         */
        const handleDayClick = React.useCallback(
            (day: Date) => {
                handleSelect(formatParts(toParts(day), format));
            },
            [handleSelect, format],
        );

        /** min/max 交给 rdp 的匹配器：before / after 都是**开区间**，正好等于「含端点」的上下界 */
        const rdpDisabled = React.useMemo(
            () => [
                { before: dateOfParts(minParts) as Date },
                { after: dateOfParts(maxParts) as Date },
            ],
            [minParts, maxParts],
        );

        /** 键盘光标作自定义修饰符：rdp 按天比对，省得每格自己 parse 日期文本 */
        const rdpModifiers = React.useMemo(
            () => ({ [ACTIVE_MODIFIER]: dateOfParts(activeParts) }),
            [activeParts],
        );

        const rdpMonth = React.useMemo(
            () => new Date(view.year, view.month - 1, 1),
            [view.year, view.month],
        );

        const handleMonthChange = React.useCallback((next: Date) => {
            setView({ year: next.getFullYear(), month: next.getMonth() + 1 });
        }, []);

        /**
         * 单值高亮当前草稿；区间高亮 displayRange（含悬停预览），端点与中间日由 rdp 区分。
         * 区间两端都没着落时必须给 `undefined` 而不是 `{ from: undefined }` ——
         * rdp 的 DateRange 要求 from 必填，空区间只能靠「整体不给」表达。
         */
        const rdpSingleSelected = React.useMemo(
            () => dateOfText(draft[0], columns),
            [draft, columns],
        );
        const rdpRangeSelected = React.useMemo(() => {
            const from = dateOfParts(displayRange.from);
            if (!from) return undefined;
            return { from, to: dateOfParts(displayRange.to) };
        }, [displayRange]);

        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!hasDay) {
                const yearPageStart =
                    minParts.year +
                    Math.floor((view.year - minParts.year) / 12) * 12;
                const moveBy = (amount: number) =>
                    moveActive(
                        addMonths(
                            activeParts,
                            amount * (coarsePrecision === "year" ? 12 : 1),
                        ),
                    );
                const verticalStep = 3;
                switch (event.key) {
                    case "ArrowLeft":
                        event.preventDefault();
                        moveBy(-1);
                        return;
                    case "ArrowRight":
                        event.preventDefault();
                        moveBy(1);
                        return;
                    case "ArrowUp":
                        event.preventDefault();
                        moveBy(-verticalStep);
                        return;
                    case "ArrowDown":
                        event.preventDefault();
                        moveBy(verticalStep);
                        return;
                    case "PageUp":
                        event.preventDefault();
                        moveBy(-12);
                        return;
                    case "PageDown":
                        event.preventDefault();
                        moveBy(12);
                        return;
                    case "Home":
                        event.preventDefault();
                        moveActive(
                            coarsePrecision === "year"
                                ? { year: yearPageStart, month: 1, day: 1 }
                                : { year: activeParts.year, month: 1, day: 1 },
                        );
                        return;
                    case "End":
                        event.preventDefault();
                        moveActive(
                            coarsePrecision === "year"
                                ? {
                                      year: Math.min(
                                          maxParts.year,
                                          yearPageStart + 11,
                                      ),
                                      month: 1,
                                      day: 1,
                                  }
                                : { year: activeParts.year, month: 12, day: 1 },
                        );
                        return;
                    case "Enter":
                    case " ":
                        event.preventDefault();
                        handleSelect(formatParts(activeParts, format));
                        return;
                    default:
                        return;
                }
            }

            switch (event.key) {
                case "ArrowLeft":
                    event.preventDefault();
                    moveActive(addDays(activeParts, -1));
                    return;
                case "ArrowRight":
                    event.preventDefault();
                    moveActive(addDays(activeParts, 1));
                    return;
                case "ArrowUp":
                    event.preventDefault();
                    moveActive(addDays(activeParts, -7));
                    return;
                case "ArrowDown":
                    event.preventDefault();
                    moveActive(addDays(activeParts, 7));
                    return;
                case "PageUp":
                    event.preventDefault();
                    moveActive(addMonths(activeParts, -1));
                    return;
                case "PageDown":
                    event.preventDefault();
                    moveActive(addMonths(activeParts, 1));
                    return;
                case "Home":
                    event.preventDefault();
                    moveActive(weekBounds(activeParts, PC_WEEK_START).start);
                    return;
                case "End":
                    event.preventDefault();
                    moveActive(weekBounds(activeParts, PC_WEEK_START).end);
                    return;
                case "Enter":
                case " ":
                    event.preventDefault();
                    handleSelect(formatParts(activeParts, format));
                    return;
                default:
            }
        };

        /** 直接输入：解析失败或越界都返回 false，让触发器自己把文本回滚（拒绝要看得见） */
        const handleTextCommit = React.useCallback(
            (text: string) => {
                const parts = parseDateTextForColumns(text, columns);
                if (!parts) return false;
                const selectable = hasDay
                    ? isWithinBounds(parts, minParts, maxParts)
                    : isPeriodSelectable(
                          parts,
                          coarsePrecision,
                          minParts,
                          maxParts,
                      );
                if (!selectable) return false;
                onSubmit([formatParts(parts, format)]);
                return true;
            },
            [
                columns,
                hasDay,
                coarsePrecision,
                minParts,
                maxParts,
                format,
                onSubmit,
            ],
        );

        const handleEditableFocus = React.useCallback(() => {
            // 关闭后的焦点归还是组件内部行为，不代表用户要求重新打开月历。
            // 不区分这一点时，转点其他浮层会让两层互相抢焦点并反复开关。
            if (suppressNextEditableFocusRef.current) return;
            onOpenChange(true);
        }, [onOpenChange]);

        const shouldCommitOnBlur = React.useCallback(
            (nextTarget: EventTarget | null) => {
                // 点日期格会把焦点从输入框移进月历；这仍是组件内部交互，不能先提交旧文本并关闭面板。
                return !(
                    nextTarget instanceof Node &&
                    panelRef.current?.contains(nextTarget)
                );
            },
            [],
        );

        const handleArrowFromTrigger = (direction: "up" | "down") => {
            if (disabled) return;
            const amount = direction === "down" ? 1 : -1;
            const next = hasDay
                ? addDays(activeParts, amount)
                : addMonths(
                      activeParts,
                      amount * (coarsePrecision === "year" ? 12 : 1),
                  );
            if (!open) {
                // 先占位：这次方向键已经决定了落点，不能让「打开时定位」的 effect 再覆盖一次
                skipResetRef.current = true;
                onOpenChange(true);
                moveActive(next);
                return;
            }
            moveActive(next);
        };

        /** rdp 的公共 props：与 mode / selected 无关的那部分，两个分支逐字相同 */
        const rdpSharedProps = {
            numberOfMonths: type === "range" ? 2 : 1,
            // 恒 6 行 7 列：行数随月份浮动会让浮层高度跟着跳，也让补位格失去稳定位置
            fixedWeeks: true,
            showOutsideDays: true,
            weekStartsOn: PC_WEEK_START as 0,
            // 月份受控：翻月状态归本组件（打开时落位、键盘翻月都要写它）
            month: rdpMonth,
            onMonthChange: handleMonthChange,
            // 前后月按钮贴在标题行两端，而不是独占一整行（与旧版观感一致）
            navLayout: "around" as const,
            disabled: rdpDisabled,
            modifiers: rdpModifiers,
            components: RDP_COMPONENTS,
            classNames: RDP_CLASS_NAMES,
            formatters: RDP_FORMATTERS,
            labels: RDP_LABELS,
            onDayClick: handleDayClick,
            // 只为把 rdp 拨到受控侧（见 RDP_NOOP_SELECT 注释），不接管选值
            onSelect: RDP_NOOP_SELECT,
            onDayMouseEnter: (day: Date) => setHoverText(isoOfDate(day)),
            onDayMouseLeave: () => setHoverText(null),
            // 关掉 rdp 自己的落焦：焦点必须留在面板上，由面板级键盘处理驱动光标
            autoFocus: false,
        };

        return (
            <PopoverPrimitive.Root
                open={open}
                onOpenChange={onOpenChange}
                modal={false}
            >
                {/* Anchor 只登记定位参考元素，不注入任何交互属性 */}
                <PopoverPrimitive.Anchor asChild>
                    <DateTrigger
                        ref={triggerMergedRef}
                        id={id}
                        mode={mode}
                        text={triggerText}
                        placeholder={placeholder}
                        filled={selected.length > 0}
                        clearable={clearable}
                        onClear={onClear}
                        disabled={disabled}
                        open={open}
                        aria-label={ariaLabel}
                        // 只开不合：触发器是可输入框，「点一下想把光标放进去」不能被当成「收起浮层」。
                        // 收起交给 Esc / 点外部 / 选完日期三条路径。
                        onActivate={() => onOpenChange(true)}
                        onEditableFocus={handleEditableFocus}
                        shouldCommitOnBlur={shouldCommitOnBlur}
                        onArrowKey={handleArrowFromTrigger}
                        onKeyDown={(event) => {
                            if (event.key !== "Escape" || !open) return;
                            event.preventDefault();
                            onOpenChange(false);
                        }}
                        // 区间用两段文本拼在一行，逐字编辑没有明确语义 → 只有单值可输入
                        editable={type === "single"}
                        onTextCommit={handleTextCommit}
                    />
                </PopoverPrimitive.Anchor>

                <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                        ref={panelRef}
                        data-mode={mode === "mobile" ? "h5" : "pc"}
                        aria-label={ariaLabel ?? "日期面板"}
                        align="start"
                        side="bottom"
                        sideOffset={SIDE_OFFSET}
                        avoidCollisions
                        tabIndex={-1}
                        onKeyDown={handleKeyDown}
                        onOpenAutoFocus={(event) => {
                            // 单值可编辑形态必须把焦点留在输入框；移到面板会触发失焦提交并立即关层。
                            event.preventDefault();
                            if (type !== "single")
                                panelRef.current?.focus({
                                    preventScroll: true,
                                });
                        }}
                        onCloseAutoFocus={(event) => {
                            // 没有 Popover.Trigger，Radix 无处归还焦点，显式还给触发器（契约第 5 条）。
                            // 可输入形态下要还给**输入框**而不是外层 div —— div 没有 tabIndex，
                            // 调用它的 focus() 是空操作，焦点会掉到 body 上
                            event.preventDefault();
                            if (skipCloseAutoFocusRef.current) {
                                skipCloseAutoFocusRef.current = false;
                                return;
                            }
                            const node = triggerRef.current;
                            const input = node?.querySelector("input");
                            if (input && document.activeElement !== input) {
                                suppressNextEditableFocusRef.current = true;
                                input.focus({ preventScroll: true });
                                suppressNextEditableFocusRef.current = false;
                                return;
                            }
                            if (node && document.activeElement !== node) {
                                node.focus({ preventScroll: true });
                            }
                        }}
                        onPointerDownOutside={(event) => {
                            // 点触发器时应由触发器自己的逻辑完成 toggle。
                            // 不拦的话 DismissableLayer 也会关一次，两边都写状态、顺序依赖实现细节。
                            const target = event.detail.originalEvent.target;
                            if (
                                target instanceof Node &&
                                triggerRef.current?.contains(target)
                            ) {
                                event.preventDefault();
                                return;
                            }
                            // 外部点击是在主动转移焦点（例如转点菜单），此时抢回日期输入框会形成焦点死循环。
                            skipCloseAutoFocusRef.current = true;
                        }}
                        onFocusOutside={(event) => {
                            const target = event.detail.originalEvent.target;
                            if (
                                target instanceof Node &&
                                triggerRef.current?.contains(target)
                            ) {
                                event.preventDefault();
                                return;
                            }
                            skipCloseAutoFocusRef.current = true;
                        }}
                        className={cn(
                            "z-[var(--bv-date-picker-pc-z-index)] box-border",
                            "rounded-[var(--bv-date-picker-pc-radius)] border border-bv-border bg-bv-surface",
                            "py-[var(--bv-date-picker-pc-padding-y)]",
                            "shadow-[var(--bv-date-picker-pc-shadow)]",
                            // 浮层翻转后可用的空间不够时自动变矮并内部滚动，而不是溢出视口
                            "max-h-[var(--radix-popper-available-height,100vh)] overflow-y-auto overscroll-contain",
                            className,
                        )}
                        data-slot="date-picker-panel"
                    >
                        {/*
                         * rdp 的 props 是按 mode 判别的联合类型（single 与 range 的 selected 形状不同），
                         * 静态上没法用一个对象同时满足两个分支 —— 这里按 type 分两次渲染，
                         * 各自给出正确的字面量，避免整块断言。
                         */}
                        {!hasDay ? (
                            <CoarseDateGrid
                                columns={columns}
                                viewYear={view.year}
                                minParts={minParts}
                                maxParts={maxParts}
                                activeParts={activeParts}
                                draft={draft}
                                displayRange={displayRange}
                                format={format}
                                onViewYearChange={(year) =>
                                    setView((prev) => ({ ...prev, year }))
                                }
                                onSelect={handleSelect}
                            />
                        ) : type === "range" ? (
                            <DayPicker
                                {...rdpSharedProps}
                                mode="range"
                                selected={rdpRangeSelected}
                            />
                        ) : (
                            <DayPicker
                                {...rdpSharedProps}
                                mode="single"
                                selected={rdpSingleSelected}
                            />
                        )}
                    </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
        );
    },
);
