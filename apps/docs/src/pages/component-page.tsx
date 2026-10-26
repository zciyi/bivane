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

    // 「装完在自己的项目里这样引」面板要给出**可运行的示例**，
    // 不能只放 import —— 示例代码从 example-code.generated.json 取首个，
    // 与上方演示卡片的「查看代码」同源，不会漂移。
    // 包成 `Demo` 组件（setup 是 hook/常量声明，放函数体内；code 是 JSX
    // 片段，可能含多个兄弟节点，用 <>…</> 包裹后 return）。
    const firstExample = examples[0] ? exampleCode[examples[0].id] : undefined;
    const usageCode =
        firstExample && (firstExample.setup || firstExample.code)
            ? (() => {
                  const importLine = `import { ${entry.name} } from '${entry.importPath}';`;
                  const setup = (firstExample.setup || '')
                      .replace(/^\n+|\n+$/g, '')
                      .split('\n')
                      .map((l) => (l ? `  ${l}` : l))
                      .join('\n');
                  const code = (firstExample.code || '')
                      .replace(/^\n+|\n+$/g, '')
                      .split('\n')
                      .map((l) => (l ? `    ${l}` : l))
                      .join('\n');
                  return [
                      importLine,
                      '',
                      '// 以下示例与上方演示同源（已去掉文档站布局壳；用到的常量/回调按你的项目补全）',
                      'export function Demo() {',
                      setup,
                      '  return (',
                      '    <>',
                      code,
                      '    </>',
                      '  );',
                      '}',
                  ]
                      .filter((l) => l !== '')
                      .join('\n');
              })()
            : null;

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
                        <span className="rounded-md bg-bv-muted px-bv-xs py-[1px] font-mono text-[11px] text-bv-text-2">
                            {entry.name}
                        </span>
                    </div>
                    <h1 className="text-docs-h1 font-bv-bold tracking-tight">
                        {entry.title}
                    </h1>
                    <p className="mt-bv-xs text-docs-lead text-bv-text-2">
                        {entry.summary}
                    </p>
                </header>

                {examples.length > 0 && (
                    <DocSection id="examples" title="示例">
                        <p className="mb-bv-md text-[13px] text-bv-text-2">
                            每张卡片左右并排展示同一个示例在 H5（390px）与 PC
                            下的表现，由 ResponsiveProvider
                            强制模式 —— 两边各自独立持有状态，互不影响。
                        </p>
                        <div className="flex flex-col gap-bv-lg">
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
                    <div className="overflow-hidden rounded-docs-lg border border-bv-border bg-bv-surface shadow-docs-card">
                        <table className="w-full border-collapse text-left text-[13px]">
                            <thead>
                                <tr className="border-b border-bv-border bg-bv-muted/40 text-[11px] uppercase tracking-wide text-bv-text-2">
                                    <th className="w-[80px] px-bv-md py-bv-xs font-medium">
                                        端
                                    </th>
                                    <th className="px-bv-md py-bv-xs font-medium">
                                        行为
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-bv-border align-top">
                                    <td className="px-bv-md py-bv-xs">
                                        <span className="rounded bg-bv-primary/10 px-bv-xs py-[1px] font-mono text-[11px] text-bv-primary">
                                            H5
                                        </span>
                                    </td>
                                    <td className="px-bv-md py-bv-xs text-bv-text-2">
                                        {entry.h5 || '—'}
                                    </td>
                                </tr>
                                <tr className="align-top">
                                    <td className="px-bv-md py-bv-xs">
                                        <span className="rounded bg-bv-muted px-bv-xs py-[1px] font-mono text-[11px] text-bv-text-2">
                                            PC
                                        </span>
                                    </td>
                                    <td className="px-bv-md py-bv-xs text-bv-text-2">
                                        {entry.pc || '—'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {(entry.shared || entry.difference) && (
                        <div className="mt-bv-sm flex flex-col gap-bv-xs">
                            {[
                                ['共享逻辑', entry.shared],
                                ['本质差异', entry.difference],
                            ]
                                .filter((pair): pair is [string, string] =>
                                    Boolean(pair[1]),
                                )
                                .map(([label, text]) => (
                                    <div
                                        key={label}
                                        className="flex gap-bv-xs rounded-md border border-bv-border bg-bv-surface px-bv-md py-bv-xs text-[13px] shadow-docs-card"
                                    >
                                        <span className="shrink-0 font-medium text-bv-text">
                                            {label}
                                        </span>
                                        <span className="text-bv-text-2">
                                            {text}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    )}
                </DocSection>

                <DocSection id="api" title="API">
                    {entry.install && (
                        <div className="mb-bv-lg grid gap-bv-gutter md:grid-cols-2">
                            <div>
                                <h3 className="mb-bv-xs text-docs-h3 font-bv-bold">
                                    安装
                                </h3>
                                <CodeBlock
                                    code={entry.install}
                                    lang="bash"
                                    title="bash"
                                />
                            </div>
                            <div>
                                <h3 className="mb-bv-xs text-docs-h3 font-bv-bold">
                                    装完在自己的项目里这样引
                                </h3>
                                <CodeBlock
                                    code={`import { ${entry.name} } from '${entry.importPath}';`}
                                    lang="tsx"
                                    title="tsx"
                                />
                            </div>
                        </div>
                    )}

                    {usageCode && (
                        <div className="mb-bv-lg">
                            <h3 className="mb-bv-xs text-docs-h3 font-bv-bold">
                                完整示例
                            </h3>
                            <CodeBlock
                                code={usageCode}
                                lang="tsx"
                                title="tsx"
                            />
                        </div>
                    )}

                    <p className="mb-bv-sm text-[13px] text-bv-text-2">
                        表格由{' '}
                        <code className="font-mono">
                            scripts/extract-props.mjs
                        </code>{' '}
                        从组件源码自动提取（{entry.propsType}
                        {entry.propsFile && ` · ${entry.propsFile}`}），与实现始终同步。
                    </p>
                    <PropsTable props={entry.props} />
                </DocSection>

                <nav className="mt-bv-xl grid gap-bv-md sm:grid-cols-2">
                    {prev ? (
                        <button
                            type="button"
                            onClick={() => onNavigate(prev.slug)}
                            className="docs-focus group cursor-pointer rounded-docs-lg border border-bv-border bg-bv-surface px-bv-md py-bv-sm text-left shadow-docs-card transition-all duration-200 hover:border-bv-primary/45 hover:shadow-docs-card-hover"
                        >
                            <span className="text-[11px] text-bv-text-2">
                                上一篇
                            </span>
                            <span className="mt-bv-xs flex items-center gap-bv-xs text-docs-h3 font-bv-bold transition-colors group-hover:text-bv-primary">
                                <span className="text-bv-text-2 transition-colors group-hover:text-bv-primary">
                                    ←
                                </span>
                                {chineseName(prev.title)}
                            </span>
                            <span className="mt-bv-base block font-mono text-[11px] text-bv-text-2">
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
                            className="docs-focus group cursor-pointer rounded-docs-lg border border-bv-border bg-bv-surface px-bv-md py-bv-sm text-right shadow-docs-card transition-all duration-200 hover:border-bv-primary/45 hover:shadow-docs-card-hover sm:col-start-2"
                        >
                            <span className="text-[11px] text-bv-text-2">
                                下一篇
                            </span>
                            <span className="mt-bv-xs flex items-center justify-end gap-bv-xs text-docs-h3 font-bv-bold transition-colors group-hover:text-bv-primary">
                                {chineseName(next.title)}
                                <span className="text-bv-text-2 transition-colors group-hover:text-bv-primary">
                                    →
                                </span>
                            </span>
                            <span className="mt-bv-base block font-mono text-[11px] text-bv-text-2">
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
