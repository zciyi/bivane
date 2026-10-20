import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import {
    SearchInputShell,
    SearchSuggestionList,
    type SearchViewProps,
} from '@/components/ui/search-parts';
import { nextSuggestionIndex } from '@/hooks/use-search-state';

/**
 * Bivane Search · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2 / §3.11
 *
 * 形态：内联输入框 + 锚定建议浮层。↑↓ 在建议间巡航、Enter 选中激活项或提交、
 * Esc / 点外部关闭。无历史区（历史是 H5 全屏页特有）。
 *
 * ⚠ 为什么这里**不用** `Popover.Trigger asChild`（矩阵 §3.11 对锚定浮层的通用要求）：
 * 搜索框是「**聚焦即开**」的 combobox，而 Trigger 是个「**点击/空格即切换**」的按钮。
 * 两者语义直接冲突：
 *   1. 输入框已聚焦时再点一下（移动光标），Trigger 的 click 会把浮层**切换关闭**；
 *   2. 用户按**空格**输入词时，keydown 冒泡到 Trigger 会被当成「空格切换」而关闭
 *      ——若为拦它 preventDefault，又会把「输入空格」一起拦掉。
 * 正确做法（本文件采用）：
 *   - `Popover.Anchor asChild` **只负责定位**（不加 Trigger 的切换语义）；
 *   - `open` 完全受控，由「聚焦 / 有关键词」驱动；
 *   - 用 `onPointerDownOutside` / `onFocusOutside` **显式把输入框判为「内部」**
 *     （target 在 pill 内则 preventDefault），从而补回 §3.11 想保住的那道保护：
 *     点回输入框 / 焦点落回输入框时浮层不被误关。其它任何外部交互照常关闭。
 * 这与 §3.11 的意图一致（保护「输入框属于浮层内部」），只是实现手段从 Trigger 换成了
 * Anchor + 显式外部判定——因为 Trigger 的 toggle 语义与输入框互斥。
 */

/** 面板与输入框之间的主轴间距，走 token */
const SIDE_OFFSET = 4;

export const PcSearch = React.forwardRef<HTMLDivElement, SearchViewProps>(function PcSearch(
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
        placeholder,
        disabled,
        readonly,
        clearable,
        shape,
        label,
        emptyText,
        loadingText,
        ariaLabel,
        id,
        className,
    },
    ref,
) {
    const pillRef = React.useRef<HTMLDivElement | null>(null);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const hasKeyword = value.trim().length > 0;

    // 关闭时重置巡航落点
    React.useEffect(() => {
        if (!open) setActiveIndex(-1);
    }, [open]);

    // 建议变少时把落点夹回合法范围（不在每次建议变化时强制归零，避免与键盘巡航打架）
    React.useEffect(() => {
        setActiveIndex((prev) => (prev >= suggestions.length ? -1 : prev));
    }, [suggestions.length]);

    const canOpen = !disabled && !readonly;

    // 聚焦即开：有静态热词（空关键词）或已有关键词才开，空且无热词不开空壳浮层
    const handleFocus = React.useCallback(() => {
        if (!canOpen) return;
        if (hasKeyword || suggestions.length > 0) onOpenChange(true);
    }, [canOpen, hasKeyword, suggestions.length, onOpenChange]);

    // 输入到非空关键词时即使此前没开（空关键词无热词）也要拉起浮层
    const handleChange = React.useCallback(
        (next: string) => {
            onValueChange(next);
            if (canOpen && next.trim() && !open) onOpenChange(true);
        },
        [onValueChange, canOpen, open, onOpenChange],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); // 防止页面滚动
            if (!open) onOpenChange(true);
            setActiveIndex((prev) =>
                nextSuggestionIndex(suggestions.length, prev, event.key === 'ArrowDown' ? 1 : -1),
            );
            return;
        }
        if (event.key === 'Escape') onOpenChange(false);
    };

    // Enter：有激活项则选中它，否则按当前词提交
    const handleEnter = React.useCallback(() => {
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
            onPick(suggestions[activeIndex]);
            return;
        }
        onSubmit();
    }, [activeIndex, suggestions, onPick, onSubmit]);

    const isInsidePill = (target: EventTarget | null) =>
        target instanceof Node && pillRef.current?.contains(target) === true;

    // forwarded ref 落到输入胶囊（PC 根部是 Radix Root，不是 DOM）
    const setPillRef = React.useCallback(
        (node: HTMLDivElement | null) => {
            pillRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
        },
        [ref],
    );

    return (
        <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
            {/* Anchor 只做定位；开合由上面的 open 受控，理由见文件头注释 */}
            <PopoverPrimitive.Anchor asChild>
                <SearchInputShell
                    ref={setPillRef}
                    mode={mode}
                    value={value}
                    onValueChange={handleChange}
                    onSubmit={handleEnter}
                    onClear={onClear}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    readonly={readonly}
                    clearable={clearable}
                    shape={shape}
                    label={label}
                    ariaLabel={ariaLabel ?? '搜索'}
                    id={id}
                />
            </PopoverPrimitive.Anchor>

            <PopoverPrimitive.Portal>
                <PopoverPrimitive.Content
                    data-mode={mode === 'mobile' ? 'h5' : 'pc'}
                    aria-label={ariaLabel ?? '搜索建议'}
                    align="start"
                    side="bottom"
                    sideOffset={SIDE_OFFSET}
                    avoidCollisions
                    // 焦点必须留在输入框：不允许 Radix 把焦点移进浮层
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    // 关闭时也不要把焦点抢走（输入框始终是焦点所在）
                    onCloseAutoFocus={(event) => event.preventDefault()}
                    // 点回输入框 / 焦点落回输入框时，判为「内部」不关闭（§3.11 的保护意图）
                    onPointerDownOutside={(event) => {
                        if (isInsidePill(event.target)) event.preventDefault();
                    }}
                    onFocusOutside={(event) => {
                        if (isInsidePill(event.target)) event.preventDefault();
                    }}
                    className={cn(
                        'z-[var(--bv-search-pc-z-index)] box-border overflow-hidden',
                        'min-w-[max(var(--bv-search-pc-panel-min-width),var(--radix-popper-anchor-width,0px))]',
                        'max-w-[var(--radix-popper-available-width,100vw)]',
                        'rounded-[var(--bv-search-pc-panel-radius)] border border-bv-border bg-bv-surface',
                        'shadow-[var(--bv-search-pc-panel-shadow)]',
                        'max-h-[min(var(--bv-search-pc-panel-max-height),var(--radix-popper-available-height,100vh))] overflow-y-auto overscroll-contain',
                        className,
                    )}
                    data-slot="search-suggestion-panel"
                >
                    <div className="py-[var(--bv-search-pc-suggestion-padding-y)]">
                        <SearchSuggestionList
                            mode={mode}
                            suggestions={suggestions}
                            activeIndex={activeIndex}
                            onPick={onPick}
                            loading={suggestionsLoading}
                            emptyText={emptyText}
                            loadingText={loadingText}
                            ariaLabel={ariaLabel ?? '搜索建议'}
                        />
                    </div>
                </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
    );
});