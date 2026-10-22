import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandPalette } from '@/apps/docs/src/components/command-palette';
import type { SearchDoc } from '@/apps/docs/src/search-index';

/**
 * 文档站 · 全局搜索面板测试
 *
 * 核心用例是「↓ 高亮的那一条，就是 Enter 打开的那一条」——
 * 这是真机踩出来的坑：面板曾按 **kind 分组**渲染（组件→示例→属性），
 * 而 Enter 取的是**打分顺序**的数组。两者一旦不一致，现象是
 * 「按一次 ↓ 高亮『基础滑块』，回车却跳到 Rate 的 ariaLabel」。
 * 界面看着完全正常，只有回车那一刻才发现跳错了地方。
 *
 * 判据写「我期望什么」：高亮项与选中项必须永远指向同一条结果。
 */

/** 一条文档的主标签（与组件里的 labels() 一致，用于把 doc 对回 DOM） */
function mainLabel(doc: SearchDoc): string {
    if (doc.kind === 'component') return doc.zh;
    if (doc.kind === 'example') return doc.title;
    return doc.propName ?? doc.title;
}

const DOCS: SearchDoc[] = [
    {
        kind: 'component',
        slug: 'slider',
        name: 'Slider',
        zh: '滑块',
        title: 'Slider 滑块',
        desc: '单值/区间滑块',
        seq: 0,
    },
    // 只在说明里提到 slider 的属性 —— 排序不能让它插到 Slider 示例前面
    {
        kind: 'prop',
        slug: 'rate',
        name: 'Rate',
        zh: '评分',
        title: 'ariaLabel',
        desc: '无障碍标签（渲染到 role="slider" 容器上）',
        propName: 'ariaLabel',
        propKind: 'prop',
        seq: 1,
    },
    {
        kind: 'example',
        slug: 'slider',
        name: 'Slider',
        zh: '滑块',
        title: '基础滑块',
        desc: '单值滑块的受控用法',
        exampleId: 'SliderExample1',
        seq: 2,
    },
    {
        kind: 'example',
        slug: 'slider',
        name: 'Slider',
        zh: '滑块',
        title: '区间滑块',
        desc: 'range 模式选出一个区间',
        exampleId: 'SliderExample2',
        seq: 3,
    },
];

function setup(docs: SearchDoc[] = DOCS) {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
        <CommandPalette
            docs={docs}
            open
            onClose={onClose}
            onSelect={onSelect}
        />,
    );
    const input = screen.getByLabelText('搜组件、示例或属性');
    const options = () => screen.getAllByRole('option');
    const activeIndex = () =>
        options().findIndex(
            (o) => o.getAttribute('aria-selected') === 'true',
        );
    /** 把一条 doc 对回它在结果列表里的下标（-1 = 没渲染） */
    const indexOfDoc = (doc: SearchDoc) =>
        options().findIndex((o) => o.textContent?.includes(mainLabel(doc)));
    return { onSelect, onClose, input, options, activeIndex, indexOfDoc };
}

describe('文档站 · 搜索面板', () => {
    it('空查询时给的是指引，不是一屏结果', () => {
        setup();
        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(
            screen.getByText(/输入组件名、示例标题或属性名/),
        ).toBeInTheDocument();
    });

    it('输入后按打分顺序出结果', () => {
        const { input, options } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        const texts = options().map((o) => o.textContent);
        // 组件名精确命中第一；Slider 的两个示例紧随其后；
        // 只在说明里提到 slider 的 Rate.ariaLabel 排在最后
        expect(texts[0]).toContain('Slider');
        expect(texts[1]).toContain('基础滑块');
        expect(texts[2]).toContain('区间滑块');
        expect(texts[3]).toContain('ariaLabel');
    });

    it('组件行中文名是主标签，英文名退为次级', () => {
        // 中文读者扫的是「滑块」；英文名留着只为了和 import 对应
        const { input, options } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        expect(options()[0].textContent).toContain('滑块');
        expect(options()[0].textContent).toContain('Slider · 组件');
    });

    it('↓ 高亮的那一条，就是 Enter 打开的那一条', () => {
        const { input, options, activeIndex, indexOfDoc, onSelect } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });

        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const highlighted = activeIndex();
        expect(highlighted).toBe(1);
        expect(options()[highlighted].textContent).toContain('基础滑块');

        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(indexOfDoc(onSelect.mock.calls[0][0] as SearchDoc)).toBe(
            highlighted,
        );
    });

    it('连按两次 ↓ 再回车，对得上的还是同一条', () => {
        const { input, activeIndex, indexOfDoc, onSelect } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        const highlighted = activeIndex();
        expect(highlighted).toBe(2);
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(indexOfDoc(onSelect.mock.calls[0][0] as SearchDoc)).toBe(
            highlighted,
        );
    });

    it('↑ 能往回走，且不越界', () => {
        const { input, activeIndex } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(activeIndex()).toBe(3); // 从 0 往上绕到最后一条
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(activeIndex()).toBe(0);
    });

    it('点哪一条就打开哪一条', () => {
        const { input, options, onSelect } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        fireEvent.click(options()[2]);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(
            (onSelect.mock.calls[0][0] as SearchDoc).exampleId,
        ).toBe('SliderExample2');
    });

    it('Esc 关闭；选完也关闭', () => {
        const { input, onClose, onSelect } = setup();
        fireEvent.change(input, { target: { value: 'slider' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('搜不到时说清楚，不猜', () => {
        const { input } = setup();
        fireEvent.change(input, { target: { value: 'zzz-没有这个' } });
        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect(screen.getByText(/没有匹配/)).toBeInTheDocument();
    });
});
