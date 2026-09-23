# Bivane /baɪˈveɪn/ · 碧帆 — Vant 风格 React 双端组件库 · 架构方案（AI 可执行版）

> 定位：以 Vant 的设计语言为视觉源，用 React + Tailwind 以 shadcn copy-paste 形态重写；**同一套组件 API，在小屏走 H5 交互、在大屏走 PC 交互**。
> 本文档是"宪法"，配套 `bivane-responsive-matrix.md`（逐组件双模式交互矩阵）。每次生成代码时，两份文档 + 对应组件任务卡一起投喂。

---

## 1. 项目基本信息

### 1.1 品牌系统

| 项       | 取值                   | 说明                                                                         |
| -------- | ---------------------- | ---------------------------------------------------------------------------- |
| 名称     | **Bivane**             | 风向标（vane）有双叶（bi-），一叶朝小屏、一叶朝大屏；亦保留 Vant 的 van 血统 |
| 读法     | `/baɪˈveɪn/`           | README 首行必须标音，避免被念成 /ˈbɪvən/                                     |
| 中文名   | **碧帆**               | 谐音锚定，同时"帆随风转"呼应风向标意象                                       |
| Slogan   | 一套 API，两端各得其所 | 英文：One API. Screen-aware.                                                 |
| 图标意象 | 双叶对称风向标         | 一叶朝小屏、一叶朝大屏                                                       |

### 1.2 工程约定

| 项                 | 约定                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| 包名 / CLI         | `bivane`（npm 已确认未被占用）；命令形态 `npx bivane add date-picker`                                      |
| Registry namespace | `@bivane/<name>`；安装形态 `npx shadcn@latest add @bivane/date-picker`                                     |
| Token 前缀         | `--bv-*`                                                                                                   |
| 组件命名           | 不加前缀，保持 shadcn/Vant 直觉（`<DatePicker>` 而非 `<BvDatePicker>`）                                    |
| 域名（待占位）     | `bivane.dev` / `bivane.com` / `bivane.io`（目前均无解析）                                                  |
| 技术栈             | React 19 + TypeScript（strict，禁 any）+ Tailwind CSS v4 + Vite                                            |
| 运行时依赖白名单   | 共 **9 个**：`react`、`react-dom`、`clsx`、`tailwind-merge`、`class-variance-authority`、`@radix-ui/react-dialog`、`@radix-ui/react-popover`、`@radix-ui/react-dropdown-menu`、`react-day-picker`（仅 PC 月历）。**已弃 `vaul`、`@use-gesture/react`**；手势、滚动锁、虚拟滚动、滚轮吸附均自研 |
| 分发形态           | shadcn registry（copy-paste 源码进用户项目），**不发布传统 npm 组件包**                                    |
| 断点约定           | 默认 `768px`（与既有项目惯例一致），通过 `ResponsiveProvider` 可配                                         |
| 交互模式判定       | 宽度 + 指针能力双重判定（见 §6.2）                                                                         |
| 法律边界           | 禁止使用 "Vant" 作为包名/品牌/组件名；README 必须含 "Design language inspired by Vant (Youzan)"，MIT 协议  |

## 2. 目录结构（monorepo）

```
bivane/
├── apps/docs/                       # 文档站：每个组件必须提供 H5/PC 双模式 demo
├── packages/
│   ├── registry/                    # registry.json + r/<name>.json
│   └── tokens/styles/               # 风格层：vant.css / vant-dark.css / <style-b>.css
├── components/
│   ├── responsive/                  # ⭐ 自适应组件（对外主入口，绝大多数场景用它）
│   │   ├── date-picker.tsx          # 内部按模式分发到 h5/pc 实现
│   │   └── dialog.tsx
│   ├── h5/                          # 小屏专用实现（手势、滚轮、底部弹层）
│   │   ├── date-picker.tsx
│   │   └── dialog.tsx
│   ├── pc/                          # 大屏专用实现（锚定浮层、日历面板、键盘导航）
│   │   ├── date-picker.tsx
│   │   └── dialog.tsx
│   ├── ui/                          # 无交互差异的共用件（Button、Cell、Tag、Icon…）
│   └── providers/
│       └── responsive-provider.tsx  # 模式上下文 + 强制模式开关
├── hooks/
│   ├── use-device-mode.ts           # 核心：返回 'mobile' | 'desktop'
│   ├── use-lock-scroll.ts
│   └── use-scroll-parent.ts
├── lib/utils.ts
└── tests/
```

三层职责不可混淆：`responsive/` 只做分发与 API 统一，`h5/` 与 `pc/` 只做各自交互，共享逻辑必须下沉到 `hooks/` 或 `lib/`。

## 3. Token 体系

### 3.1 映射规则

Vant 的 `--van-*` token 完整映射为 `--bv-*` 语义变量；**组件只允许引用语义 token，禁止硬编码色值**。

### 3.2 Vant → Bivane 基准映射（`vant.css` 已校准，唯一事实源）

已按 Vant 4 源码逐个核对（`style/css-variables.less` + 各组件 `index.less`），下表为**校准后**的实际取值：

| 语义变量                                     | 取值                                    | 说明                                              |
| -------------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| `--bv-primary / success / danger / warning`  | `#1989fa / #07c160 / #ee0a24 / #ff976a` | 语义色                                            |
| `--bv-text / -2 / -3`                        | `#323233 / #969799 / #c8c9cc`           | 三级文本（gray-8 / 6 / 5）                        |
| `--bv-border`                                | `#ebedf0`                               | gray-3                                            |
| `--bv-surface`                               | `#fff`                                  | 卡片 / 单元格底                                   |
| `--bv-muted`                                 | `#f7f8fa`                               | 页面背景                                          |
| `--bv-active-color`                          | `#f2f3f5`                               | 按压态                                            |
| `--bv-padding-base / xs / sm / md / lg / xl` | `4 / 8 / 12 / 16 / 24 / 32`             | 间距梯度                                          |
| `--bv-font-xs / sm / md / lg`                | `10 / 12 / 14 / 16`                     | 字阶（行高 `14 / 18 / 20 / 22`）                  |
| `--bv-radius-sm / md / lg / max`             | `2 / 4 / 8 / 999`                       | 圆角梯度                                          |
| `--bv-border-width`                          | `1px`                                   | hairline 基准（0.5px 靠 `scale(0.5)` 伪元素实现） |
| `--bv-z-popup / --bv-z-toast`                | `2000 / 3000`                           | 层级基线                                          |

> 校准中修正的两处草案错误：文本层级不是 gray-7 `#646566`，而是 gray-8/6/5 三级；hairline 基准是 `1px` 而非 `0.5px`。

### 3.3 间距节奏（Spacing Rhythm）

间距问题几乎全部来自「层级混用」——组件内部间距和页面骨架间距混在一个尺度里调。因此**分两层，互不越权**：

| 层级         | 谁用                 | Token                                                     | H5            | PC           | 可否随模式变      |
| ------------ | -------------------- | --------------------------------------------------------- | ------------- | ------------ | ----------------- |
| A · 组件内部 | 组件自己             | `--bv-padding-*` + 组件级 token                           | 严格等于 Vant | **同左**     | ❌ 绝不           |
| B · 页面骨架 | 页面 / docs / 业务页 | `--bv-gutter` / `--bv-block-padding` / `--bv-section-gap` | 8 / 16 / 24   | 12 / 24 / 32 | ✅ 随 `data-mode` |

硬规则：

1. **组件内部间距在任何模式下都不改写**——这是「视觉保真」的底线，也是 PC 端不会跑偏的原因。
2. **页面骨架间距随模式放宽**——手机栅格被拉伸到 1200px 会发挤，靠 B 层解决，而不是去动组件。
3. **横向基准恒为 16px**：`--bv-padding-md` 在两种模式下都不变。页面标题与白块内容都用 `px-bv-md`，保证与组件内部 16px 内边距对齐；一旦让横向留白随模式变，标题会和单元格文字错位。
4. **相邻组件行内间距用 `gap-bv-gutter`**，不要写死 `gap-2`；图标与文字之间的 4px 属于 A 层，组件自己控制。
5. **区块标题与内容 12px（`mb-bv-sm`）、区块之间 `mb-bv-section`**，不用裸 margin 拼凑。

### 3.4 Tailwind 主题必须 `@theme inline`

`packages/tokens/styles/theme.css`（随 registry 分发的第 5 个文件，见 §3.7.1）里的 `@theme` **必须带 `inline`**：

```css
@theme inline {
    --color-bv-surface: var(--bv-surface);
    --spacing-bv-md: var(--bv-padding-md);
}
```

不加 `inline` 时 Tailwind 生成 `--color-bv-surface: var(--bv-surface)` 并在 `:root` 处**提前求值**，工具类拿到的是常量，容器级 token 覆盖（深色主题 `.bv-theme-dark`、页面级间距、后续密度模式）会全部失效——2026-09-21 的深色主题区块发白就是这个原因。

配套的两个 CSS 变体用于**模式 A（纯 CSS 差异）**，比媒体查询更可靠（Provider 的 breakpoint 可配，媒体查询会失配）：

```css
@custom-variant bv-h5 ([data-mode='h5'] &);
@custom-variant bv-pc ([data-mode='pc'] &);
```

用法：页面骨架 `py-bv-block`（本身就是模式相关的 token），需要显式分支时写 `bv-pc:py-bv-lg`。

### 3.5 多风格机制

每套风格 = 一个只含 `:root` 变量的 css 文件，组件代码零改动；第 2/3 套只需新写 token 文件 + 必要组件级覆盖（走 `data-slot` 选择器）。格式兼容 tweakcn，便于接主题编辑器。

### 3.6 Token 消费规范（两条硬约束）

把 token 落到 class 上时，有两类写法会**静默失效**：token 值写对了，样式却不生效；而且单元测试抓不到——jsdom 不做 CSS 级联，`toHaveClass` 只能证明类名在，证明不了它没被覆盖。两条都已踩过，已加门禁。

**① 内边距必须拆分量：用 `px-[...]`，不要 `[padding:...]`**

Vant 的原始 token 是 padding 简写（`--van-button-normal-padding: 0 15px`）。若用 Tailwind 的任意属性语法 `[padding:var(--x)]` 消费，该写法**不参与 tailwind-merge 的冲突消解**，会被同元素上的 `p-0` 反向覆盖——按钮左右内边距直接归零、文字贴边。

于是 token 层拆成 `-padding-x` / `-padding-y` 分量：

```css
/* token 层：拆分量，注释保留 Vant 原值便于对照 */
--bv-button-normal-padding-x: 15px; /* Vant: 0 15px */
--bv-tag-padding-x: var(--bv-padding-base); /* Vant: 0 4px */
```

```tsx
/* 组件层：只用 tailwind-merge 认识的轴前缀 */
"py-0 text-bv-md px-[var(--bv-button-normal-padding-x)]";
```

**② 字号在前、行高在后：`text-bv-md leading-[...]`，不得反序**

tailwind-merge 的 `font-size` 组声明与 `leading` 组冲突（因为 Tailwind 的 `text-*` 自带 line-height）。`text-bv-*` 若出现在 `leading-*` **之后**，`leading-*` 会被删除，行高静默退回 `@theme` 的 `--text-bv-*-line-height`：

| 组件      | 反序后果                       | Vant 正确值 |
| --------- | ------------------------------ | ----------- |
| Tag base  | 高 18px（误用 `--bv-line-sm`） | 16px        |
| Tag large | 高 28px（误用 `--bv-line-md`） | 24px        |
| Badge     | 圆形角标变高变椭圆             | 16px        |

因此**字号与行高成对书写，且字号在前**；组件级行高一律显式写 `leading-[var(--bv-<组件>-line-height)]`，不复用 `--bv-line-*` 的通用值。

> 两条均由 `tests/spacing-contract.test.tsx` 门禁（含源码级扫描），并由 `npm run measure` 在真实浏览器里复核计算样式。

### 3.7 新增一个颜色 token = 三处必须同时补齐

第三类静默失效，比 §3.6 两条更隐蔽：**类名在、合并也对，但 CSS 根本没生成**。

新增一个可在工具类里消费的颜色 token，必须**同时**改三处，缺一处就会出现「类名保留、样式为空」：

| #   | 位置                                                          | 作用                      | 漏掉的后果                           |
| --- | ------------------------------------------------------------- | ------------------------- | ------------------------------------ |
| 1   | `packages/tokens/styles/vant.css`（随模式变的写 `modes.css`） | 定义 `--bv-<name>` 实际值 | 变量未定义                           |
| 2   | `packages/tokens/styles/theme.css` 的 `@theme inline`         | 声明 `--color-bv-<name>`  | **工具类 `bg-bv-<name>` 完全不生成** |
| 3   | `lib/utils.ts` 的 `BV_COLORS`                                 | 让 `cn()` 认识该命名空间  | 外部 `className` 无法覆盖组件默认值  |

**为什么第 2 处漏了最难发现**：`cn()` 因为第 3 处已注册，会**原样保留** `bg-bv-overlay` 这个类名，所以在 DOM 里查得到类、在断言里 `toHaveClass` 也过；但 Tailwind 从没为它输出任何规则，浏览器把它当普通类忽略。

实测症状（2026-09-21，Overlay）：`background-color` 落回初始值 `transparent`，遮罩**全透明**，弹出层与页面之间没有任何视觉分隔，而所有测试全绿。

**验证手段（jsdom 抓不到，必须查产物）**：

```bash
npm run build
# 在 dist/assets/*.css 里搜工具类名本身，而不是 token 名
# @theme inline 会把 var() 内联进声明，所以搜 --color-bv-x 是搜不到的
grep -o 'bg-bv-overlay{[^}]*}' dist/assets/*.css
# 期望：.bg-bv-overlay{background-color:var(--bv-overlay-background)}
```

一句话记法：**搜类名，不搜变量名**。`--color-bv-*` 在产物里永远不存在（inline 已内联）。

#### 3.7.1 三处还必须**随 registry 一起分发**

上面三处只要有一处留在 demo 的入口文件里、而没进 `packages/tokens/styles/`，就会出现**「demo 能跑、装到消费者项目里样式全白」**——比单组件失效更彻底，因为所有组件一起白。

`tokens` registry item 必须包含**全部 5 个 CSS**，每个都有不可替代的作用：

| 文件            | 作用                                                       | 缺失症状                                     |
| --------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `vant.css`      | `--bv-*` 变量实际值                                        | 变量未定义                                   |
| `vant-dark.css` | `.bv-theme-dark` 深色覆盖                                  | 无深色主题                                   |
| `modes.css`     | 随 `data-mode` 变化的变量                                  | 两端视觉无差异                               |
| `utilities.css` | 安全区 + 弹层动画原子层                                    | 刘海屏遮挡、动画不跑                         |
| **`theme.css`** | **`@theme inline` 映射 + `bv-h5:`/`bv-pc:` 变体 + 基础层** | **所有 `bg-bv-*` / `p-bv-*` 工具类都不生成** |

**2026-09-21 的实测缺陷**：`theme.css` 当时还叫 `index.css` 的一部分（demo 入口），`tokens.json` 只发了前 4 个。也就是**组件内部每一处 `bg-bv-text`、`px-bv-md` 在消费者项目里都是空类**——库装完完全不可用，而在我们自己的 demo 里一切正常（demo 的 `index.css` 自己 import 了映射）。

现在 `index.css` 只保留 6 行 `@import`（等价于消费者要在 `globals.css` 里写的全部内容），demo 与消费者走**同一条链路**，不再有分叉。

> 注意 `@import` 必须集中在文件顶部——中间插 `@import` 会被 CSS 规范直接忽略，症状同样是「变量都在、工具类全无」。

## 4. 组件硬性契约（AI 生成后逐条自检）

1. **文件位置**：按 §2 三层归属放置，不得错层
2. **结构**：`forwardRef` + 具名导出子组件，根元素带 `data-slot="<name>"`、`data-mode="h5|pc"`（自适应组件必带，便于调试与样式覆盖）
3. **变体**：用 `cva`，variant 命名对齐 Vant prop 语义（`type`: primary/success/danger/warning/default；`size`: large/normal/small）
4. **样式**：只用 Tailwind + `var(--bv-*)`；`cn()` 合并；禁止内联 style（动态值除外）
5. **可访问性**：交互件带 role/aria-\*；触控目标 ≥ 44px（H5 模式）；PC 模式必须支持键盘操作与焦点管理
6. **安全区**：贴边组件（Tabbar/NavBar/弹层）处理 `env(safe-area-inset-*)`
7. **类型**：strict TS，props 显式导出（`export type XProps = ...`），`className` 透传
8. **双轨 API**：弹层类必须同时提供声明式与命令式封装（见 §5）
9. **响应式确定性**：所有自适应组件必须保证**两种模式 props 完全一致**，交互差异不得通过 props 泄露；唯一例外是显式逃生舱 `forceMode?: 'mobile' | 'desktop'`
    - 取值就是 `DeviceMode` 本身，**不是** `h5` / `pc`。`h5` / `pc` 只是落到 DOM 上的属性值（`data-mode="h5|pc"`，由 `useDeviceModeAttrs` 映射），把它当 prop 传会直接编译报错——本契约早期版本曾误写成 `'h5' | 'pc'`，已验证并更正（2026-09-21）
10. **测试**：静态件 1 个渲染测试；交互件 H5/PC 两种模式各 1 个行为测试（mock `matchMedia`）
11. **质量门**：`tsc --noEmit` + ESLint 零错误后才算完成
12. **默认值与 Vant 源码逐字对齐**：prop 默认值错了，整页节奏都会走形（例：Button 的 `size` 默认是 `normal`，不是「base」；写成 base 会让所有按钮文字贴边）
13. **间距只从两层取**：组件内部用 `--bv-padding-*` 与组件级 token；页面骨架用 `--bv-gutter` / `--bv-block-padding` / `--bv-section-gap`（§3.3），不允许在组件里写裸 `gap-2`、`mt-4`
14. **内边距与行高的写法**：内边距一律用 `px-[...]` / `py-[...]`（token 侧拆 `-x` / `-y` 分量，禁用 `[padding:...]`）；字号与行高成对写**且字号在前**（§3.6）。两条都会静默失效，写完必须过 `spacing-contract` 测试
15. **Portal 内的一切元素都必须自带 `data-mode`**：portal 容器挂在 `body` 下，已经脱离了宿主组件的 `[data-mode]` 子树，`[data-mode='pc']` 的 token 覆盖**不会**传递进去。注意**兄弟节点也不继承**——面板带 `data-mode` 不等于它的兄弟遮罩带（Overlay 就是踩在这里：PC 端静默沿用了 H5 的 0.7 浓度与 300ms 时长）。落地方式：给这类基础件加一个 `mode?: DeviceMode` prop，由弹层把**已解析**的 mode 传进去，而不是让基础件自己再判定一次（否则 `forceMode` 逃生舱不会作用于它）
16. **`data-slot` 槽名必须与 `tokens/styles/*.css` 里的选择器逐字一致**：`utilities.css` 的进场/退场动画是挂在 `[data-slot='...'][data-state='...']` 上的，组件换个槽名（`overlay` vs `dialog-overlay`）动画就**静默不跑**——页面照样能用，只是没有过渡。改槽名时全局搜一遍选择器
17. **基础件的 `style` 合并顺序**：`{...props}` 必须排在显式 `style` **之前**。`props` 里带着调用方原始 `style`，在其后展开会把组件自己合并好的 `zIndex` / `pointerEvents` 整个覆盖掉（Overlay 的 `zIndex` 曾因此丢失）
18. **凡组件运行期依赖的 CSS，必须进 registry**：改完 token 或工具类，问一句「这行 CSS 消费者拿得到吗」。留在 `index.css`（demo 入口）里的东西消费端一律没有。判据：`packages/registry/r/tokens.json` 的 `files` 覆盖了 `packages/tokens/styles/` 下**每一个** CSS。P1 的 `theme.css` 漏分发曾导致**所有** `bg-bv-*` 工具类在消费端不生成——比单组件失效更彻底
19. **跨模式共用零件的外壳差异必须用 JS 分支，不得用 `bv-h5:` / `bv-pc:` 变体**：变体编译成**后代选择器** `[data-mode='x'] &`，元素自身带 `data-mode` 不匹配；而这类零件（Select 触发器、选项行）渲染在用户页面里，未必有 `data-mode` 祖先。变体只用于弹层/面板内部（那里必有自带 `data-mode` 的容器作祖先）。做法见 §6.5
20. **基础件不得自己判定 mode**：凡需按模式变形的公共零件（触发器、遮罩、滚动锁），一律由调用方传入**已解析**的 mode。自己再判定一次，会让 `forceMode` 逃生舱在它身上静默失效——遮罩的浓度、滚动锁的策略、触发器的外壳都会停在自动判定值上（契约 15 的姊妹条，机制相同、范围更广）

## 5. 双轨 API 约定（弹层类）

```tsx
// 声明式
<Dialog open={open} onOpenChange={setOpen} title="确认" />;
// 命令式（Vant 惯例，必须同时提供）
showDialog({ title: "确认", message: "..." });
```

命令式内部复用声明式组件，不另写渲染逻辑；通过 portal 挂载全局容器，自动卸载。命令式 API 同样必须走自适应分发。

## 6. 响应式双实现机制（核心）

### 6.1 三种落地模式

| 模式                            | 适用                                                           | 做法                                                                    |
| ------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A. 纯 CSS 差异**              | 尺寸、间距、排布不同但交互相同                                 | 组件内直接 Tailwind 断点类，无需 JS                                     |
| **B. 同一 primitive，换渲染壳** | 交互语义相同、容器形态不同（如 Dialog = 底部抽屉 vs 居中弹窗） | 单文件内按 `useDeviceMode()` 分支，复用同一份状态与内容                 |
| **C. 双实现**                   | 交互范式本质不同（滚轮 vs 日历、下拉浮层 vs 底部列表）         | `responsive/` 分发 → `h5/` 与 `pc/` 两份独立实现，共享逻辑下沉 `hooks/` |

判定原则：**能 A 不 B，能 B 不 C**。C 只在交互范式真的不同时使用。

模式 A 的 CSS 写法：**优先用模式相关的 token**（如页面骨架 `py-bv-block`），需要显式分支时用 `bv-h5:` / `bv-pc:` 变体；不要写 `md:` 等媒体查询——Provider 的 breakpoint 可配（如 1200），媒体查询会失配（§3.4）。

### 6.2 模式判定（`useDeviceMode`）

```
mode = 'mobile' :
  width < breakpoint
  OR (pointer: coarse AND hover: none)          // 触屏平板、大屏手机横屏
forceMode prop / Provider 配置 优先级最高（逃生舱）
```

- 基于 `matchMedia` + `useSyncExternalStore` 订阅，避免多余 re-render
- **SSR / 首屏**：默认渲染 `'desktop'`（保守），挂载后一帧内切换，切换必须用 `data-mode` 驱动样式而非条件卸载关键 DOM，避免闪烁与 hydration mismatch
- 尺寸类差异（模式 A）一律走 CSS 断点，不参与 JS 判定，规避抖动
- 提供 `<ResponsiveProvider breakpoint={768} mode="auto">`，文档站与测试用 `mode` 强制覆盖

### 6.3 包体策略

PC 用户不应下载滚轮/手势代码：`h5/` 与 `pc/` 各自的实现用 `React.lazy` + `Suspense`（fallback 为空壳）动态引入。注意：动态引入的组件内部不得再依赖 `Suspense` 之外的同步副作用。

### 6.4 手势件技术选型

| 组件                    | 底层方案                                                              |
| ----------------------- | --------------------------------------------------------------------- |
| 底部弹层 / Drawer       | `vaul`（drag-to-dismiss、snap points）                                |
| 滚轮 Picker             | 自研：`@use-gesture/react` + scroll-snap + transform，惯性 + 吸附     |
| 日历面板                | 自研：月网格 + 滚动加载                                               |
| SwipeCell / PullRefresh | 自研：`@use-gesture/react`，抽 `use-lock-scroll`、`use-scroll-parent` |
| PC 浮层                 | Radix/Base UI Popover + 键盘导航                                      |

**只 H5 存在的能力**（PullRefresh、SwipeCell、NumberKeyboard）在 PC 模式必须降级为等价交互（刷新按钮、hover 操作区、普通输入框），不得直接隐藏功能。

### 6.5 模式 C 的落地约定（P2 Select / DropdownMenu 沉淀）

模式 C 是「两份独立实现 + 共享逻辑下沉」。落地后有三条硬规则，否则会写出「看起来分了模式、实际两端共用一套行为」的假双实现。

**① 跨模式共用零件的外壳差异用 JS 分支，不用 `bv-h5:` / `bv-pc:` 变体**

`@custom-variant bv-h5 ([data-mode='h5'] &)` 编译出来是**后代选择器** `[data-mode='h5'] .bv-h5\:py-bv-md`。也就是说：

- 元素**自己**带 `data-mode`，它的 `bv-h5:` 工具类**不生效**；
- 共用零件（Select 触发器、选项行）渲染在用户页面里，未必有 `data-mode` 祖先。

做法是给零件传**已解析的 mode**，用一个 `triggerShellClass(mode)` 纯函数返回两串 class —— 与 `popup.tsx` 的 `panelShapeClass` 同一套。变体本身仍然有效，但只用于**弹层/面板内部**：那里必然有自带 `data-mode` 的容器作为祖先。

**② 模式 C 不需要在 `modes.css` 写模式覆盖**

两份实现是不同文件，各自读自己的 token（`--bv-select-option-height` / `--bv-select-pc-option-height`），模式差异在**命名期**就固定了，不需要运行期用 `[data-mode='pc']` 去改值。`modes.css` 只服务于**模式 A/B** —— 同一份 DOM 需要随模式变色改形时才用它。这条同时把「组件内部间距不许随模式变」的约束收窄了：模式 C 的两套密度是矩阵对两个组件的定义，不是同一组件在同一模式下的漂移。

**③ 共享逻辑以纯函数表达，而非「共享组件」**

`use-select-state.ts` 导出的是 `filterItems` / `nextEnabledIndex` / `initialActiveIndex` / `toggleSelected` 这类纯函数，React 绑定（`useSelectState`）只是薄薄一层。这样「跳过 disabled 项」「分组过滤后空组丢弃」这些边界判定可以直接单测 —— 在 DOM 测试里它们要么构造代价很高，要么根本触发不到。

**④ 模式 C 有三种成因，别把「容器不同」当成唯一判据（DropdownMenu / DatePicker 沉淀）**

Select 的 C 是**容器 + 信息模型**都不同（底部弹层 / 锚定浮层，行高、选法、搜索时机、长列表策略全不同）。
DropdownMenu 的 C 是**导航范式**不同 —— 容器差异只是表征，真正的分野在「**怎么走这棵树**」：
菜单是一棵**树**，移动端屏幕窄，子菜单无法像桌面那样在父层右侧并排展开，只能**替换当前视野**
（整层面板推入 + 头部铺出**可点的层级链** + 返回箭头逐层退回）；桌面端刚好相反，父层必须留在原地，
否则「我从哪个菜单进来的」这条信息就丢了（子菜单向右展开，父层用 `data-state=open` 保持高亮）。

DatePicker 的 C 是**交互范式**不同，比导航范式更彻底：H5 是「**连续滚动 + 吸附**」
（一维、模糊、靠手感收敛），PC 是「**二维网格 + 焦点巡航**」（二维、精确、靠光标定位）；
键盘/指针的操作语法没有任何一处可以互相翻译（滚轮没有「光标」，月历没有「吸附」）。
判据的可操作版本因此可以再收紧一格：**当两端连「当前值显示在哪里」都对不上时，一定是 C**
—— 滚轮把值放在正中的高亮行里，月历把值放在格子的底色上，这不是同一个 primitive 的两种外壳。
（同理可推：TimePicker 与 DatePicker 同族，Picker / Cascader 与滚轮同族。）

统一判据：问一句「**同一个 primitive 换个壳，能不能同时满足两端？**」
能（Tabbar → 侧边栏、NavBar → 面包屑）= B；不能 = C。

由这条还带出一个**状态归属**的推论：**状态该留在哪一层，取决于它是否跨模式同义**。
Select 有「值」，值语义两端一致 → `value` 归分发层；
DropdownMenu 除了「路径」还有一层**可选值**语义（2026-09-21 新增 `value` / `onChange`，
按树中 value 匹配**完整层级路径**回填触发器）——值语义跨模式同义，同样归分发层；
而路径深度是由导航范式决定的 → `path` 留在 `h5/menu.tsx` 内部。
**别照抄 Select 的状态归属**，两者只是恰好都叫模式 C。

**⑥ 暂存确认是值语义的一部分，归分发层；工具栏抽共享零件 PanelHeader（2026-09-21）**

「点选项只打勾、点『确定』才提交、『取消』放弃」这套**暂存**逻辑（`confirmable`）不是
「容器怎么摆」，它最终要变成 `onChange` 的参数 —— 因此草稿状态归分发层（同 `value`），
h5 实现只做受控展示（面板里的勾来自草稿副本，触发器回显永远取已提交值）。
两端的差异不在 props：PC 实现**刻意不解构**暂存相关 props（TS 的 noUnusedLocals 不豁免
下划线前缀，解构出来反而挂 lint）。
工具栏本身（`components/ui/panel-header.tsx`，槽名 `panel-header-*`，token 组
`--bv-panel-header-*`）是 H5 选择类面板的**通用头部**，Select / DropdownMenu 共用，
后续 DatePicker / TimePicker / Picker 直接复用 —— 三处各写一份必然长出三套字距与热区。
**只在 H5 渲染**：触屏点选是「高成本动作」需要确认这一步，鼠标点一下就该生效。
测试注意：Popup 的 `data-state` 在 jsdom 下恒为 `closed`（进场 raf 不跑），
「开没开」必须断言触发器的 `aria-expanded`。

**⑤ 浮层件：自研还是交给 Radix，判据是「该交互的复杂度是否值得自研」**

- **单层列表选择**（Select）：交互简单、能自研得完全可控，并且能精确对齐矩阵里的每条行为（跳过 disabled、回绕、分组过滤）→ **自研**。
- **多层树 / 含焦点契约的浮层**（DropdownMenu）：涉及子菜单展开与收回、焦点归属、typeahead、禁用项跳过，自己写一遍必然在边界上出错 → **交给 Radix**，本库只负责外观（class 与 token）与「选中后干什么」。
- **日期网格 / 区间代数**（DatePicker 的 PC 月历，2026-09-22 修正）：初版把月历网格（`buildMonthGrid`）与区间内含判定全部自研，复算「跨月补位、跨年、weekStart 轮转、区间倒序」四类边界。**先查上游有没有现成原语再决定自研** —— 结论是 **React 版 `@radix-ui` 没有 Calendar / DatePicker 原语（它只到 `Popover`）**；`radix-vue` 虽有 `DatePicker` 但属 Vue 生态，本库不可用。React 侧的现成件是 `react-day-picker`（shadcn 的选择）或 React Aria。故 **PC 月历的日期引擎交 `react-day-picker`（v10），本库只保留渲染层与值语义**：rdp 递进来的 `modifiers` 用于上色，`data-slot` / `data-*` 契约与键盘巡航仍由本库掌握（rdp 的内置键盘依赖焦点落在日期格上，与本库「触发器是可输入框、焦点须留面板」冲突，故 `tabIndex={-1}` + `onMouseDown preventDefault` 自己接管）。
  - 连带结论：`hooks/use-date-value.ts` 的 `buildMonthGrid` / `CalendarCell` / `weekdayLabels` 已删除，只留 `weekBounds`（键盘 Home/End 用）。
  - **⚠ rdp 的受控开关在 `onSelect` 上**：`useSingle` / `useRange` 内部都是 `const selected = !onSelect ? internallySelected : initiallySelected;` —— **不传 `onSelect` 时 rdp 走非受控分支**，首帧从 `selected` 播种后自己维护内部 state，之后再更新 prop 会被**静默忽略**（症状：区间悬停预览不动、第二次点选错位，且 tsc/ESLint/vitest/构建四门全绿）。本库传一个空实现 `RDP_NOOP_SELECT` 把开关拨到受控侧，选值语义仍由 `onDayClick` 负责。凡「把状态交给上游组件」的地方都要查它到底受控不受控，**别按 prop 名字假定受控**。

与 §6.4「PC 浮层用 Radix / Base UI」一致，但注意**这条不是「一律用 Radix」**——Select 的 PC 端就没有用 Radix，是按上面这条判据选的。

> 另注意：基础件不得自己调 `useDeviceMode()` 判定模式（契约 20）。Select 的触发器不自判定，由分发层把已解析的 mode 传下来 —— 与 `use-lock-scroll`、`Overlay` 完全一致。

**⑦ 树形数据回显选中值，必须带「完整层级路径」，不能只回填末级 label（2026-09-21 缺陷修正）**

树里同名节点可以挂在不同父级下（`移动到 / 项目文档` 与 `复制 / 项目文档`），只回填 label
时这两者**不可区分**，用户看不出自己选的是哪一条链 —— 这正是 `DropdownMenu` 初版的缺陷。
统一做法：查值返回的是**链**而非节点（`findMenuPath`，顶层项退化为单元素链），回显时逐级渲染
（`MenuTriggerPath`，槽名 `menu-trigger-path-ancestor / -separator / -current`）。
三条配套取舍：

- **顶层项退化为纯 label**（链长 1 时不渲染祖先与分隔符），保持既有观感，不给简单场景加噪声；
- **值失效（树里找不到）回退原 `trigger` 文案**，而不是渲染半截路径 —— 与 Select 的「值不在选项里」同一套兜底直觉；
- **分隔符复用 `--bv-menu-gap`、颜色复用 `text-bv-text-2/3`，不新增颜色 token**（§3.7 的三处补齐能不加就不加）。

这条不限于 DropdownMenu：**凡「选中值来自树的某一层」的组件都适用**，后续 `Cascader` / `Area` / `Picker`
（矩阵 §2.2 已写「路径回显」）直接复用这两个零件与幂等约定。

**⑧ 树形数据展开浮层时，要主动定位到选中值所在层级（2026-09-21 缺陷修正）**

⑦ 解决「看得到」，⑧ 解决「打开就到位」：选中项可能埋在三层之下，展开时若一律从根层开始，
用户得自己一层层点进去才能确认当前选的是哪一条。做法是**把定位量也派生在分发层**——
`initialPath` = 选中值的**祖先 value 链**（未选中 / 值失效时为空数组，等价于「从根层开始」）；
两端只负责用本模式的导航范式落位（H5 用面板栈初始化到该层，PC 用受控子菜单铺开整条链），
并各自把选中行滚入视野。三条配套取舍：

- **只在展开翻转的那一刻定位**：展开期间改草稿（暂存模式点叶子会改选中值）不能让视野弹回去；
- **关闭即收回**，下次展开重新定位，不停在上次手动下钻的位置；
- 判定依据是「祖先链」而不是「深度数字」——深度只够下钻，链才能同时回答「下钻到哪一层」和「该层的哪一项」。

两个 Radix 时序陷阱与对应修法见矩阵 §3.6「打开即定位」的踩坑记录
（`FocusScope` 的延迟自动聚焦被判成焦点外逃、`Presence` 状态机使 ref 晚到 → 滚动静默失效）。
**凡在 Radix 受控浮层上做「打开即定位 / 打开即滚动」，先假设节点不会在同一个提交里出现。**

**⑨ 多层下钻的面板头部要给出可点的层级链，且「渲染归共享头部、数据由实现层摊平」（2026-09-21）**

⑦⑧ 让用户**看得到、到得了**当前层，但头部若只显示当前层名字，用户仍看不到「我是从哪一层进来的」，
想回头也只能一层层按返回。做法是：**每层都铺这条链** —— 根层只有一格面板名，下钻后
**链身是「进入各层时点的那一项」，链尾是当前层的选中项**（如 `移动到 / 更多位置 / 共享盘`，
即「1层选中值/2层选中值/3层选中值」），**链上每一项都可点**（第 i 项就是第 i 层的选中值 →
`path` 截到 i 就落回那一层；链首即回最上层）。回头既然能靠链上点名，左键就**统一成「取消」**
（`onCancel`），下钻中不再有返回箭头。根层的面板名**不进链身**：它说的是「这个面板叫什么」，
与「选过的每一步」不同源，与触发器的层级回显同一条链。

分层与 §6.5 ③ 一致：**渲染与样式归共享零件**（`PanelHeader` 的结构化 prop
`breadcrumb?: { label: ReactNode; onSelect?: () => void }[]`，给了它即替代 `title`），
**数据摊平归实现层**（`h5/menu.tsx` 由面板栈算出链身与链尾，并给每一项接上 `setPath`）——
面包屑是「通用头部」的能力，不是某个菜单的私有零件，否则 `menu-parts` 要反向引用
`--bv-panel-header-*` token。四条配套取舍：

- **每层都铺，根层只有一格面板名**：不铺的话头部会在下钻那一刻从「居中标题」跳成「左对齐层级行」
  （行数与对齐同时变）。由调用方按 `trail.length` 分支给出；根层这一格是当前落点因而不给 `onSelect`，
  渲染成不可点的 `panel-header-crumb-current`。**共享零件不做层数判断**，也不区分「层」与「取值」——
  它只按「有没有 `onSelect`」渲染，那是调用方的语义；
- **每一项都可点**，末项照给 `onSelect`（它所在的层就是当前层，点了收敛在原地）：末项此前不可点，
  于是「二级且该层已有选中值」时链上一个可点的都没有，「一键回最上层」会随根层标题一起消失。
  而**「当前落点」的语义不因可点而丢**：着色与 `aria-current` 只看**位次**（末项），
  不看有没有 `onSelect`；回头有链上点名兜底，**左键就不必再留返回箭头**（统一 `onCancel`，
  `PanelHeader` 的 `onBack` 留给其它需要「逐层退」的多层面板）；
- **面包屑独占工具栏行下方一行**：面板头部是两行结构（`panel-header-bar` 44px +
  `panel-header-breadcrumb` 32px，后者只在该 prop 存在时铺）。与按钮挤同一行时，链一长要么压住
  标题、要么被迫给两侧按钮让位而缩进；独占一行后它才是一条可左对齐、从链首读起的路径，
  项与项之间不再留横向内边距（读成紧凑的「选1/选2/当前」）；
- **横向可滚 + 自动滚到末端**，且滚动 effect 的依赖用**项数**而非数组本身 ——
  数组每次渲染都是新身份，那样会在无关渲染里反复把视野拽回末端，用户想往回看都看不成。

PC 端不涉及：它是锚定浮层，父层本就留在原位可点，没有「弹窗上面」这一处。

## 7. Registry 产物

- `registry.json`：`items[]` 含 `name / type / files / dependencies / registryDependencies`
- namespace 形态：`@bivane/date-picker`，用户安装 `npx shadcn@latest add @bivane/date-picker`
- 自适应组件的 `registryDependencies` 必须带上 `responsive-provider`、`use-device-mode`，以及**两种模式各自的实现文件**
- 装 `date-picker` 会连带装 `h5/date-picker`、`pc/date-picker`、`popup`、`use-device-mode`——由 CLI 递归解析，需在任务卡里列全
- 发布前在空白 Vite 项目实测 `npx shadcn@latest add @bivane/<name>`

### 7.1 内部依赖必须写成命名空间形式（实测结论，勿改）

`registry.json` 里内部依赖写**纯名**（`use-device-mode`），`build-registry.mjs` 的 `resolveDep()` 统一转成 `@bivane/use-device-mode`。三种写法的后果：

| 产物里写成                   | shadcn 的处理                                                                      | 结果                                           |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- |
| `@bivane/use-device-mode` ✅ | 按消费者 `components.json` 的 `registries` 模板解析                                | 正确                                           |
| `use-device-mode.json` ❌    | `isLocalFile(p) = p.endsWith('.json') && !isUrl(p)` 命中 → 按**消费者 cwd** 找文件 | `Failed to read local registry file`（ENOENT） |
| `use-device-mode` ❌         | 无命名空间 → 兜给内置 `@shadcn` 源（`ui.shadcn.com/r/styles/<style>/…`）           | 取到官方同名件或 404                           |
| `https://host/r/x.json` ⚠️   | 原样使用                                                                           | 可用，但域名硬编码进产物，换镜像要重新构建     |

消费者侧因此**必须**声明命名空间，否则报 `Unknown registry "@bivane"`：

```json
{ "registries": { "@bivane": "https://bivane.dev/r/{name}.json" } }
```

另两条同源约束：

- **本地文件路径安装（`add ./x.json`）对本库不成立**——多条目 registry 靠 CLI 递归解析内部依赖，而那些依赖名同样会被 `isLocalFile` 命中。只能走 registry URL。
- **`files[].target` 会被 `isSrcDir` 改写**：项目存在 `src/` 目录时，shadcn 给所有 target 加 `src/` 前缀（`resolveFilePath`）。这对本库是**期望行为**（组件要跟着消费者的 `@/*` 别名走），但我们给用户的 `@import` 路径说明必须交代这条规则。

## 8. AI 执行流程（任务卡模板）

```
请按 @bivane-architecture.md 与 @bivane-responsive-matrix.md 生成组件 <Name>。

1. 组件归属：responsive(自适应) / ui(无差异)；列出 h5/ 与 pc/ 两个实现文件
2. 双模式交互定义（照矩阵文档填写，不得自行发挥）：
   - H5：<交互形态、手势、动画、降级规则>
   - PC：<交互形态、浮层锚定、键盘、悬停>
   - 落地模式：A / B / C，理由一句话
3. Props 清单（双模式必须完全一致）：<prop: type — 说明>
4. 共享逻辑提取：<需下沉到 hooks/ 的部分>
5. 依赖：<内部组件/hook，registryDependencies 列全>
6. 完成标准：§4 全部 11 条契约 + §9 四个质量门
7. 产出：responsive/h5/pc 源码 + registry JSON + 双模式测试 + docs 双模式 demo
```

### 执行顺序

- **P0 基建**：token 校准 → `lib/utils` → `use-device-mode` + `ResponsiveProvider` → `Button` → `Cell/CellGroup` → `Tag` → `Badge` → `Icon`
- **P1 弹层（大量模式 B）**：`Popup` → `Dialog` → ~~`ActionSheet`~~ → ~~`Alert`~~ → `Toast`~~/Notify~~ → `use-lock-scroll` ✅（2026-09-21：地基 + Popup/Dialog/Toast 已完成；**ActionSheet / Alert / Notify / Loading 顺延为 P1′**，均为已实现件的 preset）
- **P1′ 弹层补全**：`ActionSheet`（≈ Popup + 选项列表）→ `Alert/Confirm`（≈ Dialog 去输入区）→ `Notify`（≈ Toast 换信息模型）→ `Loading`
- **P2 选择类（大量模式 C，本项目最高价值）**：`Select` ✅（2026-09-21）→ `DropdownMenu` → `DatePicker` → `TimePicker` → `Picker/Cascader` → `Calendar` → `Tooltip/Popover`
    - PC 浮层的既定选型是 **Radix/Base UI Popover + 键盘导航**（§6.4），不要自己写锚点计算；翻转与位移防溢出交给 Radix Popper
- **P3 表单与列表**：`Field/Input/Textarea` → `Switch/Checkbox/Radio` → `Rate/Slider/Stepper` → `Uploader` → `Search` → `Tabs/Tabbar/NavBar` → `List`(无限滚动) vs `Table`(分页)
- **P4 生态**：第 2/3 套风格 → tweakcn 适配 → 文档站 → registry 发布验证

每完成一档跑全量 `tsc --noEmit` + ESLint + vitest，再进入下一档。

## 9. 验证与质量门

| 门             | 命令                                          | 标准                                                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 类型           | `tsc --noEmit`                                | 0 error                                                                                                                                                                                                                                                                        |
| 规范           | `eslint .`                                    | 0 error 0 warning                                                                                                                                                                                                                                                              |
| 测试           | `vitest run`                                  | 全绿；交互件双模式各有行为测试                                                                                                                                                                                                                                                 |
| **CSS 产物**   | `npm run build` 后搜产物                      | **新增/改动 token 或槽名时必跑**：在 `dist/assets/*.css` 里搜**工具类名**（`bg-bv-x`）与**槽名**（`data-slot=x`）确认规则真的生成了。搜 `--color-bv-*` 永远搜不到（inline 已内联）。见 §3.7                                                                                    |
| 计算样式       | `npm run measure [url] [width]`               | 真实浏览器里复核：按钮/标签实际内边距、`leading-*` 类存活、骨架间距随模式变化、遮挡浓度。**H5 与 PC 各测一次**                                                                                                                                                                 |
| 视觉/交互      | `node scripts/visual-check.mjs`               | 内置静态服务器 + CDP 无头 Chrome，**交互后**截图（不是静态首屏）+ 打印计算值探针，1200px 与 390px 各一次。几何值以计算值为准（居中偏移、贴边距离、圆角、遮罩 rgba、单例 vs 栈的条数）                                                                                          |
| **分发完整性** | `npm run registry:build` 后查 `r/tokens.json` | **新增/改动 CSS 时必跑**：`packages/registry/r/tokens.json` 的 `files` 必须覆盖 `packages/tokens/styles/` 下**每一个** CSS。留在 `index.css` 里的样式消费端拿不到，见 §3.7.1                                                                                                   |
| **消费者实测** | `npm run consumer:check`                      | **改动 `registry.json` / `build-registry.mjs` / 组件 import 路径时必跑**。在空白项目里起真实 HTTP registry、走 `npx shadcn add @bivane/<name>`、断言落盘文件、再跑消费者侧的 `tsc --noEmit` + `vite build` + CSS 产物探针。判据：registry 请求全 200、无缺失文件、消费者侧双绿 |

> **为什么「CSS 产物」和「视觉/交互」是独立门**：P1 一次真实教训——遮罩缺 `@theme` 映射导致**全透明**、遮罩漏带 `data-mode` 导致**静默沿用 H5 浓度**、槽名与动画选择器不一致导致**动画不跑**。三个缺陷全部通过了 `tsc` + `eslint` + 120 个 vitest 用例 + `vite build`。类型系统与 jsdom 都不做 CSS 级联，**只有查产物和看浏览器才能发现**。

> **为什么还要「消费者实测」**：前七门全部跑在本仓库内，内部 import 靠本仓库 tsconfig 别名解析，`registryDependencies` 根本不会被真的解析。**registry 层写错时，前七门必然全绿。** 真实教训：`registryDependencies` 曾被构造成 `<name>.json`，而 shadcn 的 `isLocalFile(p) = p.endsWith('.json') && !isUrl(p)` 会把它当成**消费者项目 cwd 下的本地文件**，安装直接 ENOENT。已改为命名空间形式 `@bivane/<name>`，消费者在 `components.json` 声明 `registries` 后解析（见 §7.1）。

## 10. 里程碑

- **M1（第 1-3 周）**：token + 判定机制 + P0 完成 → 静态件在两种宽度下都正常
- **M2（第 4-6 周）**：P1 弹层完成 → Dialog/Toast 双形态跑通，验证模式 B 可行性
- **M3（第 7-11 周）**：P2 选择类完成 → **核心价值验证点**：同一 `<DatePicker>` 在 PC 弹日历、在 H5 弹滚轮
- **M4（第 12-15 周）**：P3 + 多风格 + registry 发布 + 文档站上线

---

_修订记录：v1 初版代号 Vanx（2026-09-18）；v2 增加响应式双实现机制、三层目录、双模式契约与任务卡（2026-09-20）；v3 定名 Bivane / 碧帆，token 前缀改为 `--bv-_`，补品牌系统与 registry namespace（2026-09-20）；v4 补 §3.2 校准表、§3.3 间距节奏、§3.4 `@theme inline`约束，契约增至 13 条（2026-09-21）；v5 补 §3.6 Token 消费规范（内边距拆分量、字号与行高顺序），契约增至 14 条，质量门新增`npm run measure`（2026-09-21）；v6 P1 弹层完成，补 §3.7 新增 token 的三处补齐，契约增至 17 条（portal 自带 data-mode、槽名与选择器一致、`style` 合并顺序），质量门拆出「CSS 产物」与「视觉/交互」两门（2026-09-21）；v7 补 §3.7.1 **token 必须随 registry 完整分发**（`@theme`映射抽为`tokens/styles/theme.css`，此前漏分发会让消费端**所有**工具类不生成），契约增至 18 条，质量门新增「分发完整性」门、视觉/交互门改用 `scripts/visual-check.mjs`（2026-09-21）。；v8 P2 Select 落地，新增 §6.5 模式 C 落地约定（共用零件外壳用 JS 分支、模式 C 不写 `modes.css`覆盖、共享逻辑纯函数化），契约增至 20 条（19 共用零件不得用模式变体、20 基础件不得自判定 mode），并把这套约定应用到 §6.4 的 PC 浮层选型（Radix Popover，弃用`lib/position`）（2026-09-21）；v9 Popup 缺陷修正：H5 居中模态的宽度改为逐字对齐 Vant 的 `inset-x-0 + w-fit + mx-auto`（初版 `left-1/2 + w-auto`使 shrink-to-fit 的可用宽度只剩半屏，面板被压到 50% 视口并折行），新增 token`--bv-popup-center-max-width`；ESLint 忽略列表补 `.visual/**`与`.chrome-profile\*/**`，消除「验证产物把 lint 打红」的假失败（2026-09-21）；v10 **registry 分发修正**：新增 §7.1 —— 内部依赖必须写成 `@bivane/<name>`（原 `<name>.json`被 shadcn 的`isLocalFile()`当成本地文件，安装必然 ENOENT；裸名则被兜给官方源），消费者须在`components.json`声明`registries`；补记 `files[].target`受`isSrcDir` 影响的实际规则；质量门新增第 8 门「消费者实测」（`npm run consumer:check`，脚本 `scripts/consumer-check.mjs`）；更正契约 9 的 `forceMode`取值`'h5' | 'pc'`→`'mobile' | 'desktop'`（`h5/pc`只是`data-mode`属性值）（2026-09-21）；v11 **弹层高度约束补齐**：H5 居中模态漏了`max-height`——Vant 那条规则写在 `.van-popup` **基类**上、`--center`靠继承吃到，而本库按`position`分支产出类名，于是只给`top`/`bottom` 写了而上限 center 没有。后果不止「没上限」：面板高 = 内容高 → 内部滚动容器（`min-h-0 flex-1 overflow-y-auto`）永久拿不到约束、**滚动彻底失效**，且内容一高就溢出视口两端。已补 `max-h-[var(--bv-popup-max-height)]`（90vh，三种 H5 形态统一），实机 390×780 下 40 行内容实测封顶 702px、`scrollHeight 1852`、两端不溢出。**可复用的教训：把上游的「基类规则」拆成按方向分支产出时，必须逐分支核对，否则约束会被静默丢掉**——`tsc`/`eslint`/`vitest`/`vite build` 四门对此全部无感（jsdom 不做布局），只有真机几何探针能抓，故回归测试按 top/bottom/center **遍历**而非单点断言（2026-09-21）；v12 P2 DropdownMenu 落地（模式 C 的第二种成因）：§6.5 新增规则 ④ —— **模式 C 有两种成因**，Select 是「容器 + 信息模型」不同，DropdownMenu 是「**导航范式**」不同（H5 整层面板推入 vs PC 子菜单右展、父层不动），统一判据是「同一个 primitive 换个壳能否同时满足两端」，并带出「状态该留在哪一层取决于它是否跨模式同义」的推论（`path`留在 H5 内部，别照抄 Select 的`value`）；新增规则 ⑤ —— 浮层件**自研 vs 交给 Radix 的判据**（单层列表选择可自研，多层树含焦点契约交给 Radix；澄清「不是一律用 Radix」，Select PC 端即自研）。测试环境另记两笔**易误诊的坑**：① `@radix-ui/react-dropdown-menu` 的 Trigger 在 **`onPointerDown`** 上开合（不是 click），且经 Slot 会给子元素注入 `disabled: false` 覆盖我们的禁用态、`SubContent`类型里没有`side`/`align`；② `@radix-ui/react-menu`在打开期间订阅 window 的 blur 当作「窗口失焦」而关菜单，而 **jsdom 会在「带焦点的子树被移除」后补抛一个 window blur**（浏览器不会），症状是同一测试文件里从第二个用例起菜单「打开又立刻被关掉」，极像「卸载后 handler 失效」——已在`tests/setup.ts`截断该事件并写入成因注释（2026-09-21）。*；v13 **H5 暂存确认与可选值（2026-09-21）**：新增共享零件`components/ui/panel-header.tsx`（「取消 · 标题 · 确定」工具栏，槽名 `panel-header-_`，token 组 `--bv-panel-header-_`；下钻的返回箭头同为它，`onBack`与`onCancel`互斥占左位），Select / DropdownMenu 共用，替代 DropdownMenu 的本地标题栏（旧槽名`menu-header/-back/-title`废弃）。Select 加`title`/`confirmable`/`confirmText`/`cancelText`（`use-select-state`相应暴露`setValue`）；DropdownMenu 加可选值语义 `value`/`defaultValue`/`onChange`（按树中 value 匹配 label 回填触发器，行尾选中勾复用 Select 的 check token）+ 同一套 `confirmable`。§6.5 新增约定 ⑥：**暂存是值语义的一部分，草稿归分发层**；工具栏只在 H5 渲染（触屏误点有退路，PC 点选即生效），PC 实现刻意不解构暂存 props（noUnusedLocals 不豁免下划线前缀）。**jsdom 测试坑：Popup 的 `data-state`恒为`closed`**（两阶段挂载的进场 raf 不跑），「面板开没开」必须断言触发器 `aria-expanded`；registry 34 item；v14 **DropdownMenu 触发器层级回显（2026-09-21 缺陷修正）**：可选值场景原只回填末级 label，同名子节点分属不同父级链时**不可区分**（用户报障「选中没有层级展示」）。改为按树中 value 匹配**整条层级路径**回填：`use-menu-state.ts`新增`findMenuPath`（返回「根 → 节点」的链，`findMenuOption` 复用它取末级），`components/ui/menu-parts.tsx`新增展示零件`MenuTriggerPath`（槽名 `menu-trigger-path-ancestor / -separator / -current`，分隔符 `/`用`--bv-menu-gap`留白、祖先`text-bv-text-2`末级`text-bv-text-3`之外的默认色，**不新增 token**）；顶层项退化为纯 label、值失效回退原`trigger`文案。§6.5 新增规则 ⑦（凡选中值来自树的组件均须带路径回显，可复用于 Cascader /`Area` / Picker）。`scripts/visual-check.mjs`新增 7a 场景与`probeTriggerPath`（实机两端一致：`pathAncestors ["移动到"]`+ 1 分隔符 + 祖先色`rgb(150,151,153)`）；测试 198 → **214 例**（`findMenuPath`单测 + 双端触发器层级回显三态）。*；v15 **DropdownMenu 打开即定位（2026-09-21 缺陷修正）**：v14 解决「看得到」（触发器回显层级），本轮解决「打开就到位」（用户报障「打开弹窗需要定位到对应位置」）。分发层从选中值再派生一个`initialPath`（选中值的**祖先 value 链**，空数组即「从根层开始」）并加进 `MenuPanelProps`；H5 用它初始化面板栈（展开即下钻到该层）、PC 用它受控铺开整条子菜单链（`Sub open={openPath[depth] === item.value}`，`onOpenChange`按 depth 截断以维持「同层只开一条链」），两端各自把选中行`scrollIntoView({block:'nearest'})`。三条取舍：**只在 open 翻转那一刻定位**（`wasOpen`ref 守住，避免暂存模式点叶子改草稿时把视野弹回去）、关闭即收回、用祖先链而非深度数字。§6.5 新增规则 ⑧（凡选中值来自树的组件展开时都要主动定位，可复用于 Cascader / Picker）。**两个 Radix 时序陷阱（可复用的教训：凡在 Radix 受控浮层上做「打开即定位」，先假设节点不会在同一个提交里出现）**：①`FocusScope`的 container 是 state，根面板的**自动聚焦比子面板挂载更晚**，这次落在根面板容器上的`focusin`被`MenuSubContent`的`onFocusOutside`判成「焦点跑到子菜单外」→ 刚铺开的链立刻收回（症状`aria-expanded=false`、`subpanels=0`，极像「`open`没传进去」），修法是在`SubContent.onFocusOutside`放行「焦点落在面板容器本身」的那一次；②`Presence`是状态机，面板节点**晚一两次提交**才挂上，依赖`open`/`openPath`的 effect 拿到的 ref 还是`null`、节点挂上时依赖又没变 → 滚动**静默失效**，修法是把滚动挪进面板的 ref 回调（挂载即滚）并让 ref 引用保持稳定（内联箭头会以 `null → node` 各调一次，把用户手动滚开的视野拽回来）。`scripts/visual-check.mjs`的`probeMenu`新增`selectedDepth`/`selectedInView`两项症状级指标并加 7g 场景（实机：PC`selectedDepth=1`+`subpanel side=right`+ 父层仍在，H5`layerDepths=["0","1"]`+ 轨道 −390px + 标题「移动到」，两端`selectedInView=true`）；测试 214 → **221 例**；v16 **DropdownMenu 头部层级面包屑（2026-09-21 用户需求「弹窗上面加上层级，用户可点任意层级切到对应层」）**：v14 让用户「看得到」当前选中项、v15 让用户「打开就到位」，本轮补上「**能跨层回头**」——下钻后头部只显示当前层名字时，用户既看不到自己是从哪一层进来的，想回头也只能一层层按返回。做法是 `components/ui/panel-header.tsx`（共享头部）新增结构化 prop `breadcrumb?: { label: ReactNode; onSelect?: () => void }[]`+`breadcrumbLabel`（默认「层级」），**给了 `breadcrumb`即替代`title`**；祖先层渲染为可点 `<button>`（`path`截断到该层）、当前层为`<span aria-current="true">`，返回箭头保留为「逐层退」——两种粒度并存。槽名 `panel-header-breadcrumb`/`-crumb`/`-crumb-current`/`-crumb-separator`。**分层照 §6.5 ③：渲染与样式归共享零件，数据摊平归实现层**（`h5/menu.tsx` 由面板栈算每层名字，`panels[i].trail[i-1].label`），否则 `menu-parts`要反向引用`--bv-panel-header-\*`token。三条取舍：**单层不铺**（调用方按`levels.length > 1`决定，根层退化为普通居中标题 → 视觉零回归，共享零件不做层数判断）、**当前层不可点**、**横向可滚 + 自动滚到末端且 effect 依赖层数而非数组本身**（数组每次渲染都是新身份，会在无关渲染里反复把视野拽回末端）。复用`text-bv-text-2/3`与`--bv-padding-xs`，不新增 token；PC 端不涉及（锚定浮层，父层本就留在原位可点）。§6.5 新增规则 ⑨；`scripts/visual-check.mjs`新增 7h 场景与 5 项面包屑探针（实机：H5 三级 3 项 2 分隔符、祖先层为`button`；点根层后 `layers 1`+ 轨道归零 + 面包屑收起）；测试 221 → **227 例**；v17 **H5 头部改两行结构（2026-09-21 用户需求「只挪面包屑，新起一行，面包屑 选择1/选择2/选择3 这种格式，点到选择1就是最上层」）**：v16 把层级链铺出来了，但它与「返回 · 确定」挤在同一个 44px 工具栏行里 —— 面包屑一长，两侧按钮的点击位就被压缩，居中布局还会让不同长度的链左右乱跳。本轮把`panel-header.tsx`外层容器改成`flex-col`、工具栏抽为 `panel-header-bar`（44px，返回/取消 · 标题 · 确定），层级行 `panel-header-breadcrumb`（**新增尺寸 token `--bv-panel-header-breadcrumb-height: 32px`**，非颜色 token 只写 `vant.css`）**独占其下一行**并**左对齐**（路径从根读起）；**层与层之间不留横向内边距**，整条链才读成紧凑的「根/中/当前」一串（给了内边距就散成几段、分隔符也不再贴住层名）。有面包屑时工具栏行的标题**整段让位**（同一条链不说两遍）；层级行独占一行后也不再需要用 `--bv-panel-header-title-inset` 给两侧按钮让位（该 token 仍归工具栏行的标题使用，未删除）。取舍更新为四条（新增第 ③ 条）。**可复用的教训：共享零件里「同一行塞两类信息」是布局债** —— 它把一个组件的可读性绑在最长的那个值上；拆成两行后每行各自定高、各自对齐，改动只落在共享零件与一个尺寸 token，其余部分零回归（PC 无抽屉头部、`Select` 无面包屑 → 只铺工具栏行）。`scripts/visual-check.mjs`的`probeMenu`新增`headerCrumbRow` 症状级指标（实机 390×780：`belowBar=true`、`barBottom=top=491`、`height=32`、`startsAtLeft=16`、`separatorGaps=[0]`，面板高 317 → 349）；测试 227 → **228 例**。\*；v18 **H5 头部面包屑改「各层选中值」构成（2026-09-21 用户需求「1层选中值/2层选中值/3层选中值 这种格式，图中不要前面的，后面加上选中的」）**：v17 的链是「根层标题 → 当前层」，链首那格说的是「这个面板叫什么」（`title`），与「用户在上面选过哪一条」不同源，读起来像凭空多了一段。修正为 **链身 = 进入各层时点的那一项 + 链尾 = 当前层的选中项**（`移动到 / 更多位置 / 共享盘`），即每层各显示自己的选中值，正好等于「确定后会回填到触发器的整条链」，与 `MenuTriggerPath`的回显是同一件事的两面；根层标题**移出链上**。渲染门槛随之由「层数 > 1」改为`trail.length > 0`（根层没有「进来时点的那一项」）；`PanelHeader`契约不变 —— 仍只按「有没有`onSelect`」渲染，不判层数、也不区分「层」与「取值」（规则 ⑨ 的取舍①②同此改写）。三条取舍：**选中项只在当前层里才补进链尾**（它挂在别的分支时补进去会被读成「当前层的子项」，与眼前这一层对不上）、**末项不可点**（末项 = 当前层，或当前层的选中项）、**链首可点跨层跳**。**可复用的推论（按「选项」组织链、而不是按「层级」组织链的直接代价）**：链身＝「进来时点的那一格」意味着**当前层的入口项在链上就在末位之前**、不可点 —— 于是停在第二层且该层已有选中值时，链上**没有任何可点项**，「一键回最上层」的能力随根层标题一并消失，只能用返回箭头逐层退；要恢复得另设一格「面板名」或放宽末项的可点条件。`scripts/visual-check.mjs`的 7h 场景同步改为「先再下钻一层再点链首」（7g 停在第二层时链上无可点项，探针会`NOT_FOUND`空跑）；测试 228 → **229 例**。\*；v19 **H5 头部面包屑每一项都可点（2026-09-21 用户需求「这三个都可以点，点到【移动到】应该是返回那一层，点到哪个就是那个层」）**：v18 的链「第 i 项 = 第 i 层的选中值」是对的，但`onSelect`只给了祖先项 —— 末项（当前落点）与「链身那格」都不给，于是**二级且该层已有选中值时链上一个可点的都没有**，「一键回最上层」随根层标题一起消失，只能逐层按返回（v18 自己记下的推论）。修正为**链上每一项都接`setPath(path.slice(0, i))`**：链首即回最上层，链尾落回当前层、点了收敛在原地。`PanelHeader`的契约只多一条行为：**末项可点也仍按「当前落点」着色并标`aria-current`** —— 着色与无障碍标记只看**位次**（末项），不看有没有 `onSelect`。**可复用的教训：「不可点」被当成「当前位置」的表达手段时，导航能力会随标记一起丢** —— 「可点」与「当前」是两根正交的轴（能力 vs 位次），早先的实现把它们绑成一根（有 `onSelect`才算祖先项、没有才算当前），一个决定就同时锁死两件事。测试：链上 tags 全为`button`，`dropdown-menu.test.tsx` 里「点链首一步跨两层」拆成「点链首回最上层（`layers 1` + 轨道归零 + 面包屑收起、标题回来）」与「点中间项跨两层（`layers 2` + 轨道 −100%）」两例，`panel-header.test.tsx`新增「末项给了`onSelect`也是`button`、但仍带 `aria-current`」；229 → **231 例**。`scripts/visual-check.mjs`的`probeMenu`注释同步改写，7h 判据变为「点链首后`layers 1`+ 轨道归零 + 面包屑整行收起、标题回来」（实机三级`["移动到","更多位置"]`tags`["button","button"]`、颜色 `[rgb(150,151,153), rgb(50,50,51)]`：都可点、只有末项浓色）。\*；v20 **H5 菜单左键统一「取消」＋每层都铺面包屑（2026-09-21 用户需求「不要这个（返回箭头），还是取消，然后第一层也要有面包屑」）**：v16 起「跨层回头」已由链上点名满足，返回箭头只是「逐层退」的第二种粒度，用户否掉了它并要第一层也有层级行。① **左键统一成「取消」**（`h5/menu.tsx`下钻中不再传`onBack`、删掉只服务箭头的 `pop` 回调；`PanelHeader.onBack`/`backLabel`保留给其它需要「逐层退」的多层面板，菜单下`panel-header-back`恒为`null`）；② **每层都铺面包屑，根层只有一格面板名**（`levels`memo 改名`crumbs` 并加根层分支：`trail.length === 0`时返回`[{ label: title }]`、`title`未传则空数组；这一格是当前落点因而不给`onSelect`，渲染成不可点的 `panel-header-crumb-current`），头部渲染门槛随之写成 `crumbs.length > 0 || staged`（与旧式等价）。**可复用的推论：「结构在状态切换处跳变」比「少一行信息」更贵** —— 层级行既然是这一类面板的固定语法，就应当在最浅的一层也成立；用「根层退化为居中标题」省下的 32px，换来的是一处每进出一层都会发生的视觉跳变（行数与对齐同时变）。测试：`dropdown-menu.test.tsx` 中依赖返回箭头与「根层退化为普通标题 / 面包屑收起」的断言全部改写为「点链首回根层、面包屑缩成一格」，并新增「根层也铺面包屑：一格面板名，是当前落点」与「下钻中左键是『取消』，不再渲染返回箭头」两例；231 → **233 例**。`scripts/visual-check.mjs`的 7h 判据同步改为「点链首后`layers 1`+ 轨道归零 + 面包屑缩成一格`["选择位置"]`（`headerTitle null`）」（实机 390×780：根层 `["更多操作"]`tags`["span"]`；三级 `["移动到","更多位置"]`tags`["button","button"]`；暂存点选 / 打开即定位 `["移动到","项目文档"]`且`header{cancel:true, confirm:true, back:false}`；`headerCrumbRow`五场景一致`{belowBar:true, barBottom:491, top:491, height:32, startsAtLeft:16}`）。\*；v21 **P2 DatePicker 落地（模式 C 的第三种成因：交互范式不同）**：§6.5 规则 ④ 由「两种成因」扩为**三种**并给出可操作的收紧判据 —— 「**当两端连『当前值显示在哪里』都对不上时，一定是 C**」（滚轮把值放在正中的高亮行、月历把值放在格子底色上，这不是同一个 primitive 的两种外壳）。落地要点：值恒为`'YYYY-MM-DD'`字符串（不用 `Date`，避开 `new Date('2026-09-20')` 的 UTC 解析差一天）；`min`/`max` **显式传入是硬边界、不传时默认今天±10 年且会被外部值向外撑开**（不静默夹走用户给的值）；夹紧是**逐字段**的（只抬越界那一级）；`columnsType` 只在 H5 生效且刻意不通过 props 泄露（PC 月历缺日不成立）；H5 惯性/吸附不自研 —— 原生动量 + `scroll-snap-type: y mandatory`，`hooks/use-picker-column.ts` 只做算索引与兜底对齐，兜底带**位移守卫**（±0.5px 内不动，否则与 120ms 回写自激抖动）。**缺陷修正一号（真机探针发现，单测当时在为错误行为背书）**：`resolveCursor` 无值兜底写成`{year: today.year, month:1, day:1}`，于是**区间模式（两段式草稿恒以`''`开场，这是主路径）与列裁剪形态打开时滚轮停在 1 月 1 日**，而单值形态因分发层预填今天把这条路径盖住了 —— 它躲过了 tsc/ESLint/288 单测/静态 CSS 核对。更值钱的是`tests/date-value.test.ts` 当时写着`expect(resolveCursor(undefined,...)).toEqual(D(today.year,1,1))`：**把实现的行为当规格抄下来，等于给缺陷上锁**（断言必须来自「我期望什么」，不是「我看到什么」）。修法：兜底改`{...today}`，列裁剪补位仍由后续几行负责。**缺陷修正二号**：区间高亮只接「起点 + 悬停终点」，已提交区间反而没底色（用户以为没选上）→ `displayRange` 同时覆盖两种来源。**工具链两处**：① `index.css` 加`@source not "./docs"` / `"./.workbuddy"` —— Tailwind v4 会把架构文档里的`leading-[var(--bv-<组件>-line-height)]` 当候选类编译出**非法 CSS**（构建期两条 warning），换成真名的示例不报错但同样把垃圾规则打进 dist（消费者一起拿走），产物 CSS 65.59 → 65.19 kB、warning 归零；② `scripts/measure.mjs` 改为**自带静态服务器 + 默认 PC/H5 各测一次 + 页面没加载出来（探不到 `[data-mode]`）时 EXIT 1** —— 此前它依赖外部先起 preview，而**页面 404 时探针照样返回空结果并 EXIT 0**，这就是「本门在无服务器时空跑通过」的由来（比报错更危险）。`scripts/visual-check.mjs` 新增 8 / 8b / 8c / 8c2 / 8d 五个场景与 `probeDate`（含 `inputValue`、`snapRemainder`、`inRangeCount` 等症状级指标），以及 `wheelScroll`（CDP `mouseWheel`，按**实测行高**算 deltaY）与 `hitDateCell`（按序号取本月格子，不写死日期）。测试 233 → **288 例**（17 文件：DatePicker 双模式 18 + 纯函数 37），registry 34 → **40 item**。详见 matrix §3.7。；v22 P2 DatePicker 的日期引擎改为**复用上游**（2026-09-23）：补上「先查上游再决定自研」这一步 —— **React 版 `@radix-ui` 没有 Calendar / DatePicker 原语**（只到 `Popover`），`radix-vue` 的 `DatePicker` 属 Vue 生态不可用，故 PC 月历交 `react-day-picker` v10，本库只保留渲染层与值语义（键盘自持、`data-slot`/`data-*` 契约不变，门 5/6/7 的探针因此基本无需重写）；连带删除自研的 `buildMonthGrid` / `CalendarCell` / `weekdayLabels` 与 `CalendarMonth`（单测 288 → **284 例**）；§1 运行时依赖白名单 8 → **9 个**（加 `react-day-picker`）；§6.5 规则 ⑤ 新增「日期网格交给 rdp」一条，并记下 rdp 的**受控开关在 `onSelect` 上** —— 不传即走非受控、prop 更新被静默忽略，且 tsc/ESLint/vitest/构建四门全无感；`vite.config.ts` 加 `chunkSizeWarningLimit: 700`（rdp 让验证台 bundle 450 → 518 kB 越过 vite 默认 500 kB 阈值，与第 4 门「stderr 必须为空」冲突；dist 是验证台产物、非发布物，该阈值在此没有可执行的指导意义）\*
