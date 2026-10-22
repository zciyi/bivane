/**
 * Bivane · 颜色字面量归一化（零依赖）
 *
 * 用途：tweakcn 桥接的导入方向。
 * tweakcn 生态的默认主题用 `oklch(...)`（shadcn v4 就是），
 * 用户手写的主题也常用 oklch / hsl / rgb。但 Bivane 的 token 体系是 **hex 基线**
 * （vant.css 里 40 处裸色值全是 hex），导入产物若混进 oklch 会与库内其它
 * 风格文件（vant-ocean.css 等）不一致，也不好肉眼比对。
 * 所以这里统一转成 hex。
 *
 * 色彩空间换算走 **sRGB**（IEC 61966-2-1），与 culori / tweakcn 的默认行为一致。
 * 转出的 hex 一律 6 位小写（culori.formatHex 的格式）。
 *
 * ⚠ 精度：oklch → sRGB 需要 gamut 裁剪（超出 sRGB 的色相会被裁到边界），
 *   裁剪后可能有微小色差（ΔE < 0.01）。这是任何 hex 目标格式的固有代价 ——
 *   保留 oklch 原文才能无损，但那样产物就不是 hex 基线了。
 */

/**
 * 已经处于 **sRGB 空间**的 0..1 通道值 → 8bit。
 * hsl() 的输出天然在 sRGB 空间（定义即如此），不能再过一遍传递函数
 * —— 过了就等于把亮度整体抬高（曾导致 hsl(217,100%,53%) 算出 #45adff 而非 #0f6bff）。
 */
function fromSrgb(channel) {
    return Math.round(Math.min(1, Math.max(0, channel)) * 255);
}

/**
 * 把 **线性** sRGB 的 0..1 通道值转成 8bit（要过 sRGB 传递函数）。
 * 只用于 oklch/oklab —— 那两个色彩空间换算出来的就是线性 sRGB。
 */
function encodeSrgb(channel) {
    const c = channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, c)) * 255);
}

function toHexPair(r, g, b) {
    const hex = (n) => n.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** hex → [r,g,b] 0..255 */
function hexToRgb(hex) {
    let h = hex.replace('#', '').toLowerCase();
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length === 8) h = h.slice(0, 6);
    if (!/^[0-9a-f]{6}$/.test(h)) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * hsl → [r,g,b] 0..255（h 单位为度，s/l 为 0..100）
 *
 * 标准换算：k(n) = (n + h/30) % 12；a = s·min(l, 1-l)；
 *           f(n) = l - a·max(-1, min(k(n)-3, 9-k(n), 1))
 * 注意 min 是**三参数**（k-3、9-k、1 同时参与）—— 写成两层嵌套 min 会算错。
 */
function hslToRgb(h, s, l) {
    const sat = s / 100;
    const lig = l / 100;
    const k = (n) => (n + h / 30) % 12;
    const a = sat * Math.min(lig, 1 - lig);
    const f = (n) => lig - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return [fromSrgb(f(0)), fromSrgb(f(8)), fromSrgb(f(4))];
}

/**
 * oklch → [r,g,b] 0..255
 *
 * OKLab → 线性 sRGB 的逆变换（参考 Björn Ottosson 的推导）：
 *   l' = L + 0.3963377774·a + 0.2158037573·b
 *   m' = L - 0.1055613458·a - 0.0638541728·b
 *   s' = L - 0.0894841775·a - 1.2914855480·b
 *   l = l'³, m = m'³, s = s'³
 *   r =  4.0767416621·l - 3.3077115913·m + 0.2309699292·s
 *   g = -1.2684380046·l + 2.6097574011·m - 0.3413193965·s
 *   b =  -0.0041960863·l - 0.7034186147·m + 1.7076147010·s
 * 其中 a = C·cos(h°)、b = C·sin(h°)
 */
function oklchToRgb(L, C, hDeg) {
    const hRad = (hDeg * Math.PI) / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.291485548 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    // ⚠ 这里出来的是**线性** sRGB，必须再过一次 sRGB 传递函数才是 8bit 值。
    //    encodeSrgb 内部已经做了「传递函数 + 夹取 + x255」三件事，
    //    所以这里**不能**再额外套一层 gamma —— 套两层会把颜色整体提亮
    //    （曾导致 oklch(0.145 0 0) 算出 #383838 而非 #0a0a0a）。
    return [encodeSrgb(lr), encodeSrgb(lg), encodeSrgb(lb)];
}

/** 解析 CSS 颜色函数里的数字与百分比（统一成 0..1 或按需的原始值） */
function parseNumber(token, scale = 1) {
    const t = token.trim();
    if (t.endsWith('%')) return (parseFloat(t) / 100) * scale;
    return parseFloat(t) * scale;
}

/**
 * 把任意 CSS 颜色字面量归一化成 6 位小写 hex。
 * 认得的格式：#hex / rgb() / rgba() / hsl() / hsla() / oklch() / oklab()
 * 认不得时**原样返回**（不猜、不丢）—— 调用方据此判断是否需要报警。
 */
export function normalizeColor(value) {
    if (!value) return value;
    const v = value.trim();

    if (v.startsWith('#')) {
        const rgb = hexToRgb(v);
        return rgb ? toHexPair(rgb[0], rgb[1], rgb[2]) : v;
    }

    const fn = /^([a-zA-Z-]+)\((.*)\)$/s.exec(v);
    if (!fn) return v;
    const name = fn[1].toLowerCase();
    const body = fn[2];

    // 按逗号切分（rgb/hsl 的旧语法），或按空格切分（现代语法）
    const parts = body
        .split(/[\s,/]+/)
        .map((p) => p.trim())
        .filter(Boolean);

    try {
        if (name === 'rgb' || name === 'rgba') {
            // rgb() 的通道是 0..255（不是 0..1）；写成百分比时才按 100 折算
            const chan = (tok) => {
                const t = tok.trim();
                if (t.endsWith('%')) return Math.round((parseFloat(t) / 100) * 255);
                return Math.round(parseFloat(t));
            };
            return toHexPair(chan(parts[0]), chan(parts[1]), chan(parts[2]));
        }
        if (name === 'hsl' || name === 'hsla') {
            const h = parseFloat(parts[0]);
            // hsl 的 s/l：写百分比就除 100；写裸数字就是 0..100 的绝对值
            const pct = (tok) => (tok.trim().endsWith('%') ? parseFloat(tok) : parseFloat(tok));
            const s = pct(parts[1]);
            const l = pct(parts[2]);
            const rgb = hslToRgb(h, s, l);
            return toHexPair(rgb[0], rgb[1], rgb[2]);
        }
        if (name === 'oklch') {
            // oklch(L C H) —— L 是 0..1，C 是 0..0.4 左右，H 是角度
            const L = parseNumber(parts[0]);
            const C = parseNumber(parts[1]);
            // 色相可以带 deg / rad / grad / turn 单位
            let h = parseFloat(parts[2]);
            const unit = /([a-zA-Z]+)\s*$/.exec(parts[2])?.[1]?.toLowerCase();
            if (unit === 'rad') h = (h * 180) / Math.PI;
            else if (unit === 'turn') h = h * 360;
            else if (unit === 'grad') h = (h * 360) / 400;
            const rgb = oklchToRgb(L, C, h);
            return toHexPair(rgb[0], rgb[1], rgb[2]);
        }
        if (name === 'oklab') {
            const L = parseNumber(parts[0]);
            const a = parseNumber(parts[1]);
            const b = parseNumber(parts[2]);
            // oklab → oklch（极坐标）
            const C = Math.sqrt(a * a + b * b);
            const h = (Math.atan2(b, a) * 180) / Math.PI;
            const rgb = oklchToRgb(L, C, h);
            return toHexPair(rgb[0], rgb[1], rgb[2]);
        }
    } catch {
        return v;
    }
    return v;
}

/** 判断归一化后是否仍是一个可被 culori 解析的颜色（用于「静默丢弃」预警） */
export function isConvertibleColor(value) {
    return normalizeColor(value) !== value.trim() || /^#[0-9a-f]{6}$/.test(normalizeColor(value));
}
