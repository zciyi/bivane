/**
 * Rate 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Rate } from '@/components/responsive/rate';
/** Rate 的第 1 个示例 */
export function RateExample1() {
    const [value, setValue] = React.useState(3);
    return (
        <Block>
                        <Row>
                            <Rate
                                value={value}
                                onChange={(v) => setValue(v)}
                                ariaLabel="基础评分"
                            />
                            <span className="text-bv-text-2">当前：{value}</span>
                            <Rate defaultValue={2} ariaLabel="默认 2" />
                            <Rate defaultValue={3} count={3} ariaLabel="三星" />
                            <Rate defaultValue={2.5} allowHalf ariaLabel="半星" />
                            <div><span className="text-bv-text-2">只读</span>
                            <Rate defaultValue={3} readonly ariaLabel="只读" /></div>
                            <Rate defaultValue={2} disabled ariaLabel="禁用" />
                            <Rate defaultValue={3} clearable ariaLabel="可清零" />
                            <Rate
                                defaultValue={2}
                                color="#ffd21e"
                                voidColor="#ee0a24"
                                ariaLabel="自定义色"
                            />
                        </Row>
                    </Block>
    );
}
export function RateDemos() {
    return (
            <Section title="P3 · Rate 评分（模式 C：H5 滑动连续选 / PC 点击+hover 预览+键盘）">
                <RateExample1 />
            </Section>
        );
}