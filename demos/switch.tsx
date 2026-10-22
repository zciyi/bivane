/**
 * Switch 组件的演示
 *
 * 与其它 demo 一样：验证台与文档站共用同一份。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Cell, CellGroup } from '@/components/ui/cell';
import { Switch } from '@/components/ui/switch';
import { showConfirmDialog } from '@/components/responsive/dialog';

/**
 * Switch 的第 1 个示例：各种形态（禁用 / 加载 / 自定义色）。
 *
 * ⚠ 这两个示例**共享同一份 notice 状态**（原本是同一个组件里的一个 useState）——
 *   「基础开关」和下面 Cell 里的「消息推送」是联动的。
 *   拆成两个组件后要保住这个联动：父组件持有状态，通过 props 传下来。
 *   props 是**可选**的 —— 文档站单独渲染某张示例卡片时不传，
 *   组件内部退化成各自独立持有（这时两者不联动，符合「一张卡片一个场景」的直觉）。
 */
export function SwitchExample1({
    notice: controlledNotice,
    setNotice: controlledSetNotice,
}: {
    notice?: boolean;
    setNotice?: (v: boolean) => void;
} = {}) {
    const [localNotice, setLocalNotice] = React.useState(true);
    const notice = controlledNotice ?? localNotice;
    const setNotice = controlledSetNotice ?? setLocalNotice;

    return (
        <Block>
            <Row>
                <Switch
                    checked={notice}
                    aria-label="基础开关"
                    onChange={(v) => setNotice(v === true)}
                />
                <span className="text-bv-text-2">
                    基础开关：{notice ? "开" : "关"}
                </span>
                <Switch disabled aria-label="禁用关" />
                <Switch defaultChecked disabled aria-label="禁用开" />
                <Switch loading aria-label="加载关" />
                <Switch loading defaultChecked aria-label="加载开" />
                <Switch
                    size={24}
                    activeColor="#07c160"
                    defaultChecked
                    aria-label="小尺寸绿色"
                />
                <Switch
                    size={36}
                    activeColor="#ee0a24"
                    inactiveColor="#ebedf0"
                    aria-label="大尺寸自定义色"
                />
            </Row>
        </Block>
    );
}

/**
 * Switch 的第 2 个示例：放进 Cell 行里（右侧开关）。
 *
 * notice / setNotice 由父组件传入 → 与第 1 个示例联动（验证台里是同一份状态）。
 */
export function SwitchExample2({
    notice: controlledNotice,
    setNotice: controlledSetNotice,
}: {
    notice?: boolean;
    setNotice?: (v: boolean) => void;
} = {}) {
    const [localNotice, setLocalNotice] = React.useState(true);
    const notice = controlledNotice ?? localNotice;
    const setNotice = controlledSetNotice ?? setLocalNotice;

    const [digest, setDigest] = React.useState(false);
    const [enumValue, setEnumValue] = React.useState<"yes" | "no">("no");

    return (
        <Block className="p-0">
            <CellGroup inset className="mx-0">
                <Cell
                    center
                    title="消息推送"
                    rightIcon={
                        <Switch
                            checked={notice}
                            aria-label="消息推送"
                            onChange={(v) => setNotice(v === true)}
                        />
                    }
                />
                <Cell
                    center
                    title="每日摘要（禁用）"
                    rightIcon={<Switch disabled aria-label="每日摘要" />}
                />
                <Cell
                    center
                    title="开启前二次确认"
                    rightIcon={
                        <Switch
                            checked={digest}
                            aria-label="开启前二次确认"
                            onChange={(v) => setDigest(v === true)}
                            beforeChange={() =>
                                new Promise<boolean>((resolve) => {
                                    showConfirmDialog({
                                        title: "开启每日摘要？",
                                        message:
                                            "开启后每天 9:00 推送一次，等待期间开关显示 loading。",
                                        confirmText: "开启",
                                        cancelText: "取消",
                                        onConfirm: () => resolve(true),
                                        onCancel: () => resolve(false),
                                    });
                                })
                            }
                        />
                    }
                />
                <Cell
                    center
                    title={`枚举值开关（当前 ${enumValue}）`}
                    rightIcon={
                        <Switch
                            value={enumValue}
                            activeValue="yes"
                            inactiveValue="no"
                            aria-label="枚举值开关"
                            onChange={(v) =>
                                setEnumValue(v as "yes" | "no")
                            }
                        />
                    }
                />
            </CellGroup>
        </Block>
    );
}

export function SwitchDemos() {
    // 共享状态：两个示例里的「基础开关」与「消息推送」联动
    const [notice, setNotice] = React.useState(true);

    return (
        <Section title="P3 · Switch 开关（模式 A：两端同视觉，PC 多键盘焦点环）">
            <SwitchExample1 notice={notice} setNotice={setNotice} />
            <SwitchExample2 notice={notice} setNotice={setNotice} />
        </Section>
    );
}
