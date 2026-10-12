import * as React from "react";
import { Popup } from "@/components/responsive/popup";
import { cn } from "@/lib/utils";
import {
    CalendarConfirmBar,
    CalendarDayContent,
    CalendarHeader,
    CalendarWeekdayHeader,
    formatMonthTitle,
    resolveDayMeta,
    type CalendarPanelProps,
} from "@/components/ui/calendar-parts";
import {
    applyRangeDay,
    buildMonthGrid,
    diffDays,
    listMonths,
    resolveCalendarSeed,
    resolveDragRange,
    rowsCountInMonth,
    toggleMultiple,
    type RangeDraft,
} from "@/hooks/use-calendar-state";
import {
    compareParts,
    formatParts,
    parseDateText,
    todayParts,
    type DateParts,
} from "@/hooks/use-date-value";

/**
 * Bivane Calendar · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：全屏弹层（poppable=false 时内嵌同构内容），min→max 的所有月份
 *       纵向连续排列；月份网格进入视口附近才挂载（对齐 Vant lazy-render）。
 * 选值：
 *   single   —— 点一天即提交并关闭；
 *   multiple —— 点选累计在底部确定条暂存，确定才提交；
 *   range    —— 触摸/鼠标按下后拖动跨日选区间（窗口超 maxRange 向前滑动），
 *               也支持两次点选；半截区间时确定条禁用。
 *
 * 为什么拖选不劫持滚动：
 *   日历主体要能纵向滑着看后面的月份。pointermove 里用 elementFromPoint 找
 *   触点下的日期格、全程不 preventDefault —— 浏览器原生滚动照常，区间预览
 *   跟着触点下的日期走（对齐 Vant touchmove 的做法）。
 *   纯鼠标环境则退化为 pointerenter 逐格更新。
 */

/** 必须与 --bv-calendar-h5-row-height 保持一致（jsdom 无布局，占位高度靠常量兜底） */
const H5_ROW_HEIGHT = 64;
/** 视口上下各提前这么多像素挂载月份网格 */
const LAZY_ROOT_MARGIN = "600px 0px";
/** 初始挂载播种月前后各这么多个月，保证打开瞬间的定位区一定有内容 */
const INITIAL_VISIBLE_RADIUS = 1;

/* ------------------------------------------------------------------ *
 * 单个月份（懒挂载）
 * ------------------------------------------------------------------ */

interface MonthSectionProps {
    year: number;
    month: number;
    monthIndex: number;
    firstDayOfWeek: number;
    initialVisible: boolean;
    scrollerRef: React.RefObject<HTMLDivElement | null>;
    renderDay: (parts: DateParts) => React.ReactNode;
    registerSection: (monthIndex: number, node: HTMLElement | null) => void;
}

const MonthSection = React.memo(function MonthSection({
    year,
    month,
    monthIndex,
    firstDayOfWeek,
    initialVisible,
    scrollerRef,
    renderDay,
    registerSection,
}: MonthSectionProps) {
    // 一旦挂载就不再卸载：滚回去时已经渲染过的月份不该闪烁重建
    const [visible, setVisible] = React.useState(initialVisible);
    const sectionRef = React.useRef<HTMLElement | null>(null);

    React.useEffect(() => {
        if (visible) return undefined;
        // jsdom / 老环境没有 IntersectionObserver：直接全量渲染
        //（默认范围仅 7 个月，兜底成本可控，且保证测试不依赖 IO mock）
        if (typeof IntersectionObserver === "undefined") {
            setVisible(true);
            return undefined;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisible(true);
                    observer.disconnect();
                }
            },
            { root: scrollerRef.current, rootMargin: LAZY_ROOT_MARGIN },
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [visible, scrollerRef]);

    const setRef = React.useCallback(
        (node: HTMLElement | null) => {
            sectionRef.current = node;
            registerSection(monthIndex, node);
        },
        [monthIndex, registerSection],
    );

    const rowCount = rowsCountInMonth(year, month, firstDayOfWeek);
    const grid = React.useMemo(
        () => buildMonthGrid(year, month, firstDayOfWeek),
        [year, month, firstDayOfWeek],
    );

    return (
        <section
            ref={setRef}
            data-slot="calendar-h5-month"
            data-month={`${year}-${month}`}
            aria-label={formatMonthTitle(year, month)}
        >
            <div
                data-slot="calendar-h5-month-title"
                className={cn(
                    "bg-bv-surface text-bv-text",
                    "px-[var(--bv-calendar-h5-month-title-padding-x)]",
                    "py-[var(--bv-calendar-h5-month-title-padding-y)]",
                    "text-[length:var(--bv-calendar-h5-month-title-font)]",
                )}
            >
                {formatMonthTitle(year, month)}
            </div>

            {visible ? (
                <div
                    role="grid"
                    data-slot="calendar-h5-days"
                    className="grid grid-cols-7 bg-bv-surface"
                >
                    {grid.cells.map((cell, index) => {
                        if (!cell.inMonth) {
                            // 前置/后置补位：留空格子占位（不渲染按钮，避免无意义 Tab 停靠）
                            return (
                                <span
                                    key={`blank-${index}`}
                                    aria-hidden="true"
                                    data-slot="calendar-h5-day-blank"
                                    className="h-[var(--bv-calendar-h5-row-height)]"
                                />
                            );
                        }
                        return (
                            <React.Fragment key={formatParts(cell.parts)}>
                                {renderDay(cell.parts)}
                            </React.Fragment>
                        );
                    })}
                </div>
            ) : (
                // 未挂载时用固定高度占位：scrollTop、滚动条比例、定位滚动都不依赖网格已渲染
                <div
                    aria-hidden="true"
                    data-slot="calendar-h5-month-placeholder"
                    style={{ height: rowCount * H5_ROW_HEIGHT }}
                />
            )}
        </section>
    );
});

/* ------------------------------------------------------------------ *
 * 弹层主体（全屏弹层与内嵌形态共用同一份内容）
 * ------------------------------------------------------------------ */

interface CalendarBodyProps extends Omit<
    CalendarPanelProps,
    "mode" | "open" | "onOpenChange"
> {
    /** 弹层打开时播种定位；内嵌形态在首次挂载时也定位一次 */
    active: boolean;
}

const H5CalendarBody = React.forwardRef<HTMLDivElement, CalendarBodyProps>(
    function H5CalendarBody(
        {
            type,
            selected,
            draft,
            onDraftChange,
            onSubmit,
            onCancel,
            minParts,
            maxParts,
            firstDayOfWeek,
            formatter,
            maxRange,
            allowSameDay,
            showMark,
            title,
            showTitle,
            confirmText,
            confirmDisabledText,
            footer,
            readonly,
            poppable,
            onOverRange,
            ariaLabel,
            id,
            className,
            active,
        },
        ref,
    ) {
        const scrollerRef = React.useRef<HTMLDivElement | null>(null);
        const sectionRefs = React.useRef<Array<HTMLElement | null>>([]);
        const today = React.useMemo(() => todayParts(), []);

        /* ---------- 月份枚举与播种定位 ---------- */

        const months = React.useMemo(
            () => listMonths(minParts, maxParts),
            [minParts, maxParts],
        );

        // 打开时优先定位草稿终点（区间拖到一半的位置），其次已选值，最后今天
        const seedParts = React.useMemo(
            () =>
                resolveCalendarSeed(
                    draft.length > 0 ? draft : selected,
                    minParts,
                    maxParts,
                ),
            [draft, selected, minParts, maxParts],
        );
        const seedIndex = React.useMemo(() => {
            const found = months.findIndex(
                (item) =>
                    item.year === seedParts.year &&
                    item.month === seedParts.month,
            );
            return found >= 0 ? found : 0;
        }, [months, seedParts]);

        const [subtitle, setSubtitle] = React.useState(() =>
            formatMonthTitle(seedParts.year, seedParts.month),
        );

        const registerSection = React.useCallback(
            (monthIndex: number, node: HTMLElement | null) => {
                sectionRefs.current[monthIndex] = node;
            },
            [],
        );

        // 打开/激活瞬间滚到播种月（只在 active 翻转时做一次，不跟随值变化，
        // 否则拖选跨月时视图会被强行拽走）
        const wasActiveRef = React.useRef(false);
        React.useLayoutEffect(() => {
            if (!active || wasActiveRef.current) return;
            wasActiveRef.current = true;
            const scroller = scrollerRef.current;
            const target = sectionRefs.current[seedIndex];
            if (!scroller || !target) return;
            // 让月份标题落在 sticky 星期行的下沿，而不是被遮住 44px
            scroller.scrollTop = Math.max(0, target.offsetTop - 44);
        }, [active, seedIndex]);

        /* ---------- 区间拖选 ---------- */

        // 正在进行中的拖选起点；moved 区分「点按」与「拖动」，决定 pointerup 后
        // 要不要吞掉紧随其后的 click（否则同一次交互会被再算一次点选）
        const dragRef = React.useRef<{
            anchorText: string;
            moved: boolean;
        } | null>(null);
        const suppressClickRef = React.useRef(false);
        const dragStateRef = React.useRef({ type, maxRange, readonly });
        dragStateRef.current = { type, maxRange, readonly };

        const beginDrag = React.useCallback((dateText: string) => {
            if (dragStateRef.current.readonly) return;
            if (dragStateRef.current.type !== "range") return;
            dragRef.current = { anchorText: dateText, moved: false };
        }, []);

        /** 拖选经过某天：窗口跟手，超 maxRange 时起点整体向前滑（纯函数在 state 层） */
        const updateDragTo = React.useCallback(
            (dateText: string) => {
                const drag = dragRef.current;
                if (!drag) return;
                const anchor =
                    draft.length > 0
                        ? (draft[0] ?? drag.anchorText)
                        : drag.anchorText;
                if (dateText === anchor && draft[1] === undefined) return;
                if (dateText !== drag.anchorText) drag.moved = true;
                const { draft: preview } = resolveDragRange(
                    anchor,
                    dateText,
                    dragStateRef.current.maxRange,
                );
                if (preview[1] === null || preview[0] === null) return;
                // 同日拖选只在允许同日区间时写两端，否则保留单起点
                onDraftChange(
                    preview[0] === preview[1] && !allowSameDay
                        ? [preview[0]]
                        : [preview[0], preview[1]],
                );
            },
            [draft, allowSameDay, onDraftChange],
        );

        /* ---------- 点按选值 ---------- */

        const handleTap = React.useCallback(
            (dateText: string) => {
                if (readonly) return;
                const parts = parseDateText(dateText);
                if (!parts) return;

                if (type === "single") {
                    onSubmit([dateText]);
                    return;
                }

                if (type === "multiple") {
                    onDraftChange(toggleMultiple(draft, dateText));
                    return;
                }

                // range：两次点选定两端；轻点超出 maxRange 只回调不滑动（与拖选区分）
                const rangeDraft: RangeDraft = [
                    draft[0] ?? null,
                    draft[1] ?? null,
                ];
                if (rangeDraft[0] && rangeDraft[1] === null && maxRange) {
                    const startParts = parseDateText(rangeDraft[0]);
                    if (startParts && diffDays(startParts, parts) >= maxRange) {
                        onOverRange?.({ date: dateText, maxRange });
                        return;
                    }
                }
                const { draft: next } = applyRangeDay(rangeDraft, dateText, {
                    allowSameDay,
                });
                onDraftChange(
                    next.filter((item): item is string => item !== null),
                );
            },
            [
                readonly,
                type,
                draft,
                maxRange,
                allowSameDay,
                onSubmit,
                onDraftChange,
                onOverRange,
            ],
        );

        // pointerup 挂 window：手指/鼠标可能在格子外松开
        React.useEffect(() => {
            const finishDrag = () => {
                const drag = dragRef.current;
                if (drag && drag.moved) {
                    // 拖动产生过预览：吞掉这次 click，端点已在 pointermove 中写入草稿
                    suppressClickRef.current = true;
                    requestAnimationFrame(() => {
                        suppressClickRef.current = false;
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
        }, []);

        /** 触摸滚动途中用 elementFromPoint 找触点下的日期格（不阻止原生滚动） */
        const handleScrollerPointerMove = (
            event: React.PointerEvent<HTMLDivElement>,
        ) => {
            if (!dragRef.current) return;
            if (event.pointerType === "mouse") return; // 鼠标走 onPointerEnter，不在这里重复
            const target = document.elementFromPoint(
                event.clientX,
                event.clientY,
            );
            const dayNode = target?.closest("[data-slot='calendar-h5-day']");
            const dateText = dayNode?.getAttribute("data-date");
            if (dateText) updateDragTo(dateText);
        };

        /* ---------- 滚动联动副标题 ---------- */

        const scrollRafRef = React.useRef<number | null>(null);
        const updateSubtitle = React.useCallback(() => {
            const scroller = scrollerRef.current;
            if (!scroller) return;
            // 找最后一个顶部已经越过视口上沿（含 sticky 星期行补偿）的月份
            const probe = scroller.scrollTop + 44 + 1;
            let current = 0;
            sectionRefs.current.forEach((node, index) => {
                if (node && node.offsetTop <= probe) current = index;
            });
            const month = months[current];
            if (month) setSubtitle(formatMonthTitle(month.year, month.month));
        }, [months]);

        const handleScroll = () => {
            if (scrollRafRef.current !== null) return;
            scrollRafRef.current = requestAnimationFrame(() => {
                scrollRafRef.current = null;
                updateSubtitle();
            });
        };

        React.useEffect(() => {
            return () => {
                if (scrollRafRef.current !== null)
                    cancelAnimationFrame(scrollRafRef.current);
            };
        }, []);

        /* ---------- 日期格渲染 ---------- */

        // 范围/多选状态查询：O(1) 的 Set 比每格 includes 更稳（默认范围约 200 格）
        const selection = React.useMemo(() => {
            // multiple 的暂存还没提交，高亮必须跟草稿走；single 点选即提交，跟已选值走
            const pickedSet =
                type === "multiple" ? new Set(draft) : new Set(selected);
            return {
                isSelected: (text: string) => pickedSet.has(text),
                start: type === "range" ? (draft[0] ?? null) : null,
                end: type === "range" ? (draft[1] ?? null) : null,
            };
        }, [type, selected, draft]);

        const renderDay = React.useCallback(
            (parts: DateParts) => {
                const dateText = formatParts(parts);
                const meta = resolveDayMeta({
                    parts,
                    dateText,
                    formatter,
                    minParts,
                    maxParts,
                    todayParts: today,
                    showMark,
                });

                const isStart = selection.start === dateText;
                const isEnd = selection.end === dateText;
                const inRange =
                    selection.start !== null &&
                    selection.end !== null &&
                    (() => {
                        const startParts = parseDateText(
                            selection.start as string,
                        );
                        const endParts = parseDateText(selection.end as string);
                        return (
                            startParts &&
                            endParts &&
                            compareParts(parts, startParts) > 0 &&
                            compareParts(parts, endParts) < 0
                        );
                    })();
                const isPicked =
                    type === "range"
                        ? isStart || isEnd
                        : selection.isSelected(dateText);
                const isToday = compareParts(parts, today) === 0;

                return (
                    <button
                        key={dateText}
                        type="button"
                        data-slot="calendar-h5-day"
                        data-date={dateText}
                        data-selected={isPicked ? "true" : undefined}
                        data-in-range={inRange ? "true" : undefined}
                        data-range-start={isStart ? "true" : undefined}
                        data-range-end={isEnd ? "true" : undefined}
                        data-disabled={meta.disabled ? "true" : undefined}
                        disabled={meta.disabled}
                        aria-label={dateText}
                        aria-pressed={isPicked}
                        onPointerDown={() => {
                            if (!meta.disabled) beginDrag(dateText);
                        }}
                        onPointerEnter={() => {
                            if (!meta.disabled) updateDragTo(dateText);
                        }}
                        onClick={(event) => {
                            if (suppressClickRef.current) {
                                event.preventDefault();
                                return;
                            }
                            if (!meta.disabled) handleTap(dateText);
                        }}
                        className={cn(
                            "relative flex h-[var(--bv-calendar-h5-row-height)] w-full items-center justify-center border-0 bg-transparent p-0",
                            meta.disabled
                                ? "cursor-not-allowed opacity-[var(--bv-calendar-pc-cell-disabled-opacity)]"
                                : "cursor-pointer",
                        )}
                    >
                        {/* 区间色带：位于圆形端点下层，起止月端各切半圆角 */}
                        {inRange || isStart || isEnd ? (
                            <span
                                aria-hidden="true"
                                data-slot="calendar-h5-day-band"
                                className={cn(
                                    "pointer-events-none absolute top-1/2 h-[var(--bv-calendar-h5-day-size)] -translate-y-1/2",
                                    "bg-[var(--bv-calendar-range-background)]",
                                    isStart &&
                                        !isEnd &&
                                        "inset-x-0 rounded-l-[var(--bv-calendar-h5-day-size)]",
                                    isEnd &&
                                        !isStart &&
                                        "inset-x-0 rounded-r-[var(--bv-calendar-h5-day-size)]",
                                    inRange && "inset-x-0",
                                    // 同日区间：端点重合，不画整条带
                                    isStart && isEnd && "hidden",
                                )}
                            />
                        ) : null}
                        <span
                            data-slot="calendar-h5-day-shape"
                            className={cn(
                                "relative z-[1] flex h-[var(--bv-calendar-h5-day-size)] w-[var(--bv-calendar-h5-day-size)] items-center justify-center rounded-full",
                                isPicked
                                    ? "bg-[var(--bv-calendar-selected-background)] text-[var(--bv-calendar-selected-color)]"
                                    : inRange
                                      ? // 蓝带上的中间日白字（禁用日由按钮 opacity 统一弱化，不退回灰字）
                                        "text-[var(--bv-calendar-selected-color)]"
                                      : isToday
                                        ? "text-bv-primary"
                                        : "text-bv-text",
                                meta.disabled &&
                                    !isPicked &&
                                    !inRange &&
                                    "text-bv-text-3",
                                meta.className,
                            )}
                        >
                            <CalendarDayContent
                                mode="mobile"
                                meta={meta}
                                bottomSlot={
                                    meta.bottomInfo === undefined
                                        ? isStart
                                            ? "开始"
                                            : isEnd
                                              ? "结束"
                                              : undefined
                                        : undefined
                                }
                            />
                        </span>
                    </button>
                );
            },
            [
                formatter,
                minParts,
                maxParts,
                today,
                showMark,
                type,
                selection,
                beginDrag,
                updateDragTo,
                handleTap,
            ],
        );

        /* ---------- 确定条 ---------- */

        const showConfirmBar = !readonly && type !== "single";
        const confirmDisabled =
            type === "range" ? draft.length < 2 : draft.length === 0;

        const handleConfirm = () => {
            if (confirmDisabled) return;
            onSubmit(draft);
        };

        /* ---------- 骨架 ---------- */

        return (
            <div
                ref={ref}
                id={id}
                data-mode="h5"
                data-slot="calendar-h5-panel"
                aria-label={
                    ariaLabel ?? (typeof title === "string" ? title : "日历")
                }
                className={cn(
                    "box-border flex h-full flex-col bg-bv-surface",
                    !poppable && "h-[70vh] border border-bv-border",
                    className,
                )}
            >
                {showTitle ? (
                    <CalendarHeader
                        title={title ?? "日期选择"}
                        subtitle={poppable ? subtitle : undefined}
                        closeable={poppable}
                        onClose={onCancel}
                    />
                ) : null}

                <div
                    ref={scrollerRef}
                    data-bv-scroll-container=""
                    data-slot="calendar-h5-scroll"
                    onScroll={handleScroll}
                    onPointerMove={handleScrollerPointerMove}
                    className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                >
                    <CalendarWeekdayHeader firstDayOfWeek={firstDayOfWeek} />
                    {months.map((item, index) => (
                        <MonthSection
                            key={`${item.year}-${item.month}`}
                            year={item.year}
                            month={item.month}
                            monthIndex={index}
                            firstDayOfWeek={firstDayOfWeek}
                            initialVisible={
                                Math.abs(index - seedIndex) <=
                                INITIAL_VISIBLE_RADIUS
                            }
                            scrollerRef={scrollerRef}
                            renderDay={renderDay}
                            registerSection={registerSection}
                        />
                    ))}
                </div>

                {showConfirmBar ? (
                    <CalendarConfirmBar
                        disabled={confirmDisabled}
                        confirmText={confirmText}
                        confirmDisabledText={confirmDisabledText}
                        onConfirm={handleConfirm}
                        footer={footer}
                    />
                ) : null}
            </div>
        );
    },
);

/* ------------------------------------------------------------------ *
 * 导出：弹层 / 内嵌二选一
 * ------------------------------------------------------------------ */

export const H5Calendar = React.forwardRef<HTMLDivElement, CalendarPanelProps>(
    function H5Calendar(
        { open, onOpenChange, onCancel, poppable, ...bodyProps },
        ref,
    ) {
        if (!poppable) {
            // 内嵌形态：不挂 Popup，直接渲染同构主体
            return (
                <H5CalendarBody
                    ref={ref}
                    {...bodyProps}
                    poppable={false}
                    active
                    onCancel={onCancel}
                />
            );
        }

        return (
            <Popup
                open={open}
                // forceMode 必须透传：Popup 内部自行判模式，不传时逃生舱对弹层失效
                forceMode={bodyProps.mode}
                onOpenChange={(next) => {
                    onOpenChange(next);
                    if (!next) onCancel();
                }}
                position="fullscreen"
                round={false}
                scrollable={false}
                // 日历里点遮罩几乎都是误触（草稿会丢），默认不允许点遮罩关闭
                closeOnClickOverlay={false}
            >
                <H5CalendarBody
                    ref={ref}
                    {...bodyProps}
                    poppable
                    active={open}
                    onCancel={onCancel}
                />
            </Popup>
        );
    },
);
