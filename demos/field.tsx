/**
 * Field 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Section } from './layout';
import { Button } from '@/components/ui/button';
import { CellGroup } from '@/components/ui/cell';
import { Field } from '@/components/ui/field';
import { Icon } from '@/components/ui/icon';
import { showToast } from '@/components/responsive/toast';
function SmsField() {
    const [left, setLeft] = React.useState(0);

    React.useEffect(() => {
        if (left <= 0) return;
        const timer = window.setTimeout(() => setLeft((v) => v - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [left]);

    return (
        <Field
            label="验证码"
            type="digit"
            placeholder="请输入 6 位验证码"
            maxlength={6}
            clearable
            action={
                <Button
                    size="small"
                    type={left > 0 ? "default" : "primary"}
                    disabled={left > 0}
                    onClick={() => setLeft(60)}
                >
                    {left > 0 ? `${left}s 后重发` : "发送验证码"}
                </Button>
            }
        />
    );
}
/** Field 的第 1 个示例 */
export function FieldExample1() {
    return (
        <Block className="p-0">
                                <CellGroup inset className="mx-0">
                                    <Field
                                        label="文本"
                                        placeholder="请输入文本"
                                        clearable
                                    />
                                    <Field
                                        label="手机号"
                                        type="tel"
                                        maxlength={11}
                                        placeholder="请输入手机号"
                                        clearable
                                    />
                                    <Field
                                        label="整数"
                                        type="digit"
                                        placeholder="digit：只允许数字"
                                    />
                                    <Field
                                        label="数值"
                                        type="number"
                                        min={0}
                                        max={99}
                                        placeholder="number：失焦夹紧到 0~99"
                                    />
                                    <Field
                                        label="密码"
                                        type="password"
                                        placeholder="密码输入"
                                    />
                                </CellGroup>
                            </Block>
    );
}
/** Field 的第 2 个示例 */
export function FieldExample2() {
    return (
        <Block className="p-0">
                                <CellGroup inset className="mx-0">
                                    <Field
                                        label="昵称"
                                        required
                                        leftIcon={<Icon name="success" />}
                                        placeholder="聚焦时 label 与左图标转 primary"
                                        clearable
                                    />
                                    <SmsField />
                                    <Field
                                        label="留言"
                                        type="textarea"
                                        rows={1}
                                        autosize={{ maxHeight: 120 }}
                                        maxlength={50}
                                        showWordLimit
                                        placeholder="多行自适应高度（上限 120px）+ 字数"
                                    />
                                    <Field
                                        label="邮箱"
                                        clearable
                                        placeholder="失焦触发 rules 校验"
                                        rules={[
                                            { required: true, message: "请输入邮箱" },
                                            {
                                                pattern: /^\S+@\S+\.\S+$/,
                                                message: "邮箱格式不正确",
                                            },
                                        ]}
                                    />
                                    <Field
                                        label="金额"
                                        type="digit"
                                        inputAlign="right"
                                        placeholder="0.00（右对齐）"
                                    />
                                </CellGroup>
                            </Block>
    );
}
/** Field 的第 3 个示例 */
export function FieldExample3() {
    return (
        <Block className="p-0">
                                <CellGroup inset className="mx-0">
                                    <Field
                                        label="顶部标签"
                                        labelAlign="top"
                                        placeholder="labelAlign=top，标题独占一行"
                                    />
                                    <Field
                                        label="所在城市"
                                        readOnly
                                        isLink
                                        value="杭州"
                                        onClickInput={() =>
                                            showToast("这里内嵌 Select / Picker 触发器")
                                        }
                                    />
                                </CellGroup>
                            </Block>
    );
}
export function FieldDemos() {
    return (
    <Section title="P3 · Field 输入框（模式 A：两端同形，PC 仅多键盘焦点环）">
                        <FieldExample1 />
                        <FieldExample2 />
                        <FieldExample3 />
                    </Section>
        );
}