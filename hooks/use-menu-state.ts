// React 在本文件里只作为类型命名空间使用（React.ReactNode），
// 没有运行期引用 —— 用 `import type` 才不会给消费者带去无谓的运行时依赖
import type * as React from 'react';

/**
 * Bivane DropdownMenu · 跨模式共享模型（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 两端共享的是什么、不共享的是什么：
 *   共享 —— **菜单树本身**。一棵树怎么按路径下钻、哪个节点是叶子、分隔线占不占位，
 *          这些判定与容器形态无关，两端必须给出同样的答案。
 *   不共享 —— 「怎么走这棵树」。H5 是**二级面板推入**（把下一层推进视野，
 *          有返回按钮、能用手指退回来）；PC 是**子菜单向右展开**（悬停/→键展开，
 *          ←键收回，不改变父面板位置）。这是两种导航范式，属于模式 C 的定义差异。
 *
 * 因此本文件只导出树遍历的纯函数（可单测，不需要 DOM），不含任何组件。
 * 依赖方向：不 import 任何组件，避免与 h5/menu.tsx、pc/menu.tsx 形成环。
 */

export type MenuValue = string;

export interface MenuOption {
  /** 唯一值，onSelect 回传的就是它 */
  value: MenuValue;
  label: React.ReactNode;
  /** 右侧快捷键提示。PC 渲染成 kbd；H5 不渲染（触屏没有键盘，展示快捷键是噪音） */
  shortcut?: string;
  /** 可选前置图标 */
  icon?: React.ReactNode;
  /** 禁用项：点击无效、PC 键盘巡航会跳过 */
  disabled?: boolean;
  /** 危险操作（删除等），着色用既有语义 token --bv-danger，不新增颜色 token */
  danger?: boolean;
  /** 非空即二级菜单 */
  children?: MenuItem[];
}

/** 分隔线。不是可选项：不参与 onSelect、不占键盘巡航位、不计入 aria 序号 */
export interface MenuDivider {
  divider: true;
}

export type MenuItem = MenuOption | MenuDivider;

/** 面板栈的一层：进入该层之前的路径 + 该层的条目 */
export interface MenuPanel {
  /** 到达本层所经过的节点（根层为空数组） */
  trail: MenuOption[];
  /** 本层的条目（含分隔线） */
  items: MenuItem[];
}

/* ------------------------------------------------------------------ *
 * 结构判定
 * ------------------------------------------------------------------ */

export function isMenuDivider(item: MenuItem): item is MenuDivider {
  return 'divider' in item;
}

/** 是否是可选的叶子/父项（分隔线不算） */
export function isMenuOption(item: MenuItem): item is MenuOption {
  return !isMenuDivider(item);
}

export function hasSubmenu(option: MenuOption): boolean {
  return Array.isArray(option.children) && option.children.length > 0;
}

/** 本层可交互条目（过滤掉分隔线），用于键盘巡航与空态判定 */
export function menuOptions(items: MenuItem[]): MenuOption[] {
  return items.filter(isMenuOption);
}

/* ------------------------------------------------------------------ *
 * 路径解析
 * ------------------------------------------------------------------ */

/**
 * 按路径下钻，返回整条**面板栈**（含根层）。
 *
 * 路径中遇到不存在的值、指向叶子、或中途断开时**就地截断**并返回已走到的层。
 * 这是有意的：菜单树可以由业务动态变化（权限收窄、数据刷新），
 * 此时陈旧的 path 不应该让整个菜单渲染成空白，退回最近的有效层即可。
 */
export function resolveMenuPanels(items: MenuItem[], path: MenuValue[]): MenuPanel[] {
  const panels: MenuPanel[] = [{ trail: [], items }];
  let currentItems = items;
  let trail: MenuOption[] = [];

  for (const value of path) {
    const option = menuOptions(currentItems).find((item) => item.value === value);
    if (!option || !hasSubmenu(option)) break;

    trail = [...trail, option];
    currentItems = option.children as MenuItem[];
    panels.push({ trail, items: currentItems });
  }

  return panels;
}

/**
 * 收集所有叶子节点（按文档顺序），带各自的完整路径。
 *
 * 用途是「可选值域」这类判定：业务侧常常需要知道「这棵树里到底有哪些可选项」，
 * 例如回显一个值、或在受控校验里判断传入值是否合法。
 */
export function collectMenuLeaves(
  items: MenuItem[],
  prefix: MenuValue[] = [],
): { option: MenuOption; path: MenuValue[] }[] {
  const result: { option: MenuOption; path: MenuValue[] }[] = [];

  menuOptions(items).forEach((option) => {
    const path = [...prefix, option.value];
    if (hasSubmenu(option)) {
      result.push(...collectMenuLeaves(option.children as MenuItem[], path));
      return;
    }
    result.push({ option, path });
  });

  return result;
}

/**
 * 按值在整棵树里找节点，返回**从根到该节点的完整链**（含节点自身），找不到返回 undefined。
 *
 * 「找到节点」与「知道它在第几层」是同一件事：回显选中项时不仅要知道它的 label，
 * 还要知道它挂在哪条父级链下 —— 同名叶子挂在不同父级下时，只回显 label 会指错。
 * 顶层节点返回 `[自身]`，调用方无需再区分「顶层」与「嵌套」。
 */
export function findMenuPath(items: MenuItem[], value: MenuValue): MenuOption[] | undefined {
  for (const option of menuOptions(items)) {
    if (option.value === value) return [option];
    if (!hasSubmenu(option)) continue;
    const rest = findMenuPath(option.children as MenuItem[], value);
    if (rest) return [option, ...rest];
  }
  return undefined;
}

/** 按值在整棵树里找节点（含父项），找不到返回 undefined */
export function findMenuOption(items: MenuItem[], value: MenuValue): MenuOption | undefined {
  const path = findMenuPath(items, value);
  return path?.[path.length - 1];
}

/**
 * 关于键盘巡航：**本模块不提供索引计算**，与 Select 的 `nextEnabledIndex` 不同。
 *
 * 原因是两端都不需要它：
 *   - PC 的巡航（↑↓、Home/End、字母 typeahead、跳过禁用项、子菜单的 →←）整体交给
 *     Radix 的 DropdownMenu —— 多层菜单的焦点归属写一遍必错（架构 §6.4 的既定选型）；
 *   - H5 是触屏，没有巡航概念。
 *
 * 唯一需要留意的一致性点是「到边界不回绕」：Radix 的 `loop` 默认 false，
 * 与菜单作为**有终点的动作列表**的直觉一致（Select 是取值列表，才回绕）。
 * 若将来把 `loop` 打开，键盘行为会与本库其余组件的直觉分叉。
 */
