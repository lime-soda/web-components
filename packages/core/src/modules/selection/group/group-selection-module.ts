import type { DisplayRow } from '../../../layout/types.js';
import type { GridModule, ModuleContext } from '../../types.js';
import type { SelectionMembership } from '../membership.js';
import type { SelectionModule } from '../selection-module.js';

export interface GroupSelectionModuleOptions {
  /**
   * Selecting a parent selects its descendants, and the parent's own state is
   * derived from them. On by default — it is the reason to install this module.
   *
   * Turning it off makes a parent an independently selectable row standing for
   * nothing but itself, which suits a grid whose group rows are real records
   * rather than headings. The module is still worth having in that case: it is
   * what makes a group selectable at all under a hierarchy.
   */
  groupSelectsChildren?: boolean;
}

/**
 * Makes selection understand hierarchy.
 *
 * Core selection holds a flat set of row ids. This supplies it with a
 * {@link SelectionMembership} in which a group stands for the rows beneath it,
 * so ticking a category selects its instruments, a partly selected category
 * reads as indeterminate, and `getSelectedRows()` returns instruments rather
 * than the headings above them.
 *
 * Hierarchy-blind about *where* the hierarchy came from. It reads `meta.depth`
 * and `repeatOnBreak` off the projection, which any module may supply, and
 * never mentions the tree module. Because the projection is already filtered,
 * selecting a group selects its *visible* children — filter first, then tick
 * the group, and only what survived the filter is selected.
 */
export class GroupSelectionModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'selection-group';
  readonly dependsOn = ['selection'];

  private context?: ModuleContext<TData>;
  private selection?: SelectionModule<TData>;

  private cachedRows: readonly DisplayRow[] | undefined;
  private cachedLeaves: Map<string, readonly string[]> | undefined;
  private cachedAncestors: Map<string, readonly string[]> | undefined;

  /**
   * Group membership seen at any point, kept across projections.
   *
   * A collapsed group's children are absent from the projection, so without
   * this a group selected while expanded would read as unselected the moment it
   * was collapsed. Pruned when rows leave the store.
   */
  private readonly rememberedLeaves = new Map<string, readonly string[]>();

  constructor(private options: GroupSelectionModuleOptions = {}) {}

  setOptions(next: Partial<GroupSelectionModuleOptions>): void {
    this.options = { ...this.options, ...next };
    // The leaf index is derived from the options, so it must not survive them.
    this.invalidateIndex();
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
    const selection = context.getModule<SelectionModule<TData>>('selection');
    // `dependsOn` is asserted by the registry, so this is a type narrowing
    // rather than a real possibility.
    if (!selection) return;
    this.selection = selection;

    context.addTeardown(selection.setMembership(this.membership(selection)));

    context.addTeardown(
      context.pipeline.store.subscribe((result) => {
        if (!result.structural) return;
        for (const rowId of result.removed) this.rememberedLeaves.delete(rowId);
      }),
    );

    // Membership is recorded as a side effect of reading the index, so it must
    // be read on every projection rather than only when a checkbox happens to
    // ask. Otherwise a grid collapsed before anything consulted selection would
    // never have learned what its groups contain.
    context.addTeardown(context.pipeline.projector.subscribe(() => this.leafIndex()));
    this.leafIndex();
  }

  private get groupSelectsChildren(): boolean {
    return this.options.groupSelectsChildren ?? true;
  }

  private membership(selection: SelectionModule<TData>): SelectionMembership {
    return {
      leavesOf: (rowId) => this.membershipOf(rowId),
      allLeaves: () => this.allSelectableLeaves(),
      covers: (rowId, selected) => this.isCovered(rowId, selected),
      withdraw: (rowId, selected) => this.withdraw(rowId, selected),
    } satisfies SelectionMembership & ThisType<typeof selection>;
  }

  // -- Membership -------------------------------------------------------------

  /**
   * The leaves a row stands for, falling back to what was seen before.
   *
   * A collapsed group looks like a leaf in the projection; if it was ever seen
   * expanded, its real membership is the honest answer.
   */
  private membershipOf(rowId: string): readonly string[] {
    const projected = this.selectableLeavesOf(rowId);
    // With groups standing alone, no row ever stands for another, so remembered
    // membership is not just unnecessary — consulting it would resurrect the
    // other mode's behaviour after a switch.
    if (!this.groupSelectsChildren) return projected;

    const isOwnLeafOnly = projected.length === 1 && projected[0] === rowId;
    if (!isOwnLeafOnly) return projected;
    return this.rememberedLeaves.get(rowId) ?? projected;
  }

  /**
   * Whether a row is selected in its own right or through an ancestor.
   *
   * Selecting a collapsed group can only record the group: its children are not
   * projected, so there is nothing else to record. Expanding then reveals rows
   * that were never named, and without this they would read as unselected and
   * the selection would appear to vanish.
   */
  private isCovered(rowId: string, selected: ReadonlySet<string>): boolean {
    if (selected.has(rowId)) return true;
    // Only a group that stands for its children can confer selection on them.
    // With groups independent, a selected group says nothing about its rows.
    if (!this.groupSelectsChildren) return false;
    for (const ancestor of this.ancestorsOf(rowId)) {
      if (selected.has(ancestor)) return true;
    }
    return false;
  }

  /**
   * Removes any selected ancestor covering a row, replacing it with its other
   * leaves so only the intended row is deselected.
   */
  private withdraw(rowId: string, selected: Set<string>): void {
    if (!this.groupSelectsChildren) return;
    for (const ancestor of this.ancestorsOf(rowId)) {
      if (!selected.has(ancestor)) continue;
      selected.delete(ancestor);
      for (const leaf of this.membershipOf(ancestor)) {
        if (leaf !== rowId && !this.isDescendantOf(leaf, rowId)) selected.add(leaf);
      }
    }
  }

  private isDescendantOf(rowId: string, possibleAncestor: string): boolean {
    return this.ancestorsOf(rowId).includes(possibleAncestor);
  }

  /** Ancestors of a projected row, nearest last. Empty for a root. */
  private ancestorsOf(rowId: string): readonly string[] {
    this.leafIndex();
    return this.cachedAncestors?.get(rowId) ?? [];
  }

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

  private canSelect(rowId: string, meta: Readonly<Record<string, unknown>>): boolean {
    return this.selection?.canSelect(rowId, meta) ?? true;
  }

  private invalidateIndex(): void {
    this.cachedRows = undefined;
    this.cachedLeaves = undefined;
    this.cachedAncestors = undefined;
  }

  /**
   * Maps every projected row to the selectable leaves beneath it.
   *
   * Built from `meta.depth` alone, in one pass over the projection, and cached
   * against the projection's identity — the projection is a memoised signal, so
   * an unchanged one is the same array and the index survives ticks untouched.
   */
  private leafIndex(): Map<string, readonly string[]> {
    const rows = this.selection?.projectedRows() ?? [];
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

    if (this.groupSelectsChildren) {
      for (const [rowId, ids] of leaves) {
        // Only a row standing for others is worth remembering; a leaf stands for
        // itself in every projection.
        if (ids.length > 1 || (ids.length === 1 && ids[0] !== rowId)) {
          this.rememberedLeaves.set(rowId, ids);
        }
      }
    }

    this.cachedRows = rows;
    this.cachedLeaves = leaves;
    this.cachedAncestors = ancestors;
    return leaves;
  }
}
