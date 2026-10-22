/**
 * tweakcn 导入器的**逐字复刻**（来源：jnsahaj/tweakcn 仓库 utils/parse-css-input.ts）
 *
 * 这是桥接的「真值判定器」—— 我们不能只验证「我们的导出看起来对」，
 * 必须验证「tweakcn 自己的解析器能从中读出我们期望的值」。
 *
 * 原实现要点（逐条对齐）：
 *  1. extractCssBlockContent 用正则 `${selector}\s*{([^}]+)}` —— 要求**字面量**选择器，
 *     且块内不能出现 `}`。所以 `:root, :host {` 匹配不上 `:root`！
 *  2. variableNames = Object.keys(defaultThemeState.styles.light) —— 44 个名字，
 *     不在名单里的**直接丢弃**（不报错）。
 *  3. COMMON_STYLES 里的变量原样保留；其余走 processColorValue → colorFormatter(hex)。
 *  4. processColorValue：值以数字开头 → 当作 hsl 的裸通道值包成 hsl(...)。
 *  5. culori.parse 解析失败 → colorFormatter 捕获异常并**原样返回**（不抛）。
 *
 * 与原实现唯一的差别：colorFormatter 用我们自己的 hex 归一化代替 culori，
 * 因为本仓不引入 culori。归一化规则与 culori.formatHex 一致（转小写、补齐 6 位）。
 */

export const TWEAKCN_VARIABLE_NAMES = [
    'background', 'foreground', 'card', 'card-foreground', 'popover', 'popover-foreground',
    'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
    'muted', 'muted-foreground', 'accent', 'accent-foreground',
    'destructive', 'destructive-foreground',
    'border', 'input', 'ring',
    'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5',
    'sidebar', 'sidebar-foreground', 'sidebar-primary', 'sidebar-primary-foreground',
    'sidebar-accent', 'sidebar-accent-foreground', 'sidebar-border', 'sidebar-ring',
    'font-sans', 'font-serif', 'font-mono',
    'radius',
    'shadow-color', 'shadow-opacity', 'shadow-blur', 'shadow-spread',
    'shadow-offset-x', 'shadow-offset-y',
    'letter-spacing', 'spacing',
];

export const TWEAKCN_COMMON_STYLES = [
    'font-sans', 'font-serif', 'font-mono', 'radius',
    'shadow-opacity', 'shadow-blur', 'shadow-spread',
    'shadow-offset-x', 'shadow-offset-y', 'letter-spacing', 'spacing',
];

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 原版：new RegExp(`${selector}\s*{([^}]+)}`)，取第一个匹配 */
export function extractCssBlockContent(input, selector) {
    const regex = new RegExp(`${escapeRegExp(selector)}\\s*{([^}]+)}`);
    return input.match(regex)?.[1]?.trim() || null;
}

/** 原版 processColorValue：值以数字开头 → 当裸 HSL 通道值 */
export function processColorValue(value) {
    return /^\d/.test(value) ? `hsl(${value})` : value;
}

/**
 * 归一化成 hex（对应 culori.formatHex）。
 * 只处理 hex 输入 —— tweakcn 导出的主题里颜色槽必然已是 hex（culori 转过了）。
 */
export function toHex(value) {
    const v = value.trim();
    const m = /^#([0-9a-fA-F]{3,8})$/.exec(v);
    if (!m) return v;
    let hex = m[1].toLowerCase();
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 8) hex = hex.slice(0, 6);
    return `#${hex}`;
}

/** 原版 parseColorVariables */
function parseColorVariables(cssContent, target, validNames) {
    const variableDeclarations = cssContent.match(/--[^:]+:\s*[^;]+/g) || [];
    for (const declaration of variableDeclarations) {
        const [name, value] = declaration.split(':').map((p) => p.trim());
        const cleanName = name.replace('--', '');
        if (!validNames.includes(cleanName)) continue; // 不在名单 → 丢弃
        if (TWEAKCN_COMMON_STYLES.includes(cleanName)) {
            target[cleanName] = value;
            continue;
        }
        target[cleanName] = toHex(processColorValue(value));
    }
}

/** 原版 parseCssInput */
export function parseCssInput(input) {
    const lightColors = {};
    const darkColors = {};
    const rootContent = extractCssBlockContent(input, ':root');
    const darkContent = extractCssBlockContent(input, '.dark');
    if (rootContent) parseColorVariables(rootContent, lightColors, TWEAKCN_VARIABLE_NAMES);
    if (darkContent) parseColorVariables(darkContent, darkColors, TWEAKCN_VARIABLE_NAMES);
    return { lightColors, darkColors };
}
