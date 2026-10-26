import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Popover = lazyWithRef(() => import("@/components/h5/popover").then((m) => ({ default: m.H5Popover })));
const PcPopover = lazyWithRef(() => import("@/components/pc/popover").then((m) => ({ default: m.PcPopover })));
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import type {
  PopoverAction,
  PopoverFormPreference,
  PopoverPlacement,
} from "@/components/ui/popover-parts";

/**
 * Bivane Popover · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * ┌ H5 ── 点击触发：内容行数 ≤ maxRows 用锚定触发器的轻量气泡（翻转防溢出），
 * │       超出降级为底部抽屉（遮罩 / 安全区 / 滚动锁）；阈值走 token，h5Form 可强制
 * └ PC ── 锚定浮层（Radix Popper 翻转防溢出），Tab 面板内导航、Esc 关闭
 *
 * 信息模型两端一致：自定义 content + actions 行列表（Vant Popover 同源）。
 * children 必须是**单个**会把 props/ref 落到真实 DOM 的元素（与 Radix asChild 同约束）。
 */

export interface PopoverProps {
  /** 触发元素，必须是单个 React 元素 */
  children: React.ReactElement;
  /** 自定义面板内容；与 actions 同时给出时渲染在列表上方 */
  content?: React.ReactNode;
  /** 动作行列表；H5 行数超过 maxRows（或自定义内容实测超过阈值高度）自动改走底部抽屉 */
  actions?: PopoverAction[];
  /** 气泡优先展开方向，默认 bottom；碰撞时由 Radix Popper 翻转。H5 抽屉形态忽略 */
  placement?: PopoverPlacement;
  /** 受控开合 */
  open?: boolean;
  /** 非受控初始开合 */
  defaultOpen?: boolean;
  /** 开合变化（受控与非受控都会触发） */
  onOpenChange?: (open: boolean) => void;
  /** 点动作行后是否关闭面板，默认 true（两端一致） */
  closeOnClickAction?: boolean;
  /** 禁用时触发器不响应开合 */
  disabled?: boolean;
  /** 面板的无障碍名称；内容没有可见标题时建议传入 */
  ariaLabel?: string;
  /** 透传给面板的 className */
  className?: string;
  /**
   * H5 形态偏好，默认 auto（行数 ≤ maxRows 气泡，超出抽屉）；
   * 显式 bubble/drawer 强制形态。仅 H5 生效，PC 恒为锚定浮层
   */
  h5Form?: PopoverFormPreference;
  /**
   * H5 自动分界时气泡允许的最大动作行数，仅 h5Form="auto" 时生效。
   * 缺省读 token --bv-popover-h5-bubble-max-rows（默认 3）。仅 H5 生效
   */
  maxRows?: number;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

export const Popover = React.forwardRef<HTMLElement, PopoverProps>(
  function Popover(
    {
      children,
      content,
      actions,
      placement = "bottom",
      open,
      defaultOpen = false,
      onOpenChange,
      closeOnClickAction = true,
      disabled = false,
      ariaLabel,
      className,
      h5Form = "auto",
      maxRows,
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

    const safeActions = React.useMemo(() => actions ?? [], [actions]);

    // 动作行点选：业务回调先跑，再按 closeOnClickAction 收口。
    // 禁用行在 PopoverBody 内已被拦下，这里不重复判定。
    const handleAction = React.useCallback(
      (action: PopoverAction, _index: number) => {
        action.onClick?.(action);
        if (closeOnClickAction) setOpen(false);
      },
      [closeOnClickAction, setOpen],
    );

    const panelProps = {
      mode,
      open: opened,
      onOpenChange: setOpen,
      content,
      actions: safeActions,
      placement,
      onAction: handleAction,
      disabled,
      h5Form,
      maxRows,
      ariaLabel,
      className,
      children,
    };

    return (
      <React.Suspense fallback={null}>
        {mode === "mobile" ? (
          <H5Popover ref={ref} {...panelProps} />
        ) : (
          <PcPopover ref={ref} {...panelProps} />
        )}
      </React.Suspense>
    );
  },
);

export type { PopoverAction, PopoverFormPreference, PopoverPlacement };
