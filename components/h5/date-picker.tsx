import * as React from 'react';
import { Popup } from '@/components/responsive/popup';
import { PanelHeader } from '@/components/ui/panel-header';
import {
  DATE_RANGE_JOIN,
  DateRangeTabs,
  DateTrigger,
  WheelColumn,
  type DatePanelProps,
  type DateRangeEnd,
} from '@/components/ui/date-parts';
import {
  buildColumnValues,
  clampParts,
  formatParts,
  pad2,
  resolveCursor,
  type DateColumnKey,
  type DateParts,
} from '@/hooks/use-date-value';

/**
 * Bivane DatePicker · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：底部弹层 + 三列滚轮（年 / 月 / 日）+ 顶部工具条（取消 · 标题 · 确定）+ 底部安全区。
 * 滚轮的惯性由原生动量滚动给，吸附由 `scroll-snap` 给（见 use-picker-column.ts）。
 *
 * 恒走「暂存 → 确定」：
 *   滚轮一滚就提交会让「滚过头」直接改掉业务值，且三列联动（换年要重算月/日）中途
 *   必然经过非法组合。草稿归分发层，本组件只负责渲染与「当前在改哪一端」。
 *
 * 「当前在改哪一端」是**实现层状态**：
 *   区间端点切换只在这份实现里存在（PC 用双月并排，没有这个选择），
 *   按架构 §6.5 的状态归属推论，它不该往分发层提。
 *
 * 拖拽关闭：Popup 只在标了 DRAG_REGION_ATTR 的区域内起拖（顶部指示条），
 * 滚轮里的滑动因此不会被误判成下拉关闭。
 */

const COLUMN_LABELS: Record<DateColumnKey, string> = {
  year: '选择年份',
  month: '选择月份',
  day: '选择日期',
};

export const H5DatePicker = React.forwardRef<HTMLDivElement, DatePanelProps>(
  function H5DatePicker(
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
    const [activeEnd, setActiveEnd] = React.useState<DateRangeEnd>('start');

    // 每次打开都回到「开始日期」端：上次停在「结束」时，下次进来直接改结束端很容易被误解
    React.useEffect(() => {
      if (open) setActiveEnd('start');
    }, [open]);

    /** 区间草稿允许半截：'' 表示该端还没选（分发层据此禁用「确定」） */
    const endIndex = type === 'range' && activeEnd === 'end' ? 1 : 0;

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
      (next: DateParts) => {
        const parts = clampParts(next, minParts, maxParts);
        const text = formatParts(parts, format);
        if (type === 'range') {
          const nextDraft = [draft[0] ?? '', draft[1] ?? ''];
          nextDraft[endIndex] = text;
          onDraftChange(nextDraft);
          return;
        }
        onDraftChange([text]);
      },
      [format, minParts, maxParts, type, draft, endIndex, onDraftChange],
    );

    const rangeIncomplete = type === 'range' && (!draft[0] || !draft[1]);

    const triggerText = React.useMemo(
      () => (type === 'range' ? selected.join(DATE_RANGE_JOIN) : (selected[0] ?? '')),
      [type, selected],
    );

    const wheelColumns = React.useMemo(
      () =>
        columns.map((key) => ({
          key,
          label: COLUMN_LABELS[key],
          values: buildColumnValues(key, cursor, minParts, maxParts),
          value: cursor[key],
        })),
      [columns, cursor, minParts, maxParts],
    );

    return (
      <>
        <DateTrigger
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
          // H5 只要求「方向键能唤起面板」；完整键盘巡航是 PC 的契约（§4 第 5 条）
          onArrowKey={() => onOpenChange(true)}
        />

        <Popup
          open={open}
          onOpenChange={onOpenChange}
          position="bottom"
          scrollable={false}
          safeAreaInsetBottom
          // 传已解析的 mode，让 forceMode 逃生舱对 Popup 的形态与滚动锁策略同样生效
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
            confirmDisabled={rangeIncomplete}
          />

          {type === 'range' ? (
            <DateRangeTabs
              mode={mode}
              active={activeEnd}
              onChange={setActiveEnd}
              startText={draft[0] ?? ''}
              endText={draft[1] ?? ''}
              placeholder={placeholder}
            />
          ) : null}

          <div
            data-mode={mode === 'mobile' ? 'h5' : 'pc'}
            data-slot="date-picker-panel"
            className="flex min-h-0 w-full items-center bg-bv-surface"
          >
            {wheelColumns.map((column) => (
              <WheelColumn
                key={column.key}
                mode={mode}
                label={column.label}
                values={column.values}
                value={column.value}
                formatValue={(item) => (column.key === 'year' ? item : pad2(item))}
                disabled={disabled}
                onValueChange={(item) => commitCursor({ ...cursor, [column.key]: item })}
              />
            ))}
          </div>
        </Popup>
      </>
    );
  },
);

