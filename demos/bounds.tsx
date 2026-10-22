/**
 * Bounds 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { DatePicker } from '@/components/responsive/date-picker';
import { TimePicker } from '@/components/responsive/time-picker';
import { DateTimePicker } from '@/components/responsive/datetime-picker';
/** Bounds 的第 1 个示例 */
export function BoundsExample1() {
    const [demoDate, setDemoDate] = React.useState<string | undefined>();
    const [demoTime, setDemoTime] = React.useState<string | undefined>();
    const [demoDateTime, setDemoDateTime] = React.useState<
        string | undefined
    >();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <p className="text-bv-sm text-bv-text-2">
                                    闭区间（含端点）。滚轮列按边界「逐字段级联收窄」：只有压在边界的那一级才裁剪；
                                    PC
                                    月历禁用越界日；越界输入/选中会被夹回范围内。拖动窗口跨过
                                    768px 可对比 H5 滚轮 / PC 月历两种拦截形态。
                                </p>
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[240px]">
                                            <DatePicker
                                                ariaLabel="日期 min/max"
                                                title="日期范围约束"
                                                placeholder="09-20 ~ 10-05"
                                                min="2026-09-20"
                                                max="2026-10-05"
                                                value={demoDate}
                                                onChange={(value) =>
                                                    setDemoDate(
                                                        typeof value === "string"
                                                            ? value
                                                            : undefined,
                                                    )
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            选中：{demoDate ?? "未选"}
                                        </span>
                                    </div>
                                </Row>
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[240px]">
                                            <TimePicker
                                                ariaLabel="时间 min/max"
                                                title="时间范围约束"
                                                placeholder="09:30 ~ 18:00"
                                                min="09:30:00"
                                                max="18:00:00"
                                                value={demoTime}
                                                onChange={(value) =>
                                                    setDemoTime(
                                                        typeof value === "string"
                                                            ? value
                                                            : undefined,
                                                    )
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            小时列从 9 起、仅 9 点时分钟从 30 起；选中：
                                            {demoTime ?? "未选"}
                                        </span>
                                    </div>
                                </Row>
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[280px]">
                                            <DateTimePicker
                                                ariaLabel="日期时间 min/max"
                                                title="日期时间范围约束"
                                                placeholder="09-24 09:00 ~ 17:30"
                                                min="2026-09-24 09:00:00"
                                                max="2026-09-24 17:30:00"
                                                value={demoDateTime}
                                                onChange={(value) =>
                                                    setDemoDateTime(
                                                        typeof value === "string"
                                                            ? value
                                                            : undefined,
                                                    )
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            锁在 09-24 当天、时间窗 09:00~17:30；选中：
                                            {demoDateTime ?? "未选"}
                                        </span>
                                    </div>
                                </Row>
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[300px]">
                                            <DateTimePicker
                                                ariaLabel="min 带时间截断"
                                                title="min 带时间 → 跨天截断"
                                                placeholder="09-24 14:00 起 ~ 09-25 09:00"
                                                min="2026-09-24 14:00:00"
                                                max="2026-09-25 09:00:00"
                                                columnsType={[
                                                    "year",
                                                    "month",
                                                    "day",
                                                    "hour",
                                                    "minute",
                                                ]}
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            24 号时列从 14 起、25 号时列到 09
                                            止（逐字段级联）
                                        </span>
                                    </div>
                                </Row>
                            </Block>
    );
}
export function BoundsDemos() {
    return (
    <Section title="P2 · min/max 边界约束（Date / Time / DateTime）">
                        <BoundsExample1 />
                    </Section>
        );
}