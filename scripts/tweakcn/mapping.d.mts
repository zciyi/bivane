/** 类型声明：mapping.mjs（Bivane ↔ tweakcn 槽位映射表，唯一事实源） */

export const TWEAKCN_SLOTS: string[];
export const TWEAKCN_COMMON_SLOTS: Set<string>;
export const TWEAKCN_COLOR_SLOTS: string[];

/** 导出映射：tweakcn 槽 → Bivane 槽（值为 Bivane token 名或 `literal:<text>`） */
export const TO_TWEAKCN: Record<string, string>;

/** 导入映射：tweakcn 槽 → Bivane 槽（只覆盖品牌槽） */
export const TO_BIVANE: Record<string, string>;

/** tweakcn 图表色槽的角色约定 */
export const CHART_ROLE: Record<string, string>;

/** Bivane 有、tweakcn 无对应槽的品牌槽（导入时沿用原值） */
export const IMPORT_EXTRA_BIVANE_SLOTS: string[];
