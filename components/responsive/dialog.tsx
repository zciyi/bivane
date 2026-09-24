import * as React from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popup } from '@/components/responsive/popup';
import { DRAG_REGION_ATTR } from '@/hooks/use-drag-to-dismiss';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import { ensureImperativeHost, useManualImperativeHost } from '@/lib/imperative-host';
import {
  closeDialog as closeDialogEntry,
  getDialogEntries,
  getDialogServerEntries,
  showConfirmDialog as showConfirmDialogEntry,
  showDialog as showDialogEntry,
  subscribeDialogStore,
  type DialogAction,
  type DialogHandle,
  type DialogOptions,
} from '@/hooks/use-dialog-store';

/**
 * Bivane Dialog · 模式 B（同一状态机 + 内容，换渲染壳）
 * 交互定义见 bivane-responsive-matrix.md §2.1 与 §3.2
 *
 * ┌ H5 ── 底部抽屉（复用 Popup 的 bottom 形态）：下拉关闭、顶部圆角与拖拽指示条、
 * │        内容超出时内部滚动、按钮纵向排列
 * └ PC ── 居中模态（Radix Dialog 底座）：480~560px、ESC / 遮罩关闭、焦点陷阱、
 *          打开动画 200ms 淡入缩放、按钮横向右对齐（主按钮在右）
 *
 * 双轨 API（契约第 8 条 / 架构 §5）：
 *   声明式  <Dialog open onOpenChange title ... />
 *   命令式  showDialog({...}) / showConfirmDialog({...}) / closeDialog(id?)
 *   两者复用同一渲染逻辑，命令式仅多一层 store + 宿主。
 */

const DIALOG_HOST_KEY = 'bivane-dialog';

export interface DialogProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'title' | 'content'> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: React.ReactNode;
  /** 主体文案（Vant 命名） */
  message?: React.ReactNode;
  /** 主体文案（矩阵命名，与 message 同义且优先） */
  description?: React.ReactNode;
  /** 自定义底部，覆盖默认按钮区 */
  footer?: React.ReactNode;
  showConfirmButton?: boolean;
  confirmText?: string;
  showCancelButton?: boolean;
  cancelText?: string;
  /** 返回 false 可阻止关闭，支持异步（异步期间确认按钮进入 loading） */
  beforeClose?: (action: DialogAction) => boolean | Promise<boolean>;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** 退场动画结束后回调 */
  onClosed?: () => void;
  /** 点击遮罩关闭；不传时 H5 默认 true、PC 默认 false */
  closeOnClickOverlay?: boolean;
  /** ESC 关闭，默认 true */
  closeOnPressEscape?: boolean;
  overlay?: boolean;
  lockScroll?: boolean;
  /** 进出场时长（ms），传 0 关闭动画 */
  duration?: number;
  zIndex?: number;
  forceMode?: DeviceMode;
  children?: React.ReactNode;
}

/* ---------- 内部纯展示件（无 hooks，双模式共用） ---------- */

function DialogHeader({
  id,
  title,
  dragRegion,
}: {
  id: string;
  title: React.ReactNode;
  dragRegion: boolean;
}) {
  return (
    <div
      id={id}
      data-slot="dialog-header"
      className={cn(
        'shrink-0 px-[var(--bv-dialog-message-padding-x)] pt-[var(--bv-dialog-header-padding-top)]',
        'text-center text-bv-lg font-bv-bold leading-[var(--bv-dialog-header-line-height)] text-bv-text',
        dragRegion && 'touch-none',
      )}
      {...(dragRegion ? { [DRAG_REGION_ATTR]: '' } : null)}
    >
      {title}
    </div>
  );
}

function DialogBody({
  hasTitle,
  children,
}: {
  hasTitle: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        'min-h-0 overflow-y-auto text-center text-bv-md leading-[var(--bv-dialog-message-line-height)]',
        'max-h-[var(--bv-dialog-message-max-height)]',
        'px-[var(--bv-dialog-message-padding-x)] pb-[var(--bv-dialog-message-padding-y)]',
        hasTitle
          ? 'pt-[var(--bv-dialog-has-title-message-padding-top)] text-[var(--bv-dialog-has-title-message-color)]'
          : 'pt-[var(--bv-dialog-message-padding-y)] text-bv-text',
      )}
    >
      {children}
    </div>
  );
}

interface DialogFooterProps {
  layout: 'stack' | 'row';
  confirm: React.ReactNode | null;
  cancel: React.ReactNode | null;
}

function DialogFooter({ layout, confirm, cancel }: DialogFooterProps) {
  if (!confirm && !cancel) return null;

  if (layout === 'stack') {
    // H5：纵向铺满，Vant 顺序为「确认在上、取消在下」
    return (
      <div
        data-slot="dialog-footer"
        data-layout="stack"
        className="mt-bv-xs flex shrink-0 flex-col"
      >
        {confirm}
        {cancel}
      </div>
    );
  }

  // PC：横向右对齐，主按钮在最右
  return (
    <div
      data-slot="dialog-footer"
      data-layout="row"
      className={cn(
        'mt-bv-md flex shrink-0 items-center justify-end gap-bv-gutter',
        'px-[var(--bv-dialog-message-padding-x)] pb-[var(--bv-dialog-message-padding-y)]',
      )}
    >
      {cancel}
      {confirm}
    </div>
  );
}

/* ---------- Dialog ---------- */

export const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(function Dialog(
  {
    open,
    defaultOpen = false,
    onOpenChange,
    title,
    message,
    description,
    footer,
    showConfirmButton = true,
    confirmText = '确认',
    showCancelButton = false,
    cancelText = '取消',
    beforeClose,
    onConfirm,
    onCancel,
    onClosed,
    closeOnClickOverlay,
    closeOnPressEscape = true,
    overlay = true,
    lockScroll = true,
    duration,
    zIndex,
    forceMode,
    className,
    children,
    ...props
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const isMobile = mode === 'mobile';

  const isControlled = open !== undefined;
  const [innerOpen, setInnerOpen] = React.useState(defaultOpen);
  const opened = isControlled ? open : innerOpen;

  const [pending, setPending] = React.useState(false);
  const titleId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInnerOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  /** 仅关闭，不触发 confirm/cancel（遮罩、ESC、关闭按钮走这里） */
  const closeOnly = React.useCallback(() => setOpen(false), [setOpen]);

  const requestAction = React.useCallback(
    (action: DialogAction) => {
      setPending(true);
      void (async () => {
        try {
          const allowed = await beforeClose?.(action);
          if (allowed === false) return;
          setOpen(false);
          if (action === 'confirm') onConfirm?.();
          else onCancel?.();
        } finally {
          setPending(false);
        }
      })();
    },
    [beforeClose, onConfirm, onCancel, setOpen],
  );

  // onClosed：两种壳的退场时机不同（Popup 有 onClosed、Radix 用 Presence），
  // 这里统一按「opened 由 true → false」判定，保证双模式可观测行为一致。
  const prevOpenRef = React.useRef(opened);
  React.useEffect(() => {
    if (prevOpenRef.current && !opened) onClosed?.();
    prevOpenRef.current = opened;
  }, [opened, onClosed]);

  const body = children ?? description ?? message;
  const hasTitle = title !== undefined && title !== null && title !== '';
  const hasBody = body !== undefined && body !== null && body !== '';

  const confirmButton = showConfirmButton ? (
    <Button
      type="primary"
      plain={isMobile}
      block={isMobile}
      size="normal"
      loading={pending}
      onClick={() => requestAction('confirm')}
      className={cn(
        isMobile
          ? cn(
              'h-[var(--bv-dialog-button-height)] rounded-none border-0',
              'bv-hairline bv-hairline--top',
              'text-[var(--bv-dialog-confirm-button-color)]',
            )
          : 'min-w-[var(--bv-dialog-button-min-width)]',
      )}
    >
      {confirmText}
    </Button>
  ) : null;

  const cancelButton = showCancelButton ? (
    <Button
      type="default"
      plain={isMobile}
      block={isMobile}
      size="normal"
      disabled={pending}
      onClick={() => requestAction('cancel')}
      className={cn(
        isMobile
          ? 'h-[var(--bv-dialog-button-height)] rounded-none border-0 bv-hairline bv-hairline--top'
          : 'min-w-[var(--bv-dialog-button-min-width)]',
      )}
    >
      {cancelText}
    </Button>
  ) : null;

  const resolvedFooter =
    footer ?? (
      <DialogFooter
        layout={isMobile ? 'stack' : 'row'}
        confirm={confirmButton}
        cancel={cancelButton}
      />
    );

  /* ---------- H5：底部抽屉 ---------- */
  if (isMobile) {
    return (
      <Popup
        ref={ref}
        open={opened}
        onOpenChange={setOpen}
        position="bottom"
        overlay={overlay}
        lockScroll={lockScroll}
        closeOnClickOverlay={closeOnClickOverlay}
        closeOnPressEscape={closeOnPressEscape}
        duration={duration}
        zIndex={zIndex}
        forceMode={forceMode}
        aria-labelledby={titleId}
        data-component="dialog"
        data-variant="sheet"
        className={cn('max-h-[var(--bv-popup-max-height)]', className)}
        {...props}
      >
        {hasTitle ? <DialogHeader id={titleId} title={title} dragRegion /> : null}
        {hasBody ? <DialogBody hasTitle={hasTitle}>{body}</DialogBody> : null}
        {resolvedFooter}
      </Popup>
    );
  }

  /* ---------- PC：居中模态 ---------- */
  const overlayCloses = closeOnClickOverlay ?? false;

  return (
    <RadixDialog.Root
      open={opened}
      onOpenChange={(next) => {
        if (!next) closeOnly();
      }}
    >
      <RadixDialog.Portal>
        {overlay ? (
          <RadixDialog.Overlay
            // 遮罩槽名必须与 tokens/styles/utilities.css 的进场动画选择器一致
            // （[data-slot='dialog-overlay'][data-state]），否则动画静默失效。
            data-slot="dialog-overlay"
            // Portal 逃出 [data-mode] 作用域，须自带才能吃到 PC 的 0.45 浓度与 200ms 时长
            data-mode="pc"
            className="fixed inset-0 bg-bv-overlay"
            style={{ zIndex: zIndex ?? 'var(--bv-overlay-z-index)' }}
            onClick={overlayCloses ? closeOnly : undefined}
          />
        ) : null}

        <div
          data-slot="dialog-viewport"
          className="pointer-events-none fixed inset-0 flex items-center justify-center p-bv-md"
          style={{ zIndex: zIndex ?? 'var(--bv-popup-z-index)' }}
        >
          <RadixDialog.Content
            ref={ref}
            data-slot="dialog"
            data-component="dialog"
            data-mode="pc"
            data-variant="modal"
            // hasBody 为假时不渲染 Description，需显式传 aria-describedby={undefined}
            // 抑制 Radix 的「Missing Description or aria-describedby」开发期警告
            {...(!hasBody ? { 'aria-describedby': undefined } : null)}
            onEscapeKeyDown={(event) => {
              if (!closeOnPressEscape) event.preventDefault();
            }}
            className={cn(
              'pointer-events-auto flex w-full max-w-[var(--bv-dialog-pc-width)] flex-col overflow-hidden',
              'rounded-[var(--bv-popup-pc-radius)] bg-bv-surface shadow-[var(--bv-popup-pc-shadow)] outline-none',
              className,
            )}
            {...props}
          >
            <RadixDialog.Title asChild>
              <div
                data-slot="dialog-header"
                className={cn(
                  'shrink-0 px-[var(--bv-dialog-message-padding-x)] pt-[var(--bv-dialog-header-padding-top)]',
                  'text-center text-bv-lg font-bv-bold leading-[var(--bv-dialog-header-line-height)] text-bv-text',
                )}
              >
                {hasTitle ? title : <span className="sr-only">对话框</span>}
              </div>
            </RadixDialog.Title>

            {hasBody ? (
              <RadixDialog.Description asChild>
                <DialogBody hasTitle={hasTitle}>{body}</DialogBody>
              </RadixDialog.Description>
            ) : null}

            {resolvedFooter}
          </RadixDialog.Content>
        </div>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
});

/* ---------- 命令式宿主 + API ---------- */

/**
 * 命令式弹窗宿主。
 *
 * 默认不需要手动挂载：`showDialog()` 会自动创建一个独立 React root。
 * 若希望命令式弹窗继承你的 `<ResponsiveProvider>` 配置（例如断点改成 1200），
 * 在应用树内挂载一次即可：
 *
 *   <ResponsiveProvider breakpoint={1200}>
 *     <App />
 *     <DialogHost />
 *   </ResponsiveProvider>
 */
export interface DialogHostProps {
  /**
   * 由 showDialog 自动创建的宿主会带此标记。
   * 自动宿主不能把自己登记为「手动宿主」，否则它会卸载掉自己所在的 root。
   * 使用方手动挂载时不要传。
   */
  auto?: boolean;
}

export function DialogHost({ auto = false }: DialogHostProps = {}) {
  useManualImperativeHost(DIALOG_HOST_KEY, !auto);
  const entries = React.useSyncExternalStore(
    subscribeDialogStore,
    getDialogEntries,
    getDialogServerEntries,
  );

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <Dialog
          key={entry.id}
          {...entry.options}
          open
          onOpenChange={(next) => {
            if (!next) closeDialogEntry(entry.id);
          }}
        />
      ))}
    </>
  );
}

/** 命令式：打开一个对话框 */
export function showDialog(options: DialogOptions): DialogHandle {
  ensureImperativeHost(DIALOG_HOST_KEY, <DialogHost auto />);
  return showDialogEntry(options);
}

/**
 * 命令式：提示框（Alert 语义）
 *
 * 矩阵 §2.1 的 Alert/Confirm 复用 Dialog 底座：两者渲染逻辑与按钮序完全一致
 * （H5 纵向「确认在上、取消在下」；PC 横向右对齐且主按钮在右），
 * 差别只在默认是否带取消按钮 —— Alert 只有一个确认按钮。
 */
export function showAlertDialog(options: DialogOptions): DialogHandle {
  ensureImperativeHost(DIALOG_HOST_KEY, <DialogHost auto />);
  return showDialogEntry({ showCancelButton: false, ...options });
}

/** 命令式：打开确认对话框（Confirm 语义，默认带取消按钮） */
export function showConfirmDialog(options: DialogOptions): DialogHandle {
  ensureImperativeHost(DIALOG_HOST_KEY, <DialogHost auto />);
  return showConfirmDialogEntry(options);
}

/** 命令式：关闭指定对话框；不传 id 关闭全部 */
export function closeDialog(id?: number): void {
  closeDialogEntry(id);
}

export type { DialogAction, DialogHandle, DialogOptions };
