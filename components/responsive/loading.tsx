import * as React from 'react';
import { Portal } from '@/lib/portal';
import { LoadingOverlay } from '@/components/ui/loading-parts';
import { useDeviceMode } from '@/hooks/use-device-mode';
import { ensureImperativeHost, useManualImperativeHost } from '@/lib/imperative-host';
import {
  getLoadingEntries,
  getLoadingServerEntries,
  hideLoading as hideLoadingEntry,
  showLoading as showLoadingEntry,
  subscribeLoadingStore,
  updateLoading as updateLoadingEntry,
  type LoadingEntry,
  type LoadingHandle,
  type LoadingOptions,
} from '@/hooks/use-loading-store';

/**
 * Bivane Loading · 模式 A/B
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * ┌ H5 ── 全屏遮罩（rgba(0,0,0,.7)）+ 居中转圈 + 可选文案
 * └ PC ── 同形态（矩阵「局部骨架屏优先、全屏遮罩降级」中的降级路径）
 *
 * 两种模式视觉一致，差异仅在遮罩浓度（bg-bv-overlay 的 [data-mode='pc'] 覆盖）。
 * 遮罩点击不关闭，必须显式 hideLoading(id) —— 与 Vant showLoadingToast 同语义。
 *
 * 双轨 API（契约第 8 条 / 架构 §5）：
 *   声明式  <Loading open text mask />
 *   命令式  showLoading({ text }) / hideLoading(id?) / updateLoading(id, next)
 */

const LOADING_HOST_KEY = 'bivane-loading';

/**
 * 命令式 loading 宿主。
 *
 * 默认不需要手动挂载（`showLoading()` 会自动创建独立 root）；
 * 若希望继承你的 `<ResponsiveProvider>` 配置（例如断点 1200），
 * 在应用树内挂载一次即可。
 */
export function LoadingHost() {
  useManualImperativeHost(LOADING_HOST_KEY);
  const items = React.useSyncExternalStore(
    subscribeLoadingStore,
    getLoadingEntries,
    getLoadingServerEntries,
  );
  const mode = useDeviceMode();

  if (items.length === 0) return null;

  // 单例观感：多条并存时只呈现最新一条
  const item = items[items.length - 1];

  return (
    <Portal>
      <LoadingOverlay item={item} mode={mode} />
    </Portal>
  );
}

/* ---------- 声明式 ---------- */

export interface LoadingProps extends LoadingOptions {
  /** 是否展示（受控） */
  open?: boolean;
}

/**
 * 声明式全屏 loading。
 * 不受命令式 store 影响，open 为真即渲染遮罩 + 转圈。
 */
export function Loading({ open = false, text, mask, forbidClick, zIndex, className }: LoadingProps) {
  const mode = useDeviceMode();

  if (!open) return null;

  const item: LoadingEntry = {
    id: 0,
    options: { text, mask, forbidClick, zIndex, className },
  };

  return (
    <Portal>
      <LoadingOverlay item={item} mode={mode} />
    </Portal>
  );
}

/* ---------- 命令式 ---------- */

/** 命令式：显示 loading（默认常驻，需 hideLoading 关闭） */
export function showLoading(options: LoadingOptions = {}): LoadingHandle {
  ensureImperativeHost(LOADING_HOST_KEY, <LoadingHost />);
  return showLoadingEntry(options);
}

/** 命令式：关闭指定 loading；不传 id 关闭全部 */
export function hideLoading(id?: number): void {
  hideLoadingEntry(id);
}

/** 命令式：局部更新某条 loading（例如动态改文案） */
export function updateLoading(id: number, next: Partial<LoadingOptions>): void {
  updateLoadingEntry(id, next);
}

export type { LoadingEntry, LoadingHandle, LoadingOptions };
