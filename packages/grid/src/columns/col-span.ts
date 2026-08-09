import { getCellValue } from './resolve-columns.js';
import type { CellContext, ResolvedColumn } from './types.js';
import type { DisplayRow } from '../layout/types.js';
import type { RowNode } from '../store/types.js';

/** A column as it is actually laid out in one row. */
export interface SpannedColumn<TData = unknown> {
  readonly column: ResolvedColumn<TData>;
  /** Columns covered, including this one. Always at least 1. */
  readonly span: number;
}

/**
 * The columns a row renders, with the ones a span covers removed.
 *
 * A span is a property of the cell rather than of the column, so this has to be
 * resolved per row: the group heading spanning the grid and the instrument
 * below it occupy the same column. Anything that has to agree about what a row
 * contains — the renderer, the focus controller, the ARIA indices — reads it
 * from here rather than recomputing, so the three cannot drift.
 */
export function spannedColumns<TData>(
  columns: readonly ResolvedColumn<TData>[],
  row: DisplayRow,
  node: RowNode<TData> | undefined,
): readonly SpannedColumn<TData>[] {
  const out: SpannedColumn<TData>[] = [];

  for (let index = 0; index < columns.length;) {
    const column = columns[index]!;
    const span = clamp(spanOf(column, row, node), columns.length - index);
    out.push({ column, span });
    index += span;
  }

  return out;
}

/** The span of one cell, defaulting to a single column. */
function spanOf<TData>(
  column: ResolvedColumn<TData>,
  row: DisplayRow,
  node: RowNode<TData> | undefined,
): number {
  const { colSpan } = column;
  if (colSpan === undefined) return 1;
  if (typeof colSpan === 'number') return colSpan;
  if (!node) return 1;

  const context: CellContext<TData> = {
    value: getCellValue(column, node),
    data: node.data,
    node,
    column,
    row,
  };
  return colSpan(context);
}

/**
 * A span cannot be shorter than a column or run past the last one.
 *
 * A consumer returning 0, a fraction or more columns than exist would otherwise
 * either loop forever or leave the grid template short of cells.
 */
function clamp(span: number, remaining: number): number {
  if (!Number.isFinite(span)) return 1;
  return Math.min(Math.max(Math.floor(span), 1), remaining);
}
