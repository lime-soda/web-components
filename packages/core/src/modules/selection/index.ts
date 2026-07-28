import './selection-checkbox.js';
import type { SelectionState } from './selection-module.js';

export { SelectionModule } from './selection-module.js';
export type { SelectionMode, SelectionModuleOptions, SelectionState } from './selection-module.js';
export { FlowSelectionCheckbox } from './selection-checkbox.js';

declare module '../../api/types.js' {
  interface GridApi<TData> {
    /** True only when every selectable leaf beneath the row is selected. */
    isRowSelected(rowId: string): boolean;
    /** 'checked' | 'indeterminate' | 'unchecked' — a parent reflects its children. */
    getRowSelectionState(rowId: string): SelectionState;
    getSelectedRows(): readonly string[];
    getSelectedCount(): number;
    setRowSelected(rowId: string, selected: boolean): void;
    toggleRowSelected(rowId: string): void;
    /** Selects every row in the current projection, so filters are respected. */
    selectAll(): void;
    clearSelection(): void;
  }
}

export interface SelectionChangedDetail {
  selected: readonly string[];
  count: number;
}
