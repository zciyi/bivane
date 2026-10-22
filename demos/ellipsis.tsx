/**
 * Ellipsis 组件的演示
 *
 * 与其它 demo 一样：验证台与文档站共用同一份。
 */
import { Ellipsis } from '@/components/ui/ellipsis';
import { Block, Row, Section } from './layout';
const LONG_TEXT =
    'Bivane 是一套双端自适应的 React 组件库：同一套 API，小屏走 H5 交互，大屏走 PC 交互。' +
    '组件只声明语义 token，不硬编码色值，因此换主题、换品牌色都不需要改组件代码。' +
    '这段文字用来演示多行截断与展开 / 收起。';
/** Ellipsis 的第 1 个示例 */
export function EllipsisExample1() {
    return (
        <Block>
                            <Ellipsis>{LONG_TEXT}</Ellipsis>
                        </Block>
    );
}
/** Ellipsis 的第 2 个示例 */
export function EllipsisExample2() {
    return (
        <Block>
                            <Row>
                                <div className="w-full">
                                    <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                        rows = 1
                                    </p>
                                    <Ellipsis rows={1}>{LONG_TEXT}</Ellipsis>
                                </div>
                                <div className="w-full">
                                    <p className="mb-bv-xs text-bv-sm text-bv-text-2">
                                        rows = 3
                                    </p>
                                    <Ellipsis rows={3}>{LONG_TEXT}</Ellipsis>
                                </div>
                            </Row>
                        </Block>
    );
}
export function EllipsisDemos() {
    return (
            <>
                <Section title="Ellipsis 多行截断（默认 2 行）">
                    <EllipsisExample1 />
                </Section>
    
                <Section title="Ellipsis 指定行数">
                    <EllipsisExample2 />
                </Section>
            </>
        );
}