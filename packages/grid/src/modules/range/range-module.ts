import * as tokens from '@lime-soda/tokens/grid';
import { css } from 'lit';
import type { DisplayRow } from '../../layout/types.js';
import type { ResolvedColumn } from '../../columns/types.js';
import type { CellContext, CellDecoration, GridModule, ModuleContext } from '../types.js';
import { type CellRange, boundsOf, clamp, contains, edgesOf, rowIdsIn } from './range-model.js';

export const RANGE_EVENTS = {
  CHANGED: 'ls-grid-cell-range-changed',
} as const;

export interface CellRangeDetail {
  /** Store ids, in display order and without the layout's repeats. */
  readonly rowIds: readonly string[];
  readonly colIds: readonly string[];
}

export interface RangeModuleOptions {
  /**
   * Whether dragging across cells draws a range. On by default: it is the
   * gesture people arrive expecting, having used a spreadsheet.
   */
  readonly dragToSelect?: boolean;
}

/**
 * A rectangle of cells, the way a spreadsheet has one.
 *
 * Separate from row selection rather than an extension of it, and the two
 * coexist. They answer different questions — which instruments a trader has
 * picked out, versus which block of numbers they are about to copy — and a
 * module that collapsed one into the other would make it impossible to say
 * "these four rows, and from them just the two size columns".
 *
 * Everything is held in projection coordinates: an index into the rows as
 * displayed, and an index into the resolved columns. That is what makes the
 * flow layout a non-issue. A rectangle means the same rows whether they are
 * drawn in one instance or split across three, and the ancestor the layout
 * re-emits at a break is a row the reader can see and therefore a row the
 * rectangle covers — it is only on the way out, in {@link rowIdsIn}, that the
 * duplicate is dropped.
 */
export class RangeModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'range';
  readonly parts = ['cell-range'];

  readonly styles = css`
    /*
     * The fill is derived from the accent rather than given a token of its own,
     * so a theme that sets an accent gets a range that matches without knowing
     * this module exists. Deliberately faint: it sits under live numbers.
     */
    :host(.ls-grid-in-range) {
      background: color-mix(in srgb, ${tokens.accent} 12%, transparent);
    }

    /*
     * The active cell, in the range's own colours.
     *
     * Exactly one cell in a range is where the caret is — where typing goes and
     * where shift-arrow measures from. Two things were making it shout. It was
     * tinted as well as ringed, so a heavy outline sat on top of a fill; and the
     * outline is the design system's focus colour while the range is drawn in
     * the accent, so the caret arrived in a different hue from the block it was
     * sitting in and read as something else entirely.
     *
     * So: no tint, and the ring recoloured to the accent. What is left is a
     * heavier line in the same colour as the rectangle, which is how a
     * spreadsheet marks its active cell — of a piece with the selection rather
     * than competing with it.
     *
     * Only the colour changes. Dropping the ring would leave a focused cell with
     * no focus indicator whenever a range happened to be drawn, and the reader
     * who most needs to know where the caret is is the one who cannot see the
     * tint either.
     */
    :host(.ls-grid-in-range[data-focused]) {
      background: none;
      outline-color: ${tokens.accent};
    }

    /*
     * Only the cells on an edge draw that edge, so the outline belongs to the
     * rectangle. Every cell drawing its own box gives a lattice instead.
     */
    :host(.ls-grid-range-top) {
      border-top: 1px solid ${tokens.accent};
    }

    :host(.ls-grid-range-bottom) {
      border-bottom: 1px solid ${tokens.accent};
    }

    :host(.ls-grid-range-left) {
      border-left: 1px solid ${tokens.accent};
    }

    :host(.ls-grid-range-right) {
      border-right: 1px solid ${tokens.accent};
    }
  `;

  private ctx: ModuleContext<TData> | undefined;
  private range: CellRange | null = null;
  /** Pressed and dragging. Held here because the gesture spans many cells. */
  private dragging = false;
  private readonly wired = new WeakSet<Element>();

  constructor(private options: RangeModuleOptions = {}) {}

  init(ctx: ModuleContext<TData>): void {
    this.ctx = ctx;

    // A drag ends wherever the button comes up, which is very often not over a
    // cell — off the edge of the grid, or off the window entirely.
    //
    // Guarded because a module has to survive having no DOM. The projection and
    // everything that reads it are testable in node, and a module that throws
    // from init the moment it is registered there takes all of that with it.
    if (typeof globalThis.addEventListener !== 'function') return;
    const stop = () => {
      this.dragging = false;
    };
    globalThis.addEventListener('pointerup', stop);
    ctx.addTeardown(() => globalThis.removeEventListener('pointerup', stop));
  }

  destroy(): void {
    this.range = null;
    this.ctx = undefined;
  }

  setOptions(next: Partial<RangeModuleOptions>): void {
    this.options = { ...this.options, ...next };
  }

  // --- what is selected -----------------------------------------------------

  /** The current rectangle, clamped to the grid as it is now. */
  getCellRange(): CellRangeDetail | null {
    const range = this.currentRange();
    if (!range) return null;
    const bounds = boundsOf(range);
    return {
      rowIds: rowIdsIn(this.rows(), bounds),
      colIds: this.columns()
        .slice(bounds.firstColumn, bounds.lastColumn + 1)
        .map((column) => column.colId),
    };
  }

  /**
   * Sets the rectangle directly, in projection coordinates.
   *
   * For restoring a range and for tests. Coordinates rather than ids because a
   * rectangle is a shape over what is displayed — expressing it as row ids
   * would not survive a sort, and would say nothing about which cells are
   * between two rows that are no longer adjacent.
   */
  setCellRange(range: CellRange | null): void {
    this.range = range;
    this.announce();
  }

  clearCellRange(): void {
    if (!this.range) return;
    this.range = null;
    this.announce();
  }

  /** What the clipboard looks for. Declared, not reached into. */
  provideCellRange(): CellRangeDetail | null {
    return this.getCellRange();
  }

  /** A rectangle is more than one cell, so the grid says it is multiselectable. */
  provideMultiSelection(): boolean {
    return true;
  }

  // --- decoration -----------------------------------------------------------

  cellDecorator(ctx: CellContext<TData>): CellDecoration | null {
    const wire = (cell: HTMLElement) => this.wire(cell, ctx);

    const range = this.currentRange();
    if (!range) return { onRendered: wire };

    const at = this.coordinatesOf(ctx.row, ctx.column);
    if (!at || !contains(range, at.row, at.column)) return { onRendered: wire };

    const edges = edgesOf(range, at.row, at.column);
    return {
      // Announced, not merely drawn. `gridcell` takes `aria-selected`, and
      // without it a reader working through the grid is told nothing at all
      // about a block someone has marked out — the rectangle exists only for
      // people who can see the tint.
      attributes: { 'aria-selected': 'true' },
      classes: [
        'ls-grid-in-range',
        ...(edges.top ? ['ls-grid-range-top'] : []),
        ...(edges.bottom ? ['ls-grid-range-bottom'] : []),
        ...(edges.left ? ['ls-grid-range-left'] : []),
        ...(edges.right ? ['ls-grid-range-right'] : []),
      ],
      onRendered: wire,
    };
  }

  // --- keys -----------------------------------------------------------------

  onKeyDown(event: KeyboardEvent): boolean {
    const delta = ARROWS[event.key];
    if (!delta) return false;

    // An unshifted arrow is a move, and belongs to whatever owns navigation.
    // Declining it also clears the range, though not from here: the caret ends
    // up outside the rectangle, and that is what `currentRange` reads.
    if (!event.shiftKey) return false;

    const from = this.focusCoordinates();
    if (!from) return false;

    // Shift with no range yet begins one where the caret already is.
    this.range ??= {
      anchorRow: from.row,
      anchorColumn: from.column,
      headRow: from.row,
      headColumn: from.column,
    };

    // The head follows the caret, so the grid scrolls to keep up and the focus
    // ring stays on the cell the reader is steering.
    const moved =
      delta.row !== 0
        ? (this.ctx?.focus.moveRow(delta.row) ?? false)
        : (this.ctx?.focus.moveColumn(delta.column) ?? false);
    if (!moved) return true;

    const to = this.focusCoordinates();
    if (to) this.range = { ...this.range, headRow: to.row, headColumn: to.column };
    this.announce();
    return true;
  }

  apiExtension(): Record<string, unknown> {
    return {
      getCellRange: () => this.getCellRange(),
      clearCellRange: () => this.clearCellRange(),
    };
  }

  // --- pointer --------------------------------------------------------------

  private wire(cell: HTMLElement, ctx: CellContext<TData>): void {
    if (this.wired.has(cell)) return;
    this.wired.add(cell);

    cell.addEventListener('pointerdown', (event) => {
      const at = this.coordinatesOf(ctx.row, ctx.column);
      if (!at) return;

      // The caret goes where the gesture started, which is what a click does
      // anyway — the cell's own focus handler tells the controller. Left out,
      // focus stayed wherever it had been, `currentRange` found it outside the
      // rectangle just drawn, and cleared it on the way to being painted.
      //
      // Only on the press. A drag moves the head while the caret stays at the
      // anchor, and the anchor is a corner of the rectangle, so it never falls
      // outside the thing it is anchoring.
      cell.focus();

      if ((event as PointerEvent).shiftKey && this.range) {
        // Shift-click re-cuts from the existing anchor, as it does everywhere.
        this.range = { ...this.range, headRow: at.row, headColumn: at.column };
      } else {
        this.range = {
          anchorRow: at.row,
          anchorColumn: at.column,
          headRow: at.row,
          headColumn: at.column,
        };
        this.dragging = this.options.dragToSelect ?? true;
      }
      this.announce();
    });

    cell.addEventListener('pointerenter', () => {
      if (!this.dragging || !this.range) return;
      const at = this.coordinatesOf(ctx.row, ctx.column);
      if (!at) return;
      this.range = { ...this.range, headRow: at.row, headColumn: at.column };
      this.announce();
    });
  }

  // --- coordinates ----------------------------------------------------------

  private rows(): readonly DisplayRow[] {
    return this.ctx?.pipeline.projector.rows.get() ?? [];
  }

  private columns(): readonly ResolvedColumn<TData>[] {
    return this.ctx?.getColumns() ?? [];
  }

  /**
   * The range as it applies to the grid now.
   *
   * Filtering, collapsing or removing rows can leave a rectangle describing
   * more grid than there is. Clamped on read rather than recomputed on every
   * projection change: the range is only ever consulted while it is on screen.
   */
  private currentRange(): CellRange | null {
    if (!this.range) return null;

    // The caret has moved out of the rectangle, so the rectangle is stale.
    //
    // Read from where focus is rather than from a key press, because the key
    // never arrives: the registry offers a press to each module until one
    // reports it handled, and the keyboard module handles a plain arrow. This
    // module was clearing on a key it was never given, so a range stayed drawn
    // while the caret walked away from it. Focus is the state both agree on,
    // and it does not care which of them moved it.
    //
    // Moving *within* the rectangle leaves it alone. A spreadsheet would
    // collapse it to the cell, but there is nothing to collapse to that the
    // focus ring is not already showing.
    const at = this.focusCoordinates();
    if (at && !contains(this.range, at.row, at.column)) {
      this.range = null;
      return null;
    }

    return clamp(this.range, this.rows().length, this.columns().length);
  }

  private coordinatesOf(
    row: DisplayRow,
    column: ResolvedColumn<TData>,
  ): { row: number; column: number } | null {
    const rowIndex = this.rows().findIndex((candidate) => candidate.id === row.id);
    const columnIndex = this.columns().findIndex((candidate) => candidate.colId === column.colId);
    if (rowIndex < 0 || columnIndex < 0) return null;
    return { row: rowIndex, column: columnIndex };
  }

  private focusCoordinates(): { row: number; column: number } | null {
    const position = this.ctx?.focus.focused.get();
    if (!position || position.section !== 'body') return null;
    const rowIndex = this.rows().findIndex((row) => row.id === position.rowKey);
    const columnIndex = this.columns().findIndex((column) => column.colId === position.colId);
    if (rowIndex < 0 || columnIndex < 0) return null;
    return { row: rowIndex, column: columnIndex };
  }

  private announce(): void {
    this.ctx?.requestRender();
    this.ctx?.dispatch(RANGE_EVENTS.CHANGED, this.getCellRange());
  }
}

const ARROWS: Record<string, { row: number; column: number } | undefined> = {
  ArrowUp: { row: -1, column: 0 },
  ArrowDown: { row: 1, column: 0 },
  ArrowLeft: { row: 0, column: -1 },
  ArrowRight: { row: 0, column: 1 },
};
