/**
 * Table 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Table } from '@/components/responsive/table';
import { cn } from '@/lib/utils';
import { DEMO_ORDER_SEED, DEMO_TABLE_COLUMNS } from "./table-shared";
import type { DemoOrder } from "./table-shared";
function TableDemo({
    mode,
    caption,
    rows,
}: {
    mode: "mobile" | "desktop";
    caption: string;
    rows: DemoOrder[];
}) {
    const [selected, setSelected] = React.useState<string[]>([]);
    const [sort, setSort] = React.useState<{ key: string; order: "asc" | "desc" } | null>(
        null,
    );

    return (
        <div className={mode === "mobile" ? "w-full max-w-[360px]" : "w-full max-w-[480px]"}>
            <p className="mb-bv-sm text-bv-sm text-bv-text-2">{caption}</p>
            <div
                className={cn(
                    "max-h-[320px] rounded-bv-lg",
                    mode === "mobile"
                        ? "overflow-y-auto bg-bv-background"
                        : "overflow-hidden bg-bv-surface",
                )}
            >
                <Table
                    forceMode={mode}
                    columns={DEMO_TABLE_COLUMNS}
                    data={rows}
                    sort={sort}
                    onSortChange={setSort}
                    onSelectionChange={setSelected}
                />
            </div>
            <span className="text-bv-text-2">已选：{selected.join(", ") || "无"}</span>
        </div>
    );
}
/** Table 的第 1 个示例 */
export function TableExample1() {
    return (
        <Block>
                        <Row>
                            <TableDemo
                                mode="mobile"
                                rows={DEMO_ORDER_SEED.slice(0, 4)}
                                caption="H5：一张数据 = 一张卡片；「详情」展开其余字段，字段标签（带箭头）可点排序"
                            />
                            <TableDemo
                                mode="desktop"
                                rows={DEMO_ORDER_SEED.slice(0, 6)}
                                caption="PC：真表格；点表头排序（表头就是标签，单元格只放值）、齿轮图标列筛选、行首勾选 + 表头全选"
                            />
                        </Row>
                    </Block>
    );
}
export function TableDemos() {
    return (
            <Section title="P3 · Table 表格（模式 C：H5 卡片化 / PC 标准表格）">
                <TableExample1 />
            </Section>
        );
}