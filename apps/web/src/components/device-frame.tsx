import * as React from 'react';
import { ResponsiveProvider } from '@/components/providers/responsive-provider';

/**
 * 双模式演示容器（复用文档站同款思路）
 *
 * 两条约定（与文档站一致）：
 *  1. 两个实例各自独立持有 state —— 同一份 children 在两端各渲染一次即天然隔离。
 *  2. 用 Provider 的 mode 强制，不给组件传 forceMode。
 *
 * grid 而非 flex：宽内容（组件长说明）在帧内横向滚动，两帧始终并排对照。
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
            <div className="flex items-center gap-bv-xs">
                <span className="rounded bg-bv-primary/10 px-bv-xs py-[1px] font-mono text-[10px] text-bv-primary">
                    {label}
                </span>
                <span className="text-[11px] text-bv-text-2">
                    {mode === 'mobile' ? '触屏交互' : '鼠标 / 键盘交互'}
                </span>
            </div>
            <div
                className={`min-w-0 overflow-x-auto overflow-y-hidden rounded-docs-lg border border-bv-border bg-bv-background shadow-[inset_0_1px_4px_rgba(0,0,0,0.06)] ${widthClass}`}
            >
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
            <DeviceFrame mode="desktop" widthClass="w-full" label="PC · 自适应宽度">
                {pc}
            </DeviceFrame>
        </div>
    );
}
