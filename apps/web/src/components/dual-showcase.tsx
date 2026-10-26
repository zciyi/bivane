import * as React from 'react';
import { DualFrame } from './device-frame';
import { Select } from '@/components/responsive/select';
import type { SelectItem } from '@/hooks/use-select-state';
import { Tabs, Tab } from '@/components/responsive/tabs';
import { DatePicker } from '@/components/responsive/date-picker';

const CITY_OPTIONS: SelectItem[] = [
    { label: '北京', value: 'bj' },
    { label: '上海', value: 'sh' },
    { label: '广州', value: 'gz' },
    { label: '深圳', value: 'sz' },
    { label: '杭州', value: 'hz' },
    { label: '成都', value: 'cd', disabled: true },
    { label: '武汉', value: 'wh' },
    { label: '西安', value: 'xa' },
    { label: '南京', value: 'nj' },
    { label: '重庆', value: 'cq' },
    { label: '长沙', value: 'cs' },
    { label: '青岛', value: 'qd' },
];

/** 每个帧内独立实例：各自持有 state，互不干扰（DeviceFrame 已强制 mode） */
function ShowcaseTabs() {
    const [active, setActive] = React.useState(0);
    return (
        <Tabs value={active} onChange={setActive}>
            <Tab title="概览">概览内容区</Tab>
            <Tab title="动态">动态内容区</Tab>
            <Tab title="我的">我的内容区</Tab>
        </Tabs>
    );
}

function ShowcaseInner() {
    return (
        <div className="flex flex-col gap-bv-gutter p-bv-md">
            <div>
                <p className="mb-bv-xs text-bv-xs text-bv-text-2">Select 选择器</p>
                <Select ariaLabel="城市" placeholder="请选择城市" options={CITY_OPTIONS} />
            </div>
            <div>
                <p className="mb-bv-xs text-bv-xs text-bv-text-2">Tabs 标签页</p>
                <ShowcaseTabs />
            </div>
            <div>
                <p className="mb-bv-xs text-bv-xs text-bv-text-2">DatePicker 日期</p>
                <DatePicker
                    ariaLabel="日期"
                    title="选择日期"
                    placeholder="请选择日期"
                />
            </div>
        </div>
    );
}

export function DualShowcase() {
    return (
        <section
            id="showcase"
            className="border-y border-bv-border bg-bv-surface/40 py-bv-xl"
        >
            <div className="mx-auto max-w-6xl px-bv-md">
                <h2 className="text-docs-h2 font-bv-bold tracking-tight">
                    同一套组件，两端各自交互
                </h2>
                <p className="mt-bv-xs text-bv-text-2">
                    左为小屏（H5）交互，右为大屏（PC）交互。下方每个组件都用了完全相同的
                    props。
                </p>
                <div className="mt-bv-lg">
                    <DualFrame h5={<ShowcaseInner />} pc={<ShowcaseInner />} />
                </div>
                <ul className="mt-bv-lg grid gap-bv-sm text-bv-sm text-bv-text-2 md:grid-cols-3">
                    <li>
                        <span className="font-bv-bold text-bv-text">Select：</span>
                        H5 底部弹层列表 / PC 锚定浮层 + 键盘巡航。
                    </li>
                    <li>
                        <span className="font-bv-bold text-bv-text">Tabs：</span>
                        H5 标签条横滑 + 手势 / PC 不滑动 + 键盘 + 下划线。
                    </li>
                    <li>
                        <span className="font-bv-bold text-bv-text">DatePicker：</span>
                        H5 三列滚轮吸附 / PC 月历面板 + 焦点导航。
                    </li>
                </ul>
            </div>
        </section>
    );
}
