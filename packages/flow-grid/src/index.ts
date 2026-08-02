// Element classes, types and helpers — and nothing else. This entry has no
// side effects: it registers no elements and provides no layout, so importing a
// type or subclassing an element cannot put a grid in the custom element
// registry as a consequence.
//
// A grid comes from one of the entry points that provides one:
//   flow-grid/define  both layouts, switchable at runtime
//   flow-grid/flow    the horizontal layout alone
//   flow-grid/stack   the vertical layout alone
export { defineElements, defineElement, ELEMENTS } from './define-elements.js';

export { FlowGrid } from './components/grid.js';
export { FlowInstance } from './components/instance.js';
export { FlowRow } from './components/row.js';
export { FlowCell } from './components/cell.js';
export { FlowHeaderCell } from './components/header-cell.js';
export { CellRendererElement } from './components/cell-renderer-element.js';

// Theming: a validated token object, or the same tokens as CSS custom properties.
export {
  THEME_TOKENS,
  customPropertyFor,
  validateTheme,
  assertValidTheme,
  themeToCustomProperties,
} from './theme/index.js';
export type { GridTheme, ThemeToken, ThemeValidationIssue } from './theme/index.js';

// Contexts — how a custom cell renderer reaches its row and column.
export {
  gridContext,
  instanceContext,
  rowContext,
  columnContext,
  RowContextValue,
} from './context/index.js';

// Controller and options.
export { GridController } from './controller/grid-controller.js';
export type { GridOptions, LayoutMode } from './controller/grid-controller.js';

// Columns.
export { resolveColumns, getCellValue, formatCellValue } from './columns/resolve-columns.js';
export type {
  ColumnDef,
  ColumnDefs,
  ResolvedColumn,
  ColumnResolutionOptions,
  CellRendererFn,
  ValueGetterParams,
  ValueFormatterParams,
} from './columns/types.js';

// Data.
export { RowStore } from './store/row-store.js';
export type { RowNode, RowTransaction, TransactionResult } from './store/types.js';

// Layout. The classes are here; which of them a grid can actually use follows
// from the entry point that registered it.
export { registerLayoutEngine, createLayoutEngine } from './layout/engine-registry.js';
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
export { signal, computed, SignalWatcher } from './reactive/index.js';
export type { ReadableSignal, WritableSignal } from './reactive/index.js';
