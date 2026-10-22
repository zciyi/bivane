/**
 * Tabbar 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import type { TabbarItem } from "@/components/responsive/tabbar";
import { Block, Row, Section } from "./layout";
import { Tabbar } from '@/components/responsive/tabbar';
import { Icon } from '@/components/ui/icon';
const TABBAR_ITEMS: TabbarItem[] = [
    { value: "home", label: "首页", icon: <Icon name="home" /> },
    { value: "order", label: "订单", icon: <Icon name="order" />, badge: 3 },
    { value: "cart", label: "购物车", icon: <Icon name="cart" />, badge: true },
    { value: "me", label: "我的", icon: <Icon name="user" /> },
];
/** Tabbar 的第 1 个示例 */
export function TabbarExample1() {
    const [value, setValue] = React.useState("home");
    return (
        <Block>
                        <Row>
                            <div className="w-full max-w-[360px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    H5：底部条，图标在上文字在下（含角标与红点）。
                                    底栏自带顶部 hairline 分隔线，角标会探出这条线约 7px。
                                </p>
                                {/*
                                 * 不要给底栏再套一个带边框的白框：底栏自己已经画了顶部
                                 * hairline，再加框会出现两条线（其中一条还悬在框里），
                                 * 看着像「多了一条线」。这里用无边框白块，
                                 * hairline 就是块的顶边，角标探出去落在页面上（同真机底栏）。
                                 */}
                                <div className="bg-bv-surface">
                                    <Tabbar
                                        forceMode="mobile"
                                        fixed={false}
                                        items={TABBAR_ITEMS}
                                        value={value}
                                        onChange={setValue}
                                    />
                                </div>
                            </div>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    PC：侧边导航（默认 200px 宽），右侧竖线是导航自带的列分隔
                                </p>
                                <div className="flex bg-bv-surface">
                                    <Tabbar
                                        forceMode="desktop"
                                        fixed={false}
                                        items={TABBAR_ITEMS}
                                        value={value}
                                        onChange={setValue}
                                    />
                                    <div className="flex-1 p-bv-md text-bv-sm text-bv-text-2">
                                        内容区（侧边导航占左侧一列）
                                    </div>
                                </div>
                            </div>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    PC：顶部导航（pcVariant=&quot;top&quot;），下方的线是导航自带的分隔
                                </p>
                                <div className="bg-bv-surface">
                                    <Tabbar
                                        forceMode="desktop"
                                        pcVariant="top"
                                        fixed={false}
                                        items={TABBAR_ITEMS}
                                        value={value}
                                        onChange={setValue}
                                    />
                                    <div className="p-bv-md text-bv-sm text-bv-text-2">
                                        内容区（顶部导航的下分隔线把导航与内容隔开）
                                    </div>
                                </div>
                            </div>
                            <span className="text-bv-text-2">当前选中：{value}</span>
                        </Row>
                    </Block>
    );
}
export function TabbarDemos() {
    return (
            <Section title="P3 · Tabbar 标签栏（模式 C：H5 底部固定条 / PC 侧边或顶部导航）">
                <TabbarExample1 />
            </Section>
        );
}