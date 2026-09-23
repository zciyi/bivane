import { Icon } from '@/components/ui/icon';
import type { ToastType } from '@/hooks/use-toast-store';

/**
 * Toast 的跨模式共用零件
 * 两种形态的容器与排布不同，但「类型 → 图标」的映射必须一致，
 * 抽出来避免两端各写一份后跑偏。
 */

const ICON_BY_TYPE: Record<Exclude<ToastType, 'text'>, 'loading' | 'success' | 'fail'> = {
  loading: 'loading',
  success: 'success',
  fail: 'fail',
};

export interface ToastIconProps {
  type: ToastType;
  size?: string;
  className?: string;
}

export function ToastIcon({ type, size = 'var(--bv-toast-icon-size)', className }: ToastIconProps) {
  if (type === 'text') return null;
  return <Icon name={ICON_BY_TYPE[type]} size={size} className={className} />;
}
