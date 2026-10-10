import type { MutableRefObject, Ref, RefCallback } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Bivane cn() · 类名合并
 *
 * 关键点：tailwind-merge 默认不认识 `rounded-bv-*` / `bg-bv-*` / `text-bv-*` 这类
 * 由 @theme 生成的 token 工具类，若不注册，外部传入的 className 无法覆盖组件默认样式。
 * 因此这里把 bv 命名空间的工具类并入对应的合并分组（架构文档 §4 第 7 条）。
 */

const BV_COLORS = [
  'bv-primary',
  'bv-success',
  'bv-danger',
  'bv-warning',
  'bv-text',
  'bv-text-2',
  'bv-text-3',
  'bv-border',
  'bv-surface',
  'bv-muted',
  'bv-active',
  'bv-white',
  'bv-black',
  'bv-gray-4',
  'bv-gray-6',
  'bv-overlay',
] as const;

const BV_RADIUS = ['bv-sm', 'bv-md', 'bv-lg', 'bv-max'] as const;
const BV_FONT_SIZE = ['bv-xs', 'bv-sm', 'bv-md', 'bv-lg'] as const;
const BV_SPACING = [
  'bv-base',
  'bv-xs',
  'bv-sm',
  'bv-md',
  'bv-lg',
  'bv-xl',
  // 页面骨架节奏（随 data-mode 变化，见 tokens/styles/modes.css）
  'bv-gutter',
  'bv-block',
  'bv-section',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: [...BV_RADIUS] }],
      'font-size': [{ text: [...BV_FONT_SIZE] }],
      'font-weight': [{ font: ['bv-bold'] }],
      'font-family': [{ font: ['bv'] }],
      'bg-color': [{ bg: [...BV_COLORS] }],
      'text-color': [{ text: [...BV_COLORS] }],
      'border-color': [{ border: [...BV_COLORS] }],
      'border-w': [{ border: ['bv-hairline'] }],
      p: [{ p: [...BV_SPACING] }],
      px: [{ px: [...BV_SPACING] }],
      py: [{ py: [...BV_SPACING] }],
      m: [{ m: [...BV_SPACING] }],
      mx: [{ mx: [...BV_SPACING] }],
      my: [{ my: [...BV_SPACING] }],
      gap: [{ gap: [...BV_SPACING] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 合并多个 ref（cloneElement 触发器时，外层 forwardRef、消费者自带 ref 与
 * Radix Slot 的 ref 都要落到同一个 DOM 节点上）。函数/对象 ref 都支持。
 */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    });
  };
}
