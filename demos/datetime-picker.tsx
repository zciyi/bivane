/**
 * DateTimePicker 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { DateTimePicker } from '@/components/responsive/datetime-picker';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** DateTimePicker 的第 1 个示例 */
export function DateTimePickerExample1() {
    const [rangeStart, setRangeStart] = React.useState<string | undefined>();
    const [rangeEnd, setRangeEnd] = React.useState<string | undefined>();
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <DateTimePicker
                                                ariaLabel="年月日时"
                                                title="选择年月日时"
                                                placeholder="年-月-日 时"
                                                columnsType={[
                                                    "year",
                                                    "month",
                                                    "day",
                                                    "hour",
                                                ]}
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            年月日时 · 4 列滚轮 · 回填 YYYY-MM-DD HH
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[240px]">
                                            <DateTimePicker
                                                ariaLabel="年月日时分"
                                                title="选择年月日时分"
                                                placeholder="年-月-日 时:分"
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
                                        <span className="text-bv-sm text-bv-text-2">
                                            年月日时分 · 5 列 · YYYY-MM-DD HH:mm
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[260px]">
                                            <DateTimePicker
                                                ariaLabel="年月日时分秒"
                                                title="选择年月日时分秒"
                                                placeholder="年-月-日 时:分:秒"
                                                min="2026-01-01 00:00:00"
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            默认 6 列 · 精确到秒 · min 约束
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <DateTimePicker
                                                ariaLabel="禁用日期时间"
                                                placeholder="请选择日期时间"
                                                disabled
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            禁用态
                                        </span>
                                    </div>
                                </Row>
                                <Row>
                                    <div className="flex flex-wrap items-center gap-bv-sm">
                                        <div className="w-[260px]">
                                            <DateTimePicker
                                                ariaLabel="区间开始时间"
                                                title="选择开始时间"
                                                placeholder="开始时间"
                                                value={rangeStart}
                                                max={rangeEnd}
                                                onChange={setRangeStart}
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            至
                                        </span>
                                        <div className="w-[260px]">
                                            <DateTimePicker
                                                ariaLabel="区间结束时间"
                                                title="选择结束时间"
                                                placeholder="结束时间"
                                                value={rangeEnd}
                                                min={rangeStart}
                                                onChange={setRangeEnd}
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            区间 · 两个单值实例互相约束（开始
                                            max=结束，结束 min=开始，两端自动有序）
                                        </span>
                                    </div>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "底部弹层，4/5/6 列滚轮（年/月/日/时/分/秒）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」，列再多也是通栏均宽"
                                        : "锚定浮层：左侧月历（« < 年月 > » 翻年翻月 + 6×7 网格，今天描边）选日期，右侧时/分/秒 1~3 条居中滚轮列（选中行在正中、上下发丝线），列顶/列尾有 ▲▼，点一下 ±1、按住连发；顶部回显草稿时间，底部「此刻 / 确定」。键盘在月历区 ←→ 走天、↑↓ 走周、PgUp/PgDn 走月，点时间列后 ↑↓ 改值、←→ 换列，Enter 确定、Esc 关闭"}
                                </p>
                                <p className="text-bv-sm text-bv-text-2">
                                    单值组件（对齐 Vant DatetimePicker）：值恒为
                                    'YYYY-MM-DD HH[:mm[:ss]]' 字符串，避开 Date
                                    时区问题； min/max 是完整时刻边界（min 当天的时列从
                                    min
                                    时刻起，逐字段级联夹紧，不会一下跳回整个边界时刻）；
                                    无值草稿播种「此刻」而不是元旦午夜。日期段两端范式不同
                                    （H5 滚轮 / PC
                                    月历），时间段共用同一滚轮列，归属模式 C。
                                </p>
                            </Block>
    );
}
export function DateTimePickerDemos() {
    return (
    <Section title="P2 · DateTimePicker 日期时间选择（年月日时 / 时分 / 时分秒）">
                        <DateTimePickerExample1 />
                    </Section>
        );
}