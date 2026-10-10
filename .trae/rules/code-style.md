---
description: Bivane 代码风格与格式硬性规则。编写或修改任何源文件时必须遵守。
globs:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs,json,css,html}"
---

# 代码风格规则

## 1. 缩进：一律 2 个空格（最高优先级）

- 所有源文件（`.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` `.json` `.css` `.html`）**统一使用 2 个空格缩进**，禁止 Tab，禁止 4 空格缩进。
- **新增代码、编辑现有代码都必须保持 2 空格**。Edit 文件时若发现局部是 4 空格的历史遗留块，顺手把该文件/该块统一为 2 空格（只改缩进，不夹带其他改动）。
- 续行对齐跟随 2 空格体系：每深一个层级 +2 空格；括号续行按语法自然对齐，不要回退到 4 空格。
- 换行符 LF，文件末尾保留一个空行，行尾无尾随空格（`.md` 例外：行尾两空格是 Markdown 换行语法）。
- 不要使用格式化工具大范围 reflow（项目未引入 Prettier）；只做缩进统一，引号/分号/换行风格维持文件原貌。

## 2. 生成物不要手改

以下文件/目录由脚本生成，改了也会被覆盖；需要变更时改源头再跑生成命令：

- `packages/registry/r/**` —— 源是 `packages/registry/registry.json` 与它引用的组件文件，改后执行 `npm run registry:build`
- `bivane-demo.html`、`dist/**` —— 构建产物

## 3. 既有质量门

改动后按需运行（禁止自主执行 `npm run build` 或启动 dev server，需用户明确许可）：

- 类型检查：`npx tsc --noEmit`（可自行执行）
- Lint：`npx eslint .`
- 测试：`npx vitest run`
