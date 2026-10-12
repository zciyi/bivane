import * as React from 'react';
import {
  clampParts,
  compareParts,
  daysInMonth,
  parseDateText,
  toParts,
  todayParts,
  type DateParts,
} from '@/hooks/use-date-value';

/**
 * Bivane Calendar · 跨模式共享的日历值逻辑（模式 C 的「共享逻辑下沉 hooks/」层）
 *
 * H5（全屏弹层 + 月份纵向滚动 + 触摸拖选）与 PC（内嵌月历 + 鼠标拖选 + 键盘）
 * 共用的只有**日期推理**：默认范围、月网格、区间状态机、多选去重排序、值归一化。
 * 全部写成无 DOM 依赖的纯函数，边界（闰年、跨月补位、超窗滑动）可直接单测。
 *
 * 值形态与 DatePicker 一致：'YYYY-MM-DD' 字符串（不用 Date，避免时区差一天）。
 * 单值 = string，区间 = 有序 [start, end]，多选 = 升序 string[]。
 *
 * 依赖方向：本文件不 import 任何组件，避免与 h5/pc 实现形成环。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

export type CalendarType = 'single' | 'multiple' | 'range';

export type CalendarRangeValue = [string, string];

export type CalendarValue = string | string[] | CalendarRangeValue | undefined;

/** 区间草稿允许半截：null 表示该端还没选（确定条据此禁用） */
export type RangeDraft = [string | null, string | null];

export const CALENDAR_DATE_FORMAT = 'YYYY-MM-DD';
/** 星期表头：周日为首（与 Vant Calendar 的 first-day-of-week 默认值一致） */
export const DEFAULT_FIRST_DAY_OF_WEEK = 0;
/** Vant Calendar 默认范围：今天起 6 个月（与 DatePicker 的 ±10 年刻意不同） */
export const DEFAULT_CALENDAR_MONTH_SPAN = 6;

/* ------------------------------------------------------------------ *
 * 基础计算
 * ------------------------------------------------------------------ */

/** 用 UTC 分量求两个日历日相差的天数（规避本地时区夏令时导致的偏差） */
export function diffDays(from: DateParts, to: DateParts): number {
  const utc = (parts: DateParts) =>
    Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** n 个月后的月末（用于默认 max） */
function monthEndAfter(parts: DateParts, amount: number): DateParts {
  const shifted = new Date(parts.year, parts.month - 1 + amount, 1);
  const year = shifted.getFullYear();
  const month = shifted.getMonth() + 1;
  return { year, month, day: daysInMonth(year, month) };
}

/* ------------------------------------------------------------------ *
 * 可选范围
 * ------------------------------------------------------------------ */

export interface ResolveCalendarBoundsOptions {
  min?: string;
  max?: string;
  /**
   * 已提交值。只用来扩张**默认**范围（与 DatePicker 同规则）：
   * 调用方没显式给 min/max 时，默认范围装不下已选值就向外扩到包含它；
   * 显式给的硬边界不会被值撑开。
   */
  values?: string[];
}

export function resolveCalendarBounds(
  options: ResolveCalendarBoundsOptions,
): { min: DateParts; max: DateParts } {
  const { min, max, values } = options;
  const now = todayParts();
  const explicitMin = min ? parseDateText(min) : null;
  const explicitMax = max ? parseDateText(max) : null;

  let minParts = explicitMin ?? { ...now };
  let maxParts = explicitMax ?? monthEndAfter(now, DEFAULT_CALENDAR_MONTH_SPAN - 1);

  if (!explicitMin || !explicitMax) {
    (values ?? []).forEach((text) => {
      const parts = parseDateText(text);
      if (!parts) return;
      if (!explicitMin && compareParts(parts, minParts) < 0) minParts = parts;
      if (!explicitMax && compareParts(parts, maxParts) > 0) maxParts = parts;
    });
  }

  if (compareParts(minParts, maxParts) > 0) return { min: maxParts, max: minParts };
  return { min: minParts, max: maxParts };
}

/* ------------------------------------------------------------------ *
 * 月网格
 * ------------------------------------------------------------------ */

export interface CalendarCell {
  parts: DateParts;
  /** 当月内日期为 true；前置/后置补位格为 false（H5 留空、PC 渲染邻月灰字） */
  inMonth: boolean;
}

export interface CalendarMonthGrid {
  year: number;
  /** 1 ~ 12 */
  month: number;
  /** 补位后恒为 7 的倍数格（4~6 行），前置格来自上月、后置格来自下月 */
  cells: CalendarCell[];
  rowCount: number;
}

/**
 * 展开某月网格。前置补位格数 = (首日星期 - weekStart + 7) % 7，
 * 后置格补到 7 的倍数，保证每一行都是完整一周（区间背景带才不会断行错位）。
 */
export function buildMonthGrid(
  year: number,
  month: number,
  firstDayOfWeek: number = DEFAULT_FIRST_DAY_OF_WEEK,
): CalendarMonthGrid {
  const total = daysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const lead = (firstWeekday - firstDayOfWeek + 7) % 7;

  const cells: CalendarCell[] = [];

  for (let index = 0; index < lead; index += 1) {
    // 前置格来自上一月（仅用于占位，H5 不渲染其数字）
    const date = new Date(year, month - 1, index - lead + 1);
    cells.push({ parts: toParts(date), inMonth: false });
  }

  for (let day = 1; day <= total; day += 1) {
    cells.push({ parts: { year, month, day }, inMonth: true });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ parts: toParts(date), inMonth: false });
  }

  return { year, month, cells, rowCount: cells.length / 7 };
}

/** 某月实际占几行（H5 懒挂载占位高度要用，4/5/6 行随月份浮动） */
export function rowsCountInMonth(
  year: number,
  month: number,
  firstDayOfWeek: number = DEFAULT_FIRST_DAY_OF_WEEK,
): number {
  return buildMonthGrid(year, month, firstDayOfWeek).rowCount;
}

/** 枚举闭区间 [min, max] 覆盖的每一个月（H5 纵向列表按此顺序渲染） */
export function listMonths(
  min: DateParts,
  max: DateParts,
): Array<{ year: number; month: number }> {
  const months: Array<{ year: number; month: number }> = [];
  let year = min.year;
  let month = min.month;
  while (
    year < max.year ||
    (year === max.year && month <= max.month)
  ) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/* ------------------------------------------------------------------ *
 * 区间状态机
 * ------------------------------------------------------------------ */

export interface ApplyRangeOptions {
  allowSameDay: boolean;
}

export interface ApplyRangeResult {
  draft: RangeDraft;
  /** 本次选择是否已凑齐两端（可提交） */
  completed: boolean;
}

/**
 * 点选/触摸选定一天时的区间状态机（对齐 Vant Calendar 语义）：
 *   - 没有起点（或上一段已完成）→ 以该日为新起点，等终点；
 *   - 该日早于起点 → 丢弃旧起点，以该日重新开始；
 *   - 与起点同日 → allowSameDay 才完成同日区间，否则忽略（不重置）；
 *   - 晚于起点 → 凑齐两端。
 * maxRange 的拦截不在这里：轻点超界（onOverRange）与拖选超窗（窗口滑动）
 * 是两种行为，分别由调用方与 resolveDragRange 处理。
 */
export function applyRangeDay(
  draft: RangeDraft,
  dayText: string,
  { allowSameDay }: ApplyRangeOptions,
): ApplyRangeResult {
  const day = parseDateText(dayText);
  if (!day) return { draft, completed: false };

  const [startText, endText] = draft;
  if (!startText || endText !== null) {
    return { draft: [dayText, null], completed: false };
  }

  const start = parseDateText(startText);
  if (!start) return { draft: [dayText, null], completed: false };

  const cmp = compareParts(day, start);
  if (cmp === 0) {
    return allowSameDay
      ? { draft: [startText, dayText], completed: true }
      : { draft, completed: false };
  }
  if (cmp < 0) return { draft: [dayText, null], completed: false };
  return { draft: [startText, dayText], completed: true };
}

export interface DragRangeResult {
  draft: RangeDraft;
  /** 触点是否越过 maxRange（窗口已向前滑动） */
  slid: boolean;
}

/**
 * 拖选（H5 触摸 / PC 鼠标按下后移动）经过某一天时的预览区间。
 *
 * 对齐 Vant touchmove：
 *   - 触点早于起点：忽略（不把起点往回带，拖选过程中区间不闪跳）；
 *   - 跨度达到 maxRange（含端点计数，maxRange=3 允许 diff 2）：窗口整体
 *     向前滑动，终点恒为触点日、起点 = 触点日 - (maxRange-1)；
 *   - 其余：起点不动，终点跟手。
 * 轻点超界不走这里——点击事件先于滑动判定，由调用方比对 diffDays 后触发
 * onOverRange 且不改值。
 */
export function resolveDragRange(
  startText: string,
  dayText: string,
  maxRange?: number,
): DragRangeResult {
  const start = parseDateText(startText);
  const day = parseDateText(dayText);
  if (!start || !day) return { draft: [startText, null], slid: false };

  const delta = diffDays(start, day);
  if (delta < 0) return { draft: [startText, null], slid: false };

  if (maxRange && delta >= maxRange) {
    const shifted = new Date(Date.UTC(day.year, day.month - 1, day.day));
    shifted.setUTCDate(shifted.getUTCDate() - (maxRange - 1));
    const slidStart = `${shifted.getUTCFullYear()}-${String(
      shifted.getUTCMonth() + 1,
    ).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
    return { draft: [slidStart, dayText], slid: true };
  }

  return { draft: [startText, dayText], slid: false };
}

/* ------------------------------------------------------------------ *
 * 多选
 * ------------------------------------------------------------------ */

/** 多选切换：已在列表则移除，否则加入并按时间升序归位 */
export function toggleMultiple(list: string[], dayText: string): string[] {
  if (!parseDateText(dayText)) return list;
  if (list.includes(dayText)) return list.filter((item) => item !== dayText);
  return [...list, dayText]
    .filter((item, index, arr) => parseDateText(item) && arr.indexOf(item) === index)
    .sort((a, b) => compareParts(parseDateText(a)!, parseDateText(b)!));
}

/* ------------------------------------------------------------------ *
 * 值的归一化
 * ------------------------------------------------------------------ */

/** 解析 + 越界过滤 + 去重，得到内部统一的有序字符串列表 */
export function normalizeCalendarList(
  value: CalendarValue,
  type: CalendarType,
  min: DateParts,
  max: DateParts,
): string[] {
  if (value === undefined || value === null) return [];

  const raw = Array.isArray(value) ? value : [value];
  const valid = raw.filter(
    (text): text is string =>
      typeof text === 'string' &&
      (() => {
        const parts = parseDateText(text);
        return parts !== null && compareParts(parts, min) >= 0 && compareParts(parts, max) <= 0;
      })(),
  );

  if (type === 'range') {
    const unique = [...new Set(valid)].sort(
      (a, b) => compareParts(parseDateText(a)!, parseDateText(b)!),
    );
    return unique.slice(0, 2);
  }

  if (type === 'multiple') {
    return [...new Set(valid)].sort(
      (a, b) => compareParts(parseDateText(a)!, parseDateText(b)!),
    );
  }

  return valid.slice(0, 1);
}

/** 内部列表 → 对外值：单值给字符串，区间给有序元组，多选中给数组 */
export function toCalendarValue(
  list: string[],
  type: CalendarType,
): CalendarValue {
  if (list.length === 0) return undefined;
  if (type === 'range') {
    if (list.length < 2) return undefined;
    return [list[0], list[1]] as CalendarRangeValue;
  }
  if (type === 'multiple') return list;
  return list[0];
}

/**
 * 打开面板时的播种月：区间取终点（没有取起点）、多选取最后一项、单值取已选日，
 * 都没有则落「今天」，并夹进可选范围 —— 与 DatePicker 的 resolveCursor 同口径。
 */
export function resolveCalendarSeed(
  selected: string[],
  min: DateParts,
  max: DateParts,
): DateParts {
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const parts = parseDateText(selected[index]);
    if (parts) return clampParts(parts, min, max);
  }
  return clampParts(todayParts(), min, max);
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UseCalendarValueOptions {
  value?: CalendarValue;
  defaultValue?: CalendarValue;
  onChange?: (value: CalendarValue) => void;
  type?: CalendarType;
  min?: string;
  max?: string;
}

export interface UseCalendarValueResult {
  type: CalendarType;
  /** 已提交值（单值 0/1 项、区间 0/2 项、多选 0~n 项） */
  selected: string[];
  minParts: DateParts;
  maxParts: DateParts;
  filled: boolean;
  setValue: (next: CalendarValue) => void;
  clear: () => void;
}

export function useCalendarValue({
  value,
  defaultValue,
  onChange,
  type = 'single',
  min,
  max,
}: UseCalendarValueOptions): UseCalendarValueResult {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<CalendarValue>(defaultValue);
  const current = isControlled ? value : innerValue;

  /** bounds 依赖 selected：默认范围要被已选值撑开，先算一轮粗值再归一化 */
  const preliminaryBounds = React.useMemo(
    () =>
      resolveCalendarBounds({
        min,
        max,
        values: Array.isArray(current)
          ? current
          : current === undefined
            ? []
            : [current],
      }),
    [min, max, current],
  );

  const selected = React.useMemo(
    () => normalizeCalendarList(current, type, preliminaryBounds.min, preliminaryBounds.max),
    [current, type, preliminaryBounds.min, preliminaryBounds.max],
  );

  /** 归一化后再算一次：非法/越界项不该参与撑开默认范围 */
  const bounds = React.useMemo(
    () => resolveCalendarBounds({ min, max, values: selected }),
    [min, max, selected],
  );

  const setValue = React.useCallback(
    (next: CalendarValue) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const clear = React.useCallback(() => setValue(undefined), [setValue]);

  return {
    type,
    selected,
    minParts: bounds.min,
    maxParts: bounds.max,
    filled: selected.length > 0,
    setValue,
    clear,
  };
}
