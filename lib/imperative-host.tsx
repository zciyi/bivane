import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';

/**
 * 命令式弹层宿主（架构文档 §5 双轨 API 的落地点）
 *
 * 问题：`showDialog()` / `showToast()` 这类命令式 API 在 React 树之外被调用，
 * 但渲染结果必须能读 `useDeviceMode()`（否则命令式弹层无法自适应）。
 *
 * 解法：宿主组件渲染在一个独立 root 里（默认），或者由使用方自行挂载以获得
 * 自己的 `<ResponsiveProvider>` 配置：
 *
 *   // 方式一：什么都不做，命令式 API 自动创建独立 root（默认断点 768）
 *   showToast('已保存');
 *
 *   // 方式二：在应用树内挂载宿主，继承你的 Provider 配置
 *   <ResponsiveProvider breakpoint={1200}>
 *     <App />
 *     <DialogHost />
 *     <ToastHost />
 *   </ResponsiveProvider>
 *
 * 两种方式不会同时生效：手动宿主挂载时，自动 root 会被卸载。
 */

interface AutoHost {
  root: Root;
  container: HTMLElement;
}

const manualCounts = new Map<string, number>();
const autoHosts = new Map<string, AutoHost>();

/** 供测试重置（同时清理已创建的 DOM 容器） */
export function resetImperativeHosts(): void {
  manualCounts.clear();
  autoHosts.forEach(({ root, container }) => {
    root.unmount();
    container.remove();
  });
  autoHosts.clear();
}

/**
 * 在宿主组件内部调用：声明「本 key 已有手动宿主」。
 * 挂载期间自动创建的 root 会被卸载，避免出现两份渲染结果。
 *
 * @param enabled 自动创建的宿主必须传 false —— 否则它会把自己当成手动宿主，
 *                挂载后立即卸载自己所在的 root，命令式 API 静默失效
 *                （这个坑在 tests/dialog.test.tsx 的「未挂载宿主时自动创建 root」里被抓到）。
 */
export function useManualImperativeHost(key: string, enabled = true): void {
  React.useEffect(() => {
    if (!enabled) return undefined;

    manualCounts.set(key, (manualCounts.get(key) ?? 0) + 1);
    removeAutoHost(key);

    return () => {
      const next = (manualCounts.get(key) ?? 1) - 1;
      if (next <= 0) manualCounts.delete(key);
      else manualCounts.set(key, next);
    };
  }, [key, enabled]);
}

function removeAutoHost(key: string): void {
  const host = autoHosts.get(key);
  if (!host) return;
  autoHosts.delete(key);
  host.root.unmount();
  host.container.remove();
}

/** 某个 key 当前是否由使用方手动挂载宿主（调试与测试用） */
export function hasManualImperativeHost(key: string): boolean {
  return (manualCounts.get(key) ?? 0) > 0;
}

/**
 * 命令式 API 在真正写入 store 之前调用：确保有宿主在渲染。
 * 已有手动宿主时不做任何事。
 */
export function ensureImperativeHost(key: string, element: React.ReactElement): void {
  if (typeof document === 'undefined') return;
  if ((manualCounts.get(key) ?? 0) > 0) return;
  if (autoHosts.has(key)) return;

  const container = document.createElement('div');
  container.setAttribute('data-bivane-host', key);
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(element);
  autoHosts.set(key, { root, container });
}
