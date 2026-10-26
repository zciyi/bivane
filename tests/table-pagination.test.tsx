import { act, fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { Table, type TableColumn } from '@/components/responsive/table';
import {
    buildPageItems,
    clampPage,
    computePageCount,
    sliceStartIndex,
} from '@/components/ui/table-pagination';
import { setViewport } from './setup';

/**
 * Table 分页（PC 端）。
 *
 * 覆盖三组最容易用错的语义：
 * 1. local / remote 两种模式的切片行为完全不同
 * 2. startPage 的算术（后端从 0 开始 vs 从 1 开始）
 * 3. 越界夹紧（删光最后一页后当前页会失效）
 */

// PcTable 经 React.lazy 异步加载，render 后首帧为 Suspense fallback（null），
// 故统一用 load 等待根 slot 渲染后再做同步断言。
async function load(node: React.ReactElement) {
  const utils = rtlRender(node);
  await waitFor(async () => {
    expect(document.querySelector('[data-slot="table"]')).not.toBeNull();
  });
  return utils;
}

interface Row {
    id: string;
    name: string;
}

const DATA: Row[] = Array.from({ length: 25 }, (_, i) => ({
    id: String(i + 1),
    name: `行 ${i + 1}`,
}));

const COLUMNS: TableColumn[] = [{ key: 'name', title: '名称', h5Role: 'title' }];

function namesInDom(): string[] {
    // 只取 <tbody> 里的 <td>：表头 <th> 也是 table-pc-cell，会被一起选中
    return [...document.querySelectorAll('tbody [data-slot="table-pc-cell"][data-column="name"]')].map(
        (el) => el.textContent ?? '',
    );
}

describe('分页纯函数', async () => {
    it('computePageCount：向上取整，空数据也是 1 页', async () => {
        expect(computePageCount(25, 10)).toBe(3);
        expect(computePageCount(20, 10)).toBe(2);
        expect(computePageCount(21, 10)).toBe(3);
        expect(computePageCount(0, 10)).toBe(1);
        // pageSize 非法时兜底到 10，避免除零 / NaN
        expect(computePageCount(25, 0)).toBe(3);
    });

    it('clampPage：夹到 [startPage, 末页]，非法值落回起始页', async () => {
        expect(clampPage(2, 3, 1)).toBe(2);
        expect(clampPage(99, 3, 1)).toBe(3);
        expect(clampPage(0, 3, 1)).toBe(1);
        // startPage=0 时「第一页」是 0，越界夹到 2
        expect(clampPage(0, 3, 0)).toBe(0);
        expect(clampPage(99, 3, 0)).toBe(2);
        expect(clampPage(Number.NaN, 3, 1)).toBe(1);
    });

    it('sliceStartIndex：startPage=1 时第 1 页下标 0；=0 时第 0 页下标也是 0', async () => {
        expect(sliceStartIndex(1, 1, 10)).toBe(0);
        expect(sliceStartIndex(2, 1, 10)).toBe(10);
        // 后端从 0 开始：第 0 页就是第一批
        expect(sliceStartIndex(0, 0, 10)).toBe(0);
        expect(sliceStartIndex(1, 0, 10)).toBe(10);
    });

    it('buildPageItems：首尾恒显，中间省略号不可点', async () => {
        expect(buildPageItems(1, 1, 1)).toEqual([1]);
        expect(buildPageItems(1, 3, 1)).toEqual([1, 2, 3]);
        // 10 页、第 5 页：1 … 4 5 6 … 10
        expect(buildPageItems(5, 10, 1)).toEqual([
            1,
            'ellipsis-left',
            4,
            5,
            6,
            'ellipsis-right',
            10,
        ]);
        // 靠近首尾时省略号消失
        expect(buildPageItems(1, 10, 1)).toEqual([1, 2, 'ellipsis-right', 10]);
        // startPage=0 时首项是 0
        expect(buildPageItems(0, 3, 0)).toEqual([0, 1, 2]);
    });
});

describe('Table 分页 · PC', async () => {
    beforeEach(() => {
        act(() => setViewport({ width: 1280, touch: false }));
    });

    it('pagination 关闭时不渲染分页条', async () => {
        await load(<Table columns={COLUMNS} data={DATA} />);
        expect(document.querySelector('[data-slot="table-pagination"]')).toBeNull();
    });

    it('开启后渲染分页条，默认显示总数与页码按钮', async () => {
        await load(<Table columns={COLUMNS} data={DATA} pagination total={25} pageSize={10} />);
        expect(document.querySelector('[data-slot="table-pagination"]')).not.toBeNull();
        expect(screen.getByText('共 25 条')).toBeInTheDocument();
        // 25 条 / 每页 10 → 3 页
        const pages = document.querySelectorAll('[data-slot="table-pagination-page"]');
        expect(pages).toHaveLength(3);
    });

    it('showTotal=false 隐藏总条数', async () => {
        await load(
            <Table columns={COLUMNS} data={DATA} pagination total={25} showTotal={false} />,
        );
        expect(screen.queryByText('共 25 条')).toBeNull();
    });

    it('totalText 支持函数自定义', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                total={25}
                totalText={(total) => `合计 ${total} 笔`}
            />,
        );
        expect(screen.getByText('合计 25 笔')).toBeInTheDocument();
    });

    /* ---------- local vs remote ---------- */

    it('remote 模式（默认）：data 是当页数据，组件不切片', async () => {
        // 只给了 3 行（当页），total 25 → 不该把 3 行切得更碎
        await load(
            <Table
                columns={COLUMNS}
                data={DATA.slice(0, 3)}
                pagination
                total={25}
                pageSize={10}
            />,
        );
        expect(namesInDom()).toHaveLength(3);
        expect(namesInDom()[0]).toContain('行 1');
    });

    it('local 模式：data 是全量，组件按页切片', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
            />,
        );
        // 第 1 页 = 前 10 行
        expect(namesInDom()).toHaveLength(10);
        expect(namesInDom()[0]).toContain('行 1');
        expect(namesInDom()[9]).toContain('行 10');
    });

    it('local 模式点下一页真的换数据（切片生效）', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
            />,
        );
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(namesInDom()[0]).toContain('行 11');
        expect(namesInDom()).toHaveLength(10);
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(namesInDom()[0]).toContain('行 21');
        // 第 3 页只有 5 行
        expect(namesInDom()).toHaveLength(5);
    });

    /* ---------- 起始页 ---------- */

    it('startPage=0：页码从 0 开始显示，切片算术同步', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                startPage={0}
                total={25}
            />,
        );
        // 第 0 页高亮
        expect(screen.getByLabelText('第 0 页')).toHaveAttribute('aria-current', 'page');
        expect(namesInDom()[0]).toContain('行 1');
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(namesInDom()[0]).toContain('行 11');
    });

    /* ---------- 受控 / 非受控 ---------- */

    it('非受控：defaultCurrent 指定初始页', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                defaultCurrent={2}
            />,
        );
        expect(screen.getByLabelText('第 2 页')).toHaveAttribute('aria-current', 'page');
        expect(namesInDom()[0]).toContain('行 11');
    });

    it('受控 current：外部改值驱动切页', async () => {
        function Controlled() {
            const [page, setPage] = React.useState(1);
            return (
                <>
                    <button type="button" onClick={() => setPage(3)}>
                        去第 3 页
                    </button>
                    <Table
                        columns={COLUMNS}
                        data={DATA}
                        pagination
                        paginationMode="local"
                        pageSize={10}
                        current={page}
                        onPageChange={setPage}
                    />
                </>
            );
        }
        await load(<Controlled />);
        expect(namesInDom()[0]).toContain('行 1');
        fireEvent.click(screen.getByText('去第 3 页'));
        expect(namesInDom()[0]).toContain('行 21');
    });

    it('受控时点页码只通知业务，不自改页码', async () => {
        const onPageChange = vi.fn();
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                current={1}
                onPageChange={onPageChange}
            />,
        );
        fireEvent.click(screen.getByLabelText('第 3 页'));
        expect(onPageChange).toHaveBeenCalledWith(3, 10);
        // 业务没改 current → 仍停在第 1 页
        expect(namesInDom()[0]).toContain('行 1');
    });

    /* ---------- 越界 ---------- */

    it('页码越界夹紧：current 超出末页时落回末页', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                current={99}
            />,
        );
        expect(screen.getByLabelText('第 3 页')).toHaveAttribute('aria-current', 'page');
        expect(namesInDom()).toHaveLength(5);
    });

    it('total 变小导致当前页越界时自动夹回', async () => {
        function Shrink() {
            const [total, setTotal] = React.useState(25);
            return (
                <>
                    <button type="button" onClick={() => setTotal(3)}>
                        删到只剩 3 条
                    </button>
                    <Table
                        columns={COLUMNS}
                        data={DATA.slice(0, 3)}
                        pagination
                        pageSize={10}
                        total={total}
                        current={3}
                    />
                </>
            );
        }
        await load(<Shrink />);
        expect(screen.getByLabelText('第 3 页')).toHaveAttribute('aria-current', 'page');
        fireEvent.click(screen.getByText('删到只剩 3 条'));
        // 3 条 / 每页 10 → 只有 1 页，当前页夹到 1
        expect(screen.getByLabelText('第 1 页')).toHaveAttribute('aria-current', 'page');
    });

    /* ---------- 首尾禁用 ---------- */

    it('首页时「上一页」禁用，末页时「下一页」禁用', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                total={25}
            />,
        );
        expect(screen.getByLabelText('上一页')).toBeDisabled();
        expect(screen.getByLabelText('下一页')).not.toBeDisabled();

        fireEvent.click(screen.getByLabelText('下一页'));
        fireEvent.click(screen.getByLabelText('下一页'));
        expect(screen.getByLabelText('下一页')).toBeDisabled();
    });

    /* ---------- 跳页 ---------- */

    it('跳页输入：回车切到指定页', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                total={25}
            />,
        );
        const jumper = screen.getByLabelText('跳至页码');
        fireEvent.change(jumper, { target: { value: '3' } });
        fireEvent.keyDown(jumper, { key: 'Enter' });
        expect(namesInDom()[0]).toContain('行 21');
    });

    it('跳页越界值被夹紧', async () => {
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                total={25}
            />,
        );
        const jumper = screen.getByLabelText('跳至页码');
        fireEvent.change(jumper, { target: { value: '99' } });
        fireEvent.keyDown(jumper, { key: 'Enter' });
        expect(screen.getByLabelText('第 3 页')).toHaveAttribute('aria-current', 'page');
    });

    /* ---------- 每页条数 ---------- */

    it('给了 pageSizeOptions 才渲染每页条数下拉', async () => {
        const { unmount } = await load(
            <Table columns={COLUMNS} data={DATA} pagination total={25} />,
        );
        expect(screen.queryByLabelText('每页条数')).toBeNull();
        unmount();

        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                total={25}
                pageSizeOptions={[10, 20, 50]}
            />,
        );
        expect(screen.getByLabelText('每页条数')).toBeInTheDocument();
    });

    it('换每页条数回到起始页', async () => {
        const onPageSizeChange = vi.fn();
        await load(
            <Table
                columns={COLUMNS}
                data={DATA}
                pagination
                paginationMode="local"
                pageSize={10}
                total={25}
                pageSizeOptions={[10, 20]}
                onPageSizeChange={onPageSizeChange}
            />,
        );
        fireEvent.click(screen.getByLabelText('下一页')); // 到第 2 页
        expect(screen.getByLabelText('第 2 页')).toHaveAttribute('aria-current', 'page');

        fireEvent.change(screen.getByLabelText('每页条数'), { target: { value: '20' } });
        expect(onPageSizeChange).toHaveBeenCalledWith(20);
        // 回第 1 页（停在第 2 页但每页 20 会落到空区间）
        expect(screen.getByLabelText('第 1 页')).toHaveAttribute('aria-current', 'page');
    });

    /* ---------- 空数据 ---------- */

    it('空数据时总页数是 1，翻页按钮全禁用', async () => {
        await load(<Table columns={COLUMNS} data={[]} pagination total={0} />);
        expect(screen.getByText('共 0 条')).toBeInTheDocument();
        expect(screen.getByLabelText('上一页')).toBeDisabled();
        expect(screen.getByLabelText('下一页')).toBeDisabled();
    });

    /* ---------- H5 不渲染 ---------- */

    it('H5 端接受 pagination 但不渲染分页条', async () => {
        act(() => setViewport({ width: 375, touch: true }));
        await load(<Table columns={COLUMNS} data={DATA} pagination total={25} />);
        expect(document.querySelector('[data-slot="table-pagination"]')).toBeNull();
        // 卡片仍然全量渲染（分页是 PC 能力）
        expect(document.querySelectorAll('[data-slot="table-card"]')).toHaveLength(25);
    });
});