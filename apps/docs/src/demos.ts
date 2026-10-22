import type * as React from 'react';

/**
 * demo 组件登记表：demo 名 → 组件。
 *
 * 手工登记而不是动态 import —— 动态 import 会把**所有** demo 都打进包里
 * （每个组件一个 chunk），而文档站本来就要展示全部组件，静态引入反而更简单。
 *
 * 清单与 demos/ 目录的一致性由 tests/docs-registry.test.ts 守着
 * （catalog 里写了不存在的 demo 名 → 测试红）。
 */
import { ActionSheetDemos } from '@/demos/action-sheet';
import { BoundsDemos } from '@/demos/bounds';
import { ButtonDemos } from '@/demos/button';
import { CalendarDemos } from '@/demos/calendar';
import { CascaderDemos } from '@/demos/cascader';
import { CellDemos } from '@/demos/cell';
import { CheckboxDemos } from '@/demos/checkbox';
import { DataContainerDemos } from '@/demos/data-container';
import { DatePickerDemos } from '@/demos/date-picker';
import { DateTimePickerDemos } from '@/demos/datetime-picker';
import { DialogDemos } from '@/demos/dialog';
import { DropdownMenuDemos } from '@/demos/dropdown-menu';
import { EllipsisDemos } from '@/demos/ellipsis';
import { FieldDemos } from '@/demos/field';
import { IconDemos } from '@/demos/icon';
import { InputNumberDemos } from '@/demos/input-number';
import { ListDemos } from '@/demos/list';
import { LoadingDemos } from '@/demos/loading';
import { NavBarDemos } from '@/demos/nav-bar';
import { NotifyDemos } from '@/demos/notify';
import { PickerDemos } from '@/demos/picker';
import { PopoverDemos } from '@/demos/popover';
import { PopupDemos } from '@/demos/popup';
import { RadioDemos } from '@/demos/radio';
import { RateDemos } from '@/demos/rate';
import { SearchDemos } from '@/demos/search';
import { SelectDemos } from '@/demos/select';
import { SliderDemos } from '@/demos/slider';
import { SwitchDemos } from '@/demos/switch';
import { TabbarDemos } from '@/demos/tabbar';
import { TableDemos } from '@/demos/table';
import { TablePaginationDemos } from '@/demos/table-pagination';
import { TabsDemos } from '@/demos/tabs';
import { TagBadgeDemos } from '@/demos/tag-badge';
import { TimePickerDemos } from '@/demos/time-picker';
import { ToastDemos } from '@/demos/toast';
import { TooltipDemos } from '@/demos/tooltip';
import { UploaderDemos } from '@/demos/uploader';

export const DEMOS: Record<string, React.ComponentType> = {
    ActionSheetDemos,
    BoundsDemos,
    ButtonDemos,
    CalendarDemos,
    CascaderDemos,
    CellDemos,
    CheckboxDemos,
    DataContainerDemos,
    DatePickerDemos,
    DateTimePickerDemos,
    DialogDemos,
    DropdownMenuDemos,
    EllipsisDemos,
    FieldDemos,
    IconDemos,
    InputNumberDemos,
    ListDemos,
    LoadingDemos,
    NavBarDemos,
    NotifyDemos,
    PickerDemos,
    PopoverDemos,
    PopupDemos,
    RadioDemos,
    RateDemos,
    SearchDemos,
    SelectDemos,
    SliderDemos,
    SwitchDemos,
    TabbarDemos,
    TableDemos,
    TablePaginationDemos,
    TabsDemos,
    TagBadgeDemos,
    TimePickerDemos,
    ToastDemos,
    TooltipDemos,
    UploaderDemos,
};
