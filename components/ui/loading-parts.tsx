import { cn } from '@/lib/utils';
import type { LoadingEntry } from '@/hooks/use-loading-store';

/**
 * Loading 共用零件（跨模式一致，模式 A 仅遮罩浓度走 token 差异）
 *
 * 旋转动画走 Tailwind 内置 `animate-spin`（无需新增 keyframes）。
 * 强调色复用 --bv-primary；深色遮罩上清晰可见。
 */

export interface LoadingSpinnerProps {
  /** 直径，默认 30px（对齐 Vant 默认） */
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 30, className }: LoadingSpinnerProps) {
  return (
    <span
      data-slot="loading-spinner"
      role="img"
      aria-label="加载中"
      className={cn(
        'inline-block rounded-bv-max border-2 border-bv-primary border-t-transparent',
        'animate-spin motion-reduce:animate-none',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

export interface LoadingOverlayProps {
  item: LoadingEntry;
  /** 已解析的模式，用于视觉差异（此处视觉一致，仅遮罩浓度由 token 决定） */
  mode: 'mobile' | 'desktop';
}

/**
 * 全屏遮罩 + 居中转圈（Loading 的两种模式视觉一致，仅遮罩浓度由 bg-bv-overlay
 * 的模式 token 决定）。文本可选，纵向居中。遮罩点击不关闭（须显式 hideLoading）。
 *
 * `forbidClick` 逐字对齐 Vant Toast：`false`（默认）= 不阻断下层操作，
 * 因此容器整体 `pointer-events-none`；`true` 才吃事件。
 */
export function LoadingOverlay({ item, mode }: LoadingOverlayProps) {
  const { text, mask = true, forbidClick = false, zIndex, className } = item.options;

  return (
    <div
      data-slot="loading"
      data-mode={mode}
      data-mask={mask ? 'true' : 'false'}
      /* 层级对齐 Vant showLoadingToast：走 toast 层（3000）而不是 overlay 层（1999），
         否则 loading 会被已打开的 Popup（2000）盖在下面。 */
      className={cn(
        'fixed inset-0 z-[var(--bv-toast-z-index)] flex flex-col items-center justify-center',
        forbidClick ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      style={{ zIndex: zIndex ?? 'var(--bv-toast-z-index)' }}
    >
      {mask ? (
        <div data-slot="loading-mask" aria-hidden="true" className="absolute inset-0 bg-bv-overlay" />
      ) : null}

      <div
        data-slot="loading-body"
        className={cn('relative flex flex-col items-center gap-bv-sm', className)}
      >
        <LoadingSpinner />
        {text !== undefined && text !== null && text !== '' ? (
          <span
            data-slot="loading-text"
            className="text-bv-md leading-[var(--bv-line-md)] text-white"
          >
            {text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
