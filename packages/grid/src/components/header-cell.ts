import * as tokens from '@lime-soda/tokens/grid';
import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { adoptModuleStyles } from '../theme/adopt-module-styles.js';
import { property } from 'lit/decorators.js';
import type { ResolvedColumn } from '../columns/types.js';
import type { LayoutInstance } from '../layout/types.js';
import { columnContext, gridContext, instanceContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import { SignalWatcher } from '../reactive/index.js';

/**
 * One column header.
 *
 * Core renders the label and nothing else. Sort indicators and filter controls
 * arrive as module header slots, so a grid with neither module installed has a
 * header with no affordances rather than dead ones.
 *
 * @csspart header-label - A column heading's text
 * @csspart header-slots - Where modules add header controls
 *
 * @customElement ls-grid-header-cell
 */
export class GridHeaderCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: 8px;
      box-sizing: border-box;
      padding: 0 ${tokens.cellPaddingX};
      height: 100%;
      background: ${tokens.headerBackground};
      border-bottom: 2px solid ${tokens.border};
      border-right: 1px solid ${tokens.borderSubtle};
      color: ${tokens.headerText};
      font-weight: ${tokens.headerFontWeight};
      font-size: ${tokens.headerFontSize};
      overflow: hidden;
    }

    :host(:last-of-type) {
      border-right: none;
    }

    /*
     * The grid's own focus, for the same reason as the body cell: a header
     * reached with the mouse never matches :focus-visible and would show
     * nothing at all.
     */
    :host([data-focused]) {
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: calc(-1 * ${tokens.focusWidth});
    }

    /* No label to sit beside, so whatever a module contributed is centred. */
    :host([data-ls-grid-unnamed]) {
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
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: calc(-1 * ${tokens.focusWidth});
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

  @consume({ context: instanceContext, subscribe: true })
  accessor instance: LayoutInstance | undefined;

  @provide({ context: columnContext })
  accessor providedColumn: ResolvedColumn | undefined;

  override willUpdate(): void {
    this.providedColumn = this.column;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute('role', 'columnheader');
  }

  override firstUpdated(): void {
    // Sort indicators and filter inputs render here; their styles come with them.
    adoptModuleStyles(this.shadowRoot, this.grid?.registry.moduleStyles() ?? []);
    this.addEventListener('focus', this.handleFocus);
  }

  private readonly handleFocus = (): void => {
    const instanceId = this.instance?.id;
    if (instanceId === undefined || !this.grid) return;
    if (this.grid.focus.isHeaderFocused(instanceId, this.column.colId)) return;
    this.grid.focus.focusHeader(instanceId, this.column.colId);
  };

  override updated(): void {
    // Follows the grid's focus into the DOM, so the browser scrolls the header
    // into view and a screen reader announces it.
    if (this.isFocusedHeader() && this.gridHasFocus() && this.getRootNode() instanceof ShadowRoot) {
      if (!this.matches(':focus')) this.focus({ preventScroll: false });
    }
  }

  private gridHasFocus(): boolean {
    return this.grid?.focus.withinGrid.get() ?? false;
  }

  private isFocusedHeader(): boolean {
    const instanceId = this.instance?.id;
    if (instanceId === undefined || !this.grid || !this.column) return false;
    return this.grid.focus.isHeaderFocused(instanceId, this.column.colId);
  }

  override render(): unknown {
    if (!this.column) return nothing;

    const registry = this.grid?.registry;
    // Subscribes this header to every module's state, so a sort indicator
    // appears the moment the model changes rather than on the next unrelated
    // repaint.
    registry?.version.get();

    this.setAttribute('aria-colindex', String(this.column.index + 1));

    const focused = this.isFocusedHeader();
    this.toggleAttribute('data-focused', focused && this.gridHasFocus());
    // A header is only reachable by arrowing up into it, so it is never the
    // grid's tab stop; -1 keeps it focusable without adding a stop.
    this.tabIndex = focused ? 0 : -1;
    const slots = registry?.headerSlots({ column: this.column }) ?? [];
    const decorations = registry?.headerDecorations({ column: this.column }) ?? [];

    for (const decoration of decorations) {
      for (const className of decoration.classes ?? []) this.classList.add(className);
      for (const [name, value] of Object.entries(decoration.attributes ?? {})) {
        // As on a cell: `style` would reintroduce inline declarations through
        // the back door, and per-header values belong in customProperties.
        if (name === 'style') {
          throw new Error(
            'A module set a `style` attribute on a header cell. Use ' +
              '`customProperties` for per-header values and a module stylesheet ' +
              'for everything else.',
          );
        }
        this.setAttribute(name, value);
      }
      for (const [name, value] of Object.entries(decoration.customProperties ?? {})) {
        if (!name.startsWith('--')) {
          throw new Error(`A module set a non-custom property "${name}" on a header cell.`);
        }
        this.style.setProperty(name, value);
      }
    }

    const activators = decorations
      .map((decoration) => decoration.onActivate)
      .filter((fn): fn is (event: Event) => void => fn !== undefined);

    // A column with no name — a checkbox column, say — gets no label box at all,
    // so its slot content centres in the header instead of being pushed aside by
    // an empty flex:1 span.
    const unnamed = this.column.headerName === '';
    this.toggleAttribute('data-ls-grid-unnamed', unnamed);

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
      ${
        slots.length === 0 ? nothing : html`<span class="slots" part="header-slots">${slots}</span>`
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-header-cell': GridHeaderCell;
  }
}
