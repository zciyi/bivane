import { describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { Uploader } from "@/components/responsive/uploader";
import type { UploaderFileItem } from "@/hooks/use-uploader-state";
import type { UploaderHandle } from "@/components/ui/uploader-parts";
import { resetViewport, setViewport } from "./setup";

/**
 * Uploader 双模式行为（矩阵 §2.2）：
 * H5 宫格 + 相机(capture)；PC 拖拽区 + 列表 + 粘贴。
 * 队列/进度/校验用 afterRead 驱动状态机（不触达内置 XHR）。
 */

function makeFile(name: string, type = "text/plain", size = 10): File {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
}

function inputOf(container: HTMLElement): HTMLInputElement {
    return container.querySelector<HTMLInputElement>(
        'input[data-slot="uploader-input"]',
    )!;
}

async function selectFiles(container: HTMLElement, files: File[]) {
    await act(async () => {
        fireEvent.change(inputOf(container), { target: { files } });
    });
}

async function dropFiles(container: HTMLElement, files: File[]) {
    const zone = container.querySelector<HTMLElement>(
        '[data-slot="uploader-dropzone"]',
    )!;
    await act(async () => {
        fireEvent.drop(zone, { dataTransfer: { files } });
    });
}

async function pasteFiles(files: File[]) {
    const evt = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(evt, "clipboardData", { value: { files } });
    await act(async () => {
        window.dispatchEvent(evt);
    });
}

const resolveOk = () => Promise.resolve();
const rejectFail = () => Promise.reject(new Error("上传失败"));
const never = () => new Promise<void>(() => {});

/** 受控外壳：value 交给父组件（这正是 demo 里前两个 Uploader 的用法） */
function ControlledHarness({
    afterRead,
}: {
    afterRead?: (item: UploaderFileItem) => void | Promise<void>;
}) {
    const [value, setValue] = React.useState<UploaderFileItem[]>([]);
    return <Uploader value={value} onChange={setValue} multiple afterRead={afterRead} />;
}

/* ------------------------------- H5 ------------------------------- */

describe("Uploader · H5（宫格 + 「+」）", () => {
    it("窄屏渲染 h5 宫格与「+」位", () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader />);
        expect(container.querySelector('[data-slot="uploader"]')).toHaveAttribute(
            "data-mode",
            "h5",
        );
        expect(container.querySelector('[data-slot="uploader-add"]')).toBeTruthy();
        resetViewport();
    });

    it("选文件 → 生成宫格瓦片，afterRead resolve → done", async () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(
                container.querySelector('[data-slot="uploader-grid-item"]'),
            ).toHaveAttribute("data-status", "done"),
        );
        resetViewport();
    });

    it("afterRead reject → failed，遮罩可点重试", async () => {
        setViewport({ width: 375 });
        const afterRead = vi
            .fn()
            .mockImplementationOnce(rejectFail)
            .mockImplementationOnce(resolveOk);
        const { container } = render(<Uploader afterRead={afterRead} />);
        await selectFiles(container, [makeFile("x.txt")]);
        const tile = () =>
            container.querySelector<HTMLElement>('[data-slot="uploader-grid-item"]')!;
        await waitFor(() => expect(tile()).toHaveAttribute("data-status", "failed"));
        await act(async () => {
            fireEvent.click(
                container.querySelector<HTMLElement>('[data-slot="uploader-grid-mask"]')!,
            );
        });
        await waitFor(() => expect(tile()).toHaveAttribute("data-status", "done"));
        expect(afterRead).toHaveBeenCalledTimes(2);
        resetViewport();
    });

    it("afterRead 未上报进度 → 只转圈，不显示误导性的 0%", async () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader afterRead={never} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        const tile = container.querySelector<HTMLElement>(
            '[data-slot="uploader-grid-item"]',
        )!;
        expect(tile).toHaveAttribute("data-status", "uploading");
        expect(
            container.querySelector('[data-slot="uploader-grid-mask"]'),
        ).not.toHaveTextContent("0%");
        resetViewport();
    });

    it("afterRead 上报进度 → 遮罩显示真实百分比", async () => {
        setViewport({ width: 375 });
        const afterRead = (_item: UploaderFileItem, onProgress: (p: number) => void) => {
            onProgress(42);
            return never();
        };
        const { container } = render(<Uploader afterRead={afterRead} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(
                container.querySelector('[data-slot="uploader-grid-mask"]'),
            ).toHaveTextContent("42%"),
        );
        resetViewport();
    });

    it("删除按钮移除瓦片", async () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(container.querySelector<HTMLElement>('[data-slot="uploader-delete"]')!);
        });
        expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeNull();
        resetViewport();
    });

    it("maxCount 超限 → onExceed，仅保留上限个数", async () => {
        setViewport({ width: 375 });
        const onExceed = vi.fn();
        const { container } = render(
            <Uploader multiple maxCount={1} onExceed={onExceed} afterRead={resolveOk} />,
        );
        await selectFiles(container, [makeFile("a.txt"), makeFile("b.txt")]);
        expect(onExceed).toHaveBeenCalled();
        expect(container.querySelectorAll('[data-slot="uploader-grid-item"]')).toHaveLength(1);
        resetViewport();
    });

    it("maxSize 超限 → onOversize 且不入列", async () => {
        setViewport({ width: 375 });
        const onOversize = vi.fn();
        const { container } = render(
            <Uploader maxSize={5} onOversize={onOversize} afterRead={resolveOk} />,
        );
        await selectFiles(container, [makeFile("big.txt", "text/plain", 100)]);
        expect(onOversize).toHaveBeenCalled();
        expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeNull();
        resetViewport();
    });

    it("beforeRead 返回 false 拦截整批", async () => {
        setViewport({ width: 375 });
        const { container } = render(
            <Uploader multiple beforeRead={() => false} afterRead={resolveOk} />,
        );
        await selectFiles(container, [makeFile("a.txt")]);
        expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeNull();
        resetViewport();
    });

    it("accept 过滤非匹配文件", async () => {
        setViewport({ width: 375 });
        const { container } = render(
            <Uploader accept="image/*" afterRead={resolveOk} />,
        );
        await selectFiles(container, [makeFile("a.txt", "text/plain")]);
        expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeNull();
        resetViewport();
    });

    it("disabled → 无「+」位", () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader disabled />);
        expect(container.querySelector('[data-slot="uploader-add"]')).toBeNull();
        resetViewport();
    });
});

/* ------------------------------- PC ------------------------------- */

describe("Uploader · PC（拖拽区 + 列表 + 粘贴）", () => {
    it("宽屏渲染 pc 拖拽区", () => {
        setViewport({ width: 1280 });
        const { container } = render(<Uploader />);
        expect(container.querySelector('[data-slot="uploader"]')).toHaveAttribute(
            "data-mode",
            "pc",
        );
        expect(container.querySelector('[data-slot="uploader-dropzone"]')).toBeTruthy();
        resetViewport();
    });

    it("拖拽上传 → 生成列表行", async () => {
        setViewport({ width: 1280 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        await dropFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toBeTruthy(),
        );
        resetViewport();
    });

    it("粘贴上传（PC 独有能力）", async () => {
        setViewport({ width: 1280 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        await pasteFiles([makeFile("p.png", "image/png")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toBeTruthy(),
        );
        resetViewport();
    });

    it("列表行删除移除", async () => {
        setViewport({ width: 1280 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toBeTruthy(),
        );
        await act(async () => {
            fireEvent.click(container.querySelector<HTMLElement>('[data-slot="uploader-delete"]')!);
        });
        expect(container.querySelector('[data-slot="uploader-list-item"]')).toBeNull();
        resetViewport();
    });

    it("失败行出现重试按钮，点击后恢复 done", async () => {
        setViewport({ width: 1280 });
        const afterRead = vi
            .fn()
            .mockImplementationOnce(rejectFail)
            .mockImplementationOnce(resolveOk);
        const { container } = render(<Uploader afterRead={afterRead} />);
        await selectFiles(container, [makeFile("x.txt")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toHaveAttribute(
                "data-status",
                "failed",
            ),
        );
        await act(async () => {
            fireEvent.click(
                container.querySelector<HTMLElement>('[data-slot="uploader-list-retry"]')!,
            );
        });
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toHaveAttribute(
                "data-status",
                "done",
            ),
        );
        resetViewport();
    });

    it("disabled → 无拖拽区", () => {
        setViewport({ width: 1280 });
        const { container } = render(<Uploader disabled />);
        expect(container.querySelector('[data-slot="uploader-dropzone"]')).toBeNull();
        resetViewport();
    });
});

/* ------------------------------ 受控 ------------------------------ */

describe("Uploader · 受控", () => {
    it("value 传入按数量渲染", () => {
        setViewport({ width: 1280 });
        const value: UploaderFileItem[] = [
            { key: "k1", name: "a.png", status: "done", percent: 100 },
            { key: "k2", name: "b.png", status: "done", percent: 100 },
        ];
        const { container } = render(<Uploader value={value} />);
        expect(container.querySelectorAll('[data-slot="uploader-list-item"]')).toHaveLength(2);
        resetViewport();
    });

    // 回归：受控分支曾不 setInner，且同步 effect 在「父回传我刚 emit 的引用」时短路，
    // 两者叠加使 inner 永远停在初始值 → 受控 Uploader 选文件后毫无反应。
    it("受控模式下新增文件要显示并能上传完成", async () => {
        setViewport({ width: 1280 });
        const { container } = render(<ControlledHarness afterRead={resolveOk} />);
        await selectFiles(container, [makeFile("a.png", "image/png")]);
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toBeTruthy(),
        );
        await waitFor(() =>
            expect(container.querySelector('[data-slot="uploader-list-item"]')).toHaveAttribute(
                "data-status",
                "done",
            ),
        );
        resetViewport();
    });
});

/* ------------------------- App 桥回填（onPickRequest + ref 句柄） ------------------------- */

describe("Uploader · App 桥回填（onPickRequest + ref 句柄）", () => {
    it("传 onPickRequest：点「+」触发回调而不是打开系统弹窗", () => {
        setViewport({ width: 375 });
        const onPickRequest = vi.fn();
        const { container } = render(<Uploader onPickRequest={onPickRequest} />);
        fireEvent.click(
            container.querySelector<HTMLElement>('[data-slot="uploader-add"]')!,
        );
        expect(onPickRequest).toHaveBeenCalledTimes(1);
        const handle = onPickRequest.mock.calls[0][0] as UploaderHandle;
        expect(typeof handle.addFiles).toBe("function");
        expect(typeof handle.open).toBe("function");
        resetViewport();
    });

    it("PC：点拖拽区同样走 onPickRequest", () => {
        setViewport({ width: 1280 });
        const onPickRequest = vi.fn();
        const { container } = render(<Uploader onPickRequest={onPickRequest} />);
        fireEvent.click(
            container.querySelector<HTMLElement>('[data-slot="uploader-dropzone"]')!,
        );
        expect(onPickRequest).toHaveBeenCalledTimes(1);
        resetViewport();
    });

    it("不传 onPickRequest：点「+」不触发回调（照旧走系统 input）", () => {
        setViewport({ width: 375 });
        const { container } = render(<Uploader afterRead={resolveOk} />);
        fireEvent.click(
            container.querySelector<HTMLElement>('[data-slot="uploader-add"]')!,
        );
        expect(container.querySelector('[data-slot="uploader-grid-item"]')).toBeNull();
        resetViewport();
    });

    it("ref 句柄 addFiles 回填：外部文件进队列并上传完成", async () => {
        setViewport({ width: 375 });
        const ref = React.createRef<UploaderHandle>();
        const { container } = render(<Uploader ref={ref} afterRead={resolveOk} />);
        await act(async () => {
            await ref.current!.addFiles(makeFile("bridge.png", "image/png"));
        });
        await waitFor(() =>
            expect(
                container.querySelector('[data-slot="uploader-grid-item"]'),
            ).toHaveAttribute("data-status", "done"),
        );
        resetViewport();
    });

    it("完整桥接流程：onPickRequest 里拿到 handle 再 addFiles 回填", async () => {
        setViewport({ width: 375 });
        const { container } = render(
            <Uploader
                afterRead={resolveOk}
                onPickRequest={(handle) => {
                    void handle.addFiles(makeFile("from-bridge.png", "image/png"));
                }}
            />,
        );
        await act(async () => {
            fireEvent.click(
                container.querySelector<HTMLElement>('[data-slot="uploader-add"]')!,
            );
        });
        await waitFor(() =>
            expect(
                container.querySelector('[data-slot="uploader-grid-item"]'),
            ).toHaveAttribute("data-status", "done"),
        );
        resetViewport();
    });
});
