import * as React from "react";
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cell, CellGroup } from '@/components/ui/cell';

import { cn } from '@/lib/utils';

import { Tag } from '@/components/ui/tag';
import { useDeviceMode, useDeviceModeAttrs } from '@/hooks/use-device-mode';
import { Dialog, DialogHost } from '@/components/responsive/dialog';
import { Popup, type PopupPosition } from '@/components/responsive/popup';

import type { MenuValue } from '@/hooks/use-menu-state';
import { ToastHost, showSuccessToast, showToast } from '@/components/responsive/toast';
import { Loading, LoadingHost } from '@/components/responsive/loading';
import { NotifyHost } from '@/components/responsive/notify';
import { ActionSheet, ActionSheetHost, type ActionSheetAction } from '@/components/responsive/action-sheet';
import { Block, Row, Section } from '@/demos/layout';
import { ActionSheetDemos } from '@/demos/action-sheet';
import { BoundsDemos } from '@/demos/bounds';
import { ButtonDemos } from '@/demos/button';
import { CalendarDemos } from '@/demos/calendar';
import { CascaderDemos } from '@/demos/cascader';
import { CellDemos } from '@/demos/cell';
import { CheckboxDemos } from '@/demos/checkbox';
import { DataContainerDemos } from '@/demos/data-container';
import { DatePickerDemos } from '@/demos/date-picker';
import { DateTimePickerDemos } from '@/demos/datetime-picker';
import { DialogDemos } from '@/demos/dialog';
import { DropdownMenuDemos } from '@/demos/dropdown-menu';
import { FieldDemos } from '@/demos/field';
import { EllipsisDemos } from '@/demos/ellipsis';
import { IconDemos } from '@/demos/icon';
import { InputNumberDemos } from '@/demos/input-number';
import { ListDemos } from '@/demos/list';
import { LoadingDemos } from '@/demos/loading';
import { NavBarDemos } from '@/demos/nav-bar';
import { NotifyDemos } from '@/demos/notify';
import { PickerDemos } from '@/demos/picker';
import { PopoverDemos } from '@/demos/popover';
import { PopupDemos } from '@/demos/popup';
import { RadioDemos } from '@/demos/radio';
import { RateDemos } from '@/demos/rate';
import { SearchDemos } from '@/demos/search';
import { SelectDemos } from '@/demos/select';
import { SliderDemos } from '@/demos/slider';
import { SwitchDemos } from '@/demos/switch';
import { TabbarDemos } from '@/demos/tabbar';
import { TablePaginationDemos } from '@/demos/table-pagination';
import { TableDemos } from '@/demos/table';
import { TabsDemos } from '@/demos/tabs';
import { TagBadgeDemos } from '@/demos/tag-badge';
import { TimePickerDemos } from '@/demos/time-picker';
import { ToastDemos } from '@/demos/toast';
import { TooltipDemos } from '@/demos/tooltip';
import { UploaderDemos } from '@/demos/uploader';

/**
 * P0/P1 验证台
 * 用途：人工核对 Vant 视觉保真度 + 验证模式判定机制（缩放窗口 / 开 DevTools 设备模拟）
 *
 * 间距说明：本页只使用「页面级节奏」token（gap-bv-gutter / py-bv-block / mb-bv-section），
 * 组件内部间距一律交给组件自己的 Vant token，页面不越权。
 *
 * P1 验证重点：弹出层在两端是**不同的物理形态**，拖窗口跨过 768px 再点同一颗按钮即可对比。
 */

/**
 * 风格 / 深色切换器（P4-1）
 *
 * ⚠ class 必须挂在 `document.documentElement`（`<html>`）上，不能挂在页面根 div：
 * Dialog / Toast / Popup / Select 下拉这类浮层都走 portal，容器挂在 `document.body`
 * 下（见 lib/portal.tsx），**不在页面根 div 的子树里**。挂根 div 的后果是
 * 「页面里的按钮换了色，弹出来的浮层还是旧主色」——两套色并排，最难自查。
 * 挂 `<html>` 则整棵文档树（含 portal 容器）都在作用域内。
 *
 * 三套风格 + 深色可自由组合：bv-theme-ocean / bv-theme-grape / bv-theme-dark
 * 改的是不相交的槽，class 叠加即可（见各 CSS 文件头注释）。
 */
const STYLE_PRESETS = [
    { id: "vant", label: "Vant 复刻", cls: "" },
    { id: "ocean", label: "深海", cls: "bv-theme-ocean" },
    { id: "grape", label: "青莲", cls: "bv-theme-grape" },
] as const;

type StyleId = (typeof STYLE_PRESETS)[number]["id"];

function useThemeClass() {
    const [style, setStyle] = React.useState<StyleId>("vant");
    const [dark, setDark] = React.useState(false);

    React.useEffect(() => {
        const preset = STYLE_PRESETS.find((p) => p.id === style) ?? STYLE_PRESETS[0];
        const root = document.documentElement;
        // ⚠ 必须过滤空串：`classList.remove("")` 会抛 DOMTokenList 异常，
        // 且异常发生在 effect 里 → 整棵 React 树被卸载 → 白屏。
        // 默认风格（Vant 复刻）的 cls 就是空串。
        const allCls = [...STYLE_PRESETS.map((p) => p.cls), "bv-theme-dark"].filter(Boolean);
        for (const c of allCls) root.classList.remove(c);
        if (preset.cls) root.classList.add(preset.cls);
        if (dark) root.classList.add("bv-theme-dark");
        return () => {
            for (const c of allCls) root.classList.remove(c);
        };
    }, [style, dark]);

    return { style, setStyle, dark, setDark };
}

function ThemeSwitcher({
    style,
    setStyle,
    dark,
    setDark,
}: {
    style: StyleId;
    setStyle: (id: StyleId) => void;
    dark: boolean;
    setDark: (v: boolean) => void;
}) {
    return (
        <div
            data-testid="theme-switcher"
            className="flex items-center gap-bv-gutter text-bv-text-2"
        >
            <span>风格</span>
            {STYLE_PRESETS.map((p) => (
                <button
                    key={p.id}
                    type="button"
                    data-testid={`theme-${p.id}`}
                    aria-pressed={style === p.id}
                    onClick={() => setStyle(p.id)}
                    className={cn(
                        "cursor-pointer rounded-bv-sm border px-bv-xs py-[2px]",
                        style === p.id
                            ? "border-bv-primary text-bv-primary"
                            : "border-bv-border",
                    )}
                >
                    {p.label}
                </button>
            ))}
            <button
                type="button"
                data-testid="theme-dark"
                aria-pressed={dark}
                onClick={() => setDark(!dark)}
                className={cn(
                    "cursor-pointer rounded-bv-sm border px-bv-xs py-[2px]",
                    dark
                        ? "border-bv-primary text-bv-primary"
                        : "border-bv-border",
                )}
            >
                深色
            </button>
        </div>
    );
}

function ModeIndicator() {
    const mode = useDeviceMode();
    const theme = useThemeClass();
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
            <ThemeSwitcher {...theme} />
        </div>
    );
}

/** 区块：标题与内容同一条左基准线（都取 16px 定宽内边距） */
/**
 * 布局原语与各组件 demo 都搬到共享的 demos/ 层 ——
 * 验证台与文档站（apps/docs）展示的是**同一份** demo，不会两边漂移。
 * DOM 与搬走前逐字一致（visual-check 靠 h2 文本定位节点，不能动）。
 */

/** 间距刻度表：用于肉眼核对 token 是否真的生效 */
const SPACING_SCALE = [
    { name: "base", value: "4px", bar: "w-bv-base", scope: "组件" },
    { name: "xs", value: "8px", bar: "w-bv-xs", scope: "组件 / H5 行内" },
    { name: "sm", value: "12px", bar: "w-bv-sm", scope: "组件 / PC 行内" },
    { name: "md", value: "16px", bar: "w-bv-md", scope: "横向基准 / H5 区块" },
    { name: "lg", value: "24px", bar: "w-bv-lg", scope: "PC 区块 / H5 区块间" },
    { name: "xl", value: "32px", bar: "w-bv-xl", scope: "PC 区块间" },
] as const;

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

// P2 Picker：多列**独立**选择（列与列互不影响），含禁用项；字面量列直接传字符串

// P2 Cascader：省 / 市 / 区树（叶子才可选）

/**
 * 点击是否来自选择件自身：Checkbox/Radio 的 label 已能切换 input，
 * 外层 Cell 的整行 onClick 需跳过这类点击，否则会「label + 行」双触发。
 */

/**
 * Uploader 演示：afterRead 用 setTimeout 模拟异步上传（演示 uploading→done/失败）。
 * compress 打开走 canvas 缩放（demo 选真实图片文件即可看到体积变化）。
 */

/**
 * Tabs 双模式示例（模式 B）
 * 同一个 value 同时喂给 H5 与 PC 两个实例：模式 B 的要点就是
 * 「同一个 primitive 两端换壳，值语义完全一致」。
 */

/**
 * NavBar 双模式示例（模式 B）
 * H5 标题居中、PC 标题左对齐；层级回调（返回 / 右侧动作）两端同一份。
 */

/**
 * Tabbar 双模式示例（模式 C）
 * H5 底部固定条 / PC 侧边导航（默认）或顶部导航（pcVariant="top"）。
 */

/** List demo 用的行数据 */
/**
 * 单个 List 实例：自带一份数据状态。
 *
 * **必须每个实例独立持有 state**：验证台把 H5 与 PC 并排展示，若两者共用一份
 * useState，点 PC 的「刷新」会把 H5 的数据一起重置 —— 看起来像组件 bug，
 * 实际是 demo 把两个独立实例焊在了一起。真实业务里同一页面只会命中一种模式，
 * 不存在这种共享。
 */

/**
 * List 双模式示例（模式 C）
 * H5：竖向滚动容器 + 触底加载 + 顶部下拉刷新；
 * PC：固定高度滚动容器 + 滚到底加载 + 顶部「刷新」按钮。
 */

/**
 * 单个 Table 实例：排序/选中各自独立。
 *
 * 与 ListDemo 同理：验证台把两端并排展示，共用 state 会让
 * 「点 PC 表头排序 → H5 卡片也跟着重排」，看起来像组件 bug。
 */

/**
 * Table 双模式示例（模式 C）
 * H5：卡片化列表（关键字段直出 + 展开详情）；
 * PC：标准表格（排序 / 列固定 / 列筛选 / 行选择）。
 */

/** 分页 demo 的全量数据（比 Table 其它 demo 多，用来撑出多页） */

/**
 * Table 分页示例（PC 端能力）。
 *
 * 三个实例分别演示三种典型接法：
 * 1. local —— 组件自己切全量数据（前端分页）
 * 2. remote + 受控 current —— 业务按页取数，组件只管控件（后端分页的常态）
 * 3. startPage=0 —— 后端页码从 0 开始时
 */

/**
 * DataContainer 双模式示例（加载层）
 *
 * 关键演示「加载策略与 mode 正交」——这正是低代码 pageMode 字段该映射的东西：
 * - auto（默认）：PC 分页条 / H5 触底哨兵
 * - pagination：两端都分页（记录详情页，手机也要一页一页翻）
 * - infinite：两端都触底加载（2000 条报表，手机也得滑）
 */

function Playground() {
    const [_loading, _setLoading] = React.useState(false);
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
    const [loadingOpen, _setLoadingOpen] = React.useState(false);
    const [sheetOpen, setSheetOpen] = React.useState(false);

    // P2 DropdownMenu「可选值」示例的受控值：默认取**嵌套**叶子，
    // 好让「触发器回填完整层级路径」这条行为在页面上直接看得见
    const [_menuValue, _setMenuValue] = React.useState<MenuValue>("folder-a");

    // P2 DateTimePicker 区间示例：组件只做单值，区间 = 两个实例互相约束
    // （开始 max=结束、结束 min=开始），跨字段夹紧保证两端始终有序
    const [_rangeStart, _setRangeStart] = React.useState<string | undefined>();
    const [_rangeEnd, _setRangeEnd] = React.useState<string | undefined>();

    // P2 min/max 边界约束演示：受控值 + 实时回显，方便直接看「选不出去 / 被夹回」
    const [_demoDate, _setDemoDate] = React.useState<string | undefined>();
    const [_demoTime, _setDemoTime] = React.useState<string | undefined>();
    const [_demoDateTime, _setDemoDateTime] = React.useState<
        string | undefined
    >();

    return (
        <div
            {...modeAttrs}
            className="mx-auto min-h-screen max-w-[1100px] bg-bv-muted pb-bv-xl"
        >
            <ModeIndicator />

            <div className="pt-bv-lg">
                <ButtonDemos />

                <ButtonDemos />

                <CellDemos />

                <CellDemos />

                <TagBadgeDemos />

                <IconDemos />

                <EllipsisDemos />

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

                <PopupDemos />

                <DialogDemos />

                <ToastDemos />

                <LoadingDemos />

                <NotifyDemos />

                <ActionSheetDemos />

                <DialogDemos />

                <SelectDemos />

                <DropdownMenuDemos />

                <DatePickerDemos />

                <TimePickerDemos />

                <DateTimePickerDemos />

                <BoundsDemos />

                <TooltipDemos />

                <PopoverDemos />

                <PickerDemos />

                <CascaderDemos />

                <CalendarDemos />

                {/* ---------- P3 Field / Input / Textarea（模式 A） ---------- */}
                <FieldDemos />

                <SwitchDemos />
                <CheckboxDemos />
                <RadioDemos />
                <InputNumberDemos />
                <RateDemos />
                <SliderDemos />
                <UploaderDemos />
                <SearchDemos />
                <TabsDemos />
                <NavBarDemos />
                <TabbarDemos />
                <ListDemos />
                <TableDemos />
                <TablePaginationDemos />
                <DataContainerDemos />

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
