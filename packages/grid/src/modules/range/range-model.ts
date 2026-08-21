import type { DisplayRow } from '../../layout/types.js';

/**
 * A rectangle of cells, held as the two corners a reader actually produced.
 *
 * Stored as anchor and head rather than as normalised bounds because the two
 * are not interchangeable: the anchor is where the range began and stays put,
 * the head is where the caret is and moves. Shift-arrow past the anchor flips
 * which one is topmost, and a range that had forgotten which corner was which
 * would grow away from the reader instead of collapsing back through them.
 */
export interface CellRange {
  /** Index into the projection — the rows as displayed, sorted and filtered. */
  readonly anchorRow: number;
  readonly anchorColumn: number;
  readonly headRow: number;
  readonly headColumn: number;
}

export interface RangeBounds {
  readonly firstRow: number;
  readonly lastRow: number;
  readonly firstColumn: number;
  readonly lastColumn: number;
}

export const boundsOf = (range: CellRange): RangeBounds => ({
  firstRow: Math.min(range.anchorRow, range.headRow),
  lastRow: Math.max(range.anchorRow, range.headRow),
  firstColumn: Math.min(range.anchorColumn, range.headColumn),
  lastColumn: Math.max(range.anchorColumn, range.headColumn),
});

export const contains = (range: CellRange, row: number, column: number): boolean => {
  const bounds = boundsOf(range);
  return (
    row >= bounds.firstRow &&
    row <= bounds.lastRow &&
    column >= bounds.firstColumn &&
    column <= bounds.lastColumn
  );
};

/** Which edges of the rectangle a cell sits on, for drawing one outline round it. */
export interface EdgeFlags {
  readonly top: boolean;
  readonly bottom: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/**
 * A range is one shape, not a grid of boxes.
 *
 * Every cell drawing its own border gives a lattice; only the cells on an edge
 * draw that edge, so the outline is the rectangle's.
 */
export const edgesOf = (range: CellRange, row: number, column: number): EdgeFlags => {
  const bounds = boundsOf(range);
  return {
    top: row === bounds.firstRow,
    bottom: row === bounds.lastRow,
    left: column === bounds.firstColumn,
    right: column === bounds.lastColumn,
  };
};

/**
 * The rows a range covers, as store ids, in display order and without repeats.
 *
 * Two reasons a projection index cannot simply be mapped to a row id. The flow
 * layout re-emits an ancestor at the top of each instance it breaks across, so
 * one row can appear several times and a range spanning a break would otherwise
 * copy it twice. And a range is a rectangle over what is displayed, so a
 * collapsed group contributes itself and not the children hidden behind it —
 * which is what the reader can see, and therefore what they meant to take.
 */
export const rowIdsIn = (rows: readonly DisplayRow[], bounds: RangeBounds): readonly string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = bounds.firstRow; i <= bounds.lastRow; i += 1) {
    const row = rows[i];
    if (!row || seen.has(row.rowId)) continue;
    seen.add(row.rowId);
    out.push(row.rowId);
  }
  return out;
};

/** Clamps a range to the grid it is drawn on, after rows or columns have gone. */
export const clamp = (
  range: CellRange,
  rowCount: number,
  columnCount: number,
): CellRange | null => {
  if (rowCount <= 0 || columnCount <= 0) return null;
  const limit = (value: number, max: number) => Math.max(0, Math.min(value, max - 1));
  return {
    anchorRow: limit(range.anchorRow, rowCount),
    anchorColumn: limit(range.anchorColumn, columnCount),
    headRow: limit(range.headRow, rowCount),
    headColumn: limit(range.headColumn, columnCount),
  };
};
