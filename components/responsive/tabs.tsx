import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  useDeviceMode,
  useDeviceModeAttrs,
  type DeviceMode,
} from '@/hooks/use-device-mode';
import {
  firstEnabledIndex,
  lastEnabledIndex,
  nextEnabledIndex,
  useTabsState,
} from '@/hooks/use-tabs-state';
import { collectTabs, Tab, type TabProps } from '@/components/ui/tabs-parts';

/**
 * Bivane Tabs · 标签页（模式 B：同一激活值模型，两端换壳）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * ┌ H5 ── 横向**可滑动**标签条（超出可横滚），激活项自动滚入视野；
 * │        内容区随手势左右滑动切换（swipeable，默认关）
 * └ PC ── 横向标签**不滑动**（标题多了就等分收缩），激活项下有下划线指示器；
 *          键盘 ←/→ 切换（跳过禁用项，撞到头尾回绕）
 *
 * 为什么是模式 B 而不是 A/C：
 *   两端是同一个 primitive（标签条 + 内容区 + 激活值），差异只在
 *   「标签条能不能横滚」「怎么换页」「指示器长什么样」——换壳即可，
 *   不需要两份实现。值语义（下标）两端一致，因此 props 也一致（契约第 9 条）。
 *
 * 组合式 API（对齐 Vant）：
 *   <Tabs value={active} onChange={setActive}>
 *     <Tab title="标签一">内容一</Tab>
 *   </Tabs>
 * 子件元信息由 components/ui/tabs-parts.tsx 收集（纯函数，不做渲染期登记）。
 */

export type { TabProps };
export { Tab };

export type TabsType = 'line' | 'card';

export interface TabsProps
  extends Omit<
    React.HTMLAttributes<HTMLDivElement>,
    'onChange' | 'defaultValue' | 'title'
  > {
  /** 受控激活下标（0 起），对齐 Vant 的 v-model:active */
  value?: number;
  /** 非受控初始激活下标，默认 0 */
  defaultValue?: number;
  /** 激活项变化 */
  onChange?: (index: number) => void;
  /** 标签样式：line 下划线（默认）/ card 卡片 */
  type?: TabsType;
  /** 内容区切换动画，默认 true */
  animated?: boolean;
  /** H5：内容区随手势左右滑动切换，默认 false */
  swipeable?: boolean;
  /** 标签条吸顶，默认 false */
  sticky?: boolean;
  /** 切换动画时长（毫秒），默认 300 */
  duration?: number;
  /** 下划线宽度（px）；'auto' 表示与标题同宽；默认 40（对齐 Vant） */
  lineWidth?: number | 'auto';
  /** 激活色（覆盖主题主色） */
  color?: string;
  /** 标签条的无障碍名称 */
  ariaLabel?: string;
  /** 逃生舱：强制某个模式的交互（契约第 9 条唯一例外） */
  forceMode?: DeviceMode;
}

/** 手势判定：位移超过该值才算横向拖拽（低于它交给纵向滚动） */
const SWIPE_DIRECTION_THRESHOLD = 6;
/** 手势切换阈值：位移超过「容器宽度的 20%」与 80px 中较小者才切页 */
const SWIPE_MAX_DISTANCE = 80;
const SWIPE_RATIO = 0.2;

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    value,
    defaultValue = 0,
    onChange,
    type = 'line',
    animated = true,
    swipeable = false,
    sticky = false,
    duration = 300,
    lineWidth = 40,
    color,
    ariaLabel,
    className,
    children,
    forceMode,
    style,
    ...rest
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const modeAttrs = useDeviceModeAttrs(forceMode);
  const isMobile = mode === 'mobile';

  const { tabs, others } = React.useMemo(() => collectTabs(children), [children]);
  const count = tabs.length;

  const state = useTabsState({ value, defaultValue, count, onChange });
  const active = state.active;

  const disabledFlags = React.useMemo(
    () => tabs.map((tab) => tab.disabled),
    [tabs],
  );

  const baseId = React.useId();
  const tabDomId = (index: number) => `${baseId}-tab-${index}`;
  const panelDomId = (index: number) => `${baseId}-panel-${index}`;

  /* ---------- 标签条测量（下划线指示器 + H5 滚入视野）---------- */

  const navRef = React.useRef<HTMLDivElement | null>(null);
  const tabButtonRefs = React.useRef<Map<string, HTMLButtonElement | null>>(
    new Map(),
  );
  const tabsRef = React.useRef(tabs);
  tabsRef.current = tabs;

  const [lineMetrics, setLineMetrics] = React.useState<{
    offset: number;
    width: number;
  } | null>(null);

  /** 量出激活项相对标签条左沿的位置与宽度（jsdom 下全为 0，走兜底宽度） */
  const measureActiveTab = React.useCallback(() => {
    const nav = navRef.current;
    const list = tabsRef.current;
    const current = list[active];
    const button = current ? tabButtonRefs.current.get(current.key) : undefined;
    if (!nav || !button) {
      setLineMetrics(null);
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    setLineMetrics({
      offset: buttonRect.left - navRect.left + nav.scrollLeft,
      width: buttonRect.width,
    });
  }, [active]);

  React.useLayoutEffect(() => {
    measureActiveTab();
  }, [measureActiveTab, count, type]);

  // 标签条宽度变化（窗口缩放、字体加载完成）后指示器要跟着重算
  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measureActiveTab());
    observer.observe(nav);
    return () => observer.disconnect();
  }, [measureActiveTab]);

  /* ---------- H5：激活项滚入视野 ---------- */

  React.useLayoutEffect(() => {
    if (!isMobile) return;
    const nav = navRef.current;
    const list = tabsRef.current;
    const current = list[active];
    const button = current ? tabButtonRefs.current.get(current.key) : undefined;
    if (!nav || !button) return;
    // 居中而不是「刚好露出」：标签条滑到一半时用户仍看不清当前项
    const target = button.offsetLeft - (nav.clientWidth - button.offsetWidth) / 2;
    nav.scrollLeft = Math.max(0, target);
  }, [active, isMobile, count]);

  /* ---------- PC：键盘左右切换 ---------- */

  const focusTab = React.useCallback((index: number) => {
    const list = tabsRef.current;
    const current = list[index];
    if (!current) return;
    tabButtonRefs.current.get(current.key)?.focus();
  }, []);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isMobile) return;
      let target: number | null = null;
      if (event.key === 'ArrowRight') {
        target = nextEnabledIndex(active, count, 1, disabledFlags);
      } else if (event.key === 'ArrowLeft') {
        target = nextEnabledIndex(active, count, -1, disabledFlags);
      } else if (event.key === 'Home') {
        target = firstEnabledIndex(disabledFlags);
      } else if (event.key === 'End') {
        target = lastEnabledIndex(disabledFlags);
      }
      if (target === null || target < 0) return;
      event.preventDefault();
      if (target === active) return;
      state.setActive(target);
      focusTab(target);
    },
    [active, count, disabledFlags, focusTab, isMobile, state],
  );

  /* ---------- H5：内容区手势横滑 ---------- */

  const dragRef = React.useRef<{
    x: number;
    y: number;
    decided: boolean;
    horizontal: boolean;
  } | null>(null);
  const [dragOffset, setDragOffset] = React.useState<number | null>(null);

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isMobile || !swipeable) return;
      // 鼠标拖拽不算手势（那是选中文本/拖图片的事）
      if (event.pointerType === 'mouse') return;
      dragRef.current = {
        x: event.clientX,
        y: event.clientY,
        decided: false,
        horizontal: false,
      };
    },
    [isMobile, swipeable],
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragRef.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!start.decided) {
        if (
          Math.abs(dx) < SWIPE_DIRECTION_THRESHOLD &&
          Math.abs(dy) < SWIPE_DIRECTION_THRESHOLD
        ) {
          return;
        }
        start.decided = true;
        start.horizontal = Math.abs(dx) > Math.abs(dy);
        if (!start.horizontal) {
          // 判定为纵向滑动：交还给页面滚动，本次手势结束
          dragRef.current = null;
          return;
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }
      if (!start.horizontal) return;
      setDragOffset(dx);
    },
    [],
  );

  const handlePointerUp = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = dragRef.current;
      dragRef.current = null;
      if (!start || !start.horizontal) {
        setDragOffset(null);
        return;
      }
      const dx = event.clientX - start.x;
      const width = event.currentTarget.clientWidth || 320;
      const threshold = Math.min(SWIPE_MAX_DISTANCE, width * SWIPE_RATIO);
      if (Math.abs(dx) > threshold) {
        const step: 1 | -1 = dx < 0 ? 1 : -1;
        const next = nextEnabledIndex(active, count, step, disabledFlags);
        if (next !== active) state.setActive(next);
      }
      setDragOffset(null);
    },
    [active, count, disabledFlags, state],
  );

  /* ---------- 渲染 ---------- */

  const resolvedLineWidth =
    lineWidth === 'auto' ? lineMetrics?.width || 40 : lineWidth;
  const resolvedLineLeft = lineMetrics
    ? lineMetrics.offset + (lineMetrics.width - resolvedLineWidth) / 2
    : 0;

  const navClass = cn(
    'relative flex w-full items-stretch',
    type === 'card'
      ? 'overflow-hidden rounded-bv-md border border-bv-border'
      : 'bv-hairline bv-hairline--bottom',
    isMobile
      ? 'overflow-x-auto overscroll-x-contain scroll-smooth'
      : 'overflow-hidden',
    sticky && 'sticky top-0 z-[var(--bv-tabs-sticky-z-index)] bg-bv-surface',
  );

  const itemClass = (activeState: boolean, disabled: boolean) =>
    cn(
      'flex items-center justify-center border-0 bg-transparent p-0 whitespace-nowrap',
      'h-[var(--bv-tabs-height)]',
      'px-[var(--bv-tabs-padding-x)]',
      'text-bv-md leading-[var(--bv-tabs-line-height)]',
      isMobile ? 'shrink-0' : 'min-w-0 flex-1',
      type === 'card' && 'border-r border-bv-border last:border-r-0',
      activeState
        ? 'text-[color:var(--bv-tabs-active-color)]'
        : 'text-[color:var(--bv-tabs-text-color)]',
      type === 'card' && activeState && 'bg-bv-muted',
      disabled && 'cursor-not-allowed opacity-[var(--bv-tabs-disabled-opacity)]',
      !disabled && 'cursor-pointer',
    );

  const cssVars = {
    '--bv-tabs-duration': `${duration}ms`,
    ...(color ? { '--bv-tabs-active-color': color } : null),
  } as React.CSSProperties;

  return (
    <div
      ref={ref}
      {...rest}
      data-slot="tabs"
      data-type={type}
      {...modeAttrs}
      className={cn(
        'flex w-full flex-col bg-bv-surface',
        className,
      )}
      style={{ ...cssVars, ...style }}
    >
      <div
        ref={navRef}
        role="tablist"
        aria-label={ariaLabel}
        data-slot="tabs-nav"
        className={navClass}
        onKeyDown={handleKeyDown}
      >
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            ref={(node) => {
              if (node) tabButtonRefs.current.set(tab.key, node);
              else tabButtonRefs.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            id={tabDomId(index)}
            aria-selected={index === active}
            aria-controls={panelDomId(index)}
            tabIndex={index === active ? 0 : -1}
            disabled={tab.disabled}
            data-slot="tabs-tab"
            data-active={index === active ? 'true' : undefined}
            onClick={() => {
              if (!tab.disabled) state.setActive(index);
            }}
            className={itemClass(index === active, tab.disabled)}
          >
            {tab.title}
          </button>
        ))}

        {type === 'line' ? (
          <span
            aria-hidden="true"
            data-slot="tabs-line"
            className={cn(
              'pointer-events-none absolute bottom-0 left-0',
              'h-[var(--bv-tabs-bottom-bar-height)]',
              'rounded-bv-sm bg-[var(--bv-tabs-active-color)]',
              'transition-transform duration-[var(--bv-tabs-line-duration)]',
            )}
            style={{
              width: `${resolvedLineWidth}px`,
              transform: `translateX(${resolvedLineLeft}px)`,
            }}
          />
        ) : null}
      </div>

      <div
        data-slot="tabs-content"
        className={cn(
          'relative w-full overflow-hidden',
          // 纵向滚动照常，横向手势交给组件自己处理
          isMobile && swipeable && 'touch-pan-y',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          data-slot="tabs-track"
          className={cn(
            'flex w-full',
            animated &&
              dragOffset === null &&
              'transition-transform duration-[var(--bv-tabs-duration)]',
          )}
          style={{
            transform:
              dragOffset === null
                ? `translateX(${-active * 100}%)`
                : `translateX(calc(${-active * 100}% + ${dragOffset}px))`,
          }}
        >
          {tabs.map((tab, index) => (
            <div
              key={tab.key}
              role="tabpanel"
              id={panelDomId(index)}
              aria-labelledby={tabDomId(index)}
              aria-hidden={index === active ? undefined : 'true'}
              inert={index === active ? undefined : true}
              data-slot="tabs-panel"
              data-active={index === active ? 'true' : undefined}
              className={cn(
                'w-full shrink-0',
                index === active ? '' : 'pointer-events-none',
              )}
            >
              {tab.content}
            </div>
          ))}
        </div>
      </div>

      {others}
    </div>
  );
});
