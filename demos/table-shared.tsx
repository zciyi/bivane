/**
 * 列表 / 表格 demo 共用的数据与列定义
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import type { TableColumn } from '@/components/responsive/table';

/** 订单 / 记录的统一行结构 */
export interface DemoOrder {
    id: string;
    name: string;
    amount: number;
    status: string;
}

/** 表格 demo 的 12 条订单 */
export const DEMO_ORDER_SEED: DemoOrder[] = Array.from({ length: 12 }, (_, i) => ({
    id: String(i + 1),
    name: `订单 ${String(i + 1).padStart(2, "0")}`,
    amount: (i + 1) * 37,
    status: i % 3 === 0 ? "paid" : "pending",
}));

/** 分页 demo 的 47 条记录 */
export const PAGINATION_SEED: DemoOrder[] = Array.from({ length: 47 }, (_, i) => ({
    id: `p-${i + 1}`,
    name: `记录 ${String(i + 1).padStart(2, "0")}`,
    amount: (i + 1) * 13,
    status: i % 2 === 0 ? "paid" : "pending",
}));

/** 分页 demo 的两列 */
export const PAGINATION_COLUMNS: TableColumn[] = [
    { key: "name", title: "名称", h5Role: "title" },
    { key: "amount", title: "金额", sortable: true, h5Role: "meta" },
];

/** 表格 demo 的三列（含排序与筛选） */
export const DEMO_TABLE_COLUMNS: TableColumn[] = [
    { key: "name", title: "名称", sortable: true, h5Role: "title" },
    { key: "amount", title: "金额", sortable: true, h5Role: "meta" },
    {
        key: "status",
        title: "状态",
        h5Role: "detail",
        filterable: true,
        filters: ["paid", "pending"],
    },
];
