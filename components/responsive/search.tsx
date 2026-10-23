import * as React from 'react';
import { H5Search } from '@/components/h5/search';
import { PcSearch } from '@/components/pc/search';
import type { SearchShape, SearchViewProps } from '@/components/ui/search-parts';
import { useDeviceMode, type DeviceMode } from '@/hooks/use-device-mode';
import {
  SEARCH_HISTORY_LIMIT,
  useSearchState,
} from '@/hooks/use-search-state';

/**
 * Bivane Search · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 内联搜索条；聚焦/点击展开**全屏搜索页**（返回键退出），
 * │        页内展示历史记录（有词时切建议列表）
 * └ PC ── 内联输入框 + **建议浮层**（Radix Popover 锚定 + ↑↓/Enter/Esc 键盘），
 *          无历史（历史是 H5 全屏页特有，PC 靠浏览器/输入框历史兜底）
 *
 * 为什么是模式 C 而不是 B：
 * 两端不是「同一个 primitive 换壳」，而是**两套交互范式**——
 * H5 是「进入一个全屏任务页再退出」，PC 是「就地聚焦、就地浮出建议」。
 * 值语义（搜索词文本）两端一致，但「输入框在哪、建议摆在哪、怎么退出」全都不同。
 *
 * 状态归属：本文件拥有 value / open / 历史 / 建议源 / 防抖，
 * 两份实现都是受控展示层，因此双模式 props 天然一致（契约第 9 条）。
 */

export interface SearchProps {
  /** 受控搜索词 */
  value?: string;
  /** 非受控初始搜索词 */
  defaultValue?: string;
  /** 搜索词变化（每次输入） */
  onChange?: (value: string) => void;
  /** 提交（回车 / 点建议 / 点历史） */
  onSearch?: (keyword: string) => void;
  /** 点击清除键 */
  onClear?: () => void;
  /** 搜索框占位文案，默认「搜索」 */
  placeholder?: string;
  /** 禁用搜索框 */
  disabled?: boolean;
  /** 只读：不可键入（仍可聚焦/复制） */
  readonly?: boolean;
  /** 展示清除键，默认 true（对齐 Vant van-search） */
  clearable?: boolean;
  /** 胶囊形状，默认 round（对齐 Vant） */
  shape?: SearchShape;
  /** 左侧固定文案（Vant 的 label） */
  label?: React.ReactNode;
  /** 静态建议词；与 onFetchSuggestions 二选一，同时提供以异步为准 */
  suggestions?: string[];
  /** 异步建议源；空关键词不触发，返回值防抖后才请求 */
  onFetchSuggestions?: (keyword: string) => string[] | Promise<string[]>;
  /** 异步建议防抖毫秒，默认 300 */
  debounce?: number;
  /** 历史记录（受控）；不传则组件内内存维护（卸载即失） */
  history?: string[];
  /** 历史记录变化（新增 / 清空时触发） */
  onHistoryChange?: (history: string[]) => void;
  /** H5 全屏页是否展示历史记录区，默认 true（PC 恒不展示） */
  showHistory?: boolean;
  /** 历史条数上限，默认 10 */
  historyLimit?: number;
  /** 建议为空时的文案 */
  emptyText?: React.ReactNode;
  /** 异步建议加载中的文案 */
  loadingText?: React.ReactNode;
  /** 历史区标题 */
  historyText?: React.ReactNode;
  /** 清空历史按钮文案 */
  clearHistoryText?: React.ReactNode;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  /** 搜索框 id（挂在内层输入外壳上） */
  id?: string;
  /** 自定义类名（透传到根元素） */
  className?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

export const Search = React.forwardRef<HTMLDivElement, SearchProps>(function Search(
  {
    value,
    defaultValue,
    onChange,
    onSearch,
    onClear,
    placeholder = '搜索',
    disabled = false,
    readonly = false,
    clearable = true,
    shape = 'round',
    label,
    suggestions,
    onFetchSuggestions,
    debounce = 300,
    history,
    onHistoryChange,
    showHistory = true,
    historyLimit = SEARCH_HISTORY_LIMIT,
    emptyText = '没有找到相关结果',
    loadingText = '搜索中…',
    historyText = '历史记录',
    clearHistoryText = '清空',
    ariaLabel,
    id,
    className,
    forceMode,
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const [open, setOpen] = React.useState(false);

  const state = useSearchState({
    value,
    defaultValue,
    onChange,
    onSearch,
    onClear,
    history,
    onHistoryChange,
    suggestions,
    onFetchSuggestions,
    debounce,
    historyLimit,
  });

  /** 选中一条建议/历史：写 value、提交、收起当前浮层 */
  const pick = React.useCallback(
    (text: string) => {
      state.pick(text);
      setOpen(false);
    },
    [state],
  );

  /** 回车提交（空关键词时由 state.submit 内部忽略） */
  const submit = React.useCallback(() => {
    state.submit();
    setOpen(false);
  }, [state]);

  const pickHistory = React.useCallback(
    (text: string) => {
      state.pick(text);
      setOpen(false);
    },
    [state],
  );

  const viewProps: SearchViewProps = {
    mode,
    open,
    onOpenChange: setOpen,
    value: state.value,
    onValueChange: state.setValue,
    onSubmit: submit,
    onClear: state.clear,
    suggestions: state.suggestions,
    suggestionsLoading: state.suggestionsLoading,
    onPick: pick,
    history: state.history,
    showHistory,
    onPickHistory: pickHistory,
    onRemoveHistory: state.removeHistory,
    onClearHistory: state.clearHistory,
    placeholder,
    disabled,
    readonly,
    clearable,
    shape,
    label,
    emptyText,
    loadingText,
    historyText,
    clearHistoryText,
    ariaLabel,
    id,
    className,
  };

  return mode === 'mobile' ? (
    <H5Search ref={ref} {...viewProps} />
  ) : (
    <PcSearch ref={ref} {...viewProps} />
  );
});

export type { SearchShape } from '@/components/ui/search-parts';