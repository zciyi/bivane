/**
 * DropdownMenu 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from './layout';
import { Icon } from '@/components/ui/icon';
import { DropdownMenu } from '@/components/responsive/dropdown-menu';
import type { MenuItem, MenuValue } from '@/hooks/use-menu-state';
import { showToast } from '@/components/responsive/toast';
import { useDeviceMode } from '@/hooks/use-device-mode';
const MENU_ITEMS: MenuItem[] = [
    {
        value: "edit",
        label: "编辑",
        shortcut: "⌘E",
        icon: <Icon name="check" />,
    },
    { value: "duplicate", label: "复制", shortcut: "⌘D" },
    { divider: true },
    {
        value: "move",
        label: "移动到",
        children: [
            { value: "folder-a", label: "项目文档" },
            { value: "folder-b", label: "归档" },
            {
                value: "more",
                label: "更多位置",
                children: [
                    { value: "deep-1", label: "共享盘" },
                    { value: "deep-2", label: "回收站" },
                ],
            },
        ],
    },
    {
        value: "delete",
        label: "删除",
        danger: true,
        icon: <Icon name="cross" />,
    },
    { value: "locked", label: "锁定项（禁用）", disabled: true },
];
/** DropdownMenu 的第 1 个示例 */
export function DropdownMenuExample1() {
    const [menuValue, setMenuValue] = React.useState<MenuValue>("folder-a");
    const mode = useDeviceMode();
    return (
        <Block className="flex flex-col gap-bv-gutter">
                                <Row>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <DropdownMenu
                                                ariaLabel="操作菜单"
                                                title="更多操作"
                                                trigger="更多操作"
                                                items={MENU_ITEMS}
                                                onSelect={(value) =>
                                                    showToast(`选中 ${value}`)
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            操作菜单 · 点选即执行
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <DropdownMenu
                                                ariaLabel="右对齐菜单"
                                                title="右对齐"
                                                placement="bottom-end"
                                                trigger="右对齐"
                                                closeOnSelect={false}
                                                items={MENU_ITEMS}
                                                onSelect={(value) =>
                                                    showToast(`连选：${value}`)
                                                }
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            右对齐 · 连选不关闭
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-bv-sm">
                                        <div className="w-[200px]">
                                            <DropdownMenu
                                                ariaLabel="禁用菜单"
                                                trigger="禁用状态"
                                                items={MENU_ITEMS}
                                                disabled
                                            />
                                        </div>
                                        <span className="text-bv-sm text-bv-text-3">
                                            禁用态
                                        </span>
                                    </div>
                                </Row>
                                <div className="flex items-center gap-bv-sm">
                                    <div className="w-[200px]">
                                        <DropdownMenu
                                            ariaLabel="位置"
                                            title="选择位置"
                                            trigger="选择位置"
                                            items={MENU_ITEMS}
                                            value={menuValue}
                                            onChange={(value) => setMenuValue(value)}
                                            confirmable
                                        />
                                    </div>
                                    <span className="text-bv-sm text-bv-text-3">
                                        可选值：选好后触发器回填层级路径而不是裸
                                        label（当前：{String(menuValue)}）； H5 传
                                        confirmable 走「暂存 → 确定」，PC 点选即生效
                                    </span>
                                </div>
                                <p className="text-bv-sm text-bv-text-2">
                                    当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                                    {mode === "mobile"
                                        ? "点开是底部抽屉（可按住指示条下拉关闭）；每一层头部都铺层级行（第一层是面板名「选择位置」，下钻后是「移动到 / 项目文档」整条链）——链上每一项都点得，点到哪一层就落回哪一层，点链首即回最上层；行高 48px，不显示快捷键提示；暂存模式下点叶子只打勾，「取消 · 确定」在头部"
                                        : "点开是锚定在触发器下方的浮层；悬停或按 → 展开子菜单（父层留在原地、保持高亮），↑↓ 巡航、Enter 执行、Esc 逐层收回；行高 36px，行尾显示 ⌘E / ⌘D；点选即生效，没有确定按钮"}
                                </p>
                                <p className="text-bv-sm text-bv-text-3">
                                    注：两端共享的是同一棵菜单树（use-menu-state
                                    的纯函数），不共享「怎么走这棵树」——
                                    移动端屏幕窄，子菜单只能替换当前视野（下钻 +
                                    头部层级链点名切层）；桌面端必须留着父层，
                                    否则「我从哪个菜单进来的」就丢了。最后一个示例传了
                                    value/onChange，组件按树中 value 匹配整条层级路径
                                    回填触发器（嵌套项显示成「移动到 / 项目文档」，
                                    顶层项就是一个
                                    label），行尾打勾；不传则是纯操作菜单（行尾不渲染勾）。
                                    快捷键提示只在 PC 渲染，这不是 props 泄露：prop
                                    两端都接受、值也一致，差异由模式决定。
                                </p>
                            </Block>
    );
}
export function DropdownMenuDemos() {
    return (
    <Section title="P2 · DropdownMenu 下拉菜单（模式 C：整层推入 vs 向右展开）">
                        <DropdownMenuExample1 />
                    </Section>
        );
}