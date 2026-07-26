export { FilterModule } from './filter-module.js';
export type { FilterModuleOptions } from './filter-module.js';
export { matchesFilter, filterDependencies } from './filter-model.js';
export type {
  ColumnFilter,
  FilterModel,
  TextFilter,
  NumberFilter,
  SetFilter,
  TextFilterOperator,
  NumberFilterOperator,
} from './filter-model.js';

import type { ColumnFilter, FilterModel } from './filter-model.js';

/** Column options this module adds. They exist only when it is imported. */
declare module '../../columns/types.js' {
  interface ColumnDef<TData, TValue> {
    /** Set false to hide this column's filter UI and ignore it in quick filter. */
    filterable?: boolean;
    /** Which editor the header shows. Defaults to text. */
    filterType?: 'text' | 'number' | 'set';
  }
}

declare module '../../api/types.js' {
  interface GridApi<TData> {
    getFilterModel(): FilterModel;
    setFilterModel(model: FilterModel): void;
    setColumnFilter(colId: string, filter: ColumnFilter | null): void;
    setQuickFilter(text: string): void;
    clearFilters(): void;
    isFilterActive(): boolean;
  }
}

export interface FilterChangedDetail {
  model: FilterModel;
  quickFilter: string;
}
