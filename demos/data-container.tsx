/**
 * DataContainer 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Table } from '@/components/responsive/table';
import { DataContainer } from '@/components/responsive/data-container';
import { PAGINATION_SEED, PAGINATION_COLUMNS } from "./table-shared";
/** DataContainer 的第 1 个示例 */
export function DataContainerExample1() {
    const PAGE_SIZE = 10;
    const [page, setPage] = React.useState(1);
    const [loading, setLoading] = React.useState(false);
    const [accumulated, setAccumulated] = React.useState(6);
    const [allLoaded, setAllLoaded] = React.useState(false);
    const loadMore = React.useCallback(() => {
        setLoading(true);
        window.setTimeout(() => {
            setAccumulated((prev) => {
                const next = prev + 4;
                if (next >= PAGINATION_SEED.length) setAllLoaded(true);
                return Math.min(next, PAGINATION_SEED.length);
            });
            setLoading(false);
        }, 400);
    }, []);
    const onPageChange = React.useCallback((next: number) => {
        setPage(next);
    }, []);
    return (
        <Block>
                        {/*
                         * ① 这一份**不传 forceMode**：宽度决定形态。
                         * PC → 分页条；H5 → 触底哨兵。这是「PC 分页 / H5 触底」最常见的一档，
                         * 也是验证台应该展示的主形态 —— 用两份 forceMode 硬编码的实例冒充
                         * 「同一份配置」会掩盖问题（H5 视口下仍强出分页条，看起来像 H5 有分页）。
                         */}
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ① auto（默认）：宽屏出分页条，窄屏出触底哨兵 —— 这一份组件没传
                                    forceMode，缩放窗口跨 768px 就能看到形态自己变
                                </p>
                                <DataContainer
                                    total={PAGINATION_SEED.length}
                                    pageSize={PAGE_SIZE}
                                    current={page}
                                    onPageChange={onPageChange}
                                    loading={loading}
                                    finished={allLoaded}
                                    onLoad={loadMore}
                                >
                                    {(currentPage: number, size: number) => (
                                        <Table
                                            columns={PAGINATION_COLUMNS}
                                            data={PAGINATION_SEED.slice(
                                                (currentPage - 1) * size,
                                                currentPage * size,
                                            )}
                                        />
                                    )}
                                </DataContainer>
                                <span className="text-bv-sm text-bv-text-2">当前页：{page}</span>
                            </div>
                        </Row>
        
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ② loadStrategy=&quot;pagination&quot;：两端都分页（记录详情页，手机也要一页一页翻）
                                </p>
                                <DataContainer
                                    loadStrategy="pagination"
                                    total={PAGINATION_SEED.length}
                                    pageSize={PAGE_SIZE}
                                    pageSizeOptions={[10, 20]}
                                >
                                    <Table
                                        columns={PAGINATION_COLUMNS}
                                        data={PAGINATION_SEED.slice(0, PAGE_SIZE)}
                                    />
                                </DataContainer>
                            </div>
        
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ③ loadStrategy=&quot;infinite&quot;：两端都触底哨兵（2000 条看板，PC 也要滑）
                                </p>
                                <DataContainer
                                    loadStrategy="infinite"
                                    loading={loading}
                                    finished={allLoaded}
                                    onLoad={loadMore}
                                >
                                    <Table
                                        columns={PAGINATION_COLUMNS}
                                        data={PAGINATION_SEED.slice(0, accumulated)}
                                    />
                                </DataContainer>
                            </div>
                        </Row>
                    </Block>
    );
}
export function DataContainerDemos() {
    
        
        
        
        
        
    
        
    
        // 切页回调（两端都分页时业务用它换 data；auto 下 PC 侧生效）
    return (
            <Section title="P3 · DataContainer 加载层（只管「数据怎么来」，对内容层透明）">
                <DataContainerExample1 />
            </Section>
        );
}