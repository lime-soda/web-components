/**
 * Every module at once, for the ceiling budget.
 *
 * A file rather than a list of entry points because what is being budgeted is
 * one application's bundle, not the sum of thirteen measured apart — shared
 * code between modules is paid for once and a sum would count it repeatedly.
 */
import '@lime-soda/grid/layouts';
import { TreeModule } from '@lime-soda/grid/tree';
import { SortModule } from '@lime-soda/grid/sort';
import { FilterModule } from '@lime-soda/grid/filter';
import { SelectionModule } from '@lime-soda/grid/selection';
import { TreeSelectionModule } from '@lime-soda/grid/selection/tree';
import { RowRangeModule } from '@lime-soda/grid/selection/row-range';
import { KeyboardModule } from '@lime-soda/grid/keyboard';
import { CellFlashModule } from '@lime-soda/grid/cell-flash';
import { ColumnsModule } from '@lime-soda/grid/columns';
import { ClipboardModule } from '@lime-soda/grid/clipboard';
import { EditModule } from '@lime-soda/grid/edit';
import { RangeModule } from '@lime-soda/grid/range';

export const modules = [
  TreeModule,
  SortModule,
  FilterModule,
  SelectionModule,
  TreeSelectionModule,
  RowRangeModule,
  KeyboardModule,
  CellFlashModule,
  ColumnsModule,
  ClipboardModule,
  EditModule,
  RangeModule,
];
