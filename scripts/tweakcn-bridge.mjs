#!/usr/bin/env node
/**
 * Bivane · tweakcn 双向桥接器
 *
 * 两个方向：
 *   export  Bivane token  →  tweakcn 可导入的 CSS（贴进 tweakcn 的 Import Custom CSS）
 *   import  tweakcn CSS   →  Bivane 品牌风格类（.bv-theme-xxx，贴进自己的项目）
 *
 * ── 为什么需要它 ────────────────────────────────────────────────
 * tweakcn 的导入器（源码 utils/parse-css-input.ts）只认两样东西：
 *   1. 字面量的 `:root { … }` 与 `.dark { … }` 两个块
 *   2. 44 个 shadcn 风格变量名（--primary / --background / …）
 * Bivane 的 CSS 写的是 `:root, :host { … }` 与 `.bv-theme-dark { … }`，
 * 变量名全是 `--bv-*` —— 直接丢进去，tweakcn 会**静默导入 0 个变量**，
 * 表现为「导入成功但一个颜色都没变」。这个脚本就是补上这层翻译。
 *
 * ── 关键约束 ────────────────────────────────────────────────────
 * · 颜色必须是**字面量**（hex/hsl/oklch），不能是 var() 引用 ——
 *   tweakcn 交给 culori 解析，var() 会解析失败并被静默丢弃。
 * · 产物必须用**字面量** `:root` / `.dark` 选择器，不能用 `:root, :host`。
 * · 导入产物只覆盖**品牌槽**，不动中性槽（理由见 mapping.mjs 的注释）。
 *
 * 用法：
 *   node scripts/tweakcn-bridge.mjs export  [--out <file>]
 *   node scripts/tweakcn-bridge.mjs import  <tweakcn.css> --name <name> [--out <file>]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CHART_ROLE,
    TO_BIVANE,
    TO_TWEAKCN,
    TWEAKCN_COLOR_SLOTS,
    TWEAKCN_SLOTS,
} from './tweakcn/mapping.mjs';
import {
    collectScopes,
    extractBlocks,
    extractDecls,
    isColorLiteral,
    resolveVar,
} from './tweakcn/css-vars.mjs';
import { normalizeColor } from './tweakcn/color.mjs';
import { parseCssInput } from './tweakcn/tweakcn-parser.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES_DIR = join(ROOT, 'packages/tokens/styles');

/** Bivane 的基座作用域选择器（vant.css 用的是 `:root, :host`） */
const BASE_SCOPE = ':root, :host';

/** 深色主题的作用域选择器 */
const DARK_SCOPE = '.bv-theme-dark';

/**
 * 读取 Bivane 的 token 表。
 *
 * @param {string[]} extraFiles 额外并入的 CSS（用于把某个风格当作基座导出）
 * @returns {{base: Record<string,string>, dark: Record<string,string>, style: Record<string,string>}}
 */
export function readBivaneTokens(extraFiles = []) {
    const base = collectScopes(
        [readFileSync(join(STYLES_DIR, 'vant.css'), 'utf8')],
        [BASE_SCOPE],
    )[BASE_SCOPE] ?? {};

    const dark = {
        ...base,
        ...(collectScopes([readFileSync(join(STYLES_DIR, 'vant-dark.css'), 'utf8')], [DARK_SCOPE])[
            DARK_SCOPE
        ] ?? {}),
    };

    // 风格文件（vant-ocean.css / vant-grape.css）的作用域形如 `.bv-theme-ocean`
    const style = {};
    for (const file of extraFiles) {
        const css = readFileSync(file, 'utf8');
        const scopes = collectScopes(
            [css],
            [...new Set([...extractBlocks(css).keys()].filter((s) => s.startsWith('.bv-theme-')))],
        );
        for (const body of Object.values(scopes)) Object.assign(style, body);
    }

    return { base, dark, style };
}

/**
 * 导出：把 Bivane 的 token 翻译成 tweakcn 可导入的 CSS。
 *
 * @param {Record<string,string>} scope  当前作用域的 token 表（已含深色或风格覆盖）
 * @param {'light'|'dark'} mode
 * @returns {string}  tweakcn 格式的 CSS 片段
 */
export function exportTweakcnCss(scope, mode) {
    const lines = [];
    for (const slot of TWEAKCN_SLOTS) {
        const source = TO_TWEAKCN[slot];
        let value;
        if (source.startsWith('literal:')) {
            value = source.slice('literal:'.length);
        } else {
            value = resolveVar(scope, source);
            if (value === null) continue; // 该作用域缺这个槽 → 跳过（tweakcn 会用默认值）
        }
        // 颜色槽必须是合法颜色字面量，否则 tweakcn 的 culori 解析失败会静默丢弃
        if (TWEAKCN_COLOR_SLOTS.includes(slot) && !isColorLiteral(value)) {
            throw new Error(
                `导出中止：槽 ${slot}（来源 ${source}）解析出的 "${value}" 不是合法颜色字面量。` +
                    `tweakcn 会把它静默丢弃。`,
            );
        }
        // 折叠内部空白：vant.css 里 --bv-base-font 是多行写的，导出产物要单行
        // （多行值在 tweakcn 的正则里虽能匹配，但产物可读性差、且可能被别的工具截断）
        lines.push(`  --${slot}: ${value.replace(/\s+/g, ' ').trim()};`);
    }
    const selector = mode === 'dark' ? '.dark' : ':root';
    return `${selector} {\n${lines.join('\n')}\n}`;
}

/**
 * 组装完整的导出产物：浅色 :root + 深色 .dark。
 *
 * @param {{base:object, dark:object, style:object}} tokens
 * @param {{name?:string, includeDark?:boolean}} opts
 */
export function buildExport(tokens, opts = {}) {
    const name = opts.name ?? 'Bivane';
    const includeDark = opts.includeDark !== false;

    // 风格覆盖品牌槽：把风格表的品牌槽并进作用域
    const lightScope = { ...tokens.base, ...tokens.style };
    // 深色作用域 = 深色表（含深色中性槽） + 风格品牌槽
    const darkScope = { ...tokens.dark, ...tokens.style };

    const parts = [
        `/**`,
        ` * ${name} · tweakcn 主题导出`,
        ` *`,
        ` * 用法：打开 tweakcn.com/editor/theme → Import → 粘贴本文件内容。`,
        ` *`,
        ` * ⚠ 本文件由 scripts/tweakcn-bridge.mjs 生成，勿手改。`,
        ` *   重新生成：npm run tweakcn:export`,
        ` */`,
        ``,
        exportTweakcnCss(lightScope, 'light'),
    ];
    if (includeDark) {
        parts.push(``, exportTweakcnCss(darkScope, 'dark'));
    }
    const css = parts.join('\n') + '\n';

    // ── 写出前自查 ────────────────────────────────────────────────
    // 用 tweakcn 自己的解析器回读一遍产物，确认 44 个槽都在、颜色都是字面量。
    // 这道闸门挡住的是「文件看着对、tweakcn 读不出来」的静默失败 ——
    // 那正是桥接最初要解决的问题，不能自己再犯一遍。
    assertExportIsImportable(css);

    return css;
}

/**
 * 自查：产物必须能被 tweakcn 的真实解析器完整读出。
 *
 * 依赖 packages/tokens/tweakcn/tweakcn-parser.mjs（tweakcn 源码的逐字复刻）。
 */
export function assertExportIsImportable(css) {
    const { lightColors, darkColors } = parseCssInput(css);

    for (const [mode, colors] of [
        ['浅色', lightColors],
        ['深色', darkColors],
    ]) {
        const missing = TWEAKCN_SLOTS.filter((s) => !(s in colors));
        if (missing.length) {
            throw new Error(
                `导出自查失败：${mode}块有 ${missing.length} 个槽 tweakcn 读不出来（${missing.join(', ')}）。` +
                    `这会导致「导入成功但颜色没变」。`,
            );
        }
        for (const slot of TWEAKCN_COLOR_SLOTS) {
            if (!isColorLiteral(colors[slot])) {
                throw new Error(
                    `导出自查失败：${mode}块的 --${slot} = "${colors[slot]}" 不是合法颜色字面量，` +
                        `tweakcn 的 culori 会解析失败并静默丢弃。`,
                );
            }
        }
    }
}

/**
 * 导入：把 tweakcn 导出的 CSS 翻译回 Bivane 品牌风格类。
 *
 * @param {string} css       tweakcn 导出的 CSS
 * @param {string} className 生成的类名（不含点）
 * @returns {string} Bivane 风格类 CSS
 */
export function importTweakcnCss(css, className) {
    const blocks = extractBlocks(css);
    const light = {};
    const dark = {};
    for (const [selector, bodies] of blocks) {
        if (selector !== ':root' && selector !== '.dark') continue;
        const bucket = selector === ':root' ? light : dark;
        for (const body of bodies) Object.assign(bucket, extractDecls(body));
    }

    const total = Object.keys(light).length + Object.keys(dark).length;
    if (total === 0) {
        throw new Error(
            '导入中止：没能从输入里解析出任何 tweakcn 变量。\n' +
                'tweakcn 的 CSS 必须包含字面量的 `:root { … }` 块（深色用 `.dark { … }`），\n' +
                '变量名限 --primary / --background / --muted 等 44 个 shadcn 风格名。',
        );
    }

    // 品牌槽取值：浅色优先，缺失时用深色兜底
    // ⚠ 键名带 `--` 前缀（extractDecls 的输出形式），而映射表用 tweakcn 的裸名
    const pick = (slot) => light[`--${slot}`] ?? dark[`--${slot}`];

    const brand = {};
    for (const [slot, bvSlot] of Object.entries(TO_BIVANE)) {
        const value = pick(slot);
        if (value === undefined) continue;
        brand[bvSlot] = normalizeColor(value);
    }

    // chart 槽的角色约定：chart-1=主色 / chart-2=成功 / chart-3=警告
    // 主色已经在 TO_BIVANE 里由 primary 给出；这里只补成功/警告两个
    for (const [chartSlot, role] of Object.entries(CHART_ROLE)) {
        if (role === 'primary') continue;
        const value = pick(chartSlot);
        if (value === undefined) continue;
        const bvSlot = role === 'success' ? '--bv-green' : '--bv-orange';
        if (brand[bvSlot] === undefined) brand[bvSlot] = normalizeColor(value);
    }

    const entries = Object.entries(brand);
    const body = entries.map(([k, v]) => `    ${k}: ${v};`).join('\n');

    return `/**
 * ${className} · 由 tweakcn 主题导入生成（Bivane 品牌风格）
 *
 * 用法：<html class="bv-theme-${className}">，可与 bv-theme-dark 叠加。
 *
 * ⚠ 本文件由 scripts/tweakcn-bridge.mjs 生成，勿手改。
 *
 * 只覆盖品牌槽（--bv-blue / --bv-red / --bv-green / --bv-orange …）——
 * 中性槽（文本 / 边框 / 底色）由 Bivane 的 Vant 复刻基线统一保证，
 * 不允许被外部主题改写（理由见 packages/tokens/tweakcn/mapping.mjs）。
 */
.bv-theme-${className} {
${body}
}
`;
}

/* ─────────────────────────── CLI ─────────────────────────── */

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const key = a.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                args[key] = next;
                i += 1;
            } else {
                args[key] = true;
            }
        } else {
            args._.push(a);
        }
    }
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const cmd = args._[0];

    if (cmd === 'export') {
        // 消费者项目里没有本仓的 tokens 源文件 —— export 只在 Bivane 仓库内可用。
        // 消费者拿到的 styles/bivane/tweakcn.css 是**预生成**的产物，直接用即可。
        if (!existsSync(join(STYLES_DIR, 'vant.css'))) {
            console.error(
                'export 只能在 Bivane 仓库内运行（需要 packages/tokens/styles/ 下的源文件）。\n' +
                    '你若是在消费者项目里：直接用预生成产物 styles/bivane/tweakcn.css，\n' +
                    '把它贴进 tweakcn 的 Import Custom CSS 即可。',
            );
            process.exit(1);
        }
        const styleFile = args.style
            ? join(STYLES_DIR, `vant-${args.style}.css`)
            : null;
        if (styleFile && !existsSync(styleFile)) {
            console.error(`找不到风格文件：${styleFile}`);
            process.exit(1);
        }
        const tokens = readBivaneTokens(styleFile ? [styleFile] : []);
        const name = args.style ? `Bivane ${args.style}` : 'Bivane';
        const css = buildExport(tokens, { name });
        if (args.out) {
            writeFileSync(args.out, css, 'utf8');
            console.log(`已写入 ${args.out}（${css.length} 字节）`);
        } else {
            process.stdout.write(css);
        }
        return;
    }

    if (cmd === 'import') {
        const input = args._[1];
        const name = args.name ?? 'custom';
        if (!input) {
            console.error('用法：tweakcn-bridge import <tweakcn.css> --name <name>');
            process.exit(1);
        }
        const css = importTweakcnCss(readFileSync(input, 'utf8'), name);
        if (args.out) {
            writeFileSync(args.out, css, 'utf8');
            console.log(`已写入 ${args.out}（${css.length} 字节）`);
        } else {
            process.stdout.write(css);
        }
        return;
    }

    console.error(
        '用法：\n' +
            '  tweakcn-bridge export [--style ocean|grape] [--out <file>]\n' +
            '  tweakcn-bridge import <tweakcn.css> --name <name> [--out <file>]',
    );
    process.exit(1);
}

// 仅在被直接执行时跑 CLI（被 import 时不跑）
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
