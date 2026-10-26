const GITHUB_URL = 'https://github.com/zciyi/bivane';
const REGISTRY_URL = 'https://zciyi.github.io/bivane/r';

export function Footer() {
    return (
        <footer className="border-t border-bv-border bg-bv-surface/60">
            <div className="mx-auto flex max-w-6xl flex-col gap-bv-md px-bv-md py-bv-lg text-bv-sm text-bv-text-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-bv-xs">
                    <div className="flex items-center gap-bv-xs">
                        <span
                            aria-hidden="true"
                            className="grid h-6 w-6 place-items-center rounded-[7px] bg-gradient-to-br from-[var(--bv-primary)] to-[color-mix(in_srgb,var(--bv-primary)_55%,black)] text-[12px] font-bv-bold text-bv-white"
                        >
                            B
                        </span>
                        <span className="text-[14px] font-bv-bold text-bv-text">
                            Bivane 碧帆
                        </span>
                    </div>
                    <p>一套 API，两端各得其所。</p>
                    <p className="text-bv-xs">
                        Design language inspired by Vant (Youzan). MIT License.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-bv-md">
                    <a
                        href={GITHUB_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="web-focus rounded text-bv-primary hover:underline"
                    >
                        GitHub
                    </a>
                    <a
                        href={`${REGISTRY_URL}/button.json`}
                        target="_blank"
                        rel="noreferrer"
                        className="web-focus rounded text-bv-primary hover:underline"
                    >
                        Registry
                    </a>
                    <a
                        href="#start"
                        className="web-focus rounded text-bv-primary hover:underline"
                    >
                        快速开始
                    </a>
                </div>
            </div>
        </footer>
    );
}
