/**
 * Checkbox 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { isChoiceTarget } from './choice';
import { Cell, CellGroup } from '@/components/ui/cell';
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox';
const FRUIT_OPTIONS: ReadonlyArray<{
    name: string;
    label: string;
    disabled?: boolean;
}> = [
    { name: "apple", label: "苹果" },
    { name: "banana", label: "香蕉" },
    { name: "orange", label: "橙子（缺货）", disabled: true },
];
/** Checkbox 的第 1 个示例 */
export function CheckboxExample1() {
    return (
        <Block>
                        <Row>
                            <Checkbox defaultChecked>圆形（默认）</Checkbox>
                            <Checkbox shape="square" defaultChecked>
                                方形
                            </Checkbox>
                            <Checkbox checked={false} indeterminate>
                                半选态
                            </Checkbox>
                            <Checkbox labelPosition="left">文字在左</Checkbox>
                            <Checkbox labelDisabled>文字不可点</Checkbox>
                            <Checkbox disabled>禁用</Checkbox>
                            <Checkbox disabled defaultChecked>
                                禁用选中
                            </Checkbox>
                        </Row>
                    </Block>
    );
}
/** Checkbox 的第 2 个示例 */
export function CheckboxExample2() {
    const [fruits, setFruits] = React.useState<string[]>(["apple"]);
    const toggleFruit = (name: string) => {
        setFruits((prev) => {
            const has = prev.includes(name);
            // 上限只约束新增，与 CheckboxGroup max 语义一致
            if (!has && prev.length >= 2) return prev;
            return has ? prev.filter((item) => item !== name) : [...prev, name];
        });
    };
    return (
        <Block className="p-0">
                        <CellGroup inset className="mx-0">
                            <CheckboxGroup
                                value={fruits}
                                max={2}
                                onChange={(names) => setFruits(names as string[])}
                            >
                                {FRUIT_OPTIONS.map((item) => (
                                    <Cell
                                        key={item.name}
                                        center
                                        title={item.label}
                                        onClick={(event) => {
                                            if (item.disabled || isChoiceTarget(event))
                                                return;
                                            toggleFruit(item.name);
                                        }}
                                        rightIcon={
                                            <Checkbox
                                                name={item.name}
                                                disabled={item.disabled}
                                                ariaLabel={item.label}
                                            />
                                        }
                                    />
                                ))}
                            </CheckboxGroup>
                        </CellGroup>
                        <p className="px-bv-md py-bv-sm text-bv-sm text-bv-text-2">
                            已选 {fruits.length}/2：{fruits.join("、") || "无"}
                            （整行可点；达到上限后其余项自动禁用）
                        </p>
                    </Block>
    );
}
/** Checkbox 的第 3 个示例 */
export function CheckboxExample3() {
    const [hobbies, setHobbies] = React.useState<string[]>(["reading"]);
    return (
        <Block>
                        <CheckboxGroup
                            direction="horizontal"
                            value={hobbies}
                            onChange={(names) => setHobbies(names as string[])}
                        >
                            <Checkbox name="reading">阅读</Checkbox>
                            <Checkbox name="music">音乐</Checkbox>
                            <Checkbox name="sports">运动</Checkbox>
                            <Checkbox name="travel">旅行</Checkbox>
                        </CheckboxGroup>
                    </Block>
    );
}
/** Checkbox 的第 4 个示例 */
export function CheckboxExample4() {
    const [plans, setPlans] = React.useState<string[]>(["a"]);
    const allChecked = plans.length === 3;
    const partial = plans.length > 0 && !allChecked;
    return (
        <Block>
                        <div className="flex flex-col gap-bv-gutter">
                            <Checkbox
                                checked={allChecked}
                                indeterminate={partial}
                                onChange={(checked) =>
                                    setPlans(checked ? ["a", "b", "c"] : [])
                                }
                            >
                                全选{partial ? "（部分）" : ""}
                            </Checkbox>
                            <CheckboxGroup
                                direction="horizontal"
                                value={plans}
                                onChange={(names) => setPlans(names as string[])}
                            >
                                <Checkbox name="a">方案 A</Checkbox>
                                <Checkbox name="b">方案 B</Checkbox>
                                <Checkbox name="c">方案 C</Checkbox>
                            </CheckboxGroup>
                        </div>
                    </Block>
    );
}
export function CheckboxDemos() {
    
        // Cell 整行点击演示：组受控 + max=2，行点击与组内 Checkbox 走同一份更新逻辑
    return (
            <Section title="P3 · Checkbox 复选框（模式 A：H5 整行可点 / PC 键盘焦点环）">
                <CheckboxExample1 />
                <CheckboxExample2 />
                <CheckboxExample3 />
                <CheckboxExample4 />
            </Section>
        );
}