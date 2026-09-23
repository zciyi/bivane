import * as React from 'react';
import { cn } from '@/lib/utils';
import { useDeviceModeAttrs, type DeviceMode } from '@/hooks/use-device-mode';

/**
 * Bivane Overlay 遮罩
 *
 * 只负责视觉层：浓度、淡入淡出、层级。
 * 滚动锁、关闭时机、键盘交互由上层弹层组件负责（见 Popup / Dialog）。
 *
 * 视觉差异走 token（模式 A）：
 *   H5  rgba(0,0,0,.7)（Vant 原值）→ PC rgba(0,0,0,.45)
 *   —— 宽屏下 0.7 的蒙层压迫感过强，且居中模态本身已有足够视觉锚点。
 *   覆盖定义在 packages/tokens/styles/modes.css 的 [data-mode='pc'] 段。
 *
 * ⚠️ 本组件必须**自带 data-mode**：它渲染在 Portal 里，已逃出宿主组件的
 * `[data-mode]` 作用域，而遮罩浓度（--bv-overlay-background）与动画时长
 * （--bv-popup-duration）都靠 `[data-mode='pc']` 覆盖来生效。
 * 不自带就会出现「PC 端仍用 H5 的 .7 浓度 + 300ms 时长」的静默降级。
 */

export interface OverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 可见状态，驱动淡入淡出 */
  open?: boolean;
  /**
   * 已解析的模式。不传则自行判定（Provider / 媒体查询）。
   * 上层弹层应把**已解析**的结果传进来，否则 forceMode 逃生舱不会作用于遮罩。
   */
  mode?: DeviceMode;
  /** 层级，默认用 --bv-overlay-z-index */
  zIndex?: number;
  /** 点击回调；不传则不响应点击（PC 居中模态默认不点关） */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}

export const Overlay = React.forwardRef<HTMLDivElement, OverlayProps>(function Overlay(
  { open = true, mode, zIndex, className, style, ...props },
  ref,
) {
  const modeAttrs = useDeviceModeAttrs(mode);

  return (
    // data-slot 由本组件持有，必须在 {...props} 之后（见 button.tsx 同处注释）
    <div
      ref={ref}
      data-state={open ? 'open' : 'closed'}
      aria-hidden="true"
      className={cn(
        'fixed inset-0 bg-bv-overlay',
        'transition-opacity duration-[var(--bv-popup-duration)] ease-out',
        'motion-reduce:transition-none',
        open ? 'opacity-100' : 'opacity-0',
        className,
      )}
      {...props}
      {...modeAttrs}
      // style 必须放在 {...props} 之后：props 里带着原始 style，
      // 若在其之前展开会把下面合并好的 zIndex / pointerEvents 整个覆盖掉。
      style={{
        zIndex: zIndex ?? 'var(--bv-overlay-z-index)',
        // 关闭时立即让出指针事件，避免退出动画期间挡住下方操作
        pointerEvents: open ? undefined : 'none',
        ...style,
      }}
      data-slot="overlay"
    />
  );
});
