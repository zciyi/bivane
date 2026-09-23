import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/components/ui/tag';

describe('Tag（对齐 Vant Tag）', () => {
  it('默认类型使用 gray-6 底色', () => {
    render(<Tag>标签</Tag>);
    expect(screen.getByText('标签')).toHaveClass('bg-bv-gray-6');
  });

  it('size=large 使用 large padding 与 md 字号', () => {
    render(<Tag size="large">大标签</Tag>);
    const tag = screen.getByText('大标签');
    expect(tag.className).toContain('px-[var(--bv-tag-large-padding-x)]');
    expect(tag).toHaveClass('text-bv-md');
  });

  it('closeable 渲染关闭图标并触发 onClose', async () => {
    const onClose = vi.fn();
    render(<Tag closeable onClose={onClose}>可关闭</Tag>);

    const icon = document.querySelector('[data-slot="icon"]');
    expect(icon).not.toBeNull();

    await userEvent.click(icon as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('自定义 color 覆盖 token（动态值允许内联 style）', () => {
    render(<Tag color="#000">自定义</Tag>);
    expect(screen.getByText('自定义')).toHaveStyle({ background: 'rgb(0, 0, 0)' });
  });
});

describe('Badge（对齐 Vant Badge）', () => {
  it('超过 max 显示 max+', () => {
    render(<Badge content={100} max={99} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('content=0 默认不展示，showZero 时展示', () => {
    const { rerender, container } = render(<Badge content={0} />);
    expect(container.querySelector('[data-slot="badge"]')).toHaveClass('hidden');

    rerender(<Badge content={0} showZero />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('dot 模式渲染小圆点且不带内容', () => {
    render(<Badge dot />);
    const badge = document.querySelector('[data-slot="badge"]');
    expect(badge).toHaveAttribute('data-dot', 'true');
    expect(badge?.textContent).toBe('');
  });

  it('有 children 时包裹并绝对定位', () => {
    render(
      <Badge content={5}>
        <span>消息</span>
      </Badge>,
    );

    const wrapper = document.querySelector('[data-slot="badge-wrapper"]');
    expect(wrapper).not.toBeNull();
    expect(screen.getByText('5')).toHaveAttribute('data-position', 'top-right');
  });
});
