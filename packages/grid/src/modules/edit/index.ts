export { EditModule, EDIT_EVENTS } from './edit-module.js';
export type {
  CellEditDetail,
  CellEditStoppedDetail,
  CellValueChangedDetail,
  EditableParams,
  EditingCell,
  EditModuleOptions,
  ValueSetterParams,
} from './edit-module.js';
export { CellEditorElement } from './cell-editor-element.js';
export { NumberEditor, TextEditor } from './editors.js';

import { EDIT_EVENTS } from './edit-module.js';
import type {
  CellEditDetail,
  CellEditStoppedDetail,
  CellValueChangedDetail,
  EditableParams,
  EditingCell,
  ValueSetterParams,
} from './edit-module.js';

/** Column options this module adds. They exist only when it is imported. */
declare module '../../columns/types.js' {
  interface ColumnDef<TData, TValue> {
    /**
     * Whether this column's cells can be edited.
     *
     * A predicate for the common case that only some rows are editable — a
     * group heading holds no value of its own, and a closed trade is history.
     */
    editable?: boolean | ((params: EditableParams<TData>) => boolean);
    /** Custom element name for the editor. Defaults to the value type's. */
    cellEditor?: string;
    /**
     * Produces the updated row from an edited value.
     *
     * Needed whenever the value is not simply the field: a column with a
     * `valueGetter` has no field to write back to, and a value split across
     * two properties has to be recombined. Returning undefined abandons the
     * write.
     */
    valueSetter?: (params: ValueSetterParams<TData, TValue>) => TData | undefined;
  }
}

declare module '../../api/types.js' {
  interface GridApi<TData> {
    /** Opens an editor. Returns false when the cell is not editable. */
    startEditingCell(rowId: string, colId: string): boolean;
    /** Closes the open editor, writing its value unless `commit` is false. */
    stopEditing(commit?: boolean): void;
    getEditingCell(): EditingCell | null;
    /**
     * Copies the top row of the cell range down through the rest of it, or the
     * focused cell from the row above. Returns how many cells changed.
     */
    fillDown(): number;
  }
}

declare module '../../api/events.js' {
  interface GridEventMap {
    [EDIT_EVENTS.EDIT_STARTED]: CustomEvent<CellEditDetail>;
    [EDIT_EVENTS.EDIT_STOPPED]: CustomEvent<CellEditStoppedDetail>;
    [EDIT_EVENTS.VALUE_CHANGED]: CustomEvent<CellValueChangedDetail>;
  }
}
