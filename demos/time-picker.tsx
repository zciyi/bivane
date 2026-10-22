/**
 * TimePicker 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { TimePicker } from '@/components/responsive/time-picker';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** TimePicker 的第 1 个示例 */
export function TimePickerExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <TimePicker
                                                ariaLabel="时间"
                                                title="选择时间"
                                                placeholder="请选择时间"
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            单值 · 预填现在
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <TimePicker
                                                ariaLabel="时间区间"
                                                title="选择时间区间"
                                                placeholder="请选择区间"
                                                type="range"
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            区间 · 可清除
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[160px]">
                                            <TimePicker
                                                ariaLabel="时分"
                                                title="选择时分"
                                                placeholder="请选择时分"
                                                columnsType={["hour", "minute"]}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            时分面板 · 回填 HH:mm
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[160px]">
                                            <TimePicker
                                                ariaLabel="禁用时间"
                                                placeholder="请选择时间"
                                                disabled
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            禁用态
                                        </span>
                                    </div>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点开是底部弹层，三列拖拽滚轮（时/分/秒）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」；区间模式在工具条下方多一条「开始时间 / 结束时间」切换，滚轮改的是当前那一端，两端都选上「确定」才可用"
                                        : "点开是锚定触发器下方的浮层，壳里是同一套三列滚轮（同 5 行制、同吸附、同中央高亮带），底部「取消 / 确定」条；单值也要点「确定」才生效（滚轮要三列都调好才算选完）；键盘 ←→ 换列（点亮该列高亮带）、↑↓ 改值、Home/End 首尾、Enter 确定、Esc 关闭；区间用「开始时间 / 结束时间」两个 tab 手动切换在改哪一端，结束 ≤ 开始时「确定」禁用并提示"}
                                </p>
                                <p className="text-bv-sm text-bv-text-3">
                                    注：两端共享的是同一份时间值逻辑（use-time-value
                                    的解析/格式化/min-max
                                    逐字段夹紧/区间排序），也共享同一个滚轮行
                                    primitive（time-parts 的 TimeWheelRow）—— 同一个
                                    primitive 换个壳两端都成立，所以它归属模式 B 而不是
                                    C（与 DatePicker 同族）。 值恒为 'HH:mm:ss'
                                    字符串（区间是有序元组），避开 Date
                                    的时区问题；单值形态的草稿预填「现在」而不是
                                    '00:00:00'（时间选择器的主路径是未选，停在午夜每次都要滚回当前时刻）。
                                </p>
                            </Block>
    );
}
export function TimePickerDemos() {
    return (
    <Section title="P2 · TimePicker 时间选择（两端同一套滚轮，只换外壳）">
                        <TimePickerExample1 />
                    </Section>
        );
}