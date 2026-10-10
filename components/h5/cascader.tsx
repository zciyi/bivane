import * as React from "react";
import { Popup } from "@/components/responsive/popup";
import { PanelHeader } from "@/components/ui/panel-header";
import { PickerTrigger, PickerWheelRow } from "@/components/ui/picker-parts";
import type { DeviceMode } from "@/hooks/use-device-mode";
import type { CascaderValue, LinkedColumns } from "@/hooks/use-cascader-state";

/**
 * Bivane Cascader · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 形态：底部弹层 + **联动滚轮**（省 / 市 / 区 三列范式，即 Vant Area 的交互）。
 * 列集与选中链由分发层的 deriveLinkedColumns 派生：滚某一列，其右侧所有列
 * 整体重算并回到第一项。滚轮本体与 Picker 同源（PickerWheelRow），
 * 本组件不做任何级联计算 —— 它只把「第几列选了谁」报给分发层。
 *
 * 恒走暂存 → 确定：联动过程中必然经过中间值，滚轮一停就提交会让业务值乱跳。
 */

export interface H5CascaderPanelProps {
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linked: LinkedColumns;
  onLinkedColumnChange: (level: number, value: CascaderValue) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onClear: () => void;
  title?: React.ReactNode;
  placeholder?: React.ReactNode;
  disabled: boolean;
  clearable: boolean;
  triggerText: string;
  filled: boolean;
  confirmText: React.ReactNode;
  cancelText: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  id?: string;
}

export const H5Cascader = React.forwardRef<
  HTMLDivElement,
  H5CascaderPanelProps
>(function H5Cascader(
  {
    mode,
    open,
    onOpenChange,
    linked,
    onLinkedColumnChange,
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
  const wheelColumns = React.useMemo(
    () =>
      linked.columns.map((options, level) => ({
        options,
        value: linked.values[level],
      })),
    [linked],
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
          onConfirm={onSubmit}
          confirmText={confirmText}
        />

        <div
          data-mode={mode === "mobile" ? "h5" : "pc"}
          data-slot="cascader-panel"
          className="w-full bg-bv-surface"
        >
          <PickerWheelRow
            mode={mode}
            columns={wheelColumns}
            disabled={disabled}
            onColumnChange={onLinkedColumnChange}
          />
        </div>
      </Popup>
    </>
  );
});
