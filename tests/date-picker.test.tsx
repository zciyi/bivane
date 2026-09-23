import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from '@/components/responsive/date-picker';
import { DropdownMenu } from '@/components/responsive/dropdown-menu';

/**
 * DatePicker 双模式行为测试（矩阵 §4 要求：h5 / pc 各一组「选值 + 边界」）
 *
 * 重点不是「渲染出来了」，而是两端确实是两套交互范式：
 *   - 容器：H5 走 Popup 的底部弹层 vs PC 走 Radix 的锚定浮层（PC 下不该出现 popup 槽）
 *   - 选法：H5 靠滚轮点选 + 工具栏「确定」暂存 vs PC 靠月历点选即生效 / 键盘巡航
 *   - 区间：H5 用「开始/结束」两段式 vs PC 用并排双月
 *   - 输入：只有 PC 的触发器是可输入框
 *
 * 所有用例都显式给 min/max 与 defaultValue，**不依赖运行当天的日期** ——
 * 否则这类测试会在跨年或月末自己变红。
 *
 * 滚轮的真实滚动在 jsdom 里不会发生（不做布局），因此 H5 的「选值」路径统一走
 * 「点某一行」；「滚到哪停在哪个值」由 tests/date-value.test.ts 的纯函数覆盖。
 */

const MIN = '2020-01-01';
const MAX = '2030-12-31';
const RANGE_VALUE: [string, string] = ['2026-09-10', '2026-09-12'];

function trigger(): HTMLElement {
  // 触发器外层就是 combobox 角色（可输入形态下输入框在它内部）
  return screen.getByRole('combobox');
}

function input(): HTMLInputElement {
  return document.querySelector('[data-slot="date-picker-trigger-input"]') as HTMLInputElement;
}

function panel(): HTMLElement | null {
  return document.querySelector('[data-slot="date-picker-panel"]');
}

function wheels(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-slot="date-picker-wheel"]'));
}

/** 滚轮每点一次都可能有联动重建，因此每次都重新取 DOM，不缓存节点 */
function clickWheelOption(wheelIndex: number, name: string): void {
  const wheel = wheels()[wheelIndex];
  fireEvent.click(within(wheel).getByRole('option', { name }));
}

function confirmButton(): HTMLButtonElement {
  return document.querySelector('[data-slot="panel-header-confirm"]') as HTMLButtonElement;
}

function monthTitles(): string[] {
  return Array.from(document.querySelectorAll('[data-slot="date-picker-month-title"]')).map(
    (node) => node.textContent ?? '',
  );
}

describe('h5 mode', () => {
  it('触发器自带 data-mode="h5"，未展开时不渲染面板', () => {
    render(<DatePicker forceMode="mobile" ariaLabel="日期" />);

    expect(trigger()).toHaveAttribute('data-mode', 'h5');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(panel()).toBeNull();
    expect(screen.getByText('请选择')).toBeInTheDocument();
  });

  it('展开后走 Popup 底部弹层：三列滚轮 + 工具栏，且不经过月历', () => {
    render(<DatePicker forceMode="mobile" ariaLabel="日期" min={MIN} max={MAX} />);
    fireEvent.click(trigger());

    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(document.querySelector('[data-slot="popup"]')).toHaveAttribute(
      'data-position-resolved',
      'bottom',
    );
    expect(document.querySelector('[data-slot="panel-header"]')).toBeInTheDocument();
    expect(within(panel()!).getAllByRole('listbox')).toHaveLength(3);
    // 与 PC 的分野：H5 完全不经过 Radix 的锚定浮层
    expect(document.querySelector('[data-slot="date-picker-month-panel"]')).toBeNull();
    // H5 的触发器不是输入框（矩阵里「直接输入」只属 PC）
    expect(input()).toBeNull();
  });

  it('滚轮点选只写草稿，点「确定」才回调；关掉即丢弃', () => {
    const onChange = vi.fn();
    render(
      <DatePicker forceMode="mobile" ariaLabel="日期" min={MIN} max={MAX} onChange={onChange} />,
    );
    fireEvent.click(trigger());

    clickWheelOption(0, '2030');
    clickWheelOption(1, '05');
    clickWheelOption(2, '15');

    // 关键行为：这一天只是草稿，业务值还没动
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(confirmButton());
    expect(onChange).toHaveBeenCalledWith('2030-05-15');
  });

  it('「取消」丢弃草稿，重新打开回到已提交值', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="mobile"
        ariaLabel="日期"
        value="2026-09-20"
        min={MIN}
        max={MAX}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    clickWheelOption(0, '2030');
    fireEvent.click(document.querySelector('[data-slot="panel-header-cancel"]') as HTMLElement);
    expect(onChange).not.toHaveBeenCalled();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');

    // 重开：草稿从已提交值重新拷贝（顺带验证「打开即定位」到 2026 而不是停在 2030）
    fireEvent.click(trigger());
    const yearWheel = wheels()[0];
    expect(
      within(yearWheel).getByRole('option', { name: '2026', selected: true }),
    ).toBeInTheDocument();
  });

  it('区间模式：两段式端点切换，两端都选上「确定」才可用', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="mobile"
        ariaLabel="区间"
        type="range"
        min={MIN}
        max={MAX}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    const tabs = document.querySelector('[data-slot="date-picker-range-tabs"]') as HTMLElement;
    expect(tabs).toBeInTheDocument();
    // 三列滚轮一次只能表达一个日期，所以两端没选齐时不允许提交
    expect(confirmButton()).toBeDisabled();

    clickWheelOption(0, '2030');
    clickWheelOption(1, '05');
    clickWheelOption(2, '15');
    expect(confirmButton()).toBeDisabled();

    // 切到「结束日期」再选：此时滚轮游标应从已有的起点接上（2030-05-15）
    fireEvent.click(within(tabs).getByRole('tab', { name: '结束日期' }));
    clickWheelOption(2, '25');
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());
    expect(onChange).toHaveBeenCalledWith(['2030-05-15', '2030-05-25']);
  });

  it('区间模式：起点晚于终点时提交的是**有序**元组', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="mobile"
        ariaLabel="区间"
        type="range"
        min={MIN}
        max={MAX}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    clickWheelOption(0, '2030');
    clickWheelOption(1, '05');
    clickWheelOption(2, '25');
    fireEvent.click(
      within(document.querySelector('[data-slot="date-picker-range-tabs"]') as HTMLElement).getByRole(
        'tab',
        { name: '结束日期' },
      ),
    );
    clickWheelOption(2, '15');
    fireEvent.click(confirmButton());

    expect(onChange).toHaveBeenCalledWith(['2030-05-15', '2030-05-25']);
  });

  it('columnsType 裁剪列：只铺年月两列，回显格式跟着列走', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="mobile"
        ariaLabel="年月"
        columnsType={['year', 'month']}
        min={MIN}
        max={MAX}
        onChange={onChange}
      />,
    );
    fireEvent.click(trigger());

    expect(wheels()).toHaveLength(2);
    clickWheelOption(0, '2030');
    clickWheelOption(1, '05');
    fireEvent.click(confirmButton());

    // 默认 format 由实际列推出（'YYYY-MM'），不是硬编码的 'YYYY-MM-DD'
    expect(onChange).toHaveBeenCalledWith('2030-05');
  });

  it('clearable：有值时出现清除按钮，清除回调 undefined', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="mobile"
        ariaLabel="日期"
        value="2026-09-20"
        clearable
        onChange={onChange}
      />,
    );

    expect(screen.getByText('2026-09-20')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('清除'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('disabled：点击不展开，也不可聚焦', () => {
    render(<DatePicker forceMode="mobile" ariaLabel="日期" disabled />);
    fireEvent.click(trigger());

    expect(panel()).toBeNull();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('pc mode', () => {
  it('触发器是 pc 形态 + 可输入框；展开走锚定月历浮层（无滚轮、无工具栏）', () => {
    render(<DatePicker forceMode="desktop" ariaLabel="日期" defaultValue="2026-09-20" />);

    expect(trigger()).toHaveAttribute('data-mode', 'pc');
    expect(input()).toBeInTheDocument();
    expect(input().value).toBe('2026-09-20');

    fireEvent.focus(input());

    expect(panel()).toBeInTheDocument();
    const months = document.querySelectorAll('[data-slot="date-picker-month-panel"]');
    expect(months).toHaveLength(1);
    expect(monthTitles()[0]).toContain('2026');
    expect(monthTitles()[0]).toContain('9');
    // 与 H5 的分野：PC 不经过 Popup，也没有滚轮与「取消 · 确定」工具栏
    expect(document.querySelector('[data-slot="popup"]')).toBeNull();
    expect(wheels()).toHaveLength(0);
    expect(document.querySelector('[data-slot="panel-header"]')).toBeNull();
  });

  it('月历网格恒为 6 行 7 列，上下月补位格被标出来', () => {
    render(<DatePicker forceMode="desktop" ariaLabel="日期" defaultValue="2026-09-20" />);
    fireEvent.focus(input());

    const weeks = document.querySelectorAll('[data-slot="date-picker-week"]');
    expect(weeks).toHaveLength(6);
    expect(
      document.querySelectorAll('[data-slot="date-picker-month-panel"] [data-slot="date-picker-cell"]'),
    ).toHaveLength(42);
    expect(
      document.querySelector('[data-slot="date-picker-cell"][data-outside="true"]'),
    ).not.toBeNull();
  });

  it('columnsType=年月时回填 YYYY-MM，并渲染双年月份面板', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="年月"
        columnsType={['year', 'month']}
        defaultValue="2026-09"
        min="2025-01-01"
        max="2028-12-31"
        onChange={onChange}
      />,
    );

    expect(input().value).toBe('2026-09');
    await user.click(input());

    expect(document.querySelectorAll('[data-slot="date-picker-year-panel"]')).toHaveLength(2);
    expect(
      Array.from(document.querySelectorAll('[data-slot="date-picker-year-title"]')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['2026 年', '2027 年']);
    expect(document.querySelectorAll('[data-slot="date-picker-month-option"]')).toHaveLength(24);

    await user.click(screen.getByLabelText('2027-03'));
    expect(onChange).toHaveBeenCalledWith('2027-03');
    await waitFor(() => expect(input().value).toBe('2027-03'));
  });

  it('日历按 columnsType 提交裁剪后的月日值', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="月日"
        columnsType={['month', 'day']}
        defaultValue="09-20"
        min="2026-01-01"
        max="2026-12-31"
        onChange={onChange}
      />,
    );

    expect(input().value).toBe('09-20');
    await user.click(input());
    await user.click(screen.getByLabelText('2026-09-25'));

    expect(onChange).toHaveBeenCalledWith('09-25');
    await waitFor(() => expect(input().value).toBe('09-25'));
  });

  it('真实点击路径下，点击日期不会被输入框失焦提交截断', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="日期"
        defaultValue="2026-09-20"
        onChange={onChange}
      />,
    );

    await user.click(input());
    expect(panel()).toBeInTheDocument();

    await user.click(screen.getByLabelText('2026-09-25'));
    expect(onChange).toHaveBeenLastCalledWith('2026-09-25');
    await waitFor(() => expect(panel()).toBeNull());
  });

  it('点日期格即提交并关闭（单值没有暂存这一层）', async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="日期"
        defaultValue="2026-09-20"
        onChange={onChange}
      />,
    );
    fireEvent.focus(input());

    fireEvent.click(screen.getByLabelText('2026-09-25'));

    expect(onChange).toHaveBeenCalledWith('2026-09-25');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(panel()).toBeNull());
  });

  it('键盘：方向键移动光标、Enter 选中、PageDown 翻月、Esc 关闭', async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="日期"
        defaultValue="2026-09-20"
        onChange={onChange}
      />,
    );
    fireEvent.focus(input());
    const content = panel() as HTMLElement;

    fireEvent.keyDown(content, { key: 'ArrowRight' });
    fireEvent.keyDown(content, { key: 'ArrowDown' }); // +7 天
    fireEvent.keyDown(content, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-09-28');

    await waitFor(() => expect(panel()).toBeNull());

    // 重新打开后验翻月（光标落回已选值所在月）
    fireEvent.click(input());
    fireEvent.keyDown(panel() as HTMLElement, { key: 'PageDown' });
    expect(monthTitles()[0]).toContain('10');

    fireEvent.keyDown(panel() as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(panel()).toBeNull());
  });

  it('转点其他浮层时不会因焦点归还重新打开月历', async () => {
    render(
      <>
        <DatePicker forceMode="desktop" ariaLabel="日期" defaultValue="2026-09-20" />
        <DropdownMenu
          forceMode="desktop"
          ariaLabel="操作菜单"
          trigger="更多操作"
          items={[{ value: 'edit', label: '编辑' }]}
        />
      </>,
    );

    // Real focus updates document.activeElement; fireEvent.focus misses this focus race.
    act(() => input().focus());
    expect(panel()).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: '操作菜单' }), {
      button: 0,
      ctrlKey: false,
    });

    await waitFor(() => {
      expect(panel()).toBeNull();
      expect(document.querySelector('[data-slot="menu-panel"]')).toBeInTheDocument();
    });
  });

  it('超出 min/max 的日期置灰且点不动', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="日期"
        defaultValue="2026-09-15"
        min="2026-09-10"
        max="2026-09-20"
        onChange={onChange}
      />,
    );
    fireEvent.focus(input());

    expect(screen.getByLabelText('2026-09-09')).toBeDisabled();
    expect(screen.getByLabelText('2026-09-21')).toBeDisabled();
    expect(screen.getByLabelText('2026-09-15')).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText('2026-09-09'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('可直接输入日期：合法值回车提交，非法值原样回滚', () => {
    const onChange = vi.fn();
    render(<DatePicker forceMode="desktop" ariaLabel="日期" onChange={onChange} />);
    const box = input();

    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: '2026-09-20' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-09-20');
    expect(box.value).toBe('2026-09-20');

    fireEvent.change(box, { target: { value: '2026-02-30' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    // 驳回要看得见：不新增回调，且输入框回到当前值而不是留着非法文本
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(box.value).toBe('2026-09-20');
  });

  it('区间模式：并排双月，两下点选后提交有序区间', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="区间"
        type="range"
        defaultValue={RANGE_VALUE}
        onChange={onChange}
      />,
    );
    // 区间形态没有输入框，用点击触发器展开
    fireEvent.click(trigger());

    expect(document.querySelectorAll('[data-slot="date-picker-month-panel"]')).toHaveLength(2);
    // 双月是连续的：第一块 2026-09，第二块 2026-10
    const titles = monthTitles();
    expect(titles[0]).toContain('2026');
    expect(titles[0]).toContain('9');
    expect(titles[1]).toContain('10');
    // 区间形态下触发器不可输入（两段文本拼在一行，逐字编辑没有明确语义）
    expect(input()).toBeNull();

    // 第一下 = 重选起点，不提交
    fireEvent.click(screen.getAllByLabelText('2026-09-15')[0]);
    expect(onChange).not.toHaveBeenCalled();

    // 第二下 = 补上终点，选满即提交
    fireEvent.click(screen.getAllByLabelText('2026-09-25')[0]);
    expect(onChange).toHaveBeenCalledWith(['2026-09-15', '2026-09-25']);
  });

  it('区间模式：两端点与区间内日期分别着色，端点各带一次圆角', () => {
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="区间"
        type="range"
        defaultValue={RANGE_VALUE}
      />,
    );
    fireEvent.click(trigger());

    const start = screen.getAllByLabelText('2026-09-10')[0];
    const end = screen.getAllByLabelText('2026-09-12')[0];
    const middle = screen.getAllByLabelText('2026-09-11')[0];

    expect(start).toHaveAttribute('data-selected', 'true');
    expect(end).toHaveAttribute('data-selected', 'true');
    expect(middle).toHaveAttribute('data-in-range', 'true');
    expect(middle).not.toHaveAttribute('data-selected');
  });

  it('区间悬停预览：锁定终点后，悬停到哪天就预览到哪天', () => {
    render(
      <DatePicker
        forceMode="desktop"
        ariaLabel="区间"
        type="range"
        defaultValue={RANGE_VALUE}
        min={MIN}
        max={MAX}
      />,
    );
    fireEvent.click(trigger());

    // 第一下设定新的起点（此时终点还空着，进入「预览」态）
    fireEvent.click(screen.getAllByLabelText('2026-09-20')[0]);
    // 预览区间只有起点、没有悬停日时，用键盘光标当临时终点（光标还停在原端点 9/12），
    // 因此 9/22 不在区间里
    expect(screen.getAllByLabelText('2026-09-22')[0]).not.toHaveAttribute('data-in-range');

    fireEvent.mouseEnter(screen.getAllByLabelText('2026-09-25')[0]);
    expect(screen.getAllByLabelText('2026-09-22')[0]).toHaveAttribute('data-in-range', 'true');
    expect(screen.getAllByLabelText('2026-09-24')[0]).toHaveAttribute('data-in-range', 'true');

    // 移开鼠标即收回预览（不能把临时终点留在画面上，用户会以为是已选）
    fireEvent.mouseLeave(screen.getAllByLabelText('2026-09-25')[0]);
    expect(screen.getAllByLabelText('2026-09-22')[0]).not.toHaveAttribute('data-in-range');
  });
});
