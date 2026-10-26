import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUploader, type UploaderFileItem } from '@/hooks/use-uploader-state';

const createUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const revokeUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
const createUrl = vi.fn(() => 'blob:uploader-owned');
const revokeUrl = vi.fn();

beforeEach(() => {
    createUrl.mockClear();
    revokeUrl.mockClear();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeUrl });
});

afterEach(() => {
    vi.restoreAllMocks();
    if (createUrlDescriptor) Object.defineProperty(URL, 'createObjectURL', createUrlDescriptor);
    else Reflect.deleteProperty(URL, 'createObjectURL');
    if (revokeUrlDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeUrlDescriptor);
    else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('Uploader 生命周期', () => {
    it.each(['addFiles', 'retryRead'] as const)('%s 等待校验期间卸载，不再创建预览或启动上传', async (entry) => {
        let finishRead: (ok: boolean) => void = () => undefined;
        const gate = new Promise<boolean>((resolve) => { finishRead = resolve; });
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>();
        if (entry === 'retryRead') beforeRead.mockRejectedValueOnce(new Error('校验失败'));
        beforeRead.mockReturnValue(gate);
        const afterRead = vi.fn();
        const onChange = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ beforeRead, afterRead, onChange }));
        const file = new File(['a'], 'a.png', { type: 'image/png' });
        if (entry === 'retryRead') await act(async () => { await result.current.addFiles([file]); });
        let pending: Promise<void> = Promise.resolve();
        act(() => { pending = entry === 'addFiles' ? result.current.addFiles([file]) : result.current.retryRead(); });
        unmount();
        await act(async () => { finishRead(true); await pending; });
        expect(createUrl).not.toHaveBeenCalled();
        expect(afterRead).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('卸载后保留的 addFiles 句柄不再执行校验', async () => {
        const beforeRead = vi.fn(() => true);
        const afterRead = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ beforeRead, afterRead }));
        const addFiles = result.current.addFiles;
        unmount();
        await act(async () => { await addFiles([new File(['a'], 'a.png', { type: 'image/png' })]); });
        expect(beforeRead).not.toHaveBeenCalled();
        expect(createUrl).not.toHaveBeenCalled();
        expect(afterRead).not.toHaveBeenCalled();
    });

    it('压缩等待期间卸载，不再处理后续文件或创建上传预览', async () => {
        const images: HTMLImageElement[] = [];
        vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (this: HTMLImageElement) {
            images.push(this);
        });
        const afterRead = vi.fn();
        const onChange = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ multiple: true, compress: true, afterRead, onChange }));
        const files = ['a.png', 'b.png'].map((name) => new File(['a'], name, { type: 'image/png' }));
        let pending: Promise<void> = Promise.resolve();
        act(() => { pending = result.current.addFiles(files); });
        expect(images).toHaveLength(1);
        unmount();
        await act(async () => { images[0].dispatchEvent(new Event('error')); });
        // 先记录是否继续压缩，再结清旧实现可能已创建的第二个压缩任务。
        const startedImages = images.length;
        await act(async () => {
            for (const image of images.slice(1)) image.dispatchEvent(new Event('error'));
            await pending;
        });
        expect(startedImages).toBe(1);
        expect(createUrl).toHaveBeenCalledTimes(1);
        expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:uploader-owned');
        expect(afterRead).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('入列回调触发卸载后不再启动上传', async () => {
        let unmountUploader: () => void = () => undefined;
        const afterRead = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ afterRead, onChange: () => unmountUploader() }));
        unmountUploader = unmount;
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.png', { type: 'image/png' })]); });
        expect(createUrl).toHaveBeenCalledTimes(1);
        expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:uploader-owned');
        expect(afterRead).not.toHaveBeenCalled();
    });

    it('卸载只释放本实例创建的预览，不释放外部传入地址', async () => {
        const external: UploaderFileItem = { key: 'external', url: 'blob:external', status: 'done', percent: 100 };
        const { result, unmount } = renderHook(() => useUploader({ defaultValue: [external] }));
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.png', { type: 'image/png' })]); });
        unmount();
        expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:uploader-owned');
        expect(revokeUrl).not.toHaveBeenCalledWith('blob:external');
    });

    it('卸载后已开始上传的进度和完成回调不再通知列表变化', async () => {
        let finishUpload: () => void = () => undefined;
        const upload = new Promise<void>((resolve) => { finishUpload = resolve; });
        let reportProgress: (percent: number) => void = () => undefined;
        const afterRead = vi.fn((_item: UploaderFileItem, onProgress: (percent: number) => void) => {
            reportProgress = onProgress;
            return upload;
        });
        const onChange = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ afterRead, onChange }));
        let pending: Promise<void> = Promise.resolve();
        await act(async () => { pending = result.current.addFiles([new File(['a'], 'a.txt')]); });
        expect(afterRead).toHaveBeenCalledTimes(1);
        unmount();
        const changesBefore = onChange.mock.calls.length;
        await act(async () => { reportProgress(50); finishUpload(); await pending; });
        expect(onChange).toHaveBeenCalledTimes(changesBefore);
    });

    it('等待校验期间卸载，不再启动内置 XHR 上传', async () => {
        let finishRead: (ok: boolean) => void = () => undefined;
        const gate = new Promise<boolean>((resolve) => { finishRead = resolve; });
        const open = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(() => undefined);
        const send = vi.spyOn(XMLHttpRequest.prototype, 'send').mockImplementation(function (this: XMLHttpRequest) {
            this.dispatchEvent(new ProgressEvent('load'));
        });
        const { result, unmount } = renderHook(() => useUploader({ action: '/upload', beforeRead: () => gate }));
        let pending: Promise<void> = Promise.resolve();
        act(() => { pending = result.current.addFiles([new File(['a'], 'a.txt')]); });
        unmount();
        await act(async () => { finishRead(true); await pending; });
        expect(open).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it('删除时已释放的预览不会在卸载时重复释放', async () => {
        const { result, unmount } = renderHook(() => useUploader({}));
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.png', { type: 'image/png' })]); });
        const key = result.current.items[0].key;
        await act(async () => { await result.current.removeItem(key); });
        unmount();
        expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:uploader-owned');
    });

    it('StrictMode 重放 effect 后仍可正常选择并上传文件', async () => {
        const afterRead = vi.fn();
        const { result, unmount } = renderHook(() => useUploader({ afterRead }), { wrapper: StrictMode });
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.png', { type: 'image/png' })]); });
        expect(afterRead).toHaveBeenCalledTimes(1);
        expect(result.current.items[0]?.status).toBe('done');
        unmount();
        expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:uploader-owned');
    });
});
