import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Popover } from "@/components/responsive/popover";
import { resolvePopoverForm } from "@/components/ui/popover-parts";
import type { PopoverAction } from "@/components/ui/popover-parts";

/**
 * Popover 双模式行为测试（矩阵 §4：h5 / pc 各一组「开合 + 行点选 + 形态」）
 *
 * H5 的形态分界：纯 actions 直接数行（≤maxRows 气泡 / >maxRows 抽屉，jsdom
 * 读不到 token 时兜底 3）；自定义内容在 jsdom 量不到高度（offsetHeight=0），
 * 一律落气泡 —— 高度阈值由 resolvePopoverForm 纯函数单测兜底。
 */

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: "更多" });
}

function panel(): HTMLElement | null {
  return document.querySelector('[data-slot="popover-panel"]');
}

function drawer(): HTMLElement | null {
  return document.querySelector('[data-slot="popover-drawer"]');
}

function actions(count: number): PopoverAction[] {
  const labels = ["编辑", "分享", "收藏", "删除", "移动"];
  return labels.slice(0, count).map((text) => ({
    key: text,
    text,
    danger: text === "删除",
    onClick: vi.fn(),
  }));
}

/**
 * 面板外部按下（Radix Popover 设了 deferPointerDownOutside：
 * button=0 的外部按下不会立刻关闭，而是等随后的 document click 才关，
 * 与真实浏览器 pointerdown→click 序列保持一致就要两个事件都派发）
 */
function pressOutside(): void {
  const PointerEventCtor = (window.PointerEvent ??
    window.MouseEvent) as typeof MouseEvent;
  fireEvent(
    document.body,
    new PointerEventCtor("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
    }),
  );
  fireEvent.click(document.body);
}

describe("h5 mode", () => {
  it("未展开：触发器带 data-mode=h5 / aria-haspopup / aria-expanded=false", () => {
    render(
      <Popover actions={actions(3)} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    expect(trigger()).toHaveAttribute("data-mode", "h5");
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toBeNull();
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
  });

  it("3 个动作 → 轻量气泡（锚定浮层，非底部抽屉）", () => {
    render(
      <Popover actions={actions(3)} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    const tip = panel();
    expect(tip).not.toBeNull();
    expect(tip).toHaveAttribute("data-form", "bubble");
    expect(tip).toHaveAttribute("data-mode", "h5");
    expect(drawer()).toBeNull();
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    expect(within(tip!).getAllByRole("button")).toHaveLength(3);
  });

  it("4 个动作 → 底部抽屉（Popup），动作行 48px 密度", () => {
    render(
      <Popover actions={actions(4)} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    expect(panel()).toBeNull();
    expect(
      document.querySelector('[data-slot="popup"]'),
    ).toBeInTheDocument();
    const body = drawer();
    expect(body).not.toBeNull();
    expect(body).toHaveAttribute("data-form", "drawer");
    expect(within(body!).getAllByRole("button")).toHaveLength(4);
  });

  it("h5Form=bubble：4 个动作也强制轻量气泡，行数规则被短路", () => {
    render(
      <Popover actions={actions(4)} h5Form="bubble" forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    const tip = panel();
    expect(tip).not.toBeNull();
    expect(tip).toHaveAttribute("data-form", "bubble");
    expect(drawer()).toBeNull();
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    expect(within(tip!).getAllByRole("button")).toHaveLength(4);
  });

  it("h5Form=drawer：2 个动作也强制底部抽屉", () => {
    render(
      <Popover actions={actions(2)} h5Form="drawer" forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    expect(panel()).toBeNull();
    const body = drawer();
    expect(body).not.toBeNull();
    expect(body).toHaveAttribute("data-form", "drawer");
    expect(within(body!).getAllByRole("button")).toHaveLength(2);
  });

  it("maxRows=4：放宽阈值，4 个动作仍走气泡，5 个才进抽屉", () => {
    const { rerender } = render(
      <Popover actions={actions(4)} maxRows={4} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(panel()).toHaveAttribute("data-form", "bubble");

    // 保持打开：actions 增多触发布局 effect 重新判定（与行数规则同源）
    rerender(
      <Popover actions={actions(5)} maxRows={4} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    expect(panel()).toBeNull();
    expect(drawer()).not.toBeNull();
  });

  it("maxRows=2：收紧阈值，3 个动作就进抽屉", () => {
    render(
      <Popover actions={actions(3)} maxRows={2} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(drawer()).not.toBeNull();
    expect(panel()).toBeNull();
  });

  it("maxRows 非法（≤0）不采纳：落回默认阈值 3", () => {
    render(
      <Popover actions={actions(3)} maxRows={0} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(panel()).toHaveAttribute("data-form", "bubble");
  });

  it("h5Form 强制形态时 maxRows 不参与判定", () => {
    render(
      <Popover
        actions={actions(4)}
        maxRows={1}
        h5Form="bubble"
        forceMode="mobile"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    expect(panel()).toHaveAttribute("data-form", "bubble");
  });

  it("h5Form=drawer + 自定义内容：跳过测量探针，直接抽屉", () => {
    render(
      <Popover
        content="自定义提示文案"
        actions={actions(1)}
        h5Form="drawer"
        forceMode="mobile"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    expect(
      document.querySelector('[data-slot="popover-measure"]'),
    ).toBeNull();
    const body = drawer();
    expect(body).not.toBeNull();
    expect(within(body!).getByText("自定义提示文案")).toBeInTheDocument();
  });

  it("点动作行：业务回调触发并关闭气泡", async () => {
    const list = actions(3);
    render(
      <Popover actions={list} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    fireEvent.click(within(panel()!).getByRole("button", { name: "编辑" }));

    expect(list[0].onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("禁用行不触发回调、不关闭", () => {
    const list = actions(3);
    list[1].disabled = true;
    render(
      <Popover actions={list} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    const row = within(panel()!).getByRole("button", { name: "分享" });
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(list[1].onClick).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
  });

  it("closeOnClickAction=false：点行不关面板", () => {
    const list = actions(2);
    render(
      <Popover
        actions={list}
        closeOnClickAction={false}
        forceMode="mobile"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    fireEvent.click(within(panel()!).getByRole("button", { name: "编辑" }));
    expect(list[0].onClick).toHaveBeenCalledTimes(1);
    expect(panel()).not.toBeNull();
  });

  it("自定义内容渲染在动作列表上方", () => {
    render(
      <Popover
        content="自定义提示文案"
        actions={actions(1)}
        forceMode="mobile"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    // jsdom 量不到高度：带内容落气泡形态
    expect(panel()).not.toBeNull();
    expect(
      within(panel()!).getByText("自定义提示文案"),
    ).toBeInTheDocument();
    expect(
      within(panel()!).getByRole("button", { name: "编辑" }),
    ).toBeInTheDocument();
  });

  it("点气泡外部关闭", async () => {
    render(
      <Popover actions={actions(2)} forceMode="mobile">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(panel()).not.toBeNull();
    // Radix 在弹层挂载后的 setTimeout(0) 才注册 document pointerdown 监听
    // （避免把打开弹层的同一次点击判成外部点击）；Popper 也在异步帧里更新定位，
    // 整段包进 act 避免延迟状态更新漏到 act 外
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      pressOutside();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // 关闭后要么退场中（data-state=closed），要么 jsdom 无动画事件已卸载
    expect(panel()?.getAttribute("data-state")).not.toBe("open");
  });

  it("受控开合：点击只上报，不自行变更", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover
        actions={actions(2)}
        open={false}
        onOpenChange={onOpenChange}
        forceMode="mobile"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(panel()).toBeNull();
  });
});

describe("pc mode", () => {
  it("未展开：触发器 data-mode=pc，aria-expanded=false", () => {
    render(
      <Popover actions={actions(3)} forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    expect(trigger()).toHaveAttribute("data-mode", "pc");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toBeNull();
  });

  it("点击打开锚定浮层：aria-expanded 同步翻转，行用 PC 密度", () => {
    render(
      <Popover actions={actions(3)} forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    const tip = panel();
    expect(tip).not.toBeNull();
    expect(tip).toHaveAttribute("data-mode", "pc");
    expect(tip).toHaveAttribute("data-form", "bubble");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    const rows = within(tip!).getAllByRole("button");
    expect(rows).toHaveLength(3);
    // 36px 桌面密度，不是 H5 的 48px
    expect(rows[0].className).toContain("--bv-popover-pc-row-height");
    expect(rows[0].className).not.toContain("--bv-popover-h5-row-height");
  });

  it("键盘可导航：打开后焦点落在第一个动作行，Esc 关闭并还焦触发器", async () => {
    render(
      <Popover actions={actions(3)} forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    expect(document.activeElement?.textContent).toContain("编辑");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(panel()).toBeNull());
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("点动作行：回调触发并关闭", async () => {
    const list = actions(3);
    render(
      <Popover actions={list} forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    fireEvent.click(within(panel()!).getByRole("button", { name: "编辑" }));
    expect(list[0].onClick).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(panel()).toBeNull());
  });

  it("禁用行不可点", () => {
    const list = actions(2);
    list[0].disabled = true;
    render(
      <Popover actions={list} forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    const row = within(panel()!).getByRole("button", { name: "编辑" });
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(list[0].onClick).not.toHaveBeenCalled();
    expect(panel()).not.toBeNull();
  });

  it("自定义内容与动作行同时渲染", () => {
    render(
      <Popover
        content="面板说明"
        actions={actions(2)}
        forceMode="desktop"
      >
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(within(panel()!).getByText("面板说明")).toBeInTheDocument();
    expect(within(panel()!).getAllByRole("button")).toHaveLength(2);
  });

  it("h5Form 仅 H5 生效：PC 传 drawer 仍是锚定浮层", () => {
    render(
      <Popover actions={actions(4)} h5Form="drawer" forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());

    const tip = panel();
    expect(tip).not.toBeNull();
    expect(tip).toHaveAttribute("data-form", "bubble");
    expect(drawer()).toBeNull();
  });

  it("禁用触发器：点击打不开", () => {
    render(
      <Popover actions={actions(2)} disabled forceMode="desktop">
        <button type="button">更多</button>
      </Popover>,
    );
    fireEvent.click(trigger());
    expect(panel()).toBeNull();
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("resolvePopoverForm 纯函数", () => {
  it("纯 actions：数行，严格大于 maxRows 才进抽屉", () => {
    expect(
      resolvePopoverForm({
        actionCount: 3,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 3,
      }),
    ).toBe("bubble");
    expect(
      resolvePopoverForm({
        actionCount: 4,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 3,
      }),
    ).toBe("drawer");
  });

  it("带自定义内容：实测高度严格大于 maxRows 行高才进抽屉", () => {
    const base = { actionCount: 0, rowHeight: 48, maxRows: 3 };
    expect(resolvePopoverForm({ ...base, measuredHeight: 140 })).toBe(
      "bubble",
    );
    expect(resolvePopoverForm({ ...base, measuredHeight: 144 })).toBe(
      "bubble",
    );
    expect(resolvePopoverForm({ ...base, measuredHeight: 145 })).toBe(
      "drawer",
    );
  });

  it("maxRows 可改阈值：2 行阈值时第 3 行即进抽屉，高度阈值随行数变", () => {
    expect(
      resolvePopoverForm({
        actionCount: 2,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 2,
      }),
    ).toBe("bubble");
    expect(
      resolvePopoverForm({
        actionCount: 3,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 2,
      }),
    ).toBe("drawer");
    // 2 行高度 = 96px，97px 即超
    expect(
      resolvePopoverForm({
        actionCount: 0,
        measuredHeight: 97,
        rowHeight: 48,
        maxRows: 2,
      }),
    ).toBe("drawer");
  });

  it("preference 显式给形态时短路：行数 / maxRows / 实测高度都不再参与判定", () => {
    expect(
      resolvePopoverForm({
        actionCount: 4,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 3,
        preference: "bubble",
      }),
    ).toBe("bubble");
    expect(
      resolvePopoverForm({
        actionCount: 1,
        measuredHeight: 999,
        rowHeight: 48,
        maxRows: 9,
        preference: "drawer",
      }),
    ).toBe("drawer");
  });

  it("preference=auto（默认）等价于不传：按 maxRows 自动分界", () => {
    expect(
      resolvePopoverForm({
        actionCount: 4,
        measuredHeight: null,
        rowHeight: 48,
        maxRows: 3,
        preference: "auto",
      }),
    ).toBe("drawer");
  });
});
