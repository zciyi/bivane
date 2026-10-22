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

    /** @type {Record<string, {file: string, setup: string, code: string}>} */
    const result = {};

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
                ),
            )
                .replace(/^\(|\)$/g, '')
                .trim();

            result[name] = { file, setup, code };
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
