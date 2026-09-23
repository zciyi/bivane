import { describe, expect, it } from 'vitest';
import { resolveDragOutcome } from '@/hooks/use-drag-to-dismiss';

/**
 * 下拉关闭的判定逻辑单测
 *
 * 之所以单独测纯函数：手势的行为边界（甩动 vs 慢拖、向上拖 vs 向下拖）
 * 靠模拟 pointer 事件很难穷举，抽成纯函数后每条分支都能确定地覆盖。
 * 事件层只保留一个「能触发关闭」的集成用例（见 popup.test.tsx）。
 */

const base = {
  offset: 0,
  velocity: 0,
  height: 400,
  closeDistance: 80,
  closeVelocity: 0.5,
};

describe('resolveDragOutcome', () => {
  it('没有位移时回弹', () => {
    expect(resolveDragOutcome({ ...base, offset: 0, velocity: 0 })).toBe('reset');
  });

  it('向上拖（offset <= 0）时回弹', () => {
    expect(resolveDragOutcome({ ...base, offset: -40, velocity: -1 })).toBe('reset');
  });

  it('向上甩动时回弹，不会因速度误判为关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 30, velocity: -2 })).toBe('reset');
  });

  it('位移不足但向下甩动速度快 → 关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 20, velocity: 0.8 })).toBe('close');
  });

  it('微小抖动（低于速度护栏 16px）即使瞬时速度很大也不关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 4, velocity: 4 })).toBe('reset');
    expect(resolveDragOutcome({ ...base, offset: 15, velocity: 9 })).toBe('reset');
  });

  it('刚好达到速度护栏且速度够快 → 关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 16, velocity: 0.9 })).toBe('close');
  });

  it('位移达到阈值但速度很慢 → 关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 100, velocity: 0.05 })).toBe('close');
  });

  it('位移与速度都不足时回弹', () => {
    expect(resolveDragOutcome({ ...base, offset: 40, velocity: 0.1 })).toBe('reset');
  });

  it('拖过面板高度 40% 也判定关闭（长面板的兜底）', () => {
    expect(resolveDragOutcome({ ...base, offset: 170, velocity: 0.1 })).toBe('close');
  });

  it('阈值边界：恰好等于 closeDistance 时关闭', () => {
    expect(resolveDragOutcome({ ...base, offset: 80, velocity: 0 })).toBe('close');
  });

  it('高度未知（0）时不走比例分支，只看距离与速度', () => {
    expect(resolveDragOutcome({ ...base, height: 0, offset: 40, velocity: 0.1 })).toBe('reset');
    expect(resolveDragOutcome({ ...base, height: 0, offset: 90, velocity: 0.1 })).toBe('close');
  });
});
