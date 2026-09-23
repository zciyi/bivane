import { describe, expect, it } from 'vitest';
import {
  collectMenuLeaves,
  findMenuOption,
  findMenuPath,
  hasSubmenu,
  isMenuDivider,
  menuOptions,
  resolveMenuPanels,
  type MenuItem,
} from '@/hooks/use-menu-state';

/**
 * 菜单树模型的纯函数测试（不涉及 DOM）
 *
 * 这些判定在 DOM 测试里要么构造成本很高（需要三层菜单 + 权限收窄的中间态），
 * 要么根本触发不到。而它们恰恰是「两端是否真的共享同一棵树」的判据 ——
 * 一旦这里错了，H5 与 PC 会各自错得不一样（面板层级与子菜单层级对不上）。
 */

const MENU: MenuItem[] = [
  { value: 'edit', label: '编辑' },
  { divider: true },
  {
    value: 'move',
    label: '移动到',
    children: [
      { value: 'folder-a', label: '文件夹 A' },
      {
        value: 'more',
        label: '更多',
        children: [{ value: 'deep', label: '更深一层' }],
      },
    ],
  },
  { divider: true },
];

describe('结构判定', () => {
  it('分隔线与选项互斥', () => {
    expect(isMenuDivider({ divider: true })).toBe(true);
    expect(isMenuDivider({ value: 'a', label: 'A' })).toBe(false);
    expect(menuOptions(MENU).map((option) => option.value)).toEqual(['edit', 'move']);
  });

  it('children 为空数组不算二级菜单', () => {
    expect(hasSubmenu({ value: 'a', label: 'A', children: [] })).toBe(false);
    expect(hasSubmenu({ value: 'a', label: 'A', children: [{ value: 'b', label: 'B' }] })).toBe(
      true,
    );
  });
});

describe('resolveMenuPanels', () => {
  it('空路径只有根层', () => {
    const panels = resolveMenuPanels(MENU, []);
    expect(panels).toHaveLength(1);
    expect(panels[0].trail).toEqual([]);
  });

  it('按路径逐层下钻，trail 记录来路', () => {
    const panels = resolveMenuPanels(MENU, ['move', 'more']);
    expect(panels).toHaveLength(3);
    expect(panels[1].items.map((item) => (isMenuDivider(item) ? '-' : item.value))).toEqual([
      'folder-a',
      'more',
    ]);
    expect(panels[2].trail.map((option) => option.value)).toEqual(['move', 'more']);
    expect(panels[2].items.map((item) => (isMenuDivider(item) ? '-' : item.value))).toEqual([
      'deep',
    ]);
  });

  it('路径中途失效时就地截断，而不是渲染成空白', () => {
    // 第二段不存在（权限收窄 / 数据刷新后的陈旧路径）
    const panels = resolveMenuPanels(MENU, ['move', 'ghost', 'deep']);
    expect(panels).toHaveLength(2);
    expect(panels[1].trail.map((option) => option.value)).toEqual(['move']);
  });

  it('路径指向叶子节点时停在该层（不会把叶子当成有子级）', () => {
    const panels = resolveMenuPanels(MENU, ['edit']);
    expect(panels).toHaveLength(1);
  });

  it('路径第一段就失效时退回根层', () => {
    const panels = resolveMenuPanels(MENU, ['ghost']);
    expect(panels).toHaveLength(1);
    expect(panels[0].trail).toEqual([]);
  });
});

describe('全局查找与叶子收集', () => {
  it('findMenuOption 能在任意深度找到节点（含父项）', () => {
    expect(findMenuOption(MENU, 'deep')?.label).toBe('更深一层');
    expect(findMenuOption(MENU, 'move')?.label).toBe('移动到');
    expect(findMenuOption(MENU, 'ghost')).toBeUndefined();
  });

  it('findMenuPath 返回「根 → 节点」的完整链（顶层节点为单元素链）', () => {
    expect(findMenuPath(MENU, 'deep')?.map((option) => option.label)).toEqual([
      '移动到',
      '更多',
      '更深一层',
    ]);
    // 顶层节点：「层级」就是它自己，调用方不需要再分支判断
    expect(findMenuPath(MENU, 'edit')?.map((option) => option.value)).toEqual(['edit']);
    expect(findMenuPath(MENU, 'ghost')).toBeUndefined();
  });

  it('collectMenuLeaves 只收叶子并带完整路径（分隔线不出现）', () => {
    expect(collectMenuLeaves(MENU)).toEqual([
      { option: expect.objectContaining({ value: 'edit' }), path: ['edit'] },
      { option: expect.objectContaining({ value: 'folder-a' }), path: ['move', 'folder-a'] },
      { option: expect.objectContaining({ value: 'deep' }), path: ['move', 'more', 'deep'] },
    ]);
  });
});
