# Bivane 踩坑与注意事项清单

> 配套：`bivane-architecture.md`（架构宪法）、`bivane-responsive-matrix.md`（逐组件双模式定义）。
> **本文只记「本次接入事故中真实遇到、且已验证成因」的问题**，每条都能复现或查证。
> 素材来源：2026-10-26 一次完整的消费者接入事故复盘。

---

## 0. 事故链复盘

七层问题叠在一起，每层都伪装成"另一个问题"。**只盯着最后一个报错会一直在错的层面打转。**

| # | 现象 | 真实原因 | 归属 | 已验证方式 |
|---|---|---|---|---|
| 1 | 消费者项目里 `pc/select.tsx` 用 `render={<SelectTrigger/>}` | 装到的是 registry 的**旧构建** | 分发 | 与线上 `r/select-pc.json` 逐字比对 |
| 2 | `TS2322: Property 'render' does not exist` | `render` 是 **Base UI** 语法，Radix 用 `asChild`；`render` 在任何 Radix 版本都不存在 | 组件源码 | 读 `react-primitive` 的 `PrimitivePropsWithRef` 类型定义 |
| 3 | 组件"不渲染"（只出空壳） | Radix `Trigger` 不认 `render` → `SelectTrigger` 从未挂载 | 2 的运行时后果 | CDP 实测 DOM |
| 4 | `npx shadcn add` 重装后仍是旧代码 | **GitHub Pages CDN 边缘缓存**仍返回旧 JSON | 分发 | 同一时刻：线上是新内容、装下来是旧内容 |
| 5 | 组件渲染了但**间距全没了** | 消费者 `index.css` 顶层写了 `* { margin:0; padding:0 }`，**无层样式优先级高于任何 `@layer`** → 覆盖掉所有 Tailwind 工具类 | 消费者模板 | CDP computed style：padding 0 → 16px |
| 6 | 窄屏下主内容被挤成一条窄柱 | 消费者 `Layout.Sider` 缺 `breakpoint`，antd 不自动折叠 | 消费者模板 | 截图 + DOM |
| 7 | `npm run build` 挂在 5 个类型错误上 | 消费者模板自带的 5 处类型错误（与 Bivane 无关） | 消费者模板 | `tsc -b` 输出 |

**归属结论**：第 1/4 步是分发链问题，第 5/6/7 步是消费者模板问题，**第 2 步才是 Bivane 源码问题**。

---

## 1. 分发侧

### 1.1 registry 是快照，消费者不会自动更新

- **现象**：线上 registry 的文件已修好，消费者项目里的同名文件还是旧内容。
- **原因**：shadcn 的 `add` 是**一次性拷贝**，没有失效机制、没有版本协商、没有"该组件已更新"的提示。
- **对策**：
  - 发布后必须让消费者**重装**：`npx shadcn@latest add @bivane/xxx`（幂等，已落盘的文件会跳过，重复执行安全）。
  - 发布流程要**记录本次改动涉及的 item 名**随说明给出，否则"线上已修、用户没修"会长期错位。
  - 想根治需自建版本机制（item 里加 `version` + 消费者侧校验命令），目前没有。

### 1.2 GitHub Pages 有 CDN 边缘缓存：「推送成功」≠「线上是新内容」

- **现象**：`git push` 成功、Pages 也部署完了，但 `npx shadcn add` 抓到的还是旧 JSON。
  实测：推完约 2 分钟内 live 已是新版，1 分钟后的安装仍拿到旧版。
- **原因**：Pages 边缘节点缓存了旧 JSON；shadcn CLI 不发 `Cache-Control: no-cache`。
- **对策**：
  - **验证发布要比对「内容指纹」，不能只看 push 成功**：
    ```bash
    curl -s https://zciyi.github.io/bivane/r/select-pc.json \
      | python -c "import sys,json;print(json.load(sys.stdin)['dependencies'])"
    ```
    期望值应与本地 `packages/registry/r/*.json` **逐字一致**。
  - 给消费者一个**明确的等待窗口**（约 2 分钟）再重装。

### 1.3 item 的 npm 依赖必须钉精确版本

- **现象**：消费者装到 `@radix-ui/react-popover@1.3.1`，而 Bivane 自己构建/测试用的是 `1.1.23`。
- **原因**：`registry.json` 里原先写的是裸包名 `"@radix-ui/react-popover"`，npm 取 latest。
  **caret 也不构成保护**——Bivane 自己的 `package.json` 写 `^1.1.23`，同样放行 1.3.1。
- **对策**：钉**精确版本**（无 caret），取自仓库 `package-lock.json`（即实测那棵依赖树）。已落地：
  ```
  @radix-ui/react-dialog@1.1.23        @radix-ui/react-popover@1.1.23
  @radix-ui/react-dropdown-menu@2.1.24 class-variance-authority@0.7.1
  clsx@2.1.1   react-day-picker@10.0.1  tailwind-merge@3.7.0
  ```
- **注**：shadcn 官方 schema 里 `dependencies` 是**字符串数组**，「裸包名」在 schema 层面合法——
  问题不在格式，在**没写版本**。数组元素直接当 npm spec 传，`"react-day-picker@^10.0.1"` 才是这约定本来的样子。
- **预防性调整**（未观察到实际故障，按 peer 语义移除）：`react` / `react-dom` 已从 `portal` / `imperative-host` 的
  dependencies 删除——它们是项目级 peer，写进 item 会让 shadcn 去 `npm install react-dom@latest`，
  与消费者已有的 `react@19` 存在版本冲突风险（`ERESOLVE`）。

### 1.4 网络抖动 ≠ 凭据问题

- **现象**：`git push` 报 `fatal: unable to access '...': Recv failure: Connection was reset by peer`（exit 128）。
- **判别**：凭据错会报 `403` / `Authentication failed` / `could not read Username`；
  **连接重置 / tunnel failed / 502 是网络层**，直接重试即可。
- **要点**：发布脚本是「构建 → 提交 → 推送」三段，**推送失败时构建和提交都已完成**，
  本地 `registry-pages` 分支上已有正确 commit，重推即可，不必重跑构建。
  （本次即如此：本地 commit `6eb007f` 已就位，只是 push 撞了网络抖动。）

---

## 2. 消费侧

### 2.1 `@bivane` 是 registry 命名空间，不是运行时包

```jsonc
// components.json —— 只有这里用 @bivane
{ "registries": { "@bivane": "https://zciyi.github.io/bivane/r/{name}.json" } }
```
```tsx
// 组件代码里用真实路径
import { Select } from '@/components/responsive/select';
```
写 `import { Select } from '@bivane'` 一定报模块找不到。

### 2.2 Bivane 的 Select 走 `options` prop，不是 shadcn 的子组件式

```tsx
<Select
  options={[{ label: '选项1', value: '1' }, { label: '选项2', value: '2' }]}
  // multiple / searchable / clearable / placeholder / confirmable / forceMode ...
/>
```
`options` 元素是 `SelectItem`（平铺 `{label,value}` 或分组 `{group, options}`）。
**照抄 shadcn 的 `<Select><SelectTrigger><SelectItem>` 写法会得到一个渲染出来但没有选项的空壳。**

### 2.3 tokens 必须先装，缺它是静默失效

- `@bivane/tokens` 提供 `--bv-*` 变量 + Tailwind `@theme inline` 映射。
- 缺 `theme.css` → 所有 `bg-bv-*` / `text-bv-*` 工具类**不报错、只是没样式**。
- 装 `@bivane/select` 会经 `registryDependencies` 自动带上 tokens；但**只装单个组件前先确认 tokens 在**。
- CSS import 顺序（集中在最前面，中间插语句法上被忽略）：
  ```css
  @import "tailwindcss";
  @import "./styles/bivane/vant.css";
  @import "./styles/bivane/modes.css";
  @import "./styles/bivane/utilities.css";
  @import "./styles/bivane/theme.css";   /* 必须最后：它做 @theme inline 映射 */
  ```

### 2.4 ⚠️ Tailwind v4 层叠层：无层 reset 会覆盖掉**所有**工具类

**这是本次"间距消失"的真凶，也最容易误判成"组件没样式"。**

- **现象**：组件渲染了，但所有**内边距/外边距**归零；行高还在（`height` 不在 reset 里），
  于是看起来像"行距还在、左右缩进没了"。
- **原因**：Tailwind v4 把工具类放进 `@layer utilities`。
  **CSS 层叠规则：无层（unlayered）样式的优先级高于任何 `@layer`。**
  顶层写
  ```css
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  ```
  会把 `.px-[var(--bv-select-option-padding-x)]` 这类工具类**全部顶掉**。
- **对策**：reset 必须放进 `@layer base`：
  ```css
  @layer base {
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  }
  ```
  层顺序由 `@import "tailwindcss"` 里的 `@layer theme, base, components, utilities;` 决定，
  `utilities` 晚于 `base` → 工具类重新生效。
- **验收方式**：**看 computed style**，不要看截图（见 §4.2）。

### 2.5 `data-mode` 由组件自带，应用根节点不必设置

- 每个 Bivane 组件在自己的根元素上带 `data-mode="h5|pc"`；`ResponsiveProvider` **只提供 React context，不设任何属性**。
- `modes.css` 的 `[data-mode='pc']` 覆盖、`bv-h5:`/`bv-pc:` 自定义变体都依赖这个属性出现在**祖先**上。
- `useDeviceMode` 的 context 是**可选**的（`ResponsiveContext` 默认 `null`），
  不套 `ResponsiveProvider` 也能工作（按视口宽度自动判定）。

### 2.6 消费者项目模板自带的坑（本次 my-app 实际踩到并修掉的）

| 症状 | 根因 | 修法 |
|---|---|---|
| `TS2459: Module './request' declares 'request' locally, but it is not exported` | `request.ts` 导出的是 `http`，调用方 import 的是 `request` | 统一用 `http`；注意 `http.get<T>()` 返回的**已经是** `result.data`，别再 `.data` 解一层 |
| `TS2345: Record<string,string> \| undefined` 不能赋给 `{page,pageSize,search?}` | 钩子参数类型写宽了 | 参数改成结构化类型 + 默认值兜底 |
| `TS2345: Dispatch<SetStateAction<User[]>>` 不能赋给 `.then(setUsers)` | `getUsers` 返回分页对象，不是数组 | `.then(res => setUsers(res.data))` |
| `TS6133: 'handleClear' is declared but its value is never read` | `noUnusedLocals` 开着 | 接到真实触发点（antd `allowClear` 走 `onChange('')`） |
| `TS2307: Cannot find module '@/hooks/useUserList'` | 测试引用的 hook 不存在（模板换版残留） | 补齐 hook，或改测试指向实际存在的 hook |
| 运行时报 `Invalid URL` | `new URL(endpoint, '/api')` —— base 是相对路径，`new URL` 要求绝对 base | `new URL(RAW_BASE, window.location.origin)` 兜底 |
| 窄屏主内容被挤成窄柱 | antd `Layout.Sider` 缺 `breakpoint` | 加 `breakpoint="lg"` + `onBreakpoint` |

---

## 3. 组件源码侧：Radix 的 `render` 不存在

- **事实**：`render={<X/>}` 是 **Base UI** 的写法；**Radix 用 `asChild`**。
  `render` 在 `@radix-ui/react-popover@1.1.23` 和 `1.3.1` 的类型里**都不存在**——
  查证方式：读 `node_modules/@radix-ui/react-primitive/dist/index.d.ts` 的 `PrimitivePropsWithRef`，
  它只有 `asChild?: boolean`。
- **正确写法**（Bivane `components/pc/select.tsx` 现用）：
  ```tsx
  <PopoverPrimitive.Trigger asChild onClick={(e) => { if (disabled) e.preventDefault(); }}>
    <SelectTrigger …>{triggerContent}</SelectTrigger>
  </PopoverPrimitive.Trigger>
  ```
  `onClick` 要挂在 **Trigger** 上（Radix Slot 里 Trigger 的 handler 先于子元素执行，
  这样 `preventDefault()` 才能短路后面的开合），**不能**只挂在子元素上。
- ⚠ **判定陷阱**：`asChild` 出现在**注释**里时，grep 关键字会误判"已经用了 asChild"。
  要看 `<PopoverPrimitive.Trigger\s+asChild` 这种**属性位置**的匹配。
  （本次就差点被这个骗过去：grep `asChild` 命中 3 处，全在注释。）

---

## 4. 诊断方法论

### 4.1 分层定位表

| 层 | 问什么 | 怎么查 |
|---|---|---|
| 分发 | 线上 registry 的内容是新的吗？ | fetch `r/<item>.json` **比对内容指纹**，不看 push 结果 |
| 安装 | 项目里的文件是新的吗？ | 看 mtime + grep（注意注释误判，见 §3） |
| 源码 | 组件代码本身对吗？ | 读 `node_modules` 里依赖的**类型定义**，别凭记忆 |
| 产物 | Tailwind 生成了对应的类吗？ | 在 `dist/assets/*.css` 里搜**工具类名本身** |
| 级联 | 类生成了但被覆盖了吗？ | **CDP 读 computed style**（唯一可靠） |

### 4.2 样式类故障：截图和 jsdom 都证明不了

- `jsdom` **不做级联**，`toHaveClass('px-4')` 只能证明类名在，证明不了它没被别的规则盖掉。
- 截图只能看个大概；**归零/透明的 padding 在截图里很难一眼看出**。
- **唯一可靠手段**：无头 Chrome + CDP `Runtime.evaluate` 读 `getComputedStyle`。
- **查产物别只搜变量名**：Tailwind v4 的 `@theme inline` 会把 `var()` 内联进声明，
  所以产物里**永远搜不到 `--color-bv-primary`**——搜它徒劳。
  必须搜**工具类名本身**（`bg-bv-overlay{`、`px-\[var\(--bv-…\)\]`）或**变量被引用的地方**。
- 用 `git show <旧commit>:r/<item>.json` 可取**任意历史版本的产物内容**做 diff，
  比"回忆上次是什么样"可靠得多。

### 4.3 CDP 探针实操坑（本次实际踩到的）

- **弹层/面板首屏量不到**：Portal 渲染，必须先 `element.click()` 再量。
  每个场景前 `Page.navigate` 重载，否则上一个弹层还开着。
- **被路由守卫拦到登录页**：`AuthGuard` 会把无 token 的用户 `Navigate` 到 `/login`。
  zustand `persist` 的 key 是 `auth-storage`，先注入再重载：
  ```js
  localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'probe' }, version: 0 }));
  ```

### 4.4 npm / 网络类判断口诀（本次实际踩到的）

- `ENOTEMPTY` / `rmdir` 失败 → **有并发 npm 在写同一个 tree**（多半是上一次被 kill 的任务留下的孤儿进程）。
  先 `Get-CimInstance Win32_Process` 找孤儿并杀掉，再重跑。
- `shadcn add` 报 `Circular dependency detected` → **多半是并发抓取时某个 item 抓失败**（如 502），
  中间态被误判成环。**先查依赖图有没有真环**（DFS 染色），别直接改图。
- `npm install` 偶发失败但重跑就好 → Windows 上 npm reify 的抖动；
  门要带**有限重试**（真错误照样红，不能把门磨绿）。

---

## 5. 发布 checklist

```bash
# 1. 构建（改了组件源码或 token 后必须重跑，否则发的是旧内容）
npm run registry:build

# 2. 自查：依赖版本已钉死？
node -e "const r=require('./packages/registry/registry.json');r.items.forEach(i=>i.dependencies&&console.log(i.name,i.dependencies))"

# 3. 本地验收门（走本地静态服务，不依赖公网）
npm run consumer:check

# 4. 发布（脚本内部会自己再跑一次 build）
npm run registry:publish
#    凭据不通时：GITHUB_TOKEN=ghp_xxx npm run registry:publish

# 5. 验证「线上内容」而不是「推送成功」——等 2 分钟让边缘缓存过期
curl -s https://zciyi.github.io/bivane/r/select-pc.json \
  | python -c "import sys,json;print(json.load(sys.stdin)['dependencies'])"
#    输出应与第 2 步完全一致

# 6. 公网全量验收
REGISTRY_BASE_URL="https://zciyi.github.io/bivane/r/{name}.json" npm run consumer:check

# 7. 通知消费者重装本次改动涉及的 item
#    npx shadcn@latest add @bivane/<item> ...
```

**第 5 步和第 7 步最容易被跳过、也最容易出事**：
第 5 步跳过 → 消费者装到旧代码（§1.2）；第 7 步跳过 → "线上已修、用户没修"长期错位（§1.1）。
