/**
 * Cascader 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Cascader } from '@/components/responsive/cascader';
import { useDeviceMode } from '@/hooks/use-device-mode';
const CASCADER_AREA = [
    {
        label: "浙江",
        value: "zj",
        children: [
            {
                label: "杭州",
                value: "hz",
                children: [
                    { label: "西湖区", value: "xh" },
                    { label: "拱墅区", value: "gs" },
                ],
            },
            {
                label: "宁波",
                value: "nb",
                children: [
                    { label: "海曙区", value: "hs" },
                    { label: "江北区", value: "jb" },
                ],
            },
        ],
    },
    {
        label: "江苏",
        value: "js",
        children: [
            {
                label: "南京",
                value: "nj",
                children: [
                    { label: "玄武区", value: "xw" },
                    { label: "鼓楼区", value: "gl" },
                ],
            },
        ],
    },
];
/** Cascader 的第 1 个示例 */
export function CascaderExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[260px]">
                                            <Cascader
                                                ariaLabel="省市区"
                                                title="选择地区"
                                                options={CASCADER_AREA}
                                                defaultValue={["zj", "hz", "xh"]}
                                                searchable
                                                clearable
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            三级联动 · 可搜索（PC）· 可清除
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <Cascader
                                                ariaLabel="地区（未选）"
                                                options={CASCADER_AREA}
                                                placeholder="请选择所在地区"
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-2">
                                            无默认值
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[220px]">
                                            <Cascader
                                                ariaLabel="禁用地区"
                                                options={CASCADER_AREA}
                                                placeholder="请选择所在地区"
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
                                        ? "点开是底部弹层里的联动滚轮（省 / 市 / 区，即 Vant Area 交互）：滚「省」，市/区两列整体重算并回到第一个可选项；顶部「取消 · 标题 · 确定」，改完确定才提交"
                                        : "点开是锚定浮层：顶部面包屑（请选择 / 省 / 市，可点回退），下方逐级向右展开的多列面板；点父级展开下一列，点叶子立即生效并关闭；打开即定位到已选路径。searchable 时顶部有搜索框，按「浙江 杭州 西湖」这样的完整路径匹配，点结果直接选中整条路径；键盘 ↑↓ 巡航、→/Enter 展开或选中、← 回上级、Esc 关闭"}
                                </p>
                                <p className="text-bv-sm text-bv-text-2">
                                    注：值恒为根 → 叶子的**完整路径值数组**（如
                                    ['zj','hz','xh']），半截/失效路径不回显；只有叶子可选。
                                    options 支持 fieldNames 改字段映射，可直接喂 Vant
                                    风格
                                    {"{"}text/value/children{"}"} 数据；不内置
                                    @vant/area-data， 避免为一个地区预设背上整包体积。
                                </p>
                            </Block>
    );
}
export function CascaderDemos() {
    return (
    <Section title="P2 · Cascader 级联选择（模式 C：H5 联动滚轮 / PC 面包屑多列面板）">
                        <CascaderExample1 />
                    </Section>
        );
}