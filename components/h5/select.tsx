import * as React from 'react';
import { Popup } from '@/components/responsive/popup';
import { PanelHeader } from '@/components/ui/panel-header';
import {
  SelectEmptyState,
  SelectSearchField,
  SelectTrigger,
  renderSelectItems,
  type SelectPanelProps,
} from '@/components/ui/select-parts';
import { H5_SEARCH_VISIBLE_THRESHOLD } from '@/hooks/use-select-state';

/**
 * Bivane Select · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：底部弹层列表，项高 48px（触控热区下限），
 *       选项数 > 10 时才出现内置搜索框。
 *
 * 两种选择节奏（由分发层的 `staged` 决定，本组件只负责渲染）：
 *   - 点选即生效（默认）：点选项立刻回填并关闭，没有工具栏；
 *   - 暂存确认（staged）：面板顶部渲染「取消 · 标题 · 确定」工具栏，
 *     点选项只打勾，点「确定」才提交 —— 触屏上「误点有退路」。
 * PC 恒为前者，因此工具栏只出现在这里。
 *
 * 搜索框放在 Popup 的滚动容器之外：
 * Popup 默认 scrollable=true 会把 children 包进一个 overflow-y-auto 容器，
 * 那样搜索框会跟着列表一起滚走。这里传 scrollable={false}，自己接管
 * 「搜索框固定 + 列表独立滚动」的结构，也让列表能吃到 --bv-select-panel-max-height。
 *
 * 拖拽关闭：Popup 只在标了 DRAG_REGION_ATTR 的区域内起拖（顶部指示条），
 * 列表里的滑动因此不会被误判成下拉关闭。
 */

export const H5Select = React.forwardRef<HTMLDivElement, SelectPanelProps>(function H5Select(
  {
    mode,
    open,
    onOpenChange,
    items,
    options,
    optionCount,
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
    title,
    staged,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    className,
    ariaLabel,
    id,
  },
  ref,
) {
  // 矩阵 §2.2：「选项 > 10 时显示内置搜索框」。
  // 必须按**过滤前**的总数判定 —— 按过滤后的数会边打字边把搜索框藏掉，无法输入第二个字。
  const showSearch = searchable && optionCount > H5_SEARCH_VISIBLE_THRESHOLD;
  const listId = id ? `${id}-listbox` : undefined;

  return (
    <>
      <SelectTrigger
        ref={ref}
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
        // H5 只要求「方向键能唤起面板」；完整的键盘巡航是 PC 的契约（§4 第 5 条）选择
        onArrowKey={() => onOpenChange(true)}
      >
        {triggerContent}
      </SelectTrigger>

      <Popup
        open={open}
        onOpenChange={onOpenChange}
        position="bottom"
        scrollable={false}
        // 传已解析的 mode，让 forceMode 逃生舱对 Popup 的形态与滚动锁策略同样生效
        forceMode={mode}
        aria-label={ariaLabel}
        className={className}
      >
        {staged ? (
          <PanelHeader
            mode={mode}
            title={title}
            onCancel={onCancel}
            cancelText={cancelText}
            onConfirm={onConfirm}
            confirmText={confirmText}
          />
        ) : null}

        {showSearch ? (
          <SelectSearchField
            mode={mode}
            value={keyword}
            onValueChange={onKeywordChange}
            placeholder={searchPlaceholder}
            aria-label="搜索选项"
            aria-controls={listId}
          />
        ) : null}

        {options.length === 0 ? (
          <SelectEmptyState mode={mode}>{emptyText}</SelectEmptyState>
        ) : (
          <div
            id={listId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            aria-label={ariaLabel}
            data-bv-scroll-container=""
            className="max-h-[var(--bv-select-panel-max-height)] min-h-0 overflow-y-auto overscroll-contain"
            data-slot="select-list"
          >
            {renderSelectItems({ mode, items, selected, onSelect })}
          </div>
        )}
      </Popup>
    </>
  );
});
