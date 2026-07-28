import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { RowContextValue, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow } from '../layout/types.js';
import type { RowDecoration } from '../modules/types.js';
import { SignalWatcher } from '../reactive/index.js';
import './tf-cell.js';

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
 */
@customElement('tf-row')
export class TfRow extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ attribute: false })
  accessor row!: DisplayRow;

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
    for (const cell of this.shadowRoot?.querySelectorAll('tf-cell') ?? []) {
      cell.classList.toggle('tf-row-hover', hovered);
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

    return repeat(
      grid.columns.get(),
      (column) => column.colId,
      (column) =>
        html`<tf-cell
          part="cell"
          role="gridcell"
          class=${cellClasses}
          style=${styleMap(cellProperties)}
          .column=${column}
        ></tf-cell>`,
    );
  }

  /** See tf-cell: decorations must be withdrawn as well as applied. */
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
    'tf-row': TfRow;
  }
}
