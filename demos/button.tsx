/**
 * Button 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
/** Button 的第 1 个示例 */
export function ButtonExample1() {
    const [loading, setLoading] = React.useState(false);
    return (
        <Block>
                                    <Row>
                                        <Button>默认</Button>
                                        <Button type="primary">主要</Button>
                                        <Button type="success">成功</Button>
                                        <Button type="danger">危险</Button>
                                        <Button type="warning">警告</Button>
                                        <Button type="primary" plain>
                                            朴素
                                        </Button>
                                        <Button type="primary" hairline>
                                            细边框
                                        </Button>
                                        <Button round type="primary">
                                            圆角
                                        </Button>
                                        <Button square type="primary">
                                            直角
                                        </Button>
                                        <Button disabled>禁用</Button>
                                        <Button
                                            type="primary"
                                            loading={loading}
                                            loadingText="处理中"
                                            onClick={() => {
                                                setLoading(true);
                                                setTimeout(() => setLoading(false), 1500);
                                            }}
                                        >
                                            点击加载
                                        </Button>
                                    </Row>
                                </Block>
    );
}
/** Button 的第 2 个示例 */
export function ButtonExample2() {
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                    <Row>
                                        <Button size="normal" type="primary">
                                            normal（默认）
                                        </Button>
                                        <Button size="small" type="primary">
                                            small
                                        </Button>
                                        <Button size="mini" type="primary">
                                            mini
                                        </Button>
                                        <Button
                                            size="normal"
                                            icon={<Icon name="success" />}
                                            type="success"
                                        >
                                            带图标
                                        </Button>
                                    </Row>
                                    <Button size="large" type="primary">
                                        large（宽度 100%）
                                    </Button>
                                    <Button
                                        block
                                        type="success"
                                        icon={<Icon name="success" />}
                                    >
                                        block + 图标
                                    </Button>
                                </Block>
    );
}
export function ButtonDemos() {
    return (
    <>
        <Section title="Button 按钮类型">
                            <ButtonExample1 />
                        </Section>
        <Section title="Button 尺寸">
                            <ButtonExample2 />
                        </Section>
    </>
        );
}