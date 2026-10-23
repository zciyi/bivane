import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { searchDocs, type SearchDoc, type SearchKind } from '../search-index';

/**
 * 全局搜索面板（命令面板）
 *
 * 侧栏那个输入框是「过滤目录」；这个面板是「我知道我要找什么」——
 * 索引覆盖**组件 + 示例 + 属性/事件**，选中后直接跳到那一行 / 那一张示例卡。
 *
 * 为什么示例和属性也要进索引：真机审计出来的三个缺口——
 *   1. 「区间滑块长什么样」→ 示例标题此前不可搜；
 *   2. 搜到 `onConfirm` 只跳到页首，那一行还得自己滚；
 *   3. 手机（420px）侧栏是 `hidden md:block`，连搜索框都没有。
 *
 * 交互对齐 Ant/Element 的搜索，也对齐一切命令面板的通行习惯：
 *   `/` 或 `Ctrl/⌘+K` 唤起 · `↑↓` 移动 · `Enter` 打开 · `Esc` 关闭
 *
 * 匹配与排序全在 search-index.ts（纯函数、有单测），这里只负责渲染与键盘。
 */

const KIND_LABEL: Record<SearchKind, string> = {
    component: '组件',
    example: '示例',
    prop: '属性',
};

/** 一条结果的主标题 / 副标题 */
/**
 * 每条结果的两行标签。主标签一律中文（组件中文名 / 示例标题 / 属性名）。
 *
 * 次级标签给**所属组件**，且刻意避开主标签里已有的信息：
 *   - 示例行：主标签「基础滑块」已经含着组件中文名，次级再写「滑块」会
 *     拼成「基础滑块滑块」—— 所以示例行给英文名（同时补上 import 对照）；
 *   - 属性行：主标签是英文标识符 `onConfirm`，次级给中文名平衡一下，
 *     中文读者要的是「这是哪个组件的属性」。
 */
function labels(doc: SearchDoc): { main: string; sub: string } {
    if (doc.kind === 'component')
        return { main: doc.zh, sub: `${doc.name} · 组件` };
    if (doc.kind === 'example') {
        return { main: doc.title, sub: `${doc.name} · 示例` };
    }
    return {
        main: doc.propName ?? doc.title,
        sub: `${doc.zh} · ${doc.propKind === 'event' ? '事件' : '属性'}`,
    };
}

export function CommandPalette({
    docs,
    open,
    onClose,
    onSelect,
}: {
    docs: SearchDoc[];
    open: boolean;
    onClose: () => void;
    onSelect: (doc: SearchDoc) => void;
}) {
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const results = useMemo(() => searchDocs(docs, query), [docs, query]);

    // 打开时清空查询、聚焦输入框；关闭时不留焦点痕迹
    useEffect(() => {
        if (open) {
            setQuery('');
            setActive(0);
            // 等一帧：面板刚挂载，直接 focus 在部分浏览器里不生效
            const raf = requestAnimationFrame(() => inputRef.current?.focus());
            return () => cancelAnimationFrame(raf);
        }
    }, [open]);

    // 查询变化后把高亮挪回第一项
    useEffect(() => {
        setActive(0);
    }, [query]);

    if (!open) return null;

    const flat = results;
    const commit = (doc: SearchDoc) => {
        onSelect(doc);
        onClose();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
            return;
        }
        if (flat.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % flat.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + flat.length) % flat.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const doc = flat[active];
            if (doc) commit(doc);
        }
    };

    return (
        <div
            className="fixed inset-0 z-40 flex items-start justify-center bg-bv-overlay px-bv-md pt-[12vh] backdrop-blur-sm"
            onMouseDown={(e) => {
                // 只在点到遮罩本身时关（点在面板里不算）
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="全站搜索"
                onMouseDown={(e) => e.stopPropagation()}
                className="w-full max-w-[600px] overflow-hidden rounded-docs-xl border border-bv-border bg-bv-surface shadow-docs-float"
            >
                <div className="flex items-center gap-bv-xs border-b border-bv-border px-bv-md py-bv-sm">
                    <span
                        aria-hidden="true"
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-bv-muted text-bv-text-2"
                    >
                        ⌕
                    </span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="搜组件、示例或属性…"
                        aria-label="搜组件、示例或属性"
                        className="w-full bg-transparent text-[15px] outline-none placeholder:text-bv-text-3"
                    />
                </div>

                <div className="max-h-[52vh] overflow-y-auto py-bv-xs">
                    {flat.length === 0 && (
                        <p className="px-bv-md py-bv-md text-bv-sm text-bv-text-2">
                            {query.trim()
                                ? `没有匹配「${query.trim()}」的组件、示例或属性。`
                                : '输入组件名、示例标题或属性名，如「区间」「onConfirm」「rowKey」。'}
                        </p>
                    )}

                    {flat.length > 0 && (
                        <ul role="listbox" aria-label="搜索结果">
                            {flat.map((doc, i) => {
                                const isActive = i === active;
                                // 分组头：只在该类别的第一条前出现一次。
                                //
                                // ⚠ 必须**按 flat 的顺序**边遍历边插头，不能先分组再渲染 ——
                                //   曾经按 kind 分三组输出，DOM 顺序就成了「组件→示例→属性」，
                                //   而 Enter 用的是打分顺序，两者一旦不一致：
                                //   按一次 ↓ 高亮「基础滑块」，回车却跳到 Rate 的 ariaLabel。
                                const showHeader =
                                    i === 0 || flat[i - 1].kind !== doc.kind;
                                const { main, sub } = labels(doc);
                                return (
                                    <Fragment
                                        key={`${doc.kind}-${doc.slug}-${doc.exampleId ?? doc.propName ?? ''}`}
                                    >
                                        {showHeader && (
                                            <li
                                                role="presentation"
                                                className="px-bv-md pb-[2px] pt-bv-xs text-[11px] uppercase tracking-wide text-bv-text-2"
                                            >
                                                {KIND_LABEL[doc.kind]}
                                            </li>
                                        )}
                                        <li
                                            role="option"
                                            aria-selected={isActive}
                                            onMouseEnter={() => setActive(i)}
                                            onClick={() => commit(doc)}
                                            className={`mx-bv-xs flex cursor-pointer items-center gap-bv-sm rounded-md px-bv-sm py-[7px] ${
                                                isActive
                                                    ? 'bg-bv-primary text-bv-white shadow-[0_2px_8px_color-mix(in_srgb,var(--bv-primary)_35%,transparent)]'
                                                    : 'text-bv-text hover:bg-bv-muted'
                                            }`}
                                        >
                                            <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                                                {main}
                                            </span>
                                            <span
                                                className={`shrink-0 text-[11px] ${
                                                    isActive
                                                        ? 'text-bv-white/80'
                                                        : 'text-bv-text-2'
                                                }`}
                                            >
                                                {sub}
                                            </span>
                                        </li>
                                    </Fragment>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="flex items-center gap-bv-md border-t border-bv-border px-bv-md py-bv-xs text-[11px] text-bv-text-2">
                    <span className="flex items-center gap-1">
                        <kbd className="docs-kbd">↑</kbd>
                        <kbd className="docs-kbd">↓</kbd>
                        选择
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="docs-kbd">Enter</kbd>
                        打开
                    </span>
                    <span className="flex items-center gap-1">
                        <kbd className="docs-kbd">Esc</kbd>
                        关闭
                    </span>
                    <span className="ml-auto">命中 {flat.length} 条</span>
                </div>
            </div>
        </div>
    );
}
