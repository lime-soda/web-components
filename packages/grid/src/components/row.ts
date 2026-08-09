import { spannedColumns } from '../columns/col-span.js';
import { CELL_PARTS, forwardedParts } from './part-forwarding.js';
import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { RowContextValue, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow } from '../layout/types.js';
import type { RowDecoration } from '../modules/types.js';
import { SignalWatcher } from '../reactive/index.js';

/**
 * One display row.
 *
 * `display: contents` so the cells become items of the instance's CSS grid
 * directly — that is what keeps columns aligned across every row without any
 * measurement. It also means the row has no box to paint, so a module's visual
 * decoration is forwarded to the cells instead.
 *
 * The element holds no subscriptions. The prototype's row managed three by hand
 * (node, selection, store) with matching teardown in `disconnectedCallback`; here
 * the row context reads a signal and Lit handles the rest.
 *
 * @customElement ls-grid-row
 */
export class GridRow extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      /*
       * A row spans every column and lines its cells up with the instance's
       * tracks, rather than dissolving into them.
       *
       * It was display:contents, which made the cells grid items directly. That
       * works, but it puts role=row, aria-rowindex and aria-level on an element
       * with no box — a combination browsers have handled inconsistently, and
       * one there is no reason to rely on. Subgrid gives the same alignment
       * with the row still a real element.
       */
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }
  `;

  @property({ attribute: false })
  accessor row!: DisplayRow;

  /** 1-based position within this instance, the header row being 1. */
  @property({ attribute: false })
  accessor rowIndex = 0;

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController | undefined;

  @provide({ context: rowContext })
  accessor rowValue: RowContextValue | undefined;

  private appliedClasses = new Set<string>();
  private appliedAttributes = new Set<string>();
  private activators: ((event: Event) => void)[] = [];

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'row');
    // Cells live in this element's shadow root, so their events reach the host.
    // A `display: contents` element receives none of its own.
    this.addEventListener('click', this.handleActivate);
    this.addEventListener('mouseenter', this.handleHover);
    this.addEventListener('mouseleave', this.handleHover);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('click', this.handleActivate);
    this.removeEventListener('mouseenter', this.handleHover);
    this.removeEventListener('mouseleave', this.handleHover);
  }

  private readonly handleActivate = (event: Event): void => {
    for (const activate of this.activators) activate(event);
  };

  /**
   * Highlights the whole row on hover.
   *
   * Done in script rather than `:hover` because the row is `display: contents`:
   * its cells are the grid items and CSS has no way to say "my sibling is
   * hovered". Tracking a row across a monitor-wide grid is the whole point.
   */
  private readonly handleHover = (event: Event): void => {
    const hovered = event.type === 'mouseenter';
    for (const cell of this.shadowRoot?.querySelectorAll('ls-grid-cell') ?? []) {
      cell.classList.toggle('ls-grid-row-hover', hovered);
    }
  };

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    if (!this.grid) return;
    // Rebuilt only when the row identity changes: the context object stays stable
    // across ticks, so consumers are not re-provided on every price change.
    if (changed.has('row') || changed.has('grid') || this.rowValue === undefined) {
      this.rowValue = new RowContextValue(this.grid.pipeline.store, this.row);
    }
  }

  override render(): unknown {
    // A repeat carries no index and is hidden: it is the same row appearing
    // again at the top of a continuation, and reading it twice would be a lie
    // about how many rows there are.
    if (this.rowIndex > 0) {
      this.setAttribute('aria-rowindex', String(this.rowIndex));
      this.removeAttribute('aria-hidden');
    } else {
      this.removeAttribute('aria-rowindex');
      this.setAttribute('aria-hidden', 'true');
    }

    const grid = this.grid;
    if (!grid || !this.rowValue) return nothing;

    grid.registry.version.get();

    const node = this.rowValue.node;
    const decorations = grid.registry.rowDecorations({ row: this.row, node });
    this.applyDecorations(decorations);

    // Row-level decoration reaches the cells as classes and custom properties.
    // A row is `display: contents` and paints nothing itself.
    const cellClasses = decorations.flatMap((d) => d.cellClasses ?? []).join(' ');
    const cellProperties = Object.assign(
      {},
      ...decorations.map((d) => d.cellCustomProperties ?? {}),
    ) as Record<string, string>;

    // Spans are resolved per row, so a group heading can cover the grid while
    // the instrument below it does not. Columns a span covers render no cell.
    const laidOut = spannedColumns(grid.columns.get(), this.row, node);

    return repeat(
      laidOut,
      ({ column }) => column.colId,
      ({ column, span }) =>
        html`<ls-grid-cell
          part="cell"
          exportparts=${forwardedParts(CELL_PARTS, grid.registry.moduleParts())}
          role="gridcell"
          aria-colindex=${column.index + 1}
          aria-colspan=${span > 1 ? span : nothing}
          class=${cellClasses}
          style=${styleMap(
            span > 1 ? { ...cellProperties, gridColumn: `span ${span}` } : cellProperties,
          )}
          .column=${column}
        ></ls-grid-cell>`,
    );
  }

  /** See ls-grid-cell: decorations must be withdrawn as well as applied. */
  private applyDecorations(decorations: readonly RowDecoration[]): void {
    const classes = new Set(decorations.flatMap((d) => d.classes ?? []));
    const attributes = new Map<string, string>();
    for (const decoration of decorations) {
      for (const [name, value] of Object.entries(decoration.attributes ?? {})) {
        attributes.set(name, value);
      }
    }

    for (const className of this.appliedClasses) {
      if (!classes.has(className)) this.classList.remove(className);
    }
    for (const name of this.appliedAttributes) {
      if (!attributes.has(name)) this.removeAttribute(name);
    }
    for (const className of classes) this.classList.add(className);
    for (const [name, value] of attributes) this.setAttribute(name, value);

    this.appliedClasses = classes;
    this.appliedAttributes = new Set(attributes.keys());
    this.activators = decorations
      .map((decoration) => decoration.onActivate)
      .filter((fn): fn is (event: Event) => void => fn !== undefined);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-row': GridRow;
  }
}
