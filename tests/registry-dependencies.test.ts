import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface RegistryFile {
    /** 相对项目根目录的源文件路径 */
    path: string;
    /** 发布条目内联的源码 */
    content?: string;
}

interface RegistryItem {
    /** 条目名称 */
    name: string;
    /** 条目包含的文件 */
    files?: RegistryFile[];
    /** 递归安装的内部依赖 */
    registryDependencies?: string[];
}

interface RegistryManifest {
    /** 全部发布条目 */
    items: RegistryItem[];
}

const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'packages/registry/registry.json'), 'utf8')) as RegistryManifest;
const items = new Map(manifest.items.map((item) => [item.name, item]));

function collectFiles(item: RegistryItem, seen = new Set<string>()): Set<string> {
    if (seen.has(item.name)) return new Set();
    seen.add(item.name);
    const files = new Set((item.files ?? []).map((file) => file.path));
    for (const name of item.registryDependencies ?? []) {
        const dependency = items.get(name);
        if (dependency) for (const file of collectFiles(dependency, seen)) files.add(file);
    }
    return files;
}

function runtimeImports(path: string): string[] {
    const source = ts.createSourceFile(path, readFileSync(join(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
    return source.statements.flatMap((statement) => {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
        const specifier = statement.moduleSpecifier.text;
        if (!specifier.startsWith('@/')) return [];
        const clause = statement.importClause;
        if (clause?.isTypeOnly) return [];
        if (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings)
            && clause.namedBindings.elements.every((entry) => entry.isTypeOnly)) return [];
        const target = specifier.slice(2);
        const resolved = [target, target + '.ts', target + '.tsx', target + '/index.ts', target + '/index.tsx']
            .find((candidate) => existsSync(join(root, candidate)));
        return resolved ? [resolved] : [target];
    });
}

describe('Registry 独立安装依赖契约', () => {
    it.each(manifest.items)('$name 的运行时内部导入均在依赖闭包中', (item) => {
        const files = collectFiles(item);
        const missing: string[] = [];
        for (const file of files) {
            if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
            for (const dependency of runtimeImports(file)) {
                if (!files.has(dependency)) missing.push(file + ' → ' + dependency);
            }
        }
        expect(missing).toEqual([]);
    });

    it.each(manifest.items)('$name 的发布依赖及内联源码与清单保持一致', (item) => {
        const published = JSON.parse(readFileSync(join(root, 'packages/registry/r', item.name + '.json'), 'utf8')) as RegistryItem;
        const expected = (item.registryDependencies ?? []).map((name) => name.startsWith('@') || name.startsWith('http') ? name : '@bivane/' + name);
        expect(published.registryDependencies).toEqual(expected);
        expect(published.files?.map((file) => file.path)).toEqual(item.files?.map((file) => file.path));
        for (const file of published.files ?? []) {
            const source = readFileSync(join(root, file.path), 'utf8');
            // checkout 的换行转换不属于发布源码漂移。
            expect(file.content?.replaceAll('\r\n', '\n')).toBe(source.replaceAll('\r\n', '\n'));
        }
    });
});
