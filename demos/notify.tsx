/**
 * Notify 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { closeNotify, showNotify } from '@/components/responsive/notify';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Notify 的第 1 个示例 */
export function NotifyExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Button
                                        onClick={() => showNotify("默认类型（danger）")}
                                    >
                                        默认
                                    </Button>
                                    <Button
                                        type="primary"
                                        onClick={() =>
                                            showNotify({
                                                type: "primary",
                                                message: "这是一条主要通知",
                                            })
                                        }
                                    >
                                        primary
                                    </Button>
                                    <Button
                                        type="success"
                                        onClick={() =>
                                            showNotify({
                                                type: "success",
                                                message: "保存成功",
                                            })
                                        }
                                    >
                                        success
                                    </Button>
                                    <Button
                                        type="warning"
                                        onClick={() =>
                                            showNotify({
                                                type: "warning",
                                                message: "网络不稳定",
                                            })
                                        }
                                    >
                                        warning
                                    </Button>
                                    <Button
                                        type="danger"
                                        onClick={() =>
                                            showNotify({
                                                type: "danger",
                                                message: "删除失败",
                                            })
                                        }
                                    >
                                        danger
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            showNotify({
                                                type: "primary",
                                                message: "常驻通知 · 点 ✕ 关闭",
                                                duration: 0,
                                            })
                                        }
                                    >
                                        常驻（duration=0）
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            showNotify("第一条");
                                            showNotify("第二条");
                                            showNotify("第三条");
                                        }}
                                    >
                                        连发三条
                                    </Button>
                                    <Button onClick={() => closeNotify()}>
                                        关闭全部
                                    </Button>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "顶部通栏横幅、自上方滑入、单例（连发三条只看到最后一条）、3s 自动消失、无关闭按钮"
                                        : "右上角圆角卡片栈、自右侧滑入、可多条并存、每条带关闭按钮"}
                                    。duration=0 时常驻，H5 也会补一个 ✕ 出口。
                                </p>
                            </Block>
    );
}
export function NotifyDemos() {
    return (
    <Section title="P1′ · Notify 消息通知（模式 C：顶部横幅 vs 右上角角标）">
                        <NotifyExample1 />
                    </Section>
        );
}