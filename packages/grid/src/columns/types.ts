import type { TemplateResult } from 'lit';
import type { RowNode } from '../store/types.js';
import type { DisplayRow } from '../layout/types.js';

/**
 * What a column function is given, in three tiers.
 *
 * They differ by how much of the grid exists when the function runs, which is
 * not a detail that can be papered over: sort and filter resolve values during
 * projection, deciding which rows there will be and in what order, so at that
 * point no row has been laid out and no `DisplayRow` exists. A single flat
 * context would have to lie about that — either by making `row` optional
 * everywhere, or by handing render-time callers something they cannot trust.
 *
 * Each tier is a superset of the one before, so a function that needs less can
 * be passed where more is available.
 */
export interface CellValueContext<TData = unknown> {
  readonly data: TData;
  readonly node: RowNode<TData>;
  // Deliberately not ResolvedColumn<TData, TValue>. That self-reference put
  // TValue in both an input and an output position, making ColumnDef invariant
  // in it — so a ColumnDef<Quote, number> could not sit in a column array
  // beside its siblings, which is what anyone writing a comparator needs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  readonly column: ResolvedColumn<TData, any>;
}

/** Adds the resolved value, for anything that runs after `valueGetter`. */
export interface CellFormatContext<
  TData = unknown,
  TValue = unknown,
> extends CellValueContext<TData> {
  /** Undefined when the field is absent or a dot path did not resolve. */
  readonly value: TValue | undefined;
}

/**
 * Adds the row as laid out, for anything that runs while rendering it.
 *
 * `row` is what makes per-row decisions possible — `meta.hasChildren` for a
 * group row, `meta.depth`, whether this is a repeat at the top of a
 * continuation — so `colSpan` and the cell decorators take this tier.
 */
export interface CellContext<TData = unknown, TValue = unknown> extends CellFormatContext<
  TData,
  TValue
> {
  readonly row: DisplayRow;
}

export type CellRendererFn<TData = unknown, TValue = unknown> = (
  params: CellFormatContext<TData, TValue>,
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
 * declare module '@lime-soda/grid' {
 *   interface ColumnDef<TData, TValue> {
 *     sortable?: boolean;
 *   }
 * }
 * ```
 */
/**
 * What a column holds.
 *
 * Two things follow from it, and both are wrong often enough by hand to be
 * worth deriving: which edge the value sits against, and how it reads when no
 * formatter says otherwise. A column of prices left-aligned is unreadable at a
 * glance — the digits that matter no longer line up — and it is the sort of
 * thing that gets fixed on the columns someone looked at and missed on the rest.
 */
export type ColumnValueType = 'text' | 'number' | 'date' | 'boolean';

/** Which edge a cell's content sits against. */
export type ColumnAlign = 'start' | 'center' | 'end';

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
  /**
   * What the column holds. Defaults to `text`, which changes nothing.
   *
   * Declaring it aligns the column and gives it a default reading — a number
   * to the right with its thousands separators, a date as the reader's locale
   * writes one. A `valueFormatter` still wins: the default is what to do when
   * nobody said.
   */
  valueType?: ColumnValueType;
  /**
   * Which edge the content sits against, overriding the value type's choice.
   *
   * For the cases the type cannot know: an identifier held as a number that
   * should read as a label, a status column centred to break up a wall of text.
   */
  align?: ColumnAlign;
  valueGetter?: (params: CellValueContext<TData>) => TValue;
  valueFormatter?: (params: CellFormatContext<TData, TValue>) => string;
  /** A custom element tag name, or a function returning a Lit template. */
  cellRenderer?: string | CellRendererFn<TData, TValue>;
  cellRendererParams?: Record<string, unknown>;

  /**
   * How many columns this cell covers, from this one rightwards.
   *
   * Per row, not per column, which is why it takes a context: a group row
   * spanning its heading across the whole grid is the common case, and its
   * children in the same column span nothing. Return 1, or omit it, for the
   * usual one-column cell.
   *
   * The columns covered render no cell of their own, and the grid treats the
   * span as a single stop when navigating — so a value in a covered column is
   * not reachable, and should not be somewhere data hides.
   */
  colSpan?: number | ((context: CellContext<TData, TValue>) => number);
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
  /** Always concrete: `text` unless the definition said otherwise. */
  readonly valueType: ColumnValueType;
  /** Always concrete: the definition's, or the one its value type implies. */
  readonly align: ColumnAlign;
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
