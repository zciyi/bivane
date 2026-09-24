import { describe, expect, it } from 'vitest';
import {
  buildColumnValues,
  clampParts,
  compareParts,
  defaultFormatForColumns,
  parseBoundText,
  parseDateTimeText,
  parseDateTimeTextForColumns,
  resolveColumns,
  resolveCursor,
  resolveDateTimeBounds,
  type DateTimeParts,
} from '@/hooks/use-datetime-value';

/**
 * DateTimePicker 值逻辑纯函数测试。
 * 重点是跨字段边界：min/max 是完整时刻，时列的可选范围依赖日期是否压在边界上；
 * 以及三档精度（年月日时 / 时分 / 时分秒）的列归一与格式联动。
 */

const ALL = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;
const HOUR_COLUMNS = ['year', 'month', 'day', 'hour'] as const;
const MINUTE_COLUMNS = ['year', 'month', 'day', 'hour', 'minute'] as const;

function p(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): DateTimeParts {
  return { year, month, day, hour, minute, second };
}

describe('resolveColumns / defaultFormatForColumns', () => {
  it('默认全 6 列，三档预设按序归一', () => {
    expect(resolveColumns()).toEqual([...ALL]);
    expect(resolveColumns(HOUR_COLUMNS.slice())).toEqual([...HOUR_COLUMNS]);
    expect(resolveColumns(MINUTE_COLUMNS.slice())).toEqual([...MINUTE_COLUMNS]);
  });

  it('缺日期列、或时间列不从时连续，一律回落全 6 列（不静默渲染残缺选择器）', () => {
    expect(resolveColumns(['year', 'month', 'hour'])).toEqual([...ALL]);
    expect(resolveColumns(['year', 'month', 'day', 'hour', 'second'])).toEqual([
      ...HOUR_COLUMNS,
    ]);
    expect(resolveColumns(['year', 'month', 'day', 'minute'])).toEqual([
      ...ALL,
    ]);
  });

  it('格式随列走：年月日时 / 时分 / 时分秒三档', () => {
    expect(defaultFormatForColumns([...HOUR_COLUMNS])).toBe('YYYY-MM-DD HH');
    expect(defaultFormatForColumns([...MINUTE_COLUMNS])).toBe('YYYY-MM-DD HH:mm');
    expect(defaultFormatForColumns([...ALL])).toBe('YYYY-MM-DD HH:mm:ss');
  });
});

describe('parseDateTimeText', () => {
  it('解析标准 / 中文 / T 分隔，缺省秒分补 0', () => {
    expect(parseDateTimeText('2026-09-24 09:30:45')).toEqual(
      p(2026, 9, 24, 9, 30, 45),
    );
    expect(parseDateTimeText('2026/9/24 9:30')).toEqual(p(2026, 9, 24, 9, 30));
    expect(parseDateTimeText('2026年9月24日 9')).toEqual(p(2026, 9, 24, 9));
    expect(parseDateTimeText('2026-09-24T09:30')).toEqual(p(2026, 9, 24, 9, 30));
    expect(parseDateTimeText('2026-09-24')).toEqual(p(2026, 9, 24));
  });

  it('非法日期 / 时间返回 null', () => {
    expect(parseDateTimeText('2026-13-24 09:00:00')).toBeNull();
    expect(parseDateTimeText('2026-02-30 09:00:00')).toBeNull();
    expect(parseDateTimeText('2026-09-24 25:00:00')).toBeNull();
    expect(parseDateTimeText('abc')).toBeNull();
  });
});

describe('parseBoundText：边界缺时间位的补位方向', () => {
  it('min 缺位补 0，max 缺位补 59', () => {
    expect(parseBoundText('2026-09-24', 'min')).toEqual(p(2026, 9, 24, 0, 0, 0));
    expect(parseBoundText('2026-09-24', 'max')).toEqual(p(2026, 9, 24, 23, 59, 59));
    expect(parseBoundText('2026-09-24 09:30', 'max')).toEqual(
      p(2026, 9, 24, 9, 30, 59),
    );
    expect(parseBoundText('2026-09-24 09:30', 'min')).toEqual(
      p(2026, 9, 24, 9, 30, 0),
    );
  });

  it('按列解析时，不在列中的时间字段补 0', () => {
    expect(parseDateTimeTextForColumns('2026-09-24 09', [...HOUR_COLUMNS])).toEqual(
      p(2026, 9, 24, 9, 0, 0),
    );
  });
});

describe('compareParts', () => {
  it('按年→秒逐级比较', () => {
    expect(compareParts(p(2026, 9, 24, 9), p(2026, 9, 24, 10))).toBeLessThan(0);
    expect(compareParts(p(2026, 9, 24, 9, 30), p(2026, 9, 24, 9, 29))).toBeGreaterThan(0);
    expect(compareParts(p(2026, 9, 24, 9, 30, 0), p(2026, 9, 24, 9, 30, 0))).toBe(0);
  });
});

describe('buildColumnValues / resolveColumnRange：跨日期的时间边界', () => {
  const min = p(2026, 9, 24, 9, 0, 0);
  const max = p(2026, 9, 26, 18, 30, 0);

  it('min 当天小时列从 9 起；其它日期全天 0~23', () => {
    expect(buildColumnValues('hour', p(2026, 9, 24, 12), min, max)[0]).toBe(9);
    expect(buildColumnValues('hour', p(2026, 9, 25, 12), min, max)).toEqual(
      Array.from({ length: 24 }, (_, i) => i),
    );
    expect(buildColumnValues('hour', p(2026, 9, 26, 12), min, max).at(-1)).toBe(18);
  });

  it('边界当天的分钟列随小时收紧', () => {
    // 9 点整压在 min 上：分钟从 0 起；8 点不在可选域（会被小时级先夹走），列仍给 0~59
    expect(buildColumnValues('minute', p(2026, 9, 24, 9), min, max)[0]).toBe(0);
    // 18:30 压在 max：分钟到 30 止
    expect(buildColumnValues('minute', p(2026, 9, 26, 18), min, max).at(-1)).toBe(30);
    expect(buildColumnValues('minute', p(2026, 9, 25, 10), min, max).at(-1)).toBe(59);
  });

  it('日期列联动：闰年 2 月给 29 天，平年 28 天', () => {
    expect(buildColumnValues('day', p(2024, 2, 1), p(2000, 1, 1), p(2099, 12, 31)).at(-1)).toBe(29);
    expect(buildColumnValues('day', p(2026, 2, 1), p(2000, 1, 1), p(2099, 12, 31)).at(-1)).toBe(28);
  });
});

describe('clampParts：逐字段级联', () => {
  const min = p(2026, 9, 24, 9, 0, 0);
  const max = p(2026, 9, 26, 18, 30, 30);

  it('越界的时间字段只夹该级，不整体跳回边界时刻', () => {
    // min 当天 8 点 → 只把小时抬到 9，分秒保留
    expect(clampParts(p(2026, 9, 24, 8, 15, 45), min, max)).toEqual(
      p(2026, 9, 24, 9, 15, 45),
    );
    // max 当天 19 点 → 小时压到 18，分钟超出 30 再压到 30，秒同理
    expect(clampParts(p(2026, 9, 26, 19, 45, 50), min, max)).toEqual(
      p(2026, 9, 26, 18, 30, 30),
    );
  });

  it('换月时日期夹到月末（1/31 → 2/28）', () => {
    expect(clampParts(p(2026, 1, 31, 10), p(2000, 1, 1), p(2099, 12, 31))).toEqual(
      p(2026, 1, 31, 10),
    );
    // 把月份改成 2 后再夹（滚轮改月走的就是这条路径）
    expect(clampParts(p(2026, 2, 31, 10), p(2000, 1, 1), p(2099, 12, 31)).day).toBe(28);
  });
});

describe('resolveDateTimeBounds', () => {
  it('显式边界是硬边界；纯日期 max 补到当天最晚', () => {
    const { min: lo, max: hi } = resolveDateTimeBounds({
      min: '2026-09-24 09:00:00',
      max: '2026-09-26',
    });
    expect(lo).toEqual(p(2026, 9, 24, 9, 0, 0));
    expect(hi).toEqual(p(2026, 9, 26, 23, 59, 59));
  });

  it('默认范围被已选值向外撑开，但显式边界不被撑开', () => {
    const expanded = resolveDateTimeBounds({ values: ['2000-01-01 08:00:00'] });
    expect(expanded.min.year).toBe(2000);

    const fixed = resolveDateTimeBounds({
      min: '2026-01-01 00:00:00',
      values: ['2000-01-01 08:00:00'],
    });
    expect(fixed.min.year).toBe(2026);
  });
});

describe('resolveCursor', () => {
  it('无值落「此刻」而不是元旦午夜；缺列补 0 并夹紧', () => {
    const cursor = resolveCursor(
      undefined,
      [...ALL],
      p(2000, 1, 1),
      p(2099, 12, 31, 23, 59, 59),
    );
    const now = new Date();
    expect(cursor.year).toBe(now.getFullYear());
    expect(cursor.month).toBe(now.getMonth() + 1);
    expect(cursor.day).toBe(now.getDate());
    expect(cursor.hour).toBe(now.getHours());

    // 时精度：分秒恒 0
    const hourOnly = resolveCursor('2026-09-24 09', [...HOUR_COLUMNS], p(2000, 1, 1), p(2099, 12, 31, 23));
    expect(hourOnly).toEqual(p(2026, 9, 24, 9, 0, 0));
  });
});
