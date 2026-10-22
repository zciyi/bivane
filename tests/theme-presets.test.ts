import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 风格（theme preset）契约测试
 *
 * 背景：P4 生态新增第2/3 套品牌风格（vant-ocean.css 深海 / vant-grape.css 青莲）。
 * 三套风格（vant.css Vant 复刻 + 两套预设）+ 深色（vant-dark.css）全部走
 * 「class 激活、只改品牌槽、组件代码零改动」的路子。
 *
 * 这条路子成立的前提有三个，任一被破坏都是**静默失效**——
 * 类型、单测、构建全绿，用户切了 class 却看不到变化：
 *
 *  1. 风格文件必须只覆盖「品牌槽」，不能碰中性槽（灰阶 / 文本 / 边框 / 背景）。
 *     碰了 = 换风格顺带改了视觉基准，与「风格换调性、不换基准」的约定冲突。
 *
 *  2. 风格文件**不能**重定义 --bv-primary / --bv-success / --bv-danger / --bv-warning。
 *     vant.css 里它们写成 `var(--bv-blue)` 这类间接引用，靠 CSS 自定义属性的
 *     延迟解析跟随色板。若风格里直接写死 primary，色板覆盖就对它失效 ——
 *     主色变了而 32 个引用 primary 的组件 token 全没变（半风格化，最难查）。
 *
 *  3. vant.css 里写死 Vant 原值、不走语义引用的品牌槽（如 --bv-rate-icon-full-color）
 *     必须在每套风格里一并覆盖，否则该组件在非默认风格下仍是 Vant 原色。
 *     本测试从 vant.css 里**正则提取**这类「品牌裸值槽」再逐一核对，
 *     不手维护清单 —— 以后新增组件写进新的裸值槽，这里自动跟上。
 */

const STYLES_DIR = join(process.cwd(), 'packages/tokens/styles');

const BASE = readFileSync(join(STYLES_DIR, 'vant.css'), 'utf8');
const OCEAN = readFileSync(join(STYLES_DIR, 'vant-ocean.css'), 'utf8');
const GRAPE = readFileSync(join(STYLES_DIR, 'vant-grape.css'), 'utf8');

/** 品牌色板槽：风格可以（也必须）改的 */
const PALETTE_SLOTS = [
  '--bv-blue',
  '--bv-green',
  '--bv-red',
  '--bv-orange',
  '--bv-orange-dark',
  '--bv-orange-light',
  '--bv-gradient-red',
  '--bv-gradient-orange',
] as const;

/** 中性槽：风格一律不许碰（灰阶 / 文本 / 边框 / 底色 / 尺寸） */
const NEUTRAL_SLOTS = [
  '--bv-gray-1',
  '--bv-gray-2',
  '--bv-gray-3',
  '--bv-gray-4',
  '--bv-gray-5',
  '--bv-gray-6',
  '--bv-gray-7',
  '--bv-gray-8',
  '--bv-black',
  '--bv-white',
  '--bv-text',
  '--bv-text-2',
  '--bv-text-3',
  '--bv-border',
  '--bv-background',
  '--bv-background-2',
  '--bv-surface',
  '--bv-muted',
  '--bv-padding-md',
  '--bv-font-md',
  '--bv-radius-md',
] as const;

/** 语义色槽：必须靠间接引用跟随色板，风格里重定义即失效 */
const SEMANTIC_SLOTS = [
  '--bv-primary',
  '--bv-success',
  '--bv-danger',
  '--bv-warning',
] as const;

/** 取某文件里某选择器块内定义的变量名集合 */
function slotsDefinedIn(css: string, selector: string): Set<string> {
  // 匹配 `.bv-theme-ocean { … }` 这类块（本仓风格文件都是单层选择器）
  const re = new RegExp(`(?:^|[},])\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  const m = re.exec(css);
  if (!m) return new Set();
  return new Set(
    [...m[1].matchAll(/(--bv-[a-z0-9-]+)\s*:/g)].map((x) => x[1]),
  );
}

/**
 * 从 vant.css 的**所有** `:root, :host` 段里提取「走裸值、不走 var() 的品牌槽」。
 *
 * 这类槽（如 --bv-rate-icon-full-color: #ffd21e）不参与语义引用链，
 * 色板换了它也不动，必须由风格文件显式覆盖。
 *
 * ⚠ 必须扫全部段而不是第一段：色板在第 1 段，而组件级裸值槽散在后面各段
 * （Rate 的满星色就在第 20+ 段）。只扫第一段会让本测试**空跑通过**——
 * 「风格覆盖全了」变成「风格覆盖了色板而已」，漏掉组件槽永远测不出来。
 */
function bareBrandSlotsInBase(): string[] {
  const blocks = [...BASE.matchAll(/:root,\s*:host\s*\{([\s\S]*?)\n\}/g)];
  if (blocks.length === 0) throw new Error('vant.css 里找不到 :root, :host 段');
  const out: string[] = [];
  for (const block of blocks) {
    for (const m of block[1].matchAll(/(--bv-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      const [, name, rawValue] = m;
      const value = rawValue.trim();
      // 裸值 = 含具体色值，且没有指向其它 --bv-* 变量的引用
      const hasLiteralColor = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(value);
      const refsVariable = /var\(\s*--bv-/.test(value);
      if (!hasLiteralColor || refsVariable) continue;
      // 中性色板 / 阴影 / 遮罩不属于「品牌调性」，排除
      if (NEUTRAL_SLOTS.includes(name as (typeof NEUTRAL_SLOTS)[number])) continue;
      if (/^--bv-gray-|^--bv-(black|white)$/.test(name)) continue;
      if (/shadow|overlay|toast-background|tooltip-background|uploader-/.test(name)) continue;
      // 半透明黑 = 结构色（描边 / 阴影 / 蒙层），换风格不该跟着换 —— 如
      // --bv-switch-border-color: rgba(0,0,0,0.1)（开关轨道的发丝边）。
      // 按「取值形态」判定而非硬编码槽名：以后新增组件写 rgba(0,0,0,*) 结构色
      // 不会被误报成「风格漏覆盖」。
      if (/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,/.test(value)) continue;
      out.push(name);
    }
  }
  return [...new Set(out)];
}

const STYLES = [
  { name: 'vant-ocean.css', cls: '.bv-theme-ocean', css: OCEAN },
  { name: 'vant-grape.css', cls: '.bv-theme-grape', css: GRAPE },
] as const;

describe('风格 token：覆盖边界', () => {
  it.each(STYLES)('$name 用 class 激活（不用 :root 覆盖）', ({ cls, css }) => {
    expect(css, `${cls} 选择器必须存在`).toContain(cls);
    // :root 覆盖会与 vant-dark.css 抢特异性 → 深色与风格无法叠加
    expect(css, `${cls} 不能用 :root 覆盖，否则与深色主题互踩`).not.toMatch(/^\s*:root\s*[,{]/m);
  });

  it.each(STYLES)('$name 必须覆盖全部 8 个品牌色板槽', ({ cls, css }) => {
    const defined = slotsDefinedIn(css, cls);
    for (const slot of PALETTE_SLOTS) {
      expect(defined.has(slot), `${cls} 漏定义品牌槽 ${slot}`).toBe(true);
    }
  });

  it.each(STYLES)('$name 一律不碰中性槽', ({ cls, css }) => {
    const defined = slotsDefinedIn(css, cls);
    for (const slot of NEUTRAL_SLOTS) {
      expect(defined.has(slot), `${cls} 不该改中性槽 ${slot}（风格换调性，不换视觉基准）`).toBe(false);
    }
  });

  it.each(STYLES)('$name 不重定义 4 个语义色槽', ({ cls, css }) => {
    const defined = slotsDefinedIn(css, cls);
    for (const slot of SEMANTIC_SLOTS) {
      expect(
        defined.has(slot),
        `${cls} 重定义了 ${slot} —— 它在 vant.css 里是 var(--bv-blue) 式间接引用，` +
          `靠延迟解析跟随色板；写死会让 32 个引用它的组件 token 不换色（半风格化）`,
      ).toBe(false);
    }
  });
});

describe('风格 token：不漏覆盖裸值品牌槽', () => {
  const bareSlots = bareBrandSlotsInBase();

  it('能从 vant.css 里提取到裸值品牌槽（提取器本身没失效）', () => {
    // 提取器若因 vant.css 结构调整而失效，这条会空跑通过 —— 用一个已知的槽兜底
    expect(bareSlots).toContain('--bv-rate-icon-full-color');
  });

  it.each(STYLES)('$name 覆盖 vant.css 里全部裸值品牌槽', ({ cls, css, name }) => {
    const defined = slotsDefinedIn(css, cls);
    const missing = bareSlots.filter((s) => !defined.has(s));
    expect(
      missing,
      `${cls} 漏覆盖 vant.css 的裸值品牌槽 ${missing.join(', ')} —— ` +
        `这些槽不走语义引用链，不显式覆盖就会在该风格下仍是 Vant 原色（${name}）`,
    ).toEqual([]);
  });
});

describe('风格 token：可组合性', () => {
  it('三套激活 class 互不相同（否则后 import 的会顶掉前一个）', () => {
    const classes = ['.bv-theme-dark', ...STYLES.map((s) => s.cls)];
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('深色与风格改的是不相交的槽（保证能叠加而不是互相覆盖）', () => {
    const dark = readFileSync(join(STYLES_DIR, 'vant-dark.css'), 'utf8');
    const darkSlots = slotsDefinedIn(dark, '.bv-theme-dark');
    for (const { cls, css } of STYLES) {
      const styleSlots = slotsDefinedIn(css, cls);
      // 允许重叠的是语义别名（--bv-surface / --bv-muted，vant-dark 会重算它们跟随中性色）；
      // 品牌槽与中性槽之间不允许有任何交集
      const overlap = [...styleSlots].filter(
        (s) => darkSlots.has(s) && (PALETTE_SLOTS as readonly string[]).includes(s),
      );
      expect(overlap, `${cls} 与深色主题在品牌槽 ${overlap.join(', ')} 上重叠，会互相覆盖`).toEqual([]);
    }
  });

  it('每个风格的主色确实不同于 Vant 原色（否则「切了没变化」）', () => {
    const basePrimary = /--bv-blue:\s*([^;]+);/.exec(BASE)?.[1].trim();
    expect(basePrimary).toBe('#1989fa');
    for (const { cls, css } of STYLES) {
      const defined = slotsDefinedIn(css, cls);
      expect(defined.has('--bv-blue'), `${cls} 必须定义 --bv-blue`).toBe(true);
      // 取风格块内的取值，而不是全文第一个 --bv-blue
      const block = new RegExp(`${cls.replace('.', '\\.')}\\s*\\{([^}]*)\\}`).exec(css);
      const primary = /--bv-blue:\s*([^;]+);/.exec(block?.[1] ?? '')?.[1].trim();
      expect(primary, `${cls} 主色与 Vant 原色相同，等于没生效`).not.toBe(basePrimary);
    }
  });
});

describe('风格 token：注册进分发链路', () => {
  const registry = JSON.parse(
    readFileSync(join(process.cwd(), 'packages/registry/registry.json'), 'utf8'),
  ) as { items: { name: string; files: { path: string }[] }[] };

  it.each(['vant-ocean.css', 'vant-grape.css'])(
    '%s 在 registry tokens item 的 files 里',
    (file) => {
      const tokens = registry.items.find((i) => i.name === 'tokens');
      expect(tokens, 'registry 里找不到 tokens item').toBeTruthy();
      const paths = tokens!.files.map((f) => f.path);
      expect(
        paths.some((p) => p.endsWith(`/styles/${file}`)),
        `${file} 没进 tokens item —— 消费者装不到，class 激活后不换色`,
      ).toBe(true);
    },
  );

  it.each(['vant-ocean.css', 'vant-grape.css'])('%s 被 index.css import', (file) => {
    const indexCss = readFileSync(join(process.cwd(), 'index.css'), 'utf8');
    expect(indexCss).toContain(`/packages/tokens/styles/${file}`);
  });
});