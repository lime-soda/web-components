import type { GridApi } from '../../api/types.js';

export { TreeModule } from './tree-module.js';
export type { TreeModuleOptions } from './tree-module.js';
export { TreeIndex } from './tree-index.js';
export type { TreeIndexOptions } from './tree-index.js';

/**
 * Importing this module makes its methods appear on the grid's api. Without the
 * import they do not exist, and do not type-check.
 */
declare module '../../api/types.js' {
  interface GridState {
    /** The ids of the expanded rows. */
    tree?: string[];
  }

  interface GridApi<TData> {
    isExpanded(id: string): boolean;
    setExpanded(id: string, expanded: boolean): void;
    toggleExpanded(id: string): void;
    expandAll(): void;
    collapseAll(): void;
    /** Ancestor ids from root down to the row's parent. */
    getPath(id: string): readonly string[];
  }
}

export interface ExpansionChangedDetail {
  /** Rows whose expansion was requested to change. */
  ids: readonly string[];
  /** Every currently expanded row. */
  expanded: readonly string[];
}

export type { GridApi };
