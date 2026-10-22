#!/usr/bin/env node
/**
 * Bivane · 文档站组件清单生成
 *
 * 「哪些组件、怎么分类」是产品决策 —— 手工维护（apps/docs/src/catalog.ts）；
 * 「这个组件两端怎么表现」是**事实** —— 从 docs/bivane-responsive-matrix.md
 * 里抽（那份文档是逐组件双模式的唯一事实源）。
 *
 * 这样切分的好处：矩阵一改，文档站的行为描述跟着变；
 * 文档站自己写的描述会跟矩阵漂移，而漂移是静默的。
 *
 * 产出：apps/docs/src/registry.generated.json
 * 用法：
 *   node scripts/build-docs-registry.mjs
 *   node scripts/build-docs-registry.mjs --check    # CI：校验是否与矩阵一致
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MATRIX = join(ROOT, 'docs/bivane-responsive-matrix.md');
const CATALOG = join(ROOT, 'apps/docs/src/catalog.ts');
const PROPS = join(ROOT, 'apps/docs/src/props.generated.json');
const REGISTRY = join(ROOT, 'packages/registry/registry.json');
const OUT = join(ROOT, 'apps/docs/src/registry.generated.json');

/** 读矩阵文档 */
function readMatrix() {
    return readFileSync(MATRIX, 'utf8');
}

/**
 * 解析矩阵里的 markdown 表格行。
 *
 * @param {string[]} lines
 * @param {number} from
 * @returns {string[][]} 每行的单元格
 */
function tableRows(lines, from) {
    const rows = [];
    for (let i = from; i < lines.length; i += 1) {
        const line = lines[i];
        if (!line.trim().startsWith('|')) {
            if (rows.length) break; // 表结束
            continue;
        }
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        // 跳过分隔行（|---|---|）
        if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
        if (cells[0] === '组件') continue; // 表头
        rows.push(cells);
    }
    return rows;
}

/** 去掉 markdown 强调与括注 */
function cleanName(raw) {
    return raw
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 拆出组件名里的各个成员。
 * 例：`Field / Input / Textarea` → ['Field','Input','Textarea']
 *     `Popup（基础）` → ['Popup']
 *     `List（列表）` → ['List']
 */
function memberNames(raw) {
    const name = cleanName(raw);
    const stripped = name.replace(/[（(][^）)]*[）)]/g, '').trim();
    return stripped
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean);
}

/** 解析矩阵的 §2 三个分类表 + §3.1 总览表 */
export function parseMatrix() {
    const text = readMatrix();
    const lines = text.split('\n');

    /** @type {Record<string, any>} */
    const byComponent = {};

    const absorb = (cells, category) => {
        if (cells.length < 3) return;
        const rawName = cells[0];
        if (!rawName) return;
        const members = memberNames(rawName);
        if (members.length === 0) return;

        const h5 = cells[1] ?? '';
        const pc = cells[2] ?? '';
        // 模式列：可能在第 3 位（§2.1/2.2）或第 3 位（§2.3，列少一列）
        const mode = (cells[3] ?? '').replace(/\*\*/g, '').trim();
        const shared = (cells[4] ?? '').trim();
        // 矩阵还有一列「状态」（✅ P1 / P2 / P3 / P1′）——**故意不解析**：
        // 那是内部路线图阶段（哪些组件在第几阶段落地），不是组件事实。
        // 文档站曾经把它渲染在组件页页头，对读文档的人毫无意义 ——
        // 38 个组件全都已落地，阶段号只会让人以为组件分三六九等。
        // 2026-10-22 从「生成器 → 清单 → 页头」整链移除；
        // 目录里的每个条目就是已落地的组件，未落地的不进目录。
        // tests/docs-registry.test.ts 有守卫，别把它搬回来。

        for (const member of members) {
            if (!byComponent[member]) {
                byComponent[member] = {
                    name: member,
                    category,
                    h5: '',
                    pc: '',
                    mode: '',
                    shared: '',
                    difference: '',
                };
            }
            const entry = byComponent[member];
            if (category) entry.category = category;
            if (h5) entry.h5 = h5;
            if (pc) entry.pc = pc;
            if (mode) entry.mode = mode;
            if (shared) entry.shared = shared;
        }
    };

    // §2.1 / §2.2 / §2.3
    const sections = [
        ['弹层与反馈', '### 2.1'],
        ['选择与输入', '### 2.2'],
        ['导航与数据', '### 2.3'],
    ];
    for (const [category, marker] of sections) {
        const idx = lines.findIndex((l) => l.startsWith(marker));
        if (idx === -1) continue;
        for (const cells of tableRows(lines, idx)) absorb(cells, category);
    }

    // §3.1 总览：补「本质差异」
    const overviewIdx = lines.findIndex((l) => l.startsWith('### 3.1'));
    if (overviewIdx !== -1) {
        for (const cells of tableRows(lines, overviewIdx)) {
            const members = memberNames(cells[0]);
            const diff = cells[2] ?? '';
            for (const member of members) {
                if (byComponent[member]) byComponent[member].difference = diff;
            }
        }
    }

    return byComponent;
}

/** 读手工维护的组件目录（从 catalog.ts 里用正则抠出对象字面量） */
function readCatalog() {
    const src = readFileSync(CATALOG, 'utf8');
    // 目录是个纯数据文件，用 JSON 化的写法最省事 —— 这里直接 eval 它的数组字面量
    const match = /export const CATALOG\s*=\s*(\[[\s\S]*?\])\s*as const;/.exec(src);
    if (!match) throw new Error('catalog.ts 里找不到 CATALOG 数组');
    const list = new Function(`return ${match[1]}`)();
    return list;
}

/**
 * 读 registry.json，得出每个组件「消费者怎么装、怎么 import」。
 *
 * ⚠ Bivane **不是 npm 包** —— 它是 shadcn registry 形态（copy-paste）。
 * 所以 `import { Button } from "@bivane/button"` 是**错的**：
 * 消费者跑 `npx shadcn add @bivane/button` 之后，文件落在自己项目的
 * `src/components/ui/button.tsx`，import 写的是 `@/components/ui/button`。
 * 文档站之前给的就是那个错的路径 —— 抄了直接编译不过。
 */
function readRegistryInstalls() {
    const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    /** @type {Map<string, {install: string, importPath: string, file: string}>} */
    const map = new Map();
    for (const item of registry.items) {
        if (item.type !== 'registry:component') continue;
        const file = item.files?.[0]?.target;
        if (!file) continue;
        map.set(item.name, {
            // 消费者实际敲的命令
            install: `npx shadcn@latest add @bivane/${item.name}`,
            // 装完之后在自己项目里的 import 路径（shadcn 落到 src/ 下）
            importPath: `@/${file.replace(/\.tsx$/, '')}`,
            file,
        });
    }
    return map;
}

function main() {
    const matrix = parseMatrix();
    const catalog = readCatalog();
    const props = existsSync(PROPS) ? JSON.parse(readFileSync(PROPS, 'utf8')) : {};

    const installs = readRegistryInstalls();
    const entries = catalog.map((item) => {
        const m = matrix[item.name] ?? {};
        const propsMeta = item.propsType ? props[item.propsType] : undefined;
        const inst = installs.get(item.slug);
        if (!inst) {
            console.warn(
                `⚠ ${item.name}（slug=${item.slug}）在 registry.json 里没有对应的 component item —— ` +
                    `用法片段会缺安装命令`,
            );
        }
        return {
            ...item,
            install: inst?.install ?? '',
            importPath: inst?.importPath ?? '',
            h5: m.h5 ?? '',
            pc: m.pc ?? '',
            mode: m.mode ?? '',
            shared: m.shared ?? '',
            difference: m.difference ?? '',
            propsType: item.propsType ?? '',
            propsFile: propsMeta?.file ?? '',
            props: propsMeta?.props ?? [],
        };
    });

    // 诊断：目录里有、矩阵里没有的（多半是拼写错了）
    const missing = entries.filter((e) => !e.h5 && !e.pc).map((e) => e.name);
    if (missing.length) {
        console.warn(
            `⚠ 这些组件在矩阵里找不到对应行（行为描述会是空）：${missing.join(', ')}`,
        );
    }

    const json = JSON.stringify(
        {
            generatedFrom: 'docs/bivane-responsive-matrix.md',
            categories: [
                { id: 'basic', title: '基础' },
                { id: 'form', title: '表单' },
                { id: 'feedback', title: '弹层与反馈' },
                { id: 'select', title: '选择与输入' },
                { id: 'nav', title: '导航与数据' },
            ],
            entries,
        },
        null,
        2,
    ) + '\n';

    if (process.argv.includes('--check')) {
        if (!existsSync(OUT)) {
            console.error('✗ registry.generated.json 不存在，请先跑 npm run docs:registry');
            process.exit(1);
        }
        if (readFileSync(OUT, 'utf8') !== json) {
            console.error('✗ 文档站清单与矩阵不一致 —— 请跑 npm run docs:registry');
            process.exit(1);
        }
        console.log(`✓ 文档站清单与矩阵一致（${entries.length} 个组件）`);
        return;
    }

    // --stdout：只输出不写盘（测试用，避免与并行测试抢同一个文件）
    if (process.argv.includes('--stdout')) {
        process.stdout.write(json);
        return;
    }
    writeFileSync(OUT, json, 'utf8');
    const withBehavior = entries.filter((e) => e.h5 || e.pc).length;
    console.log(
        `✓ 已写入 ${OUT.replace(ROOT + '\\', '')}：${entries.length} 个组件` +
            `（${withBehavior} 个带矩阵行为描述）`,
    );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
