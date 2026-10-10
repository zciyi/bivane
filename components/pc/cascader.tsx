import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { PickerTrigger } from "@/components/ui/picker-parts";
import {
  CascaderBreadcrumb,
  CascaderOptionRow,
  CascaderSearchResultRow,
} from "@/components/ui/cascader-parts";
import {
  SelectEmptyState,
  SelectSearchField,
} from "@/components/ui/select-parts";
import type { DeviceMode } from "@/hooks/use-device-mode";
import {
  derivePanelColumns,
  firstEnabled,
  hasChildren,
  type CascaderOption,
  type CascaderValue,
  type FlatLeaf,
} from "@/hooks/use-cascader-state";

/**
 * Bivane Cascader · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：锚定浮层，顶部面包屑（根层 + 各级选中项，每项可点回退），
 *       下方逐级向右展开的多列面板；searchable 时顶部搜索框，按**路径全文**
 *       过滤叶子，点结果直接选中完整路径并关闭。点叶子即生效即关（无确认条，
 *       桌面点选即生效，同 Select/DropdownMenu）。
 *
 * 展开即定位（架构 §6.5 第 7 条）：打开时导航链 = 已提交路径，各列选中项
 * 在 ref 回调里滚入视野 —— Radix Presence 节点晚挂载，依赖 open 的 effect
 * 拿不到列 DOM，所以滚入视野挂在选项行的 ref 回调上，ref 身份保持稳定。
 *
 * 键盘：焦点留在面板，↑↓ 列内巡航、→/Enter 展开或选中、← 回上一级、
 *       Esc / 点外部关闭。搜索态下按键让给输入框，不拦。
 */

const SIDE_OFFSET = 4;

export interface PcCascaderPanelProps {
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tree: CascaderOption[];
  /** 当前导航链（可停在父级；选中叶子后由分发层收起浮层） */
  chain: CascaderValue[];
  onChainChange: (values: CascaderValue[]) => void;
  /** 已提交完整路径（搜索结果的勾用它判定） */
  selectedValues: CascaderValue[];
  onCommit: (values: CascaderValue[]) => void;
  onCancel: () => void;
  onClear: () => void;
  searchable: boolean;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  searchResults: FlatLeaf[];
  searchPlaceholder: string;
  emptyText: React.ReactNode;
  rootText: React.ReactNode;
  title?: React.ReactNode;
  placeholder?: React.ReactNode;
  disabled: boolean;
  clearable: boolean;
  triggerText: string;
  filled: boolean;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

export const PcCascader = React.forwardRef<
  HTMLDivElement,
  PcCascaderPanelProps
>(function PcCascader(
  {
    mode,
    open,
    onOpenChange,
    tree,
    chain,
    onChainChange,
    selectedValues,
    onCommit,
    onClear,
    searchable,
    keyword,
    onKeywordChange,
    searchResults,
    searchPlaceholder,
    emptyText,
    rootText,
    placeholder,
    disabled,
    clearable,
    triggerText,
    filled,
    className,
    ariaLabel,
    id,
  },
  ref,
) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);
  const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);
  const [activeIndices, setActiveIndices] = React.useState<number[]>([]);

  const { columns, chain: chainOptions } = React.useMemo(
    () => derivePanelColumns(tree, chain),
    [tree, chain],
  );

  const searching = keyword.trim() !== "";

  /**
   * 打开 / 导航链变化时刷新键盘落点：每列激活项 = 链上选中项（无则首个可选项），
   * 键盘光标停在最深一列（继续往下选是主路径）。
   */
  React.useEffect(() => {
    if (!open || searching) return;
    setActiveIndices(
      columns.map((options, columnIndex) => {
        const value = chain[columnIndex];
        const exact =
          value === undefined
            ? -1
            : options.findIndex((o) => o.value === value);
        if (exact >= 0) return exact;
        const first = firstEnabled(options);
        return first ? options.indexOf(first) : 0;
      }),
    );
    setActiveColumnIndex(Math.max(0, columns.length - 1));
  }, [open, columns, chain, searching]);

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

  /** 选中某个选项：父级展开下一列，叶子提交整条路径 */
  const chooseOption = React.useCallback(
    (columnIndex: number, option: CascaderOption) => {
      if (option.disabled) return;
      const nextValues = [...chain.slice(0, columnIndex), option.value];
      if (hasChildren(option)) {
        setActiveColumnIndex(columnIndex + 1);
        onChainChange(nextValues);
      } else {
        onCommit(nextValues);
      }
    },
    [chain, onChainChange, onCommit],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open || searching) return;
    // 焦点在搜索框时让输入框自己处理按键
    if (event.target instanceof HTMLInputElement) return;

    const column = columns[activeColumnIndex];
    if (!column) return;
    const current = activeIndices[activeColumnIndex] ?? 0;

    const step = (delta: number) => {
      for (
        let i = current + delta;
        i >= 0 && i < column.length;
        i += delta
      ) {
        if (!column[i].disabled) {
          setActiveAt(activeColumnIndex, i);
          return;
        }
      }
    };

    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        step(-1);
        return;
      case "ArrowDown":
        event.preventDefault();
        step(1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        if (chain.length > 0) onChainChange(chain.slice(0, -1));
        return;
      case "ArrowRight":
      case "Enter": {
        const option = column[current];
        if (!option || option.disabled) return;
        event.preventDefault();
        chooseOption(activeColumnIndex, option);
        return;
      }
      case "Home": {
        event.preventDefault();
        const first = firstEnabled(column);
        if (first)
          setActiveAt(activeColumnIndex, column.indexOf(first));
        return;
      }
      case "End": {
        event.preventDefault();
        for (let i = column.length - 1; i >= 0; i -= 1) {
          if (!column[i].disabled) {
            setActiveAt(activeColumnIndex, i);
            break;
          }
        }
        return;
      }
      default:
        return;
    }
  };

  // 面包屑：根层格恒在（点它回根），链上每项点了截到该层
  const crumbs = [
    { label: rootText, onSelect: () => onChainChange([]) },
    ...chainOptions.map((option, index) => ({
      label: option.label,
      onSelect: () => onChainChange(chain.slice(0, index + 1)),
    })),
  ];

  /** 行 ref 回调：把该列选中/激活项滚入视野（ref 身份稳定，节点挂载即触发） */
  const makeRowRef = (
    columnIndex: number,
    optionIndex: number,
    selected: boolean,
  ) => {
    return (node: HTMLButtonElement | null) => {
      if (!node || !open) return;
      const shouldReveal =
        selected || optionIndex === activeIndices[columnIndex];
      if (shouldReveal && typeof node.scrollIntoView === "function") {
        node.scrollIntoView({ block: "nearest" });
      }
    };
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
    >
      {/* 必须用 Trigger（不能 Anchor 自管开合），原因同 pc/picker：triggerRef
        登记后「点触发器不算浮层外部交互」的延迟关闭保护才生效 */}
      <PopoverPrimitive.Trigger
        asChild
        // disabled 守卫必须挂在 Trigger 本身（先于 onOpenToggle），原因同 pc/picker
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
          aria-label={ariaLabel ?? "级联选择"}
          align="start"
          side="bottom"
          sideOffset={SIDE_OFFSET}
          avoidCollisions
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(event) => {
            // 有搜索框时打开即可输入；否则焦点留面板驱动键盘巡航
            if (searchable && searchRef.current) {
              event.preventDefault();
              searchRef.current.focus();
              return;
            }
            event.preventDefault();
            panelRef.current?.focus({ preventScroll: true });
          }}
          // 不自定义 onCloseAutoFocus：外部转焦不还焦由 Radix
          // hasInteractedOutside 自动跳过，Esc/选中叶子才还焦 trigger（§3.11 规则 7）
          style={{
            width:
              "calc(var(--bv-cascader-pc-column-width) * " +
              String(Math.max(1, columns.length)) +
              ")",
          }}
          className={cn(
            "z-[var(--bv-cascader-pc-z-index)] box-border flex max-w-[var(--radix-popper-available-width,100vw)] flex-col overflow-hidden",
            "rounded-[var(--bv-cascader-pc-radius)] border border-bv-border bg-bv-surface",
            "shadow-[var(--bv-cascader-pc-shadow)]",
            className,
          )}
          data-slot="cascader-panel"
        >
          {searchable ? (
            <SelectSearchField
              ref={searchRef}
              mode={mode}
              value={keyword}
              onValueChange={onKeywordChange}
              placeholder={searchPlaceholder}
              aria-label="搜索选项"
            />
          ) : null}

          {searching ? (
            <div
              role="listbox"
              aria-label="搜索结果"
              data-slot="cascader-search-list"
              className="min-h-0 overflow-y-auto overscroll-contain py-[var(--bv-cascader-pc-padding-y)]"
            >
              {searchResults.length === 0 ? (
                <SelectEmptyState mode={mode}>
                  {emptyText}
                </SelectEmptyState>
              ) : (
                searchResults.map((leaf) => (
                  <CascaderSearchResultRow
                    key={leaf.values.join("/")}
                    mode={mode}
                    path={leaf.path}
                    selected={
                      selectedValues.length ===
                        leaf.values.length &&
                      selectedValues.every(
                        (value, index) =>
                          value ===
                          leaf.values[index],
                      )
                    }
                    onSelect={() => onCommit(leaf.values)}
                  />
                ))
              )}
            </div>
          ) : tree.length === 0 ? (
            <SelectEmptyState mode={mode}>
              {emptyText}
            </SelectEmptyState>
          ) : (
            <>
              <CascaderBreadcrumb mode={mode} crumbs={crumbs} />

              <div
                data-slot="cascader-pc-columns"
                className="flex min-h-0 items-stretch overflow-x-auto overscroll-contain"
              >
                {columns.map((column, columnIndex) => (
                  <div
                    key={columnIndex}
                    role="listbox"
                    aria-label={
                      columnIndex === 0
                        ? String(rootText)
                        : String(
                           chainOptions[
                             columnIndex - 1
                           ]?.label ?? rootText,
                         )
                    }
                    data-slot="cascader-pc-column"
                    data-active={
                      columnIndex === activeColumnIndex
                        ? "true"
                        : undefined
                    }
                    className={cn(
                      "min-h-0 w-[var(--bv-cascader-pc-column-width)] shrink-0",
                      "max-h-[var(--bv-cascader-pc-panel-max-height)] overflow-y-auto overscroll-contain",
                      "py-[var(--bv-cascader-pc-padding-y)]",
                      columnIndex > 0 &&
                        "border-l border-[var(--bv-picker-column-divider-color)]",
                    )}
                  >
                    {column.map((option, optionIndex) => {
                      const selected =
                        option.value ===
                        chain[columnIndex];
                      return (
                        <CascaderOptionRow
                          key={String(option.value)}
                          ref={makeRowRef(
                            columnIndex,
                            optionIndex,
                            selected,
                          )}
                          mode={mode}
                          option={option}
                          selected={selected}
                          active={
                            optionIndex ===
                            activeIndices[
                              columnIndex
                            ]
                          }
                          onSelect={(next) => {
                            setActiveColumnIndex(
                              columnIndex,
                            );
                            chooseOption(
                              columnIndex,
                              next,
                            );
                          }}
                          onMouseEnter={() =>
                            setActiveAt(
                              columnIndex,
                              optionIndex,
                            )
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});
