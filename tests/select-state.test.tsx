import { describe, expect, it } from 'vitest';
import {
  collectSelectedOptions,
  filterItems,
  flattenOptions,
  fromSelectedArray,
  hasGroups,
  initialActiveIndex,
  isOptionSelected,
  isSelectGroup,
  matchOption,
  nextEnabledIndex,
  toSelectedArray,
  toggleSelected,
  type SelectItem,
  type SelectOption,
} from '@/hooks/use-select-state';

/**
 * Select 共享逻辑的纯函数测试（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 为什么单独测这一层而不只测组件：
 * 「跳过 disabled 项」「分组过滤后空组丢弃」「单选只取头一个值」这类判定，
 * 在 DOM 测试里要么要构造很长的列表，要么根本触发不到；
 * 抽成纯函数后每条规则都能被精确钉住 —— 两端共用同一份逻辑，测一遍即两端都覆盖。
 */

const OPTIONS: SelectOption[] = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '广州', value: 'gz' },
  { label: '深圳', value: 'sz', disabled: true },
  { label: '杭州', value: 'hz' },
];

const ITEMS: SelectItem[] = [
  { group: '华北', options: [{ label: '北京', value: 'bj' }] },
  {
    group: '华东',
    options: [
      { label: '上海', value: 'sh' },
      { label: '杭州', value: 'hz' },
    ],
  },
];

describe('结构遍历', () => {
  it('识别分组并摊平成选项序列', () => {
    expect(ITEMS.filter(isSelectGroup)).toHaveLength(2);
    expect(flattenOptions(ITEMS).map((option) => option.value)).toEqual(['bj', 'sh', 'hz']);
  });

  it('扁平列表不产生虚假分组', () => {
    expect(hasGroups(OPTIONS)).toBe(false);
    expect(hasGroups(ITEMS)).toBe(true);
  });
});

describe('过滤', () => {
  it('空关键词原样返回（连数组引用都不变，避免多余重算）', () => {
    expect(filterItems(OPTIONS, '')).toBe(OPTIONS);
    expect(filterItems(OPTIONS, '   ')).toBe(OPTIONS);
  });

  it('按 label 子串匹配且忽略大小写', () => {
    const latin: SelectItem[] = [
      { label: 'Apple', value: 1 },
      { label: 'banana', value: 2 },
    ];
    expect(filterItems(latin, 'APP').map((item) => (item as SelectOption).value)).toEqual([1]);
  });

  it('分组内选项被过滤光时整组丢弃，不留「只有标题没有内容」的空块', () => {
    const result = filterItems(ITEMS, '杭州');
    expect(result).toHaveLength(1);
    expect(isSelectGroup(result[0]) && result[0].group).toBe('华东');
    expect(isSelectGroup(result[0]) && result[0].options).toHaveLength(1);
  });

  it('label 是自定义节点时退化为按 value 匹配（取不到文本）', () => {
    const nodeLabel: SelectOption = { label: <span>北京</span>, value: 'bj' };
    expect(matchOption(nodeLabel, '北京')).toBe(false);
    expect(matchOption(nodeLabel, 'bj')).toBe(true);
  });
});

describe('值规范化', () => {
  it('单选只取数组的头一个，防止外部误传数组导致出现多个勾', () => {
    expect(toSelectedArray(['bj', 'sh'], false)).toEqual(['bj']);
    expect(toSelectedArray(['bj', 'sh'], true)).toEqual(['bj', 'sh']);
  });

  it('undefined 规范成空数组', () => {
    expect(toSelectedArray(undefined, true)).toEqual([]);
  });

  it('还原成对外类型：单选给单值、多选给数组', () => {
    expect(fromSelectedArray(['bj'], false)).toBe('bj');
    expect(fromSelectedArray([], false)).toBeUndefined();
    expect(fromSelectedArray(['bj'], true)).toEqual(['bj']);
  });

  it('数字 0 是有效值，不会被当成空值丢掉', () => {
    expect(toSelectedArray(0, false)).toEqual([0]);
    expect(fromSelectedArray([0], false)).toBe(0);
  });
});

describe('选中判定与切换', () => {
  it('单选取代、多选翻转', () => {
    expect(toggleSelected(['bj'], OPTIONS[1], false)).toEqual(['sh']);
    expect(toggleSelected(['bj'], OPTIONS[1], true)).toEqual(['bj', 'sh']);
    expect(toggleSelected(['bj', 'sh'], OPTIONS[1], true)).toEqual(['bj']);
  });

  it('回显按 options 声明顺序，不随点击先后跳动', () => {
    expect(collectSelectedOptions(ITEMS, ['hz', 'bj']).map((option) => option.value)).toEqual([
      'bj',
      'hz',
    ]);
  });

  it('isOptionSelected 基于值相等而非引用', () => {
    expect(isOptionSelected(['bj'], { label: '北京', value: 'bj' })).toBe(true);
  });
});

describe('键盘索引：必须跳过 disabled 项', () => {
  it('从「无激活项」向下落在第一个可选项', () => {
    expect(nextEnabledIndex(OPTIONS, -1, 1)).toBe(0);
  });

  it('从「无激活项」向上落在最后一个可选项', () => {
    expect(nextEnabledIndex(OPTIONS, -1, -1)).toBe(4);
  });

  it('向下会跳过 disabled 的深圳（下标 3）', () => {
    expect(nextEnabledIndex(OPTIONS, 2, 1)).toBe(4);
  });

  it('向上会跳过 disabled 的深圳', () => {
    expect(nextEnabledIndex(OPTIONS, 4, -1)).toBe(2);
  });

  it('到边界回绕', () => {
    expect(nextEnabledIndex(OPTIONS, 4, 1)).toBe(0);
    expect(nextEnabledIndex(OPTIONS, 0, -1)).toBe(4);
  });

  it('全部 disabled 时返回 -1，调用方据此不做任何移动', () => {
    const allDisabled: SelectOption[] = [
      { label: 'a', value: 1, disabled: true },
      { label: 'b', value: 2, disabled: true },
    ];
    expect(nextEnabledIndex(allDisabled, -1, 1)).toBe(-1);
  });

  it('空列表返回 -1', () => {
    expect(nextEnabledIndex([], -1, 1)).toBe(-1);
  });

  it('初始激活项优先落在已选项，其次第一个可选项', () => {
    expect(initialActiveIndex(OPTIONS, ['gz'])).toBe(2);
    expect(initialActiveIndex(OPTIONS, [])).toBe(0);
    // 已选项若恰好是 disabled，不能停在它上面
    expect(initialActiveIndex(OPTIONS, ['sz'])).toBe(0);
    // 第一个可选项之前若全是 disabled，也要跳过
    expect(initialActiveIndex([{ label: 'a', value: 1, disabled: true }, OPTIONS[0]], [])).toBe(1);
  });
});
