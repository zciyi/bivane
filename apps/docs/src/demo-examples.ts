import type * as React from 'react';

/**
 * 示例组件登记表：demo 名 → 该 demo 的各个示例组件。
 *
 * 为什么要单独一份：组件页上每个示例是**一张独立卡片**
 * （Ant Design / Element 的做法）—— 一张卡一个用法、一份源码。
 * 验证台（src/App.tsx）则仍然用整块的 `XxxDemos`，
 * 两者渲染的是同一份 demo 代码，只是粒度不同。
 *
 * 命名约定：demo `XxxDemos` 的第 N 个示例叫 `XxxExampleN`。
 * 清单与 demos/ 目录的一致性由 tests/docs-registry.test.ts 守着。
 */
import { ActionSheetExample1 } from '@/demos/action-sheet';
import { BoundsExample1 } from '@/demos/bounds';
import { ButtonExample1, ButtonExample2 } from '@/demos/button';
import { CalendarExample1 } from '@/demos/calendar';
import { CascaderExample1 } from '@/demos/cascader';
import { CellExample1, CellExample2 } from '@/demos/cell';
import {
    CheckboxExample1,
    CheckboxExample2,
    CheckboxExample3,
    CheckboxExample4,
} from '@/demos/checkbox';
import { DataContainerExample1 } from '@/demos/data-container';
import { DatePickerExample1 } from '@/demos/date-picker';
import { DateTimePickerExample1 } from '@/demos/datetime-picker';
import { DialogExample1, DialogExample2 } from '@/demos/dialog';
import { DropdownMenuExample1 } from '@/demos/dropdown-menu';
import { EllipsisExample1, EllipsisExample2 } from '@/demos/ellipsis';
import { FieldExample1, FieldExample2, FieldExample3 } from '@/demos/field';
import { IconExample1, IconExample2 } from '@/demos/icon';
import { InputNumberExample1 } from '@/demos/input-number';
import { ListExample1 } from '@/demos/list';
import { LoadingExample1 } from '@/demos/loading';
import { NavBarExample1 } from '@/demos/nav-bar';
import { NotifyExample1 } from '@/demos/notify';
import { PickerExample1 } from '@/demos/picker';
import { PopoverExample1 } from '@/demos/popover';
import { PopupExample1 } from '@/demos/popup';
import { RadioExample1, RadioExample2 } from '@/demos/radio';
import { RateExample1 } from '@/demos/rate';
import { SearchExample1 } from '@/demos/search';
import { SelectExample1 } from '@/demos/select';
import {
    SliderExample1,
    SliderExample2,
    SliderExample3,
    SliderExample4,
} from '@/demos/slider';
import { SwitchExample1, SwitchExample2 } from '@/demos/switch';
import { TabbarExample1 } from '@/demos/tabbar';
import { TableExample1 } from '@/demos/table';
import { TablePaginationExample1 } from '@/demos/table-pagination';
import { TabsExample1 } from '@/demos/tabs';
import { TagBadgeExample1 } from '@/demos/tag-badge';
import { TimePickerExample1 } from '@/demos/time-picker';
import { ToastExample1 } from '@/demos/toast';
import { TooltipExample1 } from '@/demos/tooltip';
import {
    UploaderExample1,
    UploaderExample2,
    UploaderExample3,
    UploaderExample4,
} from '@/demos/uploader';

/**
 * demo 名 → 示例组件列表。
 *
 * 顺序即展示顺序。
 */
export const DEMO_EXAMPLES: Record<string, React.ComponentType[]> = {
    ActionSheetDemos: [ActionSheetExample1],
    BoundsDemos: [BoundsExample1],
    ButtonDemos: [ButtonExample1, ButtonExample2],
    CalendarDemos: [CalendarExample1],
    CascaderDemos: [CascaderExample1],
    CellDemos: [CellExample1, CellExample2],
    CheckboxDemos: [
        CheckboxExample1,
        CheckboxExample2,
        CheckboxExample3,
        CheckboxExample4,
    ],
    DataContainerDemos: [DataContainerExample1],
    DatePickerDemos: [DatePickerExample1],
    DateTimePickerDemos: [DateTimePickerExample1],
    DialogDemos: [DialogExample1, DialogExample2],
    DropdownMenuDemos: [DropdownMenuExample1],
    EllipsisDemos: [EllipsisExample1, EllipsisExample2],
    FieldDemos: [FieldExample1, FieldExample2, FieldExample3],
    IconDemos: [IconExample1, IconExample2],
    InputNumberDemos: [InputNumberExample1],
    ListDemos: [ListExample1],
    LoadingDemos: [LoadingExample1],
    NavBarDemos: [NavBarExample1],
    NotifyDemos: [NotifyExample1],
    PickerDemos: [PickerExample1],
    PopoverDemos: [PopoverExample1],
    PopupDemos: [PopupExample1],
    RadioDemos: [RadioExample1, RadioExample2],
    RateDemos: [RateExample1],
    SearchDemos: [SearchExample1],
    SelectDemos: [SelectExample1],
    SliderDemos: [
        SliderExample1,
        SliderExample2,
        SliderExample3,
        SliderExample4,
    ],
    SwitchDemos: [SwitchExample1, SwitchExample2],
    TabbarDemos: [TabbarExample1],
    TableDemos: [TableExample1],
    TablePaginationDemos: [TablePaginationExample1],
    TabsDemos: [TabsExample1],
    TagBadgeDemos: [TagBadgeExample1],
    TimePickerDemos: [TimePickerExample1],
    ToastDemos: [ToastExample1],
    TooltipDemos: [TooltipExample1],
    UploaderDemos: [
        UploaderExample1,
        UploaderExample2,
        UploaderExample3,
        UploaderExample4,
    ],
};
