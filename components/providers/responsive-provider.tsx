import * as React from 'react';
import {
  DEFAULT_BREAKPOINT,
  ResponsiveContext,
  type ResponsiveModeOption,
} from '@/hooks/use-device-mode';

export interface ResponsiveProviderProps {
  /** 模式判定断点，默认 768（< 768px 视为移动端） */
  breakpoint?: number;
  /** 'auto' 走自动判定；显式传 'mobile' | 'desktop' 则全局强制（文档站、测试用） */
  mode?: ResponsiveModeOption;
  children: React.ReactNode;
}

/**
 * Bivane 响应式上下文
 * 置于应用根部；组件侧的 forceMode prop 优先级高于这里的 mode。
 */
export function ResponsiveProvider({
  breakpoint = DEFAULT_BREAKPOINT,
  mode = 'auto',
  children,
}: ResponsiveProviderProps) {
  const value = React.useMemo(() => ({ breakpoint, mode }), [breakpoint, mode]);

  return <ResponsiveContext.Provider value={value}>{children}</ResponsiveContext.Provider>;
}
