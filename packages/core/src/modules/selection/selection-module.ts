import { css, html } from 'lit';
import type { ColumnDef } from '../../columns/types.js';
import type { DisplayRow } from '../../layout/types.js';
import type {
  GridModule,
  HeaderSlotContext,
  ModuleContext,
  RowContextInfo,
  RowDecoration,
} from '../types.js';

export type SelectionMode = 'single' | 'multi';

/** What a checkbox should show. Derived, never stored. */
export type SelectionState = 'checked' | 'indeterminate' | 'unchecked';

const SELECTION_COL_ID = 'flow-selection';

export interface SelectionModuleOptions {
  mode?: SelectionMode;
  /** Add a leading checkbox column. On by default in multi mode. */
  checkboxColumn?: boolean;
  /** Width of that column in px. Defaults to 28. */
  checkboxColumnWidth?: number;
  /** Select a row by clicking anywhere in it. Off by default. */
  clickToSelect?: boolean;
  /**
   * Selecting a parent selects its descendants, and the parent's own state is
   * derived from them. On by default.
   *
   * Turning it off makes a parent an independently selectable row, which suits a
   * grid whose group rows are real records rather than headings.
   */
  groupSelectsChildren?: boolean;
  /** Rows that may never be selected. */
  isSelectable?: (rowId: string, meta: Readonly<Record<string, unknown>>) => boolean;
}

/**
 * Row selection, for the basket workflows the horizontal layout is built around.
 *
 * Contributes its own checkbox column rather than making the application compose
 * one — the prototype required callers to build `createSelectionColumn(plugin)`
 * and prepend it by hand, which meant selection could not be added or removed
 * without editing the column definitions too.
 *
 * Group selection is hierarchy-blind. It reads `meta.depth` off the projection,
 * which any module may supply, and never mentions the tree module. With no tree
 * installed every row is its own leaf and the behaviour collapses to the flat
 * case at no cost. Because the projection is already filtered, selecting a group
 * selects its *visible* children — filter first, then tick the group, and only
 * what survived the filter is selected.
 */
export class SelectionModule<TData = unknown> implements GridModule<TData, string[]> {
  readonly id = 'selection';

  private context?: ModuleContext<TData>;
  /** Only leaves are stored. A parent's state is computed from these. */
  private readonly selected = new Set<string>();
  private lastToggled: string | null = null;

  private cachedRows?: readonly DisplayRow[];
  private cachedLeaves?: Map<string, readonly string[]>;

  constructor(private readonly options: SelectionModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  private get mode(): SelectionMode {
    return this.options.mode ?? 'multi';
  }

  private get groupSelectsChildren(): boolean {
    return this.options.groupSelectsChildren ?? true;
  }

  // -- Public API -------------------------------------------------------------

  /** True only when every selectable leaf beneath the row is selected. */
  isSelected(rowId: string): boolean {
    return this.getRowState(rowId) === 'checked';
  }

  /**
   * What this row's checkbox should show.
   *
   * A parent reads as indeterminate while only some of its children are
   * selected, which is the only honest answer and the one a trader building a
   * basket needs to see.
   */
  getRowState(rowId: string): SelectionState {
    const leaves = this.selectableLeavesOf(rowId);
    if (leaves.length === 0) return 'unchecked';

    let selectedCount = 0;
    for (const leaf of leaves) {
      if (this.selected.has(leaf)) selectedCount += 1;
    }

    if (selectedCount === 0) return 'unchecked';
    return selectedCount === leaves.length ? 'checked' : 'indeterminate';
  }

  /** The selected leaf rows — the instruments, not the headings above them. */
  getSelectedRows(): readonly string[] {
    return [...this.selected];
  }

  getSelectedCount(): number {
    return this.selected.size;
  }

  setRowSelected(rowId: string, selected: boolean): void {
    const leaves = this.selectableLeavesOf(rowId);
    if (leaves.length === 0) return;

    if (selected && this.mode === 'single') this.selected.clear();

    let changed = false;
    for (const leaf of leaves) {
      if (selected ? this.selected.has(leaf) : !this.selected.has(leaf)) continue;
      if (selected) this.selected.add(leaf);
      else this.selected.delete(leaf);
      changed = true;
      // Single mode selects one leaf even when handed a parent.
      if (selected && this.mode === 'single') break;
    }

    if (!changed) return;
    this.lastToggled = rowId;
    this.changed();
  }

  toggleRowSelected(rowId: string): void {
    // A partly selected parent completes rather than clears: the trader was
    // building the group up, not tearing it down.
    this.setRowSelected(rowId, this.getRowState(rowId) !== 'checked');
  }

  /**
   * Selects every row currently projected.
   *
   * Scoped to the projection rather than the store, so "select all" under an
   * active filter selects what the trader can see, not the whole book behind it.
   */
  selectAll(): void {
    if (this.mode === 'single') return;
    for (const rowId of this.allSelectableLeaves()) this.selected.add(rowId);
    this.changed();
  }

  clearSelection(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.lastToggled = null;
    this.changed();
  }

  /** Selects the span between the last toggled row and this one. */
  selectRange(toRowId: string): void {
    if (this.mode === 'single' || this.lastToggled === null) {
      this.setRowSelected(toRowId, true);
      return;
    }

    const rows = this.projectedRows();
    const from = rows.findIndex((row) => row.rowId === this.lastToggled);
    const to = rows.findIndex((row) => row.rowId === toRowId);
    if (from === -1 || to === -1) {
      this.setRowSelected(toRowId, true);
      return;
    }

    for (const row of rows.slice(Math.min(from, to), Math.max(from, to) + 1)) {
      for (const leaf of this.selectableLeavesOf(row.rowId)) this.selected.add(leaf);
    }
    this.changed();
  }

  getState(): string[] {
    return [...this.selected];
  }

  setState(state: string[]): void {
    this.selected.clear();
    for (const id of state ?? []) this.selected.add(id);
    this.changed();
  }

  apiExtension(): Record<string, unknown> {
    return {
      isRowSelected: (rowId: string) => this.isSelected(rowId),
      getRowSelectionState: (rowId: string) => this.getRowState(rowId),
      getSelectedRows: () => this.getSelectedRows(),
      getSelectedCount: () => this.getSelectedCount(),
      setRowSelected: (rowId: string, selected: boolean) => this.setRowSelected(rowId, selected),
      toggleRowSelected: (rowId: string) => this.toggleRowSelected(rowId),
      selectAll: () => this.selectAll(),
      clearSelection: () => this.clearSelection(),
    };
  }

  // -- Rendering --------------------------------------------------------------

  static readonly styles = css`
    .flow-checkbox {
      cursor: pointer;
      margin: 0;
      accent-color: var(--flow-focus, #3b82f6);
    }

    .flow-checkbox:disabled {
      cursor: default;
      opacity: var(--flow-disabled-opacity, 0.4);
    }

    .flow-checkbox:focus-visible {
      outline: var(--flow-focus-width, 2px) solid var(--flow-focus, #3b82f6);
      outline-offset: 1px;
    }
  `;

  readonly styles = SelectionModule.styles;

  provideColumns(): readonly ColumnDef<TData>[] {
    const wanted = this.options.checkboxColumn ?? this.mode === 'multi';
    if (!wanted) return [];

    return [
      {
        colId: SELECTION_COL_ID,
        headerName: '',
        // Just wide enough for the control. The cell drops its gutter for element
        // renderers, so this is the checkbox plus breathing room, not padding.
        width: this.options.checkboxColumnWidth ?? 28,
        sortable: false,
        filterable: false,
        cellRenderer: 'flow-selection-checkbox',
      },
    ];
  }

  /** Select-all for the header of the module's own column. Tri-state. */
  headerSlot(ctx: HeaderSlotContext<TData>) {
    if (ctx.column.colId !== SELECTION_COL_ID || this.mode === 'single') return null;

    const leaves = this.allSelectableLeaves();
    const selectedCount = leaves.filter((rowId) => this.selected.has(rowId)).length;
    const state: SelectionState =
      leaves.length === 0 || selectedCount === 0
        ? 'unchecked'
        : selectedCount === leaves.length
          ? 'checked'
          : 'indeterminate';

    return selectionCheckboxTemplate(state, leaves.length === 0, () => {
      if (state === 'checked') this.clearSelection();
      else this.selectAll();
    });
  }

  rowDecorator(ctx: RowContextInfo<TData>): RowDecoration | null {
    const state = this.getRowState(ctx.row.rowId);

    if (state !== 'checked') {
      // Still returns a decoration so the previous one is withdrawn and the
      // aria state stays truthful for unselected rows.
      return { attributes: { 'aria-selected': state === 'indeterminate' ? 'mixed' : 'false' } };
    }

    return {
      classes: ['flow-row-selected'],
      attributes: { 'aria-selected': 'true' },
      // A row is `display: contents` and has no box to paint, so the highlight
      // travels to the cells as a class the cell stylesheet styles.
      cellClasses: ['flow-cell-selected'],
      ...(this.options.clickToSelect
        ? {
            onActivate: (event: Event) => {
              if ((event as MouseEvent).shiftKey) this.selectRange(ctx.row.rowId);
              else this.toggleRowSelected(ctx.row.rowId);
            },
          }
        : {}),
    };
  }

  /** Exposed for the checkbox renderer, which lives in the same module. */
  handleCheckbox(rowId: string, checked: boolean, shiftKey: boolean): void {
    if (checked && shiftKey) this.selectRange(rowId);
    else this.setRowSelected(rowId, checked);
  }

  canSelect(rowId: string, meta: Readonly<Record<string, unknown>> = {}): boolean {
    return this.options.isSelectable?.(rowId, meta) ?? true;
  }

  /** Whether a row's checkbox should be interactive at all. */
  isRowSelectable(rowId: string): boolean {
    return this.selectableLeavesOf(rowId).length > 0;
  }

  // -- Leaves -----------------------------------------------------------------

  /**
   * The selectable leaf rows a given row stands for.
   *
   * A leaf stands for itself. A parent stands for its descendants, which is what
   * makes ticking a group select the instruments beneath it.
   */
  private selectableLeavesOf(rowId: string): readonly string[] {
    return this.leafIndex().get(rowId) ?? [];
  }

  private allSelectableLeaves(): readonly string[] {
    const ids = new Set<string>();
    for (const leaves of this.leafIndex().values()) {
      for (const leaf of leaves) ids.add(leaf);
    }
    return [...ids];
  }

  /**
   * Maps every projected row to the selectable leaves beneath it.
   *
   * Built from `meta.depth` alone, in one pass over the projection, and cached
   * against the projection's identity — the projection is a memoised signal, so
   * an unchanged one is the same array and the index survives ticks untouched.
   */
  private leafIndex(): Map<string, readonly string[]> {
    const rows = this.projectedRows();
    if (this.cachedRows === rows && this.cachedLeaves) return this.cachedLeaves;

    const collected = new Map<string, Set<string>>();
    const ensure = (rowId: string): Set<string> => {
      let set = collected.get(rowId);
      if (!set) {
        set = new Set();
        collected.set(rowId, set);
      }
      return set;
    };

    if (this.groupSelectsChildren) {
      const depths = rows.map((row) => (row.meta?.['depth'] as number | undefined) ?? 0);
      const open: { rowId: string; depth: number }[] = [];

      for (const [index, row] of rows.entries()) {
        const depth = depths[index] ?? 0;
        while (open.length > 0 && (open[open.length - 1]?.depth ?? 0) >= depth) open.pop();

        const own = ensure(row.rowId);

        // A leaf is a row the next one does not sit beneath. Deciding this from
        // the neighbour's depth — rather than provisionally treating every row as
        // a leaf and correcting later — is what stops an intermediate group being
        // counted as a leaf of its own ancestor.
        const isLeaf = index === rows.length - 1 || (depths[index + 1] ?? 0) <= depth;

        if (isLeaf && this.canSelect(row.rowId, row.meta ?? {})) {
          own.add(row.rowId);
          for (const ancestor of open) ensure(ancestor.rowId).add(row.rowId);
        }

        open.push({ rowId: row.rowId, depth });
      }
    } else {
      // Every row stands only for itself, groups included.
      for (const row of rows) {
        const own = ensure(row.rowId);
        if (this.canSelect(row.rowId, row.meta ?? {})) own.add(row.rowId);
      }
    }

    const leaves = new Map<string, readonly string[]>();
    for (const [rowId, ids] of collected) leaves.set(rowId, [...ids]);

    this.cachedRows = rows;
    this.cachedLeaves = leaves;
    return leaves;
  }

  private projectedRows(): readonly DisplayRow[] {
    return this.context?.pipeline.projector.rows.get() ?? [];
  }

  private changed(): void {
    this.context?.requestRender();
    this.context?.dispatch('flow-selection-changed', {
      selected: this.getSelectedRows(),
      count: this.selected.size,
    });
  }
}

/** Rendered by the module's checkbox column and its header. */
export const selectionCheckboxTemplate = (
  state: SelectionState,
  disabled: boolean,
  onChange: (checked: boolean, shiftKey: boolean) => void,
) =>
  html`<input
    type="checkbox"
    part="selection-checkbox"
    .checked=${state === 'checked'}
    .indeterminate=${state === 'indeterminate'}
    ?disabled=${disabled}
    aria-label=${state === 'checked' ? 'Deselect' : 'Select'}
    @click=${(event: Event) => {
      event.stopPropagation();
      onChange((event.target as HTMLInputElement).checked, (event as MouseEvent).shiftKey);
    }}
    class="flow-checkbox"
  />`;
