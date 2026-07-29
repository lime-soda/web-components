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
  private cachedAncestors?: Map<string, readonly string[]>;

  /**
   * Group membership seen at any point, kept across projections.
   *
   * A collapsed group's children are absent from the projection, so without this
   * a group selected while expanded would read as unselected the moment it was
   * collapsed — the same lie as the reverse case, in the other direction.
   * Pruned when rows leave the store.
   */
  private readonly rememberedLeaves = new Map<string, readonly string[]>();

  constructor(private readonly options: SelectionModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;

    context.addTeardown(
      context.pipeline.store.subscribe((result) => {
        if (!result.structural) return;
        // A remembered group whose rows have gone would otherwise keep a stale
        // membership alive for the life of the grid.
        for (const rowId of result.removed) {
          this.rememberedLeaves.delete(rowId);
          this.selected.delete(rowId);
        }
      }),
    );

    // Membership is recorded as a side effect of reading the index, so it must
    // be read on every projection rather than only when a checkbox happens to
    // ask. Otherwise a grid collapsed before anything consulted selection would
    // never have learned what its groups contain.
    context.addTeardown(context.pipeline.projector.subscribe(() => this.leafIndex()));
    this.leafIndex();
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
   * Whether a row is selected in its own right or through an ancestor.
   *
   * Selecting a collapsed group can only record the group: its children are not
   * projected, so there is nothing else to record. Expanding then reveals rows
   * that were never named, and without this they would read as unselected and
   * the selection would appear to vanish.
   */
  private isCovered(rowId: string): boolean {
    if (this.selected.has(rowId)) return true;
    // Only a group that stands for its children can confer selection on them.
    // With groups independent, a selected group says nothing about its rows.
    if (!this.groupSelectsChildren) return false;
    for (const ancestor of this.ancestorsOf(rowId)) {
      if (this.selected.has(ancestor)) return true;
    }
    return false;
  }

  /**
   * The leaves a row stands for, falling back to what was seen before.
   *
   * A collapsed group looks like a leaf in the projection; if it was ever seen
   * expanded, its real membership is the honest answer.
   */
  private membershipOf(rowId: string): readonly string[] {
    const projected = this.selectableLeavesOf(rowId);
    const isOwnLeafOnly = projected.length === 1 && projected[0] === rowId;
    if (!isOwnLeafOnly) return projected;
    return this.rememberedLeaves.get(rowId) ?? projected;
  }

  /** Ancestors of a projected row, nearest last. Empty for a root. */
  private ancestorsOf(rowId: string): readonly string[] {
    this.leafIndex();
    return this.cachedAncestors?.get(rowId) ?? [];
  }

  /**
   * What this row's checkbox should show.
   *
   * A parent reads as indeterminate while only some of its children are
   * selected, which is the only honest answer and the one a trader building a
   * basket needs to see.
   */
  getRowState(rowId: string): SelectionState {
    const leaves = this.membershipOf(rowId);
    if (leaves.length === 0) return 'unchecked';

    let selectedCount = 0;
    for (const leaf of leaves) {
      if (this.isCovered(leaf)) selectedCount += 1;
    }

    if (selectedCount === 0) return 'unchecked';
    return selectedCount === leaves.length ? 'checked' : 'indeterminate';
  }

  /**
   * The selected leaf rows — the instruments, not the headings above them.
   *
   * A group recorded while collapsed resolves to its children once they are
   * known; while they are not, the group itself is the most specific answer
   * available.
   */
  getSelectedRows(): readonly string[] {
    const resolved = new Set<string>();
    for (const id of this.selected) {
      const leaves = this.membershipOf(id);
      if (leaves.length === 0) resolved.add(id);
      else for (const leaf of leaves) resolved.add(leaf);
    }
    return [...resolved];
  }

  getSelectedCount(): number {
    return this.getSelectedRows().length;
  }

  setRowSelected(rowId: string, selected: boolean): void {
    const leaves = this.membershipOf(rowId);
    if (leaves.length === 0) return;

    if (selected && this.mode === 'single') this.selected.clear();

    const before = [...this.selected].sort().join('\u0000');

    if (selected) {
      for (const leaf of leaves) {
        this.selected.add(leaf);
        // Single mode selects one leaf even when handed a parent.
        if (this.mode === 'single') break;
      }
    } else {
      for (const leaf of leaves) this.selected.delete(leaf);
      // The row may be selected only through an ancestor recorded while its
      // children were hidden. Deselecting one child has to break that ancestor
      // apart, keeping its siblings, or the row would spring straight back.
      this.uncover(rowId);
    }

    if ([...this.selected].sort().join('\u0000') === before) return;

    this.lastToggled = rowId;
    this.changed();
  }

  /**
   * Removes any selected ancestor covering a row, replacing it with its other
   * leaves so only the intended row is deselected.
   */
  private uncover(rowId: string): void {
    for (const ancestor of this.ancestorsOf(rowId)) {
      if (!this.selected.has(ancestor)) continue;
      this.selected.delete(ancestor);
      for (const leaf of this.membershipOf(ancestor)) {
        if (leaf !== rowId && !this.isDescendantOf(leaf, rowId)) this.selected.add(leaf);
      }
    }
  }

  private isDescendantOf(rowId: string, possibleAncestor: string): boolean {
    return this.ancestorsOf(rowId).includes(possibleAncestor);
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
    // Coverage, not membership of the set: a leaf may be selected through an
    // ancestor recorded while its group was collapsed.
    const selectedCount = leaves.filter((rowId) => this.isCovered(rowId)).length;
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

  /**
   * Every selectable leaf in the grid, resolved through remembered membership.
   *
   * The projected leaves are not enough: with groups collapsed each group *is* a
   * projected leaf, so the header would count groups rather than instruments and
   * report a selection of instruments as nothing at all.
   */
  private allSelectableLeaves(): readonly string[] {
    const ids = new Set<string>();
    for (const rowId of this.leafIndex().keys()) {
      for (const leaf of this.membershipOf(rowId)) ids.add(leaf);
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

    // The ancestor chain is already on the row, put there by whichever module
    // flattened the hierarchy. Reading it here needs no notion of a parent.
    const ancestors = new Map<string, readonly string[]>();
    for (const row of rows) {
      const chain = row.repeatOnBreak;
      if (chain && chain.length > 0) {
        ancestors.set(
          row.rowId,
          chain.map((ancestor) => ancestor.rowId),
        );
      }
    }

    for (const [rowId, ids] of leaves) {
      // Only a row standing for others is worth remembering; a leaf stands for
      // itself in every projection.
      if (ids.length > 1 || (ids.length === 1 && ids[0] !== rowId)) {
        this.rememberedLeaves.set(rowId, ids);
      }
    }

    this.cachedRows = rows;
    this.cachedLeaves = leaves;
    this.cachedAncestors = ancestors;
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
