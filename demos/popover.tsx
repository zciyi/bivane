/**
 * Popover 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/responsive/popover';
import { showFailToast, showSuccessToast, showToast } from '@/components/responsive/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Popover 的第 1 个示例 */
export function PopoverExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Popover
                                        ariaLabel="更多操作"
                                        actions={[
                                            {
                                                key: "share",
                                                text: "分享",
                                                onClick: () =>
                                                    showSuccessToast("已分享"),
                                            },
                                            {
                                                key: "rename",
                                                text: "重命名",
                                                onClick: () => showToast("进入重命名"),
                                            },
                                            {
                                                key: "delete",
                                                text: "删除",
                                                danger: true,
                                                onClick: () => showFailToast("已删除"),
                                            },
                                        ]}
                                    >
                                        <Button plain size="small">
                                            3 个动作（气泡）
                                        </Button>
                                    </Popover>
                                    <Popover
                                        ariaLabel="批量操作"
                                        actions={[
                                            {
                                                key: "copy",
                                                text: "复制",
                                                onClick: () => showToast("已复制"),
                                            },
                                            {
                                                key: "move",
                                                text: "移动到",
                                                onClick: () => showToast("移动"),
                                            },
                                            {
                                                key: "top",
                                                text: "置顶",
                                                onClick: () => showToast("已置顶"),
                                            },
                                            {
                                                key: "archive",
                                                text: "归档",
                                                onClick: () => showToast("已归档"),
                                            },
                                            {
                                                key: "remove",
                                                text: "删除",
                                                danger: true,
                                                disabled: true,
                                                onClick: () =>
                                                    showFailToast("不会触发"),
                                            },
                                        ]}
                                    >
                                        <Button plain size="small">
                                            {mode === "mobile"
                                                ? "5 个动作（走抽屉）"
                                                : "5 个动作（浮层）"}
                                        </Button>
                                    </Popover>
                                    <Popover
                                        ariaLabel="同步说明"
                                        content="开启后，修改会实时同步给团队内所有成员。开启后，修改会实时同步给团队内所有成员。开启后，修改会实时同步给团队内所有成员。"
                                        actions={[
                                            {
                                                key: "ok",
                                                text: "我知道了",
                                                onClick: () => showSuccessToast("确认"),
                                            },
                                        ]}
                                        h5Form="drawer"
                                        closeOnClickAction={false}
                                    >
                                        <Button plain size="small">
                                            自定义内容 · 强制抽屉（点行不关）
                                        </Button>
                                    </Popover>
                                    <Popover
                                        ariaLabel="放宽行数阈值"
                                        maxRows={4}
                                        actions={[
                                            {
                                                key: "c1",
                                                text: "复制",
                                                onClick: () => showToast("已复制"),
                                            },
                                            {
                                                key: "c2",
                                                text: "转发",
                                                onClick: () => showToast("已转发"),
                                            },
                                            {
                                                key: "c3",
                                                text: "收藏",
                                                onClick: () => showToast("已收藏"),
                                            },
                                            {
                                                key: "c4",
                                                text: "置顶",
                                                onClick: () => showToast("已置顶"),
                                            },
                                        ]}
                                    >
                                        <Button plain size="small">
                                            4 个动作 · maxRows=4（仍气泡）
                                        </Button>
                                    </Popover>
                                    <Popover
                                        ariaLabel="放宽行数阈值"
                                        maxRows={4}
                                        actions={[
                                            {
                                                key: "c1",
                                                text: "复制",
                                                onClick: () => showToast("已复制"),
                                            },
                                            {
                                                key: "c2",
                                                text: "转发",
                                                onClick: () => showToast("已转发"),
                                            },
                                            {
                                                key: "c3",
                                                text: "收藏",
                                                onClick: () => showToast("已收藏"),
                                            },
                                            {
                                                key: "c4",
                                                text: "置顶",
                                                onClick: () => showToast("已置顶"),
                                            },
                                            {
                                                key: "c5",
                                                text: "举报",
                                                onClick: () => showToast("已举报"),
                                            },
                                        ]}
                                    >
                                        <Button plain size="small">
                                            5 个动作 · maxRows=4（H5 走抽屉）
                                        </Button>
                                    </Popover>
                                    <Popover
                                        ariaLabel="强制气泡"
                                        h5Form="bubble"
                                        // 限高由 --bv-popover-panel-max-height（默认 60vh）控制；
                                        // demo 单实例压到 200px（约 4 行），保证任意屏幕高度都能看到面板内滚动
                                        className="max-h-[200px]"
                                        actions={[
                                            {
                                                key: "b1",
                                                text: "菜单组 1",
                                                onClick: () => showToast("1"),
                                            },
                                            {
                                                key: "b2",
                                                text: "菜单组 2",
                                                onClick: () => showToast("2"),
                                            },
                                            {
                                                key: "b3",
                                                text: "菜单组 3",
                                                onClick: () => showToast("3"),
                                            },
                                            {
                                                key: "b4",
                                                text: "菜单组 4",
                                                onClick: () => showToast("4"),
                                            },
                                            {
                                                key: "b5",
                                                text: "菜单组 5",
                                                onClick: () => showToast("5"),
                                            },
                                            {
                                                key: "b6",
                                                text: "菜单组 6",
                                                onClick: () => showToast("6"),
                                            },
                                            {
                                                key: "b7",
                                                text: "菜单组 7",
                                                onClick: () => showToast("7"),
                                            },
                                            {
                                                key: "b8",
                                                text: "菜单组 8",
                                                onClick: () => showToast("8"),
                                            },
                                        ]}
                                    >
                                        <Button plain size="small">
                                            8 个动作 · 强制气泡（限高 200px 内滚动）
                                        </Button>
                                    </Popover>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "≤3 行是锚定触发器的轻量气泡（触屏不抢焦、点外部关），超过 3 行自动降级底部 Popup 抽屉（遮罩/安全区/滚动锁）；形态在打开瞬间按实测高度决定。分界行数可配：主题改 token --bv-popover-h5-bubble-max-rows，单实例传 maxRows；h5Form=bubble/drawer 可跳过规则强制形态。气泡滚动不看行数看高度：默认超过 60vh（--bv-popover-panel-max-height）才滚动，48px 行高下约第 9 行起；单实例可用 className（如 max-h-[200px]）压低限高"
                                        : "恒为 Radix 锚定浮层（翻转防溢出），打开后焦点落入面板，Tab 在动作行间循环，Esc 关闭并还焦触发器；行密度 36px；限高同为 60vh，maxRows / h5Form 仅 H5 生效，这里忽略"}
                                </p>
                            </Block>
    );
}
export function PopoverDemos() {
    return (
    <Section title="P2 · Popover 气泡菜单（H5 默认 ≤3 行气泡 / >3 行抽屉；阈值 maxRows、形态 h5Form 均可配）">
                        <PopoverExample1 />
                    </Section>
        );
}