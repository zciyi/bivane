import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";
import { compareParts, type DateParts } from "@/hooks/use-date-value";
import type { CalendarType } from "@/hooks/use-calendar-state";

/**
 * Bivane Calendar · 跨模式共用零件（模式 C 的「共享展示 + 共享契约」层）
 *
 * H5（全屏弹层 + 月份纵向滚动 + 触摸拖选）与 PC（内嵌月历 + rdp 引擎）
 * 共用的部分很薄：
 *   1. 面板契约 CalendarPanelProps（分发层与两份实现之间的接口）；
 *   2. 日期格的**内容结构**（数字 + 顶部信息 + 底部信息）与 formatter 归并；
 *   3. H5 头部（标题 / 动态月份副标题 / 关闭）与底部确定条；
 *   4. 中文星期表头、月份标题等纯文案。
 *
 * 月历网格本身**不共用**：H5 是自绘的连续月份滚动列表（要懒挂载、要拖选），
 * PC 是 react-day-picker 引擎（见 components/pc/calendar.tsx）。
 *
 * 本文件不使用 bv-h5: / bv-pc: 变体：理由同 date-parts —— 这些零件可能渲染在
 * 没有 data-mode 祖先的位置，外壳差异一律走显式 JS 分支（契约 17）。
 */

/* ------------------------------------------------------------------ *
 * 文案与日期装饰
 * ------------------------------------------------------------------ */

/** 中文单字星期表头（周日为首，与 firstDayOfWeek 默认值配套） */
export const CALENDAR_WEEKDAY_CHARS = [
    "日",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
];

/** 月份标题：H5 每月一行、PC rdp caption 同文案，两端必须逐字一致 */
export function formatMonthTitle(year: number, month: number): string {
    return `${year} 年 ${month} 月`;
}

/** formatter 每天可覆盖的展示项（对齐 Vant Calendar 的 formatter 返回结构） */
export interface CalendarFormatterResult {
    /** 格里的主文案（默认是日数字，可改成「休」「班」等） */
    text?: React.ReactNode;
    /** 数字上方小字（默认今天显示「今天」，见 showMark） */
    topInfo?: React.ReactNode;
    /** 数字下方小字（区间端点的「开始 / 结束」由实现层补） */
    bottomInfo?: React.ReactNode;
    /** 强制禁用（越界禁用不经过 formatter，这里做业务日禁用，如周末不可约） */
    disabled?: boolean;
    /** 追加到日期格上的类名（农历、节日标色等扩展用） */
    className?: string;
}

export type CalendarFormatter = (day: {
    date: string;
    parts: DateParts;
}) => CalendarFormatterResult | void;

export interface ResolveDayMetaOptions {
    parts: DateParts;
    /** 'YYYY-MM-DD'，formatter 的入参，组装一次两边复用 */
    dateText: string;
    formatter?: CalendarFormatter;
    minParts: DateParts;
    maxParts: DateParts;
    todayParts: DateParts;
    /** 默认 true：今天的顶部信息自动标「今天」（formatter 可覆盖） */
    showMark: boolean;
}

export interface CalendarDayMeta extends CalendarFormatterResult {
    /** 越界或被 formatter 禁用 */
    disabled: boolean;
}

/**
 * 归并单日的最终展示：越界 → 禁用；formatter 返回项覆盖默认；
 * showMark 给今天补默认 topInfo。H5 与 PC 必须走同一个出口，
 * 否则「同一个 formatter 在两端禁用结果不一样」是必然事故。
 */
export function resolveDayMeta({
    parts,
    dateText,
    formatter,
    minParts,
    maxParts,
    todayParts: today,
    showMark,
}: ResolveDayMetaOptions): CalendarDayMeta {
    const outOfBounds =
        compareParts(parts, minParts) < 0 || compareParts(parts, maxParts) > 0;
    const custom = formatter?.({ date: dateText, parts });

    const isToday = compareParts(parts, today) === 0;
    const topInfo =
        custom?.topInfo !== undefined
            ? custom.topInfo
            : isToday && showMark
              ? "今天"
              : undefined;

    return {
        text: custom?.text ?? parts.day,
        topInfo,
        bottomInfo: custom?.bottomInfo,
        disabled: outOfBounds || custom?.disabled === true,
        className: custom?.className,
    };
}

/* ------------------------------------------------------------------ *
 * 面板契约
 * ------------------------------------------------------------------ */

/** 超出 maxRange 时的回调载荷（轻点超界，不改变已选值） */
export interface CalendarOverRangePayload {
    date: string;
    maxRange: number;
}

/**
 * 两份实现共同接收的 props（分发层组装一次）。
 *
 * 草稿（draft）归属分发层：H5 弹层里「选了但还没确定」的区间半截/多选暂存
 * 与已提交值是两件事，取消要整体丢弃。PC 点选即提交（onSubmit），
 * 其「区间起点等终点」的本地锚点不涉及取消语义，留在 PC 实现层即可。
 */
export interface CalendarPanelProps {
    mode: DeviceMode;
    type: CalendarType;
    /** 已提交值（H5 回显 / PC 高亮），按时间升序 */
    selected: string[];
    /** 弹层草稿（仅 H5 消费；区间允许半截：长度 1 = 只有起点） */
    draft: string[];
    onDraftChange: (next: string[]) => void;
    /** 提交（H5 确定条 / single 点选即关；PC 每次选定即提交） */
    onSubmit: (next: string[]) => void;
    /** H5 取消（遮罩 / 关闭 / ESC）：丢弃草稿 */
    onCancel: () => void;
    minParts: DateParts;
    maxParts: DateParts;
    firstDayOfWeek: number;
    formatter?: CalendarFormatter;
    maxRange?: number;
    allowSameDay: boolean;
    showMark: boolean;
    title?: React.ReactNode;
    showTitle: boolean;
    confirmText: React.ReactNode;
    confirmDisabledText?: React.ReactNode;
    footer?: React.ReactNode;
    readonly: boolean;
    /** H5 弹层开合（poppable=false 内嵌时恒 true；PC 忽略） */
    open: boolean;
    onOpenChange: (open: boolean) => void;
    poppable: boolean;
    onOverRange?: (payload: CalendarOverRangePayload) => void;
    ariaLabel?: string;
    id?: string;
    className?: string;
}

/* ------------------------------------------------------------------ *
 * 日期格内容（数字 + 上/下信息）
 * ------------------------------------------------------------------ */

export interface CalendarDayContentProps {
    mode: DeviceMode;
    meta: CalendarDayMeta;
    /** 区间端点头部/底部的额外信息（如「开始」），由实现层选定后传入 */
    topSlot?: React.ReactNode;
    bottomSlot?: React.ReactNode;
}

/**
 * 格子**内部**结构两端共用；外层是圆是方、什么底色由实现层决定
 * （H5 圆形端点 54px、PC 矩形色带，几何差异不进这里）。
 */
export function CalendarDayContent({
    mode,
    meta,
    topSlot,
    bottomSlot,
}: CalendarDayContentProps) {
    const top = topSlot ?? meta.topInfo;
    const bottom = bottomSlot ?? meta.bottomInfo;
    const infoSizeClass =
        mode === "mobile"
            ? "text-[length:var(--bv-calendar-h5-day-info-size)]"
            : "text-[length:var(--bv-calendar-pc-cell-info-size)]";
    // 信息行与数字的间距两端不同：H5 圆 54px 从容；PC 圆 34px 要排两行必须收紧
    const infoGapClass =
        mode === "mobile"
            ? "mb-[var(--bv-calendar-h5-day-info-gap)]"
            : "mb-[var(--bv-calendar-pc-cell-info-gap)]";
    const infoGapBottomClass =
        mode === "mobile"
            ? "mt-[var(--bv-calendar-h5-day-info-gap)]"
            : "mt-[var(--bv-calendar-pc-cell-info-gap)]";
    const numberClass =
        mode === "mobile"
            ? "text-[length:var(--bv-calendar-h5-day-number-size)] leading-none"
            : "text-[length:var(--bv-calendar-pc-cell-number-size)] leading-none";

    return (
        <span className="flex h-full w-full flex-col items-center justify-center leading-none">
            {top !== undefined && top !== null && top !== "" ? (
                <span
                    data-slot="calendar-day-top-info"
                    className={cn(
                        "pointer-events-none block h-[1.2em] w-full truncate text-center leading-[1.2]",
                        infoGapClass,
                        infoSizeClass,
                    )}
                >
                    {top}
                </span>
            ) : null}
            <span
                data-slot="calendar-day-number"
                className={cn("pointer-events-none block", numberClass)}
            >
                {meta.text}
            </span>
            {bottom !== undefined && bottom !== null && bottom !== "" ? (
                <span
                    data-slot="calendar-day-bottom-info"
                    className={cn(
                        "pointer-events-none block h-[1.2em] w-full truncate text-center leading-[1.2]",
                        infoGapBottomClass,
                        infoSizeClass,
                    )}
                >
                    {bottom}
                </span>
            ) : null}
        </span>
    );
}

/* ------------------------------------------------------------------ *
 * H5：全屏弹层头部（标题 + 动态月份副标题 + 关闭）
 * ------------------------------------------------------------------ */

export interface CalendarHeaderProps {
    title: React.ReactNode;
    /** 随滚动更新的当前月份文案；不传则不渲染副标题行 */
    subtitle?: React.ReactNode;
    /** 是否可关闭（poppable 时给关闭按钮；内嵌形态不给） */
    closeable: boolean;
    onClose: () => void;
}

export function CalendarHeader({
    title,
    subtitle,
    closeable,
    onClose,
}: CalendarHeaderProps) {
    return (
        <div
            data-slot="calendar-h5-header"
            className={cn(
                "relative shrink-0 bg-bv-surface text-center",
                "flex flex-col items-center justify-center",
                "h-[var(--bv-calendar-h5-header-height)]",
            )}
        >
            {closeable ? (
                <button
                    type="button"
                    data-slot="calendar-h5-close"
                    aria-label="关闭"
                    onClick={onClose}
                    className="absolute left-0 top-0 flex h-[var(--bv-calendar-h5-weekday-height)] w-[var(--bv-calendar-h5-weekday-height)] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-bv-text-2"
                >
                    <Icon name="cross" />
                </button>
            ) : null}
            <div
                data-slot="calendar-h5-title"
                className="font-bv-bold text-[length:var(--bv-calendar-h5-title-font)] leading-[var(--bv-calendar-h5-title-line-height)] text-bv-text"
            >
                {title}
            </div>
            {subtitle !== undefined && subtitle !== null && subtitle !== "" ? (
                <div
                    data-slot="calendar-h5-subtitle"
                    className="mt-bv-xs text-[length:var(--bv-calendar-h5-subtitle-font)] leading-[var(--bv-calendar-h5-subtitle-line-height)] text-bv-text-2"
                >
                    {subtitle}
                </div>
            ) : null}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * H5：星期表头（sticky 吸附在月份列表上方）
 * ------------------------------------------------------------------ */

export function CalendarWeekdayHeader({
    firstDayOfWeek,
}: {
    firstDayOfWeek: number;
}) {
    const ordered = React.useMemo(() => {
        const chars = CALENDAR_WEEKDAY_CHARS;
        return chars
            .slice(firstDayOfWeek)
            .concat(chars.slice(0, firstDayOfWeek));
    }, [firstDayOfWeek]);

    return (
        <div
            role="row"
            data-slot="calendar-h5-weekdays"
            className={cn(
                "sticky top-0 z-[1] grid shrink-0 grid-cols-7 bg-bv-surface",
                "h-[var(--bv-calendar-h5-weekday-height)]",
            )}
        >
            {ordered.map((char, index) => (
                <span
                    // 索引稳定（周序不会动态变），用 index 作 key 安全
                    key={`${char}-${index}`}
                    role="columnheader"
                    data-slot="calendar-h5-weekday"
                    className="flex items-center justify-center text-[length:var(--bv-calendar-h5-weekday-font)] text-bv-text-3"
                >
                    {char}
                </span>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ *
 * H5：底部确定条（single 点选即走，不渲染；range / multiple 暂存确认）
 * ------------------------------------------------------------------ */

export interface CalendarConfirmBarProps {
    /** 区间半截时禁用，按钮文案切到 confirmDisabledText */
    disabled: boolean;
    confirmText: React.ReactNode;
    confirmDisabledText?: React.ReactNode;
    onConfirm: () => void;
    /** 自定义区（footer prop）：渲染在确定条上方、随条一起固定 */
    footer?: React.ReactNode;
}

export function CalendarConfirmBar({
    disabled,
    confirmText,
    confirmDisabledText,
    onConfirm,
    footer,
}: CalendarConfirmBarProps) {
    return (
        <div
            data-slot="calendar-h5-footer"
            className="shrink-0 bg-bv-surface bv-hairline bv-hairline--top"
        >
            {footer ? (
                <div
                    data-slot="calendar-h5-footer-extra"
                    className="px-bv-md pt-bv-sm"
                >
                    {footer}
                </div>
            ) : null}
            <div
                className={cn(
                    "px-[var(--bv-calendar-h5-footer-padding-x)]",
                    "py-[var(--bv-calendar-h5-footer-padding-y)]",
                )}
            >
                <button
                    type="button"
                    data-slot="calendar-h5-confirm"
                    data-disabled={disabled ? "true" : undefined}
                    disabled={disabled}
                    onClick={onConfirm}
                    className={cn(
                        "w-full cursor-pointer border-0",
                        "h-[var(--bv-calendar-h5-confirm-height)]",
                        "rounded-[var(--bv-calendar-h5-confirm-radius)]",
                        "text-[length:var(--bv-calendar-h5-confirm-font)]",
                        disabled
                            ? "bg-bv-primary text-bv-white opacity-50"
                            : "bg-bv-primary text-bv-white",
                    )}
                >
                    {disabled && confirmDisabledText !== undefined
                        ? confirmDisabledText
                        : confirmText}
                </button>
            </div>
        </div>
    );
}
