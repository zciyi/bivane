import * as React from "react";
import { Popup } from "@/components/responsive/popup";
import { PanelHeader } from "@/components/ui/panel-header";
import {
  DateTimeTrigger,
  DateTimeWheelRow,
  type DateTimePanelProps,
} from "@/components/ui/datetime-parts";
import {
  clampParts,
  formatParts,
  resolveCursor,
  type DateTimeParts,
} from "@/hooks/use-datetime-value";

/**
 * Bivane DateTimePicker · H5 实现
 *
 * 形态：底部弹层 + N 列滚轮（年/月/日 [时[分[秒]]]）+ 顶部工具条（取消 · 标题 · 确定）
 *       + 底部安全区。惯性由原生动量滚动给，吸附由 scroll-snap 给（见 use-picker-column）。
 *
 * 恒走「暂存 → 确定」：4~6 列要逐个调好才算选完，第一列一动就提交关闭不可用；
 * 且换年/月时日期列要联动重算，中途必然经过非法中间态。草稿归分发层。
 */

export const H5DateTimePicker = React.forwardRef<
  HTMLDivElement,
  DateTimePanelProps
>(function H5DateTimePicker(
  {
    mode,
    open,
    onOpenChange,
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
  /** 单值草稿恒有一项（分发层在打开时用已选值或「此刻」播种），「确定」永远可点 */
  const cursor = React.useMemo(
    () => resolveCursor(draft[0], columns, minParts, maxParts),
    [draft, columns, minParts, maxParts],
  );

  /** 滚轮每动一次：夹紧非法组合（min 当天 09:00 等）后写回草稿，不提交 */
  const commitCursor = React.useCallback(
    (next: DateTimeParts) => {
      const parts = clampParts(next, minParts, maxParts, columns);
      onDraftChange([formatParts(parts, format)]);
    },
    [columns, format, minParts, maxParts, onDraftChange],
  );

  return (
    <>
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
        />

        <DateTimeWheelRow
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
      </Popup>
    </>
  );
});
