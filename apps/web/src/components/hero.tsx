import * as React from 'react';
import { DualFrame } from './device-frame';
import { Select } from '@/components/responsive/select';
import { DatePicker } from '@/components/responsive/date-picker';
import type { SelectItem } from '@/hooks/use-select-state';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { showConfirmDialog, showDialog } from '@/components/responsive/dialog';

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

const INSTALL_TOKENS = 'npx shadcn@latest add @bivane/tokens';
const INSTALL_DIALOG = 'npx shadcn@latest add @bivane/dialog';

function CopyBlock({ text, label }: { text: string; label: string }) {
    const [copied, setCopied] = React.useState(false);
    const onCopy = React.useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }, [text]);
    return (
        <div className="flex items-stretch gap-bv-xs rounded-docs-lg border border-bv-border bg-bv-background">
            <code className="web-code flex-1 overflow-x-auto px-bv-sm py-bv-sm text-bv-text">
                <span className="select-none text-bv-text-3">$ </span>
                {text}
            </code>
            <button
                type="button"
                onClick={onCopy}
                aria-label={`复制${label}`}
                className="web-focus cursor-pointer border-l border-bv-border px-bv-sm text-bv-sm text-bv-primary transition-colors hover:bg-bv-primary/5"
            >
                {copied ? '已复制' : '复制'}
            </button>
        </div>
    );
}

/** Hero 双端演示：同一个 Select，两端交互不同（props 完全一致） */
function HeroSelectDemo() {
    return (
        <div className="flex flex-col gap-bv-gutter p-bv-md">
            <p className="text-bv-xs text-bv-text-2">选择城市（点开看两端差异）</p>
            <div className="w-full">
                <Select
                    ariaLabel="城市"
                    placeholder="请选择城市"
                    options={CITY_OPTIONS}
                />
            </div>
            <div className="flex flex-wrap items-center gap-bv-xs">
                <Tag type="primary">主要</Tag>
                <Tag type="success">成功</Tag>
                <Tag type="warning">警告</Tag>
            </div>
        </div>
    );
}

export function Hero() {
    return (
        <section id="hero" className="web-hero border-b border-bv-border">
            <div className="mx-auto max-w-6xl px-bv-md py-bv-xl">
                <div className="grid gap-bv-xl lg:grid-cols-2 lg:items-center">
                    <div className="flex flex-col gap-bv-md">
                        <span className="w-fit rounded-full border border-bv-primary/30 bg-bv-primary/10 px-bv-sm py-[2px] text-[12px] font-bv-bold text-bv-primary">
                            React 双端组件库
                        </span>
                        <div>
                            <h1 className="text-docs-display font-bv-bold tracking-tight">
                                Bivane{' '}
                                <span className="text-bv-text-2">碧帆</span>
                            </h1>
                            <p className="mt-bv-xs font-mono text-bv-sm text-bv-text-2">
                                /baɪˈveɪn/
                            </p>
                        </div>
                        <p className="text-docs-lead text-bv-text">
                            一套组件 API，小屏走 H5 交互、大屏走 PC 交互。
                            以 Vant 设计语言为视觉源，用 React + Tailwind 重写，
                            以 shadcn copy-paste 形态分发。
                        </p>

                        <div className="flex flex-col gap-bv-xs">
                            <CopyBlock text={INSTALL_TOKENS} label="安装 token" />
                            <CopyBlock text={INSTALL_DIALOG} label="安装组件" />
                        </div>

                        <div className="flex flex-wrap items-center gap-bv-sm pt-bv-xs">
                            <a
                                href="#components"
                                className="web-focus inline-flex h-10 items-center rounded-[var(--bv-radius-md)] bg-bv-primary px-bv-md font-bv-bold text-bv-white transition-opacity hover:opacity-90"
                            >
                                浏览组件
                            </a>
                            <Button
                                type="primary"
                                plain
                                onClick={() =>
                                    showConfirmDialog({
                                        title: '体验双端',
                                        message:
                                            '这个对话框在窄屏是底部抽屉、宽屏是居中模态——同一份 API，交互随屏幕自适应。',
                                        confirmText: '知道了',
                                    })
                                }
                            >
                                体验 Dialog
                            </Button>
                            <Button
                                type="primary"
                                plain
                                onClick={() =>
                                    showDialog({
                                        title: '体验 Select',
                                        confirmText: '关闭',
                                        children: (
                                            <div className="flex w-full flex-col gap-bv-md py-bv-xs text-left">
                                                <p className="text-bv-sm text-bv-text-2">
                                                    同一个 &lt;Select&gt;：窄屏弹底部列表、宽屏出锚定浮层
                                                    ——props 完全一致，差异只在交互。
                                                </p>
                                                <Select
                                                    ariaLabel="城市"
                                                    placeholder="请选择城市"
                                                    options={CITY_OPTIONS}
                                                />
                                            </div>
                                        ),
                                    })
                                }
                            >
                                体验 Select
                            </Button>
                            <Button
                                type="primary"
                                plain
                                onClick={() =>
                                    showDialog({
                                        title: '体验 DatePicker',
                                        confirmText: '关闭',
                                        children: (
                                            <div className="flex w-full flex-col gap-bv-md py-bv-xs text-left">
                                                <p className="text-bv-sm text-bv-text-2">
                                                    同一个 &lt;DatePicker&gt;：窄屏弹三列滚轮、宽屏出月历面板
                                                    ——props 完全一致，差异只在交互。
                                                </p>
                                                <DatePicker ariaLabel="日期" placeholder="请选择日期" />
                                            </div>
                                        ),
                                    })
                                }
                            >
                                体验 Date-Picker
                            </Button>
                        </div>
                    </div>

                    <DualFrame stack h5={<HeroSelectDemo />} pc={<HeroSelectDemo />} />
                </div>

                <p className="mt-bv-md text-center text-bv-xs text-bv-text-2">
                    同一份 &lt;Select&gt;，小屏弹底部列表、大屏出锚定浮层 —— props
                    完全一致，差异只在交互。
                </p>
            </div>
        </section>
    );
}
