import * as React from 'react';

/**
 * Bivane 设备模式判定
 * 详见 bivane-architecture.md §6.2
 *
 * 判定规则（优先级从高到低）：
 *   1. 组件 forceMode prop（逃生舱）
 *   2. <ResponsiveProvider mode>（文档站 / 测试用）
 *   3. 自动判定：宽度 < breakpoint 或 (pointer: coarse && hover: none)
 *
 * SSR / 首屏默认返回 'desktop'（保守），避免 hydration mismatch。
 */

export type DeviceMode = 'mobile' | 'desktop';
export type ResponsiveModeOption = 'auto' | DeviceMode;

export const DEFAULT_BREAKPOINT = 768;

export interface ResponsiveConfig {
  breakpoint: number;
  mode: ResponsiveModeOption;
}

export const ResponsiveContext = React.createContext<ResponsiveConfig | null>(null);

export function useResponsiveConfig(): ResponsiveConfig | null {
  return React.useContext(ResponsiveContext);
}

const narrowQuery = (breakpoint: number) => `(max-width: ${breakpoint - 1}px)`;
/** 触屏平板、大屏手机横屏：宽度够大但没有精确指针能力 */
const TOUCH_QUERY = '(pointer: coarse) and (hover: none)';

/** matchMedia 缓存 + SSR 兜底（jsdom / Node 环境无 matchMedia） */
const mqlCache = new Map<string, MediaQueryList | null>();

function getMql(query: string): MediaQueryList | null {
  const cached = mqlCache.get(query);
  if (cached !== undefined) return cached;

  let mql: MediaQueryList | null = null;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      mql = window.matchMedia(query);
    } catch {
      mql = null;
    }
  }
  mqlCache.set(query, mql);
  return mql;
}

/** 供测试环境重置缓存（切换 viewport mock 后调用） */
export function resetMediaQueryCache(): void {
  mqlCache.clear();
}

function detectMode(breakpoint: number): DeviceMode {
  const isNarrow = getMql(narrowQuery(breakpoint))?.matches ?? false;
  const isTouch = getMql(TOUCH_QUERY)?.matches ?? false;
  return isNarrow || isTouch ? 'mobile' : 'desktop';
}

export function useDeviceMode(forceMode?: DeviceMode): DeviceMode {
  const config = useResponsiveConfig();
  const breakpoint = config?.breakpoint ?? DEFAULT_BREAKPOINT;
  const providerMode = config?.mode ?? 'auto';

  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const queries = [narrowQuery(breakpoint), TOUCH_QUERY];
      const mqls = queries
        .map(getMql)
        .filter((mql): mql is MediaQueryList => mql !== null);

      if (mqls.length === 0) return () => undefined;

      mqls.forEach((mql) => mql.addEventListener('change', onStoreChange));
      return () => mqls.forEach((mql) => mql.removeEventListener('change', onStoreChange));
    },
    [breakpoint],
  );

  const getSnapshot = React.useCallback(() => detectMode(breakpoint), [breakpoint]);
  const getServerSnapshot = React.useCallback((): DeviceMode => 'desktop', []);

  const detected = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (forceMode) return forceMode;
  return providerMode === 'auto' ? detected : providerMode;
}

/** 契约要求根元素带 data-mode="h5|pc"，此 hook 直接产出可展开的属性对象 */
export type DeviceModeAttr = { 'data-mode': 'h5' | 'pc' };

export function useDeviceModeAttrs(forceMode?: DeviceMode): DeviceModeAttr {
  const mode = useDeviceMode(forceMode);
  return { 'data-mode': mode === 'mobile' ? 'h5' : 'pc' };
}
