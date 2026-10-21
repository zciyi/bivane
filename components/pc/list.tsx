import * as React from 'react';
import { cn } from '@/lib/utils';
import { ListItemView, ListStatusView } from '@/components/ui/list-parts';
import { isNearBottom } from '@/hooks/use-list-state';
import { useVirtualWindow } from '@/hooks/use-virtual-window';
import type { ListViewProps } from '@/components/ui/list-parts';

/**
 * Bivane List · PC 滚动加载（模式 C 的大屏实现）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * PC 的形态：**固定高度滚动容器 + 滚到底加载 + 顶部「刷新」按钮**。
 *
 * 「顶部刷新按钮」不是降级，而是 PC 的等价交互：
 *   鼠标没有「下拉」这个手势（拖拽滚动条 ≠ 下拉刷新），
 *   H5 的下拉手势在 PC 上没有对应物。能力等价原则要求「H5 独有能力在 PC 必须给等价交互，
 *   不得隐藏」—— 所以 PC 提供一个显式的刷新按钮，语义与 H5 的下拉刷新完全一致
 *   （都是「重新拉取第一页」），触发的是同一个 onRefresh 回调。
 *
 * 虚拟滚动（virtual + itemHeight）只在「扁平行 + 行高已知」时启用：
 *   行高由业务给定（itemHeight），不测量 —— 测量式虚拟滚动需要 ResizeObserver
 *   与不定高处理，复杂度收益不匹配。详见 use-virtual-window 的注释。
 */

export interface PcListProps extends ListViewProps {
    /** 启用虚拟滚动（需同时给 itemHeight） */
    virtual?: boolean;
    /** 虚拟滚动的固定行高（px） */
    itemHeight?: number;
    /** 滚动容器高度（虚拟滚动时必须给） */
    height?: number | string;
}

export const PcList = React.forwardRef<HTMLDivElement, PcListProps>(
    function PcList(
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
            virtual = false,
            itemHeight,
            height,
            className,
            style,
        },
        ref,
    ) {
        /** 虚拟滚动窗口：仅在开启且行高已知时启用 */
        const virtualEnabled = virtual && typeof itemHeight === 'number' && itemHeight > 0;
        /**
         * 视口高度：给了数值型 height 就直接用（不必等 DOM 测量 ——
         * jsdom 里 clientHeight 恒为 0，测量路径会让窗口化在测试里退化成全量渲染）。
         */
        const viewportHeight = typeof height === 'number' ? height : undefined;
        const { window, containerRef } = useVirtualWindow({
            itemHeight: itemHeight ?? 0,
            count: data.length,
            enabled: virtualEnabled,
            viewportHeight,
        });
        // 滚动容器复用 hook 的 containerRef（滚动位置要由它来测）

        /** 滚到底加载 */
        const handleScroll = React.useCallback(() => {
            const node = containerRef.current;
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
        }, [containerRef, onLoad, threshold]);

        /** 虚拟滚动时只渲染窗口内的行 */
        const visible = virtualEnabled
            ? data.slice(window.start, window.end)
            : data;
        const offset = virtualEnabled ? window.start : 0;

        return (
            <div
                ref={ref}
                data-slot="list"
                data-mode="pc"
                data-virtual={virtualEnabled ? 'true' : undefined}
                className={cn(
                    'flex h-full w-full flex-col overflow-hidden bg-bv-surface',
                    className,
                )}
                style={style}
            >
                {/* 顶部刷新按钮：PC 端「下拉刷新」的等价交互 */}
                {onRefresh ? (
                    <div
                        data-slot="list-pc-toolbar"
                        className={cn(
                            'flex shrink-0 items-center justify-end',
                            'border-b border-bv-border bg-bv-surface',
                            'px-[var(--bv-list-pc-toolbar-padding-x)]',
                            'py-[var(--bv-list-pc-toolbar-padding-y)]',
                        )}
                    >
                        <button
                            type="button"
                            data-slot="list-pc-refresh"
                            onClick={onRefresh}
                            className={cn(
                                'inline-flex cursor-pointer items-center border-0 bg-transparent p-0',
                                'text-bv-sm leading-[var(--bv-list-pc-item-line-height)] text-bv-primary',
                                'hover:opacity-80',
                            )}
                        >
                            刷新
                        </button>
                    </div>
                ) : null}

                <div
                    ref={containerRef}
                    data-slot="list-scroll"
                    onScroll={handleScroll}
                    className="h-full w-full flex-1 overflow-y-auto"
                    style={height === undefined ? undefined : { height }}
                >
                    {/* 虚拟滚动用上下 padding 撑出真实滚动高度 */}
                    {virtualEnabled && window.paddingTop > 0 ? (
                        <div
                            data-slot="list-pc-virtual-padding"
                            aria-hidden="true"
                            style={{ height: `${window.paddingTop}px` }}
                        />
                    ) : null}

                    <div data-slot="list-content">
                        {visible.map((item, index) => {
                            const realIndex = index + offset;
                            return (
                                <ListItemView
                                    key={rowKey(item, realIndex)}
                                    mode={mode}
                                    clickable={onItemClick !== undefined}
                                    onClick={
                                        onItemClick
                                            ? () => onItemClick(item, realIndex)
                                            : undefined
                                    }
                                >
                                    {renderItem(item, realIndex)}
                                </ListItemView>
                            );
                        })}
                    </div>

                    {virtualEnabled && window.paddingBottom > 0 ? (
                        <div
                            data-slot="list-pc-virtual-padding"
                            aria-hidden="true"
                            style={{ height: `${window.paddingBottom}px` }}
                        />
                    ) : null}

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

export type { PcListProps as PcListViewProps };
