# 项目长期约定（Bivane）

> as-built 细节在 `docs/` 与 `memory/YYYY-MM-DD.md`；跑门流程与全套环境绕法见 skill `bivane-gates`。
> 此处只留长期有效的约定与硬约束。

## 身份与命名

- **Bivane** /baɪˈveɪn/「碧帆」：以 Vant 设计语言为视觉源、React + Tailwind、以 shadcn copy-paste 形态分发的**双端自适应**组件库。
- 包名/CLI `bivane`；namespace `@bivane/<name>`；token 前缀 `--bv-*`；组件名不加前缀。
- **法律边界**：不得以 "Vant" 作包名/品牌/组件名；README 须含 "Design language inspired by Vant (Youzan)"，MIT。

## 事实源

- `docs/bivane-architecture.md` **v22** — 间距 §3.3 / `@theme inline` §3.4 / token 消费 §3.6 / token 分发 §3.7.1 / **模式 C §6.5 规则①~⑨** / registry 依赖 §7.1 / 20 条款 / 9 门。
- `docs/bivane-responsive-matrix.md` **v18** — 34 组件双模式定义 + as-built §3.4~§3.7。
- `USAGE.md` — 面向消费者的指南；**新增组件必须同步补**，否则像只写到上一个组件。

## 骨架与技术决策

- React 19 + TS strict(禁 any) + Tailwind v4 + Vite；三层目录 `components/responsive|h5|pc` + `hooks/`；断点默认 768 可配（叠加 `pointer: coarse`）。
- 运行时依赖白名单 **9 个**：react / react-dom / clsx / tailwind-merge / cva / `@radix-ui/react-{dialog,popover,dropdown-menu}` / **`react-day-picker`（仅 PC 月历引擎）**。**不用 vaul、不用 @use-gesture**。加依赖要三处同步：`package.json` + registry item 的 `dependencies` + `USAGE.md`/`README.md`/architecture §1 的数字。
- 两端 props 完全一致；唯一逃生舱 `forceMode: 'mobile' | 'desktop'`（不是 `'h5'|'pc'`）。
- 落地模式「能 A 不 B 不 C」；**C 的三种成因**：容器+信息模型（Select）/ 导航范式（DropdownMenu）/ 交互范式（DatePicker）。收紧判据：**两端连「当前值显示在哪里」都对不上，一定是 C**。
- 状态归属：跨模式同义 → 分发层（`value`/`open`/`draft`）；否则留实现层（`path`/`view`/`active`/`hoverText`）。
- 浮层：单层列表自研；多层树 / 焦点契约交 Radix；**PC 锚定浮层一律 Radix Popover 的 `Anchor`**，不自写锚点计算。
  ⚠ **React 版 `@radix-ui` 没有 Calendar / DatePicker 原语**——它只到 `Popover`。同名 `radix-vue` 虽有 `DatePicker` 但属 Vue 生态，不可用于 React 本库。React 侧现成日期件是 **`react-day-picker`（已采用，PC 月历引擎）** 或 React Aria 的 `Calendar`/`DatePicker`。
  ⚠ **rdp 的受控开关在 `onSelect` 上**：`useSingle`/`useRange` 都是 `const selected = !onSelect ? internallySelected : initiallySelected;` —— **不传 `onSelect` 就是非受控**，内部 state 首帧播种后忽略一切 prop 更新（症状：区间悬停预览不动、第二次点选错位），且四门全绿不报错。本库传空实现 `RDP_NOOP_SELECT` 拨到受控侧，选值语义仍归 `onDayClick`。
- 能力等价：H5 独有能力在 PC 降级为等价交互，不得隐藏（区间「两段式入口」替代 PC 双月同理）。

## 质量门（9 道，后五门独立于类型与单测）

`tsc --noEmit` / ESLint / vitest / `npm run build`（**stderr 必须为空**；`vite.config.ts` 的 `chunkSizeWarningLimit: 700` 就是为这条服务的 —— dist 是验证台产物、不是发布物）/ **CSS 产物核对** / **`npm run measure`** / **`scripts/visual-check.mjs`**（PC+H5）/ **分发完整性**（`r/tokens.json` 覆盖 `tokens/styles/` 全 5 CSS）/ **`npm run consumer:check`**。

**P1 三个静默缺陷、DatePicker「滚轮停 1 月」、rdp「非受控」三例全部通过了前四门 —— 几何/动画/受控开关类问题 jsdom 抓不到。**

- 门 5 只核被 `utilities.css` 真正引用的槽名（现有：`select-panel` / `menu-panel` / `menu-subpanel` / `popup` / `dialog` / `overlay` / `date-picker-panel` / `date-picker-wheel-mask`）；把全部槽名塞进清单只会造假 MISS。
- 门 6 探不到 `[data-mode]` 即 **EXIT 1**（防「无服务器时空跑通过」）。
- 门 9 若夹具没用到新组件等于没验证 → 必须同步改 `scripts/consumer-check.mjs` 的 `FIXTURE` / `componentItems` / CSS 探针数组。

## 硬约束（违反即静默失效）

- **`@theme` 必须写 `@theme inline`**，否则容器级 token 覆盖全失效。
- **新增颜色 token = 三处补齐**：`vant.css`（随模式变写 `modes.css`）+ `theme.css` 的 `@theme inline` + `lib/utils.ts` 的 `BV_COLORS`。漏 theme 最难发现；验证搜**工具类名**。**能不加就不加**。
- **组件运行期依赖的 CSS 必须进 registry**：`tokens/styles/` 5 个 CSS 全进 `tokens` item，漏 `theme.css` → 消费端**所有** `bg-bv-*` 不生成。
- **内边距必须拆分量**：`px-[...]`/`py-[...]`，禁 `[padding:var(--x)]`（不参与 tailwind-merge 消解）。
- **字号在前、行高在后**：`text-bv-md leading-[var(--bv-x-line-height)]`，反序会被 tailwind-merge 删 `leading-*`。上两条由 `tests/spacing-contract.test.tsx` 门禁。
- **绝对定位居中禁 `left-1/2 + w-auto + -translate-x-1/2`**（可用宽度只剩半屏）→ `inset-x-0 + w-fit + mx-auto` + `max-w`。
- **弹层高度上限逐形态显式给**（H5 三形态统一 `max-h-[var(--bv-popup-max-height)]` 90vh）；**凡把上游基类规则拆成分支产出，必逐分支核对**，回归用遍历。
- **portal 内元素必须自带 `data-mode`**（脱离宿主子树且兄弟不继承）；**共用零件不用 `bv-h5:`/`bv-pc:` 变体而用 JS 分支**（契约 19、20）。
- **`data-slot` 与 CSS 选择器逐字一致**，改名静默不跑；槽名按「模式+角色」区分不复用。
- **registry 内部依赖写纯名**（`build-registry.mjs` 转 `@bivane/<name>`）；写 `<name>.json` 会被当消费者 cwd 下本地文件。消费者必须声明 `"registries": {"@bivane": "https://<host>/r/{name}.json"}`。
- **prop 默认值逐字对齐 Vant**：本仓库**无 Vant 核心源码本地 check-out**（`packages/vant/src/...` 路径已失效；同级只有 `@form-create/vant` 适配器与 uni 小程序 vant 组件，非核心）。Vant 是**交互语义的事实源**（对照 `makeXxxProp`，如 date-picker 的 `min-date`/`max-date` 默认 ±10 年），靠架构文档/矩阵 + 上游知识对齐，不是代码复用。
- **间距两层互不越权**：组件内部 token 任何模式都不改写；页面骨架由 `[data-mode='pc']` 放大；**横向基准恒 16px**；禁裸 `gap-2`/`mt-4`。
- 模式差异用 `bv-h5:`/`bv-pc:` 变体（breakpoint 可配，**别用 `md:`**）。
- **无值时滚轮/选择器必须落「今天」**，不能落「今年 1 月 1 日」这类局部补位值（只在区间/列裁剪路径露头）。
- **下钻层级链（§6.5 ⑦⑧⑨）**：链身 = 进各层时点的那一项、链尾 = 当前层选中项、根层一格面板名（不可点）、**每项都可点**（点第 i 项 = `path.slice(0,i)`）、左键统一「取消」、独占工具栏下方一行；token `--bv-panel-header-breadcrumb-height: 32px`。「**可点**」与「**当前**」是两根正交轴。
- 基础件 `{...props}` 必须排在显式 `style` **之前**。
- **把状态交给上游组件前，先读它的源码确认受控开关在哪** —— 别按 prop 名字假定「传了 `selected` 就是受控」（rdp 的开关是 `onSelect`，见上）。同理：**先查上游有没有现成原语，再决定自研**。
- 手势关闭判定加**位移守卫**（≥16px 才认速度）；滚轮吸附兜底 ±0.5px 内不动（否则与 120ms 回写自激）。滚动锁 H5 `fixed`+记 scrollTop / PC `overflow`+补偿条宽，嵌套计数。

## 工程约定

- `@/*` 别名指向仓库根；tsconfig **不写 `baseUrl`**（TS 6+ 报 TS5101）；ESLint ignores 必须含 `.visual/**`、`.chrome-profile*/**`、`.consumer-check/**`。
- `cn()` 必须注册 bv 命名空间到 tailwind-merge。
- **Tailwind v4 扫全项目文本（含 `docs/`、`.workbuddy/`）** → `index.css` 已加 `@source not "./docs"` / `"./.workbuddy"`。
- 文本三级 `#323233` / `#969799` / `#c8c9cc`；hairline 基准 `1px`，0.5px 由 `scale(.5)` 伪元素。
- 组件形态：根 `data-slot`（自适应另加 `data-mode`）+ cva + `forwardRef` + className 透传。
- **值形态用字符串 `'YYYY-MM-DD'`**（`new Date('2026-09-22')` 按 UTC 解析，东八区差一天）。
- 固定行高：H5 列表 48 / PC 行 36；DatePicker 滚轮行 **44**（可见 5 行）、PC 日历格 **32**、面板宽 **252**。
- **单文件 demo `npm run demo:single`** → `bivane-demo.html`，双击即开（`file://` 可跑，已过 visual-check）。**用户说「想看 demo」就给这个。**

## 进度

- **P0 地基 ✅ / P1 弹层 ✅**（Popup B / Dialog B+双轨 / Toast C+双轨）。**P1′ 未做**：ActionSheet、Alert/Confirm、Notify、Loading。
- **P2**：`Select` ✅ → `DropdownMenu` ✅ → `DatePicker` ✅ → **下一步 TimePicker**（模式 C，与 DatePicker 同族）→ Picker/Cascader → Calendar → Tooltip/Popover。
- 现状：registry **40 item**，测试 **17 文件 284 例**，9 门全绿（DatePicker 日期引擎已由自研改为 `react-day-picker`，外层 18 例断言未动）。

## 本机踩坑（速查，详见 skill `bivane-gates`）

- 跑 npm 一律用 `scripts/run-npm.py`（受管 Python 绝对路径）；Bash coreutils 缺失**且不能接管道**；PowerShell 不回显 stdout。
- 同一文件**并行 Edit 会静默丢改动** → 串行 + 改完 Read 复核。
- **后台服务撑不过一次工具调用** → 静态服务器必须写进同一个 Node 脚本内。
- **jsdom 不做布局** → 缺陷只能靠 CDP 真机探针，探针输出**症状级**指标。
- **断言必须来自「我期望什么」，不是「我看到什么」**（从实现抄期望值 = 给缺陷上锁）。
- 长任务 `run_in_background: true`；`vite build` 加 `NODE_OPTIONS=--max-old-space-size=4096`。
