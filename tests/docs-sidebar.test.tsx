import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    SidebarList,
    type NavCategory,
    type NavEntry,
} from '@/apps/docs/src/components/sidebar';

/**
 * 文档站 · 侧栏导航测试
 *
 * 背景是用户反馈：侧栏（含手机抽屉）只显示英文名（Button / Slider …），
 * 中文读者扫不动。修法是每项**中文名主、英文名次**。
 *
 * 这里把守四件事：
 *   1. 中文名确实渲染出来了，而且在英文名**之前**（主标签）；
 *   2. 英文名没被删 —— 删了就再也对不上代码里的 import；
 *   3. 中文名、英文名都能用来过滤（两种查法都不能退化）；
 *   4. prop 名反查照旧（那是这个侧栏本来就有、且被依赖的能力）。
 */

const ENTRIES: NavEntry[] = [
    {
        name: 'Button',
        slug: 'button',
        title: 'Button 按钮',
        zh: '按钮',
        category: 'basic',
        summary: '按钮，用于触发一个操作',
        propNames: ['onClick', 'loading'],
    },
    {
        name: 'Slider',
        slug: 'slider',
        title: 'Slider 滑块',
        zh: '滑块',
        category: 'form',
        summary: '滑动选择一个数值',
        propNames: ['onChange', 'range'],
    },
];

const CATEGORIES: NavCategory[] = [
    { id: 'basic', title: '基础' },
    { id: 'form', title: '表单' },
];

function setup() {
    const onNavigate = vi.fn();
    render(
        <SidebarList
            categories={CATEGORIES}
            entries={ENTRIES}
            current=""
            onNavigate={onNavigate}
        />,
    );
    return { onNavigate };
}

describe('文档站 · 侧栏导航', () => {
    it('中文名是主标签，且排在英文名前面', () => {
        setup();
        const slider = screen.getByTitle('滑动选择一个数值');
        // 主标签 = 按钮里第一个 span。视觉顺序与 DOM 顺序一致（flex 行）。
        expect(slider.querySelector('span')?.textContent).toBe('滑块');
        expect(slider.textContent?.startsWith('滑块')).toBe(true);
    });

    it('英文名仍然在，只是退为次级', () => {
        setup();
        // 删了英文名，读者就再也对不上代码里的 import { Slider }
        expect(screen.getByText('Slider')).toBeInTheDocument();
        expect(screen.getByText('Button')).toBeInTheDocument();
    });

    it('用中文名能过滤出对应组件', () => {
        setup();
        fireEvent.change(screen.getByLabelText('过滤组件或属性'), {
            target: { value: '滑块' },
        });
        expect(screen.getByTitle('滑动选择一个数值')).toBeInTheDocument();
        expect(screen.queryByTitle('按钮，用于触发一个操作')).toBeNull();
    });

    it('用英文名照样能过滤（不能因为加了中文就退化）', () => {
        setup();
        fireEvent.change(screen.getByLabelText('过滤组件或属性'), {
            target: { value: 'button' },
        });
        expect(screen.getByTitle('按钮，用于触发一个操作')).toBeInTheDocument();
        expect(screen.queryByTitle('滑动选择一个数值')).toBeNull();
    });

    it('prop 名反查照旧，且把命中的 prop 显示出来', () => {
        setup();
        fireEvent.change(screen.getByLabelText('过滤组件或属性'), {
            target: { value: 'range' },
        });
        const slider = screen.getByTitle('滑动选择一个数值');
        expect(slider.textContent).toContain('range');
        expect(screen.queryByTitle('按钮，用于触发一个操作')).toBeNull();
    });

    it('点哪一项就导航到哪个 slug', () => {
        const { onNavigate } = setup();
        fireEvent.click(screen.getByTitle('滑动选择一个数值'));
        expect(onNavigate).toHaveBeenCalledWith('slider');
    });

    it('当前项高亮（中文名也不能把高亮弄丢）', () => {
        render(
            <SidebarList
                categories={CATEGORIES}
                entries={ENTRIES}
                current="slider"
                onNavigate={vi.fn()}
            />,
        );
        expect(screen.getByTitle('滑动选择一个数值').className).toContain(
            'bg-bv-primary',
        );
        expect(screen.getByTitle('按钮，用于触发一个操作').className).not.toContain(
            'bg-bv-primary',
        );
    });
});
