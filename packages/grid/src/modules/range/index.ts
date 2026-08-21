export { RangeModule, RANGE_EVENTS } from './range-module.js';
export type { CellRangeDetail, RangeModuleOptions } from './range-module.js';
export type { CellRange, RangeBounds } from './range-model.js';

import { RANGE_EVENTS } from './range-module.js';
import type { CellRangeDetail } from './range-module.js';

declare module '../../api/types.js' {
  interface GridApi<TData> {
    /** The selected rectangle, as store ids and column ids. Null when there is none. */
    getCellRange(): CellRangeDetail | null;
    clearCellRange(): void;
  }
}

declare module '../../api/events.js' {
  interface GridEventMap {
    [RANGE_EVENTS.CHANGED]: CustomEvent<CellRangeDetail | null>;
  }
}
