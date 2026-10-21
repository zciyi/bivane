import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

/**
 * Bivane Table · 分页器（PC 端专用）
 *
 * 交互定义见 bivane-responsive-matrix.md §2.3（Table）
 *
 * 分页只出现在 PC 端：H5 是卡片化列表 + 触底/无限滚动（那是 List 的职责），
 * 卡片流里插一条分页条会打断「连续下滑」的节奏。但 props 两端保持一致
 * （契约第 9 条）—— H5 端接受 pagination 但不渲染分页条。
 *
 * ## 两种分页模式（最容易用错的一处，务必分清）
 *
 * | mode   | data 是什么                        | 切页时谁去取数        | total 从哪来 |
 * | ------ | ---------------------------------- | --------------------- | ------------ |
 * | local  | **当前页**的行（组件不切）          | 业务（每页给新 data） | props.total  |
 * | remote | **全量**的行（组件自己按页切片）    | 业务（给全量，组件切） | data.length  |
 *
 * 命名容易误导，所以这里用 `mode` 而不是 `client/server`：
 * - `local` = 「分页在本地」= 组件拿全量数据自己切
 * - `remote` = 「分页在远端」= 组件只拿当页数据，切页由业务换 data
 *
 * **默认值 `remote`**：数据总是从接口来，业务天然只持有一页；
 * 想让组件切页得显式说 `mode="local"`，避免误以为组件会帮你切。
 */

/** 分页模式：remote = 组件只渲染当页数据；local = 组件自己按页切片全量数据 */
export type PaginationMode = 'remote' | 'local';

/** 分页计算结果 */
export interface PaginationState {
    /** 归一化后的当前页（永远 ≥ startPage） */
    current: number;
    /** 总页数（至少 1；total 为 0 时也是 1，避免出现「第 0 页」） */
    pageCount: number;
    /** 生效的每页条数 */
    pageSize: number;
    /** 起始页 */
    startPage: number;
    /** 生效的总条数 */
    total: number;
    /** 切到指定页（内部夹紧到合法范围） */
    setPage: (page: number) => void;
}

/** 默认每页条数 */
export const DEFAULT_PAGE_SIZE = 10;

/**
 * 计算总页数（纯函数）。
 *
 * `Math.max(1, ...)`：数据为空时返回 1 而不是 0 ——
 * 分页器至少要有「第 1 页」这个落点，否则翻页按钮全部禁用、
 * 「共 0 条 / 共 0 页」读起来像坏了。
 */
export function computePageCount(total: number, pageSize: number): number {
    const size = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
    const count = Math.ceil(Math.max(0, total) / size);
    return Math.max(1, count);
}

/**
 * 把页码夹到 [startPage, startPage + pageCount - 1]（纯函数）。
 *
 * 为什么要夹：删除最后一页的最后一条数据后，当前页会越界；
 * 受控场景下业务也可能算出越界页码。不夹的话组件会渲染一个空页。
 */
export function clampPage(page: number, pageCount: number, startPage: number): number {
    const max = startPage + Math.max(0, pageCount - 1);
    if (!Number.isFinite(page)) return startPage;
    return Math.min(Math.max(Math.round(page), startPage), max);
}

/**
 * 本地切片的起始下标（纯函数）。
 *
 * `startPage` 是 1 时，第 1 页下标为 0；是 0 时第 0 页下标也是 0
 * ——算术统一成「(page - startPage) * pageSize」，两种基准都能正确切片。
 */
export function sliceStartIndex(page: number, startPage: number, pageSize: number): number {
    return Math.max(0, (page - startPage) * Math.max(1, pageSize));
}

export interface UsePaginationOptions {
    /** 受控当前页 */
    current?: number;
    /** 非受控初始页 */
    defaultCurrent?: number;
    /** 每页条数 */
    pageSize?: number;
    /** 总条数 */
    total?: number;
    /** 页码起始值 */
    startPage?: number;
    /** 切页回调 */
    onChange?: (page: number, pageSize: number) => void;
}

/**
 * 分页状态。
 *
 * 受控/非受控的判定与 Table 其余状态一致：**prop 是否为 undefined**。
 * 受控时组件不写内部 state，只在越界时把「夹紧后的页码」通过 onChange 告诉业务，
 * 由业务决定要不要改 —— 组件擅自改受控值是错的（那等于替业务做决定）。
 */
export function usePagination({
    current: controlledCurrent,
    defaultCurrent,
    pageSize = DEFAULT_PAGE_SIZE,
    total = 0,
    startPage = 1,
    onChange,
}: UsePaginationOptions): PaginationState {
    const isControlled = controlledCurrent !== undefined;
    const [internalCurrent, setInternalCurrent] = React.useState(
        defaultCurrent ?? startPage,
    );

    const pageCount = computePageCount(total, pageSize);
    const raw = isControlled ? controlledCurrent : internalCurrent;
    const current = clampPage(raw, pageCount, startPage);

    const setPage = React.useCallback(
        (page: number) => {
            const next = clampPage(page, pageCount, startPage);
            if (next === current) return;
            if (!isControlled) setInternalCurrent(next);
            onChange?.(next, pageSize);
        },
        [current, isControlled, onChange, pageCount, pageSize, startPage],
    );

    return { current, pageCount, pageSize, startPage, total, setPage };
}

/** 页码按钮序列（含省略号） */
export type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

/**
 * 生成可见页码序列（纯函数）。
 *
 * 策略：首尾页恒显，中间最多 `siblings * 2 + 1` 个，
 * 超出用省略号占位。省略号**不可点**（不知道它代表哪一页）。
 *
 * 例：pageCount=10, current=5, siblings=1 → [1, '…', 4, 5, 6, '…', 10]
 */
export function buildPageItems(
    current: number,
    pageCount: number,
    startPage: number,
    siblings = 1,
): PageItem[] {
    const last = startPage + pageCount - 1;
    if (pageCount <= 1) return [startPage];

    // 当前页在序列里的位置
    const left = Math.max(startPage + 1, current - siblings);
    const right = Math.min(last - 1, current + siblings);

    const items: PageItem[] = [startPage];
    if (left > startPage + 1) items.push('ellipsis-left');
    for (let page = left; page <= right; page += 1) items.push(page);
    if (right < last - 1) items.push('ellipsis-right');
    items.push(last);
    return items;
}

/** 分页条的 props：数值全部来自 state，避免同一份数据在两个入口各传一遍 */
export interface TablePaginationProps {
    /** 分页状态（current/pageSize/total/startPage/setPage 都从这里读） */
    state: PaginationState;
    /**
     * 分页模式 / 所在模式（只作为 data-mode 标记，便于真机探针区分）。
     * Table 传 PaginationMode（remote/local），DataContainer 传 'h5' | 'pc'。
     */
    mode?: PaginationMode | 'h5' | 'pc';
    /** 是否显示总条数，默认 true */
    showTotal?: boolean;
    /** 总条数文案；传函数可自定义 */
    totalText?: React.ReactNode | ((total: number) => React.ReactNode);
    /** 切页回调（分页条内部点页码时用；翻页按钮走 state.setPage） */
    onChange?: (page: number, pageSize: number) => void;
    /** 换每页条数回调 */
    onPageSizeChange?: (pageSize: number) => void;
    /** 每页条数选项；给了就渲染下拉选择器 */
    pageSizeOptions?: number[];
    className?: string;
}

/**
 * 分页条（PC 表格底部）。
 *
 * 结构：左「共 N 条」 · 中「每页 M 条」下拉 · 右「上一页 + 页码 + 下一页 + 跳页输入」。
 * 全部是原生 button/input/select —— PC 端要求键盘可达与焦点可见，
 * 自造 div 控件会丢焦点环与 Tab 顺序。
 */
export function TablePagination({
    state,
    mode,
    showTotal = true,
    totalText,
    onChange,
    onPageSizeChange,
    pageSizeOptions,
    className,
}: TablePaginationProps) {
    const { current, pageCount, pageSize, total, startPage, setPage } = state;
    const lastPage = startPage + pageCount - 1;
    const isFirst = current <= startPage;
    const isLast = current >= lastPage;

    const totalNode = typeof totalText === 'function' ? totalText(total) : totalText;

    const items = buildPageItems(current, pageCount, startPage);

    return (
        <div
            data-slot="table-pagination"
            data-mode={mode}
            className={cn(
                'flex flex-wrap items-center justify-between',
                'gap-[var(--bv-table-pagination-gap)]',
                'px-[var(--bv-table-pagination-padding-x)]',
                'py-[var(--bv-table-pagination-padding-y)]',
                'text-bv-sm leading-[var(--bv-table-pagination-line-height)] text-bv-text-2',
                className,
            )}
        >
            {/* 左：总条数 */}
            {showTotal ? (
                <div data-slot="table-pagination-total" className="shrink-0">
                    {totalNode ?? `共 ${total} 条`}
                </div>
            ) : (
                <span />
            )}

            {/* 右：每页条数 + 翻页 */}
            <div
                data-slot="table-pagination-actions"
                className="flex flex-wrap items-center gap-[var(--bv-table-pagination-gap)]"
            >
                {pageSizeOptions && pageSizeOptions.length > 0 ? (
                    <label data-slot="table-pagination-size" className="inline-flex items-center gap-[var(--bv-table-pagination-gap)]">
                        <select
                            value={pageSize}
                            aria-label="每页条数"
                            onChange={(event) => {
                                const next = Number(event.target.value);
                                if (!Number.isFinite(next) || next <= 0) return;
                                onPageSizeChange?.(next);
                                // 换页大小后回到第一页：停留在第 5 页但每页从 10 变 100
                                // 会落到空区间（本地切片），语义上不合理。
                                setPage(startPage);
                                onChange?.(startPage, next);
                            }}
                            className={cn(
                                'cursor-pointer rounded-bv-sm border border-bv-border bg-bv-surface',
                                'px-[var(--bv-table-pagination-gap)] py-[var(--bv-table-pagination-control-padding-y)]',
                                'text-bv-sm text-bv-text',
                            )}
                        >
                            {pageSizeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option} 条/页
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}

                <button
                    type="button"
                    data-slot="table-pagination-prev"
                    aria-label="上一页"
                    disabled={isFirst}
                    onClick={() => setPage(current - 1)}
                    className={paginationButtonClass(isFirst)}
                >
                    <Icon name="arrow-left" size={12} />
                </button>

                <div data-slot="table-pagination-pages" className="flex items-center gap-[var(--bv-table-pagination-gap)]">
                    {items.map((item, index) =>
                        typeof item === 'number' ? (
                            <button
                                key={`page-${item}`}
                                type="button"
                                data-slot="table-pagination-page"
                                data-page={item}
                                aria-current={item === current ? 'page' : undefined}
                                aria-label={`第 ${item} 页`}
                                onClick={() => setPage(item)}
                                className={paginationButtonClass(false, item === current)}
                            >
                                {item}
                            </button>
                        ) : (
                            <span
                                key={`${item}-${index}`}
                                data-slot="table-pagination-ellipsis"
                                aria-hidden="true"
                                className="px-[var(--bv-table-pagination-gap)] text-bv-text-3"
                            >
                                …
                            </span>
                        ),
                    )}
                </div>

                <button
                    type="button"
                    data-slot="table-pagination-next"
                    aria-label="下一页"
                    disabled={isLast}
                    onClick={() => setPage(current + 1)}
                    className={paginationButtonClass(isLast)}
                >
                    <Icon name="arrow" size={12} />
                </button>

                {/* 跳到指定页：数字输入，回车/失焦生效 */}
                <label data-slot="table-pagination-jumper" className="inline-flex items-center gap-[var(--bv-table-pagination-gap)]">
                    <span>跳至</span>
                    <input
                        type="number"
                        min={startPage}
                        max={lastPage}
                        defaultValue={current}
                        aria-label="跳至页码"
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            const next = Number(event.currentTarget.value);
                            if (!Number.isFinite(next)) return;
                            setPage(next);
                        }}
                        onBlur={(event) => {
                            const next = Number(event.currentTarget.value);
                            if (!Number.isFinite(next)) return;
                            setPage(next);
                        }}
                        className={cn(
                            'w-[var(--bv-table-pagination-jumper-width)] rounded-bv-sm',
                            'border border-bv-border bg-bv-surface',
                            'px-[var(--bv-table-pagination-gap)] py-[var(--bv-table-pagination-control-padding-y)]',
                            'text-bv-sm text-bv-text',
                        )}
                    />
                    <span>页</span>
                </label>
            </div>
        </div>
    );
}

/** 分页按钮的类名（disabled / active 两档） */
function paginationButtonClass(disabled: boolean, active = false): string {
    return cn(
        'inline-flex min-w-[var(--bv-table-pagination-button-size)] items-center justify-center',
        'rounded-bv-sm border border-bv-border bg-bv-surface',
        'px-[var(--bv-table-pagination-gap)] py-[var(--bv-table-pagination-control-padding-y)]',
        'text-bv-sm leading-[var(--bv-table-pagination-line-height)] text-bv-text',
        disabled
            ? 'cursor-not-allowed text-bv-text-3 opacity-50'
            : 'cursor-pointer hover:border-bv-primary hover:text-bv-primary',
        active && 'border-bv-primary bg-bv-primary text-bv-white',
    );
}