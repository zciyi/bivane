import { useRef, useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch, type SwitchValue } from "@/components/ui/switch";

describe("Switch（对齐 Vant switch）", () => {
    it("默认关态，点击后切到开态并回传 activeValue", async () => {
        const onChange = vi.fn();
        render(<Switch onChange={onChange} />);
        const sw = screen.getByRole("switch");

        expect(sw).toHaveAttribute("aria-checked", "false");
        await userEvent.click(sw);
        expect(sw).toHaveAttribute("aria-checked", "true");
        expect(onChange).toHaveBeenLastCalledWith(true);

        await userEvent.click(sw);
        expect(sw).toHaveAttribute("aria-checked", "false");
        expect(onChange).toHaveBeenLastCalledWith(false);
    });

    it("受控 value 与 activeValue 全等比较，支持字符串枚举", async () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <Switch
                value="1"
                activeValue="1"
                inactiveValue="0"
                onChange={onChange}
            />,
        );
        const sw = screen.getByRole("switch");
        expect(sw).toHaveAttribute("aria-checked", "true");

        await userEvent.click(sw);
        expect(onChange).toHaveBeenLastCalledWith("0");

        rerender(
            <Switch
                value="0"
                activeValue="1"
                inactiveValue="0"
                onChange={onChange}
            />,
        );
        expect(sw).toHaveAttribute("aria-checked", "false");
    });

    it("checked 布尔快捷方式受控：点击后由外部决定下一个状态", async () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <Switch checked={false} onChange={onChange} />,
        );
        const sw = screen.getByRole("switch");
        expect(sw).toHaveAttribute("aria-checked", "false");

        await userEvent.click(sw);
        expect(onChange).toHaveBeenLastCalledWith(true);
        // 受控不更新 → 仍是关态
        expect(sw).toHaveAttribute("aria-checked", "false");

        rerender(<Switch checked onChange={onChange} />);
        expect(sw).toHaveAttribute("aria-checked", "true");
    });

    it("非受控 defaultValue 生效", () => {
        render(<Switch defaultValue={true} />);
        expect(screen.getByRole("switch")).toHaveAttribute(
            "aria-checked",
            "true",
        );
    });

    it("disabled 时点击不触发 onChange", async () => {
        const onChange = vi.fn();
        render(<Switch disabled onChange={onChange} />);
        const sw = screen.getByRole("switch");
        expect(sw).toBeDisabled();
        await userEvent.click(sw);
        expect(onChange).not.toHaveBeenCalled();
    });

    it("loading 时点击不触发 onChange，且节点内有转菊", async () => {
        const onChange = vi.fn();
        render(<Switch loading onChange={onChange} />);
        const sw = screen.getByRole("switch");
        await userEvent.click(sw);
        expect(onChange).not.toHaveBeenCalled();
        expect(sw.querySelector('[data-slot="switch-loading"]')).not.toBeNull();
    });

    it("自定义颜色写内联 style，未传时不写", () => {
        const { rerender } = render(
            <Switch activeColor="#07c160" inactiveColor="#fff" />,
        );
        expect(screen.getByRole("switch")).toHaveStyle({
            backgroundColor: "rgb(255, 255, 255)",
        });

        rerender(<Switch />);
        // 无颜色 props 时不写内联底色，交由 CSS token 接管（含禁用/深色覆盖）
        expect(screen.getByRole("switch").style.backgroundColor).toBe("");
    });

    it("size 以 px 数字写入 --bv-switch-size（驱动绝对 px 尺寸体系）", () => {
        render(<Switch size={40} />);
        expect(screen.getByRole("switch")).toHaveStyle({
            "--bv-switch-size": "40px",
        });
    });

    it("beforeChange 返回 false 时放弃切换", async () => {
        const onChange = vi.fn();
        render(<Switch beforeChange={() => false} onChange={onChange} />);
        const sw = screen.getByRole("switch");
        await userEvent.click(sw);
        expect(sw).toHaveAttribute("aria-checked", "false");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("beforeChange 抛异常时放弃切换且不卡死 loading", async () => {
        const onChange = vi.fn();
        render(
            <Switch
                beforeChange={() => Promise.reject(new Error("boom"))}
                onChange={onChange}
            />,
        );
        const sw = screen.getByRole("switch");
        await userEvent.click(sw);
        await waitFor(() => {
            expect(sw).not.toBeDisabled();
        });
        expect(sw).toHaveAttribute("aria-checked", "false");
        expect(onChange).not.toHaveBeenCalled();
    });

    it("beforeChange 等待期间内置 loading 并禁用，resolve(true) 后切换", async () => {
        let resolveHook: (allowed: boolean) => void = () => {};
        const deferred = new Promise<boolean>((resolve) => {
            resolveHook = resolve;
        });
        const onChange = vi.fn((v: SwitchValue) => v);

        function Demo() {
            const [, setTick] = useState(0);
            const ref = useRef(deferred);
            return (
                <Switch
                    beforeChange={() => ref.current}
                    onChange={(v) => {
                        onChange(v);
                        setTick((t) => t + 1);
                    }}
                />
            );
        }

        render(<Demo />);
        const sw = screen.getByRole("switch");

        await userEvent.click(sw);
        expect(sw).toHaveAttribute("data-loading", "true");
        expect(sw).toBeDisabled();
        expect(onChange).not.toHaveBeenCalled();

        resolveHook(true);
        await waitFor(() => {
            expect(sw).toHaveAttribute("aria-checked", "true");
        });
        expect(sw).not.toBeDisabled();
        expect(onChange).toHaveBeenLastCalledWith(true);
    });
});
