/**
 * A row as the store holds it: an id and the consumer's data object.
 *
 * Deliberately free of hierarchy vocabulary. There is no `parentId`, `level`,
 * `childIds` or `isExpanded` here — that language belongs to the tree module, and
 * keeping it out of core is what lets a grid run with no tree module at all.
 */
export interface RowNode<TData = unknown> {
  readonly id: string;
  readonly data: TData;
}

export interface RowTransaction<TData = unknown> {
  readonly add?: readonly TData[];
  readonly update?: readonly TData[];
  readonly remove?: readonly string[];
}

/**
 * What a transaction actually changed.
 *
 * `structural` is the important bit: it distinguishes "the set or order of rows
 * changed, re-run the projection and layout" from "some values changed, just let
 * the bound cells re-render". Price ticks are the second kind, and treating them
 * as the first is what makes naive grids drop frames.
 */
export interface TransactionResult {
  readonly added: readonly string[];
  readonly updated: readonly string[];
  readonly removed: readonly string[];
  readonly structural: boolean;
  /**
   * Data keys whose values changed across all updated rows, or `'*'` when a row's
   * data was not a plain object. Projection stages match this against their
   * declared dependencies so a price tick re-runs the sort only when price is an
   * active sort key.
   */
  readonly fieldsChanged: ReadonlySet<string>;
}
