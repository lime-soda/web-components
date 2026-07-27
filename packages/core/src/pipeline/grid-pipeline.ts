import { FlowLayoutEngine } from '../layout/flow-layout-engine.js';
import type { LayoutEngine, LayoutResult, ViewportMetrics } from '../layout/types.js';
import { RowProjector } from '../projection/row-projector.js';
import type { ProjectionStage } from '../projection/types.js';
import { type ReadableSignal, type WritableSignal, computed, signal } from '../reactive/index.js';
import { RowStore, type RowStoreOptions } from '../store/row-store.js';

export interface GridPipelineOptions<TData> extends RowStoreOptions<TData> {
  engine?: LayoutEngine;
  viewport?: ViewportMetrics;
}

const NO_VIEWPORT: ViewportMetrics = {
  width: 0,
  height: 0,
  rowHeight: 32,
  headerHeight: 32,
  instanceWidth: 0,
  instanceGap: 0,
};

/**
 * Composes the read path: rows → projection → layout, all as memoised signals.
 *
 * Reading `layout` is the only thing `<tf-grid>` does at render time. Because each
 * step is a computed, work happens strictly on demand and strictly when an actual
 * dependency changed — a value tick invalidates neither the projection nor the
 * layout, so both are skipped and only the affected cells re-render.
 */
export class GridPipeline<TData = unknown> {
  readonly store: RowStore<TData>;
  readonly projector: RowProjector<TData>;
  readonly layout: ReadableSignal<LayoutResult>;

  private readonly viewportSignal: WritableSignal<ViewportMetrics>;
  private readonly engineSignal: WritableSignal<LayoutEngine>;

  constructor(options: GridPipelineOptions<TData>) {
    this.store = new RowStore<TData>({ getRowId: options.getRowId });
    this.projector = new RowProjector(this.store);
    this.viewportSignal = signal(options.viewport ?? NO_VIEWPORT);
    this.engineSignal = signal<LayoutEngine>(options.engine ?? new FlowLayoutEngine());

    this.layout = computed(() =>
      this.engineSignal.get().layout(this.projector.rows.get(), this.viewportSignal.get()),
    );
  }

  get viewport(): ViewportMetrics {
    return this.viewportSignal.get();
  }

  setViewport(metrics: ViewportMetrics): void {
    this.viewportSignal.set(metrics);
  }

  get engine(): LayoutEngine {
    return this.engineSignal.get();
  }

  setEngine(engine: LayoutEngine): void {
    this.engineSignal.set(engine);
  }

  addStage(stage: ProjectionStage<TData>): () => void {
    return this.projector.addStage(stage);
  }

  destroy(): void {
    this.projector.destroy();
  }
}
