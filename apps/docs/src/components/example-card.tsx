import { useState } from 'react';
import { DualFrame } from './device-frame';

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
    const text = [code?.setup, code?.code].filter(Boolean).join('\n\n');
    const hasCode = Boolean(text.trim());

    return (
        <section id={id} className="scroll-mt-20">
            <h3 className="mb-bv-xs text-bv-md font-bv-bold text-bv-text">
                {title}
            </h3>
            {desc && (
                <p className="mb-bv-sm text-bv-sm text-bv-text-2">{desc}</p>
            )}

            <div className="rounded-bv-md border border-bv-border bg-bv-surface p-bv-md">
                <DualFrame h5={children} pc={children} />
            </div>

            {hasCode && (
                <div className="mt-bv-xs">
                    <div className="flex items-center gap-bv-xs">
                        <button
                            type="button"
                            onClick={() => setShowCode(!showCode)}
                            aria-expanded={showCode}
                            className="cursor-pointer rounded-bv-sm border border-bv-border px-bv-xs py-[3px] text-bv-sm text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary"
                        >
                            {showCode ? '收起代码' : '查看代码'}
                        </button>
                        <CopyButton text={text} />
                    </div>

                    {showCode && (
                        <div className="mt-bv-xs overflow-hidden rounded-bv-md border border-bv-border">
                            <CodePanel code={text} />
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}

/** 复制按钮 —— Ant/Element 的代码块都有 */
function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    return (
        <button
            type="button"
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
            className="cursor-pointer rounded-bv-sm border border-bv-border px-bv-xs py-[3px] text-bv-sm text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary"
        >
            {copied ? '已复制' : '复制代码'}
        </button>
    );
}

/** 代码面板（深底浅字 —— 代码块的通行观感） */
function CodePanel({ code }: { code: string }) {
    return (
        <pre className="overflow-x-auto bg-[#1c1e24] p-bv-md text-[12.5px] leading-relaxed">
            <code className="font-mono text-[#e6e8ee]">{code}</code>
        </pre>
    );
}
