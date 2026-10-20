import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Bivane Icon
 * 图标集为自研 SVG（lucide 风格线性图标），不依赖 Vant iconfont，
 * 彻底规避商标与字体资产的授权问题。
 *
 * 尺寸通过 fontSize 驱动（1em），因此与文字基线天然对齐；
 * 颜色统一走 currentColor，由父级颜色决定。
 */

export const iconNames = [
    "arrow",
    "arrow-left",
    "arrow-down",
    "arrow-up",
    "check",
    // Checkbox 半选（indeterminate）横杠
    "minus",
    // Search：放大镜（胶囊内）、时钟（历史记录行）、关闭（清除键）
    "search",
    "clock",
    "cross",
    "loading",
    "success",
    "fail",
    "info",
    "warning",
    // Rate 的空星（outline）；实心星由 rate-parts 同一 path 改 fill 渲染
    "star",
    // Uploader：新增（+）、重试（replay）、拖拽上传（upload）、文件（description）
    "plus",
    "replay",
    "upload",
    "description",
    // Tabbar 导航项：首页 / 我的 / 购物车 / 订单 / 设置 / 消息
    "home",
    "user",
    "cart",
    "order",
    "setting",
    "message",
] as const;

export type IconName = (typeof iconNames)[number];

const glyphs: Record<IconName, React.ReactNode> = {
    arrow: <path d="m9 5 7 7-7 7" />,
    "arrow-left": <path d="m15 5-7 7 7 7" />,
    // 下拉指示器。Select / DatePicker 的触发器用它，语义是「展开候选」而非「前往下一页」
    "arrow-down": <path d="m5 9 7 7 7-7" />,
    // 上箭头：InputNumber 的 PC 竖排微调列用它（与 arrow-down 成对）
    "arrow-up": <path d="m5 15 7-7 7 7" />,
    // 选中态勾选。用细线勾（与 Vant 的 icon-success 不同：那是填充圆环，这里是纯勾）
    check: <path d="m5 12.5 4.5 4.5L19 7" />,
    minus: <path d="M5 12h14" />,
    search: (
        <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
        </>
    ),
    cross: <path d="M18 6 6 18M6 6l12 12" />,
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    loading: <path d="M12 3a9 9 0 1 0 9 9" />,
    success: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.2 2.4 2.4 4.6-5" />
        </>
    ),
    fail: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11.2v5.3" />
            <path d="M12 7.8h.01" />
        </>
    ),
    warning: (
        <>
            <path d="M12 4.6 3.4 19.4h17.2L12 4.6Z" />
            <path d="M12 10v4.2" />
            <path d="M12 17.1h.01" />
        </>
    ),
    star: <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    replay: (
        <>
            <path d="M20 12a8 8 0 1 1-2.6-5.9" />
            <path d="M20 4v5h-5" />
        </>
    ),
    upload: (
        <>
            <path d="M12 16V4M8 8l4-4 4 4" />
            <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
        </>
    ),
    description: (
        <>
            <path d="M14 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V7.5Z" />
            <path d="M14 3v4.5h4.5" />
            <path d="M8.5 13h7M8.5 16.5h5" />
        </>
    ),
    // Tabbar 导航项图标（Tabbar 的 icon 传 <Icon name="…" />）
    home: (
        <>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    cart: (
        <>
            <circle cx="9" cy="20" r="1.5" />
            <circle cx="18" cy="20" r="1.5" />
            <path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6" />
        </>
    ),
    order: (
        <>
            <path d="M8 6h13M8 12h13M8 18h13" />
            <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </>
    ),
    setting: (
        <>
            <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
            <circle cx="15" cy="7" r="2" />
            <circle cx="9" cy="12" r="2" />
            <circle cx="17" cy="17" r="2" />
        </>
    ),
    message: (
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" />
    ),
};

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, "name"> {
    /** 图标名，取值见 iconNames */
    name: IconName;
    /** 尺寸，接受数字（px）或任意 CSS 长度，默认 1em 跟随字号 */
    size?: number | string;
    /** 颜色，默认 currentColor */
    color?: string;
    /** 无障碍标签；不传时按装饰性图标处理（aria-hidden） */
    label?: string;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon(
    { name, size, color, label, className, style, ...props },
    ref,
) {
    const isDecorative = label === undefined;

    return (
        <svg
            ref={ref}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden={isDecorative || undefined}
            role={isDecorative ? undefined : "img"}
            aria-label={label}
            className={cn(
                "inline-block h-[1em] w-[1em] shrink-0",
                name === "loading" && "animate-spin",
                className,
            )}
            style={{
                fontSize:
                    size === undefined
                        ? undefined
                        : typeof size === "number"
                          ? `${size}px`
                          : size,
                color,
                ...style,
            }}
            {...props}
            data-slot="icon"
        >
            {glyphs[name]}
        </svg>
    );
});

export { glyphs as __iconGlyphs };
