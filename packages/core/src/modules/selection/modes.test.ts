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

const activation = (selection: SelectionModule<Row>) =>
  selection.rowDecorator({ row: { id: 'a', rowId: 'a' }, node: undefined } as never)?.onActivate;

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

  it('supports checkboxes with no click-to-select, and the reverse', () => {
    const checkboxesOnly = setup({ checkboxColumn: true, clickToSelect: false }).selection;
    expect(hasCheckboxColumn(checkboxesOnly)).toBe(true);
    expect(activation(checkboxesOnly)).toBeUndefined();

    const clickOnly = setup({ checkboxColumn: false, clickToSelect: true }).selection;
    expect(hasCheckboxColumn(clickOnly)).toBe(false);
    expect(activation(clickOnly)).toBeTypeOf('function');
  });
});
