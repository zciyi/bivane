import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { formatFileSize, type UploaderFileItem } from "@/hooks/use-uploader-state";

/**
 * Bivane Uploader · 共用视觉件（两端同形，差异在容器与交互，故视觉共用）
 *
 * 宫格瓦片（uploader-grid-item）与列表行（uploader-list-item）是两种「值展示载体」，
 * 共享缩略图 / 状态遮罩 / 删除钮 / 进度视觉；拖拽区（uploader-dropzone）仅 PC 使用。
 * 槽名按「模式+角色」区分，不复用（硬约束）。
 */

/* 内联 style 只允许标识符/模板字面量（eslint no-restricted-syntax），故 token 取值提为常量 */
const GRID_SIZE = "var(--bv-uploader-grid-size)";
const DELETE_BG = "var(--bv-uploader-delete-background)";
const MASK_BG = "var(--bv-uploader-mask-background)";
const LIST_ROW_MIN_H = "var(--bv-uploader-list-row-min-height)";
const DRAG_PADDING = "var(--bv-uploader-drag-padding)";
const DRAG_BORDER = "var(--bv-uploader-drag-border)";
const PRIMARY = "var(--bv-primary)";

/**
 * 命令句柄：ref 暴露给 consumer，用于「把外部拿到的文件回填进上传控件」。
 * 典型场景是 App WebView：点「+」不走系统 <input type=file>（常被禁用/体验差），
 * 而是在 onPickRequest 里调原生 JSBridge 拿文件，再 handle.addFiles(file) 回填 ——
 * 回填走的是与手动选择完全一致的校验/压缩/上传/进度流程。
 */
export interface UploaderHandle {
    /** 回填文件：内部复用 addFiles（beforeRead/accept/maxSize/压缩/上传/进度 全走一遍） */
    addFiles: (files: File | File[]) => Promise<void>;
    /** 打开系统文件选择：在 onPickRequest 里想回退到原生弹窗时用 */
    open: () => void;
}

/* ---------------------------- 分发层→两端渲染配置 ---------------------------- */

export interface UploaderRenderProps {
    items: UploaderFileItem[];
    /** maxCount 未满且未禁用（H5 用它决定是否显示「+」宫格） */
    canAdd: boolean;
    addFiles: (files: File[]) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    retryItem: (key: string) => Promise<void>;
    /** 读取前校验是否异常；两端展示统一的友好提示 */
    readError: boolean;
    /** 是否正在重试读取前校验 */
    isRetryingRead: boolean;
    /** 用保留的原始文件重试校验 */
    retryRead: () => Promise<void>;
    accept?: string;
    multiple: boolean;
    disabled: boolean;
    /** H5 唤起相机（capture）；PC 忽略 */
    capture?: boolean | "user" | "environment";
    /** 分发层组装好的命令句柄（实现层触发 onPickRequest / handle.open 时用） */
    handle: UploaderHandle;
    /** 自定义选文件触发：传了它，点「+」/拖拽区不再打开系统弹窗，改为回调 consumer */
    onPickRequest?: (handle: UploaderHandle) => void;
    /** 各实现层把自己的 openPicker 注册到这里，供 handle.open() 回调用 */
    openPickerRef: React.MutableRefObject<() => void>;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    ariaLabel?: string;
}

/* ---------------------------- 读取失败反馈 ---------------------------- */

export function UploaderReadFeedback({
    readError,
    isRetryingRead,
    retryRead,
    canAdd,
}: Pick<UploaderRenderProps, "readError" | "isRetryingRead" | "retryRead" | "canAdd">) {
    if (!readError && !isRetryingRead) return null;
    return (
        <div
            data-slot="uploader-read-feedback"
            role={isRetryingRead ? "status" : "alert"}
            className="flex w-full items-center gap-bv-sm text-bv-sm text-bv-text-3"
        >
            <span>{isRetryingRead ? "正在重新校验文件…" : "文件校验失败，请重试或重新选择文件"}</span>
            {!isRetryingRead && (
                <button
                    type="button"
                    onClick={() => void retryRead()}
                    disabled={!canAdd}
                    className="text-bv-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                    重试校验
                </button>
            )}
        </div>
    );
}

/* ------------------------------- 缩略图 ------------------------------- */

export interface UploaderThumbProps {
    item: UploaderFileItem;
    /** 宫格瓦片铺满 vs 列表小方图 */
    variant: "grid" | "list";
    className?: string;
}

function UploaderThumb({ item, variant, className }: UploaderThumbProps) {
    const slot =
        variant === "grid" ? "uploader-grid-thumb" : "uploader-list-thumb";
    const size =
        variant === "grid"
            ? "var(--bv-uploader-grid-size)"
            : "var(--bv-uploader-thumb-size)";

    return (
        <span
            data-slot={slot}
            className={cn(
                "relative flex items-center justify-center overflow-hidden bg-bv-border",
                className,
            )}
            style={{ width: size, height: size }}
        >
            {item.url ? (
                <img
                    src={item.url}
                    alt={item.name ?? ""}
                    className="h-full w-full object-cover"
                    data-slot="uploader-thumb-img"
                />
            ) : (
                <span className="flex flex-col items-center gap-1 p-1 text-bv-text-3">
                    <Icon name="description" size={variant === "grid" ? 22 : 18} />
                    {variant === "grid" ? (
                        <span className="max-w-full truncate px-1 text-center text-bv-xs leading-[var(--bv-line-xs)]">
                            {item.name ?? "文件"}
                        </span>
                    ) : null}
                </span>
            )}
        </span>
    );
}

/* ------------------------------- 删除钮 ------------------------------- */

export interface UploaderDeleteBtnProps {
    onDelete: () => void;
    disabled?: boolean;
    /** 宫格里绝对定位到右上角 */
    floating?: boolean;
}

export function UploaderDeleteBtn({
    onDelete,
    disabled,
    floating,
}: UploaderDeleteBtnProps) {
    const box = floating ? 20 : 24;
    return (
        <button
            type="button"
            data-slot="uploader-delete"
            aria-label="删除文件"
            disabled={disabled}
            onClick={(e) => {
                e.stopPropagation();
                onDelete();
            }}
            className={cn(
                "flex items-center justify-center rounded-full text-white outline-none",
                "disabled:pointer-events-none disabled:opacity-50",
                floating
                    ? "absolute right-0 top-0 translate-x-1/3 -translate-y-1/3"
                    : "shrink-0",
            )}
            style={{
                width: box,
                height: box,
                background: DELETE_BG,
            }}
        >
            <Icon name="cross" size="var(--bv-uploader-delete-size)" />
        </button>
    );
}

/* --------------------------- 宫格瓦片（H5） --------------------------- */

export interface UploaderGridItemProps {
    item: UploaderFileItem;
    onRemove: () => void;
    onRetry: () => void;
    disabled?: boolean;
}

export function UploaderGridItem({
    item,
    onRemove,
    onRetry,
    disabled,
}: UploaderGridItemProps) {
    const failed = item.status === "failed";
    const uploading = item.status === "uploading";
    return (
        <div
            data-slot="uploader-grid-item"
            data-status={item.status}
            data-key={item.key}
            className="relative"
            style={{ width: GRID_SIZE, height: GRID_SIZE }}
        >
            <UploaderThumb
                item={item}
                variant="grid"
                className="rounded-bv-md"
            />
            {(uploading || failed) && (
                <div
                    data-slot="uploader-grid-mask"
                    className={cn(
                        "absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-bv-md text-white",
                        failed ? "cursor-pointer" : "pointer-events-none",
                    )}
                    style={{ background: MASK_BG }}
                    onClick={failed ? onRetry : undefined}
                    aria-label={failed ? "重试上传" : undefined}
                >
                    {uploading ? (
                        <>
                            <Icon name="loading" size="var(--bv-uploader-mask-icon-size)" />
                            {/* 只有真的有进度源（XHR 或业务调 onProgress）才显示数字；
                                percent 恒 0 时只转圈 —— 显示「0%」是误导。 */}
                            {item.percent > 0 ? (
                                <span className="text-bv-xs leading-[var(--bv-line-xs)]">
                                    {item.percent}%
                                </span>
                            ) : null}
                        </>
                    ) : (
                        <>
                            <Icon name="fail" size="var(--bv-uploader-mask-icon-size)" />
                            <span className="text-bv-xs leading-[var(--bv-line-xs)]">重试</span>
                        </>
                    )}
                </div>
            )}
            {!disabled && (
                <UploaderDeleteBtn onDelete={onRemove} floating />
            )}
        </div>
    );
}

/* --------------------------- 「+」宫格（H5） --------------------------- */

export interface UploaderAddTileProps {
    onClick: () => void;
    ariaLabel?: string;
}

export function UploaderAddTile({ onClick, ariaLabel }: UploaderAddTileProps) {
    return (
        <button
            type="button"
            data-slot="uploader-add"
            aria-label={ariaLabel ?? "选择文件"}
            onClick={onClick}
            className="flex items-center justify-center rounded-bv-md border border-dashed border-bv-gray-4 bg-bv-muted text-bv-text-3 outline-none active:bg-bv-border"
            style={{ width: GRID_SIZE, height: GRID_SIZE }}
        >
            <Icon name="plus" size={24} />
        </button>
    );
}

/* ---------------------------- 列表行（PC） ---------------------------- */

export interface UploaderListItemProps {
    item: UploaderFileItem;
    onRemove: () => void;
    onRetry: () => void;
    disabled?: boolean;
}

export function UploaderListItem({
    item,
    onRemove,
    onRetry,
    disabled,
}: UploaderListItemProps) {
    const failed = item.status === "failed";
    const uploading = item.status === "uploading";
    return (
        <div
            data-slot="uploader-list-item"
            data-status={item.status}
            data-key={item.key}
            className="flex items-center gap-bv-sm px-bv-sm"
            style={{ minHeight: LIST_ROW_MIN_H }}
        >
            <UploaderThumb item={item} variant="list" className="rounded-bv-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-bv-md leading-[var(--bv-line-md)] text-bv-text">
                    {item.name ?? "文件"}
                </span>
                <span className="text-bv-xs leading-[var(--bv-line-xs)] text-bv-text-3">
                    {item.file ? formatFileSize(item.file.size) : ""}
                    {failed && item.message ? ` · ${item.message}` : ""}
                </span>
                {uploading && (
                    <span
                        data-slot="uploader-list-progress"
                        className="relative h-1 w-full overflow-hidden rounded-full bg-bv-border"
                    >
                        <span
                            className="absolute left-0 top-0 h-full rounded-full bg-bv-primary"
                            style={{ width: `${item.percent}%` }}
                        />
                    </span>
                )}
            </div>
            {failed && !disabled && (
                <button
                    type="button"
                    data-slot="uploader-list-retry"
                    aria-label="重试上传"
                    onClick={onRetry}
                    className="flex shrink-0 items-center justify-center p-bv-base text-bv-primary outline-none"
                >
                    <Icon name="replay" size={18} />
                </button>
            )}
            {uploading && (
                <span
                    data-slot="uploader-list-spinner"
                    className="flex shrink-0 items-center justify-center p-bv-base text-bv-text-3"
                >
                    <Icon name="loading" size={18} />
                </span>
            )}
            {!disabled && <UploaderDeleteBtn onDelete={onRemove} />}
        </div>
    );
}

/* ---------------------------- 拖拽区（PC） ---------------------------- */

export interface UploaderDropZoneProps {
    active: boolean;
    onClick: () => void;
    onDragEnter: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    hint?: React.ReactNode;
}

export function UploaderDropZone(props: UploaderDropZoneProps) {
    const { active, onClick, hint } = props;
    return (
        <div
            data-slot="uploader-dropzone"
            data-active={active || undefined}
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            }}
            onDragEnter={props.onDragEnter}
            onDragOver={props.onDragOver}
            onDragLeave={props.onDragLeave}
            onDrop={props.onDrop}
            className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-bv-base rounded-bv-md border border-dashed text-bv-text-3 outline-none",
                active && "bg-bv-active",
            )}
            style={{
                padding: DRAG_PADDING,
                borderColor: active ? PRIMARY : DRAG_BORDER,
            }}
        >
            <Icon name="upload" size={24} />
            <span className="text-bv-md leading-[var(--bv-line-md)]">
                {hint ?? "点击或拖拽文件到此处上传"}
            </span>
        </div>
    );
}