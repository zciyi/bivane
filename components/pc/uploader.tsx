import * as React from "react";
import { cn } from "@/lib/utils";
import {
    UploaderDropZone,
    UploaderListItem,
    type UploaderRenderProps,
} from "@/components/ui/uploader-parts";

/**
 * Bivane Uploader · PC 实现（模式 C）
 * 交互定义见 bivane-responsive-matrix.md §2.2
 *
 * 列表视图 + 顶部拖拽区。PC 独有能力在此落地（能力等价原则）：
 *  ① 拖拽：dragenter/leave 用深度计数防抖（子元素反复进出不会让高亮闪烁）；
 *  ② 粘贴：window 级 paste 监听，直接取剪贴板里的图片文件。
 * 入口仍是隐藏的 `<input type=file>`（点击拖拽区或按 Enter/Space 触发）。
 *
 * 自定义触发（onPickRequest）：点拖拽区不再打开系统弹窗，改为把命令句柄交给
 * consumer；拖拽/粘贴本就自带 File，仍直接走 addFiles，不受影响。
 */
export function PcUploader(props: UploaderRenderProps) {
    const {
        items,
        canAdd,
        addFiles,
        removeItem,
        retryItem,
        accept,
        multiple,
        disabled,
        className,
        style,
        id,
        ariaLabel,
        handle,
        onPickRequest,
        openPickerRef,
    } = props;

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const [dragActive, setDragActive] = React.useState(false);
    const dragDepth = React.useRef(0);

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
            event.target.value = "";
            if (files.length > 0) await addFiles(files);
        },
        [addFiles],
    );

    // 粘贴上传（PC 独有能力）
    React.useEffect(() => {
        if (disabled) return undefined;
        const onPaste = (event: ClipboardEvent) => {
            const files = Array.from(event.clipboardData?.files ?? []);
            if (files.length > 0) {
                event.preventDefault();
                void addFiles(files);
            }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, [disabled, addFiles]);

    const onDragEnter = (event: React.DragEvent) => {
        event.preventDefault();
        dragDepth.current += 1;
        setDragActive(true);
    };
    const onDragOver = (event: React.DragEvent) => {
        event.preventDefault();
    };
    const onDragLeave = (event: React.DragEvent) => {
        event.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragActive(false);
        }
    };
    const onDrop = (event: React.DragEvent) => {
        event.preventDefault();
        dragDepth.current = 0;
        setDragActive(false);
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length > 0) void addFiles(files);
    };

    return (
        <div
            id={id}
            data-mode="pc"
            data-slot="uploader"
            role="group"
            aria-label={ariaLabel ?? "文件上传"}
            aria-disabled={disabled || undefined}
            className={cn("flex w-full flex-col gap-bv-md", className)}
            style={style}
        >
            {canAdd && (
                <UploaderDropZone
                    active={dragActive}
                    onClick={handleTrigger}
                    onDragEnter={onDragEnter}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                />
            )}
            {items.length > 0 && (
                <div
                    data-slot="uploader-list"
                    className="flex flex-col divide-y divide-bv-gray-4 overflow-hidden rounded-bv-md border border-bv-border"
                >
                    {items.map((item) => (
                        <UploaderListItem
                            key={item.key}
                            item={item}
                            onRemove={() => void removeItem(item.key)}
                            onRetry={() => void retryItem(item.key)}
                            disabled={disabled}
                        />
                    ))}
                </div>
            )}
            <input
                ref={inputRef}
                type="file"
                data-slot="uploader-input"
                className="hidden"
                accept={accept}
                multiple={multiple}
                tabIndex={-1}
                aria-hidden
                onChange={handleChange}
            />
        </div>
    );
}