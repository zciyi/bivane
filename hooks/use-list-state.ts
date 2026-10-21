import * as React from 'react';

/**
 * Bivane List · 数据获取状态机（跨模式共享逻辑）
 *
 * 交互定义见 bivane-responsive-matrix.md §2.3（List：模式 C）
 *
 *   ┌ H5 ── 容器内无限滚动 + 触底哨兵加载 + 顶部下拉刷新
 *   └ PC ── 容器内滚动加载 + 顶部「刷新」按钮（等价交互）+ 可选虚拟滚动
 *
 * 为什么状态机是共享的：
 *   两端虽然触发加载的方式不同（哨兵 vs 滚动位置），但**「什么时候允许再发一次请求」**
 *   的判定完全一致 —— loading 期间不重复触发、finished 之后不再触发、
 *   error 只能靠显式重试解除。这套判定必须是同一份，否则两端在边界条件下会分叉。
 *
 * 纯函数优先：判定逻辑全部抽成纯函数，边界可直接单测；
 * React 绑定（useListState）只做一层薄壳。
 */

/** 列表的四种状态 */
export type ListStatus = 'idle' | 'loading' | 'finished' | 'error';

export interface ListStatusInput {
    /** 加载中（受控） */
    loading?: boolean;
    /** 已无更多（受控） */
    finished?: boolean;
    /** 加载出错（受控） */
    error?: boolean;
}

/**
 * 由三个受控布尔推出唯一状态。
 *
 * 优先级：error > loading > finished > idle。
 *
 * 为什么 error 压过 loading：出错后业务通常会把 loading 置回 false，
 * 但存在「请求失败的那一瞬间 loading 还没落回 false」的中间态 ——
 * 此时必须显示「加载失败，点击重试」而不是转圈，否则用户会一直等一个已经失败的请求。
 */
export function resolveListStatus({
    loading = false,
    finished = false,
    error = false,
}: ListStatusInput): ListStatus {
    if (error) return 'error';
    if (loading) return 'loading';
    if (finished) return 'finished';
    return 'idle';
}

/** 触底判定的输入（滚动容器几何） */
export interface NearBottomInput {
    /** 当前滚动位置 */
    scrollTop: number;
    /** 视口高度 */
    clientHeight: number;
    /** 内容总高 */
    scrollHeight: number;
    /** 提前量：距离底部多少像素内就认为触底 */
    threshold: number;
}

/**
 * 是否已接近底部。
 *
 * scrollHeight 为 0（内容还没渲染 / jsdom 不做布局）时一律返回 false ——
 * 否则首帧就会误判触底并立刻发一次请求。
 */
export function isNearBottom({
    scrollTop,
    clientHeight,
    scrollHeight,
    threshold,
}: NearBottomInput): boolean {
    if (scrollHeight <= 0) return false;
    const distance = scrollHeight - scrollTop - clientHeight;
    return distance <= Math.max(0, threshold);
}

/** 下拉刷新的四种状态 */
export type PullStatus = 'idle' | 'pulling' | 'ready' | 'loading';

export interface PullStatusInput {
    /** 当前下拉位移（px，已做阻尼） */
    distance: number;
    /** 触发刷新的阈值（px） */
    threshold: number;
    /** 正在刷新（受控） */
    loading?: boolean;
}

/**
 * 下拉状态判定。
 *
 * - idle：没有位移
 * - pulling：位移中但未到阈值
 * - ready：位移到阈值以上，松手即刷新
 * - loading：刷新进行中
 */
export function resolvePullStatus({
    distance,
    threshold,
    loading = false,
}: PullStatusInput): PullStatus {
    if (loading) return 'loading';
    if (distance <= 0) return 'idle';
    if (distance >= Math.max(0, threshold)) return 'ready';
    return 'pulling';
}

/** 下拉位移的阻尼上限：拉到底也不会超过实际手指位移的该比例 */
export const PULL_DAMPING = 0.5;

/**
 * 下拉位移换算：手指位移 → 实际位移（带阻尼 + 上限）。
 *
 * 阻尼 0.5 是刻意的：手指拉 200px 只让内容跟 100px，
 * 避免小屏上内容被拉出大片空白，也避免松手瞬间的位移突变。
 */
export function computePullDistance(
    rawDelta: number,
    maxDistance: number,
    damping: number = PULL_DAMPING,
): number {
    if (rawDelta <= 0) return 0;
    return Math.min(Math.max(0, maxDistance), rawDelta * damping);
}

export interface UseListStateOptions {
    /** 加载中（受控） */
    loading?: boolean;
    /** 已无更多（受控） */
    finished?: boolean;
    /** 加载出错（受控） */
    error?: boolean;
    /** 触底加载 */
    onLoad?: () => void;
    /** 下拉刷新 / 顶部刷新按钮 */
    onRefresh?: () => void;
    /** 出错后重试 */
    onRetry?: () => void;
}

export interface ListState {
    /** 当前状态 */
    status: ListStatus;
    /** 是否允许再次触发加载（idle 才允许） */
    canLoad: boolean;
    /** 触发加载（内部带守卫：非 idle 直接忽略） */
    requestLoad: () => void;
    /** 触发刷新 */
    requestRefresh: () => void;
    /** 触发重试（等价于重新走一次加载） */
    requestRetry: () => void;
}

/**
 * List 状态机绑定。
 *
 * 三态全部受控（对齐 Vant van-list 的 `v-model:loading` / `finished` / `error`），
 * 组件不持有数据也不发请求，只负责「在正确时机通知业务去取数据」。
 *
 * 守卫用 ref 记录「本次已触发」：
 *   loading 由业务异步落回 false，存在同一帧内被调用两次的窗口
 *   （例如哨兵与滚动监听同时命中）。用 ref 做同步标记可以堵住这个窗口，
 *   而 `status` 派生值在同一帧内不会更新，靠它守卫会漏。
 */
export function useListState({
    loading = false,
    finished = false,
    error = false,
    onLoad,
    onRefresh,
    onRetry,
}: UseListStateOptions): ListState {
    const status = resolveListStatus({ loading, finished, error });
    const canLoad = status === 'idle';

    /** 本次已触发过加载；下一轮 loading 结束后由 effect 复位 */
    const triggeredRef = React.useRef(false);

    React.useEffect(() => {
        // loading 结束（回到 false）即视为「上一轮结束」，允许下一轮触发
        if (!loading) triggeredRef.current = false;
    }, [loading]);

    const requestLoad = React.useCallback(() => {
        const current = resolveListStatus({ loading, finished, error });
        if (current !== 'idle') return;
        if (triggeredRef.current) return;
        triggeredRef.current = true;
        onLoad?.();
    }, [loading, finished, error, onLoad]);

    const requestRefresh = React.useCallback(() => {
        onRefresh?.();
    }, [onRefresh]);

    const requestRetry = React.useCallback(() => {
        // 重试不经过「idle 才允许」的守卫：出错时状态就是 error，必须能重新发请求
        triggeredRef.current = true;
        onRetry?.();
    }, [onRetry]);

    return { status, canLoad, requestLoad, requestRefresh, requestRetry };
}
