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
 *   开合用 **Popover.Trigger（asChild）**，不能用 Anchor 自管开合 ——
 *   Trigger 才会把外部传入的任意触发器登记到 Radix 的 triggerRef，
 *   「点触发器 / 焦点落回触发器不算浮层外部交互」的延迟关闭保护才生效；
 *   鼠标 click toggle 由 Radix 承担（跨实例在同一 click 事件内完成关旧开新），
 *   键盘 Enter/Space 对原生 button 自动生效，div 触发器由外部自身处理。
 *   开合后焦点落入面板，Tab 在面板内循环（FocusScope），Esc 关闭，
 *   关闭后焦点显式归还触发器（契约第 5 条）。
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

    const childProps = children.props as Partial<{
      ref: React.Ref<HTMLElement>;
      className: string;
      onClick: React.MouseEventHandler<HTMLElement>;
      onKeyDown: React.KeyboardEventHandler<HTMLElement>;
    }>;

    // 外部传入的原始 onClick 原样保留（Slot 合序：Trigger 处理器 → 子元素处理器）
    const trigger = React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        ref: composeRefs(ref, childProps.ref),
        "data-slot": "popover-trigger",
        "data-mode": "pc",
        "aria-haspopup": "dialog",
        "aria-expanded": open ? "true" : "false",
        "data-disabled": disabled ? "true" : undefined,
        className: cn(childProps.className),
        onClick: childProps.onClick,
        onKeyDown: childProps.onKeyDown,
      },
    );

    return (
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        modal={false}
      >
        {/* Trigger asChild 不加额外 DOM，内部仍渲染 Popper.Anchor 承担定位，
          同时把触发器登记进 triggerRef（延迟关闭保护的前提）。
          disabled 守卫挂 Trigger 本身：其 onClick 先于 onOpenToggle 执行，
          preventDefault 才能短路 toggle（子元素处理器在 Slot 中排最后） */}
        <PopoverPrimitive.Trigger
          asChild
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          {trigger}
        </PopoverPrimitive.Trigger>

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
            // 不自定义 onCloseAutoFocus：外部转焦不还焦由 Radix
            // hasInteractedOutside 自动跳过，Esc 才还焦 trigger（§3.11 规则 7）
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
