import { act, renderHook } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { useDeviceMode, useDeviceModeAttrs } from '@/hooks/use-device-mode';
import { setViewport } from './setup';

describe('useDeviceMode（架构文档 §6.2 判定规则）', () => {
  it('小屏 -> mobile', () => {
    const { result } = renderHook(() => useDeviceMode());
    expect(result.current).toBe('desktop');

    act(() => setViewport({ width: 375 }));
    expect(result.current).toBe('mobile');
  });

  it('大屏 + 精确指针 -> desktop', () => {
    const { result } = renderHook(() => useDeviceMode());
    act(() => setViewport({ width: 1440, touch: false }));
    expect(result.current).toBe('desktop');
  });

  it('大屏 + 触屏（触屏平板）-> mobile，验证 pointer 能力叠加判定', () => {
    const { result } = renderHook(() => useDeviceMode());
    act(() => setViewport({ width: 1024, touch: true }));
    expect(result.current).toBe('mobile');
  });

  it('断点边界：767 -> mobile，768 -> desktop', () => {
    const { result } = renderHook(() => useDeviceMode());

    act(() => setViewport({ width: 767 }));
    expect(result.current).toBe('mobile');

    act(() => setViewport({ width: 768 }));
    expect(result.current).toBe('desktop');
  });

  it('ResponsiveProvider 的 breakpoint 可配置', () => {
    const { result } = renderHook(() => useDeviceMode(), {
      wrapper: ({ children }) =>
        React.createElement(ResponsiveProvider, { breakpoint: 1200, children }),
    });

    act(() => setViewport({ width: 900 }));
    expect(result.current).toBe('mobile');

    act(() => setViewport({ width: 1300 }));
    expect(result.current).toBe('desktop');
  });

  it('Provider mode 强制覆盖优先于自动判定', () => {
    const { result } = renderHook(() => useDeviceMode(), {
      wrapper: ({ children }) =>
        React.createElement(ResponsiveProvider, { mode: 'mobile', children }),
    });

    act(() => setViewport({ width: 1440, touch: false }));
    expect(result.current).toBe('mobile');
  });

  it('forceMode 优先级最高（逃生舱）', () => {
    const { result } = renderHook(() => useDeviceMode('mobile'), {
      wrapper: ({ children }) =>
        React.createElement(ResponsiveProvider, { mode: 'desktop', children }),
    });

    act(() => setViewport({ width: 1440, touch: false }));
    expect(result.current).toBe('mobile');
  });

  it('useDeviceModeAttrs 输出契约要求的 data-mode="h5|pc"', () => {
    const { result } = renderHook(() => useDeviceModeAttrs());
    act(() => setViewport({ width: 375 }));
    expect(result.current).toEqual({ 'data-mode': 'h5' });
  });
});
