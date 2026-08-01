import type { DisplayRow } from '../../../layout/types.js';
import type { RowNode } from '../../../store/types.js';
import type { GridModule, ModuleContext } from '../../types.js';
import type { SelectionMembership } from '../membership.js';
import type { SelectionModule } from '../selection-module.js';

/** What a parent row stands for when it is selected. */
export type TreeSelectionScope =
  /**
   * The row alone, standing for nothing but itself — the same answer core
   * selection gives on its own. Useful as a runtime toggle when parents are
   * real records rather than headings; installing nothing at all is the same
   * thing said statically.
   */
  | 'self'
  /**
   * Every descendant in the data, including rows the current filter has hidden.
   * Ticking a category means the category, whatever happens to be on screen.
   */
  | 'children'
  /**
   * Every descendant that passed the filter, drawn or not. Ticking a category
   * selects what the filter left of it, which is what a trader building a
   * basket from a filtered book means by it.
   */
  | 'filteredChildren';

export interface TreeSelectionModuleOptions<TData = unknown> {
  /**
   * A row's parent. Returning `null` marks a root.
   *
   * Required, and the module's only source of hierarchy. Reading it from the
   * projection instead was possible but wrong in a way that looked right: the
   * projection hides rows the filter excluded *and* rows a collapsed parent is
   * not drawing, and only the first were excluded by anything. A parent
   * collapsed before it had ever been opened therefore stood only for itself.
   *
   * Coming from the consumer for the same reason as everything else here: only
   * the application knows how its rows relate.
   */
  getParentId: (data: TData, rowId: string) => string | null | undefined;

  /**
   * What a parent stands for. Defaults to `filteredChildren`.
   *
   * The conservative one: it can only ever select rows the user could reach by
   * clearing the filter, so a filtered view cannot quietly put excluded rows in
   * a basket.
   */
  scope?: TreeSelectionScope;
}

interface StoreHierarchy {
  readonly parents: ReadonlyMap<string, string>;
  readonly children: ReadonlyMap<string, readonly string[]>;
  /** Rows nothing else names as its parent. */
  readonly leafIds: readonly string[];
}

/**
 * Makes selection understand **tree data**.
 *
 * Core selection holds a flat set of row ids. This supplies it with a
 * {@link SelectionMembership} in which a parent stands for the rows beneath it,
 * so ticking a category selects its instruments, a partly selected category
 * reads as indeterminate, and `getSelectedRows()` returns instruments rather
 * than the headings above them.
 *
 * Tree data, specifically, and not grouped rows. Every row here is a record in
 * the store with an id of its own — the parent is one of them, which is why
 * `getParentId` maps a record to another record and why a parent can be
 * selected, remembered and reported like any other row. Rows produced by
 * *grouping* are synthetic: they stand for an aggregate that was never in the
 * store, have no id to remember, and their membership follows from the grouping
 * key rather than from a parent. That is a different module.
 *
 * The hierarchy is read from the data and never from the screen. What is *on*
 * the screen decides only two things: whether a row passed the filter, and what
 * `meta` an `isSelectable` predicate is shown. It does not require `TreeModule`,
 * though it pairs with it.
 */
export class TreeSelectionModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'selection-tree';
  readonly dependsOn = ['selection'];

  private context?: ModuleContext<TData>;
  private selection?: SelectionModule<TData>;

  /**
   * The rows that passed the filter, as opposed to the rows on screen.
   *
   * `undefined` until the projection has run once, which is not the same as
   * empty — an empty set is a filter that matched nothing.
   */
  private filtered: ReadonlySet<string> | undefined;

  private cachedStoreRows: readonly RowNode<TData>[] | undefined;
  private cachedHierarchy: StoreHierarchy | undefined;

  private cachedProjection: readonly DisplayRow[] | undefined;
  private cachedMeta: Map<string, Readonly<Record<string, unknown>>> | undefined;

  constructor(private options: TreeSelectionModuleOptions<TData>) {}

  setOptions(next: Partial<TreeSelectionModuleOptions<TData>>): void {
    this.options = { ...this.options, ...next };
    // The hierarchy is derived from the options, so it must not survive them.
    this.cachedStoreRows = undefined;
    this.cachedHierarchy = undefined;
    this.context?.invalidate();
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
    const selection = context.getModule<SelectionModule<TData>>('selection');
    // `dependsOn` is asserted by the registry, so this is a type narrowing
    // rather than a real possibility.
    if (!selection) return;
    this.selection = selection;

    context.addTeardown(selection.setMembership(this.membership()));

    // A pass-through in the sort phase, which runs after filtering and before
    // anything collapses: its input is exactly the rows that passed the filter,
    // still flat. That is the difference between "excluded" and "not drawn",
    // which the projection alone cannot tell apart.
    context.addStage({
      id: 'selection-tree-filtered',
      phase: 'sort',
      run: (rows) => {
        this.filtered = new Set(rows.map((row) => row.id));
        return rows;
      },
    });
  }

  private get scope(): TreeSelectionScope {
    return this.options.scope ?? 'filteredChildren';
  }

  /** Whether a parent stands for anything beyond itself. */
  private get standsForChildren(): boolean {
    return this.scope !== 'self';
  }

  private membership(): SelectionMembership {
    return {
      leavesOf: (rowId) => this.leavesOf(rowId),
      allLeaves: () => this.allLeaves(),
      covers: (rowId, selected) => this.covers(rowId, selected),
      withdraw: (rowId, selected) => this.withdraw(rowId, selected),
    };
  }

  // -- Membership -------------------------------------------------------------

  private leavesOf(rowId: string): readonly string[] {
    if (!this.standsForChildren) return this.selectable(rowId) ? [rowId] : [];

    const leaves = this.descendantLeavesOf(rowId);
    return this.scope === 'children' ? leaves : this.keepFiltered(leaves);
  }

  private allLeaves(): readonly string[] {
    if (!this.standsForChildren) {
      // Every row stands for itself, so select-all reaches what is on screen.
      const rows = this.selection?.projectedRows() ?? [];
      return rows.map((row) => row.rowId).filter((rowId) => this.selectable(rowId));
    }

    const leaves = this.hierarchy().leafIds.filter((rowId) => this.selectable(rowId));
    return this.scope === 'children' ? leaves : this.keepFiltered(leaves);
  }

  /**
   * Whether a row is selected in its own right or through an ancestor.
   *
   * Selecting a parent records the leaves beneath it, so this is normally the
   * first branch. The walk upwards matters when the set was restored from
   * outside — `setState` with a parent id in it, say.
   */
  private covers(rowId: string, selected: ReadonlySet<string>): boolean {
    if (selected.has(rowId)) return true;
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
      for (const leaf of this.leavesOf(ancestor)) {
        if (leaf !== rowId && !this.isDescendantOf(leaf, rowId)) selected.add(leaf);
      }
    }
  }

  private isDescendantOf(rowId: string, possibleAncestor: string): boolean {
    return this.ancestorsOf(rowId).includes(possibleAncestor);
  }

  private keepFiltered(ids: readonly string[]): readonly string[] {
    const filtered = this.filtered;
    // Before the first projection nothing is known about the filter, which is
    // not the same as a filter that excluded everything.
    if (filtered === undefined) return ids;
    return ids.filter((id) => filtered.has(id));
  }

  // -- The data's own hierarchy ------------------------------------------------

  /**
   * Parents and children as the data has them.
   *
   * Cached against the store's row array, which is memoised on the structural
   * version: an unchanged store is the same array, so this survives ticks
   * untouched.
   */
  private hierarchy(): StoreHierarchy {
    const rows = this.context?.pipeline.store.rows.get() ?? [];
    if (this.cachedStoreRows === rows && this.cachedHierarchy) return this.cachedHierarchy;

    const parents = new Map<string, string>();
    const children = new Map<string, string[]>();

    for (const row of rows) {
      const parentId = this.options.getParentId(row.data, row.id);
      if (parentId === null || parentId === undefined) continue;
      parents.set(row.id, parentId);
      const siblings = children.get(parentId);
      if (siblings) siblings.push(row.id);
      else children.set(parentId, [row.id]);
    }

    const hierarchy: StoreHierarchy = {
      parents,
      children,
      leafIds: rows.filter((row) => !children.has(row.id)).map((row) => row.id),
    };
    this.cachedStoreRows = rows;
    this.cachedHierarchy = hierarchy;
    return hierarchy;
  }

  /**
   * Every selectable leaf beneath a row, in the order the data has them. A leaf
   * stands for itself.
   *
   * Depth-first and in order, so `getSelectedRows()` comes back in an order a
   * reader can follow rather than in whatever order a traversal happened to
   * pop.
   */
  private descendantLeavesOf(rowId: string): readonly string[] {
    const { children } = this.hierarchy();
    const leaves: string[] = [];
    // A cycle in consumer-supplied parents would otherwise never terminate.
    const seen = new Set<string>();

    const walk = (id: string): void => {
      if (seen.has(id)) return;
      seen.add(id);

      const below = children.get(id);
      if (!below) {
        if (this.selectable(id)) leaves.push(id);
        return;
      }
      for (const child of below) walk(child);
    };

    walk(rowId);
    return leaves;
  }

  /** Ancestors of a row, nearest last. Empty for a root. */
  private ancestorsOf(rowId: string): readonly string[] {
    const { parents } = this.hierarchy();
    const chain: string[] = [];
    const seen = new Set<string>([rowId]);

    let current = parents.get(rowId);
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      chain.unshift(current);
      current = parents.get(current);
    }
    return chain;
  }

  // -- Selectability -----------------------------------------------------------

  private selectable(rowId: string): boolean {
    return this.selection?.canSelect(rowId, this.metaFor(rowId)) ?? true;
  }

  /**
   * The projected `meta` for a row, for an `isSelectable` predicate to read.
   *
   * Only rows on screen have any: one hidden behind a collapsed parent is still
   * a real row with a real place in the hierarchy, but nothing has decorated it,
   * so a predicate sees an empty object rather than a stale one.
   */
  private metaFor(rowId: string): Readonly<Record<string, unknown>> {
    const rows = this.selection?.projectedRows() ?? [];
    if (this.cachedProjection !== rows || !this.cachedMeta) {
      const meta = new Map<string, Readonly<Record<string, unknown>>>();
      for (const row of rows) meta.set(row.rowId, row.meta ?? {});
      this.cachedProjection = rows;
      this.cachedMeta = meta;
    }
    return this.cachedMeta.get(rowId) ?? {};
  }
}
