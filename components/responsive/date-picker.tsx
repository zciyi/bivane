import * as React from 'react';
import { H5DatePicker } from '@/components/h5/date-picker';
import { PcDatePicker } from '@/components/pc/date-picker';
import type { DatePanelProps } from '@/components/ui/date-parts';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import {
  defaultFormatForColumns,
  formatParts,
  orderDateTexts,
  resolveColumns,
  todayParts,
  useDateValue,
  type DateColumnKey,
  type DatePickerType,
  type DatePickerValue,
} from '@/hooks/use-date-value';

/**
 * Bivane DatePicker · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 底部弹层 + 三列滚轮（年/月/日），惯性滚动 + 吸附对齐，
 * │        顶部工具条（取消 · 标题 · 确定）+ 底部安全区，弹层打开时锁定 body 滚动；
 * │        区间模式用「开始/结束」两段式（三列滚轮一次只表达一个日期）
 * └ PC ── 锚定触发器的浮层 + 月历面板，上下月按钮 / 键盘方向键 / 直接输入 / Esc 关闭，
 *          区间模式并排双月 + 悬停预览
 *
 * 为什么是模式 C 而不是 B（架构 §6.5 规则 ④「交互范式不同」那一类）：
 *   滚轮与月历不是同一个 primitive 的两种外壳 —— 一个是「连续滚动 + 吸附」，
 *   一个是「二维网格 + 焦点巡航」，共同点只有「都是日期」。这决定了它不能像
 *   Popup 那样靠换壳解决，必须两份实现，把公共部分压到最小公约数：
 *   值计算、范围约束、格式化、触发器外观共用，各自实现只负责「怎么选」。
 *
 * 状态归属（架构 §6.5 的推论「取决于它是否跨模式同义」）：
 *   - `open` / `selected` / `draft` 跨模式同义 → 留在本层；
 *   - H5 的「当前在改哪一端」、PC 的「视图月份 / 键盘光标 / 悬停日」只有单侧存在 → 留实现层。
 *
 * 草稿（draft）为什么归分发层：
 *   与 Select 的暂存同源 —— 它最终要变成 onChange 的参数，是**值语义的一部分**，
 *   不是「容器怎么摆」。放实现里会让两份实现各自管值，不再是对称的受控展示层（契约 19）。
 *   但它与 Select 有一点不同：**区间草稿允许半截**（'' 表示该端未选），
 *   由 onSubmit 在提交那一刻统一收口（两端不全则不提交）。
 */

export interface DatePickerProps {
  /** 受控值：单值是 'YYYY-MM-DD' 字符串，区间是 [start, end] 元组 */
  value?: DatePickerValue;
  /** 非受控初始值 */
  defaultValue?: DatePickerValue;
  /** 值变化即回调（H5 在点「确定」时、PC 在选满时） */
  onChange?: (value: DatePickerValue) => void;
  /** 确认回调，与 onChange 同值。两端都会触发，便于统一接埋点 */
  onConfirm?: (value: DatePickerValue) => void;
  /** 单选 / 区间。区间时值恒为有序的两元素元组 */
  type?: DatePickerType;
  /** 可选下界（含），'YYYY-MM-DD' */
  min?: string;
  /** 可选上界（含），'YYYY-MM-DD' */
  max?: string;
  /**
   * 参与展示的日期列，默认 `['year','month','day']`，顺序由组件固定为「年→月→日」。
   *
   * 两端都生效：PC 会按列组合切换为年、年月或日历面板。
   */
  columnsType?: DateColumnKey[];
  /**
   * 展示格式，默认由 columnsType 推出（'YYYY-MM-DD' / 'YYYY-MM' / 'MM-DD'…）。
   * 支持 YYYY / YY / MM / M / DD / D 六个 token。
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

export const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    value,
    defaultValue,
    onChange,
    onConfirm,
    type = 'single',
    min,
    max,
    columnsType,
    format,
    title,
    placeholder = '请选择',
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

  const columns = React.useMemo(() => resolveColumns(columnsType), [columnsType]);

  /** format 的默认值跟随实际展示列，两端提交与回显保持同一种值形态。 */
  const resolvedFormat = React.useMemo(
    () => format ?? defaultFormatForColumns(columns),
    [format, columns],
  );

  const { selected, minParts, maxParts, setValue, clear } = useDateValue({
    value,
    defaultValue,
    onChange,
    type,
    min,
    max,
    format: resolvedFormat,
  });

  /**
   * 草稿：单值形态一定有一项（未选时预填今天，「确定」永远可用）；
   * 区间形态按位保存两端，'' 表示该端还没选。
   * 关闭时清空 —— 否则 PC 上「只点了一下就点走」的半截区间会在下次打开时复活。
   */
  const [draft, setDraft] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) {
      setDraft([]);
      return;
    }
    if (type === 'range') {
      setDraft([selected[0] ?? '', selected[1] ?? '']);
      return;
    }
    setDraft([selected[0] ?? formatParts(todayParts(), resolvedFormat)]);
  }, [open, type, selected, resolvedFormat]);

  const handleSubmit = React.useCallback(
    (next: string[]) => {
      let nextValue: DatePickerValue;
      if (type === 'range') {
        // 两端不全时不提交也不关闭：用户还差一步，关掉会让他以为选好了
        const ordered = orderDateTexts(next[0] || undefined, next[1] || undefined, columns);
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

  const panelProps: DatePanelProps = {
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

  return mode === 'mobile' ? (
    <H5DatePicker ref={ref} {...panelProps} />
  ) : (
    <PcDatePicker ref={ref} {...panelProps} />
  );
});

export type {
  DateColumnKey,
  DateParts,
  DatePickerType,
  DatePickerValue,
  DateRangeValue,
} from '@/hooks/use-date-value';
