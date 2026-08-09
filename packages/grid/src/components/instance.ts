import { HEADER_CELL_PARTS, ROW_PARTS, forwardedParts } from './part-forwarding.js';
import * as tokens from '@lime-soda/tokens/grid';
import { consume, provide } from '@lit/context';
import { LitElement, css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { gridContext, instanceContext } from '../context/index.js';
import type { GridController } from '../controller/grid-controller.js';
import type { DisplayRow, LayoutInstance } from '../layout/types.js';
import { SignalWatcher } from '../reactive/index.js';

/** Which bands of the instance to render. */
export type InstanceParts = 'full' | 'header' | 'rows';

/**
 * One column of the flow layout: a header and the rows that fit beneath it.
 *
 * Every instance carries its own header, which is what makes the horizontal layout
 * readable — a trader looking at the fourth instance across still sees what each
 * column means.
 *
 * The stack layout splits the two: only the rows are windowed and moved by a
 * spacer, so the header renders separately and stays put. Both bands share the
 * same column template, so they stay aligned without measuring anything.
 *
 * @customElement ls-grid-instance
 */
export class GridInstance extends SignalWatcher(LitElement) {
  static override styles = css`
    :host {
      display: block;
      box-sizing: border-box;
      background: ${tokens.background};
      border: ${tokens.instanceBorderWidth} solid ${tokens.border};
      border-radius: ${tokens.radius};
      overflow: hidden;
    }

    /*
     * A split band sizes to its columns rather than to the container, and does not
     * clip. As a full-width block with overflow:hidden it clipped every column
     * past the container edge and contributed nothing to the scroller's width, so
     * the stack layout could not scroll horizontally at all.
     */
    :host([parts='header']),
    :host([parts='rows']) {
      width: max-content;
      overflow: visible;
    }

    /* Something flexible to absorb it, so the box fills the container. */
    :host([parts='header'][data-flexes]),
    :host([parts='rows'][data-flexes]) {
      width: auto;
      min-width: 100%;
    }

    /*
     * Split bands meet, so the join between them carries no border or radius —
     * otherwise a stacked header and body read as two separate tables.
     */
    :host([parts='header']) {
      border-bottom: none;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    :host([parts='rows']) {
      border-top: none;
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }

    .grid {
      display: grid;
      grid-template-columns: var(--grid-column-template);
      grid-template-rows: ${tokens.headerHeight};
      grid-auto-rows: ${tokens.rowHeight};
      width: 100%;
    }

    /* No header band, so the first row must not land in a header-height track. */
    :host([parts='rows']) .grid {
      grid-template-rows: none;
    }

    .header {
      /* Same as a row: a real element, aligned to the instance's tracks. */
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
    }
  `;

  @property({ attribute: false })
  accessor instance!: LayoutInstance;

  private cachedIndexRows: readonly DisplayRow[] | undefined;
  private cachedIndices: ReadonlyMap<DisplayRow, number> | undefined;

  /**
   * Which bands to render. `full` is the flow layout; the stack layout renders a
   * `header` instance and a `rows` instance so only the latter scrolls.
   */
  @property({ reflect: true })
  accessor parts: InstanceParts = 'full';

  @consume({ context: gridContext, subscribe: true })
  accessor grid: GridController | undefined;

  @provide({ context: instanceContext })
  accessor providedInstance: LayoutInstance | undefined;

  override willUpdate(): void {
    this.providedInstance = this.instance;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Replaced on first render with whatever the modules declare — 'treegrid'
    // when rows sit inside other rows.
    this.setAttribute('role', 'grid');
  }

  /**
   * What this instance holds, for a reader who lands in the middle of the data.
   *
   * Counted over its own rows: a repeated ancestor is the same row appearing
   * again at the top of a continuation, not another row of data.
   */
  private describeContents(): string {
    const own = this.instance?.rows.filter((row) => row.meta?.['isRepeat'] !== true) ?? [];
    if (own.length === 0) return 'No rows';

    const first = (this.instance?.firstRowIndex ?? 0) + 1;
    return `Rows ${first} to ${first + own.length - 1}`;
  }

  /**
   * A row's place in the whole data set, counting the header as 1.
   *
   * A repeated ancestor gets 0, which the row reads as "do not say": it is a
   * second appearance of a row that already has a place, and claiming another
   * would make the count disagree with itself.
   */
  private rowIndices(): ReadonlyMap<DisplayRow, number> {
    const rows = this.instance?.rows ?? [];
    if (this.cachedIndexRows === rows && this.cachedIndices) return this.cachedIndices;

    const indices = new Map<DisplayRow, number>();
    let position = 0;
    for (const row of rows) {
      // A repeat has no place of its own: it is a row already counted, drawn
      // again atop a continuation.
      if (row.meta?.['isRepeat'] === true) continue;
      // 1 is the header row, so data starts at 2.
      indices.set(row, (this.instance?.firstRowIndex ?? 0) + position + 2);
      position += 1;
    }

    this.cachedIndexRows = rows;
    this.cachedIndices = indices;
    return indices;
  }

  override render(): unknown {
    const grid = this.grid;
    if (!grid || !this.instance) return nothing;

    const columns = grid.columns.get();
    // A flow instance is a fixed-width block whose width is the sum of its
    // columns, so there is no leftover space for a fraction to divide; only the
    // stack layout can honour flex.
    const canFlex = (grid.options.layout ?? 'flow') === 'stack';
    const flexes = canFlex && columns.some((column) => column.sizing === 'flex');

    // Column widths are data, not style: they come from the column definitions
    // and change with them, so they travel as a property the stylesheet uses.
    const template = columns
      .map((column) => {
        if (!canFlex || column.sizing === 'fixed') return `${column.width}px`;
        const track = `${column.flex}fr`;
        // A flexible column still respects its floor.
        return column.minWidth === undefined ? track : `minmax(${column.minWidth}px, ${track})`;
      })
      .join(' ');

    // Only a grid with something flexible should stretch to its container. With
    // every column fixed, the box matches the columns exactly rather than leaving
    // dead space beside the last one.
    this.toggleAttribute('data-flexes', flexes);

    const showHeader = this.parts !== 'rows';
    const showRows = this.parts !== 'header';

    // A group of rows within the grid, not a grid of its own: the rows are one
    // list, and an instance is where some of them happen to be drawn. The label
    // says which, so a reader arriving here knows where in the data they are
    // rather than only that there are more rows somewhere.
    this.setAttribute('role', 'rowgroup');
    this.setAttribute('aria-label', this.describeContents());

    // Built once per render rather than per row: it was a filter and a linear
    // search for every row, which is quadratic in the rows an instance holds.
    const indices = this.rowIndices();
    // Modules render into cells and header cells, so their parts start as deep
    // as anything core owns and have to be forwarded the same distance.
    const moduleParts = grid.registry.moduleParts();

    return html`
      <div
        class="grid"
        part="instance-grid"
        style=${styleMap({ '--grid-column-template': template })}
      >
        ${
          showHeader
            ? html`<div
                class="header"
                role="row"
                aria-rowindex="1"
                aria-hidden=${this.instance.index > 0 ? 'true' : nothing}
              >
                ${repeat(
                  columns,
                  (column) => column.colId,
                  (column) =>
                    html`<ls-grid-header-cell
                      part="header-cell"
                      exportparts=${forwardedParts(HEADER_CELL_PARTS, moduleParts)}
                      .column=${column}
                    ></ls-grid-header-cell>`,
                )}
              </div>`
            : nothing
        }
        ${
          showRows
            ? repeat(
                this.instance.rows,
                (row) => row.id,
                (row) =>
                  html`<ls-grid-row
                    part="row"
                    exportparts=${forwardedParts(ROW_PARTS, moduleParts)}
                    .row=${row}
                    .rowIndex=${indices.get(row) ?? 0}
                  ></ls-grid-row>`,
              )
            : nothing
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ls-grid-instance': GridInstance;
  }
}
