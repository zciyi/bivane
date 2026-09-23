import * as React from 'react';
import { H5Select } from '@/components/h5/select';
import { PcSelect } from '@/components/pc/select';
import type { SelectPanelProps } from '@/components/ui/select-parts';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import {
  flattenOptions,
  fromSelectedArray,
  toggleSelected,
  useSelectState,
  type SelectItem,
  type SelectOption,
  type SelectValue,
  type SelectValueInput,
} from '@/hooks/use-select-state';

/**
 * Bivane Select · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 底部弹层列表，项高 48px，选项 > 10 才出现搜索框，
 * │        **暂存确认**：点选项只在面板里打勾，点工具栏「确定」才提交并关闭
 * └ PC ── 锚定下拉浮层，键盘巡航 + 输入过滤 + 翻转防溢出，多选保持展开，
 *          点一下即生效（没有暂存这一层）
 *
 * 为什么是模式 C 而不是 B：
 * 两端不是「换壳」（同一个 primitive 换容器），而是**两套交互范式**——
 * 触控的热区/弹层语义 vs 指针的锚定/键盘语义。
 * 共享的部分被压到最小公约数：值管理、过滤、分组、选项行与触发器外观都共用，
 * 各自实现只负责「容器 + 怎么选」。
 *
 * 唯一的状态归属：本文件拥有 open / value / 过滤词 / **暂存副本**，
 * 两份实现都是受控的展示层，因此双模式 props 天然一致（契约第 9 条）。
 *
 * 暂存为什么归分发层而不是 h5/select.tsx：
 *   暂存是**值语义的一部分**（它最终要变成 onChange 的参数），不是「容器怎么摆」。
 *   把它放在实现里，h5 侧就会成为一个「自己管值」的组件，与 PC 侧的受控展示层
 *   不再对称 —— 契约第 19 条要求两份实现都是受控的。H5 独有的只是**是否启用**
 *   这一步（`confirmable`），而这由 mode 决定，不通过 props 泄露（同 title、同
 *   DropdownMenu 的快捷键提示：prop 两端都接受，差异由模式决定）。
 */

export interface SelectProps {
  /** 选项或分组；分组形如 { group: '标题', options: [...] } */
  options: SelectItem[];
  /** 受控值：单选给单值，多选给数组 */
  value?: SelectValueInput;
  /** 非受控初始值 */
  defaultValue?: SelectValueInput;
  onChange?: (value: SelectValueInput) => void;
  /** 多选：触发时翻转该项，且浮层保持展开 */
  multiple?: boolean;
  /** 是否允许过滤。呈现阈值两端不同，见下方注释 */
  searchable?: boolean;
  /** 无选中值时展示 */
  placeholder?: React.ReactNode;
  disabled?: boolean;
  /** 展示清除按钮（仅在有选中值、且未禁用时出现） */
  clearable?: boolean;
  /** 无匹配项时的文案 */
  emptyText?: React.ReactNode;
  /** 内置搜索框的占位文案 */
  searchPlaceholder?: string;
  /**
   * H5 面板标题栏文案。PC 不渲染标题栏（浮层由触发器说明自己是什么）。
   * 只在 H5 走暂存确认（confirmable）时才会随工具栏一起出现；
   * 不传 title 只有「取消 / 确定」两个按钮。
   */
  title?: React.ReactNode;
  /**
   * H5 是否走「暂存 → 确定」：点选项只在面板里打勾，点「确定」才提交并关闭，
   * 「取消」放弃暂存。默认 false（点选即生效，兼容既有行为）。
   * PC 恒为点选即生效，此 props 不影响 PC。
   */
  confirmable?: boolean;
  /** 工具栏右键文案（H5 暂存确认时） */
  confirmText?: React.ReactNode;
  /** 工具栏左键文案（H5 暂存确认时；行为是关闭并放弃暂存） */
  cancelText?: React.ReactNode;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  id?: string;
  className?: string;
  /** 逃生舱：强制某个模式的交互（契约第 9 条唯一例外） */
  forceMode?: DeviceMode;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(function Select(
  {
    options,
    value,
    defaultValue,
    onChange,
    multiple = false,
    searchable = false,
    placeholder = '请选择',
    disabled = false,
    clearable = false,
    emptyText = '暂无数据',
    searchPlaceholder = '搜索',
    title,
    confirmable = false,
    confirmText = '确定',
    cancelText = '取消',
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
    selected,
    selectedOptions,
    visibleItems,
    visibleOptions,
    keyword,
    setKeyword,
    select,
    clear,
    setValue,
  } = useSelectState({ items: options, value, defaultValue, onChange, multiple });

  /** 过滤**前**的选项总数：H5 的「选项 > 10 显示搜索框」按它判定 */
  const optionCount = React.useMemo(() => flattenOptions(options).length, [options]);

  // 关闭时清空过滤词，下次展开回到完整列表（否则会「记住」上次的搜索）
  React.useEffect(() => {
    if (open) return;
    setKeyword('');
  }, [open, setKeyword]);

  /**
   * H5 暂存确认：点选项只改草稿，点「确定」才提交（onChange + 关闭），
   * 「取消」/ 遮罩关闭丢弃草稿。草稿打开时从已提交值拷贝，因此多次开关互不影响。
   * PC 没有这一层（staged 恒 false），恒走「点一下即生效」。
   */
  const staged = mode === 'mobile' && confirmable;
  const [draft, setDraft] = React.useState<SelectValue[] | null>(null);

  React.useEffect(() => {
    if (open && staged) setDraft(selected);
    if (!open) setDraft(null);
  }, [open, staged, selected]);

  const handleSelect = React.useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      if (staged) {
        // 暂存：只翻转草稿里的选中态，不触发 onChange、不关闭面板
        setDraft((prev) => (prev ? toggleSelected(prev, option, multiple) : prev));
        return;
      }
      select(option);
      if (!multiple) setOpen(false);
    },
    [staged, select, multiple],
  );

  const handleConfirm = React.useCallback(() => {
    if (!staged || draft === null) return;
    setValue(fromSelectedArray(draft, multiple));
    setOpen(false);
  }, [staged, draft, multiple, setValue]);

  /** PC 端没有工具栏，这两个回调不会被渲染出来；传 NOOP 只为满足接口形状 */
  const NOOP = React.useCallback(() => {}, []);

  const filled = selected.length > 0;

  const triggerContent = React.useMemo(() => {
    if (!filled) return null;
    if (!multiple) return selectedOptions[0]?.label ?? null;
    // 多选回显为顿号连接的文案，靠触发器的 truncate 收口。
    // 不渲染成 tag 组：标签会与触发器共用的单行截断布局打架，
    // 且多选的数量语义在窄触发器里用文字更稳。
    return selectedOptions.map((option, index) => (
      <React.Fragment key={String(option.value)}>
        {index > 0 ? <span className="text-bv-text-3">、</span> : null}
        {option.label}
      </React.Fragment>
    ));
  }, [filled, multiple, selectedOptions]);

  const panelProps: SelectPanelProps = {
    mode,
    open,
    onOpenChange: setOpen,
    items: visibleItems,
    options: visibleOptions,
    optionCount,
    // 暂存模式下传草稿（面板里的勾），否则传已提交值；触发器回显永远取已提交值
    selected: staged && draft !== null ? draft : selected,
    onSelect: handleSelect,
    multiple,
    searchable,
    keyword,
    onKeywordChange: setKeyword,
    searchPlaceholder,
    placeholder,
    emptyText,
    clearable,
    onClear: clear,
    disabled,
    triggerContent,
    filled,
    title,
    staged,
    confirmText,
    cancelText,
    onConfirm: staged ? handleConfirm : NOOP,
    onCancel: staged ? () => setOpen(false) : NOOP,
    className,
    ariaLabel,
    id,
  };

  return mode === 'mobile' ? (
    <H5Select ref={ref} {...panelProps} />
  ) : (
    <PcSelect ref={ref} {...panelProps} />
  );
});

export type { SelectGroup, SelectItem, SelectOption, SelectValue } from '@/hooks/use-select-state';
