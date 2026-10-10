import * as React from "react";
import { H5Menu } from "@/components/h5/menu";
import { PcMenu } from "@/components/pc/menu";
import {
  MenuTriggerPath,
  type MenuPanelProps,
} from "@/components/ui/menu-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
  findMenuOption,
  findMenuPath,
  type MenuItem,
  type MenuOption,
  type MenuValue,
} from "@/hooks/use-menu-state";

/**
 * Bivane DropdownMenu · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 底部抽屉，二级菜单作为**下一层面板推入**（标题栏换成该层名字 + 返回箭头）
 * └ PC ── 锚定触发器下方的浮层，子菜单**向右展开**（父层不动），行尾显示快捷键提示
 *
 * 为什么是模式 C 而不是 B：
 *   两端的分野不在容器，而在**「怎么走这棵树」**——
 *   移动端屏幕窄，子菜单无法并排展开，只能替换当前视野（下钻 + 返回）；
 *   桌面端相反，父层必须留着，否则「我从哪个菜单进来的」就丢了。
 *   这是两种导航范式，不是同一个 primitive 换壳。
 *   共享的部分压到最小公约数：菜单树结构、路径解析、行外观与触发器外壳。
 *
 * 与 Select 的差别（别照抄那边的状态归属）：
 *   Select 有「值」，值语义两端一致，所以 value 状态归分发层；
 *   DropdownMenu 除了「路径」还有一层**可选值**语义（value/onChange，按树中
 *   节点的 value 匹配**完整层级路径**回填触发器）——它两端同义，因此和 Select 一样归分发层；
 *   而路径的深度由**导航范式**决定（H5 需要面板栈，PC 靠 Radix 子菜单自带状态），
 *   所以路径状态留在 h5/menu.tsx 内部。一句话：**跨模式同义的状态归分发层，
 *   模式私有语义的状态归实现**。
 *
 * 两种用法（同一套 props，用法一不给 value 相关 props 即是）：
 *   1. 纯操作菜单（默认）：点叶子执行 onSelect 动作并关闭；
 *   2. 可选值菜单：传 value/onChange，触发器回填选中项的**层级路径**，行尾打勾。
 *      H5 传 confirmable 走「暂存 → 确定」（点叶子只打勾，点确定才提交）；
 *      PC 恒为点选即生效。
 */

export interface DropdownMenuProps {
  /** 菜单树。用 `{ divider: true }` 表示分隔线 */
  items: MenuItem[];
  /** 触发器文案。有 value 且匹配到树中节点时，回填「根 → … → 选中项」的层级路径覆盖它（顶层项即其 label） */
  trigger: React.ReactNode;
  /** 叶子项被激活（父项只是下钻，不触发它）。暂存模式下点叶子**不**触发，确定时才走 onChange */
  onSelect?: (value: MenuValue, option: MenuOption) => void;
  /** 可选值场景：受控选中项的 value（树中某叶子项的 value） */
  value?: MenuValue;
  /** 可选值场景：非受控初始值 */
  defaultValue?: MenuValue;
  /** 可选值场景：选中项变化。H5 暂存模式下点「确定」才触发；PC 点选即触发 */
  onChange?: (value: MenuValue, option: MenuOption) => void;
  /** H5 是否走「暂存 → 确定」，默认 false（点选即生效）。PC 恒为点选即生效 */
  confirmable?: boolean;
  /** 工具栏右键文案（H5 暂存确认时） */
  confirmText?: React.ReactNode;
  /** 工具栏左键文案（H5 暂存确认时；行为是关闭并放弃暂存） */
  cancelText?: React.ReactNode;
  /** H5 抽屉根层的标题栏文案；PC 不渲染标题栏（浮层由触发器说明自己是什么） */
  title?: React.ReactNode;
  /** PC 浮层与触发器的对齐方向，默认 bottom-start */
  placement?: "bottom-start" | "bottom-end";
  /** 叶子项选中后是否关闭菜单，默认 true（暂存模式恒不关闭，由「确定」关） */
  closeOnSelect?: boolean;
  disabled?: boolean;
  /** 某一层没有可交互条目时的文案 */
  emptyText?: React.ReactNode;
  /** 无障碍名称；没有可见 label 时应当传入 */
  ariaLabel?: string;
  id?: string;
  className?: string;
  /** 逃生舱：强制某个模式的交互（契约第 9 条唯一例外） */
  forceMode?: DeviceMode;
}

export const DropdownMenu = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuProps
>(function DropdownMenu(
  {
    items,
    trigger,
    onSelect,
    value,
    defaultValue,
    onChange,
    confirmable = false,
    confirmText = "确定",
    cancelText = "取消",
    title,
    placement = "bottom-start",
    closeOnSelect = true,
    disabled = false,
    emptyText = "暂无选项",
    ariaLabel,
    id,
    className,
    forceMode,
  },
  ref,
) {
  const mode = useDeviceMode(forceMode);
  const [open, setOpen] = React.useState(false);

  /** 可选值场景：true 当且仅当调用方给了 value 或 defaultValue 或 onChange */
  const selectable =
    value !== undefined ||
    defaultValue !== undefined ||
    onChange !== undefined;
  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<MenuValue | undefined>(
    defaultValue,
  );
  const currentValue = isControlled ? value : innerValue;

  /**
   * H5 暂存确认：点叶子只记草稿，点「确定」才提交。
   * 草稿打开时从当前值拷贝，关闭即丢弃，与 Select 的暂存同一形态。
   */
  const staged = mode === "mobile" && confirmable && selectable;
  const [draft, setDraft] = React.useState<MenuValue | null>(null);

  React.useEffect(() => {
    if (open && staged) setDraft(currentValue ?? null);
    if (!open) setDraft(null);
  }, [open, staged, currentValue]);

  // 禁用时强制收起：disabled 是运行期可变的（权限、加载中），
  // 若在展开状态下被置为 true，浮层不能就这么挂着
  React.useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const commit = React.useCallback(
    (next: MenuValue, option: MenuOption) => {
      if (!isControlled) setInnerValue(next);
      onChange?.(next, option);
    },
    [isControlled, onChange],
  );

  const handleSelect = React.useCallback(
    (next: MenuValue, option: MenuOption) => {
      if (staged) {
        // 暂存：只记草稿 + 行内打勾，不触发 onChange / onSelect、不关闭
        setDraft(next);
        return;
      }
      onSelect?.(next, option);
      if (selectable) commit(next, option);
    },
    [staged, onSelect, selectable, commit],
  );

  const handleConfirm = React.useCallback(() => {
    if (!staged || draft === null) return;
    const option = findMenuOption(items, draft);
    if (option) commit(draft, option);
    setOpen(false);
  }, [staged, draft, items, commit]);

  /** PC 端没有工具栏，这两个回调不会被渲染出来；传 NOOP 只为满足接口形状 */
  const NOOP = React.useCallback(() => {}, []);

  /** 选中项在树中的完整链（非可选值场景 / 值失效时为 undefined）。回显与定位共用这一次查找 */
  const selectedPath = React.useMemo(
    () =>
      selectable && currentValue !== undefined
        ? findMenuPath(items, currentValue)
        : undefined,
    [selectable, currentValue, items],
  );

  /**
   * 可选值场景：触发器回填**选中项的完整层级路径**（如「移动到 / 归档」）。
   * 只回填末级 label 会丢掉「选中的是哪一层里的哪一项」（理由见 MenuTriggerPath）；
   * 顶层选中退化成纯 label；树里找不到（value 失效）时回退原始文案，不显示半个路径。
   */
  const triggerContent = React.useMemo(() => {
    if (!selectedPath) return trigger;
    return selectedPath.length > 1 ? (
      <MenuTriggerPath path={selectedPath} />
    ) : (
      selectedPath[0].label
    );
  }, [selectedPath, trigger]);

  /**
   * 展开时要定位到的层级：选中项的**祖先 value 链**（未选中 / 值失效时为空数组）。
   * 与回显同源——回显解决「看得到」，它解决「打开就到位」：树里选中项可能埋在三层之下，
   * 展开时若一律从根层开始，用户得自己一层层点进去才能确认当前选的是哪一条。
   */
  const initialPath = React.useMemo(
    () => selectedPath?.slice(0, -1).map((option) => option.value) ?? [],
    [selectedPath],
  );

  const panelProps: MenuPanelProps = {
    mode,
    open,
    onOpenChange: setOpen,
    items,
    onSelect: handleSelect,
    title,
    emptyText,
    placement,
    closeOnSelect: staged ? false : closeOnSelect,
    disabled,
    trigger: triggerContent,
    initialPath,
    selectedValue: selectable
      ? staged && draft !== null
        ? draft
        : currentValue
      : undefined,
    staged,
    confirmText,
    cancelText,
    onConfirm: staged ? handleConfirm : NOOP,
    onCancel: staged ? () => setOpen(false) : NOOP,
    className,
    ariaLabel,
    id,
  };

  return mode === "mobile" ? (
    <H5Menu ref={ref} {...panelProps} />
  ) : (
    <PcMenu ref={ref} {...panelProps} />
  );
});

export type {
  MenuDivider,
  MenuItem,
  MenuOption,
  MenuValue,
} from "@/hooks/use-menu-state";
