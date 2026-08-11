export { ClipboardModule } from './clipboard-module.js';
export type { ClipboardModuleOptions, ExportOptions } from './clipboard-module.js';

import type { ExportOptions } from './clipboard-module.js';

/** Api methods this module adds. They exist only when it is imported. */
declare module '../../api/types.js' {
  interface GridApi<TData> {
    /** The grid as comma-separated text, formatted as it appears on screen. */
    getDataAsCsv(options?: ExportOptions): string;
    /** The same, tab-separated — what a spreadsheet pastes natively. */
    getDataAsTsv(options?: ExportOptions): string;
    /** Writes to the system clipboard. False when the clipboard refused. */
    copyToClipboard(options?: ExportOptions): Promise<boolean>;
  }
}
