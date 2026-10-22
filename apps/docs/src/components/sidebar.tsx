import { useMemo, useState } from 'react';

/**
 * 左侧导航（Ant Design / Element 的组件侧栏）
 *
 * 与它们的差别只有一处，但那一处决定了「能不能查」：
 * **带搜索框**，而且能按 **prop 名**搜。
 *
 * 为什么按 prop 名搜：Ant 的搜索只匹配组件名与描述。
 * 但真实的问题常常是「哪个组件有 onSortChange」——
 * 这类问题按组件名搜是搜不到的，必须能拿 prop 名反查组件。
 * props 表是自动抽出来的，所以这份索引也是自动的，不会过期。
 */

export interface NavEntry {
    name: string;
    slug: string;
    /** 完整标题（「Button 按钮」） */
    title: string;
    /** 中文名（「按钮」）—— 侧栏的主标签，中文读者扫的是它 */
    zh: string;
    category: string;
    summary: string;
    /** 组件的 props 名（用于反查） */
    propNames: string[];
}

export interface NavCategory {
    id: string;
    title: string;
}

/**
 * 侧栏内容（搜索框 + 分组列表）。
 *
 * 抽出来是为了**同一份内容两处渲染**：
 *   - 桌面：`<Sidebar>` 包一层常驻 nav；
 *   - 手机（< 768px）：抽屉里再渲染一份（侧栏本身是 `hidden md:block`，
 *     不抽出来就只能复制一遍搜索逻辑，迟早漂移）。
 *
 * 每项**中文名主、英文名次**：中文读者扫的是「按钮」不是「Button」，
 * 但英文名留着（等宽弱化）—— 删了就再也对不上代码里的 import。
 */
export function SidebarList({
    categories,
    entries,
    current,
    onNavigate,
}: {
    categories: NavCategory[];
    entries: NavEntry[];
    current: string;
    onNavigate: (slug: string) => void;
}) {
    const [query, setQuery] = useState('');

    const grouped = useMemo(() => {
        const q = query.trim().toLowerCase();
        // 空查询 → 按分类原样分组
        const map = new Map<string, NavEntry[]>();
        for (const cat of categories) map.set(cat.id, []);
        for (const e of entries) {
            if (!q) {
                map.get(e.category)?.push(e);
                continue;
            }
            // 匹配：组件名 / 标题 / 简介 / **prop 名**
            const hit =
                e.name.toLowerCase().includes(q) ||
                e.title.toLowerCase().includes(q) ||
                e.summary.toLowerCase().includes(q) ||
                e.propNames.some((p) => p.toLowerCase().includes(q));
            if (hit) map.get(e.category)?.push(e);
        }
        return map;
    }, [categories, entries, query]);

    const total = [...grouped.values()].reduce((n, l) => n + l.length, 0);

    return (
        <div>
            <div className="mb-bv-md">
                <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="过滤组件或属性…"
                    aria-label="过滤组件或属性"
                    className="w-full rounded-bv-sm border border-bv-border bg-bv-surface px-bv-xs py-bv-xs text-bv-sm text-bv-text outline-none placeholder:text-bv-text-3 focus:border-bv-primary"
                />
                {query.trim() && (
                    <p className="mt-bv-xs text-bv-sm text-bv-text-3">
                        命中 {total} 个
                    </p>
                )}
            </div>

            {categories.map((cat) => {
                const items = grouped.get(cat.id) ?? [];
                if (items.length === 0) return null;
                return (
                    <div key={cat.id} className="mb-bv-lg">
                        <div className="mb-bv-xs px-bv-xs text-bv-sm font-bv-bold text-bv-text-2">
                            {cat.title}
                        </div>
                        <ul>
                            {items.map((e) => {
                                const active = e.slug === current;
                                // 命中 prop 名时高亮它，让「为什么搜到它」一目了然
                                const q = query.trim().toLowerCase();
                                const hitProp = q
                                    ? e.propNames.find((p) =>
                                          p.toLowerCase().includes(q),
                                      )
                                    : undefined;
                                return (
                                    <li key={e.slug}>
                                        <button
                                            type="button"
                                            onClick={() => onNavigate(e.slug)}
                                            title={e.summary}
                                            className={`flex w-full cursor-pointer items-center gap-bv-xs rounded-bv-sm px-bv-xs py-[3px] text-left text-bv-sm ${
                                                active
                                                    ? 'bg-bv-primary text-bv-white'
                                                    : 'text-bv-text hover:bg-bv-muted'
                                            }`}
                                        >
                                            {/* 中文名是主标签；英文名等宽弱化，
                                                仍能和代码里的 import 对应上 */}
                                            <span className="min-w-0 truncate">
                                                {e.zh}
                                            </span>
                                            <span
                                                className={`shrink-0 font-mono text-[11px] ${
                                                    active
                                                        ? 'text-bv-white/80'
                                                        : 'text-bv-text-3'
                                                }`}
                                            >
                                                {e.name}
                                            </span>
                                            {hitProp && (
                                                <span
                                                    className={`ml-auto shrink-0 font-mono text-[11px] ${
                                                        active
                                                            ? 'text-bv-white'
                                                            : 'text-bv-primary'
                                                    }`}
                                                >
                                                    {hitProp}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                );
            })}

            {total === 0 && (
                <p className="px-bv-xs text-bv-sm text-bv-text-3">
                    没有匹配的组件。
                </p>
            )}
        </div>
    );
}

/** 桌面常驻侧栏 */
export function Sidebar({
    categories,
    entries,
    current,
    onNavigate,
}: {
    categories: NavCategory[];
    entries: NavEntry[];
    current: string;
    onNavigate: (slug: string) => void;
}) {
    return (
        <nav className="hidden w-[240px] shrink-0 md:block">
            <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pb-bv-lg">
                <SidebarList
                    categories={categories}
                    entries={entries}
                    current={current}
                    onNavigate={onNavigate}
                />
            </div>
        </nav>
    );
}
