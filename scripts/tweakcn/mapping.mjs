/**
 * Bivane ↔ tweakcn 槽位映射表
 *
 * 这是双向桥接的**唯一事实源**。转换器（scripts/tweakcn-bridge.mjs）与
 * 单测（tests/tweakcn-bridge.test.ts）都从这里读，改映射只改这一处。
 *
 * ── 为什么需要这张表 ──────────────────────────────────────────────
 * tweakcn 用的是 **shadcn 风格槽名**（--primary / --background / --muted …），
 * Bivane 用的是 **Vant 风格语义槽**（--bv-primary / --bv-text / --bv-muted …）。
 * 两套命名没有交集，tweakcn 的导入器只认它自己那 44 个名字
 * （见 tweakcn 源码 utils/parse-css-input.ts 的 variableNames）。
 * 所以「把 Bivane 的 CSS 丢给 tweakcn」的结果是：**静默导入 0 个变量**。
 *
 * ── 双向语义 ─────────────────────────────────────────────────────
 *   toTweakcn：Bivane 槽 → tweakcn 槽（导出，喂给 tweakcn 编辑器）
 *   toBivane： tweakcn 槽 → Bivane 槽（导入，把 tweakcn 调好的主题转回 Bivane）
 *
 * ── 三类槽的处置 ─────────────────────────────────────────────────
 *  1. 有对应：一一映射，两边都写。
 *  2. Bivane 有、tweakcn 无：导出时**丢弃**（tweakcn 没有这个概念），
 *     导入时保留 Bivane 原值（如 --bv-success / --bv-warning）。
 *  3. tweakcn 有、Bivane 无：导出时给**合理默认值**（让 tweakcn 编辑器有值可调），
 *     导入时丢弃（如 chart-1..5 / sidebar-* / font-serif）。
 */

/**
 * tweakcn 的 44 个合法槽名。
 * 来源：tweakcn 仓库 types/theme.ts 的 themeStylePropsSchema（zod）。
 * 用途：**校验**，防止我们写出 tweakcn 认不出的变量名。
 */
export const TWEAKCN_SLOTS = [
    // 表面色
    'background',
    'foreground',
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    // 交互色
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    // 状态色
    'destructive',
    'destructive-foreground',
    // 边框与输入
    'border',
    'input',
    'ring',
    // 图表色
    'chart-1',
    'chart-2',
    'chart-3',
    'chart-4',
    'chart-5',
    // 侧栏色
    'sidebar',
    'sidebar-foreground',
    'sidebar-primary',
    'sidebar-primary-foreground',
    'sidebar-accent',
    'sidebar-accent-foreground',
    'sidebar-border',
    'sidebar-ring',
    // 字体
    'font-sans',
    'font-serif',
    'font-mono',
    // 圆角
    'radius',
    // 阴影
    'shadow-color',
    'shadow-opacity',
    'shadow-blur',
    'shadow-spread',
    'shadow-offset-x',
    'shadow-offset-y',
    // 字距与间距
    'letter-spacing',
    'spacing',
];

/**
 * tweakcn 的非颜色槽（来源：config/theme.ts 的 COMMON_STYLES）。
 * 这些槽的值**原样透传**，不会被 tweakcn 的 culori 转成 hex。
 */
export const TWEAKCN_COMMON_SLOTS = new Set([
    'font-sans',
    'font-serif',
    'font-mono',
    'radius',
    'shadow-opacity',
    'shadow-blur',
    'shadow-spread',
    'shadow-offset-x',
    'shadow-offset-y',
    'letter-spacing',
    'spacing',
]);

/**
 * 颜色槽：tweakcn 的导入器会把这些值交给 culori 转 hex。
 * 所以**必须给合法颜色值**（hex / hsl() / oklch() 都行），给变量名（var(--x)）会被解析失败。
 */
export const TWEAKCN_COLOR_SLOTS = TWEAKCN_SLOTS.filter(
    (s) => !TWEAKCN_COMMON_SLOTS.has(s),
);

/**
 * 导出映射：Bivane 槽 → tweakcn 槽。
 *
 * value 语义：
 *  - 字符串 = Bivane 的 token 名（--bv-xxx），从当前作用域解析出**字面量**再写入
 *  - 'literal:<text>' = 直接写字面量（Bivane 侧无对应槽时用）
 *
 * ⚠ 关键约束：tweakcn 的导入器**不认识 var() 引用**（culori 解析 `var(--bv-primary)` 会失败，
 * 静默变成空）。所以导出必须**解析成字面量**。
 */
export const TO_TWEAKCN = {
    // ── 表面色 ──
    background: '--bv-background',
    foreground: '--bv-text',
    card: '--bv-background-2',
    'card-foreground': '--bv-text',
    popover: '--bv-background-2',
    'popover-foreground': '--bv-text',

    // ── 交互色 ──
    primary: '--bv-primary',
    'primary-foreground': '--bv-white',
    // Bivane 无「次要色」概念：取按压底色（active-color），语义上最接近「弱一级的主色」
    secondary: '--bv-active-color',
    'secondary-foreground': '--bv-text',
    muted: '--bv-muted',
    'muted-foreground': '--bv-text-2',
    accent: '--bv-active-color',
    'accent-foreground': '--bv-text',

    // ── 状态色 ──
    destructive: '--bv-danger',
    'destructive-foreground': '--bv-white',

    // ── 边框与输入 ──
    border: '--bv-border',
    input: '--bv-border',
    // 焦点环跟随主色（Bivane 的 --bv-focus-ring-color 就是 var(--bv-primary)）
    ring: '--bv-primary',

    // ── 图表色：Bivane 无图表概念，给品牌色板的固定序列 ──
    'chart-1': '--bv-blue',
    'chart-2': '--bv-green',
    'chart-3': '--bv-orange',
    'chart-4': '--bv-red',
    'chart-5': '--bv-gray-7',

    // ── 侧栏色：Bivane 无侧栏概念，映射到等价的表面/交互色 ──
    sidebar: '--bv-background-2',
    'sidebar-foreground': '--bv-text',
    'sidebar-primary': '--bv-primary',
    'sidebar-primary-foreground': '--bv-white',
    'sidebar-accent': '--bv-active-color',
    'sidebar-accent-foreground': '--bv-text',
    'sidebar-border': '--bv-border',
    'sidebar-ring': '--bv-primary',

    // ── 字体 ──
    'font-sans': '--bv-base-font',
    // tweakcn 有衬线/等宽槽，Bivane 没有：给通用字体栈，让编辑器里有值可调
    'font-serif': "literal:ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
    'font-mono':
        "literal:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",

    // ── 圆角 ──
    radius: '--bv-radius-md',

    // ── 阴影：Bivane 的阴影是「整条 box-shadow」而非分解槽，无法一一对应。
    //    这里给 tweakcn 侧可调的分解值（导入回 Bivane 时会被丢弃）。
    'shadow-color': 'literal:#000000',
    'shadow-opacity': 'literal:0.1',
    'shadow-blur': 'literal:3px',
    'shadow-spread': 'literal:0px',
    'shadow-offset-x': 'literal:0px',
    'shadow-offset-y': 'literal:1px',

    // ── 字距与间距 ──
    'letter-spacing': 'literal:0px',
    spacing: '--bv-padding-md',
};

/**
 * 导入映射：tweakcn 槽 → Bivane 槽（反向）。
 *
 * 与 TO_TWEAKCN 不是简单逆映射 —— 两边概念数量不同：
 *  - tweakcn 的 chart-* / sidebar-* / font-serif / shadow-* / letter-spacing
 *    在 Bivane 里没有落点 → **不导入**（保留 Bivane 原值）。
 *  - Bivane 的 --bv-success / --bv-warning 在 tweakcn 里没有落点
 *    → **不导入**（保留 Bivane 原值）。
 *
 * ⚠ 导入产物是「品牌槽覆盖」而非「中性槽覆盖」：
 * 中性槽（text / border / background 等）由 tweakcn 侧改过色后会**丢失**。
 * 这是有意为之：品牌槽是「风格」，中性槽是「基准」——
 * 基准由 Bivane 的 Vant 复刻值统一保证，不允许被外部主题改写
 * （同 architecture §3.3.1 的「风格只改品牌槽」约束）。
 */
export const TO_BIVANE = {
    // 主色：tweakcn 的 primary → Bivane 品牌槽「蓝」
    primary: '--bv-blue',
    // 危险色 → 品牌槽「红」
    destructive: '--bv-red',
    // 成功色：tweakcn 无对应槽（只有 destructive），但其图表色槽可承载
    // → 用 chart-2 承载成功绿（见下方 CHART_ROLE 约定）
    'chart-2': '--bv-green',
    // 警告色 → chart-3 承载警告橙
    'chart-3': '--bv-orange',
    // 注：tweakcn 的 ring **不导入**。
    // Bivane 的 --bv-focus-ring-color = var(--bv-primary) = var(--bv-blue)，
    // 焦点环自动跟随主色；若把 ring 也映射到 --bv-blue，
    // 在 ring ≠ primary 的主题里会把主色覆盖掉（对象键后写覆盖先写）。
};

/**
 * tweakcn 图表槽的「角色约定」。
 *
 * tweakcn 的 chart-1..5 是**通用分类色板**，没有业务语义。
 * 但 tweakcn 缺少 success / warning 两个语义槽，Bivane 有。
 * 约定：chart-1/2/3 分别承载 主色 / 成功 / 警告，其余为辅助色。
 * 这样「用 tweakcn 调完导回来」时，成功色与警告色不会凭空丢失。
 */
export const CHART_ROLE = {
    'chart-1': 'primary',
    'chart-2': 'success',
    'chart-3': 'warning',
};

/**
 * 导入时额外派生的品牌槽。
 *
 * Bivane 有 8 个品牌槽 + 1 个组件级品牌槽，tweakcn 侧只直接给得出 4 个。
 * 其余的按「从主色派生」或「沿用 Bivane 原值」处理：
 *  - orange-dark / orange-light：tweakcn 无对应 → 沿用 Bivane 原值（导入产物不覆盖）
 *  - gradient-red / gradient-orange：tweakcn 无对应 → 沿用 Bivane 原值
 *  - rate-icon-full-color：tweakcn 无对应 → 沿用 Bivane 原值
 */
export const IMPORT_EXTRA_BIVANE_SLOTS = [
    '--bv-orange-dark',
    '--bv-orange-light',
    '--bv-gradient-red',
    '--bv-gradient-orange',
    '--bv-rate-icon-full-color',
];
