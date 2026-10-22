/**
 * 选择件（Checkbox / Radio）demo 共用的辅助件
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import type * as React from "react";

/**
 * 判断点击是否来自选择件自身。
 *
 * Checkbox / Radio 在 Cell 里是「整行可点」的，所以行级的 onClick
 * 必须能区分「点在了选择件上」（交给选择件自己处理）与「点在了行上」。
 */
export function isChoiceTarget(event: React.MouseEvent<HTMLDivElement>): boolean {
    return (
        (event.target as HTMLElement).closest(
            "[data-slot='checkbox'], [data-slot='radio']",
        ) !== null
    );
}
