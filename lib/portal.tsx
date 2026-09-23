import type * as React from 'react';
import { createPortal } from 'react-dom';

/**
 * Bivane 统一 portal 容器
 *
 * 为什么不自接挂到 document.body：
 * 1. 后续需要插入自定义容器（如限定的弹层根、测试容器）时只改这一处；
 * 2. 便于卸载清理，避免 body 上散落匿名节点。
 *
 * ⚠️ 关键约束：portal 内容脱离了页面里 `[data-mode]` 的作用域。
 * 因此**每个弹层根元素都必须自带 `data-mode="h5|pc"`**（契约第 2 条），
 * 否则 tokens/styles/modes.css 里的 `[data-mode='pc']` 覆盖不会生效
 * （遮罩浓度、弹层圆角、动画时长会全部停在 H5 取值）。
 */

const PORTAL_ATTR = 'data-bivane-portal';

let cached: HTMLElement | null = null;

export function getPortalContainer(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  if (cached && cached.isConnected) return cached;

  const existing = document.querySelector<HTMLElement>(`[${PORTAL_ATTR}]`);
  if (existing) {
    cached = existing;
    return cached;
  }

  const el = document.createElement('div');
  el.setAttribute(PORTAL_ATTR, '');
  document.body.appendChild(el);
  cached = el;
  return cached;
}

export interface PortalProps {
  children: React.ReactNode;
}

export function Portal({ children }: PortalProps) {
  const target = getPortalContainer();
  if (!target) return null;
  return createPortal(children, target);
}
