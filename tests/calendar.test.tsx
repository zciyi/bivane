import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { Calendar } from "@/components/responsive/calendar";
import type { CalendarFormatter } from "@/components/ui/calendar-parts";

/**
 * Calendar 双模式行为测试（矩阵 §4：h5 / pc 各一组「选值 + 边界」）
 *
 * 与 date-picker 测试同口径：显式给 min/max 与初值，不依赖运行当天；
 * 拖选滑窗的纯计算在 calendar-state.test.ts 覆盖，这里走真实点击/键盘路径。
 */

const MIN = "2026-10-01";
const MAX = "2026-10-31";

function h5Day(date: string): HTMLButtonElement {
    return document.querySelector(
        `[data-slot="calendar-h5-day"][data-date="${date}"]`,
    ) as HTMLButtonElement;
}

function pcDay(date: string): HTMLButtonElement {
    return document.querySelector(
        `[data-slot="calendar-pc-cell"][data-date="${date}"]`,
    ) as HTMLButtonElement;
}

function pcActiveDay(): string | null {
    const node = document.querySelector(
        '[data-slot="calendar-pc-cell"][data-active="true"]',
    );
    return node?.getAttribute("data-date") ?? null;
}

/** 每周六禁用（2026-10 内：10、17、24、31） */
const disableSaturday: CalendarFormatter = ({ parts }) => {
    const date = new Date(parts.year, parts.month - 1, parts.day);
    return date.getDay() === 6 ? { disabled: true } : undefined;
};

describe("Calendar · h5 mode", () => {
    it("关闭态不渲染弹层；打开后是全屏弹层 + 月份列表，single 没有确定条", () => {
        const { rerender } = render(
            <Calendar forceMode="mobile" min={MIN} max={MAX} open={false} />,
        );
        expect(
            document.querySelector('[data-slot="calendar-h5-panel"]'),
        ).toBeNull();

        rerender(<Calendar forceMode="mobile" min={MIN} max={MAX} open />);
        expect(document.querySelector('[data-slot="popup"]')).toHaveAttribute(
            "data-position-resolved",
            "fullscreen",
        );
        expect(
            document.querySelectorAll('[data-slot="calendar-h5-month"]').length,
        ).toBeGreaterThan(0);
        expect(
            document.querySelector('[data-slot="calendar-h5-confirm"]'),
        ).toBeNull();
    });

    it("single：点一天即回调并请求关闭", () => {
        const onChange = vi.fn();
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        render(
            <Calendar
                forceMode="mobile"
                type="single"
                min={MIN}
                max={MAX}
                open
                onChange={onChange}
                onConfirm={onConfirm}
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.click(h5Day("2026-10-15"));
        expect(onChange).toHaveBeenCalledWith("2026-10-15");
        expect(onConfirm).toHaveBeenCalledWith("2026-10-15");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("range：两步点选，半截时确定条禁用，选满确定才回调；反向点选重置起点", () => {
        const onChange = vi.fn();
        const onOpenChange = vi.fn();
        render(
            <Calendar
                forceMode="mobile"
                type="range"
                min={MIN}
                max={MAX}
                open
                onChange={onChange}
                onOpenChange={onOpenChange}
            />,
        );

        const confirm = () =>
            document.querySelector(
                '[data-slot="calendar-h5-confirm"]',
            ) as HTMLButtonElement;

        expect(confirm()).toBeDisabled();
        expect(confirm()).toHaveTextContent("请选择结束时间");

        fireEvent.click(h5Day("2026-10-10"));
        expect(confirm()).toBeDisabled();

        // 反向点选：以更早的日期重置为新起点，仍未完成
        fireEvent.click(h5Day("2026-10-05"));
        expect(confirm()).toBeDisabled();
        expect(
            document.querySelector(
                '[data-slot="calendar-h5-day"][data-date="2026-10-05"]',
            ),
        ).toHaveAttribute("data-range-start", "true");

        fireEvent.click(h5Day("2026-10-20"));
        expect(confirm()).toBeEnabled();
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(confirm());
        expect(onChange).toHaveBeenCalledWith(["2026-10-05", "2026-10-20"]);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("range：轻点超出 maxRange 触发 onOverRange 且不改值", () => {
        const onOverRange = vi.fn();
        render(
            <Calendar
                forceMode="mobile"
                type="range"
                min={MIN}
                max={MAX}
                maxRange={3}
                open
                onOverRange={onOverRange}
            />,
        );

        fireEvent.click(h5Day("2026-10-10"));
        fireEvent.click(h5Day("2026-10-15"));
        expect(onOverRange).toHaveBeenCalledWith({
            date: "2026-10-15",
            maxRange: 3,
        });
        // 仍是半截区间：确定条保持禁用
        expect(
            document.querySelector('[data-slot="calendar-h5-confirm"]'),
        ).toBeDisabled();
    });

    it("multiple：点选累计/再点取消，确定提交升序数组", () => {
        const onChange = vi.fn();
        render(
            <Calendar
                forceMode="mobile"
                type="multiple"
                min={MIN}
                max={MAX}
                open
                onChange={onChange}
            />,
        );

        const confirm = () =>
            document.querySelector(
                '[data-slot="calendar-h5-confirm"]',
            ) as HTMLButtonElement;

        expect(confirm()).toBeDisabled();
        fireEvent.click(h5Day("2026-10-20"));
        fireEvent.click(h5Day("2026-10-08"));
        expect(confirm()).toBeEnabled();

        // 再点已选项 = 取消，但仍有一项时确定条可用
        fireEvent.click(h5Day("2026-10-20"));
        fireEvent.click(confirm());
        expect(onChange).toHaveBeenCalledWith(["2026-10-08"]);
    });

    it("formatter 禁用日不可点；关闭弹层丢弃未确定的多选草稿", () => {
        const onChange = vi.fn();
        const onOpenChange = vi.fn();
        const { rerender } = render(
            <Calendar
                forceMode="mobile"
                type="multiple"
                min={MIN}
                max={MAX}
                formatter={disableSaturday}
                open
                onChange={onChange}
                onOpenChange={onOpenChange}
            />,
        );

        // 2026-10-10 是周六，被 formatter 禁用
        expect(h5Day("2026-10-10")).toBeDisabled();
        fireEvent.click(h5Day("2026-10-10"));
        expect(onChange).not.toHaveBeenCalled();

        // 暂存一项后关闭：不产生 onChange（取消即丢弃）
        fireEvent.click(h5Day("2026-10-09"));
        fireEvent.click(
            document.querySelector(
                '[data-slot="calendar-h5-close"]',
            ) as HTMLButtonElement,
        );
        expect(onOpenChange).toHaveBeenCalledWith(false);
        expect(onChange).not.toHaveBeenCalled();

        // 重新打开：确定条恢复禁用，草稿没有复活（先关后开，播种 effect 才会重跑）
        rerender(
            <Calendar
                forceMode="mobile"
                type="multiple"
                min={MIN}
                max={MAX}
                formatter={disableSaturday}
                open={false}
                onChange={onChange}
                onOpenChange={onOpenChange}
            />,
        );
        rerender(
            <Calendar
                forceMode="mobile"
                type="multiple"
                min={MIN}
                max={MAX}
                formatter={disableSaturday}
                open
                onChange={onChange}
                onOpenChange={onOpenChange}
            />,
        );
        expect(
            document.querySelector('[data-slot="calendar-h5-confirm"]'),
        ).toBeDisabled();
    });
});

describe("Calendar · pc mode", () => {
    it("恒内嵌：不挂 Popup；range 渲染并排双月，single 单月", () => {
        const { rerender } = render(
            <Calendar forceMode="desktop" type="single" min={MIN} max={MAX} />,
        );
        expect(
            document.querySelector('[data-slot="calendar-pc-panel"]'),
        ).toBeInTheDocument();
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();
        expect(
            document.querySelectorAll('[data-slot="calendar-pc-month-panel"]')
                .length,
        ).toBe(1);

        rerender(
            <Calendar
                forceMode="desktop"
                type="range"
                min="2026-09-01"
                max="2026-12-31"
            />,
        );
        expect(
            document.querySelectorAll('[data-slot="calendar-pc-month-panel"]')
                .length,
        ).toBe(2);
    });

    it("single：点选即生效", () => {
        const onChange = vi.fn();
        render(
            <Calendar
                forceMode="desktop"
                type="single"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(pcDay("2026-10-15"));
        expect(onChange).toHaveBeenCalledWith("2026-10-15");
        expect(pcDay("2026-10-15")).toHaveAttribute("data-selected", "true");
    });

    it("multiple：点选/取消即时回写升序数组", () => {
        const onChange = vi.fn();
        render(
            <Calendar
                forceMode="desktop"
                type="multiple"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(pcDay("2026-10-20"));
        fireEvent.click(pcDay("2026-10-08"));
        expect(onChange).toHaveBeenLastCalledWith(["2026-10-08", "2026-10-20"]);

        fireEvent.click(pcDay("2026-10-20"));
        expect(onChange).toHaveBeenLastCalledWith(["2026-10-08"]);
    });

    it("range：两次点选提交有序区间；同日不允许；轻点超界只回调", () => {
        const onChange = vi.fn();
        const onOverRange = vi.fn();
        const { rerender } = render(
            <Calendar
                forceMode="desktop"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
                onOverRange={onOverRange}
            />,
        );

        // 反向两次点选：第二次点更早日期只重置起点，不提交
        fireEvent.click(pcDay("2026-10-20"));
        fireEvent.click(pcDay("2026-10-05"));
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(pcDay("2026-10-12"));
        expect(onChange).toHaveBeenCalledWith(["2026-10-05", "2026-10-12"]);

        // 同日区间默认不允许：连点同一天不回调
        fireEvent.click(pcDay("2026-10-15"));
        fireEvent.click(pcDay("2026-10-15"));
        expect(onOverRange).not.toHaveBeenCalled();

        // maxRange：起点 10-10，点 10-15（跨 6 天 > 3 含端点）只提示
        rerender(
            <Calendar
                forceMode="desktop"
                type="range"
                min={MIN}
                max={MAX}
                maxRange={3}
                onChange={onChange}
                onOverRange={onOverRange}
            />,
        );
        fireEvent.click(pcDay("2026-10-10"));
        fireEvent.click(pcDay("2026-10-15"));
        expect(onOverRange).toHaveBeenCalledWith({
            date: "2026-10-15",
            maxRange: 3,
        });
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it("range：真机指针序列（pointerdown→pointerup→click）两步点选也能选满", () => {
        // jsdom 的 fireEvent.click 不派发 pointerdown，而真机上 click 前必有：
        // 第二次按下时不得清掉第一次点好的起点
        const onChange = vi.fn();
        render(
            <Calendar
                forceMode="desktop"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );

        const realTap = (date: string) => {
            const node = pcDay(date);
            fireEvent.pointerDown(node);
            // pointerup 监听挂在 window（手指可能在格子外松开）
            fireEvent.pointerUp(window);
            fireEvent.click(node);
        };

        realTap("2026-10-10");
        expect(onChange).not.toHaveBeenCalled();
        expect(pcDay("2026-10-10")).toHaveAttribute("data-selected", "true");

        realTap("2026-10-20");
        expect(onChange).toHaveBeenCalledWith(["2026-10-10", "2026-10-20"]);
    });

    it("键盘：方向键移动光标（禁用日自动跳过），Enter 选定", () => {
        const onChange = vi.fn();
        render(
            <Calendar
                forceMode="desktop"
                type="single"
                min={MIN}
                max={MAX}
                defaultValue="2026-10-15"
                formatter={disableSaturday}
                onChange={onChange}
            />,
        );
        const panel = document.querySelector(
            '[data-slot="calendar-pc-panel"]',
        ) as HTMLElement;
        panel.focus();

        // 10-15 周四；右键到 10-16 周五，再右键跳过 10-17 周六落在 10-18 周日
        fireEvent.keyDown(panel, { key: "ArrowRight" });
        expect(pcActiveDay()).toBe("2026-10-16");
        fireEvent.keyDown(panel, { key: "ArrowRight" });
        expect(pcActiveDay()).toBe("2026-10-18");

        // 向下跨周：10-25 周日可选；Home 回到本周首日（周日为首）即 10-25 自身
        fireEvent.keyDown(panel, { key: "ArrowDown" });
        expect(pcActiveDay()).toBe("2026-10-25");
        fireEvent.keyDown(panel, { key: "Home" });
        expect(pcActiveDay()).toBe("2026-10-25");

        fireEvent.keyDown(panel, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("2026-10-25");
    });
});
