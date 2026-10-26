import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Cascader = lazyWithRef(() => import("@/components/h5/cascader").then((m) => ({ default: m.H5Cascader })));
const PcCascader = lazyWithRef(() => import("@/components/pc/cascader").then((m) => ({ default: m.PcCascader })));
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
  deriveLinkedColumns,
  searchLeaves,
  useCascaderState,
  withLinkedValue,
  type CascaderDataItem,
  type CascaderFieldNames,
  type CascaderOption,
  type CascaderValue,
  type LinkedColumns,
} from "@/hooks/use-cascader-state";

/**
 * Bivane Cascader · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 树形级联选择（省 / 市 / 区；Area 数据直接喂 options 即可）：
 * ┌ H5 ── 底部弹层 + **联动滚轮**：滚「省」则「市/区」列整体重算并回到第一项，
 * │        顶部工具条，恒走暂存 → 确定
 * └ PC ── 锚定浮层 + 逐级展开的多列面板 + 面包屑路径 + 搜索定位，
 *          点**叶子**即生效即关（桌面点选即生效，同 Select/DropdownMenu）
 *
 * 状态归属（架构 §6.5 第 4 条推论，别照抄别的组件）：
 *   open / 已提交路径两端同义 → 本层；
 *   H5 的联动滚轮草稿（永远补到叶子的完整值链）、PC 的导航链与搜索词 → 各自实现层。
 *   所以本文件同时持有两份实现层状态，但它们只在各自模式被渲染/消费。
 *
 * 只有叶子能提交；回显必须是根→叶子的完整路径，半截/失效路径回退 placeholder。
 */

export interface CascaderProps {
  /** 树形选项；默认字段 label/value/children，可用 fieldNames 改映射 */
  options: ReadonlyArray<CascaderDataItem>;
  /** 字段名映射，可直接喂 Vant 风格 {text,value,children} 数据 */
  fieldNames?: CascaderFieldNames;
  /** 受控值：根 → 叶子的完整路径值数组 */
  value?: CascaderValue[];
  /** 非受控初始值 */
  defaultValue?: CascaderValue[];
  /** 叶子选定后触发，回传完整值链与选项链 */
  onChange?: (values: CascaderValue[], options: CascaderOption[]) => void;
  /**
   * 搜索定位。仅 PC 呈现：H5 滚轮列没有搜索的落点（触屏主路径是滚），
   * 同一 prop 两端呈现差异由模式决定，不经额外 props 泄露。
   */
  searchable?: boolean;
  /** H5 面板标题；PC 不渲染标题栏 */
  title?: React.ReactNode;
  /** 无选中值时展示 */
  placeholder?: React.ReactNode;
  /** 禁用：触发器不可点、不清除 */
  disabled?: boolean;
  /** 展示清除按钮（仅在有选中值、且未禁用时出现） */
  clearable?: boolean;
  /** PC 搜索框占位文案，默认「搜索」 */
  searchPlaceholder?: string;
  /** 无匹配项时的文案 */
  emptyText?: React.ReactNode;
  /** 面包屑根层文案 */
  rootText?: React.ReactNode;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  /** 触发器 id */
  id?: string;
  /** 自定义类名（透传弹层面板） */
  className?: string;
  /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
  forceMode?: DeviceMode;
}

function labelsToText(path: CascaderOption[]): string {
  return path
    .map((option) =>
      typeof option.label === "string" || typeof option.label === "number"
        ? String(option.label)
        : "",
    )
    .filter((text) => text !== "")
    .join(" / ");
}

export const Cascader = React.forwardRef<HTMLDivElement, CascaderProps>(
  function Cascader(
    {
      options,
      fieldNames,
      value,
      defaultValue,
      onChange,
      searchable = false,
      title,
      placeholder = "请选择",
      disabled = false,
      clearable = false,
      searchPlaceholder = "搜索",
      emptyText = "暂无数据",
      rootText = "请选择",
      ariaLabel,
      id,
      className,
      forceMode,
    },
    ref,
  ) {
    const mode = useDeviceMode(forceMode);
    const [open, setOpen] = React.useState(false);

    const { tree, selectedPath, setValue, clear } = useCascaderState({
      options,
      fieldNames,
      value,
      defaultValue,
      onChange,
    });

    // H5 实现层：联动滚轮的完整列集与值链（永远补到叶子）
    const [linked, setLinked] = React.useState<LinkedColumns>(() =>
      deriveLinkedColumns(tree, []),
    );
    // PC 实现层：当前导航链（可停在父级）与搜索词
    const [chain, setChain] = React.useState<CascaderValue[]>([]);
    const [keyword, setKeyword] = React.useState("");

    /**
     * 打开时播种两端的实现层状态：已提交值是完整叶子路径时照它定位（展开即定位，
     * 架构 §6.5 第 7 条），否则 H5 从首个可选项补到叶子、PC 从根层开始。
     * 关闭收回搜索词。
     */
    React.useEffect(() => {
      if (!open) return;
      const seed = selectedPath.map((option) => option.value);
      setLinked(deriveLinkedColumns(tree, seed));
      setChain(seed);
      setKeyword("");
      // 只在打开翻转时播种；tree 变化不重算，避免用户正在下钻时被拽回
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleOpenChange = React.useCallback(
      (next: boolean) => {
        if (disabled) return;
        setOpen(next);
      },
      [disabled],
    );

    /** H5：第 level 列改选，更深列丢弃后重算（子列回到各自第一个可选项） */
    const handleLinkedColumnChange = React.useCallback(
      (level: number, nextValue: CascaderValue) => {
        setLinked((prev) =>
          deriveLinkedColumns(
            tree,
            withLinkedValue(prev.values, level, nextValue),
          ),
        );
      },
      [tree],
    );

    /** H5 确定：联动链此刻一定是完整叶子路径 */
    const handleLinkedSubmit = React.useCallback(() => {
      setValue(linked.values);
      setOpen(false);
    }, [linked.values, setValue]);

    /** PC：点叶子 / 搜中结果，提交完整路径并关闭 */
    const handleCommit = React.useCallback(
      (nextValues: CascaderValue[]) => {
        setValue(nextValues);
        setOpen(false);
      },
      [setValue],
    );

    const triggerText = React.useMemo(
      () => labelsToText(selectedPath),
      [selectedPath],
    );
    const filled = selectedPath.length > 0;

    // 搜索结果在分发层算（纯函数），PC 只负责渲染；关闭后关键词清空，结果自然为空
    const searchResults = React.useMemo(
      () =>
        open && mode === "desktop" && searchable
          ? searchLeaves(tree, keyword)
          : [],
      [open, mode, searchable, tree, keyword],
    );

    const commonProps = {
      mode,
      open,
      onOpenChange: handleOpenChange,
      title,
      placeholder,
      disabled,
      clearable,
      onClear: clear,
      triggerText,
      filled,
      className,
      ariaLabel,
      id,
    } as const;

    return (
      <React.Suspense fallback={null}>
        {mode === "mobile" ? (
          <H5Cascader
            ref={ref}
            {...commonProps}
            linked={linked}
            confirmText="确定"
            cancelText="取消"
            onLinkedColumnChange={handleLinkedColumnChange}
            onSubmit={handleLinkedSubmit}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <PcCascader
            ref={ref}
            {...commonProps}
            tree={tree}
            chain={chain}
            onChainChange={setChain}
            selectedValues={selectedPath.map((option) => option.value)}
            searchable={searchable}
            keyword={keyword}
            onKeywordChange={setKeyword}
            searchResults={searchResults}
            searchPlaceholder={searchPlaceholder}
            emptyText={emptyText}
            rootText={rootText}
            onCommit={handleCommit}
            onCancel={() => setOpen(false)}
          />
        )}
      </React.Suspense>
    );
  },
);

export type {
  CascaderDataItem,
  CascaderFieldNames,
  CascaderOption,
  CascaderValue,
} from "@/hooks/use-cascader-state";
