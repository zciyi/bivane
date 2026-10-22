import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePaletteHotkey } from '@/apps/docs/src/use-palette-hotkey';

/**
 * 文档站 · 全局快捷键测试
 *
 * 一正一误，都来自真机实测（2026-10-22 用户反馈「怎么点击选取就出现搜索」——
 * 在侧栏过滤框里全选文字，搜索面板弹出来了）：
 *
 *   正：`/`（非输入域）与 `Ctrl/⌘+K`（任何地方）唤起面板；
 *   误：**其它组合键一律不抢也不吞**。旧实现是「带 Ctrl/⌘ 就放行、
 *      输入框守卫只对裸 `/` 生效」，于是 ⌘A 全选、⌘C 复制、⌘V 粘贴、
 *      ⌘Z 撤销、Ctrl+R 刷新、Ctrl+P 打印全被 preventDefault 吞掉并弹出面板。
 *
 * 判据写「我期望什么」：唤起键唤起；别的键不但不唤起，
 * 连 preventDefault 都不能有 —— 吞掉 ⌘C 比不唤起更糟。
 */

function Harness({ onTrigger }: { onTrigger: () => void }) {
    usePaletteHotkey(onTrigger);
    return (
        <div>
            <input aria-label="过滤组件或属性" />
            <button type="button">按钮</button>
        </div>
    );
}

function setup() {
    const onTrigger = vi.fn();
    render(<Harness onTrigger={onTrigger} />);
    return {
        onTrigger,
        input: screen.getByLabelText('过滤组件或属性'),
    };
}

/**
 * 派发 keydown，返回「有没有被 preventDefault」。
 * 快捷键监听挂在 window 上，事件从目标冒泡上去 —— 与真实浏览器一致。
 */
function press(target: EventTarget, init: KeyboardEventInit): boolean {
    const event = new KeyboardEvent('keydown', {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    return target.dispatchEvent(event);
}

describe('文档站 · 全局快捷键', () => {
    it('裸 `/` 唤起面板，并阻止默认动作', () => {
        const { onTrigger } = setup();
        expect(press(document.body, { key: '/' })).toBe(false); // false = 被 preventDefault
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    it('`/` 在输入框里不抢 —— 它是合法输入字符', () => {
        const { onTrigger, input } = setup();
        expect(press(input, { key: '/' })).toBe(true);
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it('`/` 在 textarea 里同样不抢', () => {
        const { onTrigger } = setup();
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        expect(press(textarea, { key: '/' })).toBe(true);
        expect(onTrigger).not.toHaveBeenCalled();
        textarea.remove();
    });

    it('Ctrl+K / ⌘K 唤起面板', () => {
        const { onTrigger } = setup();
        expect(press(document.body, { key: 'k', ctrlKey: true })).toBe(false);
        expect(onTrigger).toHaveBeenCalledTimes(1);
        press(document.body, { key: 'k', metaKey: true });
        expect(onTrigger).toHaveBeenCalledTimes(2);
    });

    it('⌘K 在输入框里也唤起 —— 它在文本域里没有别的语义', () => {
        const { onTrigger, input } = setup();
        press(input, { key: 'k', metaKey: true });
        expect(onTrigger).toHaveBeenCalledTimes(1);
    });

    // ── 回归主用例：别的组合键一律不抢、不吞 ──
    const HIJACKED: [string, KeyboardEventInit][] = [
        ['Ctrl+A 全选', { key: 'a', ctrlKey: true }],
        ['⌘+A 全选', { key: 'a', metaKey: true }],
        ['Ctrl+C 复制', { key: 'c', ctrlKey: true }],
        ['⌘+V 粘贴', { key: 'v', metaKey: true }],
        ['Ctrl+X 剪切', { key: 'x', ctrlKey: true }],
        ['⌘+Z 撤销', { key: 'z', metaKey: true }],
        ['Ctrl+R 刷新', { key: 'r', ctrlKey: true }],
        ['Ctrl+P 打印', { key: 'p', ctrlKey: true }],
        ['Ctrl+S 保存', { key: 's', ctrlKey: true }],
        ['Ctrl+F 页内查找', { key: 'f', ctrlKey: true }],
        ['Alt+/ 组合', { key: '/', altKey: true }],
    ];

    it.each(HIJACKED)('%s：不唤起，也不被吞', (_label, init) => {
        const { onTrigger } = setup();
        expect(press(document.body, init)).toBe(true);
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it('同样的组合键在输入框里也必须原样生效', () => {
        const { onTrigger, input } = setup();
        for (const [, init] of HIJACKED.slice(0, 6)) {
            expect(press(input, init)).toBe(true);
        }
        expect(onTrigger).not.toHaveBeenCalled();
    });

    it('普通按键（字母/Enter/Esc/方向键/空格）不唤起', () => {
        const { onTrigger } = setup();
        for (const key of ['a', 'Enter', 'Escape', 'ArrowDown', ' ', 'k']) {
            press(document.body, { key });
        }
        expect(onTrigger).not.toHaveBeenCalled();
    });
});
