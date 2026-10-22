#!/usr/bin/env node
/**
 * Bivane · props 元数据自动提取
 *
 * 为什么自动提取：组件的 props 接口都带 JSDoc 说明（例：
 * `/** 按钮类型，默认 default *\/`）。文档站若手写 props 表，
 * 源码改了表不会跟着改 —— 文档与实现漂移，且漂移是静默的。
 * 所以这里从 **TypeScript 源码**里抽，产出 props.generated.json。
 *
 * 抽取内容（每个字段）：
 *  - name        字段名
 *  - type        类型文本（简化：去掉 React. 前缀、联合类型排版）
 *  - optional    是否可选
 *  - description JSDoc 说明（多行合并成一行）
 *  - default     组件实现里的解构默认值（`{ type = 'default' }`）
 *  - kind        'prop' | 'event' —— 文档站据此拆成两张表
 *
 * 用法：
 *   node scripts/extract-props.mjs            # 写入 apps/docs/src/props.generated.json
 *   node scripts/extract-props.mjs --check    # 只校验是否与源码一致（CI 用）
 *
 * 为什么用 TypeScript 编译器 API 而不是正则：
 *   正则分不清 `type?: 'a' | 'b'` 与注释里的冒号，也拿不到
 *   `extends Omit<...>` 的继承关系 —— 而这两处正是 props 表最容易错的地方。
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'apps/docs/src/props.generated.json');

/** 递归列出目录下的 .ts / .tsx 文件 */
function listSources(dir) {
    const out = [];
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) out.push(...listSources(full));
        else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full);
    }
    return out;
}

/** 简化类型文本：去 React. 前缀、把多行联合类型压成一行 */
function simplifyType(node, checker) {
    let text = checker.typeToString(node);
    text = text.replace(/\bReact\./g, '');
    text = text.replace(/\s*\|\s*/g, ' | ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

/**
 * 取 JSDoc 注释（多行合并成一行）。
 *
 * AST 节点本身没有 getSymbol()（那是 Symbol 的方法）——
 * 得让 checker 按名字节点反查符号。
 */
function jsdocOf(member, checker) {
    if (!member.name) return '';
    const sym = checker.getSymbolAtLocation(member.name);
    if (!sym) return '';
    const parts = sym.getDocumentationComment(checker);
    if (!parts) return '';
    return parts
        .map((p) => p.text)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * 从组件实现里找解构默认值。
 *
 * 模式：`function Button({ type = 'default', size, plain = false })`
 * 或 `({ type = 'default' }: ButtonProps) => ...`
 * 用 AST 找 ObjectBindingPattern 的每个元素，取 initializer 的源码文本。
 */
function collectDefaults(sourceFile) {
    const defaults = new Map();
    const visit = (node) => {
        if (
            ts.isVariableDeclaration(node) &&
            node.initializer &&
            ts.isObjectBindingPattern(node.initializer)
        ) {
            for (const el of node.initializer.elements) {
                if (!el.initializer) continue;
                const name = el.name.getText(sourceFile);
                if (ts.isIdentifier(el.name)) {
                    defaults.set(name, el.initializer.getText(sourceFile));
                }
            }
        }
        // 解构参数：function Button({ type = 'default' }) ——
        // 绑定模式是 node.name 本身，不是 node.initializer
        if (ts.isParameter(node) && ts.isObjectBindingPattern(node.name)) {
            for (const el of node.name.elements) {
                if (!el.initializer) continue;
                if (ts.isIdentifier(el.name)) {
                    defaults.set(el.name.getText(sourceFile), el.initializer.getText(sourceFile));
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return defaults;
}

/** 收集一个接口（含 extends 的父接口）里声明的成员 */
function collectMembers(decl, checker) {
    const members = [];
    for (const clause of decl.heritageClauses ?? []) {
        for (const type of clause.types) {
            // ⚠ 继承自 **React DOM 类型**的成员（extends React.TextareaHTMLAttributes 之类）
            //    不进 props 表：那是几百个内置 HTML/ARIA 属性（aria-relevant 的联合类型
            //    能有 170 多个字符），对读者零信息量，还会把生成物撑到几百 kB。
            //    只保留**本库自己**的基接口（如 ActionSheetOptions）继承来的成员。
            const baseText = type.expression.getText();
            if (/^React\.|^Omit<\s*React\.|^Partial<\s*React\./.test(baseText)) continue;

            // 用 symbol 解析基接口：checker.getTypeAtLocation 对接口引用
            // 拿到的不是「声明类型」，成员会漏。
            let baseSym = checker.getSymbolAtLocation(type.expression);
            if (!baseSym) continue;
            // 跨文件继承时，符号往往是个 **import 别名**（Alias flag），
            // 得先解析成真正的声明符号，否则取到的类型是空的。
            if (baseSym.flags & ts.SymbolFlags.Alias) {
                baseSym = checker.getAliasedSymbol(baseSym);
            }
            const base = checker.getDeclaredTypeOfSymbol(baseSym);
            for (const prop of base.getProperties()) {
                const declNode = prop.declarations?.[0];
                if (!declNode) continue;
                const name = prop.getName();
                if (members.some((m) => m.name === name)) continue;
                members.push({
                    name,
                    type: simplifyType(checker.getTypeOfSymbolAtLocation(prop, declNode), checker),
                    optional: Boolean(prop.flags & ts.SymbolFlags.Optional),
                    description: jsdocOf(declNode, checker),
                    inherited: true,
                });
            }
        }
    }
    for (const member of decl.members) {
        if (!ts.isPropertySignature(member)) continue;
        const name = member.name.getText();
        if (name.startsWith("'") || name.startsWith('"')) continue; // 字符串字面量键
        members.push({
            name: name.replace(/^['"]|['"]$/g, ''),
            type: member.type
                ? simplifyType(checker.getTypeAtLocation(member.type), checker)
                : 'unknown',
            optional: Boolean(member.questionToken),
            description: jsdocOf(member, checker),
            inherited: false,
        });
    }
    return members;
}

/**
 * 把 prop 分成「属性」与「事件」两类。
 *
 * 为什么要分：Ant Design / Element 都把 `onChange` 这类回调单列成「事件」表。
 * 混在一张表里时，1197 个属性会把 228 个事件淹掉 ——
 * 而使用者十有八九是冲着「这个组件能回调什么」来的。
 *
 * 判据（两条都要满足才算事件）：
 *  1. 名字形如 `onXxx`（首字母 on + 大写）
 *  2. 类型是函数 —— 写成 `(a) => void` 或 `XxxEventHandler<...>`
 *     （React 的 `FocusEventHandler` / `MouseEventHandler` 这类别名也算）
 */
function classifyKind(name, type) {
    if (!/^on[A-Z]/.test(name)) return 'prop';
    const isFunctionType =
        type.includes('=>') || /Handler\s*[<(]/.test(type);
    return isFunctionType ? 'event' : 'prop';
}

/** 主流程 */
export function extractProps() {
    // components/ 与 hooks/ 都要扫：
    // 不少组件的 props 是 `interface XxxProps extends XxxOptions`，
    // 而 XxxOptions 定义在 hooks/ 下（如 ActionSheetOptions）。
    const files = [
        ...listSources(join(ROOT, 'components')),
        ...listSources(join(ROOT, 'hooks')),
    ];
    const program = ts.createProgram(files, {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        jsx: ts.JsxEmit.ReactJSX,
        skipLibCheck: true,
        noEmit: true,
        // ⚠ 必须配 `@/*` 路径别名：组件之间靠它互相 import。
        //    不配的话跨文件继承的符号解析成 "unknown"，
        //    继承来的 props 会**整批丢失**（症状：ActionSheetProps 只剩 3 个字段）。
        baseUrl: ROOT,
        paths: { '@/*': ['./*'] },
    });
    const checker = program.getTypeChecker();

    /** @type {Record<string, {file: string, props: any[]}>} */
    const result = {};

    for (const file of files) {
        const sourceFile = program.getSourceFile(file);
        if (!sourceFile) continue;
        const defaults = collectDefaults(sourceFile);

        sourceFile.forEachChild((node) => {
            if (!ts.isInterfaceDeclaration(node)) return;
            if (!node.name.text.endsWith('Props')) return;
            // 跳过明显的内部件（Render / Parts / Panel 之类的下划线命名约定）
            if (/Props$/.test(node.name.text) === false) return;

            const members = collectMembers(node, checker);
            if (members.length === 0) return;

            const props = members.map((m) => ({
                name: m.name,
                type: m.type,
                optional: m.optional,
                description: m.description,
                default: defaults.get(m.name) ?? null,
                inherited: m.inherited,
                kind: classifyKind(m.name, m.type),
            }));

            result[node.name.text] = {
                file: relative(ROOT, file).replace(/\\/g, '/'),
                props,
            };
        });
    }

    return result;
}

function main() {
    const data = extractProps();
    const json = JSON.stringify(data, null, 2) + '\n';

    if (process.argv.includes('--check')) {
        if (!existsSync(OUT)) {
            console.error(`✗ ${relative(ROOT, OUT)} 不存在，请先跑 npm run docs:props`);
            process.exit(1);
        }
        const current = readFileSync(OUT, 'utf8');
        if (current !== json) {
            console.error(
                `✗ props.generated.json 与源码不一致（${Object.keys(data).length} 个接口）—— ` +
                    `请跑 npm run docs:props 重新生成`,
            );
            process.exit(1);
        }
        console.log(`✓ props 元数据与源码一致（${Object.keys(data).length} 个接口）`);
        return;
    }

    // --stdout：只把结果打到标准输出，**不写盘**。
    // 测试用它做「生成物是否与源码一致」的校验 —— 写盘的话测试会与
    // 其它并行测试产生竞态（一个在写、另一个在读同一个文件）。
    if (process.argv.includes('--stdout')) {
        process.stdout.write(json);
        return;
    }
    writeFileSync(OUT, json, 'utf8');
    const total = Object.values(data).reduce((n, d) => n + d.props.length, 0);
    const documented = Object.values(data).reduce(
        (n, d) => n + d.props.filter((p) => p.description).length,
        0,
    );
    const percent = Math.floor((documented * 100) / Math.max(total, 1));
    console.log(
        `✓ 已写入 ${relative(ROOT, OUT)}：${Object.keys(data).length} 个接口 / ${total} 个字段` +
            `（${documented} 个有说明，${percent}%）`,
    );
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    main();
}
