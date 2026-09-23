import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

/**
 * Bivane Button · 对齐 Vant Button
 * 取值来源：packages/vant/src/button/index.less
 *
 * 交互差异说明：Button 属于「无交互范式差异」的组件（架构文档 §6.1 模式 A），
 * 因此不参与 JS 模式判定，仅通过 CSS 安全区与热区保证两端可用。
 */

const buttonVariants = cva(
  [
    'bv-press inline-flex box-border items-center justify-center gap-[var(--bv-padding-base)]',
    // 上下内边距恒为 0（Vant 三种尺寸的 padding 都是 `0 <x>`），
    // 左右内边距交给 size 变体，用 px-* 以便参与 tailwind-merge 消解。
    // 注意顺序：text-*（font-size）必须写在 leading-* 之前。
    // tailwind-merge 的 font-size 组与 leading 组冲突，text-* 出现在 leading-* 之后
    // 会把 leading-* 删掉（会被 @theme 里 --text-bv-*-line-height 的默认行高顶替）。
    // 因此字号与行高成对定义在每个 size 变体里，且字号在前。
    'relative h-[var(--bv-button-default-height)] py-0 text-center align-middle',
    'rounded-bv-md select-none whitespace-nowrap',
    'transition-opacity duration-[var(--bv-duration-fast)]',
    'disabled:cursor-not-allowed disabled:opacity-[var(--bv-disabled-opacity)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bv-primary',
  ],
  {
    variants: {
      type: {
        default: 'text-bv-text bg-bv-surface border border-bv-gray-4',
        primary: 'text-bv-white bg-bv-primary border border-bv-primary',
        success: 'text-bv-white bg-bv-success border border-bv-success',
        danger: 'text-bv-white bg-bv-danger border border-bv-danger',
        warning: 'text-bv-white bg-bv-warning border border-bv-warning',
      },
      size: {
        // Vant Button 的 size 默认值是 'normal'（见 src/button/Button.tsx），
        // 即 14px 字 + padding 0 15px；只有显式 large 才是 100% 宽 / 50px 高。
        // 三种尺寸共用同一个 line-height token（Vant: --van-button-default-line-height: 1.2）。
        large:
          'text-bv-lg leading-[var(--bv-button-default-line-height)] w-full h-[var(--bv-button-large-height)] px-0',
        normal:
          'text-bv-md leading-[var(--bv-button-default-line-height)] px-[var(--bv-button-normal-padding-x)]',
        small:
          'text-bv-sm leading-[var(--bv-button-default-line-height)] h-[var(--bv-button-small-height)] px-[var(--bv-button-small-padding-x)]',
        mini:
          'text-bv-xs leading-[var(--bv-button-default-line-height)] h-[var(--bv-button-mini-height)] px-[var(--bv-button-mini-padding-x)]',
      },
      block: {
        true: 'flex w-full',
        false: '',
      },
    },
    defaultVariants: {
      type: 'default',
      size: 'normal',
    },
  },
);

/** plain 模式下文字色回落到当前 type 的主色，背景走 token（深色主题下为 transparent） */
const plainTextColor: Record<NonNullable<ButtonType>, string> = {
  default: '',
  primary: 'text-bv-primary',
  success: 'text-bv-success',
  danger: 'text-bv-danger',
  warning: 'text-bv-warning',
};

/** hairline 时边框色需跟随 type，通过 CSS 变量注入给 .bv-hairline */
const hairlineColorVar: Record<NonNullable<ButtonType>, string> = {
  default: '[--bv-hairline-color:var(--bv-gray-4)]',
  primary: '[--bv-hairline-color:var(--bv-primary)]',
  success: '[--bv-hairline-color:var(--bv-success)]',
  danger: '[--bv-hairline-color:var(--bv-danger)]',
  warning: '[--bv-hairline-color:var(--bv-warning)]',
};

export type ButtonType = 'default' | 'primary' | 'success' | 'danger' | 'warning';
export type ButtonSize = 'large' | 'normal' | 'small' | 'mini';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>,
    VariantProps<typeof buttonVariants> {
  /** 按钮类型，默认 default */
  type?: ButtonType;
  /** 尺寸；不传为 base（44px 高） */
  size?: ButtonSize;
  /** 朴素按钮（透明背景 + 类型主色文字） */
  plain?: boolean;
  /** 圆角按钮 */
  round?: boolean;
  /** 直角按钮 */
  square?: boolean;
  /** 块级按钮（宽度 100%） */
  block?: boolean;
  /** 细边线按钮（0.5px 物理边框） */
  hairline?: boolean;
  /** 加载中 */
  loading?: boolean;
  /** 加载时替代显示的文案 */
  loadingText?: string;
  /** 图标 */
  icon?: React.ReactNode;
  /** 图标位置，默认 left */
  iconPosition?: 'left' | 'right';
  /** 原生 type 属性（与组件 type 语义冲突，故改名） */
  nativeType?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    type = 'default',
    size,
    plain = false,
    round = false,
    square = false,
    block = false,
    hairline = false,
    loading = false,
    loadingText,
    icon,
    iconPosition = 'left',
    nativeType = 'button',
    disabled = false,
    className,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  const leftIcon = loading ? (
    <Icon name="loading" size="var(--bv-button-loading-icon-size)" data-icon="loading" />
  ) : iconPosition === 'left' ? (
    icon
  ) : null;
  const rightIcon = !loading && iconPosition === 'right' ? icon : null;

  const text = loading && loadingText ? loadingText : children;
  const hasText = text !== undefined && text !== null && text !== '';

  return (
    // 注意：data-slot 必须在 {...props} 之后书写，由组件自身持有。
    // 否则上层组件（如 Dialog）传进来的 data-slot 会顶掉它，破坏契约第 2 条。
    // 组合型组件请改用 data-component 标记自己的角色。
    <button
      ref={ref}
      data-type={type}
      data-loading={loading ? 'true' : undefined}
      data-disabled={isDisabled ? 'true' : undefined}
      disabled={isDisabled}
      type={nativeType}
      className={cn(
        buttonVariants({ type, size, block }),
        plain && cn('border border-transparent bg-[var(--bv-button-plain-background)]', plainTextColor[type]),
        round && 'rounded-bv-max',
        square && 'rounded-none',
        hairline && cn('border-0 bv-hairline bv-hairline--all', hairlineColorVar[type]),
        loading && 'cursor-default',
        className,
      )}
      {...props}
      data-slot="button"
    >
      {leftIcon ? (
        <span data-slot="button-icon" className="text-[var(--bv-button-icon-size)] leading-[inherit]">
          {leftIcon}
        </span>
      ) : null}
      {hasText ? <span data-slot="button-text">{text}</span> : null}
      {rightIcon ? (
        <span data-slot="button-icon" className="text-[var(--bv-button-icon-size)] leading-[inherit]">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
});

export { buttonVariants };
