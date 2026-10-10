import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";
import {
  isSelectGroup,
  type SelectItem,
  type SelectOption,
  type SelectValue,
} from "@/hooks/use-select-state";

/**
 * Bivane Select · 跨模式共用零件（模式 C 的「共享展示」那一层）
 *
 * 为什么触发器与选项行可以共用：
 * 两端的**语义**完全一致（一个可展开的组合框、一行可选项），
 * 差异只在**外壳形态**——H5 是整行通栏 + 下边线（Cell 观感、48px 热区），
 * PC 是描边圆角盒 + 悬停/焦点圈（桌面密度、36px 行高）。
 * 这类差异属于模式 A（纯 CSS），用 `mode` 分支给出两串 class 即可，无需拆两份实现。
 *
 * 所以本文件里**没有** bv-h5: / bv-pc: 变体：
 * 那两个变体的选择器是 `[data-mode='x'] &`（后代选择器），
 * 要求元素本身是某个 `[data-mode]` 容器的**后代**。
 * 触发器渲染在用户页面里，未必有 data-mode 祖先，因此改用显式 JS 分支——
 * 与 Popup 的 panelShapeClass 同一套做法，好处是结果与祖先无关、可预期。
 */

/* ------------------------------------------------------------------ *
 * 外壳形态
 * ------------------------------------------------------------------ */

function triggerShellClass(mode: DeviceMode): string {
  if (mode === "mobile") {
    return cn(
      "relative flex w-full box-border items-center",
      // 内边距走轴前缀（架构 §3.4①）
      "px-[var(--bv-select-padding-x)] py-[var(--bv-select-padding-y)]",
      // H5 触控热区：10 + 24 + 10 = 44px，与 Cell 一致
      "bg-bv-surface",
      "bv-hairline bv-hairline--bottom",
    );
  }
  return cn(
    "relative flex w-full box-border items-center",
    "h-[var(--bv-select-pc-trigger-height)]",
    "px-[var(--bv-select-padding-x)] py-0",
    "bg-bv-surface border border-[var(--bv-select-pc-trigger-border-color)]",
    "rounded-[var(--bv-select-pc-trigger-radius)]",
    "transition-colors duration-[var(--bv-duration-fast)]",
    "hover:border-bv-primary",
    "focus-visible:border-bv-primary focus-visible:outline-none",
    // 焦点圈与描边同色会更稳，不引入新的颜色 token
    "focus-visible:ring-1 focus-visible:ring-bv-primary",
  );
}

function optionShellClass(
  mode: DeviceMode,
  active: boolean,
  selected: boolean,
): string {
  const common = cn(
    "flex w-full box-border cursor-pointer items-center border-0 bg-transparent text-left",
    "px-[var(--bv-select-option-padding-x)]",
    "text-bv-md leading-[var(--bv-select-option-line-height)]",
    selected ? "text-bv-primary" : "text-bv-text",
    "disabled:cursor-not-allowed",
  );

  if (mode === "mobile") {
    return cn(
      common,
      // H5 项高 48px（矩阵 §2.2），同时是触控热区下限
      "h-[var(--bv-select-option-height)]",
      "active:bg-[var(--bv-select-option-active-background)]",
    );
  }
  return cn(
    common,
    // PC 桌面密度：矩阵 §2.2 定义的「锚定下拉浮层」行高刻意小于 H5，
    // 这里的差异属于容器形态（见 vant.css 的 Select token 注释）
    "h-[var(--bv-select-pc-option-height)]",
    "hover:bg-[var(--bv-select-option-hover-background)]",
    active && "bg-[var(--bv-select-option-active-background)]",
  );
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

export interface SelectTriggerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
  mode: DeviceMode;
  /** 无选中值时展示 */
  placeholder?: React.ReactNode;
  /** 已选内容（文案或 tag 组） */
  children?: React.ReactNode;
  /** 是否已有选中值：决定展示 placeholder 还是 children，并控制清除按钮显隐 */
  filled?: boolean;
  clearable?: boolean;
  onClear?: () => void;
  disabled?: boolean;
  /** 展开状态，用于 aria-expanded 与指示箭头方向 */
  open?: boolean;
  /** Enter / Space / 点击触发 */
  onActivate?: () => void;
  /**
   * 方向键回调。放在触发器而非面板上，是因为浮层展开后焦点仍在触发器
   * （combobox 模式），ArrowDown 必须在还没展开时也能唤起浮层。
   */
  onArrowKey?: (direction: "up" | "down") => void;
  /**
   * click 开合是否已委托外层（PC Radix Popover.Trigger）。
   * 默认 false：H5 由本元素 click 自激活；PC 必须传 true 防双触发
   */
  clickDelegated?: boolean;
}

export const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  SelectTriggerProps
>(function SelectTrigger(
  {
    mode,
    placeholder,
    children,
    filled = false,
    clearable = false,
    onClear,
    disabled = false,
    open = false,
    onActivate,
    onArrowKey,
    /**
     * click 开合是否已委托给外层（PC 的 Radix Popover.Trigger）。
     * H5 触发器自己在 click 上 onActivate（默认）；PC 必须传 true，
     * 否则 Radix toggle 与 onActivate 会双触发
     */
    clickDelegated = false,
    className,
    onKeyDown,
    onClick,
    ...props
  },
  ref,
) {
  // 鼠标开合：H5 由本元素 click 自激活；PC 委托 Radix Popover.Trigger（pc 层
  // Trigger asChild 包住本元素，triggerRef 保护才生效）。disabled 守卫也在 pc
  // 层挂 Trigger 本身：Radix Slot 中 slot 处理器先于子元素处理器，在子元素上
  // preventDefault 拦不住 onOpenToggle
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(event);
    if (clickDelegated || event.defaultPrevented || disabled) return;
    onActivate?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || disabled) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate?.();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onArrowKey?.("down");
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onArrowKey?.("up");
    }
  };

  return (
    <div
      ref={ref}
      role="combobox"
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-disabled={disabled || undefined}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-state={open ? "open" : "closed"}
      data-filled={filled ? "true" : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        triggerShellClass(mode),
        "gap-[var(--bv-select-gap)]",
        disabled
          ? "cursor-not-allowed opacity-[var(--bv-select-disabled-opacity)]"
          : "cursor-pointer",
        className,
      )}
      {...props}
      data-slot="select-trigger"
    >
      <span
        data-slot="select-trigger-value"
        className={cn(
          "min-w-0 flex-1 truncate",
          filled
            ? "text-[var(--bv-select-text-color)]"
            : "text-[var(--bv-select-placeholder-color)]",
        )}
      >
        {filled ? children : placeholder}
      </span>

      {clearable && filled && !disabled ? (
        <button
          type="button"
          data-slot="select-trigger-clear"
          aria-label="清除"
          // 鼠标专属快捷方式：键盘用户从浮层里清除，避免 Tab 流被插入一个停靠点
          tabIndex={-1}
          // preventDefault 借 defaultPrevented 短路 Radix 的 onClick toggle
          // （X 在 triggerRef 内，同实例 pointerDownOutside 也会被放行）；
          // 不能 stopPropagation：否则别的浮层挂 document 的延迟 dismiss 收不到 click
          onClick={(event) => {
            event.preventDefault();
            onClear?.();
          }}
          className={cn(
            "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
            "text-[length:var(--bv-select-icon-size)] text-[var(--bv-select-icon-color)]",
            "hover:text-bv-text-2",
          )}
        >
          <Icon name="cross" />
        </button>
      ) : null}

      <span
        data-slot="select-trigger-indicator"
        className={cn(
          "flex shrink-0 items-center justify-center",
          "text-[length:var(--bv-select-icon-size)] text-[var(--bv-select-icon-color)]",
          "transition-transform duration-[var(--bv-duration-fast)]",
          // 展开时翻转 180°，表达的是**展开态**而不是展开方向 ——
          // 与 Ant Design / Element Plus 的箭头行为一致。
          // 因此 PC 浮层因空间不足翻到触发器上方时，箭头不会跟着换向；
          // 若将来要让它跟随 Radix 的 data-side，需要由 pc/select.tsx 把
          // 已解析的 side 传下来，本组件本身读不到。
          open && "rotate-180",
        )}
      >
        <Icon name="arrow-down" />
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 选项行
 * ------------------------------------------------------------------ */

export interface SelectOptionRowProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "children" | "disabled" | "onSelect"
> {
  mode: DeviceMode;
  option: SelectOption;
  selected: boolean;
  /** 键盘激活项高亮（仅 PC 会置位） */
  active?: boolean;
  onSelect: (option: SelectOption) => void;
  /** 虚拟滚动下的位置，用于 aria-posinset / aria-setsize */
  posInSet?: number;
  setSize?: number;
}

export const SelectOptionRow = React.forwardRef<
  HTMLButtonElement,
  SelectOptionRowProps
>(function SelectOptionRow(
  {
    mode,
    option,
    selected,
    active = false,
    onSelect,
    posInSet,
    setSize,
    className,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      disabled={option.disabled}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-value={String(option.value)}
      data-selected={selected ? "true" : undefined}
      data-active={active ? "true" : undefined}
      onClick={() => onSelect(option)}
      className={cn(
        optionShellClass(mode, active, selected),
        option.disabled &&
          "text-[var(--bv-select-option-disabled-color)]",
        className,
      )}
      {...props}
      data-slot="select-option"
    >
      <span
        data-slot="select-option-label"
        className="min-w-0 flex-1 truncate"
      >
        {option.label}
      </span>
      {/* 未选中时也占位，避免选中态让文案左右跳动 */}
      <span
        data-slot="select-option-check"
        aria-hidden="true"
        className={cn(
          "ml-[var(--bv-select-gap)] flex shrink-0 items-center justify-center",
          "text-[length:var(--bv-select-option-check-size)]",
        )}
      >
        {selected ? (
          <span className="text-[var(--bv-select-option-check-color)]">
            <Icon name="check" />
          </span>
        ) : null}
      </span>
    </button>
  );
});

/* ------------------------------------------------------------------ *
 * 搜索框 / 分组标题 / 空态
 * ------------------------------------------------------------------ */

export interface SelectSearchFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "size"
> {
  mode: DeviceMode;
  value: string;
  onValueChange: (value: string) => void;
}

export const SelectSearchField = React.forwardRef<
  HTMLInputElement,
  SelectSearchFieldProps
>(function SelectSearchField(
  { mode, value, onValueChange, className, ...props },
  ref,
) {
  return (
    <div
      data-mode={mode === "mobile" ? "h5" : "pc"}
      className={cn(
        "flex box-border w-full items-center",
        "px-[var(--bv-select-padding-x)]",
        "h-[var(--bv-select-search-height)] py-0",
        "bg-bv-surface bv-hairline bv-hairline--bottom",
      )}
      data-slot="select-search"
    >
      <span className="mr-[var(--bv-select-gap)] flex shrink-0 items-center text-[length:var(--bv-select-icon-size)] text-[var(--bv-select-icon-color)]">
        <Icon name="search" />
      </span>
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        // 用 text-bv-md + leading 成对书写（架构 §3.4②，字号在前）
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent text-bv-md leading-[var(--bv-select-line-height)] text-bv-text outline-none",
          "placeholder:text-[var(--bv-select-placeholder-color)]",
          className,
        )}
        {...props}
        data-slot="select-search-input"
      />
    </div>
  );
});

export interface SelectGroupTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: DeviceMode;
}

export const SelectGroupTitle = React.forwardRef<
  HTMLDivElement,
  SelectGroupTitleProps
>(function SelectGroupTitle({ mode, className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      role="presentation"
      data-mode={mode === "mobile" ? "h5" : "pc"}
      className={cn(
        "box-border w-full",
        "px-[var(--bv-select-group-title-padding-x)] py-[var(--bv-select-group-title-padding-y)]",
        "text-bv-sm leading-[var(--bv-select-group-title-line-height)]",
        "text-[var(--bv-select-group-title-color)] bg-[var(--bv-select-group-title-background)]",
        className,
      )}
      {...props}
      data-slot="select-group-title"
    >
      {children}
    </div>
  );
});

export interface SelectPanelProps {
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 过滤后的条目（保留分组结构），用于渲染 */
  items: SelectItem[];
  /** 过滤后的扁平选项，用于键盘导航、虚拟滚动与空态判定 */
  options: SelectOption[];
  /** 过滤**前**的选项总数：H5 的「选项 > 10 才显示搜索框」必须按它判定，按过滤后的数会边打字边把搜索框藏掉 */
  optionCount: number;
  /**
   * 当前应展示为「已选」的集合。
   *
   * 注意它**不等于已提交值**：H5 走暂存确认时传的是暂存副本 ——
   * 面板只负责把当前该显示的选中态画出来，提交与否是分发层的事
   * （触发器回显仍取已提交值，所以「面板里打了勾」与「触发器变了」是两回事）。
   * PC 恒等于已提交值（点一下即生效，没有暂存这一层）。
   */
  selected: SelectValue[];
  onSelect: (option: SelectOption) => void;
  multiple: boolean;
  searchable: boolean;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  searchPlaceholder: string;
  placeholder?: React.ReactNode;
  emptyText: React.ReactNode;
  clearable: boolean;
  onClear: () => void;
  disabled: boolean;
  /** 触发器里已选内容的呈现，由分发层算好，两模式完全一致 */
  triggerContent: React.ReactNode;
  /** 是否已有选中值（决定 placeholder 与清除按钮的显隐） */
  filled: boolean;
  /** H5 面板标题栏文案；PC 不渲染标题栏（浮层由触发器说明自己是什么） */
  title?: React.ReactNode;
  /**
   * H5 是否走「暂存 → 确定」。PC 恒为 false（点一下即生效，不需要确认这一步）。
   * 面板据此决定工具栏是否出现，以及点选项是否立刻回调。
   */
  staged: boolean;
  /** 工具栏右键文案 */
  confirmText?: React.ReactNode;
  /** 工具栏左键文案。它的行为是「关闭并放弃暂存」，默认文案按惯例取「取消」 */
  cancelText?: React.ReactNode;
  /** 提交暂存（工具栏右键） */
  onConfirm: () => void;
  /** 关闭并放弃暂存（工具栏左键） */
  onCancel: () => void;
  className?: string;
  ariaLabel?: string;
  /** 分发层透传的稳定 id，供 aria-controls 关联 */
  id?: string;
}

export interface RenderSelectItemsOptions {
  mode: DeviceMode;
  /** 过滤后的条目（含分组） */
  items: SelectItem[];
  selected: SelectValue[];
  onSelect: (option: SelectOption) => void;
  /** 键盘激活项的值（仅 PC 会给），用于高亮 */
  activeValue?: SelectValue;
  /** 虚拟滚动时区间起点在**全量**列表中的下标，用于 aria-posinset */
  indexOffset?: number;
  /** 全量选项总数，用于 aria-setsize */
  setSize?: number;
}

/**
 * 全量渲染选项（保留分组）。H5 一律走这条路；
 * PC 在未达虚拟化阈值时也走它，保证两种形态的行渲染逻辑只有一份。
 *
 * 虚拟滚动的那条路不复用本函数：它渲染的是**扁平切片**（分组列表项高不定，
 * 窗口化需要固定项高），但那一路同样复用 SelectOptionRow，行外观不会分叉。
 */
export function renderSelectItems({
  mode,
  items,
  selected,
  onSelect,
  activeValue,
  indexOffset = 0,
  setSize,
}: RenderSelectItemsOptions): React.ReactNode {
  const rows: React.ReactNode[] = [];
  /** 只统计「选项」的序号（分组标题不占位），保证 aria-posinset 与 listbox 语义一致 */
  let optionIndex = 0;

  const buildRow = (option: SelectOption): React.ReactNode => {
    optionIndex += 1;
    return (
      <SelectOptionRow
        key={String(option.value)}
        mode={mode}
        option={option}
        selected={selected.includes(option.value)}
        active={
          activeValue !== undefined && activeValue === option.value
        }
        onSelect={onSelect}
        posInSet={
          setSize === undefined
            ? undefined
            : indexOffset + optionIndex
        }
        setSize={setSize}
      />
    );
  };

  items.forEach((item, itemIndex) => {
    if (isSelectGroup(item)) {
      // 用 role="group" 包一层：ARIA 允许 listbox 内出现 group，
      // 让读屏能播报「分组名 + 该组第 n 项 / 共 m 项」而不是把标题当成一个选项
      rows.push(
        <div
          role="group"
          key={`group-${itemIndex}`}
          data-slot="select-group"
        >
          <SelectGroupTitle mode={mode}>
            {item.group}
          </SelectGroupTitle>
          {item.options.map(buildRow)}
        </div>,
      );
      return;
    }

    rows.push(buildRow(item));
  });

  return rows;
}

export interface SelectEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: DeviceMode;
}

export const SelectEmptyState = React.forwardRef<
  HTMLDivElement,
  SelectEmptyStateProps
>(function SelectEmptyState({ mode, className, children, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      className={cn(
        "box-border w-full",
        "px-[var(--bv-select-padding-x)] py-[var(--bv-select-empty-padding-y)]",
        "text-center text-bv-md leading-[var(--bv-select-empty-line-height)] text-bv-text-3",
        className,
      )}
      {...props}
      data-slot="select-empty"
    >
      {children}
    </div>
  );
});
