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
        { label: "北京", value: "bj" },
        { label: "上海", value: "sh" },
        { label: "成都", value: "cd", disabled: true },
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

组件之间用命名空间互相引用（`@bivane/select` → `@bivane/select-h5` → `@bivane/popup` → `@bivane/portal`…）。装一个组件会把整棵依赖树拉全：实测装 `@bivane/select` 拉 16 个 item、`@bivane/dropdown-menu` 16 个、`@bivane/date-picker` 17 个、`@bivane/time-picker` 17 个。

`@bivane/tokens` 其实也在这棵树里（`select-h5` 就依赖它），单独先装一遍只是为了顺序清楚：`theme.css` 缺了会让所有 `bg-bv-*` 工具类**静默消失**——不报错、不警告，只是样式全没，值得让它单独占一步。

> ⚠️ 不要用本地文件路径安装。`npx shadcn add ./packages/registry/r/select.json` 这种写法对本库**不成立**：select 依赖的其他 item 会被 shadcn 当成「消费者项目里的相对文件」去找，结果是 `Failed to read local registry file: use-device-mode.json`。必须走 registry URL。

### 3) 在 globals.css 顶部按序引入

```css
@import "tailwindcss";
@import "./styles/bivane/vant.css";
@import "./styles/bivane/vant-dark.css"; /* 可选：深色主题 */
@import "./styles/bivane/modes.css";
@import "./styles/bivane/utilities.css";
@import "./styles/bivane/theme.css"; /* ← 缺了它，所有 bg-bv-* 工具类都不会生成 */
```

`@import` 必须集中在文件最前面，中间插会被 CSS 规范忽略，症状同样是「token 全在、工具类全无」。

路径**相对 globals.css 所在目录**，落点跟着你的目录布局走：

| 你的项目               | token 落在           | globals.css 在           | 上面五行可直接用              |
| ---------------------- | -------------------- | ------------------------ | ----------------------------- |
| 有 `src/` 目录         | `src/styles/bivane/` | `src/index.css`          | ✅                            |
| 无 `src/` 目录         | `styles/bivane/`     | 根目录 `index.css`       | ✅                            |
| 有 `src/` 但入口在别处 | `src/styles/bivane/` | 如 `src/app/globals.css` | ❌ 前缀改 `../styles/bivane/` |

（shadcn 的落盘规则是：项目存在 `src/` 目录时，所有文件目标都会加上 `src/` 前缀。）

运行时依赖只有 9 个：`react` · `react-dom` · `clsx` · `tailwind-merge` · `class-variance-authority` · `@radix-ui/react-dialog`（仅 PC 模态用） · `@radix-ui/react-popover`（仅 PC 锚定浮层用） · `@radix-ui/react-dropdown-menu`（仅 PC 菜单用） · `react-day-picker`（仅 PC 月历引擎用，装 `@bivane/date-picker` 时 shadcn 会自动带上）。手势、滚动锁、虚拟滚动、滚轮吸附是自研的（吸附走 CSS `scroll-snap`），不引第三方。

---

## 二、在应用根部挂载

命令式弹层（`showDialog` / `showToast`）需要一个宿主；声明式组件不需要。

```tsx
// main.tsx
import { ResponsiveProvider } from "@/components/providers/responsive-provider";
import { DialogHost } from "@/components/responsive/dialog";
import { ToastHost } from "@/components/responsive/toast";

createRoot(document.getElementById("root")!).render(
    <ResponsiveProvider breakpoint={768}>
        <App />
        <DialogHost /> {/* 命令式对话框的宿主 */}
        <ToastHost /> {/* Toast 的宿主 */}
    </ResponsiveProvider>,
);
```

`ResponsiveProvider` 挂在 `DialogHost` / `ToastHost` **上面**，宿主才能继承到断点配置。

| Provider prop | 说明                                                                               |
| ------------- | ---------------------------------------------------------------------------------- |
| `breakpoint`  | 判定断点，默认 `768`（`< 768px` 视为 H5）                                          |
| `mode`        | `'auto'`（默认）自动判定；显式传 `'mobile'` / `'desktop'` 全局强制，文档站与测试用 |

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
{
    /* 分组：自带白底与行间细边框 */
}
<CellGroup title="带标题的分组">
    <Cell title="普通行" value="内容" />
    <Cell title="大号行" large value="18px 标题" />
    <Cell title="居中" center value="垂直居中" />
    <Cell title="无下边框" border={false} value="最后一行" />
</CellGroup>;

{
    /* 卡片式：inset 默认带 16px 外边距，页面里通常用 className 归零 */
}
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
</CellGroup>;
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

| prop                  | 默认                   | 说明                                                              |
| --------------------- | ---------------------- | ----------------------------------------------------------------- |
| `round`               | H5 底部形态默认开      | 圆角，PC 形态忽略（走 `--bv-popup-pc-radius`）                    |
| `overlay`             | `true`                 | 是否渲染遮罩                                                      |
| `closeOnClickOverlay` | H5 `true` / PC `false` | 点遮罩是否关闭                                                    |
| `lockScroll`          | `true`                 | 锁定背景滚动                                                      |
| `closeOnPressEscape`  | `true`                 | 两端一致：平板外接键盘、PC 无障碍都需要                           |
| `safeAreaInsetBottom` | `true`                 | 底部安全区内边距，仅 H5 生效                                      |
| `scrollable`          | `true`                 | 内容是否由 Popup 包一层滚动容器；`false` 时由内容自己决定滚动区域 |
| `duration`            | 矩阵取值               | 进出场时长（ms），传 `0` 关闭动画                                 |

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
    onConfirm={() => {
        setOpen(false);
        showSuccessToast("已确认");
    }}
    onCancel={() => setOpen(false)}
/>;

{
    /* 自定义正文：children 存在时 message 不渲染 */
}
<Dialog
    open={open}
    onOpenChange={setOpen}
    title="长内容"
    showCancelButton
    confirmText="我知道了"
>
    <div className="max-h-[50vh] overflow-y-auto">…</div>
</Dialog>;
```

**命令式**——不进 JSX，适合「点了按钮弹一个确认框」这种场景：

```tsx
import { showConfirmDialog, showDialog } from "@/components/responsive/dialog";

showConfirmDialog({
    title: "删除确认",
    message: "删除后不可恢复，确定继续吗？",
    confirmText: "删除",
    cancelText: "再想想",
    onConfirm: () => showSuccessToast("已删除"),
    onCancel: () => showToast("已取消"),
});

// 异步提交：beforeClose 返回 Promise<boolean>，期间按钮自动进入 loading
showDialog({
    title: "异步提交",
    message: "点击确认后会延迟 1.2s 才关闭。",
    confirmText: "提交",
    showCancelButton: true,
    beforeClose: (action) =>
        action === "confirm"
            ? new Promise<boolean>((resolve) =>
                  setTimeout(() => resolve(true), 1200),
              )
            : true,
    onConfirm: () => showSuccessToast("提交完成"),
});
```

**Alert 语义（单按钮）**：`showAlertDialog` 与 `showConfirmDialog` 共用同一底座，唯一区别是 Alert 不渲染取消按钮，适合「我知道了」类纯提示：

```tsx
import { showAlertDialog } from "@/components/responsive/dialog";

showAlertDialog({
    title: "提示",
    message: "该操作不可撤销",
    confirmText: "我知道了",
});
```

**两端差异**：H5 是底部抽屉（顶部拖拽指示条、按钮纵向排列且确认在上）；PC 是居中模态（宽 520px、按钮横向右对齐、焦点陷阱、单击遮罩不关）。

### Toast

```tsx
import {
    showToast,
    showSuccessToast,
    showFailToast,
    showLoadingToast,
    closeToast,
} from "@/components/responsive/toast";

showToast("这是一条纯文案");
showSuccessToast("操作成功");
showFailToast("操作失败");

// loading 返回 handle，可主动关闭或等自动关闭
const handle = showLoadingToast("加载中");
setTimeout(() => handle.close(), 1500);

closeToast(); // 清掉当前所有（H5 单例场景常用）
showToast("第一条");
showToast("第二条");
```

**两端差异（同一组调用，信息模型不同）**：H5 是顶部居中胶囊、白字深底、**单例**——连发两条只看到第二条；PC 是右上角卡片栈、白底彩色图标、**可多条并存**并带关闭按钮。

### ActionSheet

动作面板——从一组动作里选一个。命令式适合「点更多按钮弹出操作列表」；也支持声明式放进 JSX 控制开合。

```tsx
import {
    showActionSheet,
    closeActionSheet,
    ActionSheet,
    type ActionSheetAction,
} from "@/components/responsive/action-sheet";

const actions: ActionSheetAction[] = [
    { name: "编辑" },
    { name: "分享", subname: "给微信好友" },
    { name: "删除", color: "var(--bv-danger)" },
    { name: "不可用项", disabled: true },
];

// 命令式
const handle = showActionSheet({
    title: "请选择操作",
    actions,
    cancelText: "取消", // 传 null 隐藏取消按钮
    onSelect: (action, index) => {
        console.log("选中", action.name, index);
    },
    onCancel: () => console.log("取消"),
});
handle.close(); // 或 closeActionSheet(handle.id)；不传 id 关闭全部

// 声明式
const [open, setOpen] = React.useState(false);
<ActionSheet
    open={open}
    onOpenChange={setOpen}
    title="请选择操作"
    actions={actions}
    closeOnClickAction // 默认 true：点动作即关；单项可用 closeOnClick:false 覆盖
/>;
```

| 字段 / prop                              | 说明                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| `actions[].name` / `subname`             | 主文案 / 副文案（副文案存在时行高自动撑开，不会裁切） |
| `actions[].color`                        | 行文字色，危险操作传 `var(--bv-danger)`               |
| `actions[].disabled` / `loading`         | 禁用（不可点）/ 加载中（转转圈且不可点）              |
| `actions[].closeOnClick`                 | 单项覆盖全局 `closeOnClickAction`                     |
| `cancelText`                             | 取消按钮文案，默认「取消」；传 `null` 隐藏            |
| `onSelect(action, index)` / `onCancel()` | 选中（关闭前触发）/ 点取消                            |
| `closeOnClickOverlay`                    | 点遮罩是否关闭；不传时 H5 默认开、PC 默认关           |

**两端差异（模式 B，同一组动作换壳）**：H5 是底部抽屉，动作行高 48px（触控热区），取消按钮与动作列表**分离**成独立一块；PC 自动降级为居中对话框纵向列表，行高 36px，取消按钮仍在列表下方。

### Notify

顶部消息通知——比 Toast 更强的视觉介入，用于成功/警告/危险等状态播报。语义色默认 `danger`（对齐 Vant）。

```tsx
import { showNotify, closeNotify } from "@/components/responsive/notify";

showNotify("网络异常，请稍后重试"); // 字符串入参，默认 danger

const handle = showNotify({
    message: "保存成功",
    type: "success", // primary | success | danger | warning
    duration: 3000, // 默认 3000ms；传 0 常驻，须手动关闭
    // color / background 可自定义配色
    onClick: () => console.log("点击通知"),
    onClose: () => console.log("已关闭"),
});
handle.close();
closeNotify(); // 不传 id 关闭全部

// 声明式
<Notify
    open={open}
    onOpenChange={setOpen}
    message="审核已通过"
    type="success"
/>;
```

**两端差异（模式 C，位置与队列模型都不同）**：H5 是**顶部通栏横幅**，自上方滑入，**单例**——新通知直接替换旧的，自动消失型不显示关闭按钮（常驻型为避免用户关不掉会显示 ✕）；PC 是**右上角圆角卡片栈**，自右侧滑入，**多条并存**，每条都带 ✕。

### Loading

全屏加载遮罩。默认**常驻**，必须显式关闭（对齐 Vant `showLoadingToast`），需要定时消失时传 `duration`。

```tsx
import {
    showLoading,
    hideLoading,
    updateLoading,
    Loading,
} from "@/components/responsive/loading";

const handle = showLoading({ text: "加载中" });
// 请求完成后
handle.close(); // 或 hideLoading(handle.id)；不传 id 关闭全部

// 动态更新文案（进度提示场景）
updateLoading(handle.id, { text: "正在保存第 2 步…" });

// 定时自动关闭
showLoading({ text: "稍候", duration: 1500 });

// 声明式
<Loading open={submitting} text="提交中…" />;
```

| 选项          | 说明                                                             |
| ------------- | ---------------------------------------------------------------- |
| `text`        | 转圈下方文案，不传则只显示转圈                                   |
| `mask`        | 是否渲染遮罩，默认 `true`；`false` 为无遮罩转圈                  |
| `forbidClick` | 默认 `false`——**不阻断**下层操作（对齐 Vant）；`true` 才吃掉点击 |
| `duration`    | 自动关闭毫秒数；不传常驻                                         |

**两端差异（模式 A/B）**：两端同为全屏遮罩 + 居中转圈，仅遮罩浓度随模式不同（H5 0.7 / PC 0.45）；点击遮罩**不会**关闭，必须显式 `hideLoading`。多条叠加时呈现层始终是单例（只显示最新一条），关掉最新一条后上一条自动顶上来。

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

| prop                     | 说明                                                |
| ------------------------ | --------------------------------------------------- |
| `options`                | 扁平数组或分组数组（分组形如 `{ group, options }`） |
| `value` / `defaultValue` | 受控值 / 非受控初始值；单选给单值，多选给数组       |
| `multiple`               | 多选：点选翻转该项，浮层保持展开                    |
| `searchable`             | 允许过滤。**呈现阈值两端不同**，见下                |
| `clearable`              | 显示清除按钮（仅在有选中值且未禁用时出现）          |
| `emptyText`              | 无匹配项文案，默认「暂无数据」                      |
| `searchPlaceholder`      | 内置搜索框占位，默认「搜索」                        |
| `ariaLabel`              | 无障碍名称，没有可见 label 时应当传                 |

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

| prop                                                 | 说明                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| `items`                                              | 菜单树。`{ divider: true }` 是分隔线；`children` 非空即二级菜单 |
| `trigger`                                            | 触发器文案。有 `value` 且匹配到时会被层级路径覆盖               |
| `onSelect`                                           | 叶子项被激活。`value` / `onChange` 是它的「可选值」形态         |
| `value` / `defaultValue` / `onChange`                | 受控值 / 非受控初始值 / 值变化                                  |
| `confirmable`                                        | H5 走「暂存 → 确定」，默认 `false`                              |
| `title`                                              | H5 抽屉根层标题；PC 不渲染标题栏                                |
| `placement`                                          | PC 浮层对齐方向，默认 `bottom-start`                            |
| `closeOnSelect`                                      | 叶子选中后是否关闭，默认 `true`（暂存模式恒不关闭）             |
| `clearable` / `disabled` / `emptyText` / `ariaLabel` | 同上                                                            |

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

| prop                                                   | 说明                                                                                             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `value` / `defaultValue`                               | 单值给 `'YYYY-MM-DD'`；区间给 `[start, end]`                                                     |
| `type`                                                 | `'single'`（默认）/ `'range'`                                                                    |
| `min` / `max`                                          | 可选边界（含）。**传了就是硬边界**；不传默认今天前后各 10 年                                     |
| `columnsType`                                          | 参与展示与回填的列，两端均生效；PC 会切换年份、年月或日期面板，默认 `['year','month','day']`     |
| `format`                                               | 展示格式，默认由 `columnsType` 推出（`YYYY-MM` / `MM-DD` …），支持 `YYYY` `YY` `MM` `M` `DD` `D` |
| `title`                                                | H5 工具条标题；PC 不渲染标题栏                                                                   |
| `onChange` / `onConfirm`                               | 值变化 / 确认，两者同值                                                                          |
| `placeholder` / `clearable` / `disabled` / `ariaLabel` | 同上                                                                                             |

**两端差异**：H5 是底部弹层 + 三列滚轮（年/月/日，原生惯性 + 吸附对齐），滚完点「确定」才生效，区间用「开始 / 结束」两段式入口（两端都选上「确定」才可用）；PC 是锚定触发器下方的月历浮层，支持上下月按钮、`←→↑↓` 按天移动、`PgUp/PgDn` 翻月、`Home/End` 跳到本周首尾、`Enter` 选中、`Esc` 关闭，**触发器输入框还能直接敲 `2026-09-20`**；区间模式并排双月，第一下点起点、第二下点终点（中途悬停即预览区间带）。

形态不同，**值语义完全一致**：恒为字符串，区间恒为有序元组（先点晚的日期也不会得到倒序区间）。

### TimePicker

```tsx
// 单值（草稿预填「现在」，确定永远可用）
<TimePicker ariaLabel="时间" title="选择时间" placeholder="请选择时间" onChange={setTime} />

// 受控 + 可选边界
<TimePicker ariaLabel="时间" value={time} min="08:00:00" max="20:00:00" onChange={setTime} />

// 区间：值是有序的两元素元组
<TimePicker ariaLabel="时间区间" type="range" clearable placeholder="请选择区间" onChange={setRange} />

// 只要时分（列裁剪，回填 HH:mm）
<TimePicker ariaLabel="时分" columnsType={['hour', 'minute']} placeholder="请选择时分" />
```

| prop                                                   | 说明                                                                                                                                         |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` / `defaultValue`                               | 单值给 `'HH:mm:ss'`；区间给 `[start, end]`                                                                                                   |
| `type`                                                 | `'single'`（默认）/ `'range'`                                                                                                                |
| `min` / `max`                                          | 可选边界（含），`'HH:mm:ss'`（或按列裁剪的 `'HH:mm'` 等）。**传了就是硬边界**；不传默认 00:00:00–23:59:59（无秒列时末位归零）                |
| `columnsType`                                          | 参与展示与回填的列，顺序固定「时→分→秒」，默认 `['hour','minute','second']`；裁剪到 `['hour','minute']` 即「时分」、到 `['hour']` 即「小时」 |
| `format`                                               | 展示格式，默认由 `columnsType` 推出（`HH:mm:ss` / `HH:mm` / `HH`），支持 `HH` `H` `mm` `m` `ss` `s`                                          |
| `title`                                                | H5 工具条标题；PC 不渲染标题栏                                                                                                               |
| `onChange` / `onConfirm`                               | 值变化 / 确认，两者同值                                                                                                                      |
| `placeholder` / `clearable` / `disabled` / `ariaLabel` | 同上                                                                                                                                         |

**两端同一套交互，只换外壳**：两端都是 N 列拖拽滚轮（时/分/秒，原生惯性 + 吸附对齐 + 中央高亮带），**滚完点「确定」才生效**（滚轮要三列都调好才算选完）；区间都用「开始时间 / 结束时间」两段式入口。差别只在壳：H5 是**底部弹层** + 顶部工具条（取消 · 标题 · 确定）；PC 是**锚定触发器下方的浮层** + 底部「取消 / 确定」条，另支持键盘 —— `←→` 切换方向键驾驶的列（该列高亮带会点亮）、`↑↓` 改当前列的值、`Home/End` 跳列首尾、`PgUp/PgDn` 步进 10、`Enter` 确定、`Esc` 取消。

**区间**还会挡一次非法组合：两端都选**且开始时间 < 结束时间**时「确定」才可点；若结束 ≤ 开始，「确定」禁用并提示「开始时间须小于结束时间」（H5 提示在滚轮下方、PC 在底部条左侧，同一判据）。

外壳不同，**值语义与交互范式完全一致**：恒为 `'HH:mm:ss'` 字符串（区是裁剪后的对应形态），区间恒为有序元组。与 `DatePicker` 同族 —— 两端共享 `use-time-value` 的解析 / 格式化 / 夹紧 / 排序，也共享 `time-parts` 的滚轮行（`TimeWheelRow`），各自只负责外壳。

---

### DateTimePicker

日期时间一体选择（对齐 Vant DatetimePicker）：年/月/日 + 时/分/秒在同一条滚轮列序上，**单值**，三档精度。

```tsx
// 年月日时（4 列，回填 YYYY-MM-DD HH）
<DateTimePicker ariaLabel="年月日时" columnsType={['year', 'month', 'day', 'hour']} />

// 年月日时分（5 列，回填 YYYY-MM-DD HH:mm）
<DateTimePicker ariaLabel="年月日时分" columnsType={['year', 'month', 'day', 'hour', 'minute']} clearable />

// 年月日时分秒（默认 6 列，回填 YYYY-MM-DD HH:mm:ss）
<DateTimePicker ariaLabel="年月日时分秒" value={dt} min="2026-01-01 00:00:00" onChange={setDt} />
```

| prop                                                   | 说明                                                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `value` / `defaultValue`                               | `'YYYY-MM-DD HH:mm:ss'` 字符串（或按精度的 `'YYYY-MM-DD HH:mm'` / `'YYYY-MM-DD HH'`）                                                                            |
| `columnsType`                                          | 三档之一：`['year','month','day','hour']` / `+ 'minute'` / 再 `+ 'second'`（默认全 6 列）。日期三列必在、时间列必须从「时」连续；拼错一律回落全 6 列             |
| `min` / `max`                                          | 完整时刻边界（含），`'YYYY-MM-DD HH:mm:ss'`；只给日期时 min 补 `00:00:00`、max 补 `23:59:59`。边界**当天**的时/分/秒列会从边界时刻起算（硬边界，不被已选值撑开） |
| `format`                                               | 默认随精度推出，支持日期 6 token（`YYYY YY MM M DD D`）+ 时间 6 token（`HH H mm m ss s`）                                                                        |
| `title`                                                | H5 工具条标题；PC 不渲染标题栏                                                                                                                                   |
| `onChange` / `onConfirm`                               | 点「确定」那一瞬回调，两者同值                                                                                                                                   |
| `placeholder` / `clearable` / `disabled` / `ariaLabel` | 同上                                                                                                                                                             |

**两端日期段范式不同、时间段共用滚轮**（模式 C，与 DatePicker 同族）：

- **H5** 是**底部弹层**：年/月/日 + 时/分/秒整条 N 列滚轮（4/5/6 列）+ 顶部「取消 · 标题 · 确定」工具条；
- **PC** 是**锚定浮层**：左侧**月历网格**（`« < 年月 > »` 翻年翻月、星期头、6×7 定高网格，今天描边、越界日禁用）选日期，右侧**时/分/秒 1~3 条居中滚轮列**（与 H5 同样的 5 行制滚轮：选中行在正中、上下发丝线、文本加粗，列数随精度；列顶/列尾 ▲▼ 点一下 ±1、按住连发），顶部回显草稿时间，底部「此刻 / 确定」。

交互都**恒走「暂存 → 确定」**，无值时草稿播种「此刻」而不是元旦午夜；边界是**逐字段级联夹紧**（min 当天把时间改到边界之前只会抬到边界时刻，日期不跳整天）。PC 键盘分区驾驶：焦点在月历时 `←→` 走天、`↑↓` 走周、`PgUp/PgDn` 走月；点过时间列后 `↑↓` 改值、`←→` 在时/分/秒列间切换、`Home/End` 列首尾、`PgUp/PgDn` 步进 10；`Enter` 确定、`Esc` 取消。「此刻」把草稿置为当前时刻并跳回当前月，仍需点确定生效。

> 值恒为字符串而非 `Date`（避开 UTC 差一天）；没有区间形态，需要区间请分别约束两个 DateTimePicker 或用 DatePicker/TimePicker 的区间版。

### Tooltip

一段纯展示的补充说明。**同一份 content，两端容器密度不同**（模式 B）：

- **H5**：触屏没有 hover，说明**直接常驻**——被说明的主体在上，下方铺一条行首带 ⓘ 的浅底信息提示条，全文展示、不响应任何手势。文案太长时把 `content` 交给 [Ellipsis](#ellipsis) 折叠。
- **PC**：鼠标 **hover 200ms** 后深色气泡弹出并跟随鼠标，移出即关；键盘 **focus 立即**弹出（气泡锚定元素上方/下方），`Esc` 关闭；hover 与 focus 任一仍在都不会误关。

```tsx
import { Tooltip } from "@/components/responsive/tooltip";
import { Ellipsis } from "@/components/ui/ellipsis";

{
    /* 短说明：H5 常驻一条 / PC hover 出气泡 */
}
<Tooltip content="删除后不可恢复">
    <button type="button" aria-label="删除">
        <TrashIcon />
    </button>
</Tooltip>;

{
    /* 长说明：H5 常驻且默认截 2 行，可展开看全文；PC 气泡内同样折叠 */
}
<Tooltip
    content={
        <Ellipsis rows={2}>
            开启后修改会实时同步给团队所有成员，新成员加入时也能看到全部历史记录。
        </Ellipsis>
    }
>
    <button type="button">团队同步</button>
</Tooltip>;

{
    /* 受控开合只在 PC 浮层有意义；H5 说明恒常驻 */
}
<Tooltip content="已复制" open={copied} onOpenChange={setCopied}>
    <button type="button" onClick={copy}>
        复制链接
    </button>
</Tooltip>;
```

| prop                                    | 说明                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `content`                               | 说明内容（必填）。PC 气泡 `pointer-events:none`、`role=tooltip`，**不能放可交互元素**（要用按钮请选 Popover） |
| `open` / `defaultOpen` / `onOpenChange` | PC 浮层受控/非受控开合；**H5 无浮层，这三个 prop 在 H5 不生效**                                               |
| `disabled`                              | PC 下禁用 hover/focus 触发（不影响 children 自身禁用态）；H5 说明条恒展示                                     |
| `className`                             | 透传给 PC 气泡 / H5 信息提示条                                                                                |
| `forceMode`                             | 逃生舱：强制 `'mobile'` / `'desktop'`                                                                         |

说明体 id 由分发层 `useId` 生成并与主体的 `aria-describedby` 自动配对；children 必须是**单个**会把 props/ref 落到真实 DOM 的元素。H5 下它与常驻说明条纵向排列（主体在上）。

### Ellipsis

多行文本截断 + 「展开/收起」开关，**两端完全同形**（模式 A），字号/行高继承父级，是一个通用文本容器，不依赖 Tooltip。

只有当内容**实测真的超过** `rows` 行时才显示开关（按 `scrollHeight` 与行高测量，窗口宽度变化会自动重测），短文本不会多出一个没用的按钮。

```tsx
import { Ellipsis } from '@/components/ui/ellipsis';

// 默认截 2 行
<Ellipsis>
  一段可能很长的描述文字……
</Ellipsis>

// 截 3 行 + 自定义开关文案
<Ellipsis rows={3} expandText="查看全部" collapseText="收起">
  一段可能很长的描述文字……
</Ellipsis>

// 受控
<Ellipsis expanded={open} onExpandedChange={setOpen}>{text}</Ellipsis>
```

| prop                                                | 说明                                            |
| --------------------------------------------------- | ----------------------------------------------- |
| `rows`                                              | 收起态最多显示行数，默认 `2`，小于 1 的值回落 1 |
| `expandText` / `collapseText`                       | 开关文案，默认「展开」/「收起」                 |
| `expanded` / `defaultExpanded` / `onExpandedChange` | 受控/非受控展开态                               |
| `className`                                         | 透传给外层容器                                  |

截断用的是 `-webkit-line-clamp`（iOS/Android/Chrome/Edge/Safari 全系支持，Firefox 68+ 亦已支持）；开关是一个真实 `<button>` 并带 `aria-expanded`，键盘与读屏均可操作。

### Popover

带动作列表 / 任意内容的气泡菜单。**容器范式两端不同，内容模型同源**（`content` + `actions`，模式 C）：

- **H5**：点击触发，内容行数 **≤ 阈值**是锚定触发器的轻量气泡（自动翻转防溢出，点外部关）；**超出阈值自动降级为底部抽屉**（带遮罩 / 安全区 / 滚动锁）。阈值取 token `--bv-popover-h5-bubble-max-rows`（默认 3），`maxRows` prop 可单实例覆盖；形态在打开那一刻按实测高度决定。
- **PC**：Radix 锚定浮层（翻转 / 防溢出），打开后焦点落入面板，`Tab` 在动作行间循环，`Esc` 关闭并把焦点还给触发器。

```tsx
import { Popover } from '@/components/responsive/popover';

const actions = [
  { key: 'share', text: '分享', icon: <ShareIcon />, onClick: () => share() },
  { key: 'rename', text: '重命名', onClick: () => rename() },
  { key: 'delete', text: '删除', danger: true, onClick: () => remove() },
];

// 只有动作行（H5 行数 ≤ maxRows 气泡、超出抽屉；PC 恒浮层）
<Popover actions={actions} ariaLabel="更多操作">
  <button type="button">更多</button>
</Popover>

// H5 强制抽屉形态（不管几行）；阈值 / 形态只在 H5 生效，PC 恒为锚定浮层
<Popover actions={actions} h5Form="drawer">
  <button type="button">更多</button>
</Popover>

// 自定义内容 + 动作；点动作后保持打开
<Popover
  content="此操作会同步给所有团队成员"
  actions={actions}
  closeOnClickAction={false}
  placement="bottom"
>
  <button type="button">更多</button>
</Popover>
```

| prop                                    | 说明                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `actions`                               | `{ key?, text, icon?, disabled?, danger?, onClick?(action) }[]`；danger 行复用危险色，行高 H5 48px / PC 36px |
| `content`                               | 自定义节点，渲染在动作列表上方；两者可只给其一                                                               |
| `placement`                             | 优先方向 `'top' \| 'bottom' \| 'left' \| 'right'`（默认 bottom，碰撞自动翻转；H5 抽屉形态忽略）              |
| `closeOnClickAction`                    | 点动作行后是否关闭，默认 `true`                                                                              |
| `open` / `defaultOpen` / `onOpenChange` | 受控 / 非受控开合                                                                                            |
| `disabled`                              | 触发器不响应开合                                                                                             |
| `ariaLabel`                             | 面板无障碍名称，内容没有可见标题时建议传                                                                     |
| `h5Form`                                | 仅 H5：`'auto'`（默认）按行数自动分界，`'bubble'` / `'drawer'` 强制形态（跳过测量）                          |
| `maxRows`                               | 仅 H5 且 `h5Form='auto'`：气泡形态允许的最大行数，缺省读 `--bv-popover-h5-bubble-max-rows`（默认 3）         |
| `forceMode`                             | 逃生舱：强制 `'mobile'` / `'desktop'`                                                                        |

> 行内 ↑↓ 巡航、快捷键提示、多级子菜单是 DropdownMenu 的语义；Popover 的内容可以是任意节点，面板内导航走 `Tab`。动作行的 `onClick` 第一个参数是 action 本身；H5 气泡形态触屏不抢焦点，避免点击后页面滚动。

### Picker

多列**独立**选择（对齐 Vant Picker 的多列形态）：每一列是一个互不影响的维度，一次在 N 列上各选一个值。有「省 → 市 → 区」父子联动需求请用 [Cascader](#cascader)。

```tsx
// 每列是 {label, value, disabled?}[]；也允许直接给字符串/数字数组（value 即文案）
<Picker
    ariaLabel="品牌年款"
    title="选择品牌年款"
    columns={[
        [
            { label: "奔驰", value: "benz" },
            { label: "宝马", value: "bmw" },
            { label: "奥迪（暂无车源）", value: "audi", disabled: true },
        ],
        ["2024 款", "2025 款", "2026 款"],
    ]}
    defaultValue={["bmw", "2025 款"]}
    clearable
    onChange={(values, options) => console.log(values, options)}
/>
```

| prop                                                   | 说明                                                                                          |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `columns`                                              | 各列选项数组。元素支持 `{label,value,disabled?}` 或直接 `string`/`number`（value 与文案相同） |
| `value` / `defaultValue`                               | 每列一个值的数组：`Array<string \| number>`                                                   |
| `onChange(values, options)`                            | 点「确定」时回调；`options` 与各列对齐，值失效位为 `undefined`                                |
| `title`                                                | H5 工具条标题；PC 不渲染标题栏                                                                |
| `placeholder` / `clearable` / `disabled` / `ariaLabel` | 同其它选择类                                                                                  |
| `forceMode`                                            | 逃生舱：强制 `'mobile'` / `'desktop'`                                                         |

两端都**恒走「暂存 → 确定」**（多列要全部调好才算选完）：

- **H5**：底部弹层 + N 列吸附滚轮（5 行制 44px）+ 顶部「取消 · 标题 · 确定」；
- **PC**：锚定浮层 + N 列纵向面板（各列定宽、独立滚动、36px 行高）+ 底部「取消 / 确定」条。键盘 `←→` 换列、`↑↓` 列内巡航（跳过禁用、到边界不回绕）、`Home/End` 列首尾、`Enter` 先写草稿（激活项已是草稿值时再按一次提交）、`Esc` 取消。

### Cascader

树形级联选择（省 / 市 / 区，即 Vant Area 的交互）。**只有叶子可选**，值恒为根 → 叶子的完整路径值数组。

```tsx
const area = [
  {
    label: '浙江', value: 'zj',
    children: [
      {
        label: '杭州', value: 'hz',
        children: [
          { label: '西湖区', value: 'xh' },
          { label: '拱墅区', value: 'gs' },
        ],
      },
      { label: '宁波', value: 'nb', children: [{ label: '海曙区', value: 'hs' }] },
    ],
  },
];

<Cascader
  ariaLabel="省市区"
  title="选择地区"
  options={area}
  defaultValue={['zj', 'hz', 'xh']}
  searchable
  clearable
  onChange={(values, options) => console.log(values, options)}
/>

// 数据是 Vant 风格 {text, value, children}？用 fieldNames 改映射，无需手动转
<Cascader options={vantAreaData} fieldNames={{ label: 'text' }} />
```

| prop                                               | 说明                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `options`                                          | 树形数组，默认字段 `label/value/children`；叶子没有 `children`                                                                        |
| `fieldNames`                                       | `{label?, value?, children?}` 字段名映射，可直接喂 Vant 风格数据；不内置 `@vant/area-data`，避免整包体积                              |
| `value` / `defaultValue`                           | 根 → 叶子的完整路径值数组。半截/失效路径不回显（触发器退回 placeholder）                                                              |
| `onChange(values, options)`                        | 叶子选定后回调，`options` 为完整选项链                                                                                                |
| `searchable`                                       | **仅 PC 呈现**：顶部搜索框按路径全文过滤叶子（「杭州」能命中其下所有区），结果展示完整路径；H5 滚轮没有搜索落点，此 prop 在 H5 被忽略 |
| `searchPlaceholder` / `emptyText`                  | 搜索占位文案（默认「搜索」）/ 无结果文案（默认「暂无数据」）                                                                          |
| `title` / `placeholder` / `clearable` / `disabled` | 同其它选择类                                                                                                                          |
| `forceMode`                                        | 逃生舱：强制 `'mobile'` / `'desktop'`                                                                                                 |

两端走树的方式不同（模式 C）：

- **H5**：底部弹层 + **联动滚轮**（省 / 市 / 区三列）——滚动某一列，其右侧各列整体重算并回到第一个可选项；顶部工具条，暂存 → 确定。
- **PC**：锚定浮层，顶部**面包屑**（请选择 / 省 / 市，可点回退），下方逐级向右展开的多列面板；点父级展开下一列，**点叶子立即生效并关闭**，打开时自动定位到已选路径。`searchable` 时可按「浙江 杭州 西湖」这样的完整路径搜索，点结果直接选中整条路径。键盘 `↑↓` 巡航、`→/Enter` 展开或选中、`←` 回上级、`Esc` 关闭。

---

### Calendar

日历选择（对齐 Vant Calendar 的能力面）。支持单选 / 区间 / 多选，值恒为 `'YYYY-MM-DD'` 字符串：single 是字符串，range 是有序二元组，multiple 是升序数组。

```tsx
// 单选：H5 点一天即关；PC 点选即生效
<Calendar ariaLabel="日期" onChange={(v) => console.log(v)} />
// '2026-10-12'

// 区间（最多 7 天，含首尾）
<Calendar type="range" maxRange={7} onOverRange={({ maxRange }) => toast(`最多选 ${maxRange} 天`)} />
// ['2026-10-12', '2026-10-18']

// 多选
<Calendar type="multiple" defaultValue={['2026-10-01', '2026-10-03']} />
// ['2026-10-01', '2026-10-03']

// formatter：给日期加标注或禁用（两端表现一致）；今天默认标「今天」，可覆盖
const disableWeekend: CalendarFormatter = ({ parts }) => {
  const day = new Date(parts.year, parts.month - 1, parts.day).getDay();
  return day === 0 || day === 6 ? { disabled: true } : { topInfo: '周末' };
};
<Calendar type="range" formatter={disableWeekend} />
```

H5 形态下组件**不带触发器**（全屏日历通常由业务自定义入口唤起），自己控开合即可；不需要弹层时传 `poppable={false}` 可内嵌常驻。

```tsx
const [open, setOpen] = useState(false);
<Cell title="选择日期" isLink onClick={() => setOpen(true)} />
<Calendar open={open} onOpenChange={setOpen} />
```

| prop                                                                     | 说明                                                                               |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `type`                                                                   | `'single'`（默认）/ `'range'` / `'multiple'`                                       |
| `value` / `defaultValue` / `onChange`                                    | 受控值；single 为字符串，range 为 `[start, end]`，multiple 为升序字符串数组        |
| `onConfirm(value)`                                                       | 与 `onChange` 同值，最终选定额外触发一次，便于统一接埋点                           |
| `min` / `max`                                                            | 可选下界 / 上界（含），默认**今天 ~ 6 个月后月末**；传入的值超出边界会被夹紧       |
| `firstDayOfWeek`                                                         | 星期表头起始，`0`=周日 … `6`=周六，默认 `0`                                        |
| `maxRange`                                                               | 区间最多跨多少天（含端点）；拖选超限时窗口向前滑动，轻点超限触发 `onOverRange`     |
| `allowSameDay`                                                           | 区间是否允许起止同日，默认 `false`                                                 |
| `formatter({parts, isStart, isEnd, selected, inRange})`                  | 返回 `{text?, topInfo?, bottomInfo?, disabled?, className?}`，用于节日/价格/禁选等 |
| `showMark`                                                               | 今天是否标「今天」，默认 `true`（formatter 可覆盖该标注）                          |
| `poppable`                                                               | **仅 H5**：是否以全屏弹层呈现，默认 `true`；`false` 时内嵌常驻。PC 恒内嵌          |
| `open` / `defaultOpen` / `onOpenChange`                                  | 弹层开合（受控/非受控，仅 H5 poppable 形态消费）                                   |
| `title` / `showTitle` / `confirmText` / `confirmDisabledText` / `footer` | H5 弹层文案与自定义底部区                                                          |
| `readonly`                                                               | 只读：不可选、H5 不显示确定条                                                      |
| `onOverRange({date, maxRange})`                                          | 轻点（非拖选）超出区间上限时触发                                                   |
| `forceMode`                                                              | 逃生舱：强制 `'mobile'` / `'desktop'`                                              |

两端是两套交互范式（模式 C）：

- **H5**：**全屏弹层**，min→max 的所有月份纵向连续排列，月份网格进入视口附近才挂载（IntersectionObserver，环境不支持时降级全量渲染）；区间可**按住跨日拖动**（触摸拖动不劫持页面滚动），也支持两次点选；range / multiple 在底部确定条暂存，取消整体丢弃，确定才提交，single 点一天即完成。
- **PC**：**内嵌常驻月历**（range 并排双月），鼠标按住拖选或两次点选即生效，悬停有区间预览；完整键盘支持——`←→` 换日、`↑↓` 换周、`PgUp/PgDn` 换月、`Home/End` 到周首尾、`Enter` 选定，巡航自动跳过禁用日。

### Field / Input / Textarea

表单输入行，三件分层：`Field` 是 Cell 行外壳（label、必填星、错误文案、字数、清除、箭头都在它身上），`Input` / `Textarea` 是无壳基础控件。API 对齐 Vant `<van-field>`。装 `field` 会自动带上 `input` 与 `use-field-state`：

```bash
npx shadcn@latest add @bivane/field
```

绝大多数场景只用 `Field`；需要不带行壳的裸输入框（搜索框、InputNumber 内嵌）时再直接用 `Input`。

受控 / 非受控与普通输入框一致，`onChange` 给的始终是字符串（传入数字 `value` 会归一化展示）：

```tsx
<Field label="昵称" placeholder="请输入昵称" value={name} onChange={setName} />
<Field label="签名" defaultValue="初始签名" />
```

`type` 支持 `text`（默认）· `digit`（纯数字，唤起数字键盘）· `number`（允许小数/负号）· `password` · `tel` · `email` · `url` · `search`，另有 `'textarea'` 渲染多行框。`digit` 的非法按键不会产生变更；`number` / `digit` 传 `min` / `max` 后**失焦自动夹紧**：

```tsx
<Field label="短信验证码" type="digit" maxlength={6} clearable />
<Field label="数量" type="number" min={0} max={99} inputAlign="right" />

{/* 多行：autosize 自适应高度，可给 minHeight/maxHeight 封顶，配合字数统计 */}
<Field label="备注" type="textarea" autosize={{ maxHeight: 120 }} maxlength={50} showWordLimit rows={2} />
```

常用行配置：`required` 只画红星（是否真必填交给 rules）、`colon` 冒号、`labelWidth` / `labelAlign`（含 `'top'` 标题独占一行）、`leftIcon` / `rightIcon`、`clearable`（`clearTrigger="always"` 常显）、`isLink` + `readOnly` 做选择器入口、`action` 是右侧动作区（对应 Vant `#button` 插槽，如发送验证码）：

```tsx
{
    /* action 区：发送验证码 + 倒计时 */
}
<Field
    label="手机号"
    type="digit"
    maxlength={11}
    clearable
    action={
        <Button
            size="small"
            type={counting ? "default" : "primary"}
            disabled={counting > 0}
            onClick={sendSms}
        >
            {counting > 0 ? `${counting}s 后重发` : "发送验证码"}
        </Button>
    }
/>;

{
    /* 只读 + 箭头：整行当选择器触发器，点击由 onClickInput 接管 */
}
<Field
    label="所在地区"
    readOnly
    isLink
    value={region}
    placeholder="请选择"
    onClickInput={() => setOpen(true)}
/>;
```

需要完全自定义控件体时传 `children`，此时 Field 不再渲染原生输入框（Vant `#input` 插槽语义），`rules` 仍按 `value` 字符串校验：

```tsx
<Field
    label="规格"
    value={spec}
    rules={[{ required: true, message: "请选择规格" }]}
>
    <button type="button" onClick={openSpecPicker}>
        {spec || "请选择"}
    </button>
</Field>
```

内置轻量校验，不必引表单库：`required` / `pattern` / `validator`（可异步，返回字符串即错误文案）+ `message`，默认失焦触发，`validateTrigger="onChange"` 改为变更即校验。受控的 `error` / `errorMessage` 优先级高于规则结果，便于外部表单统一控错。ref 暴露 Vant 同款实例方法：

```tsx
const fieldRef = useRef<FieldInstance>(null);

<Field
    ref={fieldRef}
    label="邮箱"
    rules={[
        { required: true, message: "请填写邮箱" },
        { pattern: /^.+@.+$/, message: "邮箱格式不正确" },
    ]}
/>;

// 提交前手动校验，再聚到第一个不合法字段
const valid = await fieldRef.current?.validate();
fieldRef.current?.resetValidation();
fieldRef.current?.focus();
```

| prop                                                                            | 说明                                                                                                 |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `value` / `defaultValue` / `onChange`                                           | 受控 / 非受控；`onChange(value: string)`，数字 value 归一化展示                                      |
| `type`                                                                          | `text`（默认）/ `digit` / `number` / `password` / `tel` / `email` / `url` / `search` / `textarea`    |
| `label` / `labelWidth` / `labelAlign` / `colon` / `required` / `labelClassName` | 左侧标题；`labelAlign="top"` 时标题独占一行                                                          |
| `inputAlign`                                                                    | 内容对齐 `left`（默认）/ `center` / `right`                                                          |
| `min` / `max`                                                                   | `number` / `digit` 失焦夹紧边界（含端点）                                                            |
| `rows` / `autosize`                                                             | textarea 行数；`autosize` 传 `{minHeight, maxHeight}` 限定高度区间                                   |
| `maxlength` / `showWordLimit`                                                   | 原生字数上限 + 「当前/上限」统计                                                                     |
| `clearable` / `clearTrigger`                                                    | 清除按钮；`'focus'`（默认，聚焦且有值才出现）/ `'always'`                                            |
| `leftIcon` / `rightIcon` / `isLink` / `arrowDirection`                          | 左右图标与方向箭头（`left` / `up` / `down` / `right`）                                               |
| `formatter` / `formatTrigger`                                                   | 值格式化器；触发时机 `onChange`（默认）/ `onBlur`，均在失焦夹紧之后                                  |
| `error` / `errorMessage` / `errorMessageAlign`                                  | 受控错误态，优先级高于 rules 结果                                                                    |
| `rules` / `validateTrigger`                                                     | `{required?, pattern?, validator?, message?, trigger?}`；时机 `onBlur`（默认）/ `onChange`           |
| `action`                                                                        | 右侧动作区（Vant `#button` 插槽）                                                                    |
| `children`                                                                      | 自定义控件体（Vant `#input` 插槽），传入后不渲染原生框                                               |
| `disabled` / `readOnly` / `center` / `border` / `size`                          | 禁用 / 只读 / 垂直居中（默认开）/ 下边框（默认开；PC 自动隐藏让位边框盒）/ `normal`（默认）· `large` |
| ref：`focus()` / `blur()` / `validate()` / `resetValidation()`                  | 实例方法，对齐 Vant Field                                                                            |

模式 A：两端同一套 DOM、同一种交互，没有 h5/pc 分叉，双端差异全部由 `@media (pointer: fine)` 按指针能力自动给出（与断点无关）：

- **触屏**：Vant 原样——无框 Cell 行，底部 hairline 分隔，聚焦仅靠 label / 左图标变主色提示。
- **鼠标 / 键盘设备**：控件默认带**边框盒**（1px gray-4 描边、4px 圆角、32px 高，与 Select 等桌面触发器同款），hover / 聚焦描边转 primary、聚焦另有 1px 主色光环，错误态整体转 danger，禁用灰底；Field 的行底线在 PC 下隐藏，由边框盒承担分隔，`action`（如发送验证码按钮）始终在边框盒外侧。裸用 `Input` / `Textarea` 时边框画在控件自身。
- 此外精确指针设备聚焦时还有 2px 主色**键盘焦点环**，触屏永不出现。

### Switch

开关，对齐 Vant `<van-switch>`。模式 A，两端同一视觉（30px 轨道），触屏把热区外扩到 44px，PC 键盘聚焦有焦点环：

```bash
npx shadcn@latest add @bivane/switch
```

布尔场景用 `checked` 快捷受控即可；需要绑定字符串/数字枚举时用 `value` + `activeValue` / `inactiveValue`，`onChange` 回传切换后的值：

```tsx
<Switch checked={notice} onChange={(v) => setNotice(v === true)} />
<Switch defaultValue={true} disabled />
<Switch loading />
<Switch size={24} activeColor="#07c160" inactiveColor="#ebedf0" />

{/* 枚举值：value === activeValue 即为开 */}
<Switch value={enumVal} activeValue="yes" inactiveValue="no" onChange={setEnumVal} />
```

`beforeChange` 用于切换前确认（危险操作、异步校验）：返回 `false` / `Promise<false>` / 抛异常都会放弃切换；Promise 等待期间开关自动进入 loading 并锁定，防止重复点击：

```tsx
<Switch
    checked={enabled}
    onChange={(v) => setEnabled(v === true)}
    beforeChange={() =>
        new Promise<boolean>((resolve) => {
            showConfirmDialog({
                title: "确认开启？",
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
            });
        })
    }
/>
```

| Prop                                              | 说明                                                            |
| ------------------------------------------------- | --------------------------------------------------------------- |
| `checked` / `value`·`defaultValue` / `onChange`   | 布尔受控快捷方式；或自定义值模式（与 `activeValue` 全等即为开） |
| `activeValue` / `inactiveValue`                   | 开 / 关对应的值，默认 `true` / `false`                          |
| `disabled` / `loading`                            | 禁用；加载态（节点内转菊且拒绝切换）                            |
| `size`                                            | 节点基准尺寸（px 数字或 CSS 长度），默认 30px，轨道按 2:1 等比  |
| `activeColor` / `inactiveColor`                   | 轨道颜色，默认 primary / 白底轻黑边                             |
| `beforeChange`                                    | `() => boolean \| Promise<boolean>`，切换前钩子                 |
| `onClick` 及其余 `button` 属性（`aria-label` 等） | 透传根按钮（`role="switch"`）                                   |

嵌在 `Cell` 行尾时放 `rightIcon` 槽（不是 `value`），开关才会贴齐 Cell 右边缘并垂直居中：

```tsx
<Cell center title="消息推送" rightIcon={<Switch aria-label="消息推送" />} />
```

### Checkbox / CheckboxGroup

复选框，对齐 Vant `<van-checkbox>`。模式 A：触屏图标热区外扩到 44px、竖排组整行 ≥44px，PC 空格切换、键盘聚焦在图标盒上画焦点环。

```bash
npx shadcn@latest add @bivane/checkbox
```

单个是布尔受控；放进 `CheckboxGroup` 后值模型变成「已选 `name` 数组」，组负责互斥关系以外的多选状态：

```tsx
{/* 单个 */}
<Checkbox defaultChecked>圆形（默认）</Checkbox>
<Checkbox shape="square" defaultChecked>方形</Checkbox>
<Checkbox checked={all} indeterminate={partial} onChange={setAll}>
  全选
</Checkbox>
<Checkbox labelPosition="left">文字在左</Checkbox>
<Checkbox labelDisabled>只有图标可点</Checkbox>

{/* 组：value 是已选 name 数组 */}
<CheckboxGroup value={fruits} max={2} onChange={setFruits}>
  <Checkbox name="apple">苹果</Checkbox>
  <Checkbox name="banana">香蕉</Checkbox>
  <Checkbox name="orange" disabled>
    橙子
  </Checkbox>
</CheckboxGroup>
```

- **`max`**：达到上限后未选项自动 `disabled`（已选项仍可取消，否则永远无法减员）。
- **`direction="horizontal"`**：横排自动换行，项间距 16px；默认竖排。
- **整行可点（H5 典型用法）**：把 `Checkbox`（不传文字、给 `ariaLabel`）放进 `Cell` 的 `rightIcon` 槽（不要放 `value`——value 与 title 各占一半宽，控件悬不到右边缘），行点击走同一份更新逻辑；Cell 的 `onClick` 里用 `event.target.closest("[data-slot='checkbox']")` 跳过来自 label 的点击，避免双触发。
- **全选 / 半选联动**：组没有内置「全选」概念，由外部一个 `Checkbox` 派生 `checked = 全选`、`indeterminate = 部分选`，组 ref 提供命令式写法。

```tsx
const groupRef = useRef<CheckboxGroupInstance>(null);
// 全选（禁用项也进值）/ 全不选
groupRef.current?.toggleAll();
groupRef.current?.toggleAll(false);
// 跳过禁用项：禁用项保持现状，启用项全选 / 全不选
groupRef.current?.toggleAll({ checked: true, skipDisabled: true });
```

组的 `disabled` / `shape` / `iconSize` / `checkedColor` 会向子项透传，子项同名 props 可覆盖。`bindGroup={false}` 可让单个 Checkbox 脱离外层组。

### Radio / RadioGroup

单选框，对齐 Vant `<van-radio>`。模式 A，热区与焦点环规则同 Checkbox；键盘交互直接复用**原生 radio**：组内 input 共享一个 name，空格选中、方向键在组内轮换由浏览器保证，无需自造键盘状态机。

```bash
npx shadcn@latest add @bivane/radio
```

```tsx
<RadioGroup value={pay} onChange={(name) => setPay(name as string)}>
    <Radio name="wechat">微信支付</Radio>
    <Radio name="alipay">支付宝</Radio>
    <Radio name="bank" disabled>
        银行卡
    </Radio>
</RadioGroup>;

{
    /* 横排 */
}
<RadioGroup direction="horizontal" defaultValue="secret">
    <Radio name="male">男</Radio>
    <Radio name="female">女</Radio>
    <Radio name="secret">保密</Radio>
</RadioGroup>;
```

`Cell` 整行点击写法同 Checkbox（控件放 `rightIcon` 槽；行 `onClick` 内 `closest("[data-slot='radio']")` 判重）。通用 props：`name` / `disabled` / `labelDisabled` / `labelPosition`（`left`·`right`）/ `iconSize` / `checkedColor`；组支持 `value`·`defaultValue`·`onChange(name)` / `direction` / `disabled` / `iconSize` / `checkedColor`。

---

### InputNumber

离散数量录入（Vant `van-stepper`）。**注意**：本组件名是 `InputNumber` 而不是 `Stepper`——刻意避开与「步骤条 Steps」的歧义。

H5 是横排 `−` 数字 `＋`，PC 是竖排微调列 + 可输入框 + 键盘。值语义（`min`/`max`/`step` 夹紧与量化、超界回调）两端逐字一致。

```tsx
<InputNumber defaultValue={1} />   {/* 默认 min=1 */}
<InputNumber min={0} max={10} step={2} />
<InputNumber value={n} onChange={setN} onOverlimit={(d) => console.log(d)} />
```

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `value` / `defaultValue` | `number \| string \| null` | `min` | `allowEmpty` 时清空得到 `null` |
| `min` / `max` | `number` | `1` / `Infinity` | 夹紧区间（逐字对齐 Vant） |
| `step` | `number` | `1` | 步长，浮点走尾差修正（`0.1+0.2=0.3`） |
| `theme` | `'default' \| 'round'` | `'default'` | `round` 为圆形按钮 |
| `inputWidth` / `buttonSize` | `number \| string` | 走 token | 数字按 px |
| `decimalLength` | `number` | — | 固定小数位 |
| `integer` / `allowEmpty` | `boolean` | `false` | 只收整数 / 允许清空为 `null` |
| `longPress` | `boolean` | `true` | H5 长按连发（400ms 起，200ms/步） |
| `autoFixed` | `boolean` | `true` | 失焦时按 step 收口 |
| `disableInput` / `disablePlus` / `disableMinus` | `boolean` | `false` | |
| `showInput` / `showPlus` / `showMinus` | `boolean` | `true` | |
| `disabled` | `boolean` | `false` | |
| `beforeChange` | `(v) => boolean \| Promise<boolean>` | — | 返回 `false` 拦截本次变更 |
| `onOverlimit` | `(dir) => void` | — | 已在边界仍按同方向点击时触发 |
| `onPlus` / `onMinus` | `() => void` | — | |
| `forceMode` | `'mobile' \| 'desktop'` | — | |

> **触屏为什么没有 44px 热区。** Rate 的选星是**按落点坐标算分**的（与 Vant 一致），
> 不是「每颗星各挂一块 44px 热区再`elementFromPoint` 找 DOM」。
> 后者在星间距只有 `size + gutter = 24px` 时会让相邻热区重叠 20px，
> 后一颗的兄弟节点赢者通吃 —— 表现为**每颗星的右半 10px 都会选中下一颗**。
> 坐标算分没有这个问题，且天然支持半星。

### Rate

评分。**模式 C**：两端视觉同形（同一套星形零件），差异只在手势与键盘 —— H5 可横向滑动连续选值，PC 是悬停预览 + 方向键微调。容器带 `role="slider"` 与 `aria-valuenow`。

```tsx
<Rate defaultValue={3} />
<Rate allowHalf defaultValue={2.5} />
<Rate count={10} defaultValue={7} />
<Rate defaultValue={3} clearable />   {/* 再次点击当前分值清零 */}
<Rate icon={<HeartIcon />} voidIcon={<HeartOutline />} />
```

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `value` / `defaultValue` | `number` | `0` | 分值，越界会被夹取 |
| `count` | `number` | `5` | 星数 |
| `allowHalf` | `boolean` | `false` | 半星（按触点/鼠标落在左半还是右半判定） |
| `clearable` | `boolean` | `false` | 再次点击当前分值清零 |
| `touchable` | `boolean` | `true` | 触屏滑动选择；**PC 忽略此 prop** |
| `size` / `gutter` | `number \| string` | `20` / `4` | 数字按 px |
| `color` / `voidColor` / `disabledColor` | `string` | 走 token 的 `var()` | 不新增工具类，直接写颜色值即可覆盖 |
| `icon` / `voidIcon` | `ReactNode` | 内置五角星 | 传 ReactNode，**不是 Vant 的 iconfont 名** |
| `readonly` / `disabled` | `boolean` | `false` | `disabled` 时 PC 不进 Tab 流 |
| `onChange` | `(v: number) => void` | — | |

### Slider

滑块。**模式 C**：两端共用轨道与滑块钮零件，差异在键盘（H5 不进 Tab 流、PC 支持方向键 / PageUp/Down / Home / End）。

```tsx
<Slider defaultValue={40} />
<Slider range defaultValue={[20, 60]} />
<Slider vertical defaultValue={30} />          {/* 竖直：值越大越靠上 */}
<Slider reverse defaultValue={30} />           {/* 反向：右/上为最小值 */}
<Slider defaultValue={30} step={5} activeColor="#ee0a24" />
<Slider value={v} onChange={setV} onDragStart={...} onDragEnd={...} />
```

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `value` / `defaultValue` | `number \| [number, number]` | `min` / `[min, max]` | `range` 时是二元组 |
| `min` / `max` | `number` | `0` / `100` | |
| `step` | `number` | `1` | 量化步长；`<=0` 时只夹紧不量化 |
| `range` | `boolean` | `false` | 双拇指区间 |
| `reverse` | `boolean` | `false` | 反向：填充条从对端连到拇指 |
| `vertical` | `boolean` | `false` | 竖直 |
| `barHeight` / `buttonSize` | `number \| string` | `2` / `24` | 数字按 px |
| `activeColor` / `inactiveColor` | `string` | 走 token 的 `var()` | 填充条 / 轨道底色 |
| `readonly` / `disabled` | `boolean` | `false` | |
| `onChange` | `(v: SliderValue) => void` | — | |
| `onDragStart` / `onDragEnd` | `(v: SliderValue) => void` | — | 与 Vant 同名同义 |
| `ariaLabel` | `string` | — | 渲染到每个滑块钮上（`range` 时自动加「起始/结束」） |

竖直形态要自己给容器高度，组件不会自己撑：

```tsx
<div style={{ height: 180 }}>
  <Slider vertical defaultValue={40} />
</div>
```

### Uploader

文件上传。**模式 C**：两端共用队列 / 进度 / 校验逻辑，差异在「值展示载体」与入口 —— H5 是**宫格**预览 + 「+」唤起相机/相册（`capture`），PC 是**列表**预览 + **拖拽区** + **粘贴**。

**传输两种驱动并存**（先 `afterRead` 后 `action`，都没有则仅本地预览）：

```tsx
// ① 业务自理上传（推荐）：resolve → 完成，reject → 失败（可重试）。
//    想让进度条/百分比动起来，就用第二个参数 onProgress 上报你的真实进度。
<Uploader multiple afterRead={async (item, onProgress) => {
  const body = new FormData();
  body.append("file", item.file!);
  const xhr = new XMLHttpRequest();                       // 或 fetch + 进度流
  // …把 xhr.upload.onprogress 的百分比喂给 onProgress(p)
  onProgress(42);                                         // 0~100
  await fetch("/api/upload", { method: "POST", body });
}} />

// ② 内置 XHR：传 action 即可，库负责 FormData 与进度（真实字节进度，自动显示百分比）
<Uploader action="/api/upload" name="file" withCredentials multiple />

// ③ 都不传：只做本地预览（status 直接 done）
<Uploader multiple />
```

> **关于进度显示**：只有「有真实进度源」时才显示百分比 —— 即用了 `action`（XHR 自动上报），
> 或在 `afterRead` 里主动调了 `onProgress`。两者都没有时上传中**只显示转圈、不显示 0%**
> （避免「一直 0% 突然跳 100」的假进度）。

#### App 桥回填（对接 JSBridge）

App WebView 里 `<input type=file>` 常被禁用或体验差，此时可让**点击交给用户自己处理**：
传 `onPickRequest` 后，点「+」/拖拽区**不再打开系统弹窗**，而是回调你；你在回调里调
原生桥拿文件，再用命令句柄 `handle.addFiles()` **回填**进上传控件 —— 回填走的是与手动
选择**完全一致**的校验（accept/maxSize/beforeRead）→ 压缩 → 入队 → 上传 → 进度流程。

```tsx
const up = React.useRef<UploaderHandle>(null);
<Uploader
  ref={up}
  onPickRequest={async (handle) => {
    const file = await window.myAppBridge.pickImage(); // 原生桥返回 File
    if (file) handle.addFiles(file);                    // 回填 → 自动进队列并上传
    // 或者 handle.open() 回退到系统 file input
  }}
/>
```

- 句柄 `UploaderHandle = { addFiles(files: File | File[]), open() }`，通过 **ref** 暴露（也可从
  `onPickRequest` 回调参数直接拿）。`addFiles` 接受单个或数组。
- 拖拽 / 粘贴不受 `onPickRequest` 影响（它们本就自带 File，仍直接进队列）。
- 不传 `onPickRequest` 时行为与之前完全一致（照旧打开系统 file input）。

H5 相机直唤 + 图片压缩（canvas，等比缩放到 `maxWidth` + `toBlob` 降质）：

```tsx
<Uploader capture="environment" compress={{ maxWidth: 1080, quality: 0.8 }} multiple />
```

校验钩子（语义对齐 Vant）：`beforeRead` 返回 false 拦截整批，`beforeDelete` 返回 false 拦截删除；超 `maxSize` 触发 `onOversize`，超 `maxCount` 触发 `onExceed`：

```tsx
<Uploader
  accept="image/*"
  multiple
  maxCount={9}
  maxSize={2 * 1024 * 1024}
  beforeRead={(f) => (Array.isArray(f) ? f.length > 0 : true)}
  beforeDelete={async (item) => confirm(`删除 ${item.name}？`)}
  onOversize={(f) => toast("文件超过 2MB")}
  onExceed={(f) => toast(`最多 9 个，多了 ${f.length} 个`)}
/>
```

受控：`value` 收 `UploaderFileItem[]`（含 `status`/`percent`），上传中状态与进度变化也会触发 `onChange`。

| prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `value` / `defaultValue` | `UploaderFileItem[]` | `[]` | 文件项：`key` / `file` / `url` / `status`(`uploading`\|`done`\|`failed`) / `percent` / `message` / `name` |
| `onChange` | `(list) => void` | — | 入列 / 上传状态 / 进度 / 删除都会触发 |
| `multiple` | `boolean` | `false` | |
| `maxCount` / `maxSize` | `number` | — | `maxSize` 单位字节 |
| `accept` | `string` | — | `'image/*'` 或 `'.jpg,.png'` |
| `capture` | `boolean \| 'user' \| 'environment'` | — | H5 直接唤起相机，PC 忽略 |
| `disabled` / `readonly` | `boolean` | `false` | `readonly` 不可增删/重试 |
| `compress` | `boolean \| { maxWidth?, quality? }` | `false` | 仅图片；默认 `maxWidth:1080` `quality:0.8` |
| `action` | `string` | — | 上传地址（内置 XHR），被 `afterRead` 优先覆盖 |
| `method` / `headers` / `name` / `data` / `withCredentials` | — | `POST` / — / `'file'` / — / `false` | XHR 传输参数 |
| `afterRead` | `(item, onProgress) => void \| Promise<void>` | — | resolve→完成，reject→失败；调 `onProgress(p)` 上报真实进度才有百分比 |
| `onPickRequest` | `(handle: UploaderHandle) => void` | — | 自定义选文件触发；传了它点「+」/拖拽区不弹系统框，改为回调，回调里用 `handle.addFiles()` 回填 |
| `beforeRead` / `beforeDelete` | `(x) => boolean \| Promise<boolean>` | — | 返回 false 拦截 |
| `onOversize` / `onExceed` | `(f) => void` | — | 超大小 / 超个数回调 |
| `ariaLabel` | `string` | — | 渲染到容器上，与全库一致用 `ariaLabel` |

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
