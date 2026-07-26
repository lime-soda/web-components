import type { TemplateResult } from 'lit';
import type { RowNode } from '../store/types.js';

export interface ValueGetterParams<TData = unknown, TValue = unknown> {
  readonly data: TData;
  readonly node: RowNode<TData>;
  // Deliberately not ResolvedColumn<TData, TValue>. That self-reference put
  // TValue in both an input and an output position, making ColumnDef invariant
  // in it — so a ColumnDef<Quote, number> could not sit in a column array
  // beside its siblings, which is what anyone writing a comparator needs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  readonly column: ResolvedColumn<TData, any>;
}

export interface ValueFormatterParams<TData = unknown, TValue = unknown> {
  /** Undefined when the field is absent or a dot path did not resolve. */
  readonly value: TValue | undefined;
  readonly data: TData;
  readonly node: RowNode<TData>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see ValueGetterParams
  readonly column: ResolvedColumn<TData, any>;
}

export type CellRendererFn<TData = unknown, TValue = unknown> = (
  params: ValueFormatterParams<TData, TValue>,
) => TemplateResult | string;

/**
 * A column as the consumer declares it.
 *
 * Core keeps this deliberately small. Modules add their own properties by
 * declaration merging into this interface — `sortable` and `comparator` arrive
 * with the sort module, `editable` with editing — so importing nothing leaves the
 * type surface minimal, and importing a module makes exactly its options appear.
 *
 * @example
 * ```ts
 * declare module '@flowgrid/core' {
 *   interface ColumnDef<TData, TValue> {
 *     sortable?: boolean;
 *   }
 * }
 * ```
 */
export interface ColumnDef<TData = unknown, TValue = unknown> {
  colId?: string;
  /**
   * Id of the module that contributed this column, stamped by the registry.
   *
   * Not for consumers to set. It lets a module tell a data column from another
   * module's furniture — the tree module puts its expander on the first column
   * the application declared, rather than on the selection module's checkbox.
   */
  readonly providedBy?: string;
  /** Property name, or a dot path such as `quote.bid.price`. */
  field?: string;
  headerName?: string;
  width?: number;
  minWidth?: number;
  flex?: number;
  /** Names of entries in `columnTypes` to merge in beneath this definition. */
  type?: string | readonly string[];
  valueGetter?: (params: ValueGetterParams<TData, TValue>) => TValue;
  valueFormatter?: (params: ValueFormatterParams<TData, TValue>) => string;
  /** A custom element tag name, or a function returning a Lit template. */
  cellRenderer?: string | CellRendererFn<TData, TValue>;
  cellRendererParams?: Record<string, unknown>;
  cellClass?: string | ((params: ValueFormatterParams<TData, TValue>) => string);
}

/** A column after defaults, column types and derived values have been applied. */
export interface ResolvedColumn<TData = unknown, TValue = unknown> extends Omit<
  ColumnDef<TData, TValue>,
  'colId' | 'type'
> {
  readonly colId: string;
  readonly headerName: string;
  readonly width: number;
  readonly index: number;
}

export interface ColumnResolutionOptions<TData = unknown> {
  defaultColDef?: ColumnDef<TData>;
  columnTypes?: Record<string, ColumnDef<TData>>;
}

/**
 * A list of column definitions.
 *
 * Each entry may carry its own value type, so a numeric column can declare
 * `ColumnDef<Quote, number>` and get a typed comparator and formatter while
 * sitting in the same array as its siblings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous by design
export type ColumnDefs<TData = unknown> = readonly ColumnDef<TData, any>[];
