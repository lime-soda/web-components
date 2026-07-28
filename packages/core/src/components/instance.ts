import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { gridContext, instanceContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { LayoutInstance } from '../layout/types.js';
import { SignalWatcher } from '../reactive/index.js';
import './header-cell.js';
import './row.js';

/**
 * One column of the flow layout: a header and the rows that fit beneath it.
 *
 * Every instance carries its own header, which is what makes the horizontal layout
 * readable — a trader looking at the fourth instance across still sees what each
 * column means.
 */
@customElement('flow-instance')
export class FlowInstance extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      background: var(--flow-background, #ffffff);
      border: 1px solid var(--flow-border, #d8d8d8);
      border-radius: var(--flow-radius, 4px);
      overflow: hidden;
    }

    .grid {
      display: grid;
      grid-template-columns: var(--flow-column-template);
      grid-template-rows: var(--flow-header-height, 32px);
      grid-auto-rows: var(--flow-row-height, 32px);
      width: 100%;
    }

    .header {
      display: contents;
    }
  `;

  @property({ attribute: false })
  accessor instance!: LayoutInstance;

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController | undefined;

  @provide({ context: instanceContext })
  accessor providedInstance: LayoutInstance | undefined;

  override willUpdate(): void {
    this.providedInstance = this.instance;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'grid');
  }

  override render(): unknown {
    const grid = this.grid;
    if (!grid || !this.instance) return nothing;

    const columns = grid.columns.get();
    // Column widths are data, not style: they come from the column definitions
    // and change with them, so they travel as a property the stylesheet uses.
    const template = columns.map((column) => `${column.width}px`).join(' ');

    return html`
      <div
        class="grid"
        part="instance-grid"
        style=${styleMap({ '--flow-column-template': template })}
      >
        <div class="header" role="row">
          ${repeat(
            columns,
            (column) => column.colId,
            (column) =>
              html`<flow-header-cell part="header-cell" .column=${column}></flow-header-cell>`,
          )}
        </div>
        ${repeat(
          this.instance.rows,
          (row) => row.id,
          (row) => html`<flow-row .row=${row}></flow-row>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'flow-instance': FlowInstance;
  }
}
