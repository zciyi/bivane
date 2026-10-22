/**
 * Search 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Search } from '@/components/responsive/search';
const SEARCH_HOT_WORDS = ["苹果手机", "苹果电脑", "苹果手表", "香蕉手机", "香蕉牛奶", "橙子"];
/** Search 的第 1 个示例 */
export function SearchExample1() {
    const [log, setLog] = React.useState<string>("（尚未提交）");
    const [history, setHistory] = React.useState<string[]>(["苹果", "耳机"]);
    const fetchSuggestions = React.useCallback((kw: string) => {
        const key = kw.trim();
        return Promise.resolve(
            SEARCH_HOT_WORDS.filter((item) => item.includes(key)).slice(0, 5),
        );
    }, []);
    return (
        <Block>
                        <Row>
                            <div className="w-full max-w-[320px]">
                                <Search
                                    suggestions={["苹果", "香蕉", "橙子", "草莓"]}
                                    onSearch={(kw) => setLog(`静态建议提交：${kw}`)}
                                    ariaLabel="静态建议搜索"
                                />
                            </div>
                            <span className="text-bv-text-2">{log}</span>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[320px]">
                                <Search
                                    onFetchSuggestions={fetchSuggestions}
                                    debounce={300}
                                    placeholder="异步建议（防抖 300ms）"
                                    onSearch={(kw) => setLog(`异步建议提交：${kw}`)}
                                    ariaLabel="异步建议搜索"
                                />
                            </div>
                            <span className="text-bv-text-2">输入后 ↑↓ 巡航 / Enter 选中 / Esc 关闭（PC）</span>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[320px]">
                                <Search
                                    history={history}
                                    onHistoryChange={setHistory}
                                    suggestions={["iPhone", "iPad", "iMac"]}
                                    placeholder="搜历史（H5 全屏页展示）"
                                    onSearch={(kw) => setLog(`历史/建议提交：${kw}`)}
                                    ariaLabel="历史搜索"
                                />
                            </div>
                            <span className="text-bv-text-2">历史：{history.join("、") || "（空）"}</span>
                        </Row>
                        <Row>
                            <div className="w-full max-w-[320px]">
                                <Search shape="square" clearable placeholder="square 形状" ariaLabel="方形" />
                            </div>
                            <div className="w-full max-w-[320px]">
                                <Search disabled placeholder="禁用" ariaLabel="禁用" />
                            </div>
                        </Row>
                    </Block>
    );
}
export function SearchDemos() {
    
        
        // 历史受控：真实场景接 localStorage / 接口
        
    
        // 异步建议源：按关键词过滤全集，Promise.resolve 模拟远程请求（配合 debounce）
    return (
            <Section title="P3 · Search 搜索（模式 C：H5 内联条→全屏页+历史 / PC 内联→建议浮层）">
                <SearchExample1 />
            </Section>
        );
}