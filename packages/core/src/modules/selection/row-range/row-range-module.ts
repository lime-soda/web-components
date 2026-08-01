import type { GridModule, ModuleContext } from '../../types.js';
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

    context.addTeardown(selection.setRangeHandler((toRowId) => this.selectRange(toRowId)));
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

    const span = rows.slice(Math.min(from, to), Math.max(from, to) + 1).map((row) => row.rowId);

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
