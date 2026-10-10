import * as React from "react";
import { cn } from "@/lib/utils";
import type { ActionSheetAction } from "@/hooks/use-action-sheet-store";

/**
 * ActionSheet 共用零件（跨模式共用，行高走 JS 分支而非 bv-h5:/bv-pc: 变体
 * —— 契约第 19/20 条：共用零件不依赖祖先是否带 data-mode）
 *
 * ┌ H5 ── 项高 48px（触控热区）
 * └ PC ── 项高 36px（桌面密度）
 */

export interface ActionSheetBodyProps {
  mode: "mobile" | "desktop";
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: ActionSheetAction[];
  /** 传 null / false 隐藏取消按钮 */
  cancelText?: React.ReactNode;
  onSelect?: (action: ActionSheetAction, index: number) => void;
  onCancel?: () => void;
}

function ActionRow({
  action,
  index,
  mode,
  onSelect,
}: {
  action: ActionSheetAction;
  index: number;
  mode: "mobile" | "desktop";
  onSelect?: (action: ActionSheetAction, index: number) => void;
}) {
  const {
    name,
    subname,
    color,
    disabled = false,
    loading = false,
    className,
  } = action;

  return (
    <button
      type="button"
      data-slot="action-sheet-item"
      // DOM 属性值契约是 h5|pc（DeviceMode 的 mobile/desktop 只用于 JS 分支与 props）
      data-mode={mode === "mobile" ? "h5" : "pc"}
      data-disabled={disabled ? "true" : "false"}
      data-loading={loading ? "true" : "false"}
      disabled={disabled || loading}
      onClick={() => onSelect?.(action, index)}
      className={cn(
        "flex w-full flex-col items-center justify-center border-0 bg-transparent",
        // min-h 而非 h：带 subname 的行要能撑开。固定高会把副文案裁在按钮盒外，
        // 溢出部分还会把 Popup 的滚动容器撑出一条假滚动条（2026-09-24 验证台实测）。
        mode === "mobile"
          ? "min-h-[48px] py-[10px]"
          : "min-h-[36px] py-[8px]",
        "px-bv-md text-center transition-colors duration-[var(--bv-popup-duration)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        index > 0 && "bv-hairline bv-hairline--top",
        className,
      )}
      style={{ ...(color ? { color } : null) }}
    >
      <span className="flex items-center gap-bv-sm">
        {loading ? (
          <span
            data-slot="action-sheet-item-spinner"
            aria-hidden="true"
            /* 转圈是加载状态的功能语义，不随 reduced-motion 停转（见 loading-parts 注释） */
            className="inline-block h-[14px] w-[14px] animate-spin rounded-bv-max border-2 border-current border-t-transparent"
          />
        ) : null}
        <span
          data-slot="action-sheet-item-name"
          className={cn(
            "text-bv-md leading-[var(--bv-line-md)]",
            color ? null : "text-bv-text",
          )}
          style={{ ...(color ? { color } : null) }}
        >
          {name}
        </span>
      </span>
      {subname !== undefined && subname !== null && subname !== "" ? (
        <span
          data-slot="action-sheet-item-subname"
          className="mt-[var(--bv-padding-base)] text-bv-xs leading-[var(--bv-line-sm)] text-bv-text-2"
        >
          {subname}
        </span>
      ) : null}
    </button>
  );
}

export function ActionSheetBody({
  mode,
  title,
  description,
  actions,
  cancelText,
  onSelect,
  onCancel,
}: ActionSheetBodyProps) {
  const hasHeader =
    (title !== undefined && title !== null && title !== "") ||
    (description !== undefined &&
      description !== null &&
      description !== "");

  const showCancel =
    cancelText !== null && cancelText !== false && cancelText !== undefined;

  return (
    <div
      data-slot="action-sheet-body"
      data-mode={mode === "mobile" ? "h5" : "pc"}
      className="flex flex-col"
    >
      {hasHeader ? (
        <div
          data-slot="action-sheet-header"
          className="flex flex-col items-center px-bv-md py-bv-sm bv-hairline bv-hairline--bottom"
        >
          {title !== undefined && title !== null && title !== "" ? (
            <span
              data-slot="action-sheet-title"
              className="text-bv-md font-bv-bold leading-[var(--bv-line-md)] text-bv-text"
            >
              {title}
            </span>
          ) : null}
          {description !== undefined &&
          description !== null &&
          description !== "" ? (
            <span
              data-slot="action-sheet-description"
              className="mt-bv-xs text-bv-sm leading-[var(--bv-line-sm)] text-bv-text-2"
            >
              {description}
            </span>
          ) : null}
        </div>
      ) : null}

      {actions && actions.length > 0 ? (
        <div data-slot="action-sheet-list" className="flex flex-col">
          {actions.map((action, index) => (
            <ActionRow
              key={index}
              action={action}
              index={index}
              mode={mode}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}

      {showCancel ? (
        <button
          type="button"
          data-slot="action-sheet-cancel"
          onClick={onCancel}
          className={cn(
            "mt-bv-sm w-full cursor-pointer border-0 bg-bv-background",
            mode === "mobile" ? "h-[48px]" : "h-[36px]",
            "text-bv-md leading-[var(--bv-line-md)] text-bv-text",
          )}
        >
          {cancelText}
        </button>
      ) : null}
    </div>
  );
}
