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

| 组件                          | H5 模式                                                                                                                                                                                                      | PC 模式                                                                                                                                                                                                       | 模式    | 共享逻辑                                                          | 状态  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------- | ----- |
| **Field / Input / Textarea**  | Cell 行（左 label + 右输入区），44px 触控热区；`digit` 用 text+inputmode=decimal 并过滤非数字；focus 时 label/左图标转 primary；clearable 聚焦显示清除；textarea autosize + 字数；error 红字；rules 失焦校验 | 同形；精确指针设备（`@media (pointer:fine)`，触屏永不生效）额外：键盘焦点环 + 控件默认 gray-4 边框（Field 由 field-box 出框包住输入区/清除/箭头，action 留框外；行底线隐藏；hover/聚焦 primary、错误 danger） | **A**   | digit/number 过滤与 min/max 夹紧、rules 校验、autosize 测量、字数 | ✅ P3 |
| **Select**                    | 底部弹层列表，项高 48px，选项 > 10 才出搜索框，单选即关                                                                                                                                                      | 锚定浮层 + 虚拟滚动，键盘 ↑↓/回车/输入过滤，多选保持展开                                                                                                                                                      | **C**   | 过滤、受控值、分组                                                | ✅ P2 |
| **DropdownMenu**              | 底部抽屉，子菜单面板推入；可选值按 value 匹配**完整层级路径**回填，展开自动下钻到选中层并滚入视野，头部铺**可点层级链**；`confirmable` 走暂存 → 确定                                                         | 锚定菜单，子菜单向右展开，快捷键提示；可选值点选即生效、同套路径回填，展开自动铺开选中子菜单链，**无工具栏**                                                                                                  | **C**   | 菜单树结构                                                        | ✅ P2 |
| **DatePicker**                | 底部弹层 + 三列滚轮（年/月/日，5 行制居中），惯性 + scroll-snap，工具条；`columnsType` 可裁列；区间为「开始/结束」两段式入口，两端选齐才可用                                                                 | 锚定浮层 + 月历面板（6×7 网格），上下月 + 键盘巡航，触发器可直接输入；区间并排双月，点起点、悬停预览区间带                                                                                                    | **C**   | 日期值计算（解析/格式化/min-max 逐字段夹紧/区间排序）、滚轮列模型 | ✅ P2 |
| **TimePicker**                | 底部弹层 + N 列滚轮（时/分/秒，5 行制居中），惯性 + scroll-snap，顶部工具条；`columnsType` 可裁列；区间两段式                                                                                                | Radix Popover 锚定浮层 + **与 H5 同源的 N 列滚轮**（仅换外壳），面板级键盘驾驶滚轮（↑↓ 改值 / ←→ 换列 / Home·End / PgUp·PgDn / Enter 确定 / Esc 取消），底部「取消/确定」条                                   | **B**   | 时间值计算（同日期族）、滚轮列模型                                | ✅ P2 |
| **DateTimePicker**            | 底部弹层 + N 列滚轮（年/月/日 + 时·分·秒三档精度，4/5/6 列），顶部工具条；单值，恒走暂存→确定                                                                                                                | 左月历网格（« < 年月 > » + 星期头 + 6×7 定高网格）选日期 + 右侧时/分/秒 1~3 条居中双横线滚轮列（▲▼ 按住连发），顶部回显草稿时间，底部「此刻 / 确定」；键盘分区驾驶                                            | **C**   | 6 字段值模型、跨日期时刻的逐字段夹紧、月历网格、时间滚轮列        | ✅ P2 |
| **Calendar**                  | 全屏弹层，月份列表纵向滚动加载，range 拖选                                                                                                                                                                   | 内嵌面板（非弹层）可常驻，range 拖选 + 键盘移动                                                                                                                                                               | **C**   | 月网格计算、区间逻辑                                              | ✅    |
| **Picker（通用滚轮）**        | 底部弹层 + 多列滚轮联动，列宽随内容                                                                                                                                                                          | 锚定浮层 + 多列面板（可滚动/搜索），或降级为多个 Select                                                                                                                                                       | **C**   | 列联动、级联数据                                                  | ⬜    |
| **Cascader / Area**           | 底部弹层 + 滚轮级联（选一级推入二级）                                                                                                                                                                        | 锚定浮层 + 多列面板 + 面包屑路径，支持搜索定位                                                                                                                                                                | **C**   | 级联索引、路径回显                                                | ⬜    |
| **Slider**                    | 触摸拖拽，禁页面滚动（`touch-action: none`），热区放大到 44px                                                                                                                                                | 点轨道跳转 + 拖拽 + 方向键微调（±step）                                                                                                                                                                       | **C**   | 值换算、步长、区间                                                | ⬜    |
| **Stepper**                   | 输入框唤起数字键盘，加减按钮热区 44px                                                                                                                                                                        | 输入框 + 上下箭头 + 键盘微调                                                                                                                                                                                  | **A/B** | 边界与步长                                                        | ⬜    |
| **NumberKeyboard**            | 自定义数字键盘弹层（含「完成」键）                                                                                                                                                                           | 不渲染，直接用系统键盘                                                                                                                                                                                        | **C**   | 输入格式化                                                        | ⬜    |
| **Uploader**                  | 点击唤起相机/相册（`capture`），压缩上传，宫格预览                                                                                                                                                           | 拖拽上传区 + 文件选择器，多选/粘贴，列表视图                                                                                                                                                                  | **C**   | 上传队列、进度、校验                                              | ⬜    |
| **Search**                    | 全屏搜索页，返回退出，历史记录                                                                                                                                                                               | 内联输入框 + 建议浮层，快捷键聚焦                                                                                                                                                                             | **C**   | 防抖、历史/建议源                                                 | ⬜    |
| **Rate**                      | 点击/滑动选择，热区 44px                                                                                                                                                                                     | 点击/悬停预览 + 键盘方向键                                                                                                                                                                                    | **C**   | 值语义                                                            | ⬜    |
| **Checkbox / Radio / Switch** | 行高 ≥ 48px，整行可点（Radio 在 Cell 内整行触发）                                                                                                                                                            | 标准控件 16~20px，label 可点，键盘空格                                                                                                                                                                        | **A**   | 受控状态                                                          | ✅    |

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

| 组件           | 模式 | 本质差异                                                                                                                                                                                                                             |
| -------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Field          | A    | 打字输入两端同范式：Field 是 Cell 行外壳（label/图标/清除/错误/字数/action），Input/Textarea 是拆出公开的无壳基础件；PC（pointer:fine）差异仅 CSS：`:focus-visible` 焦点环 + 控件/field-box 默认 gray-4 边框（触屏保持 Vant 无框行） |
| Popup          | B    | 同一 position 状态机 + 内容，H5 贴边滑入壳 / PC 居中模态壳                                                                                                                                                                           |
| Overlay        | A    | 仅浓度与「点遮罩关闭」默认值不同                                                                                                                                                                                                     |
| Dialog         | B    | H5 复用 Popup bottom；PC 用 Radix Dialog                                                                                                                                                                                             |
| Toast          | C    | 信息模型不同：H5 单例胶囊 vs PC 可并存卡片栈                                                                                                                                                                                         |
| Select         | C    | 信息模型不同：底部热区单选即关 vs 锚定浮层键盘巡航/多选不关                                                                                                                                                                          |
| DropdownMenu   | C    | 导航范式不同：面板栈替换视野 vs 子菜单右展、父层留原地                                                                                                                                                                               |
| DatePicker     | C    | 交互范式不同：一维滚轮吸附 vs 二维月历焦点巡航                                                                                                                                                                                       |
| TimePicker     | B    | 同滚轮范式、仅外壳不同：底部弹层+顶部工具条 vs 锚定浮层+底部确认条（滚轮行 `TimeWheelRow` 两端同源；曾按 C 实现，2026-09-23 改判 B）                                                                                                 |
| DateTimePicker | C    | 日期段范式不同（H5 三列滚轮 vs PC 月历网格，同 DatePicker 判据）；时间段共用同一居中双横线滚轮列（PC 多挂 ▲▼ 微调钮与列间竖线，`DateTimeWheelRow`）；单值字符串                                                                      |
| Tooltip        | B    | 同一份说明文案、容器密度不同：H5 无浮层，常驻成主体下方的 ⓘ 信息提示条（超长交 Ellipsis 折叠）vs PC hover/focus 触发的跟随气泡；恒纯展示不可交互（2026-10-09 由 C/B 改判：H5 长按气泡不符合触屏惯例，改常驻）                        |
| Ellipsis       | A    | 两端同形：`-webkit-line-clamp` 截断 N 行 + 实测溢出才出现「展开/收起」；不与 Tooltip 耦合，任何文本容器可单独使用                                                                                                                    |
| Popover        | C    | 容器范式不同：H5 ≤3 行轻量气泡 / >3 行降级 Popup 底部抽屉（打开瞬间按实测高度定形态）vs PC Radix 锚定浮层；面板内容（自定义区 + actions 行）两端同源                                                                                 |
| Picker         | C    | 多列独立选择的容器范式不同：H5 N 列吸附滚轮（底部弹层）vs PC N 列纵向面板（锚定浮层，各列独立滚动/键盘巡航）；列间互不影响，两端都暂存→确定；滚轮件两端同款但 PC 不用（`PickerWheelRow` 仅 H5 + Cascader H5 复用）                   |
| Cascader       | C    | 树的走法不同：H5 联动滚轮（省市区三列，换父列子列重算）vs PC 面包屑 + 逐级右展多列面板（点叶子即生效）+ 路径全文搜索；值恒为根→叶子完整路径                                                                                          |
| Calendar       | C    | 日历范式不同：H5 全屏弹层 + 月份纵向滚动懒挂载 + 触摸拖选（range/multiple 确定条暂存）vs PC 内嵌常驻月历（range 双月）+ 鼠标拖选 + 键盘巡航（点选即生效）；single/range/multiple，值恒为 'YYYY-MM-DD'                                |

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

- **PC Root 恒 `modal={false}`**：Radix DropdownMenu 默认 `modal=true`，开着时 body 被置 `pointer-events:none`、外部内容 `aria-hidden`，点别的触发器**第一下只够关菜单、必须再点一次才打开**，也无法与其它弹层同一手势直切（与 §3.11 的 Trigger 时序配套，全库锚定弹层一律非模态）。
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

### 3.9 Picker（模式 C，多列独立选择）

Vant 把「独立多列」与「级联」塞在同一个 Picker 里；Bivane 拆开：**列与列互不影响的多维度单选归 Picker**（姓/名、品牌/年款），父子联动归 §3.10 Cascader，两者共享触发器、H5 滚轮地基（`ui/picker-parts.tsx`）以及 **PC 同一套多列面板外壳**。
H5 = Popup 底部弹层 + N 列 `PickerWheelRow` 等平分列（5 行制吸附，复用 `use-picker-column`）+ PanelHeader；PC = Radix Popover 锚定浮层 + N 列纵向 listbox **并排平铺**（行高 36、左对齐、选中 primary + 右勾，与 §3.10 Cascader PC 行同款；但**列宽按内容 `w-max` 撑开、选项不省略**，132px 仅为最小兜底，这点与固定宽的 Cascader 不同；各列独立滚动），差别是**没有面包屑/级联**，底部多一条「取消/确定」。单列时就是一个宽度正常的列表面板（不得退化成窄条）。

**定死取值**

| 项        | H5                                             | PC                                                                                                                                                                                       | token                                        |
| --------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 触发器    | 同 TimePicker 族：通栏细下边线 44px            | 32px 描边圆角 4px；Cascader 触发器同源复用                                                                                                                                               | `--bv-picker-*` / `--bv-picker-pc-trigger-*` |
| 行/滚轮   | 滚轮行高 **44px**，可见 5 行，居中吸附         | 行高 **36px**、左对齐、选中 primary 文本 + 右侧 check 勾；**列按本列最长项 `w-max` 撑开、选项不省略**，`--bv-picker-pc-column-width`（132px）只是最小列宽兜底；列区 max-h 280px 各自滚动 | `--bv-picker-wheel-*` / `--bv-picker-pc-*`   |
| PC 浮层宽 | —                                              | 面板 `w-max` 随列内容撑开（列区 flush，确认条自带 px）；上限取 Radix 可用宽，超出列区横向滚                                                                                              | `--bv-picker-pc-column-width`                |
| 列分隔    | 滚轮列间 1px 竖发丝线（与中央指示同色 border） | 第 2 列起列自身 `border-l`（border-box 含在列宽内，不占额外宽度，否则顶出横向滚动条）                                                                                                    | `--bv-picker-column-divider-color`           |

**关键规则**

- **两端恒走「暂存 → 确定」**（同 TimePicker 判据）：多列要全部调好才算选完，点某一行/滚某一列就提交关闭不可用。Esc / 点外部 / 「取消」= 丢弃草稿；草稿归分发层，关闭不清空（退场动画仍在渲染草稿）。
- **入参列支持字面量**：每列可直接给 `string[] | number[]`，`normalizeColumn` 归一成 `{label,value}`（value 与文案相同，对齐 Vant 惯例）。
- **打开播种**（`resolveDraftValues`）：已提交值仍在列里就用它（即使该项被禁用也尊重回显）；值失效（选项集换了）落该列第一个可选项；**空列位给 undefined，「确定」禁用**并在底部提示「请补全每一列」（槽 `picker-footer-hint`），不提交半截值。
- **PC 键盘面板级接管**：↑↓ 在当前列巡航（**跳过禁用、到边界不回绕**，与滚轮「滚到头停住」一致；Select 取值列表才回绕）、←→ 换列、Home/End 列首尾、Enter 先写草稿、激活项已等于草稿值时再按一次才提交、Esc 取消；焦点落 `[data-slot=picker-footer]` 内直接放行，否则按钮永远按不动（同 3.6）。
- PC 行左对齐、`px` 行内边距、文案 `whitespace-nowrap`（**不截断**，长文案把列撑宽而非出省略号；极端超长由面板 max-w + 列区横向滚动收口）+ 右侧 check，**不再是滚轮式居中粗体**；`tabIndex={-1}` 不进 Tab 流；`data-selected` 标草稿选中（primary 文本 + 勾）、`data-active` 标键盘激活（`--bv-active-color` 底，hover 同色）。
- 底部条按钮拼 `buttonVariants({size:'small'})` 不用 `<Button>`；Radix 用 **Anchor 不用 Trigger**；关闭焦点 `onCloseAutoFocus` 显式还触发器 —— 均沿用 §3.3/§3.6 既定范式。
- 值 = 每列一个值的数组（`Array<string|number>`），`onChange(values, selectedOptions)` 选项按列对齐（失效位 undefined）。

### 3.10 Cascader（模式 C，树形级联选择）

省 / 市 / 区范式（Vant Area 的交互，但**不引** @vant/area-data，只支持其数据格式）。只有**叶子可选**（点父级只展开/联动，不产生 onChange，对齐 Vant Cascader finish；不做任意级可选）。
H5 = Popup 底部弹层 + **联动滚轮**（不做 Vant Cascader 的下钻面板：矩阵定死滚轮，且下钻面包屑已由 DropdownMenu 承担）；PC = Radix Popover 锚定浮层 + 面包屑路径 + 逐级向右展开的多列面板，searchable 时顶部路径全文搜索。

**定死取值**

| 项       | H5                                                                  | PC                                                                                 | token / 纯函数                                |
| -------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------- |
| 列模型   | `deriveLinkedColumns`：所有层级一次摊平成联动滚轮列（深度=列数）    | `derivePanelColumns`：链上每级向右展开一列，**不自动补选**（没点过的层级不高亮）   | use-cascader-state.ts                         |
| 行/面板  | 复用 `--bv-picker-wheel-*`（44px 5 行制）                           | 行高 36px、列宽 **132px**（放得下「浙江/杭州市」路径）、列区 max-h 280px           | `--bv-cascader-pc-*`                          |
| 面包屑   | 无（滚轮上方是 PanelHeader 标题）                                   | 根层「请选择」+ 各级选中项，每项可点截到该层；36px 高，横向滚动自动滚入当前层      | `cascader-breadcrumb*` / `-breadcrumb-height` |
| 搜索     | 不呈现（滚轮没有搜索落点），同一 `searchable` prop 两端差异由模式定 | 顶部搜索框；按**路径全文**匹配叶子（「杭州」能命中其下全部区）；结果行回显完整路径 | `searchLeaves` / `flattenLeaves`              |
| 提交时机 | 暂存 → 确定（PanelHeader）                                          | 点**叶子**即生效即关（桌面点选即生效，同 Select/DropdownMenu），无确认条           | —                                             |

**关键规则**

- **值恒为根 → 叶子的完整路径值数组**（如 `['zj','hz','xh']`）；`isValidLeafPath` 不完整或中途失效（数据刷新）的已提交值**不回显**、触发器退 placeholder（架构 §6.5 第 6 条）。
- **联动规则（H5）**：第 i 列改选 = 保留前缀、换掉第 i 级、丢弃更深层级后重新 `deriveLinkedColumns`，子列回到各自**第一个可选项**补到叶子（`withLinkedValue` + 填充）。滚轮只渲染派生出的列，级联计算全在分发层（`onLinkedColumnChange(level,value)`）。
- **无值播种**：H5 打开时没有效已提交路径，`fillFirstEnabledPath` 每级取第一个可选项补到叶子（滚轮不能停在半截）；PC 打开导航链 = 已提交路径（**展开即定位**，架构 §6.5 第 7 条），无值则从根列开始。
- **失效路径就地截断**：`resolvePath` 中途任一级对不上就停在最近有效层，PC 不追加空列，H5 从断点继续补首个可选项。
- **PC 面包屑**：根格恒在（点它链清空回根列）；链上末项是不可点的当前层，其余可点；独立于 PanelHeader（那是 H5 工具条，PC 不需要「取消/确定」行），用 `ui/cascader-parts.tsx` 的 `CascaderBreadcrumb`。
- **PC 行后缀**：父级右箭头（Icon `arrow`），选中叶子 check；选中 = 链上当前值（primary 文本），键盘激活 = `--bv-active-color` 底。
- **搜索**：`flattenLeaves` 摊平时**禁用项整棵子树剪枝**（禁用父级展不开，其叶子出现在搜索里就是搜得到点不动的死路）；结果行必须展示完整路径（同名叶子只看末级会选错）；label 是自定义节点无法取文本时退化为匹配 value（同 Select `matchOption`）；空关键词不搜索、无命中给 `emptyText`（默认「暂无数据」，复用 `SelectEmptyState`）。
- **PC 键盘**：↑↓ 列内巡航跳禁用、→/Enter 展开父级或提交叶子、← 回上一级（链截尾）、Home/End 首尾、Esc/点外部关闭；搜索态按键让给输入框。searchable 打开自动聚焦搜索框（同 Select），否则焦点留面板；Trigger/还焦/点触发器防一关一开沿用 §3.11 范式。
- **展开即定位的滚入视野挂在选项行 ref 回调上**：Radix Presence 列 DOM 晚挂载，依赖 open 的 effect 拿不到节点；ref 身份保持稳定，节点挂载即把选中/激活行 `scrollIntoView({block:'nearest'})`（架构 §6.5 第 7 条）。
- **fieldNames**：默认 `{label:'label',value:'value',children:'children'}`，可改映射直接吃 Vant 风格数据；缺 value 的项给列内稳定占位值并强制禁用（不能退化用 label/序号，路径匹配会静默错乱）。
- 触发器/Cascader H5 滚轮复用 Picker 零件（槽名 `picker-*`）；PC 外壳槽名 `cascader-panel / cascader-breadcrumb* / cascader-pc-column / cascader-option / cascader-search-result`。

### 3.11 PC 通用：锚定弹层必须用 Popover.Trigger（禁止 Anchor 自管开合）

适用：Select / Picker / Cascader / TimePicker / DatePicker / DateTimePicker / Popover 的 PC 触发器（DropdownMenu 用 Radix 原生 Trigger，规则天然一致）。**任何新的锚定弹层触发器都必须遵守本节，不准退回 Anchor + 自管 click。**

- **规则 1：`Popover.Trigger asChild` 包住触发器，禁止 `Popover.Anchor` 自管开合。**
  Radix 源码级原因：NonModal Content 的三道保护——`onInteractOutside` 里 `context.triggerRef.current.contains(target)` 放行、`deferPointerDownOutside: true` 把外部 pointerdown 延迟到同次手势的 click 再 dismiss、deferred 期间压制 focusoutside——**全部从 `context.triggerRef` 读取，而只有 Trigger 会登记它**（Anchor 只登记 Popper 定位锚点）。Anchor 方案下 triggerRef 恒为 null，保护全失效：开着 A 点 B 时 A 在 document pointerdown 立即 dismiss 并 flush，click 才开 B（「先关再打开」空帧）；mousedown 默认迁焦又触发 focusoutside（「要再点一次 / 打开后立刻关」）。
  改用 Trigger 后的真实时序：pointerdown 只打标并挂一个 document click 一次性监听；click 时 React root 上 B 的 `onOpenToggle` 先执行（开 B，discrete 事件同步 flush），事件继续冒泡到 document 才派发 A 的 pointerDownOutside（关 A）——**关旧开新在同一帧完成**；点自己的触发器由 targetIsTrigger 放行，同一标志位同时压住迁焦造成的 focusoutside。
- **规则 2：双端共用零件用 `clickDelegated` 分工。** 零件 click 处理器里 `clickDelegated || event.defaultPrevented || disabled` 时不自激活：H5 不传（默认 false，零件自身 click → onActivate，H5 不经 Radix）；PC 传 true，鼠标 click 全部委托 Radix toggle，杜绝双触发。键盘 Enter/Space/↑↓ 始终保留在零件的 onKeyDown 里——asChild 合并后触发器是 div，没有原生 button 的键盘合成 click。
- **规则 3：disabled 守卫挂在 Trigger 本身**（Trigger 的 onClick 里 preventDefault），不能挂零件：Radix Slot 合序中 slot 自身处理器先于子元素处理器，写在子元素上拦不住 onOpenToggle。
- **规则 4：触发器内子元素要拦截 Radix toggle，一律用 React onClick `preventDefault()`，禁止 `stopPropagation()`。** Radix `composeEventHandlers` 以 `event.defaultPrevented` 短路 `onOpenToggle`，防切关目的同样达到；但 `stopPropagation` 会让 click 到不了 document —— DismissableLayer 的延迟 dismiss 在 document capture 先标记「外部交互被拦截」，只有事件冒泡到 document 才解除，一旦被吞，**别的浮层**（不是当前这个）的 `pointerDownOutside` 不派发、不关闭，真机表现为两个浮层叠挂（如区间日历开着点另一个可输入日期框）。清除按钮、可编辑输入框都遵守本条；pointerdown 也不需要处理（目标在 triggerRef 内，Radix 自动放行）。
- **规则 5：可编辑输入框（DatePicker PC 单值）只开不合。** input 的 click 永远 `preventDefault`（不被点合，收起只走 Esc / 点外部 / 选满），**关闭态**下 click 自行唤起——Esc 关闭会把焦点还回 input，此后再点不再触发 focus，必须靠 click 重开；未聚焦时 mousedown 的 focus 已先唤起（open 已为 true），click 不重复开。
- **规则 6：Root 恒 `modal={false}`**（DropdownMenu 见 §3.4），外部关闭统一交 DismissableLayer。
- **规则 7：禁止在 `onCloseAutoFocus` 里无条件 `preventDefault + focus 自己的触发器`。** Radix FocusScope 的卸载还焦在 unmount cleanup **内再排一个 `setTimeout(0)`** 执行（比新浮层挂载 passive effect 更晚一拍）。跨实例点击时旧层若在这个延迟回调里抢焦，新浮层的 focusin 监听已经就位且没有 deferred pointerdown 标志压制 → 新浮层被判 focusOutside 立即关闭（真机症状「B 展开后直接关闭」，100% 复现）。做法：**不传 `onCloseAutoFocus`**，用 Radix NonModal 默认逻辑——外部交互关闭（`hasInteractedOutsideRef`）不还焦，Esc/选中关闭才 focus 已登记的 trigger；自写的 `document.activeElement !== node` 守卫挡不住（此刻焦点已被新浮层拿走，条件恰好成立）。唯一例外是 DatePicker（要还焦到内部 input 而非外层 div），它用 `skipCloseAutoFocusRef`：外部 pointerdown/focusoutside 时置位，延迟还焦回调里读到就跳过。
- **唯一例外：H5 Popover** 保留 Anchor + 自管 click（bubble/drawer 双形态共用外层 open，Trigger 的内部 toggle 会错位；触屏也没有 mousedown 迁焦竞态），理由见 `components/h5/popover.tsx` 文件头。
- 回归测试：`tests/anchor-switch.test.tsx` —— 用完整真实手势（pointerdown→迁焦→mousedown→pointerup→mouseup→click），末尾**连排两个 `setTimeout(0)`**（第一个 flush passive effects，旧层 cleanup 在其中再排一个 setTimeout；第二个才跑到旧层的延迟还焦）；jsdom 只派 click 或只等一个 tick 都会漏掉「旧层抢焦关掉新层」。断言跨实例同一手势关旧开新且延迟还焦后新层仍在、同实例反复点击稳定、清除按钮不关层、disabled 不开、Esc 关闭还焦触发器。

### 3.12 Calendar（模式 C，日历）

Vant Calendar 的能力面：single / range / multiple，值恒为 `'YYYY-MM-DD'`（single 字符串、range 有序二元组、multiple 升序数组）。**不内置农历**（按需在 formatter 外挂数据）。H5 = Popup **fullscreen** + min→max 月份纵向连续排列 + 触摸拖选；PC = **内嵌常驻** rdp（react-day-picker v10）月历，range 并排双月 + 鼠标拖选 + 键盘巡航。组件**不带触发器**（H5 由业务 Cell 等入口受控唤起，`poppable={false}` 可内嵌）。

**定死取值**

| 项       | H5                                                                                               | PC                                                                                                                                                    | token / 纯函数                                                          |
| -------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 容器     | Popup `position="fullscreen"`（新增位置，与 bottom 同走 translateY 出场，强制无圆角）            | 内嵌面板，恒不挂 Popup（`effectivePoppable` 在 PC 被钉死 false）                                                                                      | `--bv-calendar-h5-*` / `-pc-*`                                          |
| 月历引擎 | 自研 `buildMonthGrid`（前置补位 + trailing 补 7 倍数），全部月份纵向连续排列                     | rdp v10（`fixedWeeks` + `showOutsideDays`，range `numberOfMonths=2`），月格纯计算仍共用 hooks 层                                                      | use-calendar-state.ts                                                   |
| 挂载     | IntersectionObserver 懒挂载（`rootMargin 600px`，挂载后不卸载）；无 IO 环境（jsdom）降级全量渲染 | 全部常驻                                                                                                                                              | —                                                                       |
| 行/格    | 行高 **64px**、日期圆钮 54px；未挂载月份用 `行数×64` 占位保证 scrollTop/定位正确                 | 格高 **40px**、端点圆 **34px**（< 格宽，邻选不粘连）、面板宽 300px、双月 gap 0                                                                        | `--bv-calendar-h5-row-height` / `-pc-cell-height` / `-pc-cell-day-size` |
| 区间     | 按住拖动选区间（窗口超 maxRange 起点前滑），也可两次点选；底部确定条暂存                         | **蓝底白字整段连通**：34px 定高色带（中间全幅/起点右半幅/终点左半幅）与端点圆同色 primary，中间日白字；鼠标拖选松手提交、悬停预览（悬停夹终点不滑窗） | `resolveDragRange` / `applyRangeDay`                                    |
| 提交时机 | single 点一天即提交即关；range/multiple 确定条暂存 → 确定                                        | 三种类型都**点选即生效**（multiple 点一项即时回写，无确认条）                                                                                         | 分发层收 H5 草稿，PC anchor 留实现层                                    |

**关键规则**

- **默认边界**：min=今天、max=**6 个月后月末**（`DEFAULT_CALENDAR_MONTH_SPAN`，`resolveCalendarBounds`）；值只撑开默认侧（值早于今天则 min 下沉），min/max 写反自动交换；归一化两轮（粗算 bounds → normalize 值 → 再算），种子月 `resolveCalendarSeed` 用 `clampParts` 逐字段夹紧。
- **range 两段式状态机**（`applyRangeDay`）：无起点=定起点；有起点点更晚=完成；点更早=**反向重置**为新起点（不是交换）；同日按 `allowSameDay`（默认 false）重置；轻点超 `maxRange` 触发 `onOverRange({date,maxRange})` 且不改值。
- **拖选滑窗**：`resolveDragRange` 中触点与起点 delta ≥ maxRange 时，起点 = 触点 −(maxRange−1) 天，区间长度恒定、窗口跟手前滑；H5 触摸用 `document.elementFromPoint` 找 `[data-slot='calendar-h5-day']`、**全程不 preventDefault**（页面纵向滚动与拖选共存，对齐 Vant touchmove），纯鼠标退化为 pointerenter 逐格；pointerup 挂 window，`suppressClick` + rAF 吞掉拖选尾的合成 click。
- **rdp v10 不转发自定义 pointer 事件**：PC 格子通过模块级 CustomComponents 渲染，拖选入口走 React Context（`DayContext.resolve/beginDrag`），rdp 的 `onSelect` 给空函数拨到受控侧，避免其内部模式逻辑抢状态；模块级组件 props 必须解构吃掉 rdp 注入的自定义字段（如 `displayIndex`），防止泄漏到 DOM。
- **PC 视觉分层（圆 + 带，禁止整格填色）**：日期格分两层——色带层（与端点圆同高 34px、垂直居中；中间格全幅、起点格右半幅、终点格左半幅，跨周自然断带）与端点圆层（34px 圆浮于色带断点）。**配色整段蓝底白字**：色带与端点圆同为 `--bv-calendar-range-background`（primary），中间日数字用 `--bv-calendar-selected-color`（白），区间内禁用日由 opacity 统一弱化不退回灰字；hover 圆不进入区间中间格（会打断色带）。**今天只给 primary 文字、不画圈**——「今天」标注已由 showMark 承担，圆环只属于选中/焦点语义。**半截起点**（已点开始、等终点且未悬停）立即渲染为实心圆 +「开始」，但**不伸出色带**（`ranged=false`），色带只在出现终点/悬停预览时出现。键盘焦点环（2px）仅当面板处于 `:focus-visible` 时落在光标圆上（选择器 `.bv-calendar-pc-root:focus-visible &`），初始挂载/鼠标点选不显示。邻月网格里重复出现的区间日（rdp outside）**只补全幅色带、不画端点圆、不给 hover 圆**；邻月日用 text-3。同日起止（`both`）不画带。
- **PC 拖选与点选的手势分界（pointerdown 不得抢状态）**：`beginDrag` 在 pointerdown 时**只记录手势锚点**，绝不清 `anchor`/预览——真机上 click 前必有 pointerdown，若按下即清两段式起点，第二次点终点会被误判成"重置起点"，表现为区间只能长按拖动选、两次点选永远选不满（jsdom `fireEvent.click` 不派发 pointerdown，必须用 pointerdown→pointerup(window)→click 真实序列测试）。只有 pointermove 确认离开按下日（`moved=true`）才清 anchor/hover、改走拖选预览；滑窗每次由 `resolveDragRange` 以按下日为锚纯算，不依赖上一帧 preview。
- **PC 键盘焦点模型**：面板 `tabIndex=0`、格子恒 `tabIndex=-1`（日格 `onMouseDown preventDefault` 不夺焦），方向键移动单一光标：←→±1 日、↑↓±7 日、PgUp/PgDn±1 月、Home/End 周首尾、Enter 选定；`moveCursor` 夹紧边界后逐日找下一可选日（`ENABLED_SEARCH_LIMIT=60`，跳禁用不回绕）并同步翻月；激活格 `data-active="true"`。
- **H5 草稿归属分发层**：弹层 `draft` 在 open 翻转时用已提交值播种（selected 故意不入 effect deps——开层时外部值变化不能冲掉用户正在选的草稿），取消/关闭整体丢弃、半截不复活；PC 无暂存语义，anchor/光标/视图月属实现层状态（架构 §6.5）。
- **打开定位**：播种优先级 = 草稿终点（区间拖到一半）> 已选值 > 今天；H5 `useLayoutEffect` 在 active 翻转一次时把播种月滚到 sticky 星期行下沿（`offsetTop - 44`），拖选跨月不重新拽视图；滚动时 rAF 更新副标题月份。
- **formatter 契约两端一致**：`resolveDayMeta({parts,isStart,isEnd,selected,inRange})` → `{text,topInfo,bottomInfo,disabled,className}`；越界与 formatter.disabled 都不可点；`showMark` 今天默认 topInfo「今天」，formatter 同字段可覆盖；结果经 metaMap useMemo 缓存。
- 槽名：H5 `calendar-h5-panel/month/day/day-band/day-shape/confirm/close`；PC `calendar-pc-panel/month-panel/cell/cell-band/cell-shape`；共用件在 `ui/calendar-parts.tsx`（Header/WeekdayHeader/DayContent/ConfirmBar）。

### 3.13 Field / Input / Textarea（模式 A，表单基础件）

Vant 没有独立 Input/Textarea——`<van-field>` 一个组件覆盖单行/多行/数字全部场景（多行 = `type="textarea"`，数字 = `type="digit" | "number"`）。Bivane 拆成**三件分层**：

- `components/ui/input.tsx` 导出 `Input` / `Textarea`：无 Cell 外壳的基础控件，负责原生属性透传、token 排版、digit/number 输入过滤；供 Field 内部使用，也对外公开（Search、Stepper 等后续组件复用）。
- `components/ui/field.tsx` 导出 `Field`：Cell 行外壳（label、必填星、左右图标、清除、错误文案、字数、action 插槽、自定义控件 children），内部按 `type` 渲染 Input 或 Textarea。
- 逻辑下沉 `hooks/use-field-state.ts`：过滤/夹紧/校验/字数全部纯函数，React 绑定只薄薄一层。

**定死取值**（逐字移植 Vant `field/index.less`，token 组 `--bv-field-*`）

| 项                     | 取值                                                                                                             | token                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| label 宽 / 右间距      | `6.2em` / 16px（`--bv-padding-md`）                                                                              | `--bv-field-label-width` / `-label-margin-right` |
| label 字色/字号/行高   | text / 14px / 20px                                                                                               | `--bv-field-label-color` 等                      |
| 输入字色/字号          | text / 14px                                                                                                      | `--bv-field-input-text-color` / `-font`          |
| placeholder            | gray-5（`#c8c9cc`）                                                                                              | `--bv-field-placeholder-text-color`              |
| 错误字色               | danger；错误文案 12px / 18px                                                                                     | `--bv-field-input-error-text-color` 等           |
| 禁用字色               | gray-5                                                                                                           | `--bv-field-input-disabled-text-color`           |
| 左/右图标、清除图标    | 16px；清除 gray-5、右图标 gray-6                                                                                 | `--bv-field-icon-size` / `-clear-icon-color`     |
| textarea 最小高        | 60px                                                                                                             | `--bv-field-text-area-min-height`                |
| 字数                   | 12px / gray-5，文案 `${length}/${maxlength}`                                                                     | `--bv-field-word-limit-color` 等                 |
| 行节奏                 | 与 Cell 完全相同（纵向 10px + 24px 行高 = 44px 热区），复用 cell token，不重写                                   | —                                                |
| PC 边框盒（fine 指针） | 1px gray-4 描边、4px 圆角、32px 高、盒内 px 8px；hover/聚焦转 primary，错误转 danger，禁用 gray-2 底 + gray-3 边 | `--bv-field-pc-*`（见下条规则）                  |

**关键规则**

- **模式 A，不自判定 mode**：三件都是纯 ui 件，无 `data-mode`、无 h5/pc 文件、无懒加载。双模式差异全部沉到 utilities.css 的 `@media (pointer: fine)`，不靠 `bv-pc:` 变体（Field 可能渲染在没有 `[data-mode]` 祖先的位置，与 select-parts 等共用件同理）：触屏 `pointer: coarse` 逐字保持 Vant H5（无框行 + 聚焦仅变色），精确指针设备得到两处桌面化增强——① 键盘焦点环（`.bv-focus-ring` + `:focus-visible`，后续 Switch/Checkbox 等模式 A 件复用）；② **PC 默认边框**（见下条）。混合设备按真实指针能力判定，不依赖可配断点。H5 聚焦行为逐字对齐 Vant：根挂 `data-focused`，label 与左图标转 primary。
- **PC 边框（桌面端默认有框，触屏无框）**：桌面端输入控件必须有可见边界，语言与各 `*-pc-trigger` 统一（gray-4 / 圆角 4px / 32px 高 / hover·聚焦 primary）。两种出框位置：
    - **裸用 Input/Textarea**：控件自身出框（32px 定高、px 12px；textarea 纵向 px/py 8px），`:focus-visible` 描边转主色，焦点环仍由 `.bv-focus-ring` 画在控件自身，`aria-invalid` 红框，`:disabled` 灰底灰边。
    - **Field 内**：由 `field-control` 内新增的 **`field-box` 槽**出框——框住「输入区 + 清除键 + 右图标/箭头」；`action`（发送验证码等）是 box 的兄弟节点，**留在框外**（桌面端 `[输入框] [按钮]` 范式）。盒内裸件的描边/内边距/定高/焦点环全部让位（后代选择器压过裸件规则），避免双框双环；盒聚焦态用根 `data-focused` 驱动主色描边 + 1px `box-shadow` 光环，错误态（根 `data-error`）红框红环且**优先于 hover/聚焦**。textarea 盒打 `data-textarea="true"`：不钉 32px、高随 autosize。PC 下行底线 `.bv-hairline--bottom` 隐藏（框承担行间分隔）。H5 下 field-box 是零装饰几何容器，行布局与 Vant 完全一致。
- **digit 与 number 的区别（逐字对齐 Vant）**：
    - `digit`：渲染 `type="text"` + `inputMode="decimal"`，按键即过滤，正则 `/^\d*$/`（只留非负整数数字）。
    - `number`：渲染原生 `type="number"`（手机唤起带符号数字键盘），允许 `/^-?\d*(\.\d*)?$/` 形态的中间态（`-`、`1.` 不得在输入过程中被掐掉）。
    - 非法输入的回退靠受控渲染：`onChange` 先过滤，未通过则不回写状态，React 把 DOM 值拉回旧值。
    - `min`/`max`（Vant 4.9.5+）仅对 number/digit 生效，**失焦时**夹紧（空值与非数字不夹），夹紧结果走一次 onChange 回写。
- **formatter**：`formatTrigger="onChange"`（默认）在每次变更后过 `formatter`；`"onBlur"` 只在失焦后格式化并回写。formatter 与数字过滤串联：先类型过滤、再 formatter。
- **rules 轻量内置校验**（不做 Form 本体）：规则项 `{ required?, pattern?, min?, max?, validator?(value): boolean|Promise, message? }`；`validateTrigger` 默认 `onBlur`，可选 `onChange`。校验结果内部 state 与受控 `error/errorMessage` 合并——**受控错误优先**（显式传 error 时不被 rules 覆盖）。ref 暴露 `validate(): Promise<boolean>` 与 `resetValidation()`，留给以后 Form 聚合；纯函数 `validateFieldRules` 直接单测。
- **clearable**：`clearTrigger="focus"`（默认）聚焦且有值才显示，`"always"` 有值即显示；点清除 = 清空值 + 触发 onClear + **焦点回到输入框**（Vant 行为）。清除图标带 `aria-label="清除"`，触控热区不小于 44px（图标视觉 16px，外层 padding 撑热区）。
- **autosize**：`boolean | { minHeight?, maxHeight? }`。`useLayoutEffect` 测 `scrollHeight`，先设 `height:auto` 再取 scrollHeight 写高，避免在旧高度上累加；受 min/max 钳制，超出 maxHeight 元素内部滚动。ResizeObserver 跟宽度变化重测（jsdom 无布局时降级为不设高）。
- **字数与 maxlength 分工**：maxlength 直接透传原生属性（textarea + input 都由浏览器拦截）；字数仅展示，超长时数字转 danger 色（Vant：word-limit 超限红色），不在 JS 截断。
- **label 关联**：`id` 不传时用 `useId()` 生成（`bv-field-<id>`），label 渲染为 `<label htmlFor>`；点击 label 聚焦输入框。required 只画红星不管校验（与 Vant 一致）。
- **自定义控件体**：传 `children` 时不渲染原生 input/textarea（Vant 的 `#input` 插槽语义）——readonly Field 内嵌 Select/DatePicker 触发器的标准用法，点击整行仍通过 `onClickInput` 透出。此时 rules 校验 `value` 字符串形态，调用方也可用 ref.validate 手动触发。
- **action 区**：右侧 action prop（Vant `#button` 插槽，如「发送验证码」）是 `field-control` 下与 `field-box` 平级的兄弟节点，渲染在边框盒**外侧**（盒内顺序：输入区 → 清除 → 右图标/箭头；action 不与 clear 图标争位）。
- 槽名：`field / field-label / field-control / field-box（PC 边框盒，H5 零装饰）/ field-body / field-left-icon / field-right-icon / field-clear / field-error / field-word-limit / field-action`；基础件 `input` / `textarea`。

## 4. 测试要求

- 每个自适应组件两个测试组：`describe('h5 mode')` / `describe('pc mode')`，用 `forceMode` 或 mock `matchMedia` 切换。
- 必测：打开/关闭、值变更、键盘（PC）、手势/热区（H5）、边界值（min/max/disabled）。
- 纯逻辑（过滤、夹紧、区间、索引换算）抽纯函数单测；滚轮滚动、面板几何、区间底色等布局断言 jsdom 做不了，归 `visual-check.mjs` 真机探针。
- 「开没开」断言 `aria-expanded`，不断言 Popup 的 `data-state`（jsdom 下恒 closed）。
- 视觉回归（后期可选）：Playwright 双 viewport（375×812 / 1440×900）截图对比。
