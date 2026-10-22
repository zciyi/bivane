/**
 * InputNumber 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { InputNumber } from '@/components/responsive/input-number';
/** InputNumber 的第 1 个示例 */
export function InputNumberExample1() {
    const [value, setValue] = React.useState<number | null>(1);
    return (
        <Block>
                        <Row>
                            <InputNumber
                                value={value}
                                min={0}
                                max={10}
                                onChange={(v) => setValue(v)}
                                aria-label="基础步进器"
                            />
                            <span className="text-bv-text-2">当前：{String(value)}</span>
                            <InputNumber
                                defaultValue={1}
                                min={1}
                                max={5}
                                integer
                                aria-label="整数"
                            />
                            <InputNumber
                                defaultValue={1}
                                min={1}
                                max={5}
                                disabled
                                aria-label="禁用"
                            />
                            <InputNumber
                                defaultValue={3}
                                min={0}
                                max={5}
                                disableInput
                                aria-label="禁输入"
                            />
                            <InputNumber
                                defaultValue={1}
                                min={0}
                                max={5}
                                step={0.5}
                                decimalLength={2}
                                aria-label="小数步长"
                            />
                            <InputNumber
                                defaultValue={1}
                                min={0}
                                max={5}
                                allowEmpty
                                aria-label="可清空"
                            />
                            <InputNumber
                                defaultValue={1}
                                min={0}
                                max={5}
                                theme="round"
                                aria-label="圆角主题"
                            />
                            <InputNumber
                                defaultValue={1}
                                min={1}
                                max={5}
                                beforeChange={() => false}
                                aria-label="禁止变更"
                            />
                        </Row>
                    </Block>
    );
}
export function InputNumberDemos() {
    return (
            <Section title="P3 · InputNumber 数量步进器（模式 B：H5 横排 ± / PC 竖排 ▲▼）">
                <InputNumberExample1 />
            </Section>
        );
}