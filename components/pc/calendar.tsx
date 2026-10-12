import * as React from "react";
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
import {
    CalendarDayContent,
    CALENDAR_WEEKDAY_CHARS,
    formatMonthTitle,
    resolveDayMeta,
    type CalendarDayMeta,
    type CalendarPanelProps,
} from "@/components/ui/calendar-parts";
import {
    applyRangeDay,
    diffDays,
    resolveCalendarSeed,
    resolveDragRange,
    toggleMultiple,
    type RangeDraft,
} from "@/hooks/use-calendar-state";
import {
    DEFAULT_DATE_FORMAT,
    addDays,
    addMonths,
    clampParts,
    formatParts,
    parseDateText,
    toParts,
    weekBounds,
    type DateParts,
} from "@/hooks/use-date-value";

/**
 * Bivane Calendar · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：**内嵌常驻面板**（不是弹层）——白底描边卡片直接铺在页面里；
 *       single / multiple 单月，range 并排双月，顶部 ‹ 年月 › 导航。
 * 选值：桌面端无确认条（架构 §6.5 规则 5）——点选即提交：
 *   single   点一天即生效；multiple 点一下勾选/取消即生效；
 *   range    鼠标按下拖动跨日选区间（超 maxRange 窗口向前滑），松开即提交；
 *            也支持两次点选（首次点定起点，悬停有区间预览）。
 *
 * rdp 只作日期引擎：哪一天在哪格、outside/weekday/双月对齐归它；
 * 值语义（两段式区间、拖选滑窗、多选回写）全部在本文件，onSelect 传空函数
 * 只是为了把 rdp 拨到受控侧（原因与 components/pc/date-picker.tsx 相同）。
 *
 * 键盘：焦点落在面板上（42×N 个格子不进 Tab 流），方向键逐日/逐周、
 * PageUp/Down 逐月、Home/End 跳到周首/周末、Enter 选定；禁用日自动跳过。
 */

const PC_WEEK_START = 0;
const ACTIVE_MODIFIER = "bvActive";
/** 键盘巡航时寻找下一个可选日的最大跨步数（超过说明区间内没有可选日） */
const ENABLED_SEARCH_LIMIT = 60;

const isoOfDate = (date: Date): string =>
    formatParts(toParts(date), DEFAULT_DATE_FORMAT);
const dateOfParts = (parts: DateParts): Date =>
    new Date(parts.year, parts.month - 1, parts.day);

/* ------------------------------------------------------------------ *
 * 渲染期上下文：把「每日装饰 + 区间端点」从面板主体传给模块级 rdp 组件
 * （组件必须模块级：写在体内会让 rdp 的 useMemo 每次渲染全量重算）
 * ------------------------------------------------------------------ */

type RangeEdge = "start" | "end" | "both" | null;

interface DayContextValue {
    resolve: (date: Date) => {
        meta: CalendarDayMeta;
        edge: RangeEdge;
        /** 当前展示的区间是否已有终点（含悬停预览）；半截起点不画色带 */
        ranged: boolean;
    };
    /** 在日期格上按下指针：range 模式据此开始鼠标拖选（rdp 不转发 pointer 事件，走上下文） */
    beginDrag: (date: Date) => void;
}

const DayContext = React.createContext<DayContextValue>({
    resolve: () => ({
        meta: { text: "", disabled: false },
        edge: null,
        ranged: false,
    }),
    beginDrag: () => {},
});

function RdpRoot({ rootRef, className, children, ...rest }: RootProps) {
    return (
        <div
            {...rest}
            ref={rootRef}
            data-mode="pc"
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
            data-slot="calendar-pc-month-panel"
            aria-label={formatMonthTitle(
                calendarMonth.date.getFullYear(),
                calendarMonth.date.getMonth() + 1,
            )}
            className={cn(
                className,
                "relative flex w-[var(--bv-calendar-pc-panel-width)] flex-col",
                "px-[var(--bv-calendar-pc-padding-x)]",
            )}
        >
            {children}
        </div>
    );
}

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
            data-slot="calendar-pc-month-header"
            className={cn(
                className,
                "flex items-center justify-center",
                "h-[var(--bv-calendar-pc-nav-height)]",
            )}
        >
            <span
                data-slot="calendar-pc-month-title"
                className="text-bv-md font-bv-bold text-bv-text"
            >
                {formatMonthTitle(
                    calendarMonth.date.getFullYear(),
                    calendarMonth.date.getMonth() + 1,
                )}
            </span>
        </div>
    );
}

function RdpWeek({ week: _week, className, children, ...rest }: WeekProps) {
    return (
        <tr {...rest} data-slot="calendar-pc-week" className={cn(className)}>
            {children}
        </tr>
    );
}

function RdpWeekday({ className, children, ...rest }: WeekdayProps) {
    return (
        <th
            {...rest}
            data-slot="calendar-pc-weekday"
            className={cn(
                className,
                "h-[var(--bv-calendar-pc-weekday-height)] text-center align-middle font-normal",
                "text-bv-xs leading-[var(--bv-calendar-pc-weekday-line-height)]",
                "text-[var(--bv-calendar-pc-weekday-color)]",
            )}
        >
            {children}
        </th>
    );
}

/**
 * 日期格分两层（对齐 Vant / AntD 月历的视觉范式）：
 *   1. 区间色带层：与端点圆同高、垂直居中；中间格全幅、起点格右半幅、
 *      终点格左半幅 —— 两端圆浮在色带断点上，跨周换行时色带自然断开；
 *   2. 端点圆层：直径 34px 小于格宽（邻选不粘连），选中实心、今天只标色不画圈
 *      （「今天」文字已足够标识，圆环只属于选中/焦点，避免与旁边的选中圆打架）、
 *      键盘焦点环落在圆上而不是整格。
 * rdp 算好修饰符；装饰（topInfo / 禁用 / 端点文案）从 DayContext 取。
 * selected 对 range 中间日也为真，端点要排掉 range_middle。
 */
function RdpDayButton({
    day,
    modifiers,
    className: rdpClassName,
    children: _children,
    ...rest
}: DayButtonProps) {
    const { resolve, beginDrag } = React.useContext(DayContext);
    const { meta, edge, ranged } = resolve(day.date);

    const isMiddle = modifiers.range_middle === true;
    // 相邻月重复出现的同一天只画色带不画圆，避免双月面板交界处出现两个端点圆
    const isOutside = modifiers.outside === true;
    // 半截起点（已点「开始」、等终点且鼠标未悬停）rdp 不给 selected 修饰符，
    // 但视觉上它必须已是实心端点，不能只剩半截色带 + 普通文字。
    // 注意：rdp 区间内每一天都带 selected，中间日必须用 range_middle 排除，
    // 否则整段区间会变成一排实心圆而不是「端点圆 + 色带」
    const isAnchorStart = !isMiddle && !isOutside && edge === "start";
    const isSelected =
        (modifiers.selected === true && !isMiddle && !isOutside) ||
        isAnchorStart;
    const isDisabled = modifiers.disabled === true;
    const isToday = modifiers.today === true;
    const isActive = modifiers[ACTIVE_MODIFIER] === true;

    // 色带只在区间成段（已有终点/悬停预览）时出现：同日起止（both）不画带，
    // 半截起点只显示实心圆、不伸出色带
    let bandSide: "full" | "start" | "end" | null = null;
    if (ranged && edge !== "both") {
        if (!isOutside) {
            if (isMiddle) bandSide = "full";
            else if (edge === "start") bandSide = "start";
            else if (edge === "end") bandSide = "end";
        } else if (isMiddle || edge) {
            // 落在邻月网格里的区间日：补全幅色带，把双月之间的条纹在视觉上接上
            bandSide = "full";
        }
    }

    return (
        <button
            {...rest}
            type="button"
            tabIndex={-1}
            // 点击不抢焦点：键盘巡航由面板级处理器统一驱动（与 DatePicker PC 同理由）
            onMouseDown={(event) => event.preventDefault()}
            // range 鼠标拖选起点（rdp 不转发 pointer 事件，经由上下文回调）
            onPointerDown={() => {
                if (!isDisabled) beginDrag(day.date);
            }}
            aria-label={day.isoDate}
            data-slot="calendar-pc-cell"
            data-date={day.isoDate}
            data-selected={isSelected ? "true" : undefined}
            data-in-range={isMiddle || edge !== null ? "true" : undefined}
            data-outside={isOutside ? "true" : undefined}
            data-active={isActive ? "true" : undefined}
            data-disabled={isDisabled ? "true" : undefined}
            className={cn(
                "group relative flex h-[var(--bv-calendar-pc-cell-height)] w-full",
                "cursor-pointer items-center justify-center border-0 bg-transparent p-0",
                isDisabled && "cursor-not-allowed",
                rdpClassName,
            )}
        >
            {bandSide ? (
                <span
                    aria-hidden="true"
                    data-slot="calendar-pc-cell-band"
                    data-side={bandSide}
                    className={cn(
                        "pointer-events-none absolute top-1/2 h-[var(--bv-calendar-pc-cell-day-size)] -translate-y-1/2",
                        "bg-[var(--bv-calendar-range-background)]",
                        bandSide === "full" && "inset-x-0",
                        bandSide === "start" && "left-1/2 right-0",
                        bandSide === "end" && "left-0 right-1/2",
                    )}
                />
            ) : null}
            <span
                data-slot="calendar-pc-cell-shape"
                className={cn(
                    "relative z-[1] flex h-[var(--bv-calendar-pc-cell-day-size)] w-[var(--bv-calendar-pc-cell-day-size)]",
                    "items-center justify-center rounded-full",
                    isSelected &&
                        "bg-[var(--bv-calendar-selected-background)] text-[var(--bv-calendar-selected-color)]",
                    // 区间中间（含邻月补位）：当月日白字落在蓝带上，邻月日弱化
                    !isSelected &&
                        isMiddle &&
                        (isOutside
                            ? "text-bv-text-3"
                            : "text-[var(--bv-calendar-selected-color)]"),
                    !isSelected &&
                        !isMiddle &&
                        // 今天只给 primary 文字（「今天」标注已由 showMark 承担）：
                        // 圆环属于「选中/焦点」语义，同色再画一圈会与旁边的选中圆打架
                        isToday &&
                        "text-bv-primary",
                    !isSelected &&
                        !isMiddle &&
                        !isToday &&
                        (isOutside || isDisabled) &&
                        "text-bv-text-3",
                    // hover 圆只给当月可选日且不在蓝带上：邻月日弱化不反馈，
                    // 区间内再叠浅色圆会打断整条色带
                    !isSelected &&
                        !isMiddle &&
                        !isDisabled &&
                        !isOutside &&
                        "group-hover:bg-[var(--bv-calendar-pc-cell-hover-background)]",
                    // 键盘焦点环：仅面板处于 :focus-visible（Tab 进入/方向键巡航）
                    // 时才显现；鼠标点选或初始挂载不显示，否则光标初始日（今天）
                    // 会顶一圈蓝环，与「今天/选中」语义混淆
                    isActive &&
                        "ring-[var(--bv-calendar-pc-cell-focus-ring)] [.bv-calendar-pc-root:focus-visible_&]:ring-2",
                    isDisabled &&
                        "opacity-[var(--bv-calendar-pc-cell-disabled-opacity)]",
                    meta.className,
                )}
            >
                <CalendarDayContent
                    mode="desktop"
                    meta={meta}
                    bottomSlot={
                        !isOutside && edge && meta.bottomInfo === undefined
                            ? edge === "end"
                                ? "结束"
                                : edge === "start"
                                  ? "开始"
                                  : undefined
                            : undefined
                    }
                />
            </span>
        </button>
    );
}

const NAV_BUTTON_CLASS = cn(
    "absolute top-0 z-[1] flex cursor-pointer items-center justify-center border-0 bg-transparent p-0",
    "h-[var(--bv-calendar-pc-nav-height)] w-[var(--bv-calendar-pc-nav-height)]",
    "text-[var(--bv-calendar-pc-nav-color)] hover:text-bv-primary",
    "disabled:cursor-not-allowed disabled:opacity-30",
);

function RdpPreviousButton({
    className,
    children: _children,
    ...rest
}: PreviousMonthButtonProps) {
    return (
        <button
            {...rest}
            data-slot="calendar-pc-month-prev"
            className={cn(
                NAV_BUTTON_CLASS,
                "left-[var(--bv-calendar-pc-padding-x)]",
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
            data-slot="calendar-pc-month-next"
            className={cn(
                NAV_BUTTON_CLASS,
                "right-[var(--bv-calendar-pc-padding-x)]",
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

const RDP_CLASS_NAMES: Partial<ClassNames> = {
    months: "flex items-stretch gap-[var(--bv-calendar-pc-dual-gap)]",
    month_grid: "w-full table-fixed border-collapse",
    day: "p-0 align-middle",
    week: "",
    weeks: "",
    weekdays: "",
    weekday: "",
};

const RDP_FORMATTERS = {
    formatWeekdayName: (weekday: Date) =>
        CALENDAR_WEEKDAY_CHARS[weekday.getDay()] ?? "",
};

const RDP_LABELS = {
    labelNav: () => "月份导航",
    labelGrid: (date: Date) =>
        formatMonthTitle(date.getFullYear(), date.getMonth() + 1),
    labelGridcell: (date: Date) => isoOfDate(date),
    labelDayButton: (date: Date) => isoOfDate(date),
    labelWeekday: (weekday: Date) =>
        `星期${CALENDAR_WEEKDAY_CHARS[weekday.getDay()] ?? ""}`,
    labelPrevious: () => "上个月",
    labelNext: () => "下个月",
};

/** 空实现：仅用于把 rdp 拨到受控侧，选值语义不交给 rdp */
const RDP_NOOP_SELECT = () => {};

/* ------------------------------------------------------------------ *
 * PC 面板
 * ------------------------------------------------------------------ */

export const PcCalendar = React.forwardRef<HTMLDivElement, CalendarPanelProps>(
    function PcCalendar(
        {
            type,
            selected,
            draft: _draft,
            onDraftChange: _onDraftChange,
            onSubmit,
            minParts,
            maxParts,
            firstDayOfWeek,
            formatter,
            maxRange,
            allowSameDay,
            showMark,
            readonly,
            onOverRange,
            ariaLabel,
            id,
            className,
        },
        ref,
    ) {
        const today = React.useMemo(() => {
            const now = new Date();
            return {
                year: now.getFullYear(),
                month: now.getMonth() + 1,
                day: now.getDate(),
            };
        }, []);

        const seed = React.useMemo(
            () => resolveCalendarSeed(selected, minParts, maxParts),
            [selected, minParts, maxParts],
        );
        const [view, setView] = React.useState<{ year: number; month: number }>(
            {
                year: seed.year,
                month: seed.month,
            },
        );
        const [cursor, setCursor] = React.useState<DateParts>(seed);

        /** range 本地交互态：起点已定、等终点（不涉及取消语义，故不收分发层） */
        const [anchor, setAnchor] = React.useState<string | null>(null);
        const [hoverText, setHoverText] = React.useState<string | null>(null);
        /** 拖选进行中的预览区间；松手即提交 */
        const [dragPreview, setDragPreview] = React.useState<
            [string, string] | null
        >(null);
        const dragRef = React.useRef<{
            anchorText: string;
            moved: boolean;
        } | null>(null);
        const suppressClickRef = React.useRef(false);

        /* ---------- formatter 装饰（按日期缓存，formatter/bounds 变了整体作废） ---------- */

        const metaMap = React.useMemo(
            () => new Map<string, CalendarDayMeta>(),
            // 缓存键不含这些入参，它们变化时旧装饰必须整体作废（工厂里不引用，故需忽略本告警）
            // eslint-disable-next-line react-hooks/exhaustive-deps
            [formatter, showMark, minParts, maxParts],
        );

        const getMeta = React.useCallback(
            (date: Date): CalendarDayMeta => {
                const text = isoOfDate(date);
                const cached = metaMap.get(text);
                if (cached) return cached;
                const parts = toParts(date);
                const meta = resolveDayMeta({
                    parts,
                    dateText: text,
                    formatter,
                    minParts,
                    maxParts,
                    todayParts: today,
                    showMark,
                });
                metaMap.set(text, meta);
                return meta;
            },
            [metaMap, formatter, minParts, maxParts, today, showMark],
        );

        const isDateDisabled = React.useCallback(
            (date: Date) => getMeta(date).disabled,
            [getMeta],
        );

        /* ---------- 区间展示带（已提交 / 拖选预览 / 起点+悬停预览） ---------- */

        const committedStart = type === "range" ? (selected[0] ?? null) : null;
        const committedEnd = type === "range" ? (selected[1] ?? null) : null;

        const rangeDisplay = React.useMemo((): {
            from: string;
            to: string | null;
        } | null => {
            if (type !== "range") return null;
            if (dragPreview)
                return { from: dragPreview[0], to: dragPreview[1] };
            if (anchor) {
                const focusText = hoverText ?? formatParts(cursor);
                const anchorParts = parseDateText(anchor);
                const focusParts = parseDateText(focusText);
                if (!anchorParts || !focusParts)
                    return { from: anchor, to: null };
                const delta = diffDays(anchorParts, focusParts);
                if (delta < 0) return { from: anchor, to: null };
                // 悬停预览只夹住终点（不滑动起点）：拖选才滑动，两种反馈不能混
                if (maxRange && delta >= maxRange) {
                    const capped = addDays(anchorParts, maxRange - 1);
                    return { from: anchor, to: formatParts(capped) };
                }
                return { from: anchor, to: focusText };
            }
            if (committedStart && committedEnd) {
                return { from: committedStart, to: committedEnd };
            }
            return null;
        }, [
            type,
            dragPreview,
            anchor,
            hoverText,
            cursor,
            maxRange,
            committedStart,
            committedEnd,
        ]);

        /* ---------- 选值语义 ---------- */

        const beginDrag = React.useCallback(
            (dateText: string) => {
                if (readonly) return;
                // 只记录手势起点：普通点按（按下后没移动）必须让后续 click 走
                // selectTap 两段式。若此刻就清 anchor，第二次点击的 pointerdown
                // 会把第一次点好的起点抹掉，导致终点永远点不上（真机上 click 前
                // 必有 pointerdown，jsdom fireEvent.click 不派发，属测试盲区）
                dragRef.current = { anchorText: dateText, moved: false };
            },
            [readonly],
        );

        const updateDrag = React.useCallback(
            (dateText: string) => {
                const drag = dragRef.current;
                if (!drag) return;
                if (dateText === drag.anchorText) return;
                if (!drag.moved) {
                    drag.moved = true;
                    // 确认为拖选手势后才接管：丢弃两段式起点与悬停预览，
                    // 改以按下日为拖选起点；滑窗由 resolveDragRange 每次纯算
                    setAnchor(null);
                    setHoverText(null);
                }
                const { draft: preview } = resolveDragRange(
                    drag.anchorText,
                    dateText,
                    maxRange,
                );
                if (preview[0] && preview[1])
                    setDragPreview([preview[0], preview[1]]);
            },
            [maxRange],
        );

        const dayContextValue = React.useMemo<DayContextValue>(
            () => ({
                resolve: (date: Date) => {
                    const text = isoOfDate(date);
                    let edge: RangeEdge = null;
                    if (rangeDisplay) {
                        if (
                            text === rangeDisplay.from &&
                            text === rangeDisplay.to
                        )
                            edge = "both";
                        else if (text === rangeDisplay.from) edge = "start";
                        else if (text === rangeDisplay.to) edge = "end";
                    }
                    return {
                        meta: getMeta(date),
                        edge,
                        ranged:
                            rangeDisplay?.to !== null &&
                            rangeDisplay?.to !== undefined,
                    };
                },
                beginDrag: (date: Date) => {
                    if (type === "range") beginDrag(isoOfDate(date));
                },
            }),
            [rangeDisplay, getMeta, beginDrag, type],
        );

        React.useEffect(() => {
            const finishDrag = () => {
                const drag = dragRef.current;
                if (drag?.moved) {
                    suppressClickRef.current = true;
                    requestAnimationFrame(() => {
                        suppressClickRef.current = false;
                    });
                    // 松手即提交桌面端无确认条；预览残缺则丢弃
                    setDragPreview((current) => {
                        if (
                            current &&
                            current[0] &&
                            current[1] &&
                            current[0] !== current[1]
                        ) {
                            onSubmit([current[0], current[1]]);
                        }
                        return null;
                    });
                }
                dragRef.current = null;
            };
            window.addEventListener("pointerup", finishDrag);
            window.addEventListener("pointercancel", finishDrag);
            return () => {
                window.removeEventListener("pointerup", finishDrag);
                window.removeEventListener("pointercancel", finishDrag);
            };
        }, [onSubmit]);

        /** 点选（非拖动）：single 即提交 / multiple 即时回写 / range 两段式 */
        const selectTap = React.useCallback(
            (dateText: string) => {
                if (readonly) return;
                const parts = parseDateText(dateText);
                if (!parts) return;

                if (type === "single") {
                    onSubmit([dateText]);
                    return;
                }
                if (type === "multiple") {
                    onSubmit(toggleMultiple(selected, dateText));
                    return;
                }

                if (!anchor) {
                    setAnchor(dateText);
                    setHoverText(null);
                    return;
                }
                const anchorParts = parseDateText(anchor);
                if (
                    anchorParts &&
                    maxRange &&
                    diffDays(anchorParts, parts) >= maxRange
                ) {
                    // 轻点超界：只提示不改值（拖选超界才滑动窗口）
                    onOverRange?.({ date: dateText, maxRange });
                    return;
                }
                const { draft: next, completed } = applyRangeDay(
                    [anchor, null] as RangeDraft,
                    dateText,
                    { allowSameDay },
                );
                if (completed && next[0] && next[1]) {
                    onSubmit([next[0], next[1]]);
                    setAnchor(null);
                    setHoverText(null);
                    return;
                }
                // 反向点选：以新日期为起点重新等终点
                setAnchor(next[0]);
            },
            [
                readonly,
                type,
                selected,
                anchor,
                maxRange,
                allowSameDay,
                onSubmit,
                onOverRange,
            ],
        );

        const handleDayClick = React.useCallback(
            (day: Date) => {
                if (suppressClickRef.current) return;
                selectTap(isoOfDate(day));
            },
            [selectTap],
        );

        /* ---------- 键盘巡航（禁用日自动跳过） ---------- */

        const moveCursor = React.useCallback(
            (next: DateParts) => {
                let candidate = clampParts(next, minParts, maxParts);
                // 落在禁用日（含 formatter 业务禁用）时逐日向前找最近的可选日
                for (let index = 0; index < ENABLED_SEARCH_LIMIT; index += 1) {
                    if (!isDateDisabled(dateOfParts(candidate))) break;
                    candidate = clampParts(
                        addDays(candidate, 1),
                        minParts,
                        maxParts,
                    );
                }
                setCursor(candidate);
                setView((prev) =>
                    prev.year === candidate.year &&
                    prev.month === candidate.month
                        ? prev
                        : { year: candidate.year, month: candidate.month },
                );
            },
            [minParts, maxParts, isDateDisabled],
        );

        const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (readonly) return;
            switch (event.key) {
                case "ArrowLeft":
                    event.preventDefault();
                    moveCursor(addDays(cursor, -1));
                    return;
                case "ArrowRight":
                    event.preventDefault();
                    moveCursor(addDays(cursor, 1));
                    return;
                case "ArrowUp":
                    event.preventDefault();
                    moveCursor(addDays(cursor, -7));
                    return;
                case "ArrowDown":
                    event.preventDefault();
                    moveCursor(addDays(cursor, 7));
                    return;
                case "PageUp":
                    event.preventDefault();
                    moveCursor(addMonths(cursor, -1));
                    return;
                case "PageDown":
                    event.preventDefault();
                    moveCursor(addMonths(cursor, 1));
                    return;
                case "Home":
                    event.preventDefault();
                    moveCursor(weekBounds(cursor, firstDayOfWeek).start);
                    return;
                case "End":
                    event.preventDefault();
                    moveCursor(weekBounds(cursor, firstDayOfWeek).end);
                    return;
                case "Enter":
                case " ":
                    event.preventDefault();
                    selectTap(formatParts(cursor));
                    return;
                default:
            }
        };

        /* ---------- rdp 受控值 ---------- */

        const rdpMonth = React.useMemo(
            () => new Date(view.year, view.month - 1, 1),
            [view.year, view.month],
        );

        const rdpSingleSelected = React.useMemo(
            () =>
                selected[0]
                    ? dateOfParts(parseDateText(selected[0]) as DateParts)
                    : undefined,
            [selected],
        );
        const rdpMultipleSelected = React.useMemo(
            () =>
                selected
                    .map((text) => parseDateText(text))
                    .filter((parts): parts is DateParts => parts !== null)
                    .map((parts) => dateOfParts(parts)),
            [selected],
        );
        const rdpRangeSelected = React.useMemo(() => {
            if (!rangeDisplay) return undefined;
            const from = parseDateText(rangeDisplay.from);
            if (!from || !rangeDisplay.to) return undefined;
            const to = parseDateText(rangeDisplay.to);
            if (!to) return undefined;
            return { from: dateOfParts(from), to: dateOfParts(to) };
        }, [rangeDisplay]);

        const sharedProps = {
            numberOfMonths: type === "range" ? 2 : 1,
            fixedWeeks: true,
            showOutsideDays: true,
            weekStartsOn: (firstDayOfWeek ?? PC_WEEK_START) as 0,
            month: rdpMonth,
            onMonthChange: (next: Date) =>
                setView({
                    year: next.getFullYear(),
                    month: next.getMonth() + 1,
                }),
            startMonth: dateOfParts(minParts),
            endMonth: dateOfParts(maxParts),
            navLayout: "around" as const,
            disabled: isDateDisabled,
            modifiers: { [ACTIVE_MODIFIER]: dateOfParts(cursor) },
            components: RDP_COMPONENTS,
            classNames: RDP_CLASS_NAMES,
            formatters: RDP_FORMATTERS,
            labels: RDP_LABELS,
            onDayClick: handleDayClick,
            onDayMouseEnter: (day: Date) => {
                if (dragRef.current) updateDrag(isoOfDate(day));
                else if (anchor) setHoverText(isoOfDate(day));
            },
            onDayMouseLeave: () => {
                if (!dragRef.current) setHoverText(null);
            },
            onSelect: RDP_NOOP_SELECT,
            autoFocus: false,
        };

        return (
            <DayContext.Provider value={dayContextValue}>
                <div
                    ref={ref}
                    id={id}
                    data-mode="pc"
                    data-slot="calendar-pc-panel"
                    role="group"
                    aria-label={ariaLabel ?? "日历"}
                    aria-readonly={readonly || undefined}
                    tabIndex={readonly ? -1 : 0}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "bv-calendar-pc-root box-border inline-flex flex-col bg-bv-surface outline-none",
                        "rounded-[var(--bv-calendar-pc-radius)] border border-[var(--bv-calendar-pc-border-color)]",
                        "px-[var(--bv-calendar-pc-padding-x)] py-[var(--bv-calendar-pc-padding-y)]",
                        "focus-visible:ring-1 focus-visible:ring-bv-primary",
                        className,
                    )}
                >
                    {type === "range" ? (
                        <DayPicker
                            {...sharedProps}
                            mode="range"
                            selected={rdpRangeSelected}
                        />
                    ) : type === "multiple" ? (
                        <DayPicker
                            {...sharedProps}
                            mode="multiple"
                            selected={rdpMultipleSelected}
                        />
                    ) : (
                        <DayPicker
                            {...sharedProps}
                            mode="single"
                            selected={rdpSingleSelected}
                        />
                    )}
                </div>
            </DayContext.Provider>
        );
    },
);
