/**
 * 文档站的小部件
 *
 * ⚠ 配色一律用 **Bivane 自己的 token**（text-bv-text / text-bv-text-2 /
 *    border-bv-border / bg-bv-surface …），不用 white/xx ——
 *    文档站默认是浅色主题，white/90 在浅底上等于隐形（标题直接看不见）。
 *    唯一例外是代码块：它刻意用深底 + 浅字，是代码块的通行观感。
 *
 * 字阶 / 阴影 / 圆角用 docs 自己那套（--text-docs-* / --shadow-docs-* /
 * --radius-docs-*，见 styles.css）—— chrome 是页面外壳，
 * 组件内部的尺寸永远用 bv token，两者互不越权。
 */

/**
 * chrome 按钮（顶栏 / 卡片操作 / CTA 用）。
 *
 * 为什么不用库里的 Button 组件：文档站是这套设计系统的**第一个消费者**，
 * 但 chrome 按钮的形态（毛玻璃顶栏里的胶囊、卡片头上的小按钮）与
 * 业务场景的 Button 不是一回事 —— 硬套组件反而两边都别扭。
 * 这里只复用它的**颜色 token**，形态按 chrome 场景定制。
 */
export function ChromeButton({
    tone = 'ghost',
    size = 'sm',
    className,
    type = 'button',
    ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    /** primary = 主操作（实心主色）；ghost = 次要操作（描边） */
    tone?: 'primary' | 'ghost';
    size?: 'sm' | 'md';
}) {
    const tones = {
        primary:
            'border-transparent bg-bv-primary text-bv-white shadow-[0_2px_10px_color-mix(in_srgb,var(--bv-primary)_40%,transparent)] hover:brightness-110',
        ghost: 'border-bv-border bg-bv-surface text-bv-text-2 hover:border-bv-primary/45 hover:text-bv-primary hover:shadow-docs-card',
    } as const;
    const sizes = {
        sm: 'px-bv-sm py-[5px] text-[13px]',
        md: 'px-bv-lg py-[7px] text-[14px]',
    } as const;
    return (
        <button
            type={type}
            className={`docs-focus inline-flex cursor-pointer items-center justify-center gap-bv-xs rounded-lg border font-medium transition-all duration-200 active:scale-[0.97] ${tones[tone]} ${sizes[size]} ${className ?? ''}`}
            {...rest}
        />
    );
}

/** 代码块（深底浅字 —— 代码块的通行观感） */
export function CodeBlock({
    code,
    lang,
    title,
    flush,
}: {
    code: string;
    lang?: string;
    /** 标题栏文字（如「bash」/「tsx」）；给了就渲染一条标题栏 */
    title?: string;
    /** 贴边模式：去掉自己的边框圆角，嵌进卡片里用 */
    flush?: boolean;
}) {
    const shell = flush
        ? 'overflow-hidden'
        : 'overflow-hidden rounded-docs-lg border border-[#262a33] shadow-docs-card';
    return (
        <div className={shell}>
            {(title || lang) && (
                <div className="flex items-center gap-bv-xs border-b border-[#262a33] bg-[#101216] px-bv-md py-bv-xs">
                    <span
                        aria-hidden="true"
                        className="flex items-center gap-[3px]"
                    >
                        <i className="h-[8px] w-[8px] rounded-full bg-[#3a3f4b]" />
                        <i className="h-[8px] w-[8px] rounded-full bg-[#3a3f4b]" />
                        <i className="h-[8px] w-[8px] rounded-full bg-[#3a3f4b]" />
                    </span>
                    <span className="font-mono text-[11px] text-[#8a8f99]">
                        {title ?? lang}
                    </span>
                </div>
            )}
            <pre className="overflow-x-auto bg-[#17191f] p-bv-md text-[12.5px] leading-relaxed">
                <code className="font-mono text-[#e6e8ee]">{code}</code>
            </pre>
        </div>
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
            <div className="mb-bv-sm flex items-center gap-bv-xs">
                <span
                    aria-hidden="true"
                    className="h-[18px] w-[3px] rounded-full bg-bv-primary"
                />
                <h2 className="text-docs-h2 font-bv-bold tracking-tight text-bv-text">
                    {title}
                </h2>
            </div>
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
            ? 'bg-bv-success/10 text-bv-success'
            : mode === 'B'
              ? 'bg-bv-primary/10 text-bv-primary'
              : 'bg-bv-warning/12 text-bv-warning';
    return (
        <span
            className={`rounded-md px-bv-xs py-[1px] text-[11px] font-medium ${tone}`}
        >
            {label}
        </span>
    );
}
