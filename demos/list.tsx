/**
 * List 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { List } from '@/components/responsive/list';
import { Cell } from '@/components/ui/cell';
import { DEMO_ORDER_SEED } from "./table-shared";
import type { DemoOrder } from "./table-shared";
function ListDemo({
    mode,
    caption,
    virtual = false,
}: {
    mode: "mobile" | "desktop";
    caption: string;
    virtual?: boolean;
}) {
    const [rows, setRows] = React.useState<DemoOrder[]>(DEMO_ORDER_SEED.slice(0, 6));
    const [loading, setLoading] = React.useState(false);
    const [finished, setFinished] = React.useState(false);

    const loadMore = React.useCallback(() => {
        setLoading(true);
        // 模拟异步取数
        window.setTimeout(() => {
            setRows((prev) => {
                const next = DEMO_ORDER_SEED.slice(prev.length, prev.length + 3);
                if (prev.length + next.length >= DEMO_ORDER_SEED.length) {
                    setFinished(true);
                }
                return [...prev, ...next];
            });
            setLoading(false);
        }, 400);
    }, []);

    const refresh = React.useCallback(() => {
        setLoading(true);
        window.setTimeout(() => {
            setRows(DEMO_ORDER_SEED.slice(0, 6));
            setFinished(false);
            setLoading(false);
        }, 400);
    }, []);

    return (
        <div className={mode === "mobile" ? "w-full max-w-[360px]" : "w-full max-w-[480px]"}>
            <p className="mb-bv-sm text-bv-sm text-bv-text-2">{caption}</p>
            <div className="h-[240px] overflow-hidden rounded-bv-lg bg-bv-surface">
                <List
                    forceMode={mode}
                    data={rows}
                    renderItem={(item) => (
                        <Cell
                            title={(item as DemoOrder).name}
                            value={`¥${(item as DemoOrder).amount}`}
                        />
                    )}
                    rowKey={(item) => (item as DemoOrder).id}
                    loading={loading}
                    finished={finished}
                    onLoad={loadMore}
                    onRefresh={refresh}
                    virtual={virtual}
                    itemHeight={virtual ? 44 : undefined}
                    height={virtual ? 240 : undefined}
                />
            </div>
        </div>
    );
}
/** List 的第 1 个示例 */
export function ListExample1() {
    return (
        <Block>
                        <Row>
                            <ListDemo
                                mode="mobile"
                                caption="H5：竖向滚动容器，滚到底自动加载；顶部下拉可刷新（两个实例各自独立，互不影响）"
                            />
                            <ListDemo
                                mode="desktop"
                                caption="PC：固定高度滚动容器 + 顶部「刷新」按钮（鼠标没有下拉手势，这是等价交互）"
                            />
                        </Row>
                        <Row>
                            <ListDemo
                                mode="desktop"
                                virtual
                                caption="PC：虚拟滚动（给 virtual + itemHeight + height，只渲染视口内的行）"
                            />
                        </Row>
                    </Block>
    );
}
export function ListDemos() {
    return (
            <Section title="P3 · List 列表（模式 C：H5 无限滚动+下拉刷新 / PC 滚动加载+刷新按钮）">
                <ListExample1 />
            </Section>
        );
}