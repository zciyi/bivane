import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { ToastIcon } from '@/components/ui/toast-parts';
import type { ToastEntry, ToastType } from '@/hooks/use-toast-store';

/**
 * Bivane Toast · PC 形态
 * 定义见 bivane-responsive-matrix.md §2.1：
 *   右上角堆叠通知、带关闭按钮、可多条并存
 *
 * 与 H5 的差异不只是位置：宽屏下没有「顶部胶囊 2s 闪一下」的语境，
 * 用户可能正在别处操作，因此 PC 用可手动关闭的卡片栈 —— 这是能力增强而非功能缺失，
 * 符合矩阵总则 2 的能力等价原则（两端都能看到提示、都能提前关掉）。
 */

/** 类型 → 图标着色：H5 是深底白字，PC 是白底彩色图标 */
const iconColorClass: Record<Exclude<ToastType, 'text'>, string> = {
  loading: 'text-bv-primary',
  success: 'text-bv-success',
  fail: 'text-bv-danger',
};

export interface PcToastStackProps {
  items: readonly ToastEntry[];
  onClose: (id: number) => void;
}

export function PcToastStack({ items, onClose }: PcToastStackProps) {
  if (items.length === 0) return null;

  return (
    <div
      data-slot="toast-stack"
      data-mode="pc"
      role="region"
      aria-label="通知"
      className={cn(
        'pointer-events-none fixed right-[var(--bv-toast-pc-gutter)] top-[var(--bv-toast-pc-gutter)]',
        'z-[var(--bv-toast-z-index)] flex w-[var(--bv-toast-pc-width)] flex-col gap-[var(--bv-toast-pc-gap)]',
      )}
    >
      {items.map((item) => (
        <PcToastItem key={item.id} item={item} onClose={onClose} />
      ))}
    </div>
  );
}

interface PcToastItemProps {
  item: ToastEntry;
  onClose: (id: number) => void;
}

function PcToastItem({ item, onClose }: PcToastItemProps) {
  const type = item.type ?? 'text';

  return (
    <div
      data-slot="toast"
      data-mode="pc"
      data-type={type}
      data-toast-id={item.id}
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto flex items-start gap-bv-xs',
        'rounded-bv-lg border border-bv-border bg-bv-surface px-bv-md py-bv-sm',
        'shadow-[var(--bv-toast-pc-shadow)]',
        item.className,
      )}
    >
      {type === 'text' ? null : (
        <span
          className={cn(
            'mt-[2px] shrink-0 text-bv-lg leading-[var(--bv-toast-line-height)]',
            iconColorClass[type],
          )}
        >
          <ToastIcon type={type} size="1em" />
        </span>
      )}

      <div className="min-w-0 flex-1 text-bv-md leading-[var(--bv-toast-line-height)] text-bv-text">
        {item.content ?? <span className="break-words">{item.message}</span>}
      </div>

      <button
        type="button"
        data-slot="toast-close"
        aria-label="关闭通知"
        onClick={() => onClose(item.id)}
        className={cn(
          'mt-[2px] shrink-0 cursor-pointer border-0 bg-transparent p-0',
          'text-bv-gray-6 hover:text-bv-text-2',
          'text-[var(--bv-toast-pc-close-size)] leading-[var(--bv-toast-line-height)]',
        )}
      >
        <Icon name="cross" />
      </button>
    </div>
  );
}
