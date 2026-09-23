import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Cell } from '@/components/ui/cell';
import { Tag, tagVariants } from '@/components/ui/tag';
import { cn } from '@/lib/utils';

/**
 * 样式契约测试（cn 层）
 *
 * 这些约束来自两次真实踩坑，都属于「token 写了但没生效」的静默失败：
 *
 * 1) 内边距：Vant 的 padding token 是简写（`0 15px`），若组件侧用
 *    `[padding:var(--x)]` 任意属性消费，它不参与 tailwind-merge 的冲突消解，
 *    会被同元素上的 `p-0` 覆盖 → 按钮左右内边距归零、文字贴边。
 *    约定：需要区分方向的 padding 一律拆成 `-padding-x` / `-padding-y` 分量，
 *    组件只用 `px-[...]` / `py-[...]` 消费。
 *
 * 2) 行高：tailwind-merge 的 `font-size` 组与 `leading` 组冲突（因为 Tailwind 的
 *    `text-*` 自带 line-height）。若 `text-bv-*` 写在 `leading-*` 之后，
 *    `leading-*` 会被删除，行高静默退回 @theme 的 `--text-bv-*-line-height`。
 *    约定：字号在前、行高在后。
 */

/** 取某条轴上的内边距工具类（经 cn 消解后，正常每轴只剩 1 个） */
function paddingOf(cls: string, axis: 'p' | 'px' | 'py'): string[] {
  return cls.split(/\s+/).filter((c) => c.startsWith(`${axis}-`));
}

/** 断言 leading-* 存活，且排在所有 font-size 类之后 */
function expectLeadingSurvives(cls: string, label: string): void {
  const leadings = [...cls.matchAll(/leading-\[[^\]]*\]/g)];
  expect(leadings.length, `${label}: leading 类被 tailwind-merge 删除了`).toBeGreaterThan(0);

  const lastFontSize = [...cls.matchAll(/text-bv-(?:xs|sm|md|lg)(?![\w-])/g)].pop();
  if (lastFontSize) {
    const last = leadings[leadings.length - 1];
    expect(last.index, `${label}: leading 必须写在 font-size 类之后`).toBeGreaterThan(
      lastFontSize.index,
    );
  }
}

describe('内边距契约：token 必须能被 tailwind-merge 正确消解', () => {
  it('Button 默认（normal）左右内边距取 15px 分量 token，且不被清零', () => {
    const cls = cn(buttonVariants({ type: 'primary' }));
    expect(paddingOf(cls, 'px')).toEqual(['px-[var(--bv-button-normal-padding-x)]']);
    // 裸 p-0 会清掉左右内边距（历史 bug），必须不存在
    expect(cls).not.toMatch(/(^|\s)p-0(\s|$)/);
  });

  it('Button 上下内边距恒为 0（Vant 三种尺寸都是 `0 <x>`）', () => {
    for (const size of ['large', 'normal', 'small', 'mini'] as const) {
      expect(paddingOf(cn(buttonVariants({ size })), 'py'), `size=${size}`).toEqual(['py-0']);
    }
  });

  it('Button 各尺寸左右内边距唯一，不存在 base 与 size 并存', () => {
    expect(paddingOf(cn(buttonVariants({ size: 'large' })), 'px')).toEqual(['px-0']);
    expect(paddingOf(cn(buttonVariants({ size: 'small' })), 'px')).toEqual([
      'px-[var(--bv-button-small-padding-x)]',
    ]);
    expect(paddingOf(cn(buttonVariants({ size: 'mini' })), 'px')).toEqual([
      'px-[var(--bv-button-mini-padding-x)]',
    ]);
  });

  it('Tag 的 size 变体能覆盖 base 的 px / py', () => {
    const medium = cn(tagVariants({ size: 'medium' }));
    expect(paddingOf(medium, 'px')).toEqual(['px-[var(--bv-tag-medium-padding-x)]']);
    expect(paddingOf(medium, 'py')).toEqual(['py-[var(--bv-tag-medium-padding-y)]']);

    const large = cn(tagVariants({ size: 'large' }));
    expect(paddingOf(large, 'px')).toEqual(['px-[var(--bv-tag-large-padding-x)]']);
    expect(paddingOf(large, 'py')).toEqual(['py-[var(--bv-tag-large-padding-y)]']);
  });

  it('外部 className 可覆盖组件内边距（逃生通道有效）', () => {
    expect(paddingOf(cn(buttonVariants({ size: 'normal' }), 'px-0'), 'px')).toEqual(['px-0']);
    expect(paddingOf(cn(buttonVariants({ size: 'normal' }), 'px-8'), 'px')).toEqual(['px-8']);
  });

  // 源码级门禁：未来新增组件时，禁止再用不参与合并消解的任意属性写法。
  it('组件源码禁止 [padding:] / [margin:] 任意属性写法，一律走 px-/py- 轴前缀', () => {
    const dir = join(process.cwd(), 'components', 'ui');
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith('.tsx'))
      .filter((f) => /\[(padding|margin):/.test(readFileSync(join(dir, f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});

describe('行高契约：leading-* 必须存活且晚于 font-size', () => {
  it('Button 各尺寸都保留 Vant 行高 token（1.2）', () => {
    for (const size of ['large', 'normal', 'small', 'mini'] as const) {
      expectLeadingSurvives(cn(buttonVariants({ size })), `Button size=${size}`);
    }
  });

  it('Tag 各尺寸都保留 Vant 行高 token（16px）', () => {
    for (const size of [undefined, 'medium', 'large'] as const) {
      expectLeadingSurvives(cn(tagVariants({ type: 'primary', size })), `Tag size=${size}`);
    }
  });

  it('Badge 保留 1.2 行高（丢失会让圆形角标变高变椭圆）', () => {
    render(<Badge content={5} />);
    const el = document.querySelector('[data-slot="badge"]');
    expectLeadingSurvives(el?.className ?? '', 'Badge');
  });

  it('Button / Tag / Cell 渲染后 leading 类均在元素上生效', () => {
    const { unmount } = render(<Button>按钮</Button>);
    expectLeadingSurvives(
      document.querySelector('[data-slot="button"]')?.className ?? '',
      'Button 渲染',
    );
    unmount();

    const tag = render(<Tag>标签</Tag>);
    expectLeadingSurvives(document.querySelector('[data-slot="tag"]')?.className ?? '', 'Tag 渲染');
    tag.unmount();

    render(<Cell title="标题" label="描述" />);
    expectLeadingSurvives(
      document.querySelector('[data-slot="cell"]')?.className ?? '',
      'Cell 渲染',
    );
  });
});
