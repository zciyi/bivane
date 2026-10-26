import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  server: {
    port: 5170,
    host: true,
  },
  build: {
    /**
     * dist 是**验证台**产物（src/App.tsx 把所有组件都挂了一遍），不是要发布的
     * 应用 —— copy-paste 分发形态下消费者只装自己用到的组件，不会拿到这个 bundle。
     * 因此 vite 默认的 500 kB 建议阈值在这里没有指导意义：它对「单页演示」提不出
     * 可执行的拆分动作，只会在第 4 门（stderr 必须为空）里制造常驻噪声。
     *
     * 这个阈值是**噪声地板**，不是预算：每加一批组件演示，单页 bundle 就实打实涨一截
     * （450 → 518 引入 react-day-picker；→ 712 挂上 P3 的 Rate/Slider 等；
     * → 807.64 P3 表单与列表补齐后），
     * 越线就把地板抬到当前实际尺寸之上，保持「stderr 为空」这条门禁仍然只抓真警告
     * （缺 CSS 导入、解析失败之类），而不是抓一个必然增长的演示包体积。
     */
    chunkSizeWarningLimit: 850,
  },
  test: {
    environment: 'jsdom',
    // 为什么不用默认的 forks/threads：这两个 pool 下 setup 文件里 `import { beforeEach }
    // from 'vitest'` 拿到的模块实例与 worker 内部 populate 的那个不是同一份，
    // 于是每个文件都在 setup 第一行抛 "Vitest failed to find the runner"（45/45 全挂，
    // 且 jsdom 环境被重复创建 45 次、128s 才失败）。
    // vmThreads 让测试文件与 worker 共用同一模块图，runner 正常注入；
    // 顺带把环境创建从「每文件一次」降为「每 worker 一次」，全套从 128s 降到 ~12s。
    pool: 'vmThreads',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
