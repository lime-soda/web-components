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
@customElement('tf-header-cell')
export class TfHeaderCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      padding: 0 var(--tf-cell-padding-x, 8px);
      height: 100%;
      background: var(--tf-header-bg, #f5f5f5);
      border-bottom: 2px solid var(--tf-border, #d8d8d8);
      border-right: 1px solid var(--tf-border-subtle, #f0f0f0);
      color: var(--tf-header-text, #101010);
      font-weight: 500;
      font-size: var(--tf-header-font-size, 13px);
      overflow: hidden;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    :host(:last-of-type) {
      border-right: none;
    }

    :host(:focus-visible) {
      outline: 2px solid var(--tf-focus, #3b82f6);
      outline-offset: -2px;
    }

    /* No label to sit beside, so whatever a module contributed is centred. */
    :host([data-tf-unnamed]) {
      justify-content: center;
      padding: 0;
    }

    .label {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
      align-self: stretch;
      display: flex;
      align-items: center;
    }

    /* Only when a module made the header do something. */
    .label.activatable {
      cursor: pointer;
      user-select: none;
    }

    .label.activatable:focus-visible {
      outline: 2px solid var(--tf-focus, #3b82f6);
      outline-offset: -2px;
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

    const registry = this.grid?.registry;
    // Subscribes this header to every module's state, so a sort indicator
    // appears the moment the model changes rather than on the next unrelated
    // repaint.
    registry?.version.get();
    const slots = registry?.headerSlots({ column: this.column }) ?? [];
    const decorations = registry?.headerDecorations({ column: this.column }) ?? [];

    for (const decoration of decorations) {
      for (const className of decoration.classes ?? []) this.classList.add(className);
      for (const [name, value] of Object.entries(decoration.attributes ?? {})) {
        this.setAttribute(name, value);
      }
    }

    const activators = decorations
      .map((decoration) => decoration.onActivate)
      .filter((fn): fn is (event: Event) => void => fn !== undefined);

    // A column with no name — a checkbox column, say — gets no label box at all,
    // so its slot content centres in the header instead of being pushed aside by
    // an empty flex:1 span.
    const unnamed = this.column.headerName === '';
    this.toggleAttribute('data-tf-unnamed', unnamed);

    return html`
      ${
        unnamed
          ? nothing
          : html`<span
              class=${activators.length > 0 ? 'label activatable' : 'label'}
              part="header-label"
              title=${this.column.headerName}
              role=${activators.length > 0 ? 'button' : nothing}
              tabindex=${activators.length > 0 ? 0 : nothing}
              @click=${(event: Event) => activators.forEach((fn) => fn(event))}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                activators.forEach((fn) => fn(event));
              }}
            >
              ${this.column.headerName}
            </span>`
      }
      ${slots.length === 0 ? nothing : html`<span class="slots" part="header-slots">${slots}</span>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tf-header-cell': TfHeaderCell;
  }
}
