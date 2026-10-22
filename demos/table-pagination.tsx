/**
 * TablePagination 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Table } from '@/components/responsive/table';
import { PAGINATION_SEED, PAGINATION_COLUMNS } from "./table-shared";
/** TablePagination 的第 1 个示例 */
export function TablePaginationExample1() {
    const [localPage, setLocalPage] = React.useState(1);
    const PAGE_SIZE = 10;
    const [remotePage, setRemotePage] = React.useState(1);
    const remoteSlice = React.useMemo(
        () =>
            PAGINATION_SEED.slice(
                (remotePage - 1) * PAGE_SIZE,
                remotePage * PAGE_SIZE,
            ),
        [remotePage],
    );
    return (
        <Block>
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ① local 模式：data 给全量，组件自己按页切（受控 current，外部也可驱动）
                                </p>
                                <div className="overflow-hidden rounded-bv-lg bg-bv-surface">
                                    <Table
                                        forceMode="desktop"
                                        columns={PAGINATION_COLUMNS}
                                        data={PAGINATION_SEED}
                                        pagination
                                        paginationMode="local"
                                        pageSize={10}
                                        current={localPage}
                                        onPageChange={setLocalPage}
                                    />
                                </div>
                                <button
                                    type="button"
                                    className="mt-bv-sm cursor-pointer border-0 bg-transparent p-0 text-bv-sm text-bv-primary"
                                    onClick={() => setLocalPage(1)}
                                >
                                    外部重置到第 1 页（当前 {localPage}）
                                </button>
                            </div>
        
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ② remote 模式（默认）：data 是当页数据，组件不切片；切页由业务换 data
                                </p>
                                <div className="overflow-hidden rounded-bv-lg bg-bv-surface">
                                    <Table
                                        forceMode="desktop"
                                        columns={PAGINATION_COLUMNS}
                                        data={remoteSlice}
                                        pagination
                                        pageSize={PAGE_SIZE}
                                        total={PAGINATION_SEED.length}
                                        pageSizeOptions={[10, 20, 50]}
                                        current={remotePage}
                                        onPageChange={(page) => setRemotePage(page)}
                                    />
                                </div>
                                <span className="text-bv-sm text-bv-text-2">
                                    业务持有的当前页：{remotePage}
                                </span>
                            </div>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[480px]">
                                <p className="mb-bv-sm text-bv-sm text-bv-text-2">
                                    ③ startPage=0：后端页码从 0 开始时（页码显示成 0…4）
                                </p>
                                <div className="overflow-hidden rounded-bv-lg bg-bv-surface">
                                    <Table
                                        forceMode="desktop"
                                        columns={PAGINATION_COLUMNS}
                                        data={PAGINATION_SEED}
                                        pagination
                                        paginationMode="local"
                                        pageSize={10}
                                        startPage={0}
                                        total={PAGINATION_SEED.length}
                                    />
                                </div>
                            </div>
                        </Row>
                    </Block>
    );
}
export function TablePaginationDemos() {
    
        // 1. local：组件按页切片
        
    
        // 2. remote：业务自己按页取数（这里用切片模拟接口返回）
    return (
            <Section title="P3 · Table 分页（PC 端：开关 / 本地远程 / 每页条数 / 起始页 / 总数 / 跳页 / 受控）">
                <TablePaginationExample1 />
            </Section>
        );
}