import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DropdownMenu } from "@/components/responsive/dropdown-menu";
import type { MenuItem } from "@/hooks/use-menu-state";

/**
 * DropdownMenu 双模式行为测试（矩阵 §4 要求：h5 / pc 各一组）
 *
 * 重点不是「渲染出来了」，而是两端确实是两套**导航范式**：
 *   - 容器：H5 走 Popup 的底部抽屉 vs PC 走 Radix 锚定浮层（PC 下不该出现 popup 槽）
 *   - 下钻：H5 整层推入 + 返回按钮 vs PC 子菜单向右展开、父层不动
 *   - 行高与密度：48px vs 36px（由 class 断言锁住，见 §4 的分歧点）
 *   - 快捷键提示：PC 渲染成 kbd，H5 不渲染
 * 而「菜单树本身」两端同源：同一份 items 在两端得到同样的层级与叶子集合。
 */

const MENU: MenuItem[] = [
    { value: "edit", label: "编辑", shortcut: "⌘E" },
    { value: "duplicate", label: "复制", shortcut: "⌘D" },
    { divider: true },
    {
        value: "move",
        label: "移动到",
        children: [
            { value: "folder-a", label: "文件夹 A" },
            { value: "folder-b", label: "文件夹 B" },
        ],
    },
    { value: "delete", label: "删除", danger: true },
    { value: "locked", label: "锁定项", disabled: true },
];

function trigger(): HTMLElement {
    return screen.getByRole("button", { name: "操作" });
}

function pcPanel(): HTMLElement | null {
    return document.querySelector('[data-slot="menu-panel"]');
}

function rows(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-slot="menu-row"]'),
    );
}

function rowByValue(value: string): HTMLElement {
    const found = rows().find((row) => row.dataset.value === value);
    if (!found) throw new Error(`找不到 data-value=${value} 的菜单行`);
    return found;
}

/** 当前焦点所在行的 data-value（焦点不在行上时为 undefined） */
function focusedValue(): string | undefined {
    return (document.activeElement as HTMLElement | null)?.dataset.value;
}

/**
 * 头部层级：有面包屑时取链上各项文案。H5 菜单每层都铺面包屑 —— 根层是一格面板名，
 * 下钻后是「进来时点的那一项 → 当前层的选中项」，根层标题不进链身。
 * 没有面包屑（如 Select）才退回读标题。
 *
 * 断言用「用户看到的层级」而不是某个 slot 存不存在 —— 这条链路的价值
 * 就在于「看得到自己在哪一层、能点回哪一层」。
 */
function headerLevels(): (string | null)[] {
    const nav = document.querySelector('[data-slot="panel-header-breadcrumb"]');
    if (!nav) {
        const title = document.querySelector(
            '[data-slot="panel-header-title"]',
        );
        return title ? [title.textContent] : [];
    }
    return Array.from(
        nav.querySelectorAll(
            '[data-slot="panel-header-crumb"], [data-slot="panel-header-crumb-current"]',
        ),
    ).map((node) => node.textContent);
}

/**
 * 打开 PC 菜单。
 *
 * Radix 的 DropdownMenu Trigger 是在 **pointerdown** 上开合的
 * （`@radix-ui/react-dropdown-menu/dist/index.mjs`：`onPointerDown: … context.onOpenToggle()`），
 * 不是 click —— 用 fireEvent.click 永远打不开，而失败现象是「面板不存在」，
 * 很容易被误读成组件没渲染。
 *
 * 也不能直接用 RTL 的 fireEvent.pointerDown：它构造事件时若环境没有 PointerEvent
 * 就退化成普通 Event，`event.button` 变 undefined，Radix 的 `event.button === 0` 判定失败。
 * 这里显式用 MouseEvent 带上 button=0 派发 pointerdown，走的是 React 真实的合成链路。
 */
function pointerDown(element: HTMLElement): void {
    const PointerEventCtor = (window.PointerEvent ??
        window.MouseEvent) as typeof MouseEvent;
    fireEvent(
        element,
        new PointerEventCtor("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
        }),
    );
}

describe("h5 mode", () => {
    it('触发器自带 data-mode="h5"，未展开时不渲染面板', () => {
        render(<DropdownMenu items={MENU} trigger="操作" forceMode="mobile" />);

        expect(trigger()).toHaveAttribute("data-mode", "h5");
        expect(trigger()).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger()).toHaveAttribute("aria-expanded", "false");
        expect(document.querySelector('[data-slot="menu-panel"]')).toBeNull();
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    });

    it("点开后走 Popup 的底部抽屉形态（不是锚定浮层）", () => {
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                title="更多操作"
                forceMode="mobile"
            />,
        );
        fireEvent.click(trigger());

        expect(trigger()).toHaveAttribute("aria-expanded", "true");
        const popup = document.querySelector('[data-slot="popup"]');
        expect(popup).toHaveAttribute("data-position-resolved", "bottom");
        // 与 PC 的分野：H5 复用 popup 地基，PC 完全不经过它
        expect(pcPanel()).toBeNull();
        // 根层也铺面包屑：一格面板名，是当前落点（不可点）
        expect(screen.getByText("更多操作")).toBeInTheDocument();
        expect(headerLevels()).toEqual(["更多操作"]);
        expect(
            document.querySelector('[data-slot="panel-header-crumb-current"]'),
        ).not.toBeNull();
        // 左键不再是返回箭头（旧实现 menu-back 早已废弃，PanelHeader 的 back 槽也不占用）
        expect(document.querySelector('[data-slot="menu-back"]')).toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();
    });

    it("分隔线存在但不参与选项语义", () => {
        render(<DropdownMenu items={MENU} trigger="操作" forceMode="mobile" />);
        fireEvent.click(trigger());

        expect(
            document.querySelectorAll('[data-slot="menu-divider"]'),
        ).toHaveLength(1);
        // 分隔线不是 menuitem：读屏不该把它念成一个可选项
        expect(screen.getAllByRole("menuitem")).toHaveLength(5);
    });

    it("点叶子项回调值并关闭，父项只是下钻不回调", () => {
        const onSelect = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                forceMode="mobile"
                onSelect={onSelect}
            />,
        );
        fireEvent.click(trigger());

        fireEvent.click(rowByValue("edit"));
        expect(onSelect).toHaveBeenCalledWith(
            "edit",
            expect.objectContaining({ value: "edit" }),
        );
        expect(
            screen.getByRole("menuitem", { name: /移动到/ }),
        ).toHaveAttribute("aria-haspopup", "menu");
    });

    it("二级菜单：整层面板推入，头部铺出层级链（不再有返回箭头）", async () => {
        const onSelect = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                title="更多操作"
                forceMode="mobile"
            />,
        );
        fireEvent.click(trigger());

        fireEvent.click(rowByValue("move"));

        // 推入后有两层，当前层 depth=1
        await waitFor(() =>
            expect(
                document.querySelectorAll('[data-slot="menu-layer"]'),
            ).toHaveLength(2),
        );
        const panels = document.querySelectorAll<HTMLElement>(
            '[data-slot="menu-layer"]',
        );
        expect(panels[1]).toHaveAttribute("data-depth", "1");
        // 头部铺出「进来时点的那一项」（根层标题不进链身）
        expect(headerLevels()).toEqual(["移动到"]);
        // 左键不再是「返回箭头」：回头靠链上点名（这一项本身就可点）
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();
        // 第二层的行已经渲染（无需等动画）
        expect(rows().some((row) => row.dataset.value === "folder-a")).toBe(
            true,
        );

        // 点链上唯一的「移动到」= 第一层的选中值 → 一步落回根层
        fireEvent.click(
            document.querySelector(
                '[data-slot="panel-header-crumb"]',
            ) as HTMLElement,
        );
        await waitFor(() =>
            expect(
                document.querySelectorAll('[data-slot="menu-layer"]'),
            ).toHaveLength(1),
        );
        // 回到根层：面包屑不收起，缩成一格面板名（当前落点，不可点）
        expect(headerLevels()).toEqual(["更多操作"]);
        expect(
            document.querySelector('[data-slot="panel-header-crumb-current"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-title"]'),
        ).toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("禁用项点不动", () => {
        const onSelect = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                forceMode="mobile"
                onSelect={onSelect}
            />,
        );
        fireEvent.click(trigger());

        fireEvent.click(rowByValue("locked"));
        expect(onSelect).not.toHaveBeenCalled();
    });

    it("不渲染快捷键提示（触屏没有键盘，展示 ⌘E 是噪音）", () => {
        render(<DropdownMenu items={MENU} trigger="操作" forceMode="mobile" />);
        fireEvent.click(trigger());

        expect(
            document.querySelector('[data-slot="menu-row-shortcut"]'),
        ).toBeNull();
    });

    it("closeOnSelect=false 时选中不关闭", () => {
        const onSelect = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                forceMode="mobile"
                closeOnSelect={false}
                onSelect={onSelect}
            />,
        );
        fireEvent.click(trigger());
        fireEvent.click(rowByValue("edit"));

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(document.querySelector('[data-slot="popup"]')).not.toBeNull();
    });

    it("disabled 时触发器不可点，菜单不展开", () => {
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                disabled
                forceMode="mobile"
            />,
        );

        expect(trigger()).toBeDisabled();
        fireEvent.click(trigger());
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    });

    it("可选值：触发器回填选中叶子的 label，行尾打勾", () => {
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                defaultValue="edit"
                onChange={() => {}}
                forceMode="mobile"
            />,
        );

        // 回填：触发器显示「编辑」而不是静态文案「操作」
        const button = screen.getByRole("button", { name: "操作菜单" });
        expect(button.textContent).toContain("编辑");

        fireEvent.click(button);
        // 选中叶子行带 data-selected；父项（下钻入口）没有
        expect(rowByValue("edit")).toHaveAttribute("data-selected", "true");
        expect(rowByValue("duplicate")).not.toHaveAttribute("data-selected");
        expect(rowByValue("move")).not.toHaveAttribute("data-selected");
    });

    it("confirmable：暂存确认 —— 点叶子只打勾，「确定」才提交回填并关闭，「取消」放弃", () => {
        const onChange = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                title="更多操作"
                defaultValue="edit"
                onChange={onChange}
                confirmable
                forceMode="mobile"
            />,
        );
        const button = screen.getByRole("button", { name: "操作菜单" });
        fireEvent.click(button);

        // 工具栏：取消 + 确定（左键统一是取消，不占用返回箭头）
        expect(
            document.querySelector('[data-slot="panel-header-cancel"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-confirm"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();

        // 点「复制」：只记草稿 —— 不触发、不关闭（open 的可靠信号是 aria-expanded：
        // jsdom 下 Popup 进场 raf 不跑，data-state 恒为 closed，不能拿来断言开关）
        fireEvent.click(rowByValue("duplicate"));
        expect(onChange).not.toHaveBeenCalled();
        expect(button).toHaveAttribute("aria-expanded", "true");
        expect(rowByValue("duplicate")).toHaveAttribute(
            "data-selected",
            "true",
        );
        expect(rowByValue("edit")).not.toHaveAttribute("data-selected");
        // 触发器回填仍是已提交值
        expect(button.textContent).toContain("编辑");

        // 「确定」：提交草稿并关闭，回填更新
        fireEvent.click(
            document.querySelector(
                '[data-slot="panel-header-confirm"]',
            ) as HTMLElement,
        );
        expect(onChange).toHaveBeenCalledWith(
            "duplicate",
            expect.objectContaining({ value: "duplicate" }),
        );
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(button.textContent).toContain("复制");
    });

    it("confirmable：「取消」丢弃草稿，值与回填都不变", () => {
        const onChange = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                defaultValue="edit"
                onChange={onChange}
                confirmable
                forceMode="mobile"
            />,
        );
        const button = screen.getByRole("button", { name: "操作菜单" });
        fireEvent.click(button);

        fireEvent.click(rowByValue("duplicate"));
        fireEvent.click(
            document.querySelector(
                '[data-slot="panel-header-cancel"]',
            ) as HTMLElement,
        );

        expect(onChange).not.toHaveBeenCalled();
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(button.textContent).toContain("编辑");
    });
});

describe("pc mode", () => {
    it('触发器自带 data-mode="pc"', () => {
        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        expect(trigger()).toHaveAttribute("data-mode", "pc");
    });

    it("点开后渲染锚定浮层（不出现 popup 槽）", () => {
        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());

        const panel = pcPanel();
        expect(panel).not.toBeNull();
        expect(panel).toHaveAttribute("data-mode", "pc");
        expect(document.querySelector('[data-slot="popup"]')).toBeNull();
        expect(screen.getAllByRole("menuitem")).toHaveLength(5);
    });

    it("行尾渲染快捷键提示，危险项带 data-danger", () => {
        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());

        const shortcuts = Array.from(
            document.querySelectorAll('[data-slot="menu-row-shortcut"]'),
        ).map((node) => node.textContent);
        expect(shortcuts).toEqual(["⌘E", "⌘D"]);
        expect(rowByValue("delete")).toHaveAttribute("data-danger", "true");
    });

    it('父项是子菜单入口：aria-haspopup="menu"，子层挂在 menu-subpanel 槽上', async () => {
        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());

        const parent = rowByValue("move");
        expect(parent).toHaveAttribute("aria-haspopup", "menu");

        // 子菜单向右展开（不是推入）：父层仍在，第二层是独立的浮层
        fireEvent.click(parent);
        await waitFor(() =>
            expect(
                document.querySelector('[data-slot="menu-subpanel"]'),
            ).not.toBeNull(),
        );
        expect(
            document.querySelector('[data-slot="menu-subpanel"]'),
        ).toHaveAttribute("data-side", "right");
        expect(pcPanel()).not.toBeNull();
    });

    it("键盘：↑↓ 巡航跳过禁用项，Enter 执行并归还焦点", async () => {
        const onSelect = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                forceMode="desktop"
                onSelect={onSelect}
            />,
        );
        pointerDown(trigger());

        // 打开后焦点先落在浮层容器上（Radix 的 FocusScope 收拢焦点），还没有落到任何一行
        expect(focusedValue()).toBeUndefined();

        /**
         * 每一次巡航都要等一个宏任务：Radix 的 roving focus 把落点写在
         * `setTimeout(() => focusFirst(nodes))` 里
         * （@radix-ui/react-roving-focus/dist/index.mjs 第 194 行），
         * 同步断言会读到「还没动」的旧焦点 —— 与组件行为无关，纯时序。
         */
        const press = async (key: string) => {
            fireEvent.keyDown(
                document.activeElement ?? (pcPanel() as HTMLElement),
                { key },
            );
        };

        await press("ArrowDown");
        await waitFor(() => expect(focusedValue()).toBe("edit"));

        await press("ArrowDown");
        await waitFor(() => expect(focusedValue()).toBe("duplicate"));

        await press("ArrowDown");
        await waitFor(() => expect(focusedValue()).toBe("move"));

        // locked 是禁用项：巡航必须跳过它，直接从 move 落到 delete
        await press("ArrowDown");
        await waitFor(() => expect(focusedValue()).toBe("delete"));

        fireEvent.keyDown(document.activeElement as HTMLElement, {
            key: "Enter",
        });

        expect(onSelect).toHaveBeenCalledWith(
            "delete",
            expect.objectContaining({ value: "delete" }),
        );
        await waitFor(() => expect(pcPanel()).toBeNull());
        // 契约第 5 条：关闭后焦点归还触发器，而不是掉到 body 上
        expect(document.activeElement).toBe(trigger());
    });

    it("Esc 关闭并把焦点归还触发器（契约第 5 条）", async () => {
        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());
        expect(pcPanel()).not.toBeNull();

        fireEvent.keyDown(pcPanel() as HTMLElement, { key: "Escape" });

        await waitFor(() => expect(pcPanel()).toBeNull());
        expect(document.activeElement).toBe(trigger());
    });

    it("可选值：点选即生效（没有确定按钮），触发器回填 label", async () => {
        const onChange = vi.fn();
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                value="edit"
                onChange={onChange}
                confirmable
                forceMode="desktop"
            />,
        );
        // 回填走树中 value → label 匹配，不受 confirmable 影响
        const button = screen.getByRole("button", { name: "操作菜单" });
        expect(button.textContent).toContain("编辑");

        pointerDown(button);
        expect(document.querySelector('[data-slot="panel-header"]')).toBeNull();

        fireEvent.click(rowByValue("duplicate"));
        expect(onChange).toHaveBeenCalledWith(
            "duplicate",
            expect.objectContaining({ value: "duplicate" }),
        );
        await waitFor(() => expect(pcPanel()).toBeNull());
    });
});

describe("双模式一致：菜单树语义不随模式变化", () => {
    it("同一组 props 两端都能渲染，交互差异不通过 props 泄露", () => {
        const shared = {
            items: MENU,
            trigger: "操作",
            title: "更多操作",
            closeOnSelect: false,
        };

        const mobile = render(<DropdownMenu {...shared} forceMode="mobile" />);
        expect(trigger()).toHaveAttribute("data-mode", "h5");
        mobile.unmount();

        render(<DropdownMenu {...shared} forceMode="desktop" />);
        expect(trigger()).toHaveAttribute("data-mode", "pc");
    });

    it("同一份 items 在两端得到同样的顶层叶子集合", () => {
        const mobile = render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="mobile" />,
        );
        fireEvent.click(trigger());
        const mobileValues = rows().map((row) => row.dataset.value);
        mobile.unmount();

        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());
        const pcValues = rows().map((row) => row.dataset.value);

        expect(mobileValues).toEqual(pcValues);
        expect(mobileValues).toEqual([
            "edit",
            "duplicate",
            "move",
            "delete",
            "locked",
        ]);
    });

    it("行高按模式取 token（48px vs 36px 的密度差异写在两串 class 上）", () => {
        const mobile = render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="mobile" />,
        );
        fireEvent.click(trigger());
        expect(rowByValue("edit").className).toContain(
            "h-[var(--bv-menu-row-height)]",
        );
        mobile.unmount();

        render(
            <DropdownMenu items={MENU} trigger="操作" forceMode="desktop" />,
        );
        pointerDown(trigger());
        const pcRow = rowByValue("edit").className;
        expect(pcRow).toContain("h-[var(--bv-menu-pc-row-height)]");
        expect(pcRow).not.toContain("h-[var(--bv-menu-row-height)]");
    });
});

/**
 * 触发器回填：选中项必须带上它的层级。
 * 只回填末级 label 时，同名叶子挂在不同父级下就无法区分
 * （如「移动到 / 文件夹 A」与顶层的「文件夹 A」）。
 */
describe("触发器层级回显", () => {
    const pathSlots = () => ({
        ancestors: Array.from(
            document.querySelectorAll(
                '[data-slot="menu-trigger-path-ancestor"]',
            ),
        ).map((node) => node.textContent),
        current:
            document.querySelector('[data-slot="menu-trigger-path-current"]')
                ?.textContent ?? null,
        separators: document.querySelectorAll(
            '[data-slot="menu-trigger-path-separator"]',
        ).length,
    });

    const renderSelectable = (
        mode: "mobile" | "desktop",
        defaultValue: string,
    ) =>
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                defaultValue={defaultValue}
                onChange={() => {}}
                forceMode={mode}
            />,
        );

    it("嵌套选中：回填「根 → 选中项」整条链（两端一致）", () => {
        const mobile = renderSelectable("mobile", "folder-a");
        expect(pathSlots()).toEqual({
            ancestors: ["移动到"],
            current: "文件夹 A",
            separators: 1,
        });
        mobile.unmount();

        renderSelectable("desktop", "folder-a");
        expect(pathSlots()).toEqual({
            ancestors: ["移动到"],
            current: "文件夹 A",
            separators: 1,
        });
    });

    it("顶层选中：退化成纯 label，不渲染祖先槽与分隔符", () => {
        renderSelectable("mobile", "edit");

        const button = screen.getByRole("button", { name: "操作菜单" });
        expect(button.textContent).toContain("编辑");
        expect(pathSlots()).toEqual({
            ancestors: [],
            current: null,
            separators: 0,
        });
    });

    it("value 在树里失效：回退原始文案，不显示半个路径", () => {
        renderSelectable("mobile", "ghost");

        const button = screen.getByRole("button", { name: "操作菜单" });
        expect(button.textContent).toContain("操作");
        expect(pathSlots()).toEqual({
            ancestors: [],
            current: null,
            separators: 0,
        });
    });
});

/**
 * 打开即定位：展开时要落在选中项所在的位置。
 *
 * 触发器回显解决的是「看得到」，这一组解决的是「打开就到位」——
 * 树里选中项可能埋在三层之下，展开时若一律从根层开始（或让用户自己悬停进去），
 * 用户就得手动走一遍才能确认当前选的是哪一条。
 */
describe("打开即定位到选中项", () => {
    const layers = () => document.querySelectorAll('[data-slot="menu-layer"]');

    const renderSelectable = (
        mode: "mobile" | "desktop",
        defaultValue: string,
        extra = {},
    ) =>
        render(
            <DropdownMenu
                items={MENU}
                trigger="操作"
                ariaLabel="操作菜单"
                title="更多操作"
                defaultValue={defaultValue}
                onChange={() => {}}
                forceMode={mode}
                {...extra}
            />,
        );

    /**
     * 记录 scrollIntoView 的调用。
     *
     * jsdom 不做布局，「有没有真的滚过去」无法断言；能断言的是
     * 「滚的是哪一行、用什么对齐方式」—— 对齐必须是 nearest，
     * 否则长菜单里定位选中项会把整个浮层连带滚飞（列表上下文丢失）。
     */
    function captureScrolls() {
        const original = Element.prototype.scrollIntoView;
        const calls: {
            element: Element;
            arg?: boolean | ScrollIntoViewOptions;
        }[] = [];
        Element.prototype.scrollIntoView = function capture(
            this: Element,
            arg?: boolean | ScrollIntoViewOptions,
        ): void {
            calls.push({ element: this, arg });
        };
        return {
            calls,
            values: () =>
                calls.map(
                    ({ element }) => (element as HTMLElement).dataset.value,
                ),
            restore: () => {
                Element.prototype.scrollIntoView = original;
            },
        };
    }

    it("H5：展开时直接下钻到选中项所在层（不必自己一层层点进去）", async () => {
        renderSelectable("mobile", "folder-a");
        fireEvent.click(screen.getByRole("button", { name: "操作菜单" }));

        await waitFor(() => expect(layers()).toHaveLength(2));
        // 停在「移动到」这一层：链身是「移动到」，链尾补上这一层里选中的「文件夹 A」
        expect(headerLevels()).toEqual(["移动到", "文件夹 A"]);
        // 链身与链尾都可点（回头不必逐层按返回）
        expect(
            document.querySelectorAll(
                '[data-slot="panel-header-crumb"], [data-slot="panel-header-crumb-current"]',
            ),
        ).toHaveLength(2);
        // 选中项就在当前层里
        expect(rowByValue("folder-a")).toHaveAttribute("data-selected", "true");
    });

    it("H5：选中项在顶层时停在根层（不给简单场景凭空加一层）", () => {
        renderSelectable("mobile", "edit");
        fireEvent.click(screen.getByRole("button", { name: "操作菜单" }));

        expect(layers()).toHaveLength(1);
        // 根层也铺面包屑，只是只有一格面板名（当前落点）
        expect(headerLevels()).toEqual(["更多操作"]);
        expect(
            document.querySelector('[data-slot="panel-header-crumb-current"]'),
        ).not.toBeNull();
    });

    it("H5：value 在树里失效时停在根层，不展开空层", () => {
        renderSelectable("mobile", "ghost");
        fireEvent.click(screen.getByRole("button", { name: "操作菜单" }));

        expect(layers()).toHaveLength(1);
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();
    });

    it("H5：暂存模式下点叶子改草稿，不会把视野弹回根层", async () => {
        renderSelectable("mobile", "folder-a", { confirmable: true });
        fireEvent.click(screen.getByRole("button", { name: "操作菜单" }));
        await waitFor(() => expect(layers()).toHaveLength(2));

        // 点同层的另一项：草稿变了（勾会移动），但用户仍在「移动到」这一层
        fireEvent.click(rowByValue("folder-b"));

        expect(layers()).toHaveLength(2);
        // 链尾跟着草稿走（与行内勾同源），用户看到的就是「确定后会长成什么样」
        expect(headerLevels()).toEqual(["移动到", "文件夹 B"]);
        expect(rowByValue("folder-b")).toHaveAttribute("data-selected", "true");
    });

    it("PC：展开时把选中项所在的子菜单链铺开（父层仍在，不是 H5 的推入）", async () => {
        renderSelectable("desktop", "folder-a");
        pointerDown(screen.getByRole("button", { name: "操作菜单" }));

        await waitFor(() =>
            expect(
                document.querySelector('[data-slot="menu-subpanel"]'),
            ).not.toBeNull(),
        );
        // 父行保持展开态（data-state 由 Radix 打），父层浮层也还在
        expect(rowByValue("move")).toHaveAttribute("data-state", "open");
        expect(rowByValue("folder-a")).toHaveAttribute("data-selected", "true");
        expect(pcPanel()).not.toBeNull();
    });

    it("PC：选中项在顶层时不展开任何子菜单", () => {
        renderSelectable("desktop", "edit");
        pointerDown(screen.getByRole("button", { name: "操作菜单" }));

        expect(pcPanel()).not.toBeNull();
        expect(
            document.querySelector('[data-slot="menu-subpanel"]'),
        ).toBeNull();
    });

    it("两端都把选中项滚入视野（长菜单里选中项可能在屏幕外）", async () => {
        const capture = captureScrolls();
        try {
            const mobile = renderSelectable("mobile", "folder-a");
            fireEvent.click(screen.getByRole("button", { name: "操作菜单" }));
            await waitFor(() => expect(capture.values()).toContain("folder-a"));
            mobile.unmount();

            capture.calls.length = 0;
            renderSelectable("desktop", "folder-a");
            pointerDown(screen.getByRole("button", { name: "操作菜单" }));
            await waitFor(() => expect(capture.values()).toContain("folder-a"));

            // 对齐方式：nearest —— 只滚到「刚好看得见」，不把整层滚到顶
            expect(
                capture.calls.every(
                    ({ arg }) =>
                        (arg as ScrollIntoViewOptions).block === "nearest",
                ),
            ).toBe(true);
        } finally {
            capture.restore();
        }
    });
});

/**
 * 头部层级面包屑：每层都铺 —— 根层是一格面板名，下钻后是「进来时点的那一项 →
 * 当前层的选中项」，链上**每一项都可点** —— 第 i 项就是第 i 层的选中值，
 * 点它就落回那一层（跨层，不必逐层按返回；点链首即回最上层）。
 *
 * 与「打开即定位」是一对 —— 定位让用户展开就落在正确的层，面包屑让用户
 * 知道自己在哪条链上，并能一步切到链上任意一层。
 */
describe("头部层级面包屑", () => {
    /** 四级树：只有它才能验「点链首一步跨两层」，三级树只能验相邻层 */
    const DEEP: MenuItem[] = [
        {
            value: "a",
            label: "甲",
            children: [
                {
                    value: "a1",
                    label: "甲一",
                    children: [
                        {
                            value: "a1x",
                            label: "甲一叉",
                            children: [{ value: "a1x1", label: "甲一叉一" }],
                        },
                    ],
                },
            ],
        },
    ];

    const layers = () => document.querySelectorAll('[data-slot="menu-layer"]');

    /** 面包屑各项节点（含不可点的当前项），顺序即链上顺序 */
    const crumbs = () =>
        Array.from(
            document.querySelectorAll(
                '[data-slot="panel-header-crumb"], [data-slot="panel-header-crumb-current"]',
            ),
        );

    const renderMenu = (extra = {}) =>
        render(
            <DropdownMenu
                items={DEEP}
                trigger="操作"
                title="根标题"
                forceMode="mobile"
                {...extra}
            />,
        );

    /**
     * 展开菜单。这里不能按 name「操作」查触发器 —— 取值场景下触发器回填的是
     * 「根 → 选中项」的路径（本组要验的正是这条链），名字已经不是「操作」了。
     */
    const openMenu = () =>
        fireEvent.click(
            document.querySelector('[data-slot="menu-trigger"]') as HTMLElement,
        );

    it("下钻后铺出「进来时点的那一项」（根的标题不进链身）", () => {
        renderMenu();
        openMenu();
        fireEvent.click(rowByValue("a"));
        fireEvent.click(rowByValue("a1"));

        expect(layers()).toHaveLength(3);
        expect(headerLevels()).toEqual(["甲", "甲一"]);
        // 可点性必须落在 DOM 上：链上每一项都是 button，末项是「当前落点」并标了 aria-current
        expect(crumbs().map((crumb) => crumb.tagName)).toEqual([
            "BUTTON",
            "BUTTON",
        ]);
        expect(crumbs()[0]).not.toHaveAttribute("aria-current");
        expect(crumbs()[1]).toHaveAttribute("aria-current", "true");
        expect(
            document.querySelectorAll(
                '[data-slot="panel-header-crumb-separator"]',
            ),
        ).toHaveLength(1);
    });

    it("链尾补上当前层的选中项：头部即「确定后会回填到触发器的链」", async () => {
        renderMenu({ defaultValue: "a1x1" });
        openMenu();

        // 打开即下钻到选中项所在层：链身是下钻时点过的三层，链尾是选中的「甲一叉一」
        await waitFor(() => expect(layers()).toHaveLength(4));
        expect(headerLevels()).toEqual(["甲", "甲一", "甲一叉", "甲一叉一"]);
        // 链尾是选中的「甲一叉一」：它所在的层就是当前层，点了自然收敛 —— 照给 onSelect
        expect(crumbs().map((crumb) => crumb.tagName)).toEqual([
            "BUTTON",
            "BUTTON",
            "BUTTON",
            "BUTTON",
        ]);
        expect(crumbs()[3]).toHaveAttribute("aria-current", "true");
    });

    it("选中项不在当前层时不补进链尾（补了会被读成当前层的子项）", async () => {
        renderMenu({ defaultValue: "a1x1" });
        openMenu();
        await waitFor(() => expect(layers()).toHaveLength(4));

        // 点第二项「甲一」落回它的层：选中项埋在下两层，不在眼前这一层的行里
        fireEvent.click(crumbs()[1]);

        expect(layers()).toHaveLength(2);
        expect(headerLevels()).toEqual(["甲"]);
    });

    it("根层也铺面包屑：一格面板名，是当前落点（点了不动）", () => {
        renderMenu();
        openMenu();

        expect(layers()).toHaveLength(1);
        // 头部结构与下钻后一致（都是「工具栏行 + 层级行」），不会在切层时跳行
        expect(
            document.querySelector('[data-slot="panel-header-breadcrumb"]'),
        ).not.toBeNull();
        expect(headerLevels()).toEqual(["根标题"]);
        // 当前落点不给 onSelect：渲染成不可点的一项，也不带 aria-current 之外的交互
        expect(crumbs().map((crumb) => crumb.tagName)).toEqual(["SPAN"]);
        expect(crumbs()[0]).toHaveAttribute("aria-current", "true");
        // 面包屑铺开后标题让位（同一条链不说两遍）
        expect(
            document.querySelector('[data-slot="panel-header-title"]'),
        ).toBeNull();
    });

    it("下钻中左键是「取消」，不再渲染返回箭头", async () => {
        // confirmable 要配上取值才进暂存模式（selectable 由此判定）
        renderMenu({ defaultValue: "a1x1", confirmable: true });
        openMenu();
        await waitFor(() => expect(layers()).toHaveLength(4));

        expect(
            document.querySelector('[data-slot="panel-header-cancel"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-confirm"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-back"]'),
        ).toBeNull();
    });

    it("点链首即回最上层：面板栈清空，面包屑缩成一格面板名", () => {
        renderMenu();
        openMenu();
        fireEvent.click(rowByValue("a"));
        fireEvent.click(rowByValue("a1"));
        fireEvent.click(rowByValue("a1x"));
        expect(layers()).toHaveLength(4);

        // 链首是「甲」= 第一层的选中值 → 落回第一层，即根层
        fireEvent.click(crumbs()[0]);

        expect(layers()).toHaveLength(1);
        // 根层仍有面包屑，但只剩面板名一格；标题不回来（面包屑取代它）
        expect(headerLevels()).toEqual(["根标题"]);
        expect(
            document.querySelector('[data-slot="panel-header-breadcrumb"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="panel-header-title"]'),
        ).toBeNull();
        expect(
            document.querySelector<HTMLElement>('[data-slot="menu-track"]')
                ?.style.transform,
        ).toBe("translateX(-0%)");
    });

    it("点中间那一项回到它的层：一步跨两层，不是一路退回根层", () => {
        renderMenu();
        openMenu();
        fireEvent.click(rowByValue("a"));
        fireEvent.click(rowByValue("a1"));
        fireEvent.click(rowByValue("a1x"));
        expect(layers()).toHaveLength(4);

        // 第二项「甲一」= 第二层的选中值 → 从第四层一步落到第二层
        fireEvent.click(crumbs()[1]);

        expect(layers()).toHaveLength(2);
        expect(headerLevels()).toEqual(["甲"]);
        // 轨道位移随层数走：切层与下钻共用同一套面板栈（-100% = 第二层）
        expect(
            document.querySelector<HTMLElement>('[data-slot="menu-track"]')
                ?.style.transform,
        ).toBe("translateX(-100%)");
    });

    it("切层不触发选中回调（导航不是取值）", () => {
        const onSelect = vi.fn();
        renderMenu({ onSelect });
        openMenu();
        fireEvent.click(rowByValue("a"));
        fireEvent.click(rowByValue("a1"));

        fireEvent.click(crumbs()[0]);

        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe("空态", () => {
    it("一层里没有可交互条目时展示空态（只剩分隔线也算空）", () => {
        render(
            <DropdownMenu
                items={[{ divider: true }]}
                trigger="操作"
                forceMode="mobile"
            />,
        );
        fireEvent.click(trigger());
        expect(screen.getByText("暂无选项")).toBeInTheDocument();
    });
});
