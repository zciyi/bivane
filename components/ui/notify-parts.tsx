import * as React from 'react';
import { cn } from '@/lib/utils';
import type { NotifyEntry, NotifyType } from '@/hooks/use-notify-store';

/**
 * Notify 共用零件
 *
 * ┌ H5 ── 顶部通栏横幅，自上方滑入
 * └ PC ── 右上角圆角卡片，自右侧滑入
 *
 * 进场动画用「两阶段挂载 + data-state」实现，不新增 utilities.css 槽名
 * （门 5 只核 utilities.css 已引用的槽，新增槽会造 MISS）。
 */

const typeBackgroundClass: Record<NotifyType, string> = {
  primary: 'bg-bv-primary',
  success: 'bg-bv-success',
  danger: 'bg-bv-danger',
  warning: 'bg-bv-warning',
};

export interface NotifyItemProps {
  item: NotifyEntry;
  mode: 'mobile' | 'desktop';
  onClose?: (id: number) => void;
}

export function NotifyItem({ item, mode, onClose }: NotifyItemProps) {
  const { message, type = 'danger', color, background, onClick, zIndex, className } = item.options;

  // 两阶段挂载：先以 closed 态渲染，下一帧切 open，才能触发进场过渡
  const [state, setState] = React.useState<'open' | 'closed'>('closed');
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setState('open'));
    return () => cancelAnimationFrame(raf);
  }, []);

  const isMobile = mode === 'mobile';

  return (
    <div
      data-slot="notify"
      data-mode={mode}
      data-type={type}
      data-state={state}
      role="status"
      aria-live="polite"
      onClick={onClick}
      className={cn(
        'box-border w-full text-bv-md leading-[var(--bv-line-md)] text-white',
        'transition-[transform,opacity] duration-[var(--bv-popup-duration)] ease-out',
        'motion-reduce:transition-none',
        isMobile
          ? cn(
              'px-bv-md py-bv-sm',
              state === 'open' ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0',
            )
          : cn(
              'max-w-[320px] rounded-bv-lg',
              'px-bv-md py-bv-sm',
              'shadow-[var(--bv-popup-pc-shadow)]',
              state === 'open' ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
            ),
        background ? null : typeBackgroundClass[type],
        className,
      )}
      style={{
        zIndex: zIndex ?? 'var(--bv-toast-z-index)',
        // 自定义配色是运行时值，属契约允许的内联 style 例外
        ...(color ? { color } : null),
        ...(background ? { background } : null),
      }}
    >
      <div className="flex items-center justify-between gap-bv-gutter">
        <span data-slot="notify-message" className="min-w-0 flex-1">
          {message}
        </span>
        {/* H5 对齐 Vant Notify（无关闭按钮、纯自动消失）；但常驻通知（duration=0）
            必须给出口，否则用户永远关不掉。PC 一律给关闭按钮。 */}
        {onClose && (!isMobile || item.options.duration === 0) ? (
          <button
            type="button"
            data-slot="notify-close"
            aria-label="关闭通知"
            onClick={(event) => {
              event.stopPropagation();
              onClose(item.id);
            }}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-white opacity-80"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}
