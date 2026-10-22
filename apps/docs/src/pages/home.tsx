import { CodeBlock } from '../components/doc-parts';
import { chineseName } from '../component-label';

interface Entry {
    name: string;
    slug: string;
    title: string;
    summary: string;
    category: string;
    mode: string;
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
        <article className="max-w-[960px]">
            <header className="mb-bv-xl">
                <h1 className="mb-bv-sm text-bv-lg font-bv-bold">
                    Bivane · 双端自适应组件库
                </h1>
                <p className="text-bv-text-2">
                    以 Vant 设计语言为视觉源，React + Tailwind，shadcn
                    copy-paste 形态分发。
                    <br />
                    同一套 API，小屏走 H5 交互，大屏走 PC
                    交互 —— 不用写两遍，也不用在业务里判断屏幕。
                </p>
            </header>

            <section className="mb-bv-xl">
                <h2 className="mb-bv-sm text-bv-md font-bv-bold">快速上手</h2>
                <CodeBlock
                    lang="bash"
                    code={`# 装一个组件（会带上它的依赖树）
npx shadcn@latest add @bivane/select

# token 层单独装（缺了它所有 bg-bv-* 工具类都不会生成）
npx shadcn@latest add @bivane/tokens`}
                />
            </section>

            <section className="mb-bv-xl">
                <h2 className="mb-bv-sm text-bv-md font-bv-bold">
                    在应用根部挂载
                </h2>
                <CodeBlock
                    lang="tsx"
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
            </section>

            <section>
                <h2 className="mb-bv-sm text-bv-md font-bv-bold">
                    组件（{entries.length}）
                </h2>
                <div className="grid grid-cols-1 gap-bv-gutter sm:grid-cols-2">
                    {entries.map((e) => (
                        <button
                            key={e.slug}
                            type="button"
                            onClick={() => navigate(e.slug)}
                            className="cursor-pointer rounded-bv-md border border-bv-border bg-bv-surface px-bv-md py-bv-sm text-left transition-colors hover:border-bv-primary"
                        >
                            <div className="mb-bv-xs flex items-center gap-bv-xs">
                                {/* 中文名主、英文名次 —— 与侧栏/搜索面板一致 */}
                                <span className="font-bv-bold">
                                    {chineseName(e.title)}
                                </span>
                                <span className="font-mono text-[11px] text-bv-text-3">
                                    {e.name}
                                </span>
                                {e.mode && (
                                    <span className="rounded bg-bv-muted px-1 text-[11px] text-bv-text-3">
                                        模式 {e.mode}
                                    </span>
                                )}
                            </div>
                            <p className="text-bv-sm text-bv-text-2">
                                {e.summary}
                            </p>
                        </button>
                    ))}
                </div>
            </section>
        </article>
    );
}
