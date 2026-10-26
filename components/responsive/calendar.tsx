import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Calendar = lazyWithRef(() => import("@/components/h5/calendar").then((m) => ({ default: m.H5Calendar })));
const PcCalendar = lazyWithRef(() => import("@/components/pc/calendar").then((m) => ({ default: m.PcCalendar })));
import type {
    CalendarFormatter,
    CalendarOverRangePayload,
    CalendarPanelProps,
} from "@/components/ui/calendar-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
    DEFAULT_FIRST_DAY_OF_WEEK,
    toCalendarValue,
    useCalendarValue,
    type CalendarType,
    type CalendarValue,
} from "@/hooks/use-calendar-state";

/**
 * Bivane Calendar · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 全屏弹层 + min→max 月份纵向连续滚动（懒挂载）+ 触摸拖选；
 * │        single 点一天即关，range / multiple 在底部确定条暂存确认
 * └ PC ── 内嵌常驻月历（range 并排双月）+ 鼠标拖选 + 键盘巡航，点选即生效
 *
 * 状态归属（架构 §6.5）：
 *   - `selected` / H5 弹层 `draft` / `open` 跨模式同义或属于值语义 → 本层；
 *   - H5 的滚动位置/当前月副标题、PC 的视图月/键盘光标/区间起点锚点 → 实现层。
 *
 * H5 草稿在「打开」那一刻用已提交值播种，取消（遮罩/关闭/ESC）整体丢弃；
 * 确定才提交。PC 没有暂存语义（桌面无确认条），每次选定直接 onChange。
 */

export interface CalendarProps {
    /** 选择类型：单值 / 多选 / 区间，默认 single */
    type?: CalendarType;
    /**
     * 受控值（'YYYY-MM-DD'）：
     * single 为字符串；range 为有序 [start, end]；multiple 为升序字符串数组。
     */
    value?: CalendarValue;
    /** 非受控初始值 */
    defaultValue?: CalendarValue;
    /** 值变化回调：H5 在确定/点选关闭时、PC 在每次选定时 */
    onChange?: (value: CalendarValue) => void;
    /** 与 onChange 同值，两端最终选定都会触发（便于统一接埋点） */
    onConfirm?: (value: CalendarValue) => void;
    /** 可选下界（含），默认今天 */
    min?: string;
    /** 可选上界（含），默认 6 个月后的月末 */
    max?: string;
    /** 星期表头起始：0=周日 … 6=周六，默认 0（对齐 Vant） */
    firstDayOfWeek?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /** 单日装饰/禁用（节日、周末禁选等）；两端结果一致 */
    formatter?: CalendarFormatter;
    /** 区间最多跨多少天（含端点）；不传不限制 */
    maxRange?: number;
    /** 区间是否允许起止同日，默认 false */
    allowSameDay?: boolean;
    /** 今天是否标「今天」，默认 true（formatter 可覆盖） */
    showMark?: boolean;
    /** H5 弹层标题；PC 不渲染组件标题 */
    title?: React.ReactNode;
    /** 是否渲染标题区（H5），默认 true */
    showTitle?: boolean;
    /** 确定按钮文案，默认「确定」 */
    confirmText?: React.ReactNode;
    /** 区间未选满时确定按钮的禁用文案 */
    confirmDisabledText?: React.ReactNode;
    /** 自定义底部区（H5 渲染在确定条上方） */
    footer?: React.ReactNode;
    /** 只读：不可选、H5 不显示确定条 */
    readonly?: boolean;
    /**
     * H5 是否以全屏弹层呈现，默认 true；false 时 H5 也内嵌常驻。
     * PC 恒为内嵌，此 prop 不影响 PC。
     */
    poppable?: boolean;
    /** 弹层开合（受控，仅 H5 poppable 形态消费） */
    open?: boolean;
    /** 非受控初始开合（仅 H5 poppable 形态） */
    defaultOpen?: boolean;
    /** 开合变化（仅 H5 poppable 形态） */
    onOpenChange?: (open: boolean) => void;
    /** 轻点（非拖选）超出 maxRange 时触发 */
    onOverRange?: (payload: CalendarOverRangePayload) => void;
    /** 无障碍名称；没有可见标题时应当传入 */
    ariaLabel?: string;
    /** 根元素 id */
    id?: string;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
    function Calendar(
        {
            type = "single",
            value,
            defaultValue,
            onChange,
            onConfirm,
            min,
            max,
            firstDayOfWeek = DEFAULT_FIRST_DAY_OF_WEEK,
            formatter,
            maxRange,
            allowSameDay = false,
            showMark = true,
            title = "日期选择",
            showTitle = true,
            confirmText = "确定",
            confirmDisabledText = "请选择结束时间",
            footer,
            readonly = false,
            poppable = true,
            open: openProp,
            defaultOpen = false,
            onOpenChange,
            onOverRange,
            ariaLabel,
            id,
            className,
            forceMode,
        },
        ref,
    ) {
        const mode = useDeviceMode(forceMode);
        const isMobile = mode === "mobile";
        // poppable 仅 H5 有意义：PC 恒内嵌（矩阵定死的形态差异）
        const effectivePoppable = isMobile ? poppable : false;

        const { selected, minParts, maxParts, setValue } = useCalendarValue({
            value,
            defaultValue,
            onChange,
            type,
            min,
            max,
        });

        /* ---------- 开合（受控/非受控） ---------- */

        const isOpenControlled = openProp !== undefined;
        const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
        const open = isOpenControlled ? openProp : innerOpen;

        const setOpen = React.useCallback(
            (next: boolean) => {
                if (!isOpenControlled) setInnerOpen(next);
                onOpenChange?.(next);
            },
            [isOpenControlled, onOpenChange],
        );

        /* ---------- H5 弹层草稿 ---------- */

        const [draft, setDraft] = React.useState<string[]>(selected);

        // 打开时用已提交值播种；关闭时不清空（退出动画期间面板仍在渲染，
        // 清空会让网格瞬间跳变），下次打开无条件重新播种，半截草稿不复活。
        React.useEffect(() => {
            if (open) setDraft(selected);
            // selected 故意不进依赖：弹层开着时外部值变化不应重置用户正在选的草稿
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [open]);

        const handleSubmit = React.useCallback(
            (next: string[]) => {
                const nextValue = toCalendarValue(next, type);
                setValue(nextValue);
                onConfirm?.(nextValue);
                if (effectivePoppable) setOpen(false);
            },
            [type, setValue, onConfirm, effectivePoppable, setOpen],
        );

        const panelProps: CalendarPanelProps = {
            mode,
            type,
            selected,
            // PC 不消费草稿（点选即提交）；恒传 selected 即可，保持两份实现同一契约
            draft: isMobile ? draft : selected,
            onDraftChange: setDraft,
            onSubmit: handleSubmit,
            onCancel: () => setOpen(false),
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
            poppable: effectivePoppable,
            open,
            onOpenChange: setOpen,
            onOverRange,
            ariaLabel,
            id,
            className,
        };

        return (
            <React.Suspense fallback={null}>
                {isMobile ? (
                    <H5Calendar ref={ref} {...panelProps} />
                ) : (
                    <PcCalendar ref={ref} {...panelProps} />
                )}
            </React.Suspense>
        );
    },
);

export type {
    CalendarType,
    CalendarValue,
    CalendarRangeValue,
} from "@/hooks/use-calendar-state";

export type {
    CalendarFormatter,
    CalendarFormatterResult,
    CalendarOverRangePayload,
} from "@/components/ui/calendar-parts";
