import * as React from 'react';

/**
 * Bivane Cascader · 跨模式共享模型（模式 C 的「共享逻辑下沉 hooks/」那一层）
 *
 * 数据是一棵「子选项由父选项决定」的树（省 / 市 / 区）。两端共享这棵树的全部
 * 纯计算：字段归一化、沿路径下钻、H5 联动滚轮的「列集派生」、PC 级联面板的
 * 「层级列派生」、叶子摊平与路径搜索；不共享的是怎么走这棵树 ——
 *   · H5：所有层级一次摊成联动滚轮列（每一级都能直接滚到）；
 *   · PC：逐级展开的多列面板 + 面包屑（父层留在原地，下一级向右展开）。
 *
 * 只有**叶子节点可选**：点父节点只意味着「展开下一层」，不会产生 onChange
 * （对齐 Vant Cascader 的 finish 语义；不做任意级可选，避免一条链路两种提交点）。
 *
 * 依赖方向：本文件不 import 任何组件，不与 h5/pc 实现形成环。
 */

export type CascaderValue = string | number;

export interface CascaderOption {
  label: React.ReactNode;
  value: CascaderValue;
  disabled?: boolean;
  children?: CascaderOption[];
}

/**
 * 入参形态：默认读 label / value / children，可借 fieldNames 改成
 * text / value / children 等 Vant 风格数据。带索引签名是为了让业务直接传
 * 未归一化的对象数组（多余字段原样保留，归一化时只挑三个字段）。
 */
export interface CascaderDataItem {
  label?: React.ReactNode;
  value?: CascaderValue;
  disabled?: boolean;
  children?: CascaderDataItem[];
  [key: string]: unknown;
}

export interface CascaderFieldNames {
  label?: string;
  value?: string;
  children?: string;
}

const DEFAULT_FIELD_NAMES = { label: 'label', value: 'value', children: 'children' } as const;

/* ------------------------------------------------------------------ *
 * 归一化 / 结构判定
 * ------------------------------------------------------------------ */

export function normalizeOptions(
  items: ReadonlyArray<CascaderDataItem>,
  fieldNames?: CascaderFieldNames,
): CascaderOption[] {
  const labelKey = fieldNames?.label ?? DEFAULT_FIELD_NAMES.label;
  const valueKey = fieldNames?.value ?? DEFAULT_FIELD_NAMES.value;
  const childrenKey = fieldNames?.children ?? DEFAULT_FIELD_NAMES.children;

  return items.map((item, index) => {
    const rawValue = item[valueKey];
    // value 是级联路径的唯一标识，缺失视为数据错误：退化用 label/序号会让路径
    // 匹配静默错乱，给一个列内稳定且不与正常值冲突的占位（占位项随 disabled 不可选）
    const value: CascaderValue =
      typeof rawValue === 'string' || typeof rawValue === 'number'
        ? rawValue
        : `__bv_invalid_${index}`;
    const label = item[labelKey];
    const rawChildren = item[childrenKey];
    const childrenList = Array.isArray(rawChildren)
      ? normalizeOptions(rawChildren as CascaderDataItem[], fieldNames)
      : undefined;

    return {
      label: label === undefined || label === null ? String(value) : (label as React.ReactNode),
      value,
      disabled: Boolean(item.disabled) || !(typeof rawValue === 'string' || typeof rawValue === 'number'),
      ...(childrenList && childrenList.length > 0 ? { children: childrenList } : {}),
    };
  });
}

export function hasChildren(option: CascaderOption): boolean {
  return Array.isArray(option.children) && option.children.length > 0;
}

/** 叶子 = 没有子层；只有叶子能提交 */
export function isLeaf(option: CascaderOption): boolean {
  return !hasChildren(option);
}

export function findChild(
  options: ReadonlyArray<CascaderOption>,
  value: CascaderValue | undefined,
): CascaderOption | undefined {
  if (value === undefined) return undefined;
  return options.find((option) => option.value === value);
}

export function firstEnabled(options: ReadonlyArray<CascaderOption>): CascaderOption | undefined {
  return options.find((option) => !option.disabled);
}

/* ------------------------------------------------------------------ *
 * 路径解析
 * ------------------------------------------------------------------ */

/**
 * 沿值链下钻，返回实际走到的选项链。
 * 中途任何一级对不上（数据刷新、值失效）就**就地截断** —— 与菜单树同一策略：
 * 陈旧路径不该让整棵级联渲染成空白，退回最近的有效层即可。
 */
export function resolvePath(
  options: ReadonlyArray<CascaderOption>,
  values: ReadonlyArray<CascaderValue>,
): CascaderOption[] {
  const chain: CascaderOption[] = [];
  let current = options;

  for (const value of values) {
    const option = findChild(current, value);
    if (!option) break;
    chain.push(option);
    if (!hasChildren(option)) break;
    current = option.children as CascaderOption[];
  }

  return chain;
}

/** 已提交值是否有效：每一级都命中，且最后落在叶子上（半截路径不回显） */
export function isValidLeafPath(
  options: ReadonlyArray<CascaderOption>,
  values: ReadonlyArray<CascaderValue>,
): boolean {
  if (values.length === 0) return false;
  const chain = resolvePath(options, values);
  return chain.length === values.length && isLeaf(chain[chain.length - 1]);
}

/** 从当前链的最后一层继续，每一级取第一个可选项，补到叶子。用于 H5 滚轮的无值播种 */
export function fillFirstEnabledPath(
  options: ReadonlyArray<CascaderOption>,
  prefix: ReadonlyArray<CascaderOption> = [],
): CascaderOption[] {
  const chain = prefix.slice();
  let current =
    prefix.length === 0
      ? options
      : (prefix[prefix.length - 1].children as CascaderOption[] | undefined);

  while (current && current.length > 0) {
    const next = firstEnabled(current);
    if (!next) break;
    chain.push(next);
    if (isLeaf(next)) break;
    current = next.children;
  }

  return chain;
}

export function pathToValues(path: ReadonlyArray<CascaderOption>): CascaderValue[] {
  return path.map((option) => option.value);
}

/* ------------------------------------------------------------------ *
 * H5：联动滚轮列派生
 * ------------------------------------------------------------------ */

export interface LinkedColumns {
  /** 每一级的可选项（根层在 [0]） */
  columns: CascaderOption[][];
  /** 与 columns 对齐的当前值链；一定走到叶子（除非整棵树为空） */
  values: CascaderValue[];
  /** values 对应的完整选项链 */
  path: CascaderOption[];
}

/**
 * 由值链派生 H5 的联动滚轮列：
 *   每一级优先采用 values 里给定的值（精确匹配，即使禁用也尊重回显），
 *   给定值缺失/对不上时落该级第一个可选项 —— 与「换省后市/区重置为第一项」
 *   是同一条规则：调用方在第 i 级换值时，把 i 之后的值丢掉再调本函数即可。
 */
export function deriveLinkedColumns(
  options: ReadonlyArray<CascaderOption>,
  values: ReadonlyArray<CascaderValue>,
): LinkedColumns {
  const columns: CascaderOption[][] = [];
  const path: CascaderOption[] = [];
  const resolvedValues: CascaderValue[] = [];

  let current: ReadonlyArray<CascaderOption> = options;
  let level = 0;

  while (current.length > 0) {
    columns.push(current.slice());
    const matched = findChild(current, values[level]) ?? firstEnabled(current);
    if (!matched) break;
    path.push(matched);
    resolvedValues.push(matched.value);
    if (isLeaf(matched)) break;
    current = matched.children as CascaderOption[];
    level += 1;
  }

  return { columns, values: resolvedValues, path };
}

/**
 * 第 level 列改选后的新值链：保留前缀、换掉当前级、丢弃更深层级，
 * 再交给 deriveLinkedColumns 补到叶子（子列重置为各自的第一个可选项）。
 */
export function withLinkedValue(
  values: ReadonlyArray<CascaderValue>,
  level: number,
  nextValue: CascaderValue,
): CascaderValue[] {
  return [...values.slice(0, level), nextValue];
}

/* ------------------------------------------------------------------ *
 * PC：级联面板列派生（逐级展开，不自动补选）
 * ------------------------------------------------------------------ */

export interface PanelColumns {
  /** 从根到当前链最后一层的「下一级」为止的各列 */
  columns: CascaderOption[][];
  /** 实际有效的链（无效值就地截断后的结果） */
  chain: CascaderOption[];
}

/**
 * 由导航链派生 PC 面板的列：
 *   chain=[]           → 只有根列；
 *   chain=[省]         → 根列 + 省下的市列；
 *   chain=[省,市,区]   → 三列，区列里高亮已选叶子（不再追加空子列）。
 * 与 H5 的区别：**不补选**。用户没选过的层级就不高亮任何项，
 * 等他自己点；自动补第一项会让面板看起来像「已经选好了」。
 */
export function derivePanelColumns(
  options: ReadonlyArray<CascaderOption>,
  chainValues: ReadonlyArray<CascaderValue>,
): PanelColumns {
  const chain = resolvePath(options, chainValues);
  const columns: CascaderOption[][] = [options.slice()];

  chain.forEach((option) => {
    if (hasChildren(option)) {
      columns.push((option.children as CascaderOption[]).slice());
    }
  });

  return { columns, chain };
}

/* ------------------------------------------------------------------ *
 * PC：叶子摊平与路径搜索
 * ------------------------------------------------------------------ */

export interface FlatLeaf {
  option: CascaderOption;
  /** 根 → 叶子的完整选项链（含叶子） */
  path: CascaderOption[];
  values: CascaderValue[];
}

export function flattenLeaves(
  options: ReadonlyArray<CascaderOption>,
  prefix: CascaderOption[] = [],
): FlatLeaf[] {
  const result: FlatLeaf[] = [];

  options.forEach((option) => {
    // 禁用项整棵子树剪枝：禁用父级在面板里展不开，其叶子若出现在搜索结果里
    // 就是「搜得到却点不动」的死路（禁用叶子同理被这一条挡掉）
    if (option.disabled) return;
    const path = [...prefix, option];
    if (hasChildren(option)) {
      result.push(...flattenLeaves(option.children as CascaderOption[], path));
      return;
    }
    result.push({ option, path, values: pathToValues(path) });
  });

  return result;
}

function textOf(node: React.ReactNode): string | null {
  return typeof node === 'string' || typeof node === 'number' ? String(node) : null;
}

/**
 * 路径全文命中：把链上每一级的文本拼起来匹配（「浙江 杭州 西湖」都能搜到）。
 * label 是自定义节点时无法可靠取文本，退化为只匹配 value（同 Select 的 matchOption）。
 */
export function matchLeafPath(leaf: FlatLeaf, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;

  const text = leaf.path
    .map((option) => textOf(option.label) ?? String(option.value))
    .join(' ')
    .toLowerCase();
  return text.includes(kw);
}

export function searchLeaves(options: ReadonlyArray<CascaderOption>, keyword: string): FlatLeaf[] {
  const kw = keyword.trim();
  if (!kw) return [];
  return flattenLeaves(options).filter((leaf) => matchLeafPath(leaf, kw));
}

/* ------------------------------------------------------------------ *
 * React 绑定
 * ------------------------------------------------------------------ */

export interface UseCascaderStateOptions {
  options: ReadonlyArray<CascaderDataItem>;
  fieldNames?: CascaderFieldNames;
  value?: ReadonlyArray<CascaderValue>;
  defaultValue?: ReadonlyArray<CascaderValue>;
  onChange?: (values: CascaderValue[], options: CascaderOption[]) => void;
}

export interface UseCascaderStateResult {
  /** 归一化后的树 */
  tree: CascaderOption[];
  /** 已提交值（原样保留；是否有效用 isValidLeafPath 判） */
  selected: CascaderValue[];
  /** 已提交值的完整选项链；值失效时为空数组（触发器回退 placeholder） */
  selectedPath: CascaderOption[];
  setValue: (values: ReadonlyArray<CascaderValue>) => void;
  clear: () => void;
}

export function useCascaderState({
  options,
  fieldNames,
  value,
  defaultValue,
  onChange,
}: UseCascaderStateOptions): UseCascaderStateResult {
  const tree = React.useMemo(
    () => normalizeOptions(options, fieldNames),
    // 归一化只依赖数据与字段映射；options 身份变化由调用方负责（同其它组件）
    [options, fieldNames],
  );

  const isControlled = value !== undefined;
  const [innerValue, setInnerValue] = React.useState<ReadonlyArray<CascaderValue> | undefined>(
    defaultValue,
  );
  const current = isControlled ? value : innerValue;
  const selected = React.useMemo(() => (current ? current.slice() : []), [current]);

  // 只有完整叶子路径才回显；半截/失效路径一律视为未选（架构 §6.5 第 6 条）
  const selectedPath = React.useMemo(
    () => (isValidLeafPath(tree, selected) ? resolvePath(tree, selected) : []),
    [tree, selected],
  );

  const setValue = React.useCallback(
    (next: ReadonlyArray<CascaderValue>) => {
      if (!isControlled) setInnerValue(next);
      const path = resolvePath(tree, next);
      onChange?.(next.slice(), path);
    },
    [isControlled, tree, onChange],
  );

  const clear = React.useCallback(() => {
    if (!isControlled) setInnerValue([]);
    onChange?.([], []);
  }, [isControlled, onChange]);

  return { tree, selected, selectedPath, setValue, clear };
}
