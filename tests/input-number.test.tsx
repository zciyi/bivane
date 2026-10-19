import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { InputNumber } from "@/components/responsive/input-number";
import type { InputNumberValue } from "@/hooks/use-input-number-state";
import { setViewport } from "./setup";

/**
 * InputNumber 双模式行为（矩阵 §2.2）：
 * H5 横排 ±、长按连发、44px 热区由 CSS 负责（这里只断言结构槽位）；
 * PC 竖排 ▲▼ 微调列 + ↑↓/Home/End 键盘。
 */

function getSpinbutton() {
    return screen.getByRole("spinbutton");
}

function getButton(slot: "input-number-minus" | "input-number-plus") {
    return document.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`)!;
}

function Controlled({
    initial = 1,
    ...rest
}: { initial?: number } & Partial<Parameters<typeof InputNumber>[0]>) {
    const [value, setValue] = useState<InputNumberValue>(initial);
    return (
        <>
            <span data-testid="value">{String(value)}</span>
            <InputNumber value={value} onChange={setValue} {...rest} />
        </>
    );
}

afterEach(() => {
    vi.useRealTimers();
});

describe("InputNumber · H5（横排 ±）", () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it("渲染 H5 横排壳：h5-controls 存在、PC 微调列不存在", () => {
        render(<InputNumber aria-label="数量" />);
        expect(
            document.querySelector("[data-slot='input-number-h5-controls']"),
        ).not.toBeNull();
        expect(
            document.querySelector("[data-slot='input-number-pc-spin']"),
        ).toBeNull();
        expect(
            document
                .querySelector("[data-slot='input-number']")
                ?.getAttribute("data-mode"),
        ).toBe("h5");
    });

    it("点击 ＋/− 按 step 变更并回调；在边界点同方向只报 onOverlimit", async () => {
        const onChange = vi.fn();
        const onOverlimit = vi.fn();
        render(
            <InputNumber
                defaultValue={1}
                min={1}
                max={3}
                onChange={onChange}
                onOverlimit={onOverlimit}
            />,
        );
        const input = getSpinbutton();
        expect(input).toHaveAttribute("aria-valuenow", "1");

        await userEvent.click(getButton("input-number-plus"));
        expect(onChange).toHaveBeenLastCalledWith(2);
        expect(input).toHaveAttribute("aria-valuenow", "2");

        // 到 max 后＋置灰但不挂 disabled（边界点击仍要派 overlimit）
        await userEvent.click(getButton("input-number-plus"));
        expect(
            getButton("input-number-plus").getAttribute("aria-disabled"),
        ).toBe("true");
        await userEvent.click(getButton("input-number-plus"));
        expect(onOverlimit).toHaveBeenLastCalledWith("plus");

        await userEvent.click(getButton("input-number-minus"));
        expect(onChange).toHaveBeenLastCalledWith(2);
        await userEvent.click(getButton("input-number-minus"));
        await userEvent.click(getButton("input-number-minus"));
        expect(onOverlimit).toHaveBeenLastCalledWith("minus");
    });

    it("键入即过滤非数字；失焦夹回边界", () => {
        const onChange = vi.fn();
        render(
            <InputNumber
                defaultValue={1}
                min={1}
                max={10}
                onChange={onChange}
            />,
        );
        const input = getSpinbutton();
        fireEvent.change(input, { target: { value: "12a3" } });
        expect(input).toHaveValue("123");
        expect(onChange).toHaveBeenLastCalledWith(123);

        fireEvent.blur(input);
        expect(input).toHaveValue("10");
        expect(onChange).toHaveBeenLastCalledWith(10);
    });

    it("integer 模式输入框唤起纯数字键盘；小数按键序列只留整数", () => {
        render(<InputNumber integer defaultValue={1} />);
        const input = getSpinbutton();
        expect(input).toHaveAttribute("inputmode", "numeric");
        fireEvent.change(input, { target: { value: "12.5" } });
        expect(input).toHaveValue("125");
    });

    it("decimalLength 截断小数位；失焦补零定位", () => {
        render(<InputNumber defaultValue={1} decimalLength={2} />);
        const input = getSpinbutton();
        fireEvent.change(input, { target: { value: "1.234" } });
        expect(input).toHaveValue("1.23");
        fireEvent.blur(input);
        expect(input).toHaveValue("1.23");
    });

    it("浮点步长不出尾差（0.1+0.2=0.3）", async () => {
        render(<InputNumber defaultValue={0} min={0} step={0.1} />);
        await userEvent.click(getButton("input-number-plus"));
        await userEvent.click(getButton("input-number-plus"));
        await userEvent.click(getButton("input-number-plus"));
        expect(getSpinbutton()).toHaveValue("0.3");
    });

    it("allowEmpty 清空得 null，失焦不回填", () => {
        render(<Controlled initial={1} min={0} allowEmpty />);
        const input = getSpinbutton();
        fireEvent.change(input, { target: { value: "" } });
        expect(screen.getByTestId("value")).toHaveTextContent("null");
        fireEvent.blur(input);
        expect(input).toHaveValue("");
        expect(screen.getByTestId("value")).toHaveTextContent("null");
    });

    it("非 allowEmpty 清空后失焦回填 min", () => {
        render(<InputNumber defaultValue={3} min={1} />);
        const input = getSpinbutton();
        fireEvent.change(input, { target: { value: "" } });
        fireEvent.blur(input);
        expect(input).toHaveValue("1");
    });

    it("长按 400ms 起连发 200ms/步；松开后的合成 click 被吞掉", async () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        render(
            <InputNumber
                defaultValue={1}
                min={1}
                max={10}
                onChange={onChange}
            />,
        );
        const plus = getButton("input-number-plus");
        fireEvent.pointerDown(plus);

        await act(async () => {
            vi.advanceTimersByTime(400);
        });
        expect(onChange).toHaveBeenLastCalledWith(2);

        await act(async () => {
            vi.advanceTimersByTime(200);
        });
        expect(onChange).toHaveBeenLastCalledWith(3);

        fireEvent.pointerUp(plus);
        // 长按后的 click 尾巴不能再多发一档
        fireEvent.click(plus);
        expect(onChange).toHaveBeenLastCalledWith(3);
    });

    it("longPress=false 时按住不连发", async () => {
        vi.useFakeTimers();
        const onChange = vi.fn();
        render(
            <InputNumber
                defaultValue={1}
                longPress={false}
                onChange={onChange}
            />,
        );
        const plus = getButton("input-number-plus");
        fireEvent.pointerDown(plus);
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        fireEvent.pointerUp(plus);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("round 主题在根节点标 data-theme", () => {
        render(<InputNumber theme="round" />);
        expect(
            document.querySelector("[data-slot='input-number']")!,
        ).toHaveAttribute("data-theme", "round");
    });
});

describe("InputNumber · PC（竖排微调列 + 键盘）", () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it("渲染 PC 壳：pc-spin 内两枚竖排按钮，H5 横排壳不存在", () => {
        render(<InputNumber aria-label="数量" />);
        const spin = document.querySelector(
            "[data-slot='input-number-pc-spin']",
        );
        expect(spin).not.toBeNull();
        expect(
            document.querySelector("[data-slot='input-number-h5-controls']"),
        ).toBeNull();
        expect(spin!.querySelectorAll("button")).toHaveLength(2);
    });

    it("点微调列箭头等效加减", async () => {
        const onChange = vi.fn();
        render(
            <InputNumber
                defaultValue={0}
                min={0}
                max={5}
                onChange={onChange}
            />,
        );
        await userEvent.click(getButton("input-number-plus"));
        expect(onChange).toHaveBeenLastCalledWith(1);
        await userEvent.click(getButton("input-number-minus"));
        expect(onChange).toHaveBeenLastCalledWith(0);
    });

    it("键盘 ↑↓ 微调、Home/End 直达边界", () => {
        const onChange = vi.fn();
        const onOverlimit = vi.fn();
        render(
            <InputNumber
                defaultValue={2}
                min={0}
                max={5}
                onChange={onChange}
                onOverlimit={onOverlimit}
            />,
        );
        const input = getSpinbutton();
        fireEvent.keyDown(input, { key: "ArrowUp" });
        expect(onChange).toHaveBeenLastCalledWith(3);
        fireEvent.keyDown(input, { key: "End" });
        expect(onChange).toHaveBeenLastCalledWith(5);
        fireEvent.keyDown(input, { key: "Home" });
        expect(onChange).toHaveBeenLastCalledWith(0);
        fireEvent.keyDown(input, { key: "ArrowDown" });
        expect(onOverlimit).toHaveBeenLastCalledWith("minus");
    });

    it("受控值通过外部更新回流", () => {
        render(<Controlled initial={2} min={0} max={5} />);
        const input = getSpinbutton();
        fireEvent.keyDown(input, { key: "ArrowUp" });
        expect(screen.getByTestId("value")).toHaveTextContent("3");
        expect(input).toHaveValue("3");
    });

    it("disabled：输入框禁用，点箭头不触发 onChange（仍派 overlimit）", async () => {
        const onChange = vi.fn();
        const onOverlimit = vi.fn();
        render(
            <InputNumber
                disabled
                defaultValue={2}
                min={0}
                max={5}
                onChange={onChange}
                onOverlimit={onOverlimit}
            />,
        );
        expect(getSpinbutton()).toBeDisabled();
        await userEvent.click(getButton("input-number-plus"));
        expect(onChange).not.toHaveBeenCalled();
        expect(onOverlimit).toHaveBeenLastCalledWith("plus");
    });

    it("disableInput：输入框只读", () => {
        render(<InputNumber disableInput defaultValue={2} />);
        expect(getSpinbutton()).toHaveAttribute("readonly");
    });

    it("beforeChange 返回 false 时放弃加减", async () => {
        const onChange = vi.fn();
        render(
            <InputNumber
                defaultValue={1}
                min={1}
                max={5}
                beforeChange={() => false}
                onChange={onChange}
            />,
        );
        await userEvent.click(getButton("input-number-plus"));
        expect(onChange).not.toHaveBeenCalled();
        expect(getSpinbutton()).toHaveValue("1");
    });
});
