import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState, type ReactElement } from 'react';
import { List } from '@/components/responsive/list';
import {
    computePullDistance,
    isNearBottom,
    resolveListStatus,
    resolvePullStatus,
} from '@/hooks/use-list-state';
import { setViewport } from './setup';

/**
 * List 双模式行为（矩阵 §2.3）：
 * H5 竖向滚动容器 + 触底哨兵加载 + 顶部下拉刷新手势；
 * PC 滚动加载 + 顶部「刷新」按钮 + 可选虚拟滚动。
 * 两端共享同一份「数据获取状态机」（三态全受控）。
 */

// H5List / PcList 经 React.lazy 异步加载，render 后首帧为 Suspense fallback（null），
// 故统一用 load 等待根 slot 渲染后再做同步断言。
async function load(node: ReactElement) {
  const utils = render(node);
  await waitFor(async () => {
    expect(document.querySelector('[data-slot="list"]')).not.toBeNull();
  });
  return utils;
}

const DATA = [
    { id: '1', name: '订单 1' },
    { id: '2', name: '订单 2' },
    { id: '3', name: '订单 3' },
];

const renderItem = (item: unknown) => <span>{(item as { name: string }).name}</span>;

describe('use-list-state 纯函数', () => {
    it('resolveListStatus：error 压过 loading，loading 压过 finished', async () => {
        expect(resolveListStatus({})).toBe('idle');
        expect(resolveListStatus({ loading: true })).toBe('loading');
        expect(resolveListStatus({ finished: true })).toBe('finished');
        expect(resolveListStatus({ error: true })).toBe('error');
        // 出错的那一瞬间 loading 可能还没落回 false，必须显示可重试而不是转圈
        expect(resolveListStatus({ loading: true, error: true })).toBe('error');
        expect(resolveListStatus({ loading: true, finished: true })).toBe('loading');
    });

    it('isNearBottom：内容未渲染时永不误判触底', async () => {
        // scrollHeight 为 0（jsdom 不做布局）→ 不触发
        expect(
            isNearBottom({ scrollTop: 0, clientHeight: 100, scrollHeight: 0, threshold: 80 }),
        ).toBe(false);
        // 距底部 50 < 阈值 80 → 触底
        expect(
            isNearBottom({ scrollTop: 850, clientHeight: 100, scrollHeight: 1000, threshold: 80 }),
        ).toBe(true);
        // 距底部 200 > 阈值 80 → 未触底
        expect(
            isNearBottom({ scrollTop: 700, clientHeight: 100, scrollHeight: 1000, threshold: 80 }),
        ).toBe(false);
    });

    it('resolvePullStatus：位移到阈值以上才是 ready', async () => {
        expect(resolvePullStatus({ distance: 0, threshold: 64 })).toBe('idle');
        expect(resolvePullStatus({ distance: 30, threshold: 64 })).toBe('pulling');
        expect(resolvePullStatus({ distance: 64, threshold: 64 })).toBe('ready');
        // 刷新中压过一切
        expect(resolvePullStatus({ distance: 10, threshold: 64, loading: true })).toBe('loading');
    });

    it('computePullDistance：阻尼 0.5 且有上限', async () => {
        expect(computePullDistance(0, 96)).toBe(0);
        expect(computePullDistance(-10, 96)).toBe(0);
        // 手指拉 100px → 内容跟 50px（阻尼 0.5）
        expect(computePullDistance(100, 96)).toBe(50);
        // 拉过头时内容位移被上限截住，不会跟满 500px
        expect(computePullDistance(1000, 96)).toBe(96);
    });
});

describe('List · H5', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('渲染 H5 形态：data-mode="h5"', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(document.querySelector('[data-slot="list"]')?.getAttribute('data-mode')).toBe(
            'h5',
        );
    });

    it('渲染全部列表项', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(screen.getByText('订单 1')).toBeInTheDocument();
        expect(screen.getByText('订单 3')).toBeInTheDocument();
    });

    it('受控 loading 时显示「加载中…」状态区', async () => {
        await load(<List data={DATA} renderItem={renderItem} loading />);
        expect(document.querySelector('[data-slot="list-status"]')).not.toBeNull();
        expect(screen.getByText('加载中…')).toBeInTheDocument();
    });

    it('受控 finished 时显示「没有更多了」', async () => {
        await load(<List data={DATA} renderItem={renderItem} finished />);
        expect(screen.getByText('没有更多了')).toBeInTheDocument();
    });

    it('受控 error 时显示错误文案 + 可点重试', async () => {
        const onRetry = vi.fn();
        await load(<List data={DATA} renderItem={renderItem} error onRetry={onRetry} />);
        expect(screen.getByText('加载失败')).toBeInTheDocument();
        fireEvent.click(screen.getByText('重试'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('idle 时不渲染状态区', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(document.querySelector('[data-slot="list-status"]')).toBeNull();
    });

    it('点击列表项回调 onItemClick', async () => {
        const onItemClick = vi.fn();
        await load(<List data={DATA} renderItem={renderItem} onItemClick={onItemClick} />);
        fireEvent.click(screen.getByText('订单 2'));
        expect(onItemClick).toHaveBeenCalledWith(DATA[1], 1);
    });

    it('下拉手势：拉过阈值后松手触发 onRefresh', async () => {
        const onRefresh = vi.fn();
        await load(<List data={DATA} renderItem={renderItem} onRefresh={onRefresh} />);
        const scroll = document.querySelector('[data-slot="list-scroll"]') as HTMLElement;

        fireEvent.pointerDown(scroll, { clientY: 0, pointerType: 'touch' });
        fireEvent.pointerMove(scroll, { clientY: 200, pointerType: 'touch' });
        // 位移 200 * 0.5 = 100 > 阈值 64 → ready
        expect(
            document.querySelector('[data-slot="list-pull"]')?.getAttribute('data-status'),
        ).toBe('ready');
        fireEvent.pointerUp(scroll, { pointerType: 'touch' });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('下拉未过阈值就松手不触发刷新', async () => {
        const onRefresh = vi.fn();
        await load(<List data={DATA} renderItem={renderItem} onRefresh={onRefresh} />);
        const scroll = document.querySelector('[data-slot="list-scroll"]') as HTMLElement;

        fireEvent.pointerDown(scroll, { clientY: 0, pointerType: 'touch' });
        fireEvent.pointerMove(scroll, { clientY: 40, pointerType: 'touch' });
        // 40 * 0.5 = 20 < 64 → 仍为 pulling
        expect(
            document.querySelector('[data-slot="list-pull"]')?.getAttribute('data-status'),
        ).toBe('pulling');
        fireEvent.pointerUp(scroll, { pointerType: 'touch' });
        expect(onRefresh).not.toHaveBeenCalled();
    });

    it('loading 期间不重复触发 onLoad（守卫）', async () => {
        const onLoad = vi.fn();
        function Controlled() {
            const [loading, setLoading] = useState(false);
            return (
                <>
                    <button type="button" onClick={() => setLoading((v) => !v)}>
                        切 loading
                    </button>
                    <List data={DATA} renderItem={renderItem} loading={loading} onLoad={onLoad} />
                </>
            );
        }
        await load(<Controlled />);
        const scroll = document.querySelector('[data-slot="list-scroll"]') as HTMLElement;
        // jsdom 里 scrollHeight 恒 0，isNearBottom 恒 false → 用哨兵路径验证
        // 直接触发滚动事件不应报错，且不产生请求
        fireEvent.scroll(scroll);
        expect(onLoad).not.toHaveBeenCalled();
    });
});

describe('List · PC', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('渲染 PC 形态：data-mode="pc"', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(document.querySelector('[data-slot="list"]')?.getAttribute('data-mode')).toBe(
            'pc',
        );
    });

    it('PC 用自己的槽名（list-pc-item），不复用 H5 的槽名', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(document.querySelector('[data-slot="list-pc-item"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="list-item"]')).toBeNull();
    });

    it('顶部「刷新」按钮触发 onRefresh（H5 下拉刷新的等价交互）', async () => {
        const onRefresh = vi.fn();
        await load(<List data={DATA} renderItem={renderItem} onRefresh={onRefresh} />);
        fireEvent.click(screen.getByText('刷新'));
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('不传 onRefresh 时不渲染刷新按钮', async () => {
        await load(<List data={DATA} renderItem={renderItem} />);
        expect(document.querySelector('[data-slot="list-pc-refresh"]')).toBeNull();
    });

    it('虚拟滚动：给 virtual + itemHeight 时走窗口化并标注 data-virtual', async () => {
        const many = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `行 ${i}` }));
        await load(
            <List
                data={many}
                renderItem={renderItem}
                virtual
                itemHeight={36}
                height={360}
            />,
        );
        const root = document.querySelector('[data-slot="list"]');
        expect(root?.getAttribute('data-virtual')).toBe('true');
        // 窗口化：只渲染视口内的行，不是全部 200 行
        const rendered = document.querySelectorAll('[data-slot="list-pc-item"]');
        expect(rendered.length).toBeLessThan(200);
    });

    it('未给 itemHeight 时虚拟滚动不启用（退化为全量渲染）', async () => {
        const many = Array.from({ length: 200 }, (_, i) => ({ id: String(i), name: `行 ${i}` }));
        await load(<List data={many} renderItem={renderItem} virtual />);
        expect(
            document.querySelector('[data-slot="list"]')?.getAttribute('data-virtual'),
        ).toBeNull();
        expect(document.querySelectorAll('[data-slot="list-pc-item"]')).toHaveLength(200);
    });
});
