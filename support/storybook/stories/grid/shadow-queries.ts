import {
  accessibleName,
  deepElements,
  findAllByRole,
  parentOf,
  queryAllByRole,
  settleRenders,
} from '../shadow-queries.js';

/**
 * The queries that know what a grid is.
 *
 * Everything generic — roles, deep traversal, keys, pointers, tabbing — lives
 * one directory up, so the button's stories drive the DOM through the same
 * helpers rather than through a second set that disagrees with these in some
 * detail nobody notices for a year.
 */

export * from '../shadow-queries.js';

/**
 * The grid's rows in visual order, excluding the header row.
 *
 * And excluding the sticky band. The stack layout redraws the heading of the
 * group being scrolled through in a pinned strip above the rows, so that row
 * appears twice to a query — once where it lives and once as context. Counting
 * it makes a filtered grid look like it kept a row it dropped.
 */
export const dataRows = (root: ParentNode): HTMLElement[] =>
  queryAllByRole(root, 'row')
    .filter((row) => row.tagName === 'LS-GRID-ROW')
    .filter((row) => !inStickyBand(row));

const inStickyBand = (element: Element): boolean => {
  for (let node: Element | null = element; node; node = parentOf(node)) {
    if (node.classList?.contains('stack-sticky')) return true;
  }
  return false;
};

/** The cells of one row, in column order. */
export const cellsOf = (row: ParentNode): HTMLElement[] => queryAllByRole(row, 'gridcell');
/** The grid mounted and fully drawn: cells present, and their contents with them. */
export async function gridReady(root: ParentNode): Promise<void> {
  await findAllByRole(root, 'gridcell');
  await settleRenders(root);
}

/**
 * A cell's own value, without the controls a module put beside it.
 *
 * The accessible name of a cell includes everything in it, which is correct —
 * a screen reader reads the expander too. But a test comparing values wants the
 * value, and `▶ Group 0` matching `Group 0` is a comparison nobody wants to
 * write twice.
 */
export function cellText(cell: Element): string {
  const content = [...deepElements(cell)].find(
    (element) => element.getAttribute('part') === 'cell-content',
  );
  return accessibleName(content ?? cell);
}
