import type * as React from 'react';

/**
 * Bivane 命令式 Loading 状态存储（纯逻辑，不含 React 组件）
 *
 * 与组件分离的原因同 use-dialog-store：store 与渲染组件互引会形成环。
 * 这里只做「存 + 通知 + 自动关闭计时」，渲染完全交给 responsive/loading.tsx。
 *
 * 语义对齐 Vant `showLoadingToast`：
 *   - 默认常驻，必须显式 hideLoading(id) 才消失（除非传了 duration）。
 *   - 允许多条叠加，呈现层只显示「最新一条」的文本（单例观感）。
 */

export interface LoadingOptions {
  /** 提示文案；不传则只显示转圈 */
  text?: React.ReactNode;
  /** 是否渲染遮罩，默认 true */
  mask?: boolean;
  /**
   * 是否阻断下层点击，默认 false（逐字对齐 Vant Toast）。
   * true 时遮罩吃事件，false 时底层仍可点（但遮罩依旧盖在上面）。
   */
  forbidClick?: boolean;
  /** 层级，默认用 --bv-toast-z-index */
  zIndex?: number;
  /** 自动关闭毫秒数；不传则常驻 */
  duration?: number;
  /** 自定义类名（透传到遮罩层） */
  className?: string;
}

export interface LoadingEntry {
  id: number;
  options: LoadingOptions;
}

export interface LoadingHandle {
  id: number;
  /** 关闭该实例 */
  close: () => void;
  /** 局部更新配置（如动态改文案） */
  update: (next: Partial<LoadingOptions>) => void;
}

const EMPTY: LoadingEntry[] = [];

let entries: LoadingEntry[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeLoadingStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoadingEntries(): readonly LoadingEntry[] {
  return entries;
}

export function getLoadingServerEntries(): readonly LoadingEntry[] {
  return EMPTY;
}

/** 测试 / 热重载用：清空全部实例并清掉计时器 */
export function resetLoadingStore(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  entries = EMPTY;
  nextId = 1;
  emit();
}

export function showLoading(options: LoadingOptions = {}): LoadingHandle {
  const id = nextId;
  nextId += 1;

  entries = [...entries, { id, options }];
  emit();

  const wait = options.duration;
  if (typeof wait === 'number' && wait > 0) {
    const timer = setTimeout(() => hideLoading(id), wait);
    timers.set(id, timer);
  }

  return {
    id,
    close: () => hideLoading(id),
    update: (next) => updateLoading(id, next),
  };
}

/** 关闭指定实例；不传 id 关闭全部（Vant closeToast 同语义） */
export function hideLoading(id?: number): void {
  if (id !== undefined) {
    const timer = timers.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.delete(id);
    }
  } else {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  }

  const next = id === undefined ? EMPTY : entries.filter((entry) => entry.id !== id);
  if (next === entries) return;
  entries = next;
  emit();
}

export function updateLoading(id: number, next: Partial<LoadingOptions>): void {
  let changed = false;
  const merged = entries.map((entry) => {
    if (entry.id !== id) return entry;
    changed = true;
    return { ...entry, options: { ...entry.options, ...next } };
  });

  if (!changed) return;
  entries = merged;
  emit();
}
