import * as React from 'react';

/**
 * 让 React.lazy 加载的 forwardRef 组件支持 ref 透传。
 *
 * 原生 `React.lazy` 不转发 ref：`<Lazy ref={r} />` 里的 r 拿不到被加载组件的实例。
 * 分发层（components/responsive/*）大量使用 forwardRef 把根 DOM 透传给外部，
 * 为把这些实现拆成异步 chunk（架构 §6.3 包体策略），必须用本包装保留 ref 语义。
 *
 * 在 React 19 中 ref 作为普通 prop 传递，因此这里用 forwardRef 包一层、把 ref
 * 作为 prop 透传给内部 lazy 组件即可生效。异步 chunk 加载完成前 ref.current 为
 * null（首屏一帧内），加载完成后即指向真实根 DOM，与静态引入行为一致。
 *
 * 返回类型与被加载的 forwardRef 组件完全一致（由调用处的 import 类型推断），
 * 因此分发层 render 处无需任何改动。
 */

/** 宽松组件类型：lazy 边界内只做「接收任意 props + 透传 ref」，不关心具体签名 */
type LazyLoadable = React.ComponentType<Record<string, unknown>>;

export function lazyWithRef<T>(factory: () => Promise<{ default: T }>): T {
  const Lazy = React.lazy(factory as () => Promise<{ default: LazyLoadable }>);
  const Wrapped = React.forwardRef(function LazyWithRef(
    props: Record<string, unknown>,
    ref: React.Ref<unknown>,
  ) {
    return React.createElement(Lazy, { ...props, ref });
  });
  return Wrapped as unknown as T;
}
