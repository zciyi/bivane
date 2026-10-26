const FEATURES = [
    {
        title: '一套 API，两端各得其所',
        desc: '同一个组件在小屏走 H5 交互（底部弹层、滚轮、手势），大屏走 PC 交互（锚定浮层、月历、键盘导航）。props 完全一致，交互差异不泄露。',
        mark: '◐',
    },
    {
        title: 'shadcn copy-paste 分发',
        desc: '源码直接复制进你的项目，不锁定运行时、不引黑盒。改样式、改交互都在你手里，组件库只是起点。',
        mark: '⧉',
    },
    {
        title: '仅 9 个运行时依赖',
        desc: 'react / react-dom / clsx / tailwind-merge / cva / 三个 Radix 原语 / react-day-picker。手势、滚动锁、虚拟滚动全部自研。',
        mark: '⑨',
    },
    {
        title: 'Vant 视觉保真',
        desc: '色彩、间距、字号逐字段对齐 Vant 4 源码；换肤只需替换 token 文件，组件代码零改动。深色与多风格可叠加。',
        mark: '❖',
    },
];

export function Features() {
    return (
        <section id="features" className="mx-auto max-w-6xl px-bv-md py-bv-xl">
            <h2 className="text-docs-h2 font-bv-bold tracking-tight">为什么是 Bivane</h2>
            <p className="mt-bv-xs text-bv-text-2">
                双端自适应不是「响应式重排」，而是同一组件在不同屏幕给出各自该有的交互。
            </p>
            <div className="mt-bv-lg grid gap-bv-md sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                    <div
                        key={f.title}
                        className="flex flex-col gap-bv-sm rounded-docs-lg border border-bv-border bg-bv-surface p-bv-md shadow-docs-card transition-shadow hover:shadow-docs-card-hover"
                    >
                        <span
                            aria-hidden="true"
                            className="grid h-10 w-10 place-items-center rounded-[10px] bg-bv-primary/10 text-[18px] text-bv-primary"
                        >
                            {f.mark}
                        </span>
                        <h3 className="text-[15px] font-bv-bold text-bv-text">
                            {f.title}
                        </h3>
                        <p className="text-bv-sm text-bv-text-2">{f.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}
