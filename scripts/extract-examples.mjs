#!/usr/bin/env node
/**
 * Bivane · 示例源码提取
 *
 * 为什么要有：Ant Design / Element 的组件页上，每个示例下面都有一个
 * 「查看代码」按钮，展开就是**这一段示例的源码** —— 读者能直接抄走。
 * 我们之前一个组件只给一行 `<Button />` 的假代码，等于没有。
 *
 * 抽的是什么：从 demos/<组件>.tsx 里每个 `XxxExampleN` 的 JSX，
 * 再把验证台专用的布局壳（`<Block>` / `<Row>`）剥掉 ——
 * 那两个是**验证台的排版辅助**，不是组件 API 的一部分，
 * 留着会让读者抄到一段自己项目里不存在的代码。
 *
 * 产出：apps/docs/src/example-code.generated.json
 *   { "ButtonExample1": { "setup": "…", "code": "…", "consts": "…", "imports": "…" }, … }
 *
 * 一条硬要求：**读者抄走就能编译**。所以
 *   - 示例用到的常量 / 类型（也在别的示例文件里的话）按引用闭包捞回来；
 *   - `import … from "./table-shared"` 这种 demo 内部依赖**内联成源码**，
 *     不输出读者解析不了的相对路径；
 *   - import 按「实际用到」裁剪，不带只在注释里被提到的名字。
 *
 * 用法：
 *   node scripts/extract-examples.mjs
 *   node scripts/extract-examples.mjs --stdout
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEMOS = join(ROOT, 'demos');
const OUT = join(ROOT, 'apps/docs/src/example-code.generated.json');

/**
 * 剥掉 <Block> / <Row>。
 *
 * 做法：**按源码区间做字符串切片**（而不是 AST 重新打印）：
 * TS printer 会把 JSX 属性压成一行、丢掉手写时的换行 ——
 * 而这些代码正是要展示给读者抄的，必须保持原来的可读排版。
 *
 * 根节点（示例最外层的那个壳）连标签一起去掉，内容靠 dedent 归位；
 * **嵌套的壳换成 Fragment** —— 直接删标签会把
 * `cond ? (<CellGroup/>) : (<Row>{…}</Row>)` 的分支掏空成 `({…})`，
 * 抽出来的代码编译不过（Calendar 示例就踩过这个）。
 */
function stripShell(src, start, end, rootTag) {
    let region = src.slice(start, end);

    if (rootTag) {
        region = region
            .replace(new RegExp(`^(\\s*)<${rootTag}\\b[^>]*>`), '')
            .replace(new RegExp(`</${rootTag}>\\s*$`), '');
    }

    region = region
        .replace(/<(?:Block|Row)\b[^>]*?\/>/g, '<></>')
        .replace(/<(?:Block|Row)\b[^>]*>/g, '<>')
        .replace(/<\/(?:Block|Row)>/g, '</>');

    const lines = region.split('\n');
    const out = [];
    for (const line of lines) {
        if (!line.trim()) {
            out.push('');
            continue;
        }
        out.push(line.replace(/\s+$/, ''));
    }

    // 连续空行压成一个
    return out
        .filter((l, i, arr) => {
            if (l.trim()) return true;
            return !(i > 0 && !arr[i - 1].trim());
        })
        .join('\n');
}

/** 去掉 `export` 修饰符 —— 这些声明会被粘进文档示例的 `Demo()` 函数体内，不能带 export */
function stripExport(text) {
    return text.replace(/^export\s+(default\s+)?/, '');
}

/** 去掉公共缩进 */
function dedent(text) {
    const lines = text.split('\n');
    let min = Infinity;
    for (const l of lines) {
        if (!l.trim()) continue;
        const m = /^[ \t]*/.exec(l)[0].length;
        if (m < min) min = m;
    }
    if (!isFinite(min)) min = 0;
    return lines.map((l) => l.slice(min)).join('\n');
}

/**
 * 按「实际用到」重建一行 import。
 *
 * 为什么不直接抄原文：`import { Checkbox, CheckboxGroup }` 里可能只有一个真被用到，
 * 整行抄走会在读者那边变成 noUnusedLocals 报错；这个只被注释提到过的名字
 * （`// 上限只约束新增，与 CheckboxGroup max 语义一致`）就是典型来源。
 * 全都没用到 → 返回 null，整行丢掉。
 */
function renderImport(imp, used) {
    const parts = [];
    if (imp.defaultName && used.has(imp.defaultName)) parts.push(imp.defaultName);
    if (imp.namespaceName && used.has(imp.namespaceName)) {
        parts.push(`* as ${imp.namespaceName}`);
    }
    const named = (imp.named || []).filter((el) => used.has(el.name));
    if (named.length) parts.push(`{ ${named.map((el) => el.text).join(', ')} }`);
    if (!parts.length) return null;
    return `import ${imp.typeOnly ? 'type ' : ''}${parts.join(', ')} from '${imp.spec}';`;
}

/** 收集一条 import 声明导出的绑定名（default / 命名 / 命名空间） */
function collectImportNames(node) {
    const names = [];
    const clause = node.importClause;
    if (!clause) return names;
    if (clause.name) names.push(clause.name.text);
    const named = clause.namedBindings;
    if (named) {
        if (ts.isNamedImports(named)) {
            for (const el of named.elements) names.push(el.name.text);
        } else if (ts.isNamespaceImport(named)) {
            names.push(named.name.text);
        }
    }
    return names;
}

/** 一个节点是不是「模块级值/类型声明」（它的名字可能被示例引用） */
function isTopLevelDecl(node) {
    return (
        ts.isVariableStatement(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isEnumDeclaration(node)
    );
}

/** 取声明节点导出的名字（一条 const a=1, b=2 会拿到 a、b） */
function declNames(node, sf) {
    if (ts.isVariableStatement(node)) {
        return node.declarationList.declarations.map((d) => d.name.getText(sf));
    }
    const name = node.name?.text;
    return name ? [name] : [];
}

/** 扫描一段源码里出现的所有标识符（粗略，但够用来判断「某个顶层声明被引用」） */
function collectIdentifiers(text) {
    // 先把注释与字符串抹掉：示例里常有 `// 与 CheckboxGroup max 语义一致` 这种
    // 顺带一提的注释，直接扫原文会把没用到的 import 也带进示例代码里。
    const clean = text
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ')
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
    const ids = new Set();
    for (const m of clean.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) ids.add(m[0]);
    return ids;
}

export function extractExamples() {
    const files = readdirSync(DEMOS).filter((f) => f.endsWith('.tsx'));
    const paths = files.map((f) => join(DEMOS, f));
    const program = ts.createProgram(paths, {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        skipLibCheck: true,
        noEmit: true,
    });

    /** @type {Record<string, {file: string, setup: string, code: string, consts: string, imports: string}>} */
    const result = {};

    /** 模块解析缓存：同一个文件被多个示例引用时只解析一次 */
    const moduleCache = new Map();

    /** 解析 demo 内部的相对引用（'./table-shared'）到 demos/ 下的真实文件 */
    function resolveInternal(spec, fromPath) {
        if (!spec.startsWith('.')) return null;
        const base = resolve(dirname(fromPath), spec);
        for (const candidate of [
            `${base}.tsx`,
            `${base}.ts`,
            join(base, 'index.tsx'),
            join(base, 'index.ts'),
        ]) {
            if (existsSync(candidate)) return candidate;
        }
        return null;
    }

    /**
     * 一个文件的「模块级 import / 声明」清单。
     *
     * 示例里写死的 PAYMENT_OPTIONS 这类常量挂在模块级，函数体内抓不到；
     * 有些还挂在**同目录的共享 demo 文件**里（./table-shared、./choice）——
     * 后者读者项目里根本不存在，原样输出一条 import 等于给了一段跑不起来的代码，
     * 所以要把 `internal` 标记出来，由调用方**递归进去内联源码**。
     */
    function moduleOf(path) {
        const hit = moduleCache.get(path);
        if (hit) return hit;
        const sf = program.getSourceFile(path);
        if (!sf) {
            const empty = { imports: [], decls: [] };
            moduleCache.set(path, empty);
            return empty;
        }
        const src = readFileSync(path, 'utf8');
        /** @type {any[]} */
        const imports = [];
        /** @type {{names:string[], text:string, index:number}[]} */
        const decls = [];
        sf.forEachChild((node) => {
            if (ts.isImportDeclaration(node)) {
                const spec = node.moduleSpecifier
                    .getText(sf)
                    .replace(/^['"]|['"]$/g, '');
                const clause = node.importClause;
                const bindings = clause?.namedBindings;
                imports.push({
                    names: collectImportNames(node),
                    text: src.slice(node.getStart(sf), node.getEnd()),
                    index: node.getStart(sf),
                    spec,
                    internal: resolveInternal(spec, path),
                    typeOnly: Boolean(clause?.isTypeOnly),
                    defaultName: clause?.name?.text ?? null,
                    namespaceName:
                        bindings && ts.isNamespaceImport(bindings)
                            ? bindings.name.text
                            : null,
                    named:
                        bindings && ts.isNamedImports(bindings)
                            ? bindings.elements.map((el) => ({
                                  name: el.name.text,
                                  text: el.getText(sf),
                              }))
                            : [],
                });
            } else if (isTopLevelDecl(node)) {
                decls.push({
                    names: declNames(node, sf),
                    text: src.slice(node.getStart(sf), node.getEnd()),
                    index: node.getStart(sf),
                });
            }
        });
        const mod = { imports, decls };
        moduleCache.set(path, mod);
        return mod;
    }

    for (const path of paths) {
        const sf = program.getSourceFile(path);
        if (!sf) continue;
        const src = readFileSync(path, 'utf8');
        const file = relative(ROOT, path).replace(/\\/g, '/');

        sf.forEachChild((node) => {
            if (!ts.isFunctionDeclaration(node)) return;
            const name = node.name?.text ?? '';
            if (!/Example\d+$/.test(name)) return;

            const ret = node.body.statements.find((s) => ts.isReturnStatement(s));
            if (!ret?.expression) return;

            // ① setup：return 之前的声明（state / 回调）
            const setup = node.body.statements
                .filter((s) => s !== ret)
                .map((s) => dedent(src.slice(s.getStart(sf), s.getEnd())))
                .filter((t) => t.trim())
                .join('\n');

            // ② code：取示例的 JSX，剥掉 Block / Row 壳
            //
            // ⚠ 优先取 <Block> 本身：return 的表达式里还包着 <Section>
            //    （那是验证台的章节标题），混进来会让展示的代码里出现
            //    一个读者不存在的标签，而且它把公共缩进拉到 0，
            //    dedent 后整段代码都是歪的。
            //    但有些示例本来就没有 <Block>（如 cell 的两个示例直接返回
            //    <CellGroup>）—— 那就退回整个 return 表达式。
            let blockNode = null;
            const findBlock = (n) => {
                if (
                    ts.isJsxElement(n) &&
                    n.openingElement.tagName.getText(sf) === 'Block'
                ) {
                    blockNode = n;
                    return;
                }
                ts.forEachChild(n, findBlock);
            };
            findBlock(ret.expression);

            const code = dedent(
                stripShell(
                    src,
                    blockNode
                        ? blockNode.getStart(sf)
                        : ret.expression.getStart(sf),
                    blockNode
                        ? blockNode.getEnd()
                        : ret.expression.getEnd(),
                    blockNode ? 'Block' : null,
                ),
            )
                .replace(/^\(|\)$/g, '')
                .trim();

            // ③ consts / ④ imports：按引用做**跨文件**传递闭包
            //
            //    三种落点：
            //      顶层声明       → 收下源码，继续追它自己的依赖
            //      demo 内部相对 import（./table-shared）→ 递归进去内联同名声明
            //      库 import      → 输出这行 import（读者抄走能直接跑）
            const wantDecls = new Map();
            const wantImports = new Map();
            const seen = new Set();
            const queue = [];
            const pushIds = (f, text) => {
                for (const id of collectIdentifiers(text)) queue.push({ f, id });
            };
            pushIds(path, `${setup}\n${code}`);

            while (queue.length) {
                const { f, id } = queue.shift();
                const key = `${f}::${id}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const mod = moduleOf(f);
                const decl = mod.decls.find((d) => d.names.includes(id));
                if (decl) {
                    wantDecls.set(key, {
                        file: f,
                        index: decl.index,
                        text: decl.text,
                    });
                    pushIds(f, decl.text);
                    continue;
                }
                const imp = mod.imports.find((i) => i.names.includes(id));
                if (!imp) continue; // 文件内局部变量 / 全局，不带
                if (imp.internal) {
                    queue.push({ f: imp.internal, id });
                    continue;
                }
                // 同一个模块被两层文件各 import 一次（`import * as React` 与
                // `import type * as React`）时只留一条，否则示例里 React 重复声明
                const impKey = `${imp.spec}|${[...imp.names].sort().join(',')}`;
                if (!wantImports.has(impKey)) {
                    wantImports.set(impKey, {
                        file: f,
                        index: imp.index,
                        imp,
                    });
                }
            }

            // 带 props 的示例（Switch 的两张卡片靠父组件传入联动状态）：
            // 文档面板要把形参一并带上，否则抽出来的代码里挂着一对找不到的标识符
            const params = node.parameters.length
                ? src.slice(node.name.getEnd(), node.body.getStart(sf)).trim()
                : '';

            // 别的文件的声明在前（共享模块 → 本文件），读起来先有依赖后有使用方
            const consts = [...wantDecls.values()]
                .sort(
                    (a, b) =>
                        (a.file === path ? 1 : 0) - (b.file === path ? 1 : 0) ||
                        a.index - b.index,
                )
                .map((d) => stripExport(dedent(d.text)))
                .join('\n\n');

            // import 反过来：本文件（react / 组件库）在前，共享模块自己的 type 在后；
            // 顺手按「实际用到」裁剪 —— 读者抄走的代码里多一条没用的 import，
            // 走 noUnusedLocals 的项目会直接报错。
            const usedIds = collectIdentifiers(`${consts}\n${setup}\n${code}\n${params}`);
            const imports = [...wantImports.values()]
                .sort(
                    (a, b) =>
                        (a.file === path ? 0 : 1) - (b.file === path ? 0 : 1) ||
                        a.index - b.index,
                )
                .map((i) => renderImport(i.imp, usedIds))
                .filter(Boolean)
                .join('\n');

            result[name] = { file, setup, code, consts, imports, params };
        });
    }

    return result;
}

function main() {
    const data = extractExamples();
    const json = JSON.stringify(data, null, 2) + '\n';

    if (process.argv.includes('--stdout')) {
        process.stdout.write(json);
        return;
    }
    writeFileSync(OUT, json, 'utf8');
    const count = Object.keys(data).length;
    const empty = Object.entries(data).filter(([, v]) => !v.code.trim());
    console.log(
        `✓ 已写入 ${relative(ROOT, OUT)}：${count} 个示例` +
            (empty.length
                ? `（⚠ ${empty.length} 个代码为空：${empty.map(([k]) => k).join(', ')}）`
                : ''),
    );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
