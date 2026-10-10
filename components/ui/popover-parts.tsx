import * as React from "react";
import { cn } from "@/lib/utils";
import type { DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane Popover · 跨模式共用零件（交互定义见 bivane-responsive-matrix.md §2.1）
 *
 * 两端共享「面板里渲染什么」：自定义内容区 + actions 行列表（Vant Popover 的信息模型）。
 * 容器形态完全不同：H5 = 轻量气泡 / >3 行降级底部抽屉；PC = Radix 锚定浮层 —— 模式 C。
 *
 * 本文件只放纯渲染与一个无 DOM 依赖的形态判定纯函数；
 * 触发器契约（PopoverPanelProps）也在这里，供 h5/ 与 pc/ 各取所需。
 */

export type PopoverPlacement = "top" | "bottom" | "left" | "right";

export interface PopoverAction {
  /** 列表 key；不给时用下标 */
  key?: string | number;
  text: React.ReactNode;
  /** 行首图标，尺寸取 --bv-popover-row-icon-size（1em 跟随） */
  icon?: React.ReactNode;
  disabled?: boolean;
  /** 危险项：danger 色文字（复用 --bv-danger，不新增颜色 token） */
  danger?: boolean;
  onClick?: (action: PopoverAction) => void;
}

export interface PopoverPanelProps {
  mode: DeviceMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 自定义内容；与 actions 同时给出时渲染在列表上方 */
  content?: React.ReactNode;
  actions: PopoverAction[];
  /** 气泡优先展开方向（H5 抽屉形态忽略）；默认 bottom，翻转交 Radix Popper */
  placement: PopoverPlacement;
  /** 点中某一行（禁用行除外）：分发层负责回调与按需关闭 */
  onAction: (action: PopoverAction, index: number) => void;
  disabled: boolean;
  /**
   * H5 形态偏好（PC 恒锚定浮层，忽略）：
   * auto = 按内容量自动判定；bubble/drawer = 强制形态，跳过行数/高度判定与测量探针。
   */
  h5Form: PopoverFormPreference;
  /**
   * H5 自动分界时气泡允许的最大行数（仅 h5Form=auto 生效，PC 忽略）。
   * 未给由 H5 实现读 --bv-popover-h5-bubble-max-rows。
   */
  maxRows?: number;
  ariaLabel?: string;
  /** 面板类名（气泡 / 抽屉根面板都吃这个） */
  className?: string;
  children: React.ReactElement;
}

/** 气泡进出场所时长（镜像 --bv-popover-duration）：H5 气泡关闭后等它播完再卸载 */
export const POPOVER_TRANSITION_MS = 120;

/** 读取 :root 上的 px 型 token；jsdom 不做 CSS 级联，取值失败时回落兜底 */
export function readRootPx(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number.parseFloat(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name),
  );
  return Number.isFinite(value) ? value : fallback;
}

/** 读取 :root 上的无单位整数 token（如行数阈值）；非法 / 非正数时回落兜底 */
export function readRootInt(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const value = Number.parseInt(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name),
    10,
  );
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/* ------------------------------------------------------------------ *
 * H5 形态判定（纯函数）
 * ------------------------------------------------------------------ */

export type PopoverForm = "bubble" | "drawer";

/** auto = 按内容量自动分界；显式取值 = 业务强制形态（逃生舱，跳过测量） */
export type PopoverFormPreference = "auto" | PopoverForm;

export interface PopoverFormInput {
  actionCount: number;
  /**
   * 有自定义内容时，测量探针实测的面板整体高度（px）；
   * 纯 actions 形态给 null —— 此时行数是确定的，不需要测量。
   */
  measuredHeight: number | null;
  /** H5 行高（--bv-popover-h5-row-height）；高度阈值 = 行高 × maxRows */
  rowHeight: number;
  /** 气泡形态允许的最大行数（事实源 --bv-popover-h5-bubble-max-rows，prop 可覆盖） */
  maxRows: number;
  /** 形态偏好，默认 auto；显式 bubble/drawer 直接短路 */
  preference?: PopoverFormPreference;
}

/**
 * 矩阵 §2.1：内容 > maxRows 行走底部抽屉，否则轻量气泡。
 * 纯 actions：直接数行；带自定义内容：以实测高度对 maxRows 行高度阈值判定。
 * preference 显式给 bubble/drawer 时短路 —— 业务比规则更清楚该用什么形态。
 */
export function resolvePopoverForm({
  actionCount,
  measuredHeight,
  rowHeight,
  maxRows,
  preference = "auto",
}: PopoverFormInput): PopoverForm {
  if (preference !== "auto") return preference;
  if (measuredHeight !== null) {
    return measuredHeight > rowHeight * maxRows ? "drawer" : "bubble";
  }
  return actionCount > maxRows ? "drawer" : "bubble";
}

/* ------------------------------------------------------------------ *
 * 面板外观
 * ------------------------------------------------------------------ */

/** 锚定气泡外壳（H5 轻量气泡与 PC 浮层共用；H5 抽屉由 Popup 提供外壳） */
export function popoverBubbleClass(mode: DeviceMode): string {
  return cn(
    "box-border overflow-hidden rounded-[var(--bv-popover-radius)]",
    "border border-bv-border bg-bv-surface shadow-[var(--bv-popover-shadow)]",
    "z-[var(--bv-popover-z-index)]",
    "max-h-[var(--bv-popover-panel-max-height)] overflow-y-auto overscroll-contain",
    mode === "mobile"
      ? "max-w-[var(--bv-popover-h5-bubble-max-width)]"
      : "min-w-[var(--bv-popover-pc-panel-min-width)] max-w-[var(--bv-popover-pc-panel-max-width)]",
  );
}

function rowClass(
  mode: DeviceMode,
  danger: boolean,
  disabled: boolean,
): string {
  return cn(
    "relative flex w-full items-center border-0 bg-bv-surface text-left",
    // 行高两套密度各写各的（模式 C，不在类名上共存）
    mode === "mobile"
      ? "h-[var(--bv-popover-h5-row-height)]"
      : "h-[var(--bv-popover-pc-row-height)] hover:bg-bv-muted",
    "gap-[var(--bv-popover-row-gap)] px-[var(--bv-popover-row-padding-x)]",
    "text-bv-md text-bv-text active:bg-bv-active",
    danger && "text-bv-danger",
    disabled ? "cursor-not-allowed text-bv-text-3" : "cursor-pointer",
  );
}

export interface PopoverBodyProps {
  mode: DeviceMode;
  content?: React.ReactNode;
  actions: PopoverAction[];
  onAction: (action: PopoverAction, index: number) => void;
}

/** 面板内容：自定义内容区（有内边距）+ flush 的 actions 行列表（行间发丝线） */
export function PopoverBody({
  mode,
  content,
  actions,
  onAction,
}: PopoverBodyProps) {
  return (
    <div
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-slot="popover-body"
    >
      {content != null ? (
        <div
          data-slot="popover-content"
          className={cn(
            "px-[var(--bv-popover-content-padding-x)]",
            "py-[var(--bv-popover-content-padding-y)]",
            "text-bv-md leading-[var(--bv-line-md)] text-bv-text",
          )}
        >
          {content}
        </div>
      ) : null}

      {actions.length > 0 ? (
        <div data-slot="popover-actions" role="group">
          {actions.map((action, index) => {
            const isDisabled = action.disabled === true;
            const key = action.key ?? index;
            return (
              <button
                key={key}
                type="button"
                data-slot="popover-action"
                data-danger={action.danger ? "true" : undefined}
                disabled={isDisabled}
                aria-disabled={isDisabled || undefined}
                onClick={() => {
                  if (isDisabled) return;
                  onAction(action, index);
                }}
                className={cn(
                  rowClass(
                    mode,
                    action.danger === true,
                    isDisabled,
                  ),
                  // 末行不画分割发丝线
                  index < actions.length - 1 &&
                    "bv-hairline bv-hairline--bottom",
                )}
              >
                {action.icon != null ? (
                  <span
                    aria-hidden="true"
                    data-slot="popover-action-icon"
                    className="shrink-0 text-[length:var(--bv-popover-row-icon-size)]"
                  >
                    {action.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">
                  {action.text}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
