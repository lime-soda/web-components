import { describe, expect, it } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { SelectionModule, type SelectionModuleOptions } from './selection-module.js';

/**
 * Mode, checkboxes and click-to-select are three independent choices.
 *
 * They were not: the checkbox column's default came from the mode, so choosing
 * single selection silently removed the column.
 */

interface Row {
  id: string;
  name: string;
}

const setup = (options: SelectionModuleOptions = {}) => {
  const pipeline = new GridPipeline<Row>({ getRowId: (d) => d.id });
  pipeline.store.setRowData([
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
  ]);
  const selection = new SelectionModule<Row>(options);
  const registry = new ModuleRegistry<Row>({
    pipeline,
    getColumns: () => resolveColumns<Row>([{ field: 'name' }]),
    dispatch: () => {},
  });
  registry.register(selection);
  registry.start();
  pipeline.projector.rows.get();
  return { selection, pipeline };
};

const headerSlot = (selection: SelectionModule<Row>) =>
  selection.headerSlot({
    column: { colId: 'flow-selection', headerName: '', width: 28, index: 0 },
  } as never);

const hasCheckboxColumn = (selection: SelectionModule<Row>) =>
  selection.provideColumns().some((column) => column.colId === 'flow-selection');

const activation = (selection: SelectionModule<Row>, rowId = 'a') =>
  selection.rowDecorator({ row: { id: rowId, rowId }, node: undefined } as never)?.onActivate;

/** A row click carrying the given modifiers. */
const clickRow = (
  selection: SelectionModule<Row>,
  rowId: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {},
) => {
  activation(
    selection,
    rowId,
  )?.({
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  } as unknown as Event);
};

describe('selection modes', () => {
  describe('the checkbox column', () => {
    it('is shown in multi mode by default', () => {
      expect(hasCheckboxColumn(setup({ mode: 'multi' }).selection)).toBe(true);
    });

    it('is shown in single mode too, rather than being removed with the mode', () => {
      expect(hasCheckboxColumn(setup({ mode: 'single' }).selection)).toBe(true);
    });

    it('can be turned off in either mode', () => {
      expect(hasCheckboxColumn(setup({ mode: 'multi', checkboxColumn: false }).selection)).toBe(
        false,
      );
      expect(hasCheckboxColumn(setup({ mode: 'single', checkboxColumn: false }).selection)).toBe(
        false,
      );
    });
  });

  describe('the select-all header', () => {
    it('appears in multi mode', () => {
      expect(headerSlot(setup({ mode: 'multi' }).selection)).not.toBeNull();
    });

    it('never appears in single mode, even with the column shown', () => {
      // Selecting everything is not something single selection can express.
      const { selection } = setup({ mode: 'single', checkboxColumn: true });

      expect(hasCheckboxColumn(selection)).toBe(true);
      expect(headerSlot(selection)).toBeNull();
    });
  });

  describe('click to select', () => {
    it('works in multi mode', () => {
      expect(activation(setup({ mode: 'multi', clickToSelect: true }).selection)).toBeTypeOf(
        'function',
      );
    });

    it('works in single mode', () => {
      expect(activation(setup({ mode: 'single', clickToSelect: true }).selection)).toBeTypeOf(
        'function',
      );
    });

    it('is attached to unselected rows, which is the only way to select one', () => {
      const { selection } = setup({ clickToSelect: true });

      expect(selection.getRowState('a')).toBe('unchecked');
      expect(activation(selection)).toBeTypeOf('function');
    });

    it('is absent when the option is off', () => {
      expect(activation(setup({ clickToSelect: false }).selection)).toBeUndefined();
    });

    it('selects one row at a time in single mode', () => {
      const { selection } = setup({ mode: 'single', clickToSelect: true });

      selection.toggleRowSelected('a');
      selection.toggleRowSelected('b');

      expect(selection.getSelectedRows()).toEqual(['b']);
    });
  });

  describe('row click modifiers', () => {
    /**
     * The conventions every desktop grid shares: plain click replaces, Ctrl or
     * Cmd adds, Shift extends. A row click is not a checkbox click.
     */
    const clickable = () => setup({ mode: 'multi', clickToSelect: true }).selection;

    it('replaces the selection on a plain click', () => {
      const selection = clickable();

      clickRow(selection, 'a');
      clickRow(selection, 'b');

      expect(selection.getSelectedRows()).toEqual(['b']);
    });

    it('adds to the selection on ctrl+click', () => {
      const selection = clickable();

      clickRow(selection, 'a');
      clickRow(selection, 'b', { ctrlKey: true });

      expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
    });

    it('treats cmd+click as ctrl+click, for macOS', () => {
      const selection = clickable();

      clickRow(selection, 'a');
      clickRow(selection, 'b', { metaKey: true });

      expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
    });

    it('deselects a selected row on ctrl+click, leaving the rest alone', () => {
      const selection = clickable();

      clickRow(selection, 'a');
      clickRow(selection, 'b', { ctrlKey: true });
      clickRow(selection, 'a', { ctrlKey: true });

      expect(selection.getSelectedRows()).toEqual(['b']);
    });

    it('keeps a plain click on an already-selected row selected', () => {
      // Rather than toggling it off: the click means "just this one", and it
      // already is that one.
      const selection = clickable();

      clickRow(selection, 'a');
      clickRow(selection, 'a');

      expect(selection.getSelectedRows()).toEqual(['a']);
    });

    it('adds on a plain click when selectionWithoutKeys is set, for touch', () => {
      const { selection } = setup({
        mode: 'multi',
        clickToSelect: true,
        selectionWithoutKeys: true,
      });

      clickRow(selection, 'a');
      clickRow(selection, 'b');

      expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
      clickRow(selection, 'a');
      expect(selection.getSelectedRows()).toEqual(['b']);
    });

    it('extends from the anchor on shift+click', () => {
      const { selection, pipeline } = setup({ mode: 'multi', clickToSelect: true });
      pipeline.store.setRowData([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ]);
      pipeline.projector.rows.get();

      clickRow(selection, 'a');
      clickRow(selection, 'c', { shiftKey: true });

      expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b', 'c']);
    });

    it('keeps the anchor when a shift+click replaces an earlier span', () => {
      // Clearing the old span must not move the anchor onto the clicked row,
      // which would collapse the selection to that row alone.
      const { selection, pipeline } = setup({ mode: 'multi', clickToSelect: true });
      pipeline.store.setRowData([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ]);
      pipeline.projector.rows.get();

      clickRow(selection, 'a');
      clickRow(selection, 'c', { shiftKey: true });
      clickRow(selection, 'b', { shiftKey: true });

      expect([...selection.getSelectedRows()].sort()).toEqual(['a', 'b']);
    });

    it('replaces on a plain click in single mode too', () => {
      const { selection } = setup({ mode: 'single', clickToSelect: true });

      clickRow(selection, 'a');
      clickRow(selection, 'b');

      expect(selection.getSelectedRows()).toEqual(['b']);
    });
  });

  it('supports checkboxes with no click-to-select, and the reverse', () => {
    const checkboxesOnly = setup({ checkboxColumn: true, clickToSelect: false }).selection;
    expect(hasCheckboxColumn(checkboxesOnly)).toBe(true);
    expect(activation(checkboxesOnly)).toBeUndefined();

    const clickOnly = setup({ checkboxColumn: false, clickToSelect: true }).selection;
    expect(hasCheckboxColumn(clickOnly)).toBe(false);
    expect(activation(clickOnly)).toBeTypeOf('function');
  });
});
