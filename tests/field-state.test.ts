import { describe, expect, it } from 'vitest';
import {
  clampNumericValue,
  filterFieldInput,
  resolveInputMode,
  resolveNativeInputType,
  validateFieldRules,
} from '@/hooks/use-field-state';

describe('Field 类型映射', () => {
  it('digit 渲染成 text（避开浏览器数字控件怪癖），其余类型原样', () => {
    expect(resolveNativeInputType('digit')).toBe('text');
    expect(resolveNativeInputType('number')).toBe('number');
    expect(resolveNativeInputType('password')).toBe('password');
    expect(resolveNativeInputType('text')).toBe('text');
  });

  it('digit 默认 inputmode=decimal，显式传入优先', () => {
    expect(resolveInputMode('digit')).toBe('decimal');
    expect(resolveInputMode('digit', 'numeric')).toBe('numeric');
    expect(resolveInputMode('text')).toBeUndefined();
  });
});

describe('filterFieldInput · 按键级过滤', () => {
  it('digit：只接受非负整数字符，字母/小数点/负号一律拒绝', () => {
    expect(filterFieldInput('123', 'digit')).toBe('123');
    expect(filterFieldInput('', 'digit')).toBe('');
    expect(filterFieldInput('12a', 'digit')).toBeNull();
    expect(filterFieldInput('1.5', 'digit')).toBeNull();
    expect(filterFieldInput('-3', 'digit')).toBeNull();
  });

  it('number：允许负数/小数的输入中间态', () => {
    expect(filterFieldInput('-', 'number')).toBe('-');
    expect(filterFieldInput('-1.', 'number')).toBe('-1.');
    expect(filterFieldInput('1.25', 'number')).toBe('1.25');
    expect(filterFieldInput('1a', 'number')).toBeNull();
  });

  it('普通类型不过滤', () => {
    expect(filterFieldInput('任意值!', 'text')).toBe('任意值!');
    expect(filterFieldInput('abc', 'password')).toBe('abc');
  });
});

describe('clampNumericValue · 失焦夹紧', () => {
  it('超出 min/max 返回夹紧后的值', () => {
    expect(clampNumericValue('3', { type: 'digit', min: 5, max: 10 })).toBe('5');
    expect(clampNumericValue('101', { type: 'number', min: 0, max: 100 })).toBe('100');
    expect(clampNumericValue('-5', { type: 'number', min: 0 })).toBe('0');
  });

  it('区间内、空值、非数字内容、非数字类型都返回 null（不回写）', () => {
    expect(clampNumericValue('8', { type: 'digit', min: 5, max: 10 })).toBeNull();
    expect(clampNumericValue('', { type: 'digit', min: 5 })).toBeNull();
    expect(clampNumericValue('abc', { type: 'number' })).toBeNull();
    expect(clampNumericValue('99', { type: 'text', max: 10 })).toBeNull();
  });
});

describe('validateFieldRules · 顺序校验', () => {
  it('无规则恒通过', async () => {
    await expect(validateFieldRules('', undefined)).resolves.toEqual({ valid: true });
    await expect(validateFieldRules('x', [])).resolves.toEqual({ valid: true });
  });

  it('required：空串失败并给兜底文案', async () => {
    const result = await validateFieldRules('', [{ required: true }]);
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it('required 自定义 message 优先', async () => {
    const result = await validateFieldRules('', [
      { required: true, message: '请填写手机号' },
    ]);
    expect(result).toEqual({ valid: false, message: '请填写手机号' });
  });

  it('pattern：空值放行（非必填语义），非空不匹配才失败', async () => {
    const phone = /^1\d{10}$/;
    await expect(validateFieldRules('', [{ pattern: phone }])).resolves.toEqual({
      valid: true,
    });
    expect((await validateFieldRules('123', [{ pattern: phone }])).valid).toBe(false);
    expect((await validateFieldRules('13800000000', [{ pattern: phone }])).valid).toBe(true);
  });

  it('validator：true 通过，false 走兜底文案，字符串直接作为文案', async () => {
    expect(
      (await validateFieldRules('x', [{ validator: () => true }])).valid,
    ).toBe(true);
    expect(
      await validateFieldRules('x', [{ validator: () => false, message: 'm' }]),
    ).toEqual({ valid: false, message: 'm' });
    expect(await validateFieldRules('x', [{ validator: () => '自定义错误' }])).toEqual({
      valid: false,
      message: '自定义错误',
    });
  });

  it('validator 支持 Promise', async () => {
    const result = await validateFieldRules('x', [
      { validator: async () => '异步失败' },
    ]);
    expect(result).toEqual({ valid: false, message: '异步失败' });
  });

  it('trigger 过滤：声明了 onChange 的规则在 onBlur 时不跑', async () => {
    const rules = [{ required: true, trigger: 'onChange' as const }];
    expect((await validateFieldRules('', rules, 'onBlur')).valid).toBe(true);
    expect((await validateFieldRules('', rules, 'onChange')).valid).toBe(false);
  });

  it('规则顺序执行，第一条失败即短路', async () => {
    const later = async () => {
      throw new Error('不应执行到第二条规则');
    };
    const result = await validateFieldRules('', [
      { required: true, message: 'first' },
      { validator: later },
    ]);
    expect(result).toEqual({ valid: false, message: 'first' });
  });
});
