import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { Tabbar, type TabbarItem } from '@/components/responsive/tabbar';
import {
    findTabIndex,
    resolveInitialValue,
} from '@/hooks/use-tabbar-state';
import { setViewport } from './setup';

/**
 * Tabbar 双模式行为（矩阵 §2.3）：
 * H5 底部固定条（安全区、图标在上文字在下）；
 * PC 侧边导航（默认）或顶部导航（pcVariant），图标在左文字在右。
 * 两端共用同一份「当前选中哪一项」的语义（字符串 value）。
 */

const ITEMS: TabbarItem[] = [
    { value: 'home', label: '首页' },
    { value: 'order', label: '订单' },
    { value: 'me', label: '我的', disabled: true },
];

const ITEMS_WITH_BADGE: TabbarItem[] = [
    { value: 'home', label: '首页', icon: <span data-testid="i-home">H</span> },
    { value: 'order', label: '订单', icon: <span data-testid="i-order">O</span>, badge: 3 },
    { value: 'cart', label: '购物车', icon: <span data-testid="i-cart">C</span>, badge: true },
    { value: 'me', label: '我的', icon: <span data-testid="i-me">M</span>, badge: false },
];

function badgeOfItem(label: string): HTMLElement | null {
    const items = document.querySelectorAll<HTMLElement>(
        '[data-slot="tabbar-item"], [data-slot="tabbar-pc-item"]',
    );
    for (const item of items) {
        if (item.textContent?.includes(label)) return item.querySelector('[data-slot="badge"]');
    }
    return null;
}

describe('use-tabbar-state 纯函数', () => {
    it('findTabIndex：找到返回下标，找不到返回 -1', () => {
        expect(findTabIndex(ITEMS, 'order')).toBe(1);
        expect(findTabIndex(ITEMS, 'nope')).toBe(-1);
        expect(findTabIndex(ITEMS, undefined)).toBe(-1);
    });

    it('resolveInitialValue：defaultValue 对得上就用，对不上落到第一个未禁用项', () => {
        expect(resolveInitialValue(ITEMS, 'order')).toBe('order');
        expect(resolveInitialValue(ITEMS, 'nope')).toBe('home');
        expect(resolveInitialValue(ITEMS, undefined)).toBe('home');
        expect(resolveInitialValue([], undefined)).toBeUndefined();
    });
});

describe('Tabbar · H5', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('渲染底部形态：data-mode="h5"、data-variant="bottom"', () => {
        render(<Tabbar items={ITEMS} />);
        const bar = document.querySelector('[data-slot="tabbar"]');
        expect(bar?.getAttribute('data-mode')).toBe('h5');
        expect(bar?.getAttribute('data-variant')).toBe('bottom');
    });

    it('fixed 默认开启并留等高占位块', () => {
        render(<Tabbar items={ITEMS} />);
        expect(document.querySelector('[data-slot="tabbar-placeholder"]')).not.toBeNull();
    });

    it('点击切换激活项并回调 onChange', () => {
        const calls: string[] = [];
        render(
            <Tabbar
                items={ITEMS}
                onChange={(value) => {
                    calls.push(value);
                }}
            />,
        );
        fireEvent.click(screen.getByText('订单'));
        expect(calls).toEqual(['order']);
    });

    it('禁用项不响应点击', () => {
        const calls: string[] = [];
        render(
            <Tabbar
                items={ITEMS}
                onChange={(value) => {
                    calls.push(value);
                }}
            />,
        );
        fireEvent.click(screen.getByText('我的'));
        expect(calls).toEqual([]);
    });

    it('非受控时默认选中第一项，激活项带 aria-current="page"', () => {
        render(<Tabbar items={ITEMS} />);
        const active = document.querySelector('[data-slot="tabbar-item"][data-active="true"]');
        expect(active?.getAttribute('aria-current')).toBe('page');
        expect(active?.textContent).toContain('首页');
    });
});

describe('Tabbar · PC', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    /* ---------- 角标（徽标挂在图标右上角）---------- */

    it('角标渲染在图标盒内，并绝对定位挂在右上角', () => {
        render(<Tabbar items={ITEMS_WITH_BADGE} />);
        const iconBox = badgeOfItem('订单')?.closest('[data-slot="tabbar-pc-item-icon"]');
        const badge = badgeOfItem('订单');
        expect(iconBox).not.toBeNull();
        expect(badge).not.toBeNull();
        // 角标必须是图标盒的子元素（定位上下文 = 图标盒），而不是包一层 wrapper
        expect(iconBox?.contains(badge as Node)).toBe(true);
        // 绝对定位 + 外探量（不靠 Badge 的 position 档）
        const cls = badge?.className ?? '';
        expect(cls).toContain('absolute');
        expect(cls).toContain('right-[var(--bv-tabbar-badge-right)]');
        expect(cls).toContain('top-[var(--bv-tabbar-badge-top)]');
    });

    it('数字角标显示内容、红点只出圆点、badge=false 不出角标', () => {
        render(<Tabbar items={ITEMS_WITH_BADGE} />);
        expect(badgeOfItem('订单')?.textContent).toBe('3');
        expect(badgeOfItem('购物车')?.getAttribute('data-dot')).toBe('true');
        expect(badgeOfItem('首页')).toBeNull();
        expect(badgeOfItem('我的')).toBeNull();
    });

    it('默认侧边导航：data-mode="pc"、data-variant="sidebar"', () => {
        render(<Tabbar items={ITEMS} />);
        const bar = document.querySelector('[data-slot="tabbar"]');
        expect(bar?.getAttribute('data-mode')).toBe('pc');
        expect(bar?.getAttribute('data-variant')).toBe('sidebar');
    });

    it('pcVariant="top" 切到顶部导航', () => {
        render(<Tabbar items={ITEMS} pcVariant="top" />);
        expect(
            document.querySelector('[data-slot="tabbar"]')?.getAttribute('data-variant'),
        ).toBe('top');
    });

    it('PC 用自己的槽名（tabbar-pc-item），不复用 H5 的槽名', () => {
        render(<Tabbar items={ITEMS} />);
        expect(document.querySelector('[data-slot="tabbar-pc-item"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="tabbar-item"]')).toBeNull();
    });

    it('受控 value 决定激活项（对不上任何项时谁都不选中）', () => {
        function Controlled() {
            const [value, setValue] = useState<string | undefined>('order');
            return (
                <>
                    <button type="button" onClick={() => setValue('nope')}>
                        置为未知
                    </button>
                    <Tabbar items={ITEMS} value={value} onChange={setValue} />
                </>
            );
        }
        render(<Controlled />);
        expect(
            document.querySelector('[data-slot="tabbar-pc-item"][data-active="true"]')
                ?.textContent,
        ).toContain('订单');

        fireEvent.click(screen.getByText('置为未知'));
        expect(
            document.querySelector('[data-slot="tabbar-pc-item"][data-active="true"]'),
        ).toBeNull();
    });
});
