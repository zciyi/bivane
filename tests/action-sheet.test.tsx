import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import {
    ActionSheet,
    ActionSheetHost,
    showActionSheet,
    closeActionSheet,
    type ActionSheetAction,
} from "@/components/responsive/action-sheet";
import { resetActionSheetStore } from "@/hooks/use-action-sheet-store";
import { resetImperativeHosts } from "@/lib/imperative-host";

/**
 * ActionSheet 双模式行为测试（契约 18：交互件 H5/PC 各 1 个行为测试）
 *
 * 模式 B 的验证重点：**同一份 actions，两种壳，但选择/取消语义完全一致**。
 *   - H5：Popup 底部抽屉（data-position-resolved="bottom"），项高 48px
 *   - PC：Popup 统一降级居中（data-position-resolved="center"），项高 36px
 *
 * data-mode 断言 h5|pc（不是 DeviceMode 的 mobile/desktop）：
 * Portal 内的面板与 body 靠它命中 modes.css 的 [data-mode='pc'] token 覆盖。
 */

function panel(): HTMLElement | null {
    return document.querySelector('[data-slot="popup"]');
}

function body(): HTMLElement | null {
    return document.querySelector('[data-slot="action-sheet-body"]');
}

function items(): Element[] {
    return Array.from(
        document.querySelectorAll('[data-slot="action-sheet-item"]'),
    );
}

function cancelButton(): HTMLElement | null {
    return document.querySelector('[data-slot="action-sheet-cancel"]');
}

const ACTIONS: ActionSheetAction[] = [
    { name: "编辑" },
    { name: "分享", subname: "给微信好友" },
    { name: "删除", color: "#ee0a24", disabled: true },
];

beforeEach(() => {
    resetActionSheetStore();
    document.body.removeAttribute("data-bv-scroll-locked");
    document.body.style.cssText = "";
});

afterEach(() => {
    resetImperativeHosts();
});

describe("h5 mode", () => {
    it("渲染为底部抽屉：标题/描述/动作行与分离的取消按钮", () => {
        render(
            <ActionSheet
                open
                forceMode="mobile"
                title="操作"
                description="请选择"
                actions={ACTIONS}
            />,
        );

        expect(panel()).toHaveAttribute("data-mode", "h5");
        expect(panel()).toHaveAttribute("data-position-resolved", "bottom");
        expect(body()).toHaveAttribute("data-mode", "h5");
        expect(
            document.querySelector('[data-slot="action-sheet-title"]')
                ?.textContent,
        ).toBe("操作");
        expect(
            document.querySelector('[data-slot="action-sheet-description"]')
                ?.textContent,
        ).toBe("请选择");
        expect(items()).toHaveLength(3);
        expect(items()[1]?.textContent).toContain("给微信好友");
        expect(cancelButton()).not.toBeNull();
    });

    it("动作行 data-mode 输出 h5|pc（写 DeviceMode 原值会让 modes.css 覆盖静默失效）", () => {
        render(<ActionSheet open forceMode="mobile" actions={ACTIONS} />);

        for (const item of items()) {
            expect(item).toHaveAttribute("data-mode", "h5");
        }
    });

    it("点击动作触发 onSelect(action, index)，默认随后面板请求关闭", () => {
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <ActionSheet
                open
                forceMode="mobile"
                actions={ACTIONS}
                onSelect={onSelect}
                onOpenChange={onOpenChange}
            />,
        );

        act(() => {
            fireEvent.click(items()[0] as Element);
        });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0]?.[1]).toBe(0);
        expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ name: "编辑" });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("closeOnClickAction=false 时只回调不关闭", () => {
        const onSelect = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <ActionSheet
                open
                forceMode="mobile"
                actions={ACTIONS}
                closeOnClickAction={false}
                onSelect={onSelect}
                onOpenChange={onOpenChange}
            />,
        );

        act(() => {
            fireEvent.click(items()[0] as Element);
        });

        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("单个动作可用 closeOnClick:false 覆盖全局关闭行为", () => {
        const onOpenChange = vi.fn();
        const list: ActionSheetAction[] = [
            { name: "常驻项", closeOnClick: false },
            { name: "正常项" },
        ];

        render(
            <ActionSheet
                open
                forceMode="mobile"
                actions={list}
                onOpenChange={onOpenChange}
            />,
        );

        act(() => {
            fireEvent.click(items()[0] as Element);
        });
        expect(onOpenChange).not.toHaveBeenCalled();

        act(() => {
            fireEvent.click(items()[1] as Element);
        });
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("禁用项点击不触发 onSelect（Vant disabled 语义）", () => {
        const onSelect = vi.fn();

        render(
            <ActionSheet
                open
                forceMode="mobile"
                actions={ACTIONS}
                onSelect={onSelect}
            />,
        );

        act(() => {
            fireEvent.click(items()[2] as Element);
        });

        expect(onSelect).not.toHaveBeenCalled();
        expect(items()[2]).toBeDisabled();
    });

    it("loading 项展示转圈且不可点", () => {
        const list: ActionSheetAction[] = [{ name: "提交中", loading: true }];
        render(<ActionSheet open forceMode="mobile" actions={list} />);

        const rowSpinner = items()[0]?.querySelector(
            '[data-slot="action-sheet-item-spinner"]',
        );
        expect(rowSpinner).not.toBeNull();
        // 同 Loading：功能指示转圈不受 reduced-motion 影响
        expect(rowSpinner?.className).toContain("animate-spin");
        expect(rowSpinner?.className).not.toContain("animate-none");
        expect(items()[0]).toBeDisabled();
    });

    it("点击取消按钮触发 onCancel 并请求关闭；cancelText={null} 可隐藏", () => {
        const onCancel = vi.fn();
        const onOpenChange = vi.fn();

        const { rerender } = render(
            <ActionSheet
                open
                forceMode="mobile"
                actions={ACTIONS}
                onCancel={onCancel}
                onOpenChange={onOpenChange}
            />,
        );

        act(() => {
            fireEvent.click(cancelButton() as Element);
        });

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);

        rerender(
            <ActionSheet
                open
                forceMode="mobile"
                actions={ACTIONS}
                cancelText={null}
            />,
        );
        expect(cancelButton()).toBeNull();
    });
});

describe("pc mode", () => {
    it("同一份 actions 渲染为居中列表：Popup 位置降级 center，行高密度随 mode 切换", () => {
        render(
            <ActionSheet
                open
                forceMode="desktop"
                title="操作"
                actions={ACTIONS}
            />,
        );

        expect(panel()).toHaveAttribute("data-mode", "pc");
        expect(panel()).toHaveAttribute("data-position-resolved", "center");
        // 原始 position 保留在 data-position 上，降级只发生在 resolved
        expect(panel()).toHaveAttribute("data-position", "bottom");
        expect(body()).toHaveAttribute("data-mode", "pc");
        expect(items()).toHaveLength(3);
        for (const item of items()) {
            expect(item).toHaveAttribute("data-mode", "pc");
            // PC 行 36px 密度（min-h-36px 落在具体类名上）
            expect(item.className).toContain("min-h-[36px]");
        }
    });

    it("点选与取消语义与 H5 完全一致（模式 B：换壳不换语义）", () => {
        const onSelect = vi.fn();
        const onCancel = vi.fn();
        const onOpenChange = vi.fn();

        render(
            <ActionSheet
                open
                forceMode="desktop"
                actions={ACTIONS}
                onSelect={onSelect}
                onCancel={onCancel}
                onOpenChange={onOpenChange}
            />,
        );

        act(() => {
            fireEvent.click(items()[0] as Element);
        });
        expect(onSelect.mock.calls[0]?.[1]).toBe(0);
        expect(onOpenChange).toHaveBeenCalledWith(false);

        act(() => {
            fireEvent.click(cancelButton() as Element);
        });
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe("命令式 API", () => {
    it("showActionSheet 经 Host 渲染，点取消后从 store 移除并卸载", () => {
        render(<ActionSheetHost />);

        act(() => {
            showActionSheet({ actions: ACTIONS });
        });

        expect(items()).toHaveLength(3);
        expect(panel()).not.toBeNull();

        act(() => {
            fireEvent.click(cancelButton() as Element);
        });

        expect(
            document.querySelector('[data-slot="action-sheet-body"]'),
        ).toBeNull();
    });

    it("closeActionSheet(id) 可不经 UI 直接关闭", () => {
        render(<ActionSheetHost />);

        let handle: ReturnType<typeof showActionSheet> | null = null;
        act(() => {
            handle = showActionSheet({ actions: ACTIONS });
        });
        expect(panel()).not.toBeNull();

        act(() => {
            closeActionSheet(handle?.id);
        });
        expect(panel()).toBeNull();
    });
});
