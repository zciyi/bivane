import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  PickerFooterBar,
  PickerTrigger,
  type PickerPanelProps,
} from "@/components/ui/picker-parts";
import {
  edgeEnabledIndex,
  indexOfValue,
  isDraftComplete,
  resolveColumnIndex,
  stepEnabledIndex,
  type PickerOption,
  type PickerValue,
} from "@/hooks/use-picker-state";

/**
 * Bivane Picker · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：锚定触发器的浮层 + N 列纵向面板（每列定宽、独立滚动、桌面密度 36px），
 *       底部固定「取消 / 确定」条。多列要全部调好才算选完，所以 PC 同样走
 *       暂存确认（架构 §6.5 第 5 条）——点行只改草稿，「确定」才提交。
 *
 * 键盘（焦点留在面板，行本身 tabIndex=-1 不进 Tab 流）：
 *   ↑↓ 列内巡航（跳过禁用、到边界不回绕）、←→ 换列、Home/End 首尾，
 *   Enter 选中当前激活项（已选中则提交）、Esc 取消。
 *
 * 开合走 **Popover.Trigger asChild**，禁止 Anchor 自管开合（矩阵 §3.11）：
 * Anchor 不登记 triggerRef，跨实例点击会丢失 Radix 的延迟关闭保护（要再点一次/闪关）。
 * 共用触发器传 clickDelegated：鼠标 click 委托 Radix toggle，键盘语义留在零件内。
 */

/** 面板与触发器之间的主轴间距（与 Select/DatePicker 同为 4px） */
const SIDE_OFFSET = 4;

export const PcPicker = React.forwardRef<HTMLDivElement, PickerPanelProps>(
  function PcPicker(
    {
      mode,
      open,
      onOpenChange,
      columns,
      draft,
      onDraftChange,
      onSubmit,
      onCancel,
      onClear,
      placeholder,
      disabled,
      clearable,
      triggerText,
      filled,
      confirmText,
      cancelText,
      className,
      ariaLabel,
      id,
    },
    ref,
  ) {
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const columnsRef = React.useRef<HTMLDivElement | null>(null);
    const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);
    const [activeIndices, setActiveIndices] = React.useState<number[]>([]);

    /**
     * 打开那一刻：键盘光标回第一列，各列激活项落到当前草稿值。
     * 只在 open 翻转时做（同 TimePicker），避免滚动中被重置。
     */
    React.useEffect(() => {
      if (!open) return;
      setActiveColumnIndex(0);
      setActiveIndices(
        columns.map((column, columnIndex) =>
          resolveColumnIndex(column, draft[columnIndex]),
        ),
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    /** 激活项变化时滚入视野（打开时初始落点、键盘巡航都走这里） */
    React.useEffect(() => {
      if (!open) return;
      const root = columnsRef.current;
      if (!root) return;
      const listboxes = root.querySelectorAll<HTMLElement>(
        '[data-slot="picker-pc-column"]',
      );
      listboxes.forEach((listbox, columnIndex) => {
        const targetIndex =
          columnIndex === activeColumnIndex
            ? activeIndices[columnIndex]
            : indexOfValue(
               columns[columnIndex] ?? [],
               draft[columnIndex],
             );
        const rows = listbox.querySelectorAll<HTMLElement>(
          '[data-slot="picker-pc-option"]',
        );
        const target =
          targetIndex !== undefined ? rows[targetIndex] : undefined;
        target?.scrollIntoView({ block: "nearest" });
      });
    }, [open, activeColumnIndex, activeIndices, columns, draft]);

    const patchDraftAt = React.useCallback(
      (columnIndex: number, nextValue: PickerValue) => {
        const next = draft.slice();
        next[columnIndex] = nextValue;
        onDraftChange(next);
      },
      [draft, onDraftChange],
    );

    const setActiveAt = React.useCallback(
      (columnIndex: number, nextIndex: number) => {
        setActiveIndices((prev) => {
          const next = prev.slice();
          next[columnIndex] = nextIndex;
          return next;
        });
      },
      [],
    );

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!open) return;
      // 焦点落在底部按钮上时让按钮自己处理 Enter/Space，不挡原生激活
      if (
        (event.target as HTMLElement | null)?.closest(
          '[data-slot="picker-footer"]',
        )
      )
        return;

      const column = columns[activeColumnIndex];
      if (!column) return;
      const current =
        activeIndices[activeColumnIndex] ??
        resolveColumnIndex(column, draft[activeColumnIndex]);

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          setActiveAt(
            activeColumnIndex,
            stepEnabledIndex(column, current, -1),
          );
          return;
        case "ArrowDown":
          event.preventDefault();
          setActiveAt(
            activeColumnIndex,
            stepEnabledIndex(column, current, 1),
          );
          return;
        case "ArrowLeft":
          event.preventDefault();
          if (activeColumnIndex > 0)
            setActiveColumnIndex(activeColumnIndex - 1);
          return;
        case "ArrowRight":
          event.preventDefault();
          if (activeColumnIndex < columns.length - 1)
            setActiveColumnIndex(activeColumnIndex + 1);
          return;
        case "Home":
          event.preventDefault();
          setActiveAt(
            activeColumnIndex,
            edgeEnabledIndex(column, "start"),
          );
          return;
        case "End":
          event.preventDefault();
          setActiveAt(
            activeColumnIndex,
            edgeEnabledIndex(column, "end"),
          );
          return;
        case "Enter": {
          const option = column[current];
          if (!option || option.disabled) return;
          event.preventDefault();
          if (option.value === draft[activeColumnIndex]) {
            onSubmit(draft);
          } else {
            patchDraftAt(activeColumnIndex, option.value);
          }
          return;
        }
        case "Escape":
          event.preventDefault();
          onCancel();
          return;
        default:
          return;
      }
    };

    const handleOptionClick = (
      columnIndex: number,
      option: PickerOption,
    ) => {
      if (option.disabled) return;
      setActiveAt(
        columnIndex,
        indexOfValue(columns[columnIndex], option.value),
      );
      patchDraftAt(columnIndex, option.value);
    };

    const confirmDisabled = !isDraftComplete(draft);
    const listboxId = id ? `${id}-listbox` : undefined;

    return (
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        modal={false}
      >
        {/* 必须用 Trigger（不能 Anchor 自管开合）：triggerRef 登记后，点触发器/
          焦点落回触发器才不算「浮层外部交互」，延迟关闭保护才生效；asChild 不加额外 DOM */}
        <PopoverPrimitive.Trigger
          asChild
          // disabled 守卫必须挂在 Trigger 本身（先于 onOpenToggle），原因同 pc/select
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <PickerTrigger
            ref={ref}
            id={id}
            mode={mode}
            text={triggerText}
            placeholder={placeholder}
            filled={filled}
            clearable={clearable}
            onClear={onClear}
            disabled={disabled}
            open={open}
            aria-label={ariaLabel}
            aria-controls={listboxId}
            // onActivate 只服务键盘；鼠标开合由 Radix Trigger 的 click 承担
            onActivate={() => onOpenChange(!open)}
            onArrowKey={() => onOpenChange(true)}
            clickDelegated
          />
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            ref={panelRef}
            data-mode={mode === "mobile" ? "h5" : "pc"}
            data-state={open ? "open" : "closed"}
            aria-label={ariaLabel ?? "选择面板"}
            align="start"
            side="bottom"
            sideOffset={SIDE_OFFSET}
            avoidCollisions
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            onOpenAutoFocus={(event) => {
              // 焦点留在面板上驱动键盘巡航（行不进 Tab 流）
              event.preventDefault();
              panelRef.current?.focus({ preventScroll: true });
            }}
            // 不自定义 onCloseAutoFocus：外部转焦不还焦由 Radix
            // hasInteractedOutside 自动跳过，Esc/确定才还焦 trigger（§3.11 规则 7）
            className={cn(
              // 面板随各列内容撑开（列不省略文案）；视口放不下时 max-w 收口，列区横向滚
              "z-[var(--bv-picker-pc-z-index)] box-border flex w-max max-w-[var(--radix-popper-available-width,100vw)] flex-col overflow-hidden",
              "rounded-[var(--bv-picker-pc-radius)] border border-bv-border bg-bv-surface",
              "shadow-[var(--bv-picker-pc-shadow)]",
              className,
            )}
            data-slot="picker-panel"
          >
            {/* 列区 flush（与 pc/cascader 同一结构）：列宽已含行内边距，
              列间分隔线是列自身的 border-l（border-box 含在列宽内），不占额外宽度，
              否则 N 列内容会比面板宽出 (N-1)px 顶出横向滚动条 */}
            <div
              ref={columnsRef}
              id={listboxId}
              data-slot="picker-pc-columns"
              className="flex min-h-0 items-stretch overflow-x-auto overscroll-contain"
            >
              {columns.map((column, columnIndex) => (
                <div
                  key={columnIndex}
                  role="listbox"
                  aria-label={`第 ${columnIndex + 1} 列`}
                  data-slot="picker-pc-column"
                  data-active={
                    columnIndex === activeColumnIndex
                      ? "true"
                      : undefined
                  }
                  className={cn(
                    "min-h-0 shrink-0 overflow-y-auto overscroll-contain",
                    // 列宽按本列最长项撑开（不省略），132 只是最小列宽；
                    // 最宽行的 max-content 决定列宽，行内 w-full 再吃满该宽度
                    "w-max min-w-[var(--bv-picker-pc-column-width)]",
                    "max-h-[var(--bv-picker-pc-panel-max-height)]",
                    "py-[var(--bv-picker-pc-padding-y)]",
                    columnIndex > 0 &&
                      "border-l border-[var(--bv-picker-column-divider-color)]",
                  )}
                >
                  {column.map((option, optionIndex) => {
                    const selected =
                      option.value === draft[columnIndex];
                    const active =
                      optionIndex ===
                      activeIndices[columnIndex];
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={option.disabled}
                        data-slot="picker-pc-option"
                        data-selected={
                          selected
                            ? "true"
                            : undefined
                        }
                        data-active={
                          active ? "true" : undefined
                        }
                        onClick={() =>
                          handleOptionClick(
                            columnIndex,
                            option,
                          )
                        }
                        onMouseEnter={() =>
                          setActiveAt(
                            columnIndex,
                            optionIndex,
                          )
                        }
                        className={cn(
                          // 与 CascaderOptionRow 同款桌面行：左对齐、选中 primary + 右侧勾
                          "group flex w-full cursor-pointer box-border items-center border-0 bg-transparent text-left",
                          "px-[var(--bv-picker-pc-padding-x)] h-[var(--bv-picker-pc-row-height)] gap-[var(--bv-picker-gap)]",
                          "text-bv-md leading-[var(--bv-line-md)]",
                          selected
                            ? "text-bv-primary"
                            : "text-bv-text",
                          "hover:bg-[var(--bv-active-color)]",
                          active &&
                            "bg-[var(--bv-active-color)]",
                          option.disabled &&
                            "cursor-not-allowed opacity-[var(--bv-picker-disabled-opacity)]",
                        )}
                      >
                        <span className="whitespace-nowrap">
                          {option.label}
                        </span>
                        {selected ? (
                          <Icon
                            name="check"
                            aria-hidden="true"
                            className="shrink-0 text-[length:var(--bv-picker-icon-size)] text-bv-primary"
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <PickerFooterBar
              mode={mode}
              confirmText={confirmText}
              cancelText={cancelText}
              confirmDisabled={confirmDisabled}
              hint={confirmDisabled ? "请补全每一列" : undefined}
              onConfirm={() => onSubmit(draft)}
              onCancel={onCancel}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  },
);
