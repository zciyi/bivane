import * as React from "react";
import { cn } from "@/lib/utils";
import {
    UploaderAddTile,
    UploaderGridItem,
    type UploaderRenderProps,
} from "@/components/ui/uploader-parts";

/**
 * Bivane Uploader · H5 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 宫格预览：每文件一瓦片，图片走缩略图、非图片走文件图标；上传中遮罩转圈+百分比，
 * 失败遮罩可点重试。入口是「+」宫格，点它唤起 `<input type=file>`；
 * `capture` 透传给 input 以直接唤起相机。选中后立即重置 input.value，
 * 保证同一文件可再次选择。
 *
 * 自定义触发（onPickRequest）：传了它，点「+」不再打开系统弹窗，改为把命令句柄
 * 交给 consumer（对接 App JSBridge），拿到文件后 handle.addFiles 回填；不传则
 * 照旧打开 file input。openPicker 注册进 openPickerRef 供 handle.open() 回退。
 */
export function H5Uploader(props: UploaderRenderProps) {
    const {
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
    } = props;

    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const openPicker = React.useCallback(() => {
        if (!disabled) inputRef.current?.click();
    }, [disabled]);

    // 把 openPicker 注册给分发层的句柄，供 handle.open() 回退到系统弹窗
    React.useEffect(() => {
        openPickerRef.current = openPicker;
    });

    const handleTrigger = React.useCallback(() => {
        if (onPickRequest) onPickRequest(handle);
        else openPicker();
    }, [onPickRequest, handle, openPicker]);

    const handleChange = React.useCallback(
        async (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.target.files ?? []);
            // 先清空再 await：同一文件重选仍能触发 change
            event.target.value = "";
            if (files.length > 0) await addFiles(files);
        },
        [addFiles],
    );

    return (
        <div
            id={id}
            data-mode="h5"
            data-slot="uploader"
            role="group"
            aria-label={ariaLabel ?? "文件上传"}
            aria-disabled={disabled || undefined}
            className={cn(
                "flex flex-wrap items-start gap-[var(--bv-uploader-grid-gap)]",
                className,
            )}
            style={style}
        >
            {items.map((item) => (
                <UploaderGridItem
                    key={item.key}
                    item={item}
                    onRemove={() => void removeItem(item.key)}
                    onRetry={() => void retryItem(item.key)}
                    disabled={disabled}
                />
            ))}
            {canAdd && <UploaderAddTile onClick={handleTrigger} ariaLabel={ariaLabel} />}
            <input
                ref={inputRef}
                type="file"
                data-slot="uploader-input"
                className="hidden"
                accept={accept}
                multiple={multiple}
                {...(capture ? { capture } : {})}
                tabIndex={-1}
                aria-hidden
                onChange={handleChange}
            />
        </div>
    );
}