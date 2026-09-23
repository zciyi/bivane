# Bivane /baɪˈveɪn/ · 碧帆

**一套 API，两端各得其所。** One API. Screen-aware.

以 [Vant](https://vant-ui.github.io/vant/) 的设计语言为视觉源，用 React + Tailwind CSS 重写的**双端自适应**组件库，以 shadcn copy-paste 形态分发：

- 小屏走 H5 交互（底部弹层、滚轮选择、手势）
- 大屏走 PC 交互（锚定浮层、日历面板、键盘导航）
- **两套交互共用同一份 props**，唯一逃生舱是 `forceMode`

> Design language inspired by Vant (Youzan). 本项目与有赞官方无关，仅复刻其视觉规格与交互模式；不使用 "Vant" 作为包名、品牌或组件名。

📖 **在业务代码里怎么用 → [USAGE.md](./USAGE.md)** —— 每个组件的可复制用法、prop 说明与两端差异，代码取自正在跑的验证台。

## 状态

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | token 层 / 模式判定 / Button · Cell · CellGroup · Tag · Badge · Icon | ✅ 已完成 |
| P1 | 弹层地基（portal · imperative-host · overlay · 滚动锁 · 手势）+ **Popup · Dialog · Toast** | ✅ 已完成 |
| P1′ | ActionSheet · Alert/Confirm · Notify · Loading | ⬜ 待做 |
| P2 | **Select** ✅ · **DropdownMenu** ✅ · **DatePicker** ✅ · TimePicker · Picker · Calendar · Tooltip · Popover | 🔄 进行中（3/8） |
| P3 | 表单类 · Uploader · Search · Tabs · List/Table | ⬜ 待开始 |
| P4 | 多风格 · tweakcn 适配 · 文档站 · registry 发布 | ⬜ 待开始 |

> P1′ 的组件都是已件的 preset（ActionSheet ≈ Popup + 选项列表；Alert ≈ Dialog 去掉输入区；Notify ≈ Toast 换定位与信息模型），弹层地基已就绪，属于增量而非新建。

## 快速开始

```bash
npm install
npm run dev              # 验证台（缩放窗口即可看到 H5 / PC 模式切换）
npm run check            # typecheck + lint + test
npm run measure          # 真实浏览器读 computed style（token 是否真的落到样式上）
npm run registry:build   # 生成 packages/registry/r/*.json
```

## 目录结构

```
bivane/
├── components/
│   ├── responsive/        # ⭐ 自适应组件入口（按模式分发到 h5 / pc）
│   ├── h5/                # 小屏实现（手势、滚轮、底部弹层）
│   ├── pc/                # 大屏实现（锚定浮层、日历面板、键盘导航）
│   ├── ui/                # 无交互差异的共用件（含 overlay、toast-parts）
│   └── providers/         # ResponsiveProvider
├── hooks/                 # use-device-mode / use-lock-scroll / use-drag-to-dismiss / 各 *-store
├── lib/                   # cn()（含 bv-* 的 tailwind-merge 注册）、portal、imperative-host
├── packages/
│   ├── registry/          # registry.json + r/*.json（构建产物）
│   └── tokens/styles/     # --bv-* token：vant · vant-dark · modes · utilities · theme
├── scripts/               # registry 构建、浏览器测量、视觉验证
└── tests/                 # vitest，含 matchMedia 双模式模拟
```

**`packages/tokens/styles/` 里每个文件都有存在理由，缺一个就会静默失效**：

| 文件 | 作用 | 缺了会怎样 |
|---|---|---|
| `vant.css` | `--bv-*` 变量实际值（Vant 4 校准） | 变量未定义 |
| `vant-dark.css` | `.bv-theme-dark` 深色覆盖 | 无深色主题 |
| `modes.css` | 随 `data-mode` 变化的变量（遮罩、圆角、时长、页面节奏） | 两端视觉无差异 |
| `utilities.css` | 安全区、弹层动画原子层 | 刘海屏遮挡、动画不跑 |
| `theme.css` | `@theme inline` 映射 + `bv-h5:`/`bv-pc:` 变体 + 基础层 | **所有 `bg-bv-*` 工具类不生成** |

## 核心机制

**模式判定**（`hooks/use-device-mode.ts`，判定优先级从高到低）

```
1. 组件 forceMode prop           ← 逃生舱
2. <ResponsiveProvider mode>     ← 文档站 / 测试
3. 自动判定：width < 768px 或 (pointer: coarse && hover: none)
```

SSR / 首屏默认渲染 `desktop`，挂载后一帧内切换，避免 hydration mismatch。

**三种落地模式**（判定原则：能 A 不 B，能 B 不 C）

| 模式 | 含义 | 举例 |
|---|---|---|
| A | 纯 CSS 差异，不进 JS | Button 尺寸、Cell 行高与 hover |
| B | 同一 primitive，换渲染壳 | Dialog：PC 居中弹窗 / H5 底部抽屉 |
| C | 双实现，共享逻辑下沉 hooks | Toast：PC 通知栈 / H5 单例胶囊 |

**token 一致性**：组件只引用 `--bv-*` 语义 token（色板与尺寸取自 Vant 4 源码 `css-variables.less` 及各组件 `index.less`），换风格只需替换 token 文件，组件代码零改动。

## 质量门

| 门 | 命令 | 当前状态 |
|---|---|---|
| 1 类型 | `npm run typecheck` | ✅ 0 error |
| 2 规范 | `npm run lint` | ✅ 0 error 0 warning |
| 3 测试 | `npm run test` | ✅ 288 passed / 17 文件（双模式各一组） |
| 4 构建 | `npm run build` | ✅ token 工具类正常产出，0 CSS warning |
| 5 CSS 产物 | 在 `dist/assets/*.css` 里搜工具类名与槽名 | ✅ 工具类与动画选择器真的被生成 |
| 6 数值 | `npm run measure` | ✅ CDP 读 computed style，PC / H5 各一次 |
| 7 视觉/交互 | `node scripts/visual-check.mjs` | ✅ CDP 交互后截图 + 读计算值，两种模式各一次 |
| 8 分发完整性 | 核对 `r/tokens.json` 覆盖 `tokens/styles/` 全部 CSS | ✅ 5/5 |
| 9 消费者实测 | `npm run consumer:check` | ✅ 空白项目跑真实 registry 安装 + 消费者侧 tsc/build |

> 后五门都来自真实事故。前车之鉴：遮罩全透明、漏带 `data-mode`、槽名与动画选择器不一致——三个缺陷**全部通过**了 `tsc` + `eslint` + 120 个 vitest 用例 + `vite build`。类型系统与 jsdom 都不做 CSS 级联，只有查产物和看浏览器才能发现。
>
> DatePicker 又一次印证了这条：区间模式打开时滚轮停在「今年 1 月 1 日」而不是今天（单值形态因为分发层预填了今天而完全看不出来），**它通过了类型、规范、288 个单测与静态 CSS 核对**，只在真机探针里露头（月 = 01、日 = 01）。更值得记的是当时那份单测**在为错误行为背书**——断言写的是实现的行为而不是期望的行为。已修，并把「无值 → 落到今天」写成正向断言。
>
> 而 `consumer:check` 补的是另一个盲区：registry 的价值在于**文件复制到别人项目里还能跑**。曾经的 `registryDependencies` 被构造成 `<name>.json`，被 shadcn 的 `isLocalFile()` 当成消费者目录下的本地文件，安装直接 ENOENT——而仓库内七道门全绿，因为它从不跨出本仓库。

## 安装（registry）

Bivane 不是官方源，**必须先声明命名空间**，否则 `shadcn add @bivane/*` 会报 Unknown registry：

```json
// components.json
{
  "registries": {
    "@bivane": "https://bivane.dev/r/{name}.json"
  }
}
```

```bash
# 1) 先装 token —— 这一步不能省，组件全靠它
npx shadcn@latest add @bivane/tokens

# 2) 再装组件（自动递归带上依赖的 hooks / ui 件）
npx shadcn@latest add @bivane/dialog
```

然后在项目的 `globals.css` 里按序引入（路径相对 globals.css；项目有 `src/` 时 token 落在 `src/styles/bivane/`）：

```css
@import 'tailwindcss';
@import './styles/bivane/vant.css';
@import './styles/bivane/vant-dark.css';   /* 可选，深色主题 */
@import './styles/bivane/modes.css';
@import './styles/bivane/utilities.css';
@import './styles/bivane/theme.css';       /* ← 缺了它组件会全部失色 */
```

发布前本地验证（会在空白项目里真的走一遍上面的流程）：

```bash
npm run registry:build
npm run consumer:check
```

运行时依赖只有 9 个：`react` · `react-dom` · `clsx` · `tailwind-merge` · `class-variance-authority` · `@radix-ui/react-dialog`（仅 PC 模态用） · `@radix-ui/react-popover`（仅 PC 浮层用） · `@radix-ui/react-dropdown-menu`（仅 PC 菜单用） · `react-day-picker`（仅 PC 月历引擎用）。手势、滚动锁、虚拟滚动均为自研，不引第三方。

> 组件的可复制用法、prop 说明与两端差异见 [USAGE.md](./USAGE.md)。

## 许可

MIT
