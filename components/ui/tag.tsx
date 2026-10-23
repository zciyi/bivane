import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

/**
 * Bivane Tag · 对齐 Vant Tag
 * 取值来源：packages/vant/src/tag/index.less
 */

const tagVariants = cva(
  [
    'inline-flex items-center justify-center box-border align-middle',
    'rounded-bv-sm',
    // 顺序约定：text-*（font-size）在前、leading-* 在后，否则 leading 会被 tailwind-merge 删除
    'px-[var(--bv-tag-padding-x)] py-[var(--bv-tag-padding-y)] text-bv-sm',
    'leading-[var(--bv-tag-line-height)]',
  ],
  {
    variants: {
      type: {
        default: 'bg-bv-gray-6 border-bv-gray-6 text-bv-white',
        primary: 'bg-bv-primary border-bv-primary text-bv-white',
        success: 'bg-bv-success border-bv-success text-bv-white',
        danger: 'bg-bv-danger border-bv-danger text-bv-white',
        warning: 'bg-bv-warning border-bv-warning text-bv-white',
      },
      size: {
        // Vant 的 tag 各尺寸共用 --van-tag-line-height，只改字号与内边距
        medium:
          'px-[var(--bv-tag-medium-padding-x)] py-[var(--bv-tag-medium-padding-y)]',
        large:
          'text-bv-md leading-[var(--bv-tag-line-height)] px-[var(--bv-tag-large-padding-x)] py-[var(--bv-tag-large-padding-y)] rounded-bv-md',
      },
    },
    defaultVariants: {
      type: 'default',
    },
  },
);

/** plain 时文字色回落到类型主色 */
const plainTextColor: Record<NonNullable<TagType>, string> = {
  default: 'text-bv-gray-6',
  primary: 'text-bv-primary',
  success: 'text-bv-success',
  danger: 'text-bv-danger',
  warning: 'text-bv-warning',
};

export type TagType = 'default' | 'primary' | 'success' | 'danger' | 'warning';
export type TagSize = 'medium' | 'large';

export interface TagProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'>,
    VariantProps<typeof tagVariants> {
  /** 类型，默认 default */
  type?: TagType;
  /** 尺寸；不传为 base */
  size?: TagSize;
  /** 朴素样式 */
  plain?: boolean;
  /** 圆角标签 */
  round?: boolean;
  /** 标记样式（左侧直角、右侧圆角） */
  mark?: boolean;
  /** 是否可关闭 */
  closeable?: boolean;
  /** 关闭回调 */
  onClose?: (event: React.MouseEvent<SVGElement>) => void;
  /** 自定义背景色（覆盖 type） */
  color?: string;
  /** 自定义文字色（覆盖 type） */
  textColor?: string;
  /** 标签文案 */
  children?: React.ReactNode;
}

export const Tag = React.forwardRef<HTMLSpanElement, TagProps>(function Tag(
  {
    type = 'default',
    size,
    plain = false,
    round = false,
    mark = false,
    closeable = false,
    onClose,
    color,
    textColor,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="tag"
      data-type={type}
      className={cn(
        tagVariants({ type, size }),
        plain && cn('border', plainTextColor[type], 'bg-[var(--bv-tag-plain-background)]'),
        round && 'rounded-bv-max',
        mark && 'rounded-l-none rounded-r-bv-max',
        className,
      )}
      style={{
        ...(color ? { background: color, borderColor: color } : null),
        ...(textColor ? { color: textColor } : null),
        ...style,
      }}
      {...props}
    >
      {children}
      {closeable ? (
        <Icon
          name="cross"
          size="0.9em"
          className="ml-[var(--bv-padding-base)] cursor-pointer"
          onClick={onClose}
        />
      ) : null}
    </span>
  );
});

export { tagVariants };
