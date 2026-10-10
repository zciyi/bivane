import * as React from "react";
import { cn, composeRefs } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane Tooltip · H5 实现
 * 交互定义见 bivane-responsive-matrix.md §2.1
 *
 *   触屏没有 hover，辅助说明**直接常驻展示**：被说明的主体在上，
 *   下方一条行首带 ⓘ 的信息提示条，全文展示、不拦截任何手势。
 *   文案太长需要折叠时，由消费者用 <Ellipsis> 包 content ——
 *   「展开/收起」是独立组件的职责，Tooltip 不内置截断。
 *
 * 为什么不是长按气泡：长按看提示是把桌面范式硬搬到触屏，H5 的真实惯例
 * （Vant / Ant Design Mobile）就是说明文字常驻，长按留给系统上下文菜单。
 *
 * 因此 PC 才有的 open / disabled / onOpenChange 在本端均无作用对象，
 * H5TooltipProps 也不收它们（对外 TooltipProps 仍双模式一致，分发层按端传参）。
 */

export interface H5TooltipProps {
    mode: DeviceMode;
    /** 提示全文（需要折叠时传 <Ellipsis>） */
    content: React.ReactNode;
    /** 提示条 id，与主体 aria-describedby 配对（分发层 useId 生成） */
    infoId: string;
    /** 透传给信息提示条的 className */
    className?: string;
    /** 被说明的主体 */
    children: React.ReactElement;
}

export const H5Tooltip = React.forwardRef<HTMLElement, H5TooltipProps>(
    function H5Tooltip({ mode, content, infoId, className, children }, ref) {
        const childProps = children.props as Partial<{
            ref: React.Ref<HTMLElement>;
            className: string;
        }>;

        // 主体原样保留，仅补 ref / 槽位 / 与提示条的 aria 关联，不叠加任何事件
        const trigger = React.cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
                ref: composeRefs(ref, childProps.ref),
                "data-slot": "tooltip-trigger",
                "data-mode": "h5",
                "aria-describedby": infoId,
                className: cn(childProps.className),
            },
        );

        return (
            <span
                data-slot="tooltip-h5"
                data-mode={mode === "mobile" ? "h5" : "pc"}
                className="inline-flex max-w-full flex-col items-start gap-[var(--bv-tooltip-h5-info-margin-top)]"
            >
                {trigger}
                <span
                    id={infoId}
                    data-slot="tooltip-info"
                    data-mode="h5"
                    className={cn(
                        "inline-flex max-w-full items-start rounded-[var(--bv-tooltip-h5-info-radius)]",
                        "bg-[var(--bv-tooltip-h5-info-background)]",
                        "px-[var(--bv-tooltip-h5-info-padding-x)] py-[var(--bv-tooltip-h5-info-padding-y)]",
                        "gap-[var(--bv-tooltip-h5-info-gap)]",
                        "text-[length:var(--bv-tooltip-h5-info-font)] leading-[var(--bv-tooltip-h5-info-line-height)]",
                        "text-[var(--bv-tooltip-h5-info-color)]",
                        className,
                    )}
                >
                    <Icon
                        name="info"
                        size="var(--bv-tooltip-h5-info-icon-size)"
                        aria-hidden
                        className="mt-[calc((var(--bv-tooltip-h5-info-line-height)-var(--bv-tooltip-h5-info-icon-size))/2)] shrink-0 text-[var(--bv-tooltip-h5-info-icon-color)]"
                    />
                    {/* min-w-0 才允许文字在 flex 容器内正常换行 */}
                    <span className="min-w-0">{content}</span>
                </span>
            </span>
        );
    },
);
