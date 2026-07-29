import { describe, expect, it, vi } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { SelectionModule, type SelectionModuleOptions } from './selection-module.js';

interface Quote {
  id: string;
  parentId: string | null;
  instrument: string;
  price: number;
}

const quote = (id: string, parentId: string | null = null): Quote => ({
  id,
  parentId,
  instrument: id.toUpperCase(),
  price: 100,
});

const setup = (data: Quote[] = [], options: SelectionModuleOptions = {}) => {
  const pipeline = new GridPipeline<Quote>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(data);
  const selection = new SelectionModule<Quote>(options);
  const dispatch = vi.fn();
  const registry = new ModuleRegistry<Quote>({
    pipeline,
    getColumns: () => resolveColumns<Quote>([{ field: 'instrument' }]),
    dispatch,
  });
  registry.register(selection);
  registry.start();
  return { pipeline, selection, dispatch, registry };
};

const rows = (count: number) => Array.from({ length: count }, (_, i) => quote(`r${i}`));

describe('SelectionModule', () => {
  describe('single row', () => {
    it('selects and deselects', () => {
      const { selection } = setup(rows(2));

      selection.setRowSelected('r0', true);
      expect(selection.isSelected('r0')).toBe(true);

      selection.setRowSelected('r0', false);
      expect(selection.isSelected('r0')).toBe(false);
    });

    it('toggles', () => {
      const { selection } = setup(rows(1));

      selection.toggleRowSelected('r0');
      expect(selection.getSelectedRows()).toEqual(['r0']);

      selection.toggleRowSelected('r0');
      expect(selection.getSelectedRows()).toEqual([]);
    });

    it('is a no-op when already in the requested state', () => {
      const { selection, dispatch } = setup(rows(1));
      selection.setRowSelected('r0', true);
      dispatch.mockClear();

      selection.setRowSelected('r0', true);

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  describe('modes', () => {
    it('keeps several rows in multi mode', () => {
      const { selection } = setup(rows(3));

      selection.setRowSelected('r0', true);
      selection.setRowSelected('r1', true);

      expect(selection.getSelectedCount()).toBe(2);
    });

    it('replaces the selection in single mode', () => {
      const { selection } = setup(rows(3), { mode: 'single' });

      selection.setRowSelected('r0', true);
      selection.setRowSelected('r1', true);

      expect(selection.getSelectedRows()).toEqual(['r1']);
    });

    it('ignores selectAll in single mode', () => {
      const { selection } = setup(rows(3), { mode: 'single' });

      selection.selectAll();

      expect(selection.getSelectedCount()).toBe(0);
    });
  });

  describe('selectAll', () => {
    it('selects every projected row', () => {
      const { selection } = setup(rows(3));

      selection.selectAll();

      expect(selection.getSelectedCount()).toBe(3);
    });

    it('respects an active filter, selecting what is visible rather than the whole book', () => {
      const { selection, pipeline } = setup(rows(5));
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (all) => all.filter((row) => row.rowId === 'r1' || row.rowId === 'r2'),
      });

      selection.selectAll();

      expect(selection.getSelectedRows()).toEqual(['r1', 'r2']);
    });

    it('skips rows excluded by isSelectable', () => {
      const { selection } = setup([quote('g'), quote('c', 'g')], {
        isSelectable: (rowId) => rowId !== 'g',
      });

      selection.selectAll();

      expect(selection.getSelectedRows()).toEqual(['c']);
    });
  });

  describe('isSelectable', () => {
    it('refuses to select an excluded row', () => {
      const { selection } = setup(rows(1), { isSelectable: () => false });

      selection.setRowSelected('r0', true);

      expect(selection.isSelected('r0')).toBe(false);
    });

    it('reports selectability for renderers', () => {
      const { selection } = setup(rows(1), { isSelectable: (id) => id !== 'r0' });

      expect(selection.canSelect('r0')).toBe(false);
      expect(selection.canSelect('r1')).toBe(true);
    });
  });

  describe('columns', () => {
    it('contributes a checkbox column in multi mode', () => {
      const { selection } = setup();

      expect(selection.provideColumns().map((c) => c.colId)).toEqual(['flow-selection']);
    });

    it('contributes one in single mode too, since the column is not tied to the mode', () => {
      const { selection } = setup([], { mode: 'single' });

      expect(selection.provideColumns().map((c) => c.colId)).toEqual(['flow-selection']);
    });

    it('contributes one in single mode when asked', () => {
      const { selection } = setup([], { mode: 'single', checkboxColumn: true });

      expect(selection.provideColumns()).toHaveLength(1);
    });

    it('marks its own column unsortable and unfilterable', () => {
      const { selection } = setup();
      const column = selection.provideColumns()[0]!;

      expect(column.sortable).toBe(false);
      expect(column.filterable).toBe(false);
    });
  });

  describe('select-all header', () => {
    const headerFor = (selection: SelectionModule<Quote>, colId = 'flow-selection') =>
      selection.headerSlot({
        column: { colId, headerName: '', width: 28, index: 0 },
      } as never);

    it('offers one on its own column', () => {
      expect(headerFor(setup(rows(3)).selection)).not.toBeNull();
    });

    it('offers none on any other column', () => {
      expect(headerFor(setup(rows(3)).selection, 'instrument')).toBeNull();
    });

    it('offers none in single mode, where select-all is meaningless', () => {
      expect(headerFor(setup(rows(3), { mode: 'single' }).selection)).toBeNull();
    });

    it('selects everything visible when nothing is selected', () => {
      const { selection } = setup(rows(3));

      selection.selectAll();

      expect(selection.getSelectedCount()).toBe(3);
    });

    it('counts only selectable rows, so excluded group headings do not block the all state', () => {
      // With a group heading excluded, selecting the two children must read as
      // "all", not as "two of three".
      const { selection } = setup([quote('g'), quote('c1', 'g'), quote('c2', 'g')], {
        isSelectable: (rowId) => rowId !== 'g',
      });

      selection.selectAll();

      expect(selection.getSelectedRows()).toEqual(['c1', 'c2']);
    });

    it('counts a repeated ancestor once, not once per instance', () => {
      // The layout repeats a group heading atop each continuation instance. Those
      // copies share a rowId and are one row for selection purposes.
      const { selection, pipeline } = setup(rows(2));
      pipeline.addStage({
        id: 'repeat',
        phase: 'decorate',
        run: (all) => [...all, { ...all[0]!, id: 'r0@1' }],
      });

      selection.selectAll();

      expect(selection.getSelectedCount()).toBe(2);
    });
  });

  describe('checkbox column', () => {
    it('is narrow, because the cell drops its gutter for element renderers', () => {
      expect(setup().selection.provideColumns()[0]!.width).toBe(28);
    });

    it('accepts an explicit width', () => {
      expect(setup([], { checkboxColumnWidth: 44 }).selection.provideColumns()[0]!.width).toBe(44);
    });

    it('has an empty header name, so the header centres its checkbox', () => {
      expect(setup().selection.provideColumns()[0]!.headerName).toBe('');
    });
  });

  describe('row decoration', () => {
    const info = (rowId: string) => ({ row: { id: rowId, rowId }, node: undefined });

    it('marks a selected row and reaches its cells', () => {
      // A row is display:contents and has no box to paint, so the highlight has
      // to be carried to the cells — as a class, not an inline style.
      const { selection } = setup(rows(1));
      selection.setRowSelected('r0', true);

      const decoration = selection.rowDecorator(info('r0'))!;

      expect(decoration.attributes?.['aria-selected']).toBe('true');
      expect(decoration.cellClasses).toContain('flow-cell-selected');
    });

    it('still decorates an unselected row, so the previous highlight is withdrawn', () => {
      const { selection } = setup(rows(1));

      const decoration = selection.rowDecorator(info('r0'))!;

      expect(decoration.attributes?.['aria-selected']).toBe('false');
      expect(decoration.cellClasses).toBeUndefined();
    });

    it('adds no click handler unless clickToSelect is on', () => {
      const { selection } = setup(rows(1));
      selection.setRowSelected('r0', true);

      expect(selection.rowDecorator(info('r0'))!.onActivate).toBeUndefined();
    });

    it('adds one when clickToSelect is on', () => {
      const { selection } = setup(rows(1), { clickToSelect: true });
      selection.setRowSelected('r0', true);

      expect(selection.rowDecorator(info('r0'))!.onActivate).toBeTypeOf('function');
    });
  });

  describe('state and events', () => {
    it('round-trips', () => {
      const { selection } = setup(rows(3));
      selection.setRowSelected('r0', true);
      selection.setRowSelected('r2', true);
      const saved = selection.getState();

      selection.clearSelection();
      selection.setState(saved);

      expect(selection.getSelectedRows()).toEqual(['r0', 'r2']);
    });

    it('dispatches on change with the count', () => {
      const { selection, dispatch } = setup(rows(2));

      selection.setRowSelected('r0', true);

      expect(dispatch).toHaveBeenCalledWith('flow-selection-changed', {
        selected: ['r0'],
        count: 1,
      });
    });

    it('does not dispatch when clearing an empty selection', () => {
      const { selection, dispatch } = setup(rows(1));

      selection.clearSelection();

      expect(dispatch).not.toHaveBeenCalled();
    });
  });

  it('does not re-run the projection: selection is presentation, not structure', () => {
    const { selection, pipeline } = setup(rows(3));
    const run = vi.fn((all) => all);
    pipeline.addStage({ id: 'noop', phase: 'decorate', run });
    pipeline.projector.rows.get();
    const before = run.mock.calls.length;

    selection.setRowSelected('r0', true);
    pipeline.projector.rows.get();

    expect(run.mock.calls.length).toBe(before);
  });
});
