import type { DisplayRow } from '../../../layout/types.js';
import type { GridModule, ModuleContext } from '../../types.js';
import type { RangeHandler } from '../membership.js';
import type { SelectionModule } from '../selection-module.js';

/**
 * Shift-click spans over contiguous rows.
 *
 * Core selection holds the anchor — it is just the last row acted on — but has
 * no notion of the span between two rows. This supplies one, so shift-clicking
 * a row, or a checkbox, selects everything between it and the anchor.
 *
 * The span is taken from the projection, so it covers the rows as displayed:
 * sorted, filtered and with collapsed groups standing for their children. A
 * span across a collapsed group selects the group, which means its contents,
 * rather than reaching past it into rows that are not on screen.
 */
export class RowRangeModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'selection-row-range';
  readonly dependsOn = ['selection'];

  private selection?: SelectionModule<TData>;

  /**
   * The span this module last applied, and the anchor it was measured from.
   *
   * Shift-clicking again re-cuts that span rather than clearing the selection:
   * rows picked out separately — by a plain click, a Ctrl-click, a checkbox —
   * are none of the range's business and survive it. When the anchor moves, a
   * new range has begun and the old span is no longer this module's to withdraw.
   */
  private lastSpan: readonly string[] = [];
  private spanAnchor: string | null = null;

  init(context: ModuleContext<TData>): void {
    const selection = context.getModule<SelectionModule<TData>>('selection');
    // `dependsOn` is asserted by the registry, so this is a type narrowing
    // rather than a real possibility.
    if (!selection) return;
    this.selection = selection;
  }

  /**
   * The rows a span stands for, which is not simply the rows it covers.
   *
   * A row whose children are on screen speaks only for the children inside the
   * span — and each of those is in the span in its own right, so the parent
   * contributes nothing beyond them and is dropped. That is what makes a range
   * over a whole group select the whole group, while a range that merely
   * crosses into one selects the rows it crossed and no more. Passing the
   * parent through instead expanded it to every child it had, so clipping the
   * corner of a group selected all of it.
   *
   * A row whose children are *not* on screen is kept: a collapsed group is the
   * only representation its contents have, so spanning it means them.
   *
   * Depth is the projection's own convention, and with no hierarchy in play
   * every row is depth 0 and nothing is ever dropped.
   */
  private spanOf(
    selection: SelectionModule<TData>,
    rows: readonly DisplayRow[],
    from: number,
    to: number,
  ): readonly string[] {
    const projected = new Set(rows.map((row) => row.rowId));

    // A row whose rows are themselves on screen adds nothing to a span: each of
    // them is selectable in its own right, and the span covers exactly those it
    // reaches. A row whose are *not* on screen — a leaf, or a parent whose
    // contents are hidden behind it — is the only thing that can stand for them.
    //
    // So a range over a whole parent takes the whole parent, one that clips a
    // corner takes only the corner, and one that stops at a heading reaches
    // nothing past it.
    //
    // Asked of selection rather than worked out from `meta.depth`, so this
    // module needs no notion of hierarchy and cannot disagree with whichever
    // module supplied one.
    const standsForSomethingOnScreen = (rowId: string): boolean =>
      selection.standsFor(rowId).some((id) => id !== rowId && projected.has(id));

    return rows
      .slice(from, to + 1)
      .map((row) => row.rowId)
      .filter((rowId) => !standsForSomethingOnScreen(rowId));
  }

  /** How a shift-click extends the selection, for core selection to find. */
  provideSelectionRange(): RangeHandler {
    return (toRowId) => this.selectRange(toRowId);
  }

  /**
   * Selects the span between the anchor and the given row.
   *
   * Falls back to selecting the row alone when there is no anchor, or when
   * either end is missing from the projection — a span needs two ends that are
   * actually on screen, and selecting the row asked for is a better answer than
   * doing nothing.
   */
  selectRange(toRowId: string): void {
    const selection = this.selection;
    if (!selection) return;

    const anchor = selection.getAnchor();
    if (anchor === null) {
      selection.setRowSelected(toRowId, true);
      this.lastSpan = [];
      this.spanAnchor = null;
      return;
    }

    const rows = selection.projectedRows();
    const from = rows.findIndex((row) => row.rowId === anchor);
    const to = rows.findIndex((row) => row.rowId === toRowId);
    if (from === -1 || to === -1) {
      selection.setRowSelected(toRowId, true);
      return;
    }

    const span = this.spanOf(selection, rows, Math.min(from, to), Math.max(from, to));

    // Shrinking a range has to give back what it no longer covers, or dragging
    // back from row 6 to row 3 would leave 4, 5 and 6 selected and the span
    // would only ever grow.
    const previous = this.spanAnchor === anchor ? this.lastSpan : [];
    const withdrawn = previous.filter((rowId) => !span.includes(rowId));
    if (withdrawn.length > 0) selection.setRowsSelected(withdrawn, false);

    // One change for the whole span rather than one per row, so the grid
    // repaints once and a listener hears a single event.
    selection.setRowsSelected(span, true);
    this.lastSpan = span;
    this.spanAnchor = anchor;
  }
}
