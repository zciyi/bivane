import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";
import type { MenuItem, MenuOption, MenuValue } from "@/hooks/use-menu-state";

/**
 * Bivane DropdownMenu · 跨模式共用零件
 *
 * 共用的判据与 Select 一致：两端的**语义**相同（一个可展开的菜单按钮、
 * 一行可触发的菜单项），差异只在**外壳形态**——
 * H5 是整行通栏 + 下边线（Cell 观感、48px 热区），
 * PC 是描边圆角盒 + 悬停/键盘落点高亮（桌面密度、36px 行高）。
 * 这类差异属模式 A（纯 CSS），用 `mode` 分支给出两串 class 即可。
 *
 * 因此本文件里**没有** bv-h5: / bv-pc: 变体：那两个变体编译成后代选择器
 * `[data-mode='x'] &`，而触发器渲染在用户页面里、未必有 data-mode 祖先（架构 §6.5 规则 1）。
 *
 * 为什么行只给出 class 与内容、不给出成品组件：
 * PC 的行必须由 Radix 的 Item / SubTrigger 元素承担（键盘巡航、子菜单状态都在它身上），
 * 包一层自己的 button 会让 Radix 拿不到那个节点。所以这里导出的是
 * `menuRowClass()` + `<MenuRowContent />` 两件可组合的零件，两端各自组装。
 */

/* ------------------------------------------------------------------ *
 * 面板契约（分发层 → h5/、pc/ 两份实现）
 * ------------------------------------------------------------------ */

/**
 * 双模式必须完全一致的那组 props（契约第 9 条）。
 * 交互差异只能体现在**实现**里，不能通过这里泄露成「H5 专有 prop」。
 */
export interface MenuPanelProps {
    /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
    mode: DeviceMode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** 菜单树 */
    items: MenuItem[];
    onSelect: (value: MenuValue, option: MenuOption) => void;
    /** H5 抽屉根层的标题栏文案；PC 无标题栏（浮层由触发器说明自己是什么） */
    title?: React.ReactNode;
    /** 某一层没有可交互条目时的文案 */
    emptyText: React.ReactNode;
    /** PC 浮层与触发器的对齐方向 */
    placement: "bottom-start" | "bottom-end";
    /** 叶子项被选中后是否关闭菜单，默认 true */
    closeOnSelect: boolean;
    disabled: boolean;
    /** 触发器内容。有 value 时分发层回填选中项 label；纯操作菜单由调用方给静态文案 */
    trigger: React.ReactNode;
    /**
     * 可选值场景：当前选中叶子项的 value。给了它行尾就渲染选中勾，
     * H5 暂存模式下勾的是**暂存副本**（点确定才提交），PC 勾的是已提交值。
     * 纯操作菜单不传，行尾完全不渲染勾（保持操作菜单的原观感）。
     */
    selectedValue?: MenuValue;
    /**
     * 展开时要定位到的层级：选中项的**祖先 value 链**（未选中 / 值失效时为空数组）。
     *
     * 由分发层从选中值派生 —— 「选中值」跨模式同义，因此它的派生量也归分发层，
     * 两端只负责用各自的方式落位：H5 用它初始化面板栈（直接下钻到那一层），
     * PC 用它铺开子菜单链。空数组即「从根层开始」，与组件引入前一致。
     */
    initialPath: MenuValue[];
    /**
     * H5 是否走「暂存 → 确定」：点叶子项只把 value 记进暂存并打勾，
     * 点「确定」才 onChange + 关闭，「取消」放弃暂存。默认 false（点选即执行）。
     * PC 恒为点选即触发，此标记不影响 PC。
     */
    staged: boolean;
    /** 工具栏右键文案（H5 暂存确认时） */
    confirmText?: React.ReactNode;
    /** 工具栏左键文案（H5 暂存确认时；行为是关闭并放弃暂存） */
    cancelText?: React.ReactNode;
    /** 提交暂存（工具栏右键） */
    onConfirm: () => void;
    /** 关闭并放弃暂存（工具栏左键） */
    onCancel: () => void;
    className?: string;
    ariaLabel?: string;
    id?: string;
}

/* ------------------------------------------------------------------ *
 * 外壳形态
 * ------------------------------------------------------------------ */

function menuTriggerClass(mode: DeviceMode): string {
    if (mode === "mobile") {
        return cn(
            "relative flex w-full box-border items-center",
            "px-[var(--bv-menu-padding-x)] py-[var(--bv-menu-padding-y)]",
            "bg-bv-surface",
            "bv-hairline bv-hairline--bottom",
        );
    }
    return cn(
        "relative flex w-full box-border items-center",
        "h-[var(--bv-menu-pc-trigger-height)]",
        "px-[var(--bv-menu-padding-x)] py-0",
        "bg-bv-surface border border-[var(--bv-menu-pc-trigger-border-color)]",
        "rounded-[var(--bv-menu-pc-trigger-radius)]",
        "transition-colors duration-[var(--bv-duration-fast)]",
        "hover:border-bv-primary",
        "focus-visible:border-bv-primary focus-visible:outline-none",
        "focus-visible:ring-1 focus-visible:ring-bv-primary",
    );
}

export interface MenuRowState {
    danger?: boolean;
    disabled?: boolean;
}

/** 行外壳。两端行高刻意不同（48 / 36），见矩阵 §2.2 与 vant.css 的 token 注释 */
export function menuRowClass(
    mode: DeviceMode,
    state: MenuRowState = {},
): string {
    const common = cn(
        "flex w-full box-border cursor-pointer items-center border-0 bg-transparent text-left",
        "px-[var(--bv-menu-row-padding-x)]",
        "text-bv-md leading-[var(--bv-menu-row-line-height)]",
        state.danger
            ? "text-[var(--bv-menu-row-danger-color)]"
            : "text-bv-text",
        state.disabled && "text-[var(--bv-menu-row-disabled-color)]",
    );

    if (mode === "mobile") {
        return cn(
            common,
            "h-[var(--bv-menu-row-height)]",
            "active:bg-[var(--bv-menu-row-active-background)]",
        );
    }

    return cn(
        common,
        "h-[var(--bv-menu-pc-row-height)]",
        // Radix 用 data-highlighted 同时表达「鼠标悬停」与「键盘落点」。
        // 两侧必须同款高亮：鼠标与键盘是同一套菜单的两条入口，
        // 反馈分叉会让人以为键盘没生效（Select 的 PC 端是自研巡航，才需要 hover/active 分开写）。
        "data-[highlighted]:bg-[var(--bv-menu-row-hover-background)]",
        // 子菜单展开时父行保持高亮，否则浮层一出来「从哪来的」就丢了
        "data-[state=open]:bg-[var(--bv-menu-row-hover-background)]",
        "focus:outline-none",
    );
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

export interface MenuTriggerProps extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "disabled"
> {
    /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
    mode: DeviceMode;
    /** 展开状态，用于 aria-expanded 与箭头方向 */
    open?: boolean;
    disabled?: boolean;
    /**
     * 点击/回车/空格触发。
     *
     * H5 实现自己管开合，传它；PC 实现**不要**传 ——
     * PC 的开合归 Radix 的 Trigger，而它走的是两条我们不该重复的路径：
     * `onPointerDown → context.onOpenToggle()`（注意是 pointerdown，**不是 click**，
     * 所以测试里要用 fireEvent.pointerDown 才打得开）与 `onKeyDown`（Enter/空格同样 toggle）。
     * Radix 经 Slot 把这两个处理器合并进本组件，我们若再自己 toggle 一次，
     * 一次操作就会开合两次 —— 表现为「点开立刻又关」。
     */
    onActivate?: () => void;
}

export const MenuTrigger = React.forwardRef<
    HTMLButtonElement,
    MenuTriggerProps
>(function MenuTrigger(
    {
        mode,
        open = false,
        disabled = false,
        onActivate,
        className,
        onClick,
        onKeyDown,
        children,
        ...props
    },
    ref,
) {
    // 显式取出并组合：若把 onClick 留给 {...props} 展开，
    // Radix 注入的 onOpenToggle 会被覆盖掉，菜单永远打不开（契约第 17 条的同源问题）
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onActivate?.();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || disabled) return;
        // ArrowDown/ArrowUp 交给 Radix（PC）或 H5 的展开逻辑自行处理；
        // 这里只管「回车/空格 = 点击」这条两端一致的基础语义
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onActivate?.();
        }
    };

    return (
        <button
            ref={ref}
            type="button"
            disabled={disabled}
            aria-haspopup="menu"
            aria-expanded={open}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            data-state={open ? "open" : "closed"}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
                menuTriggerClass(mode),
                "gap-[var(--bv-menu-gap)]",
                disabled
                    ? "cursor-not-allowed opacity-[var(--bv-menu-disabled-opacity)]"
                    : "cursor-pointer",
                className,
            )}
            {...props}
            data-slot="menu-trigger"
        >
            <span
                data-slot="menu-trigger-label"
                className="min-w-0 flex-1 truncate"
            >
                {children}
            </span>
            <span
                data-slot="menu-trigger-indicator"
                aria-hidden="true"
                className={cn(
                    "flex shrink-0 items-center justify-center",
                    "text-[length:var(--bv-menu-icon-size)] text-[var(--bv-menu-icon-color)]",
                    "transition-transform duration-[var(--bv-duration-fast)]",
                    open && "rotate-180",
                )}
            >
                <Icon name="arrow-down" />
            </span>
        </button>
    );
});

export interface MenuTriggerPathProps {
    /** 从根到选中项的完整节点链，末项是选中项自身（顶层节点时长度为 1） */
    path: MenuOption[];
}

/**
 * 触发器的**层级回显**：把「根 → … → 选中项」整条链拼进触发器。
 *
 * 只回显末级 label 会丢掉「选中的是哪一层里的哪一项」——
 * 同名叶子挂在不同父级下时（如「移动到 / 归档」与「归档」），
 * 触发器上的两个字根本无法区分选的是哪一个。层级因此必须一起展示。
 *
 * 视觉：祖先与分隔符弱化（二级 / 三级文本色），末级保持正文色；
 * 分隔符间距复用 --bv-menu-gap，不为一个符号新开 token。
 * path 只有一项（顶层选中）时退化为纯 label，观感与本组件引入前一致。
 * 整行超出宽度的截断仍由 MenuTrigger 的 label 容器负责（不在这一层处理）。
 */
export function MenuTriggerPath({ path }: MenuTriggerPathProps) {
    return (
        <>
            {path.map((option, index) => {
                const isLeaf = index === path.length - 1;
                return (
                    <React.Fragment key={option.value}>
                        {index > 0 ? (
                            <span
                                data-slot="menu-trigger-path-separator"
                                aria-hidden="true"
                                className="mx-[var(--bv-menu-gap)] text-bv-text-3"
                            >
                                /
                            </span>
                        ) : null}
                        <span
                            data-slot={
                                isLeaf
                                    ? "menu-trigger-path-current"
                                    : "menu-trigger-path-ancestor"
                            }
                            className={isLeaf ? undefined : "text-bv-text-2"}
                        >
                            {option.label}
                        </span>
                    </React.Fragment>
                );
            })}
        </>
    );
}

/* ------------------------------------------------------------------ *
 * 行内容 / 分隔线 / 空态
 * ------------------------------------------------------------------ */

export interface MenuRowContentProps {
    mode: DeviceMode;
    option: MenuOption;
    /** 是否带二级菜单指示箭头（H5 的推入箭头；PC 由 Radix 的 SubTrigger 自带） */
    submenu?: boolean;
    /**
     * 是否为当前选中叶子项（可选值场景）。给了就渲染行尾选中勾 ——
     * 未选中时也占位（与 Select 的选项行同一做法），避免勾出现/消失时文案跳动。
     * 纯操作菜单（没有值语义）不传，行尾完全留白。
     */
    selected?: boolean;
}

export function MenuRowContent({
    mode,
    option,
    submenu = false,
    selected,
}: MenuRowContentProps) {
    return (
        <>
            {option.icon ? (
                <span
                    data-slot="menu-row-icon"
                    aria-hidden="true"
                    className={cn(
                        "mr-[var(--bv-menu-gap)] flex shrink-0 items-center",
                        "text-[length:var(--bv-menu-row-icon-size)] text-[var(--bv-menu-icon-color)]",
                    )}
                >
                    {option.icon}
                </span>
            ) : null}

            <span
                data-slot="menu-row-label"
                className="min-w-0 flex-1 truncate"
            >
                {option.label}
            </span>

            {/*
        快捷键提示只给 PC：触屏没有键盘，在抽屉里展示 ⌘K 是噪音。
        这不是 props 泄露 —— prop（shortcut）两端都接受、值也一致，
        差异由**模式**决定渲染，符合契约第 9 条。
      */}
            {mode === "desktop" && option.shortcut ? (
                <kbd
                    data-slot="menu-row-shortcut"
                    className={cn(
                        "ml-[var(--bv-menu-gap)] shrink-0 font-[inherit]",
                        "text-bv-sm leading-[var(--bv-menu-shortcut-line-height)]",
                        "text-[var(--bv-menu-shortcut-color)]",
                    )}
                >
                    {option.shortcut}
                </kbd>
            ) : null}

            {submenu ? (
                <span
                    data-slot="menu-row-submenu"
                    aria-hidden="true"
                    className={cn(
                        "ml-[var(--bv-menu-gap)] flex shrink-0 items-center",
                        "text-[length:var(--bv-menu-icon-size)] text-[var(--bv-menu-icon-color)]",
                    )}
                >
                    <Icon name="arrow" />
                </span>
            ) : null}

            {/*
        选中勾：复用 Select 的选中勾视觉（同一组 check token，语义就是「选中」），
        不另起 --bv-menu-* 颜色。selected 不传（纯操作菜单）时整段不渲染；
        传了但未选中也要占位，避免勾出现/消失时文案跳动（与 Select 选项行同做法）。
      */}
            {selected !== undefined ? (
                <span
                    data-slot="menu-row-check"
                    aria-hidden="true"
                    className={cn(
                        "ml-[var(--bv-menu-gap)] flex shrink-0 items-center justify-center",
                        "text-[length:var(--bv-select-option-check-size)]",
                    )}
                >
                    {selected ? (
                        <span className="text-[var(--bv-select-option-check-color)]">
                            <Icon name="check" />
                        </span>
                    ) : null}
                </span>
            ) : null}
        </>
    );
}

export const MenuDividerRow = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(function MenuDividerRow({ className, ...props }, ref) {
    return (
        <div
            ref={ref}
            role="separator"
            className={cn(
                "my-[var(--bv-menu-divider-margin-y)] h-px w-full shrink-0",
                "bg-[var(--bv-menu-divider-color)]",
                className,
            )}
            {...props}
            data-slot="menu-divider"
        />
    );
});

export interface MenuEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
    mode: DeviceMode;
}

export const MenuEmptyState = React.forwardRef<
    HTMLDivElement,
    MenuEmptyStateProps
>(function MenuEmptyState({ mode, className, children, ...props }, ref) {
    return (
        <div
            ref={ref}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            className={cn(
                "box-border w-full",
                "px-[var(--bv-menu-row-padding-x)] py-[var(--bv-menu-empty-padding-y)]",
                "text-center text-bv-md leading-[var(--bv-menu-empty-line-height)] text-bv-text-3",
                className,
            )}
            {...props}
            data-slot="menu-empty"
        >
            {children}
        </div>
    );
});
