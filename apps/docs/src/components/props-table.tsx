export interface PropMeta {
    name: string;
    type: string;
    optional: boolean;
    description: string;
    default: string | null;
    inherited: boolean;
    /** 'prop' = 普通属性；'event' = 回调事件（onXxx） */
    kind: 'prop' | 'event';
}

/**
 * props 表
 *
 * 数据来自 apps/docs/src/props.generated.json ——
 * 由 scripts/extract-props.mjs 从**组件源码**里抽（TypeScript 编译器 API），
 * 所以表永远跟实现同步，不需要手工维护。
 *
 * 拆成「属性」「事件」两张表（Ant Design / Element 都是这么分的）：
 * 混在一起时上千个属性会把回调事件淹掉，而回调恰恰是查阅时最常找的。
 */
export function PropsTable({ props }: { props: PropMeta[] }) {
    if (props.length === 0) {
        return (
            <p className="text-sm text-bv-text-2">该组件暂无 props（纯展示型组件）。</p>
        );
    }

    const events = props.filter((p) => p.kind === 'event');
    const attrs = props.filter((p) => p.kind !== 'event');

    return (
        <div className="flex flex-col gap-bv-lg">
            <PropsGroup
                title="属性"
                count={attrs.length}
                props={attrs}
                emptyText="该组件没有额外属性。"
            />
            <PropsGroup
                title="事件"
                count={events.length}
                props={events}
                emptyText="该组件没有事件回调。"
            />
        </div>
    );
}

/** 一组 props（属性或事件） */
function PropsGroup({
    title,
    count,
    props,
    emptyText,
}: {
    title: string;
    count: number;
    props: PropMeta[];
    emptyText: string;
}) {
    return (
        <div>
            <h3 className="mb-bv-sm flex items-center gap-bv-xs text-docs-h3 font-bv-bold">
                {title}
                <span className="rounded-full bg-bv-primary/10 px-bv-xs text-[11px] font-normal text-bv-primary">
                    {count}
                </span>
            </h3>
            {props.length === 0 ? (
                <p className="text-sm text-bv-text-2">{emptyText}</p>
            ) : (
                <div className="overflow-hidden rounded-docs-lg border border-bv-border bg-bv-surface shadow-docs-card">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-bv-border bg-bv-muted/40 text-[11px] uppercase tracking-wide text-bv-text-2">
                                    <th className="w-[160px] px-bv-md py-bv-xs font-medium">
                                        名称
                                    </th>
                                    <th className="py-bv-xs pr-4 font-medium">
                                        类型
                                    </th>
                                    <th className="w-[120px] px-bv-md py-bv-xs font-medium">
                                        默认值
                                    </th>
                                    <th className="px-bv-md py-bv-xs font-medium">
                                        说明
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {props.map((p) => (
                                    <tr
                                        key={p.name}
                                        // id 是深链的落点（#/dialog?prop=onConfirm）。
                                        // ⚠ 与 search-index.ts 的 targetDomId() 逐字对应 ——
                                        //   两边改一处，深链就静默失效（页面照常渲染，只是不滚不亮），
                                        //   由 tests/docs-search.test.ts 把守。
                                        id={`prop-${p.name}`}
                                        className="scroll-mt-20 border-b border-bv-border align-top transition-colors last:border-0 hover:bg-bv-muted/40"
                                    >
                                        <td className="px-bv-md py-bv-xs font-mono text-[12.5px] text-bv-primary">
                                            {p.name}
                                            {p.optional ? (
                                                <span
                                                    className="ml-1 text-bv-text-2"
                                                    title="可选"
                                                >
                                                    ?
                                                </span>
                                            ) : null}
                                            {p.inherited ? (
                                                <span
                                                    className="ml-1 rounded bg-bv-muted px-1 text-[10px] text-bv-text-2"
                                                    title="继承自基接口"
                                                >
                                                    继承
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="py-bv-xs pr-4 font-mono text-[12px] text-bv-text-2">
                                            {p.type}
                                        </td>
                                        <td className="px-bv-md py-bv-xs font-mono text-[12px] text-bv-text-2">
                                            {p.default ?? '—'}
                                        </td>
                                        <td className="px-bv-md py-bv-xs text-bv-text-2">
                                            {/* 缺说明就留空：刷一屏占位提示只会把「文档没写」
                                                印刷成噪音。真正管住它的是
                                                tests/docs-registry.test.ts 的守卫——展示的属性必须
                                                带 JSDoc，新组件想不带说明上线，先过守卫那关。 */}
                                            {p.description || null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
