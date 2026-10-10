import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn, composeRefs } from "@/lib/utils";
import {
    PopoverBody,
    popoverBubbleClass,
    readRootPx,
    type PopoverPanelProps,
} from "@/components/ui/popover-parts";

/**
 * Bivane Popover · PC 实现
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 *   锚定触发器的 Radix Popover：翻转 / 防溢出 / 与触发器间距全交 Popper；
 *   点击触发器开合（键盘 Enter/Space 由原生 button 转成 click，一并覆盖）；
 *   键盘可导航：开合后焦点落入面板，Tab 在面板内循环（FocusScope），Esc 关闭，
 *   关闭后焦点显式归还触发器（Anchor 不是 Trigger，Radix 不会自动还焦）。
 *
 * 用 Anchor 不用 Trigger（与 Select/TimePicker/H5 气泡同一处坑）：
 *   触发器是外部传入的任意元素、自带 onClick 语义，Slot 叠 Radix Trigger 的
 *   pointerdown 开合会出现双触发 / 失效；Anchor 只登记定位参考，交互自管。
 *
 * 行内漫游（↑↓/typeahead/子菜单）是 DropdownMenu 的语义，不在这里：
 * Popover 的内容可以是任意自定义节点，Tab 顺序是它的正确导航方式。
 */

const FALLBACK_OFFSET = 4;

export const PcPopover = React.forwardRef<HTMLElement, PopoverPanelProps>(
    function PcPopover(
        {
            mode,
            open,
            onOpenChange,
            content,
            actions,
            placement,
            onAction,
            disabled,
            ariaLabel,
            className,
            children,
        },
        ref,
    ) {
        const sideOffset = readRootPx("--bv-popover-offset", FALLBACK_OFFSET);
        const triggerRef = React.useRef<HTMLElement | null>(null);

        const childProps = children.props as Partial<{
            ref: React.Ref<HTMLElement>;
            className: string;
            onClick: React.MouseEventHandler<HTMLElement>;
        }>;

        const handleTriggerClick = (event: React.MouseEvent<HTMLElement>) => {
            childProps.onClick?.(event);
            if (disabled || event.defaultPrevented) return;
            onOpenChange(!open);
        };

        // children 是任意元素（P 未知），断言成「可挂任意 props」的元素类型后再 clone
        const trigger = React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
                ref: composeRefs(
                    ref,
                    (node: HTMLElement | null) => {
                        triggerRef.current = node;
                    },
                    childProps.ref,
                ),
                "data-slot": "popover-trigger",
                "data-mode": "pc",
                "aria-haspopup": "dialog",
                "aria-expanded": open ? "true" : "false",
                "data-disabled": disabled ? "true" : undefined,
                className: cn(childProps.className),
                onClick: handleTriggerClick,
            },
        );

        return (
            <PopoverPrimitive.Root
                open={open}
                onOpenChange={onOpenChange}
                modal={false}
            >
                {/* Anchor 只登记定位参考元素，不注入任何交互属性 */}
                <PopoverPrimitive.Anchor asChild>
                    {trigger}
                </PopoverPrimitive.Anchor>

                <PopoverPrimitive.Portal>
                    <PopoverPrimitive.Content
                        data-mode="pc"
                        data-slot="popover-panel"
                        data-form="bubble"
                        aria-label={ariaLabel ?? "气泡弹层"}
                        side={placement}
                        align="center"
                        sideOffset={sideOffset}
                        avoidCollisions
                        onCloseAutoFocus={(event) => {
                            // 没有 Trigger：Radix 无处归还焦点，显式还给触发器（契约第 5 条）
                            event.preventDefault();
                            triggerRef.current?.focus();
                        }}
                        className={cn(popoverBubbleClass(mode), className)}
                    >
                        <PopoverBody
                            mode={mode}
                            content={content}
                            actions={actions}
                            onAction={onAction}
                        />
                    </PopoverPrimitive.Content>
                </PopoverPrimitive.Portal>
            </PopoverPrimitive.Root>
        );
    },
);
