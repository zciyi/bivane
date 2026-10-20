import * as React from 'react';

/**
 * Bivane Tabs · 激活态状态机
 *
 * 交互定义见 bivane-responsive-matrix.md §2.3（Tabs：模式 B）。
 *
 * 纯函数与 React 绑定分离（架构 §6.5 ③）：边界判定（夹紧、回绕、跳过禁用项）
 * 全部落在纯函数里，可以直接单测；hook 只做「受控 / 非受控」这一层绑定。
 *
 * 值语义：激活项用**下标**（0 起）表达，逐字对齐 Vant 的 `v-model:active`
 * （Vant 的 Tabs 管的也是序号，不是自定义 key）。
 */

/** 把下标夹到合法区间；count <= 0 时归零（一个标签都没有时无可选项） */
export function clampIndex(index: number, count: number): number {
  if (!Number.isFinite(index)) return 0;
  const truncated = Math.trunc(index);
  if (count <= 0) return 0;
  if (truncated < 0) return 0;
  if (truncated > count - 1) return count - 1;
  return truncated;
}

/**
 * 找下一个可用的标签下标：跳过 disabled 项，撞到头尾回绕。
 *
 * 回绕而不是停在边界：标签条是一个环（最后一项后面是第一项），
 * 停在边界会让「再按一次右键」变成无响应，误以为键盘失灵。
 * 全部禁用时退回当前下标（无处可去，保持原状）。
 */
export function nextEnabledIndex(
  current: number,
  count: number,
  step: 1 | -1,
  isDisabled: boolean[],
): number {
  if (count <= 0) return 0;
  const from = clampIndex(current, count);
  for (let i = 1; i <= count; i += 1) {
    const candidate = (((from + step * i) % count) + count) % count;
    if (!isDisabled[candidate]) return candidate;
  }
  return from;
}

/** 第一个未禁用的下标；全禁用时返回 -1 */
export function firstEnabledIndex(isDisabled: boolean[]): number {
  return isDisabled.findIndex((disabled) => !disabled);
}

/** 最后一个未禁用的下标；全禁用时返回 -1 */
export function lastEnabledIndex(isDisabled: boolean[]): number {
  for (let i = isDisabled.length - 1; i >= 0; i -= 1) {
    if (!isDisabled[i]) return i;
  }
  return -1;
}

export interface UseTabsStateOptions {
  /** 受控激活下标 */
  value?: number;
  /** 非受控初始激活下标，默认 0 */
  defaultValue?: number;
  /** 标签总数 */
  count: number;
  /** 激活项变化 */
  onChange?: (index: number) => void;
}

export interface TabsState {
  /** 当前激活下标 */
  active: number;
  /** 切换激活项 */
  setActive: (index: number) => void;
  /** 是否受控 */
  isControlled: boolean;
}

/**
 * Tabs 的值状态。
 *
 * 受控展示态**直接派生自 prop**，不做「内部 state + effect 同步」：
 * 那套写法在受控值变化时总会慢一拍，且引用去重逻辑会把它锁死在旧值上
 * （Uploader 曾因此「受控模式选文件无反应」）。这里受控时根本不存在内部值。
 */
export function useTabsState({
  value,
  defaultValue = 0,
  count,
  onChange,
}: UseTabsStateOptions): TabsState {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState(() => clampIndex(defaultValue, count));

  const active = isControlled
    ? clampIndex(value, count)
    : clampIndex(internal, count);

  const setActive = React.useCallback(
    (index: number) => {
      const next = clampIndex(index, count);
      if (!isControlled) setInternal(next);
      onChange?.(next);
    },
    [count, isControlled, onChange],
  );

  return { active, setActive, isControlled };
}
