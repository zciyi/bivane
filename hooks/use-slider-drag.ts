import * as React from "react";

/**
 * Bivane Slider · 指针拖拽手势（两端共用）
 *
 * 把「轨道 ref + 落点坐标」换算成比例，全程用 Pointer Capture 思路（window 级
 * pointermove/up），pc/h5 同一套手势；差异只在：H5 不进 Tab 流、PC 加键盘焦点。
 * 比例→数值、thumb 选择由组件负责，本 hook 只做「坐标→比例」与监听器生命周期。
 */

export interface SliderDragParams {
    /** 是否竖向拖拽 */
    vertical: boolean;
    /** 是否反转坐标方向 */
    reverse: boolean;
    /** 是否禁用拖拽 */
    disabled: boolean;
    /** 拖拽开始（点击/按下瞬间），组件可在此触发 onDragStart */
    onDragStart: () => void;
    /** 拖拽中：传入落点比例 0~1（已含 reverse） */
    onDrag: (ratio: number) => void;
    /** 拖拽结束（抬手/取消），组件可在此触发 onDragEnd */
    onDragEnd: () => void;
}

function clampRatio(ratio: number): number {
    if (ratio < 0) return 0;
    if (ratio > 1) return 1;
    return ratio;
}

export function useSliderDrag(
    trackRef: React.RefObject<HTMLElement | null>,
    params: SliderDragParams,
) {
    const { vertical, reverse, disabled, onDragStart, onDragEnd, onDrag } =
        params;
    const draggingRef = React.useRef(false);
    // 监听器只活在本函数作用域内（move/up 都是闭包），抬手时直接按同一引用移除，
    // 无需再存一份 ref。React 19 的 useRef 必须带初值，这里也就没有存 undefined 的必要。
    const cleanupRef = React.useRef<(() => void) | null>(null);
    const callbacksRef = React.useRef({ onDrag, onDragEnd });
    const endTracking = React.useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        cleanupRef.current?.();
        cleanupRef.current = null;
        callbacksRef.current.onDragEnd();
    }, []);

    // 先同步回调再中断手势，确保禁用时结束通知拿到本次渲染的最终值。
    React.useLayoutEffect(() => {
        callbacksRef.current = { onDrag, onDragEnd };
        if (disabled) endTracking();
    }, [disabled, onDrag, onDragEnd, endTracking]);

    const ratioFromClient = React.useCallback(
        (clientX: number, clientY: number): number | null => {
            const el = trackRef.current;
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return null;
            let ratio = vertical
                ? 1 - (clientY - rect.top) / rect.height
                : (clientX - rect.left) / rect.width;
            ratio = clampRatio(ratio);
            if (reverse) ratio = 1 - ratio;
            return ratio;
        },
        [vertical, reverse, trackRef],
    );

    const beginTracking = React.useCallback(
        () => {
            if (disabled) return;
            cleanupRef.current?.();
            draggingRef.current = true;
            onDragStart();

            const move = (event: PointerEvent) => {
                if (!draggingRef.current) return;
                const r = ratioFromClient(event.clientX, event.clientY);
                if (r !== null) callbacksRef.current.onDrag(r);
            };
            const up = endTracking;
            cleanupRef.current = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                window.removeEventListener("pointercancel", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
            window.addEventListener("pointercancel", up);
        },
        [disabled, onDragStart, ratioFromClient, endTracking],
    );

    // 卸载时若仍在拖拽，清理全局监听，避免泄漏
    React.useEffect(
        () => () => {
            draggingRef.current = false;
            cleanupRef.current?.();
            cleanupRef.current = null;
        },
        [],
    );

    return { beginTracking, ratioFromClient, draggingRef };
}
