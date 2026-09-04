import * as tokens from '@lime-soda/tokens/grid';
import { css, html } from 'lit';
import { formatCellValue, getCellValue } from '../../columns/resolve-columns.js';
import type { ResolvedColumn } from '../../columns/types.js';
import type { DisplayRow } from '../../layout/types.js';
import type { ProjectionStage } from '../../projection/types.js';
import type { RowNode } from '../../store/types.js';
import '../../components/text-field.js';
import type { GridModule, HeaderSlotContext, ModuleContext } from '../types.js';
import {
  type ColumnFilter,
  type FilterModel,
  filterDependencies,
  matchesFilter,
} from './filter-model.js';

export interface FilterModuleOptions {
  /**
   * Show a filter box inside each filterable column header, beside its label.
   *
   * A trading grid's columns are often 80-100px, and an input crammed beside the
   * label crushes it to an initial — the header stops saying what the column is,
   * which costs more than the filter gains. Prefer `floatingFilter`, which gives
   * the boxes a strip of their own and leaves the headings alone.
   */
  headerUi?: boolean;
  /**
   * Show a strip of filter boxes beneath the column headings. Off by default.
   *
   * The answer to the problem `headerUi` has: a column of any width can hold a
   * filter box when the box is not competing with the heading for the same
   * line. Costs a row's height of vertical space, which is why it is opt-in on
   * a surface whose currency is rows on screen.
   *
   * The two are independent, and turning both on puts a box in each place. That
   * is a configuration mistake rather than something to forbid.
   */
  floatingFilter?: boolean;
  /** Height of the floating filter strip, in px. */
  floatingFilterHeight?: number;
}

/**
 * Row filtering: a quick filter across every column, plus per-column filters.
 *
 * Runs on the flat row list before any tree flattening, so it needs no notion of
 * hierarchy. When the tree module is installed it restores the ancestors of
 * surviving rows, which is what keeps a deep match reachable rather than orphaned.
 */
/** Tall enough for the boxed field and its focus ring, and no taller. */
const DEFAULT_FLOATING_HEIGHT = 30;

export class FilterModule<TData = unknown> implements GridModule<
  TData,
  { model: FilterModel; quickFilter: string }
> {
  readonly id = 'filter';

  /** Forwarded across every shadow boundary, so page CSS can reach these. */
  readonly parts = ['filter-input'];

  private context?: ModuleContext<TData>;
  private model: FilterModel = {};
  private quickFilter = '';

  constructor(private options: FilterModuleOptions = {}) {}

  /**
   * Replaces some or all of this module's options.
   *
   * Options given to the constructor are otherwise fixed for the life of the
   * grid: the grid's own options are reactive, but a module's are not reachable
   * through them, and reassigning `modules` does not re-register anything. This
   * is how a preference toggle reaches a module without rebuilding the grid.
   */
  setOptions(next: Partial<FilterModuleOptions>): void {
    this.options = { ...this.options, ...next };
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
    context.addStage(this.createStage());
  }

  private createStage(): ProjectionStage<TData> {
    const dependencies = (): ReadonlySet<string> | '*' | undefined => {
      // A quick filter reads every column, so any value change can change what
      // matches.
      if (this.quickFilter !== '') return '*';
      return filterDependencies(this.model, (colId) => {
        const column = this.columnFor(colId);
        if (!column) return undefined;
        return { field: column.field, derived: column.valueGetter !== undefined };
      });
    };

    return {
      id: 'filter',
      phase: 'filter',

      // An arrow, so the module is what `this` means inside it. A getter's own
      // `this` is the stage object, which is what an alias used to work around.
      get dependsOn(): ReadonlySet<string> | '*' | undefined {
        return dependencies();
      },

      run: (rows, ctx) => this.filter(rows, ctx.store.getRowNode.bind(ctx.store)),
    };
  }

  // -- Public API -------------------------------------------------------------

  getFilterModel(): FilterModel {
    return this.model;
  }

  setFilterModel(model: FilterModel): void {
    this.model = { ...model };
    this.changed();
  }

  setColumnFilter(colId: string, filter: ColumnFilter | null): void {
    const next = { ...this.model };
    if (filter === null) delete next[colId];
    else next[colId] = filter;
    this.model = next;
    this.changed();
  }

  getColumnFilter(colId: string): ColumnFilter | undefined {
    return this.model[colId];
  }

  getQuickFilter(): string {
    return this.quickFilter;
  }

  setQuickFilter(text: string): void {
    this.quickFilter = text;
    this.changed();
  }

  clearFilters(): void {
    this.model = {};
    this.quickFilter = '';
    this.changed();
  }

  isFilterActive(): boolean {
    return this.quickFilter !== '' || Object.keys(this.model).length > 0;
  }

  getState(): { model: FilterModel; quickFilter: string } {
    return { model: this.model, quickFilter: this.quickFilter };
  }

  setState(state: { model: FilterModel; quickFilter: string }): void {
    this.model = state?.model ?? {};
    this.quickFilter = state?.quickFilter ?? '';
    this.changed();
  }

  apiExtension(): Record<string, unknown> {
    return {
      getFilterModel: () => this.getFilterModel(),
      setFilterModel: (model: FilterModel) => this.setFilterModel(model),
      setColumnFilter: (colId: string, filter: ColumnFilter | null) =>
        this.setColumnFilter(colId, filter),
      setQuickFilter: (text: string) => this.setQuickFilter(text),
      clearFilters: () => this.clearFilters(),
      isFilterActive: () => this.isFilterActive(),
    };
  }

  // -- Header -----------------------------------------------------------------

  /*
   * Only the width. Everything else a box you type into looks like — its
   * padding, its border, the ring, the treatment when it holds something — is
   * the shared text field's, so the filter and the cell editor cannot drift
   * apart in some detail nobody notices.
   */
  static readonly styles = css`
    .ls-grid-filter-input {
      width: ${tokens.filterInputWidth};
    }
  `;

  readonly styles = FilterModule.styles;

  /**
   * How tall the strip is, or zero when it is off.
   *
   * Declared rather than measured because the layout engine needs it before
   * anything is drawn — it decides how many rows fit an instance from the
   * viewport height less the header.
   */
  provideHeaderBandHeight(): number {
    if ((this.options.floatingFilter ?? false) === false) return 0;
    return this.options.floatingFilterHeight ?? DEFAULT_FLOATING_HEIGHT;
  }

  /** The strip's box for one column. Same control as the header's, wider. */
  renderHeaderBand(ctx: HeaderSlotContext<TData>) {
    if ((this.options.floatingFilter ?? false) === false) return null;
    return this.filterField(ctx, 'floating');
  }

  headerSlot(ctx: HeaderSlotContext<TData>) {
    if ((this.options.headerUi ?? false) === false) return null;
    return this.filterField(ctx, 'header');
  }

  /**
   * One filter box, wherever it is going.
   *
   * The two placements differ only in width — in the strip a box has the column
   * to itself, in a heading it is sharing. Everything else about them has to
   * stay identical, so there is one of these rather than two that drift.
   */
  private filterField(ctx: HeaderSlotContext<TData>, placement: 'header' | 'floating') {
    if (ctx.column.filterable === false) return null;
    if (!ctx.column.field && !ctx.column.valueGetter) return null;

    const current = this.model[ctx.column.colId];
    const value = current && 'value' in current ? String(current.value ?? '') : '';

    // `type="search"`, so it is announced as a searchbox rather than a text
    // box. The difference is real to a reader and to anything looking for it.
    //
    // Clicks and keys stop here. A click on a header sorts it, and the grid's
    // navigation would take the arrow keys out of the box the reader is typing
    // in — neither is something the field itself can know.
    return html`<ls-grid-text-field
      class=${placement === 'floating' ? 'ls-grid-floating-filter' : 'ls-grid-filter-input'}
      exportparts="field: filter-input"
      appearance="boxed"
      type="search"
      placeholder="Filter"
      .label=${`Filter ${ctx.column.headerName}`}
      .value=${value}
      ?active=${current !== undefined}
      @click=${(event: Event) => event.stopPropagation()}
      @keydown=${(event: Event) => event.stopPropagation()}
      @ls-input=${(event: CustomEvent<string>) => {
        const text = event.detail;
        this.setColumnFilter(
          ctx.column.colId,
          text === ''
            ? null
            : ctx.column.filterType === 'number'
              ? { type: 'number', operator: 'equals', value: Number(text) }
              : { type: 'text', operator: 'contains', value: text },
        );
      }}
    ></ls-grid-text-field>`;
  }

  // -- Filtering --------------------------------------------------------------

  /**
   * Applies the active filter to any list of rows.
   *
   * Declared for modules that need the filtered set outside the projection —
   * export, which wants the rows a filter kept but not the grouping the
   * projection applies afterwards. The stage below uses the same code, so the
   * two cannot disagree about what the filter admits.
   */
  provideRowFilter(
    rows: readonly DisplayRow[],
    getNode: (id: string) => RowNode<TData> | undefined,
  ): readonly DisplayRow[] {
    return this.filter(rows, getNode);
  }

  private filter(
    rows: readonly DisplayRow[],
    getNode: (id: string) => RowNode<TData> | undefined,
  ): readonly DisplayRow[] {
    if (!this.isFilterActive()) return rows;

    const columns = this.context?.getColumns() ?? [];
    const entries = Object.entries(this.model)
      .map(([colId, filter]) => ({ filter, column: this.columnFor(colId) }))
      .filter(
        (pair): pair is { filter: ColumnFilter; column: ResolvedColumn<TData> } =>
          pair.column !== undefined,
      );

    const quick = this.quickFilter.toLowerCase();

    return rows.filter((row) => {
      const node = getNode(row.rowId);
      if (!node) return false;

      for (const { filter, column } of entries) {
        if (!matchesFilter(getCellValue(column, node), filter)) return false;
      }

      if (quick === '') return true;

      // Quick filter matches the *formatted* text, so what a trader types matches
      // what they can actually see in the cell.
      return columns.some((column) => formatCellValue(column, node).toLowerCase().includes(quick));
    });
  }

  private columnFor(colId: string): ResolvedColumn<TData> | undefined {
    return this.context?.getColumns().find((column) => column.colId === colId);
  }

  private changed(): void {
    this.context?.invalidate();
    this.context?.dispatch('ls-grid-filter-changed', {
      model: this.model,
      quickFilter: this.quickFilter,
    });
  }
}
