import { useState } from 'react';
import { DualFrame } from './device-frame';
import { ChromeButton } from './doc-parts';

/**
 * 示例卡片（Ant Design / Element 的「示例」区块）
 *
 * 一张卡片 = 标题 + 说明 + **并排的 H5/PC 演示** + 可展开的源码。
 *
 * 与它们的差别只在演示形态：Ant/Element 只有一种形态，
 * 我们有两端 —— 所以每张卡片里是 H5 帧与 PC 帧并排。
 *
 * 源码是**自动抽出来的**（scripts/extract-examples.mjs 从 demos/ 抽），
 * 与实际渲染的代码同源，不会漂移。
 */

export interface ExampleCode {
    /** 示例里的 state / 回调声明（可空） */
    setup: string;
    /** 示例的 JSX（已剥掉验证台的布局壳） */
    code: string;
    /** 示例引用到的模块级常量 / 类型（可空） */
    consts?: string;
    /** 示例引用到的 import 语句（可空） */
    imports?: string;
    /** 示例组件的形参（少数示例靠父组件传 props，如 Switch 的联动开关） */
    params?: string;
}

export function ExampleCard({
    id,
    title,
    desc,
    code,
    children,
}: {
    id: string;
    title: string;
    desc?: string;
    code?: ExampleCode;
    children: React.ReactNode;
}) {
    const [showCode, setShowCode] = useState(false);
    const text = [code?.imports, code?.consts, code?.setup, code?.code]
        .filter(Boolean)
        .join('\n\n');
    const hasCode = Boolean(text.trim());

    return (
        <section id={id} className="scroll-mt-20">
            <div className="overflow-hidden rounded-docs-lg border border-bv-border bg-bv-surface shadow-docs-card">
                {/* 卡头：标题居左，操作居右 —— 按钮收进卡头比放在卡下方省一行纵向空间 */}
                <div className="flex flex-wrap items-center gap-bv-xs border-b border-bv-border bg-bv-muted/40 px-bv-md py-bv-xs">
                    <h3 className="text-docs-h3 font-bv-bold text-bv-text">
                        {title}
                    </h3>
                    {hasCode && (
                        <div className="ml-auto flex items-center gap-bv-xs">
                            <ChromeButton
                                onClick={() => setShowCode(!showCode)}
                                aria-expanded={showCode}
                            >
                                {showCode ? '收起代码' : '查看代码'}
                            </ChromeButton>
                            <CopyButton text={text} />
                        </div>
                    )}
                </div>

                {desc && (
                    <p className="px-bv-md pt-bv-xs text-[13px] text-bv-text-2">
                        {desc}
                    </p>
                )}

                <div className="p-bv-md">
                    <DualFrame h5={children} pc={children} />
                </div>

                {showCode && (
                    <div className="border-t border-bv-border">
                        <CodePanel code={text} />
                    </div>
                )}
            </div>
        </section>
    );
}

/** 复制按钮 —— Ant/Element 的代码块都有 */
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <ChromeButton
            onClick={() => {
                // navigator.clipboard 在非安全上下文（http://）下不可用
                // → 退回老办法，别静默失败
                const done = () => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                };
                if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(text).then(done, () => {});
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed';
                    ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select();
                    try {
                        document.execCommand('copy');
                        done();
                    } catch {
                        /* 复制失败就静默 —— 用户还能手动选 */
                    }
                    document.body.removeChild(ta);
                }
            }}
        >
            {copied ? '已复制' : '复制代码'}
        </ChromeButton>
    );
}

/** 代码面板（深底浅字 —— 代码块的通行观感） */
function CodePanel({ code }: { code: string }) {
    return (
        <pre className="overflow-x-auto bg-[#17191f] p-bv-md text-[12.5px] leading-relaxed">
            <code className="font-mono text-[#e6e8ee]">{code}</code>
        </pre>
    );
}
