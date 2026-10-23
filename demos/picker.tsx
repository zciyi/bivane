/**
 * Picker 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Picker } from '@/components/responsive/picker';
import { useDeviceMode } from '@/hooks/use-device-mode';
const PICKER_COLUMNS = [
    [
        { label: "奔驰", value: "benz" },
        { label: "宝马", value: "bmw" },
        { label: "奥迪（暂无车源）", value: "audi", disabled: true },
    ],
    ["2024 款", "2025 款", "2026 款"],
];
/** Picker 的第 1 个示例 */
export function PickerExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[240px]">
                                            <Picker
                                                ariaLabel="品牌年款"
                                                title="选择品牌年款"
                                                columns={PICKER_COLUMNS}
                                                defaultValue={["bmw", "2025 款"]}
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            两列独立 · 含禁用项 · 可清除
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <Picker
                                                ariaLabel="姓氏"
                                                title="选择称呼"
                                                columns={[["先生", "女士"]]}
                                                placeholder="选择称呼"
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            单列 · 字面量数组
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <Picker
                                                ariaLabel="禁用选择"
                                                columns={PICKER_COLUMNS}
                                                placeholder="请选择"
                                                disabled
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            禁用态
                                        </span>
                                    </div>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点开是底部弹层，N 列滚轮横排（5 行制、各自惯性吸附），顶部「取消 · 标题 · 确定」；滚某列只改这一列的草稿，互不影响，点「确定」才提交"
                                        : "点开是锚定浮层，N 列纵向面板并排（每列定宽、各自滚动，36px 桌面行高），底部固定「取消 / 确定」条；点行只改草稿，确定才生效（多列要全部调好才算选完）；键盘 ←→ 换列、↑↓ 列内巡航（跳过禁用、不回绕）、Home/End 首尾、Enter 先选中再按一次提交、Esc 取消"}
                                </p>
                                <p className="text-bv-sm text-bv-text-2">
                                    注：Picker 只表达「列与列互不影响」的多维度单选 （值
                                    = 每列一个值的数组）。列之间有父子联动（省市区）
                                    请用下一个 Cascader —— Vant 把两者塞进同一个
                                    Picker， Bivane 按交互范式拆开，共享同一套滚轮地基。
                                </p>
                            </Block>
    );
}
export function PickerDemos() {
    return (
    <Section title="P2 · Picker 通用多列选择（模式 C：滚轮 vs 多列面板）">
                        <PickerExample1 />
                    </Section>
        );
}