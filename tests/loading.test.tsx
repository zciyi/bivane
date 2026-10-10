import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import {
  Loading,
  LoadingHost,
  showLoading,
  hideLoading,
} from "@/components/responsive/loading";
import { ResponsiveProvider } from "@/components/providers/responsive-provider";
import { resetLoadingStore } from "@/hooks/use-loading-store";
import { resetImperativeHosts } from "@/lib/imperative-host";

/**
 * Loading 双模式行为测试（契约 18）
 *
 * 模式 A/B 的验证重点：**两端形态一致（全屏遮罩 + 居中转圈），语义两端共有**。
 *   - 默认常驻，必须显式 hideLoading（对齐 Vant showLoadingToast）
 *   - forbidClick=false（默认）不阻断下层；true 才吃事件
 *   - mask=false 不渲染遮罩
 *   - 多条叠加时 store 全留、呈现层单例取最新
 */

function overlay(): HTMLElement | null {
  return document.querySelector('[data-slot="loading"]');
}

function spinner(): HTMLElement | null {
  return document.querySelector('[data-slot="loading-spinner"]');
}

function mask(): HTMLElement | null {
  return document.querySelector('[data-slot="loading-mask"]');
}

function actShow(fn: () => unknown): void {
  act(() => {
    fn();
  });
}

beforeEach(() => {
  resetLoadingStore();
});

afterEach(() => {
  resetImperativeHosts();
  vi.useRealTimers();
});

describe("h5 mode", () => {
  it("open 为真时渲染遮罩 + 转圈 + 文案，根挂 h5 模式属性", () => {
    render(
      <ResponsiveProvider mode="mobile">
        <Loading open text="努力加载中" />
      </ResponsiveProvider>,
    );

    expect(overlay()).toHaveAttribute("data-mode", "h5");
    expect(overlay()).toHaveAttribute("data-mask", "true");
    expect(mask()).not.toBeNull();
    expect(spinner()).not.toBeNull();
    expect(spinner()).toHaveAttribute("role", "img");
    // 转圈是功能语义：即使系统 prefers-reduced-motion（RDP/服务器会话默认 reduce）
    // 也不能停转，否则「加载中」与「界面卡死」无法区分
    expect(spinner()?.className).toContain("animate-spin");
    expect(spinner()?.className).not.toContain("animate-none");
    expect(
      document.querySelector('[data-slot="loading-text"]')?.textContent,
    ).toBe("努力加载中");
  });

  it("open 为假时不渲染任何内容", () => {
    render(
      <ResponsiveProvider mode="mobile">
        <Loading open={false} text="不该出现" />
      </ResponsiveProvider>,
    );

    expect(overlay()).toBeNull();
    expect(document.body.textContent).not.toContain("不该出现");
  });

  it("mask=false 时不渲染遮罩层（转圈仍在）", () => {
    render(
      <ResponsiveProvider mode="mobile">
        <Loading open mask={false} />
      </ResponsiveProvider>,
    );

    expect(mask()).toBeNull();
    expect(spinner()).not.toBeNull();
  });

  it("forbidClick 默认 false：容器不阻断下层；true 时吃掉指针事件", () => {
    const { rerender } = render(
      <ResponsiveProvider mode="mobile">
        <Loading open />
      </ResponsiveProvider>,
    );

    expect(overlay()?.className).toContain("pointer-events-none");

    rerender(
      <ResponsiveProvider mode="mobile">
        <Loading open forbidClick />
      </ResponsiveProvider>,
    );
    expect(overlay()?.className).toContain("pointer-events-auto");
  });
});

describe("pc mode", () => {
  it("PC 同形态：遮罩 + 居中转圈，根挂 pc 模式属性（遮罩浓度差异由 modes.css 承担）", () => {
    render(
      <ResponsiveProvider mode="desktop">
        <Loading open text="PC 加载" />
      </ResponsiveProvider>,
    );

    expect(overlay()).toHaveAttribute("data-mode", "pc");
    expect(mask()).not.toBeNull();
    expect(spinner()).not.toBeNull();
    expect(
      document.querySelector('[data-slot="loading-text"]')?.textContent,
    ).toBe("PC 加载");
  });

  it("PC 下同样遵守 forbidClick 语义", () => {
    render(
      <ResponsiveProvider mode="desktop">
        <Loading open forbidClick={false} />
      </ResponsiveProvider>,
    );
    expect(overlay()?.className).toContain("pointer-events-none");
  });
});

describe("命令式 API", () => {
  it("showLoading 默认常驻，advance 很久也不消失，须显式 hideLoading(id)", () => {
    vi.useFakeTimers();

    render(
      <ResponsiveProvider mode="mobile">
        <LoadingHost />
      </ResponsiveProvider>,
    );

    let handle: ReturnType<typeof showLoading> | null = null;
    actShow(() => {
      handle = showLoading({ text: "常驻" });
    });
    expect(overlay()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(overlay()).not.toBeNull();

    actShow(() => hideLoading(handle?.id));
    expect(overlay()).toBeNull();
  });

  it("传 duration 后到时自动关闭", () => {
    vi.useFakeTimers();

    render(
      <ResponsiveProvider mode="mobile">
        <LoadingHost />
      </ResponsiveProvider>,
    );

    actShow(() => showLoading({ duration: 1500 }));
    expect(overlay()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(overlay()).toBeNull();
  });

  it("多条叠加时 store 全部保留，呈现层单例只显示最新一条；关掉最新后上一条顶上来", () => {
    render(
      <ResponsiveProvider mode="mobile">
        <LoadingHost />
      </ResponsiveProvider>,
    );

    let first: ReturnType<typeof showLoading> | null = null;
    let second: ReturnType<typeof showLoading> | null = null;
    actShow(() => {
      first = showLoading({ text: "第一条" });
      second = showLoading({ text: "第二条" });
    });

    // 单例观感：宿主始终只渲染一个遮罩
    expect(document.querySelectorAll('[data-slot="loading"]')).toHaveLength(
      1,
    );
    expect(
      document.querySelector('[data-slot="loading-text"]')?.textContent,
    ).toBe("第二条");

    // 关掉最新一条后，上一条立刻顶上来
    actShow(() => second?.close());
    expect(overlay()).not.toBeNull();
    expect(
      document.querySelector('[data-slot="loading-text"]')?.textContent,
    ).toBe("第一条");

    actShow(() => first?.close());
    expect(overlay()).toBeNull();
  });

  it("hideLoading() 不传 id 时关闭全部", () => {
    render(
      <ResponsiveProvider mode="desktop">
        <LoadingHost />
      </ResponsiveProvider>,
    );

    actShow(() => {
      showLoading();
      showLoading();
    });

    actShow(() => hideLoading());
    expect(overlay()).toBeNull();
  });
});
