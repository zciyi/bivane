import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { Tab, Tabs } from '@/components/responsive/tabs';
import {
    clampIndex,
    firstEnabledIndex,
    lastEnabledIndex,
    nextEnabledIndex,
} from '@/hooks/use-tabs-state';
import { setViewport } from './setup';

/**
 * Tabs 双模式行为（矩阵 §2.3）：
 * H5 标签条可横滑（激活项滚入视野）、内容区手势横滑；
 * PC 标签条不滑动、键盘 ←/→ 切换、下划线指示器。
 * 两端共用同一份激活值模型（下标），因此 props 天然一致。
 */

/* ------------------------------------------------------------------ *
 * 纯函数
 * ------------------------------------------------------------------ */

describe('use-tabs-state 纯函数', () => {
    it('clampIndex：越界夹紧、非数归零、无标签归零', () => {
        expect(clampIndex(1, 3)).toBe(1);
        expect(clampIndex(-2, 3)).toBe(0);
        expect(clampIndex(9, 3)).toBe(2);
        expect(clampIndex(1.7, 3)).toBe(1);
        expect(clampIndex(Number.NaN, 3)).toBe(0);
        expect(clampIndex(0, 0)).toBe(0);
    });

    it('nextEnabledIndex：跳过禁用项、撞到头尾回绕、全禁用时原地不动', () => {
        const none = [false, false, false];
        expect(nextEnabledIndex(0, 3, 1, none)).toBe(1);
        expect(nextEnabledIndex(2, 3, 1, none)).toBe(0);
        expect(nextEnabledIndex(0, 3, -1, none)).toBe(2);
        expect(nextEnabledIndex(0, 3, 1, [false, true, false])).toBe(2);
        // 后面的项全禁用时回绕到唯一可用的自己
        expect(nextEnabledIndex(0, 3, 1, [false, true, true])).toBe(0);
        expect(nextEnabledIndex(0, 2, 1, [true, true])).toBe(0);
    });

    it('firstEnabledIndex / lastEnabledIndex', () => {
        expect(firstEnabledIndex([true, false, false])).toBe(1);
        expect(lastEnabledIndex([true, false, false])).toBe(2);
        expect(firstEnabledIndex([true, true])).toBe(-1);
        expect(lastEnabledIndex([true, true])).toBe(-1);
    });
});

/* ------------------------------------------------------------------ *
 * 公共行为
 * ------------------------------------------------------------------ */

describe('Tabs · 公共', () => {
    it('组合式 children：标签条与内容区都从 <Tab> 派生', () => {
        render(
            <Tabs>
                <Tab title="标签一">内容一</Tab>
                <Tab title="标签二">内容二</Tab>
            </Tabs>,
        );
        expect(screen.getAllByRole('tab')).toHaveLength(2);
        expect(screen.getByText('内容一')).toBeInTheDocument();
        expect(screen.getByText('内容二')).toBeInTheDocument();
    });

    it('Fragment 包裹的 Tab 也会被摊平收集', () => {
        render(
            <Tabs>
                <>
                    <Tab title="A">甲</Tab>
                    <Tab title="B">乙</Tab>
                </>
            </Tabs>,
        );
        expect(screen.getAllByRole('tab')).toHaveLength(2);
    });

    it('非 Tab 的 children 原样保留在内容区之后', () => {
        render(
            <Tabs>
                <Tab title="A">甲</Tab>
                <p>额外说明</p>
            </Tabs>,
        );
        expect(screen.getByText('额外说明')).toBeInTheDocument();
    });

    it('默认激活第一项；受控 value 优先于内部状态', () => {
        const { rerender } = render(
            <Tabs>
                <Tab title="A">甲</Tab>
                <Tab title="B">乙</Tab>
            </Tabs>,
        );
        expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

        rerender(
            <Tabs value={1}>
                <Tab title="A">甲</Tab>
                <Tab title="B">乙</Tab>
            </Tabs>,
        );
        expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('点击标签切换并回调 onChange（受控时由外部决定）', () => {
        const calls: number[] = [];
        render(
            <Tabs
                onChange={(index) => {
                    calls.push(index);
                }}
            >
                <Tab title="A">甲</Tab>
                <Tab title="B">乙</Tab>
            </Tabs>,
        );
        fireEvent.click(screen.getAllByRole('tab')[1]);
        expect(calls).toEqual([1]);
    });

    it('受控模式下外部改 value 才切页（内部不偷偷改）', () => {
        function Controlled() {
            const [value, setValue] = useState(0);
            return (
                <>
                    <button type="button" onClick={() => setValue(1)}>
                        切到第二项
                    </button>
                    <Tabs value={value} onChange={setValue}>
                        <Tab title="A">甲</Tab>
                        <Tab title="B">乙</Tab>
                    </Tabs>
                </>
            );
        }
        render(<Controlled />);
        fireEvent.click(screen.getByText('切到第二项'));
        expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('禁用标签不可点，也不会被键盘选中', () => {
        const calls: number[] = [];
        render(
            <Tabs
                onChange={(index) => {
                    calls.push(index);
                }}
            >
                <Tab title="A">甲</Tab>
                <Tab title="B" disabled>
                    乙
                </Tab>
            </Tabs>,
        );
        fireEvent.click(screen.getAllByRole('tab')[1]);
        expect(calls).toEqual([]);
    });

    it('type=card 不渲染下划线指示器；type=line 渲染', () => {
        const { rerender } = render(
            <Tabs>
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        expect(document.querySelector('[data-slot="tabs-line"]')).not.toBeNull();

        rerender(
            <Tabs type="card">
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        expect(document.querySelector('[data-slot="tabs-line"]')).toBeNull();
    });
});

/* ------------------------------------------------------------------ *
 * H5
 * ------------------------------------------------------------------ */

describe('Tabs · H5', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('根节点带 data-mode="h5"，标签条可横滑', () => {
        render(
            <Tabs>
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        const root = document.querySelector('[data-slot="tabs"]');
        expect(root?.getAttribute('data-mode')).toBe('h5');
        const nav = document.querySelector('[data-slot="tabs-nav"]');
        expect(nav?.className).toContain('overflow-x-auto');
    });

    it('内容区在 swipeable 时才接管横向手势（touch-pan-y）', () => {
        const { rerender } = render(
            <Tabs>
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        const content = document.querySelector('[data-slot="tabs-content"]');
        expect(content?.className).not.toContain('touch-pan-y');

        rerender(
            <Tabs swipeable>
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        expect(
            document.querySelector('[data-slot="tabs-content"]')?.className,
        ).toContain('touch-pan-y');
    });
});

/* ------------------------------------------------------------------ *
 * PC
 * ------------------------------------------------------------------ */

describe('Tabs · PC', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('根节点带 data-mode="pc"，标签条不横滑', () => {
        render(
            <Tabs>
                <Tab title="A">甲</Tab>
            </Tabs>,
        );
        const root = document.querySelector('[data-slot="tabs"]');
        expect(root?.getAttribute('data-mode')).toBe('pc');
        const nav = document.querySelector('[data-slot="tabs-nav"]');
        expect(nav?.className).not.toContain('overflow-x-auto');
    });

    it('←/→ 切换激活项，Home/End 跳到首尾', () => {
        const calls: number[] = [];
        render(
            <Tabs
                onChange={(index) => {
                    calls.push(index);
                }}
            >
                <Tab title="A">甲</Tab>
                <Tab title="B">乙</Tab>
                <Tab title="C">丙</Tab>
            </Tabs>,
        );
        const tabs = screen.getAllByRole('tab');

        // → 到第二项（内部状态随之前进）
        fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
        expect(calls).toEqual([1]);

        // ← 回到第一项（回绕：再往左就是最后一项，但先按普通路径断言）
        fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
        expect(calls).toEqual([1, 0]);

        fireEvent.keyDown(tabs[0], { key: 'End' });
        expect(calls).toEqual([1, 0, 2]);

        fireEvent.keyDown(tabs[0], { key: 'Home' });
        expect(calls).toEqual([1, 0, 2, 0]);
    });

    it('键盘切换会跳过禁用项', () => {
        const calls: number[] = [];
        render(
            <Tabs
                onChange={(index) => {
                    calls.push(index);
                }}
            >
                <Tab title="A">甲</Tab>
                <Tab title="B" disabled>
                    乙
                </Tab>
                <Tab title="C">丙</Tab>
            </Tabs>,
        );
        fireEvent.keyDown(screen.getAllByRole('tab')[0], { key: 'ArrowRight' });
        expect(calls).toEqual([2]);
    });

    it('下划线指示器存在且随激活项移动', () => {
        render(
            <Tabs>
                <Tab title="A">甲</Tab>
                <Tab title="B">乙</Tab>
            </Tabs>,
        );
        const line = document.querySelector<HTMLElement>('[data-slot="tabs-line"]');
        expect(line).not.toBeNull();
        // jsdom 无布局，指示器停在 0 位；真实位置由 measureActiveTab 计算
        expect(line?.style.width).toBe('40px');
    });
});
