import { CATALOG } from '@/apps/docs/src/catalog';

/**
 * 组件网格：清单直接取自文档站的 catalog（单一事实源，避免两边漂移）。
 *
 * 卡片点击跳转到文档站对应组件页。文档站部署路径目前假设为
 * `https://zciyi.github.io/bivane/docs/`（与官网同站、不同子路径）；
 * 若实际部署路径不同，改 DOCS_BASE 即可。
 */
const DOCS_BASE = 'https://zciyi.github.io/bivane/docs/';

export function ComponentGrid() {
    return (
        <section id="components" className="mx-auto max-w-6xl px-bv-md py-bv-xl">
            <div className="flex items-end justify-between gap-bv-md">
                <div>
                    <h2 className="text-docs-h2 font-bv-bold tracking-tight">
                        全部组件
                    </h2>
                    <p className="mt-bv-xs text-bv-text-2">
                        共 {CATALOG.length} 个公开组件，每个都通过双模式行为与属性表查阅。
                    </p>
                </div>
                <a
                    href={DOCS_BASE}
                    target="_blank"
                    rel="noreferrer"
                    className="web-focus shrink-0 rounded text-bv-sm text-bv-primary hover:underline"
                >
                    打开文档站 →
                </a>
            </div>

            <div className="mt-bv-lg grid gap-bv-md sm:grid-cols-2 lg:grid-cols-3">
                {CATALOG.map((entry) => (
                    <a
                        key={entry.slug}
                        href={`${DOCS_BASE}#/${entry.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="web-focus group flex flex-col gap-bv-xs rounded-docs-lg border border-bv-border bg-bv-surface p-bv-md shadow-docs-card transition-shadow hover:border-bv-primary/40 hover:shadow-docs-card-hover"
                    >
                        <div className="flex items-center justify-between gap-bv-xs">
                            <h3 className="text-[15px] font-bv-bold text-bv-text">
                                {entry.title}
                            </h3>
                            <span className="rounded bg-bv-muted px-bv-xs py-[1px] text-[10px] text-bv-text-2">
                                {entry.category}
                            </span>
                        </div>
                        <p className="text-bv-sm text-bv-text-2">
                            {entry.summary}
                        </p>
                    </a>
                ))}
            </div>
        </section>
    );
}
