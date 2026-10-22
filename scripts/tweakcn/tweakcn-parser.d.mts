/** 类型声明：tweakcn-parser.mjs（tweakcn 导入器的逐字复刻，用作真值判定器） */

export const TWEAKCN_VARIABLE_NAMES: string[];
export const TWEAKCN_COMMON_STYLES: string[];

export function extractCssBlockContent(input: string, selector: string): string | null;
export function processColorValue(value: string): string;
export function toHex(value: string): string;

export function parseCssInput(input: string): {
    lightColors: Record<string, string>;
    darkColors: Record<string, string>;
};
