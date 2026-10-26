import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Bivane Badge · 对齐 Vant Badge
 * 取值来源：packages/vant/src/badge/index.less
 */

export type BadgePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface BadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'content'> {
  /** 展示内容；数字超过 max 时显示 max+ */
  content?: React.ReactNode;
  /** 小圆点模式 */
  dot?: boolean;
  /** 数字上限，默认 99 */
  max?: number;
  /** 内容为 0 时是否展示，默认 false */
  showZero?: boolean;
  /** 自定义背景色 */
  color?: string;
  /** 位置（仅在有 children 包裹时生效） */
  position?: BadgePosition;
  /** 被角标包裹的元素（角标挂在它的角点上） */
  children?: React.ReactNode;
}

const positionClass: Record<BadgePosition, string> = {
  'top-left': 'absolute top-0 left-0 [transform:translate(-50%,-50%)]',
  'top-right': 'absolute top-0 right-0 [transform:translate(50%,-50%)]',
  'bottom-left': 'absolute bottom-0 left-0 [transform:translate(-50%,50%)]',
  'bottom-right': 'absolute bottom-0 right-0 [transform:translate(50%,50%)]',
};

function formatContent(content: React.ReactNode, max: number): React.ReactNode {
  if (typeof content === 'number' && Number.isFinite(content) && content > max) {
    return `${max}+`;
  }
  return content;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  {
    content,
    dot = false,
    max = 99,
    showZero = false,
    color,
    position = 'top-right',
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const isEmptyNumber = content === 0 || content === '0';
  const hidden = dot ? false : content === undefined || content === null || (isEmptyNumber && !showZero);
  const isFixed = Boolean(children);

  const badge = (
    <span
      ref={isFixed ? undefined : ref}
      data-slot="badge"
      data-dot={dot ? 'true' : undefined}
      data-position={isFixed ? position : undefined}
      className={cn(
        'inline-block box-border text-center font-bv-bold',
        // 顺序约定：text-*（font-size）在前、leading-* 在后，否则 leading 会被 tailwind-merge 删除
        'text-bv-sm leading-[1.2] rounded-bv-max',
        // 文字色必须显式套用语义 token：badge 常被放进 Cell 的 value 槽，
        // 该槽默认 text-bv-text-2（灰），不显式设色会让数字继承成浅灰、红底上看不清。
        // 用 [color:...] 任意属性而非 text-[...]，避免与上面的 text-bv-sm（字号）在 tailwind-merge 冲突。
        '[background:var(--bv-badge-background)] [color:var(--bv-badge-color)]',
        dot
          ? 'w-[var(--bv-badge-dot-size)] h-[var(--bv-badge-dot-size)] min-w-0 border-none p-0 rounded-full'
          : 'min-w-[var(--bv-badge-size)] px-[var(--bv-badge-padding-x)] py-[var(--bv-badge-padding-y)] border border-bv-surface',
        isFixed && positionClass[position],
        hidden && 'hidden',
        className,
      )}
      style={{
        ...(color ? { background: color } : null),
        ...style,
      }}
      {...props}
    >
      {dot ? null : hidden ? null : formatContent(content, max)}
    </span>
  );

  if (!isFixed) return badge;

  return (
    <span ref={ref} data-slot="badge-wrapper" className="relative inline-block">
      {children}
      {badge}
    </span>
  );
});
