import { useEffect, useRef } from 'react';
import { AnchorNav, type Anchor } from '../components/anchor-nav';
import { ExampleCard, type ExampleCode } from '../components/example-card';
import { CodeBlock, DocSection, ModeBadge } from '../components/doc-parts';
import { PropsTable, type PropMeta } from '../components/props-table';
import { chineseName } from '../component-label';
import { targetDomId, type RouteTarget } from '../search-index';

export interface RegistryEntry {
    name: string;
    slug: string;
    title: string;
    category: string;
    propsType: string;
    /** demo 模块名；数组表示这个组件页挂多个 demo */
    demo: string | string[];
    summary: string;
    h5: string;
    pc: string;
    mode: string;
    shared: string;
    difference: string;
    propsFile: string;
    install: string;
    importPath: string;
    props: PropMeta[];
}

/** 深链高亮的持续时间（ms）—— 足够读者注意到，又不至于赖着不走 */
const HIGHLIGHT_MS = 2400;

/**
 * 组件页
 *
 * 结构对齐 Ant Design / Element：
 *   标题 + 简介 → **示例**（一张卡一个用法，可展开源码）
 *   → **两端行为** → **API**（属性表 + 事件表）→ 上/下一组件
 *
 * 与它们最大的不同：我们的示例卡里是 **H5 与 PC 并排**。
 *
 * 另一处不同：右侧目录把**每张示例卡**都列成二级条目 ——
 * Uploader 一页有四张卡，只列「示例/API」三个入口等于没列。
 */
export function ComponentPage({
    entry,
    examples,
    exampleCode,
    target,
    highlightKey,
    prev,
    next,
    onNavigate,
}: {
    entry: RegistryEntry;
    /** 该组件的示例：[{ id, title, desc, Component }] */
    examples: {
        id: string;
        title: string;
        desc: string;
        Component: React.ComponentType;
    }[];
    /** 示例源码（按示例 id 索引） */
    exampleCode: Record<string, ExampleCode>;
    /** 深链目标（来自 URL 的 ?example= / ?prop=） */
    target: RouteTarget;
    /** 每次选中搜索结果都变 —— 保证「同一个目标再点一次」也能重新定位 */
    highlightKey: number;
    prev?: RegistryEntry;
    next?: RegistryEntry;
    onNavigate: (slug: string) => void;
}) {
    const timerRef = useRef<number | undefined>(undefined);

    // 深链落点的 DOM id（`ex-<示例id>` / `prop-<属性名>`）
    const domId = targetDomId(target);

    // ── 深链定位：滚到那一处 + 闪一下 ──
    //
    // 为什么要 highlightKey：同一个目标连点两次时 hash 没变，
    // hashchange 不会触发，读者就看不到「我点了它」的反馈。
    // 依赖里放 domId / slug 而不是 target 对象：后者每次渲染都是新引用。
    useEffect(() => {
        if (!domId) return;
        // 等一帧：React 刚把新页面渲染完，此刻 DOM 里才有那个节点
        const raf = requestAnimationFrame(() => {
            const el = document.getElementById(domId);
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('bv-deeplink-hit');
            window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                el.classList.remove('bv-deeplink-hit');
            }, HIGHLIGHT_MS);
        });
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(timerRef.current);
        };
    }, [domId, entry.slug, highlightKey]);

    const anchors: Anchor[] = [
        ...(examples.length
            ? [
                  {
                      id: 'examples',
                      title: '示例',
                  },
                  ...examples.map((ex) => ({
                      id: `ex-${ex.id}`,
                      title: ex.title,
                      level: 2 as const,
                  })),
              ]
            : []),
        { id: 'behavior', title: '两端行为' },
        { id: 'api', title: 'API' },
    ];

    return (
        <div className="flex min-w-0 flex-1 gap-bv-lg">
            <article className="min-w-0 max-w-[900px] flex-1">
                <header className="mb-bv-lg">
                    <div className="mb-bv-xs flex items-center gap-bv-xs">
                        <ModeBadge mode={entry.mode} />
                    </div>
                    <h1 className="mb-bv-xs text-bv-lg font-bv-bold">
                        {entry.title}
                    </h1>
                    <p className="text-bv-text-2">{entry.summary}</p>
                </header>

                {examples.length > 0 && (
                    <DocSection id="examples" title="示例">
                        <p className="mb-bv-md text-bv-sm text-bv-text-3">
                            每张卡片左右并排展示同一个示例在 H5（390px）与 PC
                            下的表现，由 ResponsiveProvider
                            强制模式 —— 两边各自独立持有状态，互不影响。
                        </p>
                        <div className="flex flex-col gap-bv-xl">
                            {examples.map((ex) => (
                                <ExampleCard
                                    key={ex.id}
                                    id={`ex-${ex.id}`}
                                    title={ex.title}
                                    desc={ex.desc}
                                    code={exampleCode[ex.id]}
                                >
                                    <ex.Component />
                                </ExampleCard>
                            ))}
                        </div>
                    </DocSection>
                )}

                <DocSection id="behavior" title="两端行为">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="border-b border-bv-border text-left text-xs uppercase tracking-wide text-bv-text-3">
                                    <th className="w-[80px] py-2 pr-4 font-medium">
                                        端
                                    </th>
                                    <th className="py-2 pr-4 font-medium">行为</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-bv-border align-top">
                                    <td className="py-2 pr-4 text-bv-sm text-bv-text-3">
                                        H5
                                    </td>
                                    <td className="py-2 pr-4 text-bv-text-2">
                                        {entry.h5 || '—'}
                                    </td>
                                </tr>
                                <tr className="border-b border-bv-border align-top">
                                    <td className="py-2 pr-4 text-bv-sm text-bv-text-3">
                                        PC
                                    </td>
                                    <td className="py-2 pr-4 text-bv-text-2">
                                        {entry.pc || '—'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {entry.shared && (
                        <p className="mt-bv-sm text-bv-sm text-bv-text-3">
                            <span className="font-medium">共享逻辑：</span>
                            {entry.shared}
                        </p>
                    )}
                    {entry.difference && (
                        <p className="mt-bv-xs text-bv-sm text-bv-text-3">
                            <span className="font-medium">本质差异：</span>
                            {entry.difference}
                        </p>
                    )}
                </DocSection>

                <DocSection id="api" title="API">
                    {entry.install && (
                        <div className="mb-bv-md">
                            <h3 className="mb-bv-xs text-bv-md font-bv-bold">
                                安装
                            </h3>
                            <CodeBlock code={entry.install} lang="bash" />
                            <p className="mt-bv-xs text-bv-sm text-bv-text-3">
                                装完在自己的项目里这样引：
                            </p>
                            <CodeBlock
                                code={`import { ${entry.name} } from '${entry.importPath}';`}
                                lang="tsx"
                            />
                        </div>
                    )}

                    <p className="mb-bv-sm text-bv-sm text-bv-text-3">
                        表格由 <code className="font-mono">scripts/extract-props.mjs</code>{' '}
                        从组件源码自动提取（{entry.propsType}
                        {entry.propsFile && ` · ${entry.propsFile}`}），与实现始终同步。
                    </p>
                    <PropsTable props={entry.props} />
                </DocSection>

                <nav className="mt-bv-xl flex items-center justify-between gap-bv-md border-t border-bv-border pt-bv-md">
                    {prev ? (
                        <button
                            type="button"
                            onClick={() => onNavigate(prev.slug)}
                            className="flex cursor-pointer items-center gap-bv-xs text-bv-sm text-bv-text-2 transition-colors hover:text-bv-primary"
                        >
                            <span>
                                ← {chineseName(prev.title)}
                            </span>
                            <span className="font-mono text-[11px] text-bv-text-3">
                                {prev.name}
                            </span>
                        </button>
                    ) : (
                        <span />
                    )}
                    {next && (
                        <button
                            type="button"
                            onClick={() => onNavigate(next.slug)}
                            className="flex cursor-pointer items-center gap-bv-xs text-bv-sm text-bv-text-2 transition-colors hover:text-bv-primary"
                        >
                            <span>
                                {chineseName(next.title)} →
                            </span>
                            <span className="font-mono text-[11px] text-bv-text-3">
                                {next.name}
                            </span>
                        </button>
                    )}
                </nav>
            </article>

            <AnchorNav anchors={anchors} />
        </div>
    );
}
