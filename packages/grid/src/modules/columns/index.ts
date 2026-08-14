export { ColumnsModule } from './columns-module.js';
export type { ColumnsModuleOptions, ColumnState } from './columns-module.js';
export type { PinPlacement, PinnableColumn } from './pinning.js';

import type { ColumnState } from './columns-module.js';

/** Column options this module adds. They exist only when it is imported. */
declare module '../../columns/types.js' {
  interface ColumnDef<TData, TValue> {
    /** Whether this column can be resized by dragging. Defaults to true. */
    resizable?: boolean;
    /** Whether this column can be moved. Defaults to true. */
    reorderable?: boolean;
    /**
     * Holds the column against an edge while the rest scroll under it.
     *
     * Stack layout only. A flow instance is sized to its own columns and the
     * scroller moves between instances, so nothing slides out from under the
     * viewport for a pinned column to stay in front of.
     */
    pinned?: 'left' | 'right';
  }
}

/** Api methods this module adds. */
declare module '../../api/types.js' {
  interface GridApi<TData> {
    setColumnWidth(colId: string, width: number): void;
    /** Moves a column to an absolute index in the current visible order. */
    moveColumn(colId: string, toIndex: number): void;
    setColumnPinned(colId: string, side: 'left' | 'right' | null): void;
    getColumnState(): ColumnState[];
    setColumnState(state: readonly ColumnState[]): void;
    resetColumnState(): void;
  }
}
