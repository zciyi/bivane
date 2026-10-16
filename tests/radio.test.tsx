import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Radio, RadioGroup } from '@/components/ui/radio';

function getRadio(name: string): HTMLInputElement {
    return screen.getByRole('radio', { name }) as HTMLInputElement;
}

describe('RadioGroup（对齐 Vant radio）', () => {
    it('组内互斥：点选后 onChange 回传 name，其余自动取消', async () => {
        const onChange = vi.fn();
        render(
            <RadioGroup onChange={onChange}>
                <Radio name="a">选项一</Radio>
                <Radio name="b">选项二</Radio>
                <Radio name="c">选项三</Radio>
            </RadioGroup>,
        );

        await userEvent.click(screen.getByText('选项一'));
        expect(getRadio('选项一')).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith('a');

        await userEvent.click(screen.getByText('选项三'));
        expect(getRadio('选项三')).toBeChecked();
        expect(getRadio('选项一')).not.toBeChecked();
        expect(getRadio('选项二')).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith('c');
    });

    it('受控 value 决定选中项', () => {
        render(
            <RadioGroup value="b">
                <Radio name="a">选项一</Radio>
                <Radio name="b">选项二</Radio>
            </RadioGroup>,
        );
        expect(getRadio('选项一')).not.toBeChecked();
        expect(getRadio('选项二')).toBeChecked();
    });

    it('非受控 defaultValue 生效', () => {
        render(
            <RadioGroup defaultValue="a">
                <Radio name="a">选项一</Radio>
                <Radio name="b">选项二</Radio>
            </RadioGroup>,
        );
        expect(getRadio('选项一')).toBeChecked();
    });

    it('组内所有 input 共享同一个原生 name（方向键轮换由浏览器保证）', () => {
        render(
            <RadioGroup>
                <Radio name="a">选项一</Radio>
                <Radio name="b">选项二</Radio>
            </RadioGroup>,
        );
        const nameA = getRadio('选项一').name;
        expect(nameA).toMatch(/^bv-radio-/);
        expect(getRadio('选项二').name).toBe(nameA);
    });

    it('容器带 radiogroup 语义与排列方向', () => {
        render(
            <RadioGroup direction="horizontal">
                <Radio name="a">选项一</Radio>
            </RadioGroup>,
        );
        expect(screen.getByRole('radiogroup')).toHaveAttribute(
            'data-direction',
            'horizontal',
        );
    });

    it('disabled 项不可选，整组 disabled 透传', async () => {
        const onChange = vi.fn();
        render(
            <RadioGroup onChange={onChange}>
                <Radio name="a">可用</Radio>
                <Radio name="b" disabled>
                    不可用
                </Radio>
            </RadioGroup>,
        );
        const disabled = getRadio('不可用');
        expect(disabled).toBeDisabled();
        await userEvent.click(screen.getByText('不可用'));
        expect(disabled).not.toBeChecked();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('labelDisabled：点文字不切换，点图标仍切换', async () => {
        const onChange = vi.fn();
        render(
            <RadioGroup onChange={onChange}>
                <Radio name="a" labelDisabled>
                    协议
                </Radio>
            </RadioGroup>,
        );
        const input = getRadio('协议');
        await userEvent.click(screen.getByText('协议'));
        expect(input).not.toBeChecked();

        await userEvent.click(
            document.querySelector('[data-slot="radio-icon"]') as Element,
        );
        expect(input).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith('a');
    });

    it('键盘空格选中聚焦的单选项', async () => {
        const onChange = vi.fn();
        render(
            <RadioGroup onChange={onChange}>
                <Radio name="a">选项一</Radio>
                <Radio name="b">选项二</Radio>
            </RadioGroup>,
        );
        const input = getRadio('选项二');
        input.focus();
        await userEvent.keyboard(' ');
        expect(input).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith('b');
    });
});

describe('Radio 独立使用', () => {
    it('defaultChecked 初始选中', () => {
        render(<Radio defaultChecked>单选项</Radio>);
        expect(getRadio('单选项')).toBeChecked();
    });

    it('选中色通过内联样式作用于边框与内圆', () => {
        render(
            <Radio checked checkedColor="#ee0a24">
                红
            </Radio>,
        );
        expect(document.querySelector('[data-slot="radio-icon"]')).toHaveStyle({
            borderColor: '#ee0a24',
        });
        expect(document.querySelector('[data-slot="radio-dot"]')).toHaveStyle({
            backgroundColor: '#ee0a24',
        });
    });
});
