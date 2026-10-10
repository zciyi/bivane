import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  deriveLinkedColumns,
  derivePanelColumns,
  fillFirstEnabledPath,
  flattenLeaves,
  isValidLeafPath,
  matchLeafPath,
  normalizeOptions,
  resolvePath,
  searchLeaves,
  useCascaderState,
  withLinkedValue,
  type CascaderDataItem,
} from "@/hooks/use-cascader-state";

/**
 * Cascader 共享模型纯函数测试。
 * 重点：字段映射、路径截断、H5 联动列的「换父重置子列」、PC 面板「逐级展开不补选」、
 * 叶子摊平与路径全文搜索、半截路径不回显。
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

const tree = () => normalizeOptions(AREA);

describe("normalizeOptions", () => {
  it("支持 fieldNames 映射（Vant 风格 text/value/children）", () => {
    const mapped = normalizeOptions(
      [{ text: "广东", value: "gd", items: [{ text: "广州", value: "gz" }] }],
      { label: "text", children: "items" },
    );
    expect(mapped[0].label).toBe("广东");
    expect(mapped[0].children?.[0].label).toBe("广州");
  });

  it("缺 value 的项被标记禁用，不产生与正常值冲突的占位", () => {
    const mapped = normalizeOptions([{ label: "无值" }, { label: "正常", value: "ok" }]);
    expect(mapped[0].disabled).toBe(true);
    expect(mapped[1].disabled).toBe(false);
  });
});

describe("路径解析", () => {
  it("resolvePath 中途失效就地截断", () => {
    const chain = resolvePath(tree(), ["zj", "nb", "xh"]);
    // nb（宁波）的子列里没有 xh，链停在宁波
    expect(chain.map((o) => o.value)).toEqual(["zj", "nb"]);
  });

  it("只有完整叶子路径才算有效", () => {
    expect(isValidLeafPath(tree(), ["zj", "hz", "xh"])).toBe(true);
    expect(isValidLeafPath(tree(), ["zj", "hz"])).toBe(false);
    expect(isValidLeafPath(tree(), [])).toBe(false);
    expect(isValidLeafPath(tree(), ["zj", "xx", "xh"])).toBe(false);
  });

  it("fillFirstEnabledPath 无值时每级取第一个可选项补到叶子", () => {
    expect(fillFirstEnabledPath(tree()).map((o) => o.value)).toEqual([
      "zj",
      "hz",
      "xh",
    ]);
  });
});

describe("H5 联动列派生", () => {
  it("无播种时补到首个可选叶子，列数 = 树深", () => {
    const linked = deriveLinkedColumns(tree(), []);
    expect(linked.columns).toHaveLength(3);
    expect(linked.values).toEqual(["zj", "hz", "xh"]);
  });

  it("换父级后子列丢弃并重算为各自第一个可选项", () => {
    // 用户在第 0 列改选「江苏」：市/区两列应整体重算
    const nextValues = withLinkedValue(["zj", "hz", "xh"], 0, "js");
    const linked = deriveLinkedColumns(tree(), nextValues);
    expect(linked.values).toEqual(["js", "nj", "xw"]);
    expect(linked.columns[1].map((o) => o.value)).toEqual(["nj"]);
  });

  it("中途改市级：市级之前保留，区级重置", () => {
    const nextValues = withLinkedValue(["zj", "hz", "xh"], 1, "nb");
    const linked = deriveLinkedColumns(tree(), nextValues);
    expect(linked.values).toEqual(["zj", "nb", "hs"]);
  });
});

describe("PC 面板列派生", () => {
  it("不补选：空链只有根列；选父级向右展开一列；到叶子不再追加空列", () => {
    expect(derivePanelColumns(tree(), []).columns).toHaveLength(1);
    expect(derivePanelColumns(tree(), ["zj"]).columns).toHaveLength(2);
    const full = derivePanelColumns(tree(), ["zj", "hz", "xh"]);
    expect(full.columns).toHaveLength(3);
    expect(full.chain.map((o) => o.value)).toEqual(["zj", "hz", "xh"]);
  });

  it("失效导航值就地截断，不渲染空列", () => {
    const { columns, chain } = derivePanelColumns(tree(), ["zzz", "hz"]);
    expect(columns).toHaveLength(1);
    expect(chain).toEqual([]);
  });
});

describe("叶子摊平与搜索", () => {
  it("摊平只保留叶子且排除禁用叶子", () => {
    const withDisabled = normalizeOptions([
      { label: "可用省", value: "a", children: [{ label: "可用市", value: "b" }] },
      { label: "禁用省", value: "c", disabled: true, children: [{ label: "禁用市", value: "d" }] },
    ]);
    const leaves = flattenLeaves(withDisabled);
    expect(leaves.map((l) => l.values)).toEqual([["a", "b"]]);
  });

  it("按路径全文命中：上级地名也能搜到叶子", () => {
    const leaves = searchLeaves(tree(), "杭州");
    expect(leaves.map((l) => l.values)).toEqual([
      ["zj", "hz", "xh"],
      ["zj", "hz", "gs"],
    ]);
    expect(searchLeaves(tree(), "西湖")[0]?.values).toEqual(["zj", "hz", "xh"]);
    expect(searchLeaves(tree(), "不存在的地方")).toEqual([]);
    expect(searchLeaves(tree(), "  ")).toEqual([]);
  });

  it("matchLeafPath 空关键词不过滤", () => {
    const [leaf] = flattenLeaves(tree());
    expect(matchLeafPath(leaf, "")).toBe(true);
  });
});

describe("useCascaderState", () => {
  it("非受控提交带出完整选项链", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCascaderState({ options: AREA, onChange }),
    );
    act(() => {
      result.current.setValue(["js", "nj", "xw"]);
    });
    const [values, options] = onChange.mock.calls[0];
    expect(values).toEqual(["js", "nj", "xw"]);
    expect(options.map((o: { value: string }) => o.value)).toEqual(["js", "nj", "xw"]);
  });

  it("半截/失效路径不回显：selectedPath 为空，触发器应退 placeholder", () => {
    const { result } = renderHook(() =>
      useCascaderState({ options: AREA, value: ["zj", "hz"] }),
    );
    expect(result.current.selectedPath).toEqual([]);

    const { result: ok } = renderHook(() =>
      useCascaderState({ options: AREA, value: ["zj", "hz", "gs"] }),
    );
    expect(ok.current.selectedPath.map((o) => o.value)).toEqual(["zj", "hz", "gs"]);
  });
});
