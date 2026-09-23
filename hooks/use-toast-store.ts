import type * as React from 'react';

/**
 * Bivane Toast 状态存储（纯逻辑）
 *
 * 矩阵 §2.1 把 Toast 归为模式 C：H5 是顶部胶囊、PC 是右上角通知栈，形态本质不同。
 * 但**队列与生命周期是共享逻辑**，必须两端一致，因此统一由本 store 负责：
 *   - 自动关闭计时（type=loading 默认不自动关，与 Vant 一致）
 *   - closeToast(id?) 语义（不传 id 关闭全部，Vant 行为）
 *   - 数组顺序即创建顺序，由各自的 presenter 决定怎么排布
 *
 * 渲染层（h5/toast.tsx、pc/toast.tsx）只做视觉，不碰计时。
 */

export type ToastType = 'text' | 'loading' | 'success' | 'fail';
export type ToastPosition = 'top' | 'middle' | 'bottom';

export interface ToastOptions {
  /** 文案，可传字符串简写 */
  message: React.ReactNode;
  /** 类型，默认 text */
  type?: ToastType;
  /** 展示时长（ms），0 表示不自动关闭；loading 类型默认 0，其余默认 2000 */
  duration?: number;
  /** 位置，默认 top */
  position?: ToastPosition;
  /** H5 下是否禁止背景点击（配合透明拦截层） */
  forbidClick?: boolean;
  /** 自定义内容，覆盖默认的图标 + 文案结构 */
  content?: React.ReactNode;
  /** 关闭时回调 */
  onClose?: () => void;
  className?: string;
}

export interface ToastEntry extends ToastOptions {
  id: number;
}

export interface ToastHandle {
  id: number;
  close: () => void;
}

const DEFAULT_DURATION = 2000;

const EMPTY: ToastEntry[] = [];

let entries: ToastEntry[] = EMPTY;
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToastStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToastEntries(): readonly ToastEntry[] {
  return entries;
}

export function getToastServerEntries(): readonly ToastEntry[] {
  return EMPTY;
}

/** 测试 / 热重载用：清空全部 toast（含未触发的计时器） */
export function resetToastStore(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  entries = EMPTY;
  nextId = 1;
  emit();
}

function resolveDuration(options: ToastOptions): number {
  return resolveToastDuration(options.type, options.duration);
}

/**
 * 解析展示时长（跨模式共用的生命周期规则）
 * loading 默认常驻（Vant 行为），其余默认 2s
 */
export function resolveToastDuration(type: ToastType | undefined, duration?: number): number {
  if (duration !== undefined) return duration;
  return type === 'loading' ? 0 : DEFAULT_DURATION;
}

export function showToast(options: ToastOptions | string): ToastHandle {
  const normalized: ToastOptions =
    typeof options === 'string' ? { message: options } : options;

  const id = nextId;
  nextId += 1;

  entries = [...entries, { ...normalized, id }];
  emit();

  const duration = resolveDuration(normalized);
  if (duration > 0) {
    const timer = setTimeout(() => {
      timers.delete(id);
      closeToast(id);
    }, duration);
    timers.set(id, timer);
  }

  return { id, close: () => closeToast(id) };
}

/** 关闭指定 toast；不传 id 时关闭全部（Vant closeToast 语义） */
export function closeToast(id?: number): void {
  const targets =
    id === undefined ? entries : entries.filter((entry) => entry.id === id);

  if (targets.length === 0) return;

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

  const ids = new Set(targets.map((entry) => entry.id));
  entries = entries.filter((entry) => !ids.has(entry.id));
  emit();

  targets.forEach((entry) => entry.onClose?.());
}

/** 允许一次只保留一条（H5 胶囊语义：新提示替换旧提示） */
export function replaceToast(options: ToastOptions | string): ToastHandle {
  closeToast();
  return showToast(options);
}
