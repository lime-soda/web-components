import { html } from 'lit';
import type { ColumnDef } from '../../columns/types.js';
import type { GridModule, ModuleContext, RowContextInfo, RowDecoration } from '../types.js';

export type SelectionMode = 'single' | 'multi';

export interface SelectionModuleOptions {
  mode?: SelectionMode;
  /** Add a leading checkbox column. On by default in multi mode. */
  checkboxColumn?: boolean;
  /** Select a row by clicking anywhere in it. Off by default. */
  clickToSelect?: boolean;
  /** Rows that may never be selected — group headings, for instance. */
  isSelectable?: (rowId: string, meta: Readonly<Record<string, unknown>>) => boolean;
}

/**
 * Row selection, for the basket workflows the horizontal layout is built around.
 *
 * Contributes its own checkbox column rather than making the application compose
 * one — the prototype required callers to build `createSelectionColumn(plugin)`
 * and prepend it by hand, which meant selection could not be added or removed
 * without editing the column definitions too.
 */
export class SelectionModule<TData = unknown> implements GridModule<TData, string[]> {
  readonly id = 'selection';

  private context?: ModuleContext<TData>;
  private readonly selected = new Set<string>();
  private lastToggled: string | null = null;

  constructor(private readonly options: SelectionModuleOptions = {}) {}

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  private get mode(): SelectionMode {
    return this.options.mode ?? 'multi';
  }

  // -- Public API -------------------------------------------------------------

  isSelected(rowId: string): boolean {
    return this.selected.has(rowId);
  }

  getSelectedRows(): readonly string[] {
    return [...this.selected];
  }

  getSelectedCount(): number {
    return this.selected.size;
  }

  setRowSelected(rowId: string, selected: boolean): void {
    if (selected && !this.canSelect(rowId)) return;
    if (this.selected.has(rowId) === selected) return;

    if (selected && this.mode === 'single') this.selected.clear();
    if (selected) this.selected.add(rowId);
    else this.selected.delete(rowId);

    this.lastToggled = rowId;
    this.changed();
  }

  toggleRowSelected(rowId: string): void {
    this.setRowSelected(rowId, !this.selected.has(rowId));
  }

  /**
   * Selects every row currently projected.
   *
   * Scoped to the projection rather than the store, so "select all" under an
   * active filter selects what the trader can see, not the whole book behind it.
   */
  selectAll(): void {
    if (this.mode === 'single') return;
    const rows = this.context?.pipeline.projector.rows.get() ?? [];
    for (const row of rows) {
      if (this.canSelect(row.rowId, row.meta)) this.selected.add(row.rowId);
    }
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

    const rows = this.context?.pipeline.projector.rows.get() ?? [];
    const from = rows.findIndex((row) => row.rowId === this.lastToggled);
    const to = rows.findIndex((row) => row.rowId === toRowId);
    if (from === -1 || to === -1) {
      this.setRowSelected(toRowId, true);
      return;
    }

    for (const row of rows.slice(Math.min(from, to), Math.max(from, to) + 1)) {
      if (this.canSelect(row.rowId, row.meta)) this.selected.add(row.rowId);
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
      getSelectedRows: () => this.getSelectedRows(),
      getSelectedCount: () => this.getSelectedCount(),
      setRowSelected: (rowId: string, selected: boolean) => this.setRowSelected(rowId, selected),
      toggleRowSelected: (rowId: string) => this.toggleRowSelected(rowId),
      selectAll: () => this.selectAll(),
      clearSelection: () => this.clearSelection(),
    };
  }

  // -- Rendering --------------------------------------------------------------

  provideColumns(): readonly ColumnDef<TData>[] {
    const wanted = this.options.checkboxColumn ?? this.mode === 'multi';
    if (!wanted) return [];

    return [
      {
        colId: 'fg-selection',
        headerName: '',
        width: 36,
        sortable: false,
        filterable: false,
        cellRenderer: 'fg-selection-checkbox',
      },
    ];
  }

  rowDecorator(ctx: RowContextInfo<TData>): RowDecoration | null {
    if (!this.selected.has(ctx.row.rowId)) {
      // Still returns a decoration so the previous one is withdrawn and the
      // aria state stays truthful for unselected rows.
      return { attributes: { 'aria-selected': 'false' } };
    }

    return {
      classes: ['fg-row-selected'],
      attributes: { 'aria-selected': 'true' },
      cellClasses: ['fg-cell-selected'],
      // A row is `display: contents`, so the highlight has to reach the cells.
      cellAttributes: { style: 'background: var(--fg-selection-bg, rgba(59, 130, 246, 0.12))' },
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

  private changed(): void {
    this.context?.requestRender();
    this.context?.dispatch('fg-selection-changed', {
      selected: this.getSelectedRows(),
      count: this.selected.size,
    });
  }
}

/** Rendered by the module's checkbox column. Kept here so the module is self-contained. */
export const selectionCheckboxTemplate = (
  checked: boolean,
  disabled: boolean,
  onChange: (checked: boolean, shiftKey: boolean) => void,
) =>
  html`<input
    type="checkbox"
    part="selection-checkbox"
    .checked=${checked}
    ?disabled=${disabled}
    aria-label=${checked ? 'Deselect row' : 'Select row'}
    @click=${(event: Event) => {
    event.stopPropagation();
    onChange((event.target as HTMLInputElement).checked, (event as MouseEvent).shiftKey);
  }}
    style="cursor:pointer;margin:0"
  />`;
