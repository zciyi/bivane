import * as React from "react";
import { ResponsiveProvider } from "@/components/providers/responsive-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cell, CellGroup } from "@/components/ui/cell";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Tag } from "@/components/ui/tag";
import { useDeviceMode, useDeviceModeAttrs } from "@/hooks/use-device-mode";
import {
    Dialog,
    DialogHost,
    showAlertDialog,
    showConfirmDialog,
    showDialog,
} from "@/components/responsive/dialog";
import { Popup, type PopupPosition } from "@/components/responsive/popup";
import { Select } from "@/components/responsive/select";
import type { SelectItem } from "@/hooks/use-select-state";
import { DropdownMenu } from "@/components/responsive/dropdown-menu";
import { DatePicker } from "@/components/responsive/date-picker";
import { TimePicker } from "@/components/responsive/time-picker";
import { DateTimePicker } from "@/components/responsive/datetime-picker";
import { Tooltip } from "@/components/responsive/tooltip";
import { Ellipsis } from "@/components/ui/ellipsis";
import { Popover } from "@/components/responsive/popover";
import type { MenuItem, MenuValue } from "@/hooks/use-menu-state";
import {
    ToastHost,
    closeToast,
    showFailToast,
    showLoadingToast,
    showSuccessToast,
    showToast,
} from "@/components/responsive/toast";
import {
    Loading,
    LoadingHost,
    hideLoading,
    showLoading,
    updateLoading,
} from "@/components/responsive/loading";
import {
    NotifyHost,
    closeNotify,
    showNotify,
} from "@/components/responsive/notify";
import {
    ActionSheet,
    ActionSheetHost,
    showActionSheet,
    type ActionSheetAction,
} from "@/components/responsive/action-sheet";

/**
 * P0/P1 验证台
 * 用途：人工核对 Vant 视觉保真度 + 验证模式判定机制（缩放窗口 / 开 DevTools 设备模拟）
 *
 * 间距说明：本页只使用「页面级节奏」token（gap-bv-gutter / py-bv-block / mb-bv-section），
 * 组件内部间距一律交给组件自己的 Vant token，页面不越权。
 *
 * P1 验证重点：弹出层在两端是**不同的物理形态**，拖窗口跨过 768px 再点同一颗按钮即可对比。
 */

function ModeIndicator() {
    const mode = useDeviceMode();
    const [width, setWidth] = React.useState(() =>
        typeof window === "undefined" ? 0 : window.innerWidth,
    );

    React.useEffect(() => {
        const onResize = () => setWidth(window.innerWidth);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const isTouch =
        typeof window !== "undefined" &&
        window.matchMedia("(pointer: coarse)").matches;

    return (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-bv-gutter border-b border-bv-border bg-bv-surface px-bv-md py-bv-sm text-bv-sm">
            <span className="font-bv-bold">Bivane P0 验证台</span>
            <span
                data-testid="mode"
                className={cn(
                    "rounded-bv-sm px-bv-xs py-[2px] text-bv-white",
                    mode === "mobile" ? "bg-bv-primary" : "bg-bv-success",
                )}
            >
                {mode === "mobile" ? "H5 交互" : "PC 交互"}
            </span>
            <span className="text-bv-text-2">
                视口 {width}px · 触屏 {isTouch ? "是" : "否"} · 断点 768px
            </span>
        </div>
    );
}

/** 区块：标题与内容同一条左基准线（都取 16px 定宽内边距） */
function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="mb-bv-section">
            <h2 className="mb-bv-sm px-bv-md text-bv-sm text-bv-text-2">
                {title}
            </h2>
            {children}
        </section>
    );
}

/** 内容块：纵向内边距随模式放宽（H5 16 / PC 24），横向恒为 16 以对齐标题 */
function Block({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("bg-bv-surface px-bv-md py-bv-block", className)}>
            {children}
        </div>
    );
}

/** 一行组件：行内间距随模式变化（H5 8 / PC 12） */
function Row({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-bv-gutter",
                className,
            )}
        >
            {children}
        </div>
    );
}

/** 间距刻度表：用于肉眼核对 token 是否真的生效 */
const SPACING_SCALE = [
    { name: "base", value: "4px", bar: "w-bv-base", scope: "组件" },
    { name: "xs", value: "8px", bar: "w-bv-xs", scope: "组件 / H5 行内" },
    { name: "sm", value: "12px", bar: "w-bv-sm", scope: "组件 / PC 行内" },
    { name: "md", value: "16px", bar: "w-bv-md", scope: "横向基准 / H5 区块" },
    { name: "lg", value: "24px", bar: "w-bv-lg", scope: "PC 区块 / H5 区块间" },
    { name: "xl", value: "32px", bar: "w-bv-xl", scope: "PC 区块间" },
] as const;

/** 12 个选项：故意超过 10，用来验证 H5「选项 > 10 才给搜索框」的阈值 */
const CITY_OPTIONS: SelectItem[] = [
    { label: "北京", value: "bj" },
    { label: "上海", value: "sh" },
    { label: "广州", value: "gz" },
    { label: "深圳", value: "sz" },
    { label: "杭州", value: "hz" },
    { label: "成都", value: "cd", disabled: true },
    { label: "武汉", value: "wh" },
    { label: "西安", value: "xa" },
    { label: "南京", value: "nj" },
    { label: "重庆", value: "cq" },
    { label: "长沙", value: "cs" },
    { label: "青岛", value: "qd" },
];

const GROUPED_CITY_OPTIONS: SelectItem[] = [
    {
        group: "华北",
        options: [
            { label: "北京", value: "bj" },
            { label: "天津", value: "tj" },
        ],
    },
    {
        group: "华东",
        options: [
            { label: "上海", value: "sh" },
            { label: "杭州", value: "hz" },
        ],
    },
];

/**
 * 菜单树：刻意同时包含「叶子项 / 二级菜单 / 分隔线 / 危险项 / 禁用项 / 快捷键」六种形态，
 * 否则两端的差异（推入 vs 右展、48 vs 36、有没有 kbd）在验证台上根本触发不到。
 */
/** ActionSheet 示例动作：刻意混入副文案 / 禁用 / 危险色，验证行内三种状态在两端的表现 */
const SHEET_ACTIONS: ActionSheetAction[] = [
    { name: "分享给好友" },
    { name: "复制链接", subname: "有效期 7 天" },
    { name: "置顶（禁用）", disabled: true },
    { name: "删除", color: "var(--bv-danger)" },
];

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

function Playground() {
    const [loading, setLoading] = React.useState(false);
    const modeAttrs = useDeviceModeAttrs();
    const mode = useDeviceMode();

    // P1 演示状态
    // long：示例内容拉长到超过 --bv-popup-max-height，用于验证「封顶 + 内部滚动」
    // （8 行 Cell 只有 ~384px，永远撑不到 90vh，不拉长就测不到这条规则）
    const [popup, setPopup] = React.useState<{
        open: boolean;
        position: PopupPosition;
        long: boolean;
    }>({
        open: false,
        position: "bottom",
        long: false,
    });
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [longDialogOpen, setLongDialogOpen] = React.useState(false);

    // P1′ 反馈组件示例状态（声明式那一轨的受控开关）
    const [loadingOpen, setLoadingOpen] = React.useState(false);
    const [sheetOpen, setSheetOpen] = React.useState(false);

    // P2 DropdownMenu「可选值」示例的受控值：默认取**嵌套**叶子，
    // 好让「触发器回填完整层级路径」这条行为在页面上直接看得见
    const [menuValue, setMenuValue] = React.useState<MenuValue>("folder-a");

    // P2 DateTimePicker 区间示例：组件只做单值，区间 = 两个实例互相约束
    // （开始 max=结束、结束 min=开始），跨字段夹紧保证两端始终有序
    const [rangeStart, setRangeStart] = React.useState<string | undefined>();
    const [rangeEnd, setRangeEnd] = React.useState<string | undefined>();

    // P2 min/max 边界约束演示：受控值 + 实时回显，方便直接看「选不出去 / 被夹回」
    const [demoDate, setDemoDate] = React.useState<string | undefined>();
    const [demoTime, setDemoTime] = React.useState<string | undefined>();
    const [demoDateTime, setDemoDateTime] = React.useState<
        string | undefined
    >();

    const openPopup = (position: PopupPosition, long = false) =>
        setPopup({ open: true, position, long });

    return (
        <div
            {...modeAttrs}
            className="mx-auto min-h-screen max-w-[1100px] bg-bv-muted pb-bv-xl"
        >
            <ModeIndicator />

            <div className="pt-bv-lg">
                <Section title="Button 按钮类型">
                    <Block>
                        <Row>
                            <Button>默认</Button>
                            <Button type="primary">主要</Button>
                            <Button type="success">成功</Button>
                            <Button type="danger">危险</Button>
                            <Button type="warning">警告</Button>
                            <Button type="primary" plain>
                                朴素
                            </Button>
                            <Button type="primary" hairline>
                                细边框
                            </Button>
                            <Button round type="primary">
                                圆角
                            </Button>
                            <Button square type="primary">
                                直角
                            </Button>
                            <Button disabled>禁用</Button>
                            <Button
                                type="primary"
                                loading={loading}
                                loadingText="处理中"
                                onClick={() => {
                                    setLoading(true);
                                    setTimeout(() => setLoading(false), 1500);
                                }}
                            >
                                点击加载
                            </Button>
                        </Row>
                    </Block>
                </Section>

                <Section title="Button 尺寸">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <Button size="normal" type="primary">
                                normal（默认）
                            </Button>
                            <Button size="small" type="primary">
                                small
                            </Button>
                            <Button size="mini" type="primary">
                                mini
                            </Button>
                            <Button
                                size="normal"
                                icon={<Icon name="success" />}
                                type="success"
                            >
                                带图标
                            </Button>
                        </Row>
                        <Button size="large" type="primary">
                            large（宽度 100%）
                        </Button>
                        <Button
                            block
                            type="success"
                            icon={<Icon name="success" />}
                        >
                            block + 图标
                        </Button>
                    </Block>
                </Section>

                <Section title="Cell 单元格（分组）">
                    <CellGroup title="带标题的分组">
                        <Cell title="普通行" value="内容" />
                        <Cell title="大号行" large value="18px 标题" />
                        <Cell title="居中" center value="垂直居中" />
                        <Cell
                            title="无下边框"
                            border={false}
                            value="最后一行"
                        />
                    </CellGroup>
                </Section>

                <Section title="Cell 单元格（卡片 inset）">
                    <div className="px-bv-md">
                        {/* inset 卡片默认带 16px 外边距，这里用 className 归零，让卡片与页面基准线对齐 */}
                        <CellGroup inset className="mx-0">
                            <Cell title="单元格" value="内容" />
                            <Cell
                                title="带描述"
                                label="描述信息描述信息"
                                value="内容"
                            />
                            <Cell
                                title="链接项"
                                isLink
                                onClick={() => undefined}
                            />
                            <Cell
                                title="必填项"
                                required
                                value={
                                    <Tag type="primary" size="medium">
                                        标签
                                    </Tag>
                                }
                            />
                            <Cell
                                title="自定义图标"
                                icon={<Icon name="info" size={16} />}
                                value={<Badge content={5} />}
                            />
                        </CellGroup>
                    </div>
                </Section>

                <Section title="Tag / Badge">
                    <Block>
                        <Row>
                            <Tag>默认</Tag>
                            <Tag type="primary">主要</Tag>
                            <Tag type="success">成功</Tag>
                            <Tag type="danger">危险</Tag>
                            <Tag type="warning">警告</Tag>
                            <Tag type="primary" plain>
                                朴素
                            </Tag>
                            <Tag type="primary" round>
                                圆角
                            </Tag>
                            <Tag type="primary" mark>
                                标记
                            </Tag>
                            <Tag size="large" type="success">
                                大号
                            </Tag>
                            <Tag
                                type="danger"
                                closeable
                                onClose={() => undefined}
                            >
                                可关闭
                            </Tag>
                            <Badge content={5} />
                            <Badge content={100} />
                            <Badge content={100} max={999} />
                            <Badge dot />
                            <Badge content={12}>
                                <span className="inline-block rounded-bv-md bg-bv-muted px-bv-md py-bv-xs">
                                    消息
                                </span>
                            </Badge>
                        </Row>
                    </Block>
                </Section>

                <Section title="间距刻度（H5 紧凑 → PC 放宽，仅页面级）">
                    <Block className="flex flex-col gap-bv-sm">
                        {SPACING_SCALE.map((step) => (
                            <div
                                key={step.name}
                                className="flex items-center text-bv-sm"
                            >
                                <span className="w-[52px] text-bv-text-2">
                                    {step.name}
                                </span>
                                <span
                                    className={cn(
                                        "h-bv-sm rounded-bv-sm bg-bv-primary",
                                        step.bar,
                                    )}
                                />
                                <span className="ml-bv-sm text-bv-text-2">
                                    {step.value}
                                </span>
                                <span className="ml-bv-sm text-bv-text-3">
                                    {step.scope}
                                </span>
                            </div>
                        ))}
                        <div className="mt-bv-xs flex items-center border-t border-bv-border pt-bv-md text-bv-sm">
                            <span className="w-[52px] text-bv-text-2">
                                gutter
                            </span>
                            <span className="h-bv-sm w-bv-gutter rounded-bv-sm bg-bv-success" />
                            <span className="ml-bv-sm text-bv-text-2">
                                行内
                            </span>
                            <span className="w-[120px]" />
                            <span className="w-[52px] text-bv-text-2">
                                block
                            </span>
                            <span className="h-bv-sm w-bv-block rounded-bv-sm bg-bv-success" />
                            <span className="ml-bv-sm text-bv-text-2">
                                区块内边距
                            </span>
                        </div>
                    </Block>
                </Section>

                <Section title="深色主题（容器级切换）">
                    <div className="bv-theme-dark bg-bv-background px-bv-md py-bv-block">
                        <Row>
                            <Button>默认</Button>
                            <Button type="primary">主要</Button>
                            <Button type="primary" plain>
                                朴素
                            </Button>
                            <Tag type="primary">标签</Tag>
                            <Badge content={9}>
                                <span className="inline-block bg-bv-surface px-bv-md py-bv-xs">
                                    消息
                                </span>
                            </Badge>
                        </Row>
                        <div className="mt-bv-md">
                            <CellGroup>
                                <Cell title="深色单元格" value="内容" isLink />
                                <Cell
                                    title="深色分组标题"
                                    label="label 走 text-2"
                                    value="值"
                                />
                            </CellGroup>
                        </div>
                    </div>
                </Section>

                <Section title="P1 · Popup 弹层（模式 B：同一 primitive 换壳）">
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
                </Section>

                <Section title="P1 · Dialog 对话框（模式 B + 双轨 API）">
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
                </Section>

                <Section title="P1 · Toast 轻提示（模式 C：两种形态本质不同）">
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
                </Section>

                <Section title="P1′ · Loading 加载（模式 A：两端同形态，仅遮罩浓度不同）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <Button
                                type="primary"
                                onClick={() => {
                                    const handle = showLoading({
                                        text: "加载中",
                                        forbidClick: true,
                                    });
                                    setTimeout(
                                        () => hideLoading(handle.id),
                                        1500,
                                    );
                                }}
                            >
                                命令式 · 1.5s 后关闭
                            </Button>
                            <Button
                                onClick={() => {
                                    const handle = showLoading({
                                        text: "步骤 1/3",
                                    });
                                    setTimeout(
                                        () =>
                                            updateLoading(handle.id, {
                                                text: "步骤 2/3",
                                            }),
                                        700,
                                    );
                                    setTimeout(
                                        () =>
                                            updateLoading(handle.id, {
                                                text: "步骤 3/3",
                                            }),
                                        1400,
                                    );
                                    setTimeout(
                                        () => hideLoading(handle.id),
                                        2100,
                                    );
                                }}
                            >
                                动态改文案
                            </Button>
                            <Button
                                onClick={() => showLoading({ duration: 1200 })}
                            >
                                无文案 · 1.2s 自关
                            </Button>
                            <Button
                                onClick={() => {
                                    setLoadingOpen(true);
                                    setTimeout(
                                        () => setLoadingOpen(false),
                                        2000,
                                    );
                                }}
                            >
                                声明式 · 2s 后自关
                            </Button>
                            <Button type="danger" onClick={() => hideLoading()}>
                                关闭全部
                            </Button>
                        </Row>
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            两端都是全屏遮罩 + 居中转圈，差异只有遮罩浓度（H5 .7
                            / PC .45，由 bg-bv-overlay 的模式覆盖给出）。
                            默认常驻，必须显式 hideLoading(id) 或给 duration；
                            forbidClick 默认 false（对齐 Vant，不阻断下层），传
                            true 才吃事件。
                        </p>
                    </Block>
                </Section>

                <Section title="P1′ · Notify 消息通知（模式 C：顶部横幅 vs 右上角角标）">
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
                </Section>

                <Section title="P1′ · ActionSheet 动作面板（模式 B：底部弹层 vs 居中对话框）">
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
                </Section>

                <Section title="P1′ · Alert / Confirm（复用 Dialog 底座）">
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
                </Section>

                <Section title="P2 · Select 选择器（模式 C：两套交互范式，不是换壳）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <Select
                                        ariaLabel="城市"
                                        placeholder="请选择城市"
                                        options={CITY_OPTIONS}
                                        onChange={(value) =>
                                            showToast(`选中 ${String(value)}`)
                                        }
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    单选 · 点选即生效
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <Select
                                        ariaLabel="多选城市"
                                        placeholder="请选择城市"
                                        multiple
                                        clearable
                                        options={CITY_OPTIONS}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    多选 · 可清除
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <Select
                                        ariaLabel="搜索城市"
                                        placeholder="请选择城市"
                                        searchable
                                        clearable
                                        options={CITY_OPTIONS}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    输入过滤（H5 需选项 &gt; 10 才出搜索框）
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <Select
                                        ariaLabel="禁用选择器"
                                        placeholder="请选择城市"
                                        disabled
                                        options={CITY_OPTIONS}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    禁用态
                                </span>
                            </div>
                        </Row>
                        <div className="flex items-center gap-bv-sm">
                            <div className="w-[240px]">
                                <Select
                                    ariaLabel="分组城市"
                                    placeholder="请选择城市"
                                    searchable
                                    options={GROUPED_CITY_OPTIONS}
                                />
                            </div>
                            <span className="text-bv-sm text-bv-text-3">
                                分组 + 过滤
                            </span>
                        </div>
                        <div className="flex items-center gap-bv-sm">
                            <div className="w-[240px]">
                                <Select
                                    ariaLabel="暂存确认城市"
                                    title="选择城市"
                                    placeholder="请选择城市"
                                    confirmable
                                    options={CITY_OPTIONS}
                                    onChange={(value) =>
                                        showToast(`确定：${String(value)}`)
                                    }
                                />
                            </div>
                            <span className="text-bv-sm text-bv-text-3">
                                H5 暂存确认：面板带「取消 · 标题 ·
                                确定」，点选项只打勾，点确定才回填
                            </span>
                        </div>
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            {mode === "mobile"
                                ? "点开是底部弹层列表（项高 48px、可按住顶部指示条下拉关闭），选项 > 10 才出现搜索框；默认点选即关，传 confirmable 走「暂存 → 确定」"
                                : "点开是锚定在触发器下方的浮层，↑↓ 巡航（自动跳过禁用项）、Enter 选中、Home/End 首尾、Esc 关闭、输入即过滤，多选保持展开；PC 恒为点选即生效，没有确定这一步"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：同一个 searchable prop，H5 在选项 ≤ 10
                            时不渲染搜索框（触屏主路径是点选），PC 只要
                            searchable 就给（桌面端输入过滤是主路径）；行高 48px
                            vs 36px 同理。这是矩阵对两种交互的定义差异，不是
                            props 泄露 ——
                            值语义（单选取代、多选翻转、多选不关闭）两端完全一致；「取消
                            / 确定」工具栏只出现在 H5（触屏误点有退路），PC
                            不需要。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · DropdownMenu 下拉菜单（模式 C：整层推入 vs 向右展开）">
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
                </Section>

                <Section title="P2 · DatePicker 日期选择（模式 C：滚轮 vs 月历）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <DatePicker
                                        ariaLabel="日期"
                                        title="选择日期"
                                        placeholder="请选择日期"
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    单值 · 可输入（仅 PC）
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <DatePicker
                                        ariaLabel="日期区间"
                                        title="选择日期区间"
                                        placeholder="请选择区间"
                                        type="range"
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    区间 · 可清除
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <DatePicker
                                        ariaLabel="年月"
                                        title="选择年月"
                                        placeholder="请选择年月"
                                        columnsType={["year", "month"]}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    年月面板 · 回填 YYYY-MM
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[160px]">
                                    <DatePicker
                                        ariaLabel="年份"
                                        title="选择年份"
                                        placeholder="请选择年份"
                                        columnsType={["year"]}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    年份面板 · 回填 YYYY
                                </span>
                            </div>
                        </Row>
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            {mode === "mobile"
                                ? "点开是底部弹层，三列滚轮（年/月/日）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」；区间模式在工具条下方多一条「开始日期 / 结束日期」切换，滚轮改的是当前那一端，两端都选上「确定」才可用"
                                : "点开是锚定触发器下方的选择浮层；年月配置显示双年月份面板，完整日期显示月历；↑↓←→ 巡航、Enter 选中、Esc 关闭；输入框与 onChange 都按 columnsType 回填 YYYY / YYYY-MM / YYYY-MM-DD 等对应格式；区间模式第一下点起点、第二下点终点"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：两端共享的是同一份日期值逻辑（use-date-value
                            的解析/格式化/min-max
                            逐字段夹紧/区间排序），不共享「怎么选」——
                            滚轮是「连续滚动 + 吸附」，月历是「二维网格 +
                            焦点巡航」，共同点只有「都是日期」，这正是它归属模式
                            C 而不是 B 的理由。值恒为 'YYYY-MM-DD'
                            字符串（区间是有序元组），与 Vant 一致、也避开 Date
                            的时区问题；默认可选范围是今天前后各 10
                            年，外部传进来的值若在范围外会自动把范围放大到包含它，
                            而不是把已选值夹走。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · TimePicker 时间选择（两端同一套滚轮，只换外壳）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <TimePicker
                                        ariaLabel="时间"
                                        title="选择时间"
                                        placeholder="请选择时间"
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    单值 · 预填现在
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <TimePicker
                                        ariaLabel="时间区间"
                                        title="选择时间区间"
                                        placeholder="请选择区间"
                                        type="range"
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    区间 · 可清除
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[160px]">
                                    <TimePicker
                                        ariaLabel="时分"
                                        title="选择时分"
                                        placeholder="请选择时分"
                                        columnsType={["hour", "minute"]}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    时分面板 · 回填 HH:mm
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[160px]">
                                    <TimePicker
                                        ariaLabel="禁用时间"
                                        placeholder="请选择时间"
                                        disabled
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    禁用态
                                </span>
                            </div>
                        </Row>
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            {mode === "mobile"
                                ? "点开是底部弹层，三列拖拽滚轮（时/分/秒）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」；区间模式在工具条下方多一条「开始时间 / 结束时间」切换，滚轮改的是当前那一端，两端都选上「确定」才可用"
                                : "点开是锚定触发器下方的浮层，壳里是同一套三列滚轮（同 5 行制、同吸附、同中央高亮带），底部「取消 / 确定」条；单值也要点「确定」才生效（滚轮要三列都调好才算选完）；键盘 ←→ 换列（点亮该列高亮带）、↑↓ 改值、Home/End 首尾、Enter 确定、Esc 关闭；区间用「开始时间 / 结束时间」两个 tab 手动切换在改哪一端，结束 ≤ 开始时「确定」禁用并提示"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：两端共享的是同一份时间值逻辑（use-time-value
                            的解析/格式化/min-max
                            逐字段夹紧/区间排序），也共享同一个滚轮行
                            primitive（time-parts 的 TimeWheelRow）—— 同一个
                            primitive 换个壳两端都成立，所以它归属模式 B 而不是
                            C（与 DatePicker 同族）。 值恒为 'HH:mm:ss'
                            字符串（区间是有序元组），避开 Date
                            的时区问题；单值形态的草稿预填「现在」而不是
                            '00:00:00'（时间选择器的主路径是未选，停在午夜每次都要滚回当前时刻）。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · DateTimePicker 日期时间选择（年月日时 / 时分 / 时分秒）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <DateTimePicker
                                        ariaLabel="年月日时"
                                        title="选择年月日时"
                                        placeholder="年-月-日 时"
                                        columnsType={[
                                            "year",
                                            "month",
                                            "day",
                                            "hour",
                                        ]}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    年月日时 · 4 列滚轮 · 回填 YYYY-MM-DD HH
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[240px]">
                                    <DateTimePicker
                                        ariaLabel="年月日时分"
                                        title="选择年月日时分"
                                        placeholder="年-月-日 时:分"
                                        columnsType={[
                                            "year",
                                            "month",
                                            "day",
                                            "hour",
                                            "minute",
                                        ]}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    年月日时分 · 5 列 · YYYY-MM-DD HH:mm
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[260px]">
                                    <DateTimePicker
                                        ariaLabel="年月日时分秒"
                                        title="选择年月日时分秒"
                                        placeholder="年-月-日 时:分:秒"
                                        min="2026-01-01 00:00:00"
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    默认 6 列 · 精确到秒 · min 约束
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <DateTimePicker
                                        ariaLabel="禁用日期时间"
                                        placeholder="请选择日期时间"
                                        disabled
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    禁用态
                                </span>
                            </div>
                        </Row>
                        <Row>
                            <div className="flex flex-wrap items-center gap-bv-sm">
                                <div className="w-[260px]">
                                    <DateTimePicker
                                        ariaLabel="区间开始时间"
                                        title="选择开始时间"
                                        placeholder="开始时间"
                                        value={rangeStart}
                                        max={rangeEnd}
                                        onChange={setRangeStart}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    至
                                </span>
                                <div className="w-[260px]">
                                    <DateTimePicker
                                        ariaLabel="区间结束时间"
                                        title="选择结束时间"
                                        placeholder="结束时间"
                                        value={rangeEnd}
                                        min={rangeStart}
                                        onChange={setRangeEnd}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    区间 · 两个单值实例互相约束（开始
                                    max=结束，结束 min=开始，两端自动有序）
                                </span>
                            </div>
                        </Row>
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            {mode === "mobile"
                                ? "底部弹层，4/5/6 列滚轮（年/月/日/时/分/秒）惯性滚动 + 吸附对齐，顶部「取消 · 标题 · 确定」，列再多也是通栏均宽"
                                : "锚定浮层：左侧月历（« < 年月 > » 翻年翻月 + 6×7 网格，今天描边）选日期，右侧时/分/秒 1~3 条居中滚轮列（选中行在正中、上下发丝线），列顶/列尾有 ▲▼，点一下 ±1、按住连发；顶部回显草稿时间，底部「此刻 / 确定」。键盘在月历区 ←→ 走天、↑↓ 走周、PgUp/PgDn 走月，点时间列后 ↑↓ 改值、←→ 换列，Enter 确定、Esc 关闭"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            单值组件（对齐 Vant DatetimePicker）：值恒为
                            'YYYY-MM-DD HH[:mm[:ss]]' 字符串，避开 Date
                            时区问题； min/max 是完整时刻边界（min 当天的时列从
                            min
                            时刻起，逐字段级联夹紧，不会一下跳回整个边界时刻）；
                            无值草稿播种「此刻」而不是元旦午夜。日期段两端范式不同
                            （H5 滚轮 / PC
                            月历），时间段共用同一滚轮列，归属模式 C。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · min/max 边界约束（Date / Time / DateTime）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <p className="text-bv-sm text-bv-text-2">
                            闭区间（含端点）。滚轮列按边界「逐字段级联收窄」：只有压在边界的那一级才裁剪；
                            PC
                            月历禁用越界日；越界输入/选中会被夹回范围内。拖动窗口跨过
                            768px 可对比 H5 滚轮 / PC 月历两种拦截形态。
                        </p>
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[240px]">
                                    <DatePicker
                                        ariaLabel="日期 min/max"
                                        title="日期范围约束"
                                        placeholder="09-20 ~ 10-05"
                                        min="2026-09-20"
                                        max="2026-10-05"
                                        value={demoDate}
                                        onChange={(value) =>
                                            setDemoDate(
                                                typeof value === "string"
                                                    ? value
                                                    : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    选中：{demoDate ?? "未选"}
                                </span>
                            </div>
                        </Row>
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[240px]">
                                    <TimePicker
                                        ariaLabel="时间 min/max"
                                        title="时间范围约束"
                                        placeholder="09:30 ~ 18:00"
                                        min="09:30:00"
                                        max="18:00:00"
                                        value={demoTime}
                                        onChange={(value) =>
                                            setDemoTime(
                                                typeof value === "string"
                                                    ? value
                                                    : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    小时列从 9 起、仅 9 点时分钟从 30 起；选中：
                                    {demoTime ?? "未选"}
                                </span>
                            </div>
                        </Row>
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[280px]">
                                    <DateTimePicker
                                        ariaLabel="日期时间 min/max"
                                        title="日期时间范围约束"
                                        placeholder="09-24 09:00 ~ 17:30"
                                        min="2026-09-24 09:00:00"
                                        max="2026-09-24 17:30:00"
                                        value={demoDateTime}
                                        onChange={(value) =>
                                            setDemoDateTime(
                                                typeof value === "string"
                                                    ? value
                                                    : undefined,
                                            )
                                        }
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    锁在 09-24 当天、时间窗 09:00~17:30；选中：
                                    {demoDateTime ?? "未选"}
                                </span>
                            </div>
                        </Row>
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[300px]">
                                    <DateTimePicker
                                        ariaLabel="min 带时间截断"
                                        title="min 带时间 → 跨天截断"
                                        placeholder="09-24 14:00 起 ~ 09-25 09:00"
                                        min="2026-09-24 14:00:00"
                                        max="2026-09-25 09:00:00"
                                        columnsType={[
                                            "year",
                                            "month",
                                            "day",
                                            "hour",
                                            "minute",
                                        ]}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    24 号时列从 14 起、25 号时列到 09
                                    止（逐字段级联）
                                </span>
                            </div>
                        </Row>
                    </Block>
                </Section>

                <Section title="P2 · Tooltip 文字提示（H5 常驻 ⓘ 说明条 / PC hover·focus 浮层）">
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
                </Section>

                <Section title="P2 · Popover 气泡菜单（H5 默认 ≤3 行气泡 / >3 行抽屉；阈值 maxRows、形态 h5Form 均可配）">
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
                </Section>

                {/* ---------- P1 弹层实例（都通过 portal 渲染到 body） ---------- */}

                <Popup
                    open={popup.open}
                    position={popup.position}
                    onOpenChange={(next) =>
                        setPopup((prev) => ({ ...prev, open: next }))
                    }
                    closeable
                    aria-label="示例弹层"
                >
                    <div className="px-bv-md pb-bv-md pt-bv-xs">
                        <p className="mb-bv-sm text-bv-lg font-bv-bold text-bv-text">
                            {popup.position} 弹层
                        </p>
                        <p className="mb-bv-md text-bv-sm text-bv-text-2">
                            实际形态：
                            <span
                                data-testid="resolved-position"
                                className="text-bv-primary"
                            >
                                {mode === "mobile"
                                    ? popup.position
                                    : "center（PC 降级）"}
                            </span>
                            。
                            {mode === "mobile"
                                ? "试试按住顶部指示条往下拖。"
                                : "试试按 ESC 或点遮罩。"}
                        </p>
                        <CellGroup inset className="mx-0">
                            {Array.from(
                                { length: popup.long ? 40 : 8 },
                                (_, index) => (
                                    <Cell
                                        key={index}
                                        title={`列表项 ${index + 1}`}
                                        value={index % 2 === 0 ? "内容" : ""}
                                        isLink={index % 2 === 1}
                                    />
                                ),
                            )}
                        </CellGroup>
                    </div>
                </Popup>

                <Dialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    title="声明式对话框"
                    message="同一份 props 与内容，H5 渲染为底部抽屉、PC 渲染为居中模态。"
                    showCancelButton
                    confirmText="好的"
                    cancelText="取消"
                    onConfirm={() => showSuccessToast("已确认")}
                    onCancel={() => showToast("已取消")}
                />

                <Dialog
                    open={longDialogOpen}
                    onOpenChange={setLongDialogOpen}
                    title="长内容对话框"
                    showCancelButton
                    confirmText="我知道了"
                >
                    <div className="max-h-[50vh] overflow-y-auto text-left">
                        {Array.from({ length: 24 }, (_, index) => (
                            <p
                                key={index}
                                className="mb-bv-sm text-bv-md text-bv-text-2"
                            >
                                第 {index + 1} 段：正文超出
                                --bv-dialog-message-max-height 后内部滚动，
                                而按钮区固定在底部（H5 下靠 scrollable=false +
                                正文自身滚动实现）。
                            </p>
                        ))}
                    </div>
                </Dialog>

                {/* ---------- P1′ 声明式反馈组件（命令式与声明式共用同一渲染逻辑） ---------- */}

                <Loading open={loadingOpen} text="声明式 loading" forbidClick />

                <ActionSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    title="声明式动作面板"
                    actions={SHEET_ACTIONS}
                    onSelect={(action) => {
                        showToast(`选中 ${String(action.name)}`);
                    }}
                />
            </div>
        </div>
    );
}

export function App() {
    return (
        <ResponsiveProvider breakpoint={768}>
            <Playground />
            {/* 命令式弹层的宿主：挂在这里可继承上面的 Provider 配置（断点 768） */}
            <DialogHost />
            <ToastHost />
            {/* P1′ 反馈组件的命令式宿主（同上，挂在 Provider 内才能继承断点） */}
            <LoadingHost />
            <NotifyHost />
            <ActionSheetHost />
        </ResponsiveProvider>
    );
}
