import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * Bivane 文档站（apps/docs）
 *
 * 独立 Vite 应用，但**不装任何新依赖**：
 *  - 复用仓库根的 node_modules（Vite 会向上找）
 *  - `@` 别名指向**仓库根**，因此能直接 import components/ hooks/ demos/
 *  - 路由是手写的 hash 路由（不引 react-router —— 运行时依赖白名单不能破）
 *
 * 构建产物落在 apps/docs/dist，与根目录的 dist（验证台）互不干扰。
 */
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('../..', import.meta.url)),
        },
    },
    server: {
        port: 5171,
        host: true,
    },
    build: {
        outDir: fileURLToPath(new URL('./dist', import.meta.url)),
        emptyOutDir: true,
        // 文档站要展示全部组件，单页 bundle 天然偏大；
        // 这个阈值是噪声地板（同根 vite.config.ts 的说明），不是预算。
        chunkSizeWarningLimit: 1200,
    },
});
