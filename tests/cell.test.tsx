import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Cell, CellGroup } from '@/components/ui/cell';

describe('Cell / CellGroup（对齐 Vant）', () => {
  it('渲染标题与右侧内容', () => {
    render(<Cell title="单元格" value="内容" />);
    expect(screen.getByText('单元格')).toBeInTheDocument();
    expect(screen.getByText('内容')).toBeInTheDocument();
  });

  it('label 使用次文本 token（gray-6）', () => {
    render(<Cell title="标题" label="描述信息" />);
    const label = screen.getByText('描述信息');
    expect(label).toHaveAttribute('data-slot', 'cell-label');
    expect(label).toHaveClass('text-bv-text-2');
  });

  it('传 onClick 即视为可点击：带 role=button 与点击反馈', async () => {
    const onClick = vi.fn();
    render(<Cell title="点击项" onClick={onClick} />);

    const cell = screen.getByRole('button');
    expect(cell).toHaveAttribute('data-clickable', 'true');
    expect(cell).toHaveClass('active:bg-bv-active');

    await userEvent.click(cell);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('isLink 默认渲染右侧箭头图标', () => {
    render(<Cell title="链接" isLink />);
    const icon = screen.getByRole('button').querySelector('[data-slot="cell-right-icon"] svg');
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute('data-slot', 'icon');
  });

  it('border=false 时不渲染下边框（data-border="false"）', () => {
    render(<Cell title="无边框" border={false} />);
    const cell = screen.getByText('无边框').closest('[data-slot="cell"]');
    expect(cell).toHaveAttribute('data-border', 'false');
    expect(cell?.className).not.toContain('bv-hairline');
  });

  it('CellGroup 支持标题与 inset 卡片模式', () => {
    render(
      <CellGroup title="分组标题" inset>
        <Cell title="子项" />
      </CellGroup>,
    );

    const group = screen.getByText('子项').closest('[data-slot="cell-group"]');
    expect(screen.getByText('分组标题')).toHaveAttribute('data-slot', 'cell-group-title');
    expect(group).toHaveAttribute('data-inset', 'true');
    expect(group).toHaveClass('rounded-bv-lg');
  });
});
