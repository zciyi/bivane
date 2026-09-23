import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  buildColumnValues,
  clampParts,
  compareParts,
  defaultFormatForColumns,
  daysInMonth,
  formatParts,
  isPartsInRange,
  orderDateTexts,
  parseDateText,
  parseDateTextForColumns,
  parseLooseDateText,
  resolveColumnRange,
  resolveColumns,
  resolveCursor,
  resolveDateBounds,
  toDateArray,
  toPickerValue,
  todayParts,
  weekBounds,
  type DateParts,
} from '@/hooks/use-date-value';
import {
  alignOffset,
  alignTargetIfNeeded,
  clampIndex,
  nearestIndex,
  wheelPadding,
} from '@/hooks/use-picker-column';

/**
 * 日期值逻辑单测（矩阵 §4 要求：两模式各 1 个行为测试「选值 + 边界」）
 *
 * 为什么这层必须单独测：
 * jsdom 不做布局，滚轮永远不会真的滚动、月历也不会真的换行 ——
 * DOM 测试只能覆盖「点这一格会回调什么」，覆盖不到
 * 「闰年 2 月 29 日」「换月后 31 日要被夹到 28 日」「min 那一年的月份从 min.month 起」
 * 这类纯计算边界。这些恰恰是日期控件最常出线上问题的地方。
 */

const D = (year: number, month: number, day: number): DateParts => ({ year, month, day });

describe('基础日期计算', () => {
  it('daysInMonth 处理闰年', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('compareParts 按年 → 月 → 日比较', () => {
    expect(compareParts(D(2026, 9, 20), D(2026, 9, 21))).toBeLessThan(0);
    expect(compareParts(D(2026, 10, 1), D(2026, 9, 30))).toBeGreaterThan(0);
    expect(compareParts(D(2026, 9, 20), D(2026, 9, 20))).toBe(0);
  });

  it('addDays 跨月跨年', () => {
    expect(addDays(D(2026, 12, 31), 1)).toEqual(D(2027, 1, 1));
    expect(addDays(D(2026, 3, 1), -1)).toEqual(D(2026, 2, 28));
    expect(addDays(D(2024, 3, 1), -1)).toEqual(D(2024, 2, 29));
  });

  it('addMonths 把超出的日夹到月末（1/31 + 1 月 = 2/28）', () => {
    expect(addMonths(D(2026, 1, 31), 1)).toEqual(D(2026, 2, 28));
    expect(addMonths(D(2024, 1, 31), 1)).toEqual(D(2024, 2, 29));
    expect(addMonths(D(2026, 12, 15), 1)).toEqual(D(2027, 1, 15));
    expect(addMonths(D(2026, 1, 15), -1)).toEqual(D(2025, 12, 15));
  });
});

describe('clampParts · 逐字段夹紧', () => {
  const min = D(2026, 3, 10);
  const max = D(2026, 9, 20);

  it('早于下界时只把越界的那一级抬到边界，而不是整体跳回下界日期', () => {
    // 关键行为：2026-02-28 只把「月」抬到 3，日保持 28 ——
    // 整体退回边界会让用户在滚轮上多滚一格就跳到 3/10，手感像卡住
    expect(clampParts(D(2026, 2, 28), min, max)).toEqual(D(2026, 3, 28));
  });

  it('正好压在下界月份上时，日也要被抬起', () => {
    expect(clampParts(D(2026, 3, 5), min, max)).toEqual(D(2026, 3, 10));
  });

  it('晚于上界时同理', () => {
    expect(clampParts(D(2026, 11, 5), min, max)).toEqual(D(2026, 9, 5));
    expect(clampParts(D(2026, 9, 25), min, max)).toEqual(D(2026, 9, 20));
  });

  it('刚好在范围外的年份只把年份抬到边界年，月日各自判一次', () => {
    // 2010-06-01 抬年份后是 2026-06-01 —— 它**本来就在范围内**，不该再动月日
    expect(clampParts(D(2010, 6, 1), min, max)).toEqual(D(2026, 6, 1));
    expect(clampParts(D(2030, 6, 1), min, max)).toEqual(D(2026, 6, 1));
    // 2010-11-01 抬年份后月份越界，月份再被夹到 max.month
    expect(clampParts(D(2010, 11, 1), min, max)).toEqual(D(2026, 9, 1));
  });

  it('月份天数变化后把日夹到月末', () => {
    const looseMin = D(2000, 1, 1);
    const looseMax = D(2099, 12, 31);
    expect(clampParts(D(2026, 2, 31), looseMin, looseMax)).toEqual(D(2026, 2, 28));
    expect(clampParts(D(2024, 2, 31), looseMin, looseMax)).toEqual(D(2024, 2, 29));
  });
});

describe('格式化与解析', () => {
  it('formatParts 支持 6 个 token', () => {
    const parts = D(2026, 9, 5);
    expect(formatParts(parts)).toBe('2026-09-05');
    expect(formatParts(parts, 'YYYY/MM/DD')).toBe('2026/09/05');
    expect(formatParts(parts, 'YYYY年M月D日')).toBe('2026年9月5日');
    expect(formatParts(parts, 'YY-M-D')).toBe('26-9-5');
    // 不含 token 的格式原样返回（不吞掉字面量）
    expect(formatParts(parts, '日期：YYYY')).toBe('日期：2026');
  });

  it('parseDateText 接受多种分隔符', () => {
    expect(parseDateText('2026-09-20')).toEqual(D(2026, 9, 20));
    expect(parseDateText('2026/9/20')).toEqual(D(2026, 9, 20));
    expect(parseDateText('2026.09.20')).toEqual(D(2026, 9, 20));
    expect(parseDateText('2026年9月20日')).toEqual(D(2026, 9, 20));
    expect(parseDateText('20260920')).toEqual(D(2026, 9, 20));
    expect(parseDateText('  2026-09-20  ')).toEqual(D(2026, 9, 20));
  });

  it('parseDateText 拒绝非法日期（而不是悄悄进位）', () => {
    expect(parseDateText('2025-02-30')).toBeNull();
    expect(parseDateText('2026-13-01')).toBeNull();
    expect(parseDateText('2026-00-10')).toBeNull();
    expect(parseDateText('2026-09-00')).toBeNull();
    expect(parseDateText('')).toBeNull();
    expect(parseDateText('明天')).toBeNull();
    // 闰年边界：2024 有 2/29，2025 没有
    expect(parseDateText('2024-02-29')).toEqual(D(2024, 2, 29));
    expect(parseDateText('2025-02-29')).toBeNull();
  });

  it('parseLooseDateText 还原「列被裁剪」后的值', () => {
    expect(parseLooseDateText('2026-09')).toEqual(D(2026, 9, 1));
    expect(parseLooseDateText('2026')).toEqual(D(2026, 1, 1));
    // 完整日期优先走 parseDateText
    expect(parseLooseDateText('2026-09-20')).toEqual(D(2026, 9, 20));
    expect(parseLooseDateText('没什么')).toBeNull();
  });

  it('parseDateTextForColumns 按列配置还原年月与年份', () => {
    expect(parseDateTextForColumns('2026-09', ['year', 'month'])).toEqual(D(2026, 9, 1));
    expect(parseDateTextForColumns('2026年09月', ['year', 'month'])).toEqual(D(2026, 9, 1));
    expect(parseDateTextForColumns('2027', ['year'])).toEqual(D(2027, 1, 1));
    expect(parseDateTextForColumns('2026-13', ['year', 'month'])).toBeNull();
  });
});

describe('可选范围', () => {
  it('默认范围是今天前后各 10 年', () => {
    const now = todayParts();
    const { min, max } = resolveDateBounds({});
    expect(min).toEqual(D(now.year - 10, 1, 1));
    expect(max).toEqual(D(now.year + 10, 12, 31));
  });

  it('显式 min/max 优先生效', () => {
    const { min, max } = resolveDateBounds({ min: '2026-03-10', max: '2026-09-20' });
    expect(min).toEqual(D(2026, 3, 10));
    expect(max).toEqual(D(2026, 9, 20));
  });

  it('已提交值落在默认范围外时把范围**向外扩张**，而不是夹走已选值', () => {
    // 这条是「值没变但显示变了」那类最难解释的 bug 的防线：
    // 外部把 value 设成 2000 年，滚轮必须打开在 2000 年而不是 2016 年
    const { min, max } = resolveDateBounds({ values: ['2000-05-06'] });
    expect(min).toEqual(D(2000, 5, 6));
    expect(compareParts(max, D(2026, 12, 31))).toBeGreaterThan(0);
  });

  it('显式 min/max 是硬边界，不会被越界的已选值撑开', () => {
    // 调用方自己给了边界就说明约束是业务要求，不能因为「值越界」就把边界悄悄放开
    const { min, max } = resolveDateBounds({
      min: '2026-01-01',
      max: '2026-12-31',
      values: ['2000-05-06', '2099-01-01'],
    });
    expect(min).toEqual(D(2026, 1, 1));
    expect(max).toEqual(D(2026, 12, 31));
  });
});

describe('列数据生成', () => {
  const min = D(2026, 3, 10);
  const max = D(2026, 9, 20);

  it('min 所在年份的月份从 min.month 起，max 所在年份到 max.month 止', () => {
    expect(resolveColumnRange('month', D(2026, 5, 1), min, max)).toEqual([3, 9]);
    // 严格夹在中间的年份是完整 1~12 月
    expect(resolveColumnRange('month', D(2028, 5, 1), min, max)).toEqual([1, 12]);
  });

  it('日列在边界月份被裁到边界日，其余月份取当月天数', () => {
    expect(resolveColumnRange('day', D(2026, 3, 15), min, max)).toEqual([10, 31]);
    expect(resolveColumnRange('day', D(2026, 9, 15), min, max)).toEqual([1, 20]);
    expect(resolveColumnRange('day', D(2026, 6, 15), min, max)).toEqual([1, 30]);
  });

  it('buildColumnValues 展开成连续序列', () => {
    expect(buildColumnValues('year', D(2026, 3, 15), min, max)).toEqual([2026]);
    expect(buildColumnValues('month', D(2026, 3, 15), min, max)).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(buildColumnValues('day', D(2024, 2, 15), D(2024, 1, 1), D(2024, 12, 31))).toHaveLength(
      29,
    );
  });

  it('日列随年份与月份联动（2 月天数变了，列长度跟着变）', () => {
    const loose = { min: D(2020, 1, 1), max: D(2030, 12, 31) };
    expect(buildColumnValues('day', D(2024, 2, 1), loose.min, loose.max)).toHaveLength(29);
    expect(buildColumnValues('day', D(2025, 2, 1), loose.min, loose.max)).toHaveLength(28);
  });

  it('isPartsInRange 对调换过的端点同样成立', () => {
    expect(isPartsInRange(D(2026, 5, 1), D(2026, 4, 1), D(2026, 6, 1))).toBe(true);
    expect(isPartsInRange(D(2026, 5, 1), D(2026, 6, 1), D(2026, 4, 1))).toBe(true);
    expect(isPartsInRange(D(2026, 7, 1), D(2026, 4, 1), D(2026, 6, 1))).toBe(false);
  });
});

describe('列裁剪与光标还原', () => {
  it('resolveColumns 去重并固定成「年→月→日」顺序', () => {
    expect(resolveColumns(undefined)).toEqual(['year', 'month', 'day']);
    expect(resolveColumns([])).toEqual(['year', 'month', 'day']);
    expect(resolveColumns(['month', 'year'])).toEqual(['year', 'month']);
    expect(resolveColumns(['day', 'day'])).toEqual(['day']);
  });

  it('defaultFormatForColumns 跟随实际列', () => {
    expect(defaultFormatForColumns(['year', 'month', 'day'])).toBe('YYYY-MM-DD');
    expect(defaultFormatForColumns(['year', 'month'])).toBe('YYYY-MM');
    expect(defaultFormatForColumns(['month', 'day'])).toBe('MM-DD');
    expect(defaultFormatForColumns([])).toBe('YYYY-MM-DD');
  });

  it('resolveCursor 还原被裁剪的值（缺年时用今年并夹进范围）', () => {
    const min = D(2020, 1, 1);
    const max = D(2030, 12, 31);
    expect(resolveCursor('2026-09-20', ['year', 'month', 'day'], min, max)).toEqual(
      D(2026, 9, 20),
    );
    expect(resolveCursor('2026-09', ['year', 'month'], min, max)).toEqual(D(2026, 9, 1));
    // '09-20' 缺年：补齐今年，且日被保留下来（columns 含 day 时不清零）
    expect(resolveCursor('09-20', ['month', 'day'], min, max).month).toBe(9);
    // 完全没有值时落到**今天**，不是「今年 1 月 1 日」——后者会让滚轮打开后
    // 停在 1 月，用户每次都得先滚到当月（区间模式与列裁剪形态的主路径）
    expect(resolveCursor(undefined, ['year', 'month', 'day'], min, max)).toEqual(todayParts());
    // 列裁剪：缺的字段才补位，没缺的字段仍然带着今天的值
    expect(resolveCursor(undefined, ['year', 'month'], min, max)).toEqual(
      D(todayParts().year, todayParts().month, 1),
    );
    expect(resolveCursor(undefined, ['month', 'day'], min, max)).toEqual(
      D(todayParts().year, todayParts().month, todayParts().day),
    );
  });
});

describe('值的归一化', () => {
  it('toDateArray 单值取一项、区间取两项', () => {
    expect(toDateArray(undefined, 'single')).toEqual([]);
    expect(toDateArray('2026-09-20', 'single')).toEqual(['2026-09-20']);
    expect(toDateArray(['2026-09-01', '2026-09-20'], 'range')).toEqual([
      '2026-09-01',
      '2026-09-20',
    ]);
    // 单值形态下误传数组只取第一项，避免 UI 出现两个端点
    expect(toDateArray(['a', 'b'], 'single')).toEqual(['a']);
  });

  it('orderDateTexts 排序并在缺项时返回 null', () => {
    expect(orderDateTexts('2026-09-20', '2026-09-01')).toEqual(['2026-09-01', '2026-09-20']);
    expect(orderDateTexts('2026-09-01', '2026-09-20')).toEqual(['2026-09-01', '2026-09-20']);
    // 区间的「大小」按日期本身判定，不靠字符串字典序（换个 format 就不可靠）
    expect(orderDateTexts('2026-9-20', '2026-10-01')).toEqual(['2026-9-20', '2026-10-01']);
    expect(orderDateTexts('2027-03', '2026-09', ['year', 'month'])).toEqual([
      '2026-09',
      '2027-03',
    ]);
    expect(orderDateTexts('2026-09-01', '')).toBeNull();
    expect(orderDateTexts('', '')).toBeNull();
    expect(orderDateTexts('乱写', '2026-09-01')).toBeNull();
  });

  it('toPickerValue 单值给字符串、区间给有序元组', () => {
    expect(toPickerValue([], 'single')).toBeUndefined();
    expect(toPickerValue(['2026-09-20'], 'single')).toBe('2026-09-20');
    expect(toPickerValue(['2026-09-20', '2026-09-01'], 'range')).toEqual([
      '2026-09-01',
      '2026-09-20',
    ]);
    // 半截区间不对外输出
    expect(toPickerValue(['2026-09-20', ''], 'range')).toBeUndefined();
  });
});

describe('周边界（月历网格本身已交给 react-day-picker，不再自测）', () => {
  it('weekBounds 返回本周首尾', () => {
    const bounds = weekBounds(D(2026, 9, 20), 0);
    expect(bounds.start).toEqual(D(2026, 9, 20));
    expect(bounds.end).toEqual(D(2026, 9, 26));
    expect(weekBounds(D(2026, 9, 20), 1).start).toEqual(D(2026, 9, 14));
  });
});

describe('滚轮列纯函数（jsdom 不做布局，只能在这一层覆盖）', () => {
  it('clampIndex 与 nearestIndex', () => {
    expect(clampIndex(-3, 5)).toBe(0);
    expect(clampIndex(9, 5)).toBe(4);
    expect(clampIndex(0, 0)).toBe(-1);

    expect(nearestIndex(0, 44, 10)).toBe(0);
    expect(nearestIndex(44 * 3, 44, 10)).toBe(3);
    // 偏移落在两行之间时取更近的一行（吸附的判定基础）
    expect(nearestIndex(44 * 3 + 30, 44, 10)).toBe(4);
    expect(nearestIndex(44 * 3 + 10, 44, 10)).toBe(3);
    expect(nearestIndex(44 * 99, 44, 10)).toBe(9);
  });

  it('itemHeight 为 0 时不除零，退化为第 0 行', () => {
    expect(nearestIndex(100, 0, 8)).toBe(0);
  });

  it('alignOffset 与 wheelPadding', () => {
    expect(alignOffset(3, 44)).toBe(132);
    expect(wheelPadding(44, 5)).toBe(88);
    expect(wheelPadding(44, 1)).toBe(0);
  });

  it('alignTargetIfNeeded 加位移守卫：已在容差内就不发 scrollTo', () => {
    // 这条守卫防的是「兜底对齐 → 触发 scroll → 再次兜底」的自激循环，
    // 表现为滚轮轻微抖动。±0.5px 视为已对齐。
    expect(alignTargetIfNeeded(44 * 3, 44, 10)).toBeNull();
    expect(alignTargetIfNeeded(44 * 3 + 0.4, 44, 10)).toBeNull();
    expect(alignTargetIfNeeded(44 * 3 + 6, 44, 10)).toBe(alignOffset(3, 44));
  });
});
