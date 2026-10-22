/**
 * 文档站的小部件
 *
 * ⚠ 配色一律用 **Bivane 自己的 token**（text-bv-text / text-bv-text-2 /
 *    border-bv-border / bg-bv-surface …），不用 white/xx ——
 *    文档站默认是浅色主题，white/90 在浅底上等于隐形（标题直接看不见）。
 *    唯一例外是代码块：它刻意用深底 + 浅字，是代码块的通行观感。
 */

/** 代码块（深底浅字 —— 代码块的通行观感） */
export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
    return (
        <pre className="overflow-x-auto rounded-bv-md border border-bv-border bg-[#1c1e24] p-bv-md text-[12.5px] leading-relaxed">
            <code className="font-mono text-[#e6e8ee]">{code}</code>
            {lang && (
                <span className="mt-bv-xs block text-[11px] text-[#8a8f99]">{lang}</span>
            )}
        </pre>
    );
}

/** 小节标题（带锚点 id，供路由锚点滚动） */
export function DocSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-20">
            <h2 className="mb-bv-sm mt-bv-lg text-bv-lg font-bv-bold text-bv-text">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** 落地模式徽标 */
export function ModeBadge({ mode }: { mode: string }) {
    if (!mode) return null;
    const label = mode === 'A' ? '模式 A' : mode === 'B' ? '模式 B' : '模式 C';
    const tone =
        mode === 'A'
            ? 'bg-bv-success/12 text-bv-success'
            : mode === 'B'
              ? 'bg-bv-primary/12 text-bv-primary'
              : 'bg-bv-warning/15 text-bv-warning';
    return (
        <span className={`rounded px-bv-xs py-[1px] text-bv-sm font-medium ${tone}`}>
            {label}
        </span>
    );
}
