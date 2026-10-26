import * as React from 'react';
import type { PcTabbarVariant } from '@/components/pc/tabbar';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import { useTabbarState, type TabbarItem } from '@/hooks/use-tabbar-state';
import { lazyWithRef } from '@/lib/lazy-with-ref';

// H5 / PC 两套实现拆成异步 chunk（架构 §6.3 包体策略）
const H5Tabbar = lazyWithRef(() => import('@/components/h5/tabbar').then((m) => ({ default: m.H5Tabbar })));
const PcTabbar = lazyWithRef(() => import('@/components/pc/tabbar').then((m) => ({ default: m.PcTabbar })));

/**
 * Bivane Tabbar · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.3
 *
 * ┌ H5 ── 底部固定条 + 安全区，图标在上、文字在下
 * └ PC ── 侧边导航（默认）或顶部导航（pcVariant），图标在左、文字在右
 *
 * 为什么是模式 C 而不是 B：
 *   两端不是「同一个 primitive 换个壳」——底栏与侧边/顶部导航在**信息模型**
 *   与**空间位置**上都不同：底栏是屏幕最下面一条、占满宽度、均分；
 *   侧边导航是屏幕左侧一列、纵向排布、文字左对齐。
 *   强行换壳会得到「一条竖着的底栏」这种四不像，所以拆成两份实现。
 *
 * 状态归属：激活项（value）归分发层 —— 两端是同一个「当前选中哪一项」的语义。
 * 路由映射同样在分发层收口：组件库不绑定任何路由框架，
 * 受控 value + onChange 就是全部契约，item.href 只是可选透传。
 */

export type { TabbarItem };
export type { PcTabbarVariant };

export interface TabbarProps {
  /** 标签项 */
  items: TabbarItem[];
  /** 受控激活项 */
  value?: string;
  /** 非受控初始激活项；给不上就落到第一个未禁用项 */
  defaultValue?: string;
  /** 激活项变化 */
  onChange?: (value: string) => void;
  /** PC 端导航形态：侧边（默认）/ 顶部；H5 恒为底部 */
  pcVariant?: PcTabbarVariant;
  /** 固定（底栏固定在底部、侧边固定在左侧、顶部固定在顶部），默认 true */
  fixed?: boolean;
  /** 固定时留等高占位块，默认 true（PC 侧边形态不适用） */
  placeholder?: boolean;
  /** 底部安全区，默认 true（仅 H5 底栏生效） */
  safeAreaInsetBottom?: boolean;
  /** 分隔线，默认 true */
  border?: boolean;
  /** 自定义类名（透传到根元素） */
  className?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

export const Tabbar = React.forwardRef<HTMLDivElement, TabbarProps>(function Tabbar(
  {
    items,
    value,
    defaultValue,
    onChange,
    pcVariant = 'sidebar',
    fixed = true,
    placeholder = true,
    safeAreaInsetBottom = true,
    border = true,
    className,
    forceMode,
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const state = useTabbarState({ items, value, defaultValue, onChange });

  /** 选中某项：禁用项不响应（按钮本身也是 disabled，这里是第二道闸） */
  const select = React.useCallback(
    (next: string) => {
      const item = items.find((entry) => entry.value === next);
      if (!item || item.disabled) return;
      state.setActive(next);
    },
    [items, state],
  );

  return (
    <React.Suspense fallback={null}>
      {mode === 'mobile' ? (
        <H5Tabbar
          ref={ref}
          items={items}
          active={state.active}
          onSelect={select}
          fixed={fixed}
          placeholder={placeholder}
          safeAreaInsetBottom={safeAreaInsetBottom}
          border={border}
          className={className}
        />
      ) : (
        <PcTabbar
          ref={ref}
          items={items}
          active={state.active}
          onSelect={select}
          variant={pcVariant}
          fixed={fixed}
          placeholder={placeholder}
          border={border}
          className={className}
        />
      )}
    </React.Suspense>
  );
});
