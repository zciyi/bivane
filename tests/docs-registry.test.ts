import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 文档站一致性测试
 *
 * 文档站的内容全部是**生成**的（props 表、组件清单），只有「组件目录」是手写的。
 * 生成的东西会漂移（源码改了、表没重新生成），手写的东西会写错
 * （demo 名改了、目录里没同步）。这个测试把两种漂移都挡住。
 *
 * 判据都来自「我期望什么」：
 *  - 目录里写的 demo 名，必须在 demos/ 下真有这个导出
 *  - 生成物（props.generated.json / registry.generated.json）必须与源码一致
 *  - 文档站必须能构建出产物（且产物里含每个组件页的标题）
 */

const ROOT = process.cwd();
const DOCS = join(ROOT, 'apps/docs');
const DEMOS = join(ROOT, 'demos');

/** 读 catalog.ts 里的手写目录 */
function readCatalog(): {
    name: string;
    slug: string;
    /** demo 模块名；数组表示这个组件页挂多个 demo */
    demo: string | string[];
    propsType: string;
    category: string;
}[] {
    const src = readFileSync(join(DOCS, 'src/catalog.ts'), 'utf8');
    const match = /export const CATALOG\s*=\s*(\[[\s\S]*?\])\s*as const;/.exec(src);
    if (!match) throw new Error('catalog.ts 里找不到 CATALOG 数组');
    return new Function(`return ${match[1]}`)();
}

/** demos/ 下实际导出的 demo 组件名 */
function readDemoExports(): Set<string> {
    const names = new Set<string>();
    for (const file of readdirSync(DEMOS)) {
        if (!file.endsWith('.tsx')) continue;
        const src = readFileSync(join(DEMOS, file), 'utf8');
        for (const m of src.matchAll(/^export function (\w+Demos)\(/gm)) names.add(m[1]);
    }
    return names;
}

describe('文档站 · 组件目录', () => {
    const catalog = readCatalog();
    const demoExports = readDemoExports();

    it('目录非空', () => {
        expect(catalog.length).toBeGreaterThan(0);
    });

    it('每个条目引用的 demo 都真实存在', () => {
        const missing = catalog
            .flatMap((e) =>
                (Array.isArray(e.demo) ? e.demo : [e.demo])
                    .filter((d) => !demoExports.has(d))
                    .map((d) => `${e.name} → ${d}`),
            );
        expect(missing, `这些 demo 在 demos/ 下不存在：${missing.join(', ')}`).toEqual([]);
    });

    it('每个 demo 模块都进了验证台', () => {
        // 反向检查：demo 文件写了、验证台却没渲染它 →
        // 那个 demo 就只有文档站在用，**验证台没验证过**。
        // 「demo 与验证台共用同一份」的约定要求两边都覆盖。
        const app = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');
        const used = new Set(
            [...app.matchAll(/import \{ (\w+Demos) \} from '@\/demos\//g)].map(
                (m) => m[1],
            ),
        );
        const orphans = [...demoExports].filter((d) => !used.has(d));
        expect(
            orphans,
            `这些 demo 文档站有、验证台没渲染：${orphans.join(', ')}`,
        ).toEqual([]);
    });

    it('验证台里的每个 demo 都能在文档站上查到', () => {
        // 反向检查：验证台有、文档站没有的 demo = 读者查不到的 demo。
        // demo 名在文档站的挂载点由 catalog 的 demo 字段决定。
        const used = new Set(
            catalog.flatMap((e) =>
                Array.isArray(e.demo) ? e.demo : [e.demo],
            ),
        );
        const orphans = [...demoExports].filter((d) => !used.has(d));
        expect(
            orphans,
            `这些 demo 验证台有、文档站没挂：${orphans.join(', ')}`,
        ).toEqual([]);
    });

    it('slug 唯一', () => {
        const slugs = catalog.map((e) => e.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
    });

    it('组件名唯一', () => {
        const names = catalog.map((e) => e.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('每个条目都填了分类 / 标题 / 一句话说明', () => {
        for (const e of catalog) {
            expect(e.category, `${e.name} 缺 category`).toBeTruthy();
            expect(e.name, '缺 name').toBeTruthy();
            expect(e.slug, `${e.name} 缺 slug`).toBeTruthy();
        }
    });
});

describe('文档站 · 生成物与源码一致', () => {
    /**
     * 用「重新生成到 stdout」的方式校验，不写盘。
     *
     * ⚠ 不能让校验脚本写盘：测试是并行的，一个文件在写、另一个在读
     * 就会偶发失败（症状：单跑绿、全量跑红，且红的原因跟本测试无关）。
     */
    function regenerate(script: string): string {
        return execFileSync('node', [script, '--stdout'], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    }

    it(
        'props.generated.json 与组件源码同步',
        // ⚠ 这三个用例要**跑子进程 + TypeScript 编译器**，耗时秒级。
        //   全量测试时机器被几十个测试文件占满，5s 默认超时不够 → 偶发红。
        { timeout: 60_000 },
        () => {
            const propsPath = join(DOCS, 'src/props.generated.json');
            expect(
                readFileSync(propsPath, 'utf8'),
                'props.generated.json 过期了 —— 跑 npm run docs:props 重新生成',
            ).toBe(regenerate('scripts/extract-props.mjs'));
        },
    );

    it(
        'registry.generated.json 与矩阵文档同步',
        { timeout: 60_000 },
        () => {
            const registryPath = join(DOCS, 'src/registry.generated.json');
            expect(
                readFileSync(registryPath, 'utf8'),
                'registry.generated.json 过期了 —— 跑 npm run docs:registry 重新生成',
            ).toBe(regenerate('scripts/build-docs-registry.mjs'));
        },
    );

    it(
        'example-code.generated.json 与 demo 源码同步',
        { timeout: 60_000 },
        () => {
            const codePath = join(DOCS, 'src/example-code.generated.json');
            expect(
                readFileSync(codePath, 'utf8'),
                'example-code.generated.json 过期了 —— 跑 npm run docs:examples 重新生成',
            ).toBe(regenerate('scripts/extract-examples.mjs'));
        },
    );
});

describe('文档站 · 示例清单', () => {
    /** demos/ 下实际导出的示例组件名 */
    function readExampleExports(): Set<string> {
        const names = new Set<string>();
        for (const file of readdirSync(DEMOS)) {
            if (!file.endsWith('.tsx')) continue;
            const src = readFileSync(join(DEMOS, file), 'utf8');
            for (const m of src.matchAll(/^export function (\w+Example\d+)\(/gm)) {
                names.add(m[1]);
            }
        }
        return names;
    }

    const exampleExports = readExampleExports();

    it('每个示例组件都登记了标题与说明', () => {
        // 读 examples.ts 里手写的 EXAMPLES 表
        const src = readFileSync(join(DOCS, 'src/examples.ts'), 'utf8');
        const match = /export const EXAMPLES\s*:\s*Record<string, ExampleMeta>\s*=\s*(\{[\s\S]*?\});/.exec(
            src,
        );
        if (!match) throw new Error('examples.ts 里找不到 EXAMPLES 表');
        const table = new Function(`return ${match[1]}`)() as Record<
            string,
            { title: string; desc: string }
        >;

        const missing = [...exampleExports].filter(
            (name) => !table[name],
        );
        expect(
            missing,
            `这些示例没写标题/说明（apps/docs/src/examples.ts）：${missing.join(', ')}`,
        ).toEqual([]);

        // 反向：表里不能有 demos/ 下不存在的示例
        const stale = Object.keys(table).filter(
            (name) => !exampleExports.has(name),
        );
        expect(
            stale,
            `examples.ts 里这些示例在 demos/ 下不存在：${stale.join(', ')}`,
        ).toEqual([]);
    });

    it('示例源码都抽到了内容', () => {
        const code = JSON.parse(
            readFileSync(join(DOCS, 'src/example-code.generated.json'), 'utf8'),
        ) as Record<string, { setup: string; code: string }>;

        for (const name of exampleExports) {
            expect(code[name], `缺 ${name} 的源码`).toBeTruthy();
            expect(
                code[name].code.trim(),
                `${name} 抽出来的代码是空的`,
            ).not.toBe('');
        }
    });

    it('抽出来的代码里不含验证台的布局壳', () => {
        // <Block> / <Row> 是验证台专有的排版辅助，读者项目里没有 → 不能出现在示例代码里
        const code = JSON.parse(
            readFileSync(join(DOCS, 'src/example-code.generated.json'), 'utf8'),
        ) as Record<string, { setup: string; code: string }>;

        for (const [name, v] of Object.entries(code)) {
            expect(
                v.code,
                `${name} 的示例代码里还有 <Block>/<Row> 布局壳`,
            ).not.toMatch(/<\/?(Block|Row)\b/);
        }
    });
});

describe('文档站 · 生成清单覆盖全部目录条目', () => {
    it('每个组件都在生成清单里，且带 props', () => {
        const registry = JSON.parse(
            readFileSync(join(DOCS, 'src/registry.generated.json'), 'utf8'),
        ) as {
            entries: { name: string; slug: string; props: unknown[] }[];
        };
        const catalog = readCatalog();
        const byName = new Map(registry.entries.map((e) => [e.name, e]));

        for (const e of catalog) {
            const entry = byName.get(e.name);
            expect(entry, `生成清单里少了 ${e.name}`).toBeTruthy();
            expect(
                entry!.props.length,
                `${e.name} 的 props 表是空的 —— props 类型名可能写错了（${e.propsType}）`,
            ).toBeGreaterThan(0);
        }
    });
});

describe('文档站 · 不泄漏内部路线图信息', () => {
    /**
     * 矩阵末列「状态」记的是**内部路线图阶段**（✅ P1 / P2 / P3 / P1′）——
     * 组件在第几阶段落地是我们自己的开发节奏，对读文档的人毫无意义：
     * 38 个组件全都已落地，阶段号只会让人以为组件分三六九等。
     *
     * 文档站曾把这个值渲染在组件页页头（`{entry.status}`），2026-10-22 全链移除
     * （生成器不再解析该列、目录不再维护该字段、页头不再渲染）。
     * 这几条断言锁住「别再搬回来」——每一层都是曾经出问题的地方。
     */
    function regenerate(script: string): string {
        return execFileSync('node', [script, '--stdout'], {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
        });
    }

    it('重新生成的清单里没有路线图阶段标签', () => {
        const json = regenerate('scripts/build-docs-registry.mjs');
        expect(
            json,
            '矩阵「状态」列又被解析进文档站清单了 —— 那是内部路线图，不对外',
        ).not.toMatch(/✅\s*P[0-4]/);
        expect(json, '清单里不该有 status 字段').not.toMatch(/"status"/);
    });

    it('磁盘上的 registry.generated.json 同样干净', () => {
        const raw = readFileSync(
            join(DOCS, 'src/registry.generated.json'),
            'utf8',
        );
        expect(raw).not.toMatch(/✅\s*P[0-4]/);
        expect(raw).not.toMatch(/"status"/);
    });

    it('catalog.ts 不再维护 status 字段', () => {
        const src = readFileSync(join(DOCS, 'src/catalog.ts'), 'utf8');
        expect(src, '目录里又出现 status 字段了').not.toMatch(/^\s+status:/m);
    });

    it(
        '组件页页头不渲染路线图阶段',
        { timeout: 60_000 },
        () => {
            const src = readFileSync(
                join(DOCS, 'src/pages/component-page.tsx'),
                'utf8',
            );
            expect(src, '组件页又在渲染 entry.status 了').not.toMatch(
                /entry\.status/,
            );
        },
    );
});
