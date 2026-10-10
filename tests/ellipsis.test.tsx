import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Ellipsis } from "@/components/ui/ellipsis";

/**
 * Ellipsis 行为测试。
 * jsdom 不做布局：默认 scrollHeight/lineHeight 都是 0（=量不出来，不显示开关）；
 * 截断判定本身依赖布局尺寸，几何分支统一 mock getComputedStyle + scrollHeight 验证。
 */

const LONG_TEXT =
  "第一段内容。第二行还在继续。第三行已经超出。第四行彻底溢出两行的高度。";

/** lineHeight=20 时，rows 行高度 = rows × 20，scrollHeight 超过它（+1px 容差）即溢出 */
function mockMetrics(scrollHeight: number, lineHeight = 20): void {
  // 在真实 style 对象上遮蔽两个命名属性：不能整体替换 getComputedStyle
  // （会丢掉 getPropertyValue，dom-accessibility-api 算按钮名时报错），
  // 也不能 spy 原型（jsdom 的 WebIDL 命名属性不挂原型）
  const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((...args) => {
    const style = original(...(args as [Element]));
    Object.defineProperty(style, "lineHeight", {
      get: () => `${lineHeight}px`,
      configurable: true,
    });
    Object.defineProperty(style, "fontSize", {
      get: () => "14px",
      configurable: true,
    });
    return style;
  });
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
    scrollHeight,
  );
}

function root(): HTMLElement {
  return document.querySelector('[data-slot="ellipsis"]') as HTMLElement;
}

function textNode(): HTMLElement {
  return root().querySelector('[data-slot="ellipsis-text"]') as HTMLElement;
}

describe("Ellipsis", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("量不出布局尺寸（jsdom / SSR 首帧）：不显示开关，也不报错", () => {
    render(<Ellipsis>{LONG_TEXT}</Ellipsis>);
    expect(root()).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("实测不超行数：不显示开关", () => {
    mockMetrics(38); // 2 行阈值 41，38 没超
    render(<Ellipsis rows={2}>{LONG_TEXT}</Ellipsis>);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("实测超行数：默认收起，文本挂 line-clamp（2 行）并出现「展开」", () => {
    mockMetrics(100);
    render(<Ellipsis rows={2}>{LONG_TEXT}</Ellipsis>);

    expect(root()).toHaveAttribute("data-expanded", "false");
    expect(textNode().style.webkitLineClamp).toBe("2");
    // 截断三件套：盒模型 + 纵向 + 裁剪
    expect(textNode().className).toContain("-webkit-box");
    expect(textNode().className).toContain("overflow-hidden");
    const action = screen.getByRole("button", { name: /展开/ });
    expect(action).toHaveAttribute("aria-expanded", "false");
  });

  it("点击「展开」：去掉截断、出现「收起」；再点收回", () => {
    mockMetrics(100);
    render(<Ellipsis rows={2}>{LONG_TEXT}</Ellipsis>);

    fireEvent.click(screen.getByRole("button", { name: /展开/ }));
    expect(root()).toHaveAttribute("data-expanded", "true");
    expect(textNode().style.webkitLineClamp).toBe("");
    expect(textNode().className).not.toContain("overflow-hidden");
    expect(
      screen.getByRole("button", { name: /收起/ }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /收起/ }));
    expect(root()).toHaveAttribute("data-expanded", "false");
    expect(textNode().style.webkitLineClamp).toBe("2");
    expect(
      screen.getByRole("button", { name: /展开/ }),
    ).toBeInTheDocument();
  });

  it("rows=3 写入 3 行截断；rows=0 等非法值回落 1 行", () => {
    mockMetrics(100);
    const { rerender } = render(<Ellipsis rows={3}>{LONG_TEXT}</Ellipsis>);
    expect(textNode().style.webkitLineClamp).toBe("3");

    rerender(<Ellipsis rows={0}>{LONG_TEXT}</Ellipsis>);
    expect(textNode().style.webkitLineClamp).toBe("1");
  });

  it("受控：点击只上报，不自行变更；expanded 由外部决定", () => {
    mockMetrics(100);
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <Ellipsis
        rows={2}
        expanded={false}
        onExpandedChange={onExpandedChange}
      >
        {LONG_TEXT}
      </Ellipsis>,
    );

    fireEvent.click(screen.getByRole("button", { name: /展开/ }));
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    // 外部没放行：仍收起
    expect(root()).toHaveAttribute("data-expanded", "false");

    rerender(
      <Ellipsis rows={2} expanded onExpandedChange={onExpandedChange}>
        {LONG_TEXT}
      </Ellipsis>,
    );
    expect(root()).toHaveAttribute("data-expanded", "true");
    fireEvent.click(screen.getByRole("button", { name: /收起/ }));
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it("自定义展开/收起文案", () => {
    mockMetrics(100);
    render(
      <Ellipsis rows={2} expandText="查看全部" collapseText="收起来">
        {LONG_TEXT}
      </Ellipsis>,
    );
    expect(
      screen.getByRole("button", { name: "查看全部" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看全部" }));
    expect(
      screen.getByRole("button", { name: "收起来" }),
    ).toBeInTheDocument();
  });

  it("defaultExpanded=true：首帧即展开态，无截断内联", () => {
    mockMetrics(100);
    render(<Ellipsis defaultExpanded>{LONG_TEXT}</Ellipsis>);
    expect(root()).toHaveAttribute("data-expanded", "true");
    expect(textNode().style.webkitLineClamp).toBe("");
    expect(
      screen.getByRole("button", { name: /收起/ }),
    ).toBeInTheDocument();
  });
});
