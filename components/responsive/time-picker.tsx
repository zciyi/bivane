import * as React from "react";
import { H5TimePicker } from "@/components/h5/time-picker";
import { PcTimePicker } from "@/components/pc/time-picker";
import type { TimePanelProps } from "@/components/ui/time-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
  defaultFormatForColumns,
  formatParts,
  nowParts,
  orderTimeTexts,
  resolveColumns,
  useTimeValue,
  type TimeColumnKey,
  type TimePickerType,
  type TimePickerValue,
} from "@/hooks/use-time-value";

/**
 * Bivane TimePicker · 分发层
 * 交互定义见 bivane-responsive-matrix.md §2.2 / §3.6
 *
 * ┌ 两端同一套交互：N 列滚轮（时/分/秒）+ 吸附对齐，区间用「开始/结束」两段式，
 * │              恒走「暂存 → 确定」（滚轮要三列都调好才算选完）
 * ├ H5 ── 底部弹层 + 顶部工具条（取消 · 标题 · 确定）+ 底部安全区
 * └ PC ── 锚定触发器的浮层 + 底部「取消 / 确定」条，键盘 ↑↓ 改值、←→ 换列、Esc 关闭
 *
 * 状态归属与 DatePicker 同族：`open` / `selected` / `draft` 跨模式同义留本层，
 * 「当前在改哪一端」（两端都有）与「方向键在驾驶哪一列」（仅 PC）只有单侧存在留实现层。
 * 值计算、范围约束、格式化、触发器外观、滚轮行共用，各自实现只负责外壳。
 *
 * 单值形态草稿恒预填「现在」（而非 '00:00:00'）：时间选择器的主路径是单值未选，
 * 若默认停在午夜，每次打开都要从 00:00:00 滚到当前时刻。这是 DatePicker「无值落今天」
 * 缺陷的时间版（缺陷修正一号）。断言要来自「我期望什么」。
 */

export interface TimePickerProps {
  /** 受控值：单值是 'HH:mm:ss' 字符串，区间是 [start, end] 元组 */
  value?: TimePickerValue;
  /** 非受控初始值 */
  defaultValue?: TimePickerValue;
  /** 值变化即回调（两端都在点「确定」那一瞬） */
  onChange?: (value: TimePickerValue) => void;
  /** 确认回调，与 onChange 同值。两端都会触发，便于统一接埋点 */
  onConfirm?: (value: TimePickerValue) => void;
  /** 单选 / 区间。区间时值恒为有序的两元素元组 */
  type?: TimePickerType;
  /** 可选下界（含），'HH:mm:ss'（或按实际列裁剪的 'HH:mm' 等） */
  min?: string;
  /** 可选上界（含），'HH:mm:ss'（或按实际列裁剪的 'HH:mm' 等） */
  max?: string;
  /**
   * 参与展示的时间列，默认 `['hour','minute','second']`，顺序由组件固定为「时→分→秒」。
   * 裁剪到 ['hour','minute'] 即「时分」选择器，['hour'] 即「小时」选择器。
   */
  columnsType?: TimeColumnKey[];
  /**
   * 展示格式，默认由 columnsType 推出（'HH:mm:ss' / 'HH:mm' / 'HH'）。
   * 支持 HH / H / mm / m / ss / s 六个 token。
   */
  format?: string;
  /** H5 面板标题栏文案。PC 不渲染标题栏（浮层由触发器说明自己是什么） */
  title?: React.ReactNode;
  /** 无选中值时展示 */
  placeholder?: React.ReactNode;
  disabled?: boolean;
  /** 展示清除按钮（仅在有选中值、且未禁用时出现） */
  clearable?: boolean;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  id?: string;
  className?: string;
  /** 逃生舱：强制某个模式的交互（契约第 9 条唯一例外） */
  forceMode?: DeviceMode;
}

export const TimePicker = React.forwardRef<HTMLDivElement, TimePickerProps>(
  function TimePicker(
    {
      value,
      defaultValue,
      onChange,
      onConfirm,
      type = "single",
      min,
      max,
      columnsType,
      format,
      title,
      placeholder = "请选择",
      disabled = false,
      clearable = false,
      ariaLabel,
      id,
      className,
      forceMode,
    },
    ref,
  ) {
    const mode = useDeviceMode(forceMode);
    const [open, setOpen] = React.useState(false);

    const columns = React.useMemo(
      () => resolveColumns(columnsType),
      [columnsType],
    );

    /** format 的默认值跟随实际展示列，两端提交与回显保持同一种值形态。 */
    const resolvedFormat = React.useMemo(
      () => format ?? defaultFormatForColumns(columns),
      [format, columns],
    );

    const { selected, minParts, maxParts, setValue, clear } = useTimeValue({
      value,
      defaultValue,
      onChange,
      type,
      min,
      max,
      format: resolvedFormat,
    });

    /**
     * 草稿：单值形态一定有一项（未选时预填现在，「确定」永远可用）；
     * 区间形态按位保存两端，'' 表示该端还没选。
     * 关闭时**不清空**：浮层退出动画期间仍在渲染 draft，清空会让滚轮瞬间回落
     * 播种值（关闭前「闪到当前时间」）；下次打开无条件重新播种，半截草稿不复活。
     */
    const [draft, setDraft] = React.useState<string[]>([]);

    React.useEffect(() => {
      if (!open) return;
      if (type === "range") {
        setDraft([selected[0] ?? "", selected[1] ?? ""]);
        return;
      }
      setDraft([selected[0] ?? formatParts(nowParts(), resolvedFormat)]);
    }, [open, type, selected, resolvedFormat]);

    const handleSubmit = React.useCallback(
      (next: string[]) => {
        let nextValue: TimePickerValue;
        if (type === "range") {
          // 两端不全时不提交也不关闭：用户还差一步，关掉会让他以为选好了
          const ordered = orderTimeTexts(
            next[0] || undefined,
            next[1] || undefined,
            columns,
          );
          if (!ordered) return;
          nextValue = ordered;
        } else {
          if (!next[0]) return;
          nextValue = next[0];
        }
        setValue(nextValue);
        onConfirm?.(nextValue);
        setOpen(false);
      },
      [type, columns, setValue, onConfirm],
    );

    const handleOpenChange = React.useCallback(
      (next: boolean) => {
        if (disabled) return;
        setOpen(next);
      },
      [disabled],
    );

    const panelProps: TimePanelProps = {
      mode,
      open,
      onOpenChange: handleOpenChange,
      type,
      columns,
      format: resolvedFormat,
      minParts,
      maxParts,
      title,
      placeholder,
      disabled,
      clearable,
      selected,
      draft,
      onDraftChange: setDraft,
      onSubmit: handleSubmit,
      onCancel: () => setOpen(false),
      onClear: clear,
      className,
      ariaLabel,
      id,
    };

    return mode === "mobile" ? (
      <H5TimePicker ref={ref} {...panelProps} />
    ) : (
      <PcTimePicker ref={ref} {...panelProps} />
    );
  },
);

export type {
  TimeColumnKey,
  TimeParts,
  TimePickerType,
  TimePickerValue,
  TimeRangeValue,
} from "@/hooks/use-time-value";
