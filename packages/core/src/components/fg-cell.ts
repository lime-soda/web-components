import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { html as staticHtml, literal, unsafeStatic } from 'lit/static-html.js';
import { formatCellValue, getCellValue } from '../columns/resolve-columns.js';
import type { ResolvedColumn } from '../columns/types.js';
import { RowContextValue, columnContext, gridContext, rowContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
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
@customElement('fg-cell')
export class FgCell extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      box-sizing: border-box;
      overflow: hidden;
      padding: 0 var(--fg-cell-padding-x, 8px);
      border-bottom: 1px solid var(--fg-border-subtle, #f0f0f0);
      color: var(--fg-text, #101010);
      font-variant-numeric: tabular-nums;
    }

    :host([data-numeric]) {
      justify-content: flex-end;
    }

    :host(:focus-visible) {
      outline: 2px solid var(--fg-focus, #3b82f6);
      outline-offset: -2px;
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

  @provide({ context: columnContext })
  accessor providedColumn: ResolvedColumn | undefined;

  override willUpdate(): void {
    this.providedColumn = this.column;
  }

  override render(): unknown {
    const node = this.row?.node;
    if (!node || !this.column) return nothing;

    // See fg-header-cell: keeps module-contributed decorations current.
    this.grid?.registry.version.get();

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
  private pendingEffects: ((cell: HTMLElement) => void)[] = [];

  override updated(): void {
    // Run after the DOM settles, so a module measuring or animating sees the
    // finished cell rather than the one being replaced.
    const effects = this.pendingEffects;
    this.pendingEffects = [];
    for (const effect of effects) effect(this);
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

    for (const decoration of decorations) {
      for (const className of decoration.classes ?? []) classes.add(className);
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

    this.pendingEffects = decorations
      .map((decoration) => decoration.onRendered)
      .filter((fn): fn is (cell: HTMLElement) => void => fn !== undefined);

    this.appliedClasses = classes;
    this.appliedAttributes = new Set(attributes.keys());
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
    'fg-cell': FgCell;
  }
}
