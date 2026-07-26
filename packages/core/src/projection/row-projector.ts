import type { DisplayRow } from '../layout/types.js';
import { type ReadableSignal, Version, computed } from '../reactive/index.js';
import type { RowStore } from '../store/row-store.js';
import { PHASE_ORDER, type ProjectionStage, type StageContext } from './types.js';

/**
 * Turns stored rows into the display rows the layout engine consumes, by running
 * module-contributed stages in a fixed phase order.
 *
 * With no modules registered this is the identity map — which is what "minimal
 * core" means in practice: a grid with nothing imported still works, it just shows
 * rows in insertion order.
 *
 * The result is a memoised computed. It re-runs on structural change, on an
 * explicit {@link invalidate} from a module whose config changed, and on a value
 * change only when some stage declared a dependency on a field that actually
 * changed. Everything else — the overwhelming majority of traffic on a live desk —
 * skips it entirely.
 */
export class RowProjector<TData = unknown> {
  private readonly stages: ProjectionStage<TData>[] = [];
  private readonly configVersion = new Version();
  private readonly dataVersion = new Version();
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  private readonly context: StageContext<TData>;

  readonly rows: ReadableSignal<readonly DisplayRow[]>;

  constructor(private readonly store: RowStore<TData>) {
    this.context = { store };

    this.rows = computed(() => {
      this.store.structuralVersion.get();
      this.configVersion.get();
      this.dataVersion.get();
      return this.project();
    });

    this.unsubscribe = store.subscribe((result) => {
      // Both checks always run. Notifications are coalesced, so one delivery can
      // report a structural change *and* a value change at once — common on a
      // live feed, where a tick lands in the same batch as an add. Returning
      // early on `structural` would drop the value invalidation and leave a sort
      // stale against data that had already moved.
      const valuesMatter = this.someStageDependsOn(result.fieldsChanged);
      if (valuesMatter) this.dataVersion.bump();
      if (result.structural || valuesMatter) this.notify();
    });
  }

  /** Registers a stage. The returned function removes it again. */
  addStage(stage: ProjectionStage<TData>): () => void {
    this.stages.push(stage);
    this.invalidate();

    return () => {
      const index = this.stages.indexOf(stage);
      if (index === -1) return;
      this.stages.splice(index, 1);
      this.invalidate();
    };
  }

  /** Forces a re-projection. Modules call this when their own config changes. */
  invalidate(): void {
    this.configVersion.bump();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.unsubscribe();
    this.listeners.clear();
    this.stages.length = 0;
  }

  private project(): readonly DisplayRow[] {
    let rows: readonly DisplayRow[] = this.store.rows.get().map((node) => ({
      id: node.id,
      rowId: node.id,
    }));

    for (const stage of this.orderedStages()) {
      rows = stage.run(rows, this.context);
    }

    return rows;
  }

  private orderedStages(): readonly ProjectionStage<TData>[] {
    // Sorting by phase index keeps registration order stable within a phase,
    // because Array#sort is specified as stable.
    return [...this.stages].sort(
      (a, b) => PHASE_ORDER.indexOf(a.phase) - PHASE_ORDER.indexOf(b.phase),
    );
  }

  private someStageDependsOn(fieldsChanged: ReadonlySet<string>): boolean {
    if (fieldsChanged.size === 0) return false;

    return this.stages.some((stage) => {
      const dependsOn = stage.dependsOn;
      if (dependsOn === undefined) return false;
      if (dependsOn === '*') return true;
      // A row whose data is not a plain object reports '*' — treat it as "anything
      // may have changed" for stages that declare dependencies at all.
      if (fieldsChanged.has('*')) return true;
      for (const field of fieldsChanged) {
        if (dependsOn.has(field)) return true;
      }
      return false;
    });
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
