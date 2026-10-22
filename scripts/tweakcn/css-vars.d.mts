/** 类型声明：css-vars.mjs（零依赖 CSS 变量提取器） */

export function stripComments(css: string): string;
export function extractBlocks(css: string): Map<string, string[]>;
export function extractDecls(body: string): Record<string, string>;
export function collectScopes(
    files: string[],
    scopeSelectors: string[],
): Record<string, Record<string, string>>;
export function resolveVar(
    scope: Record<string, string>,
    name: string,
): string | null;
export function isColorLiteral(value: string | null | undefined): boolean;
