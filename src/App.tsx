import * as React from "react";
import { ResponsiveProvider } from "@/components/providers/responsive-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cell, CellGroup } from "@/components/ui/cell";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";
import { Radio, RadioGroup } from "@/components/ui/radio";
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
import { Picker } from "@/components/responsive/picker";
import { Cascader } from "@/components/responsive/cascader";
import {
    Calendar,
    type CalendarFormatter,
    type CalendarType,
    type CalendarValue,
} from "@/components/responsive/calendar";
import { Tooltip } from "@/components/responsive/tooltip";
import { Ellipsis } from "@/components/ui/ellipsis";
import { Popover } from "@/components/responsive/popover";
import { InputNumber } from "@/components/responsive/input-number";
import { Rate } from "@/components/responsive/rate";
import { Slider } from "@/components/responsive/slider";
import { Uploader } from "@/components/responsive/uploader";
import type { UploaderFileItem } from "@/hooks/use-uploader-state";
import { Search } from "@/components/responsive/search";
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

/**
 * Calendar 单个示例：同一个受控实例在 H5 收进 Cell（点开是全屏弹层），
 * PC 直接内嵌常驻月历 —— 业务侧只写一份，形态差异由分发层处理（模式 C）。
 */
function CalendarDemo({
    label,
    type,
    maxRange,
    formatter,
}: {
    label: string;
    type: CalendarType;
    maxRange?: number;
    formatter?: CalendarFormatter;
}) {
    const mode = useDeviceMode();
    const [value, setValue] = React.useState<CalendarValue | undefined>();
    // H5 的触发器在组件外部（Cell），开合必须受控；PC 不消费这两个 props
    const [open, setOpen] = React.useState(false);

    const summary = React.useMemo(() => {
        if (value === undefined) return "";
        if (typeof value === "string") return value;
        return type === "range"
            ? `${value[0]} ~ ${value[1]}`
            : value.join("、");
    }, [value, type]);

    return (
        <div>
            {mode === "mobile" ? (
                <Cell
                    title={label}
                    value={summary || "请选择"}
                    isLink
                    onClick={() => setOpen(true)}
                />
            ) : null}

            <Calendar
                type={type}
                title={label}
                maxRange={maxRange}
                formatter={formatter}
                value={value}
                onChange={setValue}
                open={open}
                onOpenChange={setOpen}
                onOverRange={
                    maxRange
                        ? () =>
                              showToast(`区间最多选择 ${maxRange} 天（含首尾）`)
                        : undefined
                }
            />

            {mode === "desktop" ? (
                <p className="mt-bv-xs text-bv-sm text-bv-text-3">
                    {summary || "尚未选择"}
                </p>
            ) : null}
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

// P2 Picker：多列**独立**选择（列与列互不影响），含禁用项；字面量列直接传字符串
const PICKER_COLUMNS = [
    [
        { label: "奔驰", value: "benz" },
        { label: "宝马", value: "bmw" },
        { label: "奥迪（暂无车源）", value: "audi", disabled: true },
    ],
    ["2024 款", "2025 款", "2026 款"],
];

// P2 Cascader：省 / 市 / 区树（叶子才可选）
const CASCADER_AREA = [
    {
        label: "浙江",
        value: "zj",
        children: [
            {
                label: "杭州",
                value: "hz",
                children: [
                    { label: "西湖区", value: "xh" },
                    { label: "拱墅区", value: "gs" },
                ],
            },
            {
                label: "宁波",
                value: "nb",
                children: [
                    { label: "海曙区", value: "hs" },
                    { label: "江北区", value: "jb" },
                ],
            },
        ],
    },
    {
        label: "江苏",
        value: "js",
        children: [
            {
                label: "南京",
                value: "nj",
                children: [
                    { label: "玄武区", value: "xw" },
                    { label: "鼓楼区", value: "gl" },
                ],
            },
        ],
    },
];

/** Calendar 周末禁选示例：formatter 返回 disabled 即不可点（两端一致） */
const disableWeekendCalendarDay: CalendarFormatter = ({ parts }) => {
    const weekday = new Date(parts.year, parts.month - 1, parts.day).getDay();
    return weekday === 0 || weekday === 6 ? { disabled: true } : undefined;
};

/** Calendar 四种场景：single / range 限长 / multiple / formatter 禁用 */
const CALENDAR_DEMOS: Array<{
    label: string;
    type: CalendarType;
    maxRange?: number;
    formatter?: CalendarFormatter;
}> = [
    { label: "单个日期", type: "single" },
    { label: "日期区间（最多 7 天）", type: "range", maxRange: 7 },
    { label: "多个日期", type: "multiple" },
    {
        label: "周末不可选",
        type: "range",
        formatter: disableWeekendCalendarDay,
    },
];

/** 验证码输入：发送后倒计时，避免重复发送（Field action 区的典型用法） */
function SmsField() {
    const [left, setLeft] = React.useState(0);

    React.useEffect(() => {
        if (left <= 0) return;
        const timer = window.setTimeout(() => setLeft((v) => v - 1), 1000);
        return () => window.clearTimeout(timer);
    }, [left]);

    return (
        <Field
            label="验证码"
            type="digit"
            placeholder="请输入 6 位验证码"
            maxlength={6}
            clearable
            action={
                <Button
                    size="small"
                    type={left > 0 ? "default" : "primary"}
                    disabled={left > 0}
                    onClick={() => setLeft(60)}
                >
                    {left > 0 ? `${left}s 后重发` : "发送验证码"}
                </Button>
            }
        />
    );
}

/**
 * 点击是否来自选择件自身：Checkbox/Radio 的 label 已能切换 input，
 * 外层 Cell 的整行 onClick 需跳过这类点击，否则会「label + 行」双触发。
 */
function isChoiceTarget(event: React.MouseEvent<HTMLDivElement>): boolean {
    return (
        (event.target as HTMLElement).closest(
            "[data-slot='checkbox'], [data-slot='radio']",
        ) !== null
    );
}

function SwitchDemos() {
    const [notice, setNotice] = React.useState(true);
    const [digest, setDigest] = React.useState(false);
    const [enumValue, setEnumValue] = React.useState<"yes" | "no">("no");

    return (
        <Section title="P3 · Switch 开关（模式 A：两端同视觉，PC 多键盘焦点环）">
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
        </Section>
    );
}

function InputNumberDemos() {
    const [value, setValue] = React.useState<number | null>(1);
    return (
        <Section title="P3 · InputNumber 数量步进器（模式 B：H5 横排 ± / PC 竖排 ▲▼）">
            <Block>
                <Row>
                    <InputNumber
                        value={value}
                        min={0}
                        max={10}
                        onChange={(v) => setValue(v)}
                        aria-label="基础步进器"
                    />
                    <span className="text-bv-text-2">当前：{String(value)}</span>
                    <InputNumber
                        defaultValue={1}
                        min={1}
                        max={5}
                        integer
                        aria-label="整数"
                    />
                    <InputNumber
                        defaultValue={1}
                        min={1}
                        max={5}
                        disabled
                        aria-label="禁用"
                    />
                    <InputNumber
                        defaultValue={3}
                        min={0}
                        max={5}
                        disableInput
                        aria-label="禁输入"
                    />
                    <InputNumber
                        defaultValue={1}
                        min={0}
                        max={5}
                        step={0.5}
                        decimalLength={2}
                        aria-label="小数步长"
                    />
                    <InputNumber
                        defaultValue={1}
                        min={0}
                        max={5}
                        allowEmpty
                        aria-label="可清空"
                    />
                    <InputNumber
                        defaultValue={1}
                        min={0}
                        max={5}
                        theme="round"
                        aria-label="圆角主题"
                    />
                    <InputNumber
                        defaultValue={1}
                        min={1}
                        max={5}
                        beforeChange={() => false}
                        aria-label="禁止变更"
                    />
                </Row>
            </Block>
        </Section>
    );
}

function RateDemos() {
    const [value, setValue] = React.useState(3);
    return (
        <Section title="P3 · Rate 评分（模式 C：H5 滑动连续选 / PC 点击+hover 预览+键盘）">
            <Block>
                <Row>
                    <Rate
                        value={value}
                        onChange={(v) => setValue(v)}
                        ariaLabel="基础评分"
                    />
                    <span className="text-bv-text-2">当前：{value}</span>
                    <Rate defaultValue={2} ariaLabel="默认 2" />
                    <Rate defaultValue={3} count={3} ariaLabel="三星" />
                    <Rate defaultValue={2.5} allowHalf ariaLabel="半星" />
                    <div><span className="text-bv-text-2">只读</span>
                    <Rate defaultValue={3} readonly ariaLabel="只读" /></div>
                    <Rate defaultValue={2} disabled ariaLabel="禁用" />
                    <Rate defaultValue={3} clearable ariaLabel="可清零" />
                    <Rate
                        defaultValue={2}
                        color="#ffd21e"
                        voidColor="#ee0a24"
                        ariaLabel="自定义色"
                    />
                </Row>
            </Block>
        </Section>
    );
}

function SliderDemos() {
    const [value, setValue] = React.useState(40);
    const [range, setRange] = React.useState<[number, number]>([20, 60]);
    return (
        <Section title="P3 · Slider 滑块（模式 C：H5 触摸拖拽 / PC 点轨+拖拽+键盘）">
            <Block>
                <Row>
                    <div className="w-[240px]">
                        <Slider
                            value={value}
                            onChange={(v) => setValue(v as number)}
                            ariaLabel="基础滑块"
                        />
                    </div>
                    <span className="text-bv-text-2">当前：{value}</span>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="w-[240px]">
                        <Slider
                            range
                            value={range}
                            onChange={(v) =>
                                setRange(v as [number, number])
                            }
                            ariaLabel="区间滑块"
                        />
                    </div>
                    <span className="text-bv-text-2">
                        当前：[{range.join(", ")}]
                    </span>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="w-[240px]">
                        <Slider defaultValue={50} disabled ariaLabel="禁用" />
                    </div>
                    <div className="w-[240px]">
                        <Slider defaultValue={50} readonly ariaLabel="只读" />
                    </div>
                    <div className="w-[240px]">
                        <Slider defaultValue={30} reverse ariaLabel="反向" />
                    </div>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="flex h-[180px] items-center">
                        <Slider
                            defaultValue={40}
                            vertical
                            ariaLabel="竖直滑块"
                        />
                    </div>
                </Row>
            </Block>
        </Section>
    );
}

/**
 * Uploader 演示：afterRead 用 setTimeout 模拟异步上传（演示 uploading→done/失败）。
 * compress 打开走 canvas 缩放（demo 选真实图片文件即可看到体积变化）。
 */
function UploaderDemos() {
    const [list, setList] = React.useState<UploaderFileItem[]>([]);
    const [files, setFiles] = React.useState<UploaderFileItem[]>([]);

    const afterRead = (item: UploaderFileItem, onProgress: (p: number) => void) =>
        new Promise<void>((resolve, reject) => {
            // 模拟分片进度：演示「业务用 onProgress 上报真实进度」→ 进度条/百分比会动。
            // 真实接入时把 onProgress 挂到你自己的 XHR/fetch 进度事件上即可。
            let p = 0;
            const timer = setInterval(() => {
                p += 20;
                if (p >= 100) {
                    clearInterval(timer);
                    // 文件名含 fail 的走失败分支，便于看到重试 UI
                    if ((item.name ?? "").includes("fail")) {
                        reject(new Error("上传失败"));
                    } else {
                        resolve();
                    }
                } else {
                    onProgress(p);
                }
            }, 150);
        });

    /** 假 App 桥：异步返回一张绿色图片 File，演示 onPickRequest → handle.addFiles 回填 */
    const fakeBridgePick = async (): Promise<File> => {
        await new Promise((r) => setTimeout(r, 300)); // 模拟原生桥异步
        const c = document.createElement("canvas");
        c.width = 80;
        c.height = 80;
        const g = c.getContext("2d");
        if (g) {
            g.fillStyle = "#07c160";
            g.fillRect(0, 0, 80, 80);
        }
        const blob = await new Promise<Blob | null>((res) =>
            c.toBlob(res, "image/png"),
        );
        return new File([blob ?? new Blob(["x"])], `bridge-${Date.now()}.png`, {
            type: "image/png",
        });
    };

    return (
        <Section title="P3 · Uploader 上传（模式 C：H5 宫格+相机 / PC 拖拽区+列表+粘贴）">
            <Block>
                <Row>
                    <div className="flex flex-col gap-bv-sm">
                        <span className="text-bv-text-2">
                            afterRead 模拟上传（文件名含 fail 触发失败）
                        </span>
                        <Uploader
                            multiple
                            maxCount={6}
                            value={list}
                            onChange={setList}
                            afterRead={afterRead}
                            ariaLabel="基础上传"
                        />
                        <span className="text-bv-xs text-bv-text-3">
                            共 {list.length} 项
                        </span>
                    </div>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="flex flex-col gap-bv-sm">
                        <span className="text-bv-text-2">
                            受控 + 图片压缩 + accept + maxSize
                        </span>
                        <Uploader
                            value={files}
                            onChange={setFiles}
                            accept="image/*"
                            multiple
                            compress={{ maxWidth: 800, quality: 0.7 }}
                            maxSize={2 * 1024 * 1024}
                            afterRead={afterRead}
                            ariaLabel="图片上传"
                        />
                    </div>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="flex flex-col gap-bv-sm">
                        <span className="text-bv-text-2">只读 / 禁用 / 已满</span>
                        <Uploader
                            defaultValue={[]}
                            multiple
                            maxCount={1}
                            afterRead={afterRead}
                            ariaLabel="上限1"
                        />
                        <Uploader
                            multiple
                            disabled
                            afterRead={afterRead}
                            ariaLabel="禁用上传"
                        />
                    </div>
                </Row>
            </Block>
            <Block>
                <Row>
                    <div className="flex flex-col gap-bv-sm">
                        <span className="text-bv-text-2">
                            App 桥回填（onPickRequest：点「+」不弹系统框，模拟原生桥拿图后回填）
                        </span>
                        <Uploader
                            multiple
                            afterRead={afterRead}
                            onPickRequest={(handle) => {
                                void fakeBridgePick().then((f) => handle.addFiles(f));
                            }}
                            ariaLabel="App桥回填"
                        />
                    </div>
                </Row>
            </Block>
        </Section>
    );
}

const SEARCH_HOT_WORDS = ["苹果手机", "苹果电脑", "苹果手表", "香蕉手机", "香蕉牛奶", "橙子"];

function SearchDemos() {
    const [log, setLog] = React.useState<string>("（尚未提交）");
    // 历史受控：真实场景接 localStorage / 接口
    const [history, setHistory] = React.useState<string[]>(["苹果", "耳机"]);

    // 异步建议源：按关键词过滤全集，Promise.resolve 模拟远程请求（配合 debounce）
    const fetchSuggestions = React.useCallback((kw: string) => {
        const key = kw.trim();
        return Promise.resolve(
            SEARCH_HOT_WORDS.filter((item) => item.includes(key)).slice(0, 5),
        );
    }, []);

    return (
        <Section title="P3 · Search 搜索（模式 C：H5 内联条→全屏页+历史 / PC 内联→建议浮层）">
            <Block>
                <Row>
                    <div className="w-full max-w-[320px]">
                        <Search
                            suggestions={["苹果", "香蕉", "橙子", "草莓"]}
                            onSearch={(kw) => setLog(`静态建议提交：${kw}`)}
                            ariaLabel="静态建议搜索"
                        />
                    </div>
                    <span className="text-bv-text-2">{log}</span>
                </Row>
                <Row>
                    <div className="w-full max-w-[320px]">
                        <Search
                            onFetchSuggestions={fetchSuggestions}
                            debounce={300}
                            placeholder="异步建议（防抖 300ms）"
                            onSearch={(kw) => setLog(`异步建议提交：${kw}`)}
                            ariaLabel="异步建议搜索"
                        />
                    </div>
                    <span className="text-bv-text-2">输入后 ↑↓ 巡航 / Enter 选中 / Esc 关闭（PC）</span>
                </Row>
                <Row>
                    <div className="w-full max-w-[320px]">
                        <Search
                            history={history}
                            onHistoryChange={setHistory}
                            suggestions={["iPhone", "iPad", "iMac"]}
                            placeholder="搜历史（H5 全屏页展示）"
                            onSearch={(kw) => setLog(`历史/建议提交：${kw}`)}
                            ariaLabel="历史搜索"
                        />
                    </div>
                    <span className="text-bv-text-2">历史：{history.join("、") || "（空）"}</span>
                </Row>
                <Row>
                    <div className="w-full max-w-[320px]">
                        <Search shape="square" clearable placeholder="square 形状" ariaLabel="方形" />
                    </div>
                    <div className="w-full max-w-[320px]">
                        <Search disabled placeholder="禁用" ariaLabel="禁用" />
                    </div>
                </Row>
            </Block>
        </Section>
    );
}

const FRUIT_OPTIONS: ReadonlyArray<{
    name: string;
    label: string;
    disabled?: boolean;
}> = [
    { name: "apple", label: "苹果" },
    { name: "banana", label: "香蕉" },
    { name: "orange", label: "橙子（缺货）", disabled: true },
];

function CheckboxDemos() {
    // Cell 整行点击演示：组受控 + max=2，行点击与组内 Checkbox 走同一份更新逻辑
    const [fruits, setFruits] = React.useState<string[]>(["apple"]);
    const [hobbies, setHobbies] = React.useState<string[]>(["reading"]);
    const [plans, setPlans] = React.useState<string[]>(["a"]);

    const toggleFruit = (name: string) => {
        setFruits((prev) => {
            const has = prev.includes(name);
            // 上限只约束新增，与 CheckboxGroup max 语义一致
            if (!has && prev.length >= 2) return prev;
            return has ? prev.filter((item) => item !== name) : [...prev, name];
        });
    };

    const allChecked = plans.length === 3;
    const partial = plans.length > 0 && !allChecked;

    return (
        <Section title="P3 · Checkbox 复选框（模式 A：H5 整行可点 / PC 键盘焦点环）">
            <Block>
                <Row>
                    <Checkbox defaultChecked>圆形（默认）</Checkbox>
                    <Checkbox shape="square" defaultChecked>
                        方形
                    </Checkbox>
                    <Checkbox checked={false} indeterminate>
                        半选态
                    </Checkbox>
                    <Checkbox labelPosition="left">文字在左</Checkbox>
                    <Checkbox labelDisabled>文字不可点</Checkbox>
                    <Checkbox disabled>禁用</Checkbox>
                    <Checkbox disabled defaultChecked>
                        禁用选中
                    </Checkbox>
                </Row>
            </Block>
            <Block className="p-0">
                <CellGroup inset className="mx-0">
                    <CheckboxGroup
                        value={fruits}
                        max={2}
                        onChange={(names) => setFruits(names as string[])}
                    >
                        {FRUIT_OPTIONS.map((item) => (
                            <Cell
                                key={item.name}
                                center
                                title={item.label}
                                onClick={(event) => {
                                    if (item.disabled || isChoiceTarget(event))
                                        return;
                                    toggleFruit(item.name);
                                }}
                                rightIcon={
                                    <Checkbox
                                        name={item.name}
                                        disabled={item.disabled}
                                        ariaLabel={item.label}
                                    />
                                }
                            />
                        ))}
                    </CheckboxGroup>
                </CellGroup>
                <p className="px-bv-md py-bv-sm text-bv-sm text-bv-text-2">
                    已选 {fruits.length}/2：{fruits.join("、") || "无"}
                    （整行可点；达到上限后其余项自动禁用）
                </p>
            </Block>
            <Block>
                <CheckboxGroup
                    direction="horizontal"
                    value={hobbies}
                    onChange={(names) => setHobbies(names as string[])}
                >
                    <Checkbox name="reading">阅读</Checkbox>
                    <Checkbox name="music">音乐</Checkbox>
                    <Checkbox name="sports">运动</Checkbox>
                    <Checkbox name="travel">旅行</Checkbox>
                </CheckboxGroup>
            </Block>
            <Block>
                <div className="flex flex-col gap-bv-gutter">
                    <Checkbox
                        checked={allChecked}
                        indeterminate={partial}
                        onChange={(checked) =>
                            setPlans(checked ? ["a", "b", "c"] : [])
                        }
                    >
                        全选{partial ? "（部分）" : ""}
                    </Checkbox>
                    <CheckboxGroup
                        direction="horizontal"
                        value={plans}
                        onChange={(names) => setPlans(names as string[])}
                    >
                        <Checkbox name="a">方案 A</Checkbox>
                        <Checkbox name="b">方案 B</Checkbox>
                        <Checkbox name="c">方案 C</Checkbox>
                    </CheckboxGroup>
                </div>
            </Block>
        </Section>
    );
}

const PAYMENT_OPTIONS: ReadonlyArray<{
    name: string;
    label: string;
    disabled?: boolean;
}> = [
    { name: "wechat", label: "微信支付" },
    { name: "alipay", label: "支付宝" },
    { name: "bank", label: "银行卡（维护中）", disabled: true },
];

function RadioDemos() {
    const [pay, setPay] = React.useState<string>("wechat");
    const [gender, setGender] = React.useState<string>("secret");

    return (
        <Section title="P3 · Radio 单选框（模式 A：H5 整行触发 / PC 空格与方向键）">
            <Block className="p-0">
                <CellGroup inset className="mx-0">
                    <RadioGroup
                        value={pay}
                        onChange={(name) => setPay(name as string)}
                    >
                        {PAYMENT_OPTIONS.map((item) => (
                            <Cell
                                key={item.name}
                                center
                                title={item.label}
                                onClick={(event) => {
                                    if (item.disabled || isChoiceTarget(event))
                                        return;
                                    setPay(item.name);
                                }}
                                rightIcon={
                                    <Radio
                                        name={item.name}
                                        disabled={item.disabled}
                                        ariaLabel={item.label}
                                    />
                                }
                            />
                        ))}
                    </RadioGroup>
                </CellGroup>
                <p className="px-bv-md py-bv-sm text-bv-sm text-bv-text-2">
                    当前支付方式：
                    {PAYMENT_OPTIONS.find((item) => item.name === pay)?.label}
                    （整行点击触发，这是 H5 的典型用法）
                </p>
            </Block>
            <Block>
                <div className="flex flex-col gap-bv-gutter">
                    <RadioGroup
                        direction="horizontal"
                        value={gender}
                        onChange={(name) => setGender(name as string)}
                    >
                        <Radio name="male">男</Radio>
                        <Radio name="female">女</Radio>
                        <Radio name="secret">保密</Radio>
                    </RadioGroup>
                    <Row>
                        <Radio
                            name="left-label"
                            labelPosition="left"
                            defaultChecked
                        >
                            文字在左
                        </Radio>
                        <Radio name="disabled" disabled>
                            禁用项
                        </Radio>
                    </Row>
                </div>
            </Block>
        </Section>
    );
}

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

                <Section title="P2 · Picker 通用多列选择（模式 C：滚轮 vs 多列面板）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[240px]">
                                    <Picker
                                        ariaLabel="品牌年款"
                                        title="选择品牌年款"
                                        columns={PICKER_COLUMNS}
                                        defaultValue={["bmw", "2025 款"]}
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    两列独立 · 含禁用项 · 可清除
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <Picker
                                        ariaLabel="姓氏"
                                        title="选择称呼"
                                        columns={[["先生", "女士"]]}
                                        placeholder="选择称呼"
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    单列 · 字面量数组
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[200px]">
                                    <Picker
                                        ariaLabel="禁用选择"
                                        columns={PICKER_COLUMNS}
                                        placeholder="请选择"
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
                                ? "点开是底部弹层，N 列滚轮横排（5 行制、各自惯性吸附），顶部「取消 · 标题 · 确定」；滚某列只改这一列的草稿，互不影响，点「确定」才提交"
                                : "点开是锚定浮层，N 列纵向面板并排（每列定宽、各自滚动，36px 桌面行高），底部固定「取消 / 确定」条；点行只改草稿，确定才生效（多列要全部调好才算选完）；键盘 ←→ 换列、↑↓ 列内巡航（跳过禁用、不回绕）、Home/End 首尾、Enter 先选中再按一次提交、Esc 取消"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：Picker 只表达「列与列互不影响」的多维度单选 （值
                            = 每列一个值的数组）。列之间有父子联动（省市区）
                            请用下一个 Cascader —— Vant 把两者塞进同一个
                            Picker， Bivane 按交互范式拆开，共享同一套滚轮地基。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · Cascader 级联选择（模式 C：H5 联动滚轮 / PC 面包屑多列面板）">
                    <Block className="flex flex-col gap-bv-gutter">
                        <Row>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[260px]">
                                    <Cascader
                                        ariaLabel="省市区"
                                        title="选择地区"
                                        options={CASCADER_AREA}
                                        defaultValue={["zj", "hz", "xh"]}
                                        searchable
                                        clearable
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    三级联动 · 可搜索（PC）· 可清除
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <Cascader
                                        ariaLabel="地区（未选）"
                                        options={CASCADER_AREA}
                                        placeholder="请选择所在地区"
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-3">
                                    无默认值
                                </span>
                            </div>
                            <div className="flex items-center gap-bv-sm">
                                <div className="w-[220px]">
                                    <Cascader
                                        ariaLabel="禁用地区"
                                        options={CASCADER_AREA}
                                        placeholder="请选择所在地区"
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
                                ? "点开是底部弹层里的联动滚轮（省 / 市 / 区，即 Vant Area 交互）：滚「省」，市/区两列整体重算并回到第一个可选项；顶部「取消 · 标题 · 确定」，改完确定才提交"
                                : "点开是锚定浮层：顶部面包屑（请选择 / 省 / 市，可点回退），下方逐级向右展开的多列面板；点父级展开下一列，点叶子立即生效并关闭；打开即定位到已选路径。searchable 时顶部有搜索框，按「浙江 杭州 西湖」这样的完整路径匹配，点结果直接选中整条路径；键盘 ↑↓ 巡航、→/Enter 展开或选中、← 回上级、Esc 关闭"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：值恒为根 → 叶子的**完整路径值数组**（如
                            ['zj','hz','xh']），半截/失效路径不回显；只有叶子可选。
                            options 支持 fieldNames 改字段映射，可直接喂 Vant
                            风格
                            {"{"}text/value/children{"}"} 数据；不内置
                            @vant/area-data， 避免为一个地区预设背上整包体积。
                        </p>
                    </Block>
                </Section>

                <Section title="P2 · Calendar 日历（模式 C：H5 全屏弹层拖选 / PC 内嵌月历）">
                    <Block className="flex flex-col gap-bv-gutter">
                        {mode === "mobile" ? (
                            <CellGroup inset className="mx-0">
                                {CALENDAR_DEMOS.map((demo) => (
                                    <CalendarDemo key={demo.label} {...demo} />
                                ))}
                            </CellGroup>
                        ) : (
                            <Row className="items-start">
                                {CALENDAR_DEMOS.map((demo) => (
                                    <CalendarDemo key={demo.label} {...demo} />
                                ))}
                            </Row>
                        )}
                        <p className="text-bv-sm text-bv-text-2">
                            当前：{mode === "mobile" ? "H5 交互" : "PC 交互"} ——{" "}
                            {mode === "mobile"
                                ? "点行打开全屏日历：min→max 的月份纵向连续排列、进入视口附近才挂载；区间可按住后跨日拖动（窗口超出 7 天上限会向前滑动），也可两次点选；半截区间时底部确定条禁用，single 点一天即完成"
                                : "月历常驻内嵌（区间为并排双月）：鼠标按住跨日拖选或两次点选即生效，悬停有区间预览；键盘 ←→ 换日、↑↓ 换周、PgUp/PgDn 换月、Home/End 到周首尾、Enter 选定，自动跳过禁用日；轻点超出 7 天上限会 Toast 提示"}
                        </p>
                        <p className="text-bv-sm text-bv-text-3">
                            注：值恒为 'YYYY-MM-DD'（single 字符串 / range
                            有序二元组 / multiple 升序数组）；min/max 默认今天 ~
                            6 个月后月末；formatter
                            可给任意日期加标注或禁用，两端表现一致。
                        </p>
                    </Block>
                </Section>

                {/* ---------- P3 Field / Input / Textarea（模式 A） ---------- */}
                <Section title="P3 · Field 输入框（模式 A：两端同形，PC 仅多键盘焦点环）">
                    <Block className="p-0">
                        <CellGroup inset className="mx-0">
                            <Field
                                label="文本"
                                placeholder="请输入文本"
                                clearable
                            />
                            <Field
                                label="手机号"
                                type="tel"
                                maxlength={11}
                                placeholder="请输入手机号"
                                clearable
                            />
                            <Field
                                label="整数"
                                type="digit"
                                placeholder="digit：只允许数字"
                            />
                            <Field
                                label="数值"
                                type="number"
                                min={0}
                                max={99}
                                placeholder="number：失焦夹紧到 0~99"
                            />
                            <Field
                                label="密码"
                                type="password"
                                placeholder="密码输入"
                            />
                        </CellGroup>
                    </Block>
                    <Block className="p-0">
                        <CellGroup inset className="mx-0">
                            <Field
                                label="昵称"
                                required
                                leftIcon={<Icon name="success" />}
                                placeholder="聚焦时 label 与左图标转 primary"
                                clearable
                            />
                            <SmsField />
                            <Field
                                label="留言"
                                type="textarea"
                                rows={1}
                                autosize={{ maxHeight: 120 }}
                                maxlength={50}
                                showWordLimit
                                placeholder="多行自适应高度（上限 120px）+ 字数"
                            />
                            <Field
                                label="邮箱"
                                clearable
                                placeholder="失焦触发 rules 校验"
                                rules={[
                                    { required: true, message: "请输入邮箱" },
                                    {
                                        pattern: /^\S+@\S+\.\S+$/,
                                        message: "邮箱格式不正确",
                                    },
                                ]}
                            />
                            <Field
                                label="金额"
                                type="digit"
                                inputAlign="right"
                                placeholder="0.00（右对齐）"
                            />
                        </CellGroup>
                    </Block>
                    <Block className="p-0">
                        <CellGroup inset className="mx-0">
                            <Field
                                label="顶部标签"
                                labelAlign="top"
                                placeholder="labelAlign=top，标题独占一行"
                            />
                            <Field
                                label="所在城市"
                                readOnly
                                isLink
                                value="杭州"
                                onClickInput={() =>
                                    showToast("这里内嵌 Select / Picker 触发器")
                                }
                            />
                        </CellGroup>
                    </Block>
                </Section>

                <SwitchDemos />
                <CheckboxDemos />
                <RadioDemos />
                <InputNumberDemos />
                <RateDemos />
                <SliderDemos />
                <UploaderDemos />
                <SearchDemos />

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
