import * as React from "react";
import { H5DateTimePicker } from "@/components/h5/datetime-picker";
import { PcDateTimePicker } from "@/components/pc/datetime-picker";
import type { DateTimePanelProps } from "@/components/ui/datetime-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import {
    defaultFormatForColumns,
    formatParts,
    nowDateTimeParts,
    resolveColumns,
    useDateTimeValue,
    type DateTimeColumnKey,
    type DateTimePickerValue,
} from "@/hooks/use-datetime-value";

/**
 * Bivane DateTimePicker · 分发层
 *
 * ┌ H5 ── 年/月/日 + 时/分/秒 N 列滚轮（4/5/6 列），底部弹层 + 顶部工具条
 * └ PC ── 左月历网格（« < 年月 > »）选日期 + 右侧时/分/秒 1~3 条时间列，
 *         band 居中上下双线指示选中值，锚定浮层，顶部回显草稿时间，底部「此刻 / 确定」
 *
 * 与 DatePicker 同族的模式 C：日期段范式不同（滚轮 vs 月历），时间段两端共用
 * 同一滚轮列（PC 时间列也走 band 样式，不再用 solid 实心选中块）；恒走「暂存 → 确定」。
 *
 * 单值组件（对齐 Vant DatetimePicker）：值恒为字符串，
 *   'YYYY-MM-DD HH' / 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DD HH:mm:ss' 三档之一。
 * open/draft 跨模式同义留本层；月历视图与键盘驾驶区仅 PC 存在，留实现层。
 *
 * 草稿无值时播种「此刻」而不是今年元旦 00:00:00 —— 与 DatePicker/TimePicker 同族理由：
 * 未选是主路径，停在边界每次打开都要长距离滚动。
 */

export interface DateTimePickerProps {
    /** 受控值：'YYYY-MM-DD HH[:mm[:ss]]' 字符串（格式跟精度走） */
    value?: DateTimePickerValue;
    /** 非受控初始值 */
    defaultValue?: DateTimePickerValue;
    /** 点「确定」那一瞬回调 */
    onChange?: (value: DateTimePickerValue) => void;
    /** 确认回调，与 onChange 同值，便于统一接埋点 */
    onConfirm?: (value: DateTimePickerValue) => void;
    /**
     * 参与展示的列。日期三列（年/月/日）必在，时间列取「时」起的连续前缀，共三档：
     *   ['year','month','day','hour']                       年月日时
     *   ['year','month','day','hour','minute']             年月日时分
     *   ['year','month','day','hour','minute','second']     年月日时分秒（默认）
     * 拼错（缺日期列、时间列不连续）回落全 6 列。
     */
    columnsType?: DateTimeColumnKey[];
    /** 可选下界（含），'YYYY-MM-DD HH:mm:ss'；缺时间位按当天 00:00:00 */
    min?: string;
    /** 可选上界（含），'YYYY-MM-DD HH:mm:ss'；缺时间位按当天 23:59:59 */
    max?: string;
    /**
     * 展示格式，默认由 columnsType 推出
     * （'YYYY-MM-DD HH:mm:ss' / 'YYYY-MM-DD HH:mm' / 'YYYY-MM-DD HH'）。
     */
    format?: string;
    /** H5 面板标题栏文案。PC 不渲染标题栏 */
    title?: React.ReactNode;
    /** 无选中值时展示 */
    placeholder?: React.ReactNode;
    disabled?: boolean;
    /** 展示清除按钮（仅在有选中值、且未禁用时出现） */
    clearable?: boolean;
    /** 无障碍名称；没有可见 label 时应当传入 */
    ariaLabel?: string;
    id?: string;
    className?: string;
    /** 逃生舱：强制某个模式的交互（架构契约 9 唯一例外） */
    forceMode?: DeviceMode;
}

export const DateTimePicker = React.forwardRef<
    HTMLDivElement,
    DateTimePickerProps
>(function DateTimePicker(
    {
        value,
        defaultValue,
        onChange,
        onConfirm,
        columnsType,
        min,
        max,
        format,
        title,
        placeholder = "请选择",
        disabled = false,
        clearable = false,
        ariaLabel,
        id,
        className,
        forceMode,
    },
    ref,
) {
    const mode = useDeviceMode(forceMode);
    const [open, setOpen] = React.useState(false);

    const columns = React.useMemo(
        () => resolveColumns(columnsType),
        [columnsType],
    );
    const resolvedFormat = React.useMemo(
        () => format ?? defaultFormatForColumns(columns),
        [format, columns],
    );

    const { selected, minParts, maxParts, setValue, clear } = useDateTimeValue({
        value,
        defaultValue,
        onChange,
        min,
        max,
        format: resolvedFormat,
    });

    // 单值草稿：打开时播种已选值，没有则播种「此刻」；关闭清空，半截草稿不跨次复活
    const [draft, setDraft] = React.useState<string[]>([]);

    React.useEffect(() => {
        if (!open) {
            setDraft([]);
            return;
        }
        setDraft([
            selected[0] ?? formatParts(nowDateTimeParts(), resolvedFormat),
        ]);
    }, [open, selected, resolvedFormat]);

    const handleSubmit = React.useCallback(
        (next: string[]) => {
            if (!next[0]) return;
            setValue(next[0]);
            onConfirm?.(next[0]);
            setOpen(false);
        },
        [setValue, onConfirm],
    );

    const handleOpenChange = React.useCallback(
        (next: boolean) => {
            if (disabled) return;
            setOpen(next);
        },
        [disabled],
    );

    const panelProps: DateTimePanelProps = {
        mode,
        open,
        onOpenChange: handleOpenChange,
        columns,
        format: resolvedFormat,
        minParts,
        maxParts,
        title,
        placeholder,
        disabled,
        clearable,
        selected,
        draft,
        onDraftChange: setDraft,
        onSubmit: handleSubmit,
        onCancel: () => setOpen(false),
        onClear: clear,
        className,
        ariaLabel,
        id,
    };

    return mode === "mobile" ? (
        <H5DateTimePicker ref={ref} {...panelProps} />
    ) : (
        <PcDateTimePicker ref={ref} {...panelProps} />
    );
});

export type {
    DateTimeColumnKey,
    DateTimeParts,
    DateTimePickerValue,
} from "@/hooks/use-datetime-value";
