/**
 * Popup 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { type PopupPosition } from '@/components/responsive/popup';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Popup 的第 1 个示例 */
export function PopupExample1() {
    const [_popup, setPopup] = React.useState<{
        open: boolean;
        position: PopupPosition;
        long: boolean;
    }>({
        open: false,
        position: "bottom",
        long: false,
    });
    const openPopup = (position: PopupPosition, long = false) =>
        setPopup({ open: true, position, long });
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Button
                                        type="primary"
                                        onClick={() => openPopup("bottom")}
                                    >
                                        bottom
                                    </Button>
                                    <Button onClick={() => openPopup("center")}>
                                        center
                                    </Button>
                                    <Button onClick={() => openPopup("left")}>
                                        left
                                    </Button>
                                    <Button onClick={() => openPopup("right")}>
                                        right
                                    </Button>
                                    <Button onClick={() => openPopup("top")}>
                                        top
                                    </Button>
                                    {/* 长内容：验证内容超过 --bv-popup-max-height 时封顶 + 内部滚动
                 （按钮文案不能只写 center，否则会抢走 clickButton('center') 的精确匹配） */}
                                    <Button onClick={() => openPopup("center", true)}>
                                        center · 长内容
                                    </Button>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "四向滑入、底部圆角 + 安全区、可按住指示条下拉关闭、点击遮罩关闭"
                                        : "所有方向一律降级为居中模态、遮罩点击不关、ESC 关闭、动画 200ms"}
                                </p>
                                <p className="text-bv-sm text-bv-text-3">
                                    注：PC
                                    端「bottom」不会渲染成底部面板，而是居中弹出（data-position
                                    仍记录原始值， data-position-resolved
                                    记录实际形态）——这是形态降级，不是功能缺失。
                                </p>
                            </Block>
    );
}
export function PopupDemos() {
    return (
    <Section title="P1 · Popup 弹层（模式 B：同一 primitive 换壳）">
                        <PopupExample1 />
                    </Section>
        );
}