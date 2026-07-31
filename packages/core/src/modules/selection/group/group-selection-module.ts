import type { DisplayRow } from '../../../layout/types.js';
import type { RowNode } from '../../../store/types.js';
import type { GridModule, ModuleContext } from '../../types.js';
import type { SelectionMembership } from '../membership.js';
import type { SelectionModule } from '../selection-module.js';

/** What a group row stands for when it is selected. */
export type GroupSelectionScope =
  /**
   * The group row alone, standing for nothing but itself. Suits a grid whose
   * group rows are real records rather than headings — the module is still
   * worth having, because it is what makes a group selectable at all under a
   * hierarchy.
   */
  | 'self'
  /**
   * Every descendant in the data, including rows the current filter has hidden.
   * Ticking a category means the category, whatever happens to be on screen.
   *
   * Requires `getParentId`: hidden rows are absent from the projection
   * entirely, so the hierarchy has to be read from the data itself.
   */
  | 'children'
  /**
   * The descendants currently projected — filtered, sorted, and with collapsed
   * groups standing for their contents. Ticking a category selects what the
   * filter left of it, which is what a trader building a basket from a filtered
   * book means by it.
   */
  | 'filteredChildren';

export interface GroupSelectionModuleOptions<TData = unknown> {
  /**
   * What a group row stands for. Defaults to `filteredChildren`.
   *
   * The default is the conservative one: it can only ever select rows the user
   * can see, so a filtered view cannot quietly put hidden rows in a basket.
   */
  scope?: GroupSelectionScope;

  /**
   * A row's parent, for `children`.
   *
   * Comes from the consumer for the same reason the rest of this module reads
   * the projection rather than the tree module: only the application knows how
   * its rows relate. Returning `null` marks a root.
   */
  getParentId?: ((data: TData, rowId: string) => string | null | undefined) | undefined;
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

  private cachedStoreRows: readonly RowNode<TData>[] | undefined;
  private cachedStore:
    | {
        parents: Map<string, string>;
        children: Map<string, string[]>;
        allLeaves: readonly string[];
      }
    | undefined;

  /**
   * Group membership seen at any point, kept across projections.
   *
   * A collapsed group's children are absent from the projection, so without
   * this a group selected while expanded would read as unselected the moment it
   * was collapsed. Pruned when rows leave the store.
   */
  private readonly rememberedLeaves = new Map<string, readonly string[]>();

  constructor(private options: GroupSelectionModuleOptions<TData> = {}) {}

  setOptions(next: Partial<GroupSelectionModuleOptions<TData>>): void {
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

  private get scope(): GroupSelectionScope {
    return this.options.scope ?? 'filteredChildren';
  }

  /** Whether a group stands for anything beyond itself. */
  private get standsForChildren(): boolean {
    return this.scope !== 'self';
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
    if (this.scope === 'children') return this.storeLeavesOf(rowId);

    const projected = this.selectableLeavesOf(rowId);
    // With groups standing alone, no row ever stands for another, so remembered
    // membership is not just unnecessary — consulting it would resurrect the
    // other mode's behaviour after a switch.
    if (!this.standsForChildren) return projected;

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
    if (!this.standsForChildren) return false;
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
    if (!this.standsForChildren) return;
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

  /** Ancestors of a row, nearest last. Empty for a root. */
  private ancestorsOf(rowId: string): readonly string[] {
    // Under `children` the chain has to come from the data too: a row hidden by
    // the filter has no projected chain, and would otherwise look like a root.
    if (this.scope === 'children') return this.storeAncestorsOf(rowId);

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
    if (this.scope === 'children') return this.storeIndex().allLeaves;

    const ids = new Set<string>();
    for (const rowId of this.leafIndex().keys()) {
      for (const leaf of this.membershipOf(rowId)) ids.add(leaf);
    }
    return [...ids];
  }

  private canSelect(rowId: string, meta: Readonly<Record<string, unknown>>): boolean {
    return this.selection?.canSelect(rowId, meta) ?? true;
  }

  // -- The data's own hierarchy, for `children` -------------------------------

  /**
   * Parents and leaves as the *data* has them, ignoring the projection.
   *
   * `children` has to reach rows the filter removed, and those are not in the
   * projection at all — there is nothing there to read a depth or an ancestor
   * chain from. So the relationship comes from `getParentId` over the store.
   *
   * Cached against the store's row array, which is itself memoised on the
   * structural version: an unchanged store is the same array, so this survives
   * ticks untouched exactly as the projected index does.
   */
  private storeIndex(): {
    parents: Map<string, string>;
    children: Map<string, string[]>;
    allLeaves: readonly string[];
  } {
    const rows = this.context?.pipeline.store.rows.get() ?? [];
    if (this.cachedStoreRows === rows && this.cachedStore) return this.cachedStore;

    const parents = new Map<string, string>();
    const children = new Map<string, string[]>();
    const getParentId = this.options.getParentId;

    if (getParentId) {
      for (const row of rows) {
        const parentId = getParentId(row.data, row.id);
        if (parentId === null || parentId === undefined) continue;
        parents.set(row.id, parentId);
        const siblings = children.get(parentId);
        if (siblings) siblings.push(row.id);
        else children.set(parentId, [row.id]);
      }
    }

    // A leaf is a row nothing else names as its parent.
    const allLeaves = rows
      .filter((row) => !children.has(row.id) && this.canSelect(row.id, {}))
      .map((row) => row.id);

    const index = { parents, children, allLeaves };
    this.cachedStoreRows = rows;
    this.cachedStore = index;
    return index;
  }

  /** Every selectable leaf beneath a row in the data. A leaf stands for itself. */
  private storeLeavesOf(rowId: string): readonly string[] {
    const { children } = this.storeIndex();
    if (!children.has(rowId)) return this.canSelect(rowId, {}) ? [rowId] : [];

    const leaves: string[] = [];
    const stack = [...(children.get(rowId) ?? [])];
    const seen = new Set<string>([rowId]);

    while (stack.length > 0) {
      const id = stack.pop()!;
      // A cycle in consumer-supplied parents would otherwise never terminate.
      if (seen.has(id)) continue;
      seen.add(id);

      const below = children.get(id);
      if (below) stack.push(...below);
      else if (this.canSelect(id, {})) leaves.push(id);
    }
    return leaves;
  }

  private storeAncestorsOf(rowId: string): readonly string[] {
    const { parents } = this.storeIndex();
    const chain: string[] = [];
    const seen = new Set<string>([rowId]);

    let current = parents.get(rowId);
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      // Nearest last, matching the projected chain's order.
      chain.unshift(current);
      current = parents.get(current);
    }
    return chain;
  }

  private invalidateIndex(): void {
    this.cachedStoreRows = undefined;
    this.cachedStore = undefined;
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

    if (this.standsForChildren) {
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

    if (this.standsForChildren) {
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
