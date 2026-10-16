import { createRef, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Field, type FieldInstance } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/** 受控包裹：纯 jsdom 下非受控输入不会回弹，验证按键过滤必须让 React 持有值 */
function ControlledDigit() {
  const [value, setValue] = useState('');
  return (
    <Input
      type="digit"
      aria-label="digit"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
}

describe('Input 基础件', () => {
  it('digit 按键过滤：非法字符被受控渲染拉回', () => {
    render(<ControlledDigit />);
    const input = screen.getByLabelText('digit') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '12a' } });
    expect(input.value).toBe('');
    fireEvent.change(input, { target: { value: '42' } });
    expect(input.value).toBe('42');
  });
});

describe('Field 基础渲染', () => {
  it('label 通过 htmlFor 关联自动生成的 input id', () => {
    render(<Field label="用户名" />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    const label = screen.getByText('用户名').closest('label');
    expect(input.id).toMatch(/^bv-field-/);
    expect(label?.getAttribute('for')).toBe(input.id);
  });

  it('显式 id 透传给控件而非根元素', () => {
    render(<Field id="phone" label="电话" />);
    expect((screen.getByRole('textbox') as HTMLInputElement).id).toBe('phone');
  });

  it('type=textarea 渲染多行控件并透传 rows', () => {
    render(<Field type="textarea" rows={3} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.rows).toBe(3);
  });

  it('placeholder / name / maxlength 透传原生控件', () => {
    render(<Field name="user" placeholder="请输入" maxlength={10} />);
    const input = screen.getByPlaceholderText('请输入') as HTMLInputElement;
    expect(input.name).toBe('user');
    expect(input.maxLength).toBe(10);
  });

  it('required 只画红星，不产生错误态', () => {
    render(<Field label="名称" required />);
    expect(document.querySelector('[data-slot="field"]')).not.toHaveAttribute(
      'data-error',
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('自定义控件体（children）时不渲染原生输入框', () => {
    render(
      <Field label="选择">
        <button type="button">打开选择</button>
      </Field>,
    );
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: '打开选择' })).toBeInTheDocument();
  });

  it('isLink 渲染右侧方向箭头', () => {
    render(<Field isLink />);
    expect(
      document.querySelector('[data-slot="field-right-icon"] svg'),
    ).not.toBeNull();
  });

  it('field-box 包裹控件与右箭头；action 留在盒外（PC 只让边框盒出框）', () => {
    render(<Field isLink action={<span>动作</span>} />);
    const box = document.querySelector('[data-slot="field-box"]');
    expect(box).not.toBeNull();
    expect(box?.querySelector('[data-slot="input"]')).not.toBeNull();
    expect(box?.querySelector('[data-slot="field-right-icon"]')).not.toBeNull();
    // action 是 control 的直接子级、box 的兄弟节点
    expect(box?.querySelector('[data-slot="field-action"]')).toBeNull();
    expect(
      document.querySelector(
        '[data-slot="field-control"] > [data-slot="field-action"]',
      ),
    ).not.toBeNull();
  });

  it('textarea 盒打 data-textarea 标记（供 PC 盒高随内容的 CSS 区分）', () => {
    render(<Field type="textarea" />);
    expect(
      document.querySelector('[data-slot="field-box"][data-textarea="true"]'),
    ).not.toBeNull();
  });
});

describe('Field 受控值', () => {
  it('受控渲染并在变更时回调字符串', () => {
    const onChange = vi.fn();
    render(<Field value="abc" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'xyz' },
    });
    expect(onChange).toHaveBeenCalledWith('xyz');
  });

  it('number 值归一化为字符串展示', () => {
    render(<Field value={123} onChange={vi.fn()} />);
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('123');
  });

  it('digit 非法输入不触发 onChange', () => {
    const onChange = vi.fn();
    render(<Field type="digit" defaultValue="" onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '9a' },
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Field 聚焦态与清除', () => {
  it('聚焦时根挂 data-focused；clearable 默认聚焦才出现，清除后回焦点', () => {
    const onChange = vi.fn();
    const onClear = vi.fn();
    render(
      <Field clearable defaultValue="abc" onChange={onChange} onClear={onClear} />,
    );
    const input = screen.getByRole('textbox');
    const root = document.querySelector('[data-slot="field"]');

    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
    fireEvent.focus(input);
    expect(root).toHaveAttribute('data-focused', 'true');

    const clearButton = screen.getByRole('button', { name: '清除' });
    fireEvent.click(clearButton);
    expect(onChange).toHaveBeenCalledWith('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
  });

  it('clearTrigger=always 有值即显示', () => {
    render(<Field clearable clearTrigger="always" defaultValue="x" />);
    expect(screen.getByRole('button', { name: '清除' })).toBeInTheDocument();
  });

  it('readOnly 时不显示清除（只读字段走选择器语义）', () => {
    render(<Field clearable readOnly defaultValue="x" />);
    fireEvent.focus(screen.getByRole('textbox'));
    expect(screen.queryByRole('button', { name: '清除' })).toBeNull();
  });
});

describe('Field 错误态', () => {
  it('受控 error + errorMessage 优先展示', () => {
    render(<Field error errorMessage="受控错误" />);
    expect(document.querySelector('[data-slot="field"]')).toHaveAttribute(
      'data-error',
      'true',
    );
    expect(screen.getByText('受控错误')).toHaveAttribute('data-slot', 'field-error');
  });

  it('rules 失焦校验：空值触发 required 错误文案', async () => {
    render(<Field rules={[{ required: true, message: '必填项' }]} />);
    fireEvent.blur(screen.getByRole('textbox'));
    expect(await screen.findByText('必填项')).toHaveAttribute(
      'data-slot',
      'field-error',
    );
  });

  it('validateTrigger=onChange：变更即校验，通过后错误消失', async () => {
    render(
      <Field
        validateTrigger="onChange"
        rules={[{ required: true, message: '必填项' }]}
      />,
    );
    const input = screen.getByRole('textbox');
    // React 会对「值未变化」的 input 事件去重，先输入再清空才能触发 onChange
    fireEvent.change(input, { target: { value: '有值' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(await screen.findByText('必填项')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '再次输入' } });
    await waitFor(() => expect(screen.queryByText('必填项')).toBeNull());
  });

  it('ref.validate() / resetValidation() 手动控制校验', async () => {
    const ref = createRef<FieldInstance>();
    render(<Field ref={ref} rules={[{ required: true, message: 'r' }]} />);
    await act(async () => {
      await expect(ref.current?.validate()).resolves.toBe(false);
    });
    expect(await screen.findByText('r')).toBeInTheDocument();

    act(() => ref.current?.resetValidation());
    expect(screen.queryByText('r')).toBeNull();
  });
});

describe('Field 格式化与边界', () => {
  it('formatter 在 onChange 时机串接', () => {
    const onChange = vi.fn();
    render(
      <Field formatter={(value) => value.replace(/\d/g, '')} onChange={onChange} />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'a1b2' },
    });
    expect(onChange).toHaveBeenCalledWith('ab');
  });

  it('formatTrigger=onBlur：失焦才格式化并回写', async () => {
    const onChange = vi.fn();
    render(
      <Field
        defaultValue="a1"
        formatTrigger="onBlur"
        formatter={(value) => value.replace(/\d/g, '')}
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.blur(input);
    await waitFor(() => expect(input.value).toBe('a'));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('number/digit 失焦按 min/max 夹紧并回写', async () => {
    const onChange = vi.fn();
    render(
      <Field type="digit" defaultValue="50" min={1} max={9} onChange={onChange} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.blur(input);
    await waitFor(() => expect(input.value).toBe('9'));
    expect(onChange).toHaveBeenCalledWith('9');
  });
});

describe('Field 字数统计', () => {
  it('showWordLimit 展示 当前/上限', () => {
    render(
      <Field showWordLimit maxlength={5} defaultValue="abc" onChange={vi.fn()} />,
    );
    const limit = document.querySelector('[data-slot="field-word-limit"]');
    expect(limit?.textContent).toBe('3/5');
  });

  it('值变化后字数跟随', () => {
    render(
      <Field showWordLimit maxlength={5} defaultValue="" onChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'hello' },
    });
    expect(
      document.querySelector('[data-slot="field-word-num"]')?.textContent,
    ).toBe('5');
  });
});

describe('Field ref 实例方法', () => {
  it('focus() / blur() 作用于内部控件', async () => {
    const ref = createRef<FieldInstance>();
    render(<Field ref={ref} />);
    const input = screen.getByRole('textbox');

    await act(async () => ref.current?.focus());
    expect(input).toHaveFocus();
    await act(async () => ref.current?.blur());
    expect(input).not.toHaveFocus();
  });
});
