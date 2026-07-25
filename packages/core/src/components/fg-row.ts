import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { RowContextValue, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow } from '../layout/types.js';
import { SignalWatcher } from '../reactive/index.js';
import type { RowNode } from '../store/types.js';
import './fg-cell.js';

/**
 * One display row.
 *
 * `display: contents` so the cells become items of the instance's CSS grid
 * directly — that is what keeps columns aligned across every row without any
 * measurement.
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

    const node = this.rowValue.node;
    this.applyDecorations(grid, node);

    return repeat(
      grid.columns.get(),
      (column) => column.colId,
      (column) => html`<fg-cell part="cell" role="gridcell" .column=${column}></fg-cell>`,
    );
  }

  private applyDecorations(grid: GridController, node: RowNode | undefined): void {
    const decorations = grid.registry.rowDecorations({ row: this.row, node });
    for (const decoration of decorations) {
      for (const className of decoration.classes ?? []) this.classList.add(className);
      for (const [name, value] of Object.entries(decoration.attributes ?? {})) {
        this.setAttribute(name, value);
      }
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'row');
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fg-row': FgRow;
  }
}
