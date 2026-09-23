import * as React from 'react';
import { Portal } from '@/lib/portal';
import { H5ToastPresenter } from '@/components/h5/toast';
import { PcToastStack } from '@/components/pc/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
import { ensureImperativeHost, useManualImperativeHost } from '@/lib/imperative-host';
import {
  closeToast as closeToastEntry,
  getToastEntries,
  getToastServerEntries,
  resolveToastDuration,
  showToast as showToastEntry,
  subscribeToastStore,
  type ToastEntry,
  type ToastHandle,
  type ToastOptions,
  type ToastType,
} from '@/hooks/use-toast-store';

/**
 * Bivane Toast · 分发层（模式 C）
 *
 * ┌ H5 ── 顶部居中胶囊，白字深底，2s 自动消失，单例（新的覆盖旧的）
 * └ PC ── 右上角卡片栈，带关闭按钮，可多条并存
 *
 * 本文件只做「按模式分发 + 暴露双轨 API」，
 * 两种形态的视觉分别在 components/h5/toast.tsx 与 components/pc/toast.tsx。
 *
 * 双轨 API（契约第 8 条 / 架构 §5）：
 *   声明式  <Toast open message type onOpenChange />
 *   命令式  showToast('已保存') / showSuccessToast / showFailToast / showLoadingToast / closeToast
 */

const TOAST_HOST_KEY = 'bivane-toast';

/**
 * 命令式 toast 宿主。
 *
 * 默认不需要手动挂载（`showToast()` 会自动创建独立 root）；
 * 若希望 toast 继承你的 `<ResponsiveProvider>` 配置（例如断点 1200），
 * 在应用树内挂载一次即可。
 */
export function ToastHost() {
  useManualImperativeHost(TOAST_HOST_KEY);
  const items = React.useSyncExternalStore(
    subscribeToastStore,
    getToastEntries,
    getToastServerEntries,
  );
  const mode = useDeviceMode();

  if (items.length === 0) return null;

  return (
    <Portal>
      {mode === 'mobile' ? (
        // H5 单例：只呈现最新一条（更早的条目仍由 store 计时回收）
        <H5ToastPresenter item={items[items.length - 1] ?? null} />
      ) : (
        <PcToastStack items={items} onClose={closeToastEntry} />
      )}
    </Portal>
  );
}

/* ---------- 声明式 ---------- */

export interface ToastProps extends Omit<ToastOptions, 'message'> {
  message: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Toast({
  open,
  defaultOpen = false,
  onOpenChange,
  message,
  type = 'text',
  duration,
  position = 'top',
  forbidClick = false,
  content,
  className,
}: ToastProps) {
  const mode = useDeviceMode();

  const isControlled = open !== undefined;
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
  const opened = isControlled ? open : innerOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  React.useEffect(() => {
    if (!opened) return undefined;
    const wait = resolveToastDuration(type, duration);
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setOpen(false), wait);
    return () => clearTimeout(timer);
  }, [opened, type, duration, setOpen]);

  if (!opened) return null;

  const item: ToastEntry = { id: 0, message, type, position, forbidClick, content, className };

  return (
    <Portal>
      {mode === 'mobile' ? (
        <H5ToastPresenter item={item} />
      ) : (
        <PcToastStack items={[item]} onClose={() => setOpen(false)} />
      )}
    </Portal>
  );
}

/* ---------- 命令式 ---------- */

function withType(options: Omit<ToastOptions, 'type'> | string, type: ToastType): ToastOptions {
  return typeof options === 'string' ? { message: options, type } : { ...options, type };
}

export function showToast(options: ToastOptions | string): ToastHandle {
  ensureImperativeHost(TOAST_HOST_KEY, <ToastHost />);
  return showToastEntry(options);
}

export function showSuccessToast(options: Omit<ToastOptions, 'type'> | string): ToastHandle {
  return showToast(withType(options, 'success'));
}

export function showFailToast(options: Omit<ToastOptions, 'type'> | string): ToastHandle {
  return showToast(withType(options, 'fail'));
}

/** 加载提示：默认常驻，需显式 closeToast(id) 或传 duration 才会消失（Vant 行为） */
export function showLoadingToast(options: Omit<ToastOptions, 'type'> | string): ToastHandle {
  return showToast(withType(options, 'loading'));
}

/** 关闭指定 toast；不传 id 关闭全部 */
export function closeToast(id?: number): void {
  closeToastEntry(id);
}

export type { ToastEntry, ToastHandle, ToastOptions, ToastPosition, ToastType } from '@/hooks/use-toast-store';
