/**
 * Tooltip 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/responsive/tooltip';
import { Ellipsis } from '@/components/ui/ellipsis';
import { useDeviceMode } from '@/hooks/use-device-mode';
/** Tooltip 的第 1 个示例 */
export function TooltipExample1() {
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <Tooltip content="删除后不可恢复，谨慎操作">
                                        <Button plain size="small">
                                            删除
                                        </Button>
                                    </Tooltip>
                                    <Tooltip content="收藏到我的清单（再次点击取消）">
                                        <Button plain size="small">
                                            收藏
                                        </Button>
                                    </Tooltip>
                                    <Tooltip
                                        content={
                                            <Ellipsis rows={2}>
                                                这是一条比较长的操作说明：开启后修改会实时同步给团队内所有成员，新成员加入时也会看到当前版本的全部历史记录，请确认后再继续。
                                            </Ellipsis>
                                        }
                                    >
                                        <Button plain size="small">
                                            长说明（H5 可展开）
                                        </Button>
                                    </Tooltip>
                                </Row>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "触屏没有 hover，说明直接常驻在主体下方（ⓘ 信息提示条，全文展示）；超长文案用 Ellipsis 截到 2 行并显示展开/收起"
                                        : "鼠标悬停 200ms 气泡弹出并跟随鼠标，移出即关；Tab 聚焦按钮立即弹出（气泡锚定元素），Esc 关闭；hover 与 focus 任一仍在都不会误关"}
                                </p>
                                <p className="text-bv-sm text-bv-text-3">
                                    同一段说明两端容器不同：H5 常驻提示条 / PC
                                    纯展示气泡（pointer-events:none、role=tooltip），均与主体
                                    aria-describedby 配对。
                                </p>
                            </Block>
    );
}
export function TooltipDemos() {
    return (
    <Section title="P2 · Tooltip 文字提示（H5 常驻 ⓘ 说明条 / PC hover·focus 浮层）">
                        <TooltipExample1 />
                    </Section>
        );
}