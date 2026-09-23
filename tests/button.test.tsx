import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';

describe('Button（对齐 Vant Button 契约）', () => {
  it('渲染根契约属性：data-slot="button"', () => {
    render(<Button>提交</Button>);
    const btn = screen.getByRole('button', { name: '提交' });
    expect(btn).toHaveAttribute('data-slot', 'button');
    expect(btn).toHaveAttribute('data-type', 'default');
  });

  it('type 变体映射到对应 token 类', () => {
    render(<Button type="primary">确定</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-bv-primary');
  });

  it('plain 模式回落类型主色并改用 plain 背景 token', () => {
    render(
      <Button type="danger" plain>
        删除
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('text-bv-danger');
    expect(btn.className).toContain('var(--bv-button-plain-background)');
  });

  it('loading 时展示加载图标、按钮禁用且不接受点击', async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingText="提交中" onClick={onClick}>
        提交
      </Button>,
    );

    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-loading', 'true');
    expect(screen.getByText('提交中')).toBeInTheDocument();

    await userEvent.click(btn, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('size=small 使用 Vant 小号尺寸 token', () => {
    render(<Button size="small">小</Button>);
    expect(screen.getByRole('button').className).toContain('var(--bv-button-small-height)');
  });

  // 回归：Vant Button 的 size 默认值是 'normal'（Button.tsx: makeStringProp<ButtonSize>('normal')），
  // 一旦退化成 base（16px 字 / padding 0），按钮文字会贴边，整页间距看起来发挤。
  // 注意 token 用 -padding-x 分量：简写 token + [padding:...] 会被 py-0/p-0 覆盖（见 spacing-contract 测试）。
  it('不传 size 时默认等同 Vant 的 normal：14px 字 + 0 15px padding，且不占满宽度', () => {
    render(<Button>默认</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('px-[var(--bv-button-normal-padding-x)]');
    expect(btn).toHaveClass('text-bv-md');
    expect(btn).not.toHaveClass('w-full');
  });

  it('size=large 才占满宽度并使用 large 高度 token', () => {
    render(<Button size="large">大号</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('w-full');
    expect(btn.className).toContain('var(--bv-button-large-height)');
  });

  it('nativeType 映射到原生 type，默认 button（避免表单误提交）', () => {
    render(<Button>默认</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');

    render(<Button nativeType="submit">提交表单</Button>);
    expect(screen.getByRole('button', { name: '提交表单' })).toHaveAttribute('type', 'submit');
  });

  it('className 透传且可被 tailwind-merge 覆盖', () => {
    render(<Button className="rounded-none">直角</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('rounded-none');
    expect(btn).not.toHaveClass('rounded-bv-md');
  });
});
