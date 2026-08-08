import type { TemplateResult } from 'lit';
import type { RowNode } from '../store/types.js';

export interface ValueGetterParams<TData = unknown> {
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
 * declare module 'flow-grid' {
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
  /** Fixed width in px. Mutually exclusive with `flex`; `width` wins if both are set. */
  width?: number;
  /** Lower bound. Applies to a fixed width, and to a flexible column's track. */
  minWidth?: number;
  /**
   * Share of the leftover space, as a CSS `fr`.
   *
   * Only the stack layout can honour this: a flow instance is a fixed-width block
   * whose width is the sum of its columns, so there is no leftover for a fraction
   * to divide. A flexible column falls back to `width` there.
   *
   * A column with neither `width` nor `flex` is flexible with a share of 1, so a
   * grid of undeclared columns fills its container evenly.
   */
  flex?: number;
  /** Names of entries in `columnTypes` to merge in beneath this definition. */
  type?: string | readonly string[];
  valueGetter?: (params: ValueGetterParams<TData>) => TValue;
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
  /**
   * Width in px.
   *
   * Always concrete, because the flow layout engine sums these to size an
   * instance. For a flexible column this is the fallback used where `fr` cannot
   * resolve.
   */
  readonly width: number;
  /** How the column is sized when the layout can offer leftover space. */
  readonly sizing: 'fixed' | 'flex';
  /** Share of the leftover space. Only meaningful when `sizing` is `flex`. */
  readonly flex: number;
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
