import * as React from 'react';

/**
 * Bivane Tabs · 组合式子件与子件元信息收集
 *
 * Tabs 是**组合式** API（对齐 Vant）：
 *
 *   <Tabs value={active} onChange={setActive}>
 *     <Tab title="标签一">内容一</Tab>
 *     <Tab title="标签二">内容二</Tab>
 *   </Tabs>
 *
 * 「标签条」与「内容区」是两块互不相邻的 DOM，但用户只写了一份 children。
 * 收口办法是让 Tab 成为一个**声明式标记**：它自己不渲染任何东西，
 * Tabs 在渲染前把 children 摊平、读出每个 Tab 的 title / disabled / children，
 * 自己拼出标签条与内容区。
 *
 * 为什么不用「注册式」（Tab 渲染时把自己登记进 Tabs）：
 * 登记是渲染期副作用，在 StrictMode 双渲染与并发渲染下会重复登记、
 * 顺序还可能倒过来（用户看到的标签顺序与 children 顺序不一致）。
 * 读 children 是纯函数，没有这些问题。
 *
 * Tab 用**类型身份**识别（Set 里比对函数引用），不是靠 props 形状猜：
 * 猜形状会把「恰好有 title 属性的自定义组件」也当成标签吞掉。
 */

export interface TabProps {
  /** 标签文案 */
  title: React.ReactNode;
  /** 禁用该标签：不可点，键盘切换时跳过 */
  disabled?: boolean;
  /** 标签内容（渲染在内容区） */
  children?: React.ReactNode;
}

/** 已登记的 Tab 组件类型（用于识别 children 里的 Tab 元素） */
const TAB_TYPES = new Set<React.ElementType>();

/**
 * Tab 标记组件：本身不渲染任何 DOM。
 *
 * 参数带下划线前缀是因为它确实用不到 props（props 是给 Tabs 读的）。
 */
export function Tab(_props: TabProps): null {
  return null;
}
TAB_TYPES.add(Tab);

export interface TabMeta {
  /** 稳定 key（React key 与测量索引都用它） */
  key: string;
  /** 标签文案 */
  title: React.ReactNode;
  /** 是否禁用 */
  disabled: boolean;
  /** 标签内容 */
  content: React.ReactNode;
}

export interface CollectedTabs {
  /** 摊平后的 Tab 列表（顺序 = children 顺序） */
  tabs: TabMeta[];
  /** 非 Tab 的 children（原样保留到内容区末尾，不吞掉用户内容） */
  others: React.ReactNode[];
}

/** 摊平 children：数组与 Fragment 都展开成一层 */
function flattenChildren(children: React.ReactNode): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (child === null || child === undefined || typeof child === 'boolean') return;
    if (React.isValidElement(child) && child.type === React.Fragment) {
      const fragmentProps = child.props as { children?: React.ReactNode };
      out.push(...flattenChildren(fragmentProps.children));
      return;
    }
    out.push(child);
  });
  return out;
}

function isTabElement(node: React.ReactElement): boolean {
  return typeof node.type !== 'string' && TAB_TYPES.has(node.type as React.ElementType);
}

/**
 * 从 children 里收集 Tab 元信息。
 *
 * 纯函数：同样的 children 永远得到同样的结果（key 用下标派生，稳定）。
 */
export function collectTabs(children: React.ReactNode): CollectedTabs {
  const tabs: TabMeta[] = [];
  const others: React.ReactNode[] = [];

  flattenChildren(children).forEach((child, index) => {
    if (React.isValidElement(child) && isTabElement(child)) {
      const props = child.props as TabProps;
      tabs.push({
        key: `tab-${index}`,
        title: props.title,
        disabled: props.disabled ?? false,
        content: props.children ?? null,
      });
      return;
    }
    others.push(child);
  });

  return { tabs, others };
}
