import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Bivane 官网（apps/web）
 *
 * 与 apps/docs 同构的独立 Vite 应用：
 *  - 复用仓库根 node_modules（Vite 向上找）
 *  - `@` 别名指向仓库根，直接 import components/ hooks/ lib/ demos/
 *  - base: '/bivane/' —— 与 registry 同站（zciyi.github.io/bivane），路径不冲突
 *  - 构建产物落在 apps/web/dist
 */
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: '/bivane/',
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('../..', import.meta.url)),
        },
    },
    server: {
        port: 5172,
        host: true,
    },
    build: {
        outDir: fileURLToPath(new URL('./dist', import.meta.url)),
        emptyOutDir: true,
        // 官网单页要演示多个组件，bundle 天然偏大；阈值是噪声地板，不是预算。
        chunkSizeWarningLimit: 1200,
    },
});
