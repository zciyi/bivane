import * as React from 'react';

const GITHUB_URL = 'https://github.com/zciyi/bivane';

/** 深浅主题开关：class 挂在 <html> 上（portal 在 body 下，挂根 div 无效） */
function useThemeToggle() {
    const [dark, setDark] = React.useState(false);
    React.useEffect(() => {
        document.documentElement.classList.toggle('bv-theme-dark', dark);
    }, [dark]);
    return { dark, setDark };
}

export function Header() {
    const { dark, setDark } = useThemeToggle();
    return (
        <header className="sticky top-0 z-30 border-b border-bv-border bg-bv-surface/85 shadow-docs-header backdrop-blur-md">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-bv-md px-bv-md">
                <a href="#top" className="web-focus flex items-center gap-bv-xs rounded-lg">
                    <span
                        aria-hidden="true"
                        className="grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-[var(--bv-primary)] to-[color-mix(in_srgb,var(--bv-primary)_55%,black)] text-[15px] font-bv-bold text-bv-white shadow-[0_2px_8px_color-mix(in_srgb,var(--bv-primary)_45%,transparent)]"
                    >
                        B
                    </span>
                    <span className="text-[17px] font-bv-bold tracking-tight">Bivane</span>
                </a>
                <span className="hidden text-bv-sm text-bv-text-2 lg:block">
                    一套 API，两端各得其所
                </span>
                <div className="flex-1" />

                <nav className="hidden items-center gap-bv-md text-bv-sm text-bv-text-2 md:flex">
                    <a href="#features" className="web-focus rounded px-1 hover:text-bv-primary">
                        特性
                    </a>
                    <a href="#showcase" className="web-focus rounded px-1 hover:text-bv-primary">
                        演示
                    </a>
                    <a href="#components" className="web-focus rounded px-1 hover:text-bv-primary">
                        组件
                    </a>
                    <a href="#start" className="web-focus rounded px-1 hover:text-bv-primary">
                        开始
                    </a>
                </nav>

                <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="web-focus hidden h-9 items-center gap-bv-xs rounded-full border border-bv-border px-bv-sm text-[13px] text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary sm:flex"
                >
                    <span aria-hidden="true">★</span>
                    GitHub
                </a>

                <button
                    type="button"
                    aria-pressed={dark}
                    onClick={() => setDark(!dark)}
                    aria-label={dark ? '切换到浅色主题' : '切换到深色主题'}
                    className="web-focus flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-bv-border text-bv-text-2 transition-colors hover:border-bv-primary hover:text-bv-primary"
                >
                    <span aria-hidden="true">{dark ? '☀' : '☾'}</span>
                </button>
            </div>
        </header>
    );
}
