import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      // ⚠ 用 **/dist/** 而不是 dist/** ——
      //    根 dist（验证台产物）之外的 apps/docs/dist（文档站产物）
      //    也要排除，否则打包后的 minified bundle 会被当源码 lint，
      //    一次刷出几千个 no-undef / no-unused-expressions 假错。
      '**/dist/**',
      'packages/registry/r/**',
      'scripts/_install_deps.py',
      // 与 .gitignore 对齐：视觉验证的输出目录不属于源码，不应参与 lint。
      // 曾因把参考源码（Vant 的 popup.tsx）临时下载到 .visual/ 而让 lint 报 6 个假错。
      '.visual/**',
      '.chrome-profile*/**',
      // 临时工作目录：重构过程中的中间产物与截图。
      // 不排除的话，里面的旧版源码会被 lint 一次刷出几千个假错
      // （与 .visual/ 当初的情况同源）。
      '.tmp/**',
      // 第 8 门的夹具项目同理：它是「消费者侧」的产物（含 dist/ 构建输出），
      // 不属于本仓库源码。漏了这条会被夹具的 bundle 一次刷出上百个假错
      // （no-undef / no-unused-expressions），看起来像组件库挂了。
      '.consumer-check/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // 架构文档约定：禁用 any
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // 强制契约：组件样式只走 Tailwind + token，内联 style 仅允许动态值
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='style'] Property > Literal",
          message:
            '禁止内联 style 中的字面量样式，请改用 Tailwind 类或 token（架构文档 §4 第 4 条）',
        },
      ],
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
