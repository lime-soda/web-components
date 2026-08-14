/**
 * What positioning needs from a column, and nothing else.
 *
 * Structural rather than `ResolvedColumn<TData>`: the geometry does not depend
 * on the row type, and naming the three fields it reads keeps a generic that
 * would otherwise have to be threaded through every caller out of it.
 */
export interface PinnableColumn {
  readonly colId: string;
  readonly width: number;
  readonly pinned?: 'left' | 'right';
}

/** Where a pinned column sits once the rest have scrolled under it. */
export interface PinPlacement {
  readonly side: 'left' | 'right';
  /** Distance in px from that edge of the viewport. */
  readonly offset: number;
  /** The innermost pinned column on its side — the one that draws the divider. */
  readonly edge: boolean;
}

/**
 * Where each pinned column comes to rest.
 *
 * Only the stack layout has anything to pin against. A flow instance is a
 * fixed-width block sized to the sum of its columns and the scroller moves
 * between instances, so no column ever slides out from under the viewport —
 * there is nothing to hold still, and a sticky column would only detach itself
 * from the rows it belongs to. Flow gets an empty map and renders as before.
 *
 * Offsets accumulate in column order, which assumes the pinned columns have
 * already been gathered to their edges. That grouping belongs to whatever put
 * them there rather than here: this positions the order it is given.
 */
export function pinPlacements(
  columns: readonly PinnableColumn[],
  layout: 'flow' | 'stack',
): ReadonlyMap<string, PinPlacement> {
  const placements = new Map<string, PinPlacement>();
  if (layout !== 'stack') return placements;

  let left = 0;
  for (const column of columns) {
    if (column.pinned !== 'left') continue;
    placements.set(column.colId, { side: 'left', offset: left, edge: false });
    left += column.width;
  }

  let right = 0;
  for (let index = columns.length - 1; index >= 0; index -= 1) {
    const column = columns[index]!;
    if (column.pinned !== 'right') continue;
    placements.set(column.colId, { side: 'right', offset: right, edge: false });
    right += column.width;
  }

  // The divider goes on the column that meets the scrolling ones, which is the
  // last pinned column on the left and the first on the right.
  const lefts = columns.filter((column) => column.pinned === 'left');
  const rights = columns.filter((column) => column.pinned === 'right');
  markEdge(placements, lefts.at(-1));
  markEdge(placements, rights.at(0));

  return placements;
}

function markEdge(placements: Map<string, PinPlacement>, column: PinnableColumn | undefined): void {
  if (!column) return;
  const placement = placements.get(column.colId);
  if (placement) placements.set(column.colId, { ...placement, edge: true });
}
