import * as React from 'react';
import { Popup } from '@/components/responsive/popup';
import { ActionSheetBody } from '@/components/ui/action-sheet-parts';
import { useDeviceMode } from '@/hooks/use-device-mode';
import { ensureImperativeHost, useManualImperativeHost } from '@/lib/imperative-host';
import {
  closeActionSheet as closeActionSheetEntry,
  getActionSheetEntries,
  getActionSheetServerEntries,
  showActionSheet as showActionSheetEntry,
  subscribeActionSheetStore,
  updateActionSheet as updateActionSheetEntry,
  type ActionSheetAction,
  type ActionSheetEntry,
  type ActionSheetHandle,
  type ActionSheetOptions,
} from '@/hooks/use-action-sheet-store';

/**
 * Bivane ActionSheet · 模式 B（同一内容，换渲染壳）
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * ┌ H5 ── 底部弹层：动作列表 + 取消按钮分离，项高 48px
 * └ PC ── 居中对话框纵向列表，项高 36px
 *
 * PC 的「居中」由 Popup 统一承担（position 非 center 一律降级为 center），
 * 因此本组件两端只写明 position="bottom"，差异完全交给 Popup —— 这正是模式 B。
 *
 * 双轨 API（契约第 8 条 / 架构 §5）：
 *   声明式  <ActionSheet open actions onSelect />
 *   命令式  showActionSheet({ actions, onSelect }) / closeActionSheet(id?)
 */

const ACTION_SHEET_HOST_KEY = 'bivane-action-sheet';

/* ---------- 声明式 ---------- */

export interface ActionSheetProps extends ActionSheetOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const ActionSheet = React.forwardRef<HTMLDivElement, ActionSheetProps>(
  function ActionSheet(
    {
      open,
      defaultOpen = false,
      onOpenChange,
      title,
      description,
      actions,
      cancelText = '取消',
      closeOnClickAction = true,
      closeOnClickOverlay,
      closeOnPressEscape = true,
      zIndex,
      forceMode,
      className,
      onSelect,
      onCancel,
      onClosed,
    },
    ref,
  ) {
    const mode = useDeviceMode(forceMode);

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

    const handleSelect = React.useCallback(
      (action: ActionSheetAction, index: number) => {
        void onSelect?.(action, index);
        const shouldClose = action.closeOnClick ?? closeOnClickAction;
        if (shouldClose) setOpen(false);
      },
      [onSelect, closeOnClickAction, setOpen],
    );

    const handleCancel = React.useCallback(() => {
      onCancel?.();
      setOpen(false);
    }, [onCancel, setOpen]);

    return (
      <Popup
        ref={ref}
        open={opened}
        onOpenChange={setOpen}
        position="bottom"
        closeOnClickOverlay={closeOnClickOverlay}
        closeOnPressEscape={closeOnPressEscape}
        onClosed={onClosed}
        zIndex={zIndex}
        forceMode={forceMode}
        data-component="action-sheet"
        className={className}
      >
        <ActionSheetBody
          mode={mode}
          title={title}
          description={description}
          actions={actions}
          cancelText={cancelText}
          onSelect={handleSelect}
          onCancel={handleCancel}
        />
      </Popup>
    );
  },
);

/* ---------- 命令式 ---------- */

export function ActionSheetHost() {
  useManualImperativeHost(ACTION_SHEET_HOST_KEY);
  const entries = React.useSyncExternalStore(
    subscribeActionSheetStore,
    getActionSheetEntries,
    getActionSheetServerEntries,
  );

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry: ActionSheetEntry) => (
        <ActionSheet
          key={entry.id}
          {...entry.options}
          open
          onOpenChange={(next) => {
            if (!next) closeActionSheetEntry(entry.id);
          }}
        />
      ))}
    </>
  );
}

export function showActionSheet(options: ActionSheetOptions): ActionSheetHandle {
  ensureImperativeHost(ACTION_SHEET_HOST_KEY, <ActionSheetHost />);
  return showActionSheetEntry(options);
}

/** 关闭指定面板；不传 id 关闭全部 */
export function closeActionSheet(id?: number): void {
  closeActionSheetEntry(id);
}

/** 局部更新某个面板 */
export function updateActionSheet(id: number, next: Partial<ActionSheetOptions>): void {
  updateActionSheetEntry(id, next);
}

export type { ActionSheetAction, ActionSheetEntry, ActionSheetHandle, ActionSheetOptions };
