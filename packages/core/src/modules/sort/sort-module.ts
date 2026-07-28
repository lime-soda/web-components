import { css, html } from 'lit';
import { getCellValue } from '../../columns/resolve-columns.js';
import type { ResolvedColumn } from '../../columns/types.js';
import type { DisplayRow } from '../../layout/types.js';
import type { ProjectionStage } from '../../projection/types.js';
import type { RowNode } from '../../store/types.js';
import type { GridModule, HeaderDecoration, HeaderSlotContext, ModuleContext } from '../types.js';

export type SortDirection = 'asc' | 'desc';

export interface SortModelEntry {
  readonly colId: string;
  readonly direction: SortDirection;
}

export interface SortModuleOptions {
  /** Allow several columns at once, added with shift-click. On by default. */
  multiSort?: boolean;
  /** Directions cycled through on repeated activation. */
  cycle?: readonly (SortDirection | null)[];
}

export interface ComparatorParams<TData = unknown> {
  readonly nodeA: RowNode<TData>;
  readonly nodeB: RowNode<TData>;
  readonly column: ResolvedColumn<TData>;
}

const DEFAULT_CYCLE: readonly (SortDirection | null)[] = ['asc', 'desc', null];

/**
 * Column sorting.
 *
 * Sorts the flat row list, which is what keeps it hierarchy-blind: it runs before
 * the tree module's expand stage, and the sibling order it produces survives the
 * flatten. Neither module knows the other exists.
 *
 * Sorting is by resolved value, so a column with a `valueGetter` sorts on what it
 * displays rather than on some raw field behind it.
 */
export class SortModule<TData = unknown> implements GridModule<TData, SortModelEntry[]> {
  readonly id = 'sort';

  private context?: ModuleContext<TData>;
  private model: SortModelEntry[] = [];

  constructor(private readonly options: SortModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;

    for (const column of context.getColumns()) {
      if (column.initialSort)
        this.model.push({ colId: column.colId, direction: column.initialSort });
    }

    context.addStage(this.createStage());
  }

  private createStage(): ProjectionStage<TData> {
    const self = this;
    return {
      id: 'sort',
      phase: 'sort',

      /**
       * Only the fields the active sort columns actually read. A price tick
       * re-runs the sort when sorting by price, and is ignored entirely when
       * sorting by instrument — which is the difference between a grid that
       * keeps up with a live feed and one that does not.
       */
      get dependsOn(): ReadonlySet<string> | '*' | undefined {
        if (self.model.length === 0) return undefined;

        const fields = new Set<string>();
        for (const entry of self.model) {
          const column = self.columnFor(entry.colId);
          if (!column) continue;
          // A value getter can read anything, so nothing narrower is safe.
          if (column.valueGetter) return '*';
          if (column.field) fields.add(column.field);
        }
        return fields;
      },

      run: (rows, ctx) => self.sort(rows, ctx.store.getRowNode.bind(ctx.store)),
    };
  }

  // -- Public API -------------------------------------------------------------

  getSortModel(): readonly SortModelEntry[] {
    return this.model;
  }

  setSortModel(model: readonly SortModelEntry[]): void {
    this.model = [...model];
    this.changed();
  }

  getSortDirection(colId: string): SortDirection | null {
    return this.model.find((entry) => entry.colId === colId)?.direction ?? null;
  }

  clearSort(): void {
    this.model = [];
    this.changed();
  }

  /** Advances a column through the configured cycle. */
  toggleSort(colId: string, additive = false): void {
    const cycle = this.options.cycle ?? DEFAULT_CYCLE;
    const current = this.getSortDirection(colId);
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? null;

    const keep = additive && (this.options.multiSort ?? true);
    const rest = keep ? this.model.filter((entry) => entry.colId !== colId) : [];

    this.model = next === null ? rest : [...rest, { colId, direction: next }];
    this.changed();
  }

  getState(): SortModelEntry[] {
    return [...this.model];
  }

  setState(state: SortModelEntry[]): void {
    this.setSortModel(state ?? []);
  }

  apiExtension(): Record<string, unknown> {
    return {
      getSortModel: () => this.getSortModel(),
      setSortModel: (model: readonly SortModelEntry[]) => this.setSortModel(model),
      clearSort: () => this.clearSort(),
    };
  }

  // -- Header -----------------------------------------------------------------

  headerDecorator(ctx: HeaderSlotContext<TData>): HeaderDecoration | null {
    if (ctx.column.sortable === false) return null;
    if (!ctx.column.field && !ctx.column.valueGetter && !ctx.column.comparator) return null;

    const direction = this.getSortDirection(ctx.column.colId);

    return {
      classes: ['flow-sortable'],
      attributes: {
        'aria-sort':
          direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none',
      },
      onActivate: (event: Event) => {
        const additive = (event as MouseEvent | KeyboardEvent).shiftKey === true;
        this.toggleSort(ctx.column.colId, additive);
      },
    };
  }

  static readonly styles = css`
    .flow-sort-indicator {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      flex: 0 0 auto;
      font-size: var(--flow-sort-indicator-font-size, 10px);
      color: var(--flow-text-muted, #666);
    }

    .flow-sort-order {
      font-size: var(--flow-sort-order-font-size, 8px);
    }
  `;

  readonly styles = SortModule.styles;

  headerSlot(ctx: HeaderSlotContext<TData>) {
    const direction = this.getSortDirection(ctx.column.colId);
    if (direction === null) return null;

    const position = this.model.findIndex((entry) => entry.colId === ctx.column.colId);
    const showOrder = this.model.length > 1;

    return html`<span class="flow-sort-indicator" part="sort-indicator"
      >${direction === 'asc' ? '\u25B2' : '\u25BC'}${
        showOrder ? html`<sub class="flow-sort-order">${position + 1}</sub>` : ''
      }</span
    >`;
  }

  // -- Sorting ----------------------------------------------------------------

  private sort(
    rows: readonly DisplayRow[],
    getNode: (id: string) => RowNode<TData> | undefined,
  ): readonly DisplayRow[] {
    if (this.model.length === 0) return rows;

    const entries = this.model
      .map((entry) => ({ entry, column: this.columnFor(entry.colId) }))
      .filter(
        (pair): pair is { entry: SortModelEntry; column: ResolvedColumn<TData> } =>
          pair.column !== undefined,
      );
    if (entries.length === 0) return rows;

    // Array#sort is specified as stable, so rows equal on every active key keep
    // the order they arrived in.
    return [...rows].sort((rowA, rowB) => {
      const nodeA = getNode(rowA.rowId);
      const nodeB = getNode(rowB.rowId);
      if (!nodeA || !nodeB) return 0;

      for (const { entry, column } of entries) {
        const valueA = getCellValue(column, nodeA);
        const valueB = getCellValue(column, nodeB);

        // Blanks are ranked before the direction flip is applied, so they stay at
        // the bottom ascending *and* descending. Flipping them to the top would
        // put a wall of empty cells above the prices a trader reversed the sort
        // to see.
        const blanks = compareBlanks(valueA, valueB);
        if (blanks !== null) {
          if (blanks !== 0) return blanks;
          continue;
        }

        const result = column.comparator
          ? column.comparator(valueA, valueB, { nodeA, nodeB, column })
          : compareValues(valueA, valueB);

        if (result !== 0) return entry.direction === 'asc' ? result : -result;
      }
      return 0;
    });
  }

  private columnFor(colId: string): ResolvedColumn<TData> | undefined {
    return this.context?.getColumns().find((column) => column.colId === colId);
  }

  private changed(): void {
    this.context?.invalidate();
    this.context?.dispatch('flow-sort-changed', { model: this.getSortModel() });
  }
}

const isBlank = (value: unknown): boolean => value === null || value === undefined || value === '';

/**
 * Ranks a pair by blankness alone.
 *
 * Returns null when neither value is blank, meaning the caller should compare
 * them normally. Kept separate from {@link compareValues} so the sort can apply
 * it outside the ascending/descending flip.
 */
export function compareBlanks(a: unknown, b: unknown): number | null {
  const aBlank = isBlank(a);
  const bBlank = isBlank(b);
  if (!aBlank && !bBlank) return null;
  if (aBlank && bBlank) return 0;
  return aBlank ? 1 : -1;
}

/** Ordering for values with no comparator. Blanks last. */
export function compareValues(a: unknown, b: unknown): number {
  const blanks = compareBlanks(a, b);
  if (blanks !== null) return blanks;

  if (typeof a === 'number' && typeof b === 'number') {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
