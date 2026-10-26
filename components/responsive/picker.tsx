import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Picker = lazyWithRef(() => import("@/components/h5/picker").then((m) => ({ default: m.H5Picker })));
const PcPicker = lazyWithRef(() => import("@/components/pc/picker").then((m) => ({ default: m.PcPicker })));
import type { PickerPanelProps } from "@/components/ui/picker-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
  isDraftComplete,
  resolveDraftValues,
  usePickerState,
  type PickerColumnsInput,
  type PickerDraftValue,
  type PickerValue,
} from "@/hooks/use-picker-state";

/**
 * Bivane Picker · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 多列**独立**选择：列与列之间互不影响（有父子联动需求请用 Cascader）。
 * ┌ H5 ── 底部弹层 + N 列滚轮 + 顶部工具条（取消 · 标题 · 确定）
 * └ PC ── 锚定浮层 + N 列纵向面板（各自可滚、键盘巡航）+ 底部「取消 / 确定」
 *
 * 两端都走「暂存 → 确定」：多列要全部调好才算选完，某列一动就提交并关闭
 * 没法用（架构 §6.5 第 5 条，同 TimePicker）。open / 已提交值 / 草稿跨模式同义，
 * 统一归本层；两份实现都是受控展示层（状态归属规则，同 Select/TimePicker）。
 */

export interface PickerProps {
  /**
   * 各列选项。每列支持 `{label,value,disabled?}[]`，也允许直接传
   * 字符串/数字数组（此时 value 与文案相同，对齐 Vant Picker 惯例）。
   */
  columns: PickerColumnsInput;
  /** 受控值：每列一个值的数组 */
  value?: PickerValue[];
  /** 非受控初始值 */
  defaultValue?: PickerValue[];
  /** 点「确定」时触发，回传各列值与对应选项（空列位为 undefined） */
  onChange?: (
    values: PickerValue[],
    options: Array<
      { label: React.ReactNode; value: PickerValue } | undefined
    >,
  ) => void;
  /** H5 面板标题；PC 不渲染标题栏 */
  title?: React.ReactNode;
  /** 无选中值时触发器展示 */
  placeholder?: React.ReactNode;
  /** 禁用：触发器不可点、不清除 */
  disabled?: boolean;
  /** 展示清除按钮（仅有选中值且未禁用时出现） */
  clearable?: boolean;
  /** 确定按钮文案，默认「确定」 */
  confirmText?: React.ReactNode;
  /** 取消按钮文案，默认「取消」 */
  cancelText?: React.ReactNode;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  /** 触发器 id */
  id?: string;
  /** 自定义类名（透传弹层面板） */
  className?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

/** 触发器回显只认可转文本的 label；自定义节点无法可靠拼进单行字符串 */
function labelsToText(labels: Array<React.ReactNode | undefined>): string {
  return labels
    .map((label) =>
      typeof label === "string" || typeof label === "number"
        ? String(label)
        : "",
    )
    .filter((text) => text !== "")
    .join(" / ");
}

export const Picker = React.forwardRef<HTMLDivElement, PickerProps>(
  function Picker(
    {
      columns,
      value,
      defaultValue,
      onChange,
      title,
      placeholder = "请选择",
      disabled = false,
      clearable = false,
      confirmText = "确定",
      cancelText = "取消",
      ariaLabel,
      id,
      className,
      forceMode,
    },
    ref,
  ) {
    const mode = useDeviceMode(forceMode);
    const [open, setOpen] = React.useState(false);

    const {
      columns: normalizedColumns,
      selectedOptions,
      setValue,
      clear,
    } = usePickerState({
      columns,
      value,
      defaultValue,
      onChange,
    });

    /**
     * 草稿在打开那一刻从已提交值播种（对不上的列落第一个可选项，空列给 undefined）。
     * 关闭不清空：退场动画期间面板仍在渲染草稿，清空会让滚轮闪回第一项。
     */
    const [draft, setDraft] = React.useState<PickerDraftValue[]>([]);
    const selectedValuesForDraft = React.useMemo(
      () => selectedOptions.map((option) => option?.value),
      [selectedOptions],
    );

    React.useEffect(() => {
      if (!open) return;
      setDraft(
        resolveDraftValues(normalizedColumns, selectedValuesForDraft),
      );
      // 只在打开翻转时播种；normalizedColumns 变化不重播种（用户正在滚的列不能被拽回）
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleOpenChange = React.useCallback(
      (next: boolean) => {
        if (disabled) return;
        setOpen(next);
      },
      [disabled],
    );

    const handleSubmit = React.useCallback(
      (next: ReadonlyArray<PickerDraftValue>) => {
        // 有空列说明选项配置不全：不提交也不关闭，避免业务收到半截值
        if (!isDraftComplete(next)) return;
        setValue(next as PickerValue[]);
        setOpen(false);
      },
      [setValue],
    );

    const filled = selectedOptions.some((option) => option !== undefined);
    const triggerText = React.useMemo(
      () => labelsToText(selectedOptions.map((option) => option?.label)),
      [selectedOptions],
    );

    const panelProps: PickerPanelProps = {
      mode,
      open,
      onOpenChange: handleOpenChange,
      columns: normalizedColumns,
      draft,
      onDraftChange: setDraft,
      onSubmit: handleSubmit,
      onCancel: () => setOpen(false),
      onClear: clear,
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
    };

    return (
      <React.Suspense fallback={null}>
        {mode === "mobile" ? (
          <H5Picker ref={ref} {...panelProps} />
        ) : (
          <PcPicker ref={ref} {...panelProps} />
        )}
      </React.Suspense>
    );
  },
);

export type {
  PickerColumnsInput,
  PickerDraftValue,
  PickerOption,
  PickerValue,
} from "@/hooks/use-picker-state";
