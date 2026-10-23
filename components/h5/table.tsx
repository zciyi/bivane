import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import {
    TableCellContent,
    TableSortIndicator,
    tableCellClass,
    tableLabelClass,
    tableValueClass,
} from '@/components/ui/table-parts';
import type { TableColumn } from '@/hooks/use-table-state';
import type { TableViewProps } from '@/components/ui/table-parts';

/**
 * Bivane Table · H5 卡片化列表（模式 C 的小屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * H5 的形态：**一行数据 = 一张卡片**。
 *
 * 为什么不做窄表格：
 *   表格的语义建立在「列对齐」上，375px 宽塞 4 列就只剩每列 90px，
 *   中文表头必然折行、单元格必然截断。窄屏的通行做法是把表格**降维成卡片**：
 *   关键字段（title / meta）直出，其余字段收进「展开详情」。
 *
 * 展开详情用**行内展开**而不是底部弹层：
 *   弹层会打断「连续浏览多行」的节奏（看一眼关一次），
 *   行内展开让「点开 → 看完 → 收起 → 看下一行」是一串连续动作。
 *
 * 排序入口：卡片里的字段标签可点（PC 是点表头）。
 *   规则共享（asc → desc → 取消），只有入口位置不同。
 */

export const H5Table = React.forwardRef<HTMLDivElement, TableViewProps>(
    function H5Table(
        {
            mode,
            columns,
            rows,
            rowKeys,
            sort,
            onSort,
            canSort,
            onToggleRow,
            isRowSelected,
            onRowClick,
            emptyText,
            className,
            style,
        },
        ref,
    ) {
        /** 展开详情的数据行 key */
        const [expandedKeys, setExpandedKeys] = React.useState<readonly string[]>([]);

        const toggleExpand = React.useCallback((key: string) => {
            setExpandedKeys((prev) =>
                prev.includes(key) ? prev.filter((entry) => entry !== key) : [...prev, key],
            );
        }, []);

        const titleColumn = React.useMemo(
            () => columns.find((column) => column.h5Role === 'title'),
            [columns],
        );
        const metaColumns = React.useMemo(
            () => columns.filter((column) => column.h5Role === 'meta'),
            [columns],
        );
        const detailColumns = React.useMemo(
            () => columns.filter((column) => column.h5Role === 'detail'),
            [columns],
        );

        /** title 角色缺省时，退化为「第一列当标题」—— 没有标题的卡片无法扫读 */
        const effectiveTitle = titleColumn ?? columns[0];
        const effectiveMeta = titleColumn
            ? metaColumns
            : metaColumns.filter((column) => column.key !== effectiveTitle?.key);
        const effectiveDetail = titleColumn
            ? detailColumns
            : detailColumns.filter((column) => column.key !== effectiveTitle?.key);

        if (rows.length === 0) {
            return (
                <div
                    ref={ref}
                    data-slot="table"
                    data-mode="h5"
                    className={cn(
                        'flex min-h-[var(--bv-table-empty-min-height)] w-full items-center justify-center',
                        'bg-bv-background text-bv-sm text-bv-text-3',
                        className,
                    )}
                    style={style}
                >
                    {emptyText}
                </div>
            );
        }

        return (
            <div
                ref={ref}
                data-slot="table"
                data-mode="h5"
                className={cn(
                    'flex w-full flex-col gap-[var(--bv-table-card-gap)]',
                    'bg-bv-background p-[var(--bv-table-card-gap)]',
                    className,
                )}
                style={style}
            >
                {rows.map((row, index) => {
                    const key = rowKeys[index];
                    const selected = isRowSelected(key);
                    const expanded = expandedKeys.includes(key);
                    const hasDetail = effectiveDetail.length > 0;

                    return (
                        <div
                            key={key}
                            data-slot="table-card"
                            data-selected={selected ? 'true' : undefined}
                            data-expanded={expanded ? 'true' : undefined}
                            className={cn(
                                'rounded-bv-lg bg-bv-surface',
                                'px-[var(--bv-table-card-padding-x)]',
                                'py-[var(--bv-table-card-padding-y)]',
                            )}
                        >
                            {/* 卡片头：标题 + 选中圈 + 展开按钮 */}
                            <div
                                data-slot="table-card-header"
                                className="flex items-start gap-[var(--bv-table-card-header-gap)]"
                            >
                                {onToggleRow ? (
                                    <button
                                        type="button"
                                        data-slot="table-card-select"
                                        role="checkbox"
                                        aria-checked={selected}
                                        onClick={() => onToggleRow(key)}
                                        className={cn(
                                            'mt-[var(--bv-table-card-select-offset)] flex shrink-0 cursor-pointer',
                                            'items-center justify-center rounded-bv-sm',
                                            'h-[var(--bv-table-card-select-size)]',
                                            'w-[var(--bv-table-card-select-size)]',
                                            'border border-bv-gray-4 bg-bv-surface',
                                            selected && 'border-bv-primary bg-bv-primary',
                                        )}
                                    >
                                        {selected ? (
                                            <Icon
                                                name="check"
                                                size={12}
                                                color="#fff"
                                                className="text-white"
                                            />
                                        ) : null}
                                    </button>
                                ) : null}

                                <div
                                    data-slot="table-card-title"
                                    className={cn(
                                        'min-w-0 flex-1',
                                        'text-bv-md leading-[var(--bv-table-card-title-line-height)]',
                                        'font-bold text-bv-text',
                                    )}
                                >
                                    {effectiveTitle ? (
                                        <TableCellContent
                                            column={effectiveTitle}
                                            row={row}
                                            index={index}
                                        />
                                    ) : null}
                                </div>

                                {hasDetail ? (
                                    <button
                                        type="button"
                                        data-slot="table-card-expand"
                                        aria-expanded={expanded}
                                        onClick={() => toggleExpand(key)}
                                        className={cn(
                                            'flex shrink-0 cursor-pointer items-center border-0 bg-transparent p-0',
                                            'text-bv-xs text-bv-text-3',
                                        )}
                                    >
                                        {expanded ? '收起' : '详情'}
                                        <Icon
                                            name="arrow-down"
                                            size={12}
                                            className={cn(
                                                'ml-[var(--bv-table-card-expand-gap)] transition-transform',
                                                expanded && 'rotate-180',
                                            )}
                                        />
                                    </button>
                                ) : null}
                            </div>

                            {/* 副标题行：紧跟标题的关键字段 */}
                            {effectiveMeta.length > 0 ? (
                                <div
                                    data-slot="table-card-meta"
                                    className="mt-[var(--bv-table-card-meta-gap)] flex flex-col gap-[var(--bv-table-card-field-gap)]"
                                >
                                    {effectiveMeta.map((column) => {
                                        const sortable = canSort(column.key);
                                        return (
                                            <div
                                                key={column.key}
                                                data-slot="table-card-field"
                                                className={tableCellClass(mode, column.align)}
                                            >
                                                {/*
                                                 * 可排序列的标签本身就是排序入口（PC 是点表头）。
                                                 * 不另起一条排序条 —— 那会让同一个字段名在一张卡里
                                                 * 出现两次（meta 区的标签 + 底部排序按钮），视觉冗余。
                                                 */}
                                                {sortable ? (
                                                    <button
                                                        type="button"
                                                        data-slot="table-card-sort-button"
                                                        onClick={() => onSort(column.key)}
                                                        className={cn(
                                                            'inline-flex w-fit cursor-pointer items-center border-0 bg-transparent p-0',
                                                            'text-bv-xs leading-[var(--bv-table-label-line-height)] text-bv-text-3',
                                                        )}
                                                    >
                                                        {column.title}
                                                        <TableSortIndicator
                                                            sort={sort}
                                                            columnKey={column.key}
                                                            showHint
                                                        />
                                                    </button>
                                                ) : (
                                                    <span
                                                        data-slot="table-card-label"
                                                        className={tableLabelClass(mode)}
                                                    >
                                                        {column.title}
                                                    </span>
                                                )}
                                                <span
                                                    data-slot="table-card-value"
                                                    className={tableValueClass(mode)}
                                                >
                                                    <TableCellContent
                                                        column={column}
                                                        row={row}
                                                        index={index}
                                                    />
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}

                            {/* 展开详情：其余字段 */}
                            {expanded && hasDetail ? (
                                <div
                                    data-slot="table-card-detail"
                                    className="mt-[var(--bv-table-card-detail-gap)] flex flex-col gap-[var(--bv-table-card-field-gap)] border-t border-bv-border pt-[var(--bv-table-card-detail-gap)]"
                                >
                                    {effectiveDetail.map((column) => (
                                        <div
                                            key={column.key}
                                            data-slot="table-card-field"
                                            className={tableCellClass(mode, column.align)}
                                        >
                                            <span
                                                data-slot="table-card-label"
                                                className={tableLabelClass(mode)}
                                            >
                                                {column.title}
                                            </span>
                                            <span
                                                data-slot="table-card-value"
                                                className={tableValueClass(mode)}
                                            >
                                                <TableCellContent
                                                    column={column}
                                                    row={row}
                                                    index={index}
                                                />
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {onRowClick ? (
                                <button
                                    type="button"
                                    data-slot="table-card-click"
                                    onClick={() => onRowClick(row, index)}
                                    className="sr-only"
                                >
                                    打开详情
                                </button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    },
);

export type { TableColumn };
