/**
 * Bivane 文档站 · 全站搜索索引（纯函数，零依赖）
 *
 * 为什么需要它：侧栏那个搜索框只能匹配**组件名 / 标题 / 简介 / prop 名**，
 * 于是有三类问题查不到（都是真机审计出来的）：
 *   1. 「区间滑块长什么样？」—— 示例的标题与说明不在索引里；
 *   2. 搜到 prop 名只会跳到页首，那一行还得自己滚；
 *   3. 手机上侧栏是 `hidden md:block`，连搜索框都没有。
 *
 * 这个文件把「索引怎么建、怎么排、深链怎么解析」做成纯函数：
 *  - 可单测（判据写「我期望什么」，不从实现抄）；
 *  - 文档站与验证台共用 demos/，所以索引永远不会和示例漂移。
 *
 * 数据来源全是生成物或手写清单，没有网络、没有 DOM。
 */

import { chineseName } from './component-label';

/** 一条搜索命中的类型 */
export type SearchKind = 'component' | 'example' | 'prop';

/** 索引里的一条文档 */
export interface SearchDoc {
    kind: SearchKind;
    /** 目标组件 slug */
    slug: string;
    /** 组件名（英文，与代码里的 import 对应） */
    name: string;
    /** 所属组件的**中文名**（导航面的主标签） */
    zh: string;
    /** 组件标题 / 示例标题 */
    title: string;
    /** 说明文字 */
    desc: string;
    /** example 专有：示例 id（`XxxExampleN`） */
    exampleId?: string;
    /** prop 专有：属性名 */
    propName?: string;
    /** prop 专有：普通属性还是回调事件 */
    propKind?: 'prop' | 'event';
    /**
     * 建索引时的生成序号（0 起）。
     *
     * 只用于同分时按**声明顺序**稳定排序 ——
     * 否则搜 "slider" 出来的示例会按标题字典序排，
     * 「区间滑块」跑到「基础滑块」前面去，而页面上的顺序恰好相反。
     */
    seq: number;
}

/** 深链目标：跳到某个示例卡或某一行属性 */
export interface RouteTarget {
    example?: string;
    prop?: string;
}

/** 建索引需要的组件条目（registry.generated.json 的 entry 形状） */
export interface IndexEntry {
    name: string;
    slug: string;
    title: string;
    category: string;
    summary: string;
    /** demo 模块名；数组表示这个组件页挂多个 demo */
    demo: string | string[];
    props: { name: string; kind: 'prop' | 'event'; description?: string }[];
}

/** 建索引需要的示例元信息（examples.ts 的 EXAMPLES 形状） */
export interface IndexExampleMeta {
    title: string;
    desc: string;
}

/** 演示模块名 → 示例数（如 `SliderDemos` → 4） */
export type DemoCounts = Record<string, number>;

/**
 * 示例 id 必须由 **demo 模块名**推出，不能用组件名。
 *
 * 一个组件页可以挂多个 demo 模块（catalog 的 demo 字段是数组）——
 * 如 DatePicker 额外挂「跨组件的 min/max 边界约束」。若用组件名推 id，
 * BoundsExample1 会被算成 DatePickerExample2，而源码表里没有这一条。
 */
export function exampleIdsForDemo(demoName: string, count: number): string[] {
    const base = demoName.replace(/Demos$/, '');
    const out: string[] = [];
    for (let i = 1; i <= count; i++) out.push(`${base}Example${i}`);
    return out;
}

/**
 * 建全站索引：组件 + 示例 + 属性/事件。
 *
 * 示例缺 EXAMPLES 条目时**仍然入索引**（标题退化成「示例 N」）——
 * 静默丢掉会让「示例明明在页面上、却搜不到」，
 * 而这类漂移由 tests/docs-registry.test.ts 单独把守。
 */
export function buildSearchIndex(input: {
    entries: IndexEntry[];
    examples: Record<string, IndexExampleMeta>;
    demoCounts: DemoCounts;
}): SearchDoc[] {
    const { entries, examples, demoCounts } = input;
    const docs: SearchDoc[] = [];
    let seq = 0;

    for (const e of entries) {
        // 每条文档都带上所属组件的中文名 —— 侧栏/面板/上一步下一步
        // 都以它为主标签，缺了它这些导航面就只能显示英文名。
        const zh = chineseName(e.title);

        docs.push({
            kind: 'component',
            slug: e.slug,
            name: e.name,
            zh,
            title: e.title,
            desc: e.summary,
            seq: seq++,
        });

        const demoNames = Array.isArray(e.demo) ? e.demo : [e.demo];
        for (const demoName of demoNames) {
            const ids = exampleIdsForDemo(demoName, demoCounts[demoName] ?? 0);
            ids.forEach((id, i) => {
                const meta = examples[id];
                docs.push({
                    kind: 'example',
                    slug: e.slug,
                    name: e.name,
                    zh,
                    title: meta?.title ?? `示例 ${i + 1}`,
                    desc: meta?.desc ?? '',
                    exampleId: id,
                    seq: seq++,
                });
            });
        }

        for (const p of e.props) {
            docs.push({
                kind: 'prop',
                slug: e.slug,
                name: e.name,
                zh,
                title: p.name,
                desc: p.description ?? '',
                propName: p.name,
                propKind: p.kind,
                seq: seq++,
            });
        }
    }

    return docs;
}

/** 同类结果内部的名次：组件 < 示例 < 属性 */
const KIND_ORDER: Record<SearchKind, number> = {
    component: 0,
    example: 1,
    prop: 2,
};

/**
 * 单条命中分（越小越靠前）；不命中返回 null。
 *
 * 档位按「证据强度」排，不按类型排 —— 这是踩过的坑：
 * 曾经把 prop 整体压到 20+ 档，结果 Rate 的 `ariaLabel`
 * 说明里提了一句 `role="slider"`，就把 Slider 自己的四个示例全压过去了；
 * 而用户敲 "slider" 时想看的显然是 Slider 的示例。
 *
 *   0  属性名/组件名**精确**命中
 *   1-2  名字前缀 / 名字包含
 *   3-4  组件标题、示例标题
 *   10-13 示例标题精确/前缀/包含、所属组件名
 *   20+ 说明文字、简介这类弱证据
 */
function termScore(doc: SearchDoc, term: string): number | null {
    const name = doc.name.toLowerCase();
    const title = doc.title.toLowerCase();
    const desc = doc.desc.toLowerCase();

    if (doc.kind === 'component') {
        if (name === term) return 0;
        if (name.startsWith(term)) return 1;
        if (title.startsWith(term)) return 2;
        if (name.includes(term)) return 3;
        if (title.includes(term)) return 4;
        if (desc.includes(term)) return 22;
        return null;
    }

    if (doc.kind === 'prop') {
        if (title === term) return 0;
        if (title.startsWith(term)) return 1;
        if (title.includes(term)) return 2;
        if (desc.includes(term)) return 21;
        return null;
    }

    // example：标题优先，其次所属组件名，最后才是说明文字
    if (title === term) return 10;
    if (title.startsWith(term)) return 11;
    if (title.includes(term)) return 12;
    if (name.includes(term)) return 13;
    if (desc.includes(term)) return 20;
    return null;
}

/**
 * 搜索：多词按 **AND** 组合，分是所有词的分之和。
 *
 * 为什么用和而不是最小分：「禁用 开关」两个词都命中标题的示例，
 * 应该排在只命中一个词的示例前面。
 */
export function searchDocs(
    docs: SearchDoc[],
    query: string,
    limit = 24,
): SearchDoc[] {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const scored: { doc: SearchDoc; score: number }[] = [];
    for (const doc of docs) {
        let total = 0;
        let hit = true;
        for (const t of terms) {
            const s = termScore(doc, t);
            if (s === null) {
                hit = false;
                break;
            }
            total += s;
        }
        if (hit) scored.push({ doc, score: total });
    }

    scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        const k = KIND_ORDER[a.doc.kind] - KIND_ORDER[b.doc.kind];
        if (k !== 0) return k;
        // 同分同类 → 按生成顺序（= 声明顺序），保证结果稳定可预期
        return a.doc.seq - b.doc.seq;
    });

    return scored.slice(0, limit).map((s) => s.doc);
}

/**
 * 解析 hash 里的路由与深链目标。
 *
 *   `#/select?example=SelectExample1` → { path:'select', target:{ example:'SelectExample1' } }
 *   `#/dialog?prop=onConfirm`        → { path:'dialog',  target:{ prop:'onConfirm' } }
 *   `#/` / `#/button`                → { path:'' / 'button', target:{} }
 *
 * 只取第一段路径（`#/button/props` 这种旧写法按 `button` 处理），
 * 与改造前的路由行为保持一致。
 */
export function parseHashQuery(raw: string): { path: string; target: RouteTarget } {
    const bare = raw.replace(/^#\/?/, '');
    const qIndex = bare.indexOf('?');
    const left = qIndex === -1 ? bare : bare.slice(0, qIndex);
    const path = left.split('/')[0] ?? '';
    const target: RouteTarget = {};
    if (qIndex !== -1) {
        const params = new URLSearchParams(bare.slice(qIndex + 1));
        const example = params.get('example');
        const prop = params.get('prop');
        if (example) target.example = example;
        if (prop) target.prop = prop;
    }
    return { path, target };
}

/** 反向：拼出带深链目标的 hash */
export function buildHash(slug: string, target?: RouteTarget): string {
    const base = slug ? `#/${slug}` : '#/';
    if (!target) return base;
    const params = new URLSearchParams();
    if (target.example) params.set('example', target.example);
    if (target.prop) params.set('prop', target.prop);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
}

/**
 * 深链目标 → 页面上的 DOM id。
 *
 * 与 ExampleCard（`ex-<示例id>`）和 props 表行（`prop-<属性名>`）的 id 逐字对应 ——
 * 这三处只要有一处改名，深链就静默失效（页面照常渲染，只是不滚不亮），
 * 所以这个映射必须是**唯一的**，且被测试把守。
 */
export function targetDomId(target: RouteTarget): string | null {
    if (target.example) return `ex-${target.example}`;
    if (target.prop) return `prop-${target.prop}`;
    return null;
}
