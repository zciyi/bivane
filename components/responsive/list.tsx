import * as React from 'react';
import { H5List } from '@/components/h5/list';
import { PcList } from '@/components/pc/list';
import type { ListViewProps } from '@/components/ui/list-parts';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import { useListState } from '@/hooks/use-list-state';

/**
 * Bivane List · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * ┌ H5 ── 竖向滚动容器 + 触底哨兵加载 + 顶部下拉刷新手势
 * └ PC ── 固定高度滚动容器 + 滚到底加载 + 顶部「刷新」按钮 + 可选虚拟滚动
 *
 * 为什么是模式 C 而不是 B：
 *   两端连「数据从哪来」都对不上 —— H5 是**触底哨兵 + 下拉手势**这套触屏范式，
 *   PC 是**滚动容器 + 显式刷新按钮**这套鼠标范式。
 *   强行换壳会得到「在桌面端用手指下拉刷新」这种四不像。
 *
 * 状态归属：三态（loading / finished / error）**全部受控**，
 * 分发层只负责把三态合成一个 status 并下发，两端实现都是受控展示层。
 * 为什么不全放分发层内部管理：列表数据是业务异步取的，
 * 组件库替业务持有 loading 会导致「请求已发出但 loading 还没置 true」的窗口，
 * 期间用户能连点触发重复请求。契约第 9 条要求受控展示态直接派生自 prop，
 * 这里连数据获取状态也一并受控，语义最干净。
 *
 * 虚拟滚动 / 固定高度 / 触底提前量等参数是**PC 端形态参数**，
 * H5 端忽略（两端 props 完全一致，差异由 mode 内部消化）。
 */

export interface ListProps {
    /** 列表数据 */
    data: readonly unknown[];
    /** 渲染单项 */
    renderItem: (item: unknown, index: number) => React.ReactNode;
    /** 行 key（默认用下标） */
    rowKey?: (item: unknown, index: number) => string;
    /** 加载中（受控） */
    loading?: boolean;
    /** 已无更多（受控） */
    finished?: boolean;
    /** 加载出错（受控） */
    error?: boolean;
    /** 触底加载 */
    onLoad?: () => void;
    /** 下拉刷新（H5 手势 / PC 顶部按钮，两端等价） */
    onRefresh?: () => void;
    /** 出错后重试 */
    onRetry?: () => void;
    /** 点击某项 */
    onItemClick?: (item: unknown, index: number) => void;
    /** 加载中文案，默认「加载中…」 */
    loadingText?: React.ReactNode;
    /** 「没有更多」文案，默认「没有更多了」 */
    finishedText?: React.ReactNode;
    /** 出错文案，默认「加载失败」 */
    errorText?: React.ReactNode;
    /** 触底提前量（px），默认 80 */
    threshold?: number;
    /** 是否支持下拉刷新（H5），默认 true */
    pullRefresh?: boolean;
    /** PC：启用虚拟滚动（需同时给 itemHeight） */
    virtual?: boolean;
    /** PC：虚拟滚动固定行高（px） */
    itemHeight?: number;
    /** PC：滚动容器高度 */
    height?: number | string;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

export const List = React.forwardRef<HTMLDivElement, ListProps>(function List(
    {
        data,
        renderItem,
        rowKey,
        loading = false,
        finished = false,
        error = false,
        onLoad,
        onRefresh,
        onRetry,
        onItemClick,
        loadingText = '加载中…',
        finishedText = '没有更多了',
        errorText = '加载失败',
        threshold = 80,
        pullRefresh = true,
        virtual = false,
        itemHeight,
        height,
        className,
        forceMode,
    },
    ref,
) {
    const mode = useDeviceMode(forceMode);
    const state = useListState({
        loading,
        finished,
        error,
        onLoad,
        onRefresh,
        onRetry,
    });

    const viewProps: ListViewProps = {
        mode,
        data,
        renderItem,
        rowKey: rowKey ?? ((_item, index) => String(index)),
        status: state.status,
        onLoad: state.requestLoad,
        // onRefresh 只在业务真的传了才透传：
        // 否则 PC 端会永远渲染一个「刷新」按钮，业务却没接刷新逻辑。
        onRefresh: onRefresh ? state.requestRefresh : undefined,
        onRetry: onRetry ? state.requestRetry : undefined,
        onItemClick,
        loadingText,
        finishedText,
        errorText,
        threshold,
        pullRefresh,
        className,
    };

    return mode === 'mobile' ? (
        <H5List ref={ref} {...viewProps} />
    ) : (
        <PcList
            ref={ref}
            {...viewProps}
            virtual={virtual}
            itemHeight={itemHeight}
            height={height}
        />
    );
});
