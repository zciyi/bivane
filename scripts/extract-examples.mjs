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
 *   { "ButtonExample1": { "setup": "…", "code": "…" }, … }
 *
 * 用法：
 *   node scripts/extract-examples.mjs
 *   node scripts/extract-examples.mjs --stdout
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
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
 */
function stripShell(src, start, end) {
    const region = src.slice(start, end);
    const lines = region.split('\n');
    const out = [];

    for (const line of lines) {
        const trimmed = line.trim();
        // 独占一行的壳标签 → **整行删掉**（连同它的缩进）
        // 只删标签文本的话，这一行会变成空行，
        // 而里面的内容仍带着原来的深层缩进 → 展示出来的代码是歪的。
        if (/^<\/?(Block|Row)\b[^>]*\/?>$/.test(trimmed)) continue;
        // 行内出现的壳标签（罕见）→ 只删标签本身
        if (/<\/?(Block|Row)\b/.test(trimmed)) {
            out.push(
                line
                    .replace(/<\/?(Block|Row)\b[^>]*?\/?>/g, '')
                    .replace(/\s+$/, ''),
            );
            continue;
        }
        out.push(line);
    }

    // 连续空行压成一个
    return out
        .filter((l, i, arr) => {
            if (l.trim()) return true;
            return !(i > 0 && !arr[i - 1].trim());
        })
        .join('\n');
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
    const ids = new Set();
    for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) ids.add(m[0]);
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

    for (const path of paths) {
        const sf = program.getSourceFile(path);
        if (!sf) continue;
        const src = readFileSync(path, 'utf8');
        const file = relative(ROOT, path).replace(/\\/g, '/');

        // ── 预扫整个文件，收集「模块级 import」与「模块级声明」 ──
        // 示例里写死的 PAYMENT_OPTIONS 这类常量都挂在模块级，函数体内抓不到，
        // 必须从这个表里按引用关系捞回来，否则文档示例自顾不全（读者抄走跑不起来）。
        /** @type {{names:string[], text:string}[]} */
        const topImports = [];
        /** @type {{names:string[], text:string}[]} */
        const topDecls = [];
        sf.forEachChild((node) => {
            if (ts.isImportDeclaration(node)) {
                topImports.push({
                    names: collectImportNames(node),
                    text: src.slice(node.getStart(sf), node.getEnd()),
                });
            } else if (isTopLevelDecl(node)) {
                topDecls.push({
                    names: declNames(node, sf),
                    text: src.slice(node.getStart(sf), node.getEnd()),
                });
            }
        });

        // 示例引用到的标识符 → 命中即视为「需要这个顶层声明 / import」
        const referenced = (text) => {
            const ids = collectIdentifiers(text);
            const declHits = topDecls.filter((d) =>
                d.names.some((n) => ids.has(n)),
            );
            const importHits = topImports.filter((imp) =>
                imp.names.some((n) => ids.has(n)),
            );
            return { ids, declHits, importHits };
        };

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
                ),
            )
                .replace(/^\(|\)$/g, '')
                .trim();

            // ③ consts：示例引用到的「模块级声明」，做传递闭包
            //    （某个常量又引用另一个模块级常量时一并捞回）
            const { ids, declHits, importHits } = referenced(
                `${setup}\n${code}`,
            );
            const needed = new Set(
                declHits.flatMap((d) => d.names),
            );
            let changed = true;
            while (changed) {
                changed = false;
                for (const d of topDecls) {
                    if (!d.names.some((n) => needed.has(n))) continue;
                    for (const n of d.names) needed.add(n);
                    for (const id of collectIdentifiers(d.text)) {
                        if (!needed.has(id)) {
                            needed.add(id);
                            changed = true;
                        }
                    }
                }
            }
            const consts = topDecls
                .filter((d) => d.names.some((n) => needed.has(n)))
                .map((d) => dedent(d.text))
                .join('\n\n');

            // ④ imports：示例直接引用到的 import 语句（含 React 命名空间等）
            const imports = importHits
                .map((imp) => imp.text)
                .join('\n');

            result[name] = { file, setup, code, consts, imports };
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
