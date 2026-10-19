import { describe, expect, it } from "vitest";
import {
    addNumber,
    formatNumericInput,
    limitDecimalDigits,
    normalizeValue,
    toDisplayText,
} from "@/hooks/use-input-number-state";

/**
 * InputNumber 值纯函数（移植自 Vant 4 stepper）。
 * 键入中间态（"" / "." / "1."）的边界 DOM 测不出来，必须钉在纯函数层。
 */

const baseOpts = {
    min: 1,
    max: 10,
    integer: false,
    allowEmpty: false,
} as const;

describe("formatNumericInput", () => {
    it("剔除非数字字符，只保留第一个小数点", () => {
        expect(formatNumericInput("12a3.4.5", true)).toBe("123.45");
        expect(formatNumericInput("-1.2", true)).toBe("1.2");
        expect(formatNumericInput("..9.", true)).toBe(".9");
    });

    it("allowDecimal=false 时小数点也剔除（integer 模式）", () => {
        expect(formatNumericInput("1.2.3", false)).toBe("123");
    });
});

describe("limitDecimalDigits", () => {
    it("小数部分超长截断，整数部分不动", () => {
        expect(limitDecimalDigits("1.234", 2)).toBe("1.23");
        expect(limitDecimalDigits("12", 2)).toBe("12");
    });
});

describe("addNumber", () => {
    it("规避二进制尾差", () => {
        expect(addNumber(0.1, 0.2)).toBe(0.3);
        expect(addNumber(1, 2)).toBe(3);
        expect(addNumber(0.7, -0.3)).toBe(0.4);
    });
});

describe("toDisplayText", () => {
    it("null 展示为空串；decimalLength 补零", () => {
        expect(toDisplayText(null)).toBe("");
        expect(toDisplayText(1, 2)).toBe("1.00");
        expect(toDisplayText(1.5)).toBe("1.5");
    });
});

describe("normalizeValue", () => {
    it("空串归 0 后夹到 min（Vant：失焦不能留下空值）", () => {
        expect(normalizeValue("", baseOpts)).toBe(1);
    });

    it("allowEmpty 时空值归一为 null", () => {
        expect(
            normalizeValue("", { ...baseOpts, allowEmpty: true }),
        ).toBeNull();
        expect(
            normalizeValue(null, { ...baseOpts, allowEmpty: true }),
        ).toBeNull();
    });

    it("夹到 [min, max]；autoFixed=false 时保留超界中间值", () => {
        expect(normalizeValue(99, baseOpts)).toBe(10);
        // Vant 输入不接受负号（正则剔非数字字符），下界用 0 验证
        expect(normalizeValue(0, baseOpts)).toBe(1);
        expect(normalizeValue(99, baseOpts, false)).toBe(99);
    });

    it("integer 模式把小数点剔除（键入期每键过滤，format 同语义）", () => {
        // "3.9" → 去点 "39"；39 在界内，直接返回 39（非法点号本应在按键时被拦）
        expect(
            normalizeValue("3.9", {
                min: 1,
                max: 100,
                integer: true,
                allowEmpty: false,
            }),
        ).toBe(39);
    });

    it("decimalLength 固定精度", () => {
        expect(
            normalizeValue(2.345, { ...baseOpts, decimalLength: 1 }),
        ).toBe(2.3);
        expect(
            normalizeValue(2, { ...baseOpts, decimalLength: 2 }),
        ).toBe(2);
    });

    it("科学计数法先展开（1e-8 不能被正则吃掉）", () => {
        expect(
            normalizeValue(1e-8, { min: 0, max: 1, integer: false, allowEmpty: false }),
        ).toBe(0.00000001);
    });

    it("非数字文本回退 min", () => {
        expect(normalizeValue("abc", baseOpts)).toBe(1);
    });

    it("min=0 时 0 不被误夹", () => {
        expect(
            normalizeValue(0, { min: 0, max: 5, integer: true, allowEmpty: false }),
        ).toBe(0);
    });
});
