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
  build: {
    /**
     * dist 是**验证台**产物（src/App.tsx 把所有组件都挂了一遍），不是要发布的
     * 应用 —— copy-paste 分发形态下消费者只装自己用到的组件，不会拿到这个 bundle。
     * 因此 vite 默认的 500 kB 建议阈值在这里没有指导意义：它对「单页演示」提不出
     * 可执行的拆分动作，只会在第 4 门（stderr 必须为空）里制造常驻噪声。
     * 引入 react-day-picker 后从 450 kB 涨到 518 kB，越过默认阈值即为此故。
     */
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
