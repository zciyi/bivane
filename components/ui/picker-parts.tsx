import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import type { DeviceMode } from "@/hooks/use-device-mode";
import type {
  PickerDraftValue,
  PickerOption,
  PickerValue,
} from "@/hooks/use-picker-state";
import {
  WHEEL_ITEM_HEIGHT,
  WHEEL_VISIBLE_ROWS,
  alignOffset,
  usePickerColumn,
  wheelPadding,
} from "@/hooks/use-picker-column";

/**
 * Bivane Picker · 跨模式共用零件（模式 C 的「共享展示」那一层）
 *
 * 共享三件：
 *   1. PickerTrigger —— 两端同一个触发器（H5 通栏细下边线 44px / PC 32px 描边盒），
 *      Cascader 触发器同源复用，故槽名取 picker-* 而不是 cascader-*；
 *   2. PickerWheelColumn / PickerWheelRow —— H5 的多列滚轮，Cascader H5 的
 *      联动滚轮也是它（列内容由调用方派生，滚轮本身不知道「联动」）；
 *   3. PickerFooterBar —— PC 浮层底部「取消 / 确定」条。多列选择要全部调好才算
 *      选完，所以 PC 也走暂存确认（架构 §6.5 第 5 条，同 TimePicker）。
 *
 * PC 的纵向列表面板是 Picker 独有外壳，不放在本文件（Cascader PC 是另一套面包屑
 * 多列面板，没有可共用的行模型）。
 *
 * 本文件没有 bv-h5: / bv-pc: 变体：触发器渲染在用户页面里、滚轮挂在 Portal 下，
 * 都未必有 data-mode 祖先，外壳差异一律走显式 JS 分支（契约 17）。
 */

/* ------------------------------------------------------------------ *
 * 面板契约（h5/pc 两份实现的统一 props）
 * ------------------------------------------------------------------ */

export interface PickerPanelProps {
  /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 归一化后的各列选项 */
  columns: ReadonlyArray<ReadonlyArray<PickerOption>>;
  /** 面板里正在编辑的草稿（每列一个值，空列位为 undefined） */
  draft: ReadonlyArray<PickerDraftValue>;
  onDraftChange: (next: PickerDraftValue[]) => void;
  /** 要求提交草稿（两端的「确定」；PC 的 Enter 走同一条） */
  onSubmit: (draft: ReadonlyArray<PickerDraftValue>) => void;
  /** 关闭并丢弃草稿 */
  onCancel: () => void;
  /** 清空**已提交**值（触发器上的清除按钮） */
  onClear: () => void;
  /** H5 面板标题（PC 不渲染标题栏，浮层由触发器说明自己是什么） */
  title?: React.ReactNode;
  placeholder?: React.ReactNode;
  disabled: boolean;
  clearable: boolean;
  /** 触发器回显文案（未选时为空串） */
  triggerText: string;
  filled: boolean;
  confirmText: React.ReactNode;
  cancelText: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

/* ------------------------------------------------------------------ *
 * 触发器
 * ------------------------------------------------------------------ */

function triggerShellClass(mode: DeviceMode): string {
  if (mode === "mobile") {
    return cn(
      "relative flex w-full box-border items-center",
      "px-[var(--bv-picker-padding-x)] py-[var(--bv-picker-padding-y)]",
      "bg-bv-surface",
      "bv-hairline bv-hairline--bottom",
    );
  }
  return cn(
    "relative flex w-full box-border items-center",
    "h-[var(--bv-picker-pc-trigger-height)]",
    "px-[var(--bv-picker-padding-x)] py-0",
    "bg-bv-surface border border-[var(--bv-picker-pc-trigger-border-color)]",
    "rounded-[var(--bv-picker-pc-trigger-radius)]",
    "transition-colors duration-[var(--bv-duration-fast)]",
    "hover:border-bv-primary",
    "focus-within:border-bv-primary focus-within:ring-1 focus-within:ring-bv-primary",
    "focus-visible:border-bv-primary focus-visible:outline-none",
  );
}

export interface PickerTriggerProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
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
  /** 触发器上的方向键（PC 用来在未展开时直接唤起面板） */
  onArrowKey?: (direction: "up" | "down") => void;
  /**
   * click 开合是否已委托外层（PC Radix Popover.Trigger）。
   * 默认 false：H5 由本元素 click 自激活；PC 必须传 true 防双触发
   */
  clickDelegated?: boolean;
  "aria-label"?: string;
}

export const PickerTrigger = React.forwardRef<
  HTMLDivElement,
  PickerTriggerProps
>(function PickerTrigger(
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
    onArrowKey,
    clickDelegated = false,
    className,
    onClick,
    onKeyDown,
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  // 鼠标开合：H5 由本元素 click 自激活；PC 委托 Radix Popover.Trigger（原因见 select-parts）
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
      aria-haspopup="dialog"
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-state={open ? "open" : "closed"}
      data-filled={filled ? "true" : undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        triggerShellClass(mode),
        "gap-[var(--bv-picker-gap)]",
        disabled
          ? "cursor-not-allowed opacity-[var(--bv-picker-disabled-opacity)]"
          : "cursor-pointer",
        className,
      )}
      {...props}
      data-slot="picker-trigger"
    >
      <span
        data-slot="picker-trigger-value"
        className={cn(
          "min-w-0 flex-1 truncate text-bv-md leading-[var(--bv-picker-line-height)]",
          filled
            ? "text-[var(--bv-picker-text-color)]"
            : "text-[var(--bv-picker-placeholder-color)]",
        )}
      >
        {filled ? text : placeholder}
      </span>

      {clearable && filled && !disabled ? (
        <button
          type="button"
          data-slot="picker-trigger-clear"
          aria-label="清除"
          tabIndex={-1}
          // preventDefault 短路 Radix toggle（X 在 triggerRef 内，同实例
          // pointerDownOutside 也会被放行）；不能 stopPropagation —— 否则别的
          // 浮层挂 document 的延迟 dismiss 收不到这次 click
          onClick={(event) => {
            event.preventDefault();
            onClear?.();
          }}
          className={cn(
            "flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0",
            "text-[length:var(--bv-picker-icon-size)] text-[var(--bv-picker-icon-color)]",
            "hover:text-bv-text-2",
          )}
        >
          <Icon name="cross" />
        </button>
      ) : null}

      <span
        data-slot="picker-trigger-indicator"
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center",
          "text-[length:var(--bv-picker-icon-size)] text-[var(--bv-picker-icon-color)]",
          "transition-transform duration-[var(--bv-duration-fast)]",
          open && "rotate-180",
        )}
      >
        <Icon name="arrow-down" />
      </span>
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * 滚轮列 / 滚轮行（H5；Cascader H5 同源复用）
 * ------------------------------------------------------------------ */

export interface PickerWheelColumnProps {
  mode: DeviceMode;
  /** 无障碍名称，如「省份」。无独立列名时由行给「第 N 列」 */
  label: string;
  options: ReadonlyArray<PickerOption>;
  /** 当前值；不在列内时滚轮落第一个可选项（resolveDraftValues 已做兜底） */
  value: PickerValue | undefined;
  disabled?: boolean;
  /**
   * 键盘正在驾驶的列（仅 PC 键盘语义复用此件时给；触屏没有「当前列」概念）。
   * 生效方式是中央高亮带叠一层 --bv-active-color，不新增 token。
   */
  active?: boolean;
  onValueChange: (value: PickerValue) => void;
}

export const PickerWheelColumn = React.forwardRef<
  HTMLDivElement,
  PickerWheelColumnProps
>(function PickerWheelColumn(
  {
    mode,
    label,
    options,
    value,
    disabled = false,
    active = false,
    onValueChange,
  },
  ref,
) {
  const index = React.useMemo(() => {
    const found = options.findIndex((option) => option.value === value);
    return found >= 0 ? found : 0;
  }, [options, value]);

  // 行高以实测为准（token 是事实源），jsdom 量不到时回落常量
  const [itemHeight, setItemHeight] = React.useState(WHEEL_ITEM_HEIGHT);

  const handleIndexChange = React.useCallback(
    (next: number) => {
      const nextOption = options[next];
      if (!nextOption || nextOption.value === value) return;
      onValueChange(nextOption.value);
    },
    [options, value, onValueChange],
  );

  const { containerRef, onScroll, scrollToIndex } = usePickerColumn({
    index,
    count: options.length,
    itemHeight,
    onIndexChange: handleIndexChange,
  });

  React.useLayoutEffect(() => {
    const node = containerRef.current?.querySelector(
      '[data-slot="picker-wheel-item"]',
    );
    const measured = node instanceof HTMLElement ? node.offsetHeight : 0;
    if (measured > 0)
      setItemHeight((prev) => (prev === measured ? prev : measured));
  }, [options.length, containerRef]);

  const padding = wheelPadding(itemHeight, WHEEL_VISIBLE_ROWS);

  return (
    <div
      ref={ref}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      role="listbox"
      aria-label={label}
      data-slot="picker-wheel"
      data-active={active ? "true" : undefined}
      className="relative min-w-0 flex-1 overflow-hidden"
      style={{ height: alignOffset(WHEEL_VISIBLE_ROWS, itemHeight) }}
    >
      <div
        aria-hidden="true"
        data-slot="picker-wheel-indicator"
        className={cn(
          // z-0：高亮带画在文字下面，active 列的底色才不会盖住居中数字（同 TimeWheelColumn）
          "pointer-events-none absolute inset-x-0 z-0",
          "border-y border-[var(--bv-picker-wheel-line-color)]",
          active && "bg-[var(--bv-active-color)]",
        )}
        style={{ top: alignOffset(2, itemHeight), height: itemHeight }}
      />

      <div
        ref={containerRef}
        onScroll={onScroll}
        data-bv-scroll-container=""
        data-slot="picker-wheel-scroller"
        className={cn(
          "relative z-[1] h-full w-full overflow-y-auto overscroll-contain",
          "snap-y snap-mandatory",
        )}
        style={{ paddingTop: padding, paddingBottom: padding }}
      >
        {options.map((option, optionIndex) => {
          const selected = optionIndex === index;
          // tabIndex=-1：滚轮项不进 Tab 流，能被聚焦的项恒等于当前值
          return (
            <button
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled || option.disabled}
              tabIndex={-1}
              data-slot="picker-wheel-item"
              data-selected={selected ? "true" : undefined}
              onClick={() => {
                // 同 DatePicker 滚轮：先滚动带入选中行再回写值（顺序反了会各滚一次抖动）；
                // 点当前行不回写，避免级联滚轮无谓重算
                if (disabled || option.disabled || selected)
                  return;
                scrollToIndex(optionIndex);
                onValueChange(option.value);
              }}
              className={cn(
                "flex w-full cursor-pointer snap-center items-center justify-center",
                "border-0 bg-transparent px-[var(--bv-padding-xs)]",
                "h-[var(--bv-picker-wheel-item-height)]",
                "text-bv-md leading-[var(--bv-picker-wheel-item-line-height)]",
                selected
                  ? "font-bold text-[var(--bv-picker-wheel-selected-color)]"
                  : "text-[var(--bv-picker-wheel-color)]",
                (disabled || option.disabled) &&
                  "cursor-not-allowed",
              )}
            >
              <span className="block truncate">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        data-slot="picker-wheel-mask"
        data-mask="top"
        className="pointer-events-none absolute inset-x-0 top-0 z-[2]"
        style={{ height: alignOffset(2, itemHeight) }}
      />
      <div
        aria-hidden="true"
        data-slot="picker-wheel-mask"
        data-mask="bottom"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] rotate-180"
        style={{ height: alignOffset(2, itemHeight) }}
      />
    </div>
  );
});

/** 一列的渲染描述：列内容由调用方给（Picker 是静态列，Cascader 是派生的联动列） */
export interface PickerWheelColumnDef {
  options: ReadonlyArray<PickerOption>;
  value: PickerValue | undefined;
  /** 不传给时行按序号生成「第 N 列」无障碍名 */
  label?: string;
}

export interface PickerWheelRowProps {
  mode: DeviceMode;
  columns: ReadonlyArray<PickerWheelColumnDef>;
  disabled?: boolean;
  /** 键盘光标所在列下标（仅 PC 键盘语义复用时给） */
  activeColumnIndex?: number;
  /** 某一列选到了新值（滚轮吸附停下、或点了某一项） */
  onColumnChange: (columnIndex: number, value: PickerValue) => void;
  className?: string;
}

/**
 * 多列滚轮横排。等宽 flex 平分，列与列之间靠滚轮自身的中央分隔线区分；
 * Cascader H5 传入的列数随树深固定（省/市/区三列），Picker 随业务配置。
 */
export const PickerWheelRow = React.forwardRef<
  HTMLDivElement,
  PickerWheelRowProps
>(function PickerWheelRow(
  {
    mode,
    columns,
    disabled = false,
    activeColumnIndex,
    onColumnChange,
    className,
  },
  ref,
) {
  return (
    <div
      ref={ref}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-slot="picker-wheels"
      className={cn(
        "flex w-full min-h-0 items-center bg-bv-surface",
        className,
      )}
    >
      {columns.map((column, columnIndex) => (
        <React.Fragment key={columnIndex}>
          {columnIndex > 0 ? (
            <span
              aria-hidden="true"
              data-slot="picker-wheel-divider"
              className="h-[var(--bv-picker-wheel-item-height)] w-px shrink-0 bg-[var(--bv-picker-column-divider-color)]"
            />
          ) : null}
          <PickerWheelColumn
            mode={mode}
            label={column.label ?? `第 ${columnIndex + 1} 列`}
            options={column.options}
            value={column.value}
            disabled={disabled}
            active={columnIndex === activeColumnIndex}
            onValueChange={(nextValue) =>
              onColumnChange(columnIndex, nextValue)
            }
          />
        </React.Fragment>
      ))}
    </div>
  );
});

/* ------------------------------------------------------------------ *
 * PC 浮层底部「取消 / 确定」条
 * ------------------------------------------------------------------ */

export interface PickerFooterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  mode: DeviceMode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  /** 「确定」禁用（有空列/校验未过） */
  confirmDisabled?: boolean;
  /** 左侧提示文案（如校验错误），不传只靠右对齐两个按钮 */
  hint?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const PickerFooterBar = React.forwardRef<
  HTMLDivElement,
  PickerFooterBarProps
>(function PickerFooterBar(
  {
    mode,
    confirmText = "确定",
    cancelText = "取消",
    confirmDisabled = false,
    hint,
    onConfirm,
    onCancel,
    className,
    ...props
  },
  ref,
) {
  return (
    <div
      ref={ref}
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-slot="picker-footer"
      className={cn(
        "flex shrink-0 items-center justify-end",
        "gap-[var(--bv-picker-pc-padding-x)]",
        "px-[var(--bv-picker-pc-padding-x)] py-[var(--bv-picker-pc-padding-y)]",
        "bv-hairline bv-hairline--top",
        className,
      )}
      {...props}
    >
      {hint ? (
        <span
          data-slot="picker-footer-hint"
          className="mr-auto text-bv-xs leading-[var(--bv-picker-line-height)] text-bv-danger"
        >
          {hint}
        </span>
      ) : null}
      <button
        type="button"
        data-slot="picker-cancel"
        onClick={onCancel}
        className={cn(buttonVariants({ size: "small" }), "shrink-0")}
      >
        {cancelText}
      </button>
      <button
        type="button"
        data-slot="picker-confirm"
        disabled={confirmDisabled}
        aria-disabled={confirmDisabled || undefined}
        onClick={onConfirm}
        className={cn(
          buttonVariants({ type: "primary", size: "small" }),
          "shrink-0",
        )}
      >
        {confirmText}
      </button>
    </div>
  );
});
