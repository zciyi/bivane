# 使用指南

> 这份文档只回答一个问题：**装完之后，你在自己的业务代码里怎么写。**
>
> 想了解内部实现与设计规范，看 `bivane-architecture.md`；想看逐组件的双端交互定义，看 `bivane-responsive-matrix.md`。
>
> 下面每一段代码都是本仓库验证台（`src/App.tsx`）里**正在跑的那一份**，不是示意。

---

## 30 秒预览

一个 `<Select>`，小屏点开是底部弹层、大屏点开是锚定下拉，而你的代码只有这一份：

```tsx
<Select
  ariaLabel="城市"
  placeholder="请选择城市"
  options={[
    { label: '北京', value: 'bj' },
    { label: '上海', value: 'sh' },
    { label: '成都', value: 'cd', disabled: true },
  ]}
  onChange={(value) => console.log(value)}
/>
```

**不需要写任何 `if (isMobile)`。** 断点、指针能力、形态降级，组件自己处理。

---

## 一、安装

三步，顺序不能换。

### 1) 先告诉 shadcn 去哪找 `@bivane`

Bivane 不是官方源。**不声明命名空间，`shadcn add @bivane/select` 会直接报 Unknown registry。** 在 `components.json` 里加一段：

```json
{
  "registries": {
    "@bivane": "https://bivane.dev/r/{name}.json"
  }
}
```

`{name}` 是占位符，原样保留；换自建镜像或本地调试时只改这一段。

### 2) 先装 token，再装组件

```bash
# token 层 —— 组件全靠它
npx shadcn@latest add @bivane/tokens

# 组件 —— 自动递归带上依赖的 hooks 与 ui 件
npx shadcn@latest add @bivane/select
```

组件之间用命名空间互相引用（`@bivane/select` → `@bivane/select-h5` → `@bivane/popup` → `@bivane/portal`…）。装一个组件会把整棵依赖树拉全：实测装 `@bivane/select` 拉 16 个 item、`@bivane/dropdown-menu` 16 个、`@bivane/date-picker` 17 个。

`@bivane/tokens` 其实也在这棵树里（`select-h5` 就依赖它），单独先装一遍只是为了顺序清楚：`theme.css` 缺了会让所有 `bg-bv-*` 工具类**静默消失**——不报错、不警告，只是样式全没，值得让它单独占一步。

> ⚠️ 不要用本地文件路径安装。`npx shadcn add ./packages/registry/r/select.json` 这种写法对本库**不成立**：select 依赖的其他 item 会被 shadcn 当成「消费者项目里的相对文件」去找，结果是 `Failed to read local registry file: use-device-mode.json`。必须走 registry URL。

### 3) 在 globals.css 顶部按序引入

```css
@import 'tailwindcss';
@import './styles/bivane/vant.css';
@import './styles/bivane/vant-dark.css';   /* 可选：深色主题 */
@import './styles/bivane/modes.css';
@import './styles/bivane/utilities.css';
@import './styles/bivane/theme.css';       /* ← 缺了它，所有 bg-bv-* 工具类都不会生成 */
```

`@import` 必须集中在文件最前面，中间插会被 CSS 规范忽略，症状同样是「token 全在、工具类全无」。

路径**相对 globals.css 所在目录**，落点跟着你的目录布局走：

| 你的项目 | token 落在 | globals.css 在 | 上面五行可直接用 |
|---|---|---|---|
| 有 `src/` 目录 | `src/styles/bivane/` | `src/index.css` | ✅ |
| 无 `src/` 目录 | `styles/bivane/` | 根目录 `index.css` | ✅ |
| 有 `src/` 但入口在别处 | `src/styles/bivane/` | 如 `src/app/globals.css` | ❌ 前缀改 `../styles/bivane/` |

（shadcn 的落盘规则是：项目存在 `src/` 目录时，所有文件目标都会加上 `src/` 前缀。）

运行时依赖只有 9 个：`react` · `react-dom` · `clsx` · `tailwind-merge` · `class-variance-authority` · `@radix-ui/react-dialog`（仅 PC 模态用） · `@radix-ui/react-popover`（仅 PC 锚定浮层用） · `@radix-ui/react-dropdown-menu`（仅 PC 菜单用） · `react-day-picker`（仅 PC 月历引擎用，装 `@bivane/date-picker` 时 shadcn 会自动带上）。手势、滚动锁、虚拟滚动、滚轮吸附是自研的（吸附走 CSS `scroll-snap`），不引第三方。

---

## 二、在应用根部挂载

命令式弹层（`showDialog` / `showToast`）需要一个宿主；声明式组件不需要。

```tsx
// main.tsx
import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { DialogHost } from '@/components/responsive/dialog';
import { ToastHost } from '@/components/responsive/toast';

createRoot(document.getElementById('root')!).render(
  <ResponsiveProvider breakpoint={768}>
    <App />
    <DialogHost />   {/* 命令式对话框的宿主 */}
    <ToastHost />    {/* Toast 的宿主 */}
  </ResponsiveProvider>,
);
```

`ResponsiveProvider` 挂在 `DialogHost` / `ToastHost` **上面**，宿主才能继承到断点配置。

| Provider prop | 说明 |
|---|---|
| `breakpoint` | 判定断点，默认 `768`（`< 768px` 视为 H5） |
| `mode` | `'auto'`（默认）自动判定；显式传 `'mobile'` / `'desktop'` 全局强制，文档站与测试用 |

---

## 三、组件用法

### Button

```tsx
<Button>默认</Button>
<Button type="primary">主要</Button>
<Button type="success">成功</Button>
<Button type="danger">危险</Button>
<Button type="warning">警告</Button>

<Button type="primary" plain>朴素</Button>
<Button type="primary" hairline>细边框</Button>
<Button type="primary" round>圆角</Button>
<Button type="primary" square>直角</Button>
<Button disabled>禁用</Button>

{/* 加载态：loading 期间不可点，文案换成 loadingText */}
<Button type="primary" loading={loading} loadingText="处理中" onClick={submit}>
  提交
</Button>

<Button size="small" type="primary">small</Button>
<Button size="mini" type="primary">mini</Button>
<Button size="large" type="primary">large（宽度 100%）</Button>
<Button block type="success" icon={<Icon name="success" />}>block + 图标</Button>
```

`size` 可选 `normal`（默认）· `small` · `mini` · `large`；`type` 可选 `default`（默认）· `primary` · `success` · `danger` · `warning`。

### Cell / CellGroup

```tsx
{/* 分组：自带白底与行间细边框 */}
<CellGroup title="带标题的分组">
  <Cell title="普通行" value="内容" />
  <Cell title="大号行" large value="18px 标题" />
  <Cell title="居中" center value="垂直居中" />
  <Cell title="无下边框" border={false} value="最后一行" />
</CellGroup>

{/* 卡片式：inset 默认带 16px 外边距，页面里通常用 className 归零 */}
<CellGroup inset className="mx-0">
  <Cell title="单元格" value="内容" />
  <Cell title="带描述" label="描述信息" value="内容" />
  <Cell title="链接项" isLink onClick={goDetail} />
  <Cell title="必填项" required value={<Tag type="primary">标签</Tag>} />
  <Cell
    title="自定义图标"
    icon={<Icon name="info" size={16} />}
    value={<Badge content={5} />}
  />
</CellGroup>
```

### Tag / Badge / Icon

```tsx
<Tag>默认</Tag>
<Tag type="primary">主要</Tag>
<Tag type="primary" plain>朴素</Tag>
<Tag type="primary" round>圆角</Tag>
<Tag type="primary" mark>标记</Tag>
<Tag size="large" type="success">大号</Tag>
<Tag type="danger" closeable onClose={handleClose}>可关闭</Tag>

<Badge content={5} />
<Badge content={100} max={999} />       {/* 超出 max 显示 999+ */}
<Badge dot />                            {/* 小红点 */}
<Badge content={12}><span>消息</span></Badge>  {/* 挂在自定义内容上 */}

<Icon name="success" size={16} />
<Icon name="info" size={16} />
```

### Popup

```tsx
const [open, setOpen] = React.useState(false);

<Button onClick={() => setOpen(true)}>打开弹层</Button>

<Popup
  open={open}
  position="bottom"
  onOpenChange={setOpen}
  closeable
  aria-label="示例弹层"
>
  <div className="p-bv-md">任意内容</div>
</Popup>
```

`position` 可选 `bottom`（默认）· `top` · `left` · `right` · `center`。

**两端差异**：H5 按 `position` 四向滑入，底部形态带圆角与安全区，可按住顶部指示条下拉关闭；**PC 一律降级为居中模态**，遮罩点击默认不关闭、ESC 关闭。原始值仍保留在 `data-position`，实际形态在 `data-position-resolved`——这是形态降级，不是功能缺失。

| prop | 默认 | 说明 |
|---|---|---|
| `round` | H5 底部形态默认开 | 圆角，PC 形态忽略（走 `--bv-popup-pc-radius`） |
| `overlay` | `true` | 是否渲染遮罩 |
| `closeOnClickOverlay` | H5 `true` / PC `false` | 点遮罩是否关闭 |
| `lockScroll` | `true` | 锁定背景滚动 |
| `closeOnPressEscape` | `true` | 两端一致：平板外接键盘、PC 无障碍都需要 |
| `safeAreaInsetBottom` | `true` | 底部安全区内边距，仅 H5 生效 |
| `scrollable` | `true` | 内容是否由 Popup 包一层滚动容器；`false` 时由内容自己决定滚动区域 |
| `duration` | 矩阵取值 | 进出场时长（ms），传 `0` 关闭动画 |

### Dialog

**声明式**——内容与开合都在你的 JSX 里：

```tsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="声明式对话框"
  message="同一份 props 与内容，H5 渲染为底部抽屉、PC 渲染为居中模态。"
  showCancelButton
  confirmText="好的"
  cancelText="取消"
  onConfirm={() => { setOpen(false); showSuccessToast('已确认'); }}
  onCancel={() => setOpen(false)}
/>

{/* 自定义正文：children 存在时 message 不渲染 */}
<Dialog open={open} onOpenChange={setOpen} title="长内容" showCancelButton confirmText="我知道了">
  <div className="max-h-[50vh] overflow-y-auto">…</div>
</Dialog>
```

**命令式**——不进 JSX，适合「点了按钮弹一个确认框」这种场景：

```tsx
import { showConfirmDialog, showDialog } from '@/components/responsive/dialog';

showConfirmDialog({
  title: '删除确认',
  message: '删除后不可恢复，确定继续吗？',
  confirmText: '删除',
  cancelText: '再想想',
  onConfirm: () => showSuccessToast('已删除'),
  onCancel: () => showToast('已取消'),
});

// 异步提交：beforeClose 返回 Promise<boolean>，期间按钮自动进入 loading
showDialog({
  title: '异步提交',
  message: '点击确认后会延迟 1.2s 才关闭。',
  confirmText: '提交',
  showCancelButton: true,
  beforeClose: (action) =>
    action === 'confirm'
      ? new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 1200))
      : true,
  onConfirm: () => showSuccessToast('提交完成'),
});
```

**两端差异**：H5 是底部抽屉（顶部拖拽指示条、按钮纵向排列且确认在上）；PC 是居中模态（宽 520px、按钮横向右对齐、焦点陷阱、单击遮罩不关）。

### Toast

```tsx
import {
  showToast, showSuccessToast, showFailToast, showLoadingToast, closeToast,
} from '@/components/responsive/toast';

showToast('这是一条纯文案');
showSuccessToast('操作成功');
showFailToast('操作失败');

// loading 返回 handle，可主动关闭或等自动关闭
const handle = showLoadingToast('加载中');
setTimeout(() => handle.close(), 1500);

closeToast();                // 清掉当前所有（H5 单例场景常用）
showToast('第一条');
showToast('第二条');
```

**两端差异（同一组调用，信息模型不同）**：H5 是顶部居中胶囊、白字深底、**单例**——连发两条只看到第二条；PC 是右上角卡片栈、白底彩色图标、**可多条并存**并带关闭按钮。

### Select

```tsx
const CITY_OPTIONS = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '成都', value: 'cd', disabled: true },
];

const GROUPED_CITY_OPTIONS = [
  { group: '华北', options: [{ label: '北京', value: 'bj' }, { label: '天津', value: 'tj' }] },
  { group: '华东', options: [{ label: '上海', value: 'sh' }, { label: '杭州', value: 'hz' }] },
];

// 单选（非受控）
<Select ariaLabel="城市" placeholder="请选择城市" options={CITY_OPTIONS} onChange={setCity} />

// 多选 + 可清除（选中项用顿号连接回显，点选后浮层保持展开）
<Select ariaLabel="多选城市" multiple clearable options={CITY_OPTIONS} />

// 可搜索
<Select ariaLabel="搜索城市" searchable clearable options={CITY_OPTIONS} />

// 禁用
<Select ariaLabel="禁用选择器" disabled options={CITY_OPTIONS} />

// 分组 + 过滤
<Select ariaLabel="分组城市" searchable options={GROUPED_CITY_OPTIONS} />

// 受控
const [value, setValue] = React.useState<string>();
<Select value={value} onChange={(v) => setValue(v as string)} options={CITY_OPTIONS} />
```

| prop | 说明 |
|---|---|
| `options` | 扁平数组或分组数组（分组形如 `{ group, options }`） |
| `value` / `defaultValue` | 受控值 / 非受控初始值；单选给单值，多选给数组 |
| `multiple` | 多选：点选翻转该项，浮层保持展开 |
| `searchable` | 允许过滤。**呈现阈值两端不同**，见下 |
| `clearable` | 显示清除按钮（仅在有选中值且未禁用时出现） |
| `emptyText` | 无匹配项文案，默认「暂无数据」 |
| `searchPlaceholder` | 内置搜索框占位，默认「搜索」 |
| `ariaLabel` | 无障碍名称，没有可见 label 时应当传 |

**两端差异**：H5 是底部弹层（项高 48px、可下拉关闭），**选项 > 10 才出现搜索框**（触屏主路径是点选）；PC 是锚定浮层（项高 36px），只要 `searchable` 就给搜索框，另支持 ↑↓ 巡航（自动跳过禁用项）、Enter 选中、Home / End 首尾、Esc 关闭。

形态不同，**值语义完全一致**：单选取代、多选翻转、多选不关闭，两端逐字相同。

### DropdownMenu

```tsx
const FILE_MENU = [
  { value: 'new', label: '新建' },
  { value: 'edit', label: '编辑', shortcut: '⌘E' },
  { divider: true },
  { value: 'rename', label: '重命名' },
  {
    value: 'move',
    label: '移动到',
    children: [
      { value: 'docs', label: '项目文档' },
      {
        value: 'more',
        label: '更多位置',
        children: [
          { value: 'share', label: '共享盘' },
          { value: 'archive', label: '归档' },
        ],
      },
    ],
  },
  { divider: true },
  { value: 'delete', label: '删除', danger: true },
];

// 纯操作菜单：点叶子就触发（父项只是下钻，不触发）
<DropdownMenu ariaLabel="操作菜单" trigger="更多操作" items={FILE_MENU} onSelect={(v) => run(v)} />

// 可选值：触发器回填「完整层级路径」，展开时自动定位到选中项所在的那一层
const [pos, setPos] = React.useState('docs');
<DropdownMenu ariaLabel="位置" trigger="位置" title="选择位置" items={FILE_MENU} value={pos} onChange={setPos} />

// H5「暂存 → 确定」（点叶子只打勾，点「确定」才提交）。PC 忽略它，恒为点选即生效
<DropdownMenu trigger="位置" title="选择位置" items={FILE_MENU} confirmable />
```

| prop | 说明 |
|---|---|
| `items` | 菜单树。`{ divider: true }` 是分隔线；`children` 非空即二级菜单 |
| `trigger` | 触发器文案。有 `value` 且匹配到时会被层级路径覆盖 |
| `onSelect` | 叶子项被激活。`value` / `onChange` 是它的「可选值」形态 |
| `value` / `defaultValue` / `onChange` | 受控值 / 非受控初始值 / 值变化 |
| `confirmable` | H5 走「暂存 → 确定」，默认 `false` |
| `title` | H5 抽屉根层标题；PC 不渲染标题栏 |
| `placement` | PC 浮层对齐方向，默认 `bottom-start` |
| `closeOnSelect` | 叶子选中后是否关闭，默认 `true`（暂存模式恒不关闭） |
| `clearable` / `disabled` / `emptyText` / `ariaLabel` | 同上 |

**两端差异**：H5 是底部抽屉，二级菜单**整层推入**（头部铺出**可点的层级链** —— 点链上任意一项直接切到那一层，不必逐层退；左键是「取消」）；PC 是锚定浮层，子菜单**向右展开**且父层留在原地，带 `⌘` 快捷键提示与键盘巡航。

形态不同，**值语义完全一致**：触发器都回填完整层级路径（`移动到/项目文档`），展开时都自动下钻 / 铺开到选中项所在层，`onChange` 拿到的都是叶子项的 `value`。

### DatePicker

```tsx
// 单值
<DatePicker ariaLabel="日期" title="选择日期" placeholder="请选择日期" onChange={setDate} />

// 受控 + 可选边界
<DatePicker ariaLabel="日期" value={date} min="2026-01-01" max="2026-12-31" onChange={setDate} />

// 区间：值是有序的两元素元组
<DatePicker ariaLabel="日期区间" type="range" clearable placeholder="请选择区间" onChange={setRange} />

// 只要年月（仅 H5 生效；PC 是月历，必须选到具体的日）
<DatePicker ariaLabel="年月" columnsType={['year', 'month']} placeholder="请选择年月" />
```

| prop | 说明 |
|---|---|
| `value` / `defaultValue` | 单值给 `'YYYY-MM-DD'`；区间给 `[start, end]` |
| `type` | `'single'`（默认）/ `'range'` |
| `min` / `max` | 可选边界（含）。**传了就是硬边界**；不传默认今天前后各 10 年 |
| `columnsType` | 参与展示与回填的列，两端均生效；PC 会切换年份、年月或日期面板，默认 `['year','month','day']` |
| `format` | 展示格式，默认由 `columnsType` 推出（`YYYY-MM` / `MM-DD` …），支持 `YYYY` `YY` `MM` `M` `DD` `D` |
| `title` | H5 工具条标题；PC 不渲染标题栏 |
| `onChange` / `onConfirm` | 值变化 / 确认，两者同值 |
| `placeholder` / `clearable` / `disabled` / `ariaLabel` | 同上 |

**两端差异**：H5 是底部弹层 + 三列滚轮（年/月/日，原生惯性 + 吸附对齐），滚完点「确定」才生效，区间用「开始 / 结束」两段式入口（两端都选上「确定」才可用）；PC 是锚定触发器下方的月历浮层，支持上下月按钮、`←→↑↓` 按天移动、`PgUp/PgDn` 翻月、`Home/End` 跳到本周首尾、`Enter` 选中、`Esc` 关闭，**触发器输入框还能直接敲 `2026-09-20`**；区间模式并排双月，第一下点起点、第二下点终点（中途悬停即预览区间带）。

形态不同，**值语义完全一致**：恒为字符串，区间恒为有序元组（先点晚的日期也不会得到倒序区间）。

---

## 四、两端差异由谁决定

优先级从高到低：

```
1. 组件 forceMode prop            ← 单组件逃生舱
2. <ResponsiveProvider mode>      ← 全局强制（文档站 / 测试）
3. 自动判定：width < breakpoint(768) 或 (pointer: coarse && hover: none)
```

第 3 条里叠加指针能力，是为了让**触屏平板**（宽 > 768px 但没鼠标）也走 H5 交互。

个别组件要固定一端时，用 `forceMode`：

```tsx
<Select forceMode="desktop" options={CITY_OPTIONS} />   {/* 手机上也要下拉面板 */}
<Dialog forceMode="mobile" open={open} onOpenChange={setOpen} />  {/* 桌面上也要底部抽屉 */}
```

**取值只能是 `'mobile'` 或 `'desktop'`**，与 `DeviceMode` 同源。

这里有个容易踩的坑：DOM 上的 `data-mode` 是 **`"h5"` / `"pc"`**，而 prop 取值是 **`mobile` / `desktop`**。两套词表并存，`forceMode="pc"` 会编译报错。记忆方式：**prop 说的是设备（手机/桌面），`data-mode` 说的是实现（H5 交互/PC 交互）。**

```tsx
<Select forceMode="mobile" />   {/* ✅ */}
<Select forceMode="h5" />       {/* ❌ TS2322，别被 data-mode 带偏 */}
```

---

## 五、常见问题

**Q：为什么我有的样式没了 / 组件是白板？**
十有八九是 `theme.css` 没引。它装的是 `@theme inline` 映射，缺了它 Tailwind 不会生成任何 `bg-bv-*` 工具类。按「一、安装」里的五行顺序补齐，且 `@import` 必须在文件最前面。

**Q：为什么 PC 上 `position="bottom"` 变成了居中弹窗？**
设计如此。底部滑入是移动端范式，宽屏下会变成「贴底一条长面板」。内容、回调、关闭方式全部保留，只是形态降级。要强制底部形态，用 `forceMode="mobile"`。

**Q：报 `Unknown registry "@bivane"` 怎么办？**
`components.json` 里少了 `registries` 声明，见「一、安装」第 1 步。这是 Bivane 与官方组件的最大差异——官方组件不需要声明任何东西，第三方源必须声明。

**Q：报 `Failed to read local registry file: xxx.json`？**
你在用本地文件路径安装（`add ./xxx.json`）。这条路对本库不成立，会连带把内部依赖也当成本地文件。改用 registry URL 形式。

**Q：`showToast` 没有反应？**
`<ToastHost />` 没挂。命令式 API 需要一个挂载在应用根部的宿主，见「二、在应用根部挂载」。

**Q：能不能覆盖组件样式？**
可以，`className` 直接透传。`cn()` 已把 `bv-*` 命名空间注册进 tailwind-merge，所以你的类能正常盖掉组件默认样式，不会出现「两个类都留在 DOM 上但优先级打架」。

**Q：深浅色怎么切？**
给任意容器加 `bv-theme-dark` 类，其子树内的 token 整体切换，不需要改组件代码。

**Q：想看每个组件在两端到底长什么样？**
`npm run dev` 起验证台，缩放窗口跨过 768px 即可；或直接打开仓库根的 `bivane-demo.html`（自包含单文件，双击即开，不用起服务）。
