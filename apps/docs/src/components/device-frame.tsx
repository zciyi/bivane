import { ResponsiveProvider } from '@/components/providers/responsive-provider';

/**
 * 双模式演示容器
 *
 * 每个组件页并排展示 H5 与 PC 两种形态。
 *
 * ── 两条不能错的约定 ──────────────────────────────────────────
 * 1. **两个实例各自独立持有 state**。
 *    同一个 demo 组件在两个容器里各渲染一次 → React 建两个实例 → state 天然隔离。
 *    若把 state 提到外面共用，就会出现「点 PC 的刷新，H5 也刷新了」——
 *    那是 demo 层的 bug，不是组件的 bug，但读者会误判组件。
 *
 * 2. **用 Provider 的 mode 强制，不给组件传 forceMode**。
 *    `ResponsiveProvider mode="mobile" | "desktop"` 是组件库**公开支持**的
 *    全局强制方式（Provider 自己的注释就写着「文档站、测试用」）。
 *    组件级 `forceMode` 逃生舱留给业务方，文档站不用它。
 *
 * ── 布局为什么用 grid 而不是 flex ─────────────────────────────
 * flex 的行内项目**不会缩到比内容还窄**（min-width: auto），
 * 遇到宽内容（比如 Select 那一长段说明文字）就会把 PC 帧顶到 866px，
 * 两帧被迫换行 → 读者看到的是上下堆叠，而不是「左右对照」。
 *
 * grid 的 `minmax(0, 1fr)` 轨道**硬性封顶**：
 * 宽内容改为在帧内横向滚动（overflow-x-auto），两帧始终并排。
 * 这正是查阅时要的形态 —— 左右对照才看得出两端差异。
 *
 * ── 配色 ─────────────────────────────────────────────────────
 * 演示区的 chrome 用 Bivane 自己的 token（bg-bv-surface / text-bv-text-3 /
 * border-bv-border），**不用** white/xx —— 文档站默认是浅色，
 * white/50 在浅底上等于隐形。
 *
 * ── 尺寸不用内联 style ───────────────────────────────────────
 * 架构文档 §4 第 4 条禁内联 style 里的字面量（`style={{ flex: 1 }}` 会被
 * ESLint 的 no-restricted-syntax 拦下）—— 宽度一律走 Tailwind 类。
 */
export function DeviceFrame({
    mode,
    widthClass,
    label,
    children,
}: {
    mode: 'mobile' | 'desktop';
    /** 宽度类名，如 'w-[390px]' / 'flex-1' */
    widthClass: string;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-bv-xs">
            <div className="flex items-center gap-bv-xs text-bv-sm text-bv-text-3">
                <span className="rounded bg-bv-muted px-bv-xs py-[1px] font-mono">
                    {label}
                </span>
            </div>
            {/* 宽内容（如 Select 的长说明）在帧内**横向滚动**，
                而不是把帧撑宽 —— 撑宽会把另一端的帧挤出可视区，
                左右对照就没了。 */}
            <div
                className={`min-w-0 overflow-x-auto overflow-y-hidden rounded-bv-md border border-bv-border bg-bv-background ${widthClass}`}
            >
                {/* 关键：Provider 强制模式，组件拿到的是已解析的 mode */}
                <ResponsiveProvider mode={mode}>{children}</ResponsiveProvider>
            </div>
        </div>
    );
}

/** H5 与 PC 并排的演示区 */
export function DualFrame({
    h5,
    pc,
}: {
    h5: React.ReactNode;
    pc: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-1 gap-bv-lg md:grid-cols-[390px_minmax(0,1fr)] md:items-start">
            <DeviceFrame mode="mobile" widthClass="w-full md:w-[390px]" label="H5 · 390px">
                {h5}
            </DeviceFrame>
            {/* PC 帧占满剩余宽度：grid 轨道 minmax(0,1fr) 硬性封顶，
                宽内容在帧内横向滚动，不会把两帧挤成上下堆叠 */}
            <DeviceFrame
                mode="desktop"
                widthClass="w-full"
                label="PC · 自适应宽度"
            >
                {pc}
            </DeviceFrame>
        </div>
    );
}
