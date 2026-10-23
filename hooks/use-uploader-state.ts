import * as React from "react";

/**
 * Bivane Uploader · 上传队列状态机（对齐 Vant 4 uploader）
 *
 * 只做：文件 → 校验 → 压缩 → 入列 → 逐个上传（afterRead 或内置 XHR）→ 状态/进度。
 * 可单测的逻辑收敛为纯函数；React 绑定只薄薄一层。
 *
 * 传输两种驱动（并存）：
 *  ① afterRead(item) => Promise<void>：业务自理上传，resolve→done / reject→failed。
 *  ② action URL：库用 XMLHttpRequest 上传并监听 upload.onprogress 写 percent。
 *  两者都没有时仅本地预览（status 直接 done）。
 */

/* ---------------------------- 类型 ---------------------------- */

export type UploaderStatus = "uploading" | "done" | "failed";

export interface UploaderFileItem {
    /** 稳定 id（库生成；受控值回传时以此合并运行时状态） */
    key: string;
    /** 原始文件（addFiles 时填充；预览与 XHR 上传需要） */
    file?: File;
    /** 预览 / 远程地址 */
    url?: string;
    status: UploaderStatus;
    /** 上传进度 0~100 */
    percent: number;
    /** 失败原因 */
    message?: string;
    /** 文件名兜底（受控值未带 file 时显示） */
    name?: string;
}

export interface UploaderTransportOptions {
    action: string;
    method?: string;
    headers?: Record<string, string>;
    /** 表单字段名，默认 'file' */
    name?: string;
    /** 额外表单字段（或返回字段的函数，可拿到当前 item） */
    data?:
        | Record<string, string>
        | ((item: UploaderFileItem) => Record<string, string>);
    withCredentials?: boolean;
}

export type UploaderAfterRead = (
    item: UploaderFileItem,
    /** 上报真实进度 0~100。不调用它 → 上传中只显示转圈、不显示数字
     *  （库无从得知业务侧进度，显示「0%」是误导）。 */
    onProgress: (percent: number) => void,
) => void | Promise<void>;

export interface UseUploaderOptions {
    value?: UploaderFileItem[];
    defaultValue?: UploaderFileItem[];
    onChange?: (list: UploaderFileItem[]) => void;
    multiple?: boolean;
    maxCount?: number;
    maxSize?: number;
    accept?: string;
    disabled?: boolean;
    readonly?: boolean;
    compress?: boolean | { maxWidth?: number; quality?: number };
    action?: string;
    method?: string;
    headers?: Record<string, string>;
    name?: string;
    data?: UploaderTransportOptions["data"];
    withCredentials?: boolean;
    afterRead?: UploaderAfterRead;
    beforeRead?: (file: File | File[]) => boolean | Promise<boolean>;
    beforeDelete?: (item: UploaderFileItem) => boolean | Promise<boolean>;
    onOversize?: (file: File | File[]) => void;
    onExceed?: (files: File[]) => void;
}

export interface UploaderBinding {
    items: UploaderFileItem[];
    /** 入口：file input / 拖拽 / 粘贴都归到这里 */
    addFiles: (files: File[]) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    retryItem: (key: string) => Promise<void>;
    /** 是否还能再加（maxCount 满了就 false，两端用它隐藏「+」位） */
    canAdd: boolean;
    /** 读取前校验是否异常；不包含底层错误详情 */
    readError: boolean;
    /** 是否正在重试失败批次 */
    isRetryingRead: boolean;
    /** 使用保留的原始文件重新校验，重复调用不会重复提交 */
    retryRead: () => Promise<void>;
}

/* --------------------------- 纯函数 --------------------------- */

let uidSeq = 0;
function nextKey(): string {
    uidSeq += 1;
    const rnd =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `bv-up-${uidSeq}-${rnd}`;
}

/** 由原始 File 生成一个待上传项（status=uploading, percent=0） */
export function createFileItem(file: File): UploaderFileItem {
    return {
        key: nextKey(),
        file,
        name: file.name,
        status: "uploading",
        percent: 0,
    };
}

/** 是否为图片（缩略图预览 vs 文件图标） */
export function isImageFile(file?: File): boolean {
    if (!file) return false;
    if (file.type) return file.type.startsWith("image/");
    return /\.(png|jpe?g|gif|webp|heic|bmp|svg)$/i.test(file.name ?? "");
}

/** 把 accept 拆成匹配单元：MIME 子串（image/）或扩展名（.jpg） */
export function resolveAcceptList(accept?: string): string[] {
    if (!accept) return [];
    return accept
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

/** 单文件是否通过 accept 过滤（无 accept 一律通过） */
export function matchAccept(file: File, accept?: string): boolean {
    const list = resolveAcceptList(accept);
    if (list.length === 0) return true;
    const type = (file.type ?? "").toLowerCase();
    const name = (file.name ?? "").toLowerCase();
    return list.some((rule) => {
        if (rule.startsWith(".")) return name.endsWith(rule);
        // MIME 通配：image/* 表示该主类型任意子类型，取 * 前缀比对
        if (rule.includes("*")) {
            const prefix = rule.replace(/\*+$/, "");
            return type.startsWith(prefix) || name.includes(prefix);
        }
        return type.startsWith(rule) || name.includes(rule);
    });
}

/** 单文件是否在 maxSize（字节）之内；undefined 时通过 */
export function validateFileSize(file: File, maxSize?: number): boolean {
    if (maxSize == null) return true;
    return file.size <= maxSize;
}

/** 人类可读文件大小 */
export function formatFileSize(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    const value = bytes / Math.pow(1024, i);
    const text =
        i === 0 || Number.isInteger(value)
            ? String(Math.round(value))
            : value.toFixed(1);
    return `${text} ${units[i]}`;
}

export interface CompressOptions {
    maxWidth: number;
    quality: number;
}

export function normalizeCompress(
    compress: boolean | { maxWidth?: number; quality?: number } | undefined,
): CompressOptions | null {
    if (!compress) return null;
    const c = typeof compress === "object" ? compress : {};
    return { maxWidth: c.maxWidth ?? 1080, quality: c.quality ?? 0.8 };
}

/**
 * canvas 等比缩放 + toBlob 降质（仅图片）。无 canvas/Image 的环境
 * （jsdom 等）安全回退原文件，不抛错 —— 压缩是增强项，永不阻断上传。
 */
export function compressImage(file: File, opts: CompressOptions): Promise<File> {
    if (!isImageFile(file)) return Promise.resolve(file);
    if (
        typeof document === "undefined" ||
        typeof Image === "undefined" ||
        typeof URL === "undefined"
    ) {
        return Promise.resolve(file);
    }
    return new Promise<File>((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        const fail = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.onerror = fail;
        img.onload = () => {
            URL.revokeObjectURL(url);
            const ratio = Math.min(1, opts.maxWidth / Math.max(1, img.width));
            const width = Math.max(1, Math.round(img.width * ratio));
            const height = Math.max(1, Math.round(img.height * ratio));
            try {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return resolve(file);
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) =>
                        resolve(
                            blob
                                ? new File([blob], file.name, {
                                      type: blob.type || file.type,
                                      lastModified: file.lastModified,
                                  })
                                : file,
                        ),
                    file.type || "image/jpeg",
                    opts.quality,
                );
            } catch {
                resolve(file);
            }
        };
        img.src = url;
    });
}

/**
 * 内置 XHR 上传：FormData(data + file)，upload.onprogress 回报进度。
 * 业务未在 FormData 里给 file 命名时用 opts.name（默认 'file'）。
 */
export function transportXHR(
    item: UploaderFileItem,
    opts: UploaderTransportOptions,
    onProgress: (percent: number) => void,
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (typeof XMLHttpRequest === "undefined" || !item.file) {
            reject(new Error("XHR transport unavailable"));
            return;
        }
        const xhr = new XMLHttpRequest();
        xhr.open(opts.method ?? "POST", opts.action, true);
        if (opts.withCredentials) xhr.withCredentials = true;
        if (opts.headers) {
            Object.entries(opts.headers).forEach(([k, v]) =>
                xhr.setRequestHeader(k, v),
            );
        }
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
            }
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`HTTP ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("network error"));
        xhr.ontimeout = () => reject(new Error("timeout"));
        const fd = new FormData();
        const extra =
            typeof opts.data === "function" ? opts.data(item) : opts.data;
        if (extra) {
            Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
        }
        fd.append(opts.name ?? "file", item.file, item.file.name);
        xhr.send(fd);
    });
}

function errMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    return String(err);
}

/* ------------------------ React 绑定 ------------------------- */

export function useUploader(options: UseUploaderOptions): UploaderBinding {
    const {
        value: valueProp,
        defaultValue,
        onChange,
        multiple = false,
        maxCount,
        maxSize,
        accept,
        disabled = false,
        readonly = false,
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
    } = options;

    const isControlled = valueProp !== undefined;
    const [inner, setInner] = React.useState<UploaderFileItem[]>(
        () => valueProp ?? defaultValue ?? [],
    );
    const [failedRead, setFailedRead] = React.useState<File[] | null>(null);
    const [isRetryingRead, setIsRetryingRead] = React.useState(false);
    const retryingReadRef = React.useRef(false);
    const itemsRef = React.useRef<UploaderFileItem[]>(inner);
    // 最后一次 emit 的列表：受控回传同一引用时不再二次 set，避免上传循环
    const emitted = React.useRef<UploaderFileItem[]>(inner);

    // 受控：外部 value 变化才同步（跳过自己刚 emit 的那次）
    React.useEffect(() => {
        if (!isControlled) return;
        if (valueProp === emitted.current) return;
        itemsRef.current = valueProp ?? [];
        setInner(valueProp ?? []);
    }, [valueProp, isControlled]);

    const commit = React.useCallback(
        (next: UploaderFileItem[]) => {
            itemsRef.current = next;
            emitted.current = next;
            if (!isControlled) setInner(next);
            onChange?.(next);
        },
        [isControlled, onChange],
    );

    const update = React.useCallback(
        (mut: (prev: UploaderFileItem[]) => UploaderFileItem[]) => {
            commit(mut(itemsRef.current));
        },
        [commit],
    );

    const patch = React.useCallback(
        (key: string, changes: Partial<UploaderFileItem>) => {
            update((list) =>
                list.map((it) => (it.key === key ? { ...it, ...changes } : it)),
            );
        },
        [update],
    );

    /** 上传单个已入列项：afterRead 优先，其次 action XHR，都没有则本地完成 */
    const uploadItem = React.useCallback(
        async (item: UploaderFileItem) => {
            const key = item.key;
            patch(key, { status: "uploading", percent: 0, message: undefined });
            try {
                if (afterRead) {
                    // 业务自理上传：把进度回调交给它，用了才有真进度
                    await afterRead(item, (p) => {
                        patch(key, {
                            percent: Math.max(0, Math.min(100, Math.round(p))),
                        });
                    });
                } else if (action && item.file) {
                    await transportXHR(
                        item,
                        { action, method, headers, name, data, withCredentials },
                        (percent) => patch(key, { percent }),
                    );
                }
                patch(key, { status: "done", percent: 100 });
            } catch (err) {
                patch(key, { status: "failed", message: errMessage(err) });
            }
        },
        [afterRead, action, method, headers, name, data, withCredentials, patch],
    );

    const prepareFiles = React.useCallback(
        async (incoming: File[]): Promise<UploaderFileItem[]> => {
            if (disabled || readonly || incoming.length === 0) return [];
            setFailedRead(null);
            let files = incoming.slice();
            if (!multiple) files = files.slice(0, 1);

            // maxCount：超出部分不入列并回调 onExceed
            const current = itemsRef.current.length;
            if (maxCount != null) {
                const remaining = maxCount - current;
                if (remaining <= 0) {
                    onExceed?.(files);
                    return [];
                }
                if (files.length > remaining) {
                    onExceed?.(files.slice(remaining));
                    files = files.slice(0, remaining);
                }
            }

            // beforeRead：false 拦截整批（Vant 语义）
            if (beforeRead) {
                try {
                    const ok = await beforeRead(multiple ? files : files[0]);
                    if (!ok) return [];
                } catch {
                    // 文件尚未入列，保留这一批供原样重试，不把业务校验异常泄漏给事件入口。
                    setFailedRead(files);
                    return [];
                }
            }

            const cOpts = normalizeCompress(compress);
            const prepared: File[] = [];
            const originalFiles: File[] = [];
            for (const file of files) {
                if (!matchAccept(file, accept)) continue;
                if (!validateFileSize(file, maxSize)) {
                    onOversize?.(file);
                    continue;
                }
                prepared.push(cOpts ? await compressImage(file, cOpts) : file);
                originalFiles.push(file);
            }

            // 异步校验与压缩期间其他入口可能已入列；以提交时的实时队列重新分配名额。
            const remaining = maxCount == null ? prepared.length : Math.max(0, maxCount - itemsRef.current.length);
            const accepted = prepared.slice(0, remaining);
            const exceeded = originalFiles.slice(remaining);
            const created = accepted.map((f) => {
                const item = createFileItem(f);
                if (isImageFile(f) && typeof URL !== "undefined") {
                    try {
                        item.url = URL.createObjectURL(f);
                    } catch {
                        /* 无 createObjectURL 时不预览图片，退回文件图标 */
                    }
                }
                return item;
            });
            if (created.length > 0) update((list) => [...list, ...created]);
            if (exceeded.length > 0) onExceed?.(exceeded);
            return created;
        },
        [
            disabled, readonly, multiple, maxCount, beforeRead, compress,
            accept, maxSize, onOversize, onExceed, update,
        ],
    );

    const addFiles = React.useCallback(async (incoming: File[]) => {
        const created = await prepareFiles(incoming);
        await Promise.all(created.map((it) => uploadItem(it)));
    }, [prepareFiles, uploadItem]);

    const retryRead = React.useCallback(async () => {
        if (!failedRead || disabled || readonly || retryingReadRef.current) return;
        retryingReadRef.current = true;
        setIsRetryingRead(true);
        let created: UploaderFileItem[];
        try {
            created = await prepareFiles(failedRead);
        } finally {
            // 校验重试只锁定文件准备阶段，不能让后续批次等待当前文件上传完成。
            retryingReadRef.current = false;
            setIsRetryingRead(false);
        }
        await Promise.all(created.map((it) => uploadItem(it)));
    }, [failedRead, disabled, readonly, prepareFiles, uploadItem]);

    const removeItem = React.useCallback(
        async (key: string) => {
            if (readonly || disabled) return;
            const target = itemsRef.current.find((it) => it.key === key);
            if (!target) return;
            if (beforeDelete) {
                const ok = await beforeDelete(target);
                if (!ok) return;
            }
            if (target.url && typeof URL !== "undefined") {
                try {
                    URL.revokeObjectURL(target.url);
                } catch {
                    /* 忽略 */
                }
            }
            update((list) => list.filter((it) => it.key !== key));
        },
        [readonly, disabled, beforeDelete, update],
    );

    const retryItem = React.useCallback(
        async (key: string) => {
            if (disabled || readonly) return;
            const target = itemsRef.current.find((it) => it.key === key);
            if (!target) return;
            await uploadItem(target);
        },
        [disabled, readonly, uploadItem],
    );

    const canAdd =
        !disabled &&
        !readonly &&
        (maxCount == null || itemsRef.current.length < maxCount);

    // ⚠️ 受控时展示列表必须直接取自 valueProp：
    // commit 在受控分支不 setInner（值由父组件掌控），而上面那个同步 effect 又会在
    // 「父组件回传的就是我刚 emit 的那个引用」时提前 return（emitted 短路）——
    // 两者叠加会让 inner 永远停在初始值，新选的文件一条都不显示（实测：受控 Uploader
    // 选文件后毫无反应）。这里以 value 为唯一事实源，非受控才用内部态。
    const items = isControlled ? (valueProp ?? []) : inner;

    return { items, addFiles, removeItem, retryItem, canAdd, readError: failedRead !== null, isRetryingRead, retryRead };
}