/**
 * TagBadge 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import { Block, Row, Section } from './layout';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/components/ui/tag';
/** TagBadge 的第 1 个示例 */
export function TagBadgeExample1() {
    return (
        <Block>
                                <Row>
                                    <Tag>默认</Tag>
                                    <Tag type="primary">主要</Tag>
                                    <Tag type="success">成功</Tag>
                                    <Tag type="danger">危险</Tag>
                                    <Tag type="warning">警告</Tag>
                                    <Tag type="primary" plain>
                                        朴素
                                    </Tag>
                                    <Tag type="primary" round>
                                        圆角
                                    </Tag>
                                    <Tag type="primary" mark>
                                        标记
                                    </Tag>
                                    <Tag size="large" type="success">
                                        大号
                                    </Tag>
                                    <Tag
                                        type="danger"
                                        closeable
                                        onClose={() => undefined}
                                    >
                                        可关闭
                                    </Tag>
                                    <Badge content={5} />
                                    <Badge content={100} />
                                    <Badge content={100} max={999} />
                                    <Badge dot />
                                    <Badge content={12}>
                                        <span className="inline-block rounded-bv-md bg-bv-muted px-bv-md py-bv-xs">
                                            消息
                                        </span>
                                    </Badge>
                                </Row>
                            </Block>
    );
}
export function TagBadgeDemos() {
    return (
    <Section title="Tag / Badge">
                        <TagBadgeExample1 />
                    </Section>
        );
}