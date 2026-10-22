/**
 * ActionSheet 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/responsive/toast';
import { showActionSheet, type ActionSheetAction } from '@/components/responsive/action-sheet';
import { useDeviceMode } from '@/hooks/use-device-mode';
const SHEET_ACTIONS: ActionSheetAction[] = [
    { name: "分享给好友" },
    { name: "复制链接", subname: "有效期 7 天" },
    { name: "置顶（禁用）", disabled: true },
    { name: "删除", color: "var(--bv-danger)" },
];
/** ActionSheet 的第 1 个示例 */
export function ActionSheetExample1() {
    const [, setSheetOpen] = React.useState(false);
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Button
                                        type="primary"
                                        onClick={() =>
                                            showActionSheet({
                                                title: "选择操作",
                                                description:
                                                    "同一份 actions，两端只换壳",
                                                actions: SHEET_ACTIONS,
                                                onSelect: (action) => {
                                                    showToast(
                                                        `选中 ${String(action.name)}`,
                                                    );
                                                },
                                            })
                                        }
                                    >
                                        命令式 · 带标题
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            showActionSheet({
                                                actions: SHEET_ACTIONS,
                                                onSelect: (action) => {
                                                    showToast(
                                                        `选中 ${String(action.name)}`,
                                                    );
                                                },
                                                onCancel: () => showToast("已取消"),
                                            })
                                        }
                                    >
                                        命令式 · 无标题
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            showActionSheet({
                                                title: "没有取消按钮",
                                                actions: SHEET_ACTIONS.slice(0, 2),
                                                cancelText: false,
                                                closeOnClickOverlay: false,
                                            })
                                        }
                                    >
                                        无取消 + 点遮罩不关
                                    </Button>
                                    <Button
                                        type="danger"
                                        onClick={() =>
                                            showActionSheet({
                                                title: "异步动作",
                                                actions: [
                                                    {
                                                        name: "导出报表",
                                                        loading: true,
                                                        closeOnClick: false,
                                                    },
                                                    {
                                                        name: "删除记录",
                                                        color: "var(--bv-danger)",
                                                    },
                                                ],
                                                onSelect: (action) => {
                                                    showToast(
                                                        `选中 ${String(action.name)}`,
                                                    );
                                                },
                                            })
                                        }
                                    >
                                        loading 项（禁用）+ 危险色项
                                    </Button>
                                    <Button onClick={() => setSheetOpen(true)}>
                                        声明式（受控 open）
                                    </Button>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "底部弹层、项高 48px、取消按钮与列表分离、点遮罩/ESC 关闭"
                                        : "居中对话框纵向列表、项高 36px（桌面密度）"}
                                    。两端 props 完全一致，居中降级由 Popup 统一承担。
                                </p>
                            </Block>
    );
}
export function ActionSheetDemos() {
    return (
    <Section title="P1′ · ActionSheet 动作面板（模式 B：底部弹层 vs 居中对话框）">
                        <ActionSheetExample1 />
                    </Section>
        );
}