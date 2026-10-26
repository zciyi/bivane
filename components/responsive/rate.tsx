import * as React from "react";
import { lazyWithRef } from "@/lib/lazy-with-ref";
// H5 / PC 两套呈现拆成异步 chunk（架构 §6.3 包体策略）
const H5Rate = lazyWithRef(() => import("@/components/h5/rate").then((m) => ({ default: m.H5Rate })));
const PcRate = lazyWithRef(() => import("@/components/pc/rate").then((m) => ({ default: m.PcRate })));
import type { RateRenderProps } from "@/components/ui/rate-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import { useRateValue } from "@/hooks/use-rate-state";

/**
 * Bivane Rate · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 点击 / 手指横向滑动连续选值，44px 热区
 * └ PC ── 点击 + hover 预览 + 键盘方向键（±1 / 半星 ±0.5 / Home/End）
 *
 * 值语义（夹紧、clearable 同值清零）在 hooks/use-rate-state，两端同义 → 本层。
 * 星色用 props 默认走 token（var()），不新增工具类（无需改 theme.css / BV_COLORS）。
 */
export interface RateProps {
    /** 受控分值，默认 0 */
    value?: number;
    /** 初始分值，默认 0 */
    defaultValue?: number;
    /** 星数，默认 5 */
    count?: number;
    /** 允许半星，默认 false */
    allowHalf?: boolean;
    /** 只读：不可选 */
    readonly?: boolean;
    /** 禁用：不可评分（星用 disabledColor） */
    disabled?: boolean;
    /** 星尺寸，数字按 px，默认 20 */
    size?: number | string;
    /** 星间距，数字按 px，默认 4 */
    gutter?: number | string;
    /** 实心星颜色，默认星黄 token */
    color?: string;
    /** 空星颜色，默认 gray-5 token */
    voidColor?: string;
    /** 禁用星颜色，默认 gray-5 token */
    disabledColor?: string;
    /** 再次点击当前分值清零（Vant clearable），默认 false */
    clearable?: boolean;
    /** 触屏滑动选择，默认 true（PC 忽略） */
    touchable?: boolean;
    /** 自定义实心星节点（覆盖默认五角星） */
    icon?: React.ReactNode;
    /** 自定义空星节点 */
    voidIcon?: React.ReactNode;
    /** 分值变化回调 */
    onChange?: (value: number) => void;
    /** 自定义类名（透传到根元素） */
    className?: string;
    /** 自定义内联样式（透传到根元素） */
    style?: React.CSSProperties;
    /** 根元素 id */
    id?: string;
    /** 无障碍标签（渲染到 role="slider" 容器上），与全库其余组件一致用 ariaLabel */
    ariaLabel?: string;
    /** 强制按某个端渲染：'mobile' 移动端 / 'desktop' 桌面端；不传则按视口宽度自动判定 */
    forceMode?: DeviceMode;
}

export const Rate = React.forwardRef<HTMLDivElement, RateProps>(function Rate(
    {
        value,
        defaultValue,
        count = 5,
        allowHalf = false,
        readonly = false,
        disabled = false,
        size = 20,
        gutter = 4,
        color = "var(--bv-rate-icon-full-color)",
        voidColor = "var(--bv-rate-icon-void-color)",
        disabledColor = "var(--bv-rate-icon-disabled-color)",
        clearable = false,
        touchable = true,
        icon,
        voidIcon,
        onChange,
        className,
        style,
        id,
        ariaLabel,
        forceMode,
    },
    ref,
) {
    const mode = useDeviceMode(forceMode);
    const { current, selectStar } = useRateValue({
        value,
        defaultValue,
        count,
        allowHalf,
        disabled,
        readonly,
        clearable,
        onChange,
    });

    const common: RateRenderProps = {
        current,
        count,
        allowHalf,
        readonly,
        disabled,
        size,
        gutter,
        color,
        voidColor,
        disabledColor,
        icon,
        voidIcon,
        onSelect: selectStar,
        touchable,
        className,
        style,
        id,
        ariaLabel,
    };

    return (
        <React.Suspense fallback={null}>
            {mode === "mobile" ? (
                <H5Rate ref={ref} {...common} />
            ) : (
                <PcRate ref={ref} {...common} />
            )}
        </React.Suspense>
    );
});
