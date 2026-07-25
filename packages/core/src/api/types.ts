import type { ColumnDef, ResolvedColumn } from '../columns/types.js';
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
 * declare module '@flowgrid/core' {
 *   interface GridApi<TData> {
 *     expandAll(): void;
 *   }
 * }
 * ```
 */
export interface GridApi<TData = unknown> {
  applyTransaction(transaction: RowTransaction<TData>): TransactionResult;
  setRowData(data: readonly TData[]): TransactionResult;
  getRow(id: string): TData | undefined;
  getRowCount(): number;

  setColumnDefs(defs: readonly ColumnDef<TData>[]): void;
  getColumns(): readonly ResolvedColumn<TData>[];

  /** Current instance layout. Mainly for tests and diagnostics. */
  getLayout(): LayoutResult;
  /** Brings the instance containing a row into view. */
  scrollToRow(id: string): void;
  /** Forces a re-projection and repaint. */
  refresh(): void;

  getModule<T extends GridModule<TData>>(id: string): T | undefined;
  /** Aggregated module state, suitable for persisting. */
  getState(): Record<string, unknown>;
  setState(state: Record<string, unknown>): void;
}
