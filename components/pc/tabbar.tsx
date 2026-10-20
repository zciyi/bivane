import * as React from 'react';
import { cn } from '@/lib/utils';
import { TabbarItemView } from '@/components/ui/tabbar-parts';
import type { TabbarItem } from '@/hooks/use-tabbar-state';

/**
 * Bivane Tabbar · PC 导航（模式 C 的大屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * PC 端没有「底栏」这个形态：宽屏上把导航压在屏幕最下面既远又占横屏空间，
 * 桌面端惯用的是**侧边导航**（Ant Design Pro / VS Code 那一类）或**顶部导航**。
 * 两种形态由 `variant` 决定，默认侧边。
 *
 *   ├ sidebar ── 左侧竖排，图标在左文字在右，激活项铺底色
 *   └ top ───── 横排顶部，图标在左文字在右，激活项带下划线
 *
 * 侧边形态不渲染占位块：它占的是**横向**位置，一个流内占位块推不动内容，
 * 业务侧需要自己给内容区留出 `--bv-tabbar-pc-sidebar-width` 的边距
 * （或把导航放进 flex 布局的第一列）。
 */

export type PcTabbarVariant = 'sidebar' | 'top';

export interface PcTabbarProps
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
  /** 导航形态：侧边（默认）/ 顶部 */
  variant: PcTabbarVariant;
  /** 固定 */
  fixed: boolean;
  /** 固定时留等高占位块（仅顶部形态有效） */
  placeholder: boolean;
  /** 分隔线 */
  border: boolean;
}

export const PcTabbar = React.forwardRef<HTMLDivElement, PcTabbarProps>(
  function PcTabbar(
    {
      items,
      active,
      onSelect,
      variant,
      fixed,
      placeholder,
      border,
      className,
      style,
      ...rest
    },
    ref,
  ) {
    const isSidebar = variant === 'sidebar';

    const bar = (
      <div
        ref={ref}
        {...rest}
        data-slot="tabbar"
        data-mode="pc"
        data-variant={variant}
        className={cn(
          isSidebar
            ? 'flex w-[var(--bv-tabbar-pc-sidebar-width)] flex-col bg-bv-surface'
            : 'flex w-full items-stretch bg-bv-surface',
          fixed &&
            (isSidebar
              ? 'fixed bottom-0 left-0 top-0 z-[var(--bv-tabbar-z-index)]'
              : 'fixed left-0 right-0 top-0 z-[var(--bv-tabbar-z-index)]'),
          border &&
            (isSidebar
              ? 'border-r border-bv-border'
              : 'bv-hairline bv-hairline--bottom'),
          className,
        )}
        style={style}
      >
        {items.map((item) => (
          <TabbarItemView
            key={item.value}
            item={item}
            active={item.value === active}
            mode="desktop"
            variant={variant}
            onSelect={onSelect}
          />
        ))}
      </div>
    );

    if (isSidebar) return bar;

    return (
      <>
        {fixed && placeholder ? (
          <div
            aria-hidden="true"
            data-slot="tabbar-placeholder"
            className="h-[var(--bv-tabbar-pc-item-height)]"
          />
        ) : null}
        {bar}
      </>
    );
  },
);
