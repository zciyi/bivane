import * as React from 'react';

/**
 * Bivane DatePicker · 跨模式共享的日期值逻辑（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 为什么整份逻辑都写成纯函数：
 * H5 与 PC 的差异只在**怎么选**（底部滚轮 vs 锚定月历），
 * 「选出来的是哪一天、哪些天可选、区间怎么归一」两端完全一致。
 * 抽成纯函数后可以直接单测 —— 而 DOM 测试很难覆盖「闰年 2 月 29 日」
 * 「月份切换后日期被夹紧」这类边界。
 *
 * 依赖方向：本文件不 import 任何组件，避免与 h5/date-picker.tsx、pc/date-picker.tsx 形成环。
 *
 * 值形态选「格式化后的字符串」而不是 Date：
 *   ① 与 Vant 一致（`v-model` 是 'YYYY-MM-DD' 字符串），消费者拿到就能直接提交后端；
 *   ② Date 带时区，跨端序列化容易出现「差一天」；字符串没有这个问题；
 *   ③ 区间是两元素元组，字符串按 Y-M-D 补零书写时字典序即时序，便于调试比对。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

export interface DateParts {
  year: number;
  /** 1 ~ 12（不是 Date 的 0 ~ 11） */
  month: number;
  /** 1 ~ 31 */
  day: number;
}

/** 滚轮列 / 展示字段的白名单 */
export type DateColumnKey = 'year' | 'month' | 'day';

export type DatePickerType = 'single' | 'range';

/** 区间值恒为两元素元组（有序），半截区间不出现在对外 API 里 */
export type DateRangeValue = [string, string];

export type DatePickerValue = string | DateRangeValue | undefined;

export const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
export const DEFAULT_DATE_COLUMNS: DateColumnKey[] = ['year', 'month', 'day'];
/** 回显区间时的连接符（属于展示层，不参与 format 模板） */
export const DATE_RANGE_SEPARATOR = ' ~ ';
/** 默认可选范围：今天前后各 10 年（与 Vant 的 min-date / max-date 默认值一致） */
export const DEFAULT_DATE_YEAR_SPAN = 10;

/* ------------------------------------------------------------------ *
 * 基础日期计算
 * ------------------------------------------------------------------ */

/** 本月天数。用「下个月的第 0 天」取，闰年自动正确 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function toParts(date: Date): DateParts {
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

export function todayParts(): DateParts {
  return toParts(new Date());
}

export function compareParts(a: DateParts, b: DateParts): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function isSameParts(a: DateParts, b: DateParts): boolean {
  return compareParts(a, b) === 0;
}

/** 在 parts 上加减天数（跨月跨年由 Date 自己处理） */
export function addDays(parts: DateParts, amount: number): DateParts {
  return toParts(new Date(parts.year, parts.month - 1, parts.day + amount));
}

/** 在 parts 上加减月数，日超出目标月天数时夹到月末（1/31 + 1 月 → 2/28） */
export function addMonths(parts: DateParts, amount: number): DateParts {
  const shifted = new Date(parts.year, parts.month - 1 + amount, 1);
  const year = shifted.getFullYear();
  const month = shifted.getMonth() + 1;
  return { year, month, day: Math.min(parts.day, daysInMonth(year, month)) };
}

/**
 * 把 parts 夹进 [min, max]。
 * 逐字段夹紧而不是「越界就整体退回边界」—— 后者会让用户在 2026 年把月份往左滚时
 * 一下子跳回 2016 年的 min 日期。
 */
export function clampParts(parts: DateParts, min: DateParts, max: DateParts): DateParts {
  const next: DateParts = { year: parts.year, month: parts.month, day: parts.day };

  if (next.year < min.year) next.year = min.year;
  if (next.year > max.year) next.year = max.year;
  if (next.year === min.year && next.month < min.month) next.month = min.month;
  if (next.year === max.year && next.month > max.month) next.month = max.month;

  const lastDay = daysInMonth(next.year, next.month);
  if (next.day > lastDay) next.day = lastDay;
  if (next.day < 1) next.day = 1;

  if (next.year === min.year && next.month === min.month && next.day < min.day) next.day = min.day;
  if (next.year === max.year && next.month === max.month && next.day > max.day) next.day = max.day;
  return next;
}

export function isWithinBounds(parts: DateParts, min: DateParts, max: DateParts): boolean {
  return compareParts(parts, min) >= 0 && compareParts(parts, max) <= 0;
}

/**
 * 单日是否落在闭区间 [min, max]（只比年/月/日）。
 *
 * 与 PC DatePicker 交给 react-day-picker 的 `disabled: [{ before: minDate }, { after: maxDate }]`
 * **完全等价**：rdp 的 before/after 是「按日历日」匹配（忽略时分），含端点，
 * 即 `day >= minDay && day <= maxDay`，正是这条。两处共用，避免两套口径漂移。
 */
export function isDayWithinBounds(day: DateParts, min: DateParts, max: DateParts): boolean {
  return compareParts(day, min) >= 0 && compareParts(day, max) <= 0;
}

/**
 * 某个月份是否包含至少一个可选日（即与闭区间 [min, max] 有交集）。
 *
 * PC 两套月历（rdp 网格 + 自研网格）都用它决定「上一月/下一月」按钮能否点：
 * 翻到整月无可选日的空月是 UX 瑕疵（非正确性 bug），由这里统一收口，
 * 这样两套日历的「翻页边界」判定不会各写一份。
 */
export function monthHasSelectableDay(
  year: number,
  month: number,
  min: DateParts,
  max: DateParts,
): boolean {
  const monthStart: DateParts = { year, month, day: 1 };
  const monthEnd: DateParts = { year, month, day: daysInMonth(year, month) };
  return compareParts(monthEnd, min) >= 0 && compareParts(monthStart, max) <= 0;
}

/* ------------------------------------------------------------------ *
 * 格式化与解析
 * ------------------------------------------------------------------ */

const FORMAT_TOKEN = /YYYY|YY|MM|M|DD|D/g;

/** 按 format 模板输出文本。只认 6 个 token：YYYY / YY / MM / M / DD / D */
export function formatParts(parts: DateParts, format: string = DEFAULT_DATE_FORMAT): string {
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
      default:
        return token;
    }
  });
}

function validParts(year: number, month: number, day: number): DateParts | null {
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/**
 * 解析完整日期文本。
 *
 * **只接受「年 → 月 → 日」的书写顺序**（由松到紧依次试）：
 *   2026-09-20 / 2026/9/20 / 2026.09.20 / 2026年9月20日 / 20260920
 * 不按 `format` 模板反解，是为了避开「模板里带正则元字符要先转义」这一整类坑；
 * 代价是 `format='MM/DD/YYYY'` 这类月日在前的自定义格式无法直接输入。
 * 该约束写在 USAGE 里，需要它的场景请自行做输入层转换。
 */
export function parseDateText(text: string): DateParts | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const separated = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/.exec(trimmed);
  if (separated) {
    return validParts(Number(separated[1]), Number(separated[2]), Number(separated[3]));
  }

  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (compact) {
    return validParts(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  return null;
}

/**
 * 解析「列被裁剪后」的文本。
 *
 * `columnsType` 不含 day 时，值本身就是 '2026-09'，用 parseDateText 会失败并退回今天，
 * 于是滚轮每次打开都跳回当前月。这里按缺失的字段补默认值（月/日补 1），
 * 让 'YYYY-MM' 与 'YYYY' 两种情况都能稳定还原。
 */
export function parseLooseDateText(text: string): DateParts | null {
  const full = parseDateText(text);
  if (full) return full;

  const trimmed = text.trim();
  const yearMonth = /^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*月?$/.exec(trimmed);
  if (yearMonth) {
    const month = Number(yearMonth[2]);
    if (month < 1 || month > 12) return null;
    return { year: Number(yearMonth[1]), month, day: 1 };
  }

  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) return { year: Number(yearOnly[1]), month: 1, day: 1 };

  // 'MM-DD'：columnsType 不含 year 时值就是这种形态。年份锚到今年，
  // 调用方（resolveCursor）随后会按需覆盖它。
  const monthDay = /^(\d{1,2})\s*[-/.]\s*(\d{1,2})\s*日?$/.exec(trimmed);
  if (monthDay) {
    return validParts(todayParts().year, Number(monthDay[1]), Number(monthDay[2]));
  }

  return null;
}

/**
 * 按 columnsType 解析裁剪后的值。默认格式都有分隔符，因此以数字段数量匹配列；
 * 缺失的年份锚到今年，缺失的月/日补 1，与 resolveCursor 的补位规则保持一致。
 */
export function parseDateTextForColumns(
  text: string,
  columns: DateColumnKey[],
): DateParts | null {
  const normalized = DEFAULT_DATE_COLUMNS.filter((key) => columns.includes(key));
  if (normalized.length === 0) return null;

  const loose = parseLooseDateText(text);
  if (loose) {
    const next = { ...loose };
    if (!normalized.includes('year')) next.year = todayParts().year;
    if (!normalized.includes('month')) next.month = 1;
    if (!normalized.includes('day')) next.day = 1;
    return validParts(next.year, next.month, next.day);
  }

  const fields = text.trim().match(/\d+/g);
  if (!fields || fields.length !== normalized.length) return null;

  const next: DateParts = { year: todayParts().year, month: 1, day: 1 };
  normalized.forEach((key, index) => {
    next[key] = Number(fields[index]);
  });
  return validParts(next.year, next.month, next.day);
}

/* ------------------------------------------------------------------ *
 * 可选范围
 * ------------------------------------------------------------------ */

export interface ResolveBoundsOptions {
  min?: string;
  max?: string;
  /**
   * 已提交的值。
   *
   * 只用来**扩张默认范围**：调用方没显式给 min/max 时，默认范围（今天 ± 10 年）
   * 装不下已选值就向外扩到包含它 —— 夹走已选值会让「值没变但显示变了」，
   * 是最难解释的一类缺陷。
   *
   * **显式给的 min/max 是硬边界，不会被值撑开**：否则调用方设的约束形同虚设。
   * 显式边界与值冲突时（调用方自己的数据不一致），选择器打开在边界上、值原样回显。
   */
  values?: string[];
}

export function resolveDateBounds({ min, max, values }: ResolveBoundsOptions): {
  min: DateParts;
  max: DateParts;
} {
  const now = todayParts();
  const explicitMin = min ? parseDateText(min) : null;
  const explicitMax = max ? parseDateText(max) : null;

  let minParts =
    explicitMin ?? { year: now.year - DEFAULT_DATE_YEAR_SPAN, month: 1, day: 1 };
  let maxParts =
    explicitMax ?? { year: now.year + DEFAULT_DATE_YEAR_SPAN, month: 12, day: 31 };

  if (!explicitMin || !explicitMax) {
    (values ?? []).forEach((text) => {
      const parts = parseLooseDateText(text);
      if (!parts) return;
      if (!explicitMin && compareParts(parts, minParts) < 0) minParts = parts;
      if (!explicitMax && compareParts(parts, maxParts) > 0) maxParts = parts;
    });
  }

  if (compareParts(minParts, maxParts) > 0) return { min: maxParts, max: minParts };
  return { min: minParts, max: maxParts };
}

/**
 * 某一列在当前上下文下可选的数值区间 [start, end]。
 * 年 / 月 / 日三级都要看**更粗的那一级是否正好压在边界上**：
 * 只有当年份等于 minParts.year 时，月份才从 minParts.month 起。
 */
export function resolveColumnRange(
  key: DateColumnKey,
  parts: DateParts,
  min: DateParts,
  max: DateParts,
): [number, number] {
  if (key === 'year') return [min.year, max.year];

  if (key === 'month') {
    const start = parts.year === min.year ? min.month : 1;
    const end = parts.year === max.year ? max.month : 12;
    return start <= end ? [start, end] : [1, 12];
  }

  const start =
    parts.year === min.year && parts.month === min.month ? min.day : 1;
  const end =
    parts.year === max.year && parts.month === max.month
      ? max.day
      : daysInMonth(parts.year, parts.month);
  return start <= end ? [start, end] : [1, daysInMonth(parts.year, parts.month)];
}

/** 展开成列数据 */
export function buildColumnValues(
  key: DateColumnKey,
  parts: DateParts,
  min: DateParts,
  max: DateParts,
): number[] {
  const [start, end] = resolveColumnRange(key, parts, min, max);
  const values: number[] = [];
  for (let value = start; value <= end; value += 1) values.push(value);
  return values;
}

/** 某一天是否落在闭区间 [start, end] 内 */
export function isPartsInRange(parts: DateParts, start: DateParts, end: DateParts): boolean {
  const [from, to] = compareParts(start, end) <= 0 ? [start, end] : [end, start];
  return compareParts(parts, from) >= 0 && compareParts(parts, to) <= 0;
}

/* ------------------------------------------------------------------ *
 * 列裁剪与格式联动
 * ------------------------------------------------------------------ */

export function resolveColumns(columnsType?: DateColumnKey[]): DateColumnKey[] {
  if (!columnsType || columnsType.length === 0) return DEFAULT_DATE_COLUMNS;
  // 去重并固定成「年 → 月 → 日」的顺序：滚轮列的先后不该由调用方的数组顺序决定
  return DEFAULT_DATE_COLUMNS.filter((key) => columnsType.includes(key));
}

/** 没显式给 format 时，按实际展示的列推出一个（YYYY-MM / MM-DD / YYYY …） */
export function defaultFormatForColumns(columns: DateColumnKey[]): string {
  const template: Record<DateColumnKey, string> = { year: 'YYYY', month: 'MM', day: 'DD' };
  const parts = columns.map((key) => template[key]);
  return parts.length > 0 ? parts.join('-') : DEFAULT_DATE_FORMAT;
}

/**
 * 由文本还原出「当前光标日期」—— 也就是滚轮打开时停在哪个值。
 * 列被裁剪时缺失的字段补默认值：月日补 1，年缺省则取今天所在年并夹进可选范围。
 *
 * ⚠️ **完全没有值时必须落到「今天」**，不是「今年 1 月 1 日」。
 * 这两者只差一个字段，但在 12 个月里有 11 个月都表现为「打开后还得从 1 月滚到当前月」，
 * 而且单值形态因为分发层预填了今天而完全看不出来 —— 只在区间模式与列裁剪形态露头。
 * 区间模式的两段式草稿恒以 '' 开场，所以这条路径是它的**主路径**，不是边界。
 */
export function resolveCursor(
  text: string | undefined,
  columns: DateColumnKey[],
  min: DateParts,
  max: DateParts,
): DateParts {
  const now = todayParts();
  const parsed = text ? parseDateTextForColumns(text, columns) : null;
  // 无值 → 今天（列裁剪的补位在下面几行处理，不在这里预先清月清日）
  const cursor: DateParts = parsed ?? { ...now };

  if (!columns.includes('year')) {
    cursor.year = Math.min(Math.max(now.year, min.year), max.year);
  }
  if (!columns.includes('month')) cursor.month = 1;
  if (!columns.includes('day')) cursor.day = 1;

  return clampParts(cursor, min, max);
}

/* ------------------------------------------------------------------ *
 * 值的归一化
 * ------------------------------------------------------------------ */

/** 把宽松入参（单值 / 元组 / undefined）规范成内部统一的字符串数组 */
export function toDateArray(value: DatePickerValue, type: DatePickerType): string[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return type === 'range' ? value.slice(0, 2) : value.slice(0, 1);
  }
  return [value];
}

/**
 * 区间两端排序并校验完整性。
 * 两端解析失败或顺序颠倒时由这里收口，避免「上午当选到下午」的区间流到 onChange。
 */
export function orderDateTexts(
  a: string | undefined,
  b: string | undefined,
  columns: DateColumnKey[] = DEFAULT_DATE_COLUMNS,
): DateRangeValue | null {
  if (!a || !b) return null;
  const left = parseDateTextForColumns(a, columns);
  const right = parseDateTextForColumns(b, columns);
  if (!left || !right) return null;
  return compareParts(left, right) <= 0 ? [a, b] : [b, a];
}

/** 由内部数组还原成对外类型：单值给字符串，区间给有序元组 */
export function toPickerValue(list: string[], type: DatePickerType): DatePickerValue {
  if (type === 'range') return orderDateTexts(list[0], list[1]) ?? undefined;
  return list[0];
}

/* ------------------------------------------------------------------ *
 * 周边界（PC 的 Home / End 键用，纯函数便于单测）
 *
 * 月历网格本身已交给 react-day-picker（见 components/pc/date-picker.tsx），
 * 曾经的 buildMonthGrid / CalendarCell / weekdayLabels 因此删除：
 * 留着的「纯函数」如果没人调用，就只是看起来像资产的技术债。
 * ------------------------------------------------------------------ */

/** 周首/周末（Home / End 键与拖选预览共用同一套边界定义） */
export function weekBounds(parts: DateParts, weekStart = 1): { start: DateParts; end: DateParts } {
  const weekday = new Date(parts.year, parts.month - 1, parts.day).getDay();
  const lead = (weekday - weekStart + 7) % 7;
  const start = addDays(parts, -lead);
  return { start, end: addDays(start, 6) };
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UseDateValueOptions {
  value?: DatePickerValue;
  defaultValue?: DatePickerValue;
  onChange?: (value: DatePickerValue) => void;
  type?: DatePickerType;
  min?: string;
  max?: string;
  format?: string;
}

export interface UseDateValueResult {
  type: DatePickerType;
  format: string;
  /** 规范化为字符串数组的已提交值（单值 0/1 项、区间 0/2 项） */
  selected: string[];
  /** 已提交值的日期化结果（解析失败的项被丢弃） */
  selectedParts: DateParts[];
  minParts: DateParts;
  maxParts: DateParts;
  filled: boolean;
  /** 触发器回显文案 */
  displayText: string;
  setValue: (next: DatePickerValue) => void;
  clear: () => void;
}

export function useDateValue({
  value,
  defaultValue,
  onChange,
  type = 'single',
  min,
  max,
  format = DEFAULT_DATE_FORMAT,
}: UseDateValueOptions): UseDateValueResult {
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<DatePickerValue>(defaultValue);
  const current = isControlled ? value : innerValue;

  const selected = React.useMemo(() => toDateArray(current, type), [current, type]);

  const selectedParts = React.useMemo(
    () =>
      selected
        .map((text) => parseLooseDateText(text))
        .filter((parts): parts is DateParts => parts !== null),
    [selected],
  );

  /**
   * 默认范围要**看见已提交的值**，否则外部把 value 设成 2020-01-01（超出今天 ±10 年）时，
   * 滚轮会打开在 2016 年那一端，用户以为值丢了。
   */
  const bounds = React.useMemo(
    () => resolveDateBounds({ min, max, values: selected }),
    [min, max, selected],
  );

  const setValue = React.useCallback(
    (next: DatePickerValue) => {
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
    if (type === 'range') return selected.join(DATE_RANGE_SEPARATOR);
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
