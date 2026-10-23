import { useEffect, useState } from 'react';

/**
 * 页内锚点导航（Ant Design 右侧的「本页目录」）
 *
 * 两个要点：
 * 1. **跟随滚动高亮**当前小节 —— Ant 的目录会随滚动把当前小节标蓝，
 *    读者一眼知道自己在页面哪一段。
 * 2. **不随页面滚走**（sticky）—— 它是「页面内的地图」，不是页面的一部分。
 *
 * 滚动监听用 IntersectionObserver 而不是 scroll 事件：
 * 后者需要节流，且算「当前小节」要遍历所有节点。
 */

export interface Anchor {
    id: string;
    title: string;
    /** 1 = 页面小节；2 = 小节内的示例（缩进一格） */
    level?: 1 | 2;
}

export function AnchorNav({ anchors }: { anchors: Anchor[] }) {
    const [active, setActive] = useState<string>('');

    useEffect(() => {
        if (anchors.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                // 取当前与视口顶部最接近的那一节
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort(
                        (a, b) =>
                            Math.abs(a.boundingClientRect.top) -
                            Math.abs(b.boundingClientRect.top),
                    );
                if (visible[0]) setActive(visible[0].target.id);
            },
            // 上边距 = 顶栏高度 + 一点余量（顶栏是 sticky 的）
            { rootMargin: '-80px 0px -70% 0px', threshold: 0 },
        );

        for (const a of anchors) {
            const el = document.getElementById(a.id);
            if (el) observer.observe(el);
        }
        return () => observer.disconnect();
    }, [anchors]);

    if (anchors.length < 2) return null;

    return (
        <nav className="hidden w-[180px] shrink-0 xl:block">
            <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto">
                <div className="mb-bv-xs text-[11px] font-bv-bold uppercase tracking-wider text-bv-text-2">
                    本页目录
                </div>
                <ul className="border-l border-bv-border">
                    {anchors.map((a) => (
                        <li key={a.id}>
                            <a
                                href={`#${a.id}`}
                                onClick={(e) => {
                                    e.preventDefault();
                                    document
                                        .getElementById(a.id)
                                        ?.scrollIntoView({
                                            behavior: 'smooth',
                                            block: 'start',
                                        });
                                }}
                                className={`-ml-px block border-l-2 py-[4px] text-[13px] transition-colors ${
                                    a.level === 2 ? 'pl-bv-md pr-bv-xs' : 'px-bv-xs'
                                } ${
                                    active === a.id
                                        ? 'border-bv-primary font-medium text-bv-primary'
                                        : 'border-transparent text-bv-text-2 hover:text-bv-text'
                                }`}
                            >
                                {a.title}
                            </a>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
}
