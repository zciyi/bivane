import { createRef } from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
    Checkbox,
    CheckboxGroup,
    type CheckboxGroupInstance,
} from "@/components/ui/checkbox";

function getCheckbox(name: string): HTMLInputElement {
    return screen.getByRole("checkbox", { name }) as HTMLInputElement;
}

describe("Checkbox 独立使用", () => {
    it("点击图标与文字都能切换，onChange 回传布尔值", async () => {
        const onChange = vi.fn();
        render(<Checkbox onChange={onChange}>苹果</Checkbox>);
        const input = getCheckbox("苹果");

        expect(input).not.toBeChecked();
        // 点文字：label 激活行为由 user-event 转发到 input
        await userEvent.click(screen.getByText("苹果"));
        expect(input).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(true);

        // 点图标盒
        await userEvent.click(
            document.querySelector('[data-slot="checkbox-icon"]') as Element,
        );
        expect(input).not.toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("受控 checked 跟随外部值", () => {
        const { rerender } = render(<Checkbox checked={false}>受控</Checkbox>);
        const input = getCheckbox("受控");
        expect(input).not.toBeChecked();
        rerender(<Checkbox checked>受控</Checkbox>);
        expect(input).toBeChecked();
    });

    it("非受控 defaultChecked 初始选中", () => {
        render(<Checkbox defaultChecked>默认选</Checkbox>);
        expect(getCheckbox("默认选")).toBeChecked();
    });

    it("shape=square 落到 data-shape，圆角由 CSS 区分", () => {
        render(<Checkbox shape="square">方形</Checkbox>);
        expect(
            document.querySelector('[data-slot="checkbox"]'),
        ).toHaveAttribute("data-shape", "square");
    });

    it("disabled：input 原生禁用且整行点击无变化", async () => {
        const onChange = vi.fn();
        render(
            <Checkbox disabled onChange={onChange}>
                禁用
            </Checkbox>,
        );
        const input = getCheckbox("禁用");
        expect(input).toBeDisabled();
        await userEvent.click(screen.getByText("禁用"));
        expect(input).not.toBeChecked();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("labelDisabled：点文字不切换，点图标仍切换", async () => {
        const onChange = vi.fn();
        render(
            <Checkbox labelDisabled onChange={onChange}>
                协议
            </Checkbox>,
        );
        const input = getCheckbox("协议");

        await userEvent.click(screen.getByText("协议"));
        expect(input).not.toBeChecked();

        await userEvent.click(
            document.querySelector('[data-slot="checkbox-icon"]') as Element,
        );
        expect(input).toBeChecked();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });

    it("indeterminate：aria-checked=mixed 且 DOM indeterminate=true，但 checked 不变", () => {
        render(
            <Checkbox indeterminate checked={false}>
                半选
            </Checkbox>,
        );
        const input = getCheckbox("半选");
        expect(input).toHaveAttribute("aria-checked", "mixed");
        expect(input.indeterminate).toBe(true);
        expect(input).not.toBeChecked();
    });

    it("labelPosition=left 时文字渲染在图标之前", () => {
        render(<Checkbox labelPosition="left">靠左说明</Checkbox>);
        const root = document.querySelector(
            '[data-slot="checkbox"]',
        ) as HTMLElement;
        const labelEl = screen.getByText("靠左说明");
        expect(root.firstElementChild).toBe(labelEl);
    });

    it("选中且传 checkedColor 时写内联底色；禁用选中态让位给 token", () => {
        const { rerender } = render(
            <Checkbox checked checkedColor="#ee0a24">
                红
            </Checkbox>,
        );
        const icon = document.querySelector(
            '[data-slot="checkbox-icon"]',
        ) as HTMLElement;
        expect(icon.style.backgroundColor).toBe("rgb(238, 10, 36)");

        rerender(
            <Checkbox checked disabled checkedColor="#ee0a24">
                红
            </Checkbox>,
        );
        expect(icon.style.backgroundColor).toBe("");
    });
});

describe("CheckboxGroup", () => {
    it("点选多个：值为已选 name 数组且保持顺序，再点取消", async () => {
        const onChange = vi.fn();
        render(
            <CheckboxGroup onChange={onChange}>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
                <Checkbox name="c">橙子</Checkbox>
            </CheckboxGroup>,
        );

        await userEvent.click(screen.getByText("香蕉"));
        expect(onChange).toHaveBeenLastCalledWith(["b"]);
        await userEvent.click(screen.getByText("苹果"));
        expect(onChange).toHaveBeenLastCalledWith(["b", "a"]);

        await userEvent.click(screen.getByText("香蕉"));
        expect(onChange).toHaveBeenLastCalledWith(["a"]);
    });

    it("受控 value 驱动子项选中态", () => {
        render(
            <CheckboxGroup value={["a", "c"]}>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
                <Checkbox name="c">橙子</Checkbox>
            </CheckboxGroup>,
        );
        expect(getCheckbox("苹果")).toBeChecked();
        expect(getCheckbox("香蕉")).not.toBeChecked();
        expect(getCheckbox("橙子")).toBeChecked();
    });

    it("max=2：达上限后未选项原生禁用，已选项仍可取消", async () => {
        render(
            <CheckboxGroup defaultValue={["a", "b"]} max={2}>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
                <Checkbox name="c">橙子</Checkbox>
            </CheckboxGroup>,
        );
        expect(getCheckbox("橙子")).toBeDisabled();
        expect(getCheckbox("苹果")).not.toBeDisabled();

        await userEvent.click(screen.getByText("苹果"));
        // 取消后空出席位，橙子恢复可选
        expect(getCheckbox("橙子")).not.toBeDisabled();
    });

    it("整组 disabled 透传所有子项", () => {
        render(
            <CheckboxGroup disabled>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
            </CheckboxGroup>,
        );
        expect(getCheckbox("苹果")).toBeDisabled();
        expect(getCheckbox("香蕉")).toBeDisabled();
    });

    it("非受控下 ref.toggleAll 全选 / 全不选", () => {
        const onChange = vi.fn();
        const ref = createRef<CheckboxGroupInstance>();
        render(
            <CheckboxGroup ref={ref} onChange={onChange}>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
                <Checkbox name="c" disabled>
                    橙子
                </Checkbox>
            </CheckboxGroup>,
        );

        act(() => ref.current?.toggleAll());
        // 不传 skipDisabled：禁用项也进值（由组值持有，UI 禁用不代表数据剔除）
        expect(onChange).toHaveBeenLastCalledWith(["a", "b", "c"]);

        act(() => ref.current?.toggleAll(false));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("toggleAll({ skipDisabled:true }) 跳过禁用项并保留禁用项现状", () => {
        const onChange = vi.fn();
        const ref = createRef<CheckboxGroupInstance>();
        render(
            <CheckboxGroup ref={ref} defaultValue={["c"]} onChange={onChange}>
                <Checkbox name="a">苹果</Checkbox>
                <Checkbox name="b">香蕉</Checkbox>
                <Checkbox name="c" disabled>
                    橙子
                </Checkbox>
            </CheckboxGroup>,
        );

        // 全选：启用项按登记顺序在前，已选的禁用项保留追加
        act(() =>
            ref.current?.toggleAll({ checked: true, skipDisabled: true }),
        );
        expect(onChange).toHaveBeenLastCalledWith(["a", "b", "c"]);

        // 全不选：仅保留禁用项已选值
        act(() =>
            ref.current?.toggleAll({ checked: false, skipDisabled: true }),
        );
        expect(onChange).toHaveBeenLastCalledWith(["c"]);
    });

    it("direction=horizontal 写到 data-direction", () => {
        render(
            <CheckboxGroup direction="horizontal">
                <Checkbox name="a">苹果</Checkbox>
            </CheckboxGroup>,
        );
        expect(
            document.querySelector('[data-slot="checkbox-group"]'),
        ).toHaveAttribute("data-direction", "horizontal");
    });
});
