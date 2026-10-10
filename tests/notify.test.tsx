import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import {
  Notify,
  NotifyHost,
  showNotify,
  closeNotify,
} from '@/components/responsive/notify';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { resetNotifyStore } from '@/hooks/use-notify-store';
import { resetImperativeHosts } from '@/lib/imperative-host';

/**
 * Notify 双模式行为测试（契约 18）
 *
 * 模式 C 的验证重点：**位置范式与队列规则不同，但计时语义一致**。
 *   - H5：顶部通栏横幅、单例（新通知替换旧的）、默认无关闭按钮（常驻除外）
 *   - PC：右上角圆角卡片栈、多条并存、每条带关闭按钮
 *   - 两端共有：默认 3s 自动消失，duration=0 常驻
 */

function host(): HTMLElement | null {
  return document.querySelector('[data-slot="notify-host"]');
}

function notes(): Element[] {
  return Array.from(document.querySelectorAll('[data-slot="notify"]'));
}

function actShow(fn: () => unknown): void {
  act(() => {
    fn();
  });
}

beforeEach(() => {
  resetNotifyStore();
});

afterEach(() => {
  resetImperativeHosts();
  vi.useRealTimers();
});

describe('h5 mode', () => {
  it('渲染为顶部通栏横幅，默认 danger 语义色', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => showNotify({ message: '操作失败', duration: 0 }));

    expect(host()).toHaveAttribute('data-mode', 'h5');
    expect(host()?.className).toContain('inset-x-0');
    expect(host()?.className).toContain('top-0');
    expect(notes()[0]).toHaveAttribute('data-mode', 'h5');
    expect(notes()[0]).toHaveAttribute('data-type', 'danger');
    expect(notes()[0]?.textContent).toContain('操作失败');
  });

  it('单例语义：连发多条只呈现最新一条（旧条仍由 store 计时回收）', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showNotify({ message: '第一条', duration: 0 });
      showNotify({ message: '第二条', duration: 0 });
      showNotify({ message: '第三条', duration: 0 });
    });

    expect(notes()).toHaveLength(1);
    expect(notes()[0]?.textContent).toContain('第三条');
    expect(document.body.textContent).not.toContain('第一条');
  });

  it('自动消失的通知不显示关闭按钮（触屏惯例：纯自动消失）', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => showNotify({ message: '3 秒后消失', duration: 3000 }));

    expect(document.querySelector('[data-slot="notify-close"]')).toBeNull();
  });

  it('常驻通知（duration=0）必须提供关闭按钮，否则用户永远关不掉', () => {
    render(
      <ResponsiveProvider mode="mobile">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => showNotify({ message: '常驻', duration: 0 }));

    const closeBtn = document.querySelector('[data-slot="notify-close"]');
    expect(closeBtn).not.toBeNull();

    actShow(() => fireEvent.click(closeBtn as Element));
    expect(notes()).toHaveLength(0);
  });

  it('默认 3s 自动消失并回调 onClose', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <ResponsiveProvider mode="mobile">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => showNotify({ message: '会消失', onClose }));
    expect(notes()).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(notes()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('pc mode', () => {
  it('渲染为右上角圆角卡片栈', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => showNotify({ message: '桌面通知', duration: 0 }));

    expect(host()).toHaveAttribute('data-mode', 'pc');
    expect(host()?.className).toContain('right-bv-md');
    expect(host()?.className).toContain('top-bv-md');
    expect(notes()[0]).toHaveAttribute('data-mode', 'pc');
    expect(notes()[0]?.className).toContain('rounded-bv-lg');
  });

  it('多条并存（与 H5 单例形成对照），按发出顺序全部可见', () => {
    render(
      <ResponsiveProvider mode="desktop">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showNotify({ message: '第一条', duration: 0 });
      showNotify({ message: '第二条', duration: 0 });
    });

    expect(notes()).toHaveLength(2);
    expect(document.body.textContent).toContain('第一条');
    expect(document.body.textContent).toContain('第二条');
  });

  it('每条都带关闭按钮，点击只关闭对应一条并触发其 onClose', () => {
    const onCloseA = vi.fn();
    const onCloseB = vi.fn();

    render(
      <ResponsiveProvider mode="desktop">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showNotify({ message: '甲', duration: 0, onClose: onCloseA });
      showNotify({ message: '乙', duration: 0, onClose: onCloseB });
    });

    const closeButtons = document.querySelectorAll('[data-slot="notify-close"]');
    expect(closeButtons).toHaveLength(2);

    actShow(() => fireEvent.click(closeButtons[0] as Element));

    expect(notes()).toHaveLength(1);
    expect(notes()[0]?.textContent).toContain('乙');
    expect(onCloseA).toHaveBeenCalledTimes(1);
    expect(onCloseB).not.toHaveBeenCalled();
  });

  it('closeNotify() 不传 id 关闭全部并各自回调', () => {
    const onClose = vi.fn();

    render(
      <ResponsiveProvider mode="desktop">
        <NotifyHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showNotify({ message: 'A', duration: 0, onClose });
      showNotify({ message: 'B', duration: 0, onClose });
    });

    actShow(() => closeNotify());

    expect(notes()).toHaveLength(0);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('声明式 Notify', () => {
  it('open 为真时渲染，open 翻假立即卸载', () => {
    const { rerender } = render(
      <ResponsiveProvider mode="mobile">
        <Notify open message="横幅文案" />
      </ResponsiveProvider>,
    );

    expect(notes()).toHaveLength(1);
    expect(notes()[0]?.textContent).toContain('横幅文案');

    rerender(
      <ResponsiveProvider mode="mobile">
        <Notify open={false} message="横幅文案" />
      </ResponsiveProvider>,
    );
    expect(notes()).toHaveLength(0);
  });

  it('到时自动请求关闭并回调 onClose（与命令式同走 3s 默认值）', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const onClose = vi.fn();

    render(
      <ResponsiveProvider mode="desktop">
        <Notify open message="声明式" onOpenChange={onOpenChange} onClose={onClose} />
      </ResponsiveProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('duration=0 时不自动关闭', () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();

    render(
      <ResponsiveProvider mode="mobile">
        <Notify open message="常驻" duration={0} onOpenChange={onOpenChange} />
      </ResponsiveProvider>,
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(notes()).toHaveLength(1);
  });
});
