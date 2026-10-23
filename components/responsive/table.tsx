import * as React from 'react';
import { H5Table } from '@/components/h5/table';
import { PcTable } from '@/components/pc/table';
import type { TableViewProps } from '@/components/ui/table-parts';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import {
    useTableState,
    type SortState,
    type TableColumn,
} from '@/hooks/use-table-state';
import type { PaginationMode } from '@/components/ui/table-pagination';

/**
 * Bivane Table · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * ┌ H5 ── 卡片化列表：关键字段直出，其余字段收进「展开详情」
 * └ PC ── 标准表格：排序 / 列固定 / 列筛选 / 行选择
 *
 * 为什么是模式 C 而不是 B：
 *   两端连「一行数据长什么样」都对不上 —— H5 是一张卡片（标题 + 字段竖排 + 展开），
 *   PC 是一行表格（同一行内多列并排、有表头）。
 *   这不是「同一个 primitive 换壳」能覆盖的：卡片没有列的概念，
 *   表格没有「展开详情」的概念。强行换壳会得到「一张横向排开的卡片」。
 *
 * 状态归属：排序 / 列筛选 / 行选中三组状态**全在分发层**，
 * 两端实现都是受控展示层，因此双模式 props 天然一致（契约第 9 条）。
 * 理由与 List 相同：这些状态都不是「某个模式下才有」的概念 ——
 * 排序在 H5 是点字段标签、在 PC 是点表头，但**排出来的顺序必须一样**，
 * 状态若分散到两端会分叉。
 *
 * 列定义（columns）由业务给，两端消费同一份；h5Role 字段只影响 H5 的呈现。
 */

export type { TableColumn };
export type { SortState };

export interface TableProps {
    /** 列定义 */
    columns: readonly TableColumn[];
    /** 数据 */
    data: readonly unknown[];
    /**
     * 受控排序。
     *
     * `null` = 受控且当前无排序（第三态）；`undefined` = 非受控。
     * 两者必须区分 —— 否则受控方无法「取消排序」。
     */
    sort?: SortState | null;
    /** 非受控初始排序 */
    defaultSort?: SortState;
    /** 排序变化（取消排序时传 null） */
    onSortChange?: (sort: SortState | null) => void;
    /** 受控列筛选 */
    filters?: Readonly<Record<string, readonly string[]>>;
    /** 非受控初始列筛选 */
    defaultFilters?: Readonly<Record<string, readonly string[]>>;
    /** 列筛选变化 */
    onFilterChange?: (filters: Record<string, readonly string[]>) => void;
    /** 受控选中行 key */
    selectedKeys?: readonly string[];
    /** 非受控初始选中行 key */
    defaultSelectedKeys?: readonly string[];
    /** 选中行变化 */
    onSelectionChange?: (keys: string[]) => void;
    /** 点击某行 */
    onRowClick?: (row: unknown, index: number) => void;
    /** 是否启用分页（PC 端渲染分页条；H5 忽略） */
    pagination?: boolean;
    /** 受控当前页 */
    current?: number;
    /** 非受控初始页码，默认起始页 */
    defaultCurrent?: number;
    /** 每页条数，默认 10 */
    pageSize?: number;
    /** 总条数；local 模式不给则用筛选后行数 */
    total?: number;
    /** 页码起始值，默认 1（后端从 0 开始时传 0） */
    startPage?: number;
    /**
     * 分页模式，默认 `remote`：
     * - `remote`：data 是当页数据，组件不切片（数据来自接口时的常态）
     * - `local`：data 是全量，组件按页切片
     */
    paginationMode?: PaginationMode;
    /** 是否显示总条数，默认 true */
    showTotal?: boolean;
    /** 总条数文案；传函数可自定义 */
    totalText?: React.ReactNode | ((total: number) => React.ReactNode);
    /** 切页回调 */
    onPageChange?: (page: number, pageSize: number) => void;
    /** 换每页条数回调 */
    onPageSizeChange?: (pageSize: number) => void;
    /** 每页条数选项；给了就渲染下拉选择器 */
    pageSizeOptions?: number[];
    /** 空数据文案，默认「暂无数据」 */
    emptyText?: React.ReactNode;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

export const Table = React.forwardRef<HTMLDivElement, TableProps>(function Table(
    {
        columns,
        data,
        sort,
        defaultSort,
        onSortChange,
        filters,
        defaultFilters,
        onFilterChange,
        selectedKeys,
        defaultSelectedKeys,
        onSelectionChange,
        onRowClick,
        pagination = false,
        current,
        defaultCurrent,
        pageSize,
        total,
        startPage = 1,
        paginationMode = 'remote',
        showTotal = true,
        totalText,
        onPageChange,
        onPageSizeChange,
        pageSizeOptions,
        emptyText = '暂无数据',
        className,
        forceMode,
    },
    ref,
) {
    const mode = useDeviceMode(forceMode);
    const state = useTableState({
        columns,
        data,
        sort,
        defaultSort,
        onSortChange,
        filters,
        defaultFilters,
        onFilterChange,
        selectedKeys,
        defaultSelectedKeys,
        onSelectionChange,
        pagination,
        paginationCurrent: current,
        defaultPaginationPage: defaultCurrent,
        pageSize,
        paginationTotal: total,
        startPage,
        paginationMode,
        onPageChange,
        onPageSizeChange,
    });

    const viewProps: TableViewProps = {
        mode,
        columns,
        rows: state.rows,
        sort: state.sort,
        onSort: state.toggleSort,
        canSort: state.canSort,
        filters: state.filters,
        onToggleFilter: state.toggleFilter,
        isFiltered: state.isFiltered,
        selectedKeys: state.selectedKeys,
        // 传了 onSelectionChange 才给选择回调：不给就不渲染选择控件
        onToggleRow: onSelectionChange ? state.toggleRow : undefined,
        isRowSelected: state.isRowSelected,
        allSelected: state.allSelected,
        onToggleAll: onSelectionChange ? state.toggleAll : undefined,
        pagination,
        page: state.page,
        paginationMode,
        showTotal,
        totalText,
        onPageChange,
        onPageSizeChange,
        pageSizeOptions,
        onRowClick,
        emptyText,
        className,
    };

    return mode === 'mobile' ? (
        <H5Table ref={ref} {...viewProps} />
    ) : (
        <PcTable ref={ref} {...viewProps} />
    );
});
