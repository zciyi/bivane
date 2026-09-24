import * as React from 'react';
import {
  daysInMonth,
  pad2,
  todayParts,
  type DateParts,
} from '@/hooks/use-date-value';
import { nowParts, type TimeParts } from '@/hooks/use-time-value';

export { pad2 };

/**
 * Bivane DateTimePicker · 跨模式共享的日期时间值逻辑
 *
 * 与 DatePicker / TimePicker 同族：H5 用 N 列滚轮（年/月/日/时/分/秒）选值，
 * PC 用月历选日期 + 滚轮列选时间，但「选出来的是哪个时刻、哪些值可选」两端完全一致。
 * 抽成纯函数便于单测「min 当天 09:00 的小时列从 9 起」「切到 2 月时日期被夹到月末」
 * 这类跨字段边界 —— 值模型不关心 UI 是滚轮还是月历。
 *
 * 只有**单值**（对齐 Vant DatetimePicker），三档精度：
 *   年月日时    → ['year','month','day','hour']            → 'YYYY-MM-DD HH'
 *   年月日时分  → ['year','month','day','hour','minute']    → 'YYYY-MM-DD HH:mm'
 *   年月日时分秒 → 全 6 列                                  → 'YYYY-MM-DD HH:mm:ss'
 *
 * 值形态选字符串而非 Date：与两个同族组件一致，消费者拿到即可提交后端，没有 UTC 差一天问题。
 * 本文件不 import 任何组件，避免与 h5/pc 实现形成环。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

export interface DateTimeParts extends DateParts, TimeParts {}

export type DateTimeColumnKey =
  | 'year'
  | 'month'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

export type DateTimePickerValue = string | undefined;

const DATE_COLUMNS: DateTimeColumnKey[] = ['year', 'month', 'day'];
const TIME_COLUMNS: DateTimeColumnKey[] = ['hour', 'minute', 'second'];
/** 列顺序同时是夹紧级联的顺序：每一级的可选区间依赖更粗的那些级 */
export const DEFAULT_DATETIME_COLUMNS: DateTimeColumnKey[] = [
  ...DATE_COLUMNS,
  ...TIME_COLUMNS,
];

export const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
/** 默认可选范围：今天前后各 10 年（与 DatePicker 默认口径一致） */
export const DEFAULT_DATETIME_YEAR_SPAN = 10;

/* ------------------------------------------------------------------ *
 * 基础计算
 * ------------------------------------------------------------------ */

/** 无值时的光标落点 = 此刻的日期 + 此刻的时间（不是今年元旦 00:00:00） */
export function nowDateTimeParts(): DateTimeParts {
  return { ...todayParts(), ...nowParts() };
}

export function compareParts(a: DateTimeParts, b: DateTimeParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day !== b.day) return a.day - b.day;
  if (a.hour !== b.hour) return a.hour - b.hour;
  if (a.minute !== b.minute) return a.minute - b.minute;
  return a.second - b.second;
}

function isSameDate(a: DateTimeParts, b: DateTimeParts): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/* ------------------------------------------------------------------ *
 * 格式化与解析
 * ------------------------------------------------------------------ */

// 交替分支按「长 token 在前」排列，YYYY 必须排在 YY 前、MM 排在 M 前……
const FORMAT_TOKEN =
  /YYYY|YY|MM|M|DD|D|HH|H|mm|m|ss|s/g;

/** 按 format 模板输出文本，token 集是日期 6 个 + 时间 6 个的并集 */
export function formatParts(
  parts: DateTimeParts,
  format: string = DEFAULT_DATETIME_FORMAT,
): string {
  return format.replace(FORMAT_TOKEN, (token) => {
    switch (token) {
      case 'YYYY':
        return String(parts.year);
      case 'YY':
        return pad2(parts.year % 100);
      case 'MM':
        return pad2(parts.month);
      case 'M':
        return String(parts.month);
      case 'DD':
        return pad2(parts.day);
      case 'D':
        return String(parts.day);
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

function validParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): DateTimeParts | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  return { year, month, day, hour, minute, second };
}

/**
 * 解析完整日期时间文本，只接受「年→月→日 [时[:分[:秒]]]」的书写顺序：
 *   2026-09-24 09:30:00 / 2026/9/24 9:30 / 2026年9月24日 9 / 2026-09-24T09:30
 * 时间整体可省（按纯日期处理）；分、秒可省，缺省补 0。
 */
const DATETIME_TEXT =
  /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(?:[\sT]+(\d{1,2})(?:\s*[:：]\s*(\d{1,2}))?(?:\s*[:：]\s*(\d{1,2}))?)?\s*$/;

export function parseDateTimeText(text: string): DateTimeParts | null {
  const match = DATETIME_TEXT.exec(text.trim());
  if (!match) return null;
  return validParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] !== undefined ? Number(match[4]) : 0,
    match[5] !== undefined ? Number(match[5]) : 0,
    match[6] !== undefined ? Number(match[6]) : 0,
  );
}

/**
 * 解析边界文本。min/max 缺时间字段时的补位方向不同：
 * min 缺的时间位补 0（当天最早），max 缺的时间位补 59（当天最晚），
 * 否则传 max='2026-09-24' 会把当天 09:00 误判为越界。
 */
export function parseBoundText(
  text: string,
  edge: 'min' | 'max',
): DateTimeParts | null {
  const match = DATETIME_TEXT.exec(text.trim());
  if (!match) return null;
  // 缺失字段按各自的端点值补：min 全天从 00:00:00 起，max 全天到 23:59:59 止。
  // 不能统一填 59 —— 小时补 59 会直接非法（validParts 返回 null）。
  const atMax = edge === 'max';
  return validParts(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4] !== undefined ? Number(match[4]) : atMax ? 23 : 0,
    match[5] !== undefined ? Number(match[5]) : atMax ? 59 : 0,
    match[6] !== undefined ? Number(match[6]) : atMax ? 59 : 0,
  );
}

/**
 * 按列配置解析值文本。不在列中的时间字段补 0（与 TimePicker 同一补位规则）；
 * 日期三列在本组件恒存在。
 */
export function parseDateTimeTextForColumns(
  text: string,
  columns: DateTimeColumnKey[],
): DateTimeParts | null {
  const parsed = parseDateTimeText(text);
  if (!parsed) return null;
  const next: DateTimeParts = { ...parsed };
  if (!columns.includes('hour')) next.hour = 0;
  if (!columns.includes('minute')) next.minute = 0;
  if (!columns.includes('second')) next.second = 0;
  return next;
}

/* ------------------------------------------------------------------ *
 * 列裁剪与格式联动
 * ------------------------------------------------------------------ */

/**
 * 归一化列配置：日期部分恒为「年/月/日」三列，时间部分只接受**从时起的连续前缀**
 * （要秒必先有分，要分必先有时）。不满足时回落到全 6 列 —— 调用方拼错列不该静默
 * 渲染出一个残缺选择器。
 */
export function resolveColumns(
  columnsType?: DateTimeColumnKey[],
): DateTimeColumnKey[] {
  if (!columnsType || columnsType.length === 0) return DEFAULT_DATETIME_COLUMNS;
  const dateComplete = DATE_COLUMNS.every((key) => columnsType.includes(key));
  if (!dateComplete) return DEFAULT_DATETIME_COLUMNS;

  const time: DateTimeColumnKey[] = [];
  for (const key of TIME_COLUMNS) {
    if (columnsType.includes(key)) time.push(key);
    else break;
  }
  // 时间前缀为空（如只给 ymd，或跳过了时直接给分）不是合法的日期时间配置，回落全 6 列
  if (time.length === 0) return DEFAULT_DATETIME_COLUMNS;
  return [...DATE_COLUMNS, ...time];
}

/** 默认格式：日期段 'YYYY-MM-DD' + 空格 + 时间段（HH[:mm[:ss]]） */
export function defaultFormatForColumns(columns: DateTimeColumnKey[]): string {
  const timeTemplate: Partial<Record<DateTimeColumnKey, string>> = {
    hour: 'HH',
    minute: 'mm',
    second: 'ss',
  };
  const time = TIME_COLUMNS
    .filter((key) => columns.includes(key))
    .map((key) => timeTemplate[key])
    .join(':');
  return time ? `YYYY-MM-DD ${time}` : 'YYYY-MM-DD';
}

/* ------------------------------------------------------------------ *
 * 可选范围
 * ------------------------------------------------------------------ */

export interface ResolveBoundsOptions {
  min?: string;
  max?: string;
  /** 已提交值：只用来扩张默认范围，显式 min/max 是硬边界不被撑开 */
  values?: string[];
}

export function resolveDateTimeBounds({
  min,
  max,
  values,
}: ResolveBoundsOptions): { min: DateTimeParts; max: DateTimeParts } {
  const today = todayParts();
  const explicitMin = min ? parseBoundText(min, 'min') : null;
  const explicitMax = max ? parseBoundText(max, 'max') : null;

  let minParts: DateTimeParts =
    explicitMin ?? {
      year: today.year - DEFAULT_DATETIME_YEAR_SPAN,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
  let maxParts: DateTimeParts =
    explicitMax ?? {
      year: today.year + DEFAULT_DATETIME_YEAR_SPAN,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
    };

  if (!explicitMin || !explicitMax) {
    (values ?? []).forEach((text) => {
      const parts = parseDateTimeText(text);
      if (!parts) return;
      if (!explicitMin && compareParts(parts, minParts) < 0) minParts = parts;
      if (!explicitMax && compareParts(parts, maxParts) > 0) maxParts = parts;
    });
  }

  if (compareParts(minParts, maxParts) > 0) {
    return { min: maxParts, max: minParts };
  }
  return { min: minParts, max: maxParts };
}

/**
 * 某一列在当前上下文下可选的数值区间 [start, end]。
 * 每一级都看更粗的那些级**是否正好压在边界上**（与 DatePicker/TimePicker 同一规则，
 * 这里贯通日期与时间：min 当天 09:00，则只有 min 那天小时列从 9 起）。
 */
export function resolveColumnRange(
  key: DateTimeColumnKey,
  parts: DateTimeParts,
  min: DateTimeParts,
  max: DateTimeParts,
): [number, number] {
  switch (key) {
    case 'year':
      return [min.year, max.year];
    case 'month': {
      const start = parts.year === min.year ? min.month : 1;
      const end = parts.year === max.year ? max.month : 12;
      return start <= end ? [start, end] : [1, 12];
    }
    case 'day': {
      const start =
        parts.year === min.year && parts.month === min.month ? min.day : 1;
      const end =
        parts.year === max.year && parts.month === max.month
          ? max.day
          : daysInMonth(parts.year, parts.month);
      return start <= end
        ? [start, end]
        : [1, daysInMonth(parts.year, parts.month)];
    }
    case 'hour': {
      const start = isSameDate(parts, min) ? min.hour : 0;
      const end = isSameDate(parts, max) ? max.hour : 23;
      return start <= end ? [start, end] : [0, 23];
    }
    case 'minute': {
      const atMin =
        isSameDate(parts, min) && parts.hour === min.hour;
      const atMax =
        isSameDate(parts, max) && parts.hour === max.hour;
      const start = atMin ? min.minute : 0;
      const end = atMax ? max.minute : 59;
      return start <= end ? [start, end] : [0, 59];
    }
    case 'second': {
      const atMin =
        isSameDate(parts, min) &&
        parts.hour === min.hour &&
        parts.minute === min.minute;
      const atMax =
        isSameDate(parts, max) &&
        parts.hour === max.hour &&
        parts.minute === max.minute;
      const start = atMin ? min.second : 0;
      const end = atMax ? max.second : 59;
      return start <= end ? [start, end] : [0, 59];
    }
  }
}

/** 展开成列数据 */
export function buildColumnValues(
  key: DateTimeColumnKey,
  parts: DateTimeParts,
  min: DateTimeParts,
  max: DateTimeParts,
): number[] {
  const [start, end] = resolveColumnRange(key, parts, min, max);
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

/**
 * 逐字段夹紧：按「年→秒」的级联顺序，把每一级夹进「更粗级已定」的有效区间。
 * 必须用级联而不是整体退回边界 —— 后者会让用户把小时往左滚一下就跳回整个 min 时刻。
 */
export function clampParts(
  parts: DateTimeParts,
  min: DateTimeParts,
  max: DateTimeParts,
  columns: DateTimeColumnKey[] = DEFAULT_DATETIME_COLUMNS,
): DateTimeParts {
  const next: DateTimeParts = { ...parts };
  for (const key of columns) {
    const [start, end] = resolveColumnRange(key, next, min, max);
    const value = next[key];
    next[key] = Math.min(Math.max(value, start), end);
  }
  return next;
}

/**
 * 由文本还原滚轮光标。无值落「此刻」（日期时间版「无值落今天」：主路径是单值未选，
 * 停在元旦午夜每次都要长距离滚动）。不在列中的时间字段补 0。
 */
export function resolveCursor(
  text: string | undefined,
  columns: DateTimeColumnKey[],
  min: DateTimeParts,
  max: DateTimeParts,
): DateTimeParts {
  const parsed = text ? parseDateTimeTextForColumns(text, columns) : null;
  const cursor: DateTimeParts = parsed ?? nowDateTimeParts();
  if (!columns.includes('hour')) cursor.hour = 0;
  if (!columns.includes('minute')) cursor.minute = 0;
  if (!columns.includes('second')) cursor.second = 0;
  return clampParts(cursor, min, max, columns);
}

/* ------------------------------------------------------------------ *
 * React 绑定（单值）
 * ------------------------------------------------------------------ */

export interface UseDateTimeValueOptions {
  value?: DateTimePickerValue;
  defaultValue?: DateTimePickerValue;
  onChange?: (value: DateTimePickerValue) => void;
  min?: string;
  max?: string;
  format: string;
}

export interface UseDateTimeValueResult {
  format: string;
  selected: string[];
  minParts: DateTimeParts;
  maxParts: DateTimeParts;
  filled: boolean;
  displayText: string;
  setValue: (next: DateTimePickerValue) => void;
  clear: () => void;
}

export function useDateTimeValue({
  value,
  defaultValue,
  onChange,
  min,
  max,
  format,
}: UseDateTimeValueOptions): UseDateTimeValueResult {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] =
    React.useState<DateTimePickerValue>(defaultValue);
  const current = isControlled ? value : innerValue;

  const selected = React.useMemo(
    () => (current === undefined || current === null || current === '' ? [] : [current]),
    [current],
  );

  // 默认范围要看见已提交值：超出今天 ±10 年的值不该把滚轮夹到边界端
  const bounds = React.useMemo(
    () => resolveDateTimeBounds({ min, max, values: selected }),
    [min, max, selected],
  );

  const setValue = React.useCallback(
    (next: DateTimePickerValue) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const clear = React.useCallback(() => setValue(undefined), [setValue]);

  return {
    format,
    selected,
    minParts: bounds.min,
    maxParts: bounds.max,
    filled: selected.length > 0,
    displayText: selected[0] ?? '',
    setValue,
    clear,
  };
}
