/**
 * Tabs 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Tab, Tabs } from '@/components/responsive/tabs';
/** Tabs 的第 1 个示例 */
export function TabsExample1() {
    const [active, setActive] = React.useState(0);
    const [cardActive, setCardActive] = React.useState(1);
    const tabs = (
        <>
            <Tab title="标签一">内容一</Tab>
            <Tab title="标签二">内容二</Tab>
            <Tab title="标签三">内容三</Tab>
            <Tab title="很长的标签标题四">内容四</Tab>
        </>
    );
    return (
        <Block>
                        <Row>
                            <div className="w-full max-w-[360px]">
                                <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                    H5（forceMode=mobile）：标签超出可横滑，激活项滚入视野，内容区可手势横滑
                                </p>
                                <Tabs value={active} onChange={setActive} swipeable forceMode="mobile">
                                    {tabs}
                                </Tabs>
                            </div>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                    PC（forceMode=desktop）：←/→ 切换，激活项下有下划线指示器
                                </p>
                                <Tabs value={active} onChange={setActive} forceMode="desktop">
                                    {tabs}
                                </Tabs>
                            </div>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                    type=&quot;card&quot;：卡片形态（无下划线指示器）
                                </p>
                                <Tabs type="card" value={cardActive} onChange={setCardActive}>
                                    <Tab title="日">周日</Tab>
                                    <Tab title="周">周一</Tab>
                                    <Tab title="月">本月</Tab>
                                </Tabs>
                            </div>
                        </Row>
                        <Row>
                            <span className="text-bv-text-2">
                                当前激活：第 {active + 1} 项（两端共用同一个 value）
                            </span>
                        </Row>
                    </Block>
    );
}
export function TabsDemos() {
    return (
            <Section title="P3 · Tabs 标签页（模式 B：H5 标签条可横滑+手势 / PC 不滑动+键盘+下划线）">
                <TabsExample1 />
            </Section>
        );
}