import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import {
  useDeviceMode,
  useDeviceModeAttrs,
  type DeviceMode,
} from '@/hooks/use-device-mode';

/**
 * Bivane NavBar · 导航栏（模式 B：同一条标题栏，两端换壳）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * ┌ H5 ── 返回箭头（左）· 标题**居中** · 右侧动作（右对齐）；
 * │        贴顶时 fixed + 安全区（env(safe-area-inset-top)）
 * └ PC ── 返回/左标题（左）· 标题**左对齐** · 右侧操作区（右对齐）
 *
 * 为什么是模式 B：
 *   两端是同一条「左 · 中 · 右」标题栏，同一份层级回调（onClickLeft /
 *   onClickRight），差别只在**标题的落位**：触屏单手操作、标题要绝对居中才
 *   对得起「这是当前页」；桌面端标题与操作区抢同一行，居中标题会把左边的
 *   返回/面包屑和右边的操作挤成两截，所以左对齐更合理。
 *   primitive 是同一个，换壳即可（架构 §6.1 模式 B）。
 *
 * 组件不渲染内容区（children 一律不接）：内容由页面自己排，
 * 固定态下把内容塞进 fixed 容器会把它钉在屏幕上。右侧要放搜索框请用 right。
 */

export interface NavBarProps
  extends Omit<
    React.ComponentPropsWithoutRef<'nav'>,
    'title' | 'children'
  > {
  /** 标题文案 */
  title?: React.ReactNode;
  /** 左侧文字（点击触发 onClickLeft） */
  leftText?: React.ReactNode;
  /** 右侧文字（点击触发 onClickRight） */
  rightText?: React.ReactNode;
  /** 显示返回箭头，默认 false（对齐 Vant van-nav-bar） */
  leftArrow?: boolean;
  /** 点击左侧（箭头或文字） */
  onClickLeft?: () => void;
  /** 点击右侧文字 */
  onClickRight?: () => void;
  /** 自定义左侧内容（给了就顶替 leftText / leftArrow） */
  left?: React.ReactNode;
  /** 自定义右侧内容（给了就顶替 rightText） */
  right?: React.ReactNode;
  /** 吸顶固定，默认 true */
  fixed?: boolean;
  /** 固定时留一个等高占位块，默认 true */
  placeholder?: boolean;
  /** 底部分隔线，默认 true */
  border?: boolean;
  /** 顶部安全区，默认 true（贴顶时生效） */
  safeAreaInsetTop?: boolean;
  /** 返回箭头的无障碍名称 */
  backLabel?: string;
  /** 标题的无障碍名称；没有可见标题时应当传入（作为导航地标的名字） */
  ariaLabel?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

export const NavBar = React.forwardRef<HTMLElement, NavBarProps>(function NavBar(
  {
    title,
    leftText,
    rightText,
    leftArrow = false,
    onClickLeft,
    onClickRight,
    left,
    right,
    fixed = true,
    placeholder = true,
    border = true,
    safeAreaInsetTop = true,
    backLabel = '返回',
    ariaLabel,
    className,
    style,
    forceMode,
    ...rest
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const modeAttrs = useDeviceModeAttrs(forceMode);
  const isMobile = mode === 'mobile';

  /* ---------- 左侧：自定义内容 > 返回箭头 + 文字 ---------- */

  const leftContent =
    left ??
    (leftArrow || leftText !== undefined ? (
      <>
        {leftArrow ? (
          <button
            type="button"
            aria-label={backLabel}
            onClick={onClickLeft}
            data-slot="nav-bar-back"
            className={cn(
              'flex shrink-0 items-center justify-center border-0 bg-transparent p-0',
              'cursor-pointer text-[length:var(--bv-nav-bar-arrow-size)]',
              'text-[color:var(--bv-nav-bar-icon-color)]',
            )}
          >
            <Icon name="arrow-left" />
          </button>
        ) : null}
        {leftText !== undefined ? (
          <button
            type="button"
            onClick={onClickLeft}
            data-slot="nav-bar-left-text"
            className={cn(
              'shrink-0 border-0 bg-transparent p-0',
              'text-bv-md leading-[var(--bv-nav-bar-line-height)]',
              'text-[color:var(--bv-nav-bar-text-color)]',
              'cursor-pointer',
            )}
          >
            {leftText}
          </button>
        ) : null}
      </>
    ) : null);

  const rightContent =
    right ??
    (rightText !== undefined ? (
      <button
        type="button"
        onClick={onClickRight}
        data-slot="nav-bar-right-text"
        className={cn(
          'shrink-0 border-0 bg-transparent p-0',
          'text-bv-md leading-[var(--bv-nav-bar-line-height)]',
          'text-[color:var(--bv-nav-bar-text-color)]',
          'cursor-pointer',
        )}
      >
        {rightText}
      </button>
    ) : null);

  const titleNode = (
    <span
      data-slot="nav-bar-title"
      className={cn(
        'truncate',
        'text-bv-lg leading-[var(--bv-nav-bar-title-line-height)]',
        'font-bv-bold text-[color:var(--bv-nav-bar-title-color)]',
      )}
    >
      {title}
    </span>
  );

  return (
    <>
      {fixed && placeholder ? (
        <div
          aria-hidden="true"
          data-slot="nav-bar-placeholder"
          className={cn(safeAreaInsetTop && 'bv-safe-area-top')}
        >
          <div
            data-slot="nav-bar-placeholder-bar"
            className="h-[var(--bv-nav-bar-height)]"
          />
        </div>
      ) : null}

      <nav
        ref={ref}
        {...rest}
        data-slot="nav-bar"
        {...modeAttrs}
        aria-label={ariaLabel}
        className={cn(
          'w-full bg-bv-surface',
          fixed &&
            'fixed top-0 left-0 right-0 z-[var(--bv-nav-bar-z-index)]',
          border && 'bv-hairline bv-hairline--bottom',
          safeAreaInsetTop && 'bv-safe-area-top',
          className,
        )}
        style={style}
      >
        <div
          data-slot="nav-bar-bar"
          className={cn(
            'flex w-full items-center',
            'h-[var(--bv-nav-bar-height)]',
            'px-[var(--bv-nav-bar-padding-x)]',
          )}
        >
          {isMobile ? (
            /* H5：左 / 中 / 右 三等分，标题在中间那格里居中 —— 两侧等宽，
               标题才真的是「居中」而不是「在剩余空间里居中」。 */
            <>
              <div
                data-slot="nav-bar-left"
                className="flex min-w-0 flex-1 items-center gap-[var(--bv-nav-bar-gap)]"
              >
                {leftContent}
              </div>
              <div
                data-slot="nav-bar-center"
                className="flex min-w-0 flex-1 justify-center text-center"
              >
                {titleNode}
              </div>
              <div
                data-slot="nav-bar-right"
                className="flex min-w-0 flex-1 items-center justify-end gap-[var(--bv-nav-bar-gap)]"
              >
                {rightContent}
              </div>
            </>
          ) : (
            /* PC：标题左对齐，右侧操作区右对齐；标题占据剩余空间 */
            <>
              <div
                data-slot="nav-bar-left"
                className="flex shrink-0 items-center gap-[var(--bv-nav-bar-gap)]"
              >
                {leftContent}
              </div>
              <div
                data-slot="nav-bar-center"
                className="flex min-w-0 flex-1 items-center text-left"
              >
                {titleNode}
              </div>
              <div
                data-slot="nav-bar-right"
                className="flex shrink-0 items-center justify-end gap-[var(--bv-nav-bar-gap)]"
              >
                {rightContent}
              </div>
            </>
          )}
        </div>
      </nav>
    </>
  );
});
