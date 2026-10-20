import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Search } from '@/components/responsive/search';
import {
    filterSuggestions,
    nextSuggestionIndex,
    pushHistory,
    removeHistoryItem,
} from '@/hooks/use-search-state';

/**
 * Search 双模式行为测试（矩阵 §4：h5 / pc 各一组）
 *
 * 重点验证两端确实是两套交互范式，且值语义一致：
 *   - 容器：H5 展开 Popup fullscreen 全屏页（含历史区）/ PC 浮出 Radix 建议浮层（无历史）
 *   - 建议源：静态按关键词过滤；异步经防抖后请求
 *   - 历史：提交写历史、去重前置、可控
 *   - 键盘：PC ↑↓ 巡航 + Enter 选中激活项 + Esc 关闭
 */

const HOT_WORDS = ['苹果', '香蕉', '橙子'];

function inlineInput(): HTMLInputElement {
    return document.querySelector('[data-slot="search"] > [data-slot="search-input"] input') as HTMLInputElement;
}

function fullInput(): HTMLInputElement | null {
    return document.querySelector('[data-slot="search-h5-header"] input');
}

function pcInput(): HTMLInputElement {
    return document.querySelector('input[data-slot="search-field"]') as HTMLInputElement;
}

function panel(): HTMLElement | null {
    return document.querySelector('[data-slot="search-suggestion-panel"]');
}

function suggestionRows(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-slot="search-suggestion"]'));
}

function activeRow(): HTMLElement | null {
    return document.querySelector('[data-slot="search-suggestion"][data-active="true"]');
}

function historyRows(): HTMLElement[] {
    return Array.from(document.querySelectorAll('[data-slot="search-h5-history-item"]'));
}

/* ------------------------------------------------------------------ *
 * 纯函数
 * ------------------------------------------------------------------ */

describe('use-search-state 纯函数', () => {
    it('filterSuggestions：空关键词返回全部（热词态），有关键词按子串过滤', () => {
        expect(filterSuggestions(HOT_WORDS, '')).toEqual(HOT_WORDS);
        expect(filterSuggestions(HOT_WORDS, '苹')).toEqual(['苹果']);
        expect(filterSuggestions(HOT_WORDS, 'zzz')).toEqual([]);
    });

    it('pushHistory：去重前置、忽略空词、截断到上限', () => {
        expect(pushHistory([], 'a')).toEqual(['a']);
        expect(pushHistory(['a', 'b'], 'b')).toEqual(['b', 'a']);
        expect(pushHistory(['a'], '   ')).toEqual(['a']);
        expect(pushHistory(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    });

    it('removeHistoryItem / nextSuggestionIndex', () => {
        expect(removeHistoryItem(['a', 'b'], 'a')).toEqual(['b']);
        expect(nextSuggestionIndex(0, -1, 1)).toBe(-1);
        expect(nextSuggestionIndex(3, -1, 1)).toBe(0); // ↓ 从无到第一
        expect(nextSuggestionIndex(3, -1, -1)).toBe(2); // ↑ 从无到末尾
        expect(nextSuggestionIndex(3, 2, 1)).toBe(0); // 回绕
    });
});

/* ------------------------------------------------------------------ *
 * H5
 * ------------------------------------------------------------------ */

describe('h5 mode', () => {
    it('内联搜索条为只读，聚焦才展开全屏搜索页', () => {
        render(<Search forceMode="mobile" suggestions={HOT_WORDS} />);

        // 未展开：没有全屏页
        expect(fullInput()).toBeNull();
        expect(inlineInput()).toHaveAttribute('readonly');

        fireEvent.focus(inlineInput());
        expect(fullInput()).not.toBeNull();
    });

    it('无关键词且有历史时展示历史区，点历史即提交并收起', async () => {
        const onSearch = vi.fn();
        render(
            <Search
                forceMode="mobile"
                onSearch={onSearch}
                history={['西瓜', '草莓']}
            />,
        );

        fireEvent.focus(inlineInput());
        const rows = historyRows();
        expect(rows).toHaveLength(2);

        fireEvent.click(rows[0]);
        expect(onSearch).toHaveBeenCalledWith('西瓜');
        // 提交后收起全屏页（Popup 两阶段退出，卸载需等动画定时器）
        await waitFor(() => expect(fullInput()).toBeNull());
    });

    it('有关键词时切到建议列表；无历史则空关键词直接给建议', () => {
        render(<Search forceMode="mobile" suggestions={HOT_WORDS} history={['西瓜']} />);
        fireEvent.focus(inlineInput());

        // 空关键词 + 有历史 → 历史区
        expect(historyRows()).toHaveLength(1);
        expect(suggestionRows()).toHaveLength(0);

        // 输入关键词 → 切建议
        fireEvent.change(fullInput()!, { target: { value: '苹' } });
        expect(historyRows()).toHaveLength(0);
        const rows = suggestionRows();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent('苹果');
    });

    it('返回键退出且不提交', async () => {
        const onSearch = vi.fn();
        render(<Search forceMode="mobile" onSearch={onSearch} suggestions={HOT_WORDS} />);
        fireEvent.focus(inlineInput());
        expect(fullInput()).not.toBeNull();

        fireEvent.click(screen.getByRole('button', { name: '返回' }));
        await waitFor(() => expect(fullInput()).toBeNull());
        expect(onSearch).not.toHaveBeenCalled();
    });

    it('提交写历史：受控历史被去重前置', () => {
        const onHistoryChange = vi.fn();
        const onSearch = vi.fn();
        render(
            <Search
                forceMode="mobile"
                history={['西瓜']}
                onHistoryChange={onHistoryChange}
                onSearch={onSearch}
            />,
        );
        fireEvent.focus(inlineInput());
        fireEvent.change(fullInput()!, { target: { value: ' 草莓 ' } });
        fireEvent.keyDown(fullInput()!, { key: 'Enter' });

        expect(onSearch).toHaveBeenCalledWith('草莓');
        expect(onHistoryChange).toHaveBeenCalledWith(['草莓', '西瓜']);
    });
});

/* ------------------------------------------------------------------ *
 * PC
 * ------------------------------------------------------------------ */

describe('pc mode', () => {
    it('内联输入框聚焦（有热词）浮出建议浮层，不出现全屏页/历史', () => {
        render(<Search forceMode="desktop" suggestions={HOT_WORDS} history={['西瓜']} />);

        expect(panel()).toBeNull();
        fireEvent.focus(pcInput());

        expect(panel()).not.toBeNull();
        expect(suggestionRows()).toHaveLength(3);
        // PC 无历史区
        expect(historyRows()).toHaveLength(0);
        expect(fullInput()).toBeNull();
    });

    it('输入关键词过滤建议；↑↓ 巡航、Enter 选中激活项', () => {
        const onSearch = vi.fn();
        render(<Search forceMode="desktop" suggestions={HOT_WORDS} onSearch={onSearch} />);

        fireEvent.focus(pcInput());
        fireEvent.change(pcInput(), { target: { value: '' } });
        expect(suggestionRows()).toHaveLength(3);

        // ↓ 落到第一条
        fireEvent.keyDown(pcInput(), { key: 'ArrowDown' });
        expect(activeRow()).toHaveTextContent('苹果');

        // Enter 选中激活项 → 提交并收起
        fireEvent.keyDown(pcInput(), { key: 'Enter' });
        expect(onSearch).toHaveBeenCalledWith('苹果');
        expect(panel()).toBeNull();
    });

    it('Esc 关闭浮层', () => {
        render(<Search forceMode="desktop" suggestions={HOT_WORDS} />);
        fireEvent.focus(pcInput());
        expect(panel()).not.toBeNull();

        fireEvent.keyDown(pcInput(), { key: 'Escape' });
        expect(panel()).toBeNull();
    });

    it('空关键词且无热词时不浮出空壳浮层', () => {
        render(<Search forceMode="desktop" />);
        fireEvent.focus(pcInput());
        expect(panel()).toBeNull();

        // 输入后才浮出（并给空态）
        fireEvent.change(pcInput(), { target: { value: 'x' } });
        expect(panel()).not.toBeNull();
    });

    it('异步建议源：debounce=0 时按关键词请求并渲染', async () => {
        const onFetch = vi.fn((kw: string) => [`远程-${kw}`]);
        render(<Search forceMode="desktop" debounce={0} onFetchSuggestions={onFetch} />);

        fireEvent.focus(pcInput());
        fireEvent.change(pcInput(), { target: { value: 'abc' } });

        await waitFor(() => expect(onFetch).toHaveBeenCalledWith('abc'));
        await waitFor(() => expect(suggestionRows()[0]).toHaveTextContent('远程-abc'));
    });
});