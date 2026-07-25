import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ResolvedColumn } from '../columns/types.js';
import { columnContext, gridContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import { SignalWatcher } from '../reactive/index.js';

/**
 * One column header.
 *
 * Core renders the label and nothing else. Sort indicators and filter controls
 * arrive as module header slots, so a grid with neither module installed has a
 * header with no affordances rather than dead ones.
 */
@customElement('fg-header-cell')
export class FgHeaderCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      padding: 0 var(--fg-cell-padding-x, 8px);
      height: 100%;
      background: var(--fg-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--fg-border, #d8d8d8);
      border-right: 1px solid var(--fg-border-subtle, #f0f0f0);
      color: var(--fg-header-text, #101010);
      font-weight: 500;
      font-size: var(--fg-header-font-size, 13px);
      overflow: hidden;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    :host(:last-of-type) {
      border-right: none;
    }

    :host(:focus-visible) {
      outline: 2px solid var(--fg-focus, #3b82f6);
      outline-offset: -2px;
    }

    .label {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }

    .slots {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
    }
  `;

  @property({ attribute: false })
  accessor column!: ResolvedColumn;

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController | undefined;

  @provide({ context: columnContext })
  accessor providedColumn: ResolvedColumn | undefined;

  override willUpdate(): void {
    this.providedColumn = this.column;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'columnheader');
  }

  override render(): unknown {
    if (!this.column) return nothing;

    const slots = this.grid?.registry.headerSlots({ column: this.column }) ?? [];

    return html`
      <span class="label" part="header-label" title=${this.column.headerName}>
        ${this.column.headerName}
      </span>
      ${slots.length === 0 ? nothing : html`<span class="slots" part="header-slots">${slots}</span>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'fg-header-cell': FgHeaderCell;
  }
}
