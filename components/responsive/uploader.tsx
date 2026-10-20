import * as React from "react";
import { H5Uploader } from "@/components/h5/uploader";
import { PcUploader } from "@/components/pc/uploader";
import type { UploaderHandle, UploaderRenderProps } from "@/components/ui/uploader-parts";
import { useDeviceMode, type DeviceMode } from "@/hooks/use-device-mode";
import { useUploader, type UploaderAfterRead, type UploaderFileItem } from "@/hooks/use-uploader-state";

/**
 * Bivane Uploader · 分发层（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * ┌ H5 ── 宫格预览 + 「+」唤起相机/相册（capture）
 * └ PC ── 拖拽区 + 列表视图 + 粘贴
 *
 * 上传队列、进度、校验两端同义 → 全部在 hooks/use-uploader-state，本层只做模式分派。
 * 传输：afterRead 回调优先，其次 action URL 走内置 XHR，都没有则仅本地预览。
 */
export interface UploaderProps {
    /** 受控文件列表（含 status/percent），默认 undefined */
    value?: UploaderFileItem[];
    /** 初始文件列表 */
    defaultValue?: UploaderFileItem[];
    /** 文件列表变化回调（上传中状态/进度变化也会触发） */
    onChange?: (list: UploaderFileItem[]) => void;
    /** 允许多选，默认 false */
    multiple?: boolean;
    /** 最大个数，默认 undefined（不限） */
    maxCount?: number;
    /** 单文件最大字节数，超出不入列并触发 onOversize */
    maxSize?: number;
    /** accept 属性，如 'image/*' 或 '.jpg,.png' */
    accept?: string;
    /** H5 直接唤起相机（透传给 input），PC 忽略 */
    capture?: boolean | "user" | "environment";
    disabled?: boolean;
    /** 只读：不可增删/重试 */
    readonly?: boolean;
    /** 图片压缩（canvas），默认 false */
    compress?: boolean | { maxWidth?: number; quality?: number };
    /** 上传地址（内置 XHR）。传了 action 且无 afterRead 时走它 */
    action?: string;
    method?: string;
    headers?: Record<string, string>;
    /** 上传表单字段名，默认 'file' */
    name?: string;
    /** 上传额外表单字段（或返回字段的函数） */
    data?:
        | Record<string, string>
        | ((item: UploaderFileItem) => Record<string, string>);
    withCredentials?: boolean;
    /** 业务自理上传：resolve→完成 / reject→失败。优先于 action。
     *  第二个参数 onProgress 用于上报真实进度，不调用则上传中只转圈不显示百分比。 */
    afterRead?: UploaderAfterRead;
    /** 读取前钩子，返回 false 拦截整批（Vant 语义） */
    beforeRead?: (file: File | File[]) => boolean | Promise<boolean>;
    /** 删除前钩子，返回 false 拦截 */
    beforeDelete?: (item: UploaderFileItem) => boolean | Promise<boolean>;
    /** 单文件超 maxSize 回调 */
    onOversize?: (file: File | File[]) => void;
    /** 超出 maxCount 回调（参数为被丢弃的文件） */
    onExceed?: (files: File[]) => void;
    /** 自定义选文件触发：传了它，点「+」/拖拽区不再打开系统弹窗，改为回调 consumer。
     *  典型是 App WebView 对接 JSBridge：回调里拿到文件后 handle.addFiles(file) 回填。 */
    onPickRequest?: (handle: UploaderHandle) => void;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    /** 无障碍标签，与全库一致用 ariaLabel */
    ariaLabel?: string;
    forceMode?: DeviceMode;
}

export const Uploader = React.forwardRef<UploaderHandle, UploaderProps>(
    function Uploader(
        {
            value,
            defaultValue,
            onChange,
            multiple = false,
            maxCount,
            maxSize,
            accept,
            capture,
            disabled = false,
            readonly = false,
            compress = false,
            action,
            method,
            headers,
            name,
            data,
            withCredentials,
            afterRead,
            beforeRead,
            beforeDelete,
            onOversize,
            onExceed,
            onPickRequest,
            className,
            style,
            id,
            ariaLabel,
            forceMode,
        },
        ref,
    ) {
        const mode = useDeviceMode(forceMode);
        const { items, addFiles, removeItem, retryItem, canAdd } = useUploader({
            value,
            defaultValue,
            onChange,
            multiple,
            maxCount,
            maxSize,
            accept,
            disabled,
            readonly,
            compress,
            action,
            method,
            headers,
            name,
            data,
            withCredentials,
            afterRead,
            beforeRead,
            beforeDelete,
            onOversize,
            onExceed,
        });

        // 命令句柄：addFiles 复用内部队列（校验/压缩/上传/进度全走一遍），
        // open 转发到当前实现层注册的 openPicker（回退系统弹窗）。
        const openPickerRef = React.useRef<() => void>(() => {});
        const handle = React.useMemo<UploaderHandle>(
            () => ({
                addFiles: async (files) => {
                    await addFiles(Array.isArray(files) ? files : [files]);
                },
                open: () => openPickerRef.current(),
            }),
            [addFiles],
        );
        React.useImperativeHandle(ref, () => handle, [handle]);

        const common: UploaderRenderProps = {
            items,
            canAdd,
            addFiles,
            removeItem,
            retryItem,
            accept,
            multiple,
            disabled,
            capture,
            className,
            style,
            id,
            ariaLabel,
            handle,
            onPickRequest,
            openPickerRef,
        };

        return mode === "mobile" ? (
            <H5Uploader {...common} />
        ) : (
            <PcUploader {...common} />
        );
    },
);