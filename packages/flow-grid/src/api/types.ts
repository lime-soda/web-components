import type { ColumnDefs, ResolvedColumn } from '../columns/types.js';
import type { LayoutResult } from '../layout/types.js';
import type { GridModule } from '../modules/types.js';
import type { RowTransaction, TransactionResult } from '../store/types.js';

/**
 * The imperative surface of a grid.
 *
 * Core keeps only what every grid needs. Modules add their own methods by
 * declaration merging, so `api.expandAll()` type-checks exactly when the tree
 * module is imported and not otherwise.
 *
 * @example
 * ```ts
 * declare module 'flow-grid' {
 *   interface GridApi<TData> {
 *     expandAll(): void;
 *   }
 * }
 * ```
 */
export interface GridApi<TData = unknown> extends CoreGridApi<TData> {}

/**
 * The methods core itself implements.
 *
 * Split out from {@link GridApi} so that core can build and type-check its own api
 * object without the module augmentations being in scope — when the whole package
 * compiles together, every module's `declare module` block is visible, and core
 * must not be required to implement them.
 */
export interface CoreGridApi<TData = unknown> {
  applyTransaction(transaction: RowTransaction<TData>): TransactionResult;
  setRowData(data: readonly TData[]): TransactionResult;
  getRow(id: string): TData | undefined;
  getRowCount(): number;

  setColumnDefs(defs: ColumnDefs<TData>): void;
  getColumns(): readonly ResolvedColumn<TData>[];

  /** Current instance layout. Mainly for tests and diagnostics. */
  getLayout(): LayoutResult;
  /** Brings the instance containing a row into view. */
  scrollToRow(id: string): void;
  /** Forces a re-projection and repaint. */
  refresh(): void;

  getModule<T extends GridModule<TData>>(id: string): T | undefined;
  /**
   * Everything worth persisting, keyed by the module that owns it.
   *
   * Serialisable, so it can go straight to `localStorage` or a user profile
   * and come back through {@link setState}.
   */
  getState(): GridState;
  /**
   * Restores state produced by {@link getState}.
   *
   * A slice belonging to a module that is not installed is ignored rather than
   * being an error, so a saved profile survives a grid that has since dropped a
   * feature — and picks it up again if the feature returns.
   */
  setState(state: GridState): void;
}

/**
 * The persisted shape of a grid, assembled from the modules installed.
 *
 * Empty in core, because core has no state to save: a module contributes its
 * slice by augmenting this, the same way it contributes API methods and column
 * options. Import `flow-grid/sort` and `state.sort` exists and is typed;
 * without it, reading `state.sort` does not compile.
 *
 * Every slice is optional. State saved by a grid with more modules than the one
 * restoring it is still valid — the extra slices are simply not claimed.
 */
export interface GridState {}
