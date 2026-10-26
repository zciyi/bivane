/**
 * 本地静态托管 Bivane registry（packages/registry/r/），用于「发布验证」与本地预览。
 *
 * shadcn registry 本质就是一组静态 JSON：消费者在 components.json 把 registries 指向
 * `http://<host>/r/{name}.json`，就能跑真实的 `npx shadcn add @bivane/<x>`。
 * 本脚本让本仓库的 r/ 在本地可被任何消费者项目访问，复现文档里写的安装流程（把
 * `https://zciyi.github.io/bivane/r` 换成 `http://localhost:<port>/r`）。
 *
 * 用法：
 *   npm run registry:serve                 # 默认 4173
 *   node scripts/registry-serve.mjs --port 8080
 *
 * 输出会打印一份可直接粘进消费者 components.json 的 registries 片段。
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const R_DIR = join(ROOT, 'packages/registry/r');

function parseArgs(argv) {
  const out = { port: 4173 };
  for (let i = 0; i < argv.length; i += 1) {
    if ((argv[i] === '--port' || argv[i] === '-p') && argv[i + 1]) {
      const n = Number(argv[i + 1]);
      if (Number.isFinite(n)) out.port = n;
    }
  }
  return out;
}

if (!existsSync(R_DIR)) {
  console.error(`[registry:serve] 找不到 ${R_DIR}，请先跑 npm run registry:build`);
  process.exit(1);
}

const { port } = parseArgs(process.argv.slice(2));

const itemCount = readdirSync(R_DIR).filter((f) => f.endsWith('.json')).length;

const server = createServer((req, res) => {
  // 只允许读 r/ 下的 .json，防目录穿越
  const name = (req.url ?? '/').split('?')[0].replace(/^\/+/, '').replace(/\.json$/, '') + '.json';
  const file = join(R_DIR, name);
  if (!file.startsWith(R_DIR) || extname(file) !== '.json' || !existsSync(file)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', name }));
    return;
  }
  const body = readFileSync(file, 'utf8');
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${port}/r`;
  console.log(`[registry:serve] 托管 ${itemCount} 个 registry item：${R_DIR}`);
  console.log(`[registry:serve] 访问地址：${base}/{name}.json`);
  console.log('[registry:serve] 消费者 components.json 加入：');
  console.log(
    JSON.stringify({ registries: { '@bivane': `${base}/{name}.json` } }, null, 2),
  );
  console.log('[registry:serve] 然后即可跑：npx shadcn@latest add @bivane/select');
});
