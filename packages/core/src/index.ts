// Custom elements. Importing the package registers them.
import './components/fg-grid.js';
import './components/fg-instance.js';
import './components/fg-row.js';
import './components/fg-cell.js';
import './components/fg-header-cell.js';

export { FgGrid } from './components/fg-grid.js';
export { FgInstance } from './components/fg-instance.js';
export { FgRow } from './components/fg-row.js';
export { FgCell } from './components/fg-cell.js';
export { FgHeaderCell } from './components/fg-header-cell.js';
export { CellRendererElement } from './components/cell-renderer-element.js';

// Contexts — how a custom cell renderer reaches its row and column.
export { gridContext, instanceContext, rowContext, columnContext, RowContextValue } from './context/index.js';

// Controller and options.
export { GridController } from './controller/grid-controller.js';
export type { GridOptions, LayoutMode } from './controller/grid-controller.js';

// Columns.
export { resolveColumns, getCellValue, formatCellValue } from './columns/resolve-columns.js';
export type {
  ColumnDef,
  ResolvedColumn,
  ColumnResolutionOptions,
  CellRendererFn,
  ValueGetterParams,
  ValueFormatterParams,
} from './columns/types.js';

// Data.
export { RowStore } from './store/row-store.js';
export type { RowNode, RowTransaction, TransactionResult } from './store/types.js';

// Layout.
export { FlowLayoutEngine } from './layout/flow-layout-engine.js';
export { StackLayoutEngine } from './layout/stack-layout-engine.js';
export type {
  DisplayRow,
  LayoutEngine,
  LayoutInstance,
  LayoutResult,
  ViewportMetrics,
} from './layout/types.js';

// Projection — the seam modules plug into.
export { RowProjector } from './projection/row-projector.js';
export { PHASE_ORDER } from './projection/types.js';
export type { ProjectionStage, StageContext, StagePhase } from './projection/types.js';

// Modules.
export { ModuleRegistry } from './modules/module-registry.js';
export type {
  GridModule,
  ModuleContext,
  CellContext,
  CellDecoration,
  RowContextInfo,
  RowDecoration,
  HeaderSlotContext,
} from './modules/types.js';

// Pipeline and virtualisation.
export { GridPipeline } from './pipeline/grid-pipeline.js';
export { InstanceVirtualizer } from './virtualize/instance-virtualizer.js';

// API and events.
export type { GridApi } from './api/types.js';
export { GRID_EVENTS } from './api/events.js';
export type {
  GridEventMap,
  GridReadyDetail,
  DataChangedDetail,
  LayoutChangedDetail,
} from './api/events.js';

// Reactivity — exported so modules and renderers can hold their own signals.
export { signal, computed, SignalWatcher, watch } from './reactive/index.js';
export type { ReadableSignal, WritableSignal } from './reactive/index.js';
