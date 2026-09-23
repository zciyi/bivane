/**
 * Bivane registry 构建脚本
 *
 * 读取 packages/registry/registry.json，把每个 item 的源文件内容内联，
 * 产出 shadcn CLI 可直接消费的 packages/registry/r/<name>.json。
 *
 * 与官方 `shadcn build` 行为保持一致：CLI 拉取 r/<name>.json 后按 files[].target 落盘，
 * 并依据 registryDependencies 递归安装依赖项，因此安装 @bivane/date-picker 会自动
 * 带上 h5/、pc/ 两份实现与 use-device-mode 等公共依赖。
 *
 * 用法：npm run registry:build
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = join(ROOT, 'packages/registry/registry.json');
const OUT_DIR = join(ROOT, 'packages/registry/r');

/** registry item 名 -> 官方 schema 类型（保持一致） */
const ITEM_SCHEMA = 'https://ui.shadcn.com/schema/registry-item.json';

/** 本 registry 的命名空间。内部依赖必须写成 `<NS>/<name>`，见下方 resolveDep 注释。 */
const NAMESPACE = '@bivane';

/**
 * 把 registry.json 里的内部依赖名规范化成 shadcn CLI 认得的形式。
 *
 * 为什么不能是 `<name>.json`：
 * shadcn 的 `isLocalFile(p)` 判定是 `p.endsWith('.json') && !isUrl(p)`，
 * 命中后它会把依赖当成**消费者项目 cwd 下的相对文件**去读 →
 * `Failed to read local registry file: use-device-mode.json`（ENOENT）。
 *
 * 裸名（如 `use-device-mode`）更糟：`buildUrlAndHeadersForRegistryItem` 会把无命名空间的
 * 名字兜给内置的 `@shadcn` 源（`ui.shadcn.com/r/styles/<style>/<name>.json`）→ 取到官方同名件或 404。
 *
 * 唯一正确的写法是命名空间形式，消费者在 components.json 里配
 * `"registries": { "@bivane": "https://<host>/r/{name}.json" }` 即可解析。
 * 绝对 URL 也允许原样保留（免配置，但换域名要改所有产物）。
 */
function resolveDep(dep) {
  if (dep.startsWith('http') || dep.startsWith('@')) return dep;
  return `${NAMESPACE}/${dep}`;
}


async function buildItem(item) {
  const files = [];

  for (const file of item.files ?? []) {
    const source = join(ROOT, file.path);
    let content;
    try {
      content = await readFile(source, 'utf8');
    } catch {
      throw new Error(`[registry] 文件不存在：${file.path}（item: ${item.name}）`);
    }

    files.push({
      path: file.path,
      content,
      type: file.type,
      target: file.target ?? file.path,
    });
  }

  return {
    $schema: ITEM_SCHEMA,
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies ?? [],
    devDependencies: item.devDependencies ?? [],
    registryDependencies: (item.registryDependencies ?? []).map(resolveDep),
    files,
  };
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
  const items = manifest.items ?? [];

  if (items.length === 0) throw new Error('[registry] registry.json 中没有任何 item');

  await mkdir(OUT_DIR, { recursive: true });

  const names = new Set(items.map((item) => item.name));
  for (const item of items) {
    for (const dep of item.registryDependencies ?? []) {
      // 外链与已带命名空间的依赖不参与本地校验，其余必须能在清单里找到。
      if (dep.startsWith('http') || dep.startsWith('@')) continue;
      if (!names.has(dep)) {
        throw new Error(`[registry] item "${item.name}" 引用了不存在的依赖 "${dep}"`);
      }
    }
  }

  for (const item of items) {
    const built = await buildItem(item);
    await writeFile(join(OUT_DIR, `${item.name}.json`), `${JSON.stringify(built, null, 2)}\n`, 'utf8');
    console.log(`[registry] ✓ ${item.name}.json（${built.files.length} 个文件）`);
  }

  console.log(`[registry] 完成：${items.length} 个 item -> packages/registry/r/`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
