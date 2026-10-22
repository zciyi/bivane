/**
 * Calendar 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Cell, CellGroup } from '@/components/ui/cell';
import { useDeviceMode } from '@/hooks/use-device-mode';
import { Calendar, type CalendarFormatter, type CalendarType, type CalendarValue } from '@/components/responsive/calendar';
import { showToast } from '@/components/responsive/toast';
function CalendarDemo({
    label,
    type,
    maxRange,
    formatter,
}: {
    label: string;
    type: CalendarType;
    maxRange?: number;
    formatter?: CalendarFormatter;
}) {
    const mode = useDeviceMode();
    const [value, setValue] = React.useState<CalendarValue | undefined>();
    // H5 的触发器在组件外部（Cell），开合必须受控；PC 不消费这两个 props
    const [open, setOpen] = React.useState(false);

    const summary = React.useMemo(() => {
        if (value === undefined) return "";
        if (typeof value === "string") return value;
        return type === "range"
            ? `${value[0]} ~ ${value[1]}`
            : value.join("、");
    }, [value, type]);

    return (
        <div>
            {mode === "mobile" ? (
                <Cell
                    title={label}
                    value={summary || "请选择"}
                    isLink
                    onClick={() => setOpen(true)}
                />
            ) : null}

            <Calendar
                type={type}
                title={label}
                maxRange={maxRange}
                formatter={formatter}
                value={value}
                onChange={setValue}
                open={open}
                onOpenChange={setOpen}
                onOverRange={
                    maxRange
                        ? () =>
                              showToast(`区间最多选择 ${maxRange} 天（含首尾）`)
                        : undefined
                }
            />

            {mode === "desktop" ? (
                <p className="mt-bv-xs text-bv-sm text-bv-text-3">
                    {summary || "尚未选择"}
                </p>
            ) : null}
        </div>
    );
}
const disableWeekendCalendarDay: CalendarFormatter = ({ parts }) => {
    const weekday = new Date(parts.year, parts.month - 1, parts.day).getDay();
    return weekday === 0 || weekday === 6 ? { disabled: true } : undefined;
};
const CALENDAR_DEMOS: Array<{
    label: string;
    type: CalendarType;
    maxRange?: number;
    formatter?: CalendarFormatter;
}> = [
    { label: "单个日期", type: "single" },
    { label: "日期区间（最多 7 天）", type: "range", maxRange: 7 },
    { label: "多个日期", type: "multiple" },
    {
        label: "周末不可选",
        type: "range",
        formatter: disableWeekendCalendarDay,
    },
];
/** Calendar 的第 1 个示例 */
export function CalendarExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                {mode === "mobile" ? (
                                    <CellGroup inset className="mx-0">
                                        {CALENDAR_DEMOS.map((demo) => (
                                            <CalendarDemo key={demo.label} {...demo} />
                                        ))}
                                    </CellGroup>
                                ) : (
                                    <Row className="items-start">
                                        {CALENDAR_DEMOS.map((demo) => (
                                            <CalendarDemo key={demo.label} {...demo} />
                                        ))}
                                    </Row>
                                )}
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点行打开全屏日历：min→max 的月份纵向连续排列、进入视口附近才挂载；区间可按住后跨日拖动（窗口超出 7 天上限会向前滑动），也可两次点选；半截区间时底部确定条禁用，single 点一天即完成"
                                        : "月历常驻内嵌（区间为并排双月）：鼠标按住跨日拖选或两次点选即生效，悬停有区间预览；键盘 ←→ 换日、↑↓ 换周、PgUp/PgDn 换月、Home/End 到周首尾、Enter 选定，自动跳过禁用日；轻点超出 7 天上限会 Toast 提示"}
                                </p>
                                <p className="text-bv-sm text-bv-text-3">
                                    注：值恒为 'YYYY-MM-DD'（single 字符串 / range
                                    有序二元组 / multiple 升序数组）；min/max 默认今天 ~
                                    6 个月后月末；formatter
                                    可给任意日期加标注或禁用，两端表现一致。
                                </p>
                            </Block>
    );
}
export function CalendarDemos() {
    return (
    <Section title="P2 · Calendar 日历（模式 C：H5 全屏弹层拖选 / PC 内嵌月历）">
                        <CalendarExample1 />
                    </Section>
        );
}