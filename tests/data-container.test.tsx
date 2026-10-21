import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { DataContainer } from '@/components/responsive/data-container';
import { Cell } from '@/components/ui/cell';
import { setViewport } from './setup';

/**
 * DataContainer · 加载层容器
 *
 * 核心是「加载策略与 mode 正交」：
 * - auto（默认）：PC 分页 / H5 无限滚动
 * - remote：两端都分页
 * - local：两端都无限滚动（children 传函数时按页切）
 *
 * 这正是低代码 schema 里 pageMode 字段该映射的东西。
 */

describe('DataContainer · 策略与 mode 的组合', () => {
    it('auto 策略：PC 出分页条、H5 出哨兵', () => {
        // PC
        act(() => setViewport({ width: 1280, touch: false }));
        const { unmount } = render(
            <DataContainer total={25} pageSize={10}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(document.querySelector('[data-slot="data-container"]')?.getAttribute('data-strategy')).toBe('pagination');
        expect(document.querySelector('[data-slot="table-pagination"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="data-container-sentinel"]')).toBeNull();
        unmount();

        // H5
        act(() => setViewport({ width: 375, touch: true }));
        render(
            <DataContainer total={25} pageSize={10}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(document.querySelector('[data-slot="data-container"]')?.getAttribute('data-strategy')).toBe('infinite');
        expect(document.querySelector('[data-slot="data-container-sentinel"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="table-pagination"]')).toBeNull();
    });

    it('pagination 策略：H5 也出分页条（记录详情页，手机也要一页一页翻）', () => {
        act(() => setViewport({ width: 375, touch: true }));
        render(
            <DataContainer loadStrategy="pagination" total={25} pageSize={10}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(document.querySelector('[data-slot="table-pagination"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="data-container-sentinel"]')).toBeNull();
    });

    it('infinite 策略：H5 也出哨兵（2000 条报表，手机也得滑）', () => {
        act(() => setViewport({ width: 375, touch: true }));
        render(
            <DataContainer loadStrategy="infinite" total={25} pageSize={10}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(document.querySelector('[data-slot="data-container-sentinel"]')).not.toBeNull();
        expect(document.querySelector('[data-slot="table-pagination"]')).toBeNull();
    });

    it('对内容层透明：children 渲染在容器内', () => {
        act(() => setViewport({ width: 1280, touch: false }));
        render(
            <DataContainer total={25}>
                <Cell title="行 1" value="值 1" />
            </DataContainer>,
        );
        const content = document.querySelector('[data-slot="data-container-content"]');
        expect(content?.querySelector('[data-slot="cell"]')).not.toBeNull();
    });
});

describe('DataContainer · 无限滚动', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('loading 时显示「加载中…」', () => {
        render(
            <DataContainer loading>
                <div>内容</div>
            </DataContainer>,
        );
        expect(screen.getByText('加载中…')).toBeInTheDocument();
    });

    it('finished 时显示「没有更多了」', () => {
        render(
            <DataContainer finished>
                <div>内容</div>
            </DataContainer>,
        );
        expect(screen.getByText('没有更多了')).toBeInTheDocument();
    });

    it('error 时显示错误 + 可点重试', () => {
        const onRetry = vi.fn();
        render(
            <DataContainer error onRetry={onRetry}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(screen.getByText('加载失败')).toBeInTheDocument();
        fireEvent.click(screen.getByText('重试'));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('idle 时不渲染状态区', () => {
        render(
            <DataContainer>
                <div>内容</div>
            </DataContainer>,
        );
        expect(document.querySelector('[data-slot="load-status"]')).toBeNull();
    });
});

describe('DataContainer · 分页', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('点下一页回调 onPageChange', () => {
        const onPageChange = vi.fn();
        render(
            <DataContainer total={25} pageSize={10} onPageChange={onPageChange}>
                <div>内容</div>
            </DataContainer>,
        );
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(onPageChange).toHaveBeenCalledWith(2, 10);
    });

    it('startPage=0：页码从 0 开始', () => {
        render(
            <DataContainer total={25} pageSize={10} startPage={0}>
                <div>内容</div>
            </DataContainer>,
        );
        expect(screen.getByLabelText('第 0 页')).toHaveAttribute('aria-current', 'page');
    });

    it('受控 current：外部改值驱动高亮', () => {
        function Controlled() {
            const [page, setPage] = React.useState(1);
            return (
                <>
                    <button type="button" onClick={() => setPage(3)}>
                        去第 3 页
                    </button>
                    <DataContainer total={25} pageSize={10} current={page} onPageChange={setPage}>
                        <div>内容</div>
                    </DataContainer>
                </>
            );
        }
        render(<Controlled />);
        expect(screen.getByLabelText('第 1 页')).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByText('去第 3 页'));
        expect(screen.getByLabelText('第 3 页')).toHaveAttribute('aria-current', 'page');
    });

    it('children 传函数：组件按页调用，由业务自己切数据', () => {
        const all = Array.from({ length: 25 }, (_, i) => `行 ${i + 1}`);
        function Controlled() {
            const [page, setPage] = React.useState(1);
            return (
                <DataContainer
                    total={all.length}
                    pageSize={10}
                    current={page}
                    onPageChange={setPage}
                >
                    {(currentPage: number, pageSize: number) => (
                        <ul>
                            {all
                                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                .map((name) => (
                                    <li key={name}>{name}</li>
                                ))}
                        </ul>
                    )}
                </DataContainer>
            );
        }
        render(<Controlled />);
        // 第 1 页：前 10 条
        expect(screen.getByText('行 1')).toBeInTheDocument();
        expect(screen.queryByText('行 11')).toBeNull();
        // 翻页 → 11~20
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(screen.getByText('行 11')).toBeInTheDocument();
        expect(screen.queryByText('行 1')).toBeNull();
    });
});