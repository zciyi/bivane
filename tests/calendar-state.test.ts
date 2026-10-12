import { describe, expect, it } from 'vitest';
import {
  applyRangeDay,
  buildMonthGrid,
  diffDays,
  listMonths,
  normalizeCalendarList,
  resolveCalendarBounds,
  resolveCalendarSeed,
  resolveDragRange,
  rowsCountInMonth,
  toCalendarValue,
  toggleMultiple,
  type RangeDraft,
} from '@/hooks/use-calendar-state';
import { todayParts, type DateParts } from '@/hooks/use-date-value';

/**
 * Calendar 纯日期推理单测（架构 §4 第 18 条 + 矩阵 §4）。
 * 月网格补位、闰年、区间状态机、超窗滑动这些边界 jsdom 布局测试覆盖不到，
 * 必须在纯函数层钉死。
 */

const P = (year: number, month: number, day: number): DateParts => ({
  year,
  month,
  day,
});

describe('resolveCalendarBounds 默认范围', () => {
  it('默认下界为今天、上界为 6 个月后的月末', () => {
    const { min, max } = resolveCalendarBounds({});
    const now = todayParts();
    expect(min).toEqual(now);
    // 上界月份 = 当前月 + 5（跨度 6 个月），日为该月月末
    const expectedYear = now.month + 5 > 12 ? now.year + 1 : now.year;
    const expectedMonth = ((now.month + 4) % 12) + 1;
    expect(max.year).toBe(expectedYear);
    expect(max.month).toBe(expectedMonth);
  });

  it('显式 min/max 是硬边界，不被值撑开', () => {
    const { min, max } = resolveCalendarBounds({
      min: '2026-01-01',
      max: '2026-03-31',
      values: ['2020-05-05'],
    });
    expect(min).toEqual(P(2026, 1, 1));
    expect(max).toEqual(P(2026, 3, 31));
  });

  it('默认范围被已选值撑开（仅未显式给的那一侧）', () => {
    const { min } = resolveCalendarBounds({
      max: '2030-01-01',
      values: ['2020-05-05'],
    });
    expect(min).toEqual(P(2020, 5, 5));
  });

  it('min/max 写反时交换', () => {
    const { min, max } = resolveCalendarBounds({
      min: '2026-12-31',
      max: '2026-01-01',
    });
    expect(min).toEqual(P(2026, 1, 1));
    expect(max).toEqual(P(2026, 12, 31));
  });
});

describe('buildMonthGrid 月网格', () => {
  it('2026-10（周日为首）：1 号是周四，前置 4 格，共 35 格 5 行', () => {
    const grid = buildMonthGrid(2026, 10, 0);
    expect(grid.cells).toHaveLength(35);
    expect(grid.rowCount).toBe(5);
    expect(grid.cells.slice(0, 4).every((cell) => !cell.inMonth)).toBe(true);
    expect(grid.cells[4].parts).toEqual(P(2026, 10, 1));
    expect(grid.cells[34].parts).toEqual(P(2026, 10, 31));
  });

  it('前置格来自上月、后置格来自下月', () => {
    // 2026-10 前置 4 格：9/27 ~ 9/30
    const october = buildMonthGrid(2026, 10, 0);
    expect(october.cells.slice(0, 4).map((cell) => cell.parts)).toEqual([
      P(2026, 9, 27),
      P(2026, 9, 28),
      P(2026, 9, 29),
      P(2026, 9, 30),
    ]);

    // 2025-11：1 号周六（前置 6 格）+ 30 天，共 42 格，后置格为 12/1 ~ 12/6
    const november = buildMonthGrid(2025, 11, 0);
    expect(november.cells).toHaveLength(42);
    expect(november.cells.slice(-6).map((cell) => cell.parts)).toEqual([
      P(2025, 12, 1),
      P(2025, 12, 2),
      P(2025, 12, 3),
      P(2025, 12, 4),
      P(2025, 12, 5),
      P(2025, 12, 6),
    ]);
  });

  it('周一起始时前置格数按新基准计算', () => {
    // 2026-10-01 周四；周一起始 lead = (4 - 1 + 7) % 7 = 3
    const grid = buildMonthGrid(2026, 10, 1);
    expect(grid.cells[2].inMonth).toBe(false);
    expect(grid.cells[3].parts).toEqual(P(2026, 10, 1));
  });

  it('rowsCountInMonth 覆盖 4/5/6 行月份', () => {
    // 2026-02：1 号周日，28 天 → 正好 4 行
    expect(rowsCountInMonth(2026, 2, 0)).toBe(4);
    // 2026-10：5 行
    expect(rowsCountInMonth(2026, 10, 0)).toBe(5);
    // 2025-11：1 号周六，30 天 → 6 行
    expect(rowsCountInMonth(2025, 11, 0)).toBe(6);
  });
});

describe('listMonths 月份枚举', () => {
  it('闭区间逐月枚举并正确跨年', () => {
    const months = listMonths(P(2026, 11, 1), P(2027, 2, 28));
    expect(months).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
  });

  it('起止同月只有一个月', () => {
    expect(listMonths(P(2026, 5, 1), P(2026, 5, 31))).toEqual([
      { year: 2026, month: 5 },
    ]);
  });
});

describe('diffDays', () => {
  it('按日历日差值（含跨年、闰年）', () => {
    expect(diffDays(P(2024, 2, 28), P(2024, 3, 1))).toBe(2);
    expect(diffDays(P(2026, 1, 1), P(2026, 1, 1))).toBe(0);
    expect(diffDays(P(2026, 12, 31), P(2027, 1, 1))).toBe(1);
  });
});

describe('applyRangeDay 区间状态机', () => {
  const empty: RangeDraft = [null, null];

  it('空草稿点首日 = 定起点、未完成', () => {
    expect(applyRangeDay(empty, '2026-10-01', { allowSameDay: false })).toEqual({
      draft: ['2026-10-01', null],
      completed: false,
    });
  });

  it('起点已定时点更晚日 = 凑齐两端', () => {
    const result = applyRangeDay(
      ['2026-10-01', null],
      '2026-10-05',
      { allowSameDay: false },
    );
    expect(result).toEqual({ draft: ['2026-10-01', '2026-10-05'], completed: true });
  });

  it('点更早的日 = 丢弃旧起点重新开始', () => {
    const result = applyRangeDay(
      ['2026-10-10', null],
      '2026-10-05',
      { allowSameDay: false },
    );
    expect(result).toEqual({ draft: ['2026-10-05', null], completed: false });
  });

  it('同日：allowSameDay=false 忽略不改值；true 才完成同日区间', () => {
    const draft: RangeDraft = ['2026-10-10', null];
    expect(applyRangeDay(draft, '2026-10-10', { allowSameDay: false })).toEqual({
      draft,
      completed: false,
    });
    expect(applyRangeDay(draft, '2026-10-10', { allowSameDay: true })).toEqual({
      draft: ['2026-10-10', '2026-10-10'],
      completed: true,
    });
  });

  it('上一段已完成后再点 = 开始新一段', () => {
    const result = applyRangeDay(
      ['2026-10-01', '2026-10-05'],
      '2026-11-01',
      { allowSameDay: false },
    );
    expect(result).toEqual({ draft: ['2026-11-01', null], completed: false });
  });
});

describe('resolveDragRange 拖选预览', () => {
  it('触点早于起点时忽略（起点不往回带）', () => {
    const result = resolveDragRange('2026-10-10', '2026-10-08');
    expect(result).toEqual({ draft: ['2026-10-10', null], slid: false });
  });

  it('正常拖选终点跟手', () => {
    const result = resolveDragRange('2026-10-10', '2026-10-12');
    expect(result).toEqual({ draft: ['2026-10-10', '2026-10-12'], slid: false });
  });

  it('跨度达到 maxRange 时窗口向前滑动（maxRange 含端点）', () => {
    // maxRange=3：允许 diff 0/1/2；触点为 10-13（diff=3）时起点滑到 10-11
    const result = resolveDragRange('2026-10-10', '2026-10-13', 3);
    expect(result).toEqual({ draft: ['2026-10-11', '2026-10-13'], slid: true });
  });

  it('滑窗跨月正确（10-31 起、maxRange=3、拖到 11-02）', () => {
    const result = resolveDragRange('2026-10-31', '2026-11-02', 3);
    expect(result).toEqual({ draft: ['2026-10-31', '2026-11-02'], slid: false });
    const slid = resolveDragRange('2026-10-31', '2026-11-05', 3);
    expect(slid.draft).toEqual(['2026-11-03', '2026-11-05']);
    expect(slid.slid).toBe(true);
  });
});

describe('toggleMultiple 多选', () => {
  it('加入时按时间升序归位', () => {
    expect(toggleMultiple(['2026-10-01', '2026-10-05'], '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-03',
      '2026-10-05',
    ]);
  });

  it('再次点击已选项 = 取消', () => {
    expect(toggleMultiple(['2026-10-01', '2026-10-03'], '2026-10-01')).toEqual([
      '2026-10-03',
    ]);
  });

  it('非法文本被忽略', () => {
    expect(toggleMultiple([], 'not-a-date')).toEqual([]);
  });
});

describe('值归一化', () => {
  const min = P(2026, 1, 1);
  const max = P(2026, 12, 31);

  it('range 去重、排序、截断为两端', () => {
    expect(
      normalizeCalendarList(
        ['2026-10-09', '2026-10-01', '2026-10-01', '2026-12-01'],
        'range',
        min,
        max,
      ),
    ).toEqual(['2026-10-01', '2026-10-09']);
  });

  it('越界与非法项被过滤', () => {
    expect(
      normalizeCalendarList(['2025-12-31', '2026-06-01', 'bad'], 'multiple', min, max),
    ).toEqual(['2026-06-01']);
  });

  it('single 只取第一项', () => {
    expect(normalizeCalendarList(['2026-06-01', '2026-07-01'], 'single', min, max)).toEqual(
      ['2026-06-01'],
    );
  });

  it('toCalendarValue 半截区间不产生值', () => {
    expect(toCalendarValue(['2026-06-01'], 'range')).toBeUndefined();
    expect(toCalendarValue(['2026-06-01', '2026-06-05'], 'range')).toEqual([
      '2026-06-01',
      '2026-06-05',
    ]);
    expect(toCalendarValue([], 'single')).toBeUndefined();
    expect(toCalendarValue(['2026-06-01'], 'single')).toBe('2026-06-01');
  });
});

describe('resolveCalendarSeed 播种月', () => {
  const min = P(2026, 1, 1);
  const max = P(2026, 12, 31);

  it('区间优先取终点、多选取最后一项', () => {
    expect(resolveCalendarSeed(['2026-03-01', '2026-05-01'], min, max)).toEqual(
      P(2026, 5, 1),
    );
    expect(resolveCalendarSeed(['2026-03-01', '2026-05-01', '2026-07-01'], min, max)).toEqual(
      P(2026, 7, 1),
    );
  });

  it('无值落今天并夹进范围', () => {
    const now = todayParts();
    expect(resolveCalendarSeed([], min, max)).toEqual(now);
    // clampParts 逐字段夹紧：年份夹到 2030，今天的月日仍在该年范围内则保留
    const tight = resolveCalendarSeed([], P(2030, 1, 1), P(2030, 12, 31));
    expect(tight).toEqual(P(2030, now.month, now.day));
    // 月份也越界时夹到边界月，日仍保留今天的日
    const late = resolveCalendarSeed([], P(2030, 12, 1), P(2030, 12, 31));
    expect(late).toEqual(P(2030, 12, now.day));
  });
});
