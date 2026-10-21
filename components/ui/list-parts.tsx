import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { DeviceMode } from '@/hooks/use-device-mode';
import type { ListStatus } from '@/hooks/use-list-state';

/**
 * Bivane List · 共用零件
 *
 * List 是**模式 C**（H5 无限滚动 + 触底加载 + 下拉刷新 / PC 滚动加载 + 刷新按钮 + 虚拟滚动），
 * 两份实现分处 components/h5/ 与 components/pc/，但「一个列表项长什么样」
 * 和「底部状态提示长什么样」是同一份东西，收在这里给两边复用。
 *
 * 跨模式共用零件的**外壳差异必须走 JS 分支，不能用 `bv-h5:` / `bv-pc:` 变体**
 * （契约 17）：变体编译成后代选择器，元素自身带 data-mode 时不命中，
 * 而共用零件未必有 data-mode 祖先。所以这里用 `listItemClass(mode, …)`
 * 纯函数出类名（架构 §6.5 ③）。
 *
 * 槽名按「模式 + 角色」区分（H5 `list-item` / PC `list-pc-item`），
 * 避免两套实现的样式互相串（契约第 14 条）。
 */

/**
 * 两份实现共享的视图契约。
 *
 * 分发层把状态与回调打包成这份对象传给 h5/ 与 pc/，
 * 两端实现都只做**受控展示层**（与 Search 同一套路），
 * 因此双模式 props 天然一致（契约第 9 条）。
 */
export interface ListViewProps {
    /** 已解析的模式 */
    mode: DeviceMode;
    /** 列表数据 */
    data: readonly unknown[];
    /** 渲染单项 */
    renderItem: (item: unknown, index: number) => React.ReactNode;
    /** 行 key（默认用下标） */
    rowKey: (item: unknown, index: number) => string;
    /** 当前状态 */
    status: ListStatus;
    /** 触底加载 */
    onLoad?: () => void;
    /** 下拉刷新 / 顶部刷新按钮 */
    onRefresh?: () => void;
    /** 出错重试 */
    onRetry?: () => void;
    /** 点击某项 */
    onItemClick?: (item: unknown, index: number) => void;
    /** 加载中文案 */
    loadingText: React.ReactNode;
    /** 「没有更多」文案 */
    finishedText: React.ReactNode;
    /** 出错文案 */
    errorText: React.ReactNode;
    /** 触底提前量（px） */
    threshold: number;
    /** 是否支持下拉刷新（仅 H5 生效） */
    pullRefresh: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export interface ListItemViewProps {
    /** 已解析的模式 */
    mode: DeviceMode;
    /** 列表项内容 */
    children: React.ReactNode;
    /** 是否可点击 */
    clickable?: boolean;
    /** 点击回调 */
    onClick?: () => void;
    /** 额外的类名 */
    className?: string;
}

/** 各模式下的槽名前缀：H5 一套、PC 一套 */
export function listSlotPrefix(mode: DeviceMode): 'list-item' | 'list-pc-item' {
    return mode === 'mobile' ? 'list-item' : 'list-pc-item';
}

/**
 * 列表项的类名（纯函数）。
 *
 * H5：整行可点，最小热区 48px（契约第 5 条：触屏 ≥44px）
 * PC：最小行高 36px，hover 有底色，无按压态
 *
 * **刻意不加内边距**：List 是「数据获取容器」，行的排版归业务的内容组件
 * （Cell / 自定义块）管。若 List 自己也加 padding，业务再套一层 Cell
 * 就会得到双层内边距 —— 行高被撑到 68px（实测），页面节奏直接被破坏。
 * 同理用 min-h 而不是固定 h：内容比基准高时撑开，不裁切。
 */
export function listItemClass(mode: DeviceMode, clickable: boolean): string {
    const base = cn(
        'flex w-full items-center border-0 bg-bv-surface text-left',
        'text-bv-md text-bv-text',
    );

    if (mode === 'mobile') {
        return cn(
            base,
            'min-h-[var(--bv-list-item-min-height)]',
            'leading-[var(--bv-list-item-line-height)]',
            clickable && 'cursor-pointer active:bg-bv-active',
        );
    }

    return cn(
        base,
        'min-h-[var(--bv-list-pc-item-height)]',
        'text-bv-sm leading-[var(--bv-list-pc-item-line-height)]',
        clickable && 'cursor-pointer hover:bg-bv-muted',
    );
}

/** 一个列表项 */
export function ListItemView({
    mode,
    children,
    clickable = false,
    onClick,
    className,
}: ListItemViewProps) {
    const prefix = listSlotPrefix(mode);

    if (!clickable) {
        return (
            <div
                data-slot={prefix}
                className={cn(listItemClass(mode, false), className)}
            >
                {children}
            </div>
        );
    }

    return (
        <button
            type="button"
            data-slot={prefix}
            className={cn(listItemClass(mode, true), className)}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export interface ListStatusViewProps {
    /** 已解析的模式 */
    mode: DeviceMode;
    /** 当前状态 */
    status: ListStatus;
    /** 加载中文案 */
    loadingText: React.ReactNode;
    /** 「没有更多」文案 */
    finishedText: React.ReactNode;
    /** 出错文案 */
    errorText: React.ReactNode;
    /** 点击重试 */
    onRetry?: () => void;
}

/**
 * 列表底部/顶部的状态提示。
 *
 * 四个状态对应四种提示：
 *   loading  → 转圈 + 加载中
 *   finished → 没有更多了
 *   error    → 错误文案 + 可点的重试
 *   idle     → 不渲染（首屏还没触发任何加载）
 *
 * 提示区始终占位（min-height），避免「加载中 → 加载完」时列表整体上跳。
 */
export function ListStatusView({
    mode,
    status,
    loadingText,
    finishedText,
    errorText,
    onRetry,
}: ListStatusViewProps) {
    if (status === 'idle') return null;

    const prefix = mode === 'mobile' ? 'list-status' : 'list-pc-status';

    return (
        <div
            data-slot={prefix}
            data-status={status}
            className={cn(
                'flex min-h-[var(--bv-list-status-min-height)] items-center justify-center',
                'px-[var(--bv-list-status-padding-x)] py-[var(--bv-list-status-padding-y)]',
                'text-bv-sm leading-[var(--bv-list-status-line-height)] text-bv-text-3',
            )}
        >
            {status === 'loading' ? (
                <span data-slot={`${prefix}-loading`} className="inline-flex items-center">
                    <Icon name="loading" className="mr-[var(--bv-list-status-icon-gap)] animate-spin" />
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
                            className="ml-[var(--bv-list-status-icon-gap)] cursor-pointer border-0 bg-transparent p-0 text-bv-primary"
                        >
                            重试
                        </button>
                    ) : null}
                </span>
            ) : null}
        </div>
    );
}
