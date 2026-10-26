/**
 * 发布 Bivane registry 到 GitHub Pages。
 *
 * 机制：shadcn registry 就是一组静态 JSON。消费者在 components.json 声明
 *   { "registries": { "@bivane": "https://zciyi.github.io/bivane/r/{name}.json" } }
 * 后跑 `npx shadcn add @bivane/<x>`，shadcn 按 {name} 逐级拉取整棵依赖树。
 * 本脚本把 `packages/registry/r/*.json` 整体托管到 GitHub Pages：
 *   registry:build → 建 orphan 分支 registry-pages（根目录只含 r/）→ 强制推送 github 远程。
 *
 * GitHub Pages 一开（Settings → Pages → branch registry-pages / root）后随 push 自动部署，无需每次手动。
 *
 * 用法：
 *   npm run registry:publish                                    # 用本地已存的 git 凭据推送
 *   GITHUB_TOKEN=xxxx npm run registry:publish                  # 用 PAT 注入 HTTPS 凭据
 *   GITHUB_USER=other GITHUB_REPO=bivane npm run registry:publish  # 覆盖仓库坐标（GitHub 用户名/仓库名）
 *
 * 默认坐标取自 GITHUB_USER/GITHUB_REPO 环境变量，回落到 zciyi/bivane。
 * 若你的 GitHub handle 不是 zciyi，必须显式传 GITHUB_USER，否则 URL 会写错。
 *
 * ⚠ 本环境无法替你建 GitHub 仓库 / 登录 / 点 Pages 启用按钮——那些是你网页端的动作。
 *   本脚本只负责「构建 + 推送到正确分支」，其余交给你。
 */

import { spawnSync } from 'node:child_process';
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R_DIR = join(ROOT, 'packages/registry/r');
const BRANCH = 'registry-pages';
const GITHUB_USER = process.env.GITHUB_USER || 'zciyi';
const GITHUB_REPO = process.env.GITHUB_REPO || 'bivane';
const REMOTE = process.env.GITHUB_REMOTE || 'github';
const TOKEN = process.env.GITHUB_TOKEN;
const BASE_URL = `https://${GITHUB_USER}.github.io/${GITHUB_REPO}/r/{name}.json`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: opts.cwd ?? ROOT, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    throw new Error(`命令失败 (exit ${r.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function main() {
  if (!existsSync(R_DIR)) {
    throw new Error(`registry 产物不存在：${R_DIR}（先跑 npm run registry:build）`);
  }

  console.log('[publish] 1/5 构建 registry（确保发出的是最新源码，不是旧内联）');
  sh('node', [join(ROOT, 'scripts/build-registry.mjs')]);

  const worktree = join(tmpdir(), 'bivane-registry-pages');
  await rm(worktree, { recursive: true, force: true });
  sh('git', ['worktree', 'prune']);

  console.log(`[publish] 2/5 准备 worktree（分支 ${BRANCH}）`);
  const branchList = spawnSync('git', ['branch', '--list', BRANCH], { cwd: ROOT, encoding: 'utf8' });
  const addArgs = branchList.stdout.includes(BRANCH)
    ? ['worktree', 'add', worktree, BRANCH]
    : ['worktree', 'add', '-b', BRANCH, worktree];
  sh('git', addArgs);

  // 清空 worktree 全部已跟踪文件，只放 r/（GitHub Pages 站点根 = 分支根，故 r/ 落在 /r/）
  console.log('[publish] 3/5 写入 r/ 到分支根');
  sh('git', ['rm', '-rf', '.'], { cwd: worktree });
  const destR = join(worktree, 'r');
  await mkdir(destR, { recursive: true });
  const items = await readdir(R_DIR);
  for (const it of items) {
    await cp(join(R_DIR, it), join(destR, it), { recursive: true });
  }
  sh('git', ['add', 'r'], { cwd: worktree });
  const commit = spawnSync('git', ['commit', '-m', 'registry: publish r/ (auto)'], {
    cwd: worktree,
    encoding: 'utf8',
  });
  if (commit.status !== 0) {
    console.log('[publish]   无内容变化，跳过提交（强制推送仍会同步分支指针）');
  }

  // 确定推送目标：带 TOKEN 直接推 URL；否则确保 REMOTE 存在后推远程名
  let pushTarget;
  if (TOKEN) {
    pushTarget = `https://${GITHUB_USER}:${TOKEN}@github.com/${GITHUB_USER}/${GITHUB_REPO}.git`;
  } else {
    const remotes = (spawnSync('git', ['remote'], { cwd: ROOT, encoding: 'utf8' }).stdout || '')
      .split(/\s+/)
      .filter(Boolean);
    if (!remotes.includes(REMOTE)) {
      sh('git', ['remote', 'add', REMOTE, `https://github.com/${GITHUB_USER}/${GITHUB_REPO}.git`]);
    }
    pushTarget = REMOTE;
  }

  console.log(`[publish] 4/5 强制推送 ${BRANCH} 到 ${pushTarget}`);
  sh('git', ['push', '--force', pushTarget, `${BRANCH}:${BRANCH}`], { cwd: worktree });

  console.log('[publish] 5/5 清理 worktree');
  sh('git', ['worktree', 'remove', '--force', worktree]);

  console.log('\n========== 完成 ==========');
  console.log(`registry URL：${BASE_URL}`);
  console.log('\n下一步（需你网页端手动，脚本替代不了）：');
  console.log(`  1) GitHub 仓库 https://github.com/${GITHUB_USER}/${GITHUB_REPO} → Settings → Pages`);
  console.log('     Source 选 Deploy from a branch，Branch 选 registry-pages / (root)，点 Save');
  console.log('     （仅需开一次，之后每次 push 自动重新部署）');
  console.log(`  2) 验收：REGISTRY_BASE_URL="${BASE_URL}" npm run consumer:check`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
