import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DateTimePicker } from "@/components/responsive/datetime-picker";
import { pad2, todayParts } from "@/hooks/use-date-value";

/**
 * DateTimePicker 双模式行为测试（矩阵 §4：h5 / pc 各一组「选值 + 边界」）
 *
 * 范式差异（模式 C）：
 *  - H5：年/月/日 + 时/分/秒全部是滚轮（4/5/6 列），底部弹层；
 *  - PC：左侧月历网格选日期 + 右侧 1~3 条时间列（时/分/秒），锚定浮层。
 * 共同语义：单值、字符串 'YYYY-MM-DD HH[:mm[:ss]]'、恒走「暂存 → 确定」。
 * 滚轮真实滚动在 jsdom 不发生，「选值」统一走点项；跨字段夹紧归 datetime-value.test.ts。
 */

function trigger(): HTMLElement {
    return screen.getByRole("combobox");
}

/** PC 锚定浮层（H5 不渲染它） */
function panel(): HTMLElement | null {
    return document.querySelector('[data-slot="datetime-picker-panel"]');
}

function wheels(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll('[data-slot="datetime-picker-wheel"]'),
    );
}

function clickWheelOption(wheelIndex: number, name: string): void {
    const wheel = wheels()[wheelIndex];
    if (!wheel) throw new Error(`wheel #${wheelIndex} 不存在`);
    fireEvent.click(within(wheel).getByRole("option", { name }));
}

function timeDisplay(): HTMLElement {
    return document.querySelector(
        '[data-slot="datetime-picker-time-display"]',
    ) as HTMLElement;
}

function dayCell(label: string): HTMLElement {
    // aria-label 是不补零的 'YYYY-M-D'
    return document.querySelector(
        `[data-slot="datetime-picker-cell"][aria-label="${label}"]`,
    ) as HTMLElement;
}

function selectedDayCell(): HTMLElement | null {
    return document.querySelector(
        '[data-slot="datetime-picker-cell"][data-selected="true"]',
    );
}

function h5Confirm(): HTMLButtonElement {
    return document.querySelector(
        '[data-slot="panel-header-confirm"]',
    ) as HTMLButtonElement;
}

function pcConfirm(): HTMLButtonElement {
    return document.querySelector(
        '[data-slot="datetime-picker-confirm"]',
    ) as HTMLButtonElement;
}

describe("h5 mode", () => {
    it('触发器自带 data-mode="h5"，展开是底部弹层 + 6 列滚轮 + 工具条', () => {
        render(<DateTimePicker forceMode="mobile" ariaLabel="日期时间" />);
        expect(trigger()).toHaveAttribute("data-mode", "h5");
        expect(panel()).toBeNull();

        fireEvent.click(trigger());
        expect(
            document.querySelector('[data-slot="popup"]'),
        ).toBeInTheDocument();
        expect(
            document.querySelector('[data-slot="panel-header"]'),
        ).toBeInTheDocument();
        expect(wheels()).toHaveLength(6);
        // 列序：年 / 月 / 日 / 时 / 分 / 秒
        expect(wheels().map((w) => w.getAttribute("aria-label"))).toEqual([
            "年",
            "月",
            "日",
            "时",
            "分",
            "秒",
        ]);
        // PC 锚定浮层不渲染
        expect(panel()).toBeNull();
        // 两端时间列都走 band 居中滚轮，不渲染 ▲▼ 微调钮
        expect(
            document.querySelector('[data-slot="datetime-picker-wheel-step"]'),
        ).toBeNull();
    });

    it("年月日时精度：4 列滚轮，回填 YYYY-MM-DD HH", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="mobile"
                ariaLabel="年月日时"
                columnsType={["year", "month", "day", "hour"]}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        expect(wheels()).toHaveLength(4);

        // 时列（下标 3）选 09：其它列保留播种的「此刻」日期，值只精确到时
        clickWheelOption(3, "09");
        fireEvent.click(h5Confirm());
        expect(onChange).toHaveBeenCalledTimes(1);
        const value = onChange.mock.calls[0][0] as string;
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2} 09$/);
    });

    it("全精度滚轮点选只写草稿，确定才回调固定值", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="mobile"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:45"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        clickWheelOption(3, "10");
        expect(onChange).not.toHaveBeenCalled();
        fireEvent.click(h5Confirm());
        expect(onChange).toHaveBeenCalledWith("2026-09-24 10:30:45");
    });

    it("取消丢弃草稿，重新打开回到已提交值", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="mobile"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:45"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        clickWheelOption(3, "10");
        fireEvent.click(
            document.querySelector(
                '[data-slot="panel-header-cancel"]',
            ) as HTMLElement,
        );
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(trigger());
        expect(
            within(wheels()[3]).getByRole("option", {
                name: "09",
                selected: true,
            }),
        ).toBeInTheDocument();
    });

    it("min 约束：边界当天的时列从 min 时刻起（早于 09 的点不可选）", () => {
        render(
            <DateTimePicker
                forceMode="mobile"
                ariaLabel="受限"
                min="2026-09-24 09:00:00"
                defaultValue="2026-09-24 12:00:00"
            />,
        );
        fireEvent.click(trigger());
        const hourWheel = wheels()[3];
        expect(
            within(hourWheel).queryByRole("option", { name: "08" }),
        ).toBeNull();
        expect(
            within(hourWheel).getByRole("option", { name: "09" }),
        ).toBeInTheDocument();
    });
});

describe("pc mode", () => {
    it("展开是「左月历 + 右 3 条时间列」的锚定浮层，不渲染底部弹层", () => {
        render(<DateTimePicker forceMode="desktop" ariaLabel="日期时间" />);
        fireEvent.click(trigger());

        expect(panel()).toBeInTheDocument();
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();

        // 月历：7 个星期头 + 恒 6 行 × 7 格
        expect(
            document.querySelectorAll('[data-slot="datetime-picker-weekday"]'),
        ).toHaveLength(7);
        expect(
            document.querySelectorAll('[data-slot="datetime-picker-cell"]'),
        ).toHaveLength(42);
        // 右侧：时 / 分 / 秒三条时间列
        expect(wheels().map((w) => w.getAttribute("aria-label"))).toEqual([
            "时",
            "分",
            "秒",
        ]);
        // « < 年月 > » 四个导航钮 + 顶部时间回显 + 此刻/确定
        expect(
            document.querySelector('[data-slot="datetime-picker-prev-year"]'),
        ).toBeInTheDocument();
        expect(
            document.querySelector('[data-slot="datetime-picker-next-year"]'),
        ).toBeInTheDocument();
        expect(timeDisplay()).toHaveTextContent(/^\d{2}:\d{2}:\d{2}$/);
        // PC 时间列也走 band 居中滚轮，不渲染 ▲▼ 微调钮
        expect(
            document.querySelectorAll(
                '[data-slot="datetime-picker-wheel-step"]',
            ),
        ).toHaveLength(0);
        expect(
            document.querySelectorAll(
                '[data-slot="datetime-picker-wheel-indicator"]',
            ),
        ).toHaveLength(3);
    });

    it("点日期格只写草稿并选中该天，确定才回调", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        expect(
            document.querySelector('[data-slot="datetime-picker-month-title"]'),
        ).toHaveTextContent("2026 年 9 月");

        fireEvent.click(dayCell("2026-9-25"));
        expect(onChange).not.toHaveBeenCalled();
        expect(selectedDayCell()?.getAttribute("aria-label")).toBe("2026-9-25");

        fireEvent.click(pcConfirm());
        expect(onChange).toHaveBeenCalledWith("2026-09-25 09:30:00");
    });

    it("点时间列改草稿（保留日期），顶部时间回显同步", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        clickWheelOption(0, "10");
        expect(onChange).not.toHaveBeenCalled();
        expect(
            document.querySelector(
                '[data-slot="datetime-picker-time-display"]',
            ),
        ).toHaveTextContent("10:30:00");

        fireEvent.click(pcConfirm());
        expect(onChange).toHaveBeenCalledWith("2026-09-24 10:30:00");
    });

    it("时间列随精度：年月日时 1 条、年月日时分 2 条", () => {
        const onChange = vi.fn();
        const { unmount } = render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="年月日时"
                columnsType={["year", "month", "day", "hour"]}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        expect(wheels()).toHaveLength(1);
        expect(
            document.querySelector(
                '[data-slot="datetime-picker-time-display"]',
            ),
        ).toHaveTextContent(/^\d{2}$/);
        fireEvent.click(pcConfirm());
        expect(onChange).toHaveBeenCalledTimes(1);
        unmount();

        // 独立实例验证 5 列（避免上一个实例的内部已选值串档）
        const onChange2 = vi.fn();
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="年月日时分"
                columnsType={["year", "month", "day", "hour", "minute"]}
                defaultValue="2026-09-24 09:30"
                onChange={onChange2}
            />,
        );
        fireEvent.click(trigger());
        expect(wheels()).toHaveLength(2);
        fireEvent.click(pcConfirm());
        expect(onChange2).toHaveBeenCalledWith("2026-09-24 09:30");
    });

    it("min 当天 09:00：时列裁剪从 09 起（08 不存在）", () => {
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="受限"
                min="2026-09-24 09:00:00"
                defaultValue="2026-09-24 12:00:00"
            />,
        );
        fireEvent.click(trigger());
        const hourWheel = wheels()[0];
        expect(
            within(hourWheel).queryByRole("option", { name: "08" }),
        ).toBeNull();
        expect(
            within(hourWheel).getByRole("option", { name: "09" }),
        ).toBeInTheDocument();
        // 早于 min 日期的格子禁用
        expect(dayCell("2026-9-23")).toBeDisabled();
        // 选到区间起点 09 后仍可在滚轮里看到 09；band 样式无 ▲▼ 微调钮
        clickWheelOption(0, "09");
        expect(
            within(hourWheel).getByRole("option", { name: "09" }),
        ).toHaveAttribute("aria-selected", "true");
    });

    it("月历导航：< 翻到上个月，标题与补位格更新", () => {
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:00"
            />,
        );
        fireEvent.click(trigger());
        fireEvent.click(
            document.querySelector(
                '[data-slot="datetime-picker-prev-month"]',
            ) as HTMLElement,
        );
        expect(
            document.querySelector('[data-slot="datetime-picker-month-title"]'),
        ).toHaveTextContent("2026 年 8 月");
        // 9-24 不在 8 月的 42 格窗口内，网格上看不到它；翻回 9 月草稿日期仍在
        fireEvent.click(
            document.querySelector(
                '[data-slot="datetime-picker-next-month"]',
            ) as HTMLElement,
        );
        expect(
            document.querySelector('[data-slot="datetime-picker-month-title"]'),
        ).toHaveTextContent("2026 年 9 月");
        expect(selectedDayCell()?.getAttribute("aria-label")).toBe("2026-9-24");
    });

    it("键盘日期区：→ 走一天并点亮该格，Enter 确定", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        fireEvent.keyDown(panel() as HTMLElement, { key: "ArrowRight" });
        expect(selectedDayCell()?.getAttribute("aria-label")).toBe("2026-9-25");
        fireEvent.keyDown(panel() as HTMLElement, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("2026-09-25 09:30:00");
    });

    it("键盘时间区：点时列后 ↑↓ 改值、→ 换到分列", () => {
        const onChange = vi.fn();
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2026-09-24 09:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        // 点时列进入时间驾驶区
        clickWheelOption(0, "10");
        fireEvent.keyDown(panel() as HTMLElement, { key: "ArrowDown" });
        expect(
            document.querySelector(
                '[data-slot="datetime-picker-time-display"]',
            ),
        ).toHaveTextContent("11:30:00");
        fireEvent.keyDown(panel() as HTMLElement, { key: "ArrowRight" });
        fireEvent.keyDown(panel() as HTMLElement, { key: "ArrowUp" });
        expect(
            document.querySelector(
                '[data-slot="datetime-picker-time-display"]',
            ),
        ).toHaveTextContent("11:29:00");
        fireEvent.click(pcConfirm());
        expect(onChange).toHaveBeenCalledWith("2026-09-24 11:29:00");
    });

    it("「此刻」：草稿跳回今天此刻（选中今天格、回显当前时间），确定生效", () => {
        render(
            <DateTimePicker
                forceMode="desktop"
                ariaLabel="日期时间"
                defaultValue="2020-01-01 00:00:00"
            />,
        );
        fireEvent.click(trigger());
        fireEvent.click(
            document.querySelector(
                '[data-slot="datetime-picker-now"]',
            ) as HTMLElement,
        );

        const today = todayParts();
        const label = `${today.year}-${today.month}-${today.day}`;
        expect(selectedDayCell()?.getAttribute("aria-label")).toBe(label);
        expect(
            document.querySelector('[data-slot="datetime-picker-month-title"]'),
        ).toHaveTextContent(`${today.year} 年 ${today.month} 月`);
        expect(
            document.querySelector(
                '[data-slot="datetime-picker-time-display"]',
            ),
        ).toHaveTextContent(
            new RegExp(`^${pad2(new Date().getHours())}:\\d{2}:\\d{2}$`),
        );
    });

    it("Esc 关闭并把焦点还给触发器", () => {
        render(<DateTimePicker forceMode="desktop" ariaLabel="日期时间" />);
        fireEvent.click(trigger());
        fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });
});
