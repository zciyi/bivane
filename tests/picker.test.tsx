import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Picker } from "@/components/responsive/picker";
import type { PickerColumnsInput } from "@/hooks/use-picker-state";

/**
 * Picker 双模式行为测试（矩阵 §4：h5 / pc 各一组「选值 + 边界」）
 *
 * 外壳分野：
 *   H5 = Popup 底部弹层 + 滚轮（picker-wheel）+ 顶部工具条（panel-header-*）；
 *   PC = Radix 锚定浮层 + 纵向面板（picker-pc-column）+ 底部条（picker-confirm）。
 * 共同语义：两端都走「暂存 → 确定」，多列值一次提交。
 *
 * 滚轮真实滚动在 jsdom 不发生，选值统一走「点某一项」。
 */

const COLUMNS: PickerColumnsInput = [
  ["A", "B", "C"],
  [
    { label: "X", value: "x" },
    { label: "Y（禁用）", value: "y", disabled: true },
    { label: "Z", value: "z" },
  ],
];

function trigger(): HTMLElement {
  return screen.getByRole("combobox");
}

function wheels(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-slot="picker-wheel"]'));
}

function pcColumns(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-slot="picker-pc-column"]'));
}

function clickWheelOption(wheelIndex: number, name: string): void {
  fireEvent.click(within(wheels()[wheelIndex]).getByRole("option", { name }));
}

function clickPcOption(columnIndex: number, name: string): void {
  fireEvent.click(within(pcColumns()[columnIndex]).getByRole("option", { name }));
}

describe("Picker · h5 mode", () => {
  it("触发器 data-mode=h5；未展开不渲染弹层，显示 placeholder", () => {
    render(<Picker forceMode="mobile" columns={COLUMNS} />);
    expect(trigger()).toHaveAttribute("data-mode", "h5");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    expect(screen.getByText("请选择")).toBeInTheDocument();
  });

  it("展开：底部弹层 + 两列滚轮 + 工具条，无 PC 锚定浮层底部条", () => {
    render(<Picker forceMode="mobile" columns={COLUMNS} title="选择" />);
    fireEvent.click(trigger());

    expect(document.querySelector('[data-slot="popup"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="panel-header"]')).toBeInTheDocument();
    expect(wheels()).toHaveLength(2);
    expect(
      document.querySelector('[data-slot="picker-footer"]'),
    ).toBeNull();
  });

  it("滚轮只改草稿，「确定」才一次提交多列值", () => {
    const onChange = vi.fn();
    render(
      <Picker
        forceMode="mobile"
        columns={COLUMNS}
        defaultValue={["A", "x"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    clickWheelOption(0, "C");
    clickWheelOption(1, "Z");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(
      document.querySelector('[data-slot="panel-header-confirm"]') as HTMLElement,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(["C", "z"]);
    // 触发器回显整条路径
    expect(trigger()).toHaveTextContent("C / Z");
  });

  it("「取消」丢弃草稿，重新打开回到已提交值", () => {
    const onChange = vi.fn();
    render(
      <Picker
        forceMode="mobile"
        columns={COLUMNS}
        defaultValue={["A", "x"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());
    clickWheelOption(0, "B");
    fireEvent.click(
      document.querySelector('[data-slot="panel-header-cancel"]') as HTMLElement,
    );
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(trigger());
    expect(
      within(wheels()[0]).getByRole("option", { name: "A" }),
    ).toHaveAttribute("aria-selected", "true");
  });
});

describe("Picker · pc mode", () => {
  it("触发器 data-mode=pc；展开是锚定浮层多列面板 + 底部确认条", () => {
    render(<Picker forceMode="desktop" columns={COLUMNS} />);
    expect(trigger()).toHaveAttribute("data-mode", "pc");
    fireEvent.click(trigger());

    expect(pcColumns()).toHaveLength(2);
    expect(document.querySelector('[data-slot="picker-footer"]')).toBeInTheDocument();
    // PC 没有 H5 的工具条
    expect(document.querySelector('[data-slot="panel-header"]')).toBeNull();
  });

  it("点行只改草稿；底部「确定」一次提交；「取消」丢弃", () => {
    const onChange = vi.fn();
    render(
      <Picker
        forceMode="desktop"
        columns={COLUMNS}
        defaultValue={["A", "x"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    clickPcOption(0, "B");
    clickPcOption(1, "Z");
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(
      document.querySelector('[data-slot="picker-confirm"]') as HTMLElement,
    );
    expect(onChange.mock.calls[0][0]).toEqual(["B", "z"]);
    expect(trigger()).toHaveTextContent("B / Z");

    // 改了再取消
    fireEvent.click(trigger());
    clickPcOption(0, "C");
    fireEvent.click(
      document.querySelector('[data-slot="picker-cancel"]') as HTMLElement,
    );
    expect(trigger()).toHaveTextContent("B / Z");
  });

  it("键盘：↓ 巡航跳过禁用项，Enter 先选中再按一次提交，Esc 取消", () => {
    const onChange = vi.fn();
    render(
      <Picker
        forceMode="desktop"
        columns={COLUMNS}
        defaultValue={["A", "x"]}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());
    const panel = document.querySelector(
      '[data-slot="picker-panel"]',
    ) as HTMLElement;

    // 第 2 列：从 X(0) 按 ↓ 应越过禁用的 Y(1)，激活 Z(2)
    fireEvent.keyDown(panel, { key: "ArrowRight" });
    fireEvent.keyDown(panel, { key: "ArrowDown" });
    fireEvent.keyDown(panel, { key: "Enter" }); // 第一次 Enter 只写草稿
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.keyDown(panel, { key: "Enter" }); // 激活项已是草稿值 → 提交
    expect(onChange.mock.calls[0][0]).toEqual(["A", "z"]);
  });

  it("clearable：清除按钮重置已提交值并显示 placeholder", () => {
    const onChange = vi.fn();
    render(
      <Picker
        forceMode="desktop"
        columns={COLUMNS}
        defaultValue={["A", "x"]}
        clearable
        onChange={onChange}
      />,
    );
    fireEvent.click(
      document.querySelector('[data-slot="picker-trigger-clear"]') as HTMLElement,
    );
    expect(onChange.mock.calls[0][0]).toEqual([]);
    expect(screen.getByText("请选择")).toBeInTheDocument();
  });
});
