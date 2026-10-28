import type * as React from 'react';
import type { DeviceMode } from '@/hooks/use-device-mode';

/**
 * Bivane 命令式 Dialog 状态存储（纯逻辑，不含 React 组件）
 *
 * 与组件分离的原因：`components/responsive/dialog.tsx` 既要用 store，
 * 又要为命令式 API 提供宿主组件。若 store 反过来引用组件就会形成循环依赖。
 * 这里只做「存 + 通知」，渲染完全交给 dialog.tsx。
 */

export type DialogAction = 'confirm' | 'cancel';

export interface DialogOptions {
  title?: React.ReactNode;
  /** 主体文案（Vant 命名） */
  message?: React.ReactNode;
  /** 主体文案（矩阵命名，与 message 同义且优先） */
  description?: React.ReactNode;
  /** 自定义主体，优先于 message / description */
  content?: React.ReactNode;
  /** 自定义主体（React 节点），与 Dialog 组件 children 同义且优先 */
  children?: React.ReactNode;
  /** 自定义底部，覆盖默认按钮区 */
  footer?: React.ReactNode;
  showConfirmButton?: boolean;
  confirmText?: string;
  showCancelButton?: boolean;
  cancelText?: string;
  /** 返回 false 可阻止关闭（支持异步） */
  beforeClose?: (action: DialogAction) => boolean | Promise<boolean>;
  onConfirm?: () => void;
  onCancel?: () => void;
  onClosed?: () => void;
  closeOnClickOverlay?: boolean;
  closeOnPressEscape?: boolean;
  overlay?: boolean;
  lockScroll?: boolean;
  duration?: number;
  zIndex?: number;
  forceMode?: DeviceMode;
  className?: string;
}

export interface DialogEntry {
  /** 弹窗实例标识 */
  id: number;
  /** 弹窗配置 */
  options: DialogOptions;
  /** 是否处于打开状态；关闭后由宿主完成清理 */
  open: boolean;
}

export interface DialogHandle {
  id: number;
  /** 关闭该弹窗 */
  close: () => void;
  /** 局部更新配置（如按钮 loading、文案变化） */
  update: (next: Partial<DialogOptions>) => void;
}

const EMPTY: DialogEntry[] = [];

let entries: DialogEntry[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeDialogStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDialogEntries(): readonly DialogEntry[] {
  return entries;
}

export function getDialogServerEntries(): readonly DialogEntry[] {
  return EMPTY;
}

/** 测试 / 热重载用：清空全部弹窗 */
export function resetDialogStore(): void {
  entries = EMPTY;
  nextId = 1;
  emit();
}

export function showDialog(options: DialogOptions): DialogHandle {
  const id = nextId;
  nextId += 1;

  entries = [...entries, { id, options, open: true }];
  emit();

  return {
    id,
    close: () => closeDialog(id),
    update: (next) => updateDialog(id, next),
  };
}

/** 确认式弹窗：Vant 的 showConfirmDialog 等价物 */
export function showConfirmDialog(
  options: DialogOptions & { message?: React.ReactNode },
): DialogHandle {
  return showDialog({ showCancelButton: true, ...options });
}

/** 关闭指定弹窗；不传 id 时关闭全部（Vant closeDialog 语义） */
export function closeDialog(id?: number): void {
  let changed = false;
  const next = entries.map((entry) => {
    if (!entry.open || (id !== undefined && entry.id !== id)) return entry;
    changed = true;
    return { ...entry, open: false };
  });
  if (!changed) return;
  entries = next;
  emit();
}

/** 宿主已提交关闭状态后清理，先删除条目以防回调重入导致重复通知。 */
export function finishDialogClose(id: number): void {
  const entry = entries.find((item) => item.id === id);
  if (!entry || entry.open) return;
  entries = entries.filter((item) => item.id !== id);
  emit();
  entry.options.onClosed?.();
}

export function updateDialog(id: number, next: Partial<DialogOptions>): void {
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
