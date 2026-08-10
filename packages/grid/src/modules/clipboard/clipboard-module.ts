import { formatCellValue } from '../../columns/resolve-columns.js';
import type { ResolvedColumn } from '../../columns/types.js';
import type { GridModule, ModuleContext } from '../types.js';

/**
 * What "copy" means, when it is not simply everything.
 *
 * Defaults are chosen so that what lands in a spreadsheet matches what is on
 * the screen: the projection rather than the underlying data, so a filter and a
 * sort are respected, and each cell through its own `valueFormatter`, so a
 * price copies as the three decimal places it was displayed with rather than as
 * a float.
 */
export interface ExportOptions {
  /**
   * `selected` copies the selected rows, `all` the whole projection.
   *
   * Defaults to `selected` when a module reports a selection and something is
   * selected, and to `all` otherwise — so Ctrl-C does the obvious thing whether
   * or not anything is picked out.
   */
  rows?: 'selected' | 'all';
  /** Column ids to include, in this order. Defaults to every visible column. */
  columns?: readonly string[];
  /** Prepend the column headings. On by default. */
  includeHeaders?: boolean;
  /** Between fields. A comma for a file, a tab for the clipboard. */
  delimiter?: string;
}

export interface ClipboardModuleOptions {
  /**
   * Bind Ctrl-C, and Cmd-C on macOS. On by default.
   *
   * Turn it off to drive copying from the api alone — a toolbar button, say —
   * without the grid claiming a key the application may want.
   */
  copyOnKeyboard?: boolean;
  /**
   * Columns never copied, whatever else is asked for.
   *
   * Defaults to the selection checkbox column, which is a control rather than
   * data and would otherwise paste as a column of blanks.
   */
  excludeColumns?: readonly string[];
}

/** A module that can say which rows are selected. Declared, not reached into. */
interface SelectedRowsProvider {
  provideSelectedRowIds(): readonly string[];
}

const providesSelectedRows = <T>(module: T): module is T & SelectedRowsProvider =>
  typeof (module as Partial<SelectedRowsProvider>).provideSelectedRowIds === 'function';

/** Columns that hold controls rather than values. */
const DEFAULT_EXCLUDED = ['ls-grid-selection'];

/**
 * Getting data out of the grid, as text.
 *
 * Deliberately read-only: it consumes the projection and the value pipeline and
 * changes nothing, which is why it needs no cooperation from the layout, focus
 * or the tick path. It composes with selection if a module provides one and
 * works perfectly well without.
 *
 * Tab-separated for the clipboard, because that is what a spreadsheet pastes
 * natively; comma-separated for a file, because that is what one expects to be
 * handed.
 */
export class ClipboardModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'clipboard';

  private context?: ModuleContext<TData>;

  constructor(private options: ClipboardModuleOptions = {}) {}

  setOptions(next: Partial<ClipboardModuleOptions>): void {
    this.options = { ...this.options, ...next };
  }

  init(context: ModuleContext<TData>): void {
    this.context = context;
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (this.options.copyOnKeyboard === false) return false;
    if (event.key !== 'c' && event.key !== 'C') return false;
    if (!event.ctrlKey && !event.metaKey) return false;
    // Not ours if the user is copying text out of a filter input or a cell
    // editor: they mean the text they selected, not the grid.
    if (isEditable(event.composedPath()[0])) return false;

    void this.copy();
    return true;
  }

  /** Serialises to text without touching the clipboard. */
  toDelimitedText(options: ExportOptions = {}): string {
    const context = this.context;
    if (!context) return '';

    const delimiter = options.delimiter ?? ',';
    const columns = this.columnsFor(options);
    const rows = this.rowsFor(options);

    const lines: string[][] = [];
    if (options.includeHeaders !== false) {
      lines.push(columns.map((column) => column.headerName ?? column.colId));
    }
    for (const rowId of rows) {
      const node = context.pipeline.store.getRowNode(rowId);
      if (!node) continue;
      lines.push(columns.map((column) => formatCellValue(column, node)));
    }

    return lines
      .map((line) => line.map((field) => escape(field, delimiter)).join(delimiter))
      .join('\n');
  }

  /**
   * Writes to the system clipboard, tab-separated.
   *
   * Resolves false rather than throwing when the clipboard is unavailable —
   * an insecure context, or permission refused — because a copy that did not
   * happen is worth reporting but is not an error the grid can do anything
   * about.
   */
  async copy(options: ExportOptions = {}): Promise<boolean> {
    const text = this.toDelimitedText({ delimiter: '\t', ...options });
    if (!text) return false;

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  apiExtension(): Record<string, unknown> {
    return {
      getDataAsCsv: (options?: ExportOptions) =>
        this.toDelimitedText({ delimiter: ',', ...options }),
      getDataAsTsv: (options?: ExportOptions) =>
        this.toDelimitedText({ delimiter: '\t', ...options }),
      copyToClipboard: (options?: ExportOptions) => this.copy(options),
    };
  }

  /** Visible columns, minus the controls, in the order asked for. */
  private columnsFor(options: ExportOptions): readonly ResolvedColumn<TData>[] {
    const all = this.context?.getColumns() ?? [];
    const excluded = new Set(this.options.excludeColumns ?? DEFAULT_EXCLUDED);

    if (!options.columns) return all.filter((column) => !excluded.has(column.colId));

    // Explicit order wins, and an unknown id is dropped rather than throwing:
    // a saved column list should not stop an export when a column has gone.
    return options.columns
      .map((colId) => all.find((column) => column.colId === colId))
      .filter((column): column is ResolvedColumn<TData> => column !== undefined);
  }

  /** Row ids to copy, in projection order. */
  private rowsFor(options: ExportOptions): readonly string[] {
    const projected = (this.context?.pipeline.projector.rows.get() ?? []).map((row) => row.rowId);

    if (options.rows === 'all') return projected;

    const selected = this.selectedRowIds();
    if (options.rows === 'selected') return ordered(projected, selected);

    // Unspecified: whatever is selected, or everything if nothing is.
    return selected.length > 0 ? ordered(projected, selected) : projected;
  }

  private selectedRowIds(): readonly string[] {
    const providers = (this.context?.getModules() ?? []).filter(providesSelectedRows);
    return providers.flatMap((module) => module.provideSelectedRowIds());
  }
}

/**
 * Selected rows in the order they appear, not the order they were clicked.
 *
 * Pasting a block that runs bottom to top because that is how it was
 * ctrl-clicked would be its own small betrayal.
 */
function ordered(projected: readonly string[], selected: readonly string[]): readonly string[] {
  const wanted = new Set(selected);
  return projected.filter((rowId) => wanted.has(rowId));
}

/** Quotes a field only when it would otherwise break the row. */
function escape(field: string, delimiter: string): string {
  if (!field.includes(delimiter) && !field.includes('"') && !/[\n\r]/.test(field)) return field;
  return `"${field.replaceAll('"', '""')}"`;
}

function isEditable(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}
