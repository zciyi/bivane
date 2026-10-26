import * as React from 'react';

const COMPONENTS_JSON = `{
  "registries": {
    "@bivane": "https://zciyi.github.io/bivane/r/{name}.json"
  }
}`;

const INSTALL_CMDS = `# 1) 先装 token（组件全靠它）
npx shadcn@latest add @bivane/tokens

# 2) 再装组件（自动递归带上依赖的 hooks / ui 件）
npx shadcn@latest add @bivane/dialog`;

function CodeBlock({ title, code }: { title: string; code: string }) {
    const [copied, setCopied] = React.useState(false);
    const onCopy = React.useCallback(async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }, [code]);
    return (
        <div className="overflow-hidden rounded-docs-lg border border-bv-border bg-bv-background">
            <div className="flex items-center justify-between border-b border-bv-border px-bv-sm py-bv-xs">
                <span className="text-bv-xs text-bv-text-2">{title}</span>
                <button
                    type="button"
                    onClick={onCopy}
                    aria-label={`复制${title}`}
                    className="web-focus rounded px-bv-xs py-[1px] text-bv-xs text-bv-primary transition-colors hover:bg-bv-primary/5"
                >
                    {copied ? '已复制' : '复制'}
                </button>
            </div>
            <pre className="web-code overflow-x-auto px-bv-sm py-bv-sm text-bv-text">
                <code>{code}</code>
            </pre>
        </div>
    );
}

export function QuickStart() {
    return (
        <section
            id="start"
            className="border-t border-bv-border bg-bv-surface/40 py-bv-xl"
        >
            <div className="mx-auto max-w-3xl px-bv-md">
                <h2 className="text-docs-h2 font-bv-bold tracking-tight">快速开始</h2>
                <p className="mt-bv-xs text-bv-text-2">
                    Bivane 不在官方源，必须先声明命名空间，否则{' '}
                    <code className="web-code text-bv-primary">shadcn add @bivane/*</code>{' '}
                    会报 Unknown registry。
                </p>

                <div className="mt-bv-lg flex flex-col gap-bv-md">
                    <CodeBlock title="components.json" code={COMPONENTS_JSON} />
                    <CodeBlock title="安装命令" code={INSTALL_CMDS} />
                </div>

                <p className="mt-bv-md text-bv-sm text-bv-text-2">
                    然后在项目的{' '}
                    <code className="web-code text-bv-text">globals.css</code> 里按序引入
                    token（<code className="web-code text-bv-text">vant / vant-dark / modes / utilities / theme</code>），
                    即可在业务代码里使用 <code className="web-code text-bv-primary">&lt;Dialog&gt;</code>{' '}
                    等组件。
                </p>
            </div>
        </section>
    );
}
