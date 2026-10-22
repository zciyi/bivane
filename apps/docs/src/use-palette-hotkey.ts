import { useEffect } from 'react';

/**
 * 全局快捷键：`/` 或 `Ctrl/⌘+K` 唤起搜索面板。
 *
 * ⚠ 这个判断写过一次错的，而且错得很安静（2026-10-22 用户实测抓到）：
 * 旧写法是「带 Ctrl/⌘ 就放行，输入框守卫只对裸 `/` 生效」——
 * 于是 **⌘A 全选、⌘C 复制、⌘V 粘贴、⌘Z 撤销、Ctrl+R 刷新、Ctrl+P 打印**
 * 全被当成「唤起搜索」：preventDefault 吞掉按键，面板弹出来糊一脸。
 * 读者在侧栏过滤框里想全选一段文字，搜索面板就先弹出来了。
 *
 * 教训：**「带修饰键」永远不能单独当唤起条件** —— 修饰键是给组合键用的，
 * 组合键有几百个，唤起键只有那么一两个。唤起条件必须逐键收窄。
 *
 * 现在的唤起键恰好两个，其余一律不碰：
 *   1. 裸 `/`（无 Ctrl/⌘/Alt）—— 且**不在输入/编辑元素里抢**：
 *      `/` 是合法输入字符（路径、正则、日期分隔符都可能以它开头）；
 *   2. `Ctrl/⌘ + K` —— 命令面板的通行键。它在文本编辑域里没有默认语义，
 *      所以不受输入框守卫限制（在过滤框里按 ⌘K 也该唤起面板）。
 */
export function usePaletteHotkey(onTrigger: () => void) {
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const withMod = e.ctrlKey || e.metaKey;
            const isSlash = e.key === '/' && !withMod && !e.altKey;
            const isCmdK = withMod && (e.key === 'k' || e.key === 'K');
            // 不是这两个键，直接走 —— 不 preventDefault、不唤起
            if (!isSlash && !isCmdK) return;

            // 正在输入/编辑时不抢 `/`（⌘K 不受此限，见上文）
            if (isSlash) {
                const el = e.target as HTMLElement | null;
                const tag = el?.tagName;
                if (
                    tag === 'INPUT' ||
                    tag === 'TEXTAREA' ||
                    tag === 'SELECT' ||
                    el?.isContentEditable
                ) {
                    return;
                }
            }

            e.preventDefault();
            onTrigger();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onTrigger]);
}
