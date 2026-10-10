import { act, fireEvent, render, screen } from "@testing-library/react";
import { Picker } from "@/components/responsive/picker";
import { Cascader } from "@/components/responsive/cascader";
import { Select } from "@/components/responsive/select";
import { TimePicker } from "@/components/responsive/time-picker";
import { DateTimePicker } from "@/components/responsive/datetime-picker";
import { DatePicker } from "@/components/responsive/date-picker";
import { Popover } from "@/components/responsive/popover";
import { DropdownMenu } from "@/components/responsive/dropdown-menu";
import type { MenuItem } from "@/hooks/use-menu-state";
import type { PickerOption } from "@/hooks/use-picker-state";

/**
 * PC 锚定弹层「开合 / 跨实例切换」回归
 *
 * 历史教训（两轮错误方案都在这里翻车）：
 *  1. Anchor + click 自管开合：浮层 A 开着点触发器 B，Radix 在 pointerdown 关 A、
 *     click 才开 B，跨事件产生「先关再打开」空帧；
 *  2. Anchor + pointerdown 自管开合：Anchor 不登记 triggerRef，Radix NonModal 的
 *     「点触发器/焦点落回触发器不算外部交互」保护全部失效，真实浏览器里 mousedown
 *     默认迁焦与延迟 pointerdown 的时序竞态导致「点两次才开 / 开了立刻关」，
 *     jsdom 只派 click 根本测不出来。
 * 现方案：**Popover.Trigger asChild**（click 开合交 Radix，triggerRef 登记到位）。
 * 本文件因此固化两件事：click 切换的终态，以及**完整真实手势**（含 mousedown 的
 * 默认迁焦与 pointerup/mouseup）必须一次打开、再按一次干净关闭。
 */

const PICKER_COLUMNS: PickerOption[][] = [
  [
    { label: "奔驰", value: "benz" },
    { label: "宝马", value: "bmw" },
  ],
];

const CASCADER_OPTIONS = [
  {
    label: "浙江",
    value: "zj",
    children: [
      { label: "杭州", value: "hz" },
      { label: "宁波", value: "nb" },
    ],
  },
  {
    label: "江苏",
    value: "js",
    children: [{ label: "南京", value: "nj" }],
  },
];

const SELECT_OPTIONS = [
  { label: "北京", value: "bj" },
  { label: "上海", value: "sh" },
];

const MENU: MenuItem[] = [
  { value: "edit", label: "编辑" },
  { value: "delete", label: "删除" },
];

function panelCount(slot: string): number {
  return document.querySelectorAll(`[data-slot="${slot}"]`).length;
}

/**
 * 真实浏览器一次按压的完整事件序列：
 * pointerdown → mousedown（默认动作把焦点交给目标，触发 focusin）
 * → pointerup → mouseup → click。
 * Radix 的延迟外部关闭（deferPointerDownOutside）正是在这条链路上判定的；
 * 只派 click 会漏掉所有时序竞态。
 */
async function realPress(element: HTMLElement): Promise<void> {
  fireEvent.pointerDown(element, { button: 0 });
  // 真实浏览器里 mousedown 默认动作迁焦；裸 focus 触发的 onFocus→setOpen
  // 必须包 act，否则可编辑触发器（DatePicker input）会报 act 警告
  if (document.activeElement !== element) {
    act(() => {
      element.focus();
    });
  }
  fireEvent.mouseDown(element, { button: 0 });
  fireEvent.pointerUp(element, { button: 0 });
  fireEvent.mouseUp(element, { button: 0 });
  fireEvent.click(element, { button: 0 });
  await flushDeferredFocus();
}

/**
 * 排空 Radix 的两段延迟焦点任务：
 *  1. 第一个 tick：React flush passive effects —— 新浮层注册 focusin 监听，
 *     旧浮层 FocusScope 的 unmount cleanup 执行（其中**再排**一个 setTimeout(0)）；
 *  2. 第二个 tick：旧浮层的卸载还焦回调才真正运行。
 * 只等一个 tick 时还焦尚未发生，跨实例「旧层抢焦把新层当 focusOutside 关掉」
 * 的真机 bug 在 jsdom 里会漏网。
 */
async function flushDeferredFocus(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
    await new Promise((resolve) => {
      window.setTimeout(resolve, 0);
    });
  });
}

describe("PC 锚定弹层 · 跨实例 click 直切", () => {
  it("Picker：A 开着点 B，一次 click 直切（无空帧、无二次点击）", () => {
    render(
      <>
        <Picker
          columns={PICKER_COLUMNS}
          forceMode="desktop"
          ariaLabel="选择称呼甲"
        />
        <Picker
          columns={PICKER_COLUMNS}
          forceMode="desktop"
          ariaLabel="选择称呼乙"
        />
      </>,
    );
    const a = screen.getByRole("combobox", { name: "选择称呼甲" });
    const b = screen.getByRole("combobox", { name: "选择称呼乙" });

    fireEvent.click(a);
    expect(panelCount("picker-panel")).toBe(1);
    expect(a).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(b);
    expect(panelCount("picker-panel")).toBe(1);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(a);
    expect(a).toHaveAttribute("aria-expanded", "true");
    expect(b).toHaveAttribute("aria-expanded", "false");
  });

  it("Cascader：两实例一次 click 直切", () => {
    render(
      <>
        <Cascader
          options={CASCADER_OPTIONS}
          forceMode="desktop"
          ariaLabel="省市区甲"
        />
        <Cascader
          options={CASCADER_OPTIONS}
          forceMode="desktop"
          ariaLabel="省市区乙"
        />
      </>,
    );
    const a = screen.getByRole("combobox", { name: "省市区甲" });
    const b = screen.getByRole("combobox", { name: "省市区乙" });

    fireEvent.click(a);
    fireEvent.click(b);
    expect(panelCount("cascader-panel")).toBe(1);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");
  });

  it("Select：两实例一次 click 直切", () => {
    render(
      <>
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市甲"
        />
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市乙"
        />
      </>,
    );
    const a = screen.getByRole("combobox", { name: "城市甲" });
    const b = screen.getByRole("combobox", { name: "城市乙" });

    fireEvent.click(a);
    fireEvent.click(b);
    expect(panelCount("select-panel")).toBe(1);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");
  });

  it("TimePicker：两实例一次 click 直切", () => {
    render(
      <>
        <TimePicker
          min="00:00:00"
          max="23:59:59"
          forceMode="desktop"
          ariaLabel="时间甲"
        />
        <TimePicker
          min="00:00:00"
          max="23:59:59"
          forceMode="desktop"
          ariaLabel="时间乙"
        />
      </>,
    );
    const a = screen.getByRole("combobox", { name: "时间甲" });
    const b = screen.getByRole("combobox", { name: "时间乙" });

    fireEvent.click(a);
    fireEvent.click(b);
    expect(panelCount("time-picker-panel")).toBe(1);
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");
  });

  it("Popover：两个气泡一次 click 直切", () => {
    render(
      <>
        <Popover content="内容甲">
          <button type="button">气泡甲</button>
        </Popover>
        <Popover content="内容乙">
          <button type="button">气泡乙</button>
        </Popover>
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "气泡甲" }));
    expect(screen.getByText("内容甲")).toBeInTheDocument();
    expect(screen.queryByText("内容乙")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "气泡乙" }));
    expect(screen.getByText("内容乙")).toBeInTheDocument();
    expect(screen.queryByText("内容甲")).toBeNull();
  });

  it("DropdownMenu（原生 pointerdown 开合）：两菜单间一次直切", () => {
    render(
      <>
        <DropdownMenu items={MENU} trigger="菜单甲" />
        <DropdownMenu items={MENU} trigger="菜单乙" />
      </>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "菜单甲" }), {
      button: 0,
    });
    expect(panelCount("menu-panel")).toBe(1);

    fireEvent.pointerDown(screen.getByRole("button", { name: "菜单乙" }), {
      button: 0,
    });
    expect(panelCount("menu-panel")).toBe(1);
    expect(screen.getByRole("button", { name: "菜单乙" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "菜单甲" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("跨族：DropdownMenu 开着时点 Select，菜单关、选择开", () => {
    render(
      <>
        <DropdownMenu items={MENU} trigger="操作菜单" />
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市"
        />
      </>,
    );

    fireEvent.pointerDown(
      screen.getByRole("button", { name: "操作菜单" }),
      { button: 0 },
    );
    expect(panelCount("menu-panel")).toBe(1);

    fireEvent.click(screen.getByRole("combobox", { name: "城市" }));
    expect(panelCount("menu-panel")).toBe(0);
    expect(panelCount("select-panel")).toBe(1);
  });
});

describe("PC 锚定弹层 · 完整真实手势（pointerdown→click 全链路）", () => {
  it("Select：一次按压必开，不依赖第二次；再按一次干净关闭", async () => {
    render(
      <Select
        options={SELECT_OPTIONS}
        forceMode="desktop"
        ariaLabel="城市"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "城市" });

    await realPress(trigger);
    expect(panelCount("select-panel")).toBe(1);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await realPress(trigger);
    expect(panelCount("select-panel")).toBe(0);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Picker：一次按压必开（含 mousedown 迁焦的竞态路径）", async () => {
    render(
      <Picker
        columns={PICKER_COLUMNS}
        forceMode="desktop"
        ariaLabel="称呼"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "称呼" });

    await realPress(trigger);
    expect(panelCount("picker-panel")).toBe(1);

    await realPress(trigger);
    expect(panelCount("picker-panel")).toBe(0);
  });

  it("Cascader：一次按压必开", async () => {
    render(
      <Cascader
        options={CASCADER_OPTIONS}
        forceMode="desktop"
        ariaLabel="省市区"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "省市区" });

    await realPress(trigger);
    expect(panelCount("cascader-panel")).toBe(1);
  });

  it("TimePicker：一次按压必开（此组件曾缺 focusoutside 守卫，竞态最易翻车）", async () => {
    render(
      <TimePicker
        min="00:00:00"
        max="23:59:59"
        forceMode="desktop"
        ariaLabel="时间"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "时间" });

    await realPress(trigger);
    expect(
      document.querySelector('[data-slot="time-picker-panel"]'),
    ).not.toBeNull();
  });

  it("Popover：一次按压必开", async () => {
    render(
      <Popover content="内容">
        <button type="button">更多</button>
      </Popover>,
    );

    await realPress(screen.getByRole("button", { name: "更多" }));
    expect(screen.queryByText("内容")).not.toBeNull();
  });
});

describe("PC 锚定弹层 · 跨实例真实手势（旧层延迟还焦不得关掉新层）", () => {
  /**
   * 真机 bug：A 开着点 B，click 同帧 B 挂载 / A 卸载；A 的 FocusScope 在
   * unmount cleanup 内再排一个 setTimeout(0) 做还焦。旧实现无条件把焦点抢回
   * A 触发器，而此刻 B 的 focusin 监听已就位 —— B 收到 focusOutside 立刻关闭
   * （表现为「B 展开后直接关闭」）。realPress 末尾的双 tick 正好排空到该回调。
   */
  async function expectDirectSwitch(
    a: HTMLElement,
    b: HTMLElement,
    slot: string,
  ): Promise<void> {
    await realPress(a);
    expect(panelCount(slot)).toBe(1);

    await realPress(b);
    // 即时终态：B 开 A 关
    expect(b).toHaveAttribute("aria-expanded", "true");
    expect(a).toHaveAttribute("aria-expanded", "false");
    expect(panelCount(slot)).toBe(1);
    // 延迟还焦跑完后 B 仍然必须活着
    await flushDeferredFocus();
    expect(panelCount(slot)).toBe(1);
    expect(b).toHaveAttribute("aria-expanded", "true");
  }

  it("Select：A 开着点 B，旧层卸载还焦不关掉 B", async () => {
    render(
      <>
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市甲"
        />
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市乙"
        />
      </>,
    );
    await expectDirectSwitch(
      screen.getByRole("combobox", { name: "城市甲" }),
      screen.getByRole("combobox", { name: "城市乙" }),
      "select-panel",
    );
  });

  it("Picker：A 开着点 B，旧层卸载还焦不关掉 B", async () => {
    render(
      <>
        <Picker
          columns={PICKER_COLUMNS}
          forceMode="desktop"
          ariaLabel="称呼甲"
        />
        <Picker
          columns={PICKER_COLUMNS}
          forceMode="desktop"
          ariaLabel="称呼乙"
        />
      </>,
    );
    await expectDirectSwitch(
      screen.getByRole("combobox", { name: "称呼甲" }),
      screen.getByRole("combobox", { name: "称呼乙" }),
      "picker-panel",
    );
  });

  it("Cascader：A 开着点 B，旧层卸载还焦不关掉 B", async () => {
    render(
      <>
        <Cascader
          options={CASCADER_OPTIONS}
          forceMode="desktop"
          ariaLabel="地区甲"
        />
        <Cascader
          options={CASCADER_OPTIONS}
          forceMode="desktop"
          ariaLabel="地区乙"
        />
      </>,
    );
    await expectDirectSwitch(
      screen.getByRole("combobox", { name: "地区甲" }),
      screen.getByRole("combobox", { name: "地区乙" }),
      "cascader-panel",
    );
  });

  it("TimePicker：A 开着点 B，旧层卸载还焦不关掉 B", async () => {
    render(
      <>
        <TimePicker
          min="00:00:00"
          max="23:59:59"
          forceMode="desktop"
          ariaLabel="时间甲"
        />
        <TimePicker
          min="00:00:00"
          max="23:59:59"
          forceMode="desktop"
          ariaLabel="时间乙"
        />
      </>,
    );
    await expectDirectSwitch(
      screen.getByRole("combobox", { name: "时间甲" }),
      screen.getByRole("combobox", { name: "时间乙" }),
      "time-picker-panel",
    );
  });

  it("DateTimePicker：A 开着点 B，旧层卸载还焦不关掉 B", async () => {
    render(
      <>
        <DateTimePicker forceMode="desktop" ariaLabel="日期时间甲" />
        <DateTimePicker forceMode="desktop" ariaLabel="日期时间乙" />
      </>,
    );
    await expectDirectSwitch(
      screen.getByRole("combobox", { name: "日期时间甲" }),
      screen.getByRole("combobox", { name: "日期时间乙" }),
      "datetime-picker-panel",
    );
  });

  it("Popover：气泡甲开着点气泡乙，旧气泡卸载还焦不关掉新气泡", async () => {
    render(
      <>
        <Popover content="内容甲">
          <button type="button">气泡甲</button>
        </Popover>
        <Popover content="内容乙">
          <button type="button">气泡乙</button>
        </Popover>
      </>,
    );
    await realPress(screen.getByRole("button", { name: "气泡甲" }));
    expect(screen.getByText("内容甲")).toBeInTheDocument();

    await realPress(screen.getByRole("button", { name: "气泡乙" }));
    await flushDeferredFocus();
    expect(screen.getByText("内容乙")).toBeInTheDocument();
    expect(screen.queryByText("内容甲")).toBeNull();
  });

  it("跨族：DropdownMenu 开着用真实手势点 Select，菜单关、选择保持打开", async () => {
    render(
      <>
        <DropdownMenu items={MENU} trigger="操作菜单" />
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市"
        />
      </>,
    );

    // DropdownMenu 原生在 pointerdown 单事件开合（与 Popover 族的 click 不同）
    await act(async () => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "操作菜单" }),
        { button: 0 },
      );
    });
    expect(panelCount("menu-panel")).toBe(1);

    await realPress(screen.getByRole("combobox", { name: "城市" }));
    await flushDeferredFocus();
    expect(panelCount("menu-panel")).toBe(0);
    expect(panelCount("select-panel")).toBe(1);
  });

  it("DatePicker：区间日历开着点另一个可输入年月框，旧日历必须关（不得两层并存）", async () => {
    render(
      <>
        <DatePicker
          forceMode="desktop"
          type="range"
          ariaLabel="选择区间"
          min="2020-01-01"
          max="2030-12-31"
        />
        <DatePicker
          forceMode="desktop"
          ariaLabel="选择年月"
          columnsType={["year", "month"]}
          min="2020-01-01"
          max="2030-12-31"
        />
      </>,
    );
    const rangeTrigger = screen.getByRole("combobox", { name: "选择区间" });
    const monthInput = screen
      .getByRole("combobox", { name: "选择年月" })
      .querySelector("input") as HTMLInputElement;

    await realPress(rangeTrigger);
    expect(panelCount("date-picker-panel")).toBe(1);
    expect(rangeTrigger).toHaveAttribute("aria-expanded", "true");

    // input 的 click 若 stopPropagation，区间面板挂在 document 的延迟 dismiss
    // 会被吞掉 —— 真机表现为两个日期浮层叠在一起
    await realPress(monthInput);
    await flushDeferredFocus();
    expect(panelCount("date-picker-panel")).toBe(1);
    expect(
      screen.getByRole("combobox", { name: "选择年月" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(rangeTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it("Select：A 开着点 B 的清除按钮，A 关、B 清除且不弹层", async () => {
    const onChangeB = vi.fn();
    render(
      <>
        <Select
          options={SELECT_OPTIONS}
          forceMode="desktop"
          ariaLabel="城市甲"
        />
        <Select
          options={SELECT_OPTIONS}
          defaultValue="bj"
          clearable
          forceMode="desktop"
          ariaLabel="城市乙"
          onChange={onChangeB}
        />
      </>,
    );

    await realPress(screen.getByRole("combobox", { name: "城市甲" }));
    expect(panelCount("select-panel")).toBe(1);

    const clearB = screen
      .getByRole("combobox", { name: "城市乙" })
      .querySelector('[data-slot="select-trigger-clear"]') as HTMLElement;
    await realPress(clearB);
    await flushDeferredFocus();

    expect(panelCount("select-panel")).toBe(0);
    expect(onChangeB).toHaveBeenCalledWith(undefined);
  });

  it("Select：Esc 关闭仍把焦点还给触发器（键盘用户不丢焦）", async () => {
    render(
      <Select
        options={SELECT_OPTIONS}
        forceMode="desktop"
        ariaLabel="城市"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "城市" });

    await realPress(trigger);
    expect(panelCount("select-panel")).toBe(1);

    fireEvent.keyDown(
      document.querySelector('[data-slot="select-panel"]') as HTMLElement,
      { key: "Escape" },
    );
    await flushDeferredFocus();
    expect(panelCount("select-panel")).toBe(0);
    expect(document.activeElement).toBe(trigger);
  });
});

describe("PC 锚定弹层 · 触发器细节", () => {
  it("Select：清除按钮的点击只清除、不弹层", () => {
    const onChange = vi.fn();
    render(
      <Select
        options={SELECT_OPTIONS}
        defaultValue="bj"
        clearable
        forceMode="desktop"
        ariaLabel="城市"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(panelCount("select-panel")).toBe(0);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("Select：disabled 时 click 不打开（Radix toggle 被 preventDefault 短路）", () => {
    render(
      <Select
        options={SELECT_OPTIONS}
        disabled
        forceMode="desktop"
        ariaLabel="城市"
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "城市" }));
    expect(panelCount("select-panel")).toBe(0);
  });

  it("Select：键盘 Enter 在 div 触发器上开合，Esc 关闭", () => {
    render(
      <Select
        options={SELECT_OPTIONS}
        forceMode="desktop"
        ariaLabel="城市"
      />,
    );
    const trigger = screen.getByRole("combobox", { name: "城市" });

    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(panelCount("select-panel")).toBe(1);

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(panelCount("select-panel")).toBe(0);
  });
});
