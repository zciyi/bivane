import { ChromeButton, CodeBlock } from '../components/doc-parts';
import { chineseName } from '../component-label';

interface Entry {
    name: string;
    slug: string;
    title: string;
    summary: string;
    category: string;
    mode: string;
}

/** 平滑滚到页面内某节（英雄区 CTA 用） */
function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 文档站首页
 *
 * 结构对齐 Ant Design / Element 的首页：
 *   一句话定位 → 快速上手（安装）→ 组件总览（按分类分的卡片网格）
 *
 * 与它们不同的是我们额外给了「模式」徽标 ——
 * 那是本库的核心概念（同一套 API，两端各得其所），
 * 看一眼就知道这个组件是「两端同形」还是「两端不同交互」。
 */
export function HomePage({
    entries,
    navigate,
}: {
    entries: Entry[];
    navigate: (to: string) => void;
}) {
    return (
        <article className="max-w-[1080px]">
            {/* ── 英雄区：定位 + 入口 + 双端示意 ── */}
            <section className="docs-hero mb-bv-xl rounded-docs-xl border border-bv-border px-bv-xl py-10 shadow-docs-card sm:px-10 sm:py-12">
                <div className="relative flex flex-col items-center gap-bv-xl lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                        <span className="rounded-full border border-bv-border bg-bv-surface/70 px-bv-sm py-[3px] text-[12px] font-medium text-bv-primary">
                            双端自适应组件库
                        </span>
                        <h1 className="mt-bv-md text-docs-display font-bv-bold leading-tight tracking-tight">
                            一套 API，
                            <br />
                            两端各得其所
                        </h1>
                        <p className="mt-bv-md max-w-[520px] text-docs-lead text-bv-text-2">
                            以 Vant 设计语言为视觉源，React + Tailwind，
                            shadcn copy-paste 形态分发。
                            同一套 API，小屏走 H5 交互，大屏走 PC 交互
                            —— 不用写两遍，也不用在业务里判断屏幕。
                        </p>
                        <div className="mt-bv-lg flex flex-wrap items-center gap-bv-sm">
                            <ChromeButton
                                tone="primary"
                                size="md"
                                onClick={() => scrollToId('quickstart')}
                            >
                                快速开始
                            </ChromeButton>
                            <ChromeButton
                                size="md"
                                onClick={() => scrollToId('components')}
                            >
                                浏览组件 →
                            </ChromeButton>
                        </div>
                        <dl className="mt-bv-lg flex flex-wrap gap-bv-xl">
                            {[
                                [`${entries.length}`, '个组件'],
                                ['H5 × PC', '双端交互'],
                                ['MIT', '开源许可'],
                            ].map(([value, label]) => (
                                <div key={label}>
                                    <dt className="text-[20px] font-bv-bold tracking-tight">
                                        {value}
                                    </dt>
                                    <dd className="mt-bv-base text-[12px] text-bv-text-2">
                                        {label}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* 双端示意：纯 div 画的两个「屏幕」，
                        让「同一套 API 两端各得其所」在首页就看得见 */}
                    <div
                        aria-hidden="true"
                        className="hidden w-full max-w-[420px] shrink-0 items-center justify-center gap-bv-lg lg:flex"
                    >
                        <div className="flex flex-col items-center gap-bv-xs">
                            <div className="w-[116px] rounded-[18px] border-2 border-bv-border bg-bv-surface p-[6px] shadow-docs-card">
                                <div className="mx-auto mb-[6px] h-[4px] w-8 rounded-full bg-bv-muted" />
                                <div className="flex flex-col gap-[6px] rounded-[12px] bg-bv-background p-[6px]">
                                    <div className="h-[22px] rounded-bv-sm bg-bv-primary" />
                                    <div className="h-[22px] rounded-bv-sm border border-bv-border bg-bv-surface" />
                                    <div className="h-[22px] rounded-bv-sm border border-bv-border bg-bv-surface" />
                                    <div className="h-[22px] rounded-bv-sm border border-bv-border bg-bv-surface" />
                                </div>
                            </div>
                            <span className="font-mono text-[10px] text-bv-text-2">
                                H5
                            </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-bv-xs">
                            <div className="overflow-hidden rounded-[10px] border border-bv-border bg-bv-surface shadow-docs-card">
                                <div className="flex items-center gap-[3px] border-b border-bv-border px-bv-xs py-[5px]">
                                    <i className="h-[7px] w-[7px] rounded-full bg-bv-muted" />
                                    <i className="h-[7px] w-[7px] rounded-full bg-bv-muted" />
                                    <i className="h-[7px] w-[7px] rounded-full bg-bv-muted" />
                                </div>
                                <div className="flex flex-col gap-[6px] p-[8px]">
                                    <div className="flex items-center gap-[6px]">
                                        <div className="h-[16px] w-[52px] rounded-bv-sm bg-bv-primary" />
                                        <div className="h-[16px] flex-1 rounded-bv-sm border border-bv-border" />
                                    </div>
                                    <div className="h-[14px] rounded-bv-sm bg-bv-muted" />
                                    <div className="h-[14px] w-[80%] rounded-bv-sm bg-bv-muted" />
                                    <div className="h-[14px] w-[60%] rounded-bv-sm bg-bv-muted" />
                                </div>
                            </div>
                            <span className="text-center font-mono text-[10px] text-bv-text-2">
                                PC
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            <section id="quickstart" className="mb-bv-xl scroll-mt-20">
                <h2 className="mb-bv-sm text-docs-h2 font-bv-bold tracking-tight">
                    快速上手
                </h2>
                <div className="grid gap-bv-gutter md:grid-cols-2">
                    <CodeBlock
                        lang="bash"
                        title="安装 · bash"
                        code={`# 装一个组件（会带上它的依赖树）
npx shadcn@latest add @bivane/select

# token 层单独装（缺了它所有 bg-bv-* 工具类都不会生成）
npx shadcn@latest add @bivane/tokens`}
                    />
                    <CodeBlock
                        lang="tsx"
                        title="挂载 · tsx"
                        code={`import { ResponsiveProvider } from "@/components/providers/responsive-provider";
import { DialogHost } from "@/components/responsive/dialog";
import { ToastHost } from "@/components/responsive/toast";

createRoot(document.getElementById("root")!).render(
    <ResponsiveProvider breakpoint={768}>
        <App />
        <DialogHost />
        <ToastHost />
    </ResponsiveProvider>,
);`}
                    />
                </div>
            </section>

            <section id="components" className="scroll-mt-20">
                <h2 className="mb-bv-sm text-docs-h2 font-bv-bold tracking-tight">
                    组件（{entries.length}）
                </h2>
                <div className="grid grid-cols-1 gap-bv-gutter sm:grid-cols-2 lg:grid-cols-3">
                    {entries.map((e) => (
                        <button
                            key={e.slug}
                            type="button"
                            onClick={() => navigate(e.slug)}
                            className="docs-focus group cursor-pointer rounded-docs-lg border border-bv-border bg-bv-surface px-bv-md py-bv-sm text-left shadow-docs-card transition-all duration-200 hover:-translate-y-0.5 hover:border-bv-primary/45 hover:shadow-docs-card-hover"
                        >
                            <div className="flex items-center gap-bv-xs">
                                {/* 中文名主、英文名次 —— 与侧栏/搜索面板一致 */}
                                <span className="text-docs-h3 font-bv-bold">
                                    {chineseName(e.title)}
                                </span>
                                <span className="font-mono text-[11px] text-bv-text-2">
                                    {e.name}
                                </span>
                                {e.mode && (
                                    <span className="ml-auto rounded bg-bv-muted px-1 text-[11px] text-bv-text-2">
                                        模式 {e.mode}
                                    </span>
                                )}
                            </div>
                            <p className="mt-bv-xs text-[13px] leading-[20px] text-bv-text-2">
                                {e.summary}
                            </p>
                        </button>
                    ))}
                </div>
            </section>
        </article>
    );
}
