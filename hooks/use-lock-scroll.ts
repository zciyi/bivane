import * as React from 'react';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';

/**
 * Bivane 滚动锁定
 *
 * 双端策略不同，因为「不能滚」在两端的正确实现并不一样：
 *
 *  - mobile（fixed）：iOS Safari 上单纯 `overflow: hidden` 挡不住橡皮筋效果，
 *    Vant / vaul 的做法是把 body 改成 `position: fixed` 并用负 top 抵消当前滚动位置。
 *  - desktop（overflow）：PC 没有橡皮筋问题，但直接 `hidden` 会让滚动条消失、
 *    页面整体右移（布局抖动），因此需要补偿滚动条宽度。
 *
 * 支持计数：多层弹层嵌套时，只有全部关闭才真正解锁。
 */

export type ScrollLockStrategy = 'fixed' | 'overflow';

interface BodySnapshot {
  overflow: string;
  position: string;
  top: string;
  width: string;
  paddingRight: string;
  scrollY: number;
}

let locks = 0;
let snapshot: BodySnapshot | null = null;

function scrollbarGap(): number {
  if (typeof window === 'undefined') return 0;
  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

export function lockScroll(strategy: ScrollLockStrategy): void {
  if (typeof document === 'undefined') return;

  locks += 1;
  if (locks > 1) return; // 已锁，复用第一层的快照

  const { body } = document;
  snapshot = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
    scrollY: window.scrollY ?? 0,
  };

  if (strategy === 'fixed') {
    body.style.position = 'fixed';
    body.style.top = `-${snapshot.scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
  } else {
    body.style.overflow = 'hidden';
    const gap = scrollbarGap();
    if (gap > 0) body.style.paddingRight = `${gap}px`;
  }

  body.setAttribute('data-bv-scroll-locked', strategy);
}

export function unlockScroll(): void {
  if (typeof document === 'undefined') return;

  locks = Math.max(0, locks - 1);
  if (locks > 0) return;

  const { body } = document;
  const saved = snapshot;
  snapshot = null;
  body.removeAttribute('data-bv-scroll-locked');

  if (!saved) return;

  body.style.overflow = saved.overflow;
  body.style.position = saved.position;
  body.style.top = saved.top;
  body.style.width = saved.width;
  body.style.paddingRight = saved.paddingRight;

  // fixed 策略把页面顶到了 top 0，解锁后要滚回原位
  if (saved.scrollY > 0 && typeof window.scrollTo === 'function') {
    try {
      window.scrollTo(0, saved.scrollY);
    } catch {
      /* jsdom / 无滚动环境，忽略 */
    }
  }
}

/** 当前是否处于锁定状态（测试与调试用） */
export function isScrollLocked(): boolean {
  return locks > 0;
}

export interface UseLockScrollOptions {
  /** 是否锁定，默认由调用方按 open 状态传入 */
  active: boolean;
  /**
   * 组件已解析好的设备模式（含 forceMode 逃生舱）。
   * 必须由调用方传入：本 hook 内部的 useDeviceMode() 拿不到组件的 forceMode，
   * 否则强制 H5 的弹层会错误地使用 PC 的锁策略。
   */
  mode?: DeviceMode;
  /** 强制策略，优先级高于 mode */
  strategy?: ScrollLockStrategy;
}

export function useLockScroll({ active, mode, strategy }: UseLockScrollOptions): void {
  const detected: DeviceMode = useDeviceMode();
  const resolved: ScrollLockStrategy =
    strategy ?? ((mode ?? detected) === 'mobile' ? 'fixed' : 'overflow');

  React.useEffect(() => {
    if (!active) return undefined;
    lockScroll(resolved);
    return () => unlockScroll();
  }, [active, resolved]);
}
