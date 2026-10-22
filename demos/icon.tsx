/**
 * Icon 组件的演示
 *
 * 与其它 demo 一样：验证台与文档站共用同一份。
 */
import { Icon, iconNames } from '@/components/ui/icon';
import { Block, Row, Section } from './layout';
/** Icon 的第 1 个示例 */
export function IconExample1() {
    return (
        <Block>
                            <Row>
                                {iconNames.map((name) => (
                                    <span
                                        key={name}
                                        className="flex w-[64px] flex-col items-center gap-bv-xs text-bv-sm text-bv-text-2"
                                    >
                                        <Icon name={name} size={22} />
                                        <span className="text-[11px]">{name}</span>
                                    </span>
                                ))}
                            </Row>
                        </Block>
    );
}
/** Icon 的第 2 个示例 */
export function IconExample2() {
    return (
        <Block>
                            <Row>
                                <Icon name="success" size={16} />
                                <Icon name="success" size={20} />
                                <Icon name="success" size={24} />
                                <Icon name="success" size={32} />
                                <Icon name="fail" size={24} color="var(--bv-danger)" />
                                <Icon
                                    name="warning"
                                    size={24}
                                    color="var(--bv-warning)"
                                />
                                {/* 尺寸不传时是 1em，跟随字号 */}
                                <span className="text-bv-lg text-bv-primary">
                                    <Icon name="star" />
                                </span>
                            </Row>
                        </Block>
    );
}
export function IconDemos() {
    return (
            <>
                <Section title="Icon 图标集">
                    <IconExample1 />
                </Section>
    
                <Section title="Icon 尺寸与颜色">
                    <IconExample2 />
                </Section>
            </>
        );
}