/**
 * What each element forwards across its shadow boundary.
 *
 * `part` is only visible one boundary up. The grid is four deep —
 * grid → instance → row → cell — so a part on a cell reaches page CSS only if
 * every host in between re-exports it. Miss one and `::part(cell)` matches
 * nothing, which looks exactly like a typo in the consumer's stylesheet.
 *
 * Kept here rather than spelled out at each call site so the chain is one list
 * to extend: a new part is added at its own level and every level above
 * inherits it.
 *
 * Not to be confused with `ls-grid-instance`'s `parts` property, which is a
 * different thing entirely: it says whether an instance renders its header, its
 * rows, or both.
 */

/** Inside a cell's shadow root. */
export const CELL_PARTS = ['cell-content'] as const;

/** Inside a header cell's shadow root. */
export const HEADER_CELL_PARTS = ['header-label', 'header-slots'] as const;

/** Inside a row's shadow root: the cells, and whatever they expose. */
export const ROW_PARTS = ['cell', ...CELL_PARTS] as const;

/** Inside an instance's shadow root. */
export const INSTANCE_PARTS = [
  'instance-grid',
  'row',
  ...ROW_PARTS,
  'header-cell',
  ...HEADER_CELL_PARTS,
] as const;

/**
 * The `exportparts` value for a child, as the attribute wants it.
 *
 * Module parts join at every level: a module renders into a cell or a header
 * cell, so its parts start as deep as anything core owns and have to travel the
 * same distance. Deduplicated, because a part named by core and by a module
 * would otherwise appear twice.
 */
export function forwardedParts(
  own: readonly string[],
  moduleParts: readonly string[] = NONE,
): string {
  const cached = cache.get(own);
  if (cached && cached.moduleParts === moduleParts) return cached.value;

  const value = [...new Set([...own, ...moduleParts])].join(', ');
  cache.set(own, { moduleParts, value });
  return value;
}

/**
 * One entry per `own` list, which is a module-level constant at every call site.
 *
 * This runs per row, per cell and per header cell on every render, and the
 * result changes only when the module set does — so it is cached against the
 * module parts array by identity, which the registry keeps stable for exactly
 * this reason. Without it a ticking cell rebuilt the same string every frame.
 */
const cache = new WeakMap<readonly string[], { moduleParts: readonly string[]; value: string }>();

/** Shared empty list, so the no-own-parts case is cacheable like the others. */
export const NONE: readonly string[] = [];
