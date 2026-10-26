import { ResponsiveProvider } from '@/components/providers/responsive-provider';
import { DialogHost } from '@/components/responsive/dialog';
import { ToastHost } from '@/components/responsive/toast';
import { Header } from './components/header';
import { Footer } from './components/footer';
import { Hero } from './components/hero';
import { Features } from './components/features';
import { DualShowcase } from './components/dual-showcase';
import { ComponentGrid } from './components/component-grid';
import { QuickStart } from './components/quick-start';

/**
 * 官网外壳。
 *  - 整体包在 ResponsiveProvider mode="auto" 下，命令式 Dialog/Toast 宿主拿得到 mode。
 *  - 双模式演示区各自用 DeviceFrame 内部的 Provider 强制 mobile/desktop，
 *    与外层 auto 互不干扰（内层优先）。
 */
export function App() {
    return (
        <ResponsiveProvider mode="auto">
            <div id="top" className="min-h-screen">
                <Header />
                <main>
                    <Hero />
                    <Features />
                    <DualShowcase />
                    <ComponentGrid />
                    <QuickStart />
                </main>
                <Footer />
            </div>
            <DialogHost />
            <ToastHost />
        </ResponsiveProvider>
    );
}
