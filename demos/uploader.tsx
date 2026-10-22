/**
 * Uploader 组件的演示
 *
 * 由 src/App.tsx 抽出 —— 验证台与文档站共用同一份，避免两边漂移。
 */
import * as React from "react";
import { Block, Row, Section } from "./layout";
import { Uploader } from '@/components/responsive/uploader';
import type { UploaderFileItem } from '@/hooks/use-uploader-state';
const afterRead = (item: UploaderFileItem, onProgress: (p: number) => void) =>
        new Promise<void>((resolve, reject) => {
            // 模拟分片进度：演示「业务用 onProgress 上报真实进度」→ 进度条/百分比会动。
            // 真实接入时把 onProgress 挂到你自己的 XHR/fetch 进度事件上即可。
            let p = 0;
            const timer = setInterval(() => {
                p += 20;
                if (p >= 100) {
                    clearInterval(timer);
                    // 文件名含 fail 的走失败分支，便于看到重试 UI
                    if ((item.name ?? "").includes("fail")) {
                        reject(new Error("上传失败"));
                    } else {
                        resolve();
                    }
                } else {
                    onProgress(p);
                }
            }, 150);
        });
/** Uploader 的第 1 个示例 */
export function UploaderExample1() {
    const [list, setList] = React.useState<UploaderFileItem[]>([]);
    return (
        <Block>
                        <Row>
                            <div className="flex flex-col gap-bv-sm">
                                <span className="text-bv-text-2">
                                    afterRead 模拟上传（文件名含 fail 触发失败）
                                </span>
                                <Uploader
                                    multiple
                                    maxCount={6}
                                    value={list}
                                    onChange={setList}
                                    afterRead={afterRead}
                                    ariaLabel="基础上传"
                                />
                                <span className="text-bv-xs text-bv-text-3">
                                    共 {list.length} 项
                                </span>
                            </div>
                        </Row>
                    </Block>
    );
}
/** Uploader 的第 2 个示例 */
export function UploaderExample2() {
    const [files, setFiles] = React.useState<UploaderFileItem[]>([]);
    return (
        <Block>
                        <Row>
                            <div className="flex flex-col gap-bv-sm">
                                <span className="text-bv-text-2">
                                    受控 + 图片压缩 + accept + maxSize
                                </span>
                                <Uploader
                                    value={files}
                                    onChange={setFiles}
                                    accept="image/*"
                                    multiple
                                    compress={{ maxWidth: 800, quality: 0.7 }}
                                    maxSize={2 * 1024 * 1024}
                                    afterRead={afterRead}
                                    ariaLabel="图片上传"
                                />
                            </div>
                        </Row>
                    </Block>
    );
}
/** Uploader 的第 3 个示例 */
export function UploaderExample3() {
    return (
        <Block>
                        <Row>
                            <div className="flex flex-col gap-bv-sm">
                                <span className="text-bv-text-2">只读 / 禁用 / 已满</span>
                                <Uploader
                                    defaultValue={[]}
                                    multiple
                                    maxCount={1}
                                    afterRead={afterRead}
                                    ariaLabel="上限1"
                                />
                                <Uploader
                                    multiple
                                    disabled
                                    afterRead={afterRead}
                                    ariaLabel="禁用上传"
                                />
                            </div>
                        </Row>
                    </Block>
    );
}
/** Uploader 的第 4 个示例 */
export function UploaderExample4() {
    const fakeBridgePick = async (): Promise<File> => {
        await new Promise((r) => setTimeout(r, 300)); // 模拟原生桥异步
        const c = document.createElement("canvas");
        c.width = 80;
        c.height = 80;
        const g = c.getContext("2d");
        if (g) {
            g.fillStyle = "#07c160";
            g.fillRect(0, 0, 80, 80);
        }
        const blob = await new Promise<Blob | null>((res) =>
            c.toBlob(res, "image/png"),
        );
        return new File([blob ?? new Blob(["x"])], `bridge-${Date.now()}.png`, {
            type: "image/png",
        });
    };
    return (
        <Block>
                        <Row>
                            <div className="flex flex-col gap-bv-sm">
                                <span className="text-bv-text-2">
                                    App 桥回填（onPickRequest：点「+」不弹系统框，模拟原生桥拿图后回填）
                                </span>
                                <Uploader
                                    multiple
                                    afterRead={afterRead}
                                    onPickRequest={(handle) => {
                                        void fakeBridgePick().then((f) => handle.addFiles(f));
                                    }}
                                    ariaLabel="App桥回填"
                                />
                            </div>
                        </Row>
                    </Block>
    );
}
export function UploaderDemos() {
    
        
        
    
        
    
        /** 假 App 桥：异步返回一张绿色图片 File，演示 onPickRequest → handle.addFiles 回填 */
    return (
            <Section title="P3 · Uploader 上传（模式 C：H5 宫格+相机 / PC 拖拽区+列表+粘贴）">
                <UploaderExample1 />
                <UploaderExample2 />
                <UploaderExample3 />
                <UploaderExample4 />
            </Section>
        );
}