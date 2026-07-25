import type { GridApi } from './types.js';
import type { TransactionResult } from '../store/types.js';

export const GRID_EVENTS = {
  READY: 'fg-grid-ready',
  DATA_CHANGED: 'fg-data-changed',
  LAYOUT_CHANGED: 'fg-layout-changed',
} as const;

export interface GridReadyDetail<TData = unknown> {
  api: GridApi<TData>;
}

export interface DataChangedDetail {
  result: TransactionResult;
}

export interface LayoutChangedDetail {
  instanceCount: number;
  truncated: boolean;
}

/**
 * Event names to detail types.
 *
 * Modules augment this the same way they augment {@link GridApi}, so
 * `addEventListener` infers `detail` for module events only when that module is
 * imported.
 */
export interface GridEventMap {
  [GRID_EVENTS.READY]: CustomEvent<GridReadyDetail>;
  [GRID_EVENTS.DATA_CHANGED]: CustomEvent<DataChangedDetail>;
  [GRID_EVENTS.LAYOUT_CHANGED]: CustomEvent<LayoutChangedDetail>;
}
