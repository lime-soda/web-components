import type { SelectionState } from './selection-module.js';

export { SelectionModule } from './selection-module.js';
export type { SelectionMode, SelectionModuleOptions, SelectionState } from './selection-module.js';
export { GridSelectionCheckbox } from './selection-checkbox.js';
export { FlatMembership } from './membership.js';
export type { RangeHandler, SelectionMembership } from './membership.js';

declare module '../../api/types.js' {
  interface GridState {
    /** The selected row ids. */
    selection?: string[];
  }

  interface GridApi<TData> {
    /** True only when every id the row stands for is selected. */
    isRowSelected(rowId: string): boolean;
    /**
     * 'checked' | 'indeterminate' | 'unchecked'.
     *
     * Only ever 'indeterminate' with a membership module installed, since a
     * flat row is either selected or it is not.
     */
    getRowSelectionState(rowId: string): SelectionState;
    getSelectedRows(): readonly string[];
    getSelectedCount(): number;
    setRowSelected(rowId: string, selected: boolean): void;
    /** Selects or deselects several rows as one change. */
    setRowsSelected(rowIds: readonly string[], selected: boolean): void;
    toggleRowSelected(rowId: string): void;
    /** Selects every row in the current projection, so filters are respected. */
    selectAll(): void;
    clearSelection(): void;
  }
}

/** The detail of `ls-grid-selection-changed`. */
export interface SelectionChangedDetail {
  /** Ids of the selected rows, in the order they were selected. */
  selected: readonly string[];
  /** How many, so a listener need not measure the array to show a count. */
  count: number;
}
