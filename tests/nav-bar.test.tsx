import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NavBar } from '@/components/responsive/nav-bar';
import { setViewport } from './setup';

/**
 * NavBar 双模式行为（矩阵 §2.3）：
 * H5 返回箭头 + 标题**居中** + 右侧动作；PC 标题**左对齐** + 操作区右对齐。
 * 两端共用同一份层级回调（onClickLeft / onClickRight）。
 */

function centerSlot(): HTMLElement | null {
    return document.querySelector('[data-slot="nav-bar-center"]');
}

describe('NavBar · H5', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('根节点带 data-mode="h5"，标题在中间格里居中', () => {
        render(<NavBar title="详情" />);
        expect(
            document.querySelector('[data-slot="nav-bar"]')?.getAttribute('data-mode'),
        ).toBe('h5');
        expect(centerSlot()?.className).toContain('text-center');
        expect(screen.getByText('详情')).toBeInTheDocument();
    });

    it('leftArrow 默认不显示（对齐 Vant），给了才渲染返回箭头', () => {
        const { rerender } = render(<NavBar title="详情" />);
        expect(document.querySelector('[data-slot="nav-bar-back"]')).toBeNull();

        rerender(<NavBar title="详情" leftArrow />);
        expect(document.querySelector('[data-slot="nav-bar-back"]')).not.toBeNull();
    });

    it('点击返回箭头触发 onClickLeft', () => {
        let clicked = 0;
        render(<NavBar title="详情" leftArrow onClickLeft={() => (clicked += 1)} />);
        fireEvent.click(screen.getByLabelText('返回'));
        expect(clicked).toBe(1);
    });

    it('fixed 默认开启并留等高占位块', () => {
        const { rerender } = render(<NavBar title="详情" />);
        expect(document.querySelector('[data-slot="nav-bar-placeholder"]')).not.toBeNull();

        rerender(<NavBar title="详情" fixed={false} />);
        expect(document.querySelector('[data-slot="nav-bar-placeholder"]')).toBeNull();
    });

    it('右侧文字点击触发 onClickRight', () => {
        let clicked = 0;
        render(<NavBar title="详情" rightText="操作" onClickRight={() => (clicked += 1)} />);
        fireEvent.click(screen.getByText('操作'));
        expect(clicked).toBe(1);
    });
});

describe('NavBar · PC', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('根节点带 data-mode="pc"，标题左对齐', () => {
        render(<NavBar title="详情" />);
        expect(
            document.querySelector('[data-slot="nav-bar"]')?.getAttribute('data-mode'),
        ).toBe('pc');
        expect(centerSlot()?.className).toContain('text-left');
        expect(centerSlot()?.className).not.toContain('text-center');
    });

    it('右侧操作区右对齐', () => {
        render(<NavBar title="详情" rightText="操作" />);
        const right = document.querySelector('[data-slot="nav-bar-right"]');
        expect(right?.className).toContain('justify-end');
    });

    it('ariaLabel 作为导航地标的名字', () => {
        render(<NavBar ariaLabel="主导航" />);
        expect(screen.getByLabelText('主导航')).toBeInTheDocument();
    });
});
