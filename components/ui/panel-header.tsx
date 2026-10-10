import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { DeviceMode } from "@/hooks/use-device-mode";

/**
 * Bivane 面板工具栏（H5 弹层头部）
 *
 * 抽出来的理由：这不是某个组件独有的零件，而是**H5 弹层面板的通用头部**——
 * 居中标题（多层下钻时可换成面包屑）+ 左侧（返回 / 取消）+ 右侧（确定）。Select 与 DropdownMenu 都要它，
 * 后面的 DatePicker / TimePicker / Picker 也必然复用同一套（Vant 的 Picker
 * 就是「取消 · 标题 · 确认」这一条）。三处各写一份的结果一定是三套字距与热区，
 * 所以在这一层收口。
 *
 * 两行结构（给了面包屑才铺第二行）：
 *   工具栏行（`panel-header-bar`）—— 返回/取消（左）· 标题（中）· 确定（右），44px；
 *   层级行（`panel-header-breadcrumb`）—— 面包屑独占一行、左对齐，32px。
 * 面包屑与按钮挤同一行时，链一长就要么压住标题、要么被迫给两侧让位而缩进，
 *   且路径读起来是「居中飘着」的一段；独占一行后它才是可从链首读起的一条路径。
 *
 * 为什么只有 H5 用：
 *   触屏没有键盘，鼠标点选是「高成本动作」，选择类面板因此需要**暂存 → 确认**
 *   这一步（点了确定才生效，「取消」把暂存丢掉）。桌面端相反——鼠标是精准设备，
 *   点一下就该立刻生效，再叠一层确认只会让每次选择都多一次点击。
 *   所以 PC 的两份实现都不渲染本组件，工具栏只在 h5/ 里出现。
 *
 * 右侧「确定」只在带暂存确认的面板里出现；纯展示型头部（只有标题）也允许，
 * 此时两侧按钮都不渲染。
 */

/**
 * 面包屑的一项。
 *
 * 浮层用它拼出「进入各层时点的那一项 → 当前层的选中项」，根层则只有一格面板名
 * （让头部结构在下钻前后一致，不会从「居中标题」跳成「左对齐层级行」）。
 */
export interface PanelHeaderCrumb {
  /** 该项的显示文案 */
  label: React.ReactNode;
  /**
   * 点它跳到该项所在的层。**每一项都可以给，包括末项** —— 末项是当前落点
   * （当前层，或当前层的选中项），点了还是这一层，跳转自然收敛。
   * 不给则渲染成不可点的一项（`panel-header-crumb-current`）。
   */
  onSelect?: () => void;
}

export interface PanelHeaderProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** 已解析的模式（含 forceMode 逃生舱），由分发层传入 */
  mode: DeviceMode;
  /** 标题文案。不传则只有两侧按钮，标题区留白。给了 breadcrumb 时本项被它替代 */
  title?: React.ReactNode;
  /**
   * 层级面包屑：把「进入各层时点的那一项 → 当前层的选中项」整条链铺在工具栏行
   * **下方的独立一行**（根层只有一格面板名），链上每一项都点到哪层落哪层。
   *
   * 多层下钻的面板需要它：只显示当前层名字时，用户既看不到自己是从哪一层进来的，
   * 想回头也只能一层层按返回。链上有哪些项、哪一项可点，全部由调用方决定 ——
   * 本组件只按「有没有 onSelect」渲染，不判层数、也不区分「层」与「取值」。
   * 单层面板（Select）不传，行为与引入面包屑前完全一致（只有工具栏行，高度不变）；
   * 给了它才多出层级行，同时标题让位（同一条链不说两遍）。
   */
  breadcrumb?: PanelHeaderCrumb[];
  /** 面包屑的无障碍名称 */
  breadcrumbLabel?: string;
  /**
   * 左侧「返回上一级」。给了它就不再渲染取消按钮 —— 两者占同一个位置。
   *
   * 留给需要「逐层退」的多层面板；H5 菜单已不用它（层级导航交给面包屑每一项可点，
   * 左键统一是 onCancel「关闭面板并放弃暂存」）。
   */
  onBack?: () => void;
  /** 返回按钮的无障碍名称 */
  backLabel?: string;
  /** 左侧「取消/关闭」：关闭面板，并放弃暂存。传了才渲染 */
  onCancel?: () => void;
  cancelText?: React.ReactNode;
  /** 右侧「确定」：提交暂存。传了才渲染 */
  onConfirm?: () => void;
  confirmText?: React.ReactNode;
  confirmDisabled?: boolean;
}

export const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(
  function PanelHeader(
    {
      mode,
      title,
      breadcrumb,
      breadcrumbLabel = "层级",
      onBack,
      backLabel = "返回上一级",
      onCancel,
      cancelText = "取消",
      onConfirm,
      confirmText = "确定",
      confirmDisabled = false,
      className,
      ...props
    },
    ref,
  ) {
    /**
     * 两侧按钮用绝对定位而不是 flex 三段布局：
     * 标题必须在面板里**视觉居中**，而「取消」「确定」的文字宽度天然不等
     * （尤其中英文混排时），三段等分会把标题顶偏。
     */
    const actionClass = cn(
      "absolute top-0 flex h-full items-center border-0 bg-transparent",
      "px-[var(--bv-panel-header-padding-x)]",
      "text-bv-md leading-[var(--bv-panel-header-line-height)]",
      "cursor-pointer",
    );

    const crumbRef = React.useRef<HTMLElement | null>(null);
    /** 归一化后的层级链：「不传」与「空数组」同义，都当没有层级可铺 */
    const crumbs = breadcrumb ?? [];
    const crumbCount = crumbs.length;

    /**
     * 层级变深时把当前层滚进视野：抽屉宽度有限，长链会溢出到右侧之外，
     * 不滚的话用户看到的仍是最左边那几层，反而不知道自己现在在哪一层。
     *
     * 依赖用**层数**而不是数组本身 —— 数组每次渲染都是新身份，
     * 那样会在无关渲染里反复把视野拽回末端，用户想往回看都看不成。
     */
    React.useEffect(() => {
      const el = crumbRef.current;
      if (el) el.scrollLeft = el.scrollWidth;
    }, [crumbCount]);

    return (
      <div
        ref={ref}
        data-mode={mode === "mobile" ? "h5" : "pc"}
        className={cn(
          // 两行结构：上「工具栏行」，下「层级行」（只有给了面包屑才铺第二行）。
          // 高度不写在容器上，由每行各自定高 —— 面包屑不再和按钮挤同一行。
          "relative flex shrink-0 flex-col",
          "bg-bv-surface",
          "bv-hairline bv-hairline--bottom",
          className,
        )}
        {...props}
        data-slot="panel-header"
      >
        {/* 工具栏行：返回/取消（左）· 标题（中）· 确定（右） */}
        <div
          data-slot="panel-header-bar"
          className={cn(
            "relative flex w-full items-center justify-center",
            "h-[var(--bv-panel-header-height)]",
            "px-[var(--bv-panel-header-padding-x)]",
          )}
        >
          {onBack ? (
            <button
              type="button"
              aria-label={backLabel}
              onClick={onBack}
              className={cn(
                "absolute left-0 flex h-full items-center justify-center border-0 bg-transparent p-0",
                // 返回是图标按钮：热区取一个正方形，宽度跟随高度（与工具栏行等高）
                "w-[var(--bv-panel-header-height)] cursor-pointer",
                "text-[length:var(--bv-panel-header-icon-size)] text-[var(--bv-panel-header-icon-color)]",
              )}
              data-slot="panel-header-back"
            >
              <Icon name="arrow-left" />
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                actionClass,
                "left-0",
                "text-[color:var(--bv-panel-header-cancel-color)]",
                "active:opacity-[var(--bv-panel-header-disabled-opacity)]",
              )}
              data-slot="panel-header-cancel"
            >
              {cancelText}
            </button>
          ) : null}

          {/* 有面包屑时标题整段让位给层级行，避免同一条链被说两遍 */}
          {crumbCount > 0 ? null : (
            <span
              data-slot="panel-header-title"
              className={cn(
                // 标题两侧给按钮让位：左「取消」右「确定」都可能在，用内边距把可读区收进来，
                // 否则长标题会压到「确定」上（按钮是绝对定位，不参与文本流）
                "mx-[var(--bv-panel-header-title-inset)] max-w-full truncate text-bv-md",
                "leading-[var(--bv-panel-header-line-height)]",
                "text-[color:var(--bv-panel-header-color)]",
              )}
            >
              {title}
            </span>
          )}

          {onConfirm ? (
            <button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
              className={cn(
                actionClass,
                "right-0 justify-end",
                "text-[color:var(--bv-panel-header-confirm-color)]",
                confirmDisabled
                  ? "cursor-not-allowed opacity-[var(--bv-panel-header-disabled-opacity)]"
                  : "active:opacity-[var(--bv-panel-header-disabled-opacity)]",
              )}
              data-slot="panel-header-confirm"
            >
              {confirmText}
            </button>
          ) : null}
        </div>

        {/*
         层级行：面包屑独占一行（工具栏行留给返回与确定）。
         只显示当前层名字时，用户看不到自己是从哪一层进来的，想回头也只能一层层按返回。
        */}
        {crumbCount > 0 ? (
          <nav
            ref={crumbRef}
            aria-label={breadcrumbLabel}
            className={cn(
              // 独占一行后不再需要给两侧按钮让位，直接左右贴面板内边距；
              // 左对齐：路径要从链首读起（居中会让不同长度的链左右乱跳）
              "box-border flex w-full min-w-0 items-center",
              "h-[var(--bv-panel-header-breadcrumb-height)]",
              "px-[var(--bv-panel-header-padding-x)]",
              // 层数多或层名长时横向可滚，不把头部撑成两行；
              // 纵向与滚动边界都收住，否则横向滑动会被弹层判成下拉关闭
              "overflow-x-auto overflow-y-hidden overscroll-x-contain",
            )}
            data-slot="panel-header-breadcrumb"
          >
            {crumbs.map((crumb, index) => {
              // 末项即「用户当前的落点」：当前层，或当前层的选中项
              const isCurrent = index === crumbs.length - 1;
              const crumbClass = cn(
                "flex h-full shrink-0 items-center whitespace-nowrap",
                // 不留横向内边距：整条链要读成「选1/选2/当前」一串，
                // 给了内边距项与项之间就散开成几段（分隔符也不再贴着文案）
                "text-bv-md leading-[var(--bv-panel-header-line-height)]",
              );
              return (
                <React.Fragment key={index}>
                  {index > 0 ? (
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-bv-text-3"
                      data-slot="panel-header-crumb-separator"
                    >
                      /
                    </span>
                  ) : null}
                  {crumb.onSelect ? (
                    <button
                      type="button"
                      onClick={crumb.onSelect}
                      // 末项可点也仍是「当前落点」：着色与无障碍标记照旧
                      aria-current={
                        isCurrent ? "true" : undefined
                      }
                      className={cn(
                        crumbClass,
                        isCurrent
                          ? "text-[color:var(--bv-panel-header-color)]"
                          : "text-bv-text-2",
                        "border-0 bg-transparent",
                        "cursor-pointer active:opacity-[var(--bv-panel-header-disabled-opacity)]",
                      )}
                      data-slot="panel-header-crumb"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span
                      aria-current={
                        isCurrent ? "true" : undefined
                      }
                      className={cn(
                        crumbClass,
                        "text-[color:var(--bv-panel-header-color)]",
                      )}
                      data-slot="panel-header-crumb-current"
                    >
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : null}
      </div>
    );
  },
);
