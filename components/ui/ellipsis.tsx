import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Bivane Ellipsis · 多行截断 + 展开/收起
 * 两端同形（模式 A）：纯文本容器，字号/行高继承父级，不自带排版。
 *
 * 与 Tooltip 的分工：H5 没有 hover，辅助说明常驻展示；文案太长时由消费者
 * 把 content 交给本组件折叠（<Tooltip content={<Ellipsis rows={2}>…</Ellipsis>} />），
 * Tooltip 自身不内置截断，避免「提示」与「折叠」两个职责耦在一个件里。
 *
 * 「是否需要截断」靠真实布局测量（scrollHeight 对比 rows × 行高），
 * jsdom 不做布局（恒 0），几何分支由测试 mock 尺寸兜底。
 */

export interface EllipsisProps {
    /** 文本内容；也接受行内节点，但块级嵌套会破坏行数测量 */
    children: React.ReactNode;
    /** 收起态最多显示的行数，默认 2；非法值（<1）回落 1 */
    rows?: number;
    /** 展开按钮文案，默认「展开」 */
    expandText?: React.ReactNode;
    /** 收起按钮文案，默认「收起」 */
    collapseText?: React.ReactNode;
    /** 受控展开态 */
    expanded?: boolean;
    /** 非受控初始展开态，默认收起 */
    defaultExpanded?: boolean;
    onExpandedChange?: (expanded: boolean) => void;
    className?: string;
}

/** 测量判定的 1px 容差，避免子像素四舍五入把「刚好等于」误判为溢出 */
const OVERFLOW_TOLERANCE = 1;

export const Ellipsis = React.forwardRef<HTMLDivElement, EllipsisProps>(
    function Ellipsis(
        {
            children,
            rows,
            expandText = "展开",
            collapseText = "收起",
            expanded,
            defaultExpanded = false,
            onExpandedChange,
            className,
        },
        ref,
    ) {
        const clampedRows = Math.max(1, Math.floor(rows ?? 2) || 1);
        const isControlled = expanded !== undefined;
        const [innerExpanded, setInnerExpanded] =
            React.useState(defaultExpanded);
        const isExpanded = isControlled ? expanded : innerExpanded;

        const textRef = React.useRef<HTMLDivElement | null>(null);
        /** 内容是否真的超过 rows 行；没超过就不显示开关 */
        const [overflowable, setOverflowable] = React.useState(false);

        const setMergedRef = React.useCallback(
            (node: HTMLDivElement | null) => {
                textRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref)
                    (
                        ref as React.MutableRefObject<HTMLDivElement | null>
                    ).current = node;
            },
            [ref],
        );

        // 统一按「完整内容高 > rows × 行高」判定：无论当前是否展开，
        // scrollHeight 都取未裁剪的内容高（-webkit-box 裁剪下依然成立）。
        const measure = React.useCallback(() => {
            const node = textRef.current;
            if (!node) return;
            const computed = window.getComputedStyle(node);
            const fontSize = Number.parseFloat(computed.fontSize) || 0;
            const lineHeight =
                Number.parseFloat(computed.lineHeight) || fontSize * 1.2;
            if (!lineHeight) return;
            setOverflowable(
                node.scrollHeight >
                    clampedRows * lineHeight + OVERFLOW_TOLERANCE,
            );
        }, [clampedRows]);

        // 挂载、内容、行数变化后重测；宽度变化（响应式换行）交给 ResizeObserver
        React.useLayoutEffect(() => {
            measure();
        }, [measure, children]);

        React.useEffect(() => {
            const node = textRef.current;
            if (!node || typeof ResizeObserver === "undefined") return undefined;
            const observer = new ResizeObserver(() => measure());
            observer.observe(node);
            return () => observer.disconnect();
        }, [measure]);

        const toggle = React.useCallback(() => {
            const next = !isExpanded;
            if (!isControlled) setInnerExpanded(next);
            onExpandedChange?.(next);
        }, [isControlled, isExpanded, onExpandedChange]);

        return (
            <div
                data-slot="ellipsis"
                data-expanded={isExpanded ? "true" : "false"}
                className={cn("flex max-w-full flex-col items-start", className)}
            >
                <div
                    ref={setMergedRef}
                    data-slot="ellipsis-text"
                    className={cn(
                        "min-w-0 max-w-full break-words",
                        !isExpanded &&
                            "overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]",
                    )}
                    style={
                        isExpanded
                            ? undefined
                            : { WebkitLineClamp: clampedRows }
                    }
                >
                    {children}
                </div>
                {overflowable ? (
                    <button
                        type="button"
                        data-slot="ellipsis-action"
                        aria-expanded={isExpanded}
                        onClick={toggle}
                        className="mt-[var(--bv-ellipsis-action-gap)] inline-flex cursor-pointer items-center gap-[var(--bv-ellipsis-action-gap)] border-0 bg-transparent p-0 text-[length:inherit] leading-[inherit] text-[var(--bv-ellipsis-action-color)]"
                    >
                        {isExpanded ? collapseText : expandText}
                        <Icon
                            name="arrow-down"
                            size="1em"
                            aria-hidden
                            className={cn(
                                "transition-transform duration-200",
                                isExpanded && "rotate-180",
                            )}
                        />
                    </button>
                ) : null}
            </div>
        );
    },
);
