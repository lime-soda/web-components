export { CellFlashModule } from './cell-flash-module.js';
export type { CellFlashModuleOptions, FlashDirection } from './cell-flash-module.js';

/** Column options this module adds. They exist only when it is imported. */
declare module '../../columns/types.js' {
  interface ColumnDef<TData, TValue> {
    /** Set false to stop this column flashing. Useful when a renderer animates itself. */
    enableCellFlash?: boolean;
  }
}
