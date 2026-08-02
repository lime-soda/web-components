export { SortModule, compareValues } from './sort-module.js';
export type {
  SortDirection,
  SortModelEntry,
  SortModuleOptions,
  ComparatorParams,
} from './sort-module.js';

import type { ComparatorParams, SortDirection, SortModelEntry } from './sort-module.js';

/** Column options this module adds. They exist only when it is imported. */
declare module '../../columns/types.js' {
  interface ColumnDef<TData, TValue> {
    /** Set false to make a column unsortable. */
    sortable?: boolean;
    comparator?: (
      a: TValue | undefined,
      b: TValue | undefined,
      params: ComparatorParams<TData>,
    ) => number;
    initialSort?: SortDirection;
  }
}

declare module '../../api/types.js' {
  interface GridState {
    /** The active sort, in priority order. */
    sort?: SortModelEntry[];
  }

  interface GridApi<TData> {
    getSortModel(): readonly SortModelEntry[];
    setSortModel(model: readonly SortModelEntry[]): void;
    clearSort(): void;
    /** Re-sorts against current values, leaving the sort model as it is. */
    refreshSort(): void;
  }
}

export interface SortChangedDetail {
  model: readonly SortModelEntry[];
}
