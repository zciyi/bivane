import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import type { DeviceMode } from '@/hooks/use-device-mode';

/**
 * Bivane Search · 两模式共用零件
 *
 * 这些零件被 H5（内联条 + 全屏页）与 PC（内联 + 建议浮层）复用，**只负责「长什么样」**，
 * 「什么时机开合、建议从哪来、历史怎么写」一律由分发层 responsive/search.tsx 决定。
 * 外壳差异走 JS 分支（契约第 17 条），不依赖祖先是否带 data-mode。
 */

/* ------------------------------------------------------------------ *
 * 输入胶囊
 * ------------------------------------------------------------------ */

export type SearchShape = 'round' | 'square';

export interface SearchInputShellProps {
  /** 已解析的模式（契约第 13 条：基础件不自判定） */
  mode: DeviceMode;
  value: string;
  onValueChange: (next: string) => void;
  /** 回车提交（PC 可在有激活建议时改为「选中该建议」） */
  onSubmit?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** 键盘透传（PC 用于 ↑↓ 巡航建议、Esc 关闭） */
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  placeholder?: string;
  disabled?: boolean;
  readonly?: boolean;
  clearable?: boolean;
  onClear: () => void;
  shape?: SearchShape;
  /** 左侧固定文案（Vant 的 label） */
  label?: React.ReactNode;
  ariaLabel?: string;
  id?: string;
  className?: string;
  /** 调用方注入的 input ref（PC / H5 全屏页用它聚焦） */
  inputRef?: React.Ref<HTMLInputElement>;
}

/**
 * 胶囊输入外壳：放大镜 + 输入 + 清除键。两端外观一致（模式 A），
 * 因此不需要按 mode 分支；高度/圆角/配色全部走 --bv-search-* token。
 */
export const SearchInputShell = React.forwardRef<HTMLDivElement, SearchInputShellProps>(
  function SearchInputShell(
    {
      mode,
      value,
      onValueChange,
      onSubmit,
      onFocus,
      onBlur,
      onKeyDown,
      onClick,
      placeholder,
      disabled = false,
      readonly = false,
      clearable = true,
      onClear,
      shape = 'round',
      label,
      ariaLabel,
      id,
      className,
      inputRef,
    },
    ref,
  ) {
    const showClear = clearable && value.length > 0 && !disabled && !readonly;

    return (
      <div
        ref={ref}
        data-slot="search-input"
        data-mode={mode === 'mobile' ? 'h5' : 'pc'}
        onKeyDown={onKeyDown}
        onClick={onClick}
        className={cn(
          'flex h-[var(--bv-search-height)] items-center',
          'bg-[var(--bv-search-background)]',
          shape === 'round'
            ? 'rounded-[var(--bv-search-radius)]'
            : 'rounded-[var(--bv-search-radius-square)]',
          'px-[var(--bv-search-padding-x)]',
          className,
        )}
      >
        {label ? (
          <span
            data-slot="search-label"
            className="mr-[var(--bv-search-icon-gap)] shrink-0 text-[length:var(--bv-search-row-font)] leading-[var(--bv-search-row-line-height)] text-[var(--bv-text-2)]"
          >
            {label}
          </span>
        ) : null}

        <Icon
          name="search"
          size="var(--bv-search-icon-size)"
          className="mr-[var(--bv-search-icon-gap)] shrink-0 text-[var(--bv-text-3)]"
        />

        <Input
          ref={inputRef}
          id={id}
          data-slot="search-field"
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSubmit?.();
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readonly}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={ariaLabel}
          className="flex-1"
        />

        {showClear ? (
          <button
            type="button"
            data-slot="search-clear"
            aria-label="清除"
            onClick={onClear}
            className="bv-focus-ring -mr-[2px] shrink-0 cursor-pointer rounded-full p-[2px] text-[var(--bv-text-3)] hover:text-[var(--bv-text-2)]"
          >
            <Icon name="cross" size="var(--bv-search-clear-size)" />
          </button>
        ) : null}
      </div>
    );
  },
);

/* ------------------------------------------------------------------ *
 * 建议列表
 * ------------------------------------------------------------------ */

export interface SearchSuggestionRowProps {
  mode: DeviceMode;
  text: string;
  active?: boolean;
  onPick: (text: string) => void;
  className?: string;
}

/** 单条建议：放大镜 + 文案。行高按模式分支（H5 触控 44px / PC 36px）。 */
export function SearchSuggestionRow({
  mode,
  text,
  active = false,
  onPick,
  className,
}: SearchSuggestionRowProps) {
  return (
    <div
      role="option"
      aria-selected={active}
      data-slot="search-suggestion"
      data-active={active || undefined}
      onClick={() => onPick(text)}
      className={cn(
        'flex w-full cursor-pointer items-center',
        mode === 'mobile'
          ? 'h-[var(--bv-search-h5-row-height)]'
          : 'h-[var(--bv-search-pc-row-height)]',
        'gap-[var(--bv-search-row-gap)]',
        'px-[var(--bv-search-row-padding-x)]',
        'text-[length:var(--bv-search-row-font)] leading-[var(--bv-search-row-line-height)]',
        active
          ? 'bg-[var(--bv-active-color)]'
          : 'hover:bg-[var(--bv-active-color)]',
        className,
      )}
    >
      <Icon
        name="search"
        size="var(--bv-search-row-icon-size)"
        className="shrink-0 text-[var(--bv-text-3)]"
      />
      <span className="truncate text-[var(--bv-text)]">{text}</span>
    </div>
  );
}

export interface SearchSuggestionListProps {
  mode: DeviceMode;
  suggestions: string[];
  /** 键盘当前激活项下标（-1 无） */
  activeIndex?: number;
  onPick: (text: string) => void;
  /** 异步建议加载中 */
  loading?: boolean;
  /** 无建议时的文案 */
  emptyText?: React.ReactNode;
  /** 加载中的文案 */
  loadingText?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * 建议列表（只渲染列表本体，滚动容器由调用方提供：
 * PC 是浮层 Content，H5 是全屏页 body）。
 */
export function SearchSuggestionList({
  mode,
  suggestions,
  activeIndex = -1,
  onPick,
  loading = false,
  emptyText,
  loadingText,
  id,
  ariaLabel,
  className,
}: SearchSuggestionListProps) {
  const showStatus = loading || suggestions.length === 0;
  const statusText = loading ? loadingText : emptyText;

  return (
    <div
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      data-slot="search-suggestion-list"
      className={cn('w-full', className)}
    >
      {showStatus ? (
        <div
          data-slot="search-suggestion-status"
          className={cn(
            'flex items-center justify-center px-[var(--bv-search-row-padding-x)] text-[var(--bv-text-3)]',
            'text-[length:var(--bv-search-row-font)] leading-[var(--bv-search-row-line-height)]',
            mode === 'mobile'
              ? 'h-[var(--bv-search-h5-row-height)]'
              : 'h-[var(--bv-search-pc-row-height)]',
          )}
        >
          {loading ? <Icon name="loading" size="var(--bv-search-row-icon-size)" className="mr-1" /> : null}
          <span>{statusText}</span>
        </div>
      ) : (
        suggestions.map((text, index) => (
          <SearchSuggestionRow
            key={text}
            mode={mode}
            text={text}
            active={index === activeIndex}
            onPick={onPick}
          />
        ))
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 视图契约（分发层 → 两端实现的统一 props）
 * ------------------------------------------------------------------ */

/**
 * 分发层把 useSearchState 的结果 + 展示配置打包成本契约，
 * 交给 H5Search / PcSearch 消费。两端实现都只做「受控展示层」，
 * 不自己管值/开合/建议/历史（架构 §6.5：状态归属看是否跨模式同义）。
 */
export interface SearchViewProps {
  mode: DeviceMode;
  /** H5 = 全屏页开合；PC = 建议浮层开合 */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (next: string) => void;
  /** 回车提交 */
  onSubmit: () => void;
  onClear: () => void;
  /** 建议列表（静态过滤或异步结果） */
  suggestions: string[];
  suggestionsLoading: boolean;
  /** 选中一条建议（写 value + 提交） */
  onPick: (text: string) => void;
  /** 历史记录（H5 全屏页使用） */
  history: string[];
  showHistory: boolean;
  onPickHistory: (text: string) => void;
  onRemoveHistory: (text: string) => void;
  onClearHistory: () => void;
  // 展示配置
  placeholder: string;
  disabled: boolean;
  readonly: boolean;
  clearable: boolean;
  shape: SearchShape;
  label?: React.ReactNode;
  emptyText?: React.ReactNode;
  loadingText?: React.ReactNode;
  historyText?: React.ReactNode;
  clearHistoryText?: React.ReactNode;
  ariaLabel?: string;
  id?: string;
  className?: string;
}