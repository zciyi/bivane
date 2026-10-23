import * as React from 'react';
import registry from './registry.generated.json';
import exampleCodeRaw from './example-code.generated.json';
import { useHashRoute } from './router';
import { HomePage } from './pages/home';
import { ComponentPage } from './pages/component-page';
import { Sidebar, SidebarList } from './components/sidebar';
import { CommandPalette } from './components/command-palette';
import { DEMO_EXAMPLES } from './demo-examples';
import { EXAMPLES } from './examples';
import { chineseName } from './component-label';
import { usePaletteHotkey } from './use-palette-hotkey';
import { buildSearchIndex, type SearchDoc } from './search-index';

/**
 * 文档站外壳
 *
 * 路由是**手写的 hash 路由**（零依赖）——
 * 运行时依赖白名单是 9 个，不能为文档站破例引 react-router。
 *
 * 布局刻意复用 Bivane 自己的 token（bg-bv-background / text-bv-text /
 * border-bv-border …）：文档站是这套设计系统的第一个消费者，
 * 深浅色切换只要在 <html> 上加 bv-theme-dark，全站（含演示区）一起变。
 *
 * 三栏结构（对齐 Ant Design / Element）：
 *   左：组件导航（带过滤；手机上收进抽屉）
 *   中：组件页
 *   右：页内锚点目录（跟随滚动高亮，含每张示例卡）
 *
 * 查阅入口一共三个，各管一件事：
 *   1. 侧栏输入框 —— **过滤目录**（我在浏览，帮我缩小范围）；
 *   2. 顶栏搜索 / `⌘K` / `/` —— **全站搜索**（我知道要找什么，直接跳过去）；
 *   3. 首页组件网格 —— 随便看看。
 */

interface RegistryEntry {
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
    props: {
        name: string;
        type: string;
        optional: boolean;
        description: string;
        default: string | null;
        inherited: boolean;
        kind: 'prop' | 'event';
    }[];
}

interface Registry {
    categories: { id: string; title: string }[];
    entries: RegistryEntry[];
}

const REG = registry as unknown as Registry;
const CODE = exampleCodeRaw as unknown as Record<
    string,
    { setup: string; code: string }
>;

/** 深色主题开关：class 挂在 <html> 上（portal 容器在 body 下，挂在根 div 不管用） */
function useThemeToggle() {
    const [dark, setDark] = React.useState(false);
    React.useEffect(() => {
        document.documentElement.classList.toggle('bv-theme-dark', dark);
    }, [dark]);
    return { dark, setDark };
}

export function App() {
    const [route, navigate] = useHashRoute();
    const { dark, setDark } = useThemeToggle();
    const [paletteOpen, setPaletteOpen] = React.useState(false);
    const [drawerOpen, setDrawerOpen] = React.useState(false);
    /** 每次从搜索面板选中都 +1 —— 让「同一目标再点一次」也能重新定位高亮 */
    const [highlightKey, setHighlightKey] = React.useState(0);

    const path = route.path;
    const target = route.target;
    const entry = REG.entries.find((e) => e.slug === path);

    // 上/下一组件：按清单顺序
    const index = REG.entries.findIndex((e) => e.slug === path);
    const prev = index > 0 ? REG.entries[index - 1] : undefined;
    const next =
        index >= 0 && index < REG.entries.length - 1
            ? REG.entries[index + 1]
            : undefined;

    // 侧栏索引：带上 prop 名，用于「哪个组件有 onSortChange」这类反查。
    // zh 是中文名 —— 侧栏以它为主标签（见 components/sidebar.tsx）。
    const navEntries = React.useMemo(
        () =>
            REG.entries.map((e) => ({
                name: e.name,
                slug: e.slug,
                title: e.title,
                zh: chineseName(e.title),
                category: e.category,
                summary: e.summary,
                propNames: e.props.map((p) => p.name),
            })),
        [],
    );

    // 全站搜索索引：组件 + 示例 + 属性/事件
    const searchIndex = React.useMemo<SearchDoc[]>(
        () =>
            buildSearchIndex({
                entries: REG.entries,
                examples: EXAMPLES,
                // demo 模块名 → 示例数（DEMO_EXAMPLES 的值就是该模块的示例组件数组）
                demoCounts: Object.fromEntries(
                    Object.entries(DEMO_EXAMPLES).map(([k, v]) => [
                        k,
                        v.length,
                    ]),
                ),
            }),
        [],
    );

    usePaletteHotkey(() => setPaletteOpen(true));

    // 该组件的示例列表
    //
    // 一个组件页可以挂**多个** demo 模块（catalog 的 demo 字段是数组）——
    // 如 DatePicker 额外挂跨组件的「min/max 边界约束」。
    // 示例 id 必须由 **demo 模块名**推出（`XxxDemos` → `XxxExampleN`），
    // 不能用组件名 —— 否则 BoundsDemos 挂在 DatePicker 页上时，
    // 它的示例会被算成「DatePickerExample2」，而源码表里没有这一条。
    const examples = React.useMemo(() => {
        if (!entry) return [];
        const demoNames = Array.isArray(entry.demo)
            ? entry.demo
            : [entry.demo];
        const out: {
            id: string;
            title: string;
            desc: string;
            Component: React.ComponentType;
        }[] = [];
        for (const demoName of demoNames) {
            const list = DEMO_EXAMPLES[demoName] ?? [];
            const base = demoName.replace(/Demos$/, '');
            list.forEach((Component, i) => {
                const id = `${base}Example${i + 1}`;
                const meta = EXAMPLES[id];
                out.push({
                    id,
                    title: meta?.title ?? `示例 ${i + 1}`,
                    desc: meta?.desc ?? '',
                    Component,
                });
            });
        }
        return out;
    }, [entry]);

    /** 从搜索面板选中一条：带上深链目标跳过去 */
    const onPaletteSelect = React.useCallback(
        (doc: SearchDoc) => {
            setDrawerOpen(false);
            setHighlightKey((k) => k + 1);
            if (doc.kind === 'component') {
                navigate(doc.slug);
            } else if (doc.kind === 'example') {
                navigate(`${doc.slug}?example=${doc.exampleId}`);
            } else {
                navigate(`${doc.slug}?prop=${doc.propName}`);
            }
        },
        [navigate],
    );

    const goNav = React.useCallback(
        (slug: string) => {
            setDrawerOpen(false);
            navigate(slug);
        },
        [navigate],
    );

    return (
        <div className="docs-shell min-h-screen text-bv-text">
            <header className="sticky top-0 z-30 border-b border-bv-border bg-bv-surface/85 shadow-docs-header backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-bv-md px-bv-md">
                    <button
                        type="button"
                        onClick={() => navigate('')}
                        className="docs-focus flex cursor-pointer items-center gap-bv-xs rounded-lg"
                    >
                        {/* 品牌方块：主色渐变 + 同色投影，深浅主题下都跟着 --bv-primary 变 */}
                        <span
                            aria-hidden="true"
                            className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[var(--bv-primary)] to-[color-mix(in_srgb,var(--bv-primary)_55%,black)] text-[15px] font-bv-bold text-bv-white shadow-[0_2px_8px_color-mix(in_srgb,var(--bv-primary)_45%,transparent)]"
                        >
                            B
                        </span>
                        <span className="text-[17px] font-bv-bold tracking-tight">
                            Bivane
                        </span>
                    </button>
                    <span className="hidden text-bv-sm text-bv-text-2 lg:block">
                        一套 API，两端各得其所
                    </span>
                    <div className="flex-1" />

                    {/* 全站搜索入口（手机上没有侧栏，这是主要检索手段） */}
                    <button
                        type="button"
                        onClick={() => setPaletteOpen(true)}
                        aria-label="搜索组件、示例或属性"
                        className="docs-focus flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-bv-border text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary sm:w-auto sm:justify-start sm:gap-bv-xs sm:px-bv-sm"
                    >
                        <span aria-hidden="true">⌕</span>
                        <span className="hidden sm:inline">搜索</span>
                        <span className="docs-kbd ml-auto hidden md:inline">
                            ⌘K
                        </span>
                    </button>

                    <button
                        type="button"
                        aria-pressed={dark}
                        onClick={() => setDark(!dark)}
                        aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
                        className="docs-focus flex h-9 cursor-pointer items-center gap-bv-xs rounded-full border border-bv-border px-bv-sm text-[13px] text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary"
                    >
                        <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
                        <span className="hidden sm:inline">
                            {dark ? '浅色' : '深色'}
                        </span>
                    </button>

                    {/* 汉堡：手机上打开导航抽屉 */}
                    <button
                        type="button"
                        onClick={() => setDrawerOpen(true)}
                        aria-label="打开组件导航"
                        aria-expanded={drawerOpen}
                        className="docs-focus grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-bv-border text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary md:hidden"
                    >
                        ☰
                    </button>
                </div>
            </header>

            <div className="mx-auto flex max-w-[1600px] gap-bv-lg px-bv-md py-bv-lg">
                <Sidebar
                    categories={REG.categories}
                    entries={navEntries}
                    current={path}
                    onNavigate={goNav}
                />

                {/* 手机导航抽屉：与桌面侧栏同一份内容 */}
                {drawerOpen && (
                    <div
                        className="fixed inset-0 z-40 md:hidden"
                        onMouseDown={(e) => {
                            if (e.target === e.currentTarget) setDrawerOpen(false);
                        }}
                    >
                        <div className="absolute inset-0 bg-bv-overlay backdrop-blur-sm" />
                        <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col rounded-r-docs-xl bg-bv-surface shadow-docs-float">
                            <div className="flex items-center justify-between border-b border-bv-border px-bv-md py-bv-sm">
                                <span className="text-[13px] font-bv-bold">
                                    组件（{REG.entries.length}）
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setDrawerOpen(false)}
                                    aria-label="关闭导航"
                                    className="docs-focus grid h-8 w-8 cursor-pointer place-items-center rounded-full text-bv-text-2 transition-colors hover:bg-bv-muted hover:text-bv-primary"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="overflow-y-auto px-bv-md py-bv-sm">
                                <SidebarList
                                    categories={REG.categories}
                                    entries={navEntries}
                                    current={path}
                                    onNavigate={goNav}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <main className="flex min-w-0 flex-1">
                    {entry ? (
                        <ComponentPage
                            entry={entry}
                            examples={examples}
                            exampleCode={CODE}
                            target={target}
                            highlightKey={highlightKey}
                            prev={prev}
                            next={next}
                            onNavigate={goNav}
                        />
                    ) : (
                        <HomePage entries={REG.entries} navigate={goNav} />
                    )}
                </main>
            </div>

            <CommandPalette
                docs={searchIndex}
                open={paletteOpen}
                onClose={() => setPaletteOpen(false)}
                onSelect={onPaletteSelect}
            />
        </div>
    );
}
