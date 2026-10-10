import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import {
  TimeRangeTabs,
  TimeTrigger,
  TimeWheelRow,
  TIME_RANGE_JOIN,
  type TimePanelProps,
  type TimeRangeEnd,
} from "@/components/ui/time-parts";
import {
  clampParts,
  compareParts,
  formatParts,
  parseTimeTextForColumns,
  resolveColumnRange,
  resolveCursor,
  type TimeColumnKey,
  type TimeParts,
} from "@/hooks/use-time-value";
import { buttonVariants } from "@/components/ui/button";

/**
 * Bivane TimePicker · PC 实现
 * 交互定义见 bivane-responsive-matrix.md §2.2 / §3.6
 *
 * 形态：锚定触发器的浮层，里面**和移动端一样是 N 列滚轮**（时 / 分 / 秒），
 *       只是外壳从「底部弹层 + 顶部工具条」换成「锚定浮层 + 底部取消/确定条」。
 *       滚轮列由 time-parts 的 TimeWheelRow 提供，两端逐字同源。
 *
 * 为什么改成同范式（2026-09-23 用户要求「PC 应该像移动端一样，只不过不是弹窗形式而是悬浮形式」）：
 *   原先 PC 是自研的可点击 listbox —— 三列定高列表 + 滚动条，鼠标点击一列即提交。
 *   它的问题不在功能而在**可读性**：定高列表看不出「当前值在哪一行」，
 *   而滚轮天然把当前值锁在中央高亮带上，一眼就能看到「我现在选的是几点」。
 *   改完之后 TimePicker 不再是模式 C（交互范式不同），而是**同范式、不同外壳**。
 *
 * 恒走「暂存 → 确定」：
 *   单值也要确认 —— 滚轮要三列都调好才算选完，第一列一动就提交并关闭是没法用的
 *   （这正是 H5 侧同样的理由）。热区外的关法保持 PC 习惯：Esc、点击浮层外部。
 *
 * 开合走 **Popover.Trigger asChild**，禁止 Anchor 自管开合（矩阵 §3.11）：
 *   Anchor 不登记 triggerRef，Radix NonModal 的触发器放行 / pointerdown 延迟 /
 *   focusoutside 压制三道保护全失效，真实浏览器跨实例点击会「要再点一次或闪关」。
 *   共用触发器传 clickDelegated：鼠标 click 委托 Radix toggle，键盘语义留在零件内。
 *
 * 翻转与位移防溢出交给 Radix Popper（矩阵 §2.2「翻转防溢出」），不自写锚点计算。
 *
 * 键盘：浮层是唯一的键盘面（滚轮项 `tabIndex=-1`，不进 Tab 流），
 *   ↑↓ 改当前列的值、←→ 换列、Home/End 到列首尾、PgUp/PgDn 步进 10、Enter 确定、Esc 取消。
 *   焦点从面板落到「取消 / 确定」上时交还给按钮自己处理（否则 Enter 会既改草稿又挡掉按钮激活）。
 */

/** 面板与触发器之间的主轴间距，走 token 语义（与 DatePicker / Select 同为 4px） */
const SIDE_OFFSET = 4;

export const PcTimePicker = React.forwardRef<HTMLDivElement, TimePanelProps>(
  function PcTimePicker(
    {
      mode,
      open,
      onOpenChange,
      type,
      columns,
      format,
      minParts,
      maxParts,
      placeholder,
      disabled,
      clearable,
      selected,
      draft,
      onDraftChange,
      onSubmit,
      onCancel,
      onClear,
      className,
      ariaLabel,
      id,
    },
    ref,
  ) {
    const panelRef = React.useRef<HTMLDivElement | null>(null);

    /** 区间端点切换是「实现层状态」：只有区间形态存在，单值形态恒为 start。 */
    const [activeEnd, setActiveEnd] = React.useState<TimeRangeEnd>("start");
    /** 键盘方向键当前驾驶的列 —— 只影响「哪一列的高亮带被点亮」，不参与取数。 */
    const [activeColumnIndex, setActiveColumnIndex] = React.useState(0);

    /** 只决定「在改哪一端」；滚轮本身不区分两端，值都由草稿派生。 */
    const endIndex = type === "range" && activeEnd === "end" ? 1 : 0;

    /**
     * 各列的取值基准：优先本端已选值 → 另一端的已选值 → 现在。
     * 没有已选值时回落到「现在」而不是 00:00:00（时间版「无值落今天」，见分发层注释）。
     */
    const cursor = React.useMemo(
      () =>
        resolveCursor(
          draft[endIndex] || draft[0] || undefined,
          columns,
          minParts,
          maxParts,
        ),
      [draft, endIndex, columns, minParts, maxParts],
    );

    /**
     * 滚轮停下 / 点了某一项：只写草稿，**绝不提交**。
     * 非法组合（如 23 时配 min=08 的分钟列）由 clampParts 就地修正。
     */
    const commitCursor = React.useCallback(
      (next: TimeParts) => {
        const parts = clampParts(next, minParts, maxParts);
        const text = formatParts(parts, format);
        if (type === "range") {
          const nextDraft = [draft[0] ?? "", draft[1] ?? ""];
          nextDraft[endIndex] = text;
          onDraftChange(nextDraft);
          // 不自动切端：滚轮有时/分/秒多列，滚第一下就跳走会让剩下两列改到另一端去；
          // 用户调完一端自己点「开始/结束时间」tab 切换（与 H5 一致）
          return;
        }
        onDraftChange([text]);
      },
      [format, minParts, maxParts, type, draft, endIndex, onDraftChange],
    );

    /** 区间确认按钮的可点性：两端都填了、且开始 < 结束才放行。 */
    const startText = draft[0] ?? "";
    const endText = draft[1] ?? "";
    const bothFilled = startText !== "" && endText !== "";
    const startBeforeEnd = React.useMemo(() => {
      if (!bothFilled) return false;
      const s = parseTimeTextForColumns(startText, columns);
      const e = parseTimeTextForColumns(endText, columns);
      return !!s && !!e && compareParts(s, e) < 0;
    }, [bothFilled, startText, endText, columns]);
    const confirmDisabled =
      type === "range" ? !bothFilled || !startBeforeEnd : !draft[0];

    /**
     * 打开那一刻落位：端点回到 start、键盘光标回到第一列。
     * 只做这两件「实现层」的事 —— 时间值本身由分发层在 open 时播种草稿，
     * 这里再去写一次就会和草稿抢（v19 记过的坑：依赖数组放 draft 会把用户选的值拽回去）。
     */
    const wasOpenRef = React.useRef(false);
    React.useEffect(() => {
      const opened = open && !wasOpenRef.current;
      wasOpenRef.current = open;
      if (!opened) return;
      setActiveEnd("start");
      setActiveColumnIndex(0);
    }, [open]);

    const triggerText = React.useMemo(
      () =>
        type === "range"
          ? selected.join(TIME_RANGE_JOIN)
          : (selected[0] ?? ""),
      [type, selected],
    );

    /** 某一列选到了新值：把键盘光标挪到那一列，然后写草稿。 */
    const handleColumnChange = React.useCallback(
      (key: TimeColumnKey, value: number) => {
        const index = columns.indexOf(key);
        if (index >= 0) setActiveColumnIndex(index);
        commitCursor({ ...cursor, [key]: value });
      },
      [columns, cursor, commitCursor],
    );

    /** 键盘光标所在列内步进：夹在「当前配置下该列的有效范围」里。 */
    const stepColumn = React.useCallback(
      (delta: number) => {
        const key = columns[activeColumnIndex];
        if (!key) return;
        const [colStart, colEnd] = resolveColumnRange(
          key,
          cursor,
          minParts,
          maxParts,
        );
        const nextVal = Math.min(
          Math.max(cursor[key] + delta, colStart),
          colEnd,
        );
        commitCursor({ ...cursor, [key]: nextVal });
      },
      [
        columns,
        activeColumnIndex,
        cursor,
        minParts,
        maxParts,
        commitCursor,
      ],
    );

    /** 键盘巡航：方向键改值、←→ 换列、Enter 确定、Esc 取消。 */
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!open) return;
      // 焦点落在底部「取消 / 确定」按钮上时，让按钮自己处理 Enter/Space，不要让
      // 面板级键盘拦截（否则会既更新草稿又阻止按钮原生激活，行为错乱）
      if (
        (event.target as HTMLElement | null)?.closest(
          '[data-slot="time-picker-footer"]',
        )
      ) {
        return;
      }
      const key = columns[activeColumnIndex];
      if (!key) return;
      const [colStart, colEnd] = resolveColumnRange(
        key,
        cursor,
        minParts,
        maxParts,
      );
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          stepColumn(-1);
          return;
        case "ArrowDown":
          event.preventDefault();
          stepColumn(1);
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
          commitCursor({ ...cursor, [key]: colStart });
          return;
        case "End":
          event.preventDefault();
          commitCursor({ ...cursor, [key]: colEnd });
          return;
        case "PageUp":
          event.preventDefault();
          stepColumn(-10);
          return;
        case "PageDown":
          event.preventDefault();
          stepColumn(10);
          return;
        case "Enter":
          event.preventDefault();
          // 与「确定」按钮同一条判据：区间没凑齐或起止颠倒时按下 Enter 不提交
          if (!confirmDisabled) onSubmit(draft);
          return;
        case "Escape":
          event.preventDefault();
          onCancel();
          return;
        default:
          return;
      }
    };

    return (
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        modal={false}
      >
        {/* 必须用 Trigger（不能 Anchor 自管开合）：triggerRef 登记后，点触发器/
          焦点落回触发器才不算「浮层外部交互」，否则真实浏览器里 focusoutside
          与延迟 pointerdown 的时序竞态会让面板「点两次才开 / 开了立刻关」 */}
        <PopoverPrimitive.Trigger
          asChild
          // disabled 守卫必须挂在 Trigger 本身（先于 onOpenToggle），原因同 pc/select
          onClick={(event) => {
            if (disabled) event.preventDefault();
          }}
        >
          <TimeTrigger
            ref={ref}
            id={id}
            mode={mode}
            text={triggerText}
            placeholder={placeholder}
            filled={selected.length > 0}
            clearable={clearable}
            onClear={onClear}
            disabled={disabled}
            open={open}
            aria-label={ariaLabel}
            // onActivate 只服务键盘（Enter/Space/↑↓）；鼠标开合由 Radix Trigger 的 click 承担
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
            aria-label={ariaLabel ?? "时间面板"}
            align="start"
            side="bottom"
            sideOffset={SIDE_OFFSET}
            avoidCollisions
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            onOpenAutoFocus={(event) => {
              // 焦点必须留在面板上，由面板级键盘处理驱动光标（滚轮项本身不在 Tab 流里）
              event.preventDefault();
              panelRef.current?.focus({ preventScroll: true });
            }}
            // 不自定义 onCloseAutoFocus：外部转焦不还焦由 Radix
            // hasInteractedOutside 自动跳过，Esc/确定才还焦 trigger（§3.11 规则 7）。
            // 「activeElement 已在触发器就不抢」这类自写守卫不够 —— 跨实例时
            // 新浮层已把焦点走，旧面板仍会把焦点抢回自己，关掉新浮层
            className={cn(
              "z-[var(--bv-time-picker-pc-z-index)] box-border",
              "rounded-[var(--bv-time-picker-pc-radius)] border border-bv-border bg-bv-surface",
              "shadow-[var(--bv-time-picker-pc-shadow)]",
              // 浮层翻转后可用的空间不够时自动变矮并内部滚动，而不是溢出视口
              "max-h-[var(--radix-popper-available-height,100vh)] overflow-y-auto overscroll-contain",
              className,
            )}
            data-slot="time-picker-panel"
          >
            {type === "range" ? (
              <TimeRangeTabs
                mode={mode}
                active={activeEnd}
                onChange={setActiveEnd}
                startText={draft[0] ?? ""}
                endText={draft[1] ?? ""}
                placeholder={placeholder}
              />
            ) : null}

            {/* 与 H5 同一个 TimeWheelRow：列名、补零、值裁剪基准两端逐字一致 */}
            <TimeWheelRow
              mode={mode}
              columnKeys={columns}
              cursor={cursor}
              minParts={minParts}
              maxParts={maxParts}
              disabled={disabled}
              activeColumnIndex={activeColumnIndex}
              onColumnChange={handleColumnChange}
              className={cn(
                "w-[var(--bv-time-picker-pc-panel-width)]",
                "px-[var(--bv-time-picker-pc-padding-x)] py-[var(--bv-time-picker-pc-padding-y)]",
              )}
            />

            <div
              data-mode={mode === "mobile" ? "h5" : "pc"}
              data-slot="time-picker-footer"
              className={cn(
                "flex shrink-0 items-center justify-end",
                "gap-[var(--bv-time-picker-pc-padding-x)]",
                "px-[var(--bv-time-picker-pc-padding-x)] py-[var(--bv-time-picker-pc-padding-y)]",
                "bv-hairline bv-hairline--top",
              )}
            >
              {type === "range" &&
              bothFilled &&
              !startBeforeEnd ? (
                <span
                  data-slot="time-picker-range-hint"
                  className={cn(
                    "mr-auto text-bv-xs leading-[var(--bv-time-picker-line-height)]",
                    "text-bv-danger",
                  )}
                >
                  开始时间须小于结束时间
                </span>
              ) : null}
              <button
                type="button"
                data-slot="time-picker-cancel"
                onClick={onCancel}
                className={cn(
                  buttonVariants({ size: "small" }),
                  "shrink-0",
                )}
              >
                取消
              </button>
              <button
                type="button"
                data-slot="time-picker-confirm"
                disabled={confirmDisabled}
                aria-disabled={confirmDisabled || undefined}
                onClick={() => onSubmit(draft)}
                className={cn(
                  buttonVariants({
                    type: "primary",
                    size: "small",
                  }),
                  "shrink-0",
                )}
              >
                确定
              </button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    );
  },
);
