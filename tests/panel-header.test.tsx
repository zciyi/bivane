import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { PanelHeader } from "@/components/ui/panel-header";

describe("PanelHeader（H5 弹层工具栏）", () => {
  it("渲染「取消 · 标题 · 确定」三件套与三个槽名", () => {
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="选择城市"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(
      container.querySelector('[data-slot="panel-header"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-slot="panel-header-title"]')
        ?.textContent,
    ).toBe("选择城市");
    expect(
      container.querySelector('[data-slot="panel-header-cancel"]')
        ?.textContent,
    ).toBe("取消");
    expect(
      container.querySelector('[data-slot="panel-header-confirm"]')
        ?.textContent,
    ).toBe("确定");
  });

  it("onBack 与 onCancel 互斥：给了 onBack 就不再渲染取消按钮", () => {
    const onBack = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="子层"
        onBack={onBack}
        onCancel={onCancel}
      />,
    );

    const back = container.querySelector('[data-slot="panel-header-back"]');
    expect(back).not.toBeNull();
    expect(back?.getAttribute("aria-label")).toBe("返回上一级");
    expect(
      container.querySelector('[data-slot="panel-header-cancel"]'),
    ).toBeNull();

    fireEvent.click(back as HTMLElement);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("取消与确定分别触发各自回调", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="t"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      container.querySelector(
        '[data-slot="panel-header-cancel"]',
      ) as HTMLElement,
    );
    fireEvent.click(
      container.querySelector(
        '[data-slot="panel-header-confirm"]',
      ) as HTMLElement,
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("自定义两侧文案", () => {
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="t"
        onCancel={() => {}}
        cancelText="Close"
        onConfirm={() => {}}
        confirmText="OK"
      />,
    );

    expect(
      container.querySelector('[data-slot="panel-header-cancel"]')
        ?.textContent,
    ).toBe("Close");
    expect(
      container.querySelector('[data-slot="panel-header-confirm"]')
        ?.textContent,
    ).toBe("OK");
  });

  it("confirmDisabled 时确定按钮禁用且不再触发", () => {
    const onConfirm = vi.fn();
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="t"
        onCancel={() => {}}
        onConfirm={onConfirm}
        confirmDisabled
      />,
    );

    const confirm = container.querySelector(
      '[data-slot="panel-header-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("纯标题头部：两侧按钮都不渲染", () => {
    const { container } = render(
      <PanelHeader mode="mobile" title="仅标题" />,
    );

    expect(
      container.querySelector('[data-slot="panel-header-title"]')
        ?.textContent,
    ).toBe("仅标题");
    expect(
      container.querySelector('[data-slot="panel-header-cancel"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="panel-header-confirm"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="panel-header-back"]'),
    ).toBeNull();
  });

  it("给了 breadcrumb 就替代标题，祖先层可点、当前层不可点", () => {
    const onJump = vi.fn();
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="不该出现"
        onBack={() => {}}
        breadcrumb={[
          { label: "根", onSelect: onJump },
          { label: "中" },
          { label: "当前层" },
        ]}
      />,
    );

    // 标题槽整段让位给面包屑，避免两套文案并存
    expect(
      container.querySelector('[data-slot="panel-header-title"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="panel-header-breadcrumb"]')
        ?.textContent,
    ).toBe("根/中/当前层");
    expect(
      container.querySelectorAll(
        '[data-slot="panel-header-crumb-separator"]',
      ),
    ).toHaveLength(2);
    // 只有给了 onSelect 的那一层是按钮，其余是纯文本
    expect(
      container.querySelector('[data-slot="panel-header-crumb"]')
        ?.textContent,
    ).toBe("根");
    expect(
      container.querySelectorAll(
        '[data-slot="panel-header-crumb-current"]',
      ),
    ).toHaveLength(2);
    // 返回箭头与面包屑可以并存（下钻中左键仍是「回上一层」）
    expect(
      container.querySelector('[data-slot="panel-header-back"]'),
    ).not.toBeNull();

    fireEvent.click(
      container.querySelector(
        '[data-slot="panel-header-crumb"]',
      ) as HTMLElement,
    );
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("末项给了 onSelect 也是按钮，但仍按「当前落点」着色并标 aria-current", () => {
    const onJump = vi.fn();
    const { container } = render(
      <PanelHeader
        mode="mobile"
        onBack={() => {}}
        breadcrumb={[
          { label: "根", onSelect: onJump },
          { label: "当前层", onSelect: onJump },
        ]}
      />,
    );

    // 每一项都可点 → 全都是按钮（不必为末项单开一条不可点的样式）
    const crumbs = container.querySelectorAll(
      '[data-slot="panel-header-crumb"]',
    );
    expect(crumbs).toHaveLength(2);
    expect(
      container.querySelectorAll(
        '[data-slot="panel-header-crumb-current"]',
      ),
    ).toHaveLength(0);

    // 「当前落点」的语义不因可点而丢：只有末项带 aria-current
    expect(crumbs[0]).not.toHaveAttribute("aria-current");
    expect(crumbs[1]).toHaveAttribute("aria-current", "true");

    fireEvent.click(crumbs[1] as HTMLElement);
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("面包屑独占工具栏行下方的一行（不与返回/确定挤同一行）", () => {
    const { container } = render(
      <PanelHeader
        mode="mobile"
        title="不该出现"
        onBack={() => {}}
        onConfirm={() => {}}
        breadcrumb={[
          { label: "根", onSelect: () => {} },
          { label: "当前层" },
        ]}
      />,
    );

    const bar = container.querySelector('[data-slot="panel-header-bar"]');
    const nav = container.querySelector(
      '[data-slot="panel-header-breadcrumb"]',
    );
    expect(bar).not.toBeNull();
    expect(nav).not.toBeNull();
    // 两行结构：面包屑不在工具栏行内，工具栏行仍由返回 + 确定占位
    expect(bar?.contains(nav as Node)).toBe(false);
    expect(
      bar?.querySelector('[data-slot="panel-header-back"]'),
    ).not.toBeNull();
    expect(
      bar?.querySelector('[data-slot="panel-header-confirm"]'),
    ).not.toBeNull();
  });

  it("breadcrumb 为空数组时退回标题（没有层级可铺）", () => {
    const { container } = render(
      <PanelHeader mode="mobile" title="标题" breadcrumb={[]} />,
    );

    expect(
      container.querySelector('[data-slot="panel-header-breadcrumb"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="panel-header-title"]')
        ?.textContent,
    ).toBe("标题");
  });
});
