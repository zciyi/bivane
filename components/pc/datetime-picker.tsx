import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  DateTimeTrigger,
  DateTimeWheelRow,
  type DateTimePanelProps,
} from "@/components/ui/datetime-parts";
import {
  addDays,
  addMonths,
  compareParts as compareDateParts,
  todayParts,
  type DateParts,
} from "@/hooks/use-date-value";
import {
  clampParts,
  formatParts,
  nowDateTimeParts,
  resolveColumnRange,
  resolveCursor,
  type DateTimeColumnKey,
  type DateTimeParts,
} from "@/hooks/use-datetime-value";

/**
 * Bivane DateTimePicker · PC 实现
 *
 * 形态（对齐 Vant Picker / Element datetime 面板）：
 *   左侧月历 —— « < 年-月 > » 导航 + 星期头 + 6×7 日期网格；
 *   右侧时间列 —— 时/分/秒按精度 1~3 列，5 行制居中滚轮（选中行上下发丝线、
 *   无底色、加粗文本），列顶/列尾各一个 ▲▼ 微调钮（按住连发），列间竖发丝线；
 *   顶部右侧回显草稿时间；底部「此刻 / 确定」。
 *
 * 因此日期段与 H5 的「年/月/日滚轮」是**不同交互范式**（同 DatePicker 的 C 判据），
 * 时间段两端共用同一个滚轮 primitive，PC 仅多挂微调钮与列间竖线。
 *
 * 恒走「暂存 → 确定」：点日 / 滚时间 / 此刻都只写草稿，确定才提交；
 * Esc / 点浮层外部 = 取消。
 *
 * 键盘分区驾驶：点日期格进入「日期区」（←→ 走天、↑↓ 走周、PgUp/PgDn 走月），
 * 点时间列进入「时间区」（↑↓ 改值、←→ 换列、Home/End 首尾、PgUp/PgDn ±10），
 * Enter 确定、Esc 取消；两区都不进 Tab 流，选择面是整个浮层。
 *
 * 开合走 **Popover.Trigger asChild**，禁止 Anchor 自管开合（矩阵 §3.11）：
 * Anchor 不登记 triggerRef，跨实例点击会丢失 Radix 的延迟关闭保护（要再点一次/闪关）。
 * 共用触发器传 clickDelegated：鼠标 click 委托 Radix toggle，键盘语义留在零件内。
 */

/** 面板与触发器之间的主轴间距（同族组件同为 4px） */
const SIDE_OFFSET = 4;
/** 时间列键盘翻页一次跳多少项 */
const PAGE_STEP = 10;
/** 周日为首（与 DatePicker PC 一致），月历恒 6 行定高 */
const WEEKDAY_CHARS = ["日", "一", "二", "三", "四", "五", "六"];
const TIME_COLUMN_KEYS: DateTimeColumnKey[] = ["hour", "minute", "second"];

/** 键盘驾驶区：日期网格，或右侧某条时间列（下标在时间列数组内） */
type Zone = "date" | number;

interface MonthCell {
  parts: DateParts;
  outside: boolean;
}

/** 展开视图月的 6×7 网格：从 1 号所在周的周日起补位 42 格，前后月灰显 */
function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first: DateParts = { year, month, day: 1 };
  const lead = new Date(year, month - 1, 1).getDay();
  const start = addDays(first, -lead);
  return Array.from({ length: 42 }, (_, index) => {
    const parts = addDays(start, index);
    return { parts, outside: parts.month !== month };
  });
}

/** 日期格是否越过「日期粒度」的硬边界（只比年月日，当天时刻约束归时间列裁剪） */
function isDayDisabled(
  day: DateParts,
  min: DateTimeParts,
  max: DateTimeParts,
): boolean {
  const minDay: DateParts = {
    year: min.year,
    month: min.month,
    day: min.day,
  };
  const maxDay: DateParts = {
    year: max.year,
    month: max.month,
    day: max.day,
  };
  return (
    compareDateParts(day, minDay) < 0 || compareDateParts(day, maxDay) > 0
  );
}

function sameDay(a: DateParts, b: DateParts): boolean {
  return compareDateParts(a, b) === 0;
}

export const PcDateTimePicker = React.forwardRef<
  HTMLDivElement,
  DateTimePanelProps
>(function PcDateTimePicker(
  {
    mode,
    open,
    onOpenChange,
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
  const [view, setView] = React.useState<{ year: number; month: number }>(
    // 初始只在浮层关闭时渲染（不可见），打开瞬间会被草稿所在月覆盖
    () => {
      const today = todayParts();
      return { year: today.year, month: today.month };
    },
  );
  const [zone, setZone] = React.useState<Zone>("date");

  /** 右侧只渲染时间列（年月日已由月历承担），1~3 列随精度走 */
  const timeColumns = React.useMemo(
    () => TIME_COLUMN_KEYS.filter((key) => columns.includes(key)),
    [columns],
  );

  const cursor = React.useMemo(
    () => resolveCursor(draft[0], columns, minParts, maxParts),
    [draft, columns, minParts, maxParts],
  );

  /** 顶部右侧的时间回显文本，随精度给 HH / HH:mm / HH:mm:ss */
  const timeText = React.useMemo(() => {
    const template = timeColumns
      .map((key) =>
        key === "hour" ? "HH" : key === "minute" ? "mm" : "ss",
      )
      .join(":");
    return formatParts(cursor, template);
  }, [cursor, timeColumns]);

  /** 任意草稿改动统一夹紧后写字符串，绝不直接提交 */
  const commitParts = React.useCallback(
    (next: DateTimeParts) => {
      const parts = clampParts(next, minParts, maxParts, columns);
      onDraftChange([formatParts(parts, format)]);
    },
    [columns, format, minParts, maxParts, onDraftChange],
  );

  // 打开后第一次拿到草稿：月历跳到草稿所在月、键盘区回到日期网格。
  // 依赖必须包含 draft —— 本组件是子层，open 翻转时父分发层「播种草稿」的
  // effect 还没跑（子 effect 先于父），若只看 [open]，拿到的是空草稿（回落
  // 「今天」），草稿月与当前月不同时月历会定错位；首次同步后即短路，
  // 之后点日期改 draft 不会把用户正在浏览的视图拽回。
  const initializedForOpenRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      initializedForOpenRef.current = false;
      return;
    }
    if (initializedForOpenRef.current || !draft[0]) return;
    initializedForOpenRef.current = true;
    setView({ year: cursor.year, month: cursor.month });
    setZone("date");
  }, [open, draft, cursor]);

  const cells = React.useMemo(
    () => buildMonthGrid(view.year, view.month),
    [view.year, view.month],
  );
  const today = React.useMemo(() => new Date(), []);
  const todayDay: DateParts = {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };

  const canPrevYear = view.year > minParts.year;
  const canPrevMonth =
    view.year > minParts.year || view.month > minParts.month;
  const canNextYear = view.year < maxParts.year;
  const canNextMonth =
    view.year < maxParts.year || view.month < maxParts.month;

  const shiftView = React.useCallback((monthDelta: number) => {
    setView((prev) => {
      const shifted = addMonths(
        { year: prev.year, month: prev.month, day: 1 },
        monthDelta,
      );
      return { year: shifted.year, month: shifted.month };
    });
  }, []);

  /** 键盘 / 点日：改草稿日期，月历视图跟着新日期走 */
  const changeDate = React.useCallback(
    (next: DateParts) => {
      commitParts({
        ...cursor,
        year: next.year,
        month: next.month,
        day: next.day,
      });
      setView({ year: next.year, month: next.month });
    },
    [commitParts, cursor],
  );

  /** 点月历里的某一天（含前后月补位格 —— 点补位格顺带翻月） */
  const handleDayClick = (day: DateParts) => {
    if (isDayDisabled(day, minParts, maxParts)) return;
    setZone("date");
    changeDate(day);
  };

  /** 点时间列某项：进入时间驾驶区并改值 */
  const handleTimeChange = (key: DateTimeColumnKey, value: number) => {
    const index = timeColumns.indexOf(key);
    if (index >= 0) setZone(index);
    commitParts({ ...cursor, [key]: value });
  };

  /** 「此刻」：草稿夹到边界内并跳回当前月；仍是草稿，确定才生效 */
  const handleNow = () => {
    const now = clampParts(nowDateTimeParts(), minParts, maxParts, columns);
    onDraftChange([formatParts(now, format)]);
    setView({ year: now.year, month: now.month });
    setZone("date");
  };

  /** 时间驾驶区里当前列步进，夹在该列有效区间 */
  const stepTimeColumn = (index: number, delta: number) => {
    const key = timeColumns[index];
    if (!key) return;
    const [start, end] = resolveColumnRange(
      key,
      cursor,
      minParts,
      maxParts,
    );
    const nextValue = Math.min(Math.max(cursor[key] + delta, start), end);
    commitParts({ ...cursor, [key]: nextValue });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    // 焦点落在底部条按钮上时让按钮自己处理 Enter/Space
    if (
      (event.target as HTMLElement | null)?.closest(
        '[data-slot="datetime-picker-footer"]',
      )
    ) {
      return;
    }

    if (zone === "date") {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          changeDate(addDays(cursor, -1));
          return;
        case "ArrowRight":
          event.preventDefault();
          changeDate(addDays(cursor, 1));
          return;
        case "ArrowUp":
          event.preventDefault();
          changeDate(addDays(cursor, -7));
          return;
        case "ArrowDown":
          event.preventDefault();
          changeDate(addDays(cursor, 7));
          return;
        case "PageUp":
          event.preventDefault();
          // 到最早月份就停（changeDate 本身会夹回，但视图也不能越过边界）
          if (canPrevMonth) {
            shiftView(-1);
            changeDate(addMonths(cursor, -1));
          }
          return;
        case "PageDown":
          event.preventDefault();
          if (canNextMonth) {
            shiftView(1);
            changeDate(addMonths(cursor, 1));
          }
          return;
        case "Enter":
          event.preventDefault();
          onSubmit(draft);
          return;
        case "Escape":
          event.preventDefault();
          onCancel();
          return;
        default:
          return;
      }
    }

    // 走到这里说明驾驶区在时间列（日期区已在上面按 case return）
    const timeZone = zone as number;
    const key = timeColumns[timeZone];
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        stepTimeColumn(timeZone, -1);
        return;
      case "ArrowDown":
        event.preventDefault();
        stepTimeColumn(timeZone, 1);
        return;
      case "ArrowLeft":
        event.preventDefault();
        if (timeZone > 0) setZone(timeZone - 1);
        return;
      case "ArrowRight":
        event.preventDefault();
        if (timeZone < timeColumns.length - 1) setZone(timeZone + 1);
        return;
      case "Home": {
        event.preventDefault();
        if (!key) return;
        const [start] = resolveColumnRange(
          key,
          cursor,
          minParts,
          maxParts,
        );
        commitParts({ ...cursor, [key]: start });
        return;
      }
      case "End": {
        event.preventDefault();
        if (!key) return;
        const [, end] = resolveColumnRange(
          key,
          cursor,
          minParts,
          maxParts,
        );
        commitParts({ ...cursor, [key]: end });
        return;
      }
      case "PageUp":
        event.preventDefault();
        stepTimeColumn(timeZone, -PAGE_STEP);
        return;
      case "PageDown":
        event.preventDefault();
        stepTimeColumn(timeZone, PAGE_STEP);
        return;
      case "Enter":
        event.preventDefault();
        onSubmit(draft);
        return;
      case "Escape":
        event.preventDefault();
        onCancel();
        return;
      default:
        return;
    }
  };

  const navButtonClass = cn(
    "flex h-[var(--bv-date-picker-pc-nav-height)] w-7 shrink-0 items-center justify-center border-0",
    "bg-transparent p-0 text-[var(--bv-date-picker-pc-nav-color)]",
    "hover:text-bv-primary disabled:cursor-not-allowed disabled:opacity-30",
  );

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      modal={false}
    >
      {/* 必须用 Trigger（不能 Anchor 自管开合），原因同 pc/time-picker */}
      <PopoverPrimitive.Trigger
        asChild
        // disabled 守卫必须挂在 Trigger 本身（先于 onOpenToggle），原因同 pc/select
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        <DateTimeTrigger
          ref={ref}
          id={id}
          mode={mode}
          text={selected[0] ?? ""}
          placeholder={placeholder}
          filled={selected.length > 0}
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
          aria-label={ariaLabel ?? "日期时间面板"}
          align="start"
          side="bottom"
          sideOffset={SIDE_OFFSET}
          avoidCollisions
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(event) => {
            // 焦点留在面板上，由面板级键盘区分区驾驶
            event.preventDefault();
            panelRef.current?.focus({ preventScroll: true });
          }}
          // 不自定义 onCloseAutoFocus：外部转焦不还焦由 Radix
          // hasInteractedOutside 自动跳过，Esc/确定才还焦 trigger（§3.11 规则 7）
          className={cn(
            "z-[var(--bv-datetime-picker-pc-z-index)] box-border",
            "rounded-[var(--bv-datetime-picker-pc-radius)] border border-bv-border bg-bv-surface",
            "shadow-[var(--bv-datetime-picker-pc-shadow)]",
            className,
          )}
          style={{
            // 左月历固定宽 + 右侧时间列每列固定宽（动态列数允许 inline style，契约 4）
            width: `calc(var(--bv-date-picker-pc-panel-width) + var(--bv-datetime-picker-column-width) * ${timeColumns.length})`,
          }}
          data-slot="datetime-picker-panel"
        >
          {/* ── 顶部：左月历导航（« < 标题 > »），右草稿时间回显 ── */}
          <div
            data-slot="datetime-picker-header"
            className="flex items-stretch border-b border-bv-border"
          >
            <div
              data-slot="datetime-picker-month-header"
              className="relative flex h-[var(--bv-date-picker-pc-nav-height)] flex-1 items-center"
            >
              <button
                type="button"
                data-slot="datetime-picker-prev-year"
                aria-label="上一年"
                disabled={!canPrevYear}
                onClick={() => shiftView(-12)}
                className={cn(
                  navButtonClass,
                  "absolute left-1",
                )}
              >
                <span
                  className="flex items-center"
                  aria-hidden="true"
                >
                  <Icon
                    name="arrow-left"
                    className="text-[13px]"
                  />
                  <Icon
                    name="arrow-left"
                    className="-ml-[6px] text-[13px]"
                  />
                </span>
              </button>
              <button
                type="button"
                data-slot="datetime-picker-prev-month"
                aria-label="上个月"
                disabled={!canPrevMonth}
                onClick={() => shiftView(-1)}
                className={cn(
                  navButtonClass,
                  "absolute left-[26px]",
                )}
              >
                <Icon
                  name="arrow-left"
                  className="text-[15px]"
                />
              </button>
              <span
                data-slot="datetime-picker-month-title"
                className="mx-auto text-bv-md font-bold text-bv-text"
              >
                {view.year} 年 {view.month} 月
              </span>
              <button
                type="button"
                data-slot="datetime-picker-next-month"
                aria-label="下个月"
                disabled={!canNextMonth}
                onClick={() => shiftView(1)}
                className={cn(
                  navButtonClass,
                  "absolute right-[26px]",
                )}
              >
                <Icon name="arrow" className="text-[15px]" />
              </button>
              <button
                type="button"
                data-slot="datetime-picker-next-year"
                aria-label="下一年"
                disabled={!canNextYear}
                onClick={() => shiftView(12)}
                className={cn(
                  navButtonClass,
                  "absolute right-1",
                )}
              >
                <span
                  className="flex items-center"
                  aria-hidden="true"
                >
                  <Icon
                    name="arrow"
                    className="-mr-[6px] text-[13px]"
                  />
                  <Icon
                    name="arrow"
                    className="text-[13px]"
                  />
                </span>
              </button>
            </div>
            <div
              data-slot="datetime-picker-time-display"
              className="flex items-center justify-center border-l border-bv-border px-bv-xs text-bv-md font-bold tabular-nums text-bv-text"
              style={{
                width: `calc(var(--bv-datetime-picker-column-width) * ${timeColumns.length})`,
              }}
            >
              {timeText}
            </div>
          </div>

          {/* ── 主体：左月历网格 + 右时间列 ── */}
          <div
            data-slot="datetime-picker-body"
            className="flex items-stretch"
          >
            <div
              data-slot="datetime-picker-calendar"
              className="w-[var(--bv-date-picker-pc-panel-width)] shrink-0 px-[var(--bv-date-picker-pc-padding-x)] py-[var(--bv-datetime-picker-pc-padding-y)]"
            >
              <div role="row" className="grid grid-cols-7">
                {WEEKDAY_CHARS.map((char) => (
                  <span
                    key={char}
                    data-slot="datetime-picker-weekday"
                    className="flex h-[var(--bv-date-picker-pc-weekday-height)] items-center justify-center text-bv-sm font-normal text-[var(--bv-date-picker-pc-weekday-color)]"
                  >
                    {char}
                  </span>
                ))}
              </div>
              <div role="grid" className="grid grid-cols-7">
                {cells.map((cell) => {
                  const selected = sameDay(
                    cell.parts,
                    cursor,
                  );
                  const disabledDay = isDayDisabled(
                    cell.parts,
                    minParts,
                    maxParts,
                  );
                  const isToday = sameDay(
                    cell.parts,
                    todayDay,
                  );
                  return (
                    <button
                      key={`${cell.parts.year}-${cell.parts.month}-${cell.parts.day}`}
                      type="button"
                      role="gridcell"
                      aria-label={`${cell.parts.year}-${cell.parts.month}-${cell.parts.day}`}
                      aria-selected={selected}
                      aria-disabled={
                        disabledDay || undefined
                      }
                      tabIndex={-1}
                      data-slot="datetime-picker-cell"
                      data-selected={
                        selected ? "true" : undefined
                      }
                      data-outside={
                        cell.outside
                          ? "true"
                          : undefined
                      }
                      data-today={
                        isToday ? "true" : undefined
                      }
                      disabled={disabledDay}
                      onMouseDown={(event) =>
                        event.preventDefault()
                      }
                      onClick={() =>
                        handleDayClick(cell.parts)
                      }
                      className={cn(
                        "flex h-[var(--bv-date-picker-pc-cell-height)] cursor-pointer items-center justify-center border-0 bg-transparent p-0",
                        "text-bv-sm leading-[var(--bv-date-picker-pc-cell-line-height)]",
                        selected
                          ? "rounded-[var(--bv-date-picker-pc-cell-radius)] bg-[var(--bv-date-picker-pc-cell-selected-background)] text-[var(--bv-date-picker-pc-cell-selected-color)]"
                          : cn(
                             cell.outside
                               ? "text-[var(--bv-date-picker-text-3-color)]"
                               : "text-[var(--bv-date-picker-text-color)]",
                             "hover:bg-[var(--bv-date-picker-pc-cell-hover-background)]",
                           ),
                        !selected &&
                          isToday &&
                          "ring-1 ring-bv-primary",
                        disabledDay &&
                          "cursor-not-allowed text-[var(--bv-date-picker-text-3-color)] opacity-[var(--bv-date-picker-pc-cell-disabled-opacity)] hover:bg-transparent",
                      )}
                    >
                      {cell.parts.day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              data-slot="datetime-picker-time-wheels"
              className="shrink-0 border-l border-bv-border py-[var(--bv-datetime-picker-pc-padding-y)]"
              style={{
                width: `calc(var(--bv-datetime-picker-column-width) * ${timeColumns.length})`,
              }}
            >
              <DateTimeWheelRow
                mode={mode}
                columnKeys={timeColumns}
                cursor={cursor}
                minParts={minParts}
                maxParts={maxParts}
                disabled={disabled}
                stepButtons
                dividers
                activeColumnIndex={
                  typeof zone === "number" ? zone : undefined
                }
                onColumnChange={handleTimeChange}
                className="h-full"
              />
            </div>
          </div>

          {/* ── 底部：此刻 / 确定（取消走 Esc 与点外部，与截图一致不留取消钮） ── */}
          <div
            data-slot="datetime-picker-footer"
            className={cn(
              "flex shrink-0 items-center justify-between",
              "border-t border-bv-border px-[var(--bv-datetime-picker-pc-padding-x)] py-[var(--bv-datetime-picker-pc-padding-y)]",
            )}
          >
            <button
              type="button"
              data-slot="datetime-picker-now"
              onClick={handleNow}
              className={cn(
                "shrink-0 cursor-pointer border-0 bg-transparent p-0",
                "text-bv-md text-bv-primary hover:opacity-80",
              )}
            >
              此刻
            </button>
            <button
              type="button"
              data-slot="datetime-picker-confirm"
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
});
