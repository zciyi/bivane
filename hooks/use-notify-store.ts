import type * as React from 'react';

/**
 * Bivane 命令式 Notify 状态存储（纯逻辑，不含 React 组件）
 *
 * 与组件分离的原因同 use-dialog-store：避免 store 与渲染组件互引成环。
 * 这里只做「存 + 通知 + 自动关闭计时」，渲染交给 responsive/notify.tsx。
 *
 * 语义对齐 Vant `showNotify`：默认 3s 自动消失，支持四态语义色与自定义配色。
 */

export type NotifyType = 'primary' | 'success' | 'danger' | 'warning';

export interface NotifyOptions {
  /** 通知文案 */
  message: React.ReactNode;
  /** 语义类型，默认 danger（对齐 Vant notify 默认值） */
  type?: NotifyType;
  /** 自动关闭毫秒数，默认 3000；传 0 表示不自动关闭 */
  duration?: number;
  /** 自定义文字色，覆盖 type 配色 */
  color?: string;
  /** 自定义背景色，覆盖 type 配色 */
  background?: string;
  /** 点击通知条 */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** 展示时长结束后回调 */
  onClose?: () => void;
  /** 层级，默认用 --bv-toast-z-index */
  zIndex?: number;
  /** 自定义类名（透传到通知条） */
  className?: string;
}

export interface NotifyEntry {
  id: number;
  options: NotifyOptions;
}

export interface NotifyHandle {
  id: number;
  close: () => void;
  update: (next: Partial<NotifyOptions>) => void;
}

/** Vant notify 默认 3s */
export const DEFAULT_NOTIFY_DURATION = 3000;

const EMPTY: NotifyEntry[] = [];

let entries: NotifyEntry[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** 解析实际生效的时长：undefined → 默认 3s；0 → 不自动关闭 */
export function resolveNotifyDuration(duration?: number): number {
  return duration === undefined ? DEFAULT_NOTIFY_DURATION : duration;
}

export function subscribeNotifyStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotifyEntries(): readonly NotifyEntry[] {
  return entries;
}

export function getNotifyServerEntries(): readonly NotifyEntry[] {
  return EMPTY;
}

/** 测试 / 热重载用：清空全部并清掉计时器 */
export function resetNotifyStore(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  entries = EMPTY;
  nextId = 1;
  emit();
}

export function showNotify(options: NotifyOptions): NotifyHandle {
  const id = nextId;
  nextId += 1;

  entries = [...entries, { id, options }];
  emit();

  const wait = resolveNotifyDuration(options.duration);
  if (wait > 0) {
    const timer = setTimeout(() => closeNotify(id), wait);
    timers.set(id, timer);
  }

  return {
    id,
    close: () => closeNotify(id),
    update: (next) => updateNotify(id, next),
  };
}

/** 关闭指定通知；不传 id 关闭全部（Vant closeNotify 同语义） */
export function closeNotify(id?: number): void {
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

  const closing = id === undefined ? entries : entries.filter((entry) => entry.id === id);
  entries = next;
  emit();

  closing.forEach((entry) => entry.options.onClose?.());
}

export function updateNotify(id: number, next: Partial<NotifyOptions>): void {
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
