import { cn } from '@/lib/utils';
import { ToastIcon } from '@/components/ui/toast-parts';
import type { ToastEntry, ToastPosition } from '@/hooks/use-toast-store';

/**
 * Bivane Toast · H5 形态
 * 定义见 bivane-responsive-matrix.md §2.1：
 *   顶部居中胶囊（默认 top）、白字深底 rgba(0,0,0,.7)、2s 自动消失、单例
 *
 * 单例语义：同一时刻只呈现最新一条（新的覆盖旧的），
 * 与 PC 的堆叠形态形成对照 —— 这正是 Toast 被归为模式 C 的原因。
 */

const positionClass: Record<ToastPosition, string> = {
  top: 'top-[var(--bv-toast-position-top-distance)]',
  middle: 'top-1/2 -translate-y-1/2',
  bottom: 'bottom-[var(--bv-toast-position-bottom-distance)]',
};

export interface H5ToastPresenterProps {
  /** 当前要展示的一条；null 表示无 */
  item: ToastEntry | null;
}

export function H5ToastPresenter({ item }: H5ToastPresenterProps) {
  if (!item) return null;

  const type = item.type ?? 'text';
  const position = item.position ?? 'top';
  const isTextOnly = type === 'text';

  return (
    <>
      {item.forbidClick ? (
        <div
          data-slot="toast-blocker"
          aria-hidden="true"
          className="fixed inset-0 z-[var(--bv-toast-z-index)]"
        />
      ) : null}

      <div
        data-slot="toast"
        data-mode="h5"
        data-type={type}
        data-position={position}
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-none fixed inset-x-0 z-[var(--bv-toast-z-index)] flex justify-center px-bv-md',
          positionClass[position],
        )}
      >
        <div
          className={cn(
            'flex max-w-[var(--bv-toast-max-width)] items-center justify-center text-center',
            'rounded-[var(--bv-toast-radius)] bg-[var(--bv-toast-background)] text-[var(--bv-toast-text-color)]',
            'text-bv-md leading-[var(--bv-toast-line-height)]',
            isTextOnly
              ? 'min-w-[var(--bv-toast-text-min-width)] px-[var(--bv-toast-text-padding-x)] py-[var(--bv-toast-text-padding-y)]'
              : cn(
                  'w-[var(--bv-toast-default-width)] min-h-[var(--bv-toast-default-min-height)]',
                  'flex-col p-[var(--bv-toast-default-padding)]',
                ),
            item.className,
          )}
        >
          {item.content ?? (
            <>
              <ToastIcon type={type} />
              <span className={cn(!isTextOnly && 'mt-bv-xs')}>{item.message}</span>
            </>
          )}
        </div>
      </div>
    </>
  );
}
