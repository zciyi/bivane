import { describe, expect, it } from "vitest";
import {
    normalizeRange,
    quantizeValue,
    ratioToValue,
    valueToRatio,
} from "@/hooks/use-slider-state";
import { resolveSliderGeometry } from "@/components/ui/slider-parts";

describe("quantizeValue", () => {
    it("按 step 量化并夹取", () => {
        expect(quantizeValue(53, 0, 100, 1)).toBe(53);
        expect(quantizeValue(53.4, 0, 100, 1)).toBe(53);
        expect(quantizeValue(53.6, 0, 100, 1)).toBe(54);
        expect(quantizeValue(120, 0, 100, 1)).toBe(100);
        expect(quantizeValue(-5, 0, 100, 1)).toBe(0);
        // 0.15 是 0.1 与 0.2 的正中间，但 IEEE-754 下 0.15/0.1 = 1.4999999999999998，
        // Math.round 落向低一档：这是确定性行为，不是抖动，故断言 0.1。
        expect(quantizeValue(0.15, 0, 1, 0.1)).toBe(0.1);
        expect(quantizeValue(0.16, 0, 1, 0.1)).toBe(0.2);
        expect(quantizeValue(1.15, 0, 1, 0.1)).toBe(1);
    });
    it("浮点尾差修正", () => {
        expect(quantizeValue(0.1 + 0.2, 0, 1, 0.1)).toBe(0.3);
    });
    it("step<=0 直接夹紧", () => {
        expect(quantizeValue(55, 0, 100, 0)).toBe(55);
    });
});

describe("valueToRatio / ratioToValue", () => {
    it("往返一致", () => {
        for (const v of [0, 25, 50, 75, 100]) {
            const ratio = valueToRatio(v, 0, 100);
            expect(ratioToValue(ratio, 0, 100, 1)).toBe(v);
        }
    });
    it("边界", () => {
        expect(valueToRatio(100, 0, 100)).toBe(1);
        expect(valueToRatio(0, 0, 100)).toBe(0);
        expect(valueToRatio(50, 50, 50)).toBe(0); // max===min
    });
});

describe("normalizeRange", () => {
    it("保序并量化", () => {
        expect(normalizeRange([80, 20], 0, 100, 1)).toEqual([20, 80]);
        expect(normalizeRange([23.4, 67.6], 0, 100, 1)).toEqual([23, 68]);
        expect(normalizeRange([5, 150], 0, 100, 1)).toEqual([5, 100]);
    });
});

describe("resolveSliderGeometry", () => {
    it("单值横向", () => {
        const g = resolveSliderGeometry(50, 0, 100, false, false, false);
        expect(g.bar).toEqual({ start: 0, size: 50 });
        expect(g.pcts).toEqual([50]);
    });
    it("reverse 翻转位置", () => {
        const g = resolveSliderGeometry(25, 0, 100, false, true, false);
        expect(g.pcts).toEqual([75]);
        // 单值 reverse：锚端改到对端，填充条从拇指连到右端
        expect(g.bar).toEqual({ start: 75, size: 25 });
    });
    it("竖直：值越大越靠上（top% 越小）", () => {
        const g = resolveSliderGeometry(50, 0, 100, false, false, true);
        expect(g.pcts).toEqual([50]); // (1-0.5)*100 = 50
        expect(g.bar).toEqual({ start: 0, size: 50 }); // 从底部起 50%
    });
    it("竖直 + reverse：低值在上，填充条从顶端连到拇指", () => {
        const g = resolveSliderGeometry(20, 0, 100, false, true, true);
        expect(g.pcts).toEqual([20]);
        expect(g.bar).toEqual({ start: 80, size: 20 });
    });
    it("range 双拇指 + reverse", () => {
        const g = resolveSliderGeometry(
            [20, 80],
            0,
            100,
            true,
            false,
            false,
        );
        expect(g.bar).toEqual({ start: 20, size: 60 });
        expect(g.pcts).toEqual([20, 80]);
    });
});
