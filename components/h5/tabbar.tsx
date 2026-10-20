import * as React from 'react';
import { cn } from '@/lib/utils';
import { TabbarItemView } from '@/components/ui/tabbar-parts';
import type { TabbarItem } from '@/hooks/use-tabbar-state';

/**
 * Bivane Tabbar · H5 底栏（模式 C 的小屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * 底部固定条 + 安全区（env(safe-area-inset-bottom)），图标在上、文字在下。
 * 固定时留一个等高占位块，避免内容被压在底栏下面。
 */

export interface H5TabbarProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'onSelect'
  > {
  /** 标签项 */
  items: TabbarItem[];
  /** 当前激活项的 value */
  active?: string;
  /** 点击某一项 */
  onSelect: (value: string) => void;
  /** 固定在底部 */
  fixed: boolean;
  /** 固定时留等高占位块 */
  placeholder: boolean;
  /** 底部安全区 */
  safeAreaInsetBottom: boolean;
  /** 顶部 hairline 分隔线 */
  border: boolean;
}

export const H5Tabbar = React.forwardRef<HTMLDivElement, H5TabbarProps>(
  function H5Tabbar(
    {
      items,
      active,
      onSelect,
      fixed,
      placeholder,
      safeAreaInsetBottom,
      border,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    return (
      <>
        {fixed && placeholder ? (
          <div
            aria-hidden="true"
            data-slot="tabbar-placeholder"
            className={cn(safeAreaInsetBottom && 'bv-safe-area-bottom')}
          >
            <div
              data-slot="tabbar-placeholder-bar"
              className="h-[var(--bv-tabbar-height)]"
            />
          </div>
        ) : null}

        <div
          ref={ref}
          {...rest}
          data-slot="tabbar"
          data-mode="h5"
          data-variant="bottom"
          className={cn(
            'flex w-full items-stretch bg-bv-surface',
            fixed &&
              'fixed bottom-0 left-0 right-0 z-[var(--bv-tabbar-z-index)]',
            border && 'bv-hairline bv-hairline--top',
            safeAreaInsetBottom && 'bv-safe-area-bottom',
            className,
          )}
          style={style}
        >
          {items.map((item) => (
            <TabbarItemView
              key={item.value}
              item={item}
              active={item.value === active}
              mode="mobile"
              variant="bottom"
              onSelect={onSelect}
            />
          ))}
        </div>
      </>
    );
  },
);
