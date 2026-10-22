/**
 * Cell 组件的演示
 *
 * 与其它 demo 一样：验证台与文档站共用同一份。
 */
import { Section } from './layout';
import { Badge } from '@/components/ui/badge';
import { Cell, CellGroup } from '@/components/ui/cell';
import { Icon } from '@/components/ui/icon';
import { Tag } from '@/components/ui/tag';

/** Cell 的第 1 个示例：分组里的各种行形态。 */
export function CellExample1() {
    return (
        <CellGroup title="带标题的分组">
            <Cell title="普通行" value="内容" />
            <Cell title="大号行" large value="18px 标题" />
            <Cell title="居中" center value="垂直居中" />
            <Cell title="无下边框" border={false} value="最后一行" />
        </CellGroup>
    );
}

/** Cell 的第 2 个示例：卡片内嵌形态（inset）。 */
export function CellExample2() {
    return (
        <div className="px-bv-md">
            {/* inset 卡片默认带 16px 外边距，这里用 className 归零，让卡片与页面基准线对齐 */}
            <CellGroup inset className="mx-0">
                <Cell title="单元格" value="内容" />
                <Cell title="带描述" label="描述信息描述信息" value="内容" />
                <Cell title="链接项" isLink onClick={() => undefined} />
                <Cell
                    title="必填项"
                    required
                    value={
                        <Tag type="primary" size="medium">
                            标签
                        </Tag>
                    }
                />
                <Cell
                    title="自定义图标"
                    icon={<Icon name="info" size={16} />}
                    value={<Badge content={5} />}
                />
            </CellGroup>
        </div>
    );
}

export function CellDemos() {
    return (
        <>
            <Section title="Cell 单元格（分组）">
                <CellExample1 />
            </Section>
            <Section title="Cell 单元格（卡片 inset）">
                <CellExample2 />
            </Section>
        </>
    );
}
