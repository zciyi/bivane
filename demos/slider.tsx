/**
 * Slider 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Slider } from '@/components/responsive/slider';
/** Slider 的第 1 个示例 */
export function SliderExample1() {
    const [value, setValue] = React.useState(40);
    return (
        <Block>
                        <Row>
                            <div className="w-[240px]">
                                <Slider
                                    value={value}
                                    onChange={(v) => setValue(v as number)}
                                    ariaLabel="基础滑块"
                                />
                            </div>
                            <span className="text-bv-text-2">当前：{value}</span>
                        </Row>
                    </Block>
    );
}
/** Slider 的第 2 个示例 */
export function SliderExample2() {
    const [range, setRange] = React.useState<[number, number]>([20, 60]);
    return (
        <Block>
                        <Row>
                            <div className="w-[240px]">
                                <Slider
                                    range
                                    value={range}
                                    onChange={(v) =>
                                        setRange(v as [number, number])
                                    }
                                    ariaLabel="区间滑块"
                                />
                            </div>
                            <span className="text-bv-text-2">
                                当前：[{range.join(", ")}]
                            </span>
                        </Row>
                    </Block>
    );
}
/** Slider 的第 3 个示例 */
export function SliderExample3() {
    return (
        <Block>
                        <Row>
                            <div className="w-[240px]">
                                <Slider defaultValue={50} disabled ariaLabel="禁用" />
                            </div>
                            <div className="w-[240px]">
                                <Slider defaultValue={50} readonly ariaLabel="只读" />
                            </div>
                            <div className="w-[240px]">
                                <Slider defaultValue={30} reverse ariaLabel="反向" />
                            </div>
                        </Row>
                    </Block>
    );
}
/** Slider 的第 4 个示例 */
export function SliderExample4() {
    return (
        <Block>
                        <Row>
                            <div className="flex h-[180px] items-center">
                                <Slider
                                    defaultValue={40}
                                    vertical
                                    ariaLabel="竖直滑块"
                                />
                            </div>
                        </Row>
                    </Block>
    );
}
export function SliderDemos() {
    return (
            <Section title="P3 · Slider 滑块（模式 C：H5 触摸拖拽 / PC 点轨+拖拽+键盘）">
                <SliderExample1 />
                <SliderExample2 />
                <SliderExample3 />
                <SliderExample4 />
            </Section>
        );
}