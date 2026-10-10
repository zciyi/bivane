import * as React from 'react';

/**
 * Bivane Picker · 跨模式共享模型（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * Picker 是**多列独立滚轮**：列与列之间互不影响（对比 Cascader —— 上一级决定
 * 下一列有什么）。两端共享的是「每列有哪些选项、当前值落在第几行、键盘下一个
 * 可选项是谁」；不共享的是容器（H5 滚轮 vs PC 纵向面板）。
 *
 * 全部判定写成纯函数：列与列之间没有联动状态机，jsdom 里滚轮不滚，
 * 「值落在哪一行、禁用项怎么跳过」只能靠纯函数单测兜住。
 * 依赖方向：本文件不 import 任何组件，不与 h5/pc 实现形成环。
 */

export type PickerValue = string | number;

export interface PickerOption {
  label: React.ReactNode;
  value: PickerValue;
  /** 禁用项不可选；键盘巡航跳过，但滚轮吸附不主动避开（惯性停在哪由用户决定） */
  disabled?: boolean;
}

/** 一列的入参允许直接给字符串/数字（Vant 惯例），内部统一成 PickerOption */
export type PickerColumnInput = ReadonlyArray<PickerOption | string | number>;

export type PickerColumnsInput = ReadonlyArray<PickerColumnInput>;

/**
 * 草稿里允许出现 undefined：某一列的选项为空（业务配置错误/数据没到）时，
 * 该列没有可选值，「确定」必须禁用而不是提交一个半截结果。
 */
export type PickerDraftValue = PickerValue | undefined;

/* ------------------------------------------------------------------ *
 * 归一化
 * ------------------------------------------------------------------ */

/** 字面量项（string / number）的 value 与展示文案相同 */
export function normalizeOption(item: PickerOption | string | number): PickerOption {
  if (typeof item === 'string' || typeof item === 'number') {
    return { label: String(item), value: item };
  }
  return item;
}

export function normalizeColumn(column: PickerColumnInput): PickerOption[] {
  return column.map(normalizeOption);
}

export function normalizeColumns(columns: PickerColumnsInput): PickerOption[][] {
  return columns.map(normalizeColumn);
}

/* ------------------------------------------------------------------ *
 * 值 / 下标
 * ------------------------------------------------------------------ */

export function findOption(
  column: ReadonlyArray<PickerOption>,
  value: PickerDraftValue,
): PickerOption | undefined {
  if (value === undefined) return undefined;
  return column.find((option) => option.value === value);
}

/** 值在列中的下标，找不到返回 -1 */
export function indexOfValue(
  column: ReadonlyArray<PickerOption>,
  value: PickerDraftValue,
): number {
  if (value === undefined) return -1;
  return column.findIndex((option) => option.value === value);
}

/** 第一个可选项的下标；整列都禁用（或空列）返回 -1 */
export function firstEnabledIndex(column: ReadonlyArray<PickerOption>): number {
  return column.findIndex((option) => !option.disabled);
}

/**
 * 打开面板时某一列的落点：
 *   已提交值仍在列里（即使该项被禁用，也尊重业务给定的回显值）→ 用它；
 *   否则落到第一个可选项；整列无有效项 → 0（空列无意义，仅为滚轮渲染兜底）。
 */
export function resolveColumnIndex(
  column: ReadonlyArray<PickerOption>,
  value: PickerDraftValue,
): number {
  const exact = indexOfValue(column, value);
  if (exact >= 0) return exact;
  const fallback = firstEnabledIndex(column);
  return fallback >= 0 ? fallback : 0;
}

/**
 * 打开面板时的草稿：逐列解析，空列给出 undefined（调用方据此禁用「确定」）。
 * 已提交值与列对不上时（选项集换了），就地落到该列第一个可选项 ——
 * 否则滚轮会停在一个不存在的值上，用户以为选了旧值。
 */
export function resolveDraftValues(
  columns: ReadonlyArray<ReadonlyArray<PickerOption>>,
  selected: ReadonlyArray<PickerDraftValue>,
): PickerDraftValue[] {
  return columns.map((column, columnIndex) => {
    if (column.length === 0) return undefined;
    return column[resolveColumnIndex(column, selected[columnIndex])].value;
  });
}

/** 每一列都有值才允许提交 */
export function isDraftComplete(draft: ReadonlyArray<PickerDraftValue>): boolean {
  return draft.length > 0 && draft.every((value) => value !== undefined);
}

/**
 * 键盘在列内巡航：朝 step 方向找下一个可选项，**到边界不回绕**。
 * 与滚轮「滚到头就停」的直觉一致（Select 是取值列表才回绕）；
 * 全部禁用或已在边界时原样返回 from。
 */
export function stepEnabledIndex(
  column: ReadonlyArray<PickerOption>,
  from: number,
  step: 1 | -1,
): number {
  for (let index = from + step; index >= 0 && index < column.length; index += step) {
    if (!column[index].disabled) return index;
  }
  return from;
}

/** 列内首/尾可选项下标（Home / End），没有可选项返回 -1 */
export function edgeEnabledIndex(
  column: ReadonlyArray<PickerOption>,
  edge: 'start' | 'end',
): number {
  if (edge === 'start') return firstEnabledIndex(column);
  for (let index = column.length - 1; index >= 0; index -= 1) {
    if (!column[index].disabled) return index;
  }
  return -1;
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UsePickerStateOptions {
  columns: PickerColumnsInput;
  value?: ReadonlyArray<PickerValue>;
  defaultValue?: ReadonlyArray<PickerValue>;
  onChange?: (values: PickerValue[], options: Array<PickerOption | undefined>) => void;
}

export interface UsePickerStateResult {
  /** 归一化后的列（字面量项已转成 {label,value}） */
  columns: PickerOption[][];
  /** 已提交值，按列对齐；长度不足/越界按 undefined 处理 */
  selected: PickerDraftValue[];
  /** 已提交值对应的选项，按列对齐；值失效或空列时为 undefined */
  selectedOptions: Array<PickerOption | undefined>;
  /** 整体提交一组值（点「确定」时唯一的提交入口） */
  setValue: (values: ReadonlyArray<PickerValue>) => void;
  clear: () => void;
}

export function usePickerState({
  columns,
  value,
  defaultValue,
  onChange,
}: UsePickerStateOptions): UsePickerStateResult {
  // React 绑定保持薄：归一化与受控分支各只有一处，判定全部走上面的纯函数
  const normalized = React.useMemo(() => normalizeColumns(columns), [columns]);

  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<ReadonlyArray<PickerValue> | undefined>(
    defaultValue,
  );
  const current = isControlled ? value : innerValue;
  const selected = React.useMemo(
    () => normalized.map((_, index) => current?.[index]),
    [normalized, current],
  );

  const selectedOptions = React.useMemo(
    () => normalized.map((column, index) => findOption(column, selected[index])),
    [normalized, selected],
  );

  const setValue = React.useCallback(
    (next: ReadonlyArray<PickerValue>) => {
      if (!isControlled) setInnerValue(next);
      const options = next.map((item, index) => findOption(normalized[index] ?? [], item));
      onChange?.(next.slice(), options);
    },
    [isControlled, normalized, onChange],
  );

  const clear = React.useCallback(() => {
    if (!isControlled) setInnerValue([]);
    onChange?.([], []);
  }, [isControlled, onChange]);

  return { columns: normalized, selected, selectedOptions, setValue, clear };
}
