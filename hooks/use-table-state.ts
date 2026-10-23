import * as React from 'react';
import {
    DEFAULT_PAGE_SIZE,
    clampPage,
    computePageCount,
    sliceStartIndex,
    type PaginationMode,
} from '@/components/ui/table-pagination';

/**
 * Bivane Table · 列定义与排序规则（跨模式共享逻辑）
 *
 * 交互定义见 bivane-responsive-matrix.md §2.3（Table：模式 C）
 *
 *   ┌ H5 ── 卡片化列表：关键字段直出，其余字段收进「展开详情」
 *   └ PC ── 标准表格：排序 / 列固定 / 列筛选 / 行选择
 *
 * 为什么「列定义」是共享的：
 *   两端消费的是**同一份 columns 数组**。PC 把每一列渲染成 <th>/<td>，
 *   H5 把同一列渲染成卡片里的一个字段行。列的 key、标题、宽度、对齐、
 *   「是否可排序」「是否参与筛选」这些元信息两端完全一致，
 *   只有**呈现形态**不同。所以列定义放共享层，呈现分两端。
 *
 * 排序规则也共享：
 *   「点击表头排序」在 PC 是点表头，在 H5 是点卡片里的字段标签，
 *   但**排序的方向切换规则**（asc → desc → 取消）必须一致，
 *   否则同一份数据在两端排出来的顺序会不同。
 */

/** 一列的定义 */
export interface TableColumn {
    /** 列标识（唯一） */
    key: string;
    /** 表头 / 字段标签 */
    title: React.ReactNode;
    /** 单元格内容；不传则原样渲染数据里的同名字段 */
    render?: (value: unknown, row: unknown, index: number) => React.ReactNode;
    /** 排序取值；不传则用原始值（数字/字符串） */
    sortValue?: (value: unknown, row: unknown) => string | number;
    /** 是否参与排序（默认 false） */
    sortable?: boolean;
    /** 宽度（PC 端表格列宽；H5 端忽略） */
    width?: number | string;
    /** 内容对齐 */
    align?: 'left' | 'center' | 'right';
    /** PC 端固定列（left / right），用 position: sticky 实现 */
    fixed?: 'left' | 'right';
    /**
     * H5 卡片化时的字段角色（PC 端忽略）：
     * - title：作为卡片标题直出
     * - meta：作为副标题行（默认）
     * - detail：收进「展开详情」区
     */
    h5Role?: 'title' | 'meta' | 'detail';
    /** 该列是否参与列筛选（PC 端） */
    filterable?: boolean;
    /** 该列的筛选项（PC 端列筛选） */
    filters?: readonly string[];
}

/** 排序方向 */
export type SortOrder = 'asc' | 'desc';

/** 当前排序状态：按哪一列、什么方向 */
export interface SortState {
    /** 排序列的 key */
    key: string;
    /** 方向 */
    order: SortOrder;
}

/**
 * 排序方向切换规则（纯函数，共享）。
 *
 * asc → desc → 取消（null）
 *
 * 第三次点击取消排序：这是数据表格的通用约定（Ant Design / Vant 都这样），
 * 也是唯一能同时支持「升序」「降序」「原序」三态而不加额外 prop 的做法。
 */
export function nextSortOrder(
    current: SortState | undefined,
    key: string,
): SortState | undefined {
    if (!current || current.key !== key) return { key, order: 'asc' };
    if (current.order === 'asc') return { key, order: 'desc' };
    return undefined;
}

/** 比较两个排序值：数字按数值比，其余按字符串比 */
export function compareSortValues(a: string | number, b: string | number): number {
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
}

/**
 * 按排序状态对数据排序（纯函数，共享）。
 *
 * 用「复制后排序」而不是原地 sort：不改传入的 data 引用
 * （受控模式下业务可能同时持有同一份数组，原地排序会让 React 的比较失效）。
 */
export function sortData<T>(
    data: readonly T[],
    columns: readonly TableColumn[],
    sort: SortState | undefined,
    getRow: (entry: T) => unknown = (entry) => entry,
): readonly T[] {
    if (!sort) return data;
    const column = columns.find((entry) => entry.key === sort.key);
    if (!column?.sortable) return data;

    const read = (entry: T): string | number => {
        const row = getRow(entry);
        const value = (row as Record<string, unknown> | null)?.[column.key];
        return column.sortValue ? column.sortValue(value, row) : (value as string | number);
    };

    // 复制后排序：slice 断开引用，业务拿到的 data 不被就地改写
    return [...data].sort((a, b) => {
        const av = read(a);
        const bv = read(b);
        const result = compareSortValues(av, bv);
        return sort.order === 'asc' ? result : -result;
    });
}

/** 列筛选：按「该列的值落在筛选项集合内」过滤（未筛的列不参与） */
export function filterData<T>(
    data: readonly T[],
    columns: readonly TableColumn[],
    filters: Readonly<Record<string, readonly string[]>>,
    getRow: (entry: T) => unknown = (entry) => entry,
): readonly T[] {
    const active = columns.filter(
        (column) =>
            column.filterable === true &&
            filters[column.key] !== undefined &&
            filters[column.key].length > 0,
    );
    if (active.length === 0) return data;

    return data.filter((entry) =>
        active.every((column) => {
            const value = (getRow(entry) as Record<string, unknown> | null)?.[column.key];
            return filters[column.key].includes(String(value));
        }),
    );
}

/** 单元格取值：优先 render 的入参值，其次数据里的同名字段 */
export function readCellValue(row: unknown, key: string): unknown {
    return (row as Record<string, unknown> | null)?.[key];
}

/** 行 key：优先用 id / key 字段，其次下标 */
export function resolveRowKey(row: unknown, index: number): string {
    const record = row as Record<string, unknown> | null;
    const candidate = record?.id ?? record?.key;
    return candidate === undefined || candidate === null
        ? String(index)
        : String(candidate);
}

export interface UseTableStateOptions {
    /** 列定义 */
    columns: readonly TableColumn[];
    /** 数据 */
    data: readonly unknown[];
    /** 业务行标识；默认取 id/key 或原始下标，远程分页及数据重排时应提供稳定业务标识 */
    rowKey?: (row: unknown, index: number) => string | number;
    /**
     * 受控排序。
     *
     * 用 `null` 表示「受控且当前无排序」，用 `undefined` 表示「非受控」——
     * 两者必须区分：排序的第三态就是「取消排序」，
     * 若用 undefined 同时表达「非受控」和「取消」，受控方就没法取消排序了
     * （受控值落回 undefined 会让组件误判成非受控、继续用内部状态）。
     */
    sort?: SortState | null;
    /** 非受控初始排序 */
    defaultSort?: SortState;
    /**
     * 排序变化（取消排序时传 null）。
     *
     * 用 null 而非 undefined 表示「取消」：与受控 prop 的 null 语义对齐，
     * 业务方 setState 的类型能直接对上，不用再包一层转换。
     */
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
    /** 是否启用分页（PC 端渲染分页条；H5 忽略） */
    pagination?: boolean;
    /** 受控当前页 */
    paginationCurrent?: number;
    /** 非受控初始页 */
    defaultPaginationPage?: number;
    /** 每页条数 */
    pageSize?: number;
    /** 总条数（remote 模式必须给；local 模式不给则用筛选后行数） */
    paginationTotal?: number;
    /** 页码起始值，默认 1 */
    startPage?: number;
    /** 分页模式，默认 remote */
    paginationMode?: PaginationMode;
    /** 切页 */
    onPageChange?: (page: number, pageSize: number) => void;
    /** 换每页条数 */
    onPageSizeChange?: (pageSize: number) => void;
}

export interface TableState {
    /** 排序后的数据（已套用列筛选与排序） */
    rows: readonly unknown[];
    /** 与当前页 rows 一一对应、在派生处理前确定的行标识 */
    rowKeys: readonly string[];
    /** 当前排序 */
    sort: SortState | undefined;
    /** 点击列头/字段标签：切换排序方向 */
    toggleSort: (key: string) => void;
    /** 该列是否可排序 */
    canSort: (key: string) => boolean;
    /** 当前列筛选值 */
    filters: Record<string, readonly string[]>;
    /** 切换某列的某个筛选项 */
    toggleFilter: (columnKey: string, value: string) => void;
    /** 该列当前是否被筛选中 */
    isFiltered: (columnKey: string) => boolean;
    /** 已选中的行 key */
    selectedKeys: readonly string[];
    /** 切换某行选中 */
    toggleRow: (key: string) => void;
    /** 是否全选（当前页全部行都选中） */
    allSelected: boolean;
    /** 全选 / 全不选 */
    toggleAll: () => void;
    /** 某行是否选中 */
    isRowSelected: (key: string) => boolean;
    /** 分页状态（仅 pagination=true 时有意义） */
    page: {
        /** 归一化后的当前页 */
        current: number;
        /** 总页数（至少 1） */
        pageCount: number;
        /** 生效的每页条数 */
        pageSize: number;
        /** 起始页 */
        startPage: number;
        /** 生效的总条数 */
        total: number;
        /** 切页（内部夹紧） */
        setPage: (page: number) => void;
        /** 换每页条数（回起始页） */
        setPageSize: (pageSize: number) => void;
        /** 是否可上一页 */
        canPrev: boolean;
        /** 是否可下一页 */
        canNext: boolean;
    };
}

/**
 * Table 状态机绑定。
 *
 * 排序、筛选、选中三组状态各自受控/非受控可配。
 * 排序与筛选是**派生数据**（rows），选中是**独立集合**。
 *
 * 派生顺序：先筛选（行数变）再排序（顺序变）。
 * 反过来会得到「按未筛选的行排好序，再筛掉一部分」—— 结果其实一样，
 * 但先筛能让排序的比较次数更少，且语义更直观。
 *
 * 分页在**筛选排序之后**：页数依赖「当前能看到多少行」，
 * 而行数是被筛选改过的。若先分页再筛选，第 3 页筛完可能只剩 1 行。
 */
export function useTableState({
    columns,
    data,
    rowKey,
    sort: controlledSort,
    defaultSort,
    onSortChange,
    filters: controlledFilters,
    defaultFilters,
    onFilterChange,
    selectedKeys: controlledSelected,
    defaultSelectedKeys,
    onSelectionChange,
    pagination = false,
    paginationCurrent,
    defaultPaginationPage,
    pageSize = DEFAULT_PAGE_SIZE,
    paginationTotal,
    startPage = 1,
    paginationMode = 'remote',
    onPageChange,
    onPageSizeChange,
}: UseTableStateOptions): TableState {
    const isSortControlled = controlledSort !== undefined;
    const [internalSort, setInternalSort] = React.useState<SortState | undefined>(
        defaultSort,
    );
    // 受控时 null = 「受控且当前无排序」，与 undefined（非受控）区分
    const sort = isSortControlled ? (controlledSort ?? undefined) : internalSort;

    const isFilterControlled = controlledFilters !== undefined;
    const [internalFilters, setInternalFilters] = React.useState<
        Record<string, readonly string[]>
    >(defaultFilters ?? {});
    const filters = isFilterControlled ? controlledFilters : internalFilters;

    const isSelectionControlled = controlledSelected !== undefined;
    const [internalSelected, setInternalSelected] = React.useState<readonly string[]>(
        defaultSelectedKeys ?? [],
    );
    const selectedKeys = isSelectionControlled ? controlledSelected : internalSelected;

    // 行标识随原始记录一起派生，避免排序或切页后把展示下标当成业务身份。
    const keyedData = React.useMemo(
        () => data.map((row, index) => ({
            row,
            key: String(rowKey ? rowKey(row, index) : resolveRowKey(row, index)),
        })),
        [data, rowKey],
    );
    const fullRows = React.useMemo(
        () => sortData(
            filterData(keyedData, columns, filters, (entry) => entry.row),
            columns,
            sort,
            (entry) => entry.row,
        ),
        [keyedData, columns, filters, sort],
    );

    /**
     * 生效的总条数：
     * - local 模式：业务给了 total 就用它，否则用筛选后的行数（组件自己切，得知道总量）
     * - remote 模式：业务只给当页数据，行数不是总量 —— 用 props.total，缺了就退化成行数
     */
    const effectiveTotal =
        paginationMode === 'local' || paginationTotal === undefined
            ? paginationTotal ?? fullRows.length
            : paginationTotal;

    const pageCount = computePageCount(effectiveTotal, pageSize);

    const isPaginationControlled = paginationCurrent !== undefined;
    const [internalPage, setInternalPage] = React.useState(
        defaultPaginationPage ?? startPage,
    );
    // 越界夹紧：删光最后一页数据后当前页会失效，不夹会渲染空白页
    const currentPage = clampPage(
        isPaginationControlled ? paginationCurrent : internalPage,
        pageCount,
        startPage,
    );

    /**
     * 切页。
     *
     * 受控时不写内部 state —— 只通知业务。组件擅自改受控值等于替业务做决定。
     * 越界值先夹紧再通知，业务拿到的一定是合法页码。
     */
    const setPage = React.useCallback(
        (page: number) => {
            const next = clampPage(page, pageCount, startPage);
            if (next === currentPage) return;
            if (!isPaginationControlled) setInternalPage(next);
            onPageChange?.(next, pageSize);
        },
        [currentPage, isPaginationControlled, onPageChange, pageCount, pageSize, startPage],
    );

    /**
     * 换每页条数：回到起始页。
     *
     * 停在第 5 页、每页从 10 变 100 时，第 5 页在本地切片下落到空区间
     * （(5-1)*100 = 400 > 总行数）。回起始页是唯一无歧义的选择。
     */
    const setPageSize = React.useCallback(
        (next: number) => {
            const target = startPage;
            if (!isPaginationControlled) setInternalPage(target);
            onPageSizeChange?.(next);
            onPageChange?.(target, next);
        },
        [isPaginationControlled, onPageChange, onPageSizeChange, startPage],
    );

    /**
     * 实际要渲染的行。
     * - local 模式：组件按页切片全量
     * - remote 模式：业务给的就是当页数据，原样渲染（再切就错了）
     */
    const visibleRows = React.useMemo(() => {
        if (!pagination || paginationMode !== 'local') return fullRows;
        const start = sliceStartIndex(currentPage, startPage, pageSize);
        return fullRows.slice(start, start + Math.max(1, pageSize));
    }, [fullRows, pagination, paginationMode, currentPage, startPage, pageSize]);
    const rows = React.useMemo(() => visibleRows.map((entry) => entry.row), [visibleRows]);
    const rowKeys = React.useMemo(() => visibleRows.map((entry) => entry.key), [visibleRows]);

    const toggleSort = React.useCallback(
        (key: string) => {
            const next = nextSortOrder(sort, key);
            if (!isSortControlled) setInternalSort(next);
            onSortChange?.(next ?? null);
        },
        [sort, isSortControlled, onSortChange],
    );

    const canSort = React.useCallback(
        (key: string) => columns.some((column) => column.key === key && column.sortable),
        [columns],
    );

    const toggleFilter = React.useCallback(
        (columnKey: string, value: string) => {
            const current = filters[columnKey] ?? [];
            const next = current.includes(value)
                ? current.filter((entry) => entry !== value)
                : [...current, value];
            const nextFilters = { ...filters, [columnKey]: next };
            if (!isFilterControlled) setInternalFilters(nextFilters);
            onFilterChange?.(nextFilters);
        },
        [filters, isFilterControlled, onFilterChange],
    );

    const isFiltered = React.useCallback(
        (columnKey: string) => (filters[columnKey]?.length ?? 0) > 0,
        [filters],
    );

    const toggleRow = React.useCallback(
        (key: string) => {
            const next = selectedKeys.includes(key)
                ? selectedKeys.filter((entry) => entry !== key)
                : [...selectedKeys, key];
            if (!isSelectionControlled) setInternalSelected(next);
            onSelectionChange?.([...next]);
        },
        [selectedKeys, isSelectionControlled, onSelectionChange],
    );

    const allSelected = React.useMemo(
        () => rowKeys.length > 0 && rowKeys.every((key) => selectedKeys.includes(key)),
        [rowKeys, selectedKeys],
    );

    const toggleAll = React.useCallback(() => {
        const currentPageKeys = new Set(rowKeys);
        const next = allSelected
            ? selectedKeys.filter((key) => !currentPageKeys.has(key))
            : [...new Set([...selectedKeys, ...rowKeys])];
        if (!isSelectionControlled) setInternalSelected(next);
        onSelectionChange?.([...next]);
    }, [allSelected, rowKeys, selectedKeys, isSelectionControlled, onSelectionChange]);

    const isRowSelected = React.useCallback(
        (key: string) => selectedKeys.includes(key),
        [selectedKeys],
    );

    const canPrev = currentPage > startPage;
    const canNext = currentPage < startPage + pageCount - 1;

    return {
        rows,
        rowKeys,
        sort,
        toggleSort,
        canSort,
        filters,
        toggleFilter,
        isFiltered,
        selectedKeys,
        toggleRow,
        allSelected,
        toggleAll,
        isRowSelected,
        page: {
            current: currentPage,
            pageCount,
            pageSize,
            startPage,
            total: effectiveTotal,
            setPage,
            setPageSize,
            canPrev,
            canNext,
        },
    };
}
