/**
 * DatePicker 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { DatePicker } from '@/components/responsive/date-picker';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** DatePicker 的第 1 个示例 */
export function DatePickerExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <DatePicker
                                                ariaLabel="日期"
                                                title="选择日期"
                                                placeholder="请选择日期"
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            单值 · 可输入（仅 PC）
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <DatePicker
                                                ariaLabel="日期区间"
                                                title="选择日期区间"
                                                placeholder="请选择区间"
                                                type="range"
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            区间 · 可清除
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <DatePicker
                                                ariaLabel="年月"
                                                title="选择年月"
                                                placeholder="请选择年月"
                                                columnsType={["year", "month"]}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            年月面板 · 回填 YYYY-MM
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[160px]">
                                            <DatePicker
                                                ariaLabel="年份"
                                                title="选择年份"
                                                placeholder="请选择年份"
                                                columnsType={["year"]}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            年份面板 · 回填 YYYY
                                        </span>
                                    </div>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点开是底部弹层，三列滚轮（年/月/日）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」；区间模式在工具条下方多一条「开始日期 / 结束日期」切换，滚轮改的是当前那一端，两端都选上「确定」才可用"
                                        : "点开是锚定触发器下方的选择浮层；年月配置显示双年月份面板，完整日期显示月历；↑↓←→ 巡航、Enter 选中、Esc 关闭；输入框与 onChange 都按 columnsType 回填 YYYY / YYYY-MM / YYYY-MM-DD 等对应格式；区间模式第一下点起点、第二下点终点"}
                                </p>
                                <p className="text-bv-sm text-bv-text-2">
                                    注：两端共享的是同一份日期值逻辑（use-date-value
                                    的解析/格式化/min-max
                                    逐字段夹紧/区间排序），不共享「怎么选」——
                                    滚轮是「连续滚动 + 吸附」，月历是「二维网格 +
                                    焦点巡航」，共同点只有「都是日期」，这正是它归属模式
                                    C 而不是 B 的理由。值恒为 'YYYY-MM-DD'
                                    字符串（区间是有序元组），与 Vant 一致、也避开 Date
                                    的时区问题；默认可选范围是今天前后各 10
                                    年，外部传进来的值若在范围外会自动把范围放大到包含它，
                                    而不是把已选值夹走。
                                </p>
                            </Block>
    );
}
export function DatePickerDemos() {
    return (
    <Section title="P2 · DatePicker 日期选择（模式 C：滚轮 vs 月历）">
                        <DatePickerExample1 />
                    </Section>
        );
}