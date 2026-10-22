/**
 * Dialog 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { showAlertDialog, showConfirmDialog, showDialog } from '@/components/responsive/dialog';
import { showSuccessToast, showToast } from '@/components/responsive/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Dialog 的第 1 个示例 */
export function DialogExample1() {
    const [, setDialogOpen] = React.useState(false);
    const [, setLongDialogOpen] = React.useState(false);
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                    <Row>
                                        <Button
                                            type="primary"
                                            onClick={() => setDialogOpen(true)}
                                        >
                                            声明式对话框
                                        </Button>
                                        <Button
                                            type="danger"
                                            onClick={() =>
                                                showConfirmDialog({
                                                    title: "删除确认",
                                                    message: "删除后不可恢复，确定继续吗？",
                                                    confirmText: "删除",
                                                    cancelText: "再想想",
                                                    onConfirm: () =>
                                                        showSuccessToast("已删除"),
                                                    onCancel: () => showToast("已取消"),
                                                })
                                            }
                                        >
                                            命令式确认框
                                        </Button>
                                        <Button
                                            onClick={() =>
                                                showDialog({
                                                    title: "异步提交",
                                                    message:
                                                        "点击确认后会延迟 1.2s 才关闭，期间按钮进入 loading。",
                                                    confirmText: "提交",
                                                    showCancelButton: true,
                                                    beforeClose: (action) =>
                                                        action === "confirm"
                                                            ? new Promise<boolean>(
                                                                  (resolve) =>
                                                                      setTimeout(
                                                                          () =>
                                                                              resolve(true),
                                                                          1200,
                                                                      ),
                                                              )
                                                            : true,
                                                    onConfirm: () =>
                                                        showSuccessToast("提交完成"),
                                                })
                                            }
                                        >
                                            beforeClose 异步
                                        </Button>
                                        <Button onClick={() => setLongDialogOpen(true)}>
                                            长内容（内部滚动）
                                        </Button>
                                    </Row>
                                    <p className="text-bv-sm text-bv-text-2">
                                        当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                        {mode === "mobile"
                                            ? "底部抽屉、顶部拖拽指示条、按钮纵向排列（确认在上、取消在下）"
                                            : "居中模态 520px、按钮横向右对齐、焦点陷阱、单击遮罩不关"}
                                    </p>
                                </Block>
    );
}
/** Dialog 的第 2 个示例 */
export function DialogExample2() {
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                    <Row>
                                        <Button
                                            type="primary"
                                            onClick={() =>
                                                showAlertDialog({
                                                    title: "提示",
                                                    message:
                                                        "Alert 语义：只有一个确认按钮（showCancelButton 默认 false）。",
                                                    confirmText: "我知道了",
                                                })
                                            }
                                        >
                                            showAlertDialog
                                        </Button>
                                        <Button
                                            type="danger"
                                            onClick={() =>
                                                showConfirmDialog({
                                                    title: "删除确认",
                                                    message:
                                                        "Confirm 语义：默认带取消按钮。",
                                                    confirmText: "删除",
                                                    cancelText: "再想想",
                                                    onConfirm: () =>
                                                        showSuccessToast("已删除"),
                                                    onCancel: () => showToast("已取消"),
                                                })
                                            }
                                        >
                                            showConfirmDialog
                                        </Button>
                                    </Row>
                                    <p className="text-bv-sm text-bv-text-2">
                                        Alert 与 Confirm 共用同一渲染逻辑与按钮序（H5
                                        纵向「确认在上、取消在下」；PC
                                        横向右对齐、主按钮在右），差别只在默认是否带取消按钮。
                                    </p>
                                </Block>
    );
}
export function DialogDemos() {
    return (
    <>
        <Section title="P1 · Dialog 对话框（模式 B + 双轨 API）">
                            <DialogExample1 />
                        </Section>
        <Section title="P1′ · Alert / Confirm（复用 Dialog 底座）">
                            <DialogExample2 />
                        </Section>
    </>
        );
}