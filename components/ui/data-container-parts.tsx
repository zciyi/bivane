import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { ListStatus } from '@/hooks/use-list-state';

/**
 * Bivane DataContainer · 共用零件（哨兵 + 加载状态区）
 *
 * DataContainer 是**加载层**：「数据怎么来」。
 * 它对内容层（Table / List / 任意 children）完全透明 ——
 * 只在下方挂一个哨兵和一条状态提示。
 *
 * ## 为什么拆成独立组件而不是塞进 Table
 *
 * Table 只回答「一行数据长什么样」，DataContainer 只回答「数据怎么来」。
 * 低代码这类场景下两端要渲染的东西会持续演化（表格 → 看板 → 树形列表），
 * 而加载策略（分页 / 无限滚动 / 虚拟滚动 / 预加载）也在独立演化。
 * 两条线分开走，才不会互相拖累 —— 换渲染器不动加载层，加载策略升级不动渲染器。
 *
 * 跨模式共用零件的外壳差异走 JS 分支（契约 17），所以这里传 `mode` 而不是用变体类。
 */

/** 哨兵 + 状态区的类名（按模式给密度差异） */
export function loadStatusClass(mode: 'mobile' | 'desktop'): string {
    return cn(
        'flex min-h-[var(--bv-load-status-min-height)] items-center justify-center',
        'px-[var(--bv-load-status-padding-x)] py-[var(--bv-load-status-padding-y)]',
        'text-bv-sm leading-[var(--bv-load-status-line-height)] text-bv-text-3',
        mode === 'desktop' && 'bg-bv-surface',
    );
}

export interface LoadSentinelProps {
    /** 已解析的模式 */
    mode: 'mobile' | 'desktop';
    /** 触发加载 */
    onLoad?: () => void;
    /** 提前触发距离（px） */
    threshold?: number;
    /**
     * 滚动容器。给了则只在该容器内触发；
     * 不给则用视口（页面级滚动）。
     */
    root?: HTMLElement | null;
    /**
     * 是否启用 IntersectionObserver。
     *
     * 关掉后改用滚动几何判定（`isNearBottom`）——
     * 供无 IO 的环境或测试兜底；两者都不该同时生效。
     */
    useObserver?: boolean;
}

/**
 * 触底哨兵。
 *
 * 用 IntersectionObserver 而不是滚动轮询：哨兵只在「进入视口」那一刻触发一次，
 * 天然不重复；滚动轮询每次滚动都要重算距离，快滚时会连续命中。
 *
 * 容器与 children 的间距用 padding 占位，保证哨兵真的在内容末尾之外 ——
 * 否则内容不足一屏时哨兵一直可见，会立刻误触发一次加载。
 */
export function LoadSentinel({
    mode,
    onLoad,
    threshold = 80,
    root = null,
    useObserver = true,
}: LoadSentinelProps) {
    const sentinelRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !onLoad) return undefined;

        if (useObserver && typeof IntersectionObserver !== 'undefined') {
            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0]?.isIntersecting) onLoad();
                },
                { root, rootMargin: `0px 0px ${threshold}px 0px` },
            );
            observer.observe(sentinel);
            return () => observer.disconnect();
        }

        // 兜底：滚动几何判定（root 为 null 时看页面级滚动）
        const onScroll = () => {
            if (!root) return;
            const { scrollTop, clientHeight, scrollHeight } = root;
            if (scrollHeight - scrollTop - clientHeight <= threshold) onLoad();
        };
        const target: HTMLElement | Window = root ?? window;
        target.addEventListener('scroll', onScroll, { passive: true });
        return () => target.removeEventListener('scroll', onScroll);
    }, [onLoad, threshold, root, useObserver]);

    return (
        <div
            ref={sentinelRef}
            data-slot="data-container-sentinel"
            data-mode={mode === 'mobile' ? 'h5' : 'pc'}
            aria-hidden="true"
            className="h-px w-full"
        />
    );
}

export interface LoadStatusProps {
    /** 已解析的模式 */
    mode: 'mobile' | 'desktop';
    /** 当前状态 */
    status: ListStatus;
    /** 加载中文案 */
    loadingText?: React.ReactNode;
    /** 「没有更多」文案 */
    finishedText?: React.ReactNode;
    /** 出错文案 */
    errorText?: React.ReactNode;
    /** 重试 */
    onRetry?: () => void;
    className?: string;
}

/**
 * 加载状态区：加载中 / 没有更多 / 出错可重试。
 *
 * 恒占位（min-height）—— 否则「加载中 → 加载完」时内容会整体上跳。
 * `idle` 时不渲染（首屏还没触发任何加载）。
 */
export function LoadStatus({
    mode,
    status,
    loadingText = '加载中…',
    finishedText = '没有更多了',
    errorText = '加载失败',
    onRetry,
    className,
}: LoadStatusProps) {
    if (status === 'idle') return null;

    const prefix = mode === 'mobile' ? 'load-status' : 'load-status-pc';

    return (
        <div
            data-slot={prefix}
            data-status={status}
            className={cn(loadStatusClass(mode), className)}
        >
            {status === 'loading' ? (
                <span data-slot={`${prefix}-loading`} className="inline-flex items-center">
                    <Icon
                        name="loading"
                        className="mr-[var(--bv-load-status-icon-gap)] animate-spin"
                    />
                    {loadingText}
                </span>
            ) : null}

            {status === 'finished' ? (
                <span data-slot={`${prefix}-finished`}>{finishedText}</span>
            ) : null}

            {status === 'error' ? (
                <span data-slot={`${prefix}-error`} className="inline-flex items-center">
                    {errorText}
                    {onRetry ? (
                        <button
                            type="button"
                            data-slot={`${prefix}-retry`}
                            onClick={onRetry}
                            className="ml-[var(--bv-load-status-icon-gap)] cursor-pointer border-0 bg-transparent p-0 text-bv-primary"
                        >
                            重试
                        </button>
                    ) : null}
                </span>
            ) : null}
        </div>
    );
}