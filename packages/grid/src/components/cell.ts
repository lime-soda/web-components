import { consume, provide } from '@lit/context';
import { instanceContext } from '../context/index.js';
import { LitElement, css, html, nothing } from 'lit';
import { adoptModuleStyles } from '../theme/adopt-module-styles.js';
import { property } from 'lit/decorators.js';
import { html as staticHtml, literal, unsafeStatic } from 'lit/static-html.js';
import { formatCellValue, getCellValue } from '../columns/resolve-columns.js';
import type { ResolvedColumn } from '../columns/types.js';
import { RowContextValue, columnContext, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { LayoutInstance } from '../layout/types.js';
import type { CellDecoration } from '../modules/types.js';
import { SignalWatcher } from '../reactive/index.js';

/**
 * One column of one row.
 *
 * Renders `valueGetter` → `valueFormatter` → `cellRenderer`, and lets modules
 * bracket that content without owning it. Extending SignalWatcher is what keeps a
 * price tick cheap: the cell reads its row's signal during render, so a change
 * repaints this cell and touches nothing above it.
 */
export class GridCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0 var(--ls-grid-cell-padding-x, 8px);
      border-bottom: 1px solid var(--ls-grid-border-subtle, #f0f0f0);
      color: var(--ls-grid-text, #101010);
      font-variant-numeric: tabular-nums;
    }

    :host([data-numeric]) {
      justify-content: flex-end;
    }

    /*
     * A custom element renderer owns the whole cell, so the cell stops reserving
     * its own gutter. Without this a depth bar cannot reach the cell edges and a
     * checkbox cannot sit centred in a narrow column — 16px of padding leaves
     * nothing to centre a 13px control in.
     */
    :host([data-ls-grid-renderer]) {
      padding: 0;
    }

    /*
     * The grid's own focus, not the browser's :focus-visible.
     *
     * :focus-visible deliberately does not match a mouse click, so a cell
     * clicked into was focused — arrow keys moved from it, screen readers
     * followed it — while showing nothing at all. The grid tracks focus itself
     * and says so here, so clicking and tabbing look the same.
     */
    :host([data-focused]) {
      outline: var(--ls-grid-focus-width, 2px) solid var(--ls-grid-focus, #3b82f6);
      outline-offset: calc(-1 * var(--ls-grid-focus-width, 2px));
    }

    /* Applied by the selection module. A row is display:contents and has no box
       of its own, so the highlight is painted by its cells. */
    :host(.ls-grid-cell-selected) {
      background: var(--ls-grid-selection-background, rgb(59 130 246 / 12%));
    }

    /* Tracking a row across a monitor-wide grid is the whole reason this exists. */
    :host(.ls-grid-row-hover) {
      background: var(--ls-grid-hover-background, rgb(0 0 0 / 3%));
    }

    :host(.ls-grid-row-hover.ls-grid-cell-selected) {
      background: var(--ls-grid-selection-background, rgb(59 130 246 / 12%));
    }

    /* Plain values: single line, ellipsised, vertically centred by the host. */
    .content {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 1;
    }

    /*
     * A custom renderer owns its box instead, stretched to the full row height.
     * Otherwise a renderer drawing a bar or a background resolves its own
     * height: 100% against a text-height parent and collapses to nothing.
     */
    .renderer {
      flex: 1;
      min-width: 0;
      align-self: stretch;
      position: relative;
      overflow: hidden;
    }

    .affix {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
    }
  `;

  @property({ attribute: false })
  accessor column!: ResolvedColumn;

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController | undefined;

  @consume({ context: rowContext, subscribe: true })
  accessor row: RowContextValue | undefined;

  @consume({ context: instanceContext, subscribe: true })
  accessor instance: LayoutInstance | undefined;

  @provide({ context: columnContext })
  accessor providedColumn: ResolvedColumn | undefined;

  override willUpdate(): void {
    this.providedColumn = this.column;
  }

  override render(): unknown {
    const node = this.row?.node;
    if (!node || !this.column) return nothing;

    // See ls-grid-header-cell: keeps module-contributed decorations current.
    this.grid?.registry.version.get();

    this.tabIndex = this.isTabbableCell() ? 0 : -1;
    // Only while the grid has focus: a remembered position is where Tab would
    // return to, not somewhere that is focused now.
    this.toggleAttribute('data-focused', this.isFocusedCell() && this.gridHasFocus());

    const value = getCellValue(this.column, node);
    const decorations =
      this.grid?.registry.cellDecorations({
        row: this.row!.displayRow,
        node,
        column: this.column,
        value,
      }) ?? [];

    this.applyDecorations(decorations);

    const hasRenderer = this.column.cellRenderer !== undefined;
    // Element renderers own their box; function renderers and plain values are
    // content and keep the cell's gutter.
    this.toggleAttribute('data-ls-grid-renderer', typeof this.column.cellRenderer === 'string');

    return html`
      ${decorations.map((d) => (d.prefix ? html`<span class="affix">${d.prefix}</span>` : nothing))}
      <span class=${hasRenderer ? 'renderer' : 'content'} part="cell-content">
        ${this.renderContent(value, node)}
      </span>
      ${decorations.map((d) => (d.suffix ? html`<span class="affix">${d.suffix}</span>` : nothing))}
    `;
  }

  private renderContent(value: unknown, node: NonNullable<RowContextValue['node']>): unknown {
    const renderer = this.column.cellRenderer;

    if (typeof renderer === 'string') {
      // A custom element renderer receives nothing but its params: it reads the
      // row and column off the contexts this cell already provides.
      return staticHtml`<${tagFor(renderer)} .params=${this.column.cellRendererParams ?? {}}></${tagFor(renderer)}>`;
    }

    if (typeof renderer === 'function') {
      return renderer({ value, data: node.data, node, column: this.column });
    }

    return formatCellValue(this.column, node);
  }

  private appliedClasses = new Set<string>();
  private appliedAttributes = new Set<string>();
  private appliedProperties = new Set<string>();
  private pendingEffects: ((cell: HTMLElement) => void)[] = [];

  override firstUpdated(): void {
    // Module markup renders in this shadow root, where page CSS cannot reach it.
    adoptModuleStyles(this.shadowRoot, this.grid?.registry.moduleStyles() ?? []);
    // Tabbing or clicking into a cell moves the grid's focus to it, so the two
    // never disagree about where focus is.
    this.addEventListener('focus', this.handleFocus);
  }

  private readonly handleFocus = (): void => {
    const instanceId = this.instance?.id;
    const rowKey = this.row?.displayRow.id;
    if (instanceId === undefined || rowKey === undefined || !this.grid) return;
    if (this.grid.focus.isFocused(instanceId, rowKey, this.column.colId)) return;
    this.grid.focus.focus({ instanceId, rowKey, colId: this.column.colId, section: 'body' });
  };

  override updated(): void {
    // Run after the DOM settles, so a module measuring or animating sees the
    // finished cell rather than the one being replaced.
    const effects = this.pendingEffects;
    this.pendingEffects = [];
    for (const effect of effects) effect(this);

    // Roving tabindex: exactly one cell is tabbable, and it pulls DOM focus to
    // itself so the browser scrolls it into view and screen readers follow.
    if (this.isFocusedCell() && this.gridHasFocus() && this.getRootNode() instanceof ShadowRoot) {
      if (!this.matches(':focus')) this.focus({ preventScroll: false });
    }
  }

  /** The grid's single tab stop, so a user can reach it with the keyboard. */
  private isTabbableCell(): boolean {
    const instanceId = this.instance?.id;
    const rowKey = this.row?.displayRow.id;
    if (instanceId === undefined || rowKey === undefined || !this.grid) return false;
    return this.grid.focus.isTabbable(instanceId, rowKey, this.column.colId);
  }

  /** Whether focus is inside the grid, rather than merely remembered by it. */
  private gridHasFocus(): boolean {
    return this.grid?.focus.withinGrid.get() ?? false;
  }

  private isFocusedCell(): boolean {
    const instanceId = this.instance?.id;
    const rowKey = this.row?.displayRow.id;
    if (instanceId === undefined || rowKey === undefined || !this.grid) return false;
    return this.grid.focus.isFocused(instanceId, rowKey, this.column.colId);
  }

  /**
   * Applies module decorations and withdraws any from the previous render.
   *
   * Reversal is the whole point: a decoration that stops applying has to come
   * off. Only adding would leave a deselected row highlighted and a cleared
   * filter's markers stuck on, with the classes accumulating for as long as the
   * cell lives.
   */
  private applyDecorations(decorations: readonly CellDecoration[]): void {
    const classes = new Set<string>();
    const attributes = new Map<string, string>();
    const properties = new Map<string, string>();

    for (const decoration of decorations) {
      for (const className of decoration.classes ?? []) classes.add(className);
      for (const [name, value] of Object.entries(decoration.attributes ?? {})) {
        // `style` would reintroduce inline declarations through the back door;
        // per-cell values belong in customProperties.
        if (name === 'style') {
          throw new Error(
            'A module set a `style` attribute on a cell. Use `customProperties` for ' +
              'per-cell values and a module stylesheet for everything else.',
          );
        }
        attributes.set(name, value);
      }
      for (const [name, value] of Object.entries(decoration.customProperties ?? {})) {
        if (!name.startsWith('--')) {
          throw new Error(`Custom property "${name}" must start with "--".`);
        }
        properties.set(name, value);
      }
    }

    for (const className of this.appliedClasses) {
      if (!classes.has(className)) this.classList.remove(className);
    }
    for (const name of this.appliedAttributes) {
      if (!attributes.has(name)) this.removeAttribute(name);
    }
    for (const name of this.appliedProperties) {
      if (!properties.has(name)) this.style.removeProperty(name);
    }

    for (const className of classes) this.classList.add(className);
    for (const [name, value] of attributes) this.setAttribute(name, value);
    for (const [name, value] of properties) this.style.setProperty(name, value);

    this.pendingEffects = decorations
      .map((decoration) => decoration.onRendered)
      .filter((fn): fn is (cell: HTMLElement) => void => fn !== undefined);

    this.appliedClasses = classes;
    this.appliedAttributes = new Set(attributes.keys());
    this.appliedProperties = new Set(properties.keys());
  }
}

/**
 * Static templates are cached by their strings, so a tag name must become part of
 * the template's identity rather than a value. Memoised because every cache miss
 * creates a new template.
 */
const tagCache = new Map<string, ReturnType<typeof literal>>();

function tagFor(tag: string) {
  let cached = tagCache.get(tag);
  if (!cached) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag)) {
      throw new Error(`"${tag}" is not a valid custom element name for cellRenderer.`);
    }
    cached = unsafeStatic(tag) as unknown as ReturnType<typeof literal>;
    tagCache.set(tag, cached);
  }
  return cached;
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-cell': GridCell;
  }
}
