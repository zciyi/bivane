import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { Tooltip } from "@/components/responsive/tooltip";
import { Ellipsis } from "@/components/ui/ellipsis";
import { resolveBubblePosition } from "@/components/ui/tooltip-parts";

/**
 * Tooltip 双模式行为测试（矩阵 §4：h5 / pc 各一组）
 *
 * H5：常驻 ⓘ 信息提示条，无浮层、无计时（真实计时器即可，不需要 fake）。
 * PC：计时 fake（hover 延迟 200 / 退场 120）。几何（jsdom 不做布局）：
 * 气泡实测尺寸为 0，定位断言只验证「指针坐标 + gap」与翻转纯函数。
 */

/** PC hover 延迟 200ms + 进场一帧 */
const HOVER_OPEN = 220;
/** 退场 + 一帧 */
const CLOSED = 140;

function trigger(): HTMLElement {
    // 按文本定位：H5 集成用例里同页还有 Ellipsis 的「展开/收起」按钮
    return screen.getByRole("button", { name: "?" });
}

/**
 * 伪造 Ellipsis 的布局测量：jsdom 不做布局，scrollHeight 与行高恒为 0。
 * lineHeight=20、rows=2 时阈值 41px，scrollHeight 超过它即判「需要截断」。
 */
function mockOverflow(scrollHeight: number, lineHeight = 20): void {
    // 在真实 style 对象上遮蔽两个命名属性：不能整体替换 getComputedStyle
    // （会丢掉 getPropertyValue，dom-accessibility-api 算按钮名时报错），
    // 也不能 spy 原型（jsdom 的 WebIDL 命名属性不挂原型）
    const original = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((...args) => {
        const style = original(...(args as [Element]));
        Object.defineProperty(style, "lineHeight", {
            get: () => `${lineHeight}px`,
            configurable: true,
        });
        Object.defineProperty(style, "fontSize", {
            get: () => "14px",
            configurable: true,
        });
        return style;
    });
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(
        scrollHeight,
    );
}

function bubble(): HTMLElement | null {
    return document.querySelector('[data-slot="tooltip-bubble"]');
}

describe("h5 mode", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    function infoBar(): HTMLElement | null {
        return document.querySelector('[data-slot="tooltip-info"]');
    }

    it("默认常驻：主体与 ⓘ 信息提示条同时渲染，不存在浮层气泡", () => {
        render(
            <Tooltip content="删除后不可恢复" forceMode="mobile">
                <button type="button">?</button>
            </Tooltip>,
        );
        expect(trigger()).toBeInTheDocument();
        expect(bubble()).toBeNull();

        const info = infoBar();
        expect(info).not.toBeNull();
        expect(info).toHaveTextContent("删除后不可恢复");
        expect(info).toHaveAttribute("data-mode", "h5");
        // 行首信息图标（装饰性，读屏不重复念）
        const icon = info!.querySelector('[data-slot="icon"]');
        expect(icon).not.toBeNull();
        expect(icon).toHaveAttribute("aria-hidden", "true");
    });

    it("主体带 data-slot/data-mode，aria-describedby 指向信息提示条", () => {
        render(
            <Tooltip content="提示文案" forceMode="mobile">
                <button type="button">?</button>
            </Tooltip>,
        );
        expect(trigger()).toHaveAttribute("data-slot", "tooltip-trigger");
        expect(trigger()).toHaveAttribute("data-mode", "h5");
        expect(trigger()).toHaveAttribute("aria-describedby", infoBar()!.id);
    });

    it("任何指针手势都不产生浮层（触屏没有长按/hover 提示这回事）", () => {
        render(
            <Tooltip content="提示文案" forceMode="mobile">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.pointerDown(trigger(), {
            button: 0,
            clientX: 100,
            clientY: 100,
        });
        fireEvent.pointerMove(trigger(), { clientX: 200, clientY: 200 });
        fireEvent.pointerUp(trigger(), { button: 0 });
        fireEvent.click(trigger());

        expect(bubble()).toBeNull();
        expect(infoBar()).not.toBeNull();
    });

    it("disabled 不影响常驻说明（静态说明不是触发反馈，无触发可禁）", () => {
        render(
            <Tooltip
                content="权限不足时不可操作的原因"
                disabled
                forceMode="mobile"
            >
                <button type="button">?</button>
            </Tooltip>,
        );
        expect(infoBar()).not.toBeNull();
        expect(infoBar()).toHaveTextContent("权限不足时不可操作的原因");
    });

    it("受控 open=false / onOpenChange：H5 说明仍常驻，点击主体不上报开合", () => {
        const onOpenChange = vi.fn();
        render(
            <Tooltip
                content="提示"
                open={false}
                onOpenChange={onOpenChange}
                forceMode="mobile"
            >
                <button type="button">?</button>
            </Tooltip>,
        );
        expect(infoBar()).not.toBeNull();
        fireEvent.click(trigger());
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("content 传 <Ellipsis>：超长说明在提示条内展开/收起", () => {
        mockOverflow(100); // 2 行 × 20 = 40，100 > 41 判溢出
        render(
            <Tooltip
                forceMode="mobile"
                content={
                    <Ellipsis rows={2}>
                        很长的一段说明文字，超过两行时先折叠，点开关再展开全文。
                    </Ellipsis>
                }
            >
                <button type="button">?</button>
            </Tooltip>,
        );

        const info = infoBar()!;
        const toggle = within(info).getByRole("button", { name: /展开/ });
        fireEvent.click(toggle);
        expect(
            within(info).getByRole("button", { name: /收起/ }),
        ).toBeInTheDocument();
    });
});

describe("pc mode", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("hover 200ms 内不弹，延迟到点才弹并跟随鼠标坐标", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 300, clientY: 400 });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(bubble()).toBeNull();

        act(() => {
            vi.advanceTimersByTime(HOVER_OPEN);
        });
        expect(bubble()).not.toBeNull();
        expect(bubble()).toHaveTextContent("PC 提示");
        expect(bubble()?.style.transform).toBe("translate3d(312px, 412px, 0)");
        expect(trigger()).toHaveAttribute("aria-describedby", bubble()!.id);
    });

    it("延迟期间鼠标移出：永不弹出", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 0, clientY: 0 });
        act(() => {
            vi.advanceTimersByTime(100);
        });
        fireEvent.mouseLeave(trigger());
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(bubble()).toBeNull();
    });

    it("鼠标移动时气泡跟随", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 300, clientY: 400 });
        act(() => {
            vi.advanceTimersByTime(HOVER_OPEN);
        });
        fireEvent.mouseMove(trigger(), { clientX: 500, clientY: 600 });
        act(() => {
            vi.advanceTimersByTime(20);
        });
        expect(bubble()?.style.transform).toBe("translate3d(512px, 612px, 0)");
    });

    it("移出即关（无退场后的残留节点）", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 0, clientY: 0 });
        act(() => {
            vi.advanceTimersByTime(HOVER_OPEN);
        });
        fireEvent.mouseLeave(trigger());
        act(() => {
            vi.advanceTimersByTime(CLOSED);
        });
        expect(bubble()).toBeNull();
    });

    it("键盘 focus 立刻弹出（不等延迟），blur 关闭", () => {
        render(
            <Tooltip content="键盘提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.focus(trigger());
        act(() => {
            vi.advanceTimersByTime(20);
        });
        expect(bubble()).not.toBeNull();
        expect(bubble()?.getAttribute("data-placement")).toMatch(/above|below/);

        fireEvent.blur(trigger());
        act(() => {
            vi.advanceTimersByTime(CLOSED);
        });
        expect(bubble()).toBeNull();
    });

    it("Esc 关闭", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 0, clientY: 0 });
        act(() => {
            vi.advanceTimersByTime(HOVER_OPEN);
        });
        fireEvent.keyDown(window, { key: "Escape" });
        act(() => {
            vi.advanceTimersByTime(CLOSED);
        });
        expect(bubble()).toBeNull();
    });

    it("focus 打开后鼠标划入再 blur：因 hover 仍在而保留；鼠标也移出才关", () => {
        render(
            <Tooltip content="PC 提示" forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.focus(trigger());
        act(() => {
            vi.advanceTimersByTime(20);
        });
        fireEvent.mouseEnter(trigger(), { clientX: 10, clientY: 10 });
        fireEvent.blur(trigger());
        act(() => {
            vi.advanceTimersByTime(CLOSED);
        });
        expect(bubble()).not.toBeNull();

        fireEvent.mouseLeave(trigger());
        act(() => {
            vi.advanceTimersByTime(CLOSED);
        });
        expect(bubble()).toBeNull();
    });

    it("禁用：hover 与 focus 都不弹", () => {
        render(
            <Tooltip content="PC 提示" disabled forceMode="desktop">
                <button type="button">?</button>
            </Tooltip>,
        );
        fireEvent.mouseEnter(trigger(), { clientX: 0, clientY: 0 });
        act(() => {
            vi.advanceTimersByTime(HOVER_OPEN);
        });
        fireEvent.focus(trigger());
        act(() => {
            vi.advanceTimersByTime(20);
        });
        expect(bubble()).toBeNull();
    });
});

describe("resolveBubblePosition 纯函数", () => {
    const box = { width: 80, height: 40 };
    const viewport = { width: 1024, height: 768 };
    const gap = 12;
    const margin = 8;

    it("指针点：优先落在右下方", () => {
        expect(
            resolveBubblePosition(
                { kind: "point", x: 100, y: 100 },
                box,
                viewport,
                gap,
                margin,
            ),
        ).toEqual({ x: 112, y: 112, placement: "below" });
    });

    it("右侧放不下翻到指针左侧", () => {
        const pos = resolveBubblePosition(
            { kind: "point", x: 1000, y: 100 },
            box,
            viewport,
            gap,
            margin,
        );
        expect(pos.x).toBe(908);
    });

    it("下方放不下翻到指针上方", () => {
        const pos = resolveBubblePosition(
            { kind: "point", x: 1000, y: 750 },
            box,
            viewport,
            gap,
            margin,
        );
        expect(pos).toMatchObject({ x: 908, y: 698, placement: "above" });
    });

    it("元素矩形：水平居中，默认上方；上方没空间翻下方", () => {
        expect(
            resolveBubblePosition(
                {
                    kind: "rect",
                    rect: { x: 100, y: 200, width: 100, height: 40 },
                },
                box,
                viewport,
                gap,
                margin,
            ),
        ).toEqual({ x: 110, y: 148, placement: "above" });

        expect(
            resolveBubblePosition(
                {
                    kind: "rect",
                    rect: { x: 100, y: 10, width: 100, height: 40 },
                },
                box,
                viewport,
                gap,
                margin,
            ),
        ).toMatchObject({ y: 62, placement: "below" });
    });
});
