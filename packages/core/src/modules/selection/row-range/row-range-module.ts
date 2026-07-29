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

    // One change for the whole span rather than one per row, so the grid
    // repaints once and a listener hears a single event.
    selection.setRowsSelected(span, true);
  }
}
