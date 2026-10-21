# Bivane /baɪˈveɪn/ · 碧帆 — 双端组件库架构

> 定位：以 Vant 设计语言为视觉源，用 React + Tailwind 以 shadcn copy-paste 形态重写；
> **同一套组件 API，小屏走 H5 交互、大屏走 PC 交互**。
> 本文档是架构宪法；逐组件双模式定义见 `bivane-responsive-matrix.md`，两者一起投喂。

---

## 1. 项目基本信息

### 1.1 品牌

| 项          | 取值                      | 说明                                                                                      |
| ----------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| 名称 / 读法 | **Bivane** / `/baɪˈveɪn/` | 双叶（bi-）风向标（vane），一叶朝小屏、一叶朝大屏；保留 Vant 的 van 血统。README 首行标音 |
| 中文名      | **碧帆**                  | 「帆随风转」呼应风向标                                                                    |
| Slogan      | 一套 API，两端各得其所    | One API. Screen-aware.                                                                    |

### 1.2 工程约定

| 项                             | 约定                                                                                                                                                                                                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 包名 / CLI                     | `bivane`；`npx bivane add date-picker`                                                                                                                                                                                                                     |
| Registry                       | namespace `@bivane/<name>`；`npx shadcn@latest add @bivane/date-picker`                                                                                                                                                                                    |
| Token 前缀                     | `--bv-*`                                                                                                                                                                                                                                                   |
| 组件命名                       | 不加前缀（`<DatePicker>`），保持 shadcn/Vant 直觉                                                                                                                                                                                                          |
| 技术栈                         | React 19 + TypeScript（strict，禁 any）+ Tailwind CSS v4 + Vite                                                                                                                                                                                            |
| 运行时依赖（9 个，新增需评审） | `react`、`react-dom`、`clsx`、`tailwind-merge`、`class-variance-authority`、`@radix-ui/react-dialog`、`@radix-ui/react-popover`、`@radix-ui/react-dropdown-menu`、`react-day-picker`（仅 PC 月历）。手势、滚动锁、虚拟滚动、滚轮吸附均**自研**，不引手势库 |
| 分发形态                       | shadcn registry（copy-paste 源码进用户项目），不发布传统 npm 组件包                                                                                                                                                                                        |
| 断点                           | 默认 768px，`ResponsiveProvider` 可配                                                                                                                                                                                                                      |
| 模式判定                       | 宽度 + 指针能力双重判定（§6.2）                                                                                                                                                                                                                            |
| 法律边界                       | 禁止以 "Vant" 作包名/品牌/组件名；README 必须含 "Design language inspired by Vant (Youzan)"；MIT                                                                                                                                                           |

## 2. 目录结构

```
bivane/
├── apps/docs/                       # 文档站：每个组件提供 H5/PC 双模式 demo
├── packages/
│   ├── registry/                    # registry.json + r/<name>.json
│   └── tokens/styles/               # vant.css / vant-dark.css / modes.css / utilities.css / theme.css
├── components/
│   ├── responsive/                  # ⭐ 对外主入口：只做模式分发与 API 统一
│   ├── h5/                          # 小屏实现（手势、滚轮、底部弹层）
│   ├── pc/                          # 大屏实现（锚定浮层、日历面板、键盘导航）
│   ├── ui/                          # 无交互差异的共用件（Button、Cell、PanelHeader、Overlay…）
│   └── providers/                   # responsive-provider
├── hooks/                           # 共享逻辑（use-device-mode / use-lock-scroll / use-picker-column …）
├── lib/utils.ts                     # cn() 等
└── tests/
```

三层职责不可混淆：`responsive/` 只分发与统一 API，`h5/` 与 `pc/` 只做各自交互，共享逻辑下沉 `hooks/` 或 `lib/`。

## 3. Token 体系

### 3.1 基准映射

Vant `--van-*` 完整映射为 `--bv-*` 语义变量；**组件只允许引用语义 token，禁止硬编码色值**。
基准取值（`packages/tokens/styles/vant.css` 是唯一事实源，已按 Vant 4 源码核对）：

| 语义变量                                                      | 取值                                                 |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `--bv-primary / success / danger / warning`                   | `#1989fa / #07c160 / #ee0a24 / #ff976a`              |
| `--bv-text / -2 / -3`                                         | `#323233 / #969799 / #c8c9cc`（gray-8/6/5 三级文本） |
| `--bv-border / --bv-surface / --bv-muted / --bv-active-color` | `#ebedf0 / #fff / #f7f8fa / #f2f3f5`                 |
| `--bv-padding-base / xs / sm / md / lg / xl`                  | `4 / 8 / 12 / 16 / 24 / 32`                          |
| `--bv-font-xs / sm / md / lg`                                 | `10 / 12 / 14 / 16`（行高 `14 / 18 / 20 / 22`）      |
| `--bv-radius-sm / md / lg / max`                              | `2 / 4 / 8 / 999`                                    |
| `--bv-border-width`                                           | `1px`（0.5px hairline 靠 `scale(0.5)` 伪元素）       |
| `--bv-z-popup / --bv-z-toast`                                 | `2000 / 3000`                                        |

### 3.2 间距分两层，互不越权

间距问题几乎都来自层级混用——组件内部间距与页面骨架间距混在一个尺度里调：

| 层级         | 谁用                 | Token                                                     | H5          | PC           | 随模式变          |
| ------------ | -------------------- | --------------------------------------------------------- | ----------- | ------------ | ----------------- |
| A · 组件内部 | 组件自己             | `--bv-padding-*` + 组件级 token                           | 等于 Vant   | 同左         | ❌ 绝不           |
| B · 页面骨架 | 页面 / docs / 业务页 | `--bv-gutter` / `--bv-block-padding` / `--bv-section-gap` | 8 / 16 / 24 | 12 / 24 / 32 | ✅ 随 `data-mode` |

硬规则：

1. 组件内部间距任何模式下不改写——视觉保真的底线。
2. 页面骨架间距随模式放宽，不动组件。
3. 横向基准恒为 16px（`--bv-padding-md`）：页面标题与白块内容都对齐组件 16px 内边距。
4. 相邻组件行内间距用 `gap-bv-gutter`，不写死 `gap-2`；图标与文字间的 4px 属 A 层，组件自控。
5. 区块标题与内容 `mb-bv-sm`、区块之间 `mb-bv-section`，不用裸 margin 拼凑。

### 3.3 `@theme inline` 与模式变体

`theme.css` 的 `@theme` **必须带 `inline`**：

```css
@theme inline {
    --color-bv-surface: var(--bv-surface);
    --spacing-bv-md: var(--bv-padding-md);
}
```

否则 Tailwind 在 `:root` 提前求值，容器级 token 覆盖（深色主题、页面级间距）全部失效。
配套两个 CSS 变体用于**模式 A（纯 CSS 差异）**，比媒体查询可靠（Provider breakpoint 可配，媒体查询会失配）：

```css
@custom-variant bv-h5 ([data-mode='h5'] &);
@custom-variant bv-pc ([data-mode='pc'] &);
```

优先用模式相关 token（`py-bv-block`）；需要显式分支写 `bv-pc:py-bv-lg`，不写 `md:`。
多风格机制：每套风格 = 一个只含 `:root` 变量的 CSS 文件，组件代码零改动；格式兼容 tweakcn。

### 3.4 Token 消费的三类静默失效

jsdom 不做 CSS 级联，单测抓不到这些——类名在、样式却不生效。

**① 内边距拆分量：用 `px-[...]` / `py-[...]`，禁用 `[padding:...]`**
任意属性语法不参与 tailwind-merge 冲突消解，会被同元素 `p-0` 反向覆盖。token 侧拆 `-padding-x` / `-padding-y`：

```css
--bv-button-normal-padding-x: 15px; /* Vant: 0 15px */
```

```tsx
"py-0 px-[var(--bv-button-normal-padding-x)]";
```

**② 字号在前、行高在后，成对书写**
反序时 tailwind-merge 会删掉 `leading-*`，行高静默退回主题默认值。组件级行高显式写
`leading-[var(--bv-<组件>-line-height)]`，不复用通用 `--bv-line-*`。

**③ 新增颜色 token = 三处同时补齐，缺一即「类名保留、样式为空」**

| #   | 位置                                                     | 漏掉的后果                           |
| --- | -------------------------------------------------------- | ------------------------------------ |
| 1   | `vant.css`（随模式变的写 `modes.css`）定义 `--bv-<name>` | 变量未定义                           |
| 2   | `theme.css` 的 `@theme inline` 声明 `--color-bv-<name>`  | 工具类 `bg-bv-<name>` **完全不生成** |
| 3   | `lib/utils.ts` 的 `BV_COLORS` 注册命名空间               | 外部 className 无法覆盖默认值        |

验证只能查产物：`npm run build` 后在 `dist/assets/*.css` 里**搜工具类名**（`bg-bv-overlay{...}`），
不要搜 `--color-bv-*`——inline 已内联，产物里永远不存在。

### 3.5 Token 文件必须随 registry 全量分发（5 个 CSS）

demo 与消费者走同一条链路：`index.css` 只保留顶部集中的 6 行 `@import`（中间插 `@import` 会被 CSS 规范忽略）。
`tokens.json` 的 `files` 必须覆盖 `packages/tokens/styles/` 下**每一个**文件：

| 文件            | 作用                                                   | 缺失症状                                   |
| --------------- | ------------------------------------------------------ | ------------------------------------------ |
| `vant.css`      | `--bv-*` 实际值                                        | 变量未定义                                 |
| `vant-dark.css` | `.bv-theme-dark` 深色覆盖                              | 无深色主题                                 |
| `modes.css`     | 随 `data-mode` 变化的变量                              | 两端视觉无差异                             |
| `utilities.css` | 安全区 + 弹层动画原子层                                | 刘海屏遮挡、动画不跑                       |
| `theme.css`     | `@theme inline` 映射 + `bv-h5:`/`bv-pc:` 变体 + 基础层 | **所有 `bg-bv-*` / `p-bv-*` 工具类不生成** |

另：`index.css` 用 `@source not "./docs"` / `@source not "./.workbuddy"` 排除非源码目录，
否则文档里的 Tailwind 类名示例会被编译进产物（非法 CSS warning + 死规则）。

## 4. 组件硬性契约（生成后逐条自检）

1. **位置**：按 §2 三层归属放置，不得错层。
2. **结构**：`forwardRef` + 具名导出；根元素带 `data-slot="<name>"`；自适应组件必带 `data-mode="h5|pc"`（`useDeviceModeAttrs`）。
3. **变体**：用 `cva`，命名对齐 Vant prop 语义（`type`: primary/success/danger/warning/default；`size`: large/normal/small）。
4. **样式**：只用 Tailwind + `var(--bv-*)` + `cn()`；禁内联 style（动态值除外）。
5. **可访问性**：交互件带 role/aria-\*；H5 触控目标 ≥ 44px；PC 必须支持键盘操作与焦点管理。
6. **安全区**：贴边组件（Tabbar/NavBar/弹层）处理 `env(safe-area-inset-*)`。
7. **类型**：strict TS，props 显式导出（`export type XProps`），透传 `className`。
8. **双轨 API**：弹层类同时提供声明式与命令式（§5）。
9. **props 双模式完全一致**：交互差异不得经 props 泄露；唯一逃生舱 `forceMode?: 'mobile' | 'desktop'`。
   取值是 `DeviceMode`，**不是** `h5`/`pc`——后者只是 DOM 属性值，当 prop 传会编译报错。
10. **默认值逐字对齐 Vant 源码**（如 Button 的 `size` 默认 `normal`，不是 `base`）。
11. **间距只从两层取**（§3.2）：组件内禁裸 `gap-2`、`mt-4`。
12. **写法**：内边距 `px/py-[...]`（禁 `[padding:...]`）；字号在行高前。改完过 `spacing-contract` 测试（§3.4）。
13. **基础件不自判定 mode**：遮罩、滚动锁、跨模式共用触发器等，一律由调用方传入**已解析**的 `mode?: DeviceMode`。
    Portal 挂在 `body` 下脱离 `[data-mode]` 子树，**兄弟节点也不继承**——面板、遮罩及各自内部元素都要自带 `data-mode`。
    自判定会让 `forceMode` 逃生舱在这些零件上静默失效。
14. **`data-slot` 槽名与 CSS 选择器逐字一致**：`utilities.css` 动画挂在 `[data-slot='...'][data-state='...']`，改名必须全局搜选择器。
15. **`style` 合并顺序**：`{...props}` 必须排在显式 `style` **之前**，否则调用方 style 覆盖组件合并的 `zIndex`/`pointerEvents`。
16. **运行期依赖的 CSS 必须进 registry**：判据 = `tokens.json` 的 `files` 覆盖 styles 下每个 CSS（§3.5）。
17. **跨模式共用零件的外壳差异用 JS 分支，不用 `bv-h5:`/`bv-pc:` 变体**：变体编译成后代选择器，
    元素自身带 `data-mode` 不命中，且共用零件未必有 `data-mode` 祖先。做法：传已解析 mode +
    `xxxShellClass(mode)` 纯函数。变体只用于弹层/面板内部（必有自带 data-mode 的容器祖先）。
18. **测试**：静态件 1 个渲染测试；交互件 H5/PC 各 1 个行为测试（mock `matchMedia`）。
19. **完成门**：`tsc --noEmit` + ESLint 零错误零警告，才算完成。

## 5. 双轨 API（弹层类）

```tsx
<Dialog open={open} onOpenChange={setOpen} title="确认" />; // 声明式
showDialog({ title: "确认", message: "..." }); // 命令式（Vant 惯例）
```

命令式内部复用声明式组件，portal 挂载全局容器并自动卸载，同样走自适应分发。

## 6. 响应式双实现机制

### 6.1 三种落地模式

| 模式                      | 适用                                                       | 做法                                                                |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **A · 纯 CSS 差异**       | 尺寸/间距/排布不同，交互相同                               | 模式 token + `bv-h5:`/`bv-pc:` 变体，无 JS                          |
| **B · 同 primitive 换壳** | 交互语义相同、容器形态不同（Dialog：底部抽屉 vs 居中弹窗） | 单文件内按 mode 分支，复用同一状态与内容                            |
| **C · 双实现**            | 交互范式本质不同（滚轮 vs 月历、下拉浮层 vs 底部列表）     | `responsive/` 分发 → `h5/` 与 `pc/` 独立实现，共享逻辑下沉 `hooks/` |

判定：**能 A 不 B，能 B 不 C**。可操作判据：问「**同一个 primitive 换个壳，能不能同时满足两端？**」
不能才是 C；收紧版：**两端连「当前值显示在哪里」都对不上时，一定是 C**。

### 6.2 模式判定（`useDeviceMode`）

```
mode = 'mobile' 当 width < breakpoint 或 (pointer: coarse AND hover: none)
forceMode prop → Provider 配置 → 自动判定（优先级从高到低）
```

- 基于 `matchMedia` + `useSyncExternalStore` 订阅。
- SSR/首屏保守渲染 `desktop`，挂载后一帧内切换；切换用 `data-mode` 驱动，不条件卸载关键 DOM。
- 尺寸类差异（模式 A）一律走 CSS，不参与 JS 判定，规避抖动。
- `<ResponsiveProvider breakpoint={768} mode="auto">`；文档站与测试用 `mode` 强制覆盖。

### 6.3 包体策略

PC 用户不下载滚轮/手势代码：`h5/` 与 `pc/` 实现用 `React.lazy` + `Suspense`（空壳 fallback）动态引入；
动态组件内部不得再依赖 Suspense 之外的同步副作用。

### 6.4 技术选型

| 场景                                           | 方案                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 底部弹层拖拽关闭                               | 自研 pointer 手势（`use-drag-to-dismiss`，位移超 16px 才认速度）                                                                                           |
| 滚轮 Picker                                    | 原生惯性 + CSS scroll-snap 吸附；`use-picker-column` 只做算索引与兜底对齐                                                                                  |
| 滚动锁                                         | 自研双策略（H5 `fixed`+记录 scrollTop 治 iOS 橡皮筋；PC `overflow:hidden`+补偿滚动条宽度）                                                                 |
| PC Dialog                                      | `@radix-ui/react-dialog`                                                                                                                                   |
| PC 浮层（Select/DatePicker/TimePicker 触发器） | Radix Popover 的碰撞检测；**触发器共用件用 `Anchor` 不用 `Trigger`**（避免 Slot 叠加 onClick 导致双触发）                                                  |
| PC 多层菜单                                    | `@radix-ui/react-dropdown-menu`（焦点/typeahead/子菜单整套交给 Radix）                                                                                     |
| Tooltip 气泡 / 说明                            | **自研**：PC hover/focus 跟随指针气泡（指针点定位，Radix Tooltip 是触发元素锚点模型，跟不了手）；H5 不做浮层，说明常驻成 ⓘ 信息提示条（触屏无 hover 惯例） |
| 长文展开/收起                                  | **自研 Ellipsis**（`-webkit-line-clamp` + scrollHeight 实测），不引截断库；与 Tooltip 解耦，任何文本容器可单用                                             |
| Popover 容器                                   | 两端都建在 `@radix-ui/react-popover` 上：H5 只取气泡（抽屉另复用 Popup），PC 全用；触发器仍一律 `Anchor`                                                   |
| PC 月历日期引擎                                | `react-day-picker` v10，本库只留渲染层、值语义与键盘                                                                                                       |
| SwipeCell / PullRefresh                        | 自研手势                                                                                                                                                   |

**自研还是交给 Radix 的判据**：交互复杂度是否值得自研。单层列表选择（Select）自研以精确对齐行为；
多层树/含焦点契约的浮层（DropdownMenu）交给 Radix。不是「一律 Radix」。

**H5 独有能力的降级**：PullRefresh、SwipeCell、NumberKeyboard 在 PC 必须给等价交互
（刷新按钮、hover 操作区、普通输入框），不得隐藏功能。

### 6.5 模式 C 的落地规则

1. **外壳差异 JS 分支**：同契约 17。变体只用于弹层内部。
2. **模式 C 不写 `modes.css` 覆盖**：两份实现各自读自己的 token（如 `--bv-select-option-height` /
   `--bv-select-pc-option-height`），差异在命名期固定。`modes.css` 只服务模式 A/B。
3. **共享逻辑表达为纯函数**：`use-select-state.ts` 导出 `filterItems` / `nextEnabledIndex` 等纯函数，
   React 绑定只薄薄一层，边界判定可直接单测。
4. **模式 C 的三种成因，判据不是「容器不同」**：
    - Select：容器 + 信息模型都不同；
    - DropdownMenu：**导航范式**不同（H5 面板栈替换视野，PC 父层留在原地、子菜单右展）；
    - DatePicker：**交互范式**不同（一维连续滚动吸附 vs 二维网格焦点巡航）。
      TimePicker 最初按 C 实现（PC 为可点击 listbox），后改判 **B**：两端共用同一个滚轮 primitive
      （`TimeWheelRow`），只换外壳（底部弹层+顶部工具条 vs 锚定浮层+底部确认条）。判据始终是
      「primitive 能否共用」，以代码现状为准。
      推论——**状态归属取决于是否跨模式同义**：`value`/`open`/暂存草稿两端同义 → 分发层；
      H5 的面板栈路径/`activeEnd`、PC 的视图月/键盘驾驶列 → 实现层。别照抄别的组件的归属。
5. **暂存确认是值语义，归分发层**：`confirmable`（点选项只打勾、确定才提交、取消放弃）最终是
   `onChange` 参数，草稿收在分发层，h5/pc 只做受控展示。**选择类工具栏默认只在 H5 渲染**
   （触屏点选是高成本动作，鼠标点一下就该生效；Select/DropdownMenu 的 PC 点选即生效）；
   TimePicker 两端都是滚轮（多列调好才算选完），**两端都走暂存 → 确定**（PC 确认条在浮层底部）；
   DatePicker 仅 H5 滚轮走确认，PC 月历仍点选即关。共享工具栏 `components/ui/panel-header.tsx`
   （槽名 `panel-header-*`，token 组 `--bv-panel-header-*`），Select/DropdownMenu/DatePicker 共用。
6. **树形值回显整条链**：选中值来自树的组件（DropdownMenu/Cascader/Area/Picker），回显必须是
   「根 → 节点」的完整层级路径（`findMenuPath` + `MenuTriggerPath`），不能只回填末级 label（同名叶子不可区分）。
   顶层项退化为纯 label；值失效回退原 trigger 文案；颜色/gap 复用既有 token，不新增。
7. **展开即定位**：`initialPath` = 选中值祖先 value 链，由分发层派生；只在 open 翻转那一刻定位，
   关闭即收回；两端各自滚入视野（`block:'nearest'`）。**在 Radix 受控浮层上做打开即定位/滚动，
   先假设节点不在同一提交出现**：`FocusScope` 延迟聚焦可能被判焦点外逃而收回浮层；`Presence` 节点晚挂载，
   依赖 open 的 effect 拿不到 ref——滚入视野放进 ref 回调，且 ref 身份保持稳定。
8. **H5 多层面包屑（PanelHeader 的 `breadcrumb`）**：根层铺一格面板名（不可点），下钻后链身 =
   进入各层时点的项、链尾 = 当前层选中项；**每一项都可点**（点第 i 项 = path 截到 i，落回该层），
   末项仍按位次着色并标 `aria-current`；左键统一「取消」，不渲染返回箭头（`onBack` 留给其它逐层退面板）。
   面包屑独占工具栏下方一行，左对齐、项间无横向内边距、横向可滚；滚动 effect 依赖用**项数**而非数组身份。
9. **TimePicker 两端共用滚轮行**（`components/ui/time-parts.tsx` 的 `TimeWheelRow`，槽名
   `time-picker-wheel` / `-scroller` / `-item`，单一 token `--bv-time-picker-wheel-item-height`=44px，
   两端同密度）：滚轮项 `tabIndex={-1}` 不进 Tab 流；`data-selected` 标当前值项，列容器 `data-active`
   标键盘正在驾驶的列（中央高亮带只画在 active 列）。键盘面板级统一接管：↑↓ 改当前列值、←→ 换列、
   Home/End 首尾、PgUp/PgDn ±10、Enter 确定、Esc 取消；焦点落在底部确认条上时不拦截。
   单值无值草稿预填「现在」（`nowParts()`），不是 `00:00:00`。
10. **接管上游组件先确认受控开关**：`react-day-picker` 的受控开关在 `onSelect` 上——不传则走非受控，
    prop 更新被静默忽略（症状：区间悬停不动、点选错位，四门全绿）。传空实现 `RDP_NOOP_SELECT` 拨到受控侧，
    选值仍由 `onDayClick` 负责。凡把状态交给上游，读其源码确认开关，别按 prop 名假定受控。

## 7. Registry 产物

- `registry.json`：`items[]` 含 `name / type / files / dependencies / registryDependencies`。
- 自适应组件的 `registryDependencies` 必须带 `responsive-provider`、`use-device-mode` 及两模式实现文件，CLI 递归解析。
- 发布前在空白 Vite 项目实测 `npx shadcn@latest add @bivane/<name>`。

**内部依赖必须写命名空间形式（实测结论）**：源 registry 里写纯名（`use-device-mode`），
`build-registry.mjs` 统一转成 `@bivane/use-device-mode`。产物里：

| 写法                         | 结果                                                    |
| ---------------------------- | ------------------------------------------------------- |
| `@bivane/use-device-mode` ✅ | 按消费者 `components.json` 的 registries 模板解析，正确 |
| `use-device-mode.json` ❌    | 被当消费者 cwd 的本地文件 → ENOENT                      |
| `use-device-mode` ❌         | 无命名空间，兜给内置 `@shadcn` 源 → 404                 |

消费者必须声明：

```json
{ "registries": { "@bivane": "https://bivane.dev/r/{name}.json" } }
```

本地文件路径安装（`add ./x.json`）对本库不成立；只能走 registry URL。
另：消费者项目存在 `src/` 时 shadcn 会给所有 target 加 `src/` 前缀（期望行为，组件跟 `@/*` 别名走）。

## 8. AI 执行流程（任务卡模板）

```
请按 @bivane-architecture.md 与 @bivane-responsive-matrix.md 生成组件 <Name>。

1. 组件归属：responsive(自适应) / ui(无差异)；列出 h5/ 与 pc/ 实现文件
2. 双模式交互定义（照矩阵填写，不得自行发挥）：H5 交互/手势/动画/降级；PC 交互/浮层/键盘/悬停；落地模式 A/B/C + 一句理由
3. Props 清单（双模式完全一致）
4. 共享逻辑：需下沉 hooks/ 的部分（纯函数优先）
5. 依赖：内部组件/hook，registryDependencies 列全
6. 完成标准：§4 全部契约 + §9 质量门
7. 产出：responsive/h5/pc 源码 + registry JSON + 双模式测试 + docs 双模式 demo
```

执行顺序（每完成一档跑全量 tsc + ESLint + vitest）：

- **P0 基建** ✅：token → `lib/utils` → `use-device-mode`/Provider → Button → Cell → Tag → Badge → Icon
- **P1 弹层** ✅：Popup → Dialog → Toast → use-lock-scroll
- **P1′ 弹层补全** ✅：ActionSheet（Popup+列表）→ Alert/Confirm（Dialog preset）→ Notify（Toast 换信息模型）→ Loading
- **P2 选择类（最高价值）**：Select ✅ → DropdownMenu ✅ → DatePicker ✅ → TimePicker ✅ → DateTimePicker ✅ → Tooltip/Popover ✅ → Picker ✅ / Cascader ✅ → Calendar ✅
- **P3 表单与列表** ✅：Field/Input/Textarea ✅ → Switch/Checkbox/Radio ✅ → Rate/Slider ✅ → InputNumber ✅ → Uploader ✅ → **Search ✅（2026-10-20，模式 C）** → **Tabs/NavBar ✅（2026-10-20，模式 B）→ Tabbar ✅（2026-10-20，模式 C）** → **List ✅ / Table ✅（2026-10-20，模式 C / C，闭环 P3）**
- **P4 生态** ⬜：第 2/3 套风格 → tweakcn 适配 → 文档站 → registry 发布验证

## 9. 验证与质量门

| 门         | 命令                                          | 标准                                                                                                |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 类型       | `tsc --noEmit`                                | 0 error                                                                                             |
| 规范       | `eslint .`                                    | 0 error 0 warning                                                                                   |
| 测试       | `vitest run`                                  | 全绿；交互件双模式各有行为测试                                                                      |
| CSS 产物   | `npm run build` 后搜 `dist/assets/*.css`      | 新增/改 token 或槽名时必跑：搜**工具类名与槽名**确认规则真生成（§3.4）                              |
| 计算样式   | `npm run measure [url] [width]`               | 真实浏览器复核内边距/行高/骨架间距/遮罩浓度，H5 与 PC 各一次                                        |
| 视觉/交互  | `node scripts/visual-check.mjs`               | 静态服务器 + CDP 无头 Chrome，交互后截图 + 计算值探针，1200px 与 390px 各一次                       |
| 分发完整性 | `npm run registry:build` 后查 `r/tokens.json` | 新增/改 CSS 时必跑：files 覆盖 styles 下每个 CSS（§3.5）                                            |
| 消费者实测 | `npm run consumer:check`                      | 改 registry 构建/import 路径时必跑：空白项目走真实安装、断言落盘 + 消费者侧 tsc/vite build/CSS 探针 |

> CSS 产物门与视觉门独立存在的原因：类型系统与 jsdom 都不做 CSS 级联——遮罩全透明、动画不跑、
> 工具类不生成这类缺陷曾全部通过 tsc + ESLint + 全部 vitest 用例 + 构建。只有查产物和看浏览器能发现。
