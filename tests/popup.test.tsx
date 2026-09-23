import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Popup } from '@/components/responsive/popup';
import { Overlay } from '@/components/ui/overlay';

/**
 * Popup 双模式行为测试（矩阵 §4 要求：h5 / pc 各一组）
 *
 * 重点不是「渲染出来了」，而是两端交互确实不同：
 *   - 容器形态：H5 贴边滑入 vs PC 一律居中
 *   - 遮罩点击：H5 默认关 vs PC 默认不关
 *   - 手势：H5 可下拉关闭 vs PC 无手势
 */

function panel(): HTMLElement {
  return screen.getByRole('dialog');
}

function overlay(): HTMLElement {
  // Overlay 的 data-slot 由自身持有（不被上层覆盖），两端都是 [data-slot="overlay"]
  return document.querySelector('[data-slot="overlay"]') as HTMLElement;
}

describe('遮罩契约（portal 逃出 [data-mode] 作用域后必须自带 mode）', () => {
  // 遮罩浓度（H5 .7 / PC .45）与动画时长（300ms / 200ms）都靠 [data-mode='pc'] 覆盖，
  // 而遮罩渲染在 portal 里、又是面板的兄弟节点，拿不到面板上的 data-mode。
  it('H5 遮罩自带 data-mode="h5"', () => {
    render(
      <Popup open forceMode="mobile">
        内容
      </Popup>,
    );

    expect(overlay()).toHaveAttribute('data-mode', 'h5');
    expect(overlay()).toHaveClass('bg-bv-overlay');
  });

  it('PC 遮罩自带 data-mode="pc"', () => {
    render(
      <Popup open forceMode="desktop">
        内容
      </Popup>,
    );

    expect(overlay()).toHaveAttribute('data-mode', 'pc');
  });

  it('外部传入 style 时不会冲掉遮罩自身的 zIndex', () => {
    // 回归：style 若在 {...props} 之前展开，props 里的原始 style 会把
    // 合并好的 zIndex / pointerEvents 整个覆盖掉。
    // style 用变量传入：契约规则只拦 JSX 内联字面量，变量即「动态值」用法。
    const externalStyle = { color: 'red' };

    render(<Overlay zIndex={5} style={externalStyle} data-testid="ov" />);

    const el = screen.getByTestId('ov');
    expect(el.getAttribute('style')).toContain('z-index');
    expect(el.getAttribute('style')).toContain('color');
    expect(el).toHaveAttribute('data-slot', 'overlay');
  });
});

beforeEach(() => {
  document.body.removeAttribute('data-bv-scroll-locked');
  document.body.style.cssText = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('h5 mode', () => {
  it('默认从底部滑入，根元素带 data-mode="h5"', () => {
    render(
      <Popup open forceMode="mobile">
        内容
      </Popup>,
    );

    expect(panel()).toHaveAttribute('data-mode', 'h5');
    expect(panel()).toHaveAttribute('data-position', 'bottom');
    expect(panel()).toHaveAttribute('data-position-resolved', 'bottom');
    expect(panel().className).toContain('bottom-0');
  });

  it('position="center" 横向按内容收缩并居中，不得再用 left-1/2 + w-auto（挤扁回归）', () => {
    render(
      <Popup open forceMode="mobile" position="center">
        内容
      </Popup>,
    );

    expect(panel()).toHaveAttribute('data-position-resolved', 'center');
    // 居中靠 auto margin，宽度靠 fit-content —— 对齐 Vant .van-popup--center
    expect(panel().className).toContain('inset-x-0');
    expect(panel().className).toContain('w-fit');
    expect(panel().className).toContain('mx-auto');
    // 这两条是上一版挤扁的成因：right 为 auto 时 shrink-to-fit 只剩半屏可用宽度
    expect(panel().className).not.toContain('left-1/2');
    expect(panel().className).not.toContain('w-auto');
    expect(panel().className).toContain('max-w-[var(--bv-popup-center-max-width)]');
    expect(panel().className).not.toContain('max-w-[90vw]');
    // 高度上限：漏掉这条 → 面板高 = 内容高，内部滚动容器拿不到约束、永不滚动
    expect(panel().className).toContain('max-h-[var(--bv-popup-max-height)]');
  });

  it('H5 的 top / bottom / center 三种形态都带高度上限', () => {
    // 回归：Vant 把 `max-height: 100%` 放在 .van-popup **基类**上，center 靠继承吃到；
    // Bivane 按 position 分支产出类名，曾只给 top/bottom 写而漏掉 center。
    for (const position of ['top', 'bottom', 'center'] as const) {
      const { unmount } = render(
        <Popup open forceMode="mobile" position={position}>
          内容
        </Popup>,
      );

      expect(panel().className).toContain('max-h-[var(--bv-popup-max-height)]');
      unmount();
    }
  });

  it('顶部圆角与拖拽指示条按矩阵默认渲染', () => {
    render(
      <Popup open forceMode="mobile">
        内容
      </Popup>,
    );

    expect(panel().className).toContain('rounded-t-[var(--bv-popup-round-radius)]');
    expect(panel().querySelector('[data-slot="popup-drag-handle"]')).not.toBeNull();
  });

  it('round={false} 时不加圆角（props 双模式一致，H5 下生效）', () => {
    render(
      <Popup open forceMode="mobile" round={false}>
        内容
      </Popup>,
    );

    expect(panel().className).toContain('rounded-none');
  });

  it('点击遮罩默认关闭', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.click(overlay());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closeOnClickOverlay={false} 时点遮罩不关闭（显式值两端一致）', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" closeOnClickOverlay={false} onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.click(overlay());

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('从拖拽指示条下拉可关闭（手势）', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    const handle = panel().querySelector('[data-bv-drag-region]');
    expect(handle).not.toBeNull();

    await act(async () => {
      fireEvent.pointerDown(handle as Element, { clientY: 100, button: 0 });
      fireEvent.pointerMove(window, { clientY: 300 });
      fireEvent.pointerUp(window, { clientY: 300 });
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('位移不足时不关闭（含速度护栏，防抖动误触）', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    const handle = panel().querySelector('[data-bv-drag-region]');

    await act(async () => {
      fireEvent.pointerDown(handle as Element, { clientY: 100, button: 0 });
      fireEvent.pointerMove(window, { clientY: 104 });
      fireEvent.pointerUp(window, { clientY: 104 });
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('在非拖拽区（内容区）按下不会起拖', async () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" onOpenChange={onOpenChange}>
        <span data-testid="body">内容</span>
      </Popup>,
    );

    await act(async () => {
      fireEvent.pointerDown(screen.getByTestId('body'), { clientY: 100, button: 0 });
      fireEvent.pointerMove(window, { clientY: 400 });
      fireEvent.pointerUp(window, { clientY: 400 });
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('按 ESC 关闭', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closeOnPressEscape={false} 时不响应 ESC', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" closeOnPressEscape={false} onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('打开时锁定背景滚动，使用 H5 的 fixed 策略', () => {
    render(
      <Popup open forceMode="mobile">
        内容
      </Popup>,
    );

    expect(document.body.getAttribute('data-bv-scroll-locked')).toBe('fixed');
  });

  it('lockScroll={false} 时不锁滚动', () => {
    render(
      <Popup open forceMode="mobile" lockScroll={false}>
        内容
      </Popup>,
    );

    expect(document.body.getAttribute('data-bv-scroll-locked')).toBeNull();
  });

  it('closeable 时渲染关闭按钮并可关闭', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="mobile" closeable onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.click(panel().querySelector('[data-slot="popup-close"]') as Element);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('pc mode', () => {
  it('position="bottom" 降级为居中模态，原始值保留在 data-position', () => {
    render(
      <Popup open forceMode="desktop">
        内容
      </Popup>,
    );

    expect(panel()).toHaveAttribute('data-mode', 'pc');
    expect(panel()).toHaveAttribute('data-position', 'bottom');
    expect(panel()).toHaveAttribute('data-position-resolved', 'center');
    expect(panel().className).toContain('left-1/2');
    expect(panel().className).toContain('max-w-[var(--bv-popup-pc-width)]');
  });

  it('不渲染 H5 的拖拽指示条（能力等价降级，不是功能缺失）', () => {
    render(
      <Popup open forceMode="desktop">
        内容
      </Popup>,
    );

    expect(panel().querySelector('[data-slot="popup-drag-handle"]')).toBeNull();
  });

  it('点击遮罩默认不关闭（矩阵 §2.1）', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="desktop" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.click(overlay());

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('closeOnClickOverlay={true} 时点遮罩关闭', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="desktop" closeOnClickOverlay onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.click(overlay());

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('按 ESC 关闭', () => {
    const onOpenChange = vi.fn();
    render(
      <Popup open forceMode="desktop" onOpenChange={onOpenChange}>
        内容
      </Popup>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('滚动锁使用 PC 的 overflow 策略', () => {
    render(
      <Popup open forceMode="desktop">
        内容
      </Popup>,
    );

    expect(document.body.getAttribute('data-bv-scroll-locked')).toBe('overflow');
  });
});

describe('双模式一致性', () => {
  it('同一组 props 在两种模式下都能渲染，不因模式改变 API', () => {
    const shared = {
      open: true,
      position: 'center' as const,
      closeable: true,
      overlay: true,
      lockScroll: false,
      safeAreaInsetBottom: false,
      className: 'x-test',
    };

    const { unmount } = render(<Popup {...shared} forceMode="mobile" />);
    expect(panel()).toHaveAttribute('data-mode', 'h5');
    unmount();

    render(
      <Popup {...shared} forceMode="desktop">
        pc 内容
      </Popup>,
    );
    expect(panel()).toHaveAttribute('data-mode', 'pc');
  });

  it('index.css 的页面节奏 token 未泄露到弹层内部（组件内部间距恒定）', () => {
    render(
      <Popup open forceMode="mobile">
        内容
      </Popup>,
    );

    // 弹层只允许引用 --bv-* 的组件级 token，不允许出现页面骨架节奏类
    expect(panel().className).not.toMatch(/py-bv-block|gap-bv-gutter|mb-bv-section/);
  });
});

describe('关闭流程', () => {
  it('duration={0} 时关闭后立即卸载节点', async () => {
    const { rerender } = render(
      <Popup open forceMode="mobile" duration={0}>
        内容
      </Popup>,
    );

    expect(screen.queryByRole('dialog')).not.toBeNull();

    rerender(
      <Popup open={false} forceMode="mobile" duration={0}>
        内容
      </Popup>,
    );

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('退场动画结束后释放滚动锁', async () => {
    const { rerender } = render(
      <Popup open forceMode="mobile" duration={0}>
        内容
      </Popup>,
    );

    expect(document.body.getAttribute('data-bv-scroll-locked')).toBe('fixed');

    rerender(
      <Popup open={false} forceMode="mobile" duration={0}>
        内容
      </Popup>,
    );

    await waitFor(() => {
      expect(document.body.getAttribute('data-bv-scroll-locked')).toBeNull();
    });
  });
});
