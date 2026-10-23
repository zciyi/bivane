import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import {
    TableCellContent,
    TableSortIndicator,
    tableAlignClass,
    tableValueClass,
} from '@/components/ui/table-parts';
import { TablePagination } from '@/components/ui/table-pagination';
import type { TableColumn } from '@/hooks/use-table-state';
import type { TableViewProps } from '@/components/ui/table-parts';

/**
 * Bivane Table · PC 标准表格（模式 C 的大屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * PC 的形态：**真表格**（<table> + <thead> + <tbody>），带四件套能力：
 *   1. 排序 —— 点表头切换 asc → desc → 取消
 *   2. 列固定 —— position: sticky，横向滚动时左侧列钉住
 *   3. 列筛选 —— 表头下拉多选
 *   4. 行选择 —— 行首 checkbox + 表头全选
 *
 * 为什么用原生 <table> 而不是 div+grid：
 *   语义标签自带「表头关联单元格」的关系（scope="col"），
 *   屏幕阅读器能正确朗读「第 3 列：金额」；div 方案要自己补全套 ARIA，
 *   且列数一多极易漏。
 *
 * 列固定用 sticky 而不是重排 DOM 顺序：
 *   sticky 保留真实 DOM 顺序，键盘 Tab 顺序与视觉顺序一致
 *   （重排会让 Tab 先走到右边的列再回到左边）。
 *
 * 列筛选用**原生 details/summary** 还是自研浮层？
 *   自研浮层：表头格子里放一个绝对定位的下拉面板（position: absolute + 高 z-index），
 *   点击外部关闭。不引 Radix —— 筛选面板是单层多选列表，
 *   矩阵 §6.4 的判据是「多层树/含焦点契约交 Radix，单层列表自研」。
 */

export const PcTable = React.forwardRef<HTMLDivElement, TableViewProps>(
    function PcTable(
        {
            mode,
            columns,
            rows,
            rowKeys,
            sort,
            onSort,
            canSort,
            filters,
            onToggleFilter,
            isFiltered,
            onToggleRow,
            isRowSelected,
            allSelected,
            onToggleAll,
            pagination,
            page,
            paginationMode,
            showTotal,
            totalText,
            onPageChange,
            onPageSizeChange,
            pageSizeOptions,
            onRowClick,
            emptyText,
            className,
            style,
        },
        ref,
    ) {
        /** 展开筛选面板的列 key；同一时刻只开一个 */
        const [openFilter, setOpenFilter] = React.useState<string | null>(null);
        const filterRootRef = React.useRef<HTMLDivElement | null>(null);

        /** 点外部关闭筛选面板 */
        React.useEffect(() => {
            if (openFilter === null) return undefined;
            const onPointerDown = (event: PointerEvent) => {
                const root = filterRootRef.current;
                if (root && !root.contains(event.target as Node)) {
                    setOpenFilter(null);
                }
            };
            const onKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') setOpenFilter(null);
            };
            document.addEventListener('pointerdown', onPointerDown);
            document.addEventListener('keydown', onKeyDown);
            return () => {
                document.removeEventListener('pointerdown', onPointerDown);
                document.removeEventListener('keydown', onKeyDown);
            };
        }, [openFilter]);

        /** 有选择能力的列（行首 checkbox） */
        const hasSelection = onToggleRow !== undefined && onToggleAll !== undefined;

        /** 固定列的 sticky 偏移：左侧列按前序固定列宽度累加 */
        const stickyOffsets = React.useMemo(() => {
            const offsets: Record<string, { left?: string; right?: string }> = {};
            let left = 0;
            let right = 0;
            const rightColumns = columns.filter((column) => column.fixed === 'right');
            // 从右往左累加右侧固定列
            for (let i = rightColumns.length - 1; i >= 0; i -= 1) {
                const column = rightColumns[i];
                offsets[column.key] = { right: `${right}px` };
                right += typeof column.width === 'number' ? column.width : 0;
            }
            // 从左往右累加左侧固定列
            for (const column of columns) {
                if (column.fixed !== 'left') continue;
                offsets[column.key] = { left: `${left}px` };
                left += typeof column.width === 'number' ? column.width : 0;
            }
            return offsets;
        }, [columns]);

        const cellStyle = (column: TableColumn): React.CSSProperties | undefined => {
            const style: React.CSSProperties = {};
            if (typeof column.width === 'number') style.width = `${column.width}px`;
            else if (typeof column.width === 'string') style.width = column.width;
            const sticky = stickyOffsets[column.key];
            if (sticky) {
                style.position = 'sticky';
                if (sticky.left !== undefined) style.left = sticky.left;
                if (sticky.right !== undefined) style.right = sticky.right;
                style.zIndex = 1;
                style.background = 'var(--bv-surface)';
            }
            return Object.keys(style).length > 0 ? style : undefined;
        };

        return (
            <div
                ref={ref}
                data-slot="table"
                data-mode="pc"
                className={cn(
                    'w-full overflow-x-auto bg-bv-surface',
                    className,
                )}
                style={style}
            >
                <table
                    data-slot="table-pc-table"
                    className={cn(
                        'w-full border-collapse text-bv-sm',
                        'leading-[var(--bv-table-cell-line-height)]',
                    )}
                >
                    <thead data-slot="table-pc-head">
                        <tr>
                            {hasSelection ? (
                                <th
                                    data-slot="table-pc-cell"
                                    scope="col"
                                    className={cn(
                                        'w-[var(--bv-table-pc-select-column-width)] px-[var(--bv-table-pc-cell-padding-x)]',
                                        'py-[var(--bv-table-pc-cell-padding-y)] text-left',
                                    )}
                                >
                                    <button
                                        type="button"
                                        role="checkbox"
                                        aria-checked={allSelected}
                                        aria-label="全选"
                                        onClick={onToggleAll}
                                        className={cn(
                                            'flex h-[var(--bv-table-pc-select-size)] w-[var(--bv-table-pc-select-size)]',
                                            'cursor-pointer items-center justify-center rounded-bv-sm',
                                            'border border-bv-gray-4 bg-bv-surface',
                                            allSelected && 'border-bv-primary bg-bv-primary',
                                        )}
                                    >
                                        {allSelected ? (
                                            <Icon name="check" size={12} color="#fff" />
                                        ) : null}
                                    </button>
                                </th>
                            ) : null}

                            {columns.map((column) => {
                                const sortable = canSort(column.key);
                                const filtered = isFiltered(column.key);
                                const sticky = stickyOffsets[column.key];

                                return (
                                    <th
                                        key={column.key}
                                        data-slot="table-pc-cell"
                                        data-column={column.key}
                                        scope="col"
                                        aria-sort={
                                            sortable && sort?.key === column.key
                                                ? sort.order === 'asc'
                                                    ? 'ascending'
                                                    : 'descending'
                                                : undefined
                                        }
                                        style={cellStyle(column)}
                                        className={cn(
                                            'relative px-[var(--bv-table-pc-cell-padding-x)]',
                                            'py-[var(--bv-table-pc-cell-padding-y)]',
                                            'text-left font-bold text-bv-text',
                                            sticky && 'bg-bv-surface',
                                        )}
                                    >
                                        <div
                                            data-slot="table-pc-head-content"
                                            className="flex items-center gap-[var(--bv-table-head-gap)]"
                                        >
                                            {sortable ? (
                                                <button
                                                    type="button"
                                                    data-slot="table-pc-sort"
                                                    onClick={() => onSort(column.key)}
                                                    className={cn(
                                                        'inline-flex cursor-pointer items-center border-0 bg-transparent p-0',
                                                        'text-bv-sm font-bold text-bv-text',
                                                    )}
                                                >
                                                    {column.title}
                                                    <TableSortIndicator
                                                        sort={sort}
                                                        columnKey={column.key}
                                                    />
                                                </button>
                                            ) : (
                                                <span data-slot="table-pc-label">{column.title}</span>
                                            )}

                                            {column.filterable && column.filters ? (
                                                <div
                                                    data-slot="table-pc-filter"
                                                    ref={
                                                        openFilter === column.key
                                                            ? filterRootRef
                                                            : undefined
                                                    }
                                                    className="relative"
                                                >
                                                    <button
                                                        type="button"
                                                        data-slot="table-pc-filter-trigger"
                                                        aria-expanded={openFilter === column.key}
                                                        aria-label={`筛选 ${String(column.title)}`}
                                                        onClick={() =>
                                                            setOpenFilter(
                                                                openFilter === column.key
                                                                    ? null
                                                                    : column.key,
                                                            )
                                                        }
                                                        className={cn(
                                                            'inline-flex cursor-pointer items-center border-0 bg-transparent p-0',
                                                            'text-bv-text-3',
                                                            filtered && 'text-bv-primary',
                                                        )}
                                                    >
                                                        <Icon name="setting" size={12} />
                                                    </button>

                                                    {openFilter === column.key ? (
                                                        <div
                                                            data-slot="table-pc-filter-panel"
                                                            role="group"
                                                            aria-label={`${String(column.title)} 筛选`}
                                                            className={cn(
                                                                'absolute left-0 top-[var(--bv-table-filter-panel-offset)] z-[var(--bv-table-filter-panel-z-index)]',
                                                                'min-w-[var(--bv-table-filter-panel-min-width)]',
                                                                'rounded-bv-md border border-bv-border bg-bv-surface',
                                                                'py-[var(--bv-table-filter-panel-padding-y)]',
                                                                'shadow-[var(--bv-table-filter-panel-shadow)]',
                                                            )}
                                                        >
                                                            {column.filters.map((option) => {
                                                                const checked =
                                                                    filters[column.key]?.includes(
                                                                        option,
                                                                    ) ?? false;
                                                                return (
                                                                    <label
                                                                        key={option}
                                                                        data-slot="table-pc-filter-option"
                                                                        className={cn(
                                                                            'flex cursor-pointer items-center gap-[var(--bv-table-cell-gap)]',
                                                                            'px-[var(--bv-table-filter-panel-padding-x)]',
                                                                            'py-[var(--bv-table-filter-option-padding-y)]',
                                                                            'text-bv-sm text-bv-text hover:bg-bv-muted',
                                                                        )}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={() =>
                                                                                onToggleFilter(
                                                                                    column.key,
                                                                                    option,
                                                                                )
                                                                            }
                                                                            className="accent-bv-primary"
                                                                        />
                                                {option}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody data-slot="table-pc-body">
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    data-slot="table-pc-empty"
                                    colSpan={columns.length + (hasSelection ? 1 : 0)}
                                    className="px-[var(--bv-table-pc-cell-padding-x)] py-[var(--bv-table-empty-min-height)] text-center text-bv-sm text-bv-text-3"
                                >
                                    {emptyText}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, index) => {
                                const key = rowKeys[index];
                                const selected = isRowSelected(key);

                                return (
                                    <tr
                                        key={key}
                                        data-slot="table-pc-row"
                                        data-selected={selected ? 'true' : undefined}
                                        onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                                        className={cn(
                                            'bv-hairline bv-hairline--bottom',
                                            onRowClick && 'cursor-pointer',
                                            selected && 'bg-bv-muted',
                                            !selected && onRowClick && 'hover:bg-bv-muted',
                                        )}
                                    >
                                        {hasSelection ? (
                                            <td
                                                data-slot="table-pc-cell"
                                                className={cn(
                                                    'w-[var(--bv-table-pc-select-column-width)]',
                                                    'px-[var(--bv-table-pc-cell-padding-x)]',
                                                    'py-[var(--bv-table-pc-cell-padding-y)]',
                                                )}
                                                onClick={(event) => event.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={selected}
                                                    aria-label={`选择第 ${index + 1} 行`}
                                                    onClick={() => onToggleRow(key)}
                                                    className={cn(
                                                        'flex h-[var(--bv-table-pc-select-size)] w-[var(--bv-table-pc-select-size)]',
                                                        'cursor-pointer items-center justify-center rounded-bv-sm',
                                                        'border border-bv-gray-4 bg-bv-surface',
                                                        selected &&
                                                            'border-bv-primary bg-bv-primary',
                                                    )}
                                                >
                                                    {selected ? (
                                                        <Icon name="check" size={12} color="#fff" />
                                                    ) : null}
                                                </button>
                                            </td>
                                        ) : null}

                                        {columns.map((column) => {
                                            const sticky = stickyOffsets[column.key];
                                            return (
                                                <td
                                                    key={column.key}
                                                    data-slot="table-pc-cell"
                                                    data-column={column.key}
                                                    style={cellStyle(column)}
                                                    className={cn(
                                                        'px-[var(--bv-table-pc-cell-padding-x)]',
                                                        'py-[var(--bv-table-pc-cell-padding-y)]',
                                                        'align-middle',
                                                        sticky && 'bg-bv-surface',
                                                        selected && sticky && 'bg-bv-muted',
                                                    )}
                                                >
                                                <div
                                                    data-slot="table-pc-cell-content"
                                                    className={cn(
                                                        'flex items-center gap-[var(--bv-table-cell-gap)]',
                                                        tableAlignClass(column.align),
                                                    )}
                                                >
                                                    {/*
                                                     * 单元格**只渲染值**：表头就是这一列的标签。
                                                     * 若把标签也渲染进单元格（像 H5 卡片那样），
                                                     * 一格会变成「标签 + 值」两段，
                                                     * 值被挤到第二行甚至竖排（实测「订 单 01」折行）。
                                                     */}
                                                    <span
                                                        data-slot="table-pc-value"
                                                        className={tableValueClass(mode)}
                                                    >
                                                        <TableCellContent
                                                            column={column}
                                                            row={row}
                                                            index={index}
                                                        />
                                                    </span>
                                                </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                {/* 分页条：仅 PC 端（数据同源 props，H5 不渲染，由 table-pagination 组件承担交互） */}
                {pagination ? (
                    <TablePagination
                        state={{
                            current: page.current,
                            pageCount: page.pageCount,
                            pageSize: page.pageSize,
                            startPage: page.startPage,
                            total: page.total,
                            setPage: page.setPage,
                        }}
                        mode={paginationMode}
                        showTotal={showTotal}
                        totalText={totalText}
                        onChange={onPageChange}
                        onPageSizeChange={onPageSizeChange}
                        pageSizeOptions={pageSizeOptions}
                    />
                ) : null}
            </div>
        );
    },
);

export type { TableColumn };
