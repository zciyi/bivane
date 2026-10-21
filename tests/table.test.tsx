import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Table, type TableColumn } from '@/components/responsive/table';
import {
    compareSortValues,
    filterData,
    nextSortOrder,
    resolveRowKey,
    sortData,
} from '@/hooks/use-table-state';
import { setViewport } from './setup';

/**
 * Table 双模式行为（矩阵 §2.3）：
 * H5 卡片化列表（关键字段直出 + 展开详情）；
 * PC 标准表格（排序 / 列固定 / 列筛选 / 行选择）。
 * 两端消费同一份 columns，排序方向切换规则共享。
 */

interface Row {
    id: string;
    name: string;
    amount: number;
    status: string;
}

const DATA: Row[] = [
    { id: '1', name: '订单甲', amount: 300, status: 'paid' },
    { id: '2', name: '订单乙', amount: 100, status: 'pending' },
    { id: '3', name: '订单丙', amount: 200, status: 'paid' },
];

const COLUMNS: TableColumn[] = [
    { key: 'name', title: '名称', sortable: true, h5Role: 'title' },
    { key: 'amount', title: '金额', sortable: true, h5Role: 'meta' },
    { key: 'status', title: '状态', h5Role: 'detail', filterable: true, filters: ['paid', 'pending'] },
];

describe('use-table-state 纯函数', () => {
    it('nextSortOrder：asc → desc → 取消', () => {
        expect(nextSortOrder(undefined, 'a')).toEqual({ key: 'a', order: 'asc' });
        expect(nextSortOrder({ key: 'a', order: 'asc' }, 'a')).toEqual({ key: 'a', order: 'desc' });
        // 第三次点击取消排序
        expect(nextSortOrder({ key: 'a', order: 'desc' }, 'a')).toBeUndefined();
        // 换一列 → 重新从 asc 开始
        expect(nextSortOrder({ key: 'a', order: 'desc' }, 'b')).toEqual({
            key: 'b',
            order: 'asc',
        });
    });

    it('compareSortValues：数字按数值比，混合按字符串比', () => {
        expect(compareSortValues(1, 2)).toBeLessThan(0);
        expect(compareSortValues(2, 1)).toBeGreaterThan(0);
        expect(compareSortValues(1, 1)).toBe(0);
        expect(compareSortValues('a', 'b')).toBeLessThan(0);
    });

    it('sortData：按列排序且不改写传入的 data 引用', () => {
        const source = [...DATA];
        const sorted = sortData(source, COLUMNS, { key: 'amount', order: 'asc' });
        expect((sorted[0] as Row).amount).toBe(100);
        expect((sorted[2] as Row).amount).toBe(300);
        // 降序
        const desc = sortData(source, COLUMNS, { key: 'amount', order: 'desc' });
        expect((desc[0] as Row).amount).toBe(300);
        // 原数组顺序没被就地改写
        expect(source[0].amount).toBe(300);
    });

    it('sortData：不可排序列不参与排序', () => {
        const sorted = sortData(DATA, COLUMNS, { key: 'status', order: 'asc' });
        expect(sorted[0]).toBe(DATA[0]);
    });

    it('filterData：只按有筛选值的列过滤', () => {
        const filtered = filterData(DATA, COLUMNS, { status: ['paid'] });
        expect(filtered).toHaveLength(2);
        // 未筛的列不参与
        expect(filterData(DATA, COLUMNS, {})).toHaveLength(3);
    });

    it('resolveRowKey：优先 id，其次下标', () => {
        expect(resolveRowKey({ id: 'x' }, 3)).toBe('x');
        expect(resolveRowKey({ name: 'y' }, 3)).toBe('3');
    });
});

describe('Table · H5', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 375, touch: true }));
    });

    it('渲染 H5 形态：卡片而非表格', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        expect(document.querySelector('[data-slot="table"]')?.getAttribute('data-mode')).toBe(
            'h5',
        );
        expect(document.querySelector('[data-slot="table-card"]')).not.toBeNull();
        // H5 不渲染真表格
        expect(document.querySelector('table')).toBeNull();
    });

    it('title 角色直出、detail 角色收进展开区', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        const card = document.querySelector('[data-slot="table-card"]') as HTMLElement;
        // 标题区
        expect(card.querySelector('[data-slot="table-card-title"]')?.textContent).toContain(
            '订单甲',
        );
        // detail 字段（状态）在折叠时不可见
        expect(card.querySelector('[data-slot="table-card-detail"]')).toBeNull();
        // 展开后可见
        fireEvent.click(screen.getAllByText('详情')[0]);
        expect(
            (card.querySelector('[data-slot="table-card-detail"]') as HTMLElement).textContent,
        ).toContain('paid');
    });

    it('meta 角色直出在卡片主体（不需展开）', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        const card = document.querySelector('[data-slot="table-card"]') as HTMLElement;
        expect(card.querySelector('[data-slot="table-card-meta"]')?.textContent).toContain('300');
    });

    it('空数据显示空态文案', () => {
        render(<Table columns={COLUMNS} data={[]} emptyText="没有订单" />);
        expect(screen.getByText('没有订单')).toBeInTheDocument();
    });

    it('字段标签可点排序（与 PC 同一套方向规则）', () => {
        const onSortChange = vi.fn();
        render(
            <Table
                columns={COLUMNS}
                data={DATA}
                defaultSort={{ key: 'amount', order: 'asc' }}
                onSortChange={onSortChange}
            />,
        );
        // 排序入口在 meta 区的字段标签上（PC 是点表头），用槽名定位第一张卡片的按钮
        const sortButton = document.querySelector(
            '[data-slot="table-card"] [data-slot="table-card-sort-button"]',
        ) as HTMLElement;
        expect(sortButton.textContent).toContain('金额');
        // 第一次点已排 asc 的列 → desc
        fireEvent.click(sortButton);
        expect(onSortChange).toHaveBeenCalledWith({ key: 'amount', order: 'desc' });
    });

    it('同一字段名在一张卡里只出现一次（标签即排序入口，不另起排序条）', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        const card = document.querySelector('[data-slot="table-card"]') as HTMLElement;
        // 「金额」是 meta 区的字段（标签 + 值），在整张卡里只该出现一次
        const occurrences = (card.textContent?.match(/金额/g) ?? []).length;
        expect(occurrences).toBe(1);
        // 没有独立的排序条容器
        expect(card.querySelector('[data-slot="table-card-sort"]')).toBeNull();
    });
});

describe('Table · PC', () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('渲染 PC 形态：真表格 + 表头', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        expect(document.querySelector('[data-slot="table"]')?.getAttribute('data-mode')).toBe(
            'pc',
        );
        expect(document.querySelector('table')).not.toBeNull();
        expect(document.querySelectorAll('[data-slot="table-pc-head"] th').length).toBe(3);
    });

    it('点表头排序：asc → desc → 取消，aria-sort 同步', () => {
        function Controlled() {
            // null = 受控且当前无排序（第三态），与 undefined（非受控）区分
            const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(
                null,
            );
            return <Table columns={COLUMNS} data={DATA} sort={sort} onSortChange={setSort} />;
        }
        render(<Controlled />);
        const amountTh = document.querySelector(
            '[data-slot="table-pc-cell"][data-column="amount"]',
        ) as HTMLElement;
        const sortButton = amountTh.querySelector(
            '[data-slot="table-pc-sort"]',
        ) as HTMLElement;

        fireEvent.click(sortButton);
        expect(amountTh.getAttribute('aria-sort')).toBe('ascending');
        fireEvent.click(sortButton);
        expect(amountTh.getAttribute('aria-sort')).toBe('descending');
        // 第三次点击取消
        fireEvent.click(sortButton);
        expect(amountTh.getAttribute('aria-sort')).toBeNull();
    });

    it('排序真的改变行顺序', () => {
        render(<Table columns={COLUMNS} data={DATA} defaultSort={{ key: 'amount', order: 'asc' }} />);
        const firstRow = document.querySelector('[data-slot="table-pc-row"]') as HTMLElement;
        expect(firstRow.textContent).toContain('订单乙');
    });

    it('列筛选：选中筛选项后只留匹配行', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        const statusTh = document.querySelector(
            '[data-slot="table-pc-cell"][data-column="status"]',
        ) as HTMLElement;
        fireEvent.click(
            statusTh.querySelector('[data-slot="table-pc-filter-trigger"]') as HTMLElement,
        );
        const panel = document.querySelector('[data-slot="table-pc-filter-panel"]');
        expect(panel).not.toBeNull();

        // 筛选项在面板内；表格单元格里也有 'paid' 字样，必须限定在面板内找
        const paidOption = panel?.querySelector(
            '[data-slot="table-pc-filter-option"]',
        ) as HTMLElement;
        expect(paidOption.textContent).toContain('paid');
        fireEvent.click(paidOption.querySelector('input') as HTMLElement);
        expect(document.querySelectorAll('[data-slot="table-pc-row"]')).toHaveLength(2);
    });

    it('行选择：行首 checkbox 切换选中，全选按钮同步', () => {
        const onSelectionChange = vi.fn();
        render(
            <Table columns={COLUMNS} data={DATA} onSelectionChange={onSelectionChange} />,
        );
        const selectButtons = document.querySelectorAll(
            '[data-slot="table-pc-row"] [role="checkbox"]',
        );
        fireEvent.click(selectButtons[0] as HTMLElement);
        expect(onSelectionChange).toHaveBeenCalledWith(['1']);

        // 全选
        const allButton = document.querySelector(
            'thead [role="checkbox"]',
        ) as HTMLElement;
        fireEvent.click(allButton);
        expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
    });

    it('未传 onSelectionChange 时不渲染选择列', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        expect(document.querySelector('[role="checkbox"]')).toBeNull();
    });

    it('列固定：fixed 列走 position: sticky', () => {
        const fixedColumns: TableColumn[] = [
            { key: 'name', title: '名称', fixed: 'left', width: 120 },
            { key: 'amount', title: '金额' },
        ];
        render(<Table columns={fixedColumns} data={DATA} />);
        const nameTh = document.querySelector(
            '[data-slot="table-pc-cell"][data-column="name"]',
        ) as HTMLElement;
        expect(nameTh.style.position).toBe('sticky');
        expect(nameTh.style.left).toBe('0px');
    });

    it('PC 不渲染 H5 的卡片槽名', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        expect(document.querySelector('[data-slot="table-card"]')).toBeNull();
    });

    it('PC 单元格只渲染值（表头就是标签，不重复渲染）', () => {
        render(<Table columns={COLUMNS} data={DATA} />);
        const firstCell = document.querySelector(
            '[data-slot="table-pc-row"] [data-slot="table-pc-cell"]',
        ) as HTMLElement;
        // 单元格里没有「名称」这个标签（它在表头里）
        expect(firstCell.querySelector('[data-slot="table-pc-label"]')).toBeNull();
        expect(firstCell.textContent).not.toContain('名称');
        // 值在
        expect(firstCell.textContent).toContain('订单甲');
    });
});
