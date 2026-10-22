/** 类型声明：color.mjs（零依赖颜色字面量归一化） */

/** 把任意 CSS 颜色字面量归一化成 6 位小写 hex；认不得时原样返回。 */
export function normalizeColor(value: string): string;

/** 判断归一化后是否仍是可被 culori 解析的颜色。 */
export function isConvertibleColor(value: string): boolean;
