import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import {
    MenuDividerRow,
    MenuEmptyState,
    MenuRowContent,
    MenuTrigger,
    menuRowClass,
    type MenuPanelProps,
} from "@/components/ui/menu-parts";
import {
    hasSubmenu,
    isMenuDivider,
    menuOptions,
    type MenuItem,
    type MenuOption,
    type MenuValue,
} from "@/hooks/use-menu-state";

/**
 * Bivane DropdownMenu · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：**锚定在触发器上的浮层 + 子菜单向右展开 + 快捷键提示**。
 *   悬停或按 → 展开子菜单（父层留在原地，用高亮表明来路），← 或 Esc 逐层收回；
 *   ↑↓ 巡航、Enter 执行、Home/End 首尾、字母键做 typeahead。
 *
 * 为什么交给 Radix 而不是像 Select 那样自研巡航：
 *   Select 是**列表选择**（单层、有值回显），交互简单，自研巡航可控且能精确对齐矩阵；
 *   菜单是**多层结构**（子菜单的展开/收回/焦点归属/typeahead/禁用项跳过），
 *   自己写一遍必然在边界上出错。Radix 的 DropdownMenu 正好覆盖这一整块，
 *   本库只负责外观（class 与 token）与「选中后干什么」。
 *   —— 与架构 §6.4「PC 浮层用 Radix/Base UI」的既定选型一致。
 *
 * 槽名 menu-panel / menu-subpanel 已在 utilities.css 里挂了进出场动画，
 * 名字换了动画会静默不跑（契约第 16 条）。
 */

/** 浮层与触发器的主轴间距，与 Select 同一节奏（4px） */
const SIDE_OFFSET = 4;
/** 子菜单与父层的间距：比主轴更紧，否则鼠标斜向移入子菜单时容易穿空滑出去 */
const SUBMENU_SIDE_OFFSET = 2;

/**
 * 把面板里的选中项滚入视野：长菜单里选中项可能在屏幕外，
 * 只展开到那一层还差最后一步「看得到」。
 *
 * 在**面板挂载的那一刻**调用（面板的 ref 回调里），而不是放进依赖 open / openPath 的 effect：
 * Radix 的 Presence 是个状态机，`present` 翻转后还要再走一两次提交才真正挂上节点，
 * effect 在那一刻拿到的 ref 还是 null，等节点挂上时依赖又没变，滚动就永远不会发生。
 */
function scrollSelectedIntoView(
    container: HTMLElement | null | undefined,
): void {
    const row = container?.querySelector('[data-selected="true"]');
    if (row instanceof HTMLElement) row.scrollIntoView({ block: "nearest" });
}

const panelClass = cn(
    "box-border min-w-[var(--bv-menu-pc-panel-min-width)]",
    "max-w-[var(--radix-popper-available-width,100vw)]",
    "overflow-x-hidden overflow-y-auto overscroll-contain",
    // 高度上限同时受 token 与「浮层翻转后可用的空间」约束，空间不足时自动变矮而不是溢出视口
    "max-h-[min(var(--bv-menu-pc-panel-max-height),var(--radix-popper-available-height,100vh))]",
    "py-[var(--bv-menu-pc-padding-y)]",
    "rounded-[var(--bv-menu-pc-radius)] border border-bv-border bg-bv-surface",
    "shadow-[var(--bv-menu-pc-shadow)]",
    "z-[var(--bv-menu-pc-z-index)]",
);

export const PcMenu = React.forwardRef<HTMLButtonElement, MenuPanelProps>(
    function PcMenu(
        {
            mode,
            open,
            onOpenChange,
            items,
            onSelect,
            emptyText,
            placement,
            closeOnSelect,
            disabled,
            trigger,
            initialPath,
            selectedValue,
            className,
            ariaLabel,
            id,
            // staged / confirmText / cancelText / onConfirm / onCancel 是 H5 暂存确认的专属
            // 通道：PC 点选即生效，既没有工具栏也用不到它们，解构出来只为显式声明「已知悉」
            staged: _staged,
            confirmText: _confirmText,
            cancelText: _cancelText,
            onConfirm: _onConfirm,
            onCancel: _onCancel,
        },
        ref,
    ) {
        const triggerMergedRef = React.useCallback(
            (node: HTMLButtonElement | null) => {
                if (typeof ref === "function") ref(node);
                else if (ref)
                    (
                        ref as React.MutableRefObject<HTMLButtonElement | null>
                    ).current = node;
            },
            [ref],
        );

        /** 主面板节点：供「根面板自动聚焦不算焦点离开子菜单」的判断使用（见 SubContent 的 onFocusOutside） */
        const panelRef = React.useRef<HTMLDivElement | null>(null);
        /**
         * 已展开的子菜单链（按层级存父项的 value）。
         * 与 Radix 的默认行为一致：同一层只开一个，展开新的一项就把同层其余子菜单收回。
         * 之所以接管它，是为了能**主动**铺开一条链（展开时定位到选中项所在的那一层）。
         */
        const [openPath, setOpenPath] = React.useState<MenuValue[]>([]);

        /**
         * 开合时重置展开链：
         *   展开 → 直接把选中项所在的那条链铺开（否则用户要自己一层层悬停进去，
         *          才能确认当前选的是哪一条 —— 与触发器的层级回显是同一件事的两面）；
         *   关闭 → 收回，下次展开重新定位。
         *
         * 只在 open **翻转的那一刻**定位：展开期间用户自己悬停别的父项时，
         * 不能因为 selectedValue 变化就把视野拽回选中项那条链。
         */
        const wasOpen = React.useRef(false);
        React.useEffect(() => {
            if (wasOpen.current === open) return;
            wasOpen.current = open;
            setOpenPath(open ? initialPath : []);
        }, [open, initialPath]);

        /**
         * 主面板 ref。**引用必须稳定** —— 内联箭头每次渲染都会换身份，React 便会先以
         * null、再以节点各调用一次，「滚入视野」就会被无关渲染反复触发，把用户手动
         * 滚开的视野又拽回来。
         */
        const rootPanelRef = React.useCallback(
            (node: HTMLDivElement | null) => {
                panelRef.current = node;
                scrollSelectedIntoView(node);
            },
            [],
        );

        /** 子面板 ref 按父项 value 缓存，理由同上：子菜单在 Portal 里，也要靠挂载时机滚动 */
        const subPanelRefs = React.useRef(
            new Map<MenuValue, (node: HTMLDivElement | null) => void>(),
        );
        const getSubPanelRef = (value: MenuValue) => {
            let callback = subPanelRefs.current.get(value);
            if (!callback) {
                callback = (node) => scrollSelectedIntoView(node);
                subPanelRefs.current.set(value, callback);
            }
            return callback;
        };

        /** 叶子项被选中。closeOnSelect=false 时阻止 Radix 的默认关闭（用于「连点多项」场景） */
        const handleItemSelect = (option: MenuOption, event: Event) => {
            onSelect(option.value, option);
            if (!closeOnSelect) event.preventDefault();
        };

        /**
         * 渲染一层条目。
         * 分隔线、行外观、行内容都复用 menu-parts —— 两端只有「谁来当那行元素」不同：
         * H5 是自己的 button，PC 必须是 Radix 的 Item / SubTrigger（键盘巡航与子菜单
         * 状态都注册在它们身上），包一层会让 Radix 拿不到节点。
         *
         * depth 是当前层在树中的深度，用于把展开状态落到 openPath 的对应格子上。
         */
        const renderRows = (list: MenuItem[], depth = 0): React.ReactNode => {
            if (menuOptions(list).length === 0) {
                return <MenuEmptyState mode={mode}>{emptyText}</MenuEmptyState>;
            }

            return list.map((item, index) => {
                if (isMenuDivider(item))
                    return <MenuDividerRow key={`divider-${index}`} />;

                const rowClass = menuRowClass(mode, {
                    danger: item.danger,
                    disabled: item.disabled,
                });

                if (hasSubmenu(item)) {
                    return (
                        <DropdownMenuPrimitive.Sub
                            key={item.value}
                            open={openPath[depth] === item.value}
                            onOpenChange={(next) =>
                                // 展开时截掉该层之后的部分（同层只留一条链），收回时也只截到该层
                                setOpenPath((prev) =>
                                    next
                                        ? [...prev.slice(0, depth), item.value]
                                        : prev.slice(0, depth),
                                )
                            }
                        >
                            <DropdownMenuPrimitive.SubTrigger
                                disabled={item.disabled}
                                data-value={item.value}
                                data-danger={item.danger ? "true" : undefined}
                                className={rowClass}
                                data-slot="menu-row"
                            >
                                <MenuRowContent
                                    mode={mode}
                                    option={item}
                                    submenu
                                />
                            </DropdownMenuPrimitive.SubTrigger>
                            <DropdownMenuPrimitive.Portal>
                                <DropdownMenuPrimitive.SubContent
                                    ref={getSubPanelRef(item.value)}
                                    data-mode={mode === "mobile" ? "h5" : "pc"}
                                    // 子菜单向右展开是 Radix 的固定行为（SubContent 的类型里没有 side/align，
                                    // 它内部恒为 side="right" + align="start"），只暴露间距与碰撞检测。
                                    // 父层不动 —— 这正是与 H5「整层推入」的分野。
                                    sideOffset={SUBMENU_SIDE_OFFSET}
                                    avoidCollisions
                                    /**
                                     * 根面板的**自动聚焦**不算「焦点离开子菜单」。
                                     *
                                     * Radix 的 FocusScope 要等 container 落地（container 是 state，
                                     * 得多走一次提交）才聚焦根面板，比子面板挂载更晚。于是「展开即定位」
                                     * 时会出现这个次序：子面板挂上 focus-outside 监听 → 根面板才聚焦 →
                                     * 这次 focusin 落在根面板容器上，被判成焦点跑到子菜单外 → 刚铺开的
                                     * 整条链立刻被收回。
                                     *
                                     * 焦点落在**面板容器本身**（而非某个菜单项）说明是自动聚焦，放行这一次；
                                     * 焦点落到菜单项上仍按 Radix 默认行为收回子菜单。
                                     */
                                    onFocusOutside={(event) => {
                                        if (event.target === panelRef.current)
                                            event.preventDefault();
                                    }}
                                    className={cn(
                                        panelClass,
                                        "z-[var(--bv-menu-pc-z-index)]",
                                    )}
                                    data-slot="menu-subpanel"
                                >
                                    {renderRows(
                                        item.children as MenuItem[],
                                        depth + 1,
                                    )}
                                </DropdownMenuPrimitive.SubContent>
                            </DropdownMenuPrimitive.Portal>
                        </DropdownMenuPrimitive.Sub>
                    );
                }

                return (
                    <DropdownMenuPrimitive.Item
                        key={item.value}
                        disabled={item.disabled}
                        data-value={item.value}
                        data-danger={item.danger ? "true" : undefined}
                        {...(selectedValue !== undefined &&
                        item.value === selectedValue
                            ? { "data-selected": "true" }
                            : {})}
                        onSelect={(event) => handleItemSelect(item, event)}
                        className={rowClass}
                        data-slot="menu-row"
                    >
                        <MenuRowContent
                            mode={mode}
                            option={item}
                            selected={
                                selectedValue !== undefined
                                    ? item.value === selectedValue
                                    : undefined
                            }
                        />
                    </DropdownMenuPrimitive.Item>
                );
            });
        };

        return (
            <DropdownMenuPrimitive.Root open={open} onOpenChange={onOpenChange}>
                {/* asChild：本库自带触发器外壳（两端观感一致）。
          **不传** onActivate：Radix 的 Trigger 在 **onPointerDown** 上开合
          （dist/index.mjs 的 `onPointerDown: ... context.onOpenToggle()`），
          Slot 会把这个处理器合并进 MenuTrigger 的 props，我们再自己 toggle
          就会一次点击开合两次。注意它**不是** click —— 见 tests 里的 pointerDown 辅助函数。
          disabled 必须同时给 Radix 的 Trigger：Radix 会给子元素注入 `disabled: false`
          （dist 里 `const { disabled = false, ...triggerProps } = props`），
          经 Slot 合并后会**覆盖**我们传进 MenuTrigger 的那个 disabled，
          少了这一行，PC 端的禁用态会静默失效。 */}
                <DropdownMenuPrimitive.Trigger asChild disabled={disabled}>
                    <MenuTrigger
                        ref={triggerMergedRef}
                        id={id}
                        mode={mode}
                        open={open}
                        disabled={disabled}
                        aria-label={ariaLabel}
                    >
                        {trigger}
                    </MenuTrigger>
                </DropdownMenuPrimitive.Trigger>

                <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content
                        ref={rootPanelRef}
                        data-mode={mode === "mobile" ? "h5" : "pc"}
                        aria-label={ariaLabel}
                        align={placement === "bottom-end" ? "end" : "start"}
                        side="bottom"
                        sideOffset={SIDE_OFFSET}
                        // 翻转与位移防溢出交给 Radix Popper（矩阵 §2.2 的「自动翻转防溢出」）
                        avoidCollisions
                        className={cn(panelClass, className)}
                        data-slot="menu-panel"
                    >
                        {renderRows(items)}
                    </DropdownMenuPrimitive.Content>
                </DropdownMenuPrimitive.Portal>
            </DropdownMenuPrimitive.Root>
        );
    },
);
