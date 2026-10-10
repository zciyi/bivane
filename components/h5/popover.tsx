import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn, composeRefs } from "@/lib/utils";
import { Portal } from "@/lib/portal";
import { Popup } from "@/components/responsive/popup";
import {
  POPOVER_TRANSITION_MS,
  PopoverBody,
  popoverBubbleClass,
  readRootInt,
  readRootPx,
  resolvePopoverForm,
  type PopoverForm,
  type PopoverPanelProps,
} from "@/components/ui/popover-parts";

/**
 * Bivane Popover · H5 实现
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * 两种形态（默认按内容量二选一，打开那一刻定，关闭后收回）：
 *   轻量气泡：行数 ≤ 阈值 —— Radix Popover 锚定触发器，翻转防溢出交 Popper，点外部关；
 *   底部抽屉：行数 > 阈值 —— 复用 Popup bottom（遮罩 / 安全区 / 滚动锁整套现成）。
 * 行数阈值事实源是 --bv-popover-h5-bubble-max-rows（默认 3），maxRows prop 可单实例覆盖；
 * h5Form 显式给 bubble/drawer 时为业务强制形态，跳过行数/高度判定与测量探针。
 *
 * 纯 actions 形态行数确定，直接数；带自定义内容时先挂一个不可见的测量探针，
 * 实测面板高度再和「阈值行数」高度比（宽度不确定时高度没有意义，探针按气泡限宽渲染）。
 *
 * 气泡形态保留 **Anchor + 自定义 click 开合**（与 PC 端改用 Trigger 的做法不同，
 * 不是历史遗留）：本组件 bubble / drawer 双形态共用外层同一个 open，而 Radix Root
 * 的 open 只反映 bubbleOpen；Trigger 的内部 onOpenToggle 在 drawer 形态/测量未定态
 * 下会与外层状态错位。触屏没有鼠标「mousedown 默认迁焦」的竞态（且 onOpenAutoFocus
 * 已阻止抢焦），onPointerDownOutside 守卫足以保证点触发器不误关。
 */

/** jsdom 无 CSS 级联取不到 token 时的兜底；事实源是 vant.css 中的同名 token */
const FALLBACK_ROW_HEIGHT = 48;
const FALLBACK_MAX_ROWS = 3;
const FALLBACK_OFFSET = 4;

interface MeasureProbeProps {
  /** 实测到高度后回调一次，随后探针自卸载 */
  onMeasure: (height: number) => void;
  children: React.ReactNode;
}

function MeasureProbe({ onMeasure, children }: MeasureProbeProps) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    onMeasure(ref.current?.offsetHeight ?? 0);
    // 只在挂载时测一次；内容变化由外层 key/开合负责
  }, [onMeasure]);

  return (
    <Portal>
      <div
        ref={ref}
        aria-hidden="true"
        data-slot="popover-measure"
        className="pointer-events-none fixed left-0 top-0 invisible w-[var(--bv-popover-h5-bubble-max-width)]"
      >
        {children}
      </div>
    </Portal>
  );
}

export const H5Popover = React.forwardRef<HTMLElement, PopoverPanelProps>(
  function H5Popover(
    {
      mode,
      open,
      onOpenChange,
      content,
      actions,
      placement,
      onAction,
      disabled,
      h5Form,
      maxRows,
      ariaLabel,
      className,
      children,
    },
    ref,
  ) {
    /** null = 尚未定形态（带自定义内容时正在测量） */
    const [form, setForm] = React.useState<PopoverForm | null>(null);
    const triggerRef = React.useRef<HTMLElement | null>(null);

    const hasCustomContent = content != null;
    const rowHeight = readRootPx(
      "--bv-popover-h5-row-height",
      FALLBACK_ROW_HEIGHT,
    );
    const tokenMaxRows = readRootInt(
      "--bv-popover-h5-bubble-max-rows",
      FALLBACK_MAX_ROWS,
    );
    // prop 是单实例覆盖；非法值（缺省 / ≤0）不采纳，落回 token 阈值
    const resolvedMaxRows =
      typeof maxRows === "number" && maxRows > 0 ? maxRows : tokenMaxRows;
    const sideOffset = readRootPx("--bv-popover-offset", FALLBACK_OFFSET);

    // 打开即定形态：强制形态 / 纯 actions 直接判定（纯函数短路或数行）；
    // 只有 auto + 自定义内容才需要等测量探针。
    // 注意不能在打开时无条件 setForm(null)：layout effect 子先父后，探针回传
    // 的形态会被这里的 null 覆盖，表现为「探针常驻、面板永不渲染」。
    // null 的保证来自初始态与关闭时的收回（下方退场 effect / Popup onClosed）。
    // 依赖显式列全：actions 在打开期间变化时重新判定是合理的（行数变多就该换形态）。
    React.useLayoutEffect(() => {
      if (!open) return;
      if (h5Form === "auto" && hasCustomContent) return;
      setForm(
        resolvePopoverForm({
          actionCount: actions.length,
          measuredHeight: null,
          rowHeight,
          maxRows: resolvedMaxRows,
          preference: h5Form,
        }),
      );
    }, [
      open,
      h5Form,
      hasCustomContent,
      actions.length,
      rowHeight,
      resolvedMaxRows,
    ]);

    const handleMeasure = React.useCallback(
      (height: number) => {
        setForm(
          resolvePopoverForm({
            actionCount: actions.length,
            measuredHeight: height,
            rowHeight,
            maxRows: resolvedMaxRows,
          }),
        );
      },
      [actions.length, rowHeight, resolvedMaxRows],
    );

    // 气泡形态：关闭后等退场动画播完再收回 form（抽屉由 Popup onClosed 收回）
    React.useEffect(() => {
      if (open || form !== "bubble") return undefined;
      const timer = window.setTimeout(
        () => setForm(null),
        POPOVER_TRANSITION_MS,
      );
      return () => window.clearTimeout(timer);
    }, [open, form]);

    const handleTriggerClick = () => {
      if (disabled) return;
      onOpenChange(!open);
    };

    const childProps = children.props as Partial<{
      ref: React.Ref<HTMLElement>;
      className: string;
      onClick: React.MouseEventHandler<HTMLElement>;
    }>;

    // children 是任意元素（P 未知），断言成「可挂任意 props」的元素类型后再 clone
    const trigger = React.cloneElement(
      children as React.ReactElement<Record<string, unknown>>,
      {
        ref: composeRefs(
          ref,
          (node) => {
            triggerRef.current = node;
          },
          childProps.ref,
        ),
        "data-slot": "popover-trigger",
        "data-mode": "h5",
        "aria-haspopup": "dialog",
        "aria-expanded": open ? "true" : "false",
        "data-disabled": disabled ? "true" : undefined,
        className: cn(childProps.className),
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          childProps.onClick?.(event);
          if (!event.defaultPrevented) handleTriggerClick();
        },
      },
    );

    const bubbleOpen = open && form === "bubble";
    const drawerOpen = open && form === "drawer";

    return (
      <>
        <PopoverPrimitive.Root
          open={bubbleOpen}
          onOpenChange={(next) => {
            if (disabled) return;
            onOpenChange(next);
          }}
          modal={false}
        >
          <PopoverPrimitive.Anchor asChild>
            {trigger}
          </PopoverPrimitive.Anchor>

          {form === "bubble" ? (
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content
                data-mode="h5"
                data-slot="popover-panel"
                data-form="bubble"
                aria-label={ariaLabel ?? "气泡弹层"}
                side={placement}
                align="center"
                sideOffset={sideOffset}
                avoidCollisions
                onOpenAutoFocus={(event) => {
                  // 触屏不抢焦点：避免点击触发后的页面滚动与虚焦轮廓
                  event.preventDefault();
                }}
                onPointerDownOutside={(event) => {
                  // 点触发器时由触发器自己的 onClick 完成 toggle；
                  // 不拦会让 Radix 关一次、click 又开一次（同 Select 的坑）
                  const target =
                    event.detail.originalEvent.target;
                  if (
                    target instanceof Node &&
                    triggerRef.current?.contains(target)
                  ) {
                    event.preventDefault();
                  }
                }}
                className={cn(
                  popoverBubbleClass(mode),
                  className,
                )}
              >
                <PopoverBody
                  mode={mode}
                  content={content}
                  actions={actions}
                  onAction={onAction}
                />
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          ) : null}
        </PopoverPrimitive.Root>

        {form === "drawer" ? (
          <Popup
            open={drawerOpen}
            onOpenChange={onOpenChange}
            position="bottom"
            forceMode={mode}
            onClosed={() => setForm(null)}
            className={className}
          >
            <div
              data-slot="popover-drawer"
              data-form="drawer"
              data-mode="h5"
            >
              <PopoverBody
                mode={mode}
                content={content}
                actions={actions}
                onAction={onAction}
              />
            </div>
          </Popup>
        ) : null}

        {/* 形态未定 + 正在打开 + auto + 有自定义内容：挂探针量高度；强制形态无需测量 */}
        {open &&
        form === null &&
        hasCustomContent &&
        h5Form === "auto" ? (
          <MeasureProbe onMeasure={handleMeasure}>
            <PopoverBody
              mode={mode}
              content={content}
              actions={actions}
              onAction={onAction}
            />
          </MeasureProbe>
        ) : null}
      </>
    );
  },
);
