import * as tokens from '@lime-soda/tokens/grid';
import { css, html } from 'lit';
import { defineElement } from '../../define-elements.js';
import { GridSelectionCheckbox } from './selection-checkbox.js';
import {
  FlatMembership,
  type RangeHandler,
  type SelectionMembership,
  type SelectionMembershipProvider,
  type SelectionRangeProvider,
  providesMembership,
  providesRange,
} from './membership.js';
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

const SELECTION_COL_ID = 'ls-grid-selection';

export interface SelectionModuleOptions {
  mode?: SelectionMode;
  /**
   * Add a leading checkbox column. On by default, in either mode.
   *
   * Independent of `mode`: single selection with checkboxes behaves like radio
   * buttons, and multi selection without them relies on `clickToSelect`. In
   * single mode no select-all appears in the header, because there is nothing
   * for it to mean.
   */
  checkboxColumn?: boolean;
  /** Width of that column in px. Defaults to 28. */
  checkboxColumnWidth?: number;
  /**
   * Select a row with a plain click anywhere in it. Off by default.
   *
   * Off does not mean unreachable: Ctrl-click, or Cmd-click on macOS, selects
   * whatever this is set to, so a pointer can always reach selection even with
   * no checkbox column. What this option decides is whether an *unmodified*
   * click means selection — which it should not by default, because a row
   * click is free to mean something else, such as opening a detail panel.
   */
  clickToSelect?: boolean;

  /**
   * Make a plain row click add to the selection instead of replacing it, so
   * several rows can be selected without Ctrl or Cmd. Off by default.
   *
   * For touch devices, which have no modifier keys and could otherwise reach
   * only one row at a time.
   */
  selectionWithoutKeys?: boolean;
  /** Rows that may never be selected. */
  isSelectable?: (rowId: string, meta: Readonly<Record<string, unknown>>) => boolean;
}

/**
 * Row selection: a set of selected row ids, and the affordances for changing it.
 *
 * Deliberately flat. Every row stands for itself, the set holds exactly what was
 * selected, and nothing here reads `meta.depth` or `repeatOnBreak`. A grid that
 * groups rows installs `GroupSelectionModule`, which supplies a
 * {@link SelectionMembership} making a group stand for the rows beneath it; a
 * grid that wants shift-click spans installs `RowRangeModule`, which supplies a
 * {@link RangeHandler}. Both are seams rather than flags, so the cost of each
 * falls only on the grids that ask for it.
 *
 * Contributes its own checkbox column rather than making the application compose
 * one — the prototype required callers to build `createSelectionColumn(plugin)`
 * and prepend it by hand, which meant selection could not be added or removed
 * without editing the column definitions too.
 */
export class SelectionModule<TData = unknown> implements GridModule<TData, string[]> {
  readonly id = 'selection';

  /** Forwarded across every shadow boundary, so page CSS can reach these. */
  readonly parts = ['selection-checkbox'];

  private context?: ModuleContext<TData>;
  private readonly selected = new Set<string>();

  /**
   * The last row acted on, from which a range extends.
   *
   * Held here rather than in the range module because it is simply the last row
   * touched — every path that changes the selection knows it, and a range
   * module installed later would have no way to have been watching.
   */
  private anchor: string | null = null;

  /** Core's own answer, used when no module provides one. */
  private readonly flat: SelectionMembership = new FlatMembership(
    () => this.projectedRows(),
    (rowId, meta) => this.canSelect(rowId, meta),
  );

  private membershipProvider: SelectionMembershipProvider | undefined;
  private rangeProvider: SelectionRangeProvider | undefined;
  private resolvedMembership: SelectionMembership | undefined;
  private resolvedRange: RangeHandler | undefined;

  constructor(private options: SelectionModuleOptions = {}) {}

  /**
   * Replaces some or all of this module's options.
   *
   * Options given to the constructor are otherwise fixed for the life of the
   * grid: the grid's own options are reactive, but a module's are not reachable
   * through them, and reassigning `modules` does not re-register anything. This
   * is how a preference toggle reaches a module without rebuilding the grid.
   */
  setOptions(next: Partial<SelectionModuleOptions>): void {
    this.options = { ...this.options, ...next };
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
    this.resolveProviders(context);
    // The module's checkbox column names this element, so the module is what
    // must ensure it exists — rather than an import side effect that would
    // register it even for a grid with no selection.
    defineElement('ls-grid-selection-checkbox', GridSelectionCheckbox);

    context.addTeardown(
      context.pipeline.store.subscribe((result) => {
        if (!result.structural) return;
        for (const rowId of result.removed) this.selected.delete(rowId);
      }),
    );
  }

  /**
   * Forgets the providers found at init.
   *
   * Their modules are going away with this one, so anything still holding a
   * reference to this module gets core's own answers back rather than a
   * membership belonging to a module that no longer exists.
   */
  destroy(): void {
    this.membershipProvider = undefined;
    this.rangeProvider = undefined;
    this.resolvedMembership = undefined;
    this.resolvedRange = undefined;
  }

  // -- Extension seams --------------------------------------------------------

  /**
   * What a row id stands for, and how a shift-click extends a selection.
   *
   * Resolved from whichever modules declare them rather than installed by
   * those modules reaching in here. Core answers both itself when nothing
   * provides them: every row stands for itself, and shift is an unmodified
   * click.
   *
   * Resolved lazily because a provider needs its own `init` to have run before
   * it can answer — but *counted* during init, so two modules claiming the same
   * job is a registration error rather than a surprise on first click.
   */
  private get membership(): SelectionMembership {
    this.resolvedMembership ??= this.membershipProvider?.provideSelectionMembership() ?? this.flat;
    return this.resolvedMembership;
  }

  private get range(): RangeHandler | undefined {
    if (!this.rangeProvider) return undefined;
    this.resolvedRange ??= this.rangeProvider.provideSelectionRange();
    return this.resolvedRange;
  }

  /**
   * Finds the modules providing each seam, and refuses a second.
   *
   * Two modules with different ideas of what a row id stands for are not
   * composable — one of them would be wrong about every row — so the grid says
   * so at registration instead of behaving like whichever came last.
   */
  private resolveProviders(context: ModuleContext<TData>): void {
    const modules = context.getModules().filter((module) => module !== this);

    const membership = modules.filter(providesMembership);
    const range = modules.filter(providesRange);
    assertAtMostOne('membership', membership);
    assertAtMostOne('range handling', range);

    this.membershipProvider = membership[0];
    this.rangeProvider = range[0];
    this.resolvedMembership = undefined;
    this.resolvedRange = undefined;
  }

  /** The row a range extends from: the last one acted on. */
  getAnchor(): string | null {
    return this.anchor;
  }

  /** True when a plain row click selects, which a range module needs in order to agree. */
  get clickSelects(): boolean {
    return this.options.clickToSelect ?? false;
  }

  get selectionMode(): SelectionMode {
    return this.mode;
  }

  private get mode(): SelectionMode {
    return this.options.mode ?? 'multi';
  }

  // -- Public API -------------------------------------------------------------

  /** True only when every id the row stands for is selected. */
  isSelected(rowId: string): boolean {
    return this.getRowState(rowId) === 'checked';
  }

  /**
   * What this row's checkbox should show.
   *
   * Flat, a row is checked or it is not. With group membership installed a
   * parent reads as indeterminate while only some of its children are selected,
   * which is the only honest answer and the one a trader building a basket
   * needs to see.
   */
  getRowState(rowId: string): SelectionState {
    const leaves = this.membership.leavesOf(rowId);
    if (leaves.length === 0) return 'unchecked';

    let selectedCount = 0;
    for (const leaf of leaves) {
      if (this.membership.covers(leaf, this.selected)) selectedCount += 1;
    }

    if (selectedCount === 0) return 'unchecked';
    return selectedCount === leaves.length ? 'checked' : 'indeterminate';
  }

  /**
   * The selected rows.
   *
   * With group membership installed these are the leaves — the instruments,
   * not the headings above them, which is what you would send to a basket.
   */
  /**
   * Declared for any module that needs to know what is selected — the clipboard
   * module, for one — so it can find the capability rather than this class.
   */
  provideSelectedRowIds(): readonly string[] {
    return this.getSelectedRows();
  }

  getSelectedRows(): readonly string[] {
    const resolved = new Set<string>();
    for (const id of this.selected) {
      const leaves = this.membership.leavesOf(id);
      if (leaves.length === 0) resolved.add(id);
      else for (const leaf of leaves) resolved.add(leaf);
    }
    return [...resolved];
  }

  getSelectedCount(): number {
    return this.getSelectedRows().length;
  }

  setRowSelected(rowId: string, selected: boolean): void {
    const leaves = this.membership.leavesOf(rowId);
    if (leaves.length === 0) return;

    if (selected && this.mode === 'single') this.selected.clear();

    const before = this.snapshot();

    if (selected) {
      for (const leaf of leaves) {
        this.selected.add(leaf);
        // Single mode selects one leaf even when handed a parent.
        if (this.mode === 'single') break;
      }
    } else {
      for (const leaf of leaves) this.selected.delete(leaf);
      // The row may be selected through something else — an ancestor recorded
      // while its children were hidden. That has to be broken apart, or the row
      // would spring straight back.
      this.membership.withdraw(rowId, this.selected);
    }

    if (this.snapshot() === before) return;

    this.anchor = rowId;
    this.changed();
  }

  /**
   * Selects or deselects several rows as one change.
   *
   * One change event and one repaint rather than one per row, which is what
   * makes a range module cheap: it names the span and core applies it.
   */
  setRowsSelected(rowIds: readonly string[], selected: boolean): void {
    if (rowIds.length === 0) return;
    if (this.mode === 'single') {
      const last = rowIds[rowIds.length - 1];
      if (last !== undefined) this.setRowSelected(last, selected);
      return;
    }

    const before = this.snapshot();
    for (const rowId of rowIds) {
      const leaves = this.membership.leavesOf(rowId);
      if (selected) for (const leaf of leaves) this.selected.add(leaf);
      else {
        for (const leaf of leaves) this.selected.delete(leaf);
        this.membership.withdraw(rowId, this.selected);
      }
    }

    if (this.snapshot() === before) return;
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
    for (const rowId of this.membership.allLeaves()) this.selected.add(rowId);
    this.changed();
  }

  clearSelection(): void {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.anchor = null;
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
      setRowsSelected: (rowIds: readonly string[], selected: boolean) =>
        this.setRowsSelected(rowIds, selected),
      toggleRowSelected: (rowId: string) => this.toggleRowSelected(rowId),
      selectAll: () => this.selectAll(),
      clearSelection: () => this.clearSelection(),
    };
  }

  // -- Rendering --------------------------------------------------------------

  static readonly styles = css`
    /* Read aloud, never drawn: clipped to a single pixel and taken out of flow. */
    .ls-grid-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }

    .ls-grid-checkbox {
      cursor: pointer;
      margin: 0;
      accent-color: ${tokens.accent};
    }

    .ls-grid-checkbox:disabled {
      cursor: default;
      opacity: ${tokens.disabledOpacity};
    }

    .ls-grid-checkbox:focus-visible {
      outline: ${tokens.focusWidth} solid ${tokens.focus};
      outline-offset: 1px;
    }
  `;

  readonly styles = SelectionModule.styles;

  /** Whether the module contributes its checkbox column. On unless refused. */
  private get hasCheckboxColumn(): boolean {
    return this.options.checkboxColumn ?? true;
  }

  provideColumns(): readonly ColumnDef<TData>[] {
    // Deliberately not derived from `mode`. Tying the two meant switching to
    // single selection silently removed the column, which is a surprising way
    // for one option to change another.
    if (!this.hasCheckboxColumn) return [];

    return [
      {
        colId: SELECTION_COL_ID,
        headerName: '',
        // Just wide enough for the control. The cell drops its gutter for element
        // renderers, so this is the checkbox plus breathing room, not padding.
        width: this.options.checkboxColumnWidth ?? 28,
        sortable: false,
        filterable: false,
        cellRenderer: 'ls-grid-selection-checkbox',
      },
    ];
  }

  /**
   * Select-all for the header of the module's own column. Tri-state.
   *
   * Never in single mode: selecting everything is not a thing single selection
   * can express, so the header stays empty even though the column is there.
   */
  /**
   * The checkbox column's heading, named for anyone who cannot see it.
   *
   * A word above a column of tickboxes is noise, so the column carries no
   * visible text — which left its heading with no name at all, and axe
   * reporting `empty-table-header`. In multi mode the select-all control
   * happened to supply one; in single mode there is no such control and the
   * heading was simply anonymous.
   *
   * Text rather than an `aria-label`, because the rule asks for content and an
   * attribute does not satisfy it. Hidden the usual way: clipped to nothing,
   * still read aloud.
   */
  headerSlot(ctx: HeaderSlotContext<TData>) {
    if (ctx.column.colId !== SELECTION_COL_ID) return null;

    const name = html`<span class="ls-grid-visually-hidden">Row selection</span>`;
    if (this.mode === 'single') return name;

    const leaves = this.membership.allLeaves();
    // Coverage, not membership of the set: with a hierarchy installed, a leaf
    // may be selected through an ancestor recorded while its group was collapsed.
    const selectedCount = leaves.filter((rowId) =>
      this.membership.covers(rowId, this.selected),
    ).length;
    const state: SelectionState =
      leaves.length === 0 || selectedCount === 0
        ? 'unchecked'
        : selectedCount === leaves.length
          ? 'checked'
          : 'indeterminate';

    return html`${name}${selectionCheckboxTemplate(state, leaves.length === 0, () => {
      if (state === 'checked') this.clearSelection();
      else this.selectAll();
    })}`;
  }

  /**
   * Row click, with the modifier conventions of the desktop.
   *
   * A plain click replaces the selection rather than adding to it, which is
   * what a click means in a file manager, a spreadsheet or any other grid. It
   * is deliberately not the checkbox behaviour: a checkbox accumulates because
   * that is the only thing it can do, whereas a row click has modifiers to say
   * so, and without a plain click that clears there is no way to say "just this
   * one" short of clearing by hand.
   *
   * Cmd is read alongside Ctrl, so the gesture is the platform's own on macOS.
   *
   * `selectionWithoutKeys` restores the accumulating plain click, because a
   * touch device has no modifier keys and would otherwise reach one row at a time.
   *
   * Shift falls through to a plain click unless a range module is installed —
   * the span is that module's to define.
   */
  private activate(rowId: string, event: MouseEvent): void {
    const modified = event.ctrlKey || event.metaKey;
    const additive = modified || (this.options.selectionWithoutKeys ?? false);

    // Without `clickToSelect` a plain click is not ours to interpret — the
    // application may want it for something else entirely. A modified click is
    // unambiguous, so it selects regardless, which is what keeps selection
    // reachable by pointer when there is no checkbox column.
    if (!this.clickSelects && !modified && !this.extendsRange(event.shiftKey)) return;

    if (this.extendsRange(event.shiftKey)) {
      this.range!(rowId);
      return;
    }

    if (additive) {
      this.toggleRowSelected(rowId);
      return;
    }

    this.replaceSelection(rowId);
  }

  /** Selects one row and nothing else, in a single change. */
  private replaceSelection(rowId: string): void {
    const membership = this.membership.leavesOf(rowId);
    const alreadyOnlyThisRow =
      membership.length > 0 &&
      this.selected.size === membership.length &&
      membership.every((leaf) => this.selected.has(leaf));
    if (alreadyOnlyThisRow) return;

    this.selected.clear();
    this.setRowSelected(rowId, true);
  }

  rowDecorator(ctx: RowContextInfo<TData>): RowDecoration | null {
    const state = this.getRowState(ctx.row.rowId);
    const selected = state === 'checked';

    // Attached whatever the state. Putting it only on selected rows meant
    // clicking could deselect but never select — the option looked broken
    // because the rows that needed the handler most were the ones without it.
    // Always attached. Whether an unmodified click means anything is decided in
    // `activate`, because a modified one means selection either way — leaving
    // the handler off entirely was what made a grid with no checkbox column
    // selectable by keyboard and inert to a mouse.
    const activation = {
      onActivate: (event: Event) => this.activate(ctx.row.rowId, event as MouseEvent),
    };

    if (!selected) {
      // Still returns a decoration so the previous one is withdrawn and the
      // aria state stays truthful for unselected rows.
      return {
        attributes: { 'aria-selected': state === 'indeterminate' ? 'mixed' : 'false' },
        ...activation,
      };
    }

    return {
      classes: ['ls-grid-row-selected'],
      attributes: { 'aria-selected': 'true' },
      // A row is `display: contents` and has no box to paint, so the highlight
      // travels to the cells as a class the cell stylesheet styles.
      cellClasses: ['ls-grid-cell-selected'],
      ...activation,
    };
  }

  /**
   * Whether this click extends a range rather than picking out a single row.
   *
   * The same answer for a checkbox and for a row, so shift-clicking either
   * re-cuts the span the same way. The range module gives back what the new
   * span no longer covers, so nothing here needs to clear the selection —
   * which is what used to make a shift-click discard rows chosen separately.
   */
  private extendsRange(shiftKey: boolean): boolean {
    return shiftKey && this.mode === 'multi' && this.range !== undefined && this.anchor !== null;
  }

  /** Exposed for the checkbox renderer, which lives in the same module. */
  handleCheckbox(rowId: string, checked: boolean, shiftKey: boolean): void {
    // Deliberately regardless of `checked`: shift-clicking a ticked box is
    // still a range gesture, and re-cutting the span is the answer to it.
    if (this.extendsRange(shiftKey)) this.range!(rowId);
    else this.setRowSelected(rowId, checked);
  }

  /**
   * Space or Enter selects the focused row.
   *
   * The keyboard counterpart to clicking a checkbox. A focused cell is not the
   * checkbox inside it — focus sits on the cell — so the key press would
   * otherwise reach nothing, and a grid navigable entirely by keyboard had no
   * way to actually select anything.
   *
   * Scoped to the checkbox column when there is one: the checkbox is the thing
   * being operated, and a key that selects from anywhere would fight whatever a
   * value cell wants Enter for. With no checkbox column there is nothing to
   * aim at, so any cell answers — otherwise a grid without checkboxes could not
   * be selected from the keyboard at all.
   */
  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key !== ' ' && event.key !== 'Enter') return false;

    const position = this.context?.focus.focused.get();
    if (!position) return false;
    if (this.hasCheckboxColumn && position.colId !== SELECTION_COL_ID) return false;

    // The focused row is identified by its DisplayRow id, which repeats of an
    // ancestor do not share; the selection is keyed by rowId.
    const rowId = this.projectedRows().find((row) => row.id === position.rowKey)?.rowId;
    if (rowId === undefined || !this.isRowSelectable(rowId)) return false;

    this.toggleRowSelected(rowId);
    // Returning true is what stops Space scrolling the page.
    return true;
  }

  canSelect(rowId: string, meta: Readonly<Record<string, unknown>> = {}): boolean {
    return this.options.isSelectable?.(rowId, meta) ?? true;
  }

  /**
   * The ids this row stands for.
   *
   * Itself, ordinarily. With a membership module installed, a parent stands for
   * the rows beneath it — which is how a caller can tell whether one row already
   * speaks for another without knowing what a hierarchy is or how this one was
   * built.
   */
  standsFor(rowId: string): readonly string[] {
    return this.membership.leavesOf(rowId);
  }

  /** Whether a row's checkbox should be interactive at all. */
  isRowSelectable(rowId: string): boolean {
    return this.membership.leavesOf(rowId).length > 0;
  }

  /** The projection, which membership implementations are defined against. */
  projectedRows(): readonly DisplayRow[] {
    return this.context?.pipeline.projector.rows.get() ?? [];
  }

  /** Order-independent snapshot, for deciding whether anything actually moved. */
  private snapshot(): string {
    return [...this.selected].sort().join('\u0000');
  }

  private changed(): void {
    this.context?.requestRender();
    this.context?.dispatch('ls-grid-selection-changed', {
      selected: this.getSelectedRows(),
      count: this.selected.size,
    });
  }
}

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
    class="ls-grid-checkbox"
  />`;

/** One module may do a job; two cannot, and saying so early is the whole point. */
function assertAtMostOne(what: string, providers: readonly { readonly id: string }[]): void {
  if (providers.length <= 1) return;
  const names = providers.map((provider) => `"${provider.id}"`).join(' and ');
  throw new Error(
    `Modules ${names} both provide selection ${what}. A row id can only stand for ` +
      `one thing, so these modules cannot be installed together.`,
  );
}
