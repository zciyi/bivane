import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';
import {
  SelectEmptyState,
  SelectOptionRow,
  SelectSearchField,
  SelectTrigger,
  renderSelectItems,
  type SelectPanelProps,
} from '@/components/ui/select-parts';
import { hasGroups, initialActiveIndex, nextEnabledIndex } from '@/hooks/use-select-state';
import { VIRTUAL_THRESHOLD, useVirtualWindow } from '@/hooks/use-virtual-window';

/**
 * Bivane Select · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：锚定触发器下方的浮层 + 键盘巡航（↑↓ 移动 / Enter 选中 / Home·End 首尾 /
 *       Esc 关闭）+ 输入过滤 + 翻转防溢出（Radix Popper 负责碰撞检测），
 *       多选时保持展开。
 *
 * 用 Radix Popover 而非 Popover 的 Trigger：
 *   触发器是跨模式共用的 SelectTrigger（自带点击/键盘语义），
 *   若挂在 Popover.Trigger 上，Slot 会把 Radix 的 onClick 与组件自身的 onClick
 *   都保留下来 —— 一次点击 toggle 两次，表现为「点开立刻又关」。
 *   改用 Anchor 只取它的定位能力，交互完全由自己掌控。
 *
 * 用 data-slot="select-panel" 而非自定义槽名：
 *   utilities.css 的进出场动画是挂在 [data-slot='x'][data-state='y'] 上的（契约第 16 条），
 *   槽名与选择器必须逐字一致，否则动画静默不跑。
 */

/** 面板与触发器之间的主轴间距，走 token */
const SIDE_OFFSET = 4;

export const PcSelect = React.forwardRef<HTMLDivElement, SelectPanelProps>(function PcSelect(
  {
    mode,
    open,
    onOpenChange,
    items,
    options,
    selected,
    onSelect,
    multiple,
    searchable,
    keyword,
    onKeywordChange,
    searchPlaceholder,
    placeholder,
    emptyText,
    clearable,
    onClear,
    disabled,
    triggerContent,
    filled,
    className,
    ariaLabel,
    id,
  },
  ref,
) {
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [itemHeight, setItemHeight] = React.useState(0);

  // 分组列表里多了分组标题，项高不固定；窗口化要求固定项高，因此只在纯扁平长列表上启用
  const measurable = options.length >= VIRTUAL_THRESHOLD && !hasGroups(items);

  const { containerRef, window: virtualWindow } = useVirtualWindow({
    itemHeight,
    count: options.length,
    enabled: measurable && itemHeight > 0,
  });
  const virtualize = measurable && itemHeight > 0;

  const triggerMergedRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      triggerRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref],
  );

  /**
   * 量取真实行高，而不是在 JS 里写死 36。
   * 用 useLayoutEffect 是为了在**绘制前**完成测量并触发同步重渲染，
   * 避免「先按全量渲染 100+ 行、下一帧再切换成窗口化」的闪烁。
   * 环境不提供布局（jsdom 的 offsetHeight 恒为 0）时保持全量渲染，行为不受影响。
   */
  React.useLayoutEffect(() => {
    if (!open || !measurable) return;
    const node = containerRef.current?.querySelector('[data-slot="select-option"]');
    const measured = node instanceof HTMLElement ? node.offsetHeight : 0;
    setItemHeight((prev) => (prev === measured ? prev : measured));
  }, [open, measurable, options.length, containerRef]);

  const moveActive = React.useCallback(
    (step: 1 | -1) => {
      setActiveIndex((prev) => {
        const next = nextEnabledIndex(options, prev, step);
        return next < 0 ? prev : next;
      });
    },
    [options],
  );

  const activeKeyRef = React.useRef<string | null>(null);

  // 展开、或过滤条件变化时，把激活项落到「第一个已选项 / 第一个可选项」。
  // 用 activeKeyRef 去重：否则多选每选中一项，options 与 selected 都会变，
  // 激活项就被拽回列表里最靠前的那个已选项，键盘落点会跳。
  React.useEffect(() => {
    if (!open) return;
    if (activeKeyRef.current === keyword) return;
    activeKeyRef.current = keyword;
    setActiveIndex(initialActiveIndex(options, selected));
  }, [open, keyword, options, selected]);

  React.useEffect(() => {
    if (open) return;
    activeKeyRef.current = null;
    setActiveIndex(-1);
  }, [open]);

  // 键盘落点滚入视野
  React.useEffect(() => {
    if (!open || activeIndex < 0) return;
    const container = containerRef.current;
    if (!container) return;

    if (virtualize) {
      // 窗口化时目标行可能还没渲染，直接按固定行高算 scrollTop
      const top = activeIndex * itemHeight;
      const bottom = top + itemHeight;
      if (top < container.scrollTop) container.scrollTop = top;
      else if (bottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = bottom - container.clientHeight;
      }
      return;
    }

    const rows = container.querySelectorAll<HTMLElement>('[data-slot="select-option"]');
    const node = rows[activeIndex];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ block: 'nearest' });
    }
  }, [open, activeIndex, virtualize, itemHeight, containerRef]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (options.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
        return;
      case 'Home':
        event.preventDefault();
        setActiveIndex(nextEnabledIndex(options, -1, 1));
        return;
      case 'End':
        event.preventDefault();
        setActiveIndex(nextEnabledIndex(options, 0, -1));
        return;
      case 'Enter': {
        const option = options[activeIndex];
        if (!option) return;
        event.preventDefault();
        onSelect(option);
        return;
      }
      default:
    }
  };

  /**
   * 触发器上的方向键：未展开时先落好激活项再展开；
   * 已展开时交给同一套移动逻辑（焦点仍在触发器上的情况）。
   */
  const handleArrowFromTrigger = (direction: 'up' | 'down') => {
    if (disabled) return;
    if (!open) {
      // 先占位初始化键，避免「展开时重置激活项」的 effect 把这次键盘落点冲掉
      activeKeyRef.current = keyword;
      setActiveIndex(
        direction === 'down'
          ? nextEnabledIndex(options, -1, 1)
          : nextEnabledIndex(options, 0, -1),
      );
      onOpenChange(true);
      return;
    }
    moveActive(direction === 'down' ? 1 : -1);
  };

  // PC 不做「选项 > 10 才给搜索框」的限制：桌面端输入过滤是主路径，不是补充能力。
  // 同一个 searchable prop，两端的呈现阈值不同 —— 属于矩阵对两种交互的定义差异。
  const showSearch = searchable;
  const listId = id ? `${id}-listbox` : undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      {/* Anchor 只登记定位参考元素，不注入任何交互属性 */}
      <PopoverPrimitive.Anchor asChild>
        <SelectTrigger
          ref={triggerMergedRef}
          id={id}
          mode={mode}
          placeholder={placeholder}
          filled={filled}
          clearable={clearable}
          onClear={onClear}
          disabled={disabled}
          open={open}
          aria-label={ariaLabel}
          aria-controls={listId}
          onActivate={() => onOpenChange(!open)}
          onArrowKey={handleArrowFromTrigger}
        >
          {triggerContent}
        </SelectTrigger>
      </PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          data-mode={mode === 'mobile' ? 'h5' : 'pc'}
          aria-label={ariaLabel}
          align="start"
          side="bottom"
          sideOffset={SIDE_OFFSET}
          // 翻转与位移防溢出交给 Radix Popper（矩阵 §2.2 的「自动翻转防溢出」）
          avoidCollisions
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(event) => {
            // 有搜索框时优先聚焦它，打开即可输入过滤；否则交给 Radix 聚焦面板本体，
            // 两种情况的 keydown 都会冒泡到面板上的 handler
            if (!searchRef.current) return;
            event.preventDefault();
            searchRef.current.focus();
          }}
          onCloseAutoFocus={(event) => {
            // 没有 Popover.Trigger，Radix 无处归还焦点，显式还给触发器（契约第 5 条）
            event.preventDefault();
            triggerRef.current?.focus({ preventScroll: true });
          }}
          onPointerDownOutside={(event) => {
            // 点触发器时应由触发器自己的 onClick 完成 toggle。
            // 不拦的话 DismissableLayer 也会关一次，两边都写状态、顺序依赖实现细节。
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && triggerRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          onFocusOutside={(event) => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Node && triggerRef.current?.contains(target)) {
              event.preventDefault();
            }
          }}
          className={cn(
            'z-[var(--bv-select-pc-z-index)] box-border overflow-hidden',
            // 与触发器同宽：--radix-popper-anchor-width 由 Radix Popper 注入，
            // 环境不提供时兜底 0px，于是退化为 --bv-select-pc-panel-min-width
            'min-w-[max(var(--bv-select-pc-panel-min-width),var(--radix-popper-anchor-width,0px))]',
            'max-w-[var(--radix-popper-available-width,100vw)]',
            'rounded-[var(--bv-select-pc-radius)] border border-bv-border bg-bv-surface',
            'shadow-[var(--bv-select-pc-shadow)]',
            className,
          )}
          data-slot="select-panel"
        >
          {showSearch ? (
            <SelectSearchField
              ref={searchRef}
              mode={mode}
              value={keyword}
              onValueChange={onKeywordChange}
              placeholder={searchPlaceholder}
              aria-label="搜索选项"
              aria-controls={listId}
              aria-autocomplete="list"
            />
          ) : null}

          {options.length === 0 ? (
            <SelectEmptyState mode={mode}>{emptyText}</SelectEmptyState>
          ) : (
            <div
              ref={containerRef}
              id={listId}
              role="listbox"
              aria-multiselectable={multiple || undefined}
              aria-label={ariaLabel}
              data-bv-scroll-container=""
              className={cn(
                'min-h-0 overflow-y-auto overscroll-contain',
                'py-[var(--bv-select-pc-padding-y)]',
                // 高度上限同时受 token 与「浮层翻转后可用的空间」约束，
                // 空间不足时自动变矮而不是溢出视口
                'max-h-[min(var(--bv-select-pc-panel-max-height),var(--radix-popper-available-height,100vh))]',
              )}
              data-slot="select-list"
            >
              {virtualize ? (
                <>
                  {virtualWindow.paddingTop > 0 ? (
                    <div aria-hidden="true" style={{ height: virtualWindow.paddingTop }} />
                  ) : null}
                  {options.slice(virtualWindow.start, virtualWindow.end).map((option, index) => (
                    <SelectOptionRow
                      key={String(option.value)}
                      mode={mode}
                      option={option}
                      selected={selected.includes(option.value)}
                      active={activeIndex === virtualWindow.start + index}
                      onSelect={onSelect}
                      posInSet={virtualWindow.start + index + 1}
                      setSize={options.length}
                    />
                  ))}
                  {virtualWindow.paddingBottom > 0 ? (
                    <div aria-hidden="true" style={{ height: virtualWindow.paddingBottom }} />
                  ) : null}
                </>
              ) : (
                renderSelectItems({
                  mode,
                  items,
                  selected,
                  onSelect,
                  activeValue: activeIndex >= 0 ? options[activeIndex]?.value : undefined,
                  setSize: options.length,
                })
              )}
            </div>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
