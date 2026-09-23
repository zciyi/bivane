# Bivane 响应式交互矩阵（H5 / PC 双模式）

> 配套文档：`bivane-architecture.md`（§6 是机制，本文是逐组件定义）。
> 规则：**本表的定义是唯一事实源。**生成组件时必须照此实现，不得自行发挥；确需偏离时先在本文档追加一行修订。

---

## 1. 判定与降级总则

1. 判定优先级：`forceMode` prop → `<ResponsiveProvider mode>` → 自动判定（宽度 < 768px 或 `pointer: coarse && hover: none`）
    - `forceMode` 的取值是 `'mobile' | 'desktop'`（即 `DeviceMode`），**不是** `h5` / `pc`。`h5` / `pc` 只是落到 DOM 上的 `data-mode` 属性值。写错会 `TS2322`
2. **能力等价原则**：PC 模式不得因交互差异而丢失功能。H5 独有能力（下拉刷新、滑动删除、数字键盘）在 PC 必须给出等价操作（刷新按钮、悬停操作区、普通输入）
3. **props 一致性原则**：同一组件的 H5/PC 两套实现必须接受完全相同的 props；差异只体现在交互与容器形态
4. **默认值等价**：两种模式下的默认值、校验规则、受控语义完全一致，不因模式改变行为
5. 落地模式标注：**A** = 纯 CSS 差异｜**B** = 同一 primitive 换壳｜**C** = 双实现

## 2. 交互矩阵（按组件）

### 2.1 弹层与反馈类

| 组件                | H5 模式                                                    | PC 模式                                                                                        | 模式                  | 共享逻辑                      | 状态   |
| ------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- | ----------------------------- | ------ |
| **Popup（基础）**   | 四向滑入，`position: bottom` 默认，圆角 + 安全区，下拉关闭 | **`position` 一律降级为居中模态**（原值留在 `data-position`，实态记 `data-position-resolved`） | **B**                 | 进出场动画时长                | ✅ P1  |
| **Overlay / 遮罩**  | 点击即关，蒙层 `rgba(0,0,0,.7)`                            | 蒙层 `rgba(0,0,0,.45)`，点击不关（可配）                                                       | A                     | 滚动锁定                      | ✅ P1  |
| **Dialog**          | 底部弹出抽屉，可下拉关闭，圆角顶部 16px，内容随高度增长    | 居中模态框，宽 520px，点击遮罩/ESC 关闭，焦点陷阱                                              | **B**                 | open 状态机、关闭时机         | ✅ P1  |
| **Toast**           | 顶部居中胶囊，单例（新覆盖旧），2s 自动消失                | 右上卡片栈，带关闭按钮，可多条并存                                                             | **C**                 | 队列与生命周期                | ✅ P1  |
| **ActionSheet**     | 底部动作列表 + 取消按钮分离，项高 48px                     | 居中对话框内纵向列表，或上下文菜单（≤5 项时用 Popover）                                        | **B**                 | 选项数据结构                  | ⬜ P1′ |
| **Alert / Confirm** | 顶部抽屉式或居中窄弹窗，按钮纵向排列（Vant 默认）          | 居中弹窗，按钮横向右对齐（主按钮在右）                                                         | **A**（排布差异为主） | 按钮语义顺序                  | ⬜ P1′ |
| **Notify**          | 顶部横幅滑入                                               | 右上角角标通知                                                                                 | **C**                 | 队列管理                      | ⬜ P1′ |
| **Loading**         | 全屏遮罩 + 居中转圈                                        | 局部骨架屏优先，全屏遮罩降级                                                                   | **A/B**               | 展示时机                      | ⬜ P1′ |
| **Tooltip**         | 长按触发，浮层跟随手指，1.5s 后自动消失                    | hover 触发 200ms 延迟显示，跟随鼠标，ESC 可关                                                  | **C**                 | 内容渲染                      | ⬜ P2  |
| **Popover**         | 底部抽屉（内容 > 3 行）或轻量气泡（≤ 3 行）                | 锚定浮层，翻转防溢出，键盘可导航                                                               | **C**                 | 锚点计算（共用 lib/position） | ⬜ P2  |

### 2.2 选择与输入类（双实现重灾区，本项目核心价值）

| 组件                          | H5 模式                                                                                                                                                                                                                                       | PC 模式                                                                                                                                                | 模式    | 共享逻辑                                 | 状态  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ---------------------------------------- | ----- |
| **Select**                    | 底部弹层列表，项高 48px，选项 > 10 才出现搜索框，单选即关                                                                                                                                                                                     | 锚定下拉浮层 + 虚拟滚动列表，键盘上下选择/回车确认/输入过滤，多选保持展开                                                                              | **C**   | 选项过滤、受控值、分组                   | ✅ P2 |
| **DropdownMenu**              | 底部抽屉，二级菜单为二级面板推入；可选值场景（value/onChange）按树中 value 匹配**完整层级路径**回填触发器，展开时**自动下钻到选中项所在层**并滚入视野，头部铺出**可点的层级链**（点任意祖先层直接切过去）；传 `confirmable` 走「暂存 → 确定」 | 锚定下拉菜单，子菜单向右展开，支持快捷键提示；可选值场景点选即生效并按同一套层级路径回填，展开时**自动铺开选中项所在子菜单链**并滚入视野，**无工具栏** | **C**   | 菜单树结构                               | ✅ P2 |
| **DatePicker**                | 底部弹层 + 三列滚轮（年/月/日，5 行制居中），原生惯性 + `scroll-snap` 吸附对齐，工具条（取消 · 标题 · 确定）；`columnsType` 可裁列；区间模式多一条「开始 / 结束」两段式入口，两端都选上「确定」才可用                                                                                                                                                                           | 锚定浮层 + 月历面板（6×7 网格），上下月按钮 + 键盘巡航（←→↑↓ / PgUp/PgDn / Home/End / Enter / Esc），触发器可直接输入 2026-09-20；区间并排双月，第一下点起点、悬停即预览区间带                                                                      | **C**   | 日期值计算（解析/格式化/min-max 逐字段夹紧/区间排序）、滚轮列模型 | ✅ P2 |
| **TimePicker**                | 底部弹层 + 两/三列滚轮（时/分/秒）                                                                                                                                                                                                            | 锚定浮层 + 可滚动候选列表（或直接输入时分）                                                                                                            | **C**   | 时间校验、步长                           | ⬜    |
| **Calendar**                  | 全屏弹层，月份列表纵向滚动加载，支持 range 拖选                                                                                                                                                                                               | 内嵌面板（非弹层），可常驻页面，range 拖选 + 键盘方向键移动                                                                                            | **C**   | 月网格计算、选中区间逻辑                 | ⬜    |
| **Picker（通用滚轮）**        | 底部弹层 + 多列滚轮联动，列宽随内容                                                                                                                                                                                                           | 锚定浮层 + 多列面板（每列可滚动/搜索），或降级为多个 Select                                                                                            | **C**   | 列联动、级联数据                         | ⬜    |
| **Cascader / Area**           | 底部弹层 + 滚轮级联（选一级推入二级）                                                                                                                                                                                                         | 锚定浮层 + 多列面板 + 面包屑路径，支持搜索定位                                                                                                         | **C**   | 级联数据索引、路径回显                   | ⬜    |
| **Slider**                    | 触摸拖拽，禁用页面滚动（`touch-action: none`），滑块热区放大到 44px                                                                                                                                                                           | 点击轨道任意位置跳转 + 拖拽 + 方向键微调（±step）                                                                                                      | **C**   | 值换算、步长、区间逻辑                   | ⬜    |
| **Stepper**                   | 输入框唤起数字键盘，加减按钮热区 44px                                                                                                                                                                                                         | 输入框 + 上下箭头 + 键盘上下微调                                                                                                                       | **A/B** | 边界与步长                               | ⬜    |
| **NumberKeyboard**            | 自定义数字键盘弹层（含「完成」键）                                                                                                                                                                                                            | 不渲染，直接使用系统键盘                                                                                                                               | **C**   | 输入格式化                               | ⬜    |
| **Uploader**                  | 点击唤起相机/相册（`capture`），图片压缩后上传，宫格预览                                                                                                                                                                                      | 拖拽上传区域 + 文件选择器，支持多选/粘贴，列表视图                                                                                                     | **C**   | 上传队列、进度、校验                     | ⬜    |
| **Search**                    | 点击后全屏搜索页，返回按钮退出，历史记录                                                                                                                                                                                                      | 内联输入框 + 下拉建议浮层，支持快捷键聚焦                                                                                                              | **C**   | 搜索防抖、历史/建议数据源                | ⬜    |
| **Rate**                      | 点击/滑动选择，热区 44px                                                                                                                                                                                                                      | 点击/悬停预览（hover 高亮）+ 键盘方向键                                                                                                                | **C**   | 值语义                                   | ⬜    |
| **Checkbox / Radio / Switch** | 行高 ≥ 48px，整行可点（Radio 在 Cell 内整行触发）                                                                                                                                                                                             | 标准控件尺寸 16~20px，label 可点，支持键盘空格                                                                                                         | **A**   | 受控状态                                 | ⬜    |

### 2.3 导航与列表类

| 组件                      | H5 模式                                                          | PC 模式                                           | 模式  | 共享逻辑         |
| ------------------------- | ---------------------------------------------------------------- | ------------------------------------------------- | ----- | ---------------- |
| **Tabs**                  | 横向可滑动标签，激活项自动滚入视野，支持手势切换内容             | 横向标签 + 下划线，支持键盘左右切换，不滑动       | **B** | 激活态与切换动画 |
| **Tabbar**                | 底部固定 + 安全区，图标 + 文字                                   | 降级为侧边导航或顶部导航（依业务布局配置）        | **C** | 路由映射         |
| **NavBar**                | 返回箭头 + 标题居中 + 右侧动作                                   | 面包屑或页面标题栏（左对齐 + 操作区右对齐）       | **B** | 层级与返回逻辑   |
| **List（列表）**          | 无限滚动 + 触底加载 + 下拉刷新                                   | 分页器（页码 + 每页条数）或虚拟滚动 + 滚动加载    | **C** | 数据获取状态机   |
| **Table**                 | 卡片化列表展示（关键字段 + 展开详情）                            | 标准表格，支持排序/列固定/列筛选/行选择           | **C** | 列定义、排序规则 |
| **PullRefresh**           | 原生下拉刷新，三态文案（下拉刷新/释放刷新/加载中），阻尼系数 0.3 | 不渲染下拉区，顶部提供「刷新」按钮 + 最后更新时间 | **C** | 刷新状态机       |
| **SwipeCell**             | 左右滑动露出操作按钮，弹性边界，超阈值自动展开                   | 不滑动手势，行悬停时右侧显示操作按钮              | **C** | 操作项定义       |
| **Sticky**                | `position: sticky` + 顶部安全区偏移                              | 同左，额外支持吸顶后加阴影                        | A     | 吸顶阈值         |
| **Grid / Cell / Divider** | 4 列网格，cell 行高 44~48px                                      | 网格仍 4~6 列，cell 行高 40px，hover 态           | A     | 数据结构         |

## 3. 三个参考实现（任务卡已填好，可直接执行）

### 3.1 DatePicker（模式 C · 最高优先级）

```
请按 @bivane-architecture.md 与 @bivane-responsive-matrix.md 生成组件 DatePicker。

1. 归属：responsive/date-picker.tsx 分发 → h5/date-picker.tsx、pc/date-picker.tsx
2. 双模式定义：
   - H5：底部弹层 + 三列滚轮（年/月/日），惯性滚动 + 吸附对齐，顶部工具条（取消/标题/确认），
         底部安全区；弹层打开时锁定 body 滚动
   - PC：锚定输入框的浮层 + 单月历面板，支持上下月按钮 + 键盘方向键、直接输入 2026-09-20、
         Esc 关闭，range 模式显示双月并支持区间悬停预览
   - 模式：C，理由：滚轮与日历是两种交互范式，无法用同一 primitive 换壳实现
3. Props（双模式一致）：value, defaultValue, onConfirm, onChange, min, max, type('single'|'range'),
   columnsType, format, title, placeholder, disabled, clearable, forceMode, className
4. 共享逻辑下沉 hooks/：use-date-value.ts（值规范化/区间计算/格式化/边界校验）、use-picker-column.ts（滚轮吸附与惯性）
5. 依赖：popup、button、icon、use-device-mode、use-lock-scroll、responsive-provider
6. 完成标准：§4 十一条契约 + §9 五个质量门；两模式各 1 个行为测试（选值 + 边界）
7. 产出：源码 + registry JSON + 测试 + docs 双模式 demo
```

### 3.2 Dialog（模式 B）

```
请按 @bivane-architecture.md 与 @bivane-responsive-matrix.md 生成组件 Dialog。

1. 归属：responsive/dialog.tsx（单文件内按 useDeviceMode 分支，不拆两份实现）
2. 双模式定义：
   - H5：底部抽屉（复用 Popup 的 bottom 形态），下拉关闭，顶部圆角 + 拖拽指示条，内容超出时内部滚动，按钮纵向排列
   - PC：居中模态（Radix Dialog），宽 480~560px，ESC/遮罩关闭，按钮横向右对齐，打开动画 200ms 淡入缩放
   - 模式：B，理由：状态机与内容一致，仅容器形态与关闭手势不同
   - 注：原稿写「底部抽屉（vaul）」，实测 vaul 只支持 bottom sheet、且已停止维护，改为自研 pointer 手势（hooks/use-drag-to-dismiss.ts）。落地值见 §3.4
3. Props：open, defaultOpen, onOpenChange, title, description, showConfirmButton, confirmText,
   showCancelButton, cancelText, onConfirm, onCancel, closeOnClickOverlay, forceMode, className
4. 命令式：showDialog({...}) / showConfirmDialog({...})，复用同一渲染逻辑，portal 挂载自动卸载
5. 依赖：overlay、button、use-device-mode、use-lock-scroll、responsive-provider
6. 完成标准：§4 十一条契约 + §9 五个质量门；两模式各 1 个行为测试（打开/确认/遮罩关闭）
7. 产出：源码 + registry JSON + 测试 + docs 双模式 demo
```

### 3.3 Select（模式 C）

```
请按 @bivane-architecture.md 与 @bivane-responsive-matrix.md 生成组件 Select。

1. 归属：responsive/select.tsx 分发 → h5/select.tsx、pc/select.tsx
2. 双模式定义：
   - H5：底部弹层列表，项高 48px，选中项右侧勾选图标，选项 > 10 时显示内置搜索框，单选即关
   - PC：锚定下拉浮层 + 虚拟滚动，键盘 ↑↓ 移动 / Enter 选中 / Esc 关闭 / 输入过滤，
         浮层自动翻转防溢出，支持多选时保持展开
   - 模式：C，理由：H5 依赖弹层与触控热区，PC 依赖锚定浮层与键盘导航，交互范式不同
3. Props（双模式一致）：value, defaultValue, onChange, options, multiple, searchable, placeholder,
   disabled, clearable, emptyText, forceMode, className
4. 共享逻辑下沉 hooks/：use-select-state.ts（单/多选值管理、过滤、分组）
5. 依赖：popup、field、icon、use-device-mode、use-lock-scroll、responsive-provider
6. 完成标准：§4 十一条契约 + §9 五个质量门；两模式各 1 个行为测试（选择/过滤/键盘）
7. 产出：源码 + registry JSON + 测试 + docs 双模式 demo
```

### 3.4 P1 弹层落地记录（as-built）

§2.1 中 **Popup / Overlay / Dialog / Toast 四条已落地**（见该表状态列 ✅ P1）；其余（ActionSheet / Alert / Notify / Loading）**未实现，顺延为 P1′**。实际取值与落地方式记录如下，后续组件照此对齐。

**模式归属（实测确认可行）**

| 组件   | 落地模式 | 为什么                                                                   |
| ------ | -------- | ------------------------------------------------------------------------ |
| Popup  | **B**    | 同一 `position` 状态机 + 内容，H5 换贴边滑入壳、PC 换居中模态壳          |
| Dialog | **B**    | 同上；H5 复用 Popup 的 bottom 形态，PC 用 Radix Dialog                   |
| Toast  | **C**    | 两端不是换壳而是**本质不同的信息模型**：H5 单例胶囊 vs PC 可并存的通知栈 |

**已经定死的取值（写进 token，勿在组件里硬编码）**

| 项          | H5                          | PC                                  | token                                              |
| ----------- | --------------------------- | ----------------------------------- | -------------------------------------------------- |
| 遮罩浓度    | `rgba(0,0,0,.7)`            | `rgba(0,0,0,.45)`                   | `--bv-overlay-background`                          |
| 进出场时长  | 300ms                       | 200ms                               | `--bv-popup-duration`                              |
| 弹层圆角    | 16px（贴边内侧两角）        | 8px（四角）                         | `--bv-popup-round-radius` / `--bv-popup-pc-radius` |
| Dialog 宽度 | 100%（贴边）                | 520px                               | `--bv-dialog-pc-width`                             |
| Dialog 按钮 | 纵向铺满，确认在上          | 横向右对齐，主按钮在右，最小宽 88px | `--bv-dialog-button-min-width`                     |
| 点遮罩关闭  | 默认 **true**               | 默认 **false**                      | — （prop 显式传值时两端一致）                      |
| Toast       | 顶部居中胶囊，单例，2s 自关 | 右上卡片栈，可并存，带关闭按钮      | `--bv-toast-*`                                     |

**Popup 的形态降级（能力等价，不是功能缺失）**

PC 下 `position` 的 `top/left/right/bottom` **一律渲染为居中模态**，但原始值保留在 `data-position`、实际形态记录在 `data-position-resolved`。理由：底部滑入面板是移动端范式，宽屏下会出现「贴底一条长面板」的可用性问题；内容、回调、关闭方式全部保留。

**H5 居中模态的宽度（缺陷修正 · 2026-09-21）**

初版写成 `left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-auto max-w-[90vw]`，实机把面板压到约 **187.5px / 375px 视口（50%）**，长文本被挤成折行（用户实测「列表项 2」断成两行）。

根因是**绝对定位 + shrink-to-fit 的可用宽度**：`left: 50%` 配 `w-auto` 时 `right` 为 `auto`，shrink-to-fit 的可用宽度 = 包含块宽 − left = **半屏**；`max-w` 只是上限，救不了。`-translate-x-1/2` 是绘制期变换，改不了这个计算结果。

现在逐字对齐 Vant `.van-popup--center`：

| 项       | Vant                                      | Bivane（修正后）                                                                        |
| -------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| 横向定位 | `left: 0; right: 0`                       | `inset-x-0`                                                                             |
| 宽度     | `width: fit-content`                      | `w-fit`（按内容收缩，两侧等距）                                                         |
| 居中     | `margin: 0 auto`                          | `mx-auto`                                                                               |
| 最大宽   | `calc(100vw - var(--van-padding-md) * 2)` | `max-w-[var(--bv-popup-center-max-width)]`（=`calc(100vw - var(--bv-padding-md) * 2)`） |
| 纵向     | `top: 50%` + `translateY(-50%)`           | `top-1/2 -translate-y-1/2`（不变）                                                      |

`--bv-popup-center-max-width` 定义在 `tokens/styles/vant.css`。**不要用 `90vw`**：大屏下留白比例会失控，且与 Vant「固定留白」的语义不同。

实机验证（`node scripts/visual-check.mjs`，390×780 视口）：面板宽 **293.36px**（占视口 **75.2%**，上限 358px 未被触及 → 确认是按内容收缩而非撑满）、`leftGap 48.31` / `rightGap 48.33`（等距居中）、8 行 `Cell` 行高均为 44px、**折行行数 = 0**。回归由 `tests/popup.test.tsx` 的 `position="center" … 不得再用 left-1/2 + w-auto` 一例锁定。

**H5 居中模态的高度（缺陷修正 · 2026-09-21）**

同一处还有第二个缺陷，症状离宽度问题很远、但根因同源：**center 分支漏了高度上限**。

Vant 把 `max-height: 100%` 写在 `.van-popup` **基类**上，`--center` 是靠继承吃到的；Bivane 把类名按 `position` 分支产出，于是只给 `top` / `bottom` 写了 `max-h-[var(--bv-popup-max-height)]`，center 漏了。

后果不是「没有上限」这么轻：面板高度 = 内容高度 → 里面的滚动容器（`min-h-0 flex-1 overflow-y-auto`）永远拿不到约束 → **内部滚动彻底失效**，内容一高就同时溢出视口上下两端，且滚不动。

修复：center 也加 `max-h-[var(--bv-popup-max-height)]`，三种 H5 形态的高度上限统一由同一个 token 管。

| position         | 高度上限                        | 说明                                                             |
| ---------------- | ------------------------------- | ---------------------------------------------------------------- |
| `top` / `bottom` | `--bv-popup-max-height`（90vh） | 一直有                                                           |
| `center`         | `--bv-popup-max-height`（90vh） | **本次补上**。Vant 此处是基类的 `100%`，我们用 90vh 留出上下呼吸 |
| `left` / `right` | 无（`inset-y-0` 满高）          | 不受影响，宽度才是它们的约束                                     |

实机验证（390×780 视口，40 行 Cell → 内容高 1852px）：面板 `h = 702px`（= 90vh，**正好封顶**）、`y = 39` 且 `y + h = 741 < 780`（**两端均未溢出**）、滚动容器 `clientHeight 702 / scrollHeight 1852` → `scrollable: true`。短内容（8 行）面板仍为 444px、`scrollable: false`，与修复前一致，**无回归**。PC 侧本来就有 `--bv-popup-pc-max-height`（80vh），实测 `h = 720px` + `scrollHeight 1852`，行为不变。

回归由 `tests/popup.test.tsx` 两例锁定：center 单例断言类名含 `max-h-[var(--bv-popup-max-height)]`，外加一例遍历 `top` / `bottom` / `center` 三形态——按 position 分支产出类名时最容易漏掉其中一个，遍历能挡住下一次。

**手势与滚动的实现约定**

- 下拉关闭为自研 pointer 手势（`hooks/use-drag-to-dismiss.ts`）。判定逻辑抽成纯函数 `resolveDragOutcome()`，要求**位移超过 16px 才认速度**——否则手指抖动会产生瞬时高速度值，误判为「快速下拉」而关掉弹层
- 滚动锁双策略（`hooks/use-lock-scroll.ts`）：H5 用 `fixed` + 记录 `scrollTop`（治 iOS 橡皮筋），PC 用 `overflow:hidden` + 补偿滚动条宽度
- `mode` 必须由弹层**显式传入**滚动锁与遮罩，不能让它们各自再判定一次，否则 `forceMode` 逃生舱不会作用于锁策略与遮罩浓度

**Toast 的单例语义（模式 C 的关键差异）**

同一组调用 `showToast('第一条'); showToast('第二条')`：H5 只看到「第二条」（新的覆盖旧的），PC 两张卡片并存。这条差异由**测试**固定，不是实现细节。

### 3.5 P2 Select 落地记录（as-built）

§2.2 中 **Select 已落地**（见该表状态列）；该表其余 13 行未实现。

**模式归属：C，而且必须是 C**

原任务卡给的理由是「H5 依赖弹层与触控热区，PC 依赖锚定浮层与键盘导航，交互范式不同」。落地后可以给出更硬的判据：**两端连信息模型都不一样**——

|        | H5                                               | PC                                                      |
| ------ | ------------------------------------------------ | ------------------------------------------------------- |
| 容器   | `Popup`（底部弹层，通栏、圆角 16px、可下拉关闭） | Radix `Popover.Content`（锚定触发器、圆角 4px、可翻转） |
| 行高   | 48px（触控热区下限）                             | 36px（桌面密度）                                        |
| 选法   | 点热区                                           | ↑↓ 巡航 + Enter + Home/End + Esc                        |
| 搜索框 | 选项 > 10 才出现                                 | `searchable` 即出现                                     |
| 长列表 | 原生滚动                                         | 虚拟滚动（> 100 项且无分组）                            |

**已经定死的取值（写进 token，勿在组件里硬编码）**

| 项                   | H5                                    | PC                                      | token                                                              |
| -------------------- | ------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| 触发器高度           | 44px（10 + 24 + 10，与 Cell 同节奏）  | 32px（固定高）                          | `--bv-select-padding-y` / `--bv-select-pc-trigger-height`          |
| 触发器形态           | 通栏 + `bv-hairline--bottom` 细下边线 | 1px 描边 + 圆角 4px + hover/focus 变色  | `--bv-select-pc-trigger-border-color`                              |
| 选项行高             | 48px                                  | 36px                                    | `--bv-select-option-height` / `--bv-select-pc-option-height`       |
| 面板最大高           | 60vh                                  | 280px（再取 `min()` 与 Radix 可用高度） | `--bv-select-panel-max-height` / `--bv-select-pc-panel-max-height` |
| 浮层动画             | 由 Popup 的 transition 承担（300ms）  | `bv-fade-in/out` 120ms                  | `--bv-select-pc-duration`                                          |
| 最小宽度             | 100%                                  | `max(160px, 触发器宽)`                  | `--bv-select-pc-panel-min-width`                                   |
| 选项 > 10 才给搜索框 | ✅                                    | ❌（`searchable` 即给）                 | —                                                                  |

**⚠️ 一处向设计稿的纠正：PC 浮层不用 `lib/position`**

§2.2 的 Popover 一行原写「锚点计算（共用 `lib/position`）」。落地时按架构 §6.4 的既定选型走 —— **PC 浮层用 Radix/Base UI Popover + 键盘导航**，因此 `lib/position` 不再需要，翻转/位移防溢出交给 Radix Popper 的碰撞检测。与 P1 的 vaul 同属「设计稿选型在落地时被证伪」的情形。

**实测佐证（`node scripts/visual-check.mjs`，1200px / 390px 各一次）**

| 观察项     | PC                                                                                                   | H5                                         |
| ---------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 触发器     | 200×**32**，描边 1px，圆角 4px                                                                       | 200×**44**，无描边，`::after` 细下边线 1px |
| 容器槽名   | `select-panel`                                                                                       | `popup`                                    |
| 选项行高   | **36px**（禁用项同样 36px）                                                                          | **48px**（禁用项同样 48px）                |
| 浮层动画   | `bv-fade-in 0.12s`                                                                                   | 走 Popup 的 transition（0.3s）             |
| 键盘激活项 | `bj` → `gz`（两次 ArrowDown，跳过 disabled 的成都）                                                  | `null`（无激活项概念）                     |
| 翻转       | 空间不足时 `data-side` 由 `bottom` 翻成 `top`，主轴间距恒为 4px；输入过滤后面板变矮自动翻回 `bottom` | 恒为贴底（`gapToViewportBottom = 0`）      |
| 输入「杭」 | 选项 12 → 1                                                                                          | 选项 12 → 1                                |

**键盘与无障碍约定（两模式的公共底线）**

- `↑↓` 巡航**跳过 disabled 项并回绕**，`Home`/`End` 落首尾，`Enter` 选中，`Esc` 关闭
- 关闭后焦点**必须归还给触发器**（PC 没有 Radix 的 Trigger，需显式归还）
- 触发器是 `role="combobox"` + `aria-expanded` + `aria-haspopup="listbox"`，**并且必须有可访问名称**（`ariaLabel` 会同时落到触发器、浮层与列表上）
- 分组用 `role="group"` 包一层，避免读屏把分组标题当成一个可选项
- 箭头翻转表达的是**展开态**而非展开方向（与 Ant Design / Element Plus 一致），因此 PC 浮层翻到上方时箭头不换向

**虚拟滚动的适用边界（别照搬到所有列表）**

窗口化要求**固定项高**，因此只在「纯扁平列表 + 项数 ≥ 100 + 真实测得行高 > 0」时启用：分组列表里多了标题行，项高不固定，直接全量渲染。行高是在 `useLayoutEffect` 里**量出来的**（不是写死 36），未测量完成时退化为全量，避免首帧空白。阈值取 100 也保证演示与测试里的小列表永远走全量路径，窗口化的边界问题不会污染常规场景。

### 3.6 P2 DropdownMenu 落地记录（as-built）

§2.2 中 **Select 与 DropdownMenu 已落地**（见该表状态列）；该表其余 12 行未实现。

**模式归属：C，判据是「怎么走这棵树」而不是「用什么容器」**

§2.2 给的理由是「底部抽屉 vs 锚定下拉」。落地后可以给出更硬的判据：**两端的导航范式不同**——
菜单是一棵**树**，而移动端屏幕窄，子菜单无法像桌面那样在父层右侧并排展开：

|            | H5                                                                                                                                                                                                                                                                    | PC                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 容器       | `Popup`（底部抽屉，通栏、可下拉关闭）                                                                                                                                                                                                                                 | Radix `DropdownMenu.Content`（锚定触发器、可翻转）                                   |
| 走下钻树   | **整层面板推入**：下一层从右侧推进视野，**每层**头部都铺「各层选中值」**层级链**（根层只有一格面板名，下钻后链身 = 进来时点的那一项 + 链尾 = 当前层的选中项；**链上每一项都可点**，点哪一项就落回那一层、点链首即回最上层；左键统一是「取消」，不再用返回箭头逐层退） | **子菜单向右展开**：父层留在原地（`data-state=open` 高亮表明来路），← / Esc 逐层收回 |
| 行高       | 48px（触控热区下限）                                                                                                                                                                                                                                                  | 36px（桌面密度）                                                                     |
| 快捷键提示 | 不渲染（触屏没有键盘）                                                                                                                                                                                                                                                | 渲染成 `<kbd>`                                                                       |
| 键盘       | 无巡航概念                                                                                                                                                                                                                                                            | ↑↓ 巡航（跳过 disabled）、→ 展开子菜单、← 收回、Home/End 首尾、字母键 typeahead      |

**已经定死的取值（写进 token，勿在组件里硬编码）**

| 项           | H5                                          | PC                                     | token                                                          |
| ------------ | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| 行高         | 48px                                        | 36px                                   | `--bv-menu-row-height` / `--bv-menu-pc-row-height`             |
| 触发器高度   | 由 `padding-y` 撑开（与 Cell 同节奏）       | 32px 固定高                            | `--bv-menu-pc-trigger-height`                                  |
| 触发器形态   | 通栏 + `bv-hairline--bottom` 细下边线       | 1px 描边 + 圆角 4px + hover/focus 变色 | `--bv-menu-pc-trigger-border-color`                            |
| 面板最大高   | 60vh                                        | `min(320px, Radix 可用高度)`           | `--bv-menu-panel-max-height` / `--bv-menu-pc-panel-max-height` |
| 浮层动画     | 由 Popup 的 transition 承担                 | `bv-fade-in/out` 120ms                 | `--bv-menu-pc-duration`                                        |
| 面板最小宽   | 100%                                        | 200px                                  | `--bv-menu-pc-panel-min-width`                                 |
| 推入动画时长 | 240ms（`ease-out`，`motion-reduce` 时关闭） | —                                      | `--bv-menu-push-duration`                                      |

**为什么把浮层交给 Radix（与 Select 自研巡航相反）**

Select 是**列表选择**——单层、有值回显，交互简单，自研巡航可控且能精确对齐矩阵。
菜单是**多层结构**：子菜单的展开/收回、焦点归属、typeahead、禁用项跳过，自己写一遍必然在边界上出错。
Radix 的 DropdownMenu 正好覆盖这一整块，本库只负责外观（class 与 token）与「选中后干什么」。
与架构 §6.4「PC 浮层用 Radix / Base UI」的既定选型一致。

**状态归属：路径留在 H5，值归分发层（2026-09-21 追加了「可选值」后修正）**

Select 有「值」，值语义两端一致，所以 `value` 归分发层。DropdownMenu 最初只有「路径」——
路径的深度由导航范式决定（H5 需要面板栈，PC 靠 Radix 子菜单自带状态），所以 `path` 留在
`components/h5/menu.tsx`。**2026-09-21 起 DropdownMenu 支持可选值**（`value` / `defaultValue` /
`onChange`）：值语义与 Select 一样跨模式同义，因此同样归分发层——分发层按树中 value 匹配
**完整层级路径**回填触发器，并把「暂存草稿」也收在分发层（理由同架构 §6.5 ④：暂存是值语义的一部分）。
判别口诀不变：**跨模式同义的状态归分发层，模式私有语义的状态归实现**。

**触发器回填必须带层级，不能只回填末级 label（2026-09-21 缺陷修正）**

菜单是**树**，同一个 label 可以挂在不同父级下（演示树里「移动到 / 项目文档」与顶层项并存就是这种形态）。
只回填末级 label 时，触发器上的两个字根本无法回答「选中的是哪一层里的哪一项」——
用户看到「项目文档」，无从判断它属于「移动到」还是别的父级，这正是「选中没有层级展示」的根因。

修法是让回填走**整条链**而不是单个节点：`hooks/use-menu-state.ts` 的 `findMenuPath()` 返回
「根 → 节点」的完整链（顶层节点为单元素链，调用方不必分支），`findMenuOption()` 改为复用它
（`path[path.length - 1]`，语义不变）。展示零件是 `components/ui/menu-parts.tsx` 的
`MenuTriggerPath`：

|            | 表现                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| 嵌套项     | `移动到 / 项目文档` —— 祖先与分隔符用 `--bv-text-2` / `--bv-text-3` 弱化，末级保持正文色 |
| 顶层项     | 退化为纯 label（**不渲染**祖先槽与分隔符），观感与本修正前一致                           |
| value 失效 | 回退调用方给的 `trigger` 文案，**不显示半个路径**（不残留祖先）                          |

槽名 `menu-trigger-path-ancestor` / `-separator` / `-current` 供测试与探针定位；
分隔符间距复用 `--bv-menu-gap`，**不为一个符号新开 token**（延续 §2.2「能不新增 token 就不新增」）。
两端共用同一份回填逻辑与同一组 class，所以两端的取值逐项一致（实机：PC/H5 均
`["移动到"]` + 1 个分隔符 + 末级「项目文档」，祖先色 `rgb(150,151,153)`）。

**打开即定位：展开时落到选中项所在的那一层（2026-09-21 缺陷修正）**

上一条解决「看得到」（触发器回显层级），这一条解决「打开就到位」。选中项可能埋在三层之下，
展开时若一律从根层开始，用户得自己一层层点进去才能确认当前选的是哪一条 —— 同一件事的两面。

定位量由分发层从选中值派生：`initialPath` = 选中项的**祖先 value 链**。它和「选中值」一样
跨模式同义，所以归分发层；两端各自用本模式的导航范式落位：

|     | 落位方式                                                                       | 滚入视野                           |
| --- | ------------------------------------------------------------------------------ | ---------------------------------- |
| H5  | 展开时面板栈直接初始化到该层（`path = initialPath`），标题栏与轨道位移随之到位 | 当前层的选中行 `scrollIntoView`    |
| PC  | 受控 `Sub open={openPath[depth] === item.value}`，主动铺开整条子菜单链         | 每层面板各自把自己的选中行滚入视野 |

三条设计取舍：
① **只在 open 翻转的那一刻定位**（`wasOpen` ref 守住）：展开期间改草稿（暂存模式点叶子会改
`selectedValue`）不能让视野弹回去，否则用户点一下就被踢回上一层；
② **关闭即收回**，下次展开重新定位，不停在上次手动下钻的位置；
③ 空 `initialPath`（未选中 / value 失效）等价于「从根层开始」，与本组件引入前一致。
滚动统一用 `block: 'nearest'`（与 Select 同源）：只滚到「刚好看得见」，不把整层滚到顶。

**⚠️ 踩坑记录：Radix 的两个时序陷阱（PC 端「打开即定位」踩到的，现象极易误诊）**

1. **根面板的自动聚焦比子面板挂载更晚**。Radix 的 `FocusScope` 要等 `container` 落地
   （`container` 是 state，得多走一次提交）才聚焦根面板；而 `MenuSubContent` 的
   `onFocusOutside` 会把这次落在根面板容器上的 `focusin` 判成「焦点跑到子菜单外」，
   刚铺开的整条链被立刻收回。现象是 `aria-expanded=false`、`subpanels=0`，
   像极了「`open` 没传进去」。修法：在 `SubContent` 的 `onFocusOutside` 里放行
   「焦点落在**面板容器本身**」的那一次（落到菜单项上仍按 Radix 默认行为收回）。
2. **`Presence` 是状态机，节点晚一两次提交才挂上**（`present` 翻转靠 `useLayoutEffect`
   里的 state machine 推进）。因此依赖 `open` / `openPath` 的 effect 在那一刻拿到的
   panel ref 还是 `null`，等节点挂上时依赖又没变 —— 滚动**永远不会发生**，且不会报错。
   修法：把「滚入视野」挪进面板的 **ref 回调**（挂载即滚），并让 ref 引用保持稳定
   （内联箭头每次渲染都换身份，会以 `null → node` 各调一次，把用户手动滚开的视野又拽回来）。

**H5 暂存确认与共享工具栏 PanelHeader（2026-09-21 新增）**

触屏没有键盘，点选是「高成本动作」，选择类面板需要**暂存 → 确定**这一步（点选项只打勾，
「确定」才提交，「取消」放弃暂存）；鼠标是精准设备，点一下就该生效——所以
**「取消 · 标题 · 确定」工具栏只在 H5 渲染，PC 恒为点选即生效**。这一条抽成了共享零件
`components/ui/panel-header.tsx`（槽名 `panel-header` / `-title` / `-back` / `-cancel` / `-confirm`，
token 收在 `--bv-panel-header-*` 组），Select / DropdownMenu / DatePicker 共用（DatePicker 只用「取消 · 标题 · 确定」三槽，不带面包屑），后续 TimePicker /
Picker 直接复用；`-back` 槽留给需要「逐层退」的多层面板（H5 菜单不用它 —— 回头靠头部层级行点名，
左键统一是「取消」，`onBack` 与 `onCancel` 互斥、同占左位）。
DropdownMenu 的本地标题栏（旧槽名 `menu-header` / `menu-back` / `menu-title`）已被它取代。
PC 端实现**刻意不解构**暂存相关 props（TS 的 noUnusedLocals 不豁免下划线前缀，解构出来反而挂 lint）。

**头部层级面包屑：每层都铺（根层一格面板名），链身是「进来时点的那一项」、链尾是选中值，链上每一项都可点（2026-09-21 新增，同日改两行、链身构成、可点范围与根层形态）**

「返回箭头」只能一层一层退。选中项埋在三层之下时，用户想回到上层要点多次返回；而且头部只显示
**当前层**名字，用户看不到自己是从哪一层进来的。修法是在弹窗里把这条链铺出来，链上每一项一点即到
（`path` 截断到该项所在的层），不必逐层按返回。左键由此统一成「取消」（关闭面板并放弃暂存，
见下「根层形态」），返回箭头不再被菜单占用。

链的构成（按用户需求「1层选中值/2层选中值/3层选中值 这种格式，不要前面的、后面加上选中的」修正）：
**链身 = 进入各层时点的那一项**（根层的名字说的是「这个面板叫什么」，与「选过的每一步」不同源，
因而不进链身）；**链尾 = 当前层的选中项**（暂存模式下与行内勾同源于草稿值）。
于是头部显示的正是「确定后会回填到触发器的整条链」，与 `MenuTriggerPath` 的回显是同一件事的两面：
`移动到 / 更多位置 / 共享盘`。选中项只在**当前层**里才补进链尾 —— 它挂在别的分支时补进去会被读成
「当前层的子项」，与用户眼前这一层对不上。

**链上第 i 项就是第 i 层的选中值**，所以每一项都点得，点它 = `path` 截到 i、落回那一层 ——
链首「移动到」就是第一层的选中值，**点链首即回最上层**；「更多位置」落回第二层；链尾的选中值
落回的正是当前层（点了收敛在原地）。用户的原话是「这三个都可以点，点到【移动到】应该是返回那一层，
点到哪个就是那个层」，这条映射就是它。

**根层形态**：根层也铺面包屑，只是只有一格面板名（当前落点，不给 `onSelect`）。用户的原话是
「不要这个（返回箭头），还是取消，然后第一层也要有面包屑」—— 根层没有「进来时点的那一项」，
不给它铺的话头部会在下钻那一刻从「居中标题」跳成「左对齐层级行」：行数与对齐同时变，
这是最容易被感知为「闪一下」的地方。左键则统一是「取消」，下钻中不再有返回箭头 ——
回头交给链上点名。

数据语义与渲染分家，与 §3.6 一贯的分层一致：**摊平由 H5 实现做**（`panels[i].trail[i-1].label`
即链身第 i 项），**渲染与样式归共享零件 `PanelHeader`** —— 面包屑是「通用头部」的能力，
不是 menu 私有零件，否则 `menu-parts` 要反向引用 `--bv-panel-header-*` token。

头部因此是**两行结构**（给了 `breadcrumb` 才铺第二行）：工具栏行 `panel-header-bar`（返回/取消 ·
标题 · 确定，44px）在上，层级行 `panel-header-breadcrumb`（32px）在下。面包屑与按钮挤同一行时，
链一长要么压住标题、要么被迫给两侧按钮让位而缩进，读起来是「居中飘着」的一段；独占一行后它才是
一条可从链首读起的路径，且项与项之间**不留横向内边距**，读成紧凑的「选1/选2/当前」（分隔符
直接贴着两侧文案）。

|               | 契约                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| prop          | `breadcrumb?: PanelHeaderCrumb[]`（`{ label: ReactNode; onSelect?: () => void }`）                                                                                                                     |
| 与 title 关系 | 给了 `breadcrumb` 就**替代** `title`（H5 菜单每层都给；Select 等不传的面板行为与引入前完全一致）                                                                                                       |
| 行结构        | 工具栏行 `panel-header-bar`（44px）+ 层级行 `panel-header-breadcrumb`（32px，独占一行、左对齐）                                                                                                        |
| 链的构成      | 根层 = 一格面板名（当前落点，不给 `onSelect`）；下钻后链身 = 进入各层时点的那一项 + 链尾 = 当前层的选中项（不在当前层则不补）；**链上第 i 项就是第 i 层的选中值 → 点它即落回第 i 层**（链首 = 最上层） |
| 槽名          | `panel-header-breadcrumb` / `-crumb`（可点项，`<button>`）/ `-crumb-current`（不可点项，`<span>`）/ `-crumb-separator`                                                                                 |
| 无障碍        | `nav[aria-label]`（默认「层级」）+ **末项**（当前落点，可点也照标）`aria-current="true"`                                                                                                               |

四条取舍：

① **每层都铺，根层是一格面板名**：根层没有「进来时点的那一项」，但仍铺一格（面板名），
好让头部结构在下钻前后一致 —— 否则第一层是居中标题、第二层是左对齐层级行，行数与对齐同时变。
调用方按 `trail.length === 0` 走根层分支（`title === undefined` 时可以不铺）；
**共享零件不做层数判断**，也不区分「层」与「取值」——它只按「有没有 `onSelect`」渲染；
根层这一格是当前落点因而不给 `onSelect`，渲染成不可点的 `panel-header-crumb-current`；
② **链上每一项都可点**：第 i 项就是第 i 层的选中值，点它 = `path` 截到 i、落回那一层（链首即回最上层，
不必逐层按返回）。末项照给 `onSelect` —— 它所在的层就是当前层，点了自然收敛，不必为它单开一条
不可点的样式；而「当前落点」的语义不因可点而丢：着色与 `aria-current` 只看**位次**（末项），
不看有没有 `onSelect`。回头既然能靠链上点名，**左键就统一成「取消」**（`onCancel`，暂存确认时渲染），
下钻中不再有返回箭头 —— `PanelHeader` 的 `onBack` 留给其它需要「逐层退」的多层面板；
③ **独占工具栏行下方一行 + 左对齐 + 无横向内边距**：层级行的左右内边距退回面板内边距
（`--bv-panel-header-padding-x`，原先为避开两侧按钮而缩进的 `--bv-panel-header-title-inset` 不再需要）；
④ **横向可滚 + 自动滚到末端**：项数多或文案长时抽屉宽度不够，不滚的话用户看到的仍是链首那几项，
反而不知道自己现在在哪一层。滚动 effect 的依赖用**项数**（`breadcrumb?.length`）而不是数组本身 ——
数组每次渲染都是新身份，那样会在无关渲染里反复把视野拽回末端，用户想往回看都看不成。

只新增一个**尺寸** token `--bv-panel-header-breadcrumb-height: 32px`（层级行高度，Write 到
`tokens/styles/vant.css` 的公共头部组）；颜色仍复用 `text-bv-text-2`（可点项）/ `text-bv-text-3`
（分隔符）/ `--bv-panel-header-color`（末项），不新增颜色 token（§3.7 的三处补齐不涉及尺寸 token）。
PC 端不涉及 —— 它是锚定浮层，父层本就留在原位可点，没有「弹窗上面」这一处（实机探针在 PC 下
`headerCrumbs` 为空且 7h 场景打印 `NOT_FOUND` 后跳过）。

实机佐证（`node scripts/visual-check.mjs`，探针新增 `headerCrumbs` / `headerCrumbTags` /
`headerCrumbColors` / `headerCrumbSeparators` / `headerCrumbScroll` / **`headerCrumbRow`** 六项与 7h 场景，
390×780 实机）：**根层**（`更多操作`）`["更多操作"]` + tags `["span"]` + 无标题
（`headerTitle null`、`header.back` 恒 `false`）—— 第一层就有层级行，且只有一格「当前落点」；
H5 二级（`操作菜单`，该实例无选中值）`["移动到"]` + tags `["button"]` + 0 个分隔符 —— 链上唯一一项
就是「进入当前层时点的那一项」，它同时是当前落点，所以是浓色 `rgb(50,50,51)`；
H5 三级 `["移动到","更多位置"]` + tags `["button","button"]` + 1 个分隔符 + 颜色
`[rgb(150,151,153), rgb(50,50,51)]` —— **两项都可点，但只有末项是「当前落点」的浓色**：
着色与 `aria-current` 只看位次，不看可点性；
H5 带选中值的一支（暂存点选 / 打开即定位）`["移动到","项目文档"]` + 1 个分隔符 + `header{cancel:true,
confirm:true, back:false}` —— 链尾补上的正是当前层的选中项（与触发器回显同一条链），
**下钻中左键确实是「取消」，`back` 槽不再被占用**；
`headerCrumbRow` 五个场景一致达标 `{belowBar:true, barBottom:491, top:491, height:32,
startsAtLeft:16}`、`separatorGaps` 恒为 `[0]`（无分隔符者为 `[]`）—— 真的在工具栏行下方一行、
左贴 16px 内边距、分隔符与项名零间隙，且**根层与下钻层行结构完全相同**（不会跳行）；
7h「先到三级再点链首」：点前 `layers 3` + 轨道 −780px + `["移动到","更多位置"]`，点链首后
`layers 1` + 轨道归零 + **面包屑缩成一格 `["选择位置"]`（tags `["span"]`，`headerTitle null`）**
—— 一步回最上层，头部结构与下钻前一致。

一条曾被记下的边界，这次随「每一项都可点」一并解掉：**二级且该层已有选中值时，链上曾没有任何可点项**
（链身那格是「进来时点的那一项」、位于末位之前，链尾那格是选中值，两者都不给 `onSelect`），
于是「一键回最上层」随根层标题一并消失、只能逐层按返回；改为「每一项都可点」后，链首即最上层、
链尾收敛在原地，该缺口不再存在。PC 无抽屉头部，各场景 `headerCrumbs []`、`headerCrumbRow null`（无回归）。

**jsdom 测试的开关信号：用 `aria-expanded`，别用 Popup 的 `data-state`**

Popup 是两阶段挂载（先 mounted 再 raf 切 `data-state=open`），jsdom 下 raf 回调不跑，
`data-state` 恒为 `closed`；且关闭后 DOM 常驻到退出动画结束。因此「面板开没开」的断言
必须看触发器的 `aria-expanded`，`data-state` 在测试里没有任何分辨力。

**三个槽名是分开的，别合并**

`menu-panel`（PC 主浮层）/ `menu-subpanel`（PC 子菜单）/ `menu-layer`（H5 的面板层）。
最初 H5 面板也写成 `menu-panel`，后果有两个：①「H5 不该出现 PC 浮层」这类断言**假失败**（PC 选择器在 H5 下也命中）；
② `utilities.css` 的进场动画会命中错的对象（契约第 16 条）。

**⚠️ 踩坑记录：Radix Trigger 在 `onPointerDown` 上开合，不是 `click`**

`@radix-ui/react-dropdown-menu` 的 Trigger 是 `onPointerDown: … context.onOpenToggle()`。
用 `fireEvent.click` **永远打不开**，而失败现象是「面板不存在」，极易误读成组件没渲染。
另有两处同源坑：Radix 会给子元素注入 `disabled: false`（`const { disabled = false, ...triggerProps } = props`），
经 Slot 合并会**覆盖**我们传进 `MenuTrigger` 的 `disabled` → PC 禁用态静默失效，必须给 `Trigger` 也传 `disabled`；
`SubContent` 的类型里**没有** `side`/`align`，它内部恒为右展，只暴露 `sideOffset` / `avoidCollisions`。

**⚠️ 踩坑记录：jsdom 补抛的 `window` blur 会关掉菜单（测试环境专属，曾误诊为「卸载后 handler 失效」）**

`@radix-ui/react-menu` 在菜单打开期间订阅 window 的 blur，把它当作「用户切走了窗口」并 `onOpenChange(false)`：

```js
React.useEffect(() => {
    if (!open) return;
    const handleBlur = () => handleOpenChange(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
}, [open, handleOpenChange]);
```

jsdom 会在「带着焦点的子树被移除」之后补抛一个 `window` 的 blur（浏览器不会），
于是同一个测试文件里**从第二个用例起**菜单「打开又立刻被关掉」——断言只看到「面板不存在」，
看起来完全像「Radix 的 handler 在卸载后失效」。**该现象与组件行为无关**，
已在 `tests/setup.ts` 里对 window 的 blur 做 `stopImmediatePropagation()` 截断（附成因注释）。

同源的第二个时序坑：Radix 的 roving focus 把巡航落点写在
`setTimeout(() => focusFirst(nodes))` 里（`react-roving-focus/dist/index.mjs`），
所以键盘巡航的断言必须 `await`，同步断言会读到「还没动」的旧焦点。

**键盘与无障碍约定（两模式的公共底线）**

- 分隔线用 `role="separator"`，**不参与 `menuitem` 计数**，也不占键盘巡航位
- 父项（子菜单入口）用 `aria-haspopup="menu"`，读屏念的是「打开一个菜单」而不是「执行一个动作」
- 禁用项：H5 `disabled` 属性、PC 键盘巡航跳过
- PC 关闭后焦点**归还触发器**（Radix `onCloseAutoFocus`），不能掉到 `body`
- H5 非当前层面板 `aria-hidden` 摘出无障碍树，否则读屏会把看不见的那层也念出来
- 触发器无可见 label 时必须给 `ariaLabel`（落到触发器与 `role="menu"` 上）

**实测佐证（`node scripts/visual-check.mjs`）**

| 观察项     | PC                                                              | H5                                                                                          |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 容器槽名   | `menu-panel`                                                    | `popup` + `menu-layer`                                                                      |
| 行高       | 36px                                                            | 48px                                                                                        |
| 触发器     | 32px 高、描边 1px、圆角 4px                                     | 通栏、`::after` 细下边线                                                                    |
| 快捷键提示 | `⌘E` 以 `<kbd>` 渲染                                            | 不渲染                                                                                      |
| 子菜单     | 独立浮层 `menu-subpanel`，父层不动                              | 第二层 `menu-layer[data-depth=1]`，头部层级行变「移动到」（左键是「取消」，不再有返回箭头） |
| 巡航       | `edit → duplicate → move → delete`（跳过 disabled 的 `locked`） | 无                                                                                          |

**测试要求（已落到 `tests/dropdown-menu.test.tsx`）**

`describe('h5 mode')` 12 例 + `describe('pc mode')` 7 例 + 双模式一致 3 例 + 触发器层级回显 3 例 +
打开即定位 7 例 + 头部层级面包屑 8 例 + 空态 1 例 = 41 例，
另加 `tests/menu-state.test.tsx` 9 例纯函数测试（路径下钻 / 路径失效截断 / 叶子集合）。
（面包屑一组含「根层也铺一格」「下钻中左键是取消、不渲染返回箭头」两例 —— 2026-09-21 第三轮需求）

### 3.7 P2 DatePicker 落地记录（as-built）

**模式归属复核：为什么是 C，不是 B**

任务卡写「滚轮与日历是两种交互范式」，这一点在落地时被具体化成一个可复用的判据：

> **同一个 primitive 换个壳，能不能同时满足两端？**

- Popup：底部弹层 ↔ 居中模态，**同一个盒子**换个位置与动画 → B。
- Select：H5 底部列表 ↔ PC 锚定浮层，两者都是「**一列选项 + 一个选中值**」，换壳可行 → B 的表象。
  它之所以最终是 C，是因为**信息模型不同**（H5 单选即关、PC 多选不关 + 输入过滤），
  换壳解决不了「两端要表达的语义不一样」。
- DatePicker：H5 是「**连续滚动 + 吸附**」（一维、模糊、靠手感收敛），
  PC 是「**二维网格 + 焦点巡航**」（二维、精确、靠光标定位）。共同点只剩「都是日期」——
  连「当前值」的表达方式都不同（滚轮把值放在正中的高亮行里，月历把值放在格子底色上）。
  没有共同的 primitive 可换 → **C**。

**定死取值表（写进 `tokens/styles/vant.css` 的 `--bv-date-picker-*` 组）**

| 项                     | H5                             | PC                          | 依据                             |
| ---------------------- | ------------------------------ | --------------------------- | -------------------------------- |
| 触发器                 | 通栏、`::after` 细下边线、44px | 32px、描边 1px、圆角 4px    | 与 Cell / 表单控件对齐           |
| 滚轮单行高             | **44px**（可见 5 行 → 220px）  | —                           | Vant Picker 行高                 |
| 滚轮上下留白           | 2 行（88px）                   | —                           | 首尾行也能滚到正中               |
| 选中行字号 / 字重      | `--bv-font-md` / 700           | —                           | 未选中 `--bv-text-3`，选中 `--bv-text` |
| 月历面板宽             | —                              | **252px**                   | Vant Calendar 单月宽             |
| 月历格子               | —                              | 32px 高、12px / 14px 行高   | 6×7 网格、周日为首               |
| 双月间距               | —                              | 0（两月共边框）             | 并排双月读成一张大面板           |
| 面板浮层               | Popup `bottom`（贴底 + 安全区）| `sideOffset: 4`             | 与 Select / DropdownMenu 同源    |

**状态归属（架构 §6.5 推论的实例）**

| 状态                                                   | 归属   | 理由                                                     |
| ------------------------------------------------------ | ------ | -------------------------------------------------------- |
| `open` / `selected` / `draft`（草稿）                  | 分发层 | 值语义跨模式同义，最终都是 `onChange` 的参数             |
| H5「当前在改哪一端」（`activeEnd`）                    | 实现层 | PC 用双月并排，不存在「一次只能改一端」这回事            |
| PC「视图月份 / 键盘光标 / 悬停日」（`view`/`active`/`hoverText`） | 实现层 | 滚轮没有「光标」概念，这三个状态传下去只会被忽略         |

草稿归分发层这一点与 Select 的暂存同源，但**区间草稿允许半截**（`''` = 该端未选），
由 `handleSubmit` 在提交那一刻统一收口（两端不全则不提交、也不关闭面板）。

**值形态与边界语义（两条容易写错的）**

- 值恒为 `'YYYY-MM-DD'` 字符串（区间是有序元组），**不用 `Date` 对象**：`Date` 带时区，
  `new Date('2026-09-22')` 在东八区解析成 UTC 零点 → 迟到 8 小时的地方会差一天。
  时间类组件（TimePicker）再单独定形态，不在这里预留。
- `min` / `max` 的语义分两种：**显式传入的是硬边界**（不因值越界而移动，越界值由
  `clampParts` 逐字段夹紧）；**没传时默认今天前后各 10 年**，且这个默认范围会被外部传入的
  值**向外撑开**而不是把值夹走 —— 「你给了个 2010 年的值」不该被静默改成 2016 年。
- 夹紧是**逐字段**的：只抬到越界的那一级（如 `min=2026-09-10` 时选 2026-09-01 → 得
  2026-09-10），不整体跳回边界（2026-09-10 的「年/月」不动）。

**`columnsType` 只在 H5 生效，且刻意不通过 props 泄露**

PC 是月历，必须选到具体的日；把 `['year','month']` 套到月历上会点出缺日的值。这与
Select「搜索框阈值两端不同」是同一类差异，属**矩阵对两种交互的定义差异**，不该塞进同一个 prop。

**区间的两段式入口（H5）不是功能降级**

三列滚轮一次只能表达「一个日期」，而区间是两个。三种做法里选了第三种：
① 两组滚轮并排（6 列，宽度塞不下）；② 连续两次「确定」（用户不知道现在选的是哪一端）；
③ **显式标出当前在改哪一端**（`date-picker-range-tabs`，两端各显示已选文案）。
它替代的是「PC 双月并排」在触屏上的位置 —— 符合矩阵的能力等价原则。

**惯性 + 吸附为什么不自研**

惯性 = 原生 `overflow` 动量滚动；吸附 = CSS `scroll-snap-type: y mandatory` +
每项 `scroll-snap-align: center`。自研 pointer 物理既难对齐原生手感，也会和 Popup 的
下拉关闭手势抢事件（同 `use-drag-to-dismiss` 那条约定）。`hooks/use-picker-column.ts`
因此只做两件事：**算索引**与**兜底对齐**，并且兜底对齐带**位移守卫**
（偏移已在容差 0.5px 内就什么都不做），否则原生吸附停在 ±0.5px 时再滚一次会与
「120ms 后回写值」形成自激循环，表现为滚轮轻微抖动。

**⚠️ 缺陷修正一号：区间模式打开时滚轮停在「今年 1 月 1 日」而不是今天**

`resolveCursor` 在**完全没有值**时的兜底是 `{year: today.year, month: 1, day: 1}`，
看起来只是「月日取 1」，实际后果是：

- 区间模式的两段式草稿恒以 `''` 开场 → 这是它的**主路径**，不是边界情况。
  用户点开区间选择器，年份对、月份停在一月、日期停在一号，得先滚 8 个月；
- 列裁剪形态（`['year','month']`）同样走这条路径；
- **单值形态完全看不出来** —— 分发层会给单值草稿预填今天，把这条路径盖住了。

它躲过了 tsc、ESLint、288 个单测与静态 CSS 核对，只在真机探针里露头（`月=01 日=01`；
同一次探针里 PC 月历停在「2026 年 1 月」，而 `activeText` 是 1 号）。
更值得记的是**单测当时是在为这个行为背书**：`tests/date-value.test.ts` 里写着
`expect(resolveCursor(undefined, ...)).toEqual(D(today.year, 1, 1))` —— 把实现的行为
当成规格抄了进来。断言不是「我期望的」，而是「我看到的」，等于给缺陷上了锁。
修法：兜底改成 `{...today}`，列裁剪的补位仍由后续几行负责（缺的字段才清零）。
测试改成正向断言，并补两例列裁剪下的兜底（`['year','month']` → 今天所在月 + 日补 1）。

**⚠️ 缺陷修正二号：已提交的区间在月历上没有底色（实现期自捕获）**

区间高亮最初只接「起点 + 悬停终点」这一路（矩阵写的是「悬停预览」），于是
**两端都定下来之后反而没有带**——用户会以为没选上。修法是 `displayRange` 同时覆盖两种来源：
两端都有则画整条已选区间；只有起点则用悬停日（无悬停时退化为键盘光标）当临时终点。
纯键盘操作因此也能看到带。

**顺带修掉的构建噪音：文档里的代码示例被 Tailwind 当成类名编译**

Tailwind v4 默认扫描全项目文本文件，架构文档里的
`leading-[var(--bv-<组件>-line-height)]` 被当成候选类 → 产出一条**非法 CSS**（构建期两条
warning）；把占位符换成真名的其它示例不报错，但同样会把一堆没人用的规则打进 `dist`，
消费者装包时一起拿走。修法：`index.css` 加 `@source not "./docs"` / `@source not "./.workbuddy"`
（类名只可能出现在源码里）。构建产物 CSS 65.59 → 65.19 kB，warning 归零。

**实测佐证（`node scripts/visual-check.mjs` 的 8 / 8b / 8c / 8c2 / 8d 场景 + `probeDate`）**

| 观察项         | PC                                                       | H5                                                                         |
| -------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 容器槽名       | `date-picker-panel`（锚定浮层）                          | `popup`（底部弹层，`gapToViewportBottom=0`）                                |
| 选择器形态     | 1 个（range 2 个）6×7 月历，格子 32px                     | 3 列滚轮，每列 220px = 5×44px                                              |
| 吸附           | —                                                        | `scrollSnapType: y mandatory`、`align: center`、`paddingTop: 88px`          |
| 滚轮滚动       | —                                                        | Δ3 行后 `scrollTop` 440→572（整数倍、`snapRemainder=0`）、选中 2026→2029    |
| 区间入口       | 并排双月（2026-09 + 2026-10，`dualGap=0`）                | 两段式 tabs，切「结束日期」后 `active` 随之为 true（未选满时「确定」禁用）   |
| 键盘           | ←↓ 后光标 22 → 30（`data-active` 前移）、Enter 提交并回填 | 无「光标」概念                                                             |
| 提交           | 面板关闭 + `input.value = 2026-09-22`                     | 面板关闭 + 触发器回填 `2026-09-22`                                         |
| 区间带         | 点 12 号、悬停 22 号 → `in-range` **9 格**（13~21）、底色 `rgb(242,243,245)` | —                                                    |

**测试要求（已落到 `tests/date-picker.test.tsx` / `tests/date-value.test.ts`）**

双模式行为 18 例（H5 走 Popup + 三滚轮 + 暂存确认 / 区间两段式 / 列裁剪 / clearable / disabled；
PC 可输入 / 月历 6×7 / 点选即关 / 键盘 / Esc / min-max 置灰 / 非法输入回滚 / 双月区间 / 悬停预览）
\+ 纯函数 33 例（闰年、逐字段夹紧、解析与拒绝、列范围裁剪、周边界、滚轮索引换算）。
**jsdom 不做布局**：滚轮滚动、面板几何、区间底色一律只能靠 `visual-check.mjs` 真机探针，
单测只覆盖纯函数与「点一下发生了什么」。

**⚠️ 架构修正三号：PC 月历改为 `react-day-picker` 引擎（2026-09-23）**

初版月历是**全自研**：`buildMonthGrid` 造网格、`CalendarCell` 造补位格、自己算区间内含。
复算过的边界有「跨月补位、跨年、`weekStart` 轮转、区间倒序」四类 —— 都能跑对，
但**先查上游有没有现成原语再决定自研**这条没做，属于顺序错误。补查后的结论：

- **React 版 `@radix-ui` 没有 Calendar / DatePicker 原语**（它只到 `Popover`）；
  `radix-vue` 虽有 `DatePicker` 但属 Vue 生态，本库不可用。React 侧现成件是
  `react-day-picker`（shadcn 的选择）或 React Aria。
- 因此 **PC 月历的日期引擎交 `react-day-picker` v10，本库只保留渲染层与值语义**：
  rdp 递进来的 `modifiers` 用于上色（`range_start` / `range_end` / `range_middle`），
  `data-slot` / `data-*` 契约、`data-mode="pc"`、键盘巡航仍由本库掌握。
  **键盘必须自持**：rdp 的内置巡航依赖焦点落在日期格上，与本库「触发器是可输入框、
  焦点须留在面板」冲突 → 日期格 `tabIndex={-1}` + `onMouseDown preventDefault`，
  方向键 / PgUp / PgDn / Home / End / Enter 由面板级 `handleKeyDown` 统一接管。
- **值语义不复用 rdp**：`addToRange` 那套「在已选区间上调整」与 Vant 的「再点即重选」不同，
  只取 `onDayClick` 里的那一天，区间仍由 `displayRange` 推导。
- 连带删除：`hooks/use-date-value.ts` 的 `buildMonthGrid` / `CalendarCell` / `weekdayLabels`
  与 `components/ui/date-parts.tsx` 的 `CalendarMonth`（`CalendarWeekdays` / `CalendarMonthProps`
  同去），只留 `weekBounds`（键盘 Home/End 用）。单测随之 **288 → 284 例**（月网格 4 例删除），
  DatePicker 的 18 例外层行为断言**一条未改** —— 这正是当初坚持「只换渲染层、保留全部
  `data-slot` / `data-*` 契约」的回报：门 5 / 6 / 7 的探针与断言基本无需重写。

**⚠️ 缺陷修正四号（本轮真机抓到的静默失效）：rdp 的受控开关在 `onSelect` 上**

`useSingle` / `useRange` 内部都是同一行：

```js
const selected = !onSelect ? internallySelected : initiallySelected;
```

即**不传 `onSelect` 时 rdp 走非受控分支**：它把 `selected` 当初始值 useState 存一份，
之后自己维护内部 state，我们这边再更新 `selected` prop 会被**完全忽略**。

症状与排除路径（值得复用的排查法）：

| 现象 | 排除掉的可能 |
| ---- | ------------ |
| PC 区间「悬停预览」不动：状态已是 `{from: 09-20, to: 09-25}`，DOM 仍停在上一帧的带 | 先读 DOM 上 `__reactProps` → `onMouseEnter` **确实挂在 button 上**；直接调用它，DOM 仍不变 → **不是事件投递问题** |
| 同上 | 在 rdp 的 `DayButton` 里打印 `modifiers` → `range_start` 停在**上一帧**的日期 → **rdp 内部就是给了旧值** |
| 同上 | 读上游 `useRange.js` / `useSingle.js` 源码 → 命中 `!onSelect` 分支 |

四门（tsc / ESLint / vitest / 构建）对此**全部无感**，而且**没有任何报错**。
修法：`rdpSharedProps` 传一个空实现 `RDP_NOOP_SELECT`，把开关拨到受控侧；
选值语义仍由 `onDayClick` 负责。
**可复用的教训：把状态交给上游组件时，别按 prop 名字假定「我传了 `selected` 就是受控」——
去读它的源码确认开关在哪。**

## 4. 测试要求

- 每个自适应组件必须有两个测试组：`describe('h5 mode')` / `describe('pc mode')`，通过 `forceMode` 或 mock `matchMedia` 切换
- 必测项：打开/关闭、值变更、键盘操作（PC）、手势/点击热区（H5）、边界值（min/max/disabled）
- 视觉回归（可选，后期）：Playwright 双 viewport（375×812 / 1440×900）截图对比

## 5. 修订记录

| 版本 | 日期       | 变更                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1   | 2026-09-20 | 初版：判定总则 + 三大类共 34 个组件的双模式定义 + 三个参考任务卡                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v2   | 2026-09-20 | 项目定名 Bivane / 碧帆，文档与引用同步更名（token 前缀统一 `--bv-*`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| v3   | 2026-09-21 | 补 §3.4 P1 弹层落地记录（as-built）：模式归属确认、已定死取值表、Popup 降级语义、手势/滚动锁约定、Toast 单例语义；修正 §3.2 Dialog 卡中已作废的 vaul 方案                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v4   | 2026-09-21 | §2.1 表格新增**状态列**并重排（已实现的在前），补正 Popup 的 PC 降级语义（原写「居中或锚定」，实为**一律降级为居中**）；明确 ActionSheet / Alert / Notify / Loading 未实现，划为 P1′                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| v5   | 2026-09-21 | P2 Select 落地：§2.2 新增状态列并标记 Select 为 ✅ P2（顺带把「内置搜索框」修正为「选项 > 10 才出现」）；新增 §3.5 落地记录（模式归属硬判据、定死取值表、**纠正 PC 浮层不用 `lib/position` 而用 Radix Popover**、键盘与无障碍约定、虚拟滚动适用边界、真实浏览器实测表）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v6   | 2026-09-21 | **缺陷修正**：§3.4 补「H5 居中模态的宽度」——初版 `left-1/2 + w-auto` 让 shrink-to-fit 的可用宽度只剩半屏，面板被压到 187.5px 并折行；改为逐字对齐 Vant 的 `inset-x-0 + w-fit + mx-auto + max-w-[var(--bv-popup-center-max-width)]`，并附 Vant/ Bivane 对照表与实机实测值                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| v7   | 2026-09-21 | **§1 总则补正**：`forceMode` 取值明确为 `'mobile' \| 'desktop'`，`h5`/`pc` 仅为 `data-mode` 属性值（原文只写「`forceMode` prop」，配合架构文档的过期取值会让人写出编译不过的代码）。另：新增第 8 道质量门「消费者实测」，验证安装链路在空白项目中真的可用                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| v8   | 2026-09-21 | **缺陷修正**：§3.4 补「H5 居中模态的高度」——Vant 把 `max-height` 写在 `.van-popup` 基类上、center 靠继承吃到；本库按 `position` 分支产出类名时漏掉了 center，后果是面板高 = 内容高 → 内部滚动容器拿不到约束（**滚动彻底失效**）且上下溢出视口。补 `max-h-[var(--bv-popup-max-height)]` 并附三形态对照表与实机数值；回归用 top/bottom/center **遍历**用例锁定（防下次再漏某一方向）。配套：验证台新增「center · 长内容」入口（40 行 Cell，8 行够不到 90vh 测不出这条规则），`visual-check.mjs` 新增 2c 场景、探针新增 `maxHeight` / `overflowTop` / `overflowBottom` / `scroll` 四项症状级指标                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v9   | 2026-09-21 | P2 DropdownMenu 落地：§2.2 标记为 ✅ P2（顺带把 §3.5 开头的「其余 14 个」修正为 13 个）；新增 §3.6 落地记录 —— 模式归属的硬判据（分野在**怎么走这棵树**，不在容器）、定死取值表、**槽名三分（`menu-panel` / `menu-subpanel` / `menu-layer`）的由来**、为何浮层交给 Radix 而 Select 是自研巡航、路径状态为何留在 H5 内部、两处踩坑（Radix Trigger 走 `onPointerDown` 而非 click、且经 Slot 注入 `disabled: false` 会覆盖禁用态；**jsdom 补抛的 window blur 会把刚打开的菜单关掉**，曾误诊为「卸载后 handler 失效」）、键盘/无障碍约定与实测佐证表                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| v10  | 2026-09-21 | **缺陷修正（用户报障「DropdownMenu 选中没有层级展示」）**：触发器回填改为**整条层级路径**（嵌套项显示成「移动到 / 项目文档」），不再只回填末级 label —— 同名叶子挂在不同父级下时，裸 label 无法回答「选的是哪一层里的哪一项」。§2.2 该行同步改写；§3.6 新增「触发器回填必须带层级」一节（三态表：嵌套 / 顶层 / value 失效）。落地面：`findMenuPath()` 新增且 `findMenuOption()` 改为复用它、`menu-parts.tsx` 新增 `MenuTriggerPath`、验证台「位置」示例改为嵌套默认值、`visual-check.mjs` 新增 7a 场景与 `probeTriggerPath`（按 aria-label 取触发器，避免未展开时筛到错实例）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v11  | 2026-09-21 | **缺陷修正（用户报障「打开弹窗需要定位到对应位置」）**：展开时**自动定位到选中项所在层级**并滚入视野（H5 下钻到该层 / PC 铺开子菜单链），与 v10 的回显互为表里。定位量 `initialPath`（祖先 value 链）由分发层派生，两端各按自己的导航范式落位，且**只在 open 翻转时定位**。§2.2 该行同步改写；§3.6 新增「打开即定位」一节 + **Radix 两个时序陷阱的踩坑记录**（`FocusScope` 的延迟自动聚焦会被 `SubContent.onFocusOutside` 判成焦点外逃而收回刚铺开的链；`Presence` 状态机使面板节点晚一两次提交才挂上，依赖 `open`/`openPath` 的 effect 拿不到 ref → 滚动静默失效）。`visual-check.mjs` 的 `probeMenu` 新增 `selectedDepth` / `selectedInView` 两项症状级指标并加 7g 场景（实机：PC `selectedDepth=1`、H5 `layerDepths=["0","1"]` + 轨道 −390px，两端 `selectedInView=true`）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| v12  | 2026-09-21 | **用户需求「弹窗上面加上层级，用户可点任意层级切到对应层」**：H5 抽屉头部由「只显示当前层名字」改为铺出**「根 → 当前层」整条可点层级链**（祖先层一点跨层跳，不必逐层按返回），返回箭头保留为「逐层退」。落地面：`PanelHeader` 新增结构化 prop `breadcrumb` / `breadcrumbLabel`（给了它即替代 `title`，单层面板不传 → 根层视觉零回归），槽名 `panel-header-breadcrumb` / `-crumb` / `-crumb-current` / `-crumb-separator`；数据摊平留在 H5 实现（`panels[i].trail[i-1].label`），避免 `menu-parts` 反向引用 `--bv-panel-header-*`。三条取舍：根层退化为居中标题、当前层不可点并标 `aria-current`、横向可滚且 effect 依赖**层数**（数组每次渲染都是新身份，会反复把视野拽回末端）。§2.2 该行与 §3.6 下钻树对照表同步改写；`visual-check.mjs` 新增 7h 场景与 5 项面包屑探针（实机：H5 三级 3 项 2 分隔符、祖先层为 `button`；点根层后 `layers 1` + 轨道归零 + 面包屑收起）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| v13  | 2026-09-21 | **用户需求「只挪面包屑，新起一行，面包屑 选择1/选择2/选择3 这种格式，点到选择1就是最上层」**：H5 抽屉头部由「单行（返回 · 标题/面包屑 · 确定）」改为**两行结构** —— 工具栏行（`panel-header-bar`，44px，返回/取消 · 标题 · 确定）在上，层级行（`panel-header-breadcrumb`，32px）**独占其下一行**，面包屑不再与按钮挤同一行。层级行**左对齐**（路径要从根读起，居中会让不同长度的链左右乱跳）且**层与层之间不留横向内边距**（整条链读成「根/中/当前」一串，分隔符贴住层名）。落地面：`panel-header.tsx` 外层容器改 `flex-col`、工具栏行抽为 `panel-header-bar`（有面包屑时标题整段让位，避免同一条链说两遍）、**新增尺寸 token `--bv-panel-header-breadcrumb-height: 32px`**（非颜色 token，只写 `vant.css`）；层级行独占一行后不再需要用 `--bv-panel-header-title-inset` 给两侧按钮让位（该 token 仍归工具栏行的标题使用，未删除）。四条取舍：① 单层不铺（调用方按 `levels.length > 1` 决定，根层仍为普通居中标题）；② 当前层不可点并标 `aria-current`；③ **独占一行 + 左对齐 + 无横向内边距**（本次新增）；④ 横向可滚且 effect 依赖**层数**。§2.2 该行、§3.6 面包屑小节与架构 §6.5 规则 ⑨ 同步改写；`visual-check.mjs` 的 `probeMenu` 新增 `headerCrumbRow` 症状级指标（实机 390×780：`belowBar=true`、`barBottom=top=491`、`height=32`、`startsAtLeft=16`、`separatorGaps=[0]`，面板高 317 → 349，点最左层后 `layers 1` + 轨道归零 + 面包屑收起）；测试 227 → **228 例** |
| v14  | 2026-09-21 | **用户需求「1层选中值/2层选中值/3层选中值 这种格式，图中不要前面的，后面加上选中的」**：头部层级链的构成由「根层标题 → 当前层」改为「**链身 = 进入各层时点的那一项 + 链尾 = 当前层的选中项**」，根层标题**移出链上**（它说的是「这个面板叫什么」，与「选过的每一步」不同源），最终形如 `移动到 / 更多位置 / 共享盘`，与触发器 `MenuTriggerPath` 的回显是同一条链。落地面：`h5/menu.tsx` 的 `levels` 改两段拼（`panels.slice(1)` 取链身 + 在当前层里找选中叶子补链尾）、头部渲染门槛由「层数 > 1」改为 `trail.length > 0`；`PanelHeader` 契约不变，仍只按「有没有 `onSelect`」渲染（不判层数、不区分「层」与「取值」）。三条取舍：① 选中项**只在当前层里才补进链尾**（挂在别的分支时补进去会被读成「当前层的子项」）；② 末项不可点（末项 = 当前层，或当前层的选中项）；③ 链首可点跨层跳。**新的边界**：二级且该层已有选中值时，链身那格（位于末位之前）与链尾都不给 `onSelect` → 链上没有任何可点项，「一键回最上层」随根层标题一并消失，只能逐层按返回。§3.6 面包屑小节与架构 §6.5 规则 ⑨ / 修订记录 v18 同步改写；7h 场景改为「先到三级再点链首」（原脚本在二级点不到祖先项，会 `NOT_FOUND` 空跑），实机往返成立（点前 `layers 3` + 轨道 −780px + `["移动到","更多位置"]`，点后 `layers 2` + 轨道 −390px + `["移动到","项目文档"]`）；测试 228 → **229 例**                                                                                                               |
| v15  | 2026-09-21 | **用户需求「这三个都可以点，点到【移动到】应该是返回那一层，点到哪个就是那个层」**：链上每一项都改成可点 —— **第 i 项就是第 i 层的选中值，点它 = `path` 截到 i、落回那一层**（链首即回最上层，链尾收敛在当前层）。此前只有「祖先项」可点、末项与链身那格不可点，于是二级且该层已有选中值时链上**一个可点的都没有**，「一键回最上层」随根层标题一起消失（v14 记下的边界）—— 本次一并解掉。落地面：`h5/menu.tsx` 的 `levels` 每一项都带 `onSelect: () => setPath(path.slice(0, index))`；`PanelHeader` 加一条行为：**末项可点也仍按「当前落点」着色并标 `aria-current`**（着色与无障碍标记只看位次，不看有没有 `onSelect`），契约其余不变。测试：`dropdown-menu.test.tsx` 链上 tags 全为 `BUTTON`、原「点链首跨两层」一例拆成「点链首回最上层（`layers 1`、轨道归零、标题回来）」与「点中间项跨两层（`layers 2`、轨道 −100%）」两例，`panel-header.test.tsx` 新增「末项给了 onSelect 也是按钮但仍标 `aria-current`」；229 → **231 例**。实机：三级 `["移动到","更多位置"]` tags `["button","button"]`、颜色 `[rgb(150,151,153), rgb(50,50,51)]`（都可点，只有末项浓色）；7h 点链首后 `layers 1` + 轨道归零 + 面包屑整行收起、标题「选择位置」回来                                                                                                                                                                                                                            |
| v16  | 2026-09-21 | **用户需求「不要这个（返回箭头），还是取消，然后第一层也要有面包屑」**：① 菜单左键统一成「取消」——`h5/menu.tsx` 下钻中不再传 `onBack`、删掉只服务返回箭头的 `pop` 回调，回头交给链上点名（`PanelHeader.onBack` 保留给其它需要「逐层退」的多层面板，`panel-header-back` 槽在菜单下恒为 `null`）；② **每层都铺面包屑，根层只有一格面板名**——`levels` memo 改名 `crumbs` 并加根层分支（`trail.length === 0` 时返回 `[{ label: title }]`，`title` 未传则空数组；这一格是当前落点，不给 `onSelect`，渲染成不可点的 `panel-header-crumb-current`），头部渲染门槛改为 `crumbs.length > 0 \|\| staged`。动机是根层「居中标题」与下钻后「左对齐层级行」会在切层那一刻同时改行数与对齐（最容易被感知为「闪一下」）。属取舍：① 根层一格（不是「根层也一并把面板名进链身」）；② 左键统一取消（不再保留两种回头粒度）。落地面：`h5/menu.tsx` 文档注释与渲染分支、`panel-header.tsx` 的 `onBack`/`backcrumb` 文档、`src/App.tsx` 演示文案、`scripts/visual-check.mjs` 的 7h 判据与探针注释。测试：原「点返回箭头逐层退回」「根层退化为普通标题」「面包屑收起」等断言改写为「点链首回根层、面包屑缩成一格」，新增「根层也铺面包屑：一格面板名，是当前落点」「下钻中左键是『取消』，不再渲染返回箭头」两例；231 → **233 例**。实机（390×780）：根层 `["更多操作"]` tags `["span"]`；三级 `["移动到","更多位置"]` tags `["button","button"]`；暂存点选 / 打开即定位 `["移动到","项目文档"]` + `header{cancel:true, confirm:true, back:false}`；7h 点链首后 `layers 1` + 轨道归零 + `["选择位置"]`（`headerTitle null`）；`headerCrumbRow` 五场景一致 `{belowBar:true, barBottom:491, top:491, height:32, startsAtLeft:16}` |
| v17  | 2026-09-22 | **P2 DatePicker 落地（模式 C 第三种成因：交互范式不同）**：§2.2 该行标记 ✅ P2 并按 as-built 改写（H5 三列滚轮 5 行制 + `scroll-snap` 吸附 + 工具条 + 区间两段式；PC 6×7 月历 + 上下月 + 完整键盘巡航 + 触发器直接输入 + 区间并排双月与悬停预览；顺带**更正任务卡里并不成立的「双击选日」**——落地是单击即选）。新增 §3.7 落地记录：模式归属的**可操作判据**（「同一个 primitive 换个壳能否同时满足两端」，以及收紧版「**两端连『当前值显示在哪里』都对不上时一定是 C**」）、定死取值表（滚轮行高 44 / 可见 5 行 / 上下留白 2 行；月历面板宽 252 / 格子 32 / 双月间距 0）、状态归属表（`open`/`selected`/`draft` 在分发层；H5 `activeEnd` 与 PC `view`/`active`/`hoverText` 留实现层）、值形态选字符串的理由（避开 `Date` 的 UTC 解析差一天）、`min`/`max` 的**两套边界语义**（显式是硬边界；不传时默认范围会被外部值**向外撑开**而非夹走）、逐字段夹紧、`columnsType` 仅 H5、惯性/吸附不自研（原生 + `scroll-snap`，兜底对齐带位移守卫）、区间两段式为何属能力等价而非降级。**缺陷修正一号（真机探针发现，而单测当时在为错误行为背书）**：`resolveCursor` 无值兜底是「今年 1 月 1 日」，于是**区间模式（主路径）与列裁剪形态打开时滚轮停在 1 月**，单值形态因分发层预填今天而完全看不出来；更值钱的教训是 `tests/date-value.test.ts` 当时把实现的行为当规格抄进断言（`toEqual(D(today.year,1,1))`）—— **断言若来自「我看到什么」而不是「我期望什么」，等于给缺陷上锁**。**缺陷修正二号**：区间高亮只接「起点 + 悬停终点」，已提交区间反而没底色。**工具链两处**：① `index.css` 加 `@source not "./docs"` / `"./.workbuddy"`（Tailwind 会把架构文档里的 `leading-[var(--bv-<组件>-line-height)]` 当候选类编译成**非法 CSS**，并把一堆没人用的规则打进 dist），产物 65.59 → 65.19 kB、warning 归零；② `scripts/measure.mjs` 自带静态服务器 + 默认 PC/H5 各测一次 + **页面没加载出来就 EXIT 1**（此前页面 404 时探针照样返回空结果并 EXIT 0，第 5 门会「空跑通过」）。`scripts/visual-check.mjs` 新增 8 / 8b / 8c / 8c2 / 8d 五场景与 `probeDate`、`wheelScroll`（CDP `mouseWheel`，deltaY 按**实测行高**算）、`hitDateCell`（按序号取本月格子，不写死日期）；实机佐证：H5 滚轮每列 220px = 5×44、`snapType=y mandatory`、Δ3 行后 `scrollTop` 440→572 且 `snapRemainder=0`、区间未选满「确定」禁用；PC 月历 6×7、`dualGap=0`、←↓ 后光标 22→30、Enter 提交并回填 `input.value`、点 12 号 + 悬停 22 号得到 `in-range` **9 格**（13~21，底色 `rgb(242,243,245)`）。测试 233 → **288 例**（17 文件），registry 34 → **40 item** |
| v18  | 2026-09-23 | **架构修正：PC 月历改用 react-day-picker 引擎（用户要求「能用、好用、没有问题」）**：§3.7 新增「架构修正三号 / 缺陷修正四号」两节 —— 自研月历改为 rdp 提供日期引擎（React 版 `@radix-ui` **没有** Calendar/DatePicker 原语，`radix-vue` 属 Vue 生态不可用），本库只留渲染层 + 值语义 + 键盘（rdp 内置巡航依赖焦点落在日期格，与「触发器是可输入框、焦点须留面板」冲突，故日期格 `tabIndex={-1}` + `onMouseDown preventDefault`、方向键由面板级 `handleKeyDown` 接管）；`onDayClick` 只取「点了哪一天」，区间仍由 `displayRange` 推导（rdp 的 `addToRange` 语义与 Vant「再点即重选」不同）。真机抓到一处**四门全绿的静默失效**：rdp 的 `useSingle`/`useRange` 在**不传 `onSelect`** 时走非受控分支（`const selected = !onSelect ? internallySelected : initiallySelected`），内部 state 首帧播种后忽略一切 prop 更新 —— 症状是区间悬停预览不动、第二次点选错位；修法是传空实现把开关拨到受控侧。连带：删 `buildMonthGrid`/`CalendarCell`/`weekdayLabels`/`CalendarMonth`，单测 288 → **284 例**（17 文件，DatePicker 的 18 例外层行为断言一条未改），运行时依赖白名单 8 → **9**。实机佐证：PC 点 12 号 + 悬停 22 号 → `selectedTexts=["12","22"]`、`in-range` **9 格**、底色 `rgb(242,243,245)`、`dualGap=0`；H5 滚轮 220px = 5×44、`snapRemainder=0` 未受影响 |
