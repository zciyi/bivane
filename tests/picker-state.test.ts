import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  edgeEnabledIndex,
  isDraftComplete,
  normalizeColumns,
  resolveColumnIndex,
  resolveDraftValues,
  stepEnabledIndex,
  usePickerState,
  type PickerColumnsInput,
} from "@/hooks/use-picker-state";

/**
 * Picker 共享模型纯函数测试。
 * 重点：列与列互不影响（独立多列）、失效值的落点兜底、空列禁止提交、键盘跳禁用。
 */

const COLUMNS: PickerColumnsInput = [
    // 字面量列
    ["A", "B", "C"],
    // 带禁用项的对象列
    [
      { label: "X", value: "x" },
      { label: "Y（禁用）", value: "y", disabled: true },
      { label: "Z", value: "z" },
    ],
  ];

describe("normalizeColumns", () => {
  it("字面量项归一化为 label/value 相同的对象", () => {
    const [first, second] = normalizeColumns(COLUMNS);
    expect(first[0]).toEqual({ label: "A", value: "A" });
    expect(second[1]).toEqual({ label: "Y（禁用）", value: "y", disabled: true });
  });
});

describe("resolveColumnIndex", () => {
  const [first, second] = normalizeColumns(COLUMNS);

  it("精确值命中（即使该项禁用也尊重回显）", () => {
    expect(resolveColumnIndex(first, "B")).toBe(1);
    expect(resolveColumnIndex(second, "y")).toBe(1);
  });

  it("值对不上时落到第一个可选项，而不是停在不存在的值上", () => {
    expect(resolveColumnIndex(first, "ZZZ")).toBe(0);
    // 第二列第一个可选项是 X（下标 0），不是禁用的 Y
    expect(resolveColumnIndex(second, undefined)).toBe(0);
  });
});

describe("resolveDraftValues / isDraftComplete", () => {
  const normalized = normalizeColumns(COLUMNS);

  it("逐列播种：失效列落首个可选项", () => {
    expect(resolveDraftValues(normalized, ["ZZZ", "z"])).toEqual(["A", "z"]);
  });

  it("空列给 undefined，且草稿因此不完整", () => {
    const withEmpty = normalizeColumns([["A"], [], ["X"]]);
    const draft = resolveDraftValues(withEmpty, []);
    expect(draft).toEqual(["A", undefined, "X"]);
    expect(isDraftComplete(draft)).toBe(false);
  });

  it("每列都有值才算完整；空草稿不完整", () => {
    expect(isDraftComplete(resolveDraftValues(normalized, []))).toBe(true);
    expect(isDraftComplete([])).toBe(false);
  });
});

describe("键盘步进", () => {
  const [, second] = normalizeColumns(COLUMNS);

  it("到边界不回绕", () => {
    expect(stepEnabledIndex(second, 2, 1)).toBe(2);
    expect(stepEnabledIndex(second, 0, -1)).toBe(0);
  });

  it("步进跳过禁用项", () => {
    // 从 X（0）向下应越过禁用的 Y（1）落到 Z（2）
    expect(stepEnabledIndex(second, 0, 1)).toBe(2);
    // 从 Z 向上越过禁用的 Y 回到 X
    expect(stepEnabledIndex(second, 2, -1)).toBe(0);
  });

  it("Home/End 取首尾可选项", () => {
    expect(edgeEnabledIndex(second, "start")).toBe(0);
    expect(edgeEnabledIndex(second, "end")).toBe(2);
  });
});

describe("usePickerState", () => {
  it("非受控：setValue 触发 onChange 并带出对应选项；clear 清空", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      usePickerState({ columns: COLUMNS, onChange }),
    );

    act(() => {
      result.current.setValue(["B", "z"]);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [values, options] = onChange.mock.calls[0];
    expect(values).toEqual(["B", "z"]);
    expect(options.map((o: { value: unknown }) => o?.value)).toEqual(["B", "z"]);

    act(() => {
      result.current.clear();
    });
    expect(onChange).toHaveBeenLastCalledWith([], []);
  });

  it("受控：内部不改值，selectedOptions 按列对齐（失效值为 undefined）", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string[] }) =>
        usePickerState({ columns: COLUMNS, value }),
      { initialProps: { value: ["A", "y"] } },
    );
    expect(result.current.selectedOptions.map((o) => o?.value)).toEqual(["A", "y"]);

    // 失效值不回显选项
    rerender({ value: ["A", "ZZZ"] });
    expect(result.current.selectedOptions[1]).toBeUndefined();
  });
});
