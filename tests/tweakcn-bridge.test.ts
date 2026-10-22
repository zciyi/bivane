import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
    buildExport,
    exportTweakcnCss,
    importTweakcnCss,
    readBivaneTokens,
} from '../scripts/tweakcn-bridge.mjs';
import {
    collectScopes,
    extractBlocks,
    extractDecls,
    isColorLiteral,
    resolveVar,
    stripComments,
} from '../scripts/tweakcn/css-vars.mjs';
import { normalizeColor } from '../scripts/tweakcn/color.mjs';
import {
    CHART_ROLE,
    TO_BIVANE,
    TO_TWEAKCN,
    TWEAKCN_COLOR_SLOTS,
    TWEAKCN_COMMON_SLOTS,
    TWEAKCN_SLOTS,
} from '../scripts/tweakcn/mapping.mjs';
import {
    parseCssInput,
    TWEAKCN_VARIABLE_NAMES,
} from '../scripts/tweakcn/tweakcn-parser.mjs';

/**
 * tweakcn 桥接契约测试
 *
 * ── 这个测试真正在验证什么 ──────────────────────────────────────
 * 不是「导出文件生成了」，而是**「tweakcn 自己的解析器能从中读出我们期望的值」**。
 * 依据是 tweakcn 源码 utils/parse-css-input.ts（已逐字复刻进
 * packages/tokens/tweakcn/tweakcn-parser.mjs）—— 那是唯一有意义的判定标准。
 *
 * 这条链路上的每个缺陷都是**静默**的：
 *  - 导出用了 `:root, :host` → tweakcn 匹配不到 → 导入 0 个变量，**不报错**
 *  - 导出色值写成 var() 引用 → culori 解析失败 → 变量被**丢弃**，不报错
 *  - 变量名不在 tweakcn 的 44 个名单里 → **丢弃**，不报错
 *  - 颜色函数多套一层 gamma → 颜色**偏亮**，仍能导入，不报错
 * 所以断言必须落在「实际被读出的值」上，不能只断言「文件存在」。
 *
 * ── 断言从哪来 ─────────────────────────────────────────────────
 * 参考值来自**独立实现**（Python stdlib colorsys + 手写 oklab 矩阵），
 * 不是从本仓实现反推的 —— 从实现抄期望值 = 给缺陷上锁。
 */

const ROOT = process.cwd();
const STYLES_DIR = join(ROOT, 'packages/tokens/styles');

/* ══════════════════════════════════════════════════════════════
   一、底层解析器
   ══════════════════════════════════════════════════════════════ */

describe('CSS 变量提取器', () => {
    it('剥注释时保持字符位置（后续所有偏移才不错位）', () => {
        const css = '/* 注释 */\n.a { --x: 1; }';
        const stripped = stripComments(css);
        expect(stripped.length).toBe(css.length);
        expect(stripped).not.toContain('注释');
    });

    it('注释里含 } 不会截断块（vant.css 真有这种注释）', () => {
        // 真实场景：vant.css 有一段注释内嵌了 `.van-popup--center { max… }`
        const css = `
            /* 参考 .van-popup--center { max-width: 560px } 的写法 */
            :root, :host { --bv-text: #323233; }
        `;
        const decls = extractDecls(extractBlocks(css).get(':root, :host')![0]);
        expect(decls['--bv-text']).toBe('#323233');
    });

    it('选择器归一化空白', () => {
        const blocks = extractBlocks(':root,\n:host { --a: 1; }');
        expect(blocks.has(':root, :host')).toBe(true);
    });

    it('声明值里的分号不被当作分隔符', () => {
        const decls = extractDecls('--font: "a;b"; --x: 1;');
        expect(decls['--font']).toBe('"a;b"');
        expect(decls['--x']).toBe('1');
    });

    it('括号内的分号不被当作分隔符', () => {
        // data URI 是这个坑的真实场景：url(data:image/svg+xml;base64,…)
        // 里面的分号若被当分隔符，值会被截成 "url(data:image/svg+xml"
        const decls = extractDecls(
            '--icon: url(data:image/svg+xml;base64,PHN2Zy8+); --y: 2;',
        );
        expect(decls['--icon']).toBe('url(data:image/svg+xml;base64,PHN2Zy8+)');
        expect(decls['--y']).toBe('2');
    });

    it('collectScopes 合并同选择器的多个块', () => {
        const css = ':root, :host { --a: 1; } :root, :host { --b: 2; }';
        const scopes = collectScopes([css], [':root, :host']);
        expect(scopes[':root, :host']).toEqual({ '--a': '1', '--b': '2' });
    });

    it('resolveVar 逐层解引用 var() 链', () => {
        const scope = { '--a': 'var(--b)', '--b': 'var(--c)', '--c': '#fff' };
        expect(resolveVar(scope, '--a')).toBe('#fff');
    });

    it('resolveVar 对循环引用返回 null（不无限递归）', () => {
        const scope = { '--a': 'var(--b)', '--b': 'var(--a)' };
        expect(resolveVar(scope, '--a')).toBeNull();
    });

    it('isColorLiteral 认得常见颜色格式、拒绝 var()', () => {
        expect(isColorLiteral('#1989fa')).toBe(true);
        expect(isColorLiteral('oklch(1 0 0)')).toBe(true);
        expect(isColorLiteral('rgb(1 2 3)')).toBe(true);
        expect(isColorLiteral('var(--bv-primary)')).toBe(false);
        expect(isColorLiteral('4px')).toBe(false);
    });
});

/* ══════════════════════════════════════════════════════════════
   二、颜色归一化（参考值来自独立实现）
   ══════════════════════════════════════════════════════════════ */

describe('颜色归一化', () => {
    // 参考值由 Python stdlib colorsys + 手写 oklab 矩阵独立算出
    const CASES: [string, string][] = [
        ['#1989fa', '#1989fa'],
        ['#fff', '#ffffff'],
        ['#000', '#000000'],
        ['#abc', '#aabbcc'],
        ['rgb(25, 137, 250)', '#1989fa'],
        ['rgb(25 137 250)', '#1989fa'],
        ['rgb(100%, 0%, 50%)', '#ff0080'],
        ['hsl(217, 100%, 53%)', '#0f6bff'],
        ['hsl(217 100% 53%)', '#0f6bff'],
        ['hsl(0, 0%, 100%)', '#ffffff'],
        ['hsl(120, 100%, 50%)', '#00ff00'],
        ['oklch(1 0 0)', '#ffffff'],
        ['oklch(0.145 0 0)', '#0a0a0a'],
        ['oklch(0.628 0.2577 29.23)', '#ff0000'],
        ['oklch(0.8664 0.2948 142.5)', '#00ff00'],
        ['oklch(0.452 0.3132 264.05)', '#0000ff'],
        ['oklch(0.55 0.2 250)', '#0071df'],
        ['oklch(0.985 0 0)', '#fafafa'],
        ['oklab(1 0 0)', '#ffffff'],
    ];

    it.each(CASES)('%s → %s', (input, expected) => {
        expect(normalizeColor(input)).toBe(expected);
    });

    it('认不得的格式原样返回（不猜、不丢）', () => {
        expect(normalizeColor('color(display-p3 1 0 0)')).toBe('color(display-p3 1 0 0)');
    });

    it('线性 sRGB 只过一遍传递函数（曾因多套一层 gamma 把颜色整体提亮）', () => {
        // oklch(0.145 0 0) 是中灰，若多套一层 gamma 会变成 #383838（明显偏亮）
        expect(normalizeColor('oklch(0.145 0 0)')).toBe('#0a0a0a');
    });

    it('hsl 输出本就在 sRGB 空间，不该再过传递函数', () => {
        expect(normalizeColor('hsl(217, 100%, 53%)')).toBe('#0f6bff');
    });
});

/* ══════════════════════════════════════════════════════════════
   三、映射表自身
   ══════════════════════════════════════════════════════════════ */

describe('映射表', () => {
    it('TO_TWEAKCN 覆盖全部 44 个 tweakcn 槽（不多不少）', () => {
        expect(Object.keys(TO_TWEAKCN).sort()).toEqual([...TWEAKCN_SLOTS].sort());
    });

    it('槽名与 tweakcn 源码的 44 个名字完全一致', () => {
        // 与 tweakcn-parser.mjs 里的复刻名单比对 —— 两者独立维护，任一漂移都能发现
        expect([...TWEAKCN_SLOTS].sort()).toEqual([...TWEAKCN_VARIABLE_NAMES].sort());
    });

    it('颜色槽与非颜色槽的划分与 tweakcn 的 COMMON_STYLES 一致', () => {
        const common = TWEAKCN_SLOTS.filter((s) => TWEAKCN_COMMON_SLOTS.has(s));
        expect(common.sort()).toEqual(
            [...TWEAKCN_COMMON_SLOTS].filter((s) => TWEAKCN_SLOTS.includes(s as never)).sort(),
        );
        expect(TWEAKCN_COLOR_SLOTS.length + common.length).toBe(TWEAKCN_SLOTS.length);
    });

    it('TO_BIVANE 只映射到品牌槽（不得碰中性槽）', () => {
        const NEUTRAL = [
            '--bv-text', '--bv-text-2', '--bv-text-3', '--bv-border',
            '--bv-background', '--bv-background-2', '--bv-muted',
            '--bv-active-color', '--bv-white', '--bv-black',
        ];
        for (const bvSlot of Object.values(TO_BIVANE)) {
            expect(NEUTRAL, `导入产物不得覆盖中性槽 ${bvSlot}`).not.toContain(bvSlot);
        }
    });

    it('TO_BIVANE 不映射 ring（否则会覆盖掉 primary 映射的主色）', () => {
        // Bivane 的 --bv-focus-ring-color = var(--bv-primary)，焦点环自动跟随主色
        expect(TO_BIVANE).not.toHaveProperty('ring');
    });

    it('chart 槽角色约定：chart-1=主色 / chart-2=成功 / chart-3=警告', () => {
        expect(CHART_ROLE['chart-1']).toBe('primary');
        expect(CHART_ROLE['chart-2']).toBe('success');
        expect(CHART_ROLE['chart-3']).toBe('warning');
    });
});

/* ══════════════════════════════════════════════════════════════
   四、导出：产物必须能被 tweakcn 的真实解析器读出
   ══════════════════════════════════════════════════════════════ */

describe('导出：tweakcn 可导入性', () => {
    const tokens = readBivaneTokens();
    const css = buildExport(tokens, { name: 'Bivane' });
    const parsed = parseCssInput(css);

    it('用字面量 :root 块（tweakcn 的正则要求，:root, :host 匹配不上）', () => {
        expect(css).toMatch(/^:root \{/m);
        expect(css).not.toContain(':root,');
    });

    it('用字面量 .dark 块', () => {
        expect(css).toMatch(/^\.dark \{/m);
    });

    it('tweakcn 解析器读出全部 44 个浅色槽', () => {
        expect(Object.keys(parsed.lightColors).sort()).toEqual(
            [...TWEAKCN_VARIABLE_NAMES].sort(),
        );
    });

    it('tweakcn 解析器读出全部 44 个深色槽', () => {
        expect(Object.keys(parsed.darkColors).sort()).toEqual(
            [...TWEAKCN_VARIABLE_NAMES].sort(),
        );
    });

    it('浅色主色等关键值与 Bivane 基线一致', () => {
        expect(parsed.lightColors.primary).toBe('#1989fa');
        expect(parsed.lightColors.background).toBe('#f7f8fa');
        expect(parsed.lightColors.foreground).toBe('#323233');
        expect(parsed.lightColors.destructive).toBe('#ee0a24');
        expect(parsed.lightColors.border).toBe('#ebedf0');
        expect(parsed.lightColors.muted).toBe('#f7f8fa');
        expect(parsed.lightColors['muted-foreground']).toBe('#969799');
    });

    it('深色块是深色基线（不是浅色值重复一遍）', () => {
        expect(parsed.darkColors.background).toBe('#000000');
        expect(parsed.darkColors.foreground).toBe('#f5f5f5');
        expect(parsed.darkColors.card).toBe('#1c1c1e');
    });

    it('所有颜色槽都是合法颜色字面量（culori 解析失败会被静默丢弃）', () => {
        for (const slot of TWEAKCN_COLOR_SLOTS) {
            const v = parsed.lightColors[slot];
            expect(v, `--${slot} 未被解析出`).toBeTruthy();
            expect(isColorLiteral(v), `--${slot} = "${v}" 不是合法颜色字面量`).toBe(true);
        }
    });

    it('所有颜色槽都是字面量而非 var() 引用', () => {
        // 桥接的核心：tweakcn 不认识 var(--bv-*) 引用
        expect(css).not.toMatch(/--[a-z-]+:\s*var\(/);
    });

    it('圆角是非颜色槽，原样透传', () => {
        expect(parsed.lightColors.radius).toBe('4px');
    });

    it('风格导出把品牌色换成风格色（ocean）', () => {
        const ocean = readBivaneTokens([join(STYLES_DIR, 'vant-ocean.css')]);
        const oceanParsed = parseCssInput(buildExport(ocean, { name: 'ocean' }));
        expect(oceanParsed.lightColors.primary).toBe('#0d8fa8');
        expect(oceanParsed.lightColors.destructive).toBe('#e03131');
        // 中性槽不受风格影响
        expect(oceanParsed.lightColors.background).toBe('#f7f8fa');
    });
});

/* ══════════════════════════════════════════════════════════════
   五、导入：tweakcn 主题 → Bivane 品牌风格类
   ══════════════════════════════════════════════════════════════ */

describe('导入：tweakcn → Bivane', () => {
    const TWEAKCN_THEME = `
        :root {
            --primary: oklch(0.55 0.2 250);
            --destructive: oklch(0.577 0.245 27.325);
            --chart-2: oklch(0.62 0.19 260);
            --chart-3: oklch(0.55 0.22 263);
            --background: oklch(1 0 0);
            --foreground: oklch(0.145 0 0);
            --radius: 0.5rem;
        }
    `;

    it('生成 .bv-theme-<name> 类', () => {
        const out = importTweakcnCss(TWEAKCN_THEME, 'mytheme');
        expect(out).toContain('.bv-theme-mytheme {');
    });

    it('主色 / 危险色映射到品牌槽', () => {
        const out = importTweakcnCss(TWEAKCN_THEME, 'mytheme');
        expect(out).toContain('--bv-blue: #0071df;');
        expect(out).toContain('--bv-red: #e7000b;');
    });

    it('chart-2 / chart-3 承载成功绿与警告橙', () => {
        const out = importTweakcnCss(TWEAKCN_THEME, 'mytheme');
        expect(out).toMatch(/--bv-green: #[0-9a-f]{6};/);
        expect(out).toMatch(/--bv-orange: #[0-9a-f]{6};/);
    });

    it('中性槽不被改写（Bivane 基线统一保证）', () => {
        const out = importTweakcnCss(TWEAKCN_THEME, 'mytheme');
        expect(out).not.toMatch(/--bv-text:/);
        expect(out).not.toMatch(/--bv-border:/);
        expect(out).not.toMatch(/--bv-background:/);
        expect(out).not.toMatch(/--bv-white:/);
    });

    it('颜色统一归一化成 hex（库里其它风格文件都是 hex 基线）', () => {
        const out = importTweakcnCss(TWEAKCN_THEME, 'mytheme');
        expect(out).not.toMatch(/oklch\(/);
        expect(out).not.toMatch(/hsl\(/);
    });

    it('解析不出任何变量时报错（防「静默导入 0 个变量」）', () => {
        // 这正是把 Bivane 原始 CSS 丢给 tweakcn 时的症状
        const bivaneRaw = readFileSync(join(STYLES_DIR, 'vant.css'), 'utf8');
        expect(() => importTweakcnCss(bivaneRaw, 'x')).toThrow(/没能从输入里解析出任何/);
    });

    it('Bivane 原始 CSS 用 :root, :host —— 这正是 tweakcn 匹配不上的原因', () => {
        // 锁定这个「为什么需要桥接」的事实，防止有人把 vant.css 改成 :root 破坏 Vant 约定
        const bivaneRaw = readFileSync(join(STYLES_DIR, 'vant.css'), 'utf8');
        expect(bivaneRaw).toContain(':root,\n:host {');
        const parsed = parseCssInput(bivaneRaw);
        expect(Object.keys(parsed.lightColors).length).toBe(0);
    });
});

/* ══════════════════════════════════════════════════════════════
   六、往返：Bivane → tweakcn → Bivane 必须保值
   ══════════════════════════════════════════════════════════════ */

describe('往返一致性', () => {
    it('Bivane → tweakcn → Bivane：四个品牌槽逐字相同', () => {
        const exported = buildExport(readBivaneTokens(), { name: 'Bivane' });
        const reimported = importTweakcnCss(exported, 'roundtrip');
        expect(reimported).toContain('--bv-blue: #1989fa;');
        expect(reimported).toContain('--bv-red: #ee0a24;');
        expect(reimported).toContain('--bv-green: #07c160;');
        expect(reimported).toContain('--bv-orange: #ff976a;');
    });

    it('往返不会引入中性槽覆盖', () => {
        const exported = buildExport(readBivaneTokens(), { name: 'Bivane' });
        const reimported = importTweakcnCss(exported, 'roundtrip');
        for (const neutral of ['--bv-text', '--bv-border', '--bv-background', '--bv-white']) {
            expect(reimported, `往返后不应出现中性槽 ${neutral}`).not.toContain(`${neutral}:`);
        }
    });

    it('风格往返也保值（ocean）', () => {
        const exported = buildExport(readBivaneTokens([join(STYLES_DIR, 'vant-ocean.css')]), {
            name: 'ocean',
        });
        const reimported = importTweakcnCss(exported, 'ocean');
        expect(reimported).toContain('--bv-blue: #0d8fa8;');
        expect(reimported).toContain('--bv-green: #0aa672;');
    });
});

/* ══════════════════════════════════════════════════════════════
   七、产物形态：体积与可读性
   ══════════════════════════════════════════════════════════════ */

describe('产物形态', () => {
    const css = buildExport(readBivaneTokens(), { name: 'Bivane' });

    it('导出产物在 5 kB 内（它是可选文件，不是每个消费者的固定成本）', () => {
        expect(css.length).toBeLessThan(5 * 1024);
    });

    it('导出产物不含 Bivane 私有变量名（tweakcn 不认 --bv-*）', () => {
        expect(css).not.toContain('--bv-');
    });

    it('多行值被折叠成单行（--font-sans 原本在 vant.css 里是多行）', () => {
        const fontLine = css.split('\n').find((l) => l.includes('--font-sans:'))!;
        // 只看「值」部分：行首的两格缩进是格式化，不算多行残留
        const value = fontLine.slice(fontLine.indexOf('--font-sans:') + '--font-sans:'.length).trim();
        expect(value).not.toContain('\n');
        expect(value).not.toMatch(/\s{2,}/); // 连续空白（ vant.css 里是换行 + 8 格缩进）
    });

    it('exportTweakcnCss 遇到非法颜色字面量时抛错（不静默产出坏文件）', () => {
        expect(() =>
            exportTweakcnCss({ '--bv-primary': 'not-a-color' }, 'light'),
        ).toThrow(/不是合法颜色字面量/);
    });
});
