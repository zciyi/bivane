/**
 * Bivane 文档站 · 示例清单
 *
 * 这里是**产品文案**（每个示例叫什么、演示什么）—— 手写维护。
 * 代码在 `example-code.generated.json` 里，由 `npm run docs:examples`
 * 从 `demos/<组件>.tsx` 自动抽取（与实现同源，不会漂移）。
 *
 * key = 示例组件名（`XxxExampleN`），value = { title, desc }
 * title 用来做卡片标题与锚点，desc 是卡片里的一句话说明。
 */
export interface ExampleMeta {
    /** 卡片标题 */
    title: string;
    /** 一句话说明这个示例演示什么 */
    desc: string;
}

export const EXAMPLES: Record<string, ExampleMeta> = {
    // ── 基础 ──
    ButtonExample1: {
        title: '按钮类型',
        desc: '五种类型（默认/主要/成功/危险/警告）与四种形态（朴素/圆角/直角/块级），含加载态。',
    },
    ButtonExample2: {
        title: '按钮尺寸',
        desc: 'normal / small / mini / large 四档尺寸，large 宽度撑满。',
    },
    CellExample1: {
        title: '单元格分组',
        desc: 'CellGroup 分组容器，含大号行、居中、无下边框等行形态。',
    },
    CellExample2: {
        title: '卡片内嵌',
        desc: 'inset 卡片式单元格，支持标签+值、描述、链接、必填标记、自定义图标与角标。',
    },
    TagBadgeExample1: {
        title: '标签与徽标',
        desc: 'Tag 的类型色与尺寸，Badge 的数量角标与点状形态。',
    },
    IconExample1: {
        title: '图标集',
        desc: '内置图标全集，纯 SVG 渲染，无字体依赖。',
    },
    IconExample2: {
        title: '尺寸与颜色',
        desc: '图标可显式指定尺寸与颜色；不传尺寸时按 1em 跟随字号。',
    },

    // ── 表单 ──
    FieldExample1: {
        title: '基础输入',
        desc: 'Field 是 Cell 行形态的输入外壳：label、图标、清除、错误提示。',
    },
    FieldExample2: {
        title: '验证码与倒计时',
        desc: 'action 区放按钮的典型用法：发送后倒计时禁用，等待期间显示剩余秒数。',
    },
    FieldExample3: {
        title: '字数与只读',
        desc: 'maxlength 与 showWordCount 组合，以及只读态的展示。',
    },
    SwitchExample1: {
        title: '各种形态',
        desc: '受控基础用法，以及禁用、加载、自定义尺寸与颜色的形态。',
    },
    SwitchExample2: {
        title: '放在 Cell 行里',
        desc: '开关作为 Cell 行的右侧图标；含 beforeChange 二次确认与枚举值开关。',
    },
    CheckboxExample1: {
        title: '基本形态',
        desc: '圆形/方形、半选态、文字位置、文字不可点、禁用等形态。',
    },
    CheckboxExample2: {
        title: 'Cell 行内与上限',
        desc: '整行可点的 CheckboxGroup，max 限制新增数量，达到上限后其余项自动禁用。',
    },
    CheckboxExample3: {
        title: '横向分组',
        desc: 'direction="horizontal" 的横向排列。',
    },
    CheckboxExample4: {
        title: '全选与半选',
        desc: '父项根据子项状态自动呈现全选/半选，子项全不选时父项自动取消。',
    },
    RadioExample1: {
        title: 'Cell 行内单选',
        desc: 'RadioGroup 放进 CellGroup，整行可点。',
    },
    RadioExample2: {
        title: '纵向排列',
        desc: '默认的纵向 RadioGroup。',
    },
    RateExample1: {
        title: '评分',
        desc: '受控/非受控、只读、禁用、可清零、自定义颜色与半星。',
    },
    SliderExample1: {
        title: '基础滑块',
        desc: '单值滑块的受控用法。',
    },
    SliderExample2: {
        title: '区间滑块',
        desc: 'range 模式选出一个区间，值为 [起, 止]。',
    },
    SliderExample3: {
        title: '禁用 / 只读 / 反向',
        desc: '三种特殊状态：不可交互、只读展示、轨道反向。',
    },
    SliderExample4: {
        title: '竖直滑块',
        desc: 'vertical 属性改为纵向轨道。',
    },
    InputNumberExample1: {
        title: '数量步进',
        desc: '加减按钮 + 数字输入；H5 横排 ±，PC 竖排 ▲▼，值语义对齐 Vant van-stepper。',
    },
    UploaderExample1: {
        title: '基础上传',
        desc: '默认上传：H5 宫格 + 相机，PC 拖拽区 + 列表。',
    },
    UploaderExample2: {
        title: '受控与压缩',
        desc: 'value/onChange 受控，配合 accept 过滤与 maxSize 限制。',
    },
    UploaderExample3: {
        title: '进度与失败重试',
        desc: 'afterRead 上报真实进度；文件名含 fail 的走失败分支展示重试。',
    },
    UploaderExample4: {
        title: '自定义回填',
        desc: 'onPickRequest 交由 App 桥回原生选择器，选完用 ref 的 addFiles 回填。',
    },
    SearchExample1: {
        title: '基础搜索',
        desc: 'H5 聚焦展开全屏页 + 历史记录，PC 内联输入 + 建议浮层。',
    },

    // ── 弹层与反馈 ──
    PopupExample1: {
        title: '四种位置',
        desc: 'position 决定弹出位置；PC 端一律降级为居中模态，原值仍记在 data-position。',
    },
    DialogExample1: {
        title: '对话框',
        desc: '声明式用法 + 命令式（showDialog / showConfirmDialog）；H5 底部抽屉，PC 居中模态。',
    },
    DialogExample2: {
        title: 'Alert 与 Confirm',
        desc: '复用 Dialog 底座的两种语义，差别只在默认是否带取消按钮。',
    },
    ActionSheetExample1: {
        title: '动作面板',
        desc: 'H5 底部动作列表，PC 居中列表；confirmable 走暂存 → 确定。',
    },
    ToastExample1: {
        title: '轻提示',
        desc: 'H5 单例胶囊，PC 可并存卡片栈。',
    },
    NotifyExample1: {
        title: '消息通知',
        desc: 'H5 顶部横幅，PC 右上角角标通知。',
    },
    LoadingExample1: {
        title: '加载',
        desc: 'H5 全屏遮罩 + 转圈，PC 优先局部骨架屏。',
    },
    TooltipExample1: {
        title: '文字提示',
        desc: 'H5 无浮层（常驻 ⓘ 说明条），PC hover/focus 跟随气泡。',
    },
    PopoverExample1: {
        title: '气泡菜单',
        desc: 'H5 ≤3 行气泡 / >3 行降级底部抽屉，PC 锚定浮层。',
    },
    EllipsisExample1: {
        title: '多行截断',
        desc: '默认按 2 行截断，实测溢出才出现「展开 / 收起」。',
    },
    EllipsisExample2: {
        title: '指定行数',
        desc: 'rows 属性控制截断行数。',
    },

    // ── 选择与输入 ──
    SelectExample1: {
        title: '选择器',
        desc: 'H5 底部热区单选即关，PC 锚定浮层键盘巡航 / 多选不关；选项 > 10 才出搜索框。',
    },
    DropdownMenuExample1: {
        title: '下拉菜单',
        desc: 'H5 面板栈替换视野，PC 子菜单右展；值按完整层级路径匹配。',
    },
    DatePickerExample1: {
        title: '日期选择',
        desc: 'H5 三列滚轮，PC 月历面板；区间为两段式入口。',
    },
    TimePickerExample1: {
        title: '时间选择',
        desc: '两端同一套滚轮，只换外壳（底部弹层 vs 锚定浮层 + 底部确认条）。',
    },
    DateTimePickerExample1: {
        title: '日期时间选择',
        desc: 'H5 滚轮，PC 月历 + 时分秒滚轮列；单值恒走暂存 → 确定。',
    },
    PickerExample1: {
        title: '多列选择',
        desc: 'H5 N 列吸附滚轮，PC N 列纵向面板；列间互不影响。',
    },
    CascaderExample1: {
        title: '级联选择',
        desc: 'H5 联动滚轮，PC 面包屑 + 逐级右展多列面板。值恒为根 → 叶完整路径。',
    },
    CalendarExample1: {
        title: '日历',
        desc: 'H5 全屏弹层拖选，PC 内嵌常驻月历。值恒为 YYYY-MM-DD。',
    },
    BoundsExample1: {
        title: 'min / max 边界约束',
        desc: 'Date / Time / DateTime 共用一套边界语义：闭区间，滚轮列按边界逐字段级联收窄。',
    },

    // ── 导航与数据 ──
    TabsExample1: {
        title: '标签页',
        desc: 'H5 标签条可横滑 + 手势，PC 不滑动 + 键盘 + 下划线指示器。',
    },
    NavBarExample1: {
        title: '导航栏',
        desc: 'H5 返回箭头 + 标题居中，PC 标题左对齐 + 操作区右对齐。',
    },
    TabbarExample1: {
        title: '标签栏',
        desc: 'H5 底部固定条，PC 侧边导航或顶部导航。',
    },
    ListExample1: {
        title: '列表',
        desc: 'H5 无限滚动 + 触底加载 + 下拉刷新，PC 滚动加载 + 刷新按钮 + 虚拟滚动。',
    },
    TableExample1: {
        title: '表格',
        desc: 'H5 卡片化，PC 标准表格（表头排序 / 列固定 / 列筛选 / 行选择）。',
    },
    TablePaginationExample1: {
        title: '分页',
        desc: 'PC 端分页条：远程/本地、每页条数、起始页、总数、跳页、受控。',
    },
    DataContainerExample1: {
        title: '加载层',
        desc: '只回答「数据怎么来」，对内容层透明。加载策略与 mode 正交。',
    },
};
