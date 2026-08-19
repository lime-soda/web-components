import { NONE, forwardedParts } from './part-forwarding.js';
import * as tokens from '@lime-soda/tokens/grid';
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
 *
 * @csspart cell-content - A cell's content, inside its padding
 *
 * @customElement ls-grid-cell
 */
export class GridCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0 ${tokens.cellPaddingX};
      border-right: 1px solid ${tokens.borderSubtle};
      border-bottom: 1px solid ${tokens.borderSubtle};
      color: ${tokens.text};
      font-variant-numeric: ${tokens.numericVariant};
    }

    /*
     * The column rule runs the height of the grid, not just the heading.
     *
     * Headings carried one and the cells beneath them did not, so the columns
     * were ruled apart for forty pixels and then dissolved — which reads as a
     * header belonging to a different table from its body. This is the same
     * rule the heading draws, in the same token.
     *
     * The last column stops, as the last heading does: past it is the
     * instance's own edge, and a rule there would be a second line against it.
     */
    :host(:last-of-type) {
      border-right: none;
    }

    /*
     * Which edge the value sits against, from the column's value type.
     *
     * There was a data-numeric rule here that nothing ever set: the styling
     * for a right-aligned number existed and no column could reach it, so every
     * column of prices read down its left edge.
     */
    :host([data-align='end']) {
      justify-content: flex-end;
      text-align: right;
    }

    :host([data-align='center']) {
      justify-content: center;
      text-align: center;
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
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: calc(-1 * ${tokens.focusWidth});
    }

    /* Applied by the selection module. A row is display:contents and has no box
       of its own, so the highlight is painted by its cells. */
    :host(.ls-grid-cell-selected) {
      background: ${tokens.selectionBackground};
    }

    /* Tracking a row across a monitor-wide grid is the whole reason this exists. */
    :host(.ls-grid-row-hover) {
      background: ${tokens.hoverBackground};
    }

    :host(.ls-grid-row-hover.ls-grid-cell-selected) {
      background: ${tokens.selectionBackground};
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

    // `start` is the default and needs no attribute, so the common column
    // carries nothing extra.
    if (this.column.align === 'start') this.removeAttribute('data-align');
    else this.setAttribute('data-align', this.column.align);

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
    // A module may have taken the cell over — an open editor is the case this
    // exists for. Asked before the column's own renderer, because the point is
    // to replace what the column would otherwise show.
    const claimed = this.grid?.registry.cellContent({
      row: this.row!.displayRow,
      node,
      column: this.column,
      value,
    });
    if (claimed) return claimed;

    const renderer = this.column.cellRenderer;

    if (typeof renderer === 'string') {
      // A custom element renderer receives nothing but its params: it reads the
      // row and column off the contexts this cell already provides.
      //
      // A renderer is a shadow root of its own, so anything it marks with
      // `part` is a boundary further from the page than the cell is. Module
      // parts are forwarded because they are declared and therefore known; a
      // consumer's own renderer has to export its parts itself.
      return staticHtml`<${tagFor(renderer)}
        exportparts=${forwardedParts(NONE, this.grid?.registry.moduleParts() ?? NONE)}
        .params=${this.column.cellRendererParams ?? {}}
      ></${tagFor(renderer)}>`;
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

  override connectedCallback(): void {
    super.connectedCallback();
    // A grid whose rows contain unroled elements is not a grid: the cells have
    // to say what they are or assistive tech reads a row of nothing. Set here
    // rather than in render so it is true before the first paint, matching the
    // row and the header cell.
    this.setAttribute('role', 'gridcell');
  }

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
    // The pinned band mirrors rows that are in the body already, so it shows
    // focus but never takes a turn in the tab order — two tab stops for one row
    // would be one too many.
    if (this.instance?.pinned) return false;
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
