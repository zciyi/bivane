import * as React from 'react';

/**
 * Bivane Field · 跨三件共享的输入逻辑（Field 外壳 / Input / Textarea）
 *
 * 与选择类组件同一组织原则：值层面的规则全部写成纯函数（数字过滤、min/max 夹紧、
 * rules 校验），React 绑定只保留「textarea 自适应高度」这一必须碰 DOM 的部分。
 * 过滤/夹紧的中间态边界（`-`、`1.` 不能在输入过程中被掐掉）靠 DOM 测不出来，
 * 必须落在纯函数单测里。
 *
 * 语义逐字对齐 Vant 4 packages/vant/src/field/Field.tsx。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/** 单行输入支持的类型；多行由 Field 的 type="textarea" 表达 */
export type FieldType =
  | 'text'
  | 'number'
  | 'digit'
  | 'password'
  | 'tel'
  | 'email'
  | 'url'
  | 'search';

export type FieldTextAlign = 'left' | 'center' | 'right';

export type FieldClearTrigger = 'focus' | 'always';

export type FieldFormatTrigger = 'onChange' | 'onBlur';

export type FieldValidateTrigger = 'onChange' | 'onBlur';

export interface FieldAutosizeConfig {
  minHeight?: number | string;
  maxHeight?: number | string;
}

/** 校验规则（轻量子集，不依赖 Form；Form 以后在这一层聚合） */
export interface FieldRule {
  /** 空字符串视为不合规（只画红星的 required prop 与本开关无关） */
  required?: boolean;
  /** 非空时正则必须通过；空值不校验（非必填语义） */
  pattern?: RegExp;
  /** 自定义校验：true 通过；false/字符串失败，字符串直接作为错误文案 */
  validator?: (value: string) => boolean | string | Promise<boolean | string>;
  /** 错误文案；不传走内置兜底文案 */
  message?: string;
  /** 只在指定时机校验本规则；不传则两个时机都跑 */
  trigger?: FieldValidateTrigger;
}

export interface FieldValidationResult {
  valid: boolean;
  message?: string;
}

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/** digit：只允许非负整数（Vant 同名正则） */
const DIGIT_RE = /^\d*$/;
/**
 * number：允许「输入过程的中间态」——`-`、`1.`、`-1.` 都必须暂时合法，
 * 否则用户无法逐字符敲出负数/小数；最终是否为合法数字交给浏览器与失焦夹紧。
 */
const NUMBER_RE = /^-?\d*(\.\d*)?$/;

const DEFAULT_REQUIRED_MESSAGE = '该项为必填项';
const DEFAULT_PATTERN_MESSAGE = '输入内容格式不正确';
const DEFAULT_VALIDATOR_MESSAGE = '输入内容不正确';

/* ------------------------------------------------------------------ *
 * 纯函数：类型映射 / 输入过滤 / 失焦夹紧
 * ------------------------------------------------------------------ */

/** digit 伪装成 text：避开浏览器数字输入框的怪癖，改由 inputmode 唤起数字键盘 */
export function resolveNativeInputType(type: FieldType): string {
  return type === 'digit' ? 'text' : type;
}

/** digit 唤起带小数点的数字键盘（Vant：decimal）；其余尊重消费者显式传入 */
export function resolveInputMode(
  type: FieldType,
  explicit?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'],
): React.InputHTMLAttributes<HTMLInputElement>['inputMode'] | undefined {
  if (explicit) return explicit;
  return type === 'digit' ? 'decimal' : undefined;
}

/**
 * 按键级过滤。返回 null 表示本次输入必须拒绝——受控渲染下不回写状态，
 * React 会把 DOM 值拉回旧值，等价于 Vant 内部「非法时重置 input.value」。
 */
export function filterFieldInput(next: string, type: FieldType): string | null {
  if (type === 'digit') return DIGIT_RE.test(next) ? next : null;
  if (type === 'number') return NUMBER_RE.test(next) ? next : null;
  return next;
}

/**
 * 失焦时把 number/digit 夹紧到 [min, max]（Vant 4.9.5 语义）。
 * 返回需要回写的值；null 表示无需回写（非数字类型 / 空值 / 已在区间内）。
 * 空值不夹——必填语义归 rules 管，避免与 required 错误双重提示。
 */
export function clampNumericValue(
  value: string,
  opts: { type: FieldType; min?: number; max?: number },
): string | null {
  if (value === '') return null;
  if (opts.type !== 'number' && opts.type !== 'digit') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (opts.min !== undefined && num < opts.min) return String(opts.min);
  if (opts.max !== undefined && num > opts.max) return String(opts.max);
  return null;
}

/* ------------------------------------------------------------------ *
 * 纯函数：rules 校验（async：validator 允许返回 Promise）
 * ------------------------------------------------------------------ */

function ruleFailure(
  rule: FieldRule,
  fallback: string,
  validatorResult?: boolean | string,
): FieldValidationResult {
  if (typeof validatorResult === 'string' && validatorResult !== '') {
    return { valid: false, message: validatorResult };
  }
  return { valid: false, message: rule.message ?? fallback };
}

/**
 * 顺序执行规则，第一条失败即返回（与 Vant 一致）。
 * trigger 用于跳过声明了其他触发时机的规则；空字符串只由 required 拦截，
 * pattern 与 validator 的空值策略：pattern 放行、validator 自行决定。
 */
export async function validateFieldRules(
  value: string,
  rules: readonly FieldRule[] | undefined,
  trigger?: FieldValidateTrigger,
): Promise<FieldValidationResult> {
  if (!rules || rules.length === 0) return { valid: true };

  for (const rule of rules) {
    if (rule.trigger !== undefined && rule.trigger !== trigger) continue;

    if (rule.required && value === '') {
      return ruleFailure(rule, DEFAULT_REQUIRED_MESSAGE);
    }
    if (value !== '' && rule.pattern && !rule.pattern.test(value)) {
      return ruleFailure(rule, DEFAULT_PATTERN_MESSAGE);
    }
    if (rule.validator) {
      const result = await rule.validator(value);
      if (result !== true) {
        return ruleFailure(rule, DEFAULT_VALIDATOR_MESSAGE, result);
      }
    }
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ *
 * React 绑定：textarea 自适应高度
 * ------------------------------------------------------------------ */

function toPx(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * autosize 测量：value 变化或宽度变化时，按 scrollHeight 重写高度。
 * 先 height:auto 再测量，避免在上一次高度上累加；min/max 钳制，超出 max 内部滚动。
 * jsdom 无布局（scrollHeight 恒 0）时不写高度，测试环境天然降级。
 */
export function useFieldAutosize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  autosize: boolean | FieldAutosizeConfig | undefined,
  value: string,
): void {
  const enabled = autosize !== undefined && autosize !== false;
  const config = typeof autosize === 'object' ? autosize : undefined;
  const minHeight = toPx(config?.minHeight);
  const maxHeight = toPx(config?.maxHeight);

  const resize = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = 'auto';
    const measured = el.scrollHeight;
    if (measured <= 0) return; // 无布局环境：保持浏览器默认高度

    let next = measured;
    if (minHeight !== undefined) next = Math.max(next, minHeight);
    if (maxHeight !== undefined) next = Math.min(next, maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = maxHeight !== undefined && measured > maxHeight ? 'auto' : 'hidden';
  }, [ref, minHeight, maxHeight]);

  // 值变化（行数变化）立即重测
  React.useLayoutEffect(() => {
    if (!enabled) return;
    resize();
  }, [enabled, resize, value]);

  // 宽度变化（折行行数变化）跟随重测；记录宽度防止「自己写高」触发自激回调
  React.useLayoutEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    resize();
    if (typeof ResizeObserver === 'undefined') return;

    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
    // ref 为稳定 RefObject，列入仅为满足 lint，实际不会引发重订阅
  }, [enabled, resize, ref]);
}
