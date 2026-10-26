import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Select } from '@/components/responsive/select';
import type { SelectItem } from '@/hooks/use-select-state';

/**
 * Select 双模式行为测试（矩阵 §4 要求：h5 / pc 各一组）
 *
 * 重点不是「渲染出来了」，而是两端确实是两套交互范式：
 *   - 容器：H5 走 Popup 的底部弹层 vs PC 走 Radix 的锚定浮层（PC 下不该出现 popup 槽）
 *   - 选法：H5 靠点击热区 vs PC 靠键盘巡航（↑↓ / Home / End / Enter / Esc）
 *   - 搜索阈值：H5 选项 > 10 才给搜索框 vs PC 只要 searchable 就给
 *   - 焦点：PC 关闭后必须归还给触发器
 * 而「值语义」两端完全一致：单选取代、多选翻转、多选不关闭。
 *
 * 注：H5Select / PcSelect 经 React.lazy 异步加载，故所有断言改用 findBy* + await
 * 等待 Suspense 解析（首帧为 fallback=null）。
 */

const OPTIONS: SelectItem[] = [
  { label: '北京', value: 'bj' },
  { label: '上海', value: 'sh' },
  { label: '广州', value: 'gz' },
  { label: '深圳', value: 'sz', disabled: true },
  { label: '杭州', value: 'hz' },
];

/** 12 个选项：用于验证 H5 的「选项 > 10 才显示搜索框」阈值 */
const MANY: SelectItem[] = Array.from({ length: 12 }, (_, index) => ({
  label: `选项 ${index + 1}`,
  value: index + 1,
}));

async function trigger(): Promise<HTMLElement> {
  return screen.findByRole('combobox');
}

function panel(): HTMLElement | null {
  return document.querySelector('[data-slot="select-panel"]') as HTMLElement | null;
}

function activeRow(): HTMLElement | null {
  return document.querySelector('[data-slot="select-option"][data-active="true"]');
}

describe('h5 mode', () => {
  it('触发器自带 data-mode="h5"，未展开时不渲染列表', async () => {
    render(<Select options={OPTIONS} forceMode="mobile" ariaLabel="城市" />);

    expect(await trigger()).toHaveAttribute('data-mode', 'h5');
    expect(await trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(await trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(await screen.findByText('请选择')).toBeInTheDocument();
  });

  it('点击后走 Popup 的底部弹层形态（不是锚定浮层）', async () => {
    render(<Select options={OPTIONS} forceMode="mobile" />);
    fireEvent.click(await trigger());

    expect(await trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(await screen.findAllByRole('option')).toHaveLength(5);
    // 与 PC 的分野：H5 复用 popup 地基，PC 完全不经过它
    expect(document.querySelector('[data-slot="popup"]')).toHaveAttribute(
      'data-position-resolved',
      'bottom',
    );
    expect(panel()).toBeNull();
  });

  it('点选后回调单值，且单选即关', async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} forceMode="mobile" onChange={onChange} />);
    fireEvent.click(await trigger());
    fireEvent.click(await screen.findByRole('option', { name: '上海' }));

    expect(onChange).toHaveBeenCalledWith('sh');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('disabled 选项点不动（select() 内部也有一道守卫）', async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} forceMode="mobile" onChange={onChange} />);
    fireEvent.click(await trigger());
    fireEvent.click(await screen.findByRole('option', { name: '深圳' }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('选项 ≤ 10 不显示搜索框，> 10 才出现（矩阵 §2.2）', async () => {
    const few = render(<Select options={OPTIONS} searchable forceMode="mobile" />);
    fireEvent.click(await trigger());
    expect(screen.queryByRole('searchbox')).toBeNull();
    few.unmount();

    render(<Select options={MANY} searchable forceMode="mobile" />);
    fireEvent.click(await trigger());
    expect(await screen.findByRole('searchbox')).toBeInTheDocument();
  });

  it('多选：选中后浮层保持展开', async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} multiple forceMode="mobile" onChange={onChange} />);
    fireEvent.click(await trigger());
    fireEvent.click(await screen.findByRole('option', { name: '上海' }));

    expect(onChange).toHaveBeenCalledWith(['sh']);
    expect(await screen.findByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  it('confirmable：暂存确认 —— 点选项只改面板里的勾，「确定」才回填关闭，「取消」放弃', async () => {
    const onChange = vi.fn();
    render(
      <Select
        options={OPTIONS}
        forceMode="mobile"
        ariaLabel="城市"
        title="选择城市"
        confirmable
        defaultValue="bj"
        onChange={onChange}
      />,
    );
    fireEvent.click(await trigger());

    // 工具栏三件套：取消 + 标题 + 确定（共享零件 PanelHeader 的槽）
    expect(document.querySelector('[data-slot="panel-header-cancel"]')).not.toBeNull();
    expect(document.querySelector('[data-slot="panel-header-title"]')?.textContent).toBe(
      '选择城市',
    );
    expect(document.querySelector('[data-slot="panel-header-confirm"]')).not.toBeNull();

    // 点「上海」：只动草稿 —— 不触发 onChange、不关闭、触发器回填仍是已提交值
    fireEvent.click(await screen.findByRole('option', { name: '上海' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect((await trigger()).textContent).toContain('北京');

    // 「取消」：丢弃草稿关闭，值不变
    fireEvent.click(document.querySelector('[data-slot="panel-header-cancel"]') as HTMLElement);
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect(onChange).not.toHaveBeenCalled();

    // 重新打开 → 点「确定」才提交
    fireEvent.click(await trigger());
    fireEvent.click(await screen.findByRole('option', { name: '上海' }));
    fireEvent.click(document.querySelector('[data-slot="panel-header-confirm"]') as HTMLElement);
    expect(onChange).toHaveBeenCalledWith('sh');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
    expect((await trigger()).textContent).toContain('上海');
  });
});

describe('pc mode', () => {
  it('触发器自带 data-mode="pc"', async () => {
    render(<Select options={OPTIONS} forceMode="desktop" />);
    expect(await trigger()).toHaveAttribute('data-mode', 'pc');
  });

  it('点击后渲染锚定浮层（不出现 popup 槽）', async () => {
    render(<Select options={OPTIONS} forceMode="desktop" />);
    fireEvent.click(await trigger());

    expect(panel()).not.toBeNull();
    expect(panel()).toHaveAttribute('data-mode', 'pc');
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    expect(await screen.findAllByRole('option')).toHaveLength(5);
  });

  it('confirmable / title 在 PC 下不渲染工具栏：点选即生效，没有「确定」这一步', async () => {
    const onChange = vi.fn();
    render(
      <Select
        options={OPTIONS}
        forceMode="desktop"
        ariaLabel="城市"
        title="选择城市"
        confirmable
        onChange={onChange}
      />,
    );
    fireEvent.click(await trigger());

    expect(document.querySelector('[data-slot="panel-header"]')).toBeNull();

    fireEvent.click(await screen.findByRole('option', { name: '上海' }));
    expect(onChange).toHaveBeenCalledWith('sh');
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('展开时键盘落点优先落在已选项', async () => {
    render(<Select options={OPTIONS} defaultValue="gz" forceMode="desktop" />);
    fireEvent.click(await trigger());
    expect(activeRow()).toHaveAttribute('data-value', 'gz');
  });

  it('↑↓ 巡航跳过 disabled 项并回绕', async () => {
    render(<Select options={OPTIONS} forceMode="desktop" />);
    fireEvent.click(await trigger());

    expect(activeRow()).toHaveAttribute('data-value', 'bj');

    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    expect(activeRow()).toHaveAttribute('data-value', 'sh');

    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    expect(activeRow()).toHaveAttribute('data-value', 'gz');

    // 深圳（disabled）被跳过，直接落到杭州
    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    expect(activeRow()).toHaveAttribute('data-value', 'hz');

    // 末尾回绕到第一个可选项
    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    expect(activeRow()).toHaveAttribute('data-value', 'bj');

    // 向上同样跳过 disabled，落到广州
    fireEvent.keyDown(panel()!, { key: 'ArrowUp' });
    expect(activeRow()).toHaveAttribute('data-value', 'hz');
    fireEvent.keyDown(panel()!, { key: 'ArrowUp' });
    expect(activeRow()).toHaveAttribute('data-value', 'gz');
  });

  it('Home / End 落到首尾可选项', async () => {
    render(<Select options={OPTIONS} forceMode="desktop" />);
    fireEvent.click(await trigger());

    fireEvent.keyDown(panel()!, { key: 'End' });
    expect(activeRow()).toHaveAttribute('data-value', 'hz');

    fireEvent.keyDown(panel()!, { key: 'Home' });
    expect(activeRow()).toHaveAttribute('data-value', 'bj');
  });

  it('Enter 选中当前激活项', async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} forceMode="desktop" onChange={onChange} />);
    fireEvent.click(await trigger());

    fireEvent.keyDown(panel()!, { key: 'ArrowDown' });
    fireEvent.keyDown(panel()!, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('sh');
  });

  it('输入过滤：PC 的 searchable 不设数量阈值（桌面端输入是主路径）', async () => {
    render(<Select options={OPTIONS} searchable forceMode="desktop" />);
    fireEvent.click(await trigger());

    const search = await screen.findByRole('searchbox');
    fireEvent.change(search, { target: { value: '杭' } });

    expect(await screen.findAllByRole('option')).toHaveLength(1);
    expect(await screen.findByRole('option', { name: '杭州' })).toBeInTheDocument();
  });

  it('过滤无结果时展示空态', async () => {
    render(<Select options={OPTIONS} searchable emptyText="没有匹配项" forceMode="desktop" />);
    fireEvent.click(await trigger());
    fireEvent.change(await screen.findByRole('searchbox'), { target: { value: '成都' } });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(await screen.findByText('没有匹配项')).toBeInTheDocument();
  });

  it('Esc 关闭并把焦点归还触发器（契约第 5 条）', async () => {
    render(<Select options={OPTIONS} forceMode="desktop" />);
    fireEvent.click(await trigger());
    expect(panel()).not.toBeNull();

    fireEvent.keyDown(panel()!, { key: 'Escape' });

    await waitFor(() => expect(panel()).toBeNull());
    expect(document.activeElement).toBe(await trigger());
  });
});

describe('双模式一致：值语义不随模式变化', () => {
  it('同一组 props 两端都能渲染，交互差异不通过 props 泄露', async () => {
    const shared = {
      options: OPTIONS,
      placeholder: '选一个',
      clearable: true,
      multiple: true,
    };

    const mobile = render(<Select {...shared} forceMode="mobile" />);
    expect(await trigger()).toHaveAttribute('data-mode', 'h5');
    mobile.unmount();

    render(<Select {...shared} forceMode="desktop" />);
    expect(await trigger()).toHaveAttribute('data-mode', 'pc');
  });

  it('多选回显为顿号连接，两端同源（由分发层算好）', async () => {
    // 文案被顿号分隔成多个节点，用 textContent 断言拼接结果，
    // 顺带把分隔符本身也钉住
    const triggerValue = () => document.querySelector('[data-slot="select-trigger-value"]');

    const { unmount } = render(
      <Select options={OPTIONS} multiple defaultValue={['bj', 'sh']} forceMode="mobile" />,
    );
    await trigger();
    expect(triggerValue()?.textContent).toBe('北京、上海');
    unmount();

    render(<Select options={OPTIONS} multiple defaultValue={['bj', 'sh']} forceMode="desktop" />);
    await trigger();
    expect(triggerValue()?.textContent).toBe('北京、上海');
  });

  it('clearable 只在有选中值且未禁用时出现，点击清空', async () => {
    const onChange = vi.fn();
    render(
      <Select
        options={OPTIONS}
        defaultValue="bj"
        clearable
        forceMode="mobile"
        onChange={onChange}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: '清除' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disabled 时触发器不可聚焦且不展开', async () => {
    render(<Select options={OPTIONS} disabled forceMode="mobile" />);

    expect(await trigger()).toHaveAttribute('tabindex', '-1');
    fireEvent.click(await trigger());
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
