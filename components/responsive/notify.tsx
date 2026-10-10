import * as React from "react";
import { cn } from "@/lib/utils";
import { Portal } from "@/lib/portal";
import { NotifyItem } from "@/components/ui/notify-parts";
import { useDeviceMode } from "@/hooks/use-device-mode";
import {
  ensureImperativeHost,
  useManualImperativeHost,
} from "@/lib/imperative-host";
import {
  closeNotify as closeNotifyEntry,
  getNotifyEntries,
  getNotifyServerEntries,
  resolveNotifyDuration,
  showNotify as showNotifyEntry,
  subscribeNotifyStore,
  updateNotify as updateNotifyEntry,
  type NotifyEntry,
  type NotifyHandle,
  type NotifyOptions,
  type NotifyType,
} from "@/hooks/use-notify-store";

/**
 * Bivane Notify · 模式 C
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * ┌ H5 ── 顶部通栏横幅，自上方滑入，单例（新通知替换旧的）
 * └ PC ── 右上角圆角卡片栈，自右侧滑入，可多条并存、带关闭按钮
 *
 * 为什么 H5 用单例：移动端顶部空间只有一屏宽，多条堆叠会互相遮挡且挤压内容区，
 * Vant 原生也是「新的替换旧的」。PC 角标空间充裕，多条并存更符合桌面通知习惯。
 *
 * 双轨 API（契约第 8 条 / 架构 §5）：
 *   声明式  <Notify open message type onClose />
 *   命令式  showNotify({ message, type }) / closeNotify(id?)
 */

const NOTIFY_HOST_KEY = "bivane-notify";

/** 命令式 notify 宿主 */
export function NotifyHost() {
  useManualImperativeHost(NOTIFY_HOST_KEY);
  const items = React.useSyncExternalStore(
    subscribeNotifyStore,
    getNotifyEntries,
    getNotifyServerEntries,
  );
  const mode = useDeviceMode();

  if (items.length === 0) return null;

  const isMobile = mode === "mobile";
  // H5 单例：只呈现最新一条（更早的条目仍由 store 计时回收）
  const visible = isMobile ? [items[items.length - 1] as NotifyEntry] : items;

  return (
    <Portal>
      <div
        data-slot="notify-host"
        data-mode={mode === "mobile" ? "h5" : "pc"}
        className={cn(
          "pointer-events-none fixed flex flex-col",
          isMobile
            ? "inset-x-0 top-0 z-[var(--bv-toast-z-index)]"
            : "right-bv-md top-bv-md z-[var(--bv-toast-z-index)] w-fit max-w-[320px] gap-bv-sm",
        )}
      >
        {visible.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <NotifyItem
              item={item}
              mode={mode}
              onClose={closeNotifyEntry}
            />
          </div>
        ))}
      </div>
    </Portal>
  );
}

/* ---------- 声明式 ---------- */

export interface NotifyProps extends NotifyOptions {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Notify({
  open,
  defaultOpen = false,
  onOpenChange,
  message,
  type,
  duration,
  color,
  background,
  onClick,
  onClose,
  zIndex,
  className,
}: NotifyProps) {
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
    const wait = resolveNotifyDuration(duration);
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => {
      setOpen(false);
      onClose?.();
    }, wait);
    return () => clearTimeout(timer);
  }, [opened, duration, setOpen, onClose]);

  if (!opened) return null;

  const item: NotifyEntry = {
    id: 0,
    options: {
      message,
      type,
      duration,
      color,
      background,
      onClick,
      onClose,
      zIndex,
      className,
    },
  };

  return (
    <Portal>
      <div
        data-slot="notify-host"
        data-mode={mode === "mobile" ? "h5" : "pc"}
        className={cn(
          "pointer-events-none fixed flex flex-col",
          mode === "mobile"
            ? "inset-x-0 top-0"
            : "right-bv-md top-bv-md w-fit max-w-[320px]",
        )}
        style={{ zIndex: zIndex ?? "var(--bv-toast-z-index)" }}
      >
        <div className="pointer-events-auto">
          <NotifyItem
            item={item}
            mode={mode}
            onClose={() => {
              setOpen(false);
              onClose?.();
            }}
          />
        </div>
      </div>
    </Portal>
  );
}

/* ---------- 命令式 ---------- */

export function showNotify(options: NotifyOptions | string): NotifyHandle {
  ensureImperativeHost(NOTIFY_HOST_KEY, <NotifyHost />);
  return showNotifyEntry(
    typeof options === "string" ? { message: options } : options,
  );
}

/** 关闭指定通知；不传 id 关闭全部 */
export function closeNotify(id?: number): void {
  closeNotifyEntry(id);
}

/** 局部更新某条通知 */
export function updateNotify(id: number, next: Partial<NotifyOptions>): void {
  updateNotifyEntry(id, next);
}

export type { NotifyEntry, NotifyHandle, NotifyOptions, NotifyType };
