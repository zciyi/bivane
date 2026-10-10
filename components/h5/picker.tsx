import * as React from "react";
import { Popup } from "@/components/responsive/popup";
import { PanelHeader } from "@/components/ui/panel-header";
import {
  PickerTrigger,
  PickerWheelRow,
  type PickerPanelProps,
} from "@/components/ui/picker-parts";
import { isDraftComplete, type PickerValue } from "@/hooks/use-picker-state";

/**
 * Bivane Picker · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：底部弹层 + N 列滚轮横排（5 行制、各自吸附）+ 顶部工具条
 *       （取消 · 标题 · 确定）+ 底部安全区。
 * 恒走「暂存 → 确定」：滚轮只改草稿，确定才提交。空列（选项集不全）时禁用确定。
 *
 * 拖拽关闭：Popup 只在顶部指示条区域起拖，滚轮内的滑动不会被误判成下拉关闭。
 */

export const H5Picker = React.forwardRef<HTMLDivElement, PickerPanelProps>(
  function H5Picker(
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
      title,
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
    const handleColumnChange = React.useCallback(
      (columnIndex: number, value: PickerValue) => {
        const next = draft.slice();
        next[columnIndex] = value;
        onDraftChange(next);
      },
      [draft, onDraftChange],
    );

    const wheelColumns = React.useMemo(
      () =>
        columns.map((options, columnIndex) => ({
          options,
          value: draft[columnIndex],
        })),
      [columns, draft],
    );

    return (
      <>
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
          // H5 只要求「方向键能唤起面板」；完整键盘巡航是 PC 的契约
          onActivate={() => onOpenChange(!open)}
          onArrowKey={() => onOpenChange(true)}
        />

        <Popup
          open={open}
          onOpenChange={onOpenChange}
          position="bottom"
          scrollable={false}
          safeAreaInsetBottom
          // 传已解析的 mode，让 forceMode 逃生舱对 Popup 形态与滚动锁同样生效
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
            confirmDisabled={!isDraftComplete(draft)}
          />

          <div
            data-mode={mode === "mobile" ? "h5" : "pc"}
            data-slot="picker-panel"
            className="w-full bg-bv-surface"
          >
            <PickerWheelRow
              mode={mode}
              columns={wheelColumns}
              disabled={disabled}
              onColumnChange={handleColumnChange}
            />
          </div>
        </Popup>
      </>
    );
  },
);
