import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Tooltip = lazyWithRef(() => import("@/components/h5/tooltip").then((m) => ({ default: m.H5Tooltip })));
const PcTooltip = lazyWithRef(() => import("@/components/pc/tooltip").then((m) => ({ default: m.PcTooltip })));
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane Tooltip · 分发层
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * 同一段补充说明，两端容器密度不同：
 * ┌ H5 ── 没有 hover，说明直接常驻：主体下方一条 ⓘ 信息提示条（全文展示）。
 * │       open/disabled 等触发类 props 在 H5 无作用对象（本端不渲染浮层）；
 * │       文案太长要折叠时，content 传 <Ellipsis>。
 * └ PC ── hover 200ms 延迟触发、气泡随鼠标移动；focus 立刻触发（锚定元素）；Esc 可关。
 *
 * 气泡是纯展示：不含可交互内容、不阻断指针；要放操作按钮请用 Popover。
 * children 必须是**单个**会把 props/ref 落到真实 DOM 的元素（与 Radix asChild 同约束）。
 */

export interface TooltipProps {
  /** 提示内容（两端共享的唯一信息：内容渲染）；H5 全文常驻，超长折叠可传 <Ellipsis> */
  content: React.ReactNode;
  /** 被说明的主体，必须是单个 React 元素 */
  children: React.ReactElement;
  /** 受控开合（仅 PC 浮层有意义；H5 说明常驻） */
  open?: boolean;
  /** 非受控初始开合（仅 PC） */
  defaultOpen?: boolean;
  /** 开合变化（仅 PC 浮层；H5 说明常驻不触发） */
  onOpenChange?: (open: boolean) => void;
  /** PC 禁用时不响应 hover/focus（不影响 children 自身禁用态）；H5 恒展示说明条 */
  disabled?: boolean;
  /** 透传给 PC 气泡 / H5 信息提示条的 className */
  className?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

export const Tooltip = React.forwardRef<HTMLElement, TooltipProps>(
  function Tooltip(
    {
      content,
      children,
      open,
      defaultOpen = false,
      onOpenChange,
      disabled = false,
      className,
      forceMode,
    },
    ref,
  ) {
    const mode = useDeviceMode(forceMode);
    const isControlled = open !== undefined;
    const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
    const opened = isControlled ? open : innerOpen;

    const setOpen = React.useCallback(
      (next: boolean) => {
        if (!isControlled) setInnerOpen(next);
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange],
    );

    // 提示体 id 与主体 aria-describedby 配对；useId 保证同页多个 Tooltip 不串
    const rawId = React.useId();
    const describedById = `bv-tooltip-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    // H5 是常驻说明条：没有开合/禁用概念，触发类状态只服务 PC 浮层。
    // 上面的 hooks 仍须无条件调用（不能随模式提前 return 跳过 hook）。
    if (mode === "mobile") {
      return (
        <React.Suspense fallback={null}>
          <H5Tooltip
            ref={ref}
            mode={mode}
            content={content}
            infoId={describedById}
            className={className}
          >
            {children}
          </H5Tooltip>
        </React.Suspense>
      );
    }

    return (
      <React.Suspense fallback={null}>
        <PcTooltip
          ref={ref}
          mode={mode}
          open={opened}
          onOpenChange={setOpen}
          content={content}
          bubbleId={describedById}
          disabled={disabled}
          className={className}
        >
          {children}
        </PcTooltip>
      </React.Suspense>
    );
  },
);
