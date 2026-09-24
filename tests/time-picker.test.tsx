import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { TimePicker } from "@/components/responsive/time-picker";

/**
 * TimePicker 双模式行为测试（矩阵 §4 要求：h5 / pc 各一组「选值 + 边界」）
 *
 * 重点不是「渲染出来了」，而是两端的**外壳差异**与**共同语义**：
 *   - 外壳：H5 走 Popup 底部弹层 + 顶部工具条（取消 · 标题 · 确定）；
 *           PC 走 Radix 锚定浮层 + 底部「取消 / 确定」条
 *   - 共同：两端都是 N 列滚轮（time-picker-wheel），都恒走「暂存 → 确定」
 *   - 区间：两端都复用「开始/结束」两段式
 *
 * 所有用例都显式给 min/max 与 defaultValue，**不依赖运行当时的时刻** ——
 * 否则「默认落现在」这条路径会让测试随时变红。
 *
 * 滚轮的真实滚动在 jsdom 里不会发生（不做布局），因此「选值」路径统一走「点某一项」；
 * 「滚到哪停在哪个值」由 tests/time-value.test.ts 的纯函数覆盖。
 */

const MIN = "00:00:00";
const MAX = "23:59:59";
const RANGE_VALUE: [string, string] = ["08:30:00", "18:45:00"];

function trigger(): HTMLElement {
    return screen.getByRole("combobox");
}

/** PC 的锚定浮层容器（H5 不渲染它 —— 滚轮行在 H5 侧是 popup 的子节点） */
function panel(): HTMLElement | null {
    return document.querySelector('[data-slot="time-picker-panel"]');
}

function wheels(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll('[data-slot="time-picker-wheel"]'),
    );
}

function wheelRow(): HTMLElement | null {
    return document.querySelector('[data-slot="time-picker-wheels"]');
}

/** 每次都重新取 DOM，不缓存节点（滚轮点一次可能联动重建） */
function clickWheelOption(wheelIndex: number, name: string): void {
    const wheel = wheels()[wheelIndex];
    fireEvent.click(within(wheel).getByRole("option", { name }));
}

/** H5 的工具条确定按钮（PC 用底部条上的 time-picker-confirm） */
function confirmButton(): HTMLButtonElement {
    return document.querySelector(
        '[data-slot="panel-header-confirm"]',
    ) as HTMLButtonElement;
}

/** PC 底部条的确定按钮 */
function pcConfirm(): HTMLButtonElement {
    return document.querySelector(
        '[data-slot="time-picker-confirm"]',
    ) as HTMLButtonElement;
}

function rangeTabs(): HTMLElement | null {
    return document.querySelector('[data-slot="time-picker-range-tabs"]');
}

describe("h5 mode", () => {
    it('触发器自带 data-mode="h5"，未展开时不渲染面板', () => {
        render(<TimePicker forceMode="mobile" ariaLabel="时间" />);

        expect(trigger()).toHaveAttribute("data-mode", "h5");
        expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expect(panel()).toBeNull();
        expect(screen.getByText("请选择")).toBeInTheDocument();
    });

    it("展开后走 Popup 底部弹层：三列滚轮 + 工具栏，且不经过锚定浮层", () => {
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="时间"
                min={MIN}
                max={MAX}
            />,
        );
        fireEvent.click(trigger());

        expect(trigger()).toHaveAttribute("aria-expanded", "true");
        expect(
            document.querySelector('[data-slot="popup"]'),
        ).toBeInTheDocument();
        expect(
            document.querySelector('[data-slot="panel-header"]'),
        ).toBeInTheDocument();
        expect(within(wheelRow()!).getAllByRole("listbox")).toHaveLength(3);
        // 与 PC 的分野：H5 完全没有 Radix 的锚定浮层与底部「取消 / 确定」条
        expect(panel()).toBeNull();
        expect(pcConfirm()).toBeNull();
    });

    it("滚轮点选只写草稿，点「确定」才回调；关掉即丢弃", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="时间"
                min={MIN}
                max={MAX}
                defaultValue="10:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        clickWheelOption(0, "12");
        // 关键行为：只是草稿，业务值还没动
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.click(confirmButton());
        expect(onChange).toHaveBeenCalledWith("12:30:00");
    });

    it("「取消」丢弃草稿，重新打开回到已提交值", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="时间"
                value="10:30:00"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        clickWheelOption(0, "12");
        fireEvent.click(
            document.querySelector(
                '[data-slot="panel-header-cancel"]',
            ) as HTMLElement,
        );
        expect(onChange).not.toHaveBeenCalled();
        expect(trigger()).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(trigger());
        const hourWheel = wheels()[0];
        expect(
            within(hourWheel).getByRole("option", {
                name: "10",
                selected: true,
            }),
        ).toBeInTheDocument();
    });

    it("区间模式：两段式端点切换，两端都选上「确定」才可用", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                defaultValue={RANGE_VALUE}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        const tabs = rangeTabs() as HTMLElement;
        expect(tabs).toBeInTheDocument();

        clickWheelOption(0, "12");

        fireEvent.click(within(tabs).getByRole("tab", { name: "结束时间" }));
        clickWheelOption(0, "20");
        expect(confirmButton()).toBeEnabled();

        fireEvent.click(confirmButton());
        expect(onChange).toHaveBeenCalledWith(["12:30:00", "20:45:00"]);
    });

    it("区间模式（空值）：起点选完仍禁用确定，选满两端才提交有序区间", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        expect(confirmButton()).toBeDisabled();
        clickWheelOption(0, "12");
        expect(confirmButton()).toBeDisabled();

        fireEvent.click(
            within(rangeTabs() as HTMLElement).getByRole("tab", {
                name: "结束时间",
            }),
        );
        clickWheelOption(0, "20");
        expect(confirmButton()).toBeEnabled();
        fireEvent.click(confirmButton());

        const result = (onChange.mock.calls[0] as string[])[0];
        expect(Array.isArray(result)).toBe(true);
        const pair = result as unknown as [string, string];
        expect(pair).toHaveLength(2);
        // 有序区间（'HH:mm:ss' 定宽，字典序即时间序）
        expect(pair[0] <= pair[1]).toBe(true);
    });

    it("区间非法（开始 ≥ 结束）：确定禁用并提示，改回合法区间后才放行（与 PC 同一判据）", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        // 起点选 20 点、终点选 12 点 → 开始晚于结束
        clickWheelOption(0, "20");
        fireEvent.click(
            within(rangeTabs() as HTMLElement).getByRole("tab", {
                name: "结束时间",
            }),
        );
        clickWheelOption(0, "12");

        expect(confirmButton()).toBeDisabled();
        expect(screen.getByText("开始时间须小于结束时间")).toHaveAttribute(
            "data-slot",
            "time-picker-range-hint",
        );
        fireEvent.click(confirmButton());
        expect(onChange).not.toHaveBeenCalled();

        // 回开始端把起点改到 08 点：提示消失、确定可用
        fireEvent.click(
            within(rangeTabs() as HTMLElement).getByRole("tab", {
                name: "开始时间",
            }),
        );
        clickWheelOption(0, "08");
        expect(screen.queryByText("开始时间须小于结束时间")).toBeNull();
        expect(confirmButton()).toBeEnabled();

        fireEvent.click(confirmButton());
        expect(onChange).toHaveBeenCalledTimes(1);
        const result = (onChange.mock.calls[0] as string[][])[0];
        expect(
            (result as unknown as [string, string])[0].startsWith("08:"),
        ).toBe(true);
        expect(
            (result as unknown as [string, string])[1].startsWith("12:"),
        ).toBe(true);
    });

    it("columnsType 裁剪列：只铺时分两列，回显格式跟着列走", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="时分"
                columnsType={["hour", "minute"]}
                min={MIN}
                max={MAX}
                defaultValue="10:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        expect(wheels()).toHaveLength(2);
        clickWheelOption(0, "12");
        fireEvent.click(confirmButton());
        // 默认 format 由实际列推出（'HH:mm'），不是硬编码的 'HH:mm:ss'
        expect(onChange).toHaveBeenCalledWith("12:30");
    });

    it("clearable：有值时出现清除按钮，清除回调 undefined", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="mobile"
                ariaLabel="时间"
                value="10:30:00"
                clearable
                onChange={onChange}
            />,
        );

        expect(screen.getByText("10:30:00")).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText("清除"));
        expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it("disabled：点击不展开，也不可聚焦", () => {
        render(<TimePicker forceMode="mobile" ariaLabel="时间" disabled />);
        fireEvent.click(trigger());

        expect(panel()).toBeNull();
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expect(trigger()).toHaveAttribute("aria-disabled", "true");
    });
});

describe("pc mode", () => {
    it("触发器是 pc 形态；展开是锚定浮层里的滚轮（无 Popup、无顶部工具条）", () => {
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="时间"
                defaultValue="10:30:00"
            />,
        );

        expect(trigger()).toHaveAttribute("data-mode", "pc");
        fireEvent.click(trigger());

        expect(panel()).toBeInTheDocument();
        // 与 H5 同款的三列滚轮
        expect(within(panel()!).getAllByRole("listbox")).toHaveLength(3);
        expect(wheelRow()).toHaveAttribute("data-mode", "pc");
        // 与 H5 的分野：PC 不经过 Popup，也没有顶部工具条；确认走底部条
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();
        expect(document.querySelector('[data-slot="panel-header"]')).toBeNull();
        expect(
            document.querySelector('[data-slot="time-picker-footer"]'),
        ).toBeInTheDocument();
    });

    it("单值也走「暂存 → 确定」：滚一次只写草稿，点「确定」才提交并关闭", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="时间"
                min={MIN}
                max={MAX}
                defaultValue="10:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        clickWheelOption(0, "12");
        // 滚轮要三列都调好才算选完，第一列一动就提交关闭是没法用的
        expect(onChange).not.toHaveBeenCalled();
        expect(trigger()).toHaveAttribute("aria-expanded", "true");

        fireEvent.click(pcConfirm());
        expect(onChange).toHaveBeenCalledWith("12:30:00");
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });

    it("键盘：↑↓ 改当前列的值、Enter 确定、Esc 取消", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="时间"
                min={MIN}
                max={MAX}
                defaultValue="10:30:00"
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());
        const content = panel() as HTMLElement;

        // 打开时方向键驾驶时列，ArrowDown 把时 +1（只写草稿，滚轮跟着滚到 11）
        fireEvent.keyDown(content, { key: "ArrowDown" });
        expect(
            within(wheels()[0]).getByRole("option", {
                name: "11",
                selected: true,
            }),
        ).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.keyDown(content, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("11:30:00");

        // 重新打开后 Esc 关闭
        fireEvent.click(trigger());
        fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });

    it("键盘：← → 换列（data-active 切换到目标列），Home/End 跳到列边界", () => {
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="时间"
                min={MIN}
                max={MAX}
                defaultValue="10:30:00"
            />,
        );
        fireEvent.click(trigger());
        const content = panel() as HTMLElement;

        // 首列默认高亮；右移一格到分列，End 把分跳到 59
        expect(wheels()[0]).toHaveAttribute("data-active", "true");
        fireEvent.keyDown(content, { key: "ArrowRight" });
        expect(wheels()[1]).toHaveAttribute("data-active", "true");
        expect(wheels()[0]).not.toHaveAttribute("data-active");

        fireEvent.keyDown(content, { key: "End" });
        expect(
            within(wheels()[1]).getByRole("option", {
                name: "59",
                selected: true,
            }),
        ).toBeInTheDocument();

        // 左移回时列，Home 把时跳到 00
        fireEvent.keyDown(content, { key: "ArrowLeft" });
        fireEvent.keyDown(content, { key: "Home" });
        expect(
            within(wheels()[0]).getByRole("option", {
                name: "00",
                selected: true,
            }),
        ).toBeInTheDocument();
    });

    it("区间模式：两段式 + 选满两端后须点「确定」才提交（不再选满即关）", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        const tabs = rangeTabs() as HTMLElement;
        expect(tabs).toBeInTheDocument();
        expect(wheels()).toHaveLength(3);
        // 区间底部出现「取消 / 确定」条（区别于 H5 的 panel-header）
        const confirm = pcConfirm();
        expect(confirm).toBeInTheDocument();

        // 第一下 = 选起点（空值区间，不会立即提交）
        clickWheelOption(0, "12");
        expect(onChange).not.toHaveBeenCalled();
        // 只选了起点，确定仍禁用
        expect(confirm).toBeDisabled();
        // 滚轮有多列，滚一下不得自动跳到「结束时间」端，仍停在开始端
        expect(
            within(tabs).getByRole("tab", { name: "开始时间" }),
        ).toHaveAttribute("data-active", "true");

        // 手动切到「结束时间」端再选终点（与 H5 同一套交互）
        fireEvent.click(within(tabs).getByRole("tab", { name: "结束时间" }));
        clickWheelOption(0, "20");
        expect(onChange).not.toHaveBeenCalled();
        expect(confirm).toBeEnabled();

        // 点「确定」才提交并关闭
        fireEvent.click(confirm);
        const result = (onChange.mock.calls[0] as string[])[0];
        expect(Array.isArray(result)).toBe(true);
        const pair = result as unknown as [string, string];
        expect(pair).toHaveLength(2);
        expect(pair[0] <= pair[1]).toBe(true);
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
    });

    it("区间模式：结束时间早于开始时间时「确定」禁用并给出提示", () => {
        const onChange = vi.fn();
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                onChange={onChange}
            />,
        );
        fireEvent.click(trigger());

        // 起点选 20，切到结束端选 12（结束 < 开始）
        clickWheelOption(0, "20");
        fireEvent.click(
            within(rangeTabs() as HTMLElement).getByRole("tab", {
                name: "结束时间",
            }),
        );
        clickWheelOption(0, "12");

        const confirm = pcConfirm();
        expect(confirm).toBeDisabled();
        expect(
            document.querySelector('[data-slot="time-picker-range-hint"]'),
        ).toBeInTheDocument();
        expect(onChange).not.toHaveBeenCalled();
    });

    it("区间模式：端点在滚轮内以 data-selected 标记", () => {
        render(
            <TimePicker
                forceMode="desktop"
                ariaLabel="区间"
                type="range"
                min={MIN}
                max={MAX}
                defaultValue={RANGE_VALUE}
            />,
        );
        fireEvent.click(trigger());

        const hourWheel = wheels()[0];
        expect(
            within(hourWheel).getByRole("option", {
                name: "08",
                selected: true,
            }),
        ).toBeInTheDocument();
    });

    it("disabled：点击不展开", () => {
        render(<TimePicker forceMode="desktop" ariaLabel="时间" disabled />);
        fireEvent.click(trigger());

        expect(panel()).toBeNull();
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expect(trigger()).toHaveAttribute("aria-disabled", "true");
    });
});
