import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { gridContext, instanceContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { LayoutInstance } from '../layout/types.js';
import { SignalWatcher } from '../reactive/index.js';
import './fg-header-cell.js';
import './fg-row.js';

/**
 * One column of the flow layout: a header and the rows that fit beneath it.
 *
 * Every instance carries its own header, which is what makes the horizontal layout
 * readable — a trader looking at the fourth instance across still sees what each
 * column means.
 */
@customElement('fg-instance')
export class FgInstance extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      background: var(--fg-bg, #ffffff);
      border: 1px solid var(--fg-border, #d8d8d8);
      border-radius: var(--fg-radius, 4px);
      overflow: hidden;
    }

    .grid {
      display: grid;
      grid-auto-rows: var(--fg-row-height, 32px);
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
    const template = columns.map((column) => `${column.width}px`).join(' ');
    const headerHeight = grid.pipeline.viewport.headerHeight;

    return html`
      <div
        class="grid"
        part="instance-grid"
        style="grid-template-columns: ${template}; grid-template-rows: ${headerHeight}px;"
      >
        <div class="header" role="row">
          ${repeat(
            columns,
            (column) => column.colId,
            (column) =>
              html`<fg-header-cell part="header-cell" .column=${column}></fg-header-cell>`,
          )}
        </div>
        ${repeat(
          this.instance.rows,
          (row) => row.id,
          (row) => html`<fg-row .row=${row}></fg-row>`,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fg-instance': FgInstance;
  }
}
