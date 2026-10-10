import * as React from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { DeviceMode } from '@/hooks/use-device-mode';
import type { CascaderOption } from '@/hooks/use-cascader-state';

/**
 * Bivane Cascader · PC 专属零件
 *
 * H5 复用 Picker 的触发器与联动滚轮（见 picker-parts），本文件只服务 PC 的
 * 「面包屑 + 多列级联面板 + 搜索结果」外壳。没有 bv-h5:/bv-pc: 变体：
 * 这些零件要么在用户页面（无 data-mode 祖先），要么外壳差异已由 mode 显式分支。
 */

/* ------------------------------------------------------------------ *
 * 面包屑路径
 * ------------------------------------------------------------------ */

export interface CascaderCrumb {
  /** 该项的显示文案（根层一般是「请选择」） */
  label: React.ReactNode;
  /** 给了就渲染成可点按钮：点它把导航链截到该层 */
  onSelect?: () => void;
}

export interface CascaderBreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  mode: DeviceMode;
  crumbs: CascaderCrumb[];
}

/**
 * 级联面包屑：根层「请选择」恒为第一格，其后是各级选中项，末项是当前落点。
 * 独占浮层顶部一行、左对齐、横向可滚（与 H5 多层面板的面包屑同一读法，
 * 但不复用 PanelHeader —— 那是 H5 弹层工具栏，PC 浮层里不需要「取消/确定」行）。
 */
export const CascaderBreadcrumb = React.forwardRef<HTMLElement, CascaderBreadcrumbProps>(
  function CascaderBreadcrumb({ mode, crumbs, className, ...props }, ref) {
    const scrollRef = React.useRef<HTMLElement | null>(null);

    // 合并转发 ref 与内部滚动 ref
    const mergedRef = React.useCallback(
      (node: HTMLElement | null) => {
        scrollRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      },
      [ref],
    );

    // 下钻变深时把当前层滚进视野；依赖项数而非数组身份（同 PanelHeader 的坑）
    React.useEffect(() => {
      const el = scrollRef.current;
      if (el) el.scrollLeft = el.scrollWidth;
    }, [crumbs.length]);

    return (
      <nav
        ref={mergedRef}
        data-mode={mode === 'mobile' ? 'h5' : 'pc'}
        aria-label="层级路径"
        className={cn(
          'box-border flex h-[var(--bv-cascader-pc-breadcrumb-height)] w-full min-w-0 shrink-0 items-center',
          'gap-0 overflow-x-auto overflow-y-hidden overscroll-x-contain',
          'px-[var(--bv-cascader-pc-padding-x)]',
          'bg-bv-surface bv-hairline bv-hairline--bottom',
          className,
        )}
        {...props}
        data-slot="cascader-breadcrumb"
      >
        {crumbs.map((crumb, index) => {
          const isCurrent = index === crumbs.length - 1;
          return (
            <React.Fragment key={index}>
              {index > 0 ? (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-bv-text-3"
                  data-slot="cascader-breadcrumb-separator"
                >
                  /
                </span>
              ) : null}
              {crumb.onSelect ? (
                <button
                  type="button"
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={crumb.onSelect}
                  className={cn(
                    'flex h-full shrink-0 cursor-pointer items-center whitespace-nowrap border-0 bg-transparent',
                    'text-bv-md leading-[var(--bv-line-md)]',
                    isCurrent ? 'text-bv-text' : 'text-bv-text-2 hover:text-bv-primary',
                  )}
                  data-slot="cascader-breadcrumb-item"
                >
                  {crumb.label}
                </button>
              ) : (
                <span
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    'flex h-full shrink-0 items-center whitespace-nowrap',
                    'text-bv-md leading-[var(--bv-line-md)] text-bv-text',
                  )}
                  data-slot="cascader-breadcrumb-current"
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    );
  },
);

/* ------------------------------------------------------------------ *
 * 级联选项行（PC 多列面板里的一级）
 * ------------------------------------------------------------------ */

export interface CascaderOptionRowProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  mode: DeviceMode;
  option: CascaderOption;
  /** 当前链在这一列的选中项（叶子或父项都算） */
  selected: boolean;
  /** 键盘巡航高亮项 */
  active?: boolean;
  onSelect: (option: CascaderOption) => void;
}

export const CascaderOptionRow = React.forwardRef<HTMLButtonElement, CascaderOptionRowProps>(
  function CascaderOptionRow(
    { mode, option, selected, active = false, onSelect, className, ...props },
    ref,
  ) {
    const hasSub = Boolean(option.children && option.children.length > 0);
    return (
      <button
        ref={ref}
        type="button"
        role="option"
        aria-selected={selected}
        aria-expanded={hasSub ? selected : undefined}
        disabled={option.disabled}
        data-mode={mode === 'mobile' ? 'h5' : 'pc'}
        data-value={String(option.value)}
        data-selected={selected ? 'true' : undefined}
        data-active={active ? 'true' : undefined}
        onClick={() => onSelect(option)}
        className={cn(
          'group flex w-full cursor-pointer box-border items-center border-0 bg-transparent text-left',
          'px-[var(--bv-cascader-pc-padding-x)]',
          'h-[var(--bv-cascader-pc-row-height)] gap-[var(--bv-picker-gap)]',
          'text-bv-md leading-[var(--bv-line-md)]',
          selected ? 'text-bv-primary' : 'text-bv-text',
          'hover:bg-[var(--bv-active-color)]',
          active && 'bg-[var(--bv-active-color)]',
          option.disabled && 'cursor-not-allowed opacity-[var(--bv-picker-disabled-opacity)]',
          className,
        )}
        {...props}
        data-slot="cascader-option"
      >
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {hasSub ? (
          <Icon
            name="arrow"
            aria-hidden="true"
            className={cn(
              'shrink-0 text-[length:var(--bv-picker-icon-size)]',
              selected ? 'text-bv-primary' : 'text-bv-text-3',
            )}
          />
        ) : selected ? (
          <span
            aria-hidden="true"
            className="flex shrink-0 items-center text-bv-primary text-[length:var(--bv-picker-icon-size)]"
            data-slot="cascader-option-check"
          >
            <Icon name="check" />
          </span>
        ) : null}
      </button>
    );
  },
);

/* ------------------------------------------------------------------ *
 * 搜索结果行（PC 搜索定位）
 * ------------------------------------------------------------------ */

export interface CascaderSearchResultRowProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect'> {
  mode: DeviceMode;
  /** 根 → 叶子的完整链 */
  path: CascaderOption[];
  selected: boolean;
  onSelect: (option: CascaderOption) => void;
}

/**
 * 搜索命中行展示**完整路径**（架构 §6.5 第 6 条：同名叶子不可区分，
 * 只回显末级 label 会指错）。链身弱化、叶子正常色。
 */
export const CascaderSearchResultRow = React.forwardRef<
  HTMLButtonElement,
  CascaderSearchResultRowProps
>(function CascaderSearchResultRow(
  { mode, path, selected, onSelect, className, ...props },
  ref,
) {
  const leaf = path[path.length - 1];
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => leaf && onSelect(leaf)}
      data-mode={mode === 'mobile' ? 'h5' : 'pc'}
      className={cn(
        'flex w-full cursor-pointer box-border items-center border-0 bg-transparent text-left',
        'px-[var(--bv-cascader-pc-padding-x)]',
        'h-[var(--bv-cascader-pc-row-height)]',
        'text-bv-md leading-[var(--bv-line-md)]',
        'hover:bg-[var(--bv-active-color)]',
        selected && 'text-bv-primary',
        className,
      )}
      {...props}
      data-slot="cascader-search-result"
    >
      <span className="min-w-0 flex-1 truncate">
        {path.map((option, index) => (
          <React.Fragment key={String(option.value)}>
            {index > 0 ? (
              <span aria-hidden="true" className="text-bv-text-3">
                {' / '}
              </span>
            ) : null}
            <span className={index === path.length - 1 ? undefined : 'text-bv-text-3'}>
              {option.label}
            </span>
          </React.Fragment>
        ))}
      </span>
      {selected ? (
        <span
          aria-hidden="true"
          className="ml-[var(--bv-picker-gap)] flex shrink-0 items-center text-bv-primary text-[length:var(--bv-picker-icon-size)]"
        >
          <Icon name="check" />
        </span>
      ) : null}
    </button>
  );
});
