import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Bivane Icon
 * 图标集为自研 SVG（lucide 风格线性图标），不依赖 Vant iconfont，
 * 彻底规避商标与字体资产的授权问题。
 *
 * 尺寸通过 fontSize 驱动（1em），因此与文字基线天然对齐；
 * 颜色统一走 currentColor，由父级颜色决定。
 */

export const iconNames = [
  'arrow',
  'arrow-left',
  'arrow-down',
  'check',
  'search',
  'cross',
  'loading',
  'success',
  'fail',
  'info',
  'warning',
] as const;

export type IconName = (typeof iconNames)[number];

const glyphs: Record<IconName, React.ReactNode> = {
  arrow: <path d="m9 5 7 7-7 7" />,
  'arrow-left': <path d="m15 5-7 7 7 7" />,
  // 下拉指示器。Select / DatePicker 的触发器用它，语义是「展开候选」而非「前往下一页」
  'arrow-down': <path d="m5 9 7 7 7-7" />,
  // 选中态勾选。用细线勾（与 Vant 的 icon-success 不同：那是填充圆环，这里是纯勾）
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  cross: <path d="M18 6 6 18M6 6l12 12" />,
  loading: <path d="M12 3a9 9 0 1 0 9 9" />,
  success: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </>
  ),
  fail: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11.2v5.3" />
      <path d="M12 7.8h.01" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.6 3.4 19.4h17.2L12 4.6Z" />
      <path d="M12 10v4.2" />
      <path d="M12 17.1h.01" />
    </>
  ),
};

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  /** 图标名，取值见 iconNames */
  name: IconName;
  /** 尺寸，接受数字（px）或任意 CSS 长度，默认 1em 跟随字号 */
  size?: number | string;
  /** 颜色，默认 currentColor */
  color?: string;
  /** 无障碍标签；不传时按装饰性图标处理（aria-hidden） */
  label?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
  { name, size, color, label, className, style, ...props },
  ref,
) {
  const isDecorative = label === undefined;

  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={isDecorative || undefined}
      role={isDecorative ? undefined : 'img'}
      aria-label={label}
      className={cn(
        'inline-block h-[1em] w-[1em] shrink-0',
        name === 'loading' && 'animate-spin',
        className,
      )}
      style={{
        fontSize: size === undefined ? undefined : typeof size === 'number' ? `${size}px` : size,
        color,
        ...style,
      }}
      {...props}
      data-slot="icon"
    >
      {glyphs[name]}
    </svg>
  );
});

export { glyphs as __iconGlyphs };
