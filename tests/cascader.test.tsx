import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Cascader } from "@/components/responsive/cascader";
import type { CascaderDataItem } from "@/hooks/use-cascader-state";

/**
 * Cascader 双模式行为测试（矩阵 §4：h5 / pc 各一组）
 *
 * H5 = 底部弹层联动滚轮（picker-wheel 三列），改父列子列重算，暂存 → 确定；
 * PC = 锚定浮层面包屑 + 逐级多列面板，点叶子即生效；searchable 时路径全文搜索。
 */

const AREA: CascaderDataItem[] = [
  {
    label: "浙江",
    value: "zj",
    children: [
      {
        label: "杭州",
        value: "hz",
        children: [
          { label: "西湖区", value: "xh" },
          { label: "拱墅区", value: "gs" },
        ],
      },
      { label: "宁波", value: "nb", children: [{ label: "海曙区", value: "hs" }] },
    ],
  },
  {
    label: "江苏",
    value: "js",
    children: [
      { label: "南京", value: "nj", children: [{ label: "玄武区", value: "xw" }] },
    ],
  },
];

function trigger(): HTMLElement {
  return screen.getByRole("combobox");
}

function wheels(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-slot="picker-wheel"]'));
}

function pcColumns(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-slot="cascader-pc-column"]'));
}

function clickWheelOption(wheelIndex: number, name: string): void {
  fireEvent.click(within(wheels()[wheelIndex]).getByRole("option", { name }));
}

function clickPcOption(columnIndex: number, name: string): void {
  fireEvent.click(within(pcColumns()[columnIndex]).getByRole("option", { name }));
}

describe("Cascader · h5 mode", () => {
  it("展开三列联动滚轮（省/市/区）+ 工具条", () => {
    render(<Cascader forceMode="mobile" options={AREA} />);
    fireEvent.click(trigger());

    expect(document.querySelector('[data-slot="popup"]')).toBeInTheDocument();
    expect(wheels()).toHaveLength(3);
    expect(document.querySelector('[data-slot="panel-header"]')).toBeInTheDocument();
  });

  it("改父列，子列整体重算为各自第一个可选项；确定提交完整路径", () => {
    const onChange = vi.fn();
    render(<Cascader forceMode="mobile" options={AREA} onChange={onChange} />);
    fireEvent.click(trigger());

    // 默认播种在 浙江/杭州/西湖区；改选「江苏」后，市列只剩南京、区列只剩玄武区
    clickWheelOption(0, "江苏");
    expect(
      within(wheels()[1]).queryByRole("option", { name: "杭州" }),
    ).toBeNull();
    expect(
      within(wheels()[1]).getByRole("option", { name: "南京" }),
    ).toBeInTheDocument();
    expect(
      within(wheels()[2]).getByRole("option", { name: "玄武区" }),
    ).toBeInTheDocument();

    // 中途只是联动草稿，不提交
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(
      document.querySelector('[data-slot="panel-header-confirm"]') as HTMLElement,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual(["js", "nj", "xw"]);
    expect(trigger()).toHaveTextContent("江苏 / 南京 / 玄武区");
  });

  it("中途改市级：省级保留，区级重置", () => {
    render(<Cascader forceMode="mobile" options={AREA} />);
    fireEvent.click(trigger());

    clickWheelOption(1, "宁波");
    expect(
      within(wheels()[0]).getByRole("option", { name: "浙江" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(wheels()[2]).getByRole("option", { name: "海曙区" }),
    ).toBeInTheDocument();
  });
});

describe("Cascader · pc mode", () => {
  it("初始只有根列 + 根层面包屑；逐级向右展开，点叶子提交并关闭", () => {
    const onChange = vi.fn();
    render(<Cascader forceMode="desktop" options={AREA} onChange={onChange} />);
    fireEvent.click(trigger());

    expect(pcColumns()).toHaveLength(1);
    expect(
      screen.getByRole("navigation", { name: "层级路径" }),
    ).toHaveTextContent("请选择");

    clickPcOption(0, "浙江");
    expect(pcColumns()).toHaveLength(2);
    clickPcOption(1, "杭州");
    expect(pcColumns()).toHaveLength(3);

    expect(onChange).not.toHaveBeenCalled();
    clickPcOption(2, "西湖区");
    expect(onChange.mock.calls[0][0]).toEqual(["zj", "hz", "xh"]);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(trigger()).toHaveTextContent("浙江 / 杭州 / 西湖区");
  });

  it("面包屑可点回退：点「浙江」把链截回省级", () => {
    render(<Cascader forceMode="desktop" options={AREA} />);
    fireEvent.click(trigger());
    clickPcOption(0, "浙江");
    clickPcOption(1, "杭州");
    expect(pcColumns()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "浙江" }));
    expect(pcColumns()).toHaveLength(2);
  });

  it("已有值展开即定位：三列都在且选中链高亮", () => {
    render(<Cascader forceMode="desktop" options={AREA} defaultValue={["zj", "nb", "hs"]} />);
    fireEvent.click(trigger());

    expect(pcColumns()).toHaveLength(3);
    expect(
      within(pcColumns()[1]).getByRole("option", { name: "宁波" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(pcColumns()[2]).getByRole("option", { name: "海曙区" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("searchable：按路径全文过滤，点结果直接提交整条路径", () => {
    const onChange = vi.fn();
    render(
      <Cascader
        forceMode="desktop"
        options={AREA}
        searchable
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "杭州" } });
    // 杭州下两个叶子都命中
    const results = document.querySelectorAll('[data-slot="cascader-search-result"]');
    expect(results).toHaveLength(2);

    fireEvent.click(screen.getByRole("option", { name: /拱墅区/ }));
    expect(onChange.mock.calls[0][0]).toEqual(["zj", "hz", "gs"]);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("搜索无命中展示空态文案", () => {
    render(<Cascader forceMode="desktop" options={AREA} searchable />);
    fireEvent.click(trigger());
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "查无此地" } });
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });
});
