/**
 * Bivane · CSS 变量提取器（零依赖）
 *
 * 用途：tweakcn 双向桥接的底层工具。**故意不依赖 postcss** ——
 * 消费者 `npx shadcn add @bivane/tweakcn` 后要能直接跑这个脚本，
 * 若依赖 postcss 就得给消费者装一个包（体积 + 供应链面）。
 * 正解性的保证来自 tests/tweakcn-bridge.test.ts：**用 postcss 做交叉验证**
 * （postcss 是本仓 devDependency，测试里拿它当「真值」比对本模块的输出）。
 *
 * ── 为什么不能用正则硬啃 ─────────────────────────────────────────
 * 1. 注释里可能有 `}`：vant.css 有一段注释内嵌了 `.van-popup--center { max… }`，
 *    用 `\{([^}]*)\}` 提块会在这里**提前截断**，后半张表全丢。
 * 2. 选择器与花括号之间可能有注释：`:root` 与 `, :host` 之间夹一段注释。
 * 3. 声明值里可能有分号（自定义属性里尤其常见）：`--x: a; b;`。
 * 所以这里手写一个**够用但正确**的小解析器：
 * 先剥注释（等长替换，保留字符位置），再按括号配平提块。
 */

/** 剥掉 CSS 注释，用等长空格替换以保留字符位置 */
export function stripComments(css) {
    let out = '';
    let i = 0;
    const n = css.length;
    while (i < n) {
        const c = css[i];
        if (c === '/' && css[i + 1] === '*') {
            const end = css.indexOf('*/', i + 2);
            const stop = end === -1 ? n : end + 2;
            // 换成等长空白：保持后续所有偏移不变
            out += ' '.repeat(stop - i);
            i = stop;
            continue;
        }
        out += c;
        i += 1;
    }
    return out;
}

/**
 * 找出所有「选择器 → 块体」的映射。
 *
 * 只处理**顶层**规则（不递归进 @media / @supports）——
 * 桥接场景只需要 :root / .dark / .bv-theme-* 这类顶层块。
 *
 * @returns Map<string, string[]>  选择器（已归一化空白）→ 块体数组
 */
export function extractBlocks(css) {
    const src = stripComments(css);
    const map = new Map();
    let i = 0;
    const n = src.length;

    while (i < n) {
        // 找到下一个顶层 '{'
        const brace = src.indexOf('{', i);
        if (brace === -1) break;

        const selector = src.slice(i, brace).trim();
        // 块体起点
        let depth = 1;
        let j = brace + 1;
        while (j < n && depth > 0) {
            if (src[j] === '{') depth += 1;
            else if (src[j] === '}') depth -= 1;
            j += 1;
        }
        const body = src.slice(brace + 1, depth === 0 ? j - 1 : n);

        // 只收顶层规则：选择器里若含 '{' 说明前面跳过了嵌套（@media 等）
        if (selector && !selector.includes('@') && !selector.includes('{')) {
            const key = selector.replace(/\s+/g, ' ').trim();
            const list = map.get(key) ?? [];
            list.push(body);
            map.set(key, list);
        }

        // 若块体内部还有嵌套（@media），需要跳过它的内容继续找顶层块
        if (depth > 0) {
            // 找与这个 '{' 配平的 '}'，从那里继续
            let d = 1;
            let k = brace + 1;
            while (k < n && d > 0) {
                if (src[k] === '{') d += 1;
                else if (src[k] === '}') d -= 1;
                k += 1;
            }
            i = k;
        } else {
            i = j;
        }
    }
    return map;
}

/**
 * 从块体里提取自定义属性声明。
 *
 * 值里可能有分号（`--x: a; b` 里的 `;` 属于值的一部分），
 * 所以按「分号分隔，但跳过引号内与括号内」来切。
 *
 * @returns Record<string, string>  变量名 → 原始值（未 trim 内部空白）
 */
export function extractDecls(body) {
    const out = {};
    const s = stripComments(body);
    let i = 0;
    const n = s.length;
    let start = 0;

    const push = (from, to) => {
        const chunk = s.slice(from, to);
        const colon = chunk.indexOf(':');
        if (colon === -1) return;
        const name = chunk.slice(0, colon).trim();
        const value = chunk.slice(colon + 1).trim();
        if (!name.startsWith('--')) return;
        out[name] = value;
    };

    while (i < n) {
        const c = s[i];
        if (c === '"' || c === "'") {
            // 跳过字符串
            const quote = c;
            i += 1;
            while (i < n && s[i] !== quote) {
                if (s[i] === '\\') i += 1;
                i += 1;
            }
            i += 1;
            continue;
        }
        if (c === '(') {
            let d = 1;
            i += 1;
            while (i < n && d > 0) {
                if (s[i] === '(') d += 1;
                else if (s[i] === ')') d -= 1;
                i += 1;
            }
            continue;
        }
        if (c === ';') {
            push(start, i);
            start = i + 1;
        }
        i += 1;
    }
    push(start, n);
    return out;
}

/**
 * 把一组 CSS 文件解析成「作用域 → 变量表」。
 *
 * @param {string[]} files           CSS 文件内容
 * @param {string[]} scopeSelectors  哪些选择器算「作用域」（如 [':root, :host']）
 * @returns Record<string, Record<string,string>>
 */
export function collectScopes(files, scopeSelectors) {
    const scopes = {};
    for (const css of files) {
        const blocks = extractBlocks(css);
        for (const [selector, bodies] of blocks) {
            if (!scopeSelectors.includes(selector)) continue;
            const bucket = (scopes[selector] ??= {});
            for (const body of bodies) {
                Object.assign(bucket, extractDecls(body));
            }
        }
    }
    return scopes;
}

/**
 * 解析 `var(--x)` 引用链，返回字面量。
 *
 * CSS 自定义属性是**延迟解析**的：`--bv-primary: var(--bv-blue)` 在
 * `.bv-theme-ocean` 作用域内会解析成 ocean 的 --bv-blue。
 * 这里做同样的事：按作用域合并后逐层解引用。
 *
 * @param {Record<string,string>} scope  变量表（含各级）
 * @param {string} name                 变量名
 * @returns {string|null}               解引用后的字面量；无法解析时返回 null
 */
export function resolveVar(scope, name) {
    const seen = new Set();
    const walk = (key) => {
        if (seen.has(key)) return null;
        seen.add(key);
        const raw = scope[key];
        if (raw === undefined) return null;
        const m = /^var\(\s*(--[a-zA-Z0-9_-]+)\s*\)$/.exec(raw);
        if (m) return walk(m[1]);
        return raw;
    };
    return walk(name);
}

/**
 * 判断一个值是否是「可安全交给 culori 的颜色字面量」。
 *
 * tweakcn 的导入器对颜色槽做 `culori.parse(value)`，
 * 解析失败会静默变成空 —— 所以导出前必须自查。
 */
export function isColorLiteral(value) {
    if (!value) return false;
    const v = value.trim();
    return (
        /^#[0-9a-fA-F]{3,8}$/.test(v) ||
        /^rgb\(/i.test(v) ||
        /^rgba\(/i.test(v) ||
        /^hsl\(/i.test(v) ||
        /^hsla\(/i.test(v) ||
        /^oklch\(/i.test(v) ||
        /^oklab\(/i.test(v) ||
        /^color\(/i.test(v)
    );
}
