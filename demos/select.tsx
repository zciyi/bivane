/**
 * Select 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Select } from '@/components/responsive/select';
import type { SelectItem } from '@/hooks/use-select-state';
import { showToast } from '@/components/responsive/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
const CITY_OPTIONS: SelectItem[] = [
    { label: "北京", value: "bj" },
    { label: "上海", value: "sh" },
    { label: "广州", value: "gz" },
    { label: "深圳", value: "sz" },
    { label: "杭州", value: "hz" },
    { label: "成都", value: "cd", disabled: true },
    { label: "武汉", value: "wh" },
    { label: "西安", value: "xa" },
    { label: "南京", value: "nj" },
    { label: "重庆", value: "cq" },
    { label: "长沙", value: "cs" },
    { label: "青岛", value: "qd" },
];
const GROUPED_CITY_OPTIONS: SelectItem[] = [
    {
        group: "华北",
        options: [
            { label: "北京", value: "bj" },
            { label: "天津", value: "tj" },
        ],
    },
    {
        group: "华东",
        options: [
            { label: "上海", value: "sh" },
            { label: "杭州", value: "hz" },
        ],
    },
];
/** Select 的第 1 个示例 */
export function SelectExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <Select
                                                ariaLabel="城市"
                                                placeholder="请选择城市"
                                                options={CITY_OPTIONS}
                                                onChange={(value) =>
                                                    showToast(`选中 ${String(value)}`)
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            单选 · 点选即生效
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <Select
                                                ariaLabel="多选城市"
                                                placeholder="请选择城市"
                                                multiple
                                                clearable
                                                options={CITY_OPTIONS}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            多选 · 可清除
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <Select
                                                ariaLabel="搜索城市"
                                                placeholder="请选择城市"
                                                searchable
                                                clearable
                                                options={CITY_OPTIONS}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            输入过滤（H5 需选项 &gt; 10 才出搜索框）
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <Select
                                                ariaLabel="禁用选择器"
                                                placeholder="请选择城市"
                                                disabled
                                                options={CITY_OPTIONS}
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            禁用态
                                        </span>
                                    </div>
                                </Row>
                                <div className="flex items-center gap-bv-sm">
                                    <div className="w-[240px]">
                                        <Select
                                            ariaLabel="分组城市"
                                            placeholder="请选择城市"
                                            searchable
                                            options={GROUPED_CITY_OPTIONS}
                                        />
                                    </div>
                                    <span className="text-bv-sm text-bv-text-2">
                                        分组 + 过滤
                                    </span>
                                </div>
                                <div className="flex items-center gap-bv-sm">
                                    <div className="w-[240px]">
                                        <Select
                                            ariaLabel="暂存确认城市"
                                            title="选择城市"
                                            placeholder="请选择城市"
                                            confirmable
                                            options={CITY_OPTIONS}
                                            onChange={(value) =>
                                                showToast(`确定：${String(value)}`)
                                            }
                                        />
                                    </div>
                                    <span className="text-bv-sm text-bv-text-2">
                                        H5 暂存确认：面板带「取消 · 标题 ·
                                        确定」，点选项只打勾，点确定才回填
                                    </span>
                                </div>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点开是底部弹层列表（项高 48px、可按住顶部指示条下拉关闭），选项 > 10 才出现搜索框；默认点选即关，传 confirmable 走「暂存 → 确定」"
                                        : "点开是锚定在触发器下方的浮层，↑↓ 巡航（自动跳过禁用项）、Enter 选中、Home/End 首尾、Esc 关闭、输入即过滤，多选保持展开；PC 恒为点选即生效，没有确定这一步"}
                                </p>
                                <p className="text-bv-sm text-bv-text-2">
                                    注：同一个 searchable prop，H5 在选项 ≤ 10
                                    时不渲染搜索框（触屏主路径是点选），PC 只要
                                    searchable 就给（桌面端输入过滤是主路径）；行高 48px
                                    vs 36px 同理。这是矩阵对两种交互的定义差异，不是
                                    props 泄露 ——
                                    值语义（单选取代、多选翻转、多选不关闭）两端完全一致；「取消
                                    / 确定」工具栏只出现在 H5（触屏误点有退路），PC
                                    不需要。
                                </p>
                            </Block>
    );
}
export function SelectDemos() {
    return (
    <Section title="P2 · Select 选择器（模式 C：两套交互范式，不是换壳）">
                        <SelectExample1 />
                    </Section>
        );
}