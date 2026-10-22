/**
 * NavBar 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { NavBar } from '@/components/responsive/nav-bar';
/** NavBar 的第 1 个示例 */
export function NavBarExample1() {
    const [log, setLog] = React.useState("（无）");
    return (
        <Block>
                        <Row>
                            <div className="w-full max-w-[360px]">
                                <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                    H5：左箭头 + 居中标题 + 右侧动作
                                </p>
                                <NavBar
                                    forceMode="mobile"
                                    fixed={false}
                                    title="订单详情"
                                    leftArrow
                                    onClickLeft={() => setLog("H5 · 返回")}
                                    rightText="帮助"
                                    onClickRight={() => setLog("H5 · 帮助")}
                                />
                            </div>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                    PC：左对齐标题 + 右对齐操作区
                                </p>
                                <NavBar
                                    forceMode="desktop"
                                    fixed={false}
                                    title="订单详情"
                                    leftArrow
                                    onClickLeft={() => setLog("PC · 返回")}
                                    rightText="帮助"
                                    onClickRight={() => setLog("PC · 帮助")}
                                />
                            </div>
                        </Row>
                        <Row>
                            <span className="text-bv-text-2">最近操作：{log}</span>
                        </Row>
                    </Block>
    );
}
export function NavBarDemos() {
    return (
            <Section title="P3 · NavBar 导航栏（模式 B：H5 返回箭头+标题居中 / PC 标题左对齐+操作区右对齐）">
                <NavBarExample1 />
            </Section>
        );
}