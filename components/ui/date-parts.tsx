import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { DeviceMode } from '@/hooks/use-device-mode';
import {
  DATE_RANGE_SEPARATOR,
  type DateColumnKey,
  type DateParts,
  type DatePickerType,
} from '@/hooks/use-date-value';
import {
  WHEEL_ITEM_HEIGHT,
  WHEEL_VISIBLE_ROWS,
  alignOffset,
  usePickerColumn,
  wheelPadding,
} from '@/hooks/use-picker-column';

/**
 * Bivane DatePicker · 跨模式共用零件（模式 C 的「共享展示」那一层）
 *
 * 两端共用的只有**触发器**：语义完全一致（一个可展开的日期输入控件），
 * 差异只在外壳形态（H5 是 Cell 观感通栏、PC 是描边圆角盒 + 可直接输入）。
 * 面板本身**不共用** —— 三列滚轮与月历是两种交互范式，这也正是 DatePicker
 * 归属模式 C 的理由（架构 §6.5 规则 ④「交互范式不同」）。
 *
 * 本文件里没有 bv-h5: / bv-pc: 变体：
 * 那两个变体的选择器是 `[data-mode='x'] &`（后代选择器），要求元素是某个
 * `[data-mode]` 容器的后代。触发器渲染在用户页面里，未必有 data-mode 祖先，
 * 因此改用显式 JS 分支 —— 与 Popup 的 panelShapeClass、select-parts 同一套做法（契约 19）。
 *
 * PC 的月历**不在这里**：自研的 CalendarMonth 已删除，PC 月历整体交给
 * react-day-picker（见 components/pc/date-picker.tsx）。本文件只剩「两端共享的
 * 触发器外壳 + H5 的三列滚轮」。
 */

/* ------------------------------------------------------------------ *
 * 外壳形态
 * ------------------------------------------------------------------ */

function triggerShellClass(mode: DeviceMode): string {
  if (mode === 'mobile') {
    return cn(
      'relative flex w-full box-border items-center',
      // 内边距走轴前缀（架构 §3.6 第 ① 条）
      'px-[var(--bv-date-picker-padding-x)] py-[var(--bv-date-picker-padding-y)]',
      'bg-bv-surface',
      'bv-hairline bv-hairline--bottom',
    );
  }
  return cn(
    'relative flex w-full box-border items-center',
    'h-[var(--bv-date-picker-pc-trigger-height)]',
    'px-[var(--bv-date-picker-padding-x)] py-0',
    'bg-bv-surface border border-[var(--bv-date-picker-pc-trigger-border-color)]',
    'rounded-[var(--bv-date-picker-pc-trigger-radius)]',
    'transition-colors duration-[var(--bv-duration-fast)]',
    'hover:border-bv-primary',
    // 可输入形态下焦点落在内部 input 上，因此 focus-within 与 focus-visible 都要给
    'focus-within:border-bv-primary focus-within:ring-1 focus-within:ring-bv-primary',
    'focus-visible:border-bv-primary focus-visible:outline-none',
  );
}

/* ------------------------------------------------------------------ *
 * 面板契约
 * ------------------------------------------------------------------ */

/**
 * 两份实现共同接收的 props。
 *
 * 草稿（draft）由**分发层**持有而不是实现层：
 * 「用户改了什么但还没提交」与 Select 的暂存同源，是值语义的一部分；
 * 但它**允许半截**（区间只选了开始端），因此与单值的 complete 形态不同，
 * 由 `onSubmit` 在提交那一刻统一收口（两端不全则不提交）。
 */
export interface DatePanelProps {
  /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: DatePickerType;
  /** 参与展示的日期列，恒为「年→月→日」的子序列 */
  columns: DateColumnKey[];
  format: string;
  /** 已解析的可选范围（分发层算一次，避免两份实现各解析一遍） */
  minParts: DateParts;
  maxParts: DateParts;
  /** H5 面板标题；PC 不渲染标题（浮层由触发器说明自己是什么） */
  title?: React.ReactNode;
  placeholder?: React.ReactNode;
  disabled: boolean;
  clearable: boolean;
  /** 已提交值（触发器回显用） */
  selected: string[];
  /** 草稿（面板高亮用），区间模式下可能是半截 */
  draft: string[];
  /** 改了草稿但尚未提交（H5 滚轮滚动、PC 第一端） */
  onDraftChange: (next: string[]) => void;
  /** 要求提交并关闭（H5 的「确定」、PC 选满即提交） */
  onSubmit: (next: string[]) => void;
  /** 关闭并丢弃草稿 */
  onCancel: () => void;
  /** 清空**已提交**的值（触发器上的清除按钮）。与「取消草稿」是两件事 */
  onClear: () => void;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  className?: string;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  id?: string;
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

export interface DateTriggerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  mode: DeviceMode;
  /** 已格式化的回显文案（未选时为空串） */
  text: string;
  placeholder?: React.ReactNode;
  filled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  disabled?: boolean;
  open?: boolean;
  /** Enter / Space / 点击触发 */
  onActivate?: () => void;
  /** 可编辑输入框获得焦点时触发；未提供时沿用 onActivate */
  onEditableFocus?: () => void;
  /** 输入框失焦时是否提交文本，用于排除焦点移入组件自身面板的情况 */
  shouldCommitOnBlur?: (nextTarget: EventTarget | null) => boolean;
  onArrowKey?: (direction: 'up' | 'down') => void;
  /**
   * PC 单值形态：把触发器本身做成输入框（矩阵 §2.2「支持直接输入日期」）。
   * 只有 PC 单值才为 true —— 区间用两段文本拼在一行，逐字编辑没有明确语义。
   */
  editable?: boolean;
  /**
   * 输入框文本提交（回车 / 失焦）时回调，返回**是否被接受**。
   * 返回 false 时把输入框恢复成当前值 —— 拒绝的话要看得见，否则用户以为存下了。
   */
  onTextCommit?: (text: string) => boolean;
}

export const DateTrigger = React.forwardRef<HTMLDivElement, DateTriggerProps>(function DateTrigger(
  {
    mode,
    text,
    placeholder,
    filled = false,
    clearable = false,
    onClear,
    disabled = false,
    open = false,
    onActivate,
    onEditableFocus,
    shouldCommitOnBlur,
    onArrowKey,
    editable = false,
    onTextCommit,
    className,
    onKeyDown,
    onClick,
    'aria-label': ariaLabel,
    ...props
  },
  ref,
) {
  // 正在编辑时不受外部 text 影响，否则每次输入都会被打回去
  const editingRef = React.useRef(false);
  const [draftText, setDraftText] = React.useState(text);

  React.useEffect(() => {
    // 日期格会阻止 mousedown 抢焦点，因此点击选中后 input 不一定触发 blur。
    // 面板一旦关闭就应结束编辑态，并用已提交值覆盖本地草稿，避免触发器仍显示旧值。
    if (!editingRef.current || !open) {
      editingRef.current = false;
      setDraftText(text);
    }
  }, [text, open]);

  // 两个处理器都必须显式取出并组合：直接写在 JSX 上再 {...props} 展开，
  // 调用方传的 onClick / onKeyDown 会把组件的展开逻辑整个覆盖掉（静默失去交互）。
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    onActivate?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate?.();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      onArrowKey?.('down');
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onArrowKey?.('up');
    }
  };

  const commitText = () => {
    editingRef.current = false;
    if (!onTextCommit) return;
    const accepted = onTextCommit(draftText);
    if (!accepted) setDraftText(text);
  };

  return (
    <div
      ref={ref}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      data-mode={mode === 'mobile' ? 'h5' : 'pc'}
      data-state={open ? 'open' : 'closed'}
      data-filled={filled ? 'true' : undefined}
      tabIndex={disabled || editable ? undefined : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        triggerShellClass(mode),
        'gap-[var(--bv-date-picker-gap)]',
        disabled
          ? 'cursor-not-allowed opacity-[var(--bv-date-picker-disabled-opacity)]'
          : 'cursor-pointer',
        className,
      )}
      {...props}
      data-slot="date-picker-trigger"
    >
      {editable ? (
        <input
          data-slot="date-picker-trigger-input"
          value={draftText}
          placeholder={typeof placeholder === 'string' ? placeholder : undefined}
          aria-label={ariaLabel}
          disabled={disabled}
          onFocus={() => {
            editingRef.current = true;
            (onEditableFocus ?? onActivate)?.();
          }}
          onChange={(event) => setDraftText(event.target.value)}
          onBlur={(event) => {
            if (shouldCommitOnBlur?.(event.relatedTarget) === false) {
              editingRef.current = false;
              return;
            }
            commitText();
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            commitText();
          }}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none',
            'text-[var(--bv-date-picker-text-color)]',
            'placeholder:text-[var(--bv-date-picker-placeholder-color)]',
          )}
        />
      ) : (
        <span
          data-slot="date-picker-trigger-value"
          className={cn(
            'min-w-0 flex-1 truncate',
            filled
              ? 'text-[var(--bv-date-picker-text-color)]'
              : 'text-[var(--bv-date-picker-placeholder-color)]',
          )}
        >
          {filled ? text : placeholder}
        </span>
      )}

      {clearable && filled && !disabled ? (
        <button
          type="button"
          data-slot="date-picker-trigger-clear"
          aria-label="清除"
          // 鼠标专属快捷方式：键盘用户从面板里清除，避免 Tab 流被插入一个停靠点
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            onClear?.();
          }}
          className={cn(
            'flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0',
            'text-[length:var(--bv-date-picker-icon-size)] text-[var(--bv-date-picker-icon-color)]',
            'hover:text-bv-text-2',
          )}
        >
          <Icon name="cross" />
        </button>
      ) : null}

      <span
        data-slot="date-picker-trigger-indicator"
        className={cn(
          'flex shrink-0 items-center justify-center',
          'text-[length:var(--bv-date-picker-icon-size)] text-[var(--bv-date-picker-icon-color)]',
          'transition-transform duration-[var(--bv-duration-fast)]',
          // 展开时翻转，表达的是**展开态**而不是展开方向（与 Select / DropdownMenu 一致）
          open && 'rotate-180',
        )}
      >
        <Icon name="arrow-down" />
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * H5：区间端点切换
 * ------------------------------------------------------------------ */

export type DateRangeEnd = 'start' | 'end';

export interface DateRangeTabsProps {
  mode: DeviceMode;
  active: DateRangeEnd;
  onChange: (end: DateRangeEnd) => void;
  /** 已选端点文案，未选时给占位符 */
  startText: string;
  endText: string;
  placeholder?: React.ReactNode;
}

/**
 * H5 区间模式的两段式入口。
 *
 * 为什么需要它：三列滚轮一次只能表达「一个日期」，而区间是两个。
 * 可选做法有三：① 两组滚轮并排（6 列，宽度塞不下）；② 连续两次「确定」（用户不知道
 * 现在选的是哪一端）；③ 显式标出当前在改哪一端 —— 本组件走 ③。
 * 它替代了「PC 双月并排」在触屏上的位置，属于**能力等价**（矩阵原则），不是功能降级。
 */
export const DateRangeTabs = React.forwardRef<HTMLDivElement, DateRangeTabsProps>(
  function DateRangeTabs(
    { mode, active, onChange, startText, endText, placeholder = '请选择' },
    ref,
  ) {
    const items: { key: DateRangeEnd; label: string; text: string }[] = [
      { key: 'start', label: '开始日期', text: startText },
      { key: 'end', label: '结束日期', text: endText },
    ];

    return (
      <div
        ref={ref}
        data-mode={mode === 'mobile' ? 'h5' : 'pc'}
        role="tablist"
        aria-label="区间端点"
        className={cn(
          'flex w-full shrink-0 items-center',
          'gap-[var(--bv-date-picker-range-tabs-gap)]',
          'px-[var(--bv-date-picker-padding-x)]',
          'py-[var(--bv-date-picker-range-tabs-padding-y)]',
          'bg-bv-surface',
          'bv-hairline bv-hairline--bottom',
        )}
        data-slot="date-picker-range-tabs"
      >
        {items.map((item) => {
          const selected = item.key === active;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={item.label}
              data-slot="date-picker-range-tab"
              data-active={selected ? 'true' : undefined}
              onClick={() => onChange(item.key)}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col items-start border-0 text-left',
                'rounded-[var(--bv-date-picker-range-tab-radius)]',
                'px-[var(--bv-date-picker-range-tab-padding-x)]',
                'py-[var(--bv-date-picker-range-tab-padding-y)]',
                'text-bv-md leading-[var(--bv-date-picker-range-tab-line-height)]',
                selected
                  ? 'bg-[var(--bv-date-picker-range-tab-active-background)] text-[var(--bv-date-picker-range-tab-active-color)]'
                  : 'bg-transparent text-[var(--bv-date-picker-text-2-color)]',
              )}
            >
              <span
                data-slot="date-picker-range-tab-label"
                className="text-bv-xs leading-[var(--bv-date-picker-range-tab-hint-line-height)] opacity-70"
              >
                {item.label}
              </span>
              <span data-slot="date-picker-range-tab-value" className="w-full truncate">
                {item.text || placeholder}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

/* ------------------------------------------------------------------ *
 * H5：滚轮列
 * ------------------------------------------------------------------ */

export interface WheelColumnProps {
  mode: DeviceMode;
  /** 无障碍名称，如「年」 */
  label: string;
  /** 本列可选值（已按 min/max 裁剪） */
  values: number[];
  /** 当前值 */
  value: number;
  /** 每项的展示文案；不传则直接渲染数值 */
  formatValue?: (value: number) => React.ReactNode;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}

export const WheelColumn = React.forwardRef<HTMLDivElement, WheelColumnProps>(function WheelColumn(
  { mode, label, values, value, formatValue, disabled = false, onValueChange },
  ref,
) {
  const index = React.useMemo(() => {
    const found = values.indexOf(value);
    return found >= 0 ? found : 0;
  }, [values, value]);

  /**
   * 行高以**实测**为准（token 才是唯一事实源），拿不到布局时回落常量。
   * jsdom 的 offsetHeight 恒为 0，此时滚轮的滚动行为本来也不会触发，
   * 回落到常量只影响滚动偏移的计算，不影响点击选值。
   */
  const [itemHeight, setItemHeight] = React.useState(WHEEL_ITEM_HEIGHT);

  const handleIndexChange = React.useCallback(
    (next: number) => {
      const nextValue = values[next];
      if (nextValue === undefined || nextValue === value) return;
      onValueChange(nextValue);
    },
    [values, value, onValueChange],
  );

  const { containerRef, onScroll, scrollToIndex } = usePickerColumn({
    index,
    count: values.length,
    itemHeight,
    onIndexChange: handleIndexChange,
  });

  React.useLayoutEffect(() => {
    const node = containerRef.current?.querySelector('[data-slot="date-picker-wheel-item"]');
    const measured = node instanceof HTMLElement ? node.offsetHeight : 0;
    if (measured > 0) setItemHeight((prev) => (prev === measured ? prev : measured));
  }, [values.length, containerRef]);

  const padding = wheelPadding(itemHeight, WHEEL_VISIBLE_ROWS);

  return (
    <div
      ref={ref}
      data-mode={mode === 'mobile' ? 'h5' : 'pc'}
      role="listbox"
      aria-label={label}
      data-slot="date-picker-wheel"
      className="relative min-w-0 flex-1 overflow-hidden"
      // 高度是行高的整数倍（5 行），由 JS 算出来避免 CSS 与 JS 各写一份
      style={{ height: alignOffset(WHEEL_VISIBLE_ROWS, itemHeight) }}
    >
      {/* 选中行的高亮框：两条 hairline，横向内缩 */}
      <div
        aria-hidden="true"
        data-slot="date-picker-wheel-indicator"
        className={cn(
          'pointer-events-none absolute inset-x-0 z-[1]',
          'border-y border-[var(--bv-date-picker-wheel-line-color)]',
        )}
        style={{ top: alignOffset(2, itemHeight), height: itemHeight }}
      />

      <div
        ref={containerRef}
        onScroll={onScroll}
        data-bv-scroll-container=""
        data-slot="date-picker-wheel-scroller"
        className={cn(
          'h-full w-full overflow-y-auto overscroll-contain',
          'snap-y snap-mandatory',
        )}
        style={{ paddingTop: padding, paddingBottom: padding }}
      >
        {values.map((item, itemIndex) => {
          const selected = itemIndex === index;
          return (
            <button
              key={item}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              data-slot="date-picker-wheel-item"
              data-selected={selected ? 'true' : undefined}
              onClick={() => {
                if (disabled || selected) return;
                // 点一下先用滚动把它带入选中行，再回写值 —— 顺序反过来会让
                // 「外部 index 变化」的 effect 与这次滚动各滚一次，画面来回抖
                scrollToIndex(itemIndex);
                onValueChange(item);
              }}
              className={cn(
                'flex w-full cursor-pointer snap-center items-center justify-center',
                'border-0 bg-transparent',
                'h-[var(--bv-date-picker-wheel-item-height)]',
                'text-bv-md leading-[var(--bv-date-picker-wheel-item-line-height)]',
                selected
                  ? 'font-bold text-[var(--bv-date-picker-wheel-selected-color)]'
                  : 'text-[var(--bv-date-picker-wheel-color)]',
                disabled && 'cursor-not-allowed',
              )}
            >
              {formatValue ? formatValue(item) : item}
            </button>
          );
        })}
      </div>

      {/* 上下渐隐遮罩：让远端行淡出而不是被硬切，提示还能继续滚 */}
      <div
        aria-hidden="true"
        data-slot="date-picker-wheel-mask"
        data-mask="top"
        className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
        style={{ height: alignOffset(2, itemHeight) }}
      />
      <div
        aria-hidden="true"
        data-slot="date-picker-wheel-mask"
        data-mask="bottom"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rotate-180"
        style={{ height: alignOffset(2, itemHeight) }}
      />
    </div>
  );
});

/** 区间文案连接符由本文件统一暴露，避免两份实现各拼一次（漂移了就两端不一致） */
export const DATE_RANGE_JOIN = DATE_RANGE_SEPARATOR;
