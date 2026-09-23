import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Overlay } from '@/components/ui/overlay';
import { Portal } from '@/lib/portal';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import { useLockScroll } from '@/hooks/use-lock-scroll';
import { useDragToDismiss, DRAG_REGION_ATTR } from '@/hooks/use-drag-to-dismiss';

/**
 * Bivane Popup · 弹层地基（模式 B：同一 primitive 换渲染壳）
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 * ┌ H5 ── 四向滑入 + 底部圆角 + 安全区 + 下拉关闭（position=bottom）
 * └ PC ── 一律居中模态；position 的其余取值降级为 center（能力等价）
 *
 * 为什么 PC 要做「非 center 一律居中」的降级：
 *   底部滑入面板是移动端范式，宽屏下会出现「底部一条长面板」的可用性问题。
 *   内容、关闭方式、回调全部保留，只是容器形态变化 —— 符合矩阵总则 2 的能力等价原则，
 *   不构成功能缺失。原始 position 仍保留在 data-position 上便于调试。
 *
 * ⚠️ 双模式 props 完全一致（契约第 9 条）：交互差异不通过 props 泄露。
 *    closeOnClickOverlay 是「物理交互开关」，其默认值按模式取（H5 true / PC false），
 *    但显式传值时两端行为完全一致。
 */

export type PopupPosition = 'center' | 'top' | 'bottom' | 'left' | 'right';
export type PopupCloseIconPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** JS 侧等待退出动画的默认时长（ms）；需 ≥ tokens 里的 --bv-popup-duration */
const DEFAULT_DURATION = 300;

export interface PopupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'children'> {
  /** 受控开合 */
  open?: boolean;
  /** 非受控初始开合 */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 关闭后回调（与 onOpenChange 的区别：仅关闭时触发） */
  onClose?: () => void;
  /** 进场动画结束后回调 */
  onOpened?: () => void;
  /** 退场动画结束、节点卸载后回调 */
  onClosed?: () => void;
  /** 弹出方向，默认 bottom；PC 模式下一律渲染为 center */
  position?: PopupPosition;
  /** 圆角；不传时 H5 底部形态默认开启（矩阵规定），PC 形态忽略此值走 --bv-popup-pc-radius */
  round?: boolean;
  /** 是否渲染遮罩，默认 true */
  overlay?: boolean;
  /** 点击遮罩是否关闭；不传时 H5 默认 true、PC 默认 false（矩阵 §2.1） */
  closeOnClickOverlay?: boolean;
  /** 是否锁定背景滚动，默认 true */
  lockScroll?: boolean;
  /** 是否按 ESC 关闭，默认 true（两端一致：平板外接键盘、PC 无障碍都需要） */
  closeOnPressEscape?: boolean;
  /** 是否显示右上角关闭按钮，默认 false */
  closeable?: boolean;
  /** 自定义关闭图标 */
  closeIcon?: React.ReactNode;
  /** 关闭按钮位置，默认 top-right */
  closeIconPosition?: PopupCloseIconPosition;
  /** 底部安全区内边距（仅 H5 底部/居中形态生效），默认 true */
  safeAreaInsetBottom?: boolean;
  /**
   * 内容是否由 Popup 包裹一层滚动容器（默认 true）。
   * 传 false 时 children 直接进入面板，由内容自己决定滚动区域
   * —— Dialog 需要「按钮区固定、正文单独滚动」时用这个。
   */
  scrollable?: boolean;
  /** 进出场时长（ms），同时覆盖 CSS 变量；传 0 表示不做动画（测试与低性能场景） */
  duration?: number;
  zIndex?: number;
  /** 逃生舱：强制某个模式的交互（契约第 9 条唯一例外） */
  forceMode?: DeviceMode;
  children?: React.ReactNode;
}

/** 各方向的容器形态 */
function panelShapeClass(resolved: PopupPosition, isMobile: boolean): string {
  switch (resolved) {
    case 'top':
      return 'fixed inset-x-0 top-0 max-h-[var(--bv-popup-max-height)]';
    case 'left':
      return 'fixed inset-y-0 left-0 w-[80%] max-w-[420px]';
    case 'right':
      return 'fixed inset-y-0 right-0 w-[80%] max-w-[420px]';
    case 'bottom':
      return 'fixed inset-x-0 bottom-0 max-h-[var(--bv-popup-max-height)]';
    case 'center':
    default:
      return isMobile
        ? cn(
            // 横向居中：inset-x-0 + w-fit + mx-auto，逐字对齐 Vant
            // `.van-popup--center { left: 0; right: 0; width: fit-content; margin: 0 auto }`。
            //
            // 不要改回 `left-1/2 -translate-x-1/2 w-auto`：那样 right 为 auto，
            // 绝对定位元素 shrink-to-fit 的可用宽度只剩「包含块宽 − left」＝半屏，
            // 面板会被压到约 50vw 并把长文本挤成折行
            // （2026-09-21 实测：「列表项 2」被挤成两行，面板仅 187.5px / 375px 视口）。
            'fixed inset-x-0 top-1/2 -translate-y-1/2 w-fit mx-auto',
            'max-w-[var(--bv-popup-center-max-width)]',
            // 高度上限必须显式给：Vant 把 max-height 放在 .van-popup **基类**上
            // （`max-height: 100%`），center 是靠继承吃到它的。我们拆成了按 position
            // 分支产出，就容易漏 —— 漏掉的后果不是"没有上限"这么轻：
            // 面板高度会等于内容高度，里面的 [data-bv-scroll-container]
            // （min-h-0 flex-1 overflow-y-auto）永远拿不到约束，内部滚动彻底失效，
            // 内容一高就上下溢出视口两端且不可滚（2026-09-21 修复）。
            'max-h-[var(--bv-popup-max-height)]',
          )
        : cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-[var(--bv-popup-pc-width)] max-h-[var(--bv-popup-pc-max-height)]',
            'shadow-[var(--bv-popup-pc-shadow)]',
          );
  }
}

/** 圆角：H5 贴边方向只圆「内侧两角」 */
function panelRadiusClass(resolved: PopupPosition, isMobile: boolean, round: boolean): string {
  if (!isMobile) return 'rounded-[var(--bv-popup-pc-radius)]';
  if (resolved === 'center') return 'rounded-bv-lg';
  if (!round) return 'rounded-none';
  switch (resolved) {
    case 'top':
      return 'rounded-b-[var(--bv-popup-round-radius)]';
    case 'left':
      return 'rounded-r-[var(--bv-popup-round-radius)]';
    case 'right':
      return 'rounded-l-[var(--bv-popup-round-radius)]';
    case 'bottom':
    default:
      return 'rounded-t-[var(--bv-popup-round-radius)]';
  }
}

/** 进出场位移；center 用淡入缩放，贴边方向用位移 */
function panelStateClass(resolved: PopupPosition, state: 'open' | 'closed'): string {
  if (resolved === 'center') {
    return state === 'open' ? 'opacity-100 scale-100' : 'opacity-0 scale-95';
  }
  if (state === 'open') return 'translate-x-0 translate-y-0';
  switch (resolved) {
    case 'top':
      return '-translate-y-full';
    case 'left':
      return '-translate-x-full';
    case 'right':
      return 'translate-x-full';
    case 'bottom':
    default:
      return 'translate-y-full';
  }
}

const closeIconPositionClass: Record<PopupCloseIconPosition, string> = {
  'top-left': 'left-[var(--bv-popup-close-icon-margin)] top-[var(--bv-popup-close-icon-margin)]',
  'top-right': 'right-[var(--bv-popup-close-icon-margin)] top-[var(--bv-popup-close-icon-margin)]',
  'bottom-left':
    'left-[var(--bv-popup-close-icon-margin)] bottom-[var(--bv-popup-close-icon-margin)]',
  'bottom-right':
    'right-[var(--bv-popup-close-icon-margin)] bottom-[var(--bv-popup-close-icon-margin)]',
};

export const Popup = React.forwardRef<HTMLDivElement, PopupProps>(function Popup(
  {
    open,
    defaultOpen = false,
    onOpenChange,
    onClose,
    onOpened,
    onClosed,
    position = 'bottom',
    round,
    overlay = true,
    closeOnClickOverlay,
    lockScroll = true,
    closeOnPressEscape = true,
    closeable = false,
    closeIcon,
    closeIconPosition = 'top-right',
    safeAreaInsetBottom = true,
    scrollable = true,
    duration,
    zIndex,
    forceMode,
    className,
    style,
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

  const [mounted, setMounted] = React.useState(opened);
  const [state, setState] = React.useState<'open' | 'closed'>(opened ? 'open' : 'closed');

  const wait = duration ?? DEFAULT_DURATION;
  /** position 在 PC 上降级为 center，但原始值保留在 data-position 上 */
  const resolvedPosition: PopupPosition = isMobile ? position : 'center';
  const rounded = round ?? true;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInnerOpen(next);
      onOpenChange?.(next);
      if (!next) onClose?.();
    },
    [isControlled, onOpenChange, onClose],
  );

  const close = React.useCallback(() => setOpen(false), [setOpen]);

  // 两阶段挂载：先挂载再切 open 状态，才能触发进场过渡
  React.useEffect(() => {
    if (opened) {
      setMounted(true);
      if (wait <= 0) {
        setState('open');
        return undefined;
      }
      const raf = requestAnimationFrame(() => setState('open'));
      const timer = setTimeout(() => onOpened?.(), wait);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }

    setState('closed');
    if (wait <= 0) {
      setMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setMounted(false);
      onClosed?.();
    }, wait);
    return () => clearTimeout(timer);
  }, [opened, wait, onOpened, onClosed]);

  // 背景滚动锁定（H5 fixed / PC overflow 补偿）
  // 必须把已解析的 mode 传进去，否则 forceMode 逃生舱不会作用于锁策略
  useLockScroll({ active: mounted && lockScroll, mode });

  // ESC 关闭
  React.useEffect(() => {
    if (!mounted || !closeOnPressEscape) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mounted, closeOnPressEscape, close]);

  // 焦点管理：打开时把焦点移入面板，关闭后归还给触发元素
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!mounted) return undefined;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      restoreFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [mounted]);

  // H5 底部形态：下拉关闭
  const dragEnabled = isMobile && mounted && resolvedPosition === 'bottom';
  const { rootRef: dragRef, offset, dragging } = useDragToDismiss({
    enabled: dragEnabled,
    onDismiss: close,
  });

  const setPanelRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      (dragRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    },
    [ref, dragRef],
  );

  if (!mounted) return null;

  const overlayCloses = closeOnClickOverlay ?? isMobile;
  const showSafeArea = isMobile && safeAreaInsetBottom && resolvedPosition !== 'top';

  const panel = (
    <div
      ref={setPanelRef}
      data-mode={isMobile ? 'h5' : 'pc'}
      data-position={position}
      data-position-resolved={resolvedPosition}
      data-state={state}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      className={cn(
        'box-border overflow-hidden bg-bv-surface outline-none',
        panelShapeClass(resolvedPosition, isMobile),
        panelRadiusClass(resolvedPosition, isMobile, rounded),
        panelStateClass(resolvedPosition, state),
        'flex flex-col',
        'transition-[transform,opacity] duration-[var(--bv-popup-duration)] ease-out',
        'motion-reduce:transition-none',
        state === 'closed' && 'pointer-events-none',
        // 拖拽时取消过渡动画，保证面板跟手（用类而非内联 style，见 §4 第 4 条）
        dragging && 'transition-none',
        className,
      )}
      style={{
        zIndex: zIndex ?? 'var(--bv-popup-z-index)',
        ...(duration === undefined ? null : { ['--bv-popup-duration' as string]: `${duration}ms` }),
        // 拖拽位移属于运行时动态值，是契约第 4 条允许的内联 style 例外
        ...(dragging && resolvedPosition === 'bottom'
          ? { transform: `translateY(${offset}px)` }
          : null),
        ...style,
      }}
      {...props}
      data-slot="popup"
    >
      {dragEnabled ? (
        <div
          {...{ [DRAG_REGION_ATTR]: '' }}
          data-slot="popup-drag-handle"
          className="flex shrink-0 touch-none justify-center pt-bv-xs pb-bv-base"
        >
          <span className="h-[4px] w-[36px] rounded-bv-max bg-bv-gray-4" />
        </div>
      ) : null}

      {closeable ? (
        <button
          type="button"
          data-slot="popup-close"
          aria-label="关闭"
          onClick={close}
          className={cn(
            'absolute z-[var(--bv-popup-close-icon-z-index)] flex h-[var(--bv-popup-close-icon-size)] w-[var(--bv-popup-close-icon-size)] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[var(--bv-popup-close-icon-size)] text-[var(--bv-popup-close-icon-color)]',
            closeIconPositionClass[closeIconPosition],
          )}
        >
          {closeIcon ?? <Icon name="cross" />}
        </button>
      ) : null}

      {scrollable ? (
        <div
          data-bv-scroll-container=""
          data-slot="popup-content"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      ) : (
        children
      )}

      {showSafeArea ? <div className="bv-safe-area-bottom shrink-0" /> : null}
    </div>
  );

  return (
    <Portal>
      {overlay ? (
        <Overlay
          open={state === 'open'}
          // 传已解析的 mode：遮罩在 Portal 内，拿不到面板上的 data-mode
          mode={mode}
          onClick={overlayCloses ? close : undefined}
          data-component="popup-overlay"
        />
      ) : null}
      {panel}
    </Portal>
  );
});
