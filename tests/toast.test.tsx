import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import {
  Toast,
  ToastHost,
  showToast,
  showSuccessToast,
  showLoadingToast,
  showFailToast,
  closeToast,
  type ToastHandle,
} from '@/components/responsive/toast';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { resetToastStore } from '@/hooks/use-toast-store';
import { resetImperativeHosts } from '@/lib/imperative-host';

/**
 * Toast 双模式行为测试（矩阵 §4 要求）
 *
 * 模式 C 的验证重点：**形态本质不同，但生命周期规则完全一致**
 *   - H5：顶部居中胶囊、单例（新的覆盖旧的）
 *   - PC：右上角卡片栈、可多条并存、可手动关闭
 *   - 两端共有：2s 自动消失、loading 默认常驻、closeToast() 全关
 */

function toasts(): Element[] {
  return Array.from(document.querySelectorAll('[data-slot="toast"]'));
}

function actShow(fn: () => unknown): void {
  act(() => {
    fn();
  });
}

beforeEach(() => {
  resetToastStore();
  document.body.removeAttribute('data-bv-scroll-locked');
});

afterEach(() => {
  resetImperativeHosts();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('h5 mode', () => {
  it('渲染为顶部居中胶囊，白字深底', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('已保存'));

    const [toast] = toasts();
    expect(toast).toHaveAttribute('data-mode', 'h5');
    expect(toast).toHaveAttribute('data-position', 'top');
    expect(toast.className).toContain('justify-center');
    expect(toast.textContent).toContain('已保存');

    const capsule = toast.querySelector('div') as HTMLElement;
    expect(capsule.className).toContain('bg-[var(--bv-toast-background)]');
    expect(capsule.className).toContain('text-[var(--bv-toast-text-color)]');
  });

  it('2s 后自动消失', () => {
    vi.useFakeTimers();
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('会自动消失'));
    expect(toasts().length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(toasts().length).toBe(0);
  });

  it('单例语义：连发两条只显示最新一条', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showToast('第一条');
      showToast('第二条');
    });

    expect(toasts().length).toBe(1);
    expect(toasts()[0].textContent).toContain('第二条');
    expect(document.body.textContent).not.toContain('第一条');
  });

  it('loading 类型默认常驻，不自动消失', () => {
    vi.useFakeTimers();
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showLoadingToast('加载中'));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(toasts().length).toBe(1);
    expect(toasts()[0].querySelector('[data-slot="icon"]')).not.toBeNull();
  });

  it('closeToast(id) 可提前关闭 loading', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    let handle: ToastHandle = { id: 0, close: () => undefined };
    actShow(() => {
      handle = showLoadingToast('加载中');
    });

    expect(toasts().length).toBe(1);

    actShow(() => handle.close());

    expect(toasts().length).toBe(0);
  });

  it('无关闭按钮（H5 靠自动消失）', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('纯文案'));

    expect(document.querySelector('[data-slot="toast-close"]')).toBeNull();
  });

  it('success 类型带成功图标', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showSuccessToast('操作成功'));

    const icon = toasts()[0].querySelector('[data-slot="icon"]');
    expect(icon).not.toBeNull();
    // 图标为自研 SVG，通过 viewBox 与描边识别，不依赖字体图标
    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
  });
});

describe('pc mode', () => {
  it('渲染为右上角卡片栈', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('已保存'));

    const stack = document.querySelector('[data-slot="toast-stack"]');
    expect(stack).toHaveAttribute('data-mode', 'pc');
    expect(stack?.className).toContain('right-[var(--bv-toast-pc-gutter)]');
    expect(stack?.className).toContain('top-[var(--bv-toast-pc-gutter)]');
    expect(toasts()[0]).toHaveAttribute('data-mode', 'pc');
  });

  it('可多条并存（与 H5 单例形成对照）', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showToast('第一条');
      showFailToast('第二条');
    });

    expect(toasts().length).toBe(2);
    expect(document.body.textContent).toContain('第一条');
    expect(document.body.textContent).toContain('第二条');
  });

  it('带关闭按钮，点击后立即移除', async () => {
    render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('可手动关闭'));

    const closeBtn = document.querySelector('[data-slot="toast-close"]');
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      fireEvent.click(closeBtn as Element);
    });

    await waitFor(() => {
      expect(toasts().length).toBe(0);
    });
  });

  it('2s 自动消失（生命周期两端一致）', () => {
    vi.useFakeTimers();
    render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast('会自动消失'));
    expect(toasts().length).toBe(1);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(toasts().length).toBe(0);
  });

  it('成功类型使用彩色图标（白底卡片，不再是白字深底）', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showSuccessToast('操作成功'));

    const item = toasts()[0];
    expect(item.className).toContain('bg-bv-surface');
    const iconWrap = item.querySelector('[data-slot="icon"]')?.parentElement;
    expect(iconWrap?.className).toContain('text-bv-success');
  });
});

describe('双模式一致性', () => {
  it('closeToast() 不传 id 时两端都关闭全部', () => {
    const { unmount } = render(
      <ResponsiveProvider mode="desktop">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showToast('A');
      showToast('B');
    });
    expect(toasts().length).toBe(2);

    actShow(() => closeToast());
    expect(toasts().length).toBe(0);
    unmount();

    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );
    actShow(() => showToast('C'));
    expect(toasts().length).toBe(1);

    actShow(() => closeToast());
    expect(toasts().length).toBe(0);
  });

  it('duration 显式传 0 时两端都不自动关闭', () => {
    vi.useFakeTimers();
    render(
      <ResponsiveProvider mode="mobile">
        <ToastHost />
      </ResponsiveProvider>,
    );

    actShow(() => showToast({ message: '常驻', duration: 0 }));

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(toasts().length).toBe(1);
  });
});

describe('声明式 Toast', () => {
  it('open 为真时渲染，2s 后回调 onOpenChange(false)', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();

    render(
      <ResponsiveProvider mode="mobile">
        <Toast open message="声明式提示" onOpenChange={onOpenChange} />
      </ResponsiveProvider>,
    );

    expect(document.body.textContent).toContain('声明式提示');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('open 为假时不渲染', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <Toast open={false} message="不该出现" />
      </ResponsiveProvider>,
    );

    expect(document.body.textContent).not.toContain('不该出现');
  });

  it('PC 模式下走卡片栈形态', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <Toast open message="PC 提示" />
      </ResponsiveProvider>,
    );

    expect(document.querySelector('[data-slot="toast-stack"]')).not.toBeNull();
    expect(toasts()[0]).toHaveAttribute('data-mode', 'pc');
  });
});
