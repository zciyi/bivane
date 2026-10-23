import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * 演示区的布局原语
 *
 * 这些原语**同时**给验证台（src/App.tsx）与文档站（apps/docs）用 ——
 * 放在共享层是为了让两边的演示长得一样、改一处两处都变。
 *
 * ⚠ DOM 必须与验证台原来的 Section / Block / Row **逐字一致**：
 *   scripts/visual-check.mjs 是靠 h2 的**文本内容**滚动定位的
 *   （scrollToSection('P3 · Rate')），
 *   所以 Section 的标题文案与标签层级都不能动 —— 动了视觉门禁会找不到节点。
 *
 * 与组件库自身的关系：这里的 class 全是 Tailwind 工具类 + Bivane token，
 * 不引入任何新 token —— 演示区是「页面级」用法（页面骨架间距），
 * 不是组件内部间距。
 */

/** 带小标题的分组（h2 —— 与验证台的 Section 同级，visual-check 靠它定位） */
export function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-bv-section">
            <h2 className="mb-bv-sm px-bv-md text-bv-sm text-bv-text-2">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** 内容块：纵向内边距随模式放宽（H5 16 / PC 24），横向恒为 16 以对齐标题；
 *  块内是纵向 flex（gap 16px）—— 相邻 Row / 说明段之间不再靠运气留白，
 *  没有它，连续两个 <Row> 会 0 间距贴死（Tabs 页「内容一」怼着下一行说明）。 */
export function Block({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-stretch gap-bv-md bg-bv-surface px-bv-md py-bv-block",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** 一行组件：行内间距随模式变化（H5 8 / PC 12） */
export function Row({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-bv-gutter",
                className,
            )}
        >
            {children}
        </div>
    );
}
