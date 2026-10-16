import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/**
 * Bivane Switch · 对齐 Vant <van-switch>（模式 A）
 *
 * 纯 ui 件：视觉与状态规则全在 utilities.css（[data-slot='switch'] 选择器），
 * 触屏保持 Vant 30px 轨道（伪元素外扩 44px 热区），精确指针设备由
 * .bv-focus-ring 给键盘焦点环。组件不做模式判定（矩阵 §2.2）。
 *
 * 值语义同 Vant：value 与 activeValue 全等比较判定开态，onChange 回传另一侧的
 * activeValue/inactiveValue（默认 true/false），因此可直接绑定字符串枚举。
 */

export type SwitchValue = boolean | string | number;

export interface SwitchProps extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onChange" | "value" | "defaultValue"
> {
    /**
     * 布尔受控快捷方式：等价于 value={checked ? activeValue : inactiveValue}。
     * 与 value 同时传入时以 checked 为准。
     */
    checked?: boolean;
    /** 当前值（受控）；与 activeValue 全等即为开 */
    value?: SwitchValue;
    /** 初始值（非受控），默认 inactiveValue */
    defaultValue?: SwitchValue;
    /** 值变更回调，回传切换后的值 */
    onChange?: (value: SwitchValue) => void;
    /** 开态对应的值（默认 true） */
    activeValue?: SwitchValue;
    /** 关态对应的值（默认 false） */
    inactiveValue?: SwitchValue;
    /** 禁用（Vant disabled） */
    disabled?: boolean;
    /** 加载态：节点内显示转菊且拒绝切换（Vant loading） */
    loading?: boolean;
    /** 节点基准尺寸，默认 30px（轨道按 2:1 等比）；数字按 px */
    size?: number | string;
    /** 开态轨道色，默认 primary */
    activeColor?: string;
    /** 关态轨道色，默认白底轻黑边 */
    inactiveColor?: string;
    /**
     * 切换前钩子：返回 false / Promise<false> / 抛异常都会放弃切换。
     * 等待期间自动进入 loading 态，防止重复点击（Vant before-change）。
     */
    beforeChange?: () => boolean | Promise<boolean>;
}

function toCssSize(size: number | string): string {
    return typeof size === "number" ? `${size}px` : size;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
    function Switch(
        {
            checked,
            value,
            defaultValue = false,
            onChange,
            activeValue = true,
            inactiveValue = false,
            disabled = false,
            loading = false,
            size,
            activeColor,
            inactiveColor,
            beforeChange,
            onClick,
            className,
            style,
            ...rest
        },
        ref,
    ) {
        const isControlled = value !== undefined;
        const [innerValue, setInnerValue] =
            React.useState<SwitchValue>(defaultValue);
        const currentValue = isControlled ? value : innerValue;
        // checked 布尔快捷方式优先；否则按 Vant 语义与 activeValue 全等比较
        const isOn =
            checked !== undefined ? checked : currentValue === activeValue;

        // beforeChange 进行中的内置 loading；外部 loading prop 同样锁定交互
        const [pending, setPending] = React.useState(false);
        const busy = loading || pending;
        const blocked = disabled || busy;

        const commit = React.useCallback(
            (next: SwitchValue) => {
                if (!isControlled) setInnerValue(next);
                onChange?.(next);
            },
            [isControlled, onChange],
        );

        const handleClick = async (
            event: React.MouseEvent<HTMLButtonElement>,
        ) => {
            // onClick 仅透出事件语义；即使禁用/忙碌也先让外部观察到点击
            onClick?.(event);
            if (blocked || event.defaultPrevented) return;

            const next = isOn ? inactiveValue : activeValue;

            if (beforeChange) {
                setPending(true);
                let allowed: boolean;
                try {
                    allowed = await beforeChange();
                } catch {
                    // 钩子异常等价于拒绝切换，避免异常白屏式静默
                    allowed = false;
                }
                setPending(false);
                if (!allowed) return;
            }

            commit(next);
        };

        // 仅在外部显式传参时写内联样式，否则交由 token 驱动（含禁用/深色覆盖）。
        // size 覆盖的是绝对 px 尺寸变量（轨道宽高与圆点全部派生自它），不走 em。
        const trackColor = isOn ? activeColor : inactiveColor;
        const dynamicStyle = {
            ...(size !== undefined
                ? { ["--bv-switch-size"]: toCssSize(size) }
                : {}),
            ...(trackColor !== undefined
                ? { backgroundColor: trackColor }
                : {}),
            ...style,
        } as React.CSSProperties;

        return (
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={isOn}
                disabled={disabled || pending}
                data-slot="switch"
                data-checked={isOn ? "true" : undefined}
                data-disabled={disabled ? "true" : undefined}
                data-loading={busy ? "true" : undefined}
                onClick={handleClick}
                className={cn("bv-focus-ring", className)}
                style={dynamicStyle}
                {...rest}
            >
                <span data-slot="switch-node">
                    {busy ? (
                        <span data-slot="switch-loading">
                            <Icon name="loading" />
                        </span>
                    ) : null}
                </span>
            </button>
        );
    },
);
