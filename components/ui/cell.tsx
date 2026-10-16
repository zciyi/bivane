import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

/**
 * Bivane Cell / CellGroup · 对齐 Vant
 * 取值来源：packages/vant/src/cell/index.less、cell-group/index.less
 *
 * 交互差异说明：Cell 属于模式 A（纯 CSS 差异）——
 * H5 保证 ≥44px 触控热区（Vant 默认 10px 上下 padding + 24px 行高 = 44px），
 * PC 追加 hover 态与指针样式，不参与 JS 模式判定。
 */

export interface CellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 左侧标题 */
  title?: React.ReactNode;
  /** 右侧内容 */
  value?: React.ReactNode;
  /** 标题下方的描述信息 */
  label?: React.ReactNode;
  /** 左侧图标 */
  icon?: React.ReactNode;
  /** 右侧图标（isLink 时默认展示箭头） */
  rightIcon?: React.ReactNode;
  /** 展示右侧箭头并开启点击反馈 */
  isLink?: boolean;
  /** 是否展示下边框，默认 true */
  border?: boolean;
  /** 是否开启点击反馈（按压态） */
  clickable?: boolean;
  /** 垂直居中 */
  center?: boolean;
  /** 必填项（标题左侧红星） */
  required?: boolean;
  /** 大号单元格 */
  large?: boolean;
  /** 点击回调；传入即视为可点击 */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  children?: React.ReactNode;
}

export const Cell = React.forwardRef<HTMLDivElement, CellProps>(function Cell(
  {
    title,
    value,
    label,
    icon,
    rightIcon,
    isLink = false,
    border = true,
    clickable,
    center = false,
    required = false,
    large = false,
    className,
    onClick,
    children,
    ...props
  },
  ref,
) {
  const isClickable = clickable ?? (isLink || Boolean(onClick));

  return (
    <div
      ref={ref}
      data-slot="cell"
      data-clickable={isClickable ? 'true' : undefined}
      data-border={border ? undefined : 'false'}
      data-large={large ? 'true' : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={onClick}
      className={cn(
        'relative flex box-border w-full items-start overflow-hidden',
        'bg-bv-surface text-bv-text text-bv-md',
        'py-[var(--bv-cell-vertical-padding)] px-[var(--bv-cell-horizontal-padding)]',
        'leading-[var(--bv-cell-line-height)]',
        border && 'bv-hairline bv-hairline--bottom [--bv-hairline-inset-left:var(--bv-padding-md)] [--bv-hairline-inset-right:var(--bv-padding-md)]',
        center && 'items-center',
        large && [
          'pt-[var(--bv-cell-large-vertical-padding)] pb-[var(--bv-cell-large-vertical-padding)]',
        ],
        isClickable && 'cursor-pointer transition-colors active:bg-bv-active hover:bg-bv-muted',
        required &&
          "before:absolute before:left-bv-xs before:text-bv-danger before:content-['*']",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          data-slot="cell-left-icon"
          className="mr-[var(--bv-padding-base)] h-[var(--bv-cell-line-height)] text-[length:var(--bv-cell-icon-size)] leading-[var(--bv-cell-line-height)]"
        >
          {icon}
        </span>
      ) : null}

      <div data-slot="cell-title" className={cn('flex-1', large && 'text-bv-lg')}>
        {title}
        {label ? (
          <div
            data-slot="cell-label"
            className="mt-[var(--bv-cell-label-margin-top)] text-bv-sm leading-[var(--bv-cell-label-line-height)] text-bv-text-2"
          >
            {label}
          </div>
        ) : null}
      </div>

      <div
        data-slot="cell-value"
        className={cn(
          'flex-1 overflow-hidden text-right align-middle break-words text-bv-text-2',
          large && 'text-bv-lg',
        )}
      >
        {value}
        {children}
      </div>

      {rightIcon ?? isLink ? (
        <span
          data-slot="cell-right-icon"
          className="ml-[var(--bv-padding-base)] inline-flex h-[var(--bv-cell-line-height)] items-center text-[length:var(--bv-cell-icon-size)] leading-[var(--bv-cell-line-height)] text-bv-gray-6"
        >
          {rightIcon ?? <Icon name="arrow" />}
        </span>
      ) : null}
    </div>
  );
});

export interface CellGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 分组标题 */
  title?: React.ReactNode;
  /** 是否为卡片风格（内嵌圆角） */
  inset?: boolean;
  /** 是否整体展示下边框；false 时由内部 Cell 各自处理 */
  border?: boolean;
  children?: React.ReactNode;
}

export const CellGroup = React.forwardRef<HTMLDivElement, CellGroupProps>(function CellGroup(
  { title, inset = false, border = true, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-slot="cell-group"
      data-inset={inset ? 'true' : undefined}
      className={cn(
        'bg-bv-surface',
        inset && 'mx-[var(--bv-padding-md)] overflow-hidden rounded-bv-lg',
        border && !inset && 'bv-hairline bv-hairline--top bv-hairline--bottom',
        className,
      )}
      {...props}
    >
      {title ? (
        <div
          data-slot="cell-group-title"
          className={cn(
            'text-bv-md leading-[var(--bv-cell-group-title-line-height)] text-bv-text-2',
            'py-[var(--bv-padding-md)] px-[var(--bv-padding-md)]',
          )}
        >
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
});
