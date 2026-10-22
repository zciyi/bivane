/**
 * Radio 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { isChoiceTarget } from './choice';
import { Cell, CellGroup } from '@/components/ui/cell';
import { Radio, RadioGroup } from '@/components/ui/radio';
const PAYMENT_OPTIONS: ReadonlyArray<{
    name: string;
    label: string;
    disabled?: boolean;
}> = [
    { name: "wechat", label: "微信支付" },
    { name: "alipay", label: "支付宝" },
    { name: "bank", label: "银行卡（维护中）", disabled: true },
];
/** Radio 的第 1 个示例 */
export function RadioExample1() {
    const [pay, setPay] = React.useState<string>("wechat");
    return (
        <Block className="p-0">
                        <CellGroup inset className="mx-0">
                            <RadioGroup
                                value={pay}
                                onChange={(name) => setPay(name as string)}
                            >
                                {PAYMENT_OPTIONS.map((item) => (
                                    <Cell
                                        key={item.name}
                                        center
                                        title={item.label}
                                        onClick={(event) => {
                                            if (item.disabled || isChoiceTarget(event))
                                                return;
                                            setPay(item.name);
                                        }}
                                        rightIcon={
                                            <Radio
                                                name={item.name}
                                                disabled={item.disabled}
                                                ariaLabel={item.label}
                                            />
                                        }
                                    />
                                ))}
                            </RadioGroup>
                        </CellGroup>
                        <p className="px-bv-md py-bv-sm text-bv-sm text-bv-text-2">
                            当前支付方式：
                            {PAYMENT_OPTIONS.find((item) => item.name === pay)?.label}
                            （整行点击触发，这是 H5 的典型用法）
                        </p>
                    </Block>
    );
}
/** Radio 的第 2 个示例 */
export function RadioExample2() {
    const [gender, setGender] = React.useState<string>("secret");
    return (
        <Block>
                        <div className="flex flex-col gap-bv-gutter">
                            <RadioGroup
                                direction="horizontal"
                                value={gender}
                                onChange={(name) => setGender(name as string)}
                            >
                                <Radio name="male">男</Radio>
                                <Radio name="female">女</Radio>
                                <Radio name="secret">保密</Radio>
                            </RadioGroup>
                            <Row>
                                <Radio
                                    name="left-label"
                                    labelPosition="left"
                                    defaultChecked
                                >
                                    文字在左
                                </Radio>
                                <Radio name="disabled" disabled>
                                    禁用项
                                </Radio>
                            </Row>
                        </div>
                    </Block>
    );
}
export function RadioDemos() {
    return (
            <Section title="P3 · Radio 单选框（模式 A：H5 整行触发 / PC 空格与方向键）">
                <RadioExample1 />
                <RadioExample2 />
            </Section>
        );
}