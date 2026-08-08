import type { DisplayRow } from '../layout/types.js';
import type { RowStore } from '../store/row-store.js';

/**
 * Phases run in a fixed order, so a module never has to reason about what other
 * modules registered first. Filter and sort operate on the flat row list; the tree
 * module's `expand` stage then groups and flattens it, preserving sibling order.
 * That ordering is precisely what lets sort and filter stay hierarchy-blind while
 * still producing a correctly sorted, correctly filtered tree.
 */
export type StagePhase = 'filter' | 'sort' | 'expand' | 'decorate';

export const PHASE_ORDER: readonly StagePhase[] = ['filter', 'sort', 'expand', 'decorate'];

export interface StageContext<TData = unknown> {
  readonly store: RowStore<TData>;
}

export interface ProjectionStage<TData = unknown> {
  readonly id: string;
  readonly phase: StagePhase;
  /**
   * Data fields whose change should re-run this stage, or `'*'` for any change.
   * Omitted means value changes never re-run it.
   *
   * Read fresh on every transaction, so a module may expose it as a getter that
   * tracks its live config — a sort module returns its active sort keys.
   */
  readonly dependsOn?: ReadonlySet<string> | '*' | undefined;
  run(rows: readonly DisplayRow[], ctx: StageContext<TData>): readonly DisplayRow[];
}
