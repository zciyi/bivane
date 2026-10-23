import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { DeviceMode } from '@/hooks/use-device-mode';
import type { SortState, TableColumn } from '@/hooks/use-table-state';
import type { PaginationMode } from '@/components/ui/table-pagination';

/**
 * Bivane Table · 共用零件
 *
 * Table 是**模式 C**（H5 卡片化列表 / PC 标准表格），
 * 两份实现分处 components/h5/ 与 components/pc/，但「一个字段长什么样」
 * 「排序指示器长什么样」「行选中态长什么样」是同一份东西，收在这里复用。
 *
 * 跨模式共用零件的**外壳差异必须走 JS 分支，不能用 `bv-h5:` / `bv-pc:` 变体**
 * （契约 17）。所以这里用 `tableCellClass(mode, …)` 纯函数出类名。
 *
 * 槽名按「模式 + 角色」区分（H5 `table-card-*` / PC `table-pc-*`），
 * 避免两套实现的样式互相串（契约第 14 条）。
 */

/** 两份实现共享的视图契约 */
export interface TableViewProps {
    /** 已解析的模式 */
    mode: DeviceMode;
    /** 列定义 */
    columns: readonly TableColumn[];
    /** 已套用筛选与排序的数据 */
    rows: readonly unknown[];
    /** 与 rows 对应的稳定行标识，由共享状态层提供 */
    rowKeys: readonly string[];
    /** 当前排序 */
    sort: SortState | undefined;
    /** 点击列头 / 字段标签切换排序 */
    onSort: (key: string) => void;
    /** 该列是否可排序 */
    canSort: (key: string) => boolean;
    /** 当前列筛选值 */
    filters: Readonly<Record<string, readonly string[]>>;
    /** 切换列筛选项 */
    onToggleFilter: (columnKey: string, value: string) => void;
    /** 该列是否处于筛选态 */
    isFiltered: (columnKey: string) => boolean;
    /** 选中行 key */
    selectedKeys: readonly string[];
    /** 切换行选中（不传则不渲染选择控件） */
    onToggleRow?: (key: string) => void;
    /** 是否全选 */
    allSelected: boolean;
    /** 全选 / 全不选（不传则不渲染全选控件） */
    onToggleAll?: () => void;
    /** 某行是否选中 */
    isRowSelected: (key: string) => boolean;
    /** 是否启用分页（PC 渲染分页条；H5 忽略） */
    pagination: boolean;
    /** 分页状态 */
    page: {
        current: number;
        pageCount: number;
        pageSize: number;
        startPage: number;
        total: number;
        setPage: (page: number) => void;
        setPageSize: (pageSize: number) => void;
    };
    /** 分页模式（PC 分页条上标 data-mode） */
    paginationMode: PaginationMode;
    /** 是否显示总条数 */
    showTotal: boolean;
    /** 总条数文案 */
    totalText?: React.ReactNode | ((total: number) => React.ReactNode);
    /** 切页回调（分页条专用） */
    onPageChange?: (page: number, pageSize: number) => void;
    /** 换每页条数回调 */
    onPageSizeChange?: (pageSize: number) => void;
    /** 每页条数选项 */
    pageSizeOptions?: number[];
    /** 点击某行 */
    onRowClick?: (row: unknown, index: number) => void;
    /** 空数据文案 */
    emptyText: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

/** 各模式下的槽名前缀 */
export function tableSlotPrefix(mode: DeviceMode): 'table-card' | 'table-pc' {
    return mode === 'mobile' ? 'table-card' : 'table-pc';
}

/** 单元格的对齐类（两端共用同一套对齐语义） */
export function tableAlignClass(align: TableColumn['align']): string {
    if (align === 'center') return 'text-center justify-center';
    if (align === 'right') return 'text-right justify-end';
    return 'text-left justify-start';
}

/**
 * 字段单元格的类名（纯函数）。
 *
 * H5：标签在上、值在下（竖排），或同一行（横排）—— 竖排更适合窄屏。
 * PC：单行内标签在左、值在右。
 */
export function tableCellClass(mode: DeviceMode, align: TableColumn['align']): string {
    const base = cn(
        'flex min-w-0 items-center gap-[var(--bv-table-cell-gap)]',
        'text-bv-sm leading-[var(--bv-table-cell-line-height)]',
    );

    if (mode === 'mobile') {
        return cn(
            base,
            'flex-col items-stretch gap-[var(--bv-table-card-field-gap)]',
            align === 'center' && 'text-center items-center',
            align === 'right' && 'text-right items-end',
        );
    }

    return cn(base, tableAlignClass(align));
}

/** 字段标签的类名（仅 H5 卡片用；PC 的标签在表头，不进单元格） */
export function tableLabelClass(mode: DeviceMode): string {
    return mode === 'mobile'
        ? 'text-bv-xs leading-[var(--bv-table-label-line-height)] text-bv-text-3'
        : 'w-[var(--bv-table-pc-label-width)] shrink-0 text-bv-text-3';
}

/** 字段值的类名 */
export function tableValueClass(mode: DeviceMode): string {
    return mode === 'mobile'
        ? 'min-w-0 break-words text-bv-md leading-[var(--bv-table-value-line-height)] text-bv-text'
        : 'min-w-0 flex-1 break-words text-bv-md leading-[var(--bv-table-value-line-height)] text-bv-text';
}

export interface TableSortIndicatorProps {
    /** 当前排序列的 key（不等于本列则不显示指示器） */
    sort?: SortState;
    /** 本列的 key */
    columnKey: string;
    /**
     * 未排序时也渲染一个淡箭头（提示「这一列可点排序」）。
     *
     * 触屏没有 hover，无法靠悬停态表达可点性；
     * 若未排序时什么都不显示，用户根本不知道这个标签能点。
     */
    showHint?: boolean;
}

/**
 * 排序指示器。
 *
 * 三态：未排序（淡箭头提示）/ 升序（arrow-up）/ 降序（arrow-down）。
 * 用箭头而不是 A-Z 字母，触屏与窄列里更易辨识。
 */
export function TableSortIndicator({
    sort,
    columnKey,
    showHint = false,
}: TableSortIndicatorProps) {
    if (!sort || sort.key !== columnKey) {
        if (!showHint) return null;
        return (
            <span
                data-slot="table-sort-hint"
                aria-hidden="true"
                className="ml-[var(--bv-table-sort-gap)] inline-flex shrink-0 text-[length:var(--bv-table-sort-icon-size)] text-bv-text-3 opacity-50"
            >
                <Icon name="arrow-down" />
            </span>
        );
    }
    return (
        <span
            data-slot="table-sort-indicator"
            data-order={sort.order}
            aria-hidden="true"
            className="ml-[var(--bv-table-sort-gap)] inline-flex shrink-0 text-[length:var(--bv-table-sort-icon-size)] text-bv-primary"
        >
            <Icon name={sort.order === 'asc' ? 'arrow-up' : 'arrow-down'} />
        </span>
    );
}

export interface TableCellContentProps {
    /** 列定义 */
    column: TableColumn;
    /** 行数据 */
    row: unknown;
    /** 行下标 */
    index: number;
}

/**
 * 单元格内容：优先走列的 render，否则原样渲染数据里的同名字段。
 *
 * 两端共用同一份取值逻辑（readCellValue 在 use-table-state 里），
 * 避免 H5 与 PC 对同一个字段渲染出不同内容。
 */
export function TableCellContent({ column, row, index }: TableCellContentProps) {
    const value = (row as Record<string, unknown> | null)?.[column.key];
    if (column.render) {
        return <>{column.render(value, row, index)}</>;
    }
    if (value === null || value === undefined || value === '') {
        return <span className="text-bv-text-3">—</span>;
    }
    return <>{value as React.ReactNode}</>;
}
