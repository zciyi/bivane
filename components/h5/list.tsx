import * as React from 'react';
import { cn } from '@/lib/utils';
import { ListItemView, ListStatusView } from '@/components/ui/list-parts';
import {
    computePullDistance,
    isNearBottom,
    resolvePullStatus,
    type ListStatus,
    type PullStatus,
} from '@/hooks/use-list-state';
import type { ListViewProps } from '@/components/ui/list-parts';

/**
 * Bivane List · H5 无限滚动（模式 C 的小屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * H5 的形态：**竖向滚动容器 + 触底哨兵加载 + 顶部下拉刷新**。
 *
 * 为什么下拉刷新内联在 List 里而不是做成独立组件：
 *   矩阵把「下拉刷新」列在 List 的 H5 形态下，而 PullRefresh 独立组件不在本轮范围。
 *   内联实现保证下拉手势与「触底加载」共用同一份滚动容器 —— 拆成两个组件会得到
 *   两个嵌套滚动容器，手指拖动时两个都在抢滚动，行为不可预测。
 *
 * 触底用哨兵（IntersectionObserver）而不是 scroll 事件轮询：
 *   哨兵只在「进入视口」那一刻触发一次，天然不会重复；scroll 轮询需要在
 *   每次滚动事件里重算距离，且快滚时会连续命中。
 */

export const H5List = React.forwardRef<HTMLDivElement, ListViewProps>(
    function H5List(
        {
            mode,
            data,
            renderItem,
            rowKey,
            status,
            onLoad,
            onRefresh,
            onRetry,
            onItemClick,
            loadingText,
            finishedText,
            errorText,
            threshold,
            pullRefresh,
            className,
            style,
        },
        ref,
    ) {
        const scrollRef = React.useRef<HTMLDivElement | null>(null);
        const sentinelRef = React.useRef<HTMLDivElement | null>(null);

        /** 下拉手势状态 */
        const [pullDistance, setPullDistance] = React.useState(0);
        const [pullStatus, setPullStatus] = React.useState<PullStatus>('idle');
        /** 是否正在拖动（用于区分「手势中」与「程序滚动」） */
        const draggingRef = React.useRef(false);
        const startYRef = React.useRef(0);

        const pullThreshold = 64;
        const maxPull = 96;

        /** 触底加载：哨兵进入视口时触发 */
        React.useEffect(() => {
            const sentinel = sentinelRef.current;
            const root = scrollRef.current;
            if (!sentinel || !root) return undefined;
            if (typeof IntersectionObserver === 'undefined') return undefined;

            const observer = new IntersectionObserver(
                (entries) => {
                    const entry = entries[0];
                    if (entry?.isIntersecting) onLoad?.();
                },
                { root, rootMargin: `0px 0px ${threshold}px 0px` },
            );
            observer.observe(sentinel);
            return () => observer.disconnect();
        }, [onLoad, threshold]);

        /** 触底兜底：没有 IntersectionObserver 时用滚动几何判定 */
        const handleScroll = React.useCallback(() => {
            const node = scrollRef.current;
            if (!node) return;
            if (!isNearBottom({
                scrollTop: node.scrollTop,
                clientHeight: node.clientHeight,
                scrollHeight: node.scrollHeight,
                threshold,
            })) {
                return;
            }
            onLoad?.();
        }, [onLoad, threshold]);

        /** 下拉手势：pointer 事件统一处理触摸与鼠标 */
        const handlePointerDown = React.useCallback(
            (event: React.PointerEvent<HTMLDivElement>) => {
                if (!pullRefresh) return;
                const node = scrollRef.current;
                // 只在滚到顶时才接管手势，否则会抢走正常滚动
                if (!node || node.scrollTop > 0) return;
                draggingRef.current = true;
                startYRef.current = event.clientY;
            },
            [pullRefresh],
        );

        const handlePointerMove = React.useCallback(
            (event: React.PointerEvent<HTMLDivElement>) => {
                if (!draggingRef.current) return;
                const delta = event.clientY - startYRef.current;
                if (delta <= 0) {
                    // 往上推回时把位移归零并解除接管
                    if (pullDistance > 0) setPullDistance(0);
                    if (pullStatus !== 'idle') setPullStatus('idle');
                    return;
                }
                // 触屏上阻止默认滚动，否则页面会跟着一起下移
                if (event.pointerType === 'touch') event.preventDefault();
                const distance = computePullDistance(delta, maxPull);
                setPullDistance(distance);
                setPullStatus(resolvePullStatus({ distance, threshold: pullThreshold }));
            },
            [pullDistance, pullStatus],
        );

        const handlePointerUp = React.useCallback(() => {
            if (!draggingRef.current) return;
            draggingRef.current = false;
            const ready = pullStatus === 'ready';
            setPullDistance(0);
            setPullStatus('idle');
            if (ready) onRefresh?.();
        }, [onRefresh, pullStatus]);

        const pullText =
            pullStatus === 'ready'
                ? '松开立即刷新'
                : pullStatus === 'loading'
                  ? '正在刷新…'
                  : '下拉刷新';

        return (
            <div
                ref={ref}
                data-slot="list"
                data-mode="h5"
                data-pull-status={pullStatus}
                className={cn(
                    'relative flex h-full w-full flex-col overflow-hidden bg-bv-background',
                    className,
                )}
                style={style}
            >
                {/* 下拉刷新区：随手指位移下移，用绝对定位盖在内容上方 */}
                <div
                    data-slot="list-pull"
                    data-status={pullStatus}
                    aria-hidden={pullStatus === 'idle'}
                    className={cn(
                        'pointer-events-none absolute inset-x-0 top-0 z-[var(--bv-list-pull-z-index)]',
                        'flex items-center justify-center overflow-hidden',
                        'bg-bv-surface text-bv-sm leading-[var(--bv-list-status-line-height)] text-bv-text-2',
                    )}
                    style={{ height: `${pullDistance}px` }}
                >
                    {pullText}
                </div>

                {/* 滚动容器：内容整体随下拉位移下移 */}
                <div
                    ref={scrollRef}
                    data-slot="list-scroll"
                    onScroll={handleScroll}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={cn(
                        'h-full w-full flex-1 overflow-y-auto overscroll-contain',
                        'transition-transform duration-[var(--bv-list-pull-duration)]',
                        !draggingRef.current && pullDistance === 0 && 'duration-0',
                    )}
                    style={
                        pullDistance > 0
                            ? { transform: `translateY(${pullDistance}px)` }
                            : undefined
                    }
                >
                    <div data-slot="list-content">
                        {data.map((item, index) => (
                            <ListItemView
                                key={rowKey(item, index)}
                                mode={mode}
                                clickable={onItemClick !== undefined}
                                onClick={
                                    onItemClick ? () => onItemClick(item, index) : undefined
                                }
                            >
                                {renderItem(item, index)}
                            </ListItemView>
                        ))}
                    </div>

                    {/* 触底哨兵 */}
                    <div
                        ref={sentinelRef}
                        data-slot="list-sentinel"
                        aria-hidden="true"
                        className="h-px w-full"
                    />

                    <ListStatusView
                        mode={mode}
                        status={status}
                        loadingText={loadingText}
                        finishedText={finishedText}
                        errorText={errorText}
                        onRetry={onRetry}
                    />
                </div>
            </div>
        );
    },
);

export type { ListStatus };
