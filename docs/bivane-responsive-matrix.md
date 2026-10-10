# Bivane 响应式交互矩阵（H5 / PC 双模式）

> 配套：`bivane-architecture.md`（§6 机制与契约，本文是逐组件定义）。
> **本表是唯一事实源**：生成组件必须照此实现，不得自行发挥；确需偏离先在本文档修订。
> 已实现组件的定死取值与关键坑见 §3（as-built），后续组件照此对齐。

---

## 1. 判定与降级总则

1. 判定优先级：`forceMode` prop → `<ResponsiveProvider mode>` → 自动判定（宽度 < 768px 或 `pointer: coarse && hover: none`）。
   `forceMode` 取值是 `'mobile' | 'desktop'`（`DeviceMode`），**不是** `h5`/`pc`；后者只是 `data-mode` 属性值，写错会 `TS2322`。
2. **能力等价原则**：PC 不得因交互差异丢失功能。H5 独有能力（下拉刷新、滑动删除、数字键盘）在 PC 必须给等价操作（刷新按钮、悬停操作区、普通输入）。
3. **props 一致性原则**：两套实现接受完全相同的 props，差异只在交互与容器形态。
4. **默认值等价**：两种模式下默认值、校验规则、受控语义完全一致。
5. 落地模式：**A** = 纯 CSS 差异｜**B** = 同一 primitive 换壳｜**C** = 双实现。

## 2. 交互矩阵（按组件）

### 2.1 弹层与反馈类

| 组件                | H5 模式                                                                                        | PC 模式                                                                                  | 模式    | 共享逻辑                  | 状态   |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------- | ------------------------- | ------ |
| **Popup（基础）**   | 四向滑入，默认 bottom，圆角 + 安全区，下拉关闭                                                 | `position` 一律降级为居中模态（原值留 `data-position`，实态记 `data-position-resolved`） | **B**   | 进出场动画时长            | ✅ P1  |
| **Overlay / 遮罩**  | 点击即关，蒙层 `rgba(0,0,0,.7)`                                                                | 蒙层 `rgba(0,0,0,.45)`，点击不关（可配）                                                 | A       | 滚动锁定                  | ✅ P1  |
| **Dialog**          | 底部抽屉，可下拉关闭，顶部圆角 16px，内容随高度增长                                            | 居中模态 520px，遮罩/ESC 关闭，焦点陷阱                                                  | **B**   | open 状态机、关闭时机     | ✅ P1  |
| **Toast**           | 顶部居中胶囊，单例（新覆盖旧），2s 自关                                                        | 右上卡片栈，带关闭按钮，可多条并存                                                       | **C**   | 队列与生命周期            | ✅ P1  |
| **ActionSheet**     | 底部动作列表 + 取消按钮分离，项高 48px                                                         | 居中对话框纵向列表，或上下文菜单（≤5 项用 Popover）                                      | **B**   | 选项数据结构              | ✅ P1′ |
| **Alert / Confirm** | 抽屉式或居中窄弹窗，按钮纵向排列                                                               | 居中弹窗，按钮横向右对齐（主按钮在右）                                                   | **A**   | 按钮语义顺序              | ✅ P1′ |
| **Notify**          | 顶部横幅滑入                                                                                   | 右上角角标通知                                                                           | **C**   | 队列管理                  | ✅ P1′ |
| **Loading**         | 全屏遮罩 + 居中转圈                                                                            | 局部骨架屏优先，全屏遮罩降级                                                             | **A/B** | 展示时机                  | ✅ P1′ |
| **Tooltip**         | **无浮层**：说明直接常驻——主体下方一条行首 ⓘ 的信息提示条，全文展示；超长用 Ellipsis 展开/收起 | hover 触发 200ms 延迟，跟随鼠标，focus 锚定，ESC 关                                      | **B**   | 同一份说明文案（content） | ✅ P2  |
| **Popover**         | 底部抽屉（内容 > 3 行）或轻量气泡（≤ 3 行）                                                    | 锚定浮层，Radix Popper 翻转防溢出，键盘可导航                                            | **C**   | 内容渲染                  | ✅ P2  |

### 2.2 选择与输入类（双实现重灾区，核心价值）

| 组件                          | H5 模式                                                                                                                                              | PC 模式                                                                                                                                                                     | 模式    | 共享逻辑                                                          | 状态  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- | ----- |
| **Select**                    | 底部弹层列表，项高 48px，选项 > 10 才出搜索框，单选即关                                                                                              | 锚定浮层 + 虚拟滚动，键盘 ↑↓/回车/输入过滤，多选保持展开                                                                                                                    | **C**   | 过滤、受控值、分组                                                | ✅ P2 |
| **DropdownMenu**              | 底部抽屉，子菜单面板推入；可选值按 value 匹配**完整层级路径**回填，展开自动下钻到选中层并滚入视野，头部铺**可点层级链**；`confirmable` 走暂存 → 确定 | 锚定菜单，子菜单向右展开，快捷键提示；可选值点选即生效、同套路径回填，展开自动铺开选中子菜单链，**无工具栏**                                                                | **C**   | 菜单树结构                                                        | ✅ P2 |
| **DatePicker**                | 底部弹层 + 三列滚轮（年/月/日，5 行制居中），惯性 + scroll-snap，工具条；`columnsType` 可裁列；区间为「开始/结束」两段式入口，两端选齐才可用         | 锚定浮层 + 月历面板（6×7 网格），上下月 + 键盘巡航，触发器可直接输入；区间并排双月，点起点、悬停预览区间带                                                                  | **C**   | 日期值计算（解析/格式化/min-max 逐字段夹紧/区间排序）、滚轮列模型 | ✅ P2 |
| **TimePicker**                | 底部弹层 + N 列滚轮（时/分/秒，5 行制居中），惯性 + scroll-snap，顶部工具条；`columnsType` 可裁列；区间两段式                                        | Radix Popover 锚定浮层 + **与 H5 同源的 N 列滚轮**（仅换外壳），面板级键盘驾驶滚轮（↑↓ 改值 / ←→ 换列 / Home·End / PgUp·PgDn / Enter 确定 / Esc 取消），底部「取消/确定」条 | **B**   | 时间值计算（同日期族）、滚轮列模型                                | ✅ P2 |
| **DateTimePicker**            | 底部弹层 + N 列滚轮（年/月/日 + 时·分·秒三档精度，4/5/6 列），顶部工具条；单值，恒走暂存→确定                                                        | 左月历网格（« < 年月 > » + 星期头 + 6×7 定高网格）选日期 + 右侧时/分/秒 1~3 条居中双横线滚轮列（▲▼ 按住连发），顶部回显草稿时间，底部「此刻 / 确定」；键盘分区驾驶          | **C**   | 6 字段值模型、跨日期时刻的逐字段夹紧、月历网格、时间滚轮列        | ✅ P2 |
| **Calendar**                  | 全屏弹层，月份列表纵向滚动加载，range 拖选                                                                                                           | 内嵌面板（非弹层）可常驻，range 拖选 + 键盘移动                                                                                                                             | **C**   | 月网格计算、区间逻辑                                              | ⬜    |
| **Picker（通用滚轮）**        | 底部弹层 + 多列滚轮联动，列宽随内容                                                                                                                  | 锚定浮层 + 多列面板（可滚动/搜索），或降级为多个 Select                                                                                                                     | **C**   | 列联动、级联数据                                                  | ⬜    |
| **Cascader / Area**           | 底部弹层 + 滚轮级联（选一级推入二级）                                                                                                                | 锚定浮层 + 多列面板 + 面包屑路径，支持搜索定位                                                                                                                              | **C**   | 级联索引、路径回显                                                | ⬜    |
| **Slider**                    | 触摸拖拽，禁页面滚动（`touch-action: none`），热区放大到 44px                                                                                        | 点轨道跳转 + 拖拽 + 方向键微调（±step）                                                                                                                                     | **C**   | 值换算、步长、区间                                                | ⬜    |
| **Stepper**                   | 输入框唤起数字键盘，加减按钮热区 44px                                                                                                                | 输入框 + 上下箭头 + 键盘微调                                                                                                                                                | **A/B** | 边界与步长                                                        | ⬜    |
| **NumberKeyboard**            | 自定义数字键盘弹层（含「完成」键）                                                                                                                   | 不渲染，直接用系统键盘                                                                                                                                                      | **C**   | 输入格式化                                                        | ⬜    |
| **Uploader**                  | 点击唤起相机/相册（`capture`），压缩上传，宫格预览                                                                                                   | 拖拽上传区 + 文件选择器，多选/粘贴，列表视图                                                                                                                                | **C**   | 上传队列、进度、校验                                              | ⬜    |
| **Search**                    | 全屏搜索页，返回退出，历史记录                                                                                                                       | 内联输入框 + 建议浮层，快捷键聚焦                                                                                                                                           | **C**   | 防抖、历史/建议源                                                 | ⬜    |
| **Rate**                      | 点击/滑动选择，热区 44px                                                                                                                             | 点击/悬停预览 + 键盘方向键                                                                                                                                                  | **C**   | 值语义                                                            | ⬜    |
| **Checkbox / Radio / Switch** | 行高 ≥ 48px，整行可点（Radio 在 Cell 内整行触发）                                                                                                    | 标准控件 16~20px，label 可点，键盘空格                                                                                                                                      | **A**   | 受控状态                                                          | ⬜    |

### 2.3 导航、列表与文本类

| 组件                      | H5 模式                                      | PC 模式                                       | 模式  | 共享逻辑         |
| ------------------------- | -------------------------------------------- | --------------------------------------------- | ----- | ---------------- |
| **Tabs**                  | 横向可滑动标签，激活项滚入视野，手势切换内容 | 横向标签 + 下划线，键盘左右切换，不滑动       | **B** | 激活态与切换动画 |
| **Tabbar**                | 底部固定 + 安全区，图标 + 文字               | 侧边导航或顶部导航（依布局配置）              | **C** | 路由映射         |
| **NavBar**                | 返回箭头 + 标题居中 + 右侧动作               | 面包屑或标题栏（左对齐 + 操作区右对齐）       | **B** | 层级与返回逻辑   |
| **List（列表）**          | 无限滚动 + 触底加载 + 下拉刷新               | 分页器或虚拟滚动 + 滚动加载                   | **C** | 数据获取状态机   |
| **Table**                 | 卡片化列表（关键字段 + 展开详情）            | 标准表格，排序/列固定/列筛选/行选择           | **C** | 列定义、排序规则 |
| **PullRefresh**           | 原生下拉刷新，三态文案，阻尼 0.3             | 不渲染下拉区，顶部「刷新」按钮 + 最后更新时间 | **C** | 刷新状态机       |
| **SwipeCell**             | 左右滑动露操作按钮，弹性边界，超阈值自动展开 | 不滑动，行 hover 显示右侧操作按钮             | **C** | 操作项定义       |
| **Sticky**                | `position: sticky` + 顶部安全区偏移          | 同左，吸顶后额外加阴影                        | A     | 吸顶阈值         |
| **Grid / Cell / Divider** | 4 列网格，cell 行高 44~48px                  | 4~6 列，cell 行高 40px，hover 态              | A     | 数据结构         |

## 3. 已落地组件 as-built（后续组件对齐）

### 3.1 总览

| 组件           | 模式 | 本质差异                                                                                                                                                                                                      |
| -------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popup          | B    | 同一 position 状态机 + 内容，H5 贴边滑入壳 / PC 居中模态壳                                                                                                                                                    |
| Overlay        | A    | 仅浓度与「点遮罩关闭」默认值不同                                                                                                                                                                              |
| Dialog         | B    | H5 复用 Popup bottom；PC 用 Radix Dialog                                                                                                                                                                      |
| Toast          | C    | 信息模型不同：H5 单例胶囊 vs PC 可并存卡片栈                                                                                                                                                                  |
| Select         | C    | 信息模型不同：底部热区单选即关 vs 锚定浮层键盘巡航/多选不关                                                                                                                                                   |
| DropdownMenu   | C    | 导航范式不同：面板栈替换视野 vs 子菜单右展、父层留原地                                                                                                                                                        |
| DatePicker     | C    | 交互范式不同：一维滚轮吸附 vs 二维月历焦点巡航                                                                                                                                                                |
| TimePicker     | B    | 同滚轮范式、仅外壳不同：底部弹层+顶部工具条 vs 锚定浮层+底部确认条（滚轮行 `TimeWheelRow` 两端同源；曾按 C 实现，2026-09-23 改判 B）                                                                          |
| DateTimePicker | C    | 日期段范式不同（H5 三列滚轮 vs PC 月历网格，同 DatePicker 判据）；时间段共用同一居中双横线滚轮列（PC 多挂 ▲▼ 微调钮与列间竖线，`DateTimeWheelRow`）；单值字符串                                               |
| Tooltip        | B    | 同一份说明文案、容器密度不同：H5 无浮层，常驻成主体下方的 ⓘ 信息提示条（超长交 Ellipsis 折叠）vs PC hover/focus 触发的跟随气泡；恒纯展示不可交互（2026-10-09 由 C/B 改判：H5 长按气泡不符合触屏惯例，改常驻） |
| Ellipsis       | A    | 两端同形：`-webkit-line-clamp` 截断 N 行 + 实测溢出才出现「展开/收起」；不与 Tooltip 耦合，任何文本容器可单独使用                                                                                             |
| Popover        | C    | 容器范式不同：H5 ≤3 行轻量气泡 / >3 行降级 Popup 底部抽屉（打开瞬间按实测高度定形态）vs PC Radix 锚定浮层；面板内容（自定义区 + actions 行）两端同源                                                          |

### 3.2 P1：Popup / Overlay / Dialog / Toast

**定死取值（写进 token，不在组件里硬编码）**

| 项               | H5                                                 | PC                                  | token                                                   |
| ---------------- | -------------------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| 遮罩浓度         | `rgba(0,0,0,.7)`                                   | `rgba(0,0,0,.45)`                   | `--bv-overlay-background`                               |
| 进出场时长       | 300ms                                              | 200ms                               | `--bv-popup-duration`                                   |
| 弹层圆角         | 16px（贴边内侧两角）                               | 8px（四角）                         | `--bv-popup-round-radius` / `--bv-popup-pc-radius`      |
| 高度上限         | `--bv-popup-max-height`（90vh，**center 也要带**） | `--bv-popup-pc-max-height`（80vh）  | —                                                       |
| Dialog 宽 / 按钮 | 100% 贴边 / 按钮纵向铺满、确认在上                 | 520px / 按钮横向右对齐、最小宽 88px | `--bv-dialog-pc-width` / `--bv-dialog-button-min-width` |
| 点遮罩关闭       | 默认 **true**                                      | 默认 **false**                      | prop 显式传值时两端一致                                 |

**关键规则**

- **Popup PC 降级**：`top/left/right/bottom` 一律渲染居中模态，原值留 `data-position`、实态记 `data-position-resolved`；内容、回调、关闭方式全保留（能力等价）。
- **H5 center 定位逐字对齐 Vant `.van-popup--center`**：`inset-x-0` + `w-fit` + `mx-auto` +
  `max-w-[var(--bv-popup-center-max-width)]`（= `calc(100vw - var(--bv-padding-md) * 2)`），纵向 `top-1/2 -translate-y-1/2`。
  **禁用 `left-1/2 + w-auto`**（shrink-to-fit 可用宽度只剩半屏）与裸 `90vw`。
- **center 必须带 `max-h`**：否则内部滚动容器无约束、滚动失效并溢出视口（Vant 的 max-height 在基类，center 靠继承）。
- **下拉关闭**：自研 pointer 手势 `use-drag-to-dismiss`，纯函数 `resolveDragOutcome()` 判定——**位移超 16px 才认速度**，防抖动误触。
- **滚动锁**：H5 `fixed` + 记录 scrollTop；PC `overflow:hidden` + 补偿滚动条宽度。`mode` 由弹层显式传入锁与遮罩，它们不自判定（架构契约 13）。
- **Toast 单例语义**：连续两次 `showToast`，H5 只见第二条，PC 两张并存——由测试固定。
- **测试开关信号**：jsdom 下 Popup 的 `data-state` 恒为 `closed`（进场 raf 不跑），「开没开」断言触发器的 `aria-expanded`。

### 3.3 Select（模式 C）

**定死取值**

| 项              | H5                                 | PC                                      | token                                                        |
| --------------- | ---------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| 触发器高 / 形态 | 44px，通栏 + `bv-hairline--bottom` | 32px，1px 描边 + 圆角 4px + hover/focus | `--bv-select-padding-y` / `--bv-select-pc-trigger-*`         |
| 选项行高        | 48px                               | 36px                                    | `--bv-select-option-height` / `--bv-select-pc-option-height` |
| 面板最大高      | 60vh                               | 280px（再取 min 与 Radix 可用高度）     | `--bv-select-panel-max-height` / `--bv-select-pc-*`          |
| 浮层动画        | Popup transition 300ms             | `bv-fade-in/out` 120ms                  | `--bv-select-pc-duration`                                    |
| 面板最小宽      | 100%                               | `max(160px, 触发器宽)`                  | `--bv-select-pc-panel-min-width`                             |
| 搜索框          | 选项 > 10 才出现                   | `searchable` 即出现                     | —                                                            |

**关键规则**

- PC 浮层用 **Radix Popover**，翻转/防溢出交 Radix Popper；不使用 `lib/position`（已废弃）。
- 键盘：↑↓ **跳过 disabled 并回绕**，Home/End 首尾，Enter 选中，Esc 关闭；关闭后焦点**显式归还触发器**。
- 触发器 `role="combobox"` + `aria-expanded` + `aria-haspopup="listbox"`，必须有可访问名称（`ariaLabel` 同时落触发器、浮层、列表）；分组用 `role="group"`。
- 箭头朝向表达**展开态**而非展开方向，浮层翻到上方箭头不换向。
- **虚拟滚动边界**：仅「扁平列表 + 项数 ≥ 100 + 实测行高 > 0」启用（分组列表项高不固定，全量渲染）；行高在 `useLayoutEffect` 里量，未量完退化全量。
- 外壳差异走 `triggerShellClass(mode)` 纯函数 JS 分支（架构契约 17），槽名 `select-panel`（PC）/ `popup`（H5）。

### 3.4 DropdownMenu（模式 C）

**定死取值**：行高 48/36（`--bv-menu-row-height` / `--bv-menu-pc-row-height`）；PC 触发器 32px + 描边圆角 4px；
面板 H5 60vh / PC `min(320px, 可用高)`、最小宽 200px；PC 动画 120ms；H5 面板推入 240ms（`--bv-menu-push-duration`，`motion-reduce` 时关闭）。

**关键规则**

- **PC 整套交 Radix DropdownMenu**（多层树的子菜单/焦点/typeahead/禁用跳过不自研），本库只管外观与「选中后干什么」；Select 的单层巡航是自研，两者选型理由不同。
- **槽名三分**：`menu-panel`（PC 主浮层）/ `menu-subpanel`（PC 子菜单）/ `menu-layer`（H5 面板层），合并会导致断言假命中 + 动画挂错对象。
- **状态归属**：`path`（面板栈深度）留 `h5/menu.tsx`；`value` 与暂存草稿跨模式同义，归分发层。
- **层级回显**：`findMenuPath()` 返回「根 → 节点」完整链，`MenuTriggerPath` 逐级渲染；顶层退化为纯 label；值失效回退 trigger 文案；分隔符复用 `--bv-menu-gap`，不新增 token。
- **打开即定位**：分发层派生 `initialPath`（祖先 value 链），H5 面板栈初始化到该层、PC 受控铺开子菜单链；只在 open 翻转时定位，关闭收回，各自 `scrollIntoView({block:'nearest'})`。
- **H5 面包屑**：见架构 §6.5-8（每层铺、可点、aria-current 看位次、左键统一取消、独占一行、滚到末端且依赖用项数）。
- **暂存工具栏只 H5 有**：共享 `PanelHeader`，PC 点选即生效且刻意不解构暂存 props。

**Radix / jsdom 踩坑（测试与实现都适用）**

- Trigger 在 **`onPointerDown`** 开合：`fireEvent.click` 永远打不开；要 `pointerDown`。
- Radix 经 Slot 注入 `disabled: false` 会覆盖传入的禁用态 → `Trigger` 也要显式传 `disabled`。
- `SubContent` 无 `side`/`align`（恒右展），只有 `sideOffset` / `avoidCollisions`。
- 打开即定位两处时序：`FocusScope` 延迟聚焦会被 `onFocusOutside` 判成焦点外逃而收链（放行「焦点落在面板容器本身」）；`Presence` 节点晚挂载 → 滚动写进 ref 回调，ref 身份稳定。
- jsdom 会在带焦点子树移除后**补抛 window blur**，Radix 据此关菜单（浏览器不会）：已在 `tests/setup.ts` 截断 blur。
- roving focus 的焦点落点在 `setTimeout` 里：键盘巡航断言必须 `await`。
- a11y：分隔线 `role="separator"` 不占巡航位；父项 `aria-haspopup="menu"`；关闭后焦点归还触发器；H5 非当前层 `aria-hidden`。

### 3.5 DatePicker（模式 C）

**定死取值**

| 项     | H5                                                                      | PC                                                              |
| ------ | ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| 触发器 | 通栏 + 细下边线，44px                                                   | 32px + 1px 描边圆角 4px                                         |
| 选择器 | 滚轮项 **44px**，可见 5 行（220px），上下留白 2 行；选中行字号 md / 700 | 月历面板宽 **252px**，格 32px 高，6×7，周日为首；并排双月间距 0 |
| 浮层   | Popup bottom + 安全区                                                   | `sideOffset: 4`                                                 |

**关键规则**

- **值恒为 `'YYYY-MM-DD'` 字符串**（区间为有序元组），不用 `Date` 对象（`new Date('2026-09-22')` 按 UTC 解析，东八区差一天）。
- **min/max 两套语义**：显式传入是硬边界，越界由 `clampParts` **逐字段夹紧**（只抬越界的级，不整体跳边界）；不传默认今天 ±10 年，且默认范围被外部值**向外撑开**而非把值夹走。
- `columnsType`（裁列）**只 H5 生效**，不经 props 泄露差异。
- **区间两段式入口（H5）是能力等价不是降级**：三列滚轮一次只能表达一个日期，用 `date-picker-range-tabs` 显式标当前端；草稿允许半截，提交时收口（两端不全不提交不关）。
- **滚轮惯性/吸附不自研**：原生动量滚动 + `scroll-snap-type: y mandatory` + `align: center`；`use-picker-column` 只算索引 + 兜底对齐，兜底带**位移守卫**（已在 0.5px 容差内不再滚，防自激抖动）。
- **无值兜底落今天**：`resolveCursor(undefined)` 取 `{...today}`（列裁剪才把缺的字段清零），不是「今年 1 月 1 日」——区间与裁列是主路径。断言要写「我期望什么」，别把实现现状当规格。
- **PC 引擎用 react-day-picker v10**：本库保留渲染层、`data-slot`/`data-*` 契约、值语义；日期格 `tabIndex={-1}` + `onMouseDown preventDefault`，键盘（←→↑↓/PgUp/PgDn/Home/End/Enter/Esc）面板级自管（rdp 内置巡航要求焦点在格子上，与「焦点留面板」冲突）。
- **rdp 受控开关在 `onSelect`**：不传则非受控、prop 更新被忽略（悬停预览不动、点选错位，四门全绿）；传 `RDP_NOOP_SELECT` 拨到受控侧。值语义不用 rdp 的 `addToRange`（与 Vant「再点即重选」不同），只取 `onDayClick`。
- **区间带两种来源都要画**：已提交区间整条带；只有起点时用悬停日（无悬停退化键盘光标）当临时终点，纯键盘也能看到带。

### 3.6 TimePicker（模式 B，2026-09-23 由 C 改判）

两端**同一套 N 列滚轮交互**（共享 `components/ui/time-parts.tsx` 的 `TimeWheelRow`，逐字同源）：
H5 = Popup 底部弹层 + 顶部 `PanelHeader` 工具条 + 安全区；PC = Radix Popover 锚定浮层 + 底部「取消/确定」条。
改判原因：PC 旧实现是可点击定高 listbox，当前值在哪一行缺乏可读性；滚轮天然把当前值锁在中央高亮带。
共用 primitive 能同时满足两端 → B。

**定死取值**

| 项       | 取值                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------ |
| 触发器   | 与 DatePicker 同：H5 通栏细下边线 44px；PC 32px 描边圆角 4px                                           |
| 滚轮     | 两端共用 `--bv-time-picker-wheel-item-height` = **44px**，可见 5 行，居中吸附；单一 token，无 -pc 密度 |
| PC 浮层  | 宽 `--bv-time-picker-pc-panel-width`，`sideOffset: 4`，翻转交 Radix Popper                             |
| 区间入口 | 两端共用同一条 `time-picker-range-tabs`（开始/结束两段式）                                             |

**关键规则**

- **两端恒走「暂存 → 确定」，单值也不例外**：滚轮要三列都调好才算选完，一动就提交关闭不可用；
  Esc / 点浮层外部 = 取消。草稿归分发层。
- **滚轮项 `tabIndex={-1}`** 不进 Tab 流（Tab 逐个走过 60 个数字无意义），选择面是整个浮层。
- **`data-selected`（项）标当前值；`data-active`（列容器）标键盘正在驾驶的列**，中央高亮带只画 active 列。
- **键盘面板级接管**：↑↓ 改当前列值、←→ 换列、Home/End 列首尾、PgUp/PgDn ±10、Enter 确定、Esc 取消；
  事件目标落在 `[data-slot="time-picker-range-footer"]` 内直接放行，否则 Enter 被面板截走，按钮永远按不动。
- **区间确认条件**：两端选齐**且开始 < 结束**「确定」才可点；结束 ≤ 开始时禁用并提示
  「开始时间须小于结束时间」（槽 `time-picker-range-hint`）。比较必须 `compareParts` 解析后比，
  不能比字符串（`H`/`m` 等非补零格式字典序错误）。
- **点中已选中的滚轮项也要上报 onValueChange**：区间空草稿用「现在」播种，播种值恰好就是用户
  想要的那一格（例如下午 12 点打开时点「12」）时，点击必须把该端标记为已选，否则两端永远选不齐、
  确定钮不解禁；仅「滚动对齐」在值未变时跳过。
- **单值无值草稿预填「现在」**（`nowParts()`），不是 `00:00:00`。
- 开合只重置一次：open 翻转时归位 activeEnd 与驾驶列；effect 依赖**不能放 draft**（写草稿触发的 effect 会把端点/驾驶列拽回初始值）。
- **两端都不自动切端**：滚轮有时/分/秒多列，滚一列就跳端会让剩余列改到另一端；调完一端由用户点 tab 手动切换。
- 底部条按钮用 `buttonVariants({size:'small'})` 拼类名，不直接用 `<Button>`（Button 的 data-slot 写在 `{...props}` 后会顶掉外部槽名）。
- 用 Radix Popover 的 **`Anchor` 不用 `Trigger`**（共用 `TimeTrigger` 自带点击语义，Slot 叠加会双触发），同 DatePicker。
- `columnsType` 两端都生效（滚轮同源），不泄露 props 差异。

### 3.7 DateTimePicker（模式 C，与 DatePicker 同族；2026-09-24 由 B 改判）

日期段两端**不同范式**，时间段两端**共用滚轮**：

- H5 = Popup 底部弹层 + `DateTimeWheelRow` 整条 4~6 列（年/月/日/时/分/秒，居中双横线滚轮）+ PanelHeader；
- PC = Radix Popover 锚定浮层，**左侧月历网格**选日期（`« < 年月 > »` 年/月导航、星期头、6×7 定高网格、今天描边、越界日禁用），
  **右侧时/分/秒 1~3 条居中滚轮列**（与 H5 同一个 5 行制滚轮：选中行上下发丝线、无底色、文本加粗，
  列间竖发丝线，列顶/列尾各一个 ▲▼ 微调钮：单击 ±1、按住连发），顶部右侧回显草稿时间，底部「此刻 / 确定」。

改判原因：日期用滚轮在 PC 上要年/月/日滚三列才到目标日，月历网格才是 PC 主范式（与 DatePicker 同判据）；
但时间列滚轮在两端都成立，因此只换日期段，时间列原样复用，PC 仅多挂微调钮与列间竖线。
定位对齐 Vant DatetimePicker：**只做单值**（区间请约束两个实例或用 Date/TimePicker 区间版）。

**定死取值**

| 项        | 取值                                                                                                            |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| 精度      | 三档：`年月日时` / `年月日时分` / `年月日时分秒`（默认）。H5 = 4/5/6 列滚轮；PC = 月历 + 1/2/3 条时间列         |
| 月历      | 恒 6 行 × 7 列定高，周日为首；格子复用 date-picker PC 尺寸 token（32px / 圆角 / 主色选中 / 今天 ring）          |
| 时间列    | 列宽 `--bv-datetime-picker-column-width` 56px，行高 44px；选中态 = 居中双横线（无底色）+ 加粗文本，两端同一样式 |
| PC 浮层宽 | `calc(var(--bv-date-picker-pc-panel-width) + 列宽 * 时间列数)`，不写死三档三个 token                            |
| 值        | 恒为字符串 `'YYYY-MM-DD HH[:mm[:ss]]'`，不用 Date（UTC 解析会差一天）                                           |

**关键规则**

- **列归一**：日期三列必在；时间列只接受从 hour 起的连续前缀。缺日期列、时间前缀为空或跳列（如给了 minute 没给 hour）一律回落全 6 列。
- **边界是完整时刻**：`parseBoundText` 缺时间位时 min 补 `00:00:00`、max 按字段补 `23/59/59` —— 不能统一补 59（小时 59 非法，整个边界变 null 静默回落默认范围）。纯日期 max 语义为当天 23:59:59。
- **月历格只按日期粒度判禁用**（`isDayDisabled` 只比年月日）：min 当天之前的日期不可点；当天的时刻约束（09:00 起）归时间列裁剪，不能把整天判死。
- **逐字段级联夹紧**（`clampParts`）：点日 / 此刻 / 键盘改值都走它，min 当天的时刻会被抬到边界时刻但不跳整天。
- **键盘分区驾驶**：点日期格进入日期区（←→ 走天、↑↓ 走周、PgUp/PgDn 走月，视图跟随）；点时间列项进入时间区（↑↓ 改值、←→ 换列、Home/End 首尾、PgUp/PgDn ±10）。Enter 确定、Esc 取消；两区元素都 `tabIndex={-1}`，选择面是整个浮层。
- **时间列 ▲▼ 微调钮**（仅 PC solid）：pointerdown 立即 ±1，按住 `PRESS_REPEAT_DELAY` 400ms 后按 `PRESS_REPEAT_INTERVAL` 70ms 连发（`usePressRepeat`，action 走 ref 避免连发闭包持旧区间）；pointerup / 移出 / 取消 / 卸载即停；到可选区间端点钮禁用，`tabIndex={-1}` 不与面板键盘双路步进。
- **「此刻」只写草稿不直接提交**：夹到边界内、月历跳回当前月、回显当前时间，确定才生效（与面板整体暂存语义一致）。
- **翻月只是浏览**：`« »` / `< >` 只改视图月，草稿日期不变；选中日落在别的月份时网格照常高亮（跨月可见）。
- 默认范围 = 今天 ±10 年；已选值年份落在默认范围外时撑开默认端，**但显式 min/max 是硬边界不被撑开**（同 DatePicker）。
- **无值草稿播种「此刻」**（`nowDateTimeParts()`），不是元旦 00:00:00；打开时月历定位到草稿月、驾驶区归日期区；开合 effect 依赖不放 draft（同 3.6）。
- 底部无取消钮（对齐 Element/原生面板）：取消走 Esc 与点外部；footer 键事件放行、按钮拼 `buttonVariants` 不用 `<Button>` 沿用 3.6 规则。
- 值模型全在 `hooks/use-datetime-value.ts`（纯函数），与 use-date-value / use-time-value 同族并复用 `daysInMonth / pad2 / todayParts / nowParts / addDays / addMonths`；月历网格是 PC 文件内的轻量纯函数（`buildMonthGrid`，42 格补位），不引 react-day-picker（单月单选不需要其区间/双月能力）。

### 3.8 Tooltip（模式 B）/ Ellipsis（模式 A）/ Popover（模式 C）

同一段补充说明，Tooltip 两端**容器密度不同**（H5 常驻说明条 / PC hover 气泡）；「长文展开收起」独立成 Ellipsis（模式 A，任何文本容器可单独使用，Tooltip 不内置截断）；Popover 仍是模式 C，共享面板内容（`ui/popover-parts.tsx` 的 `PopoverBody`），两端都建在 Radix Popover 之上（H5 只取气泡，抽屉复用 Popup）。Tooltip 的 PC 气泡不引 Radix（要跟手自研定位，Radix Tooltip 的锚点模型不匹配）。

> 2026-10-09 改判：H5 原方案是「长按 500ms 跟手气泡 + 1.5s 自关」，落地复核发现长按看提示是把桌面范式硬搬触屏——Vant / Ant Design Mobile 都没有长按 Tooltip，H5 真实惯例就是**辅助说明常驻**，长文走**展开/收起**。H5 长按/自关/位移护栏/压 click 全套已删除，模式由 C 改判 B（信息相同、容器不同），PC 实现不变。

**Tooltip 定死取值**

| 项         | H5（常驻信息条）                                                    | PC（跟随气泡）                                                       | token / JS 镜像常量                                  |
| ---------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| 形态       | 主体在上、下方一条行首 ⓘ 的浅底圆角说明条，**全文常驻**、不拦截手势 | hover 200ms 延迟弹出；focus 立即；Esc 关                             | `--bv-tooltip-pc-open-delay`                         |
| 超长文案   | content 传 `<Ellipsis rows>` 折叠，Tooltip 自身不截断               | 气泡 max-width 240px 自然折行                                        | —                                                    |
| 信息条配色 | 底 `--bv-background`、字 `--bv-text-2`、ⓘ `--bv-primary`，字号 sm   | 深色 `rgba(0,0,0,.75)` 白字                                          | `--bv-tooltip-h5-info-*` / `--bv-tooltip-*`          |
| 信息条间距 | 与主体 gap xs；条内 ⓘ 与文案 gap base；ⓘ 14px                       | 气泡 gap 12px、距视口边 8px                                          | `--bv-tooltip-h5-info-*` / `-gap`/`-viewport-margin` |
| 进出场     | 无（常驻）                                                          | 120ms 淡入淡出，两阶段挂载、退场后卸载                               | `--bv-tooltip-duration` / `TOOLTIP_TRANSITION_MS`    |
| 无障碍     | 主体 `aria-describedby` 指向提示条（ⓘ 装饰性 `aria-hidden`）        | 打开时主体挂 `aria-describedby`，`role=tooltip`、pointer-events:none | 分发层 `useId`                                       |

**Ellipsis 定死取值**

| 项       | 取值                                                                                          | token / 实现                                     |
| -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 截断行数 | `rows` 默认 2，非法值（<1/非整数）回落 1                                                      | 内联 `WebkitLineClamp`（动态值只能内联）         |
| 截断 CSS | `[display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden`                         | Tailwind 任意属性类                              |
| 溢出判定 | `scrollHeight > rows × lineHeight + 1px`，实测不溢出不显示开关                                | `useLayoutEffect` 测量 + ResizeObserver 跟随宽度 |
| 开关     | 「展开/收起」文字按钮（可自定义文案）+ arrow-down 图标（展开旋转 180°），`aria-expanded` 同步 | `--bv-ellipsis-action-color`（primary）          |
| 受控     | `expanded` / `defaultExpanded` / `onExpandedChange`                                           | 与库内其他件同一套                               |

**Popover 定死取值**

| 项          | H5                                                                                                                                                                                                                                                      | PC                     | token                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| 形态分界    | 内容实测高度 **严格大于 N 行** → 底部抽屉，否则轻量气泡；纯 actions 直接数行。N 取 token `--bv-popover-h5-bubble-max-rows`（默认 3），实例可用 `maxRows` prop 覆盖；`h5Form="bubble"\|"drawer"` 可强制形态（默认 `auto`，强制时跳过探针）。均仅 H5 生效 | 恒锚定浮层             | `resolvePopoverForm()` 纯函数 / `--bv-popover-h5-bubble-max-rows` |
| 动作行高    | 48px                                                                                                                                                                                                                                                    | 36px（hover muted 底） | `--bv-popover-h5-row-height` / `-pc-row-height`                   |
| 气泡宽      | max-width 240px                                                                                                                                                                                                                                         | min 160 / max 320      | `--bv-popover-h5-bubble-max-width` / `-pc-panel-min/max`          |
| 面板        | 圆角 lg + 阴影，max-h 60vh                                                                                                                                                                                                                              | 同左                   | `--bv-popover-radius` / `-shadow` / `-panel-max-height`           |
| 间距/进出场 | offset 4px（Popper sideOffset）、120ms                                                                                                                                                                                                                  | 同左                   | `--bv-popover-offset` / `-duration`                               |

**关键规则**

- **H5 常驻条不做触发态**：`H5Tooltip` 不渲染浮层、不收 open/disabled/onOpenChange（分发层按端传参，对外 TooltipProps 仍双模式一致）；主体 cloneElement 只补 ref/槽位/`aria-describedby`，**不叠加任何事件**。外层 `inline-flex flex-col items-start` 纵向排，信息条 `max-w-full`、文案包 `min-w-0` 才能正常换行；ⓘ 用 Icon `name="info"`（currentColor 吃 `--bv-tooltip-h5-info-icon-color`），按行高差做半行距位移与首行对齐。
- **折叠职责归 Ellipsis，不进 Tooltip**：要「常驻 + 超长折叠」就 `<Tooltip content={<Ellipsis rows={2}>…</Ellipsis>}>`；Tooltip 全文渲染、不量高度，避免一个件同时背「提示」和「截断」两个会各自演化的职责。
- **Ellipsis 只在实测溢出时出现开关**：统一用 `scrollHeight > rows × lineHeight + 1` 判定（收起/展开两态都成立：-webkit-box 裁剪下 scrollHeight 仍是完整内容高），lineHeight 取不到（normal/空）回落 fontSize×1.2；ResizeObserver 跟随容器宽度重测（响应式换行后溢出结论会变）。动态行数的 `-webkit-line-clamp` 只能内联（Tailwind 类无法参数化 N），内联值是变量数字、不撞 eslint 的字面量 style 禁令。
- **（PC）Tooltip 定位是纯函数**（`resolveBubblePosition`，无 DOM 依赖可单测）：指针点锚点优先落右下（光标挡住左上），右/下放不下翻左/上，最后统一夹回视口留白；元素矩形锚点（键盘 focus 无指针坐标）水平居中、默认上方、放不下翻下。jsdom 量不到气泡尺寸，几何断言只验「坐标 + gap」与纯函数翻转。
- **（PC）跟随用 rAF 合帧**：mousemove 只写 pending ref，一帧内多次移动只重定位一次。
- **（PC）hover/focus 双意图独立**（`hoveredRef` / `focusedRef`）：键盘聚焦时鼠标移出、或鼠标悬停时 blur 都不关，两者都消失才关；Esc 监听 window 关闭。
- **无障碍配对**：分发层 `useId` 生成 id，主体与提示体（H5 常驻条 / PC 气泡）以 `aria-describedby` 配对；PC 气泡 `pointer-events:none` 且不可聚焦，纯展示不承载操作（要可点操作请用 Popover）。
- **Popover 形态只在打开瞬间定，关闭后收回**：纯 actions 行数确定直接数；带自定义内容先挂**不可见限宽测量探针**（Portal 内 `invisible`、宽 = 气泡限宽，宽度不定时测高无意义），`useLayoutEffect` 报实测高度再和 3 行阈值比。注意形态判定 effect 不能在打开时无条件 `setForm(null)`——layout effect 子先父后，会覆盖探针刚回传的形态；null 由初始态与关闭收回（气泡退场 120ms 后 / Popup `onClosed`）保证。
- **Popover 触发器两端都用 Radix Anchor 自管 click，不用 Trigger**（同 Select/TimePicker 既定范式）：触发器是外部传入的任意元素、自带 onClick，叠 Radix Trigger 的 pointerdown 开合会双触发/失效（实测克隆触发器上 Trigger 不回调 open）。后果自负的两件事：`aria-expanded` 自己同步；PC 关闭焦点用 `onCloseAutoFocus` 显式还给触发器（Anchor 不会自动还焦）。
- **H5 气泡触屏不抢焦**（`onOpenAutoFocus` preventDefault，避免点击后页面滚动与虚焦轮廓）；点触发器不关的拦截放在 `onPointerDownOutside`（Radix 的延迟外部关 + 触发器自身 click 会一关一开）。
- **actions 语义**：点行先调业务 `onClick(action)`，再按 `closeOnClickAction`（默认 true）关闭；danger 行复用 `--bv-danger`（不新增颜色 token），禁用行原生 disabled。

**测试开关信号**

- H5 Tooltip 无浮层无计时，用真实计时器；断言「主体 + `[data-slot=tooltip-info]` 同时存在、任何指针手势都不产生 `tooltip-bubble`」。
- （PC）hover/退场计时全 fake：退场是「关闭后再挂退场计时器」，fake 时钟下要**分段 advance**，退场计时器在 act 刷掉状态更新后才挂载。
- Ellipsis 的布局尺寸 jsdom 恒为 0（默认不显示开关）；几何分支 mock 时**不能整体替换 `getComputedStyle`**（返回对象丢掉 `getPropertyValue` 会让 dom-accessibility-api 算按钮 accessible name 时报 `getPropertyValue is not a function`），也不能 spy `CSSStyleDeclaration.prototype`（WebIDL 命名属性不挂原型）——正确做法：调真实 `getComputedStyle` 拿原对象，再 `defineProperty` 遮蔽 `lineHeight/fontSize`，另 mock `HTMLElement.prototype.scrollHeight`。
- Radix Popover 两个 jsdom 已知时序：document 的 pointerdown 监听在弹层挂载后 `setTimeout(0)` 才注册（外部关闭用例打开后先让一帧）；`deferPointerDownOutside` 要求外部 pointerdown 后**再派一个 click** 才真关，且最终 dismiss 在 `setTimeout(0)`（整段包 async act，避免 PopperContent 的 act 警告）。

## 4. 测试要求

- 每个自适应组件两个测试组：`describe('h5 mode')` / `describe('pc mode')`，用 `forceMode` 或 mock `matchMedia` 切换。
- 必测：打开/关闭、值变更、键盘（PC）、手势/热区（H5）、边界值（min/max/disabled）。
- 纯逻辑（过滤、夹紧、区间、索引换算）抽纯函数单测；滚轮滚动、面板几何、区间底色等布局断言 jsdom 做不了，归 `visual-check.mjs` 真机探针。
- 「开没开」断言 `aria-expanded`，不断言 Popup 的 `data-state`（jsdom 下恒 closed）。
- 视觉回归（后期可选）：Playwright 双 viewport（375×812 / 1440×900）截图对比。
