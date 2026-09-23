import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  Dialog,
  DialogHost,
  showDialog,
  showConfirmDialog,
  closeDialog,
  type DialogHandle,
} from '@/components/responsive/dialog';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { resetDialogStore } from '@/hooks/use-dialog-store';
import { resetImperativeHosts } from '@/lib/imperative-host';

/**
 * Dialog 双模式行为测试（矩阵 §3.2 要求：两模式各 1 个行为测试，开放式/关闭/确认）
 *
 * 模式 B 的验证重点：**同一份 props 与内容，两种壳的交互不同**。
 *   - H5：底部抽屉（data-variant="sheet"）、按钮纵向、遮罩点击关闭
 *   - PC：居中模态（data-variant="modal"）、按钮横向右对齐、遮罩点击不关、ESC 关闭
 *
 * 选择器约定：
 *   data-slot    由交付该元素的组件持有（popup / overlay / button），不可被上层覆盖
 *   data-component 组合型组件标记自身角色（dialog）—— 因此 Dialog 用后者定位
 */

function dialogEl(): HTMLElement {
  return document.querySelector('[data-component="dialog"]') as HTMLElement;
}

/**
 * 遮罩取件：H5 走 Popup 的 Overlay（data-slot="overlay"），
 * PC 走 Radix 自己的遮罩（data-slot="dialog-overlay"，槽名与 utilities.css 的动画选择器对齐）
 */
function overlayEl(): HTMLElement {
  return (document.querySelector('[data-slot="overlay"]') ??
    document.querySelector('[data-slot="dialog-overlay"]')) as HTMLElement;
}

function footerEl(): HTMLElement {
  return document.querySelector('[data-slot="dialog-footer"]') as HTMLElement;
}

function loadingButton(): Element | null {
  return document.querySelector('[data-slot="button"][data-loading="true"]');
}

beforeEach(() => {
  resetDialogStore();
  document.body.removeAttribute('data-bv-scroll-locked');
  document.body.style.cssText = '';
});

afterEach(() => {
  resetImperativeHosts();
  vi.restoreAllMocks();
});

describe('h5 mode', () => {
  it('渲染为底部抽屉形态，按钮纵向排列', () => {
    render(
      <Dialog
        open
        forceMode="mobile"
        title="标题"
        message="正文内容"
        showCancelButton
        duration={0}
      />,
    );

    expect(dialogEl()).toHaveAttribute('data-mode', 'h5');
    expect(dialogEl()).toHaveAttribute('data-variant', 'sheet');
    expect(dialogEl()).toHaveAttribute('data-position-resolved', 'bottom');
    expect(footerEl()).toHaveAttribute('data-layout', 'stack');
    expect(screen.getByText('标题')).toBeInTheDocument();
    expect(screen.getByText('正文内容')).toBeInTheDocument();
  });

  it('description 优先于 message（矩阵命名与 Vant 命名并存）', () => {
    render(
      <Dialog open forceMode="mobile" message="旧文案" description="新文案" duration={0} />,
    );

    expect(screen.getByText('新文案')).toBeInTheDocument();
    expect(screen.queryByText('旧文案')).toBeNull();
  });

  it('点击确认触发 onConfirm 并关闭', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <Dialog
        open
        forceMode="mobile"
        confirmText="确定"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('确定'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('点击取消触发 onCancel（Vant 语义：confirm/cancel 各管各的）', async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <Dialog
        open
        forceMode="mobile"
        showCancelButton
        cancelText="再想想"
        onCancel={onCancel}
        onConfirm={onConfirm}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('再想想'));
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('beforeClose 返回 false 时阻止关闭', async () => {
    const onOpenChange = vi.fn();

    render(
      <Dialog
        open
        forceMode="mobile"
        confirmText="确定"
        beforeClose={() => false}
        onOpenChange={onOpenChange}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('确定'));
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('beforeClose 支持异步：await 期间确认按钮进入 loading', async () => {
    let release: (value: boolean) => void = () => undefined;
    const gate = new Promise<boolean>((resolve) => {
      release = resolve;
    });

    render(
      <Dialog
        open
        forceMode="mobile"
        confirmText="确定"
        beforeClose={() => gate}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('确定'));
    });

    expect(loadingButton()).not.toBeNull();

    await act(async () => {
      release(true);
      await gate;
    });

    expect(loadingButton()).toBeNull();
  });

  it('点击遮罩默认关闭（H5 抽屉形态）', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open forceMode="mobile" onOpenChange={onOpenChange} duration={0} />);

    await act(async () => {
      fireEvent.click(overlayEl());
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ESC 关闭', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open forceMode="mobile" onOpenChange={onOpenChange} duration={0} />);

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('showConfirmButton={false} 时不渲染确认按钮', () => {
    render(<Dialog open forceMode="mobile" showConfirmButton={false} duration={0} />);

    expect(screen.queryByText('确认')).toBeNull();
    expect(document.querySelector('[data-slot="dialog-footer"]')).toBeNull();
  });

  it('自定义 footer 覆盖默认按钮区', () => {
    render(
      <Dialog
        open
        forceMode="mobile"
        footer={<button type="button">自定义按钮</button>}
        duration={0}
      />,
    );

    expect(screen.getByText('自定义按钮')).toBeInTheDocument();
    expect(screen.queryByText('确认')).toBeNull();
  });
});

describe('pc mode', () => {
  it('渲染为居中模态，按钮横向右对齐', () => {
    render(
      <Dialog
        open
        forceMode="desktop"
        title="标题"
        message="正文内容"
        showCancelButton
        duration={0}
      />,
    );

    expect(dialogEl()).toHaveAttribute('data-mode', 'pc');
    expect(dialogEl()).toHaveAttribute('data-variant', 'modal');
    expect(footerEl()).toHaveAttribute('data-layout', 'row');
    expect(dialogEl().className).toContain('max-w-[var(--bv-dialog-pc-width)]');
  });

  it('不渲染 H5 的拖拽指示条', () => {
    render(<Dialog open forceMode="desktop" title="标题" duration={0} />);

    expect(document.querySelector('[data-slot="popup-drag-handle"]')).toBeNull();
  });

  it('点击确认触发 onConfirm 并关闭', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <Dialog
        open
        forceMode="desktop"
        confirmText="确定"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText('确定'));
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('点击遮罩默认不关闭（矩阵 §2.1）', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open forceMode="desktop" onOpenChange={onOpenChange} duration={0} />);

    await act(async () => {
      fireEvent.click(overlayEl());
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closeOnClickOverlay={true} 时点遮罩关闭（显式值两端一致）', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open
        forceMode="desktop"
        closeOnClickOverlay
        onOpenChange={onOpenChange}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.click(overlayEl());
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('ESC 关闭（Radix 键盘交互）', async () => {
    const onOpenChange = vi.fn();
    render(<Dialog open forceMode="desktop" onOpenChange={onOpenChange} duration={0} />);

    await act(async () => {
      fireEvent.keyDown(dialogEl(), { key: 'Escape' });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closeOnPressEscape={false} 时 ESC 不关闭', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog
        open
        forceMode="desktop"
        closeOnPressEscape={false}
        onOpenChange={onOpenChange}
        duration={0}
      />,
    );

    await act(async () => {
      fireEvent.keyDown(dialogEl(), { key: 'Escape' });
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('无标题时用 sr-only 占位，保证 aria-labelledby 有效', () => {
    render(<Dialog open forceMode="desktop" message="只有正文" duration={0} />);

    const header = document.querySelector('[data-slot="dialog-header"]');
    expect(header).not.toBeNull();
    expect(header?.querySelector('.sr-only')).not.toBeNull();
  });
});

describe('遮罩契约（portal 逃出 [data-mode] 作用域后必须自带 mode）', () => {
  // 这两条是「静默降级」的防线：遮罩的浓度与动画时长都由
  // [data-mode='pc'] 的 token 覆盖决定，不自带 data-mode 就会静默沿用 H5 值。
  it('H5 遮罩自带 data-mode="h5"', () => {
    render(<Dialog open forceMode="mobile" duration={0} />);

    expect(overlayEl()).toHaveAttribute('data-mode', 'h5');
    expect(overlayEl()).toHaveAttribute('data-slot', 'overlay');
  });

  it('PC 遮罩自带 data-mode="pc"，且槽名与动画选择器一致', () => {
    render(<Dialog open forceMode="desktop" duration={0} />);

    expect(overlayEl()).toHaveAttribute('data-mode', 'pc');
    // utilities.css 的进场动画挂在 [data-slot='dialog-overlay'] 上
    expect(overlayEl()).toHaveAttribute('data-slot', 'dialog-overlay');
    expect(overlayEl()).toHaveClass('bg-bv-overlay');
  });
});

describe('双模式一致性', () => {
  it('同一组 props 两端都能渲染，交互差异不通过 props 泄露', async () => {
    const shared = {
      title: '标题',
      message: '正文',
      showCancelButton: true,
      duration: 0,
      lockScroll: false,
    };

    const { unmount } = render(<Dialog {...shared} open forceMode="mobile" />);
    expect(dialogEl()).toHaveAttribute('data-variant', 'sheet');
    unmount();

    render(<Dialog {...shared} open forceMode="desktop" />);
    expect(dialogEl()).toHaveAttribute('data-variant', 'modal');
  });
});

describe('命令式 API（双轨）', () => {
  it('showDialog 打开、closeDialog 关闭', async () => {
    render(
      <ResponsiveProvider mode="mobile">
        <DialogHost />
      </ResponsiveProvider>,
    );

    expect(document.querySelector('[data-component="dialog"]')).toBeNull();

    let handle: DialogHandle = { id: 0, close: () => undefined, update: () => undefined };
    await act(async () => {
      handle = showDialog({ title: '命令式弹窗', message: '来自 store', duration: 0 });
    });

    await waitFor(() => {
      expect(screen.getByText('命令式弹窗')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-component="dialog"]')).toHaveAttribute(
      'data-variant',
      'sheet',
    );

    await act(async () => {
      handle.close();
    });

    await waitFor(() => {
      expect(screen.queryByText('命令式弹窗')).toBeNull();
    });
  });

  it('showConfirmDialog 默认带上取消按钮', async () => {
    render(
      <ResponsiveProvider mode="mobile">
        <DialogHost />
      </ResponsiveProvider>,
    );

    await act(async () => {
      showConfirmDialog({ message: '确认删除？', cancelText: '不了', duration: 0 });
    });

    await waitFor(() => {
      expect(screen.getByText('不了')).toBeInTheDocument();
    });
    expect(document.querySelector('[data-slot="button"]')).not.toBeNull();
  });

  it('closeDialog() 不传 id 时关闭全部', async () => {
    render(
      <ResponsiveProvider mode="mobile">
        <DialogHost />
      </ResponsiveProvider>,
    );

    await act(async () => {
      showDialog({ message: '第一个', duration: 0 });
      showDialog({ message: '第二个', duration: 0 });
    });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-component="dialog"]').length).toBe(2);
    });

    await act(async () => {
      closeDialog();
    });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-component="dialog"]').length).toBe(0);
    });
  });

  it('未挂载宿主时自动创建 root（默认断点下的 PC 形态）', async () => {
    // 注：这条用例会让 stderr 出现一条 act(...) 警告 —— 自动宿主的更新发生在
    // 独立 React root 里，不在 RTL 的 act 作用域内。这是被测设计本身的性质，不是缺陷。
    await act(async () => {
      showDialog({ message: '自动宿主', duration: 0 });
    });

    await waitFor(() => {
      expect(document.querySelector('[data-bivane-host="bivane-dialog"]')).not.toBeNull();
    });

    await act(async () => {
      closeDialog();
    });

    await waitFor(() => {
      expect(document.querySelector('[data-component="dialog"]')).toBeNull();
    });
  });
});
