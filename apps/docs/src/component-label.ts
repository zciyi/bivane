/**
 * 组件标题里的中文名。
 *
 * registry 的 title 形如「Button 按钮」——英文名 + 空格 + 中文名
 * （`Input / Textarea 输入` 这种别名型标题，中文名在最后一段）。
 *
 * 文档站是中文站，所有**导航面**（侧栏、首页网格、上一步/下一步、
 * 搜索面板）一律以中文名为主标签：中文读者扫的是「按钮」不是「Button」。
 * 英文名降为次级标签（等宽、弱化）保留 —— 既和代码里的 import 对得上，
 * 又不让满屏英文名把中文读者挡在门外。
 *
 * 标题里没有中文时退回整个字符串（英文名顶上），绝不返回空 ——
 * 空主标签会让导航项变成一个看不见的点。
 */

/** 从「Button 按钮」里取出「按钮」 */
export function chineseName(title: string): string {
    const m = title.match(/[\u4e00-\u9fff][\u4e00-\u9fff/]*/);
    return m ? m[0] : title;
}
