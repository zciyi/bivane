import { describe, expect, it } from "vitest";
import {
    createFileItem,
    formatFileSize,
    isImageFile,
    matchAccept,
    normalizeCompress,
    resolveAcceptList,
    validateFileSize,
} from "@/hooks/use-uploader-state";

/**
 * Uploader 纯函数单测（对齐 Vant 4 uploader 的校验与格式化语义）。
 */

function makeFile(name: string, type: string, size = 10): File {
    const f = new File(["x"], name, { type });
    Object.defineProperty(f, "size", { value: size });
    return f;
}

describe("formatFileSize", () => {
    it("0 / 负数 → 0 B", () => {
        expect(formatFileSize(0)).toBe("0 B");
        expect(formatFileSize(-5)).toBe("0 B");
    });
    it("B / KB / MB / GB 分级，整数不带小数", () => {
        expect(formatFileSize(100)).toBe("100 B");
        expect(formatFileSize(1024)).toBe("1 KB");
        expect(formatFileSize(1024 * 1024)).toBe("1 MB");
        expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    });
    it("非整除保留一位小数", () => {
        expect(formatFileSize(1536)).toBe("1.5 KB");
    });
});

describe("isImageFile", () => {
    it("按 MIME 判定", () => {
        expect(isImageFile(makeFile("a.png", "image/png"))).toBe(true);
        expect(isImageFile(makeFile("a.txt", "text/plain"))).toBe(false);
    });
    it("无 MIME 时按扩展名兜底", () => {
        expect(isImageFile(makeFile("a.JPG", ""))).toBe(true);
        expect(isImageFile(makeFile("a.pdf", ""))).toBe(false);
    });
    it("undefined → false", () => {
        expect(isImageFile(undefined)).toBe(false);
    });
});

describe("resolveAcceptList / matchAccept", () => {
    it("拆分并小写化 accept", () => {
        expect(resolveAcceptList("Image/*, .JPG ,")).toEqual(["image/*", ".jpg"]);
    });
    it("无 accept 一律通过", () => {
        expect(matchAccept(makeFile("a.exe", "application/x-msdownload"))).toBe(true);
    });
    it("MIME 前缀匹配", () => {
        const png = makeFile("a.png", "image/png");
        expect(matchAccept(png, "image/*")).toBe(true);
        expect(matchAccept(png, "video/*")).toBe(false);
    });
    it("扩展名匹配（大小写不敏感）", () => {
        expect(matchAccept(makeFile("a.JPG", "image/jpeg"), ".jpg")).toBe(true);
        expect(matchAccept(makeFile("a.gif", "image/gif"), ".jpg,.png")).toBe(false);
    });
});

describe("validateFileSize", () => {
    it("maxSize 未设 → 通过", () => {
        expect(validateFileSize(makeFile("a", "", 1e9))).toBe(true);
    });
    it("超限 → false；等于上限 → true", () => {
        const f = makeFile("a", "", 100);
        expect(validateFileSize(f, 99)).toBe(false);
        expect(validateFileSize(f, 100)).toBe(true);
    });
});

describe("normalizeCompress", () => {
    it("false / undefined → null", () => {
        expect(normalizeCompress(false)).toBeNull();
        expect(normalizeCompress(undefined)).toBeNull();
    });
    it("true → 默认 maxWidth 1080 / quality 0.8", () => {
        expect(normalizeCompress(true)).toEqual({ maxWidth: 1080, quality: 0.8 });
    });
    it("对象部分覆盖", () => {
        expect(normalizeCompress({ maxWidth: 800 })).toEqual({
            maxWidth: 800,
            quality: 0.8,
        });
    });
});

describe("createFileItem", () => {
    it("初始 uploading / percent 0，带文件名与唯一 key", () => {
        const a = createFileItem(makeFile("a.png", "image/png"));
        const b = createFileItem(makeFile("b.png", "image/png"));
        expect(a.status).toBe("uploading");
        expect(a.percent).toBe(0);
        expect(a.name).toBe("a.png");
        expect(a.file).toBeTruthy();
        expect(a.key).not.toBe(b.key);
    });
});