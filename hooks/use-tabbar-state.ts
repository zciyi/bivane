import * as React from 'react';

/**
 * Bivane Tabbar · 激活项状态机
 *
 * 交互定义见 bivane-responsive-matrix.md §2.3（Tabbar：模式 C）。
 *
 * 值语义用**字符串标识**（`value`）而不是下标：Tabbar 的一项通常对应一条
 * 路由，路由标识天然是字符串；下标会随「多一个角标项 / 少一项」而漂移。
 * 组件库不绑定任何路由框架，路由映射交给业务：
 * 受控 `value` + `onChange` 就是全部契约，item 上的 `href` 只是可选的透传。
 */

export interface TabbarItem {
  /** 项标识（受控值） */
  value: string;
  /** 文案 */
  label: React.ReactNode;
  /** 图标（通常是一个 <Icon /> 节点） */
  icon?: React.ReactNode;
  /** 角标：true = 小圆点；数字/字符串 = 文字角标 */
  badge?: string | number | boolean;
  /** 禁用该项（不可点） */
  disabled?: boolean;
  /** 传了就渲染成链接（<a href>），不传渲染成按钮 */
  href?: string;
}

/** 找出 value 对应的下标；找不到返回 -1 */
export function findTabIndex(items: TabbarItem[], value: string | undefined): number {
  if (value === undefined) return -1;
  return items.findIndex((item) => item.value === value);
}

/**
 * 非受控时的初始激活项。
 *
 * 优先用 defaultValue（能对上就用），对不上就落到第一个未禁用项 ——
 * 「一个都没选」的底栏会让用户不知道自己在哪，默认落在第一项更合理。
 */
export function resolveInitialValue(
  items: TabbarItem[],
  defaultValue: string | undefined,
): string | undefined {
  if (defaultValue !== undefined && findTabIndex(items, defaultValue) >= 0) {
    return defaultValue;
  }
  const firstEnabled = items.find((item) => !item.disabled);
  if (firstEnabled) return firstEnabled.value;
  return items[0]?.value;
}

export interface UseTabbarStateOptions {
  /** 标签项 */
  items: TabbarItem[];
  /** 受控激活项 */
  value?: string;
  /** 非受控初始激活项 */
  defaultValue?: string;
  /** 激活项变化 */
  onChange?: (value: string) => void;
}

export interface TabbarState {
  /** 当前激活项的 value（对不上任何 item 时为 undefined，即「谁都不选中」） */
  active?: string;
  /** 切换激活项 */
  setActive: (value: string) => void;
  /** 是否受控 */
  isControlled: boolean;
}

/**
 * Tabbar 的值状态。
 *
 * 受控展示态**直接派生自 prop**：受控值对不上任何一项时就是「谁都不选中」，
 * 不替业务方兜一个第一项（那会让受控方以为自己选中了它）。
 */
export function useTabbarState({
  items,
  value,
  defaultValue,
  onChange,
}: UseTabbarStateOptions): TabbarState {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<string | undefined>(() =>
    resolveInitialValue(items, defaultValue),
  );

  const active = isControlled ? value : internal;

  const setActive = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return { active, setActive, isControlled };
}
