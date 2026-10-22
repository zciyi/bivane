/**
 * Loading 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { hideLoading, showLoading, updateLoading } from '@/components/responsive/loading';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Loading 的第 1 个示例 */
export function LoadingExample1() {
    const [, setLoadingOpen] = React.useState(false);
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            const handle = showLoading({
                                                text: "加载中",
                                                forbidClick: true,
                                            });
                                            setTimeout(
                                                () => hideLoading(handle.id),
                                                1500,
                                            );
                                        }}
                                    >
                                        命令式 · 1.5s 后关闭
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const handle = showLoading({
                                                text: "步骤 1/3",
                                            });
                                            setTimeout(
                                                () =>
                                                    updateLoading(handle.id, {
                                                        text: "步骤 2/3",
                                                    }),
                                                700,
                                            );
                                            setTimeout(
                                                () =>
                                                    updateLoading(handle.id, {
                                                        text: "步骤 3/3",
                                                    }),
                                                1400,
                                            );
                                            setTimeout(
                                                () => hideLoading(handle.id),
                                                2100,
                                            );
                                        }}
                                    >
                                        动态改文案
                                    </Button>
                                    <Button
                                        onClick={() => showLoading({ duration: 1200 })}
                                    >
                                        无文案 · 1.2s 自关
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setLoadingOpen(true);
                                            setTimeout(
                                                () => setLoadingOpen(false),
                                                2000,
                                            );
                                        }}
                                    >
                                        声明式 · 2s 后自关
                                    </Button>
                                    <Button type="danger" onClick={() => hideLoading()}>
                                        关闭全部
                                    </Button>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    两端都是全屏遮罩 + 居中转圈，差异只有遮罩浓度（H5 .7
                                    / PC .45，由 bg-bv-overlay 的模式覆盖给出）。
                                    默认常驻，必须显式 hideLoading(id) 或给 duration；
                                    forbidClick 默认 false（对齐 Vant，不阻断下层），传
                                    true 才吃事件。
                                </p>
                            </Block>
    );
}
export function LoadingDemos() {
    return (
    <Section title="P1′ · Loading 加载（模式 A：两端同形态，仅遮罩浓度不同）">
                        <LoadingExample1 />
                    </Section>
        );
}