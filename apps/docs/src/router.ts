import * as React from 'react';
import { parseHashQuery, type RouteTarget } from './search-index';

/**
 * 极简 hash 路由（零依赖）
 *
 * 为什么不用 react-router：运行时依赖白名单是 9 个，不能为了文档站破例。
 * 文档站只需要「读当前路径 + 跳转」两件事，hash 路由足够。
 *
 * 路由形态：
 *   #/                       首页
 *   #/button                 Button 页
 *   #/select?example=SelectExample1   跳到 Select 页的某个示例卡
 *   #/dialog?prop=onConfirm            跳到 Dialog 页属性表里的某一行
 *
 * 查询串是**可分享的深链**：搜索结果点进去、目录点进去都带它，
 * 别人拿到 URL 打开时落在同一处（见 component-page 的定位高亮）。
 */

export interface Route {
    path: string;
    /** 深链目标；空对象表示只要到这个页面 */
    target: RouteTarget;
}

export function useHashRoute(): [Route, (to: string) => void] {
    const read = React.useCallback((): Route => {
        const raw = window.location.hash;
        const { path, target } = parseHashQuery(raw);
        return { path, target };
    }, []);

    const [route, setRoute] = React.useState(read);

    React.useEffect(() => {
        const onChange = () => setRoute(read());
        window.addEventListener('hashchange', onChange);
        return () => window.removeEventListener('hashchange', onChange);
    }, [read]);

    const navigate = React.useCallback((to: string) => {
        // to 形如 `select?example=SelectExample1` 或纯 `select` / ''
        if (window.location.hash === `#/${to}`) return;
        window.location.hash = `#/${to}`;
    }, []);

    return [route, navigate];
}
