import * as React from 'react';

/**
 * Bivane Select · 跨模式共享状态（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 为什么整份逻辑都写成纯函数：
 * H5 与 PC 的差异只在**怎么选**（底部列表点 vs 锚定浮层键盘），
 * 「选了什么、怎么过滤、下一个可选项是谁」两端完全一致。
 * 把这些判定抽成纯函数后，可以直接单测——而 DOM 测试很难覆盖
 * 「跳过一个 disabled 项」这类边界。
 *
 * 依赖方向：本文件不 import 任何组件，避免与 h5/select.tsx、pc/select.tsx 形成环。
 */

export type SelectValue = string | number;

export interface SelectOption {
  /** 展示文案。参与搜索匹配时要求为 string / number（见 matchOption） */
  label: React.ReactNode;
  value: SelectValue;
  /** 禁用项不可选，但键盘导航会**跳过**而不是停在它上面 */
  disabled?: boolean;
}

export interface SelectGroup {
  /** 分组标题 */
  group: React.ReactNode;
  options: SelectOption[];
}

export type SelectItem = SelectOption | SelectGroup;

/** 单选用单值、多选用数组；undefined 表示未选 */
export type SelectValueInput = SelectValue | SelectValue[] | undefined;

/* ------------------------------------------------------------------ *
 * 结构遍历
 * ------------------------------------------------------------------ */

export function isSelectGroup(item: SelectItem): item is SelectGroup {
  return 'options' in item;
}

/** 摊平分组，得到纯选项序列（键盘导航与虚拟滚动都基于它） */
export function flattenOptions(items: SelectItem[]): SelectOption[] {
  const result: SelectOption[] = [];
  items.forEach((item) => {
    if (isSelectGroup(item)) result.push(...item.options);
    else result.push(item);
  });
  return result;
}

export function hasGroups(items: SelectItem[]): boolean {
  return items.some(isSelectGroup);
}

/* ------------------------------------------------------------------ *
 * 过滤
 * ------------------------------------------------------------------ */

/**
 * 单选项是否命中关键词。
 *
 * 只匹配「可转成文本」的 label（string / number）与 value：
 * label 是自定义节点时无法可靠取文本，此时退化为按 value 匹配。
 * 需要按业务字段搜索的场景请自行传入字符串 label。
 */
export function matchOption(option: SelectOption, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;

  const { label, value } = option;
  const labelText =
    typeof label === 'string' || typeof label === 'number' ? String(label) : String(value);
  return labelText.toLowerCase().includes(kw);
}

/** 过滤条目；分组内选项被过滤光时整组丢弃，避免出现「只有标题没有内容」的空块 */
export function filterItems(items: SelectItem[], keyword: string): SelectItem[] {
  const kw = keyword.trim();
  if (!kw) return items;

  const result: SelectItem[] = [];
  items.forEach((item) => {
    if (isSelectGroup(item)) {
      const options = item.options.filter((option) => matchOption(option, kw));
      if (options.length > 0) result.push({ group: item.group, options });
    } else if (matchOption(item, kw)) {
      result.push(item);
    }
  });
  return result;
}

/* ------------------------------------------------------------------ *
 * 值规范化与选中判定
 * ------------------------------------------------------------------ */

/** 把宽松的入参（单值 / 数组 / undefined）规范成内部统一的数组 */
export function toValueArray(value: SelectValueInput): SelectValue[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value.slice() : [value];
}

/** 回显成数组（单选只取第一个，防止外部误传数组导致 UI 出现多个勾） */
export function toSelectedArray(value: SelectValueInput, multiple: boolean): SelectValue[] {
  const list = toValueArray(value);
  return multiple ? list : list.slice(0, 1);
}

/** 由内部数组还原成对外类型：单选给单值，多选给数组 */
export function fromSelectedArray(selected: SelectValue[], multiple: boolean): SelectValueInput {
  if (multiple) return selected;
  return selected.length > 0 ? selected[0] : undefined;
}

export function isOptionSelected(selected: SelectValue[], option: SelectOption): boolean {
  return selected.includes(option.value);
}

/**
 * 计算点击某一项之后的新选中集。
 * 单选直接替换（H5 侧据此「单选即关」），多选则翻转该项。
 */
export function toggleSelected(
  selected: SelectValue[],
  option: SelectOption,
  multiple: boolean,
): SelectValue[] {
  if (!multiple) return [option.value];
  return selected.includes(option.value)
    ? selected.filter((item) => item !== option.value)
    : [...selected, option.value];
}

/**
 * 回显选项。
 * 按 **options 的声明顺序** 而非选择顺序返回，这样展示层拿到的多个 tag / 文案
 * 顺序稳定，不随用户点击先后跳动。
 */
export function collectSelectedOptions(
  items: SelectItem[],
  selected: SelectValue[],
): SelectOption[] {
  return flattenOptions(items).filter((option) => selected.includes(option.value));
}

/* ------------------------------------------------------------------ *
 * 键盘导航
 * ------------------------------------------------------------------ */

/**
 * 从 from 出发按 step 找下一个**可选**项的下标，到边界回绕。
 *
 * from 传 -1 表示「还没有激活项」：
 *   step=+1（ArrowDown）→ 落在第一个可选项
 *   step=-1（ArrowUp）  → 落在最后一个可选项
 * 全部项都 disabled 时返回 -1，调用方据此不做任何移动。
 */
export function nextEnabledIndex(
  options: SelectOption[],
  from: number,
  step: 1 | -1,
): number {
  const count = options.length;
  if (count === 0) return -1;

  let index = from < 0 ? (step === 1 ? -1 : 0) : from;
  for (let i = 0; i < count; i += 1) {
    index = (index + step + count) % count;
    if (!options[index].disabled) return index;
  }
  return -1;
}

/** 打开浮层时的初始激活项：第一个已选项，没有则第一个可选项 */
export function initialActiveIndex(
  options: SelectOption[],
  selected: SelectValue[],
): number {
  const selectedIndex = options.findIndex(
    (option) => !option.disabled && selected.includes(option.value),
  );
  if (selectedIndex >= 0) return selectedIndex;
  return options.findIndex((option) => !option.disabled);
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

/** H5 在选项数超过该阈值时才展示搜索框（矩阵 §2.2：「选项 > 10 时显示内置搜索框」） */
export const H5_SEARCH_VISIBLE_THRESHOLD = 10;

export interface UseSelectStateOptions {
  items: SelectItem[];
  value?: SelectValueInput;
  defaultValue?: SelectValueInput;
  onChange?: (value: SelectValueInput) => void;
  multiple?: boolean;
}

export interface UseSelectStateResult {
  /** 规范化后的选中值数组 */
  selected: SelectValue[];
  selectedOptions: SelectOption[];
  /** 过滤后的条目（保留分组结构） */
  visibleItems: SelectItem[];
  /** 过滤后的扁平选项（键盘导航 / 虚拟滚动 / 空态判定都用它） */
  visibleOptions: SelectOption[];
  keyword: string;
  setKeyword: (keyword: string) => void;
  select: (option: SelectOption) => void;
  clear: () => void;
  isSelected: (option: SelectOption) => boolean;
  /**
   * 直接提交一个值（不经由点选翻转）。
   * H5 暂存确认用它在「确定」时把草稿整体写回；select/clear 内部也复用它，
   * 因此受控/非受控的分支只有这一处。
   */
  setValue: (value: SelectValueInput) => void;
}

export function useSelectState({
  items,
  value,
  defaultValue,
  onChange,
  multiple = false,
}: UseSelectStateOptions): UseSelectStateResult {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<SelectValueInput>(defaultValue);
  const current = isControlled ? value : innerValue;

  const [keyword, setKeyword] = React.useState('');

  const selected = React.useMemo(() => toSelectedArray(current, multiple), [current, multiple]);

  const visibleItems = React.useMemo(() => filterItems(items, keyword), [items, keyword]);
  const visibleOptions = React.useMemo(() => flattenOptions(visibleItems), [visibleItems]);
  const selectedOptions = React.useMemo(
    () => collectSelectedOptions(items, selected),
    [items, selected],
  );

  const setValue = React.useCallback(
    (next: SelectValueInput) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const select = React.useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      setValue(fromSelectedArray(toggleSelected(selected, option, multiple), multiple));
    },
    [selected, multiple, setValue],
  );

  const clear = React.useCallback(() => {
    setValue(fromSelectedArray([], multiple));
    setKeyword('');
  }, [setValue, multiple]);

  const isSelected = React.useCallback(
    (option: SelectOption) => isOptionSelected(selected, option),
    [selected],
  );

  return {
    selected,
    selectedOptions,
    visibleItems,
    visibleOptions,
    keyword,
    setKeyword,
    select,
    setValue,
    clear,
    isSelected,
  };
}
