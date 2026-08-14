import { css, html } from 'lit';
import type { TemplateResult } from 'lit';
import * as tokens from '@lime-soda/tokens/grid';
import { pinPlacements } from './pinning.js';
import type { PinPlacement } from './pinning.js';
import type { ResolvedColumn } from '../../columns/types.js';
import type {
  CellContext,
  CellDecoration,
  GridModule,
  HeaderDecoration,
  HeaderSlotContext,
  ModuleContext,
} from '../types.js';

/** Where a column sits and how wide it is, as the user last left it. */
export interface ColumnState {
  readonly colId: string;
  readonly width?: number;
  readonly pinned?: 'left' | 'right';
}

export interface ColumnsModuleOptions {
  /** Drag a header edge to resize. On by default. */
  resizable?: boolean;
  /** Drag a header to move the column. On by default. */
  reorderable?: boolean;
  /**
   * Allow columns to be pinned. On by default, and inert in the flow layout.
   *
   * Flow sizes each instance to its own columns and scrolls between instances,
   * so no column ever slides out from under the viewport for a pinned one to
   * stay in front of.
   */
  pinnable?: boolean;
  /** Floor for a drag-resize, in px. A column's own `minWidth` wins when larger. */
  minWidth?: number;
}

const DEFAULT_MIN_WIDTH = 40;

/**
 * Columns the user can rearrange: resize, reorder and pin.
 *
 * All three are one module because they are one interaction surface — the
 * header — and one piece of state: where a column sits and how wide it is. A
 * consumer who wants only resizing turns the other two off rather than
 * importing a third of a feature.
 *
 * Nothing here reaches into core rendering. The order and widths go through
 * `transformColumns`, and pinning is drawn by this module's own stylesheet
 * against a custom property it sets per cell — so a grid without this module
 * carries none of it, which matters most in the flow layout where pinning
 * cannot apply at all.
 */
export class ColumnsModule<TData = unknown> implements GridModule<TData, ColumnState[]> {
  readonly id = 'columns';

  private context?: ModuleContext<TData>;
  /** Explicit order by column id. Empty until something moves. */
  private order: string[] = [];
  private widths = new Map<string, number>();
  private pins = new Map<string, 'left' | 'right'>();
  /** Recomputed with the columns, so a cell reads its offset rather than finding it. */
  private placements: ReadonlyMap<string, PinPlacement> = new Map();

  constructor(private options: ColumnsModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  setOptions(next: Partial<ColumnsModuleOptions>): void {
    this.options = { ...this.options, ...next };
    this.changed();
  }

  /**
   * Applies the user's arrangement over the declared columns.
   *
   * Order first, then widths, then pinning — pinning last because gathering the
   * pinned columns to the edges rewrites the order, and doing that before the
   * explicit order was applied would let the two fight over the same columns.
   */
  transformColumns(columns: readonly ResolvedColumn<TData>[]): readonly ResolvedColumn<TData>[] {
    const ordered = this.applyOrder(columns);
    const sized = ordered.map((column) => this.applyWidth(column));
    const pinned = this.applyPins(sized);

    this.placements = pinPlacements(pinned, this.layout());
    return pinned;
  }

  // --- state -------------------------------------------------------------

  setColumnWidth(colId: string, width: number): void {
    const column = this.column(colId);
    if (!column) return;
    this.widths.set(colId, Math.max(width, this.floorFor(column)));
    this.changed();
  }

  /** Moves a column to an absolute index in the current visible order. */
  moveColumn(colId: string, toIndex: number): void {
    const ids = this.context?.getColumns().map((column) => column.colId) ?? [];
    const from = ids.indexOf(colId);
    if (from === -1) return;

    const next = [...ids];
    next.splice(from, 1);
    next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, colId);
    this.order = next;
    this.changed();
  }

  setColumnPinned(colId: string, side: 'left' | 'right' | null): void {
    if (side === null) this.pins.delete(colId);
    else this.pins.set(colId, side);
    this.changed();
  }

  getColumnState(): ColumnState[] {
    return (this.context?.getColumns() ?? []).map((column) => {
      const width = this.widths.get(column.colId);
      const pinned = this.pins.get(column.colId);
      return {
        colId: column.colId,
        ...(width === undefined ? {} : { width }),
        ...(pinned === undefined ? {} : { pinned }),
      };
    });
  }

  setColumnState(state: readonly ColumnState[]): void {
    this.order = state.map((entry) => entry.colId);
    this.widths = new Map(
      state.filter((e) => e.width !== undefined).map((e) => [e.colId, e.width!]),
    );
    this.pins = new Map(
      state.filter((e) => e.pinned !== undefined).map((e) => [e.colId, e.pinned!]),
    );
    this.changed();
  }

  resetColumnState(): void {
    this.order = [];
    this.widths.clear();
    this.pins.clear();
    this.changed();
  }

  getState(): ColumnState[] {
    return this.getColumnState();
  }

  setState(state: ColumnState[]): void {
    this.setColumnState(state ?? []);
  }

  apiExtension(): Record<string, unknown> {
    return {
      setColumnWidth: (colId: string, width: number) => this.setColumnWidth(colId, width),
      moveColumn: (colId: string, toIndex: number) => this.moveColumn(colId, toIndex),
      setColumnPinned: (colId: string, side: 'left' | 'right' | null) =>
        this.setColumnPinned(colId, side),
      getColumnState: () => this.getColumnState(),
      setColumnState: (state: readonly ColumnState[]) => this.setColumnState(state),
      resetColumnState: () => this.resetColumnState(),
    };
  }

  // --- rendering ---------------------------------------------------------

  static readonly styles = css`
    /*
     * The handles below are absolutely positioned within the header cell, and
     * the cell does not position itself — core has no reason to. Without this
     * they resolve against whatever ancestor happens to be positioned and land
     * somewhere else entirely.
     *
     * Scoped to headers by a marker class rather than a bare host selector,
     * because this one stylesheet is adopted by the body cells too and they
     * have no handles to contain.
     */
    :host(.ls-grid-column-header) {
      position: relative;
    }

    :host(.ls-grid-pinned) {
      position: sticky;
      z-index: 1;
      background: ${tokens.background};
    }

    :host(.ls-grid-pinned-left) {
      left: var(--ls-grid-pin-offset, 0px);
    }

    :host(.ls-grid-pinned-right) {
      right: var(--ls-grid-pin-offset, 0px);
    }

    :host(.ls-grid-pinned-edge-left) {
      border-right: 1px solid ${tokens.border};
    }

    :host(.ls-grid-pinned-edge-right) {
      border-left: 1px solid ${tokens.border};
    }

    /*
     * The header band is not inside the scroller. It sits outside and follows
     * the body with a transform, so there is no scrollport for a sticky header
     * to hold against — it rode along and split the column between a held cell
     * and a moving heading. Cancelling that transform is what holds it still.
     */
    :host(.ls-grid-pinned-header) {
      position: relative;
      z-index: 2;
      transform: translateX(var(--grid-scroll-left, 0px));
    }

    .ls-grid-resize-handle {
      position: absolute;
      inset-block: 0;
      inset-inline-end: -3px;
      width: 7px;
      cursor: col-resize;
      touch-action: none;
      background: transparent;
      border: 0;
      padding: 0;
      z-index: 3;
    }

    .ls-grid-resize-handle:hover,
    .ls-grid-resize-handle[data-dragging] {
      background: ${tokens.focus};
      opacity: 0.5;
    }

    .ls-grid-column-grip {
      flex: 0 0 auto;
      cursor: grab;
      touch-action: none;
      background: transparent;
      border: 0;
      padding: 0 2px;
      color: inherit;
      opacity: 0.45;
      font-size: 1em;
      line-height: 1;
    }

    .ls-grid-column-grip:hover {
      opacity: 1;
    }

    .ls-grid-column-grip[data-dragging] {
      cursor: grabbing;
      opacity: 1;
    }

    .ls-grid-column-grip:focus-visible,
    .ls-grid-resize-handle:focus-visible {
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: -1px;
    }
  `;

  readonly styles = ColumnsModule.styles;

  readonly parts = ['column-resize-handle', 'column-move-grip'] as const;

  cellDecorator(ctx: CellContext<TData>): CellDecoration | null {
    return this.pinDecoration(ctx.column.colId, false);
  }

  headerDecorator(ctx: HeaderSlotContext<TData>): HeaderDecoration | null {
    const pin = this.pinDecoration(ctx.column.colId, true);
    // The marker goes on every header, pinned or not: it is what gives the
    // resize handle something to position against.
    return { ...pin, classes: ['ls-grid-column-header', ...(pin?.classes ?? [])] };
  }

  headerSlot(ctx: HeaderSlotContext<TData>): TemplateResult | null {
    const resize = this.canResize(ctx.column);
    const move = this.canReorder(ctx.column);
    if (!resize && !move) return null;

    return html`
      ${
        move
          ? html`<button
              class="ls-grid-column-grip"
              part="column-move-grip"
              aria-label=${`Move ${ctx.column.headerName}`}
              @pointerdown=${(event: PointerEvent) => this.beginMove(event, ctx.column)}
              @keydown=${(event: KeyboardEvent) => this.shift(event, ctx.column)}
            >
              ⠿
            </button>`
          : null
      }
      ${
        resize
          ? html`<button
              class="ls-grid-resize-handle"
              part="column-resize-handle"
              aria-label=${`Resize ${ctx.column.headerName}`}
              @pointerdown=${(event: PointerEvent) => this.beginDrag(event, ctx.column)}
              @keydown=${(event: KeyboardEvent) => this.nudge(event, ctx.column)}
            ></button>`
          : null
      }
    `;
  }

  // --- interaction -------------------------------------------------------

  /**
   * Pointer capture rather than window listeners.
   *
   * The pointer leaves the 7px handle on the first move of any real drag, and
   * with plain listeners the drag would end there. Capture keeps the events
   * coming to the handle until release, including when the pointer leaves the
   * window entirely.
   */
  private beginDrag(event: PointerEvent, column: ResolvedColumn<TData>): void {
    const handle = event.currentTarget as HTMLElement;
    const startX = event.clientX;
    const startWidth = column.width;

    handle.setPointerCapture(event.pointerId);
    handle.toggleAttribute('data-dragging', true);
    event.preventDefault();
    event.stopPropagation();

    const move = (moved: PointerEvent) => {
      this.setColumnWidth(column.colId, startWidth + (moved.clientX - startX));
    };
    const end = () => {
      handle.removeAttribute('data-dragging');
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      this.context?.dispatch('ls-grid-column-resized', {
        colId: column.colId,
        width: this.widths.get(column.colId) ?? startWidth,
      });
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /**
   * Drags a column to a new position.
   *
   * The drop index comes from the header cells themselves rather than from
   * arithmetic on column widths: pinned columns, a column mid-resize and the
   * gap between instances all make the two disagree, and the headers are the
   * thing the user is actually aiming at.
   */
  private beginMove(event: PointerEvent, column: ResolvedColumn<TData>): void {
    const grip = event.currentTarget as HTMLElement;
    const headerCell = (grip.getRootNode() as ShadowRoot).host as HTMLElement;
    const siblings = [...(headerCell.parentElement?.children ?? [])] as HTMLElement[];

    grip.setPointerCapture(event.pointerId);
    grip.toggleAttribute('data-dragging', true);
    event.preventDefault();
    event.stopPropagation();

    let target = siblings.indexOf(headerCell);

    const move = (moved: PointerEvent) => {
      const over = siblings.findIndex((cell) => {
        const box = cell.getBoundingClientRect();
        return moved.clientX >= box.left && moved.clientX <= box.right;
      });
      if (over !== -1) target = over;
    };
    const end = () => {
      grip.removeAttribute('data-dragging');
      grip.releasePointerCapture(event.pointerId);
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      if (target !== siblings.indexOf(headerCell)) {
        this.moveColumn(column.colId, target);
        this.context?.dispatch('ls-grid-column-moved', { colId: column.colId, toIndex: target });
      }
    };

    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  /** Arrow keys on the grip move the column, for anyone who cannot drag one. */
  private shift(event: KeyboardEvent, column: ResolvedColumn<TData>): void {
    const ids = this.context?.getColumns().map((c) => c.colId) ?? [];
    const index = ids.indexOf(column.colId);
    if (index === -1) return;

    if (event.key === 'ArrowLeft' && index > 0) this.moveColumn(column.colId, index - 1);
    else if (event.key === 'ArrowRight' && index < ids.length - 1) {
      this.moveColumn(column.colId, index + 1);
    } else return;

    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Arrow keys on the handle resize it too.
   *
   * A drag is not an accessible affordance on its own, and resizing is exactly
   * the kind of thing someone who cannot drag still needs — a column of numbers
   * ellipsised to `1,2…` is unreadable, not merely inconvenient.
   */
  private nudge(event: KeyboardEvent, column: ResolvedColumn<TData>): void {
    const step = event.shiftKey ? 50 : 10;
    if (event.key === 'ArrowLeft') this.setColumnWidth(column.colId, column.width - step);
    else if (event.key === 'ArrowRight') this.setColumnWidth(column.colId, column.width + step);
    else return;

    event.preventDefault();
    event.stopPropagation();
  }

  // --- internals ---------------------------------------------------------

  private pinDecoration(colId: string, header: boolean): CellDecoration | null {
    const placement = this.placements.get(colId);
    if (!placement) return null;

    return {
      classes: [
        'ls-grid-pinned',
        `ls-grid-pinned-${placement.side}`,
        ...(placement.edge ? [`ls-grid-pinned-edge-${placement.side}`] : []),
        ...(header ? ['ls-grid-pinned-header'] : []),
      ],
      customProperties: { '--ls-grid-pin-offset': `${placement.offset}px` },
    };
  }

  private applyOrder(columns: readonly ResolvedColumn<TData>[]): readonly ResolvedColumn<TData>[] {
    if (this.order.length === 0) return columns;

    const byId = new Map(columns.map((column) => [column.colId, column]));
    const known = this.order
      .map((colId) => byId.get(colId))
      .filter((column): column is ResolvedColumn<TData> => column !== undefined);
    // A column added since the order was recorded keeps its declared position
    // rather than being dropped or shunted to the end.
    const rest = columns.filter((column) => !this.order.includes(column.colId));
    return [...known, ...rest];
  }

  private applyWidth(column: ResolvedColumn<TData>): ResolvedColumn<TData> {
    const width = this.widths.get(column.colId);
    if (width === undefined) return column;
    // Fixed, not flex: a column the user has sized should keep that size rather
    // than be redistributed on the next container resize.
    return { ...column, width, sizing: 'fixed', flex: 0 };
  }

  private applyPins(columns: readonly ResolvedColumn<TData>[]): readonly ResolvedColumn<TData>[] {
    // Nothing at all in the flow layout, not merely no sticky positioning:
    // gathering a column to the edge there would move it in front of its
    // neighbours and then fail to hold it, which is worse than ignoring the
    // request outright.
    if (this.pins.size === 0 || !this.pinnable() || this.layout() !== 'stack') return columns;

    const withPins = columns.map((column) => {
      const pinned = this.pins.get(column.colId);
      return pinned === undefined ? column : { ...column, pinned };
    });

    // Gathered to the edges, because the offsets that hold them there assume it
    // — a pinned column left in the middle would stick over its own neighbours.
    return [
      ...withPins.filter((column) => column.pinned === 'left'),
      ...withPins.filter((column) => column.pinned === undefined),
      ...withPins.filter((column) => column.pinned === 'right'),
    ];
  }

  private column(colId: string): ResolvedColumn<TData> | undefined {
    return this.context?.getColumns().find((column) => column.colId === colId);
  }

  private floorFor(column: ResolvedColumn<TData>): number {
    return Math.max(column.minWidth ?? 0, this.options.minWidth ?? DEFAULT_MIN_WIDTH);
  }

  private canResize(column: ResolvedColumn<TData>): boolean {
    if (this.options.resizable === false) return false;
    return column.resizable !== false;
  }

  private canReorder(column: ResolvedColumn<TData>): boolean {
    if (this.options.reorderable === false) return false;
    return column.reorderable !== false;
  }

  private pinnable(): boolean {
    return this.options.pinnable !== false;
  }

  /**
   * Taken from the engine rather than the grid options, because the engine is
   * what actually decides whether anything scrolls out from under the viewport
   * — and a consumer can supply their own instead of naming a built-in one.
   */
  private layout(): 'flow' | 'stack' {
    return this.context?.pipeline.engine.id === 'stack' ? 'stack' : 'flow';
  }

  private changed(): void {
    this.context?.invalidate();
  }
}
