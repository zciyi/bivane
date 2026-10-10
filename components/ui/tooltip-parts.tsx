import * as React from "react";
import { cn } from "@/lib/utils";
import { Portal } from "@/lib/portal";
import type { DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane Tooltip · PC 气泡零件（交互定义见 bivane-responsive-matrix.md §2.1）
 *
 * 信息只有一段补充说明，两端容器密度不同：
 *   PC = hover/focus 触发的跟随指针深色气泡（本文件：内容渲染 + 定位 + 进出场）；
 *   H5 = 常驻 ⓘ 信息提示条（见 components/h5/tooltip.tsx，不经过浮层）。
 * 键盘聚焦触发时气泡退化为锚定触发元素。
 *
 * 气泡恒为纯展示：pointer-events:none、role="tooltip"、不承载任何操作。
 */

/* ------------------------------------------------------------------ *
 * 计时常量（与 vant.css 同名 token 逐字对齐；jsdom 不做 CSS 级联，
 * 定时器在 JS 侧，需要一份镜像常量。token 是视觉事实源，这里是计时事实源）
 * ------------------------------------------------------------------ */

/** PC：hover 后延迟多久弹出（矩阵定死 200ms，防扫过误触） */
export const TOOLTIP_PC_OPEN_DELAY = 200;
/** 进出场所时长（镜像 --bv-tooltip-duration），到点才卸载节点 */
export const TOOLTIP_TRANSITION_MS = 120;

/* ------------------------------------------------------------------ *
 * 定位纯函数（无 DOM 依赖，可直接单测）
 * ------------------------------------------------------------------ */

export interface TipPoint {
    x: number;
    y: number;
}

export interface TipRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** 指针锚点（触摸 / 鼠标）或元素矩形锚点（键盘聚焦，没有指针坐标可用） */
export type TipAnchor =
    | ({ kind: "point" } & TipPoint)
    | { kind: "rect"; rect: TipRect };

export interface TipViewport {
    width: number;
    height: number;
}

export interface ResolvedTipPosition extends TipPoint {
    /** 实际落位（相对锚点），写入 data-placement 便于调试 */
    placement: "above" | "below";
}

/**
 * 计算气泡左上角坐标：
 * - 指针点：优先落在指针**右下方**（手指/光标本身挡住左上区域），
 *   右/下放不下时翻转；最后统一夹回视口安全留白内。
 * - 元素矩形：水平居中于元素，默认贴**上方**，上方放不下才翻下方。
 */
export function resolveBubblePosition(
    anchor: TipAnchor,
    box: { width: number; height: number },
    viewport: TipViewport,
    gap: number,
    margin: number,
): ResolvedTipPosition {
    const maxX = Math.max(margin, viewport.width - margin - box.width);
    const maxY = Math.max(margin, viewport.height - margin - box.height);
    const clampX = (x: number) => Math.min(Math.max(x, margin), maxX);
    const clampY = (y: number) => Math.min(Math.max(y, margin), maxY);

    if (anchor.kind === "rect") {
        const { rect } = anchor;
        const x = clampX(rect.x + (rect.width - box.width) / 2);
        const aboveY = rect.y - gap - box.height;
        if (aboveY >= margin) {
            return { x, y: clampY(aboveY), placement: "above" };
        }
        return {
            x,
            y: clampY(rect.y + rect.height + gap),
            placement: "below",
        };
    }

    let x = anchor.x + gap;
    let y = anchor.y + gap;
    let placement: ResolvedTipPosition["placement"] = "below";
    if (x + box.width > viewport.width - margin) {
        x = anchor.x - gap - box.width;
    }
    if (y + box.height > viewport.height - margin) {
        y = anchor.y - gap - box.height;
        placement = "above";
    }
    return { x: clampX(x), y: clampY(y), placement };
}

/* ------------------------------------------------------------------ *
 * 气泡
 * ------------------------------------------------------------------ */

/** 读取 :root 上的 px 型 token；拿不到（jsdom / 未引 token）时回落兜底值 */
function readTokenPx(name: string, fallback: number): number {
    if (typeof window === "undefined") return fallback;
    const value = Number.parseFloat(
        window
            .getComputedStyle(document.documentElement)
            .getPropertyValue(name),
    );
    return Number.isFinite(value) ? value : fallback;
}

function getViewport(): TipViewport {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
}

export interface TooltipBubbleProps {
    mode: DeviceMode;
    /** 是否展示；false 时播 120ms 退场再卸载 */
    show: boolean;
    /** 定位锚点；show=false 时保留上一次的值，退场动画不跳位 */
    anchor: TipAnchor;
    /** 与触发器 aria-describedby 对应的唯一 id（分发层用 useId 生成） */
    id?: string;
    className?: string;
    children: React.ReactNode;
}

export const TooltipBubble = React.forwardRef<
    HTMLDivElement,
    TooltipBubbleProps
>(function TooltipBubble({ mode, show, anchor, id, className, children }, ref) {
    const [mounted, setMounted] = React.useState(show);
    const [state, setState] = React.useState<"open" | "closed">(
        show ? "open" : "closed",
    );

    // 两阶段挂载（同 Popup）：先挂载再下一帧切 open，淡入动画才有起始帧
    React.useEffect(() => {
        if (show) {
            setMounted(true);
            const raf = requestAnimationFrame(() => setState("open"));
            return () => cancelAnimationFrame(raf);
        }
        setState("closed");
        const timer = window.setTimeout(
            () => setMounted(false),
            TOOLTIP_TRANSITION_MS,
        );
        return () => window.clearTimeout(timer);
    }, [show]);

    const bubbleRef = React.useRef<HTMLDivElement | null>(null);
    const [box, setBox] = React.useState({ width: 0, height: 0 });

    // 挂载后先量尺寸再定位：useLayoutEffect 在绘制前完成，看不到「先出现在左上角再跳位」
    React.useLayoutEffect(() => {
        if (!mounted) return;
        const node = bubbleRef.current;
        if (!node) return;
        setBox((prev) => {
            const next = {
                width: node.offsetWidth,
                height: node.offsetHeight,
            };
            return prev.width === next.width && prev.height === next.height
                ? prev
                : next;
        });
    }, [mounted, children]);

    const [viewport, setViewport] = React.useState(getViewport);
    React.useEffect(() => {
        if (!mounted) return undefined;
        const onResize = () => setViewport(getViewport());
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [mounted]);

    const setMergedRef = React.useCallback(
        (node: HTMLDivElement | null) => {
            bubbleRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref)
                (ref as React.MutableRefObject<HTMLDivElement | null>).current =
                    node;
        },
        [ref],
    );

    if (!mounted) return null;

    const gap = readTokenPx("--bv-tooltip-gap", 12);
    const margin = readTokenPx("--bv-tooltip-viewport-margin", 8);
    const position = resolveBubblePosition(anchor, box, viewport, gap, margin);

    return (
        <Portal>
            <div
                ref={setMergedRef}
                id={id}
                role="tooltip"
                data-mode={mode === "mobile" ? "h5" : "pc"}
                data-state={state}
                data-placement={position.placement}
                data-slot="tooltip-bubble"
                className={cn(
                    "pointer-events-none fixed left-0 top-0 z-[var(--bv-tooltip-z-index)] box-border",
                    "max-w-[var(--bv-tooltip-max-width)] rounded-[var(--bv-tooltip-radius)]",
                    "px-[var(--bv-tooltip-padding-x)] py-[var(--bv-tooltip-padding-y)]",
                    "text-bv-sm leading-[var(--bv-tooltip-line-height)]",
                    "bg-[var(--bv-tooltip-background)] text-[var(--bv-tooltip-color)]",
                    className,
                )}
                style={{
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                }}
            >
                {children}
            </div>
        </Portal>
    );
});
