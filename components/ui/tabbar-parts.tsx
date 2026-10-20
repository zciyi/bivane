import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { DeviceMode } from '@/hooks/use-device-mode';
import type { TabbarItem } from '@/hooks/use-tabbar-state';

/**
 * Bivane Tabbar · 共用零件
 *
 * 底栏是**模式 C**（H5 底部固定条 / PC 侧边或顶部导航），
 * 两份实现分处 components/h5/ 与 components/pc/，但「一项长什么样」
 * （图标 + 文字 + 角标）是同一份东西，收在这里给两边复用。
 *
 * 跨模式共用零件的**外壳差异必须走 JS 分支，不能用 `bv-h5:` / `bv-pc:` 变体**
 * （契约 17）：变体编译成后代选择器，元素自身带 data-mode 时不命中，
 * 而共用零件未必有 data-mode 祖先。所以这里用 `tabbarItemClass(mode, variant, …)`
 * 纯函数出类名（架构 §6.5 ③）。
 *
 * 槽名按「模式 + 角色」区分（H5 `tabbar-item` / PC `tabbar-pc-item`），
 * 避免两套实现的样式互相串（契约第 14 条）。
 */

export type TabbarVariant = 'bottom' | 'sidebar' | 'top';

/** 各变体下的槽名前缀：H5 一套、PC 一套 */
export function tabbarSlotPrefix(mode: DeviceMode): 'tabbar-item' | 'tabbar-pc-item' {
  return mode === 'mobile' ? 'tabbar-item' : 'tabbar-pc-item';
}

/**
 * 项的类名（纯函数）。
 *
 * - bottom（H5 底栏）：图标在上、文字在下，竖排，均分宽度 —— Vant 底栏的经典形态
 * - sidebar（PC 侧边）：图标在左、文字在右，左对齐，激活项铺底色
 * - top（PC 顶部）：图标在左、文字在右，整体居中，激活项带下划线
 */
export function tabbarItemClass(
  mode: DeviceMode,
  variant: TabbarVariant,
  active: boolean,
  disabled: boolean,
): string {
  const base = cn(
    'flex items-center border-0 bg-transparent',
    'transition-colors duration-[var(--bv-tabbar-transition-duration)]',
    disabled
      ? 'cursor-not-allowed opacity-[var(--bv-tabbar-disabled-opacity)]'
      : 'cursor-pointer',
  );

  // H5 恒为底栏形态（图标在上、文字在下、均分宽度）
  if (mode === 'mobile') {
    return cn(
      base,
      'flex-1 flex-col justify-center gap-[var(--bv-tabbar-icon-gap)]',
      'h-[var(--bv-tabbar-height)] px-[var(--bv-tabbar-item-padding-x)]',
      'text-bv-sm leading-[var(--bv-tabbar-line-height)]',
      active
        ? 'text-[color:var(--bv-tabbar-item-active-color)]'
        : 'text-[color:var(--bv-tabbar-item-color)]',
    );
  }

  if (variant === 'sidebar') {
    return cn(
      base,
      'w-full items-center gap-[var(--bv-tabbar-pc-item-gap)]',
      'h-[var(--bv-tabbar-pc-item-height)] px-[var(--bv-tabbar-pc-item-padding-x)]',
      'text-bv-md leading-[var(--bv-tabbar-pc-line-height)]',
      'text-left',
      active
        ? 'bg-bv-muted text-[color:var(--bv-tabbar-item-active-color)]'
        : 'text-[color:var(--bv-tabbar-item-color)]',
    );
  }

  // PC 顶部导航
  return cn(
    base,
    'flex-1 justify-center gap-[var(--bv-tabbar-pc-item-gap)]',
    'h-[var(--bv-tabbar-pc-item-height)] px-[var(--bv-tabbar-item-padding-x)]',
    'text-bv-md leading-[var(--bv-tabbar-pc-line-height)]',
    // 透明下边框占位：激活时才换色，切换时底栏高度不会跳
    'border-b-2 border-transparent',
    active
      ? 'border-b-[var(--bv-tabbar-item-active-color)] text-[color:var(--bv-tabbar-item-active-color)]'
      : 'text-[color:var(--bv-tabbar-item-color)]',
  );
}

export interface TabbarItemViewProps {
  /** 项数据 */
  item: TabbarItem;
  /** 是否为当前激活项 */
  active: boolean;
  /** 已解析的模式 */
  mode: DeviceMode;
  /** 变体 */
  variant: TabbarVariant;
  /** 点击该项 */
  onSelect: (value: string) => void;
}

/** 一项：图标（带角标）+ 文字 */
export function TabbarItemView({
  item,
  active,
  mode,
  variant,
  onSelect,
}: TabbarItemViewProps) {
  const prefix = tabbarSlotPrefix(mode);
  const disabled = item.disabled ?? false;
  const className = tabbarItemClass(mode, variant, active, disabled);

  const badgeContent =
    item.badge === true
      ? undefined
      : item.badge === false || item.badge === undefined
        ? null
        : item.badge;

  /**
   * 图标 + 角标。
   *
   * 角标**不用** Badge 的 `position="top-right"`：那一档的语义是
   * 「角标中心压在图标角点上」，压在图标正中间偏上（实测盖住图标 40%，
   * PC 端 16px 的角标还比 16px 的图标更宽 → 图标直接糊掉）。
   * Tabbar 是「小图标挂角标」，要的是角标**挂在角上、大半露在图标外**
   * （Vant 的做法），所以自己按绝对定位 + 外探量摆，Badge 只提供红底/圆点/超数样式。
   */
  const icon = item.icon ? (
    <span
      data-slot={`${prefix}-icon`}
      className={cn(
        'relative inline-flex items-center justify-center',
        variant === 'bottom'
          ? 'text-[length:var(--bv-tabbar-item-icon-size)]'
          : 'text-[length:var(--bv-tabbar-pc-item-icon-size)]',
      )}
    >
      {item.icon}
      {badgeContent !== null || item.badge === true ? (
        <Badge
          content={badgeContent}
          dot={item.badge === true}
          className={cn(
            'absolute',
            'right-[var(--bv-tabbar-badge-right)] top-[var(--bv-tabbar-badge-top)]',
            'translate-x-1/2 -translate-y-1/2',
          )}
        />
      ) : null}
    </span>
  ) : null;

  const content = (
    <>
      {icon}
      <span data-slot={`${prefix}-label`} className="truncate">
        {item.label}
      </span>
    </>
  );

  const shared = {
    'data-slot': prefix,
    'data-active': active ? 'true' : undefined,
    'aria-current': active ? ('page' as const) : undefined,
    className,
  };

  if (item.href !== undefined) {
    return (
      <a
        {...shared}
        href={item.href}
        aria-disabled={disabled || undefined}
        onClick={(event) => {
          if (disabled) {
            event.preventDefault();
            return;
          }
          onSelect(item.value);
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      {...shared}
      type="button"
      disabled={disabled}
      onClick={() => onSelect(item.value)}
    >
      {content}
    </button>
  );
}
