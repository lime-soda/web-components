import type { CoreGridApi, GridApi } from '../api/types.js';
import { resolveColumns } from '../columns/resolve-columns.js';
import type {
  ColumnDef,
  ColumnDefs,
  ColumnResolutionOptions,
  ResolvedColumn,
} from '../columns/types.js';
import type { FocusController } from './focus-controller.js';
import { FlowLayoutEngine } from '../layout/flow-layout-engine.js';
import { StackLayoutEngine } from '../layout/stack-layout-engine.js';
import type { LayoutResult, ViewportMetrics } from '../layout/types.js';
import { ModuleRegistry } from '../modules/module-registry.js';
import type { GridModule } from '../modules/types.js';
import { GridPipeline } from '../pipeline/grid-pipeline.js';
import { type ReadableSignal, type WritableSignal, computed, signal } from '../reactive/index.js';
import type { RowTransaction, TransactionResult } from '../store/types.js';

export type LayoutMode = 'flow' | 'stack';

export interface GridOptions<TData = unknown> extends ColumnResolutionOptions<TData> {
  columns: ColumnDefs<TData>;
  getRowId?: (data: TData) => string;
  modules?: readonly GridModule<TData>[];
  layout?: LayoutMode;
  rowHeight?: number;
  headerHeight?: number;
  instanceGap?: number;
  maxInstances?: number;
  /** Turns vertical wheel gestures into horizontal scrolling. Flow layout only. */
  enableScrollJacking?: boolean;
  ariaLabel?: string;
}

const DEFAULTS = {
  rowHeight: 32,
  headerHeight: 32,
  instanceGap: 16,
} as const;

/**
 * Everything a grid instance owns, independent of the DOM.
 *
 * `<tf-grid>` provides this on a context and reads from it at render time; keeping
 * it a plain object rather than an element is what lets the whole data path be
 * exercised without a browser.
 */
export class GridController<TData = unknown> {
  readonly pipeline: GridPipeline<TData>;
  readonly registry: ModuleRegistry<TData>;
  readonly api: GridApi<TData>;
  readonly columns: ReadableSignal<readonly ResolvedColumn<TData>[]>;

  private readonly optionsSignal: WritableSignal<GridOptions<TData>>;
  private readonly containerSignal: WritableSignal<{ width: number; height: number }>;
  private readonly dispatcher: (type: string, detail: unknown) => void;

  constructor(options: GridOptions<TData>, dispatch: (type: string, detail: unknown) => void) {
    this.dispatcher = dispatch;
    this.optionsSignal = signal(options);
    this.containerSignal = signal({ width: 0, height: 0 });

    this.pipeline = new GridPipeline<TData>({
      getRowId: options.getRowId ?? defaultGetRowId,
      engine: engineFor(options.layout ?? 'flow'),
    });

    this.registry = new ModuleRegistry<TData>({
      pipeline: this.pipeline,
      getColumns: () => this.columns.get(),
      dispatch,
    });

    this.columns = computed(() => {
      const current = this.optionsSignal.get();
      // Module columns lead: a selection checkbox belongs at the left edge, and a
      // consumer who wants otherwise can place it explicitly instead.
      const defs = [...this.registry.provideColumns(), ...current.columns];
      const resolution: ColumnResolutionOptions<TData> = {};
      if (current.defaultColDef !== undefined) resolution.defaultColDef = current.defaultColDef;
      if (current.columnTypes !== undefined) resolution.columnTypes = current.columnTypes;
      return resolveColumns<TData>(defs, resolution);
    });

    for (const module of options.modules ?? []) this.registry.register(module);
    this.registry.start();

    this.api = this.createApi();
    this.syncViewport();
  }

  /** Focus position and traversal. */
  get focus(): FocusController {
    return this.registry.focus;
  }

  get options(): GridOptions<TData> {
    return this.optionsSignal.get();
  }

  setOptions(next: Partial<GridOptions<TData>>): void {
    const merged = { ...this.optionsSignal.get(), ...next };
    this.optionsSignal.set(merged);
    if (next.layout !== undefined) this.pipeline.setEngine(engineFor(next.layout));
    this.syncViewport();
  }

  /** Called by the host's ResizeObserver. */
  setContainerSize(width: number, height: number): void {
    const current = this.containerSignal.get();
    if (current.width === width && current.height === height) return;
    this.containerSignal.set({ width, height });
    this.syncViewport();
  }

  get layout(): ReadableSignal<LayoutResult> {
    return this.pipeline.layout;
  }

  destroy(): void {
    this.registry.destroy();
    this.pipeline.destroy();
  }

  private syncViewport(): void {
    const options = this.optionsSignal.get();
    const container = this.containerSignal.get();
    const rowHeight = options.rowHeight ?? DEFAULTS.rowHeight;
    const headerHeight = options.headerHeight ?? DEFAULTS.headerHeight;

    const metrics: ViewportMetrics = {
      width: container.width,
      // Before the first measurement, fall back to a viewport-ish height so the
      // grid produces a sensible first paint rather than one row per instance.
      height: container.height > 0 ? container.height : 600,
      rowHeight,
      headerHeight,
      instanceWidth: this.columns.get().reduce((total, column) => total + column.width, 0),
      instanceGap: options.instanceGap ?? DEFAULTS.instanceGap,
      ...(options.maxInstances === undefined ? {} : { maxInstances: options.maxInstances }),
    };

    this.pipeline.setViewport(metrics);
  }

  private createApi(): GridApi<TData> {
    const core: CoreGridApi<TData> = {
      applyTransaction: (transaction: RowTransaction<TData>): TransactionResult => {
        const result = this.pipeline.store.applyTransaction(transaction);
        this.dispatcher('tf-data-changed', { result });
        return result;
      },
      setRowData: (data) => {
        const result = this.pipeline.store.setRowData(data);
        this.dispatcher('tf-data-changed', { result });
        return result;
      },
      getRow: (id) => this.pipeline.store.getRow(id),
      getRowCount: () => this.pipeline.store.size,
      setColumnDefs: (columns) => this.setOptions({ columns }),
      getColumns: () => this.columns.get(),
      getLayout: () => this.pipeline.layout.get(),
      scrollToRow: (id) => this.dispatcher('tf-scroll-to-row', { id }),
      refresh: () => this.pipeline.projector.invalidate(),
      getModule: (id) => this.registry.get(id),
      getState: () => this.registry.getState(),
      setState: (state) => this.registry.setState(state),
    };

    // Module methods are merged in, never allowed to shadow a core method.
    const extensions = this.registry.apiExtensions();
    for (const [key, value] of Object.entries(extensions)) {
      if (key in core) {
        throw new Error(`A module tried to override the core GridApi method "${key}".`);
      }
      (core as unknown as Record<string, unknown>)[key] = value;
    }

    // The cast is the accepted cost of typing module methods by declaration
    // merging: whether they exist is a runtime fact about which modules were
    // registered, which the type system cannot express. Registering a module is
    // what makes its methods both present and typed.
    return core as GridApi<TData>;
  }
}

function engineFor(mode: LayoutMode) {
  return mode === 'stack' ? new StackLayoutEngine() : new FlowLayoutEngine();
}

function defaultGetRowId(data: unknown): string {
  const id = (data as { id?: unknown } | null)?.id;
  if (typeof id === 'string') return id;
  if (typeof id === 'number') return String(id);
  throw new Error(
    'Rows need an id. Give each row a string or number `id`, or pass a getRowId option.',
  );
}
