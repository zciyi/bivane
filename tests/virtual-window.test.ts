import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, VIRTUAL_THRESHOLD } from '@/hooks/use-virtual-window';

/**
 * 虚拟窗口的纯函数测试
 *
 * 窗口化最容易出的两类问题：
 *   1. 未测量完成（viewportHeight = 0）时算出空区间 → 首帧一片空白
 *   2. 上下占位算错 → 滚动条长度不对或滚到底部露出空白
 * 这两类都在这里钉住。
 */

describe('computeVirtualWindow', () => {
  it('未测量时退化为全量渲染，绝不返回空区间', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 0,
      itemHeight: 36,
      count: 500,
    });
    expect(result).toEqual({
      start: 0,
      end: 500,
      paddingTop: 0,
      paddingBottom: 0,
      totalHeight: 18000,
    });
  });

  it('空列表返回零区间且总高为 0', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 280,
      itemHeight: 36,
      count: 0,
    });
    expect(result.end).toBe(0);
    expect(result.totalHeight).toBe(0);
  });

  it('项高为 0 时同样退化为全量（避免除零得到 Infinity）', () => {
    const result = computeVirtualWindow({
      scrollTop: 100,
      viewportHeight: 280,
      itemHeight: 0,
      count: 20,
    });
    expect(result.start).toBe(0);
    expect(result.end).toBe(20);
  });

  it('顶部：从第一项开始渲染，上方无占位', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 280,
      itemHeight: 36,
      count: 1000,
      overscan: 4,
    });
    expect(result.start).toBe(0);
    expect(result.paddingTop).toBe(0);
    // 280 / 36 ≈ 7.8 → 8 个可见项，加上下各 4 个 overscan
    expect(result.end).toBe(16);
    expect(result.totalHeight).toBe(36000);
    expect(result.paddingBottom).toBe((1000 - 16) * 36);
  });

  it('滚动中：渲染区间跟随 scrollTop，上下占位之和守恒', () => {
    const result = computeVirtualWindow({
      scrollTop: 3600,
      viewportHeight: 280,
      itemHeight: 36,
      count: 1000,
      overscan: 4,
    });
    expect(result.start).toBe(96); // 3600/36 = 100，再上探 4 个 overscan
    expect(result.paddingTop).toBe(96 * 36);
    // 渲染项数 × 项高 + 上下占位 == 总高，任何一项错都会破坏这个恒等式
    expect(
      (result.end - result.start) * 36 + result.paddingTop + result.paddingBottom,
    ).toBe(result.totalHeight);
  });

  it('滚动到底：end 恰好等于 count，不留多余的下方占位', () => {
    const result = computeVirtualWindow({
      scrollTop: 36000,
      viewportHeight: 280,
      itemHeight: 36,
      count: 1000,
      overscan: 4,
    });
    expect(result.end).toBe(1000);
    expect(result.paddingBottom).toBe(0);
    expect(result.start).toBeLessThanOrEqual(1000);
  });

  it('负数 scrollTop（部分浏览器回弹时会短暂出现）按 0 处理', () => {
    const result = computeVirtualWindow({
      scrollTop: -50,
      viewportHeight: 280,
      itemHeight: 36,
      count: 100,
    });
    expect(result.start).toBe(0);
  });

  it('渲染项数远小于总数，证明窗口化确实生效', () => {
    const result = computeVirtualWindow({
      scrollTop: 0,
      viewportHeight: 280,
      itemHeight: 36,
      count: 10000,
    });
    expect(result.end - result.start).toBeLessThan(VIRTUAL_THRESHOLD);
  });
});
