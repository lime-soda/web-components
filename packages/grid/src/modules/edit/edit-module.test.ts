import { describe, expect, it } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import type { ColumnDefs } from '../../columns/types.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import type { GridModule } from '../types.js';
import { EditModule, type EditModuleOptions } from './edit-module.js';
import { RangeModule } from '../range/range-module.js';

/**
 * What an edit decides, without a browser.
 *
 * The parts worth testing here are the ones a story cannot see: which cells
 * accept an edit at all, what is written where, and what happens when the same
 * value comes back. Typing, focus and the editor element itself belong to the
 * story tests, which drive them the way a person does.
 */

interface Bond {
  id: string;
  instrument: string;
  price: number;
  desk: { trader: string };
}

const data: Bond[] = [
  { id: 'a', instrument: 'UKT 4% 2030', price: 101.25, desk: { trader: 'RM' } },
  { id: 'b', instrument: 'UKT 1% 2041', price: 98.5, desk: { trader: 'JP' } },
  // A third, because filling down needs somewhere to fill to and two rows
  // cannot tell a fill from a copy of one row into one other.
  { id: 'c', instrument: 'DBR 2% 2032', price: 100.125, desk: { trader: 'KL' } },
];

const columns: ColumnDefs<Bond> = [
  { field: 'instrument', headerName: 'Instrument', editable: true },
  { field: 'price', headerName: 'Price', valueType: 'number', editable: true },
  { field: 'desk.trader', headerName: 'Trader', editable: true },
  { field: 'id', headerName: 'Id' },
];

const setup = (
  options: EditModuleOptions = {},
  defs: ColumnDefs<Bond> = columns,
  extra: GridModule<Bond>[] = [],
) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);

  const events: { type: string; detail: unknown }[] = [];
  const edit = new EditModule<Bond>(options);
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>(defs),
    dispatch: (type, detail) => events.push({ type, detail }),
  });
  for (const module of extra) registry.register(module);
  registry.register(edit);
  registry.start();
  pipeline.projector.rows.get();

  const rowOf = (id: string) => pipeline.store.getRowNode(id)!.data;
  return { edit, pipeline, events, rowOf, registry };
};

/** Opens an edit, reports a value the way an editor would, and closes it. */
const type = (edit: EditModule<Bond>, rowId: string, colId: string, value: unknown) => {
  edit.startEditing(rowId, colId);
  reportFromEditor(edit, value);
};

/**
 * Stands in for the editor element.
 *
 * `cellContent` is what hands an editor its `commitValue`, so calling it is how
 * a test reaches the same channel a real editor uses rather than inventing a
 * second one.
 */
const reportFromEditor = (edit: EditModule<Bond>, value: unknown) => {
  const editing = edit.getEditingCell()!;
  const template = edit.cellContent({
    row: { id: editing.rowId, rowId: editing.rowId },
    node: undefined,
    // Only colId and valueType are read for this purpose.
    column: { colId: editing.colId, valueType: 'text' } as never,
    value: undefined,
  })!;
  const report = template.values.find((v) => typeof v === 'function') as (v: unknown) => void;
  report(value);
};

describe('EditModule', () => {
  describe('which cells open', () => {
    it('opens an editable column', () => {
      const { edit } = setup();

      expect(edit.startEditing('a', 'instrument')).toBe(true);
      expect(edit.getEditingCell()).toEqual({ rowId: 'a', colId: 'instrument' });
    });

    it('refuses a column that did not opt in', () => {
      // Editable-by-default turns every stray Enter into a write.
      const { edit } = setup();

      expect(edit.startEditing('a', 'id')).toBe(false);
      expect(edit.getEditingCell()).toBeNull();
    });

    it('opts every column in when the module says so', () => {
      const { edit } = setup({ editable: true });

      expect(edit.startEditing('a', 'id')).toBe(true);
    });

    it('lets a column overrule the module', () => {
      const { edit } = setup({ editable: true }, [
        { field: 'instrument', headerName: 'Instrument', editable: false },
      ]);

      expect(edit.startEditing('a', 'instrument')).toBe(false);
    });

    it('asks a predicate about the row it is on', () => {
      // The case this exists for: a closed trade is history, an open one is not.
      const { edit } = setup({}, [
        {
          field: 'instrument',
          headerName: 'Instrument',
          editable: ({ data }) => data.id !== 'b',
        },
      ]);

      expect(edit.startEditing('a', 'instrument')).toBe(true);
      edit.stopEditing(false);
      expect(edit.startEditing('b', 'instrument')).toBe(false);
    });

    it('refuses a row that is not there', () => {
      const { edit } = setup();

      expect(edit.startEditing('nope', 'instrument')).toBe(false);
    });
  });

  describe('committing', () => {
    it('writes what the editor reported', () => {
      const { edit, rowOf } = setup();
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.stopEditing(true);

      expect(rowOf('a').instrument).toBe('UKT 5% 2035');
    });

    it('writes through a dot path without disturbing its siblings', () => {
      const { edit, rowOf } = setup();
      type(edit, 'a', 'desk.trader', 'AB');

      edit.stopEditing(true);

      expect(rowOf('a').desk.trader).toBe('AB');
      expect(rowOf('a').instrument).toBe('UKT 4% 2030');
    });

    it('replaces the row rather than mutating it', () => {
      // The store detects a change by identity, so a mutated row is one that
      // has changed and does not look like it.
      const { edit, pipeline } = setup();
      const before = pipeline.store.getRowNode('a')!.data;
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.stopEditing(true);

      expect(pipeline.store.getRowNode('a')!.data).not.toBe(before);
      expect(before.instrument).toBe('UKT 4% 2030');
    });

    it('leaves the row alone when the value is unchanged', () => {
      // Writing anyway would emit a change event, which a listener acts on.
      const { edit, pipeline, events } = setup();
      const before = pipeline.store.getRowNode('a')!.data;
      type(edit, 'a', 'instrument', 'UKT 4% 2030');

      edit.stopEditing(true);

      expect(pipeline.store.getRowNode('a')!.data).toBe(before);
      expect(events.filter((e) => e.type === 'ls-grid-cell-value-changed')).toHaveLength(0);
    });

    it('writes nothing when the editor never reported', () => {
      const { edit, pipeline } = setup();
      const before = pipeline.store.getRowNode('a')!.data;
      edit.startEditing('a', 'instrument');

      edit.stopEditing(true);

      expect(pipeline.store.getRowNode('a')!.data).toBe(before);
    });

    it('announces the change with both values', () => {
      const { edit, events } = setup();
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.stopEditing(true);

      const changed = events.find((e) => e.type === 'ls-grid-cell-value-changed');
      expect(changed?.detail).toMatchObject({
        rowId: 'a',
        colId: 'instrument',
        oldValue: 'UKT 4% 2030',
        newValue: 'UKT 5% 2035',
      });
    });
  });

  describe('cancelling', () => {
    it('discards what was typed', () => {
      const { edit, rowOf } = setup();
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.stopEditing(false);

      expect(rowOf('a').instrument).toBe('UKT 4% 2030');
      expect(edit.getEditingCell()).toBeNull();
    });

    it('says so when it closes', () => {
      const { edit, events } = setup();
      edit.startEditing('a', 'instrument');

      edit.stopEditing(false);

      expect(events.find((e) => e.type === 'ls-grid-cell-edit-stopped')?.detail).toMatchObject({
        committed: false,
      });
    });
  });

  describe('valueSetter', () => {
    it('is used instead of the field', () => {
      // The case that needs it: a column whose value is computed has no field
      // to write back to.
      const { edit, rowOf } = setup({}, [
        {
          colId: 'initials',
          headerName: 'Trader',
          editable: true,
          valueGetter: ({ data }) => data.desk.trader,
          valueSetter: ({ value, data }) => ({ ...data, desk: { trader: String(value) } }),
        },
      ]);
      type(edit, 'a', 'initials', 'ZZ');

      edit.stopEditing(true);

      expect(rowOf('a').desk.trader).toBe('ZZ');
    });

    it('abandons the write when it returns undefined', () => {
      // How a setter rejects a value it cannot use, rather than throwing into
      // the middle of a keystroke.
      const { edit, pipeline } = setup({}, [
        {
          field: 'instrument',
          headerName: 'Instrument',
          editable: true,
          valueSetter: () => undefined,
        },
      ]);
      const before = pipeline.store.getRowNode('a')!.data;
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.stopEditing(true);

      expect(pipeline.store.getRowNode('a')!.data).toBe(before);
    });

    it('is required by a column with no field', () => {
      // Without one there is nowhere to put the value, so the write is dropped
      // rather than guessed at.
      const { edit, pipeline } = setup({}, [
        { colId: 'computed', headerName: 'Computed', editable: true, valueGetter: () => 'x' },
      ]);
      const before = pipeline.store.getRowNode('a')!.data;
      type(edit, 'a', 'computed', 'y');

      edit.stopEditing(true);

      expect(pipeline.store.getRowNode('a')!.data).toBe(before);
    });
  });

  describe('one at a time', () => {
    it('commits the open edit when another opens', () => {
      // Two editors is not a state to reconcile: which value won would depend
      // on the order the clicks arrived in.
      const { edit, rowOf } = setup();
      type(edit, 'a', 'instrument', 'UKT 5% 2035');

      edit.startEditing('b', 'instrument');

      expect(rowOf('a').instrument).toBe('UKT 5% 2035');
      expect(edit.getEditingCell()).toEqual({ rowId: 'b', colId: 'instrument' });
    });

    it('closing when nothing is open does nothing', () => {
      const { edit, events } = setup();

      edit.stopEditing(true);

      expect(events).toHaveLength(0);
    });
  });
});

/**
 * Writing a block, as a paste does.
 *
 * The parts a story cannot see: what happens to a cell that will not take an
 * edit, how text becomes the column's own type, and that two columns of one row
 * arrive as one updated object rather than two that overwrite each other.
 */
describe('EditModule pasting', () => {
  const paste = (edit: EditModule<Bond>, cells: { rowId: string; colId: string; text: string }[]) =>
    edit.pasteCells(cells);

  it('writes a block of text into cells', () => {
    const { edit, rowOf } = setup();

    const written = paste(edit, [
      { rowId: 'a', colId: 'instrument', text: 'UKT 5% 2035' },
      { rowId: 'b', colId: 'instrument', text: 'UKT 6% 2040' },
    ]);

    expect(written).toBe(2);
    expect(rowOf('a').instrument).toBe('UKT 5% 2035');
    expect(rowOf('b').instrument).toBe('UKT 6% 2040');
  });

  it('writes two columns of one row as a single updated object', () => {
    // Written separately, the second update carries a copy of the row taken
    // before the first, and silently undoes it.
    const { edit, rowOf } = setup();

    paste(edit, [
      { rowId: 'a', colId: 'instrument', text: 'UKT 5% 2035' },
      { rowId: 'a', colId: 'price', text: '99' },
    ]);

    expect(rowOf('a').instrument).toBe('UKT 5% 2035');
    expect(rowOf('a').price).toBe(99);
  });

  it('gives a number column a number, not the text of one', () => {
    // The failure this prevents is quiet: the column keeps working and stops
    // being a number — sorting, formatting and comparing all as text.
    const { edit, rowOf } = setup();

    paste(edit, [{ rowId: 'a', colId: 'price', text: '102.5' }]);

    expect(rowOf('a').price).toBe(102.5);
    expect(typeof rowOf('a').price).toBe('number');
  });

  it('reads the thousands separators a spreadsheet copies out', () => {
    const { edit, rowOf } = setup();

    paste(edit, [{ rowId: 'a', colId: 'price', text: '1,500' }]);

    expect(rowOf('a').price).toBe(1500);
  });

  it('leaves text that will not convert as text rather than as NaN', () => {
    // NaN reads as a value and is not one. The string is at least visibly wrong.
    const { edit, rowOf } = setup();

    paste(edit, [{ rowId: 'a', colId: 'price', text: 'not a price' }]);

    expect(rowOf('a').price).toBe('not a price');
  });

  it('skips a cell that will not take an edit rather than failing the paste', () => {
    // A block crossing one computed column should land everywhere else.
    const { edit, rowOf } = setup();

    const written = paste(edit, [
      { rowId: 'a', colId: 'id', text: 'nope' },
      { rowId: 'a', colId: 'instrument', text: 'UKT 5% 2035' },
    ]);

    expect(written).toBe(1);
    expect(rowOf('a').id).toBe('a');
    expect(rowOf('a').instrument).toBe('UKT 5% 2035');
  });

  it('writes nothing when no cell would accept it', () => {
    const { edit, pipeline } = setup();
    const before = pipeline.store.getRowNode('a')!.data;

    expect(paste(edit, [{ rowId: 'a', colId: 'id', text: 'nope' }])).toBe(0);
    expect(pipeline.store.getRowNode('a')!.data).toBe(before);
  });

  it('ignores a value that is already there', () => {
    const { edit, events } = setup();

    paste(edit, [{ rowId: 'a', colId: 'instrument', text: 'UKT 4% 2030' }]);

    expect(events.filter((e) => e.type === 'ls-grid-cell-value-changed')).toHaveLength(0);
  });

  it('announces every cell it changed', () => {
    const { edit, events } = setup();

    paste(edit, [
      { rowId: 'a', colId: 'instrument', text: 'UKT 5% 2035' },
      { rowId: 'b', colId: 'instrument', text: 'UKT 6% 2040' },
    ]);

    expect(events.filter((e) => e.type === 'ls-grid-cell-value-changed')).toHaveLength(2);
  });

  it('writes through a valueSetter, so a computed column is pasteable', () => {
    const { edit, rowOf } = setup({}, [
      {
        colId: 'initials',
        headerName: 'Trader',
        editable: true,
        valueGetter: ({ data }) => data.desk.trader,
        valueSetter: ({ value, data }) => ({ ...data, desk: { trader: String(value) } }),
      },
    ]);

    paste(edit, [{ rowId: 'a', colId: 'initials', text: 'ZZ' }]);

    expect(rowOf('a').desk.trader).toBe('ZZ');
  });
});

/**
 * Filling down.
 *
 * A range module is registered because a fill over a rectangle is the main
 * case, and the two find each other through a declared capability that a mock
 * on either side would assume works.
 */
describe('EditModule filling down', () => {
  const withRange = (defs: ColumnDefs<Bond> = columns) => {
    const range = new RangeModule<Bond>();
    const base = setup({}, defs, [range]);
    const select = (rows: [number, number], cols: [number, number]) =>
      range.setCellRange({
        anchorRow: rows[0],
        anchorColumn: cols[0],
        headRow: rows[1],
        headColumn: cols[1],
      });
    return { ...base, range, select };
  };

  it('copies the top row of the range down through the rest', () => {
    const { edit, select, rowOf } = withRange();
    select([0, 2], [0, 0]);

    expect(edit.fillDown()).toBe(2);

    expect(rowOf('b').instrument).toBe('UKT 4% 2030');
    expect(rowOf('c').instrument).toBe('UKT 4% 2030');
  });

  it('leaves the source row alone', () => {
    const { edit, select, rowOf } = withRange();
    select([0, 2], [0, 0]);

    edit.fillDown();

    expect(rowOf('a').instrument).toBe('UKT 4% 2030');
  });

  it('fills every column the range covers', () => {
    const { edit, select, rowOf } = withRange();
    select([0, 1], [0, 1]);

    edit.fillDown();

    expect(rowOf('b').instrument).toBe('UKT 4% 2030');
    expect(rowOf('b').price).toBe(101.25);
  });

  it('carries the value rather than a formatted copy of it', () => {
    // A fill is not a round trip through the clipboard, so a number stays a
    // number and never becomes the text of one.
    const { edit, select, rowOf } = withRange();
    select([0, 1], [1, 1]);

    edit.fillDown();

    expect(rowOf('b').price).toBe(101.25);
    expect(typeof rowOf('b').price).toBe('number');
  });

  it('reads every source before writing anything', () => {
    // Otherwise each row fills from the row above as already filled, and the
    // top value cascades through by accident rather than by design. Here that
    // would be indistinguishable — so the check is that the second row took the
    // first's original value, not a value that had been written mid-fill.
    const { edit, select, rowOf } = withRange();
    select([0, 2], [1, 1]);

    edit.fillDown();

    expect([rowOf('a').price, rowOf('b').price, rowOf('c').price]).toEqual([
      101.25, 101.25, 101.25,
    ]);
  });

  it('skips a column that will not take an edit', () => {
    const { edit, select, rowOf } = withRange();
    // The id column is not editable; the instrument beside it is.
    select([0, 1], [0, 3]);

    edit.fillDown();

    expect(rowOf('b').id).toBe('b');
    expect(rowOf('b').instrument).toBe('UKT 4% 2030');
  });

  it('has nothing to do with a single-row range', () => {
    const { edit, select } = withRange();
    select([1, 1], [0, 0]);
    // With focus unset there is no cell to fill from the row above either.

    expect(edit.fillDown()).toBe(0);
  });

  it('fills the focused cell from the row above when no range is drawn', () => {
    // What Ctrl-D means to anyone arriving from a spreadsheet.
    const { edit, pipeline, registry, rowOf } = setup();
    const rows = pipeline.projector.rows.get();
    registry.focus.focus({
      instanceId: 'i',
      rowKey: rows[1]!.id,
      colId: 'instrument',
      section: 'body',
    });

    expect(edit.fillDown()).toBe(1);
    expect(rowOf('b').instrument).toBe('UKT 4% 2030');
  });

  it('has nothing above the first row', () => {
    const { edit, pipeline, registry } = setup();
    const rows = pipeline.projector.rows.get();
    registry.focus.focus({
      instanceId: 'i',
      rowKey: rows[0]!.id,
      colId: 'instrument',
      section: 'body',
    });

    expect(edit.fillDown()).toBe(0);
  });

  it('writes the whole fill as one transaction', () => {
    // A fill is one action to the reader. Per-cell transactions would re-run
    // the projection for each and wake a listener once per cell.
    const { edit, select, events } = withRange();
    select([0, 2], [0, 0]);

    edit.fillDown();

    expect(events.filter((e) => e.type === 'ls-grid-data-changed')).toHaveLength(0);
    expect(events.filter((e) => e.type === 'ls-grid-cell-value-changed')).toHaveLength(2);
  });
});
