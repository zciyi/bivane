/**
 * Toast 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { closeToast, showFailToast, showLoadingToast, showSuccessToast, showToast } from '@/components/responsive/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Toast 的第 1 个示例 */
export function ToastExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Button onClick={() => showToast("这是一条纯文案")}>
                                        纯文案
                                    </Button>
                                    <Button
                                        type="success"
                                        onClick={() => showSuccessToast("操作成功")}
                                    >
                                        成功
                                    </Button>
                                    <Button
                                        type="danger"
                                        onClick={() => showFailToast("操作失败")}
                                    >
                                        失败
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            const handle = showLoadingToast("加载中");
                                            setTimeout(() => handle.close(), 1500);
                                        }}
                                    >
                                        loading（1.5s 后自关）
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            closeToast();
                                            showToast("第一条");
                                            showToast("第二条");
                                        }}
                                    >
                                        连发两条
                                    </Button>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "顶部居中胶囊、白字深底、单例（连发两条只看到第二条）、2s 自动消失"
                                        : "右上角卡片栈、白底彩色图标、可多条并存、带关闭按钮"}
                                </p>
                            </Block>
    );
}
export function ToastDemos() {
    return (
    <Section title="P1 · Toast 轻提示（模式 C：两种形态本质不同）">
                        <ToastExample1 />
                    </Section>
        );
}