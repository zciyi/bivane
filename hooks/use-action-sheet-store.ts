import type * as React from 'react';
import type { DeviceMode } from '@/hooks/use-device-mode';

/**
 * Bivane 命令式 ActionSheet 状态存储（纯逻辑，不含 React 组件）
 *
 * 与组件分离的原因同 use-dialog-store：避免 store 与渲染组件互引成环。
 * 这里只做「存 + 通知」，渲染交给 responsive/action-sheet.tsx。
 */

export interface ActionSheetAction {
  /** 主文案 */
  name: React.ReactNode;
  /** 副文案 */
  subname?: React.ReactNode;
  /** 该行文字色（危险操作常用 --bv-danger） */
  color?: string;
  disabled?: boolean;
  loading?: boolean;
  /** 覆盖组件级 closeOnClickAction */
  closeOnClick?: boolean;
  className?: string;
}

export interface ActionSheetOptions {
  /** 顶部标题 */
  title?: React.ReactNode;
  /** 标题下方副文案 */
  description?: React.ReactNode;
  /** 选项列表 */
  actions?: ActionSheetAction[];
  /** 取消按钮文案；传 null / false 隐藏取消 */
  cancelText?: React.ReactNode;
  /** 点击选项后是否自动关闭，默认 true */
  closeOnClickAction?: boolean;
  /** 点击遮罩是否关闭；不传时 H5 默认 true、PC 默认 false */
  closeOnClickOverlay?: boolean;
  /** 是否按 ESC 关闭，默认 true */
  closeOnPressEscape?: boolean;
  /** 层级，默认用 --bv-overlay-z-index */
  zIndex?: number;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
  /** 自定义类名（透传弹层面板） */
  className?: string;
  /** 选中某项（在关闭之前触发） */
  onSelect?: (action: ActionSheetAction, index: number) => void | Promise<void>;
  /** 点取消按钮（在关闭之前触发） */
  onCancel?: () => void;
  /** 退场动画结束、节点卸载后回调 */
  onClosed?: () => void;
}

export interface ActionSheetEntry {
  id: number;
  options: ActionSheetOptions;
}

export interface ActionSheetHandle {
  id: number;
  close: () => void;
  update: (next: Partial<ActionSheetOptions>) => void;
}

const EMPTY: ActionSheetEntry[] = [];

let entries: ActionSheetEntry[] = EMPTY;
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeActionSheetStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActionSheetEntries(): readonly ActionSheetEntry[] {
  return entries;
}

export function getActionSheetServerEntries(): readonly ActionSheetEntry[] {
  return EMPTY;
}

/** 测试 / 热重载用：清空全部 */
export function resetActionSheetStore(): void {
  entries = EMPTY;
  nextId = 1;
  emit();
}

export function showActionSheet(options: ActionSheetOptions): ActionSheetHandle {
  const id = nextId;
  nextId += 1;

  entries = [...entries, { id, options }];
  emit();

  return {
    id,
    close: () => closeActionSheet(id),
    update: (next) => updateActionSheet(id, next),
  };
}

/** 关闭指定面板；不传 id 关闭全部 */
export function closeActionSheet(id?: number): void {
  const next = id === undefined ? EMPTY : entries.filter((entry) => entry.id !== id);
  if (next === entries) return;
  entries = next;
  emit();
}

export function updateActionSheet(id: number, next: Partial<ActionSheetOptions>): void {
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
