import * as React from "react";
import { cn } from "@/lib/utils";
import { Popup } from "@/components/responsive/popup";
import { PanelHeader } from "@/components/ui/panel-header";
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
  resolveCursor,
  type TimeParts,
} from "@/hooks/use-time-value";

/**
 * Bivane TimePicker · H5 实现
 * 交互定义见 bivane-responsive-matrix.md §2.2 / §3.6
 *
 * 形态：底部弹层 + N 列滚轮（时 / 分 / 秒）+ 顶部工具条（取消 · 标题 · 确定）+ 底部安全区。
 * 滚轮的惯性由原生动量滚动给，吸附由 `scroll-snap` 给（见 use-picker-column.ts）。
 *
 * 恒走「暂存 → 确定」：
 *   滚轮一滚就提交会让「滚过头」直接改掉业务值，且三列联动（换时可能要重算分/秒）中途
 *   必然经过非法组合。草稿归分发层，本组件只负责渲染与「当前在改哪一端」。
 *
 * 「当前在改哪一端」是**实现层状态**：区间端点切换只在这份实现里存在（PC 用同一条 tabs），
 * 按架构 §6.5 的状态归属推论，它不该往分发层提。
 */

export const H5TimePicker = React.forwardRef<HTMLDivElement, TimePanelProps>(
  function H5TimePicker(
    {
      mode,
      open,
      onOpenChange,
      type,
      columns,
      format,
      minParts,
      maxParts,
      title,
      placeholder,
      disabled,
      clearable,
      selected,
      draft,
      onDraftChange,
      onSubmit,
      onCancel,
      onClear,
      confirmText,
      cancelText,
      className,
      ariaLabel,
      id,
    },
    ref,
  ) {
    const [activeEnd, setActiveEnd] = React.useState<TimeRangeEnd>("start");

    // 每次打开都回到「开始时间」端：上次停在「结束」时，下次进来直接改结束端很容易被误解
    React.useEffect(() => {
      if (open) setActiveEnd("start");
    }, [open]);

    /** 区间草稿允许半截：'' 表示该端还没选（分发层据此禁用「确定」） */
    const endIndex = type === "range" && activeEnd === "end" ? 1 : 0;

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

    /** 滚轮每动一次就走这里：写回草稿（不提交）。非法组合由 clampParts 就地修正 */
    const commitCursor = React.useCallback(
      (next: TimeParts) => {
        const parts = clampParts(next, minParts, maxParts);
        const text = formatParts(parts, format);
        if (type === "range") {
          const nextDraft = [draft[0] ?? "", draft[1] ?? ""];
          nextDraft[endIndex] = text;
          onDraftChange(nextDraft);
          return;
        }
        onDraftChange([text]);
      },
      [format, minParts, maxParts, type, draft, endIndex, onDraftChange],
    );

    const startText = draft[0] ?? "";
    const endText = draft[1] ?? "";
    const bothFilled = startText !== "" && endText !== "";

    /**
     * 区间合法判据与 PC 完全一致：两端都填、且开始 < 结束才放行「确定」。
     * 必须 parse 成 parts 再比 —— format 允许 H / m 这类非补零形态，字典序会错。
     */
    const startBeforeEnd = React.useMemo(() => {
      if (type !== "range" || !bothFilled) return false;
      const s = parseTimeTextForColumns(startText, columns);
      const e = parseTimeTextForColumns(endText, columns);
      return !!s && !!e && compareParts(s, e) < 0;
    }, [type, bothFilled, startText, endText, columns]);

    const rangeIncomplete = type === "range" && !bothFilled;
    const rangeInvalid = type === "range" && bothFilled && !startBeforeEnd;
    const confirmDisabled = rangeIncomplete || rangeInvalid;

    const triggerText = React.useMemo(
      () =>
        type === "range"
          ? selected.join(TIME_RANGE_JOIN)
          : (selected[0] ?? ""),
      [type, selected],
    );

    return (
      <>
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
          onActivate={() => onOpenChange(!open)}
          onArrowKey={() => onOpenChange(true)}
        />

        <Popup
          open={open}
          onOpenChange={onOpenChange}
          position="bottom"
          scrollable={false}
          safeAreaInsetBottom
          forceMode={mode}
          aria-label={ariaLabel}
          className={className}
        >
          <PanelHeader
            mode={mode}
            title={title}
            onCancel={onCancel}
            cancelText={cancelText}
            onConfirm={() => onSubmit(draft)}
            confirmText={confirmText}
            confirmDisabled={confirmDisabled}
          />

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

          <TimeWheelRow
            mode={mode}
            columnKeys={columns}
            cursor={cursor}
            minParts={minParts}
            maxParts={maxParts}
            disabled={disabled}
            onColumnChange={(key, item) =>
              commitCursor({ ...cursor, [key]: item })
            }
            className="min-h-0 w-full bg-bv-surface"
          />

          {/* 区间非法（开始 ≥ 结束）时在滚轮下方提示，并禁用顶部「确定」（与 PC 同一判据） */}
          {rangeInvalid ? (
            <p
              data-slot="time-picker-range-hint"
              className={cn(
                "shrink-0 bg-bv-surface",
                "px-[var(--bv-time-picker-padding-x)] pb-[var(--bv-padding-sm)]",
                "text-bv-xs leading-[var(--bv-time-picker-line-height)]",
                "text-bv-danger",
              )}
            >
              开始时间须小于结束时间
            </p>
          ) : null}
        </Popup>
      </>
    );
  },
);
