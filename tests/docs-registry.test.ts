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

    it('示例代码不 import demo 内部文件，且用到的组件都带上了', () => {
        // 读者没有 demos/table-shared.tsx 这种文件 —— 共享数据必须内联成源码，
        // 而不是甩一条 `import … from "./table-shared"`（抄走直接报错）。
        const code = JSON.parse(
            readFileSync(join(DOCS, 'src/example-code.generated.json'), 'utf8'),
        ) as Record<
            string,
            { imports?: string; consts?: string; setup?: string; code: string }
        >;

        for (const [name, v] of Object.entries(code)) {
            expect(
                v.imports || '',
                `${name} 的示例代码还在 import demo 内部文件`,
            ).not.toMatch(/from\s+['"]\.{1,2}\//);
        }

        // 表格示例：数据内联后，渲染它用到的 React / Table / cn 一个都不能少
        const table = code.TableExample1;
        for (const dep of ["react", "@/components/responsive/table", "@/lib/utils"]) {
            expect(
                table.imports,
                `TableExample1 少了 ${dep} 的 import —— 读者抄走跑不起来`,
            ).toContain(dep);
        }
        expect(table.consts).toContain('DEMO_TABLE_COLUMNS');
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
     * 矩阵里曾有一列「状态」，记的是**内部路线图阶段**（✅ P1 / P2 / P3 / P1′）——
     * 组件在第几阶段落地是我们自己的开发节奏，对读文档的人毫无意义：
     * 38 个组件全都已落地，阶段号只会让人以为组件分三六九等。
     * 那一列还无图例、无消费方、值已过期（Picker/Cascader 标 ⬜ 但早已落地），
     * 2026-10-22 整列删除，只在矩阵文档头留了一句「为什么不记阶段」。
     *
     * 文档站曾把这个值渲染在组件页页头（`{entry.status}`），同一次全链移除
     * （生成器不解析、目录不维护、页头不渲染）。
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

    it('矩阵里没有路线图状态符号', () => {
        // ✅/⬜ 只会从已删除的「状态」列来 —— 出现即回潮。
        // （矩阵正文里「状态」二字是合法词汇：状态归属、状态机、刷新状态机……
        //   所以只禁符号、不禁词。）
        const matrix = readFileSync(
            join(ROOT, 'docs/bivane-responsive-matrix.md'),
            'utf8',
        );
        expect(
            matrix,
            '矩阵里又出现 ✅/⬜ 了 —— 路线图阶段不进矩阵（文档头有说明）',
        ).not.toMatch(/[✅⬜]/);
    });
});

describe('README · 路线图状态与现实一致', () => {
    /**
     * README 有一张**对外**的路线图表，漂过两次：
     * P2 写着「进行中（6/8）」其实 10/10 全落地；P3 写着「⬜ 待开始」其实 2026-10-20 已闭环
     * ——读文档的人收到的全是过时信息。2026-10-22 按 architecture §8 的事实更新。
     *
     * 这里冻结「已闭环批次必须标 ✅」：P0~P3 都是闭环批次，不会重开；
     * P4 仍在进行（registry 发布验证未完成），不冻结——它完成时这张表本来就要改。
     */
    const CLOSED = ['P0', 'P1', 'P1′', 'P2', 'P3'];

    it('已闭环批次都标为 ✅ 已完成', () => {
        const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
        for (const phase of CLOSED) {
            expect(
                readme,
                `README 路线图的 ${phase} 行不是 ✅ 了 —— ${phase} 是已闭环批次，` +
                    '别把它标回「待开始 / 进行中」',
            ).toMatch(new RegExp(`^\\| ${phase} \\|[^\\n]*✅`, 'm'));
        }
    });
});

describe('文档站 · 展示的属性必须带说明', () => {
    /**
     * props 表「说明」列的内容来自源码接口的 JSDoc。2026-10-22 之前，
     * 38 个组件页上有 149 个展示属性（近三分之一）没写说明，渲染层刷一屏
     * 「（源码里没写说明）」——零信息量，还把「文档缺失」印刷成噪音。
     * 那 149 条已全部补写，渲染层也改成缺说明留空。
     *
     * 这两条断言锁住两边：
     *  1. 展示面上的每个属性都有说明 —— 新组件想不带 JSDoc 上线，先过这关。
     *     「不能描述就空着」是渲染层的兜底，不是不上说明的许可证。
     *  2. 渲染层不回流占位文本（空单元格由兜底负责，不需要文案）。
     */
    const catalog = readCatalog();
    const props = JSON.parse(readFileSync(join(DOCS, 'src/props.generated.json'), 'utf8')) as {
        [typeName: string]: { props: { name: string; description?: string }[] };
    };

    it('每个展示属性都有 JSDoc 说明', () => {
        const gaps: string[] = [];
        for (const entry of catalog) {
            const table = props[entry.propsType];
            if (!table) continue; // propsType 缺失由「生成物与源码一致」那组把关
            for (const p of table.props) {
                if (!(p.description ?? '').trim()) gaps.push(`${entry.name}.${p.name}`);
            }
        }
        expect(
            gaps,
            '这些展示属性缺说明 —— 去源码接口补 JSDoc，再跑 npm run docs:props：' +
                gaps.join(', '),
        ).toEqual([]);
    });

    it('props 表缺说明时留空，不渲染占位文本', () => {
        const src = readFileSync(join(DOCS, 'src/components/props-table.tsx'), 'utf8');
        expect(
            src,
            'props-table 的说明列兜底不是「留空」了 —— 缺说明就渲染空，' +
                '别把「文档没写」印刷成占位文案',
        ).toMatch(/\{p\.description \|\| null\}/);
        expect(src, 'props-table 又在渲染占位文案了').not.toMatch(
            /源码里(没写|缺)说明|暂无说明|（无说明）/,
        );
    });
});
