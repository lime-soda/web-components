import type { TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { literal, html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { getCellValue } from '../../columns/resolve-columns.js';
import type { ColumnValueType, ResolvedColumn } from '../../columns/types.js';
import type { RowNode } from '../../store/types.js';
import type { CellContext, CellDecoration, GridModule, ModuleContext } from '../types.js';
import './editors.js';
import type { CellEditorElement } from './cell-editor-element.js';

/**
 * Which cell is open.
 *
 * Identified by store row rather than by display row: an edit has to survive a
 * re-projection — a tick arriving mid-edit re-runs nothing, but a sort or a
 * filter does — and a repeated ancestor is one row appearing twice, which
 * should not be two separately editable things.
 */
export interface EditingCell {
  readonly rowId: string;
  readonly colId: string;
}

export interface CellEditDetail {
  readonly rowId: string;
  readonly colId: string;
}

export interface CellEditStoppedDetail extends CellEditDetail {
  readonly committed: boolean;
}

export interface CellValueChangedDetail<TData = unknown> extends CellEditDetail {
  readonly oldValue: unknown;
  readonly newValue: unknown;
  readonly data: TData;
}

export const EDIT_EVENTS = {
  EDIT_STARTED: 'ls-grid-cell-edit-started',
  EDIT_STOPPED: 'ls-grid-cell-edit-stopped',
  VALUE_CHANGED: 'ls-grid-cell-value-changed',
} as const;

/**
 * A module that can say which cells are in the selected rectangle.
 *
 * Declared rather than imported, as the clipboard declares it too: a fill works
 * without a range module installed, on the focused cell alone.
 */
interface CellRangeProvider {
  provideCellRange(): { rowIds: readonly string[]; colIds: readonly string[] } | null;
}

const providesCellRange = <T>(module: T): module is T & CellRangeProvider =>
  typeof (module as Partial<CellRangeProvider>).provideCellRange === 'function';

/** One cell of a paste: where it goes, and the text that landed there. */
export interface PastedCell {
  readonly rowId: string;
  readonly colId: string;
  readonly text: string;
}

export interface EditableParams<TData = unknown> {
  readonly data: TData;
  readonly node: RowNode<TData>;
  readonly column: ResolvedColumn<TData>;
}

export interface ValueSetterParams<TData = unknown, TValue = unknown> {
  readonly value: TValue;
  readonly data: TData;
  readonly node: RowNode<TData>;
  readonly column: ResolvedColumn<TData>;
}

export interface EditModuleOptions {
  /**
   * Whether a cell can be edited when its column does not say.
   *
   * Defaults to false, so a column opts in. An editable-by-default grid turns
   * every stray Enter into a write, and a column showing a computed value has
   * no business accepting one.
   */
  readonly editable?: boolean;
  /** Opens an edit on double click. On by default: the mouse needs a way in. */
  readonly editOnDoubleClick?: boolean;
  /**
   * Opens an edit when a printable character is typed over a focused cell, and
   * seeds the editor with it. On by default, as in every spreadsheet.
   */
  readonly editOnTyping?: boolean;
  /**
   * Whether Ctrl-D (Cmd-D) fills down. On by default.
   *
   * It only ever writes where an edit was already allowed, so unlike pasting it
   * opens nothing a column had not already offered. Off is for a grid that
   * wants the browser's own binding left alone.
   */
  readonly fillDownOnKeyboard?: boolean;
}

/** The editor a value type gets when its column does not name one. */
const DEFAULT_EDITORS: Record<ColumnValueType, string> = {
  text: 'ls-grid-text-editor',
  number: 'ls-grid-number-editor',
  // Neither has an editor of its own yet, so both edit as raw text. Worse than
  // a date picker, better than a cell that silently refuses.
  date: 'ls-grid-text-editor',
  boolean: 'ls-grid-text-editor',
};

/**
 * Editing a cell in place.
 *
 * The module owns the whole transaction — which cell is open, what the editor
 * has reported, and the write. An editor element is only asked to show a value
 * and say when it changed, which is what lets an application supply its own
 * without learning anything about the store.
 *
 * Committing on blur is the one genuinely contested choice here, and is
 * deliberate: clicking away from a half-typed value and losing it is what
 * people report as a bug. Escape stays the way to discard on purpose.
 */
export class EditModule<TData = unknown> implements GridModule<TData> {
  readonly id = 'edit';
  readonly parts = ['cell-editor'];

  private ctx: ModuleContext<TData> | undefined;
  private editing: EditingCell | null = null;
  /** What the editor has reported. Undefined until it reports anything at all. */
  private draft: { value: unknown } | undefined;
  private initialInput: string | undefined;
  /**
   * The cell waiting to be given focus, once it next renders.
   *
   * Closing an editor destroys the element holding focus and the browser hands
   * it to the body, so the reader's place in the grid is gone and Tab starts
   * again from the top of the page. The module has no handle on a cell, so it
   * waits for one to report itself through `onRendered`.
   *
   * Read from the focus controller rather than remembered from the edit,
   * because Enter and Tab move on purpose: restoring the cell that was being
   * edited would drag focus back out of the one they just stepped to.
   */
  private restoreFocusTo: EditingCell | null = null;
  /**
   * Elements already carrying a listener, so each attaches once.
   *
   * Both `onRendered` and a `ref` run on every update, and an element that
   * accumulates a listener per render commits once per render too.
   */
  private readonly wired = new WeakSet<Element>();

  constructor(private options: EditModuleOptions = {}) {}

  /**
   * Changes the module's options after it is registered.
   *
   * A grid keeps the modules it was given, so a consumer that rebuilds one to
   * change a setting finds the new instance is not the one in use. Every other
   * module offers this for the same reason.
   */
  setOptions(next: Partial<EditModuleOptions>): void {
    this.options = { ...this.options, ...next };
    // An open edit was opened under the old rules; a column that is no longer
    // editable should not stay open because it was.
    if (this.editing) this.stopEditing(false);
    this.ctx?.requestRender();
  }

  init(ctx: ModuleContext<TData>): void {
    this.ctx = ctx;
  }

  destroy(): void {
    this.editing = null;
    this.draft = undefined;
    this.ctx = undefined;
  }

  // --- what is open ---------------------------------------------------------

  getEditingCell(): EditingCell | null {
    return this.editing;
  }

  startEditing(rowId: string, colId: string, initialInput?: string): boolean {
    const column = this.columnById(colId);
    const node = this.ctx?.pipeline.store.getRowNode(rowId);
    if (!column || !node || !this.isEditable(column, node)) return false;

    // Opening a second edit commits the first. Two open editors is not a state
    // to reconcile — which value won would depend on the order clicks arrived.
    if (this.editing) this.stopEditing(true);

    this.editing = { rowId, colId };
    this.draft = undefined;
    this.initialInput = initialInput;
    this.ctx?.dispatch(EDIT_EVENTS.EDIT_STARTED, { rowId, colId } satisfies CellEditDetail);
    this.ctx?.requestRender();
    return true;
  }

  /** Closes the open edit, writing what the editor reported when committing. */
  stopEditing(commit: boolean): void {
    const editing = this.editing;
    if (!editing) return;

    this.editing = null;
    const draft = this.draft;
    this.draft = undefined;
    this.initialInput = undefined;

    if (commit && draft !== undefined) this.write(editing, draft.value);

    this.ctx?.dispatch(EDIT_EVENTS.EDIT_STOPPED, {
      ...editing,
      committed: commit,
    } satisfies CellEditStoppedDetail);
    this.ctx?.requestRender();
  }

  // --- the cell it takes over -----------------------------------------------

  cellContent(ctx: CellContext<TData>): TemplateResult | null {
    if (!this.isOpen(ctx)) return null;

    const tag = tagFor(ctx.column.cellEditor ?? DEFAULT_EDITORS[ctx.column.valueType]);
    // The value the edit starts from is the resolved one, before formatting: a
    // formatter exists to make a value readable, and parsing its output back is
    // something no formatter promises is possible.
    return staticHtml`<${tag}
      exportparts="cell-editor"
      .label=${ctx.column.headerName}
      .value=${ctx.value}
      .initialInput=${this.initialInput}
      .commitValue=${this.report}
      ${ref(this.takeFocus)}
    ></${tag}>`;
  }

  cellDecorator(ctx: CellContext<TData>): CellDecoration | null {
    if (this.isOpen(ctx)) {
      // Announced, not merely drawn. A cell whose contents have become a text
      // box has to say so, or a reader is told the old value and then types
      // into something nobody mentioned.
      return { attributes: { 'data-editing': 'true' } };
    }

    const node = this.ctx?.pipeline.store.getRowNode(ctx.row.rowId);
    if (!node || !this.isEditable(ctx.column, node)) return null;

    return {
      onRendered: (cell) => {
        this.wireDoubleClick(cell, ctx.row.rowId, ctx.column.colId);
        this.restoreFocus(cell, ctx.row.rowId, ctx.column.colId);
      },
    };
  }

  // --- keys -----------------------------------------------------------------

  onKeyDown(event: KeyboardEvent): boolean {
    if (this.editing) return this.handleKeyWhileEditing(event);

    // Ctrl-D fills down, as it does in a spreadsheet. Claimed only when it does
    // something: the browser's own binding for it is the bookmark dialog, and
    // taking that from a reader whose grid has nothing to fill would be rude.
    if (
      (event.key === 'd' || event.key === 'D') &&
      (event.ctrlKey || event.metaKey) &&
      (this.options.fillDownOnKeyboard ?? true)
    ) {
      return this.fillDown() > 0;
    }

    const position = this.ctx?.focus.focused.get();
    if (!position || position.section !== 'body') return false;
    const rowId = this.rowIdOf(position.rowKey);
    if (rowId === undefined) return false;

    if (event.key === 'Enter' || event.key === 'F2') {
      return this.startEditing(rowId, position.colId);
    }

    if ((this.options.editOnTyping ?? true) && isPrintable(event)) {
      return this.startEditing(rowId, position.colId, event.key);
    }

    return false;
  }

  private handleKeyWhileEditing(event: KeyboardEvent): boolean {
    switch (event.key) {
      case 'Escape':
        this.stopEditing(false);
        this.focusCurrentCell();
        return true;
      case 'Enter':
        this.stopEditing(true);
        // Down a row, as a spreadsheet does, so a column can be filled in
        // without reaching for the mouse.
        this.ctx?.focus.moveRow(1);
        this.focusCurrentCell();
        return true;
      case 'Tab':
        this.stopEditing(true);
        this.ctx?.focus.moveColumn(event.shiftKey ? -1 : 1);
        this.focusCurrentCell();
        return true;
      default:
        // Everything else belongs to the editor. Arrows move the caret rather
        // than the grid's focus for as long as one is open.
        return true;
    }
  }

  apiExtension(): Record<string, unknown> {
    return {
      startEditingCell: (rowId: string, colId: string) => this.startEditing(rowId, colId),
      stopEditing: (commit = true) => this.stopEditing(commit),
      getEditingCell: () => this.getEditingCell(),
      fillDown: () => this.fillDown(),
    };
  }

  // --- writing many at once --------------------------------------------------

  /**
   * Writes text into cells, as a paste does. Returns how many changed.
   *
   * Here rather than in the clipboard module because everything it has to
   * respect lives here: whether a column accepts an edit at all, how a column's
   * value type reads text, and whether the row is written through a field or a
   * `valueSetter`. The clipboard knows how to get text off the system and how
   * to cut it into a grid, and nothing about what a cell will accept.
   *
   * One transaction for the lot. A block paste is one action to the reader, and
   * per-cell transactions would have the projection re-run for every cell and
   * a listener woken once per cell to hear about a change that is really one.
   *
   * A cell that will not take an edit is skipped rather than failing the paste:
   * a block crossing one computed column should land everywhere else, which is
   * what a spreadsheet does.
   */
  pasteCells(cells: readonly PastedCell[]): number {
    // Text arrives; the column decides what it means. Everything after that is
    // the same as any other multi-cell write.
    return this.writeCells(
      cells.map((cell) => ({
        rowId: cell.rowId,
        colId: cell.colId,
        value: (column: ResolvedColumn<TData>) => coerce(cell.text, column.valueType),
      })),
    );
  }

  /**
   * Copies the top row of the cell range down through the rest of it.
   *
   * With no range, the focused cell takes the value from the row above — which
   * is what Ctrl-D means to anyone arriving from a spreadsheet, and the two are
   * the same idea: bring down what is above.
   *
   * Values rather than text. A fill is not a round trip through the clipboard,
   * so nothing is formatted and nothing needs parsing back — which also means a
   * column whose value is an object survives being filled.
   */
  fillDown(): number {
    const plan = this.fillPlan();
    if (!plan) return 0;

    const store = this.ctx?.pipeline.store;
    if (!store) return 0;

    // Every source is read before anything is written, or each row would fill
    // from the row above as already filled and the top value would cascade
    // through by accident rather than by design.
    const sources = new Map<string, unknown>();
    for (const colId of plan.colIds) {
      const column = this.columnById(colId);
      const node = store.getRowNode(plan.sourceRowId);
      if (!column || !node) continue;
      sources.set(colId, getCellValue(column, node));
    }

    return this.writeCells(
      plan.targetRowIds.flatMap((rowId) =>
        plan.colIds
          .filter((colId) => sources.has(colId))
          .map((colId) => ({ rowId, colId, value: () => sources.get(colId) })),
      ),
    );
  }

  /** Which row is copied, and where to. Null when there is nothing to fill. */
  private fillPlan(): { sourceRowId: string; targetRowIds: string[]; colIds: string[] } | null {
    const range = this.cellRange();
    if (range && range.rowIds.length > 1) {
      const [sourceRowId, ...targetRowIds] = range.rowIds;
      return { sourceRowId: sourceRowId!, targetRowIds, colIds: [...range.colIds] };
    }

    // No range, or one row of it: fill the focused cell from the row above.
    const position = this.ctx?.focus.focused.get();
    if (!position || position.section !== 'body') return null;
    const rows = this.ctx?.pipeline.projector.rows.get() ?? [];
    const index = rows.findIndex((row) => row.id === position.rowKey);
    if (index <= 0) return null;

    const above = rows[index - 1]?.rowId;
    const target = rows[index]?.rowId;
    if (above === undefined || target === undefined || above === target) return null;
    // A single-row range still says which columns; a bare caret means its own.
    const colIds = range && range.rowIds.length === 1 ? [...range.colIds] : [position.colId];
    return { sourceRowId: above, targetRowIds: [target], colIds };
  }

  private cellRange(): { rowIds: readonly string[]; colIds: readonly string[] } | null {
    const provider = (this.ctx?.getModules() ?? []).find(providesCellRange);
    return provider?.provideCellRange() ?? null;
  }

  /**
   * Writes a value into each of many cells, as one action.
   *
   * The value is produced from the column rather than given outright, because
   * the two callers arrive with different things: a paste has text the column
   * has to interpret, a fill has a value already.
   */
  private writeCells(
    cells: readonly {
      rowId: string;
      colId: string;
      value: (column: ResolvedColumn<TData>) => unknown;
    }[],
  ): number {
    const store = this.ctx?.pipeline.store;
    if (!store || cells.length === 0) return 0;

    // Keyed by row, because two cells of one row are one updated object — write
    // them separately and the second overwrites the first's field with a stale
    // copy of the row.
    const updates = new Map<string, TData>();
    const changes: CellValueChangedDetail<TData>[] = [];

    for (const cell of cells) {
      const column = this.columnById(cell.colId);
      const node = store.getRowNode(cell.rowId);
      if (!column || !node || !this.isEditable(column, node)) continue;

      const data = updates.get(cell.rowId) ?? node.data;
      // Read from what this write has already put in the row, so a second
      // column sees the first's change rather than the value on disk.
      const staged = { ...node, data };
      const oldValue = getCellValue(column, staged);
      const value = cell.value(column);
      if (Object.is(oldValue, value)) continue;

      const next = column.valueSetter
        ? column.valueSetter({ value, data, node: staged, column })
        : writePath(data, column.field, value);
      if (next === undefined) continue;

      updates.set(cell.rowId, next);
      changes.push({
        rowId: cell.rowId,
        colId: cell.colId,
        oldValue,
        newValue: value,
        data: next,
      });
    }

    if (updates.size === 0) return 0;

    store.applyTransaction({ update: [...updates.values()] });
    for (const change of changes) this.ctx?.dispatch(EDIT_EVENTS.VALUE_CHANGED, change);
    return changes.length;
  }

  /** What the clipboard looks for. Declared, not reached into. */
  provideCellWrite(cells: readonly PastedCell[]): number {
    return this.pasteCells(cells);
  }

  /** Whether a cell would accept a written value, for a caller sizing a paste. */
  provideCellWritable(rowId: string, colId: string): boolean {
    const column = this.columnById(colId);
    const node = this.ctx?.pipeline.store.getRowNode(rowId);
    return column !== undefined && node !== undefined && this.isEditable(column, node);
  }

  // --- writing --------------------------------------------------------------

  private write(editing: EditingCell, value: unknown): void {
    const store = this.ctx?.pipeline.store;
    const node = store?.getRowNode(editing.rowId);
    const column = this.columnById(editing.colId);
    if (!store || !node || !column) return;

    const oldValue = getCellValue(column, node);
    // Writing an unchanged value would still emit a change event, and a
    // listener takes that as a reason to act.
    if (Object.is(oldValue, value)) return;

    const data = column.valueSetter
      ? column.valueSetter({ value, data: node.data, node, column })
      : writePath(node.data, column.field, value);
    if (data === undefined) return;

    store.applyTransaction({ update: [data] });
    this.ctx?.dispatch(EDIT_EVENTS.VALUE_CHANGED, {
      rowId: editing.rowId,
      colId: editing.colId,
      oldValue,
      newValue: value,
      data,
    } satisfies CellValueChangedDetail<TData>);
  }

  // --- plumbing -------------------------------------------------------------

  private isOpen(ctx: CellContext<TData>): boolean {
    const editing = this.editing;
    return (
      editing !== null && ctx.row.rowId === editing.rowId && ctx.column.colId === editing.colId
    );
  }

  private readonly report = (value: unknown): void => {
    this.draft = { value };
  };

  private readonly takeFocus = (element: Element | undefined): void => {
    // Called with undefined when the editor is torn down.
    const editor = element as CellEditorElement | undefined;
    if (!editor) return;

    // After its first render, or there is nothing in the shadow root to focus.
    void editor.updateComplete.then(() => editor.focusEditor());

    if (this.wired.has(editor)) return;
    this.wired.add(editor);
    editor.addEventListener('focusout', this.handleFocusOut);
  };

  /**
   * Focus leaving the editor commits it.
   *
   * The contested choice, made deliberately: clicking away from a half-typed
   * value and losing it is what people report as a bug, and Escape is still
   * there to discard on purpose.
   *
   * `relatedTarget` is retargeted to the editor's host when focus moves inside
   * its own shadow root, so an editor made of several fields does not commit
   * every time the reader tabs between them.
   */
  private readonly handleFocusOut = (event: FocusEvent): void => {
    const editor = event.currentTarget as HTMLElement;
    const next = event.relatedTarget as Node | null;
    if (next !== null && (next === editor || editor.contains(next))) return;

    // Deferred, because a commit re-renders the cell the browser is in the
    // middle of moving focus out of.
    queueMicrotask(() => {
      if (this.editing) this.stopEditing(true);
    });
  };

  /**
   * Marks wherever the grid's focus now is as needing the caret.
   *
   * Only the keyboard paths ask for this. Focus leaving on its own has already
   * gone somewhere the reader chose — possibly out of the grid entirely — and
   * pulling it back would be taking it from them.
   */
  private focusCurrentCell(): void {
    const position = this.ctx?.focus.focused.get();
    if (!position || position.section !== 'body') return;
    const rowId = this.rowIdOf(position.rowKey);
    if (rowId === undefined) return;
    this.restoreFocusTo = { rowId, colId: position.colId };
    this.ctx?.requestRender();
  }

  /** Hands focus to the cell that asked for it, once and only once. */
  private restoreFocus(cell: HTMLElement, rowId: string, colId: string): void {
    const pending = this.restoreFocusTo;
    if (pending === null || pending.rowId !== rowId || pending.colId !== colId) return;
    this.restoreFocusTo = null;
    cell.focus();
  }

  private wireDoubleClick(cell: HTMLElement, rowId: string, colId: string): void {
    if ((this.options.editOnDoubleClick ?? true) === false || this.wired.has(cell)) return;
    this.wired.add(cell);
    cell.addEventListener('dblclick', () => this.startEditing(rowId, colId));
  }

  private isEditable(column: ResolvedColumn<TData>, node: RowNode<TData>): boolean {
    const declared = column.editable ?? this.options.editable ?? false;
    return typeof declared === 'function' ? declared({ data: node.data, node, column }) : declared;
  }

  private columnById(colId: string): ResolvedColumn<TData> | undefined {
    return this.ctx?.getColumns().find((column) => column.colId === colId);
  }

  /** A focus position names a display row; the store knows store rows. */
  private rowIdOf(rowKey: string): string | undefined {
    return this.ctx?.pipeline.projector.rows.get().find((row) => row.id === rowKey)?.rowId;
  }
}

/**
 * Text from a clipboard, as the column's value type would hold it.
 *
 * Without this a number column pasted into holds the string "1234", which sorts
 * as text, formats as text and compares as text — the column keeps working and
 * quietly stops being a number.
 *
 * A value that will not convert is left as text rather than becoming NaN or an
 * Invalid Date, both of which are worse than the string: they read as a value
 * and are not one.
 */
function coerce(text: string, valueType: ColumnValueType): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;

  if (valueType === 'number') {
    // Thousands separators are how a spreadsheet copies a number out.
    const parsed = Number(trimmed.replaceAll(',', ''));
    return Number.isNaN(parsed) ? text : parsed;
  }

  if (valueType === 'boolean') {
    const lower = trimmed.toLowerCase();
    if (['true', 'yes', '1'].includes(lower)) return true;
    if (['false', 'no', '0'].includes(lower)) return false;
    return text;
  }

  if (valueType === 'date') {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? text : parsed;
  }

  return text;
}

function isPrintable(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' '
  );
}

/**
 * Writes a value at a dot path, copying the whole way down.
 *
 * A copy rather than a mutation: the store detects a change by identity, so
 * writing into the object already there produces a row that has changed and
 * does not look like it.
 */
function writePath<TData>(
  data: TData,
  field: string | undefined,
  value: unknown,
): TData | undefined {
  if (field === undefined || field === '') return undefined;
  const [head, ...rest] = field.split('.');
  if (head === undefined) return undefined;

  const source = data as Record<string, unknown>;
  if (rest.length === 0) return { ...source, [head]: value } as TData;

  const nested = source[head];
  const child = typeof nested === 'object' && nested !== null ? nested : {};
  return { ...source, [head]: writePath(child, rest.join('.'), value) } as TData;
}

const tagCache = new Map<string, ReturnType<typeof literal>>();

function tagFor(tag: string) {
  let cached = tagCache.get(tag);
  if (!cached) {
    if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(tag)) {
      throw new Error(`"${tag}" is not a valid custom element name for cellEditor.`);
    }
    cached = unsafeStatic(tag) as unknown as ReturnType<typeof literal>;
    tagCache.set(tag, cached);
  }
  return cached;
}
