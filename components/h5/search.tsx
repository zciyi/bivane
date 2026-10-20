import * as React from 'react';
import { cn } from '@/lib/utils';
import { Popup } from '@/components/responsive/popup';
import { Icon } from '@/components/ui/icon';
import {
    SearchInputShell,
    SearchSuggestionList,
    type SearchViewProps,
} from '@/components/ui/search-parts';

/**
 * Bivane Search · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：内联搜索条（只读，点击/聚焦展开）+ 全屏搜索页（Popup position=fullscreen）。
 * 全屏页顶部是「返回 + 可编辑输入」，主体在「历史记录」与「建议列表」之间切换：
 * 无关键词且有历史 → 历史区；否则 → 建议列表（静态过滤或异步防抖结果）。
 *
 * 内联条为什么用只读输入：
 * 避免「点一下先弹起系统键盘、再盖一层全屏页」的双重键盘抖动；
 * 真正的输入发生在全屏页里，内联条只负责「进入任务」与回显结果。
 */

/** 全屏页打开即聚焦：把聚焦放进 ref 回调（Presence 晚挂载，依赖 open 的 effect 拿不到 ref） */
export const H5Search = React.forwardRef<HTMLDivElement, SearchViewProps>(function H5Search(
    {
        mode,
        open,
        onOpenChange,
        value,
        onValueChange,
        onSubmit,
        onClear,
        suggestions,
        suggestionsLoading,
        onPick,
        history,
        showHistory,
        onPickHistory,
        onRemoveHistory,
        onClearHistory,
        placeholder,
        disabled,
        readonly,
        clearable,
        shape,
        label,
        emptyText,
        loadingText,
        historyText,
        clearHistoryText,
        ariaLabel,
        id,
        className,
    },
    ref,
) {
    const isMobile = mode === 'mobile';
    const hasKeyword = value.trim().length > 0;
    const showHistorySection = !hasKeyword && showHistory && history.length > 0;

    const setFullInputRef = React.useCallback(
        (node: HTMLInputElement | null) => {
            if (node && open && typeof node.focus === 'function') node.focus();
        },
        [open],
    );

    const openFull = React.useCallback(() => {
        if (!disabled) onOpenChange(true);
    }, [disabled, onOpenChange]);

    return (
        <div ref={ref} data-slot="search" data-mode={isMobile ? 'h5' : 'pc'} className={className}>
            {/* 内联搜索条：只读，作用是「进入全屏搜索任务」+ 回显当前词 */}
            <SearchInputShell
                mode={mode}
                value={value}
                onValueChange={onValueChange}
                onClear={onClear}
                placeholder={placeholder}
                disabled={disabled}
                readonly
                clearable={false}
                shape={shape}
                label={label}
                ariaLabel={ariaLabel ?? '搜索'}
                id={id}
                onFocus={openFull}
                onClick={openFull}
            />

            <Popup
                open={open}
                forceMode={mode}
                onOpenChange={onOpenChange}
                position="fullscreen"
                round={false}
                scrollable={false}
                closeOnClickOverlay={false}
            >
                <div className="flex h-full flex-col bg-bv-surface">
                    {/* 顶部：返回 + 可编辑输入 */}
                    <div
                        data-slot="search-h5-header"
                        className="flex min-h-[var(--bv-search-h5-header-height)] shrink-0 items-center gap-[var(--bv-search-icon-gap)] border-b border-bv-border px-[var(--bv-search-h5-body-padding)]"
                    >
                        <button
                            type="button"
                            data-slot="search-h5-back"
                            aria-label="返回"
                            onClick={() => onOpenChange(false)}
                            className="bv-focus-ring -ml-[var(--bv-search-icon-gap)] shrink-0 cursor-pointer rounded-[var(--bv-radius-sm)] p-[var(--bv-search-icon-gap)] text-[var(--bv-text-2)] hover:text-[var(--bv-text)]"
                        >
                            <Icon name="arrow-left" size="var(--bv-search-h5-back-icon-size)" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <SearchInputShell
                                mode={mode}
                                value={value}
                                onValueChange={onValueChange}
                                onSubmit={onSubmit}
                                onClear={onClear}
                                placeholder={placeholder}
                                disabled={disabled}
                                readonly={readonly}
                                clearable={clearable}
                                shape={shape}
                                ariaLabel={ariaLabel ?? '搜索'}
                                inputRef={setFullInputRef}
                            />
                        </div>
                    </div>

                    {/* 主体：历史记录 或 建议列表 */}
                    <div
                        data-slot="search-h5-body"
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--bv-search-h5-body-padding)]"
                    >
                        {showHistorySection ? (
                            <div data-slot="search-h5-history">
                                <div className="flex items-center justify-between py-[var(--bv-search-h5-section-gap)]">
                                    <span
                                        data-slot="search-h5-history-title"
                                        className="text-[length:var(--bv-search-h5-section-title-font)] leading-[var(--bv-search-h5-section-title-line-height)] text-[var(--bv-text-3)]"
                                    >
                                        {historyText}
                                    </span>
                                    <button
                                        type="button"
                                        data-slot="search-h5-history-clear"
                                        onClick={onClearHistory}
                                        className="bv-focus-ring cursor-pointer rounded-[var(--bv-radius-sm)] px-[var(--bv-search-icon-gap)] text-[length:var(--bv-search-h5-section-title-font)] leading-[var(--bv-search-h5-section-title-line-height)] text-[var(--bv-text-3)] hover:text-[var(--bv-text-2)]"
                                    >
                                        {clearHistoryText}
                                    </button>
                                </div>
                                {history.map((text) => (
                                    <div
                                        key={text}
                                        role="button"
                                        data-slot="search-h5-history-item"
                                        onClick={() => onPickHistory(text)}
                                        className={cn(
                                            'flex h-[var(--bv-search-h5-row-height)] cursor-pointer items-center',
                                            'gap-[var(--bv-search-row-gap)]',
                                            'text-[length:var(--bv-search-row-font)] leading-[var(--bv-search-row-line-height)]',
                                        )}
                                    >
                                        <Icon
                                            name="clock"
                                            size="var(--bv-search-row-icon-size)"
                                            className="shrink-0 text-[var(--bv-text-3)]"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-[var(--bv-text)]">
                                            {text}
                                        </span>
                                        <button
                                            type="button"
                                            aria-label={`删除 ${text}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRemoveHistory(text);
                                            }}
                                            className="bv-focus-ring shrink-0 cursor-pointer rounded-full p-[var(--bv-search-icon-gap)] text-[var(--bv-text-3)] hover:text-[var(--bv-text-2)]"
                                        >
                                            <Icon name="cross" size="var(--bv-search-row-icon-size)" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <SearchSuggestionList
                                mode={mode}
                                suggestions={suggestions}
                                onPick={onPick}
                                loading={suggestionsLoading}
                                emptyText={emptyText}
                                loadingText={loadingText}
                                ariaLabel={ariaLabel ?? '搜索建议'}
                            />
                        )}
                    </div>
                </div>
            </Popup>
        </div>
    );
});