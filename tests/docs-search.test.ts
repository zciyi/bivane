import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    buildHash,
    buildSearchIndex,
    exampleIdsForDemo,
    parseHashQuery,
    searchDocs,
    targetDomId,
    type IndexEntry,
} from '@/apps/docs/src/search-index';
import { chineseName } from '@/apps/docs/src/component-label';

/**
 * 文档站 · 全站搜索索引测试
 *
 * 这些用例把**真机审计出来的三个查阅缺口**固化成回归：
 *   1. 示例的标题/说明必须能被搜到（否则「区间滑块长什么样」查不到）；
 *   2. prop 命中必须能定位到那一行（否则跳到页首还得自己滚）；
 *   3. 深链（#/slug?prop=x）必须解析得回来，且 DOM id 与渲染处逐字一致
 *      （否则链接静默失效 —— 页面照常渲染，只是不滚不亮）。
 *
 * 判据全部来自「我期望什么」，不从实现反推。
 */

const ROOT = process.cwd();
const DOCS = join(ROOT, 'apps/docs');
const DEMOS = join(ROOT, 'demos');

interface RegistryEntry extends IndexEntry {
    props: { name: string; kind: 'prop' | 'event'; description?: string }[];
}

/** 读生成清单（registry.generated.json） */
function readRegistry(): RegistryEntry[] {
    return JSON.parse(
        readFileSync(join(DOCS, 'src/registry.generated.json'), 'utf8'),
    ).entries as RegistryEntry[];
}

/** 读 examples.ts 里手写的 EXAMPLES 表 */
function readExamples(): Record<string, { title: string; desc: string }> {
    const src = readFileSync(join(DOCS, 'src/examples.ts'), 'utf8');
    const match =
        /export const EXAMPLES\s*:\s*Record<string, ExampleMeta>\s*=\s*(\{[\s\S]*?\});/.exec(
            src,
        );
    if (!match) throw new Error('examples.ts 里找不到 EXAMPLES 表');
    return new Function(`return ${match[1]}`)();
}

/**
 * 从 demos/ 源码数每个演示模块的示例数。
 *
 * 不 import demo 组件（那会把全部 React 组件拖进 node 测试），
 * 用正则数导出名 —— 与 tests/docs-registry.test.ts 同一套办法。
 */
function readDemoCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const file of readdirSync(DEMOS)) {
        if (!file.endsWith('.tsx')) continue;
        const src = readFileSync(join(DEMOS, file), 'utf8');
        for (const m of src.matchAll(/^export function (\w+?)Example\d+\(/gm)) {
            const key = `${m[1]}Demos`;
            counts[key] = (counts[key] ?? 0) + 1;
        }
    }
    return counts;
}

const REGISTRY = readRegistry();
const EXAMPLES = readExamples();
const DEMO_COUNTS = readDemoCounts();
const INDEX = buildSearchIndex({
    entries: REGISTRY,
    examples: EXAMPLES,
    demoCounts: DEMO_COUNTS,
});

// ─────────────────────────────────────────────────────────────
// 合成夹具：精确的排序判据（不依赖真实数据，数据改了也不飘）
// ─────────────────────────────────────────────────────────────

const FIXTURE_ENTRIES: IndexEntry[] = [
    {
        name: 'Slider',
        slug: 'slider',
        title: 'Slider 滑块',
        category: 'form',
        summary: '滑动选择一个数值',
        demo: 'SliderDemos',
        props: [
            { name: 'value', kind: 'prop', description: '当前值' },
            { name: 'onChange', kind: 'event', description: '值变化时触发' },
        ],
    },
    {
        name: 'Switch',
        slug: 'switch',
        title: 'Switch 开关',
        category: 'form',
        summary: '开关切换',
        demo: 'SwitchDemos',
        props: [{ name: 'onChange', kind: 'event', description: '开关变化' }],
    },
];

const FIXTURE_INDEX = buildSearchIndex({
    entries: FIXTURE_ENTRIES,
    examples: {
        SliderExample1: { title: '基础滑块', desc: '单值受控用法' },
        SliderExample2: { title: '区间滑块', desc: 'range 模式选出一个区间' },
        SwitchExample1: { title: '各种形态', desc: '禁用与加载' },
    },
    demoCounts: { SliderDemos: 2, SwitchDemos: 1 },
});

describe('搜索索引 · 覆盖', () => {
    it('每个组件 / 示例 / 属性都进了索引', () => {
        const comps = INDEX.filter((d) => d.kind === 'component');
        const exs = INDEX.filter((d) => d.kind === 'example');
        const props = INDEX.filter((d) => d.kind === 'prop');

        expect(comps.length).toBe(REGISTRY.length);
        expect(props.length).toBe(
            REGISTRY.reduce((n, e) => n + e.props.length, 0),
        );
        // 示例数按「组件页 × 它挂的 demo 模块」累加。
        // ⚠ 不能按 demos/ 的模块去重：FieldDemos 同时挂在 Field 与 Input 两页上、
        //   TagBadgeDemos 同时挂在 Tag 与 Badge 上 —— 同一份示例要在两页都查得到。
        const expectedExamples = REGISTRY.reduce(
            (n, e) =>
                n +
                (Array.isArray(e.demo) ? e.demo : [e.demo]).reduce(
                    (m, d) => m + (DEMO_COUNTS[d] ?? 0),
                    0,
                ),
            0,
        );
        expect(exs.length).toBe(expectedExamples);
        expect(exs.length).toBeGreaterThan(40);
    });

    it('被多个组件页共用的示例，在两页都查得到', () => {
        // FieldDemos 挂在 Field 与 Input 两页 —— 这是 demos/ 共享的既定设计
        const field = INDEX.filter((d) => d.exampleId === 'FieldExample1');
        expect(field.map((d) => d.slug).sort()).toEqual(['field', 'input']);
    });

    it('示例 id 由 demo 模块名推出，且落在正确的组件页上', () => {
        // DatePicker 页额外挂了 BoundsDemos —— 它的示例不能算成 DatePicker 的
        const bounds = INDEX.filter((d) => d.exampleId?.startsWith('Bounds'));
        expect(bounds.length).toBeGreaterThan(0);
        for (const d of bounds) expect(d.slug).toBe('date-picker');

        const ex = INDEX.find((d) => d.exampleId === 'SliderExample2');
        expect(ex).toBeDefined();
        expect(ex!.slug).toBe('slider');
        expect(ex!.title).toBe('区间滑块');
    });

    it('示例缺 EXAMPLES 条目时不丢，退化成「示例 N」', () => {
        const idx = buildSearchIndex({
            entries: [FIXTURE_ENTRIES[0]],
            examples: {},
            demoCounts: { SliderDemos: 2 },
        });
        const exs = idx.filter((d) => d.kind === 'example');
        expect(exs.map((e) => e.title)).toEqual(['示例 1', '示例 2']);
    });

    it('exampleIdsForDemo：模块名 → 示例 id 列表', () => {
        expect(exampleIdsForDemo('SliderDemos', 3)).toEqual([
            'SliderExample1',
            'SliderExample2',
            'SliderExample3',
        ]);
        expect(exampleIdsForDemo('SliderDemos', 0)).toEqual([]);
    });
});

describe('搜索索引 · 匹配与排序', () => {
    it('空查询 / 纯空格返回空', () => {
        expect(searchDocs(FIXTURE_INDEX, '')).toEqual([]);
        expect(searchDocs(FIXTURE_INDEX, '   ')).toEqual([]);
    });

    it('搜不到就返回空，不猜', () => {
        expect(searchDocs(FIXTURE_INDEX, 'zzz-not-exist')).toEqual([]);
    });

    it('组件名精确命中排第一，它的示例紧随其后', () => {
        const hits = searchDocs(FIXTURE_INDEX, 'slider');
        expect(hits[0].kind).toBe('component');
        expect(hits[0].slug).toBe('slider');
        // 同一个组件的两个示例也要翻出来（按示例标题分排序）
        expect(hits.slice(1, 3).every((h) => h.kind === 'example')).toBe(true);
        expect(hits.slice(1, 3).map((h) => h.exampleId)).toEqual([
            'SliderExample1',
            'SliderExample2',
        ]);
    });

    it('示例标题可搜：这是审计缺口 1', () => {
        // 「区间滑块」是 SliderExample2 的标题 —— 改造前侧栏搜索完全搜不到
        const hits = searchDocs(FIXTURE_INDEX, '区间');
        expect(hits.length).toBe(1);
        expect(hits[0].kind).toBe('example');
        expect(hits[0].exampleId).toBe('SliderExample2');
        expect(hits[0].slug).toBe('slider');
    });

    it('示例说明文字也可搜', () => {
        const hits = searchDocs(FIXTURE_INDEX, 'range 模式');
        expect(hits.map((h) => h.exampleId)).toContain('SliderExample2');
    });

    it('prop 名可反查组件，且能定位到那一行', () => {
        const hits = searchDocs(FIXTURE_INDEX, 'onChange');
        // 两个组件都有 onChange —— 都是 prop 命中，且带 propName
        expect(hits.length).toBe(2);
        for (const h of hits) {
            expect(h.kind).toBe('prop');
            expect(h.propName).toBe('onChange');
            expect(targetDomId({ prop: h.propName! })).toBe('prop-onChange');
        }
    });

    it('多词按 AND 组合，命中词多的排前面', () => {
        const hits = searchDocs(FIXTURE_INDEX, '区间 range');
        expect(hits[0].exampleId).toBe('SliderExample2');
        // 只命中一个词的示例不该出现
        expect(hits.map((h) => h.exampleId)).not.toContain('SliderExample1');
    });

    it('limit 生效', () => {
        const all = searchDocs(FIXTURE_INDEX, 'e', 100);
        expect(all.length).toBeGreaterThan(2);
        expect(searchDocs(FIXTURE_INDEX, 'e', 2).length).toBe(2);
    });

    it('大小写不敏感', () => {
        expect(searchDocs(FIXTURE_INDEX, 'SLIDER')[0].slug).toBe('slider');
        expect(searchDocs(FIXTURE_INDEX, 'onchange').length).toBe(2);
    });
});

describe('搜索索引 · 真实数据回归', () => {
    it('搜「区间」能直达区间滑块示例', () => {
        const hits = searchDocs(INDEX, '区间');
        expect(hits.length).toBeGreaterThan(0);
        const ex = hits.find((h) => h.kind === 'example');
        expect(ex, '区间滑块必须是示例级命中').toBeDefined();
        expect(ex!.exampleId).toBe('SliderExample2');
        expect(ex!.slug).toBe('slider');
    });

    it('prop 名精确命中排第一，示例说明里提到它排后面', () => {
        // SwitchExample2 的说明写着「含 beforeChange 二次确认」——
        // 用户敲的是属性名，第一跳必须是 API 那一行，不是示例卡。
        const hits = searchDocs(INDEX, 'beforeChange');
        expect(hits.length).toBeGreaterThan(1);
        expect(hits[0].kind).toBe('prop');
        expect(hits[0].propName).toBe('beforeChange');
        expect(hits[0].slug).toBe('switch');
        // 提到它的示例也要能翻出来（排在属性之后）
        expect(
            hits.some((h) => h.kind === 'example' && h.slug === 'switch'),
        ).toBe(true);
    });

    it('搜 prop 名的结果都能定位到那一行', () => {
        for (const q of ['onConfirm', 'rowKey']) {
            const hits = searchDocs(INDEX, q);
            expect(hits.length, `${q} 应该有命中`).toBeGreaterThan(0);
            for (const h of hits) {
                expect(h.kind, `${q} 命中了非 prop 结果`).toBe('prop');
                expect(h.propName!.toLowerCase()).toContain(q.toLowerCase());
                expect(targetDomId({ prop: h.propName! })).toBe(
                    `prop-${h.propName}`,
                );
            }
        }
    });

    it('搜「禁用」能同时翻出组件与示例', () => {
        const hits = searchDocs(INDEX, '禁用', 60);
        const kinds = new Set(hits.map((h) => h.kind));
        expect(kinds.has('component')).toBe(true);
        expect(kinds.has('example')).toBe(true);
    });

    it('每个 prop 命中都能跳到真实存在的锚点', () => {
        // targetDomId 的 prop 分支必须与 props 表渲染出来的 id 一致
        const src = readFileSync(
            join(DOCS, 'src/components/props-table.tsx'),
            'utf8',
        );
        expect(src, 'props 表行没有 id，深链会静默失效').toContain(
            'id={`prop-${p.name}`}',
        );
    });
});

describe('搜索索引 · 深链解析', () => {
    it('解析 example 深链', () => {
        expect(parseHashQuery('#/select?example=SelectExample1')).toEqual({
            path: 'select',
            target: { example: 'SelectExample1' },
        });
    });

    it('解析 prop 深链', () => {
        expect(parseHashQuery('#/dialog?prop=onConfirm')).toEqual({
            path: 'dialog',
            target: { prop: 'onConfirm' },
        });
    });

    it('没有查询串就是纯路径', () => {
        expect(parseHashQuery('#/')).toEqual({ path: '', target: {} });
        expect(parseHashQuery('#/button')).toEqual({
            path: 'button',
            target: {},
        });
        expect(parseHashQuery('')).toEqual({ path: '', target: {} });
        expect(parseHashQuery('#/table/')).toEqual({
            path: 'table',
            target: {},
        });
    });

    it('旧写法 #/slug/anchor 仍按 slug 处理', () => {
        expect(parseHashQuery('#/button/props')).toEqual({
            path: 'button',
            target: {},
        });
    });

    it('不认识的查询参数被忽略', () => {
        expect(parseHashQuery('#/select?foo=1')).toEqual({
            path: 'select',
            target: {},
        });
    });

    it('buildHash 与 parseHashQuery 互为逆运算', () => {
        const cases: [string, { example?: string; prop?: string } | undefined][] = [
            ['', undefined],
            ['button', undefined],
            ['select', { example: 'SelectExample1' }],
            ['dialog', { prop: 'onConfirm' }],
        ];
        for (const [slug, target] of cases) {
            const hash = buildHash(slug, target);
            expect(hash.startsWith('#/')).toBe(true);
            expect(parseHashQuery(hash)).toEqual({ path: slug, target: target ?? {} });
        }
    });

    it('targetDomId：example / prop / 空', () => {
        expect(targetDomId({ example: 'SliderExample2' })).toBe(
            'ex-SliderExample2',
        );
        expect(targetDomId({ prop: 'onConfirm' })).toBe('prop-onConfirm');
        expect(targetDomId({})).toBeNull();
    });

    it('示例卡的 id 与 targetDomId 逐字一致', () => {
        // ExampleCard 渲染 id={id}，调用方传的是 `ex-${示例id}`
        const page = readFileSync(
            join(DOCS, 'src/pages/component-page.tsx'),
            'utf8',
        );
        expect(page).toContain('id={`ex-${ex.id}`}');
    });
});

// ─────────────────────────────────────────────────────────────
// 导航面的中文标签
//
// 用户反馈的缺口：侧栏/首页/上一步下一步/搜索面板全是英文名，
// 中文读者扫不动。修法是这些面一律以中文名为主标签。
// 这里把守两件事：① 每个组件都取得出中文名；② 索引把中文名带全。
// ─────────────────────────────────────────────────────────────

describe('导航标签 · 中文名', () => {
    it('chineseName：从「Button 按钮」里取出「按钮」', () => {
        expect(chineseName('Button 按钮')).toBe('按钮');
        expect(chineseName('InputNumber 数量步进器')).toBe('数量步进器');
        // 别名型标题：中文名在最后一段
        expect(chineseName('Input / Textarea 输入')).toBe('输入');
        expect(chineseName('DateTimePicker 日期时间选择')).toBe('日期时间选择');
    });

    it('chineseName：标题里没有中文时退回原串，绝不返回空', () => {
        // 空主标签会让导航项变成一个看不见的点 —— 比显示英文名更糟
        expect(chineseName('Button')).toBe('Button');
        expect(chineseName('')).toBe('');
    });

    it('每个组件都取得出中文名', () => {
        // 这是侧栏中文主标签的前提：谁缺了中文名，侧栏那一项就退化成英文
        const missing = REGISTRY.filter(
            (e) => !chineseName(e.title) || chineseName(e.title) === e.title,
        );
        expect(
            missing.map((e) => `${e.name}（${e.title}）`),
            '这些组件的 title 里没有中文名 —— 侧栏/首页/搜索面板只能显示英文',
        ).toEqual([]);
    });

    it('索引里每条文档都带着所属组件的中文名', () => {
        // 示例行与属性行的次级标签用的是父组件的中文名
        const zhBySlug = new Map(
            REGISTRY.map((e) => [e.slug, chineseName(e.title)]),
        );
        for (const d of INDEX) {
            expect(d.zh, `${d.kind} ${d.slug} 缺中文名`).toBe(zhBySlug.get(d.slug));
        }
    });

    it('四个导航面都真的以中文名为主标签', () => {
        // 源码级把守：谁退回只渲染英文名，这里就红。
        // 注意侧栏自己不算中文名 —— 它收 NavEntry.zh，算的地方在 app.tsx。
        const expects: [string, string][] = [
            ['src/app.tsx', 'zh: chineseName(e.title)'],
            ['src/components/sidebar.tsx', '{e.zh}'],
            ['src/pages/home.tsx', 'chineseName(e.title)'],
            ['src/pages/component-page.tsx', 'chineseName(prev.title)'],
        ];
        for (const [file, needle] of expects) {
            const src = readFileSync(join(DOCS, file), 'utf8');
            expect(src, `${file} 没有以中文名为主标签（找不到 ${needle}）`).toContain(
                needle,
            );
        }
    });
});
