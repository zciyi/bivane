import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  filterFieldInput,
  resolveInputMode,
  resolveNativeInputType,
  useFieldAutosize,
  type FieldAutosizeConfig,
  type FieldType,
} from '@/hooks/use-field-state';

/**
 * Bivane Input / Textarea · 无外壳输入基础件（模式 A）
 *
 * 与 Field 的分工：本文件只负责「一个能打字的控件」——原生属性透传、Vant token
 * 排版、digit/number 按键过滤、textarea autosize、键盘焦点环。
 * label / 清除图标 / 错误文案 / 字数等 Cell 行结构归 components/ui/field.tsx。
 * Search、Stepper 等后续组件直接复用本件，不再自绘 input。
 */

const CONTROL_BASE =
  'm-0 w-full min-w-0 border-0 bg-transparent p-0 appearance-none outline-none ' +
  'text-[length:var(--bv-field-input-font)] leading-[var(--bv-field-input-line-height)] ' +
  'text-[var(--bv-field-input-text-color)] placeholder:text-[var(--bv-field-placeholder-text-color)] ' +
  'disabled:cursor-not-allowed disabled:text-[var(--bv-field-input-disabled-text-color)]';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** 输入类型；digit = 纯数字键盘且按键即过滤（Vant 语义） */
  type?: FieldType;
  /** 错误态：输入文字转 danger（Field 内部受控，也可单独使用） */
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { type = 'text', invalid = false, inputMode, className, onChange, ...props },
  ref,
) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // 受控下拒绝非法输入：不向上传事件，消费者 value 不变，DOM 被 React 拉回旧值
    if (filterFieldInput(event.target.value, type) === null) return;
    onChange?.(event);
  };

  return (
    <input
      ref={ref}
      data-slot="input"
      aria-invalid={invalid || undefined}
      type={resolveNativeInputType(type)}
      inputMode={resolveInputMode(type, inputMode)}
      onChange={handleChange}
      className={cn(
        CONTROL_BASE,
        'bv-focus-ring rounded-bv-sm',
        invalid && 'text-[var(--bv-field-input-error-text-color)]',
        className,
      )}
      {...props}
    />
  );
});

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 自适应高度；可给 minHeight/maxHeight 钳制区间 */
  autosize?: boolean | FieldAutosizeConfig;
  /** 错误态：输入文字转 danger */
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { autosize = false, invalid = false, className, onChange, value, defaultValue, ...props },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const ref = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  // 非受控下也要跟随输入重测高度：镜像一份内部文本驱动 autosize effect
  const [innerText, setInnerText] = React.useState(() =>
    String(value ?? defaultValue ?? ''),
  );
  const currentText = value !== undefined ? String(value) : innerText;
  useFieldAutosize(innerRef, autosize, currentText);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInnerText(event.target.value);
    onChange?.(event);
  };

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={handleChange}
      className={cn(
        CONTROL_BASE,
        'bv-focus-ring block min-h-[var(--bv-field-text-area-min-height)] resize-none rounded-bv-sm',
        invalid && 'text-[var(--bv-field-input-error-text-color)]',
        className,
      )}
      {...props}
    />
  );
});
