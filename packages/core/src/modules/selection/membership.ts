import type { DisplayRow } from '../../layout/types.js';

/**
 * What a row id stands for when it is selected.
 *
 * Core selection holds a flat set of ids, and every row stands only for itself.
 * That is the whole of the model, and it is why core selection knows nothing
 * about hierarchy: selecting a row adds one id, deselecting removes it.
 *
 * A module that does understand hierarchy replaces this, so that selecting a
 * group means selecting the rows beneath it, and a group whose children are
 * partly selected can report itself as indeterminate. Doing it through an
 * interface rather than a flag is what keeps that logic — and its cost — out of
 * the grids that never group anything.
 */
export interface SelectionMembership {
  /**
   * The ids this row stands for.
   *
   * Empty when the row cannot be selected at all, which is how an unselectable
   * row is refused: there is nothing to add to the set.
   */
  leavesOf(rowId: string): readonly string[];

  /** Every selectable id in the current projection, for select-all. */
  allLeaves(): readonly string[];

  /**
   * Whether this id counts as selected — in its own right, or through something
   * else that is.
   *
   * Flat selection can only answer "is it in the set". A hierarchy can also
   * answer "is one of its ancestors in the set", which is what stops a
   * selection made while a group was collapsed from vanishing when it opens.
   */
  covers(rowId: string, selected: ReadonlySet<string>): boolean;

  /**
   * Rewrites the set so this row is no longer selected through anything else.
   *
   * Called when a row is deselected. Flat selection has nothing to do; a
   * hierarchy has to break up any selected ancestor covering the row, keeping
   * that ancestor's other children, or the row would spring straight back.
   */
  withdraw(rowId: string, selected: Set<string>): void;
}

/**
 * The default: every row stands for itself and nothing else.
 *
 * Deliberately unaware of `meta.depth` and `repeatOnBreak`, even though the
 * rows carry them. A grid that wants those read installs the module that reads
 * them.
 */
export class FlatMembership implements SelectionMembership {
  constructor(
    private readonly rows: () => readonly DisplayRow[],
    private readonly canSelect: (rowId: string, meta: Readonly<Record<string, unknown>>) => boolean,
  ) {}

  leavesOf(rowId: string): readonly string[] {
    const row = this.rows().find((candidate) => candidate.rowId === rowId);
    // A row absent from the projection is still selectable by id — the caller
    // named it, and the grid has no reason to claim it does not exist.
    if (!row) return [rowId];
    return this.canSelect(rowId, row.meta ?? {}) ? [rowId] : [];
  }

  allLeaves(): readonly string[] {
    const ids = new Set<string>();
    for (const row of this.rows()) {
      if (this.canSelect(row.rowId, row.meta ?? {})) ids.add(row.rowId);
    }
    return [...ids];
  }

  covers(rowId: string, selected: ReadonlySet<string>): boolean {
    return selected.has(rowId);
  }

  withdraw(): void {
    // Nothing can confer selection on anything else, so nothing to withdraw.
  }
}

/**
 * Extends the selection from the anchor to a row.
 *
 * Supplied by a range module. Core selection holds the anchor — it is just the
 * last row acted on — but has no notion of the span between two rows.
 */
export type RangeHandler = (toRowId: string) => void;
