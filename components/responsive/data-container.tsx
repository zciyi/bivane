import * as React from 'react';
import { cn } from '@/lib/utils';
import { LoadSentinel, LoadStatus } from '@/components/ui/data-container-parts';
import { TablePagination } from '@/components/ui/table-pagination';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import {
    clampPage,
    computePageCount,
    sliceStartIndex,
    DEFAULT_PAGE_SIZE,
    type PaginationState,
} from '@/components/ui/table-pagination';
import { useListState, type ListStatus } from '@/hooks/use-list-state';

/**
 * Bivane DataContainer · 加载层容器
 *
 * ## 它只回答一个问题：「数据怎么来」
 *
 * 对内容层完全透明 —— `children` 可以是 Table、List、任何自定义渲染器。
 * DataContainer 不碰数据本身，只在正确时机通知业务去取。
 *
 * ## 为什么要独立于 Table（架构决策）
 *
 * 低代码这类场景下，两端要渲染的东西会持续演化（表格 → 看板 → 树形列表），
 * 而加载策略（分页 / 无限滚动 / 虚拟滚动 / 预加载）也在独立演化。
 * 两条线分开走，才不会互相拖累 —— 换渲染器不动加载层，反之亦然。
 *
 * ## 加载策略与 mode 正交（这是关键）
 *
 * 过去 Table 把「PC=分页、H5=滚动」焊死在分发层里，业务改不了。
 * 现在由业务显式声明 `loadStrategy`：
 * - `auto`（默认）：PC → 分页，H5 → 无限滚动（最常见的组合）
 * - `pagination`：两端都分页（记录详情页，手机也要一页一页翻）
 * - `infinite`：两端都无限滚动（2000 条的报表，手机也得滑）
 *
 * 这正是低代码 schema 里 `pageMode` 字段该映射的东西。
 *
 * **注意「切分」与「触发器」是两件事**：
 * 切分（组件切 vs 业务切）由 `children` 是函数还是节点决定，与 loadStrategy 无关。
 */

export type LoadStrategy = 'auto' | 'pagination' | 'infinite';

export type DataContainerChildren =
    | React.ReactNode
    | ((page: number, pageSize: number) => React.ReactNode);

export interface DataContainerProps {
    /** 内容层：任意渲染器（节点或按页渲染的函数） */
    children?: DataContainerChildren;
    /**
     * 加载策略（只管触发器），默认 `auto`：
     * - `auto`：PC 分页 / H5 无限滚动
     * - `pagination`：两端都分页
     * - `infinite`：两端都无限滚动
     *
     * **数据切分是另一件事**：children 传函数 → 组件调用它并传 `(page, pageSize)`
     * 由你自己切；传节点 → 原样渲染（数据已经切好了）。
     */
    loadStrategy?: LoadStrategy;
    /** 覆盖 loadStrategy 推导出的触发器（留作逃生口，一般不用传） */
    pagination?: boolean;
    /** 受控当前页 */
    current?: number;
    /** 非受控初始页 */
    defaultCurrent?: number;
    /** 每页条数，默认 10 */
    pageSize?: number;
    /** 总条数（remote 模式必给；local 模式不给则用 children 行数） */
    total?: number;
    /** 页码起始值，默认 1 */
    startPage?: number;
    /** 切页回调 */
    onPageChange?: (page: number, pageSize: number) => void;
    /** 是否显示总条数，默认 true */
    showTotal?: boolean;
    /** 总条数文案 */
    totalText?: React.ReactNode | ((total: number) => React.ReactNode);
    /** 每页条数选项 */
    pageSizeOptions?: number[];
    /** 换每页条数回调 */
    onPageSizeChange?: (pageSize: number) => void;

    /** 无限滚动：加载中（受控） */
    loading?: boolean;
    /** 无限滚动：已无更多（受控） */
    finished?: boolean;
    /** 无限滚动：出错（受控） */
    error?: boolean;
    /** 触底加载 */
    onLoad?: () => void;
    /** 下拉刷新（H5） */
    onRefresh?: () => void;
    /** 出错重试 */
    onRetry?: () => void;
    /** 提前触发距离（px），默认 80 */
    threshold?: number;

    /** 文案 */
    loadingText?: React.ReactNode;
    finishedText?: React.ReactNode;
    errorText?: React.ReactNode;

    className?: string;
    /** 逃生舱：强制某个模式 */
    forceMode?: DeviceMode;
}

export const DataContainer = React.forwardRef<HTMLDivElement, DataContainerProps>(
    function DataContainer(
        {
            children,
            loadStrategy = 'auto',
            pagination: paginationProp,
            current: controlledCurrent,
            defaultCurrent,
            pageSize = DEFAULT_PAGE_SIZE,
            total: totalProp,
            startPage = 1,
            onPageChange,
            showTotal = true,
            totalText,
            pageSizeOptions,
            onPageSizeChange,
            loading = false,
            finished = false,
            error = false,
            onLoad,
            onRefresh,
            onRetry,
            threshold = 80,
            loadingText,
            finishedText,
            errorText,
            className,
            forceMode,
        },
        ref,
    ) {
        const mode = useDeviceMode(forceMode);

        // ---- 策略解析：这里是本组件的核心 ----
        //
        // 「触发器」（分页条 / 哨兵）与「数据切分」（谁切）本来是正交的两件事。
        // 早期版本把两者焊成一层（用 strategy 直接推导触发器），
        // 结果 local 在 H5 下错误地渲染成分页条 —— local 的语义是
        // 「组件自己切数据」，它完全可以配哨兵（2000 条报表，手机滑到底自动加页）。
        //
        // 所以 loadStrategy 只描述**触发器**：auto 时按 mode 推导，其余两端统一。
        const trigger: 'pagination' | 'infinite' =
            loadStrategy === 'auto'
                ? mode === 'mobile'
                    ? 'infinite'
                    : 'pagination'
                : loadStrategy;

        // 显式 pagination prop 优先于 strategy（留给「两端同策略」的逃生口）
        const usePagination = paginationProp ?? trigger === 'pagination';
        const useInfinite = !usePagination;

        // ---- 分页状态（与 Table 同一套纯函数，语义完全一致）----
        const isCurrentControlled = controlledCurrent !== undefined;
        const [internalCurrent, setInternalCurrent] = React.useState(
            defaultCurrent ?? startPage,
        );
        const effectiveTotal = totalProp ?? 0;
        const pageCount = computePageCount(effectiveTotal, pageSize);
        const currentPage = clampPage(
            isCurrentControlled ? controlledCurrent : internalCurrent,
            pageCount,
            startPage,
        );

        const setPage = React.useCallback(
            (page: number) => {
                const next = clampPage(page, pageCount, startPage);
                if (next === currentPage) return;
                if (!isCurrentControlled) setInternalCurrent(next);
                onPageChange?.(next, pageSize);
            },
            [currentPage, isCurrentControlled, onPageChange, pageCount, pageSize, startPage],
        );

        const pageState: PaginationState = {
            current: currentPage,
            pageCount,
            pageSize,
            startPage,
            total: effectiveTotal,
            setPage,
        };

        // ---- 无限滚动状态（复用 List 的三态状态机）----
        const listState = useListState({
            loading,
            finished,
            error,
            onLoad,
            onRefresh,
            onRetry,
        });

        // ---- local 模式：本组件自己切分页数据 ----
        // ---- 内容层：children 是函数时按页调用，由业务自己切 ----
        //
        // 切分不绑定策略：只要 children 是函数就切，与 loadStrategy 无关。
        // 无限滚动策略下 currentPage 恒为 startPage，函数收到的就是第一页 ——
        // 业务要「一直往后加」就自己别切（传节点），要「翻页看数据」就用分页策略。
        const content = React.useMemo(() => {
            if (typeof children !== 'function') return children;
            const factory = children as (
                page: number,
                pageSize: number,
            ) => React.ReactNode;
            return factory(currentPage, pageSize);
        }, [children, currentPage, pageSize]);

        return (
            <div
                ref={ref}
                data-slot="data-container"
                data-mode={mode === 'mobile' ? 'h5' : 'pc'}
                data-strategy={trigger}
                className={cn(
                    'flex w-full flex-col',
                    mode === 'mobile' ? 'bg-bv-background' : 'bg-bv-surface',
                    className,
                )}
            >
                {/* 内容层 */}
                <div data-slot="data-container-content" className="min-w-0 flex-1">
                    {content}
                </div>

                {/* 无限滚动：哨兵 + 状态区 */}
                {useInfinite ? (
                    <>
                        <LoadSentinel
                            mode={mode}
                            onLoad={onLoad ? listState.requestLoad : undefined}
                            threshold={threshold}
                            root={null}
                        />
                        <LoadStatus
                            mode={mode}
                            status={listState.status}
                            loadingText={loadingText}
                            finishedText={finishedText}
                            errorText={errorText}
                            onRetry={onRetry ? listState.requestRetry : undefined}
                        />
                    </>
                ) : null}

                {/* 分页：底部页码条 */}
                {usePagination ? (
                    <TablePagination
                        state={pageState}
                        mode={mode === 'mobile' ? 'h5' : 'pc'}
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

export type { ListStatus };
export { sliceStartIndex };