import * as React from 'react';

/**
 * Bivane TimePicker · 跨模式共享的时间值逻辑（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 与 DatePicker 同族：H5 与 PC 的差异只在**怎么选**（拖拽滚轮 vs 可点击列表面板），
 * 「选出来的是哪个时间、哪些时间可选、区间怎么归一」两端完全一致。
 * 抽成纯函数后可以直接单测 —— 而 DOM 测试很难覆盖「跨午夜边界」「列裁剪」「逐字段夹紧」这类边界。
 *
 * 依赖方向：本文件不 import 任何组件，避免与 h5/time-picker.tsx、pc/time-picker.tsx 形成环。
 *
 * 值形态选「格式化后的字符串」：与 Vant 的时间选择器一致（'HH:mm:ss' / 'HH:mm'），
 * 消费者拿到就能直接提交后端；区间是有序两元素元组。
 *
 * 默认值落点：无值时落到「现在」而不是 '00:00:00' —— 这是 DatePicker「无值落今天」（缺陷修正一号）的
 * 时间版：时间选择器的主路径是**单值未选**，若默认停在 00:00:00 等于每次打开都要从午夜滚到当前时刻，
 * 而单值形态因为分发层预填了现在、区间草稿恒为 ''（主路径）才会把这条路径盖住。断言要来自「我期望什么」。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

export interface TimeParts {
  /** 0 ~ 23 */
  hour: number;
  /** 0 ~ 59 */
  minute: number;
  /** 0 ~ 59 */
  second: number;
}

/** 滚轮列 / 展示字段的白名单 */
export type TimeColumnKey = 'hour' | 'minute' | 'second';

export type TimePickerType = 'single' | 'range';

/** 区间值恒为两元素元组（有序），半截区间不出现在对外 API 里 */
export type TimeRangeValue = [string, string];

export type TimePickerValue = string | TimeRangeValue | undefined;

export const DEFAULT_TIME_FORMAT = 'HH:mm:ss';
export const DEFAULT_TIME_COLUMNS: TimeColumnKey[] = ['hour', 'minute', 'second'];
/** 回显区间时的连接符（展示层，不参与 format 模板） */
export const TIME_RANGE_SEPARATOR = ' ~ ';

/* ------------------------------------------------------------------ *
 * 基础时间计算
 * ------------------------------------------------------------------ */

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function nowParts(): TimeParts {
  const now = new Date();
  return { hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds() };
}

export function compareParts(a: TimeParts, b: TimeParts): number {
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

export function isSameParts(a: TimeParts, b: TimeParts): boolean {
  return compareParts(a, b) === 0;
}

/**
 * 把 parts 夹进 [min, max]。
 * 逐字段夹紧而不是「越界就整体退回边界」—— 后者会让用户在 10:00 把分钟往左滚时
 * 一下子跳回 00:00 的 min 时间。只有压在 min/max 边界上时，更细的那一级才被夹。
 */
export function clampParts(parts: TimeParts, min: TimeParts, max: TimeParts): TimeParts {
  const next: TimeParts = { hour: parts.hour, minute: parts.minute, second: parts.second };

  if (next.hour < min.hour) next.hour = min.hour;
  if (next.hour > max.hour) next.hour = max.hour;

  if (next.hour === min.hour && next.minute < min.minute) next.minute = min.minute;
  if (next.hour === max.hour && next.minute > max.minute) next.minute = max.minute;
  if (next.minute < 0) next.minute = 0;
  if (next.minute > 59) next.minute = 59;

  if (next.hour === min.hour && next.minute === min.minute && next.second < min.second) {
    next.second = min.second;
  }
  if (next.hour === max.hour && next.minute === max.minute && next.second > max.second) {
    next.second = max.second;
  }
  if (next.second < 0) next.second = 0;
  if (next.second > 59) next.second = 59;

  return next;
}

export function isWithinBounds(parts: TimeParts, min: TimeParts, max: TimeParts): boolean {
  return compareParts(parts, min) >= 0 && compareParts(parts, max) <= 0;
}

/* ------------------------------------------------------------------ *
 * 格式化与解析
 * ------------------------------------------------------------------ */

const FORMAT_TOKEN = /HH|H|mm|m|ss|s/g;

/** 按 format 模板输出文本。只认 6 个 token：HH / H / mm / m / ss / s */
export function formatParts(parts: TimeParts, format: string = DEFAULT_TIME_FORMAT): string {
  return format.replace(FORMAT_TOKEN, (token) => {
    switch (token) {
      case 'HH':
        return pad2(parts.hour);
      case 'H':
        return String(parts.hour);
      case 'mm':
        return pad2(parts.minute);
      case 'm':
        return String(parts.minute);
      case 'ss':
        return pad2(parts.second);
      case 's':
        return String(parts.second);
      default:
        return token;
    }
  });
}

function validParts(hour: number, minute: number, second: number): TimeParts | null {
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  return { hour, minute, second };
}

/**
 * 解析完整时间文本。只接受「时 → 分 → 秒（可选）」的书写顺序，分隔符兼容 : ： . 空格：
 *   10:30:00 / 10:30 / 10：30：00 / 103000（紧凑）
 * 不按 `format` 模板反解，避开「模板里带正则元字符要先转义」这一整类坑。
 */
export function parseTimeText(text: string): TimeParts | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const separated = /^(\d{1,2})\s*[:：.]\s*(\d{1,2})(?:\s*[:：.]\s*(\d{1,2}))?\s*$/.exec(trimmed);
  if (separated) {
    const hour = Number(separated[1]);
    const minute = Number(separated[2]);
    const second = separated[3] !== undefined ? Number(separated[3]) : 0;
    return validParts(hour, minute, second);
  }

  const compact = /^(\d{2})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) {
    return validParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  return null;
}

/**
 * 解析「列被裁剪后」的文本。columnsType 不含 second 时，值本身就是 '10:30'，
 * 用 parseTimeText 也能解析（秒默认 0）。这里主要是给缺字段补默认值，让
 * 列裁剪形态也能稳定还原（缺失字段按 0 补，与 resolveCursor 的补位规则一致）。
 */
export function parseTimeTextForColumns(
  text: string,
  columns: TimeColumnKey[],
): TimeParts | null {
  const normalized = DEFAULT_TIME_COLUMNS.filter((key) => columns.includes(key));
  if (normalized.length === 0) return null;

  const loose = parseTimeText(text);
  if (loose) {
    const next = { ...loose };
    if (!normalized.includes('hour')) next.hour = 0;
    if (!normalized.includes('minute')) next.minute = 0;
    if (!normalized.includes('second')) next.second = 0;
    return validParts(next.hour, next.minute, next.second);
  }

  const fields = text.trim().match(/\d+/g);
  if (!fields || fields.length !== normalized.length) return null;

  const next: TimeParts = { hour: 0, minute: 0, second: 0 };
  normalized.forEach((key, index) => {
    next[key] = Number(fields[index]);
  });
  return validParts(next.hour, next.minute, next.second);
}

/* ------------------------------------------------------------------ *
 * 可选范围
 * ------------------------------------------------------------------ */

export interface ResolveBoundsOptions {
  min?: string;
  max?: string;
  /** 已展示的列（决定默认值是否含秒） */
  columns?: TimeColumnKey[];
  /**
   * 已提交的值。时间选择器有固定的全天范围，外部值不可能越界，因此**不用来扩张默认范围**；
   * 但保留参数以便与 DatePicker 的调用签名保持一致，避免分发层两套逻辑分叉。
   */
  values?: string[];
}

/**
 * 解析可选范围。没显式给 min/max 时默认一整天（00:00:00 ~ 23:59:59，或不含秒时到 23:59:00）；
 * 显式给的 min/max 是**硬边界**，不会被值撑开（否则调用方设的约束形同虚设）。
 */
export function resolveTimeBounds({
  min,
  max,
  columns = DEFAULT_TIME_COLUMNS,
  values: _values,
}: ResolveBoundsOptions): { min: TimeParts; max: TimeParts } {
  const hasSecond = columns.includes('second');
  const explicitMin = min ? parseTimeText(min) : null;
  const explicitMax = max ? parseTimeText(max) : null;

  const minParts = explicitMin ?? { hour: 0, minute: 0, second: 0 };
  const maxParts = explicitMax ?? { hour: 23, minute: 59, second: hasSecond ? 59 : 0 };

  if (compareParts(minParts, maxParts) > 0) return { min: maxParts, max: minParts };
  return { min: minParts, max: maxParts };
}

/**
 * 某一列在当前上下文下可选的数值区间 [start, end]。
 * 时 / 分 / 秒三级都要看**更粗的那一级是否正好压在边界上**：
 * 只有当时钟等于 minParts.hour 时，分钟才从 minParts.minute 起。
 */
export function resolveColumnRange(
  key: TimeColumnKey,
  parts: TimeParts,
  min: TimeParts,
  max: TimeParts,
): [number, number] {
  if (key === 'hour') return [min.hour, max.hour];

  if (key === 'minute') {
    const start = parts.hour === min.hour ? min.minute : 0;
    const end = parts.hour === max.hour ? max.minute : 59;
    return start <= end ? [start, end] : [0, 59];
  }

  const start =
    parts.hour === min.hour && parts.minute === min.minute ? min.second : 0;
  const end =
    parts.hour === max.hour && parts.minute === max.minute ? max.second : 59;
  return start <= end ? [start, end] : [0, 59];
}

/** 展开成列数据 */
export function buildColumnValues(
  key: TimeColumnKey,
  parts: TimeParts,
  min: TimeParts,
  max: TimeParts,
): number[] {
  const [start, end] = resolveColumnRange(key, parts, min, max);
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

/** 某段时间是否落在闭区间 [start, end] 内 */
export function isPartsInRange(parts: TimeParts, start: TimeParts, end: TimeParts): boolean {
  const [from, to] = compareParts(start, end) <= 0 ? [start, end] : [end, start];
  return compareParts(parts, from) >= 0 && compareParts(parts, to) <= 0;
}

/* ------------------------------------------------------------------ *
 * 列裁剪与格式联动
 * ------------------------------------------------------------------ */

export function resolveColumns(columnsType?: TimeColumnKey[]): TimeColumnKey[] {
  if (!columnsType || columnsType.length === 0) return DEFAULT_TIME_COLUMNS;
  // 去重并固定成「时 → 分 → 秒」的顺序：滚轮列的先后不该由调用方的数组顺序决定
  return DEFAULT_TIME_COLUMNS.filter((key) => columnsType.includes(key));
}

/** 没显式给 format 时，按实际展示的列推出一个（HH:mm:ss / HH:mm / HH …） */
export function defaultFormatForColumns(columns: TimeColumnKey[]): string {
  const template: Record<TimeColumnKey, string> = { hour: 'HH', minute: 'mm', second: 'ss' };
  const parts = columns.map((key) => template[key]);
  return parts.length > 0 ? parts.join(':') : DEFAULT_TIME_FORMAT;
}

/**
 * 由文本还原出「当前光标时间」—— 也就是滚轮打开时停在哪个值。
 *
 * ⚠️ **完全没有值时必须落到「现在」**，不是 '00:00:00'。
 * 时间选择器的主路径是**单值未选**（区间草稿也恒为 ''），若默认停在午夜，
 * 用户每次打开都要从 00:00:00 滚到当前时刻 —— 单值形态因分发层预填现在而完全看不出来，
 * 只在列裁剪 / 区间形态露头。这是 DatePicker「无值落今天」缺陷的时间版。
 */
export function resolveCursor(
  text: string | undefined,
  columns: TimeColumnKey[],
  min: TimeParts,
  max: TimeParts,
): TimeParts {
  const now = nowParts();
  const parsed = text ? parseTimeTextForColumns(text, columns) : null;
  // 无值 → 现在（列裁剪的补位在下面几行处理）
  const cursor: TimeParts = parsed ?? { ...now };

  if (!columns.includes('hour')) cursor.hour = 0;
  if (!columns.includes('minute')) cursor.minute = 0;
  if (!columns.includes('second')) cursor.second = 0;

  return clampParts(cursor, min, max);
}

/* ------------------------------------------------------------------ *
 * 值的归一化
 * ------------------------------------------------------------------ */

/** 把宽松入参（单值 / 元组 / undefined）规范成内部统一的字符串数组 */
export function toTimeArray(value: TimePickerValue, type: TimePickerType): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return type === 'range' ? value.slice(0, 2) : value.slice(0, 1);
  }
  return [value];
}

/**
 * 区间两端排序并校验完整性。两端解析失败或顺序颠倒时由这里收口，避免「10:00 当选到 09:00」的区间流到 onChange。
 */
export function orderTimeTexts(
  a: string | undefined,
  b: string | undefined,
  columns: TimeColumnKey[] = DEFAULT_TIME_COLUMNS,
): TimeRangeValue | null {
  if (!a || !b) return null;
  const left = parseTimeTextForColumns(a, columns);
  const right = parseTimeTextForColumns(b, columns);
  if (!left || !right) return null;
  return compareParts(left, right) <= 0 ? [a, b] : [b, a];
}

/** 由内部数组还原成对外类型：单值给字符串，区间给有序元组 */
export function toPickerValue(list: string[], type: TimePickerType): TimePickerValue {
  if (type === 'range') return orderTimeTexts(list[0], list[1]) ?? undefined;
  return list[0];
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UseTimeValueOptions {
  value?: TimePickerValue;
  defaultValue?: TimePickerValue;
  onChange?: (value: TimePickerValue) => void;
  type?: TimePickerType;
  min?: string;
  max?: string;
  format?: string;
  columns?: TimeColumnKey[];
}

export interface UseTimeValueResult {
  type: TimePickerType;
  format: string;
  /** 规范化为字符串数组的已提交值（单值 0/1 项、区间 0/2 项） */
  selected: string[];
  /** 已提交值的时间化结果（解析失败的项被丢弃） */
  selectedParts: TimeParts[];
  minParts: TimeParts;
  maxParts: TimeParts;
  filled: boolean;
  /** 触发器回显文案 */
  displayText: string;
  setValue: (next: TimePickerValue) => void;
  clear: () => void;
}

export function useTimeValue({
  value,
  defaultValue,
  onChange,
  type = 'single',
  min,
  max,
  format = DEFAULT_TIME_FORMAT,
  columns = DEFAULT_TIME_COLUMNS,
}: UseTimeValueOptions): UseTimeValueResult {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<TimePickerValue>(defaultValue);
  const current = isControlled ? value : innerValue;

  const selected = React.useMemo(() => toTimeArray(current, type), [current, type]);

  const selectedParts = React.useMemo(
    () =>
      selected
        .map((text) => parseTimeTextForColumns(text, columns))
        .filter((parts): parts is TimeParts => parts !== null),
    [selected, columns],
  );

  const bounds = React.useMemo(
    () => resolveTimeBounds({ min, max, columns }),
    [min, max, columns],
  );

  const setValue = React.useCallback(
    (next: TimePickerValue) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const clear = React.useCallback(() => {
    setValue(undefined);
  }, [setValue]);

  const displayText = React.useMemo(() => {
    if (selected.length === 0) return '';
    if (type === 'range') return selected.join(TIME_RANGE_SEPARATOR);
    return selected[0];
  }, [selected, type]);

  return {
    type,
    format,
    selected,
    selectedParts,
    minParts: bounds.min,
    maxParts: bounds.max,
    filled: selected.length > 0,
    displayText,
    setValue,
    clear,
  };
}
