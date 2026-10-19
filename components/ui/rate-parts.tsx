import * as React from "react";

/**
 * Bivane Rate · 共用视觉件（两端同形，差异只在交互，故视觉共用）
 *
 * 单颗星 = 空星（outline）+ 其上一块按比例裁切的实心星。
 * 半星由裁切宽度（fraction×100%）自然得到，不另画半星 glyph。
 * 实心星默认用内置 Star（Vant 同款五角星 path）；允许传自定义 `icon`/`voidIcon`
 * 节点（Vant 原是 iconfont 名字，本库无 iconfont，故改为 ReactNode）。
 */

/** 两端共用的渲染配置：值与外观，交互各自实现 */
export interface RateRenderProps {
    current: number;
    count: number;
    allowHalf: boolean;
    readonly: boolean;
    disabled: boolean;
    size: number | string;
    gutter: number | string;
    color: string;
    voidColor: string;
    disabledColor: string;
    icon?: React.ReactNode;
    voidIcon?: React.ReactNode;
    /** 选星（已含 clearable 同值清零，来自分发层的 binding） */
    onSelect: (target: number) => void;
    /** 触屏滑动选择（H5 消费，PC 忽略） */
    touchable: boolean;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    ariaLabel?: string;
}

const STAR_PATH =
    "M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

function toPx(size: number | string): string {
    return typeof size === "number" ? `${size}px` : size;
}

function Star({
    filled,
    color,
    size,
}: {
    filled: boolean;
    color: string;
    size: string;
}) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill={filled ? color : "none"}
            stroke={filled ? "none" : color}
            strokeWidth={1.8}
            strokeLinejoin="round"
            data-slot="rate-star-glyph"
            className="block"
        >
            <path d={STAR_PATH} />
        </svg>
    );
}

export interface RateStarProps {
    /** 该星被填充比例 0~1（半星即 0.5） */
    fraction: number;
    /** 星尺寸，数字按 px */
    size: number | string;
    /** 实心星颜色（禁用时改用 disabledColor） */
    color: string;
    /** 空星颜色 */
    voidColor: string;
    disabledColor: string;
    disabled?: boolean;
    /** 自定义实心星节点（覆盖默认 Star） */
    icon?: React.ReactNode;
    /** 自定义空星节点（覆盖默认 Star） */
    voidIcon?: React.ReactNode;
}

export const RateStar = React.forwardRef<HTMLSpanElement, RateStarProps>(
    function RateStar(
        {
            fraction,
            size,
            color,
            voidColor,
            disabledColor,
            disabled = false,
            icon,
            voidIcon,
        },
        ref,
    ) {
        const px = toPx(size);
        const fillColor = disabled ? disabledColor : color;

        const fullNode = icon ? (
            <span
                className="block"
                style={{ width: px, height: px }}
                data-slot="rate-star-custom"
            >
                {icon}
            </span>
        ) : (
            <Star filled size={px} color={fillColor} />
        );
        const voidNode = voidIcon ? (
            <span
                className="block"
                style={{ width: px, height: px }}
                data-slot="rate-star-custom"
            >
                {voidIcon}
            </span>
        ) : (
            <Star filled={false} size={px} color={voidColor} />
        );

        return (
            <span
                ref={ref}
                data-slot="rate-star"
                className="relative inline-block align-top"
                style={{ width: px, height: px }}
            >
                <span
                    data-slot="rate-star-void"
                    className="absolute inset-0"
                >
                    {voidNode}
                </span>
                <span
                    data-slot="rate-star-fill"
                className="absolute left-0 top-0 h-full overflow-hidden"
                style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }}
                >
                    {fullNode}
                </span>
            </span>
        );
    },
);
