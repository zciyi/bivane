import { describe, expect, it } from "vitest";
import {
    buildRateHitRanges,
    clampRateValue,
    rateScoreFromX,
    resolveStarFraction,
    selectRateTarget,
} from "@/hooks/use-rate-state";

describe("clampRateValue", () => {
    it("整数模式四舍五入到 0~count", () => {
        expect(clampRateValue(3, 5, false)).toBe(3);
        expect(clampRateValue(2.4, 5, false)).toBe(2);
        expect(clampRateValue(2.6, 5, false)).toBe(3);
        expect(clampRateValue(5.6, 5, false)).toBe(5);
        expect(clampRateValue(-2, 5, false)).toBe(0);
        expect(clampRateValue(9, 5, false)).toBe(5);
        expect(clampRateValue(NaN, 5, false)).toBe(0);
    });
    it("半星模式对 0.5 取整并夹取", () => {
        expect(clampRateValue(2.2, 5, true)).toBe(2);
        expect(clampRateValue(2.3, 5, true)).toBe(2.5);
        expect(clampRateValue(2.8, 5, true)).toBe(3);
        expect(clampRateValue(5.9, 5, true)).toBe(5);
        expect(clampRateValue(-1, 5, true)).toBe(0);
    });
});

describe("resolveStarFraction", () => {
    it("返回第 index 颗星的填充比例", () => {
        expect(resolveStarFraction(0, 0)).toBe(0);
        expect(resolveStarFraction(2.5, 2)).toBe(0.5);
        expect(resolveStarFraction(3, 1)).toBe(1);
        expect(resolveStarFraction(0.5, 0)).toBe(0.5);
    });
    it("越界裁切到 0~1", () => {
        expect(resolveStarFraction(0.2, 1)).toBe(0);
        expect(resolveStarFraction(10, 0)).toBe(1);
    });
});

describe("selectRateTarget", () => {
    it("整星目标 = index + 1", () => {
        expect(selectRateTarget(2, false, false)).toBe(3);
    });
    it("半星左半 = index+0.5，右半 = index+1", () => {
        expect(selectRateTarget(2, true, true)).toBe(2.5);
        expect(selectRateTarget(2, false, true)).toBe(3);
        // allowHalf=false 时即使落在左半也按整星处理
        expect(selectRateTarget(2, true, false)).toBe(3);
    });
});

describe("buildRateHitRanges + rateScoreFromX（按坐标算分，对齐 Vant getScoreByPosition）", () => {
    // 5 颗星、每颗 20px、间距 24px：left = 0 / 24 / 48 / 72 / 96
    const rects = [0, 24, 48, 72, 96].map((left) => ({ left, width: 20 }));

    it("整星模式：每颗星一条区间，落点用x 决定分数", () => {
        const ranges = buildRateHitRanges(rects, false);
        expect(ranges).toHaveLength(5);
        // 落在第 1 颗内（0~24 之间的点）= 1 分
        expect(rateScoreFromX(5, ranges)).toBe(1);
        expect(rateScoreFromX(23, ranges)).toBe(1);
        // 第 2 颗：24~48
        expect(rateScoreFromX(25, ranges)).toBe(2);
        expect(rateScoreFromX(47, ranges)).toBe(2);
        // 最后一颗右边缘 = 116
        expect(rateScoreFromX(115, ranges)).toBe(5);
    });

    it("整星模式：点在第一颗星左侧返回 null（调用方按 allowHalf 兜底）", () => {
        const ranges = buildRateHitRanges(rects, false);
        expect(rateScoreFromX(0, ranges)).toBeNull();
        expect(rateScoreFromX(-10, ranges)).toBeNull();
    });

    it("关键回归：每颗星的右边缘仍归属自己，不被下一颗抢走", () => {
        // 这是真实缺陷的形状：先前用 44px 热区叠加，每颗星右半 10px
        // 会被下一颗的兄弟节点抢走（实测点第 1 颗 x=55 / 右边缘 59.5 → star#2）。
        const ranges = buildRateHitRanges(rects, false);
        expect(rateScoreFromX(19.5, ranges)).toBe(1);
        expect(rateScoreFromX(20, ranges)).toBe(1);
        expect(rateScoreFromX(23.9, ranges)).toBe(1);
        // 越过第一颗右边缘后才算第二颗
        expect(rateScoreFromX(24.1, ranges)).toBe(2);
    });

    it("半星模式：每颗星拆成两条（左半 index+0.5 / 右半 index+1）", () => {
        const ranges = buildRateHitRanges(rects, true);
        expect(ranges).toHaveLength(10);
        // 第 1 颗 left=0，宽 20 → 中线 10
        expect(rateScoreFromX(5, ranges)).toBe(0.5);
        expect(rateScoreFromX(9.9, ranges)).toBe(0.5);
        expect(rateScoreFromX(10.1, ranges)).toBe(1);
        expect(rateScoreFromX(23.9, ranges)).toBe(1);
        // 第 2 颗左半 = 1.5
        expect(rateScoreFromX(25, ranges)).toBe(1.5);
        expect(rateScoreFromX(33.9, ranges)).toBe(1.5);
        expect(rateScoreFromX(34.1, ranges)).toBe(2);
    });

    it("半星模式：正好落在中线上归左半（严格 > 判定，与 Vant 一致）", () => {
        const ranges = buildRateHitRanges(rects, true);
        // 右半的 left 就是中线本身，`x > left` 不成立 → 归左半。
        // 这是**刻意**的：中线是 0.5 与 1 的分界，判给半星侧更保守。
        expect(rateScoreFromX(10, ranges)).toBe(0.5);
        expect(rateScoreFromX(34, ranges)).toBe(1.5);
        // 越过中线一点点才算右半
        expect(rateScoreFromX(10.1, ranges)).toBe(1);
        expect(rateScoreFromX(34.1, ranges)).toBe(2);
    });

    it("count=1 时也能工作", () => {
        const ranges = buildRateHitRanges([{ left: 0, width: 20 }], false);
        expect(rateScoreFromX(10, ranges)).toBe(1);
        expect(rateScoreFromX(0, ranges)).toBeNull();
    });
});
