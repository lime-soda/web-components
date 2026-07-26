import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { RowContextValue, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow } from '../layout/types.js';
import type { RowDecoration } from '../modules/types.js';
import { SignalWatcher } from '../reactive/index.js';
import './fg-cell.js';

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
@customElement('fg-row')
export class FgRow extends SignalWatcher(LitElement) {
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
    // Cells live in this element's shadow root, so their clicks reach the host.
    // A `display: contents` element receives no clicks of its own.
    this.addEventListener('click', this.handleActivate);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('click', this.handleActivate);
  }

  private readonly handleActivate = (event: Event): void => {
    for (const activate of this.activators) activate(event);
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

    const cellClasses = decorations.flatMap((d) => d.cellClasses ?? []).join(' ');
    const cellAttributes = Object.assign(
      {},
      ...decorations.map((d) => d.cellAttributes ?? {}),
    ) as Record<string, string>;
    const cellStyle = cellAttributes['style'] ?? '';

    return repeat(
      grid.columns.get(),
      (column) => column.colId,
      (column) =>
        html`<fg-cell
          part="cell"
          role="gridcell"
          class=${cellClasses}
          style=${cellStyle}
          .column=${column}
        ></fg-cell>`,
    );
  }

  /** See fg-cell: decorations must be withdrawn as well as applied. */
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
    'fg-row': FgRow;
  }
}
