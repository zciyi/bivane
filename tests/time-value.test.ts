import { describe, expect, it } from 'vitest';
import {
  buildColumnValues,
  clampParts,
  compareParts,
  defaultFormatForColumns,
  formatParts,
  isPartsInRange,
  nowParts,
  orderTimeTexts,
  pad2,
  parseTimeText,
  parseTimeTextForColumns,
  resolveColumnRange,
  resolveColumns,
  resolveCursor,
  resolveTimeBounds,
  toTimeArray,
  toPickerValue,
  type TimeParts,
} from '@/hooks/use-time-value';

/**
 * 时间值逻辑单测（矩阵 §4 要求：两模式各 1 个行为测试「选值 + 边界」）
 *
 * 为什么这层必须单独测：
 * jsdom 不做布局，滚轮永远不会真的滚动、listbox 也不会真的滚动 ——
 * DOM 测试只能覆盖「点这一项会回调什么」，覆盖不到
 * 「跨午夜边界」「列裁剪」「逐字段夹紧」这类纯计算边界。这些恰恰是时间控件最常出问题的地方。
 *
 * 与 DatePicker 同族：本文件只测时间计算，组件交互留给 time-picker.test.tsx。
 */

const T = (hour: number, minute = 0, second = 0): TimeParts => ({ hour, minute, second });

describe('基础时间计算', () => {
  it('pad2 补零', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(5)).toBe('05');
    expect(pad2(23)).toBe('23');
  });

  it('compareParts 按时 → 分 → 秒比较', () => {
    expect(compareParts(T(10, 30), T(10, 31))).toBeLessThan(0);
    expect(compareParts(T(11, 0), T(10, 59, 59))).toBeGreaterThan(0);
    expect(compareParts(T(10, 30, 0), T(10, 30, 0))).toBe(0);
  });
});

describe('clampParts · 逐字段夹紧', () => {
  const min = T(8, 30, 0);
  const max = T(20, 45, 30);

  it('早于下界时把越界的时抬到边界，且落到 min.hour 时分钟被抬到 min.minute', () => {
    // 07:00:00 的时 < 8 → 时抬到 8；落到 08 后分钟仍低于 min.minute(30) → 分钟也抬到 30。
    // 与 DatePicker 的「月=min.month 时日被夹」同一级联逻辑：最早合法时间就是 08:30:00。
    expect(clampParts(T(7, 0, 0), min, max)).toEqual(T(8, 30, 0));
  });

  it('正好压在下界分钟上时，秒也要被抬起', () => {
    expect(clampParts(T(8, 20, 0), min, max)).toEqual(T(8, 30, 0));
  });

  it('晚于上界时同理逐字段夹', () => {
    expect(clampParts(T(21, 0, 0), min, max)).toEqual(T(20, 0, 0));
    expect(clampParts(T(20, 50, 0), min, max)).toEqual(T(20, 45, 0));
  });

  it('分钟/秒在小时未压边界时各自取满量程', () => {
    expect(resolveColumnRange('minute', T(12, 0, 0), min, max)).toEqual([0, 59]);
    expect(resolveColumnRange('second', T(12, 30, 0), min, max)).toEqual([0, 59]);
  });
});

describe('格式化与解析', () => {
  it('formatParts 支持 6 个 token', () => {
    const parts = T(10, 5, 9);
    expect(formatParts(parts)).toBe('10:05:09');
    expect(formatParts(parts, 'HH时mm分')).toBe('10时05分');
    expect(formatParts(parts, 'H:m:s')).toBe('10:5:9');
    // 不含 token 的格式原样返回（不吞掉字面量）
    expect(formatParts(parts, '时间：HH')).toBe('时间：10');
  });

  it('parseTimeText 接受多种分隔符与紧凑写法', () => {
    expect(parseTimeText('10:30:00')).toEqual(T(10, 30, 0));
    expect(parseTimeText('10：30：00')).toEqual(T(10, 30, 0));
    expect(parseTimeText('10.30.00')).toEqual(T(10, 30, 0));
    expect(parseTimeText('10:30')).toEqual(T(10, 30, 0));
    expect(parseTimeText('103000')).toEqual(T(10, 30, 0));
    expect(parseTimeText('  10:30:00  ')).toEqual(T(10, 30, 0));
  });

  it('parseTimeText 拒绝非法时间（而不是悄悄进位）', () => {
    expect(parseTimeText('25:00:00')).toBeNull();
    expect(parseTimeText('10:60:00')).toBeNull();
    expect(parseTimeText('10:30:60')).toBeNull();
    expect(parseTimeText('')).toBeNull();
    expect(parseTimeText('中午')).toBeNull();
  });

  it('parseTimeTextForColumns 按列配置补默认值', () => {
    expect(parseTimeTextForColumns('10:30', ['hour', 'minute'])).toEqual(T(10, 30, 0));
    expect(parseTimeTextForColumns('10', ['hour'])).toEqual(T(10, 0, 0));
    expect(parseTimeTextForColumns('25', ['hour'])).toBeNull();
  });
});

describe('可选范围', () => {
  it('默认范围是全天 00:00:00 ~ 23:59:59（含秒时到 59）', () => {
    const { min, max } = resolveTimeBounds({});
    expect(min).toEqual(T(0, 0, 0));
    expect(max).toEqual(T(23, 59, 59));
  });

  it('列裁剪到不含秒时，上界秒为 0', () => {
    const { max } = resolveTimeBounds({ columns: ['hour', 'minute'] });
    expect(max).toEqual(T(23, 59, 0));
  });

  it('显式 min/max 优先生效', () => {
    const { min, max } = resolveTimeBounds({ min: '08:30:00', max: '20:45:30' });
    expect(min).toEqual(T(8, 30, 0));
    expect(max).toEqual(T(20, 45, 30));
  });

  it('显式 min/max 是硬边界，不会被越界的已选值撑开', () => {
    const { min, max } = resolveTimeBounds({
      min: '08:00:00',
      max: '20:00:00',
      values: ['00:00:00', '23:00:00'],
    });
    expect(min).toEqual(T(8, 0, 0));
    expect(max).toEqual(T(20, 0, 0));
  });
});

describe('列数据生成', () => {
  const min = T(8, 30, 0);
  const max = T(20, 45, 30);

  it('时列在边界年内取 [min.hour, max.hour]', () => {
    expect(resolveColumnRange('hour', T(12, 0, 0), min, max)).toEqual([8, 20]);
  });

  it('分列在 hour 压到下界时从 min.minute 起，压到上界时到 max.minute 止', () => {
    expect(resolveColumnRange('minute', T(8, 40, 0), min, max)).toEqual([30, 59]);
    expect(resolveColumnRange('minute', T(20, 40, 0), min, max)).toEqual([0, 45]);
    expect(resolveColumnRange('minute', T(12, 40, 0), min, max)).toEqual([0, 59]);
  });

  it('秒列同理逐级裁', () => {
    expect(resolveColumnRange('second', T(8, 30, 40), min, max)).toEqual([0, 59]);
    expect(resolveColumnRange('second', T(20, 45, 40), min, max)).toEqual([0, 30]);
  });

  it('buildColumnValues 展开成连续序列', () => {
    expect(buildColumnValues('hour', T(12, 0, 0), min, max)).toEqual([
      8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(buildColumnValues('minute', T(12, 0, 0), min, max)).toHaveLength(60);
    expect(buildColumnValues('second', T(20, 45, 0), min, max)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });

  it('isPartsInRange 对调换过的端点同样成立', () => {
    expect(isPartsInRange(T(12, 0, 0), T(10, 0, 0), T(14, 0, 0))).toBe(true);
    expect(isPartsInRange(T(12, 0, 0), T(14, 0, 0), T(10, 0, 0))).toBe(true);
    expect(isPartsInRange(T(16, 0, 0), T(10, 0, 0), T(14, 0, 0))).toBe(false);
  });
});

describe('列裁剪与光标还原', () => {
  it('resolveColumns 去重并固定成「时→分→秒」顺序', () => {
    expect(resolveColumns(undefined)).toEqual(['hour', 'minute', 'second']);
    expect(resolveColumns([])).toEqual(['hour', 'minute', 'second']);
    expect(resolveColumns(['minute', 'hour'])).toEqual(['hour', 'minute']);
    expect(resolveColumns(['second', 'second'])).toEqual(['second']);
  });

  it('defaultFormatForColumns 跟随实际列', () => {
    expect(defaultFormatForColumns(['hour', 'minute', 'second'])).toBe('HH:mm:ss');
    expect(defaultFormatForColumns(['hour', 'minute'])).toBe('HH:mm');
    expect(defaultFormatForColumns(['hour'])).toBe('HH');
    expect(defaultFormatForColumns([])).toBe('HH:mm:ss');
  });

  it('resolveCursor 还原被裁剪的值（缺字段补 0）', () => {
    const min = T(0, 0, 0);
    const max = T(23, 59, 59);
    expect(resolveCursor('10:30:00', ['hour', 'minute', 'second'], min, max)).toEqual(
      T(10, 30, 0),
    );
    expect(resolveCursor('10:30', ['hour', 'minute'], min, max)).toEqual(T(10, 30, 0));
    expect(resolveCursor('08', ['hour'], min, max)).toEqual(T(8, 0, 0));
  });

  it('完全没有值时落到「现在」而不是 00:00:00（缺陷修正一号的时间版）', () => {
    const min = T(0, 0, 0);
    const max = T(23, 59, 59);
    const cursor = resolveCursor(undefined, ['hour', 'minute', 'second'], min, max);
    // 与 resolveCursor 内部同一时刻取 now，二者一致即证明走了「现在」路径
    expect(cursor).toEqual(nowParts());
    // 列裁剪：缺的字段补 0，但已列的字段带现在的值
    const hourOnly = resolveCursor(undefined, ['hour'], min, max);
    expect(hourOnly).toEqual(T(nowParts().hour, 0, 0));
  });

  it('最小值非 0 时点选落点仍被夹紧到 min 之内', () => {
    const min = T(8, 0, 0);
    const max = T(20, 0, 0);
    const cursor = resolveCursor(undefined, ['hour', 'minute', 'second'], min, max);
    expect(compareParts(cursor, min)).toBeGreaterThanOrEqual(0);
    expect(compareParts(cursor, max)).toBeLessThanOrEqual(0);
  });
});

describe('值的归一化', () => {
  it('toTimeArray 单值取一项、区间取两项', () => {
    expect(toTimeArray(undefined, 'single')).toEqual([]);
    expect(toTimeArray('10:30:00', 'single')).toEqual(['10:30:00']);
    expect(toTimeArray(['10:30:00', '18:45:00'], 'range')).toEqual([
      '10:30:00',
      '18:45:00',
    ]);
    // 单值形态下误传数组只取第一项
    expect(toTimeArray(['a', 'b'], 'single')).toEqual(['a']);
  });

  it('orderTimeTexts 排序并在缺项时返回 null', () => {
    expect(orderTimeTexts('18:45:00', '10:30:00')).toEqual(['10:30:00', '18:45:00']);
    expect(orderTimeTexts('10:30:00', '18:45:00')).toEqual(['10:30:00', '18:45:00']);
    // 区间的「大小」按时间本身判定，不靠字符串字典序
    expect(orderTimeTexts('09:00:00', '10:00:00')).toEqual(['09:00:00', '10:00:00']);
    expect(orderTimeTexts('10:30:00', '')).toBeNull();
    expect(orderTimeTexts('', '')).toBeNull();
    expect(orderTimeTexts('乱写', '10:30:00')).toBeNull();
  });

  it('toPickerValue 单值给字符串、区间给有序元组', () => {
    expect(toPickerValue([], 'single')).toBeUndefined();
    expect(toPickerValue(['10:30:00'], 'single')).toBe('10:30:00');
    expect(toPickerValue(['18:45:00', '10:30:00'], 'range')).toEqual([
      '10:30:00',
      '18:45:00',
    ]);
    // 半截区间不对外输出
    expect(toPickerValue(['10:30:00', ''], 'range')).toBeUndefined();
  });
});
