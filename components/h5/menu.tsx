import * as React from "react";
import { cn } from "@/lib/utils";
import { Popup } from "@/components/responsive/popup";
import {
    PanelHeader,
    type PanelHeaderCrumb,
} from "@/components/ui/panel-header";
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
    resolveMenuPanels,
    type MenuItem,
    type MenuOption,
    type MenuValue,
} from "@/hooks/use-menu-state";

/**
 * Bivane DropdownMenu · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：**底部抽屉 + 二级面板推入**。
 *   点带子菜单的行 → 下一层从右侧推入视野；
 *   头部铺出「进入各层时点的那一项 → 当前层的选中项」层级链，**链上每一项都点得** ——
 *   点哪一项就落回那一层（链首即回最上层）。这是移动端「层级下钻」的范式：屏幕窄，
 *   子菜单无法像桌面那样在右侧并排展开，只能替换当前视野；回头也就不再靠「返回箭头」
 *   逐层退（左键统一是「取消」，见下），而是靠链上直接点名要去哪一层。
 *   根层同样铺面包屑（只有一格面板名）—— 否则「居中标题」与「左对齐层级行」会在第一层
 *   与第二层之间跳：行数与对齐都在变。
 *
 * 与 PC 的分野（矩阵 §2.2）：
 *   - 容器：Popup 的底部弹层（可下拉关闭）vs Radix 锚定浮层
 *   - 下钻：整层推入、回头靠层级链点名 vs 子菜单向右展开、父层不动
 *   - 行高：48px 触控热区 vs 36px 桌面密度
 *   - 快捷键提示：不渲染（触屏没有键盘）vs 渲染成 kbd
 *
 * 抽屉不接管滚动（scrollable={false}）：每一层面板各自滚动，
 * 否则进到第二层时滚动位置会与第一层共享，返回时位置全乱。
 *
 * 拖拽关闭由 Popup 只在指示条区域起拖（DRAG_REGION_ATTR），
 * 菜单行上的滑动因此不会被误判成下拉关闭。
 */

export const H5Menu = React.forwardRef<HTMLButtonElement, MenuPanelProps>(
    function H5Menu(
        {
            mode,
            open,
            onOpenChange,
            items,
            onSelect,
            title,
            emptyText,
            closeOnSelect,
            disabled,
            trigger,
            selectedValue,
            initialPath,
            staged,
            confirmText,
            cancelText,
            onConfirm,
            onCancel,
            className,
            ariaLabel,
            id,
        },
        ref,
    ) {
        const [path, setPath] = React.useState<MenuValue[]>([]);
        const viewportRef = React.useRef<HTMLDivElement>(null);

        /**
         * 开合时重置面板栈：
         *   展开 → 直接下钻到选中项所在的那一层（否则用户得自己一层层点进去，
         *          才能确认当前选的是哪一条链 —— 与触发器的层级回显是同一件事的两面）；
         *   关闭 → 回到根层，下次展开重新定位，而不是停在上次手动下钻的位置。
         *
         * 只在 open **翻转的那一刻**定位：展开期间改草稿（暂存模式点叶子会改 selectedValue）
         * 不能让视野弹回去，否则用户点一下就被踢回上一层。
         */
        const wasOpen = React.useRef(false);
        React.useEffect(() => {
            if (wasOpen.current === open) return;
            wasOpen.current = open;
            setPath(open ? initialPath : []);
        }, [open, initialPath]);

        /**
         * 把**当前层**的选中项滚入视野。
         * 长菜单里选中项可能在屏幕外，只下钻到该层还差最后一步「看得到」。
         * 依赖 path.length：每进入新的一层都重新定位该层。
         */
        React.useEffect(() => {
            if (!open) return;
            const layer = viewportRef.current?.querySelector(
                `[data-depth="${path.length}"]`,
            );
            const row = layer?.querySelector('[data-selected="true"]');
            if (row instanceof HTMLElement)
                row.scrollIntoView({ block: "nearest" });
        }, [open, path.length]);

        const panels = React.useMemo(
            () => resolveMenuPanels(items, path),
            [items, path],
        );

        // resolveMenuPanels 在路径失效时就地截断（菜单树可能因权限/数据变化而收窄），
        // 此时面板栈比 path 短。把状态收敛回去，避免「返回按钮层数与实际视野不一致」。
        React.useEffect(() => {
            const maxDepth = panels.length - 1;
            if (path.length > maxDepth)
                setPath((prev) => prev.slice(0, maxDepth));
        }, [panels.length, path.length]);

        const push = React.useCallback((value: MenuValue) => {
            setPath((prev) => [...prev, value]);
        }, []);

        const activate = (option: MenuOption) => {
            if (option.disabled) return;
            if (hasSubmenu(option)) {
                push(option.value);
                return;
            }
            onSelect(option.value, option);
            if (closeOnSelect) onOpenChange(false);
        };

        const current = panels[panels.length - 1];
        const trail = current.trail;

        /**
         * 头部层级：把面板栈摊平成「进入各层时点的那一项 → 当前层的选中项」。
         *
         * 根层也有面包屑（只有一格面板名）—— 头部结构不该在下钻那一刻跳：
         * 没有它时，第一层是居中标题、第二层是左对齐层级行，行数与对齐同时变。
         *
         * 下钻后分两段拼：
         *   ① 链身 —— 每层「进来时点的那一项」；
         *   ② 链尾 —— 当前层的选中项（暂存模式下与行内勾同源于草稿值）。
         * 于是头部显示的就是「确定后会回填到触发器的整条链」，与 MenuTriggerPath
         * 的回显是同一件事的两面。
         *
         * 链上第 i 项就是**第 i 层的选中值**，所以每一项都点得：点它 = 把 path 截到 i，
         * 落回那一层（那一行正好就是这一项，看得见自己选了谁）。链尾那项照给 ——
         * 它所在的层就是当前层，点上去自然收敛，不必为它单开一条不可点的样式。
         */
        const crumbs = React.useMemo<PanelHeaderCrumb[]>(() => {
            // 根层：没有「进来时点的那一项」，链上只有面板名一格。它是当前落点，
            // 点不动，因而**不给 onSelect**（PanelHeader 会渲染成不可点的一项）
            if (trail.length === 0)
                return title === undefined ? [] : [{ label: title }];

            // panels[0] 是根层，链身从第二层起算：
            // panels[i] 的 trail[i-1] 正是进入它时点的那一项
            const chain: PanelHeaderCrumb[] = panels
                .slice(1)
                .map((panel, index) => ({
                    label: panel.trail[index].label,
                    onSelect: () => setPath(path.slice(0, index)),
                }));

            // 选中项只在**当前层**里才补：它挂在别的分支时补进链尾，会被读成
            // 「当前层的子项」，与用户眼前这一层对不上
            const picked = menuOptions(current.items).find(
                (item) => !hasSubmenu(item) && item.value === selectedValue,
            );
            if (picked)
                chain.push({
                    label: picked.label,
                    onSelect: () => setPath(path.slice(0, path.length)),
                });

            return chain;
        }, [panels, path, current, selectedValue, trail.length, title]);

        /**
         * 头部什么时候渲染（两种都有时才完整，缺什么缺哪半边）：
         *   - 有面包屑就铺面包屑（下钻中是整条层级链、每一项都可点；根层是一格面板名）；
         *   - 没有 title 也没有下钻则可以完全不渲染；
         *   - 走暂存确认（staged）则必有「取消/确定」。
         * 头部统一由 PanelHeader 渲染（与 Select 共用同一套零件与 token），
         * 不再在这里手写标题栏 —— 曾经的本地实现（menu-header/menu-back/menu-title）
         * 已被它取代（token 也收进了公共的 --bv-panel-header-* 组）。
         */
        const showHeader = crumbs.length > 0 || staged;

        const renderRows = (list: MenuItem[]) => {
            if (menuOptions(list).length === 0) {
                return <MenuEmptyState mode={mode}>{emptyText}</MenuEmptyState>;
            }

            return list.map((item, index) => {
                if (isMenuDivider(item))
                    return <MenuDividerRow key={`divider-${index}`} />;
                const submenu = hasSubmenu(item);
                // 选中勾只属于叶子项；父项的行尾永远是下钻箭头，两者不共存
                const selected =
                    !submenu && selectedValue !== undefined
                        ? item.value === selectedValue
                        : undefined;
                return (
                    <button
                        key={item.value}
                        type="button"
                        role="menuitem"
                        // 父项在无障碍语义上是「打开一个子菜单」，不是「执行一个动作」
                        aria-haspopup={submenu ? "menu" : undefined}
                        disabled={item.disabled}
                        data-value={item.value}
                        data-submenu={submenu ? "true" : undefined}
                        {...(selected ? { "data-selected": "true" } : {})}
                        onClick={() => activate(item)}
                        className={menuRowClass(mode, {
                            danger: item.danger,
                            disabled: item.disabled,
                        })}
                        data-slot="menu-row"
                    >
                        <MenuRowContent
                            mode={mode}
                            option={item}
                            submenu={submenu}
                            selected={selected}
                        />
                    </button>
                );
            });
        };

        return (
            <>
                <MenuTrigger
                    ref={ref}
                    id={id}
                    mode={mode}
                    open={open}
                    disabled={disabled}
                    aria-label={ariaLabel}
                    onActivate={() => onOpenChange(!open)}
                >
                    {trigger}
                </MenuTrigger>

                <Popup
                    open={open}
                    onOpenChange={onOpenChange}
                    position="bottom"
                    // 每一层自己滚：共享滚动的弹层在图层切换时会把上一层的滚动位置带过来
                    scrollable={false}
                    // 传已解析的 mode，让 forceMode 逃生舱对容器形态与滚动锁策略同样生效
                    forceMode={mode}
                    aria-label={
                        ariaLabel ??
                        (typeof title === "string" ? title : "菜单")
                    }
                    className={className}
                >
                    {showHeader ? (
                        <PanelHeader
                            mode={mode}
                            // 头部一律铺面包屑（下钻中是整条层级链、每一项都可点；
                            // 根层是一格面板名）；没有面包屑时退回普通居中标题
                            {...(crumbs.length > 0
                                ? { breadcrumb: crumbs }
                                : { title })}
                            // 左键统一是「取消」（关闭面板并放弃暂存）；
                            // 层级导航交给面包屑每一项可点，不再用返回箭头逐层退
                            {...(staged ? { onCancel, cancelText } : {})}
                            {...(staged ? { onConfirm, confirmText } : {})}
                        />
                    ) : null}

                    {/* 面板轨道：整条轨道按 path 深度左移，形成「推入」观感。
            位移是运行时动态值，属契约第 4 条允许的内联 style 例外。 */}
                    <div
                        ref={viewportRef}
                        data-slot="menu-viewport"
                        className="relative min-h-0 flex-1 overflow-hidden"
                    >
                        <div
                            data-slot="menu-track"
                            className={cn(
                                "flex",
                                "transition-transform duration-[var(--bv-menu-push-duration)] ease-out",
                                "motion-reduce:transition-none",
                            )}
                            style={{
                                transform: `translateX(-${path.length * 100}%)`,
                            }}
                        >
                            {panels.map((panel, index) => {
                                const isCurrent = index === panels.length - 1;
                                return (
                                    <div
                                        key={index}
                                        role="menu"
                                        aria-label={ariaLabel}
                                        // 非当前层从无障碍树里摘掉，否则读屏会把看不到的那一层也念出来
                                        aria-hidden={
                                            isCurrent ? undefined : true
                                        }
                                        // 槽名刻意与 PC 的 menu-panel / menu-subpanel 区分开：
                                        // 三个名字若撞车，一方面「H5 不该出现 PC 浮层」这类断言会假失败，
                                        // 另一方面 utilities.css 的动画规则会命中错的对象（契约第 16 条）
                                        data-slot="menu-layer"
                                        data-depth={index}
                                        {...(isCurrent
                                            ? { "data-bv-scroll-container": "" }
                                            : {})}
                                        className={cn(
                                            "box-border w-full shrink-0",
                                            "max-h-[var(--bv-menu-panel-max-height)] overflow-y-auto overscroll-contain",
                                            !isCurrent && "pointer-events-none",
                                        )}
                                    >
                                        {renderRows(panel.items)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </Popup>
            </>
        );
    },
);
