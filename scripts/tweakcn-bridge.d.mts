/** 类型声明：tweakcn-bridge.mjs（Bivane ↔ tweakcn 双向桥接 CLI） */

export interface BivaneTokens {
    base: Record<string, string>;
    dark: Record<string, string>;
    style: Record<string, string>;
}

export interface ExportOptions {
    /** 导出产物的标题（默认 'Bivane'） */
    name?: string;
    /** 是否包含深色块（默认 true） */
    includeDark?: boolean;
}

/** 读取 Bivane 的 token 表（基座 / 深色 / 风格覆盖） */
export function readBivaneTokens(extraFiles?: string[]): BivaneTokens;

/** 把一个作用域的 token 翻译成 tweakcn 可导入的 CSS 片段 */
export function exportTweakcnCss(
    scope: Record<string, string>,
    mode: 'light' | 'dark',
): string;

/** 组装完整导出产物（浅色 :root + 深色 .dark），带写出前自查 */
export function buildExport(tokens: BivaneTokens, opts?: ExportOptions): string;

/** 自查：产物必须能被 tweakcn 的真实解析器完整读出，否则抛错 */
export function assertExportIsImportable(css: string): void;

/** 导入：tweakcn CSS → Bivane 品牌风格类 */
export function importTweakcnCss(css: string, className: string): string;
