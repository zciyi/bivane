import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { List } from '@/components/responsive/list';
import { Table } from '@/components/responsive/table';
import { Slider } from '@/components/responsive/slider';
import { Uploader } from '@/components/responsive/uploader';
import { DialogHost, closeDialog, showDialog, type DialogHandle } from '@/components/responsive/dialog';
import { resetDialogStore } from '@/hooks/use-dialog-store';
import { useTableState, type TableColumn } from '@/hooks/use-table-state';
import { useUploader } from '@/hooks/use-uploader-state';
import { useSliderValue } from '@/hooks/use-slider-state';

interface BusinessRow {
    /** 刷新前后保持不变的业务标识 */
    code: string;
    /** 行展示名称 */
    name: string;
}

const columns: TableColumn[] = [
    { key: 'name', title: '名称', sortable: true, filterable: true, filters: ['A', 'B'] },
];

function element(container: ParentNode, selector: string): HTMLElement {
    const node = container.querySelector<HTMLElement>(selector);
    if (!node) throw new Error('测试目标不存在：' + selector);
    return node;
}

function paste(target: HTMLElement, file: File, prevented = false): Event {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { files: [file] } });
    if (prevented) event.preventDefault();
    fireEvent(target, event);
    return event;
}

afterEach(() => {
    act(() => resetDialogStore());
    vi.restoreAllMocks();
});

describe('审查回归 · 固定高度虚拟列表', () => {
    it('滚动后更新窗口，而不是保留首屏记录', () => {
        const { container } = render(
            <List data={Array.from({ length: 200 }, (_, index) => index)}
                renderItem={(item) => <span>{'记录-' + String(item)}</span>}
                virtual height={200} itemHeight={20} forceMode="desktop" />,
        );
        expect(screen.queryByText('记录-100')).toBeNull();
        fireEvent.scroll(element(container, '[data-slot="list-scroll"]'), { target: { scrollTop: 2000 } });
        expect(screen.getByText('记录-100')).toBeInTheDocument();
        expect(screen.queryByText('记录-0')).toBeNull();
    });
});

describe('审查回归 · 表格行身份与跨页选择', () => {
    it('无 id 的行在排序、筛选和分页后保留原始身份', () => {
        const data = [{ name: 'B' }, { name: 'A' }];
        const { result } = renderHook(() => useTableState({ columns, data, pagination: true, paginationMode: 'local', pageSize: 1 }));
        act(() => result.current.toggleRow('0'));
        act(() => result.current.toggleSort('name'));
        expect(result.current.rows).toEqual([data[1]]);
        expect(result.current.rowKeys).toEqual(['1']);
        act(() => result.current.page.setPage(2));
        expect(result.current.rowKeys).toEqual(['0']);
        expect(result.current.isRowSelected(result.current.rowKeys[0])).toBe(true);
        act(() => result.current.toggleFilter('name', 'A'));
        expect(result.current.rowKeys).toEqual(['1']);
        expect(result.current.isRowSelected(result.current.rowKeys[0])).toBe(false);
    });

    it.each(['mobile', 'desktop'] as const)('%s 视图使用共享行标识，不按展示位置重算', (forceMode) => {
        const data = [{ name: 'B' }, { name: 'A' }];
        const onSelectionChange = vi.fn();
        const { container, rerender } = render(<Table columns={columns} data={data} forceMode={forceMode}
            defaultSelectedKeys={['0']} onSelectionChange={onSelectionChange} />);
        rerender(<Table columns={columns} data={data} forceMode={forceMode}
            defaultSelectedKeys={['0']} onSelectionChange={onSelectionChange} sort={{ key: 'name', order: 'asc' }} />);
        const selected = element(container, '[role="checkbox"][aria-checked="true"]');
        const row = selected.closest('tr, [data-slot="table-card"]');
        expect(row).toHaveTextContent('B');
        expect(row).not.toHaveTextContent('A');
    });

    it('支持自定义业务行标识，数据刷新后仍能匹配选中项', () => {
        const rowKey = (row: unknown) => (row as BusinessRow).code;
        const { result, rerender } = renderHook(({ data }) => useTableState({ columns, data, rowKey }), {
            initialProps: { data: [{ code: 'b', name: 'B' }, { code: 'a', name: 'A' }] },
        });
        act(() => result.current.toggleRow('b'));
        rerender({ data: [{ code: 'a', name: 'A' }, { code: 'b', name: 'B' }] });
        expect(result.current.rowKeys).toEqual(['a', 'b']);
        expect(result.current.isRowSelected('b')).toBe(true);
    });

    it('重复原始值在排序后也保留各自的原始下标', () => {
        const row = { name: 'B' };
        const { result } = renderHook(() => useTableState({ columns, data: [row, { name: 'A' }, row], defaultSort: { key: 'name', order: 'asc' } }));
        expect(result.current.rowKeys).toEqual(['1', '0', '2']);
    });

    it.each([false, true])('当前页全选与反选不覆盖其他页（受控=%s）', (controlled) => {
        const onSelectionChange = vi.fn();
        const data = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
        const { result, rerender } = renderHook(({ selectedKeys }) => useTableState({ columns, data,
            pagination: true, paginationMode: 'local', pageSize: 1, onSelectionChange,
            defaultSelectedKeys: ['a'], selectedKeys: controlled ? selectedKeys : undefined,
        }), { initialProps: { selectedKeys: ['a'] } });
        act(() => result.current.page.setPage(2));
        act(() => result.current.toggleAll());
        expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'b']);
        if (controlled) rerender({ selectedKeys: ['a', 'b'] });
        act(() => result.current.toggleAll());
        expect(onSelectionChange).toHaveBeenLastCalledWith(['a']);
    });
});

describe('审查回归 · 上传粘贴与并发限额', () => {
    it('只由粘贴目标所属的上传组件接收文件', async () => {
        const first = vi.fn();
        const second = vi.fn();
        const { container } = render(<><Uploader forceMode="desktop" afterRead={first} /><Uploader forceMode="desktop" afterRead={second} /></>);
        const zone = element(container, '[data-slot="uploader-dropzone"]');
        zone.focus();
        await act(async () => { paste(zone, new File(['x'], 'image.png', { type: 'image/png' })); });
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it('不拦截其他输入区或已被处理的粘贴', async () => {
        const afterRead = vi.fn();
        const { container } = render(<><textarea aria-label="编辑区" /><Uploader forceMode="desktop" afterRead={afterRead} /></>);
        const file = new File(['x'], 'image.png', { type: 'image/png' });
        let outside: Event | undefined;
        await act(async () => {
            outside = paste(screen.getByLabelText('编辑区'), file);
            paste(element(container, '[data-slot="uploader-dropzone"]'), file, true);
        });
        expect(outside?.defaultPrevented).toBe(false);
        expect(afterRead).not.toHaveBeenCalled();
    });

    it('超限图片不会创建额外预览或触发上传', async () => {
        const originalDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
        const createUrl = vi.fn(() => 'blob:test');
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
        try {
            let release: (allowed: boolean) => void = () => undefined;
            const gate = new Promise<boolean>((resolve) => { release = resolve; });
            const afterRead = vi.fn();
            const onExceed = vi.fn();
            const { result } = renderHook(() => useUploader({ maxCount: 1, beforeRead: () => gate, afterRead, onExceed }));
            const first = new File(['a'], 'a.png', { type: 'image/png' });
            const second = new File(['b'], 'b.png', { type: 'image/png' });
            await act(async () => {
                const a = result.current.addFiles([first]);
                const b = result.current.addFiles([second]);
                release(true);
                await Promise.all([a, b]);
            });
            expect(createUrl).toHaveBeenCalledExactlyOnceWith(first);
            expect(afterRead).toHaveBeenCalledTimes(1);
            expect(onExceed).toHaveBeenCalledWith([second]);
        } finally {
            if (originalDescriptor) Object.defineProperty(URL, 'createObjectURL', originalDescriptor);
            else Reflect.deleteProperty(URL, 'createObjectURL');
        }
    });

    it('异步 beforeRead 并发结束时重新校验 maxCount', async () => {
        let release: (allowed: boolean) => void = () => undefined;
        const gate = new Promise<boolean>((resolve) => { release = resolve; });
        const afterRead = vi.fn();
        const onExceed = vi.fn();
        const { result } = renderHook(() => useUploader({ maxCount: 1, beforeRead: () => gate, afterRead, onExceed }));
        const first = new File(['a'], 'a.txt');
        const second = new File(['b'], 'b.txt');
        await act(async () => {
            const a = result.current.addFiles([first]);
            const b = result.current.addFiles([second]);
            release(true);
            await Promise.all([a, b]);
        });
        expect(result.current.items.map((item) => item.file)).toEqual([first]);
        expect(afterRead).toHaveBeenCalledTimes(1);
        expect(onExceed).toHaveBeenCalledWith([second]);
    });
});

describe('审查回归 · Slider 拖拽回调', () => {
    it.each(['mobile', 'desktop'] as const)('%s 拖拽结束返回最终值', (forceMode) => {
        const onChange = vi.fn();
        const onDragEnd = vi.fn();
        const { container } = render(<Slider defaultValue={20} forceMode={forceMode} onChange={onChange} onDragEnd={onDragEnd} />);
        const line = element(container, '[data-slot="slider-line"]');
        vi.spyOn(line, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 10));
        fireEvent(element(container, '[data-slot="slider-button"]'), new MouseEvent('pointerdown', { bubbles: true, clientX: 20 }));
        fireEvent(window, new MouseEvent('pointermove', { clientX: 80 }));
        fireEvent(window, new MouseEvent('pointerup', { clientX: 80 }));
        expect(onChange).toHaveBeenLastCalledWith(80);
        expect(onDragEnd).toHaveBeenCalledExactlyOnceWith(80);
    });

    it.each(['mobile', 'desktop'] as const)('%s 连续事件在同一批次也返回最后提交值', (forceMode) => {
        const onChange = vi.fn();
        const onDragEnd = vi.fn();
        const { container } = render(<Slider range defaultValue={[20, 90]} forceMode={forceMode} onChange={onChange} onDragEnd={onDragEnd} />);
        vi.spyOn(element(container, '[data-slot="slider-line"]'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 10));
        act(() => {
            fireEvent(element(container, '[data-slot="slider-button"]'), new MouseEvent('pointerdown', { bubbles: true }));
            fireEvent(window, new MouseEvent('pointermove', { clientX: 50 }));
            fireEvent(window, new MouseEvent('pointermove', { clientX: 80 }));
            fireEvent(window, new MouseEvent('pointerup'));
        });
        expect(onChange).toHaveBeenLastCalledWith([80, 90]);
        expect(onDragEnd).toHaveBeenCalledExactlyOnceWith([80, 90]);
    });

    it('拖拽期间替换回调后，取消拖拽调用最新回调一次', () => {
        const oldEnd = vi.fn();
        const newEnd = vi.fn();
        const { container, rerender } = render(<Slider defaultValue={20} forceMode="desktop" onDragEnd={oldEnd} />);
        vi.spyOn(element(container, '[data-slot="slider-line"]'), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 10));
        fireEvent(element(container, '[data-slot="slider-button"]'), new MouseEvent('pointerdown', { bubbles: true }));
        rerender(<Slider defaultValue={20} forceMode="desktop" onDragEnd={newEnd} />);
        fireEvent(window, new MouseEvent('pointermove', { clientX: 60 }));
        fireEvent(window, new MouseEvent('pointercancel'));
        fireEvent(window, new MouseEvent('pointerup'));
        expect(oldEnd).not.toHaveBeenCalled();
        expect(newEnd).toHaveBeenCalledExactlyOnceWith(60);
    });
});

describe('审查回归 · 命令式 Dialog 关闭生命周期', () => {
    it.each(['mobile', 'desktop'] as const)('%s 手动关闭只调用一次 onClosed', async (forceMode) => {
        render(<DialogHost />);
        const onClosed = vi.fn();
        let handle: DialogHandle | undefined;
        await act(async () => { handle = showDialog({ message: '回归弹窗', forceMode, duration: 0, onClosed }); });
        await act(async () => { handle?.close(); handle?.close(); });
        await waitFor(() => expect(screen.queryByText('回归弹窗')).toBeNull());
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it.each(['confirm', 'cancel'] as const)('%s 按钮关闭也调用 onClosed', async (action) => {
        render(<DialogHost />);
        const onClosed = vi.fn();
        await act(async () => { showDialog({ message: '按钮弹窗', showCancelButton: true, forceMode: 'mobile', duration: 0, onClosed }); });
        await act(async () => { fireEvent.click(screen.getByText(action === 'confirm' ? '确认' : '取消')); });
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it('同一批次打开后立即关闭也会清理并且只回调一次', async () => {
        render(<DialogHost />);
        const onClosed = vi.fn();
        await act(async () => { const handle = showDialog({ message: '立即关闭', onClosed }); handle.close(); closeDialog(); });
        expect(onClosed).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('立即关闭')).toBeNull();
    });

    it('关闭全部保留各弹窗的独立关闭回调', async () => {
        render(<DialogHost />);
        const first = vi.fn();
        const second = vi.fn();
        await act(async () => { showDialog({ message: '一', forceMode: 'mobile', duration: 0, onClosed: first }); showDialog({ message: '二', forceMode: 'mobile', duration: 0, onClosed: second }); });
        await act(async () => closeDialog());
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).toHaveBeenCalledTimes(1);
    });
});

describe('审查回归 · Slider 中断手势', () => {
    for (const forceMode of ['mobile', 'desktop'] as const) {
        it.each(['disabled', 'readonly'] as const)(`${forceMode} 拖拽中切换 %s 立即结束且不恢复旧手势`, (flag) => {
            const onChange = vi.fn();
            const oldEnd = vi.fn();
            const newEnd = vi.fn();
            const { container, rerender } = render(
                <Slider defaultValue={20} forceMode={forceMode} onChange={onChange} onDragEnd={oldEnd} />,
            );
            vi.spyOn(element(container, '[data-slot="slider-line"]'), 'getBoundingClientRect')
                .mockReturnValue(new DOMRect(0, 0, 100, 10));
            fireEvent(element(container, '[data-slot="slider-button"]'), new MouseEvent('pointerdown', { bubbles: true }));
            fireEvent(window, new MouseEvent('pointermove', { clientX: 40 }));
            onChange.mockClear();
            const removeListener = vi.spyOn(window, 'removeEventListener');
            rerender(<Slider defaultValue={20} forceMode={forceMode} onChange={onChange} onDragEnd={newEnd}
                disabled={flag === 'disabled'} readonly={flag === 'readonly'} />);
            expect(oldEnd).not.toHaveBeenCalled();
            expect(newEnd).toHaveBeenCalledExactlyOnceWith(40);
            expect(element(container, '[data-slot="slider-button"]')).not.toHaveAttribute('aria-pressed', 'true');
            for (const event of ['pointermove', 'pointerup', 'pointercancel']) {
                expect(removeListener).toHaveBeenCalledWith(event, expect.any(Function));
            }
            fireEvent(window, new MouseEvent('pointermove', { clientX: 80 }));
            rerender(<Slider defaultValue={20} forceMode={forceMode} onChange={onChange} onDragEnd={newEnd} />);
            fireEvent(window, new MouseEvent('pointermove', { clientX: 90 }));
            fireEvent(window, new MouseEvent('pointerup'));
            fireEvent(window, new MouseEvent('pointercancel'));
            expect(onChange).not.toHaveBeenCalled();
            expect(newEnd).toHaveBeenCalledTimes(1);
            fireEvent(element(container, '[data-slot="slider-button"]'), new MouseEvent('pointerdown', { bubbles: true }));
            fireEvent(window, new MouseEvent('pointermove', { clientX: 70 }));
            fireEvent(window, new MouseEvent('pointerup'));
            expect(onChange).toHaveBeenLastCalledWith(70);
            expect(newEnd).toHaveBeenLastCalledWith(70);
            expect(newEnd).toHaveBeenCalledTimes(2);
        });
    }

    it.each(['disabled', 'readonly'] as const)('状态入口在 %s 时拒绝直接提交', (flag) => {
        const onChange = vi.fn();
        const { result, rerender } = renderHook(({ blocked }) => useSliderValue({
            defaultValue: 20, min: 0, max: 100, step: 1, range: false,
            disabled: blocked && flag === 'disabled', readonly: blocked && flag === 'readonly', onChange,
        }), { initialProps: { blocked: false } });
        rerender({ blocked: true });
        act(() => result.current.apply(80));
        expect(result.current.current).toBe(20);
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('审查回归 · Uploader 读取前校验异常', () => {
    it.each(['同步抛错', '异步拒绝'] as const)('%s 不向入口传播、不入列、不上传，并可重试原批次', async (kind) => {
        const files = [new File(['a'], 'a.txt'), new File(['b'], 'b.txt')];
        const beforeRead = vi.fn<(files: File | File[]) => boolean | Promise<boolean>>()
            .mockImplementationOnce(() => {
                if (kind === '同步抛错') throw new Error('校验服务内部错误');
                return Promise.reject(new Error('校验服务内部错误'));
            }).mockResolvedValue(true);
        const afterRead = vi.fn();
        const onChange = vi.fn();
        const { result } = renderHook(() => useUploader({ multiple: true, beforeRead, afterRead, onChange }));
        await act(async () => {
            await expect(result.current.addFiles(files)).resolves.toBeUndefined();
        });
        expect(result.current.items).toEqual([]);
        expect(onChange).not.toHaveBeenCalled();
        expect(afterRead).not.toHaveBeenCalled();
        expect(result.current.readError).toBe(true);
        await act(async () => { await result.current.retryRead(); });
        expect(beforeRead).toHaveBeenNthCalledWith(2, files);
        expect(result.current.items.map((item) => item.file)).toEqual(files);
        expect(result.current.readError).toBe(false);
        expect(afterRead).toHaveBeenCalledTimes(2);
    });

    it('正常返回 false 不显示异常或保留待重试文件', async () => {
        const beforeRead = vi.fn(() => false);
        const { result } = renderHook(() => useUploader({ beforeRead }));
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.txt')]); });
        expect(result.current.readError).toBe(false);
        await act(async () => { await result.current.retryRead(); });
        expect(beforeRead).toHaveBeenCalledTimes(1);
        expect(result.current.items).toEqual([]);
    });

    it('重试期间反馈加载并阻止重复重试，失败后仍保留文件', async () => {
        let rejectRetry: (reason: Error) => void = () => undefined;
        const gate = new Promise<boolean>((_resolve, reject) => { rejectRetry = reject; });
        const file = new File(['a'], 'a.txt');
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>()
            .mockRejectedValueOnce(new Error('首次失败')).mockReturnValueOnce(gate).mockResolvedValue(true);
        const { result } = renderHook(() => useUploader({ beforeRead }));
        await act(async () => { await result.current.addFiles([file]); });
        let retry: Promise<void> = Promise.resolve();
        act(() => { retry = result.current.retryRead(); });
        expect(result.current.isRetryingRead).toBe(true);
        await act(async () => {
            await result.current.retryRead();
            rejectRetry(new Error('重试失败'));
            await retry;
        });
        expect(beforeRead).toHaveBeenCalledTimes(2);
        expect(result.current.isRetryingRead).toBe(false);
        expect(result.current.readError).toBe(true);
        await act(async () => { await result.current.retryRead(); });
        expect(result.current.items[0]?.file).toBe(file);
    });

    it.each(['disabled', 'readonly'] as const)('失败后变为 %s 不允许重试', async (flag) => {
        const beforeRead = vi.fn().mockRejectedValue(new Error('校验失败'));
        const { result, rerender } = renderHook(({ blocked }) => useUploader({
            beforeRead, disabled: blocked && flag === 'disabled', readonly: blocked && flag === 'readonly',
        }), { initialProps: { blocked: false } });
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.txt')]); });
        rerender({ blocked: true });
        await act(async () => { await result.current.retryRead(); });
        expect(beforeRead).toHaveBeenCalledTimes(1);
    });

    it.each(['mobile', 'desktop'] as const)('%s 输入入口显示友好错误并用原文件重试', async (forceMode) => {
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>()
            .mockRejectedValueOnce(new Error('secret backend detail')).mockResolvedValue(true);
        const afterRead = vi.fn();
        const file = new File(['a'], 'a.txt');
        const { container } = render(<Uploader beforeRead={beforeRead} afterRead={afterRead} forceMode={forceMode} />);
        fireEvent.change(element(container, '[data-slot="uploader-input"]'), { target: { files: [file] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('文件校验失败');
        expect(screen.queryByText(/secret backend detail/)).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: '重试校验' }));
        await waitFor(() => expect(afterRead).toHaveBeenCalledTimes(1));
        expect(beforeRead).toHaveBeenNthCalledWith(2, file);
        expect(screen.queryByRole('alert')).toBeNull();
    });
});


describe('审查回归 · Uploader 异常入口与反馈', () => {
    it.each(['粘贴', '拖拽'] as const)('PC %s 入口捕获拒绝并反馈错误', async (entry) => {
        const file = new File(['a'], 'a.txt');
        const beforeRead = vi.fn().mockRejectedValue(new Error('业务校验失败'));
        const { container } = render(<Uploader beforeRead={beforeRead} forceMode="desktop" />);
        const zone = element(container, '[data-slot="uploader-dropzone"]');
        if (entry === '粘贴') paste(zone, file);
        else fireEvent.drop(zone, { dataTransfer: { files: [file] } });
        expect(await screen.findByRole('alert')).toHaveTextContent('文件校验失败');
        expect(beforeRead).toHaveBeenCalledExactlyOnceWith(file);
    });

    it('图片校验异常不创建预览 URL', async () => {
        const descriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
        const createUrl = vi.fn(() => 'blob:test');
        Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createUrl });
        try {
            const { result } = renderHook(() => useUploader({ beforeRead: () => Promise.reject(new Error('校验失败')) }));
            await act(async () => { await result.current.addFiles([new File(['x'], 'a.png', { type: 'image/png' })]); });
            expect(createUrl).not.toHaveBeenCalled();
            expect(result.current.items).toEqual([]);
        } finally {
            if (descriptor) Object.defineProperty(URL, 'createObjectURL', descriptor);
            else Reflect.deleteProperty(URL, 'createObjectURL');
        }
    });

    it.each(['mobile', 'desktop'] as const)('%s 重试时展示加载提示，失败后仍可重试', async (forceMode) => {
        let rejectRetry: (reason: Error) => void = () => undefined;
        const gate = new Promise<boolean>((_resolve, reject) => { rejectRetry = reject; });
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>()
            .mockRejectedValueOnce(new Error('首次失败')).mockReturnValueOnce(gate);
        const { container } = render(<Uploader beforeRead={beforeRead} forceMode={forceMode} />);
        fireEvent.change(element(container, '[data-slot="uploader-input"]'), { target: { files: [new File(['a'], 'a.txt')] } });
        fireEvent.click(await screen.findByRole('button', { name: '重试校验' }));
        expect(screen.getByRole('status')).toHaveTextContent('正在重新校验文件');
        expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
        await act(async () => { rejectRetry(new Error('重试失败')); });
        expect(await screen.findByRole('button', { name: '重试校验' })).toBeEnabled();
    });
});


describe('审查回归 · Uploader 校验与上传阶段隔离', () => {
    it.each(['mobile', 'desktop'] as const)('%s 上传未结束时仍可反馈并重试下一批校验失败', async (forceMode) => {
        let finishUpload: () => void = () => undefined;
        let finishValidation: (ok: boolean) => void = () => undefined;
        const upload = new Promise<void>((resolve) => { finishUpload = resolve; });
        const validation = new Promise<boolean>((resolve) => { finishValidation = resolve; });
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>()
            .mockRejectedValueOnce(new Error('A 校验失败'))
            .mockResolvedValueOnce(true)
            .mockRejectedValueOnce(new Error('B 校验失败'))
            .mockReturnValueOnce(validation);
        const afterRead = vi.fn(() => upload);
        const fileA = new File(['a'], 'a.txt');
        const fileB = new File(['b'], 'b.txt');
        const { container } = render(<Uploader beforeRead={beforeRead} afterRead={afterRead} forceMode={forceMode} />);
        const input = element(container, '[data-slot="uploader-input"]');
        try {
            fireEvent.change(input, { target: { files: [fileA] } });
            fireEvent.click(await screen.findByRole('button', { name: '重试校验' }));
            await waitFor(() => expect(afterRead).toHaveBeenCalledTimes(1));
            expect(screen.queryByText('正在重新校验文件…')).toBeNull();

            fireEvent.change(input, { target: { files: [fileB] } });
            expect(await screen.findByRole('alert')).toHaveTextContent('文件校验失败');
            const retryButton = screen.getByRole('button', { name: '重试校验' });
            expect(retryButton).toBeEnabled();
            fireEvent.click(retryButton);
            fireEvent.click(retryButton);
            expect(beforeRead).toHaveBeenCalledTimes(4);
            expect(beforeRead).toHaveBeenNthCalledWith(4, fileB);
            expect(screen.getByRole('status')).toHaveTextContent('正在重新校验文件');

            // 前一批上传完成不能解除当前批次仍在进行的校验状态。
            await act(async () => { finishUpload(); await upload; });
            expect(screen.getByRole('status')).toHaveTextContent('正在重新校验文件');
            expect(screen.queryByRole('button', { name: '重试校验' })).toBeNull();
            await act(async () => { finishValidation(true); await validation; });
            await waitFor(() => expect(afterRead).toHaveBeenCalledTimes(2));
            expect(screen.queryByText('正在重新校验文件…')).toBeNull();
            expect(screen.queryByRole('alert')).toBeNull();
        } finally {
            await act(async () => {
                finishValidation(true);
                finishUpload();
                await Promise.all([validation, upload]);
            });
        }
    });

    it('校验状态提前释放后 retryRead 仍等待上传完成', async () => {
        let finishUpload: () => void = () => undefined;
        const upload = new Promise<void>((resolve) => { finishUpload = resolve; });
        const beforeRead = vi.fn<(file: File | File[]) => boolean | Promise<boolean>>()
            .mockRejectedValueOnce(new Error('校验失败')).mockResolvedValue(true);
        const afterRead = vi.fn(() => upload);
        const { result } = renderHook(() => useUploader({ beforeRead, afterRead }));
        await act(async () => { await result.current.addFiles([new File(['a'], 'a.txt')]); });
        let retry: Promise<void> = Promise.resolve();
        const completed = vi.fn();
        try {
            await act(async () => { retry = result.current.retryRead().then(completed); });
            expect(afterRead).toHaveBeenCalledTimes(1);
            expect(result.current.isRetryingRead).toBe(false);
            expect(result.current.items[0]?.status).toBe('uploading');
            expect(completed).not.toHaveBeenCalled();
        } finally {
            await act(async () => { finishUpload(); await retry; });
        }
        expect(completed).toHaveBeenCalledTimes(1);
        expect(result.current.items[0]?.status).toBe('done');
    });
});
