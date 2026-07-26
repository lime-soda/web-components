import './fg-selection-checkbox.js';

export { SelectionModule } from './selection-module.js';
export type { SelectionMode, SelectionModuleOptions } from './selection-module.js';
export { FgSelectionCheckbox } from './fg-selection-checkbox.js';

declare module '../../api/types.js' {
  interface GridApi<TData> {
    isRowSelected(rowId: string): boolean;
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
