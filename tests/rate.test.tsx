import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Rate } from "@/components/responsive/rate";
import { setViewport, resetViewport } from "./setup";

/**
 * Rate 双模式行为（矩阵 §2.2）：
 * H5 点击/滑动连续选值；PC 点击 + hover 预览 + 键盘方向键。
 * 44px 热区由 CSS 负责，这里只断言结构与值语义。
 */

function getSlider() {
    return screen.getByRole("slider");
}

function getStar(index: number): HTMLElement {
    return document.querySelector<HTMLElement>(
        `[data-slot="rate-item"][data-index="${index}"]`,
    )!;
}

describe("Rate 结构与基本渲染", () => {
    it("默认渲染 5 颗星，aria 正确", () => {
        setViewport({ width: 1280 });
        render(<Rate />);
        expect(getSlider()).toHaveAttribute("data-mode", "pc");
        expect(getSlider()).toHaveAttribute("aria-valuenow", "0");
        expect(getSlider()).toHaveAttribute("aria-valuemax", "5");
        expect(document.querySelectorAll('[data-slot="rate-item"]')).toHaveLength(5);
        resetViewport();
    });

    it("count 控制星数", () => {
        setViewport({ width: 1280 });
        render(<Rate count={3} />);
        expect(document.querySelectorAll('[data-slot="rate-item"]')).toHaveLength(3);
        resetViewport();
    });
});

describe("Rate · PC（点击 + 键盘 + hover 预览不改值）", () => {
    it("点击第 3 颗星 → 值 3", () => {
        setViewport({ width: 1280 });
        const onChange = vi.fn();
        render(<Rate defaultValue={1} onChange={onChange} />);
        fireEvent.click(getStar(2));
        expect(onChange).toHaveBeenCalledWith(3);
        expect(getSlider()).toHaveAttribute("aria-valuenow", "3");
        resetViewport();
    });

    it("hover 只预览不改受控值", () => {
        setViewport({ width: 1280 });
        const onChange = vi.fn();
        render(<Rate value={2} onChange={onChange} />);
        fireEvent.pointerEnter(getStar(4));
        expect(getSlider()).toHaveAttribute("aria-valuenow", "5");
        expect(onChange).not.toHaveBeenCalled();
        // 移出后还原到受控值
        fireEvent.pointerLeave(getSlider());
        expect(getSlider()).toHaveAttribute("aria-valuenow", "2");
        resetViewport();
    });

    it("键盘 → 递增，Home/End 跳边界", () => {
        setViewport({ width: 1280 });
        const onChange = vi.fn();
        render(<Rate defaultValue={2} onChange={onChange} />);
        const slider = getSlider();
        slider.focus();
        fireEvent.keyDown(slider, { key: "ArrowRight" });
        expect(onChange).toHaveBeenLastCalledWith(3);
        fireEvent.keyDown(slider, { key: "End" });
        expect(onChange).toHaveBeenLastCalledWith(5);
        fireEvent.keyDown(slider, { key: "Home" });
        expect(onChange).toHaveBeenLastCalledWith(0);
        resetViewport();
    });

    it("disabled / readonly 不可选", () => {
        setViewport({ width: 1280 });
        const onChange = vi.fn();
        const { rerender } = render(
            <Rate defaultValue={1} disabled onChange={onChange} />,
        );
        fireEvent.click(getStar(3));
        expect(onChange).not.toHaveBeenCalled();
        rerender(<Rate defaultValue={1} readonly onChange={onChange} />);
        fireEvent.click(getStar(3));
        expect(onChange).not.toHaveBeenCalled();
        resetViewport();
    });

    it("clearable：再点当前值清零", () => {
        setViewport({ width: 1280 });
        const onChange = vi.fn();
        render(<Rate value={3} clearable onChange={onChange} />);
        fireEvent.click(getStar(2));
        expect(onChange).toHaveBeenCalledWith(0);
        resetViewport();
    });
});

describe("Rate · H5（点击/滑动选值）", () => {
    it("pointerdown 选星 → 值 4", () => {
        setViewport({ width: 375, touch: true });
        const onChange = vi.fn();
        render(<Rate defaultValue={1} onChange={onChange} />);
        expect(getSlider()).toHaveAttribute("data-mode", "h5");
        fireEvent.pointerDown(getStar(3), { clientX: 5 });
        expect(onChange).toHaveBeenCalledWith(4);
        resetViewport();
    });

    it("disabled 下 pointerdown 无效果", () => {
        setViewport({ width: 375, touch: true });
        const onChange = vi.fn();
        render(<Rate defaultValue={1} disabled onChange={onChange} />);
        fireEvent.pointerDown(getStar(3), { clientX: 5 });
        expect(onChange).not.toHaveBeenCalled();
        resetViewport();
    });
});
