import { describe, expect, it } from 'vitest';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { SelectionModule, type SelectionModuleOptions } from './selection-module.js';

interface Bond {
  id: string;
  parentId: string | null;
  instrument: string;
}

const bond = (id: string, parentId: string | null = null): Bond => ({
  id,
  parentId,
  instrument: id.toUpperCase(),
});

/** Two groups of three instruments each, expanded. */
const data: Bond[] = [
  bond('g1'),
  bond('g1-a', 'g1'),
  bond('g1-b', 'g1'),
  bond('g1-c', 'g1'),
  bond('g2'),
  bond('g2-a', 'g2'),
  bond('g2-b', 'g2'),
];

const setup = (options: SelectionModuleOptions = {}, rows = data) => {
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(rows);
  const selection = new SelectionModule<Bond>(options);
  const tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true });
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>([{ field: 'instrument' }]),
    dispatch: () => {},
  });
  registry.register(tree);
  registry.register(selection);
  registry.start();
  pipeline.projector.rows.get();
  return { pipeline, selection, tree };
};

const selected = (s: SelectionModule<Bond>) => [...s.getSelectedRows()].sort();

describe('group selection', () => {
  describe('selecting a group', () => {
    it('selects its children', () => {
      const { selection } = setup();

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c']);
    });

    it('does not put the heading itself in the selection', () => {
      // A basket is instruments, not the category above them.
      const { selection } = setup();

      selection.setRowSelected('g1', true);

      expect(selection.getSelectedRows()).not.toContain('g1');
    });

    it('leaves other groups alone', () => {
      const { selection } = setup();

      selection.setRowSelected('g1', true);

      expect(selection.getRowState('g2')).toBe('unchecked');
    });

    it('deselects its children again', () => {
      const { selection } = setup();
      selection.setRowSelected('g1', true);

      selection.setRowSelected('g1', false);

      expect(selected(selection)).toEqual([]);
    });

    it('reports the group as checked once every child is', () => {
      const { selection } = setup();

      selection.setRowSelected('g1', true);

      expect(selection.getRowState('g1')).toBe('checked');
      expect(selection.isSelected('g1')).toBe(true);
    });
  });

  describe('derived parent state', () => {
    it('is indeterminate while only some children are selected', () => {
      const { selection } = setup();

      selection.setRowSelected('g1-a', true);

      expect(selection.getRowState('g1')).toBe('indeterminate');
    });

    it('becomes checked when the last child is ticked individually', () => {
      const { selection } = setup();

      selection.setRowSelected('g1-a', true);
      selection.setRowSelected('g1-b', true);
      selection.setRowSelected('g1-c', true);

      expect(selection.getRowState('g1')).toBe('checked');
    });

    it('falls back to indeterminate when a child is unticked', () => {
      const { selection } = setup();
      selection.setRowSelected('g1', true);

      selection.setRowSelected('g1-b', false);

      expect(selection.getRowState('g1')).toBe('indeterminate');
    });

    it('completes a partly selected group rather than clearing it', () => {
      // The trader was building the group up, not tearing it down.
      const { selection } = setup();
      selection.setRowSelected('g1-a', true);

      selection.toggleRowSelected('g1');

      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c']);
    });
  });

  describe('with a filter', () => {
    it('selects only the children that survived the filter', () => {
      // The projection is already filtered, so a group stands for what is visible.
      const { selection, pipeline } = setup();
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.filter((row) => row.rowId !== 'g1-b'),
      });
      pipeline.projector.rows.get();

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1-a', 'g1-c']);
    });

    it('reads as checked when every visible child is selected', () => {
      const { selection, pipeline } = setup();
      pipeline.addStage({
        id: 'filter',
        phase: 'filter',
        run: (rows) => rows.filter((row) => row.rowId !== 'g1-b'),
      });
      pipeline.projector.rows.get();

      selection.setRowSelected('g1', true);

      expect(selection.getRowState('g1')).toBe('checked');
    });
  });

  describe('collapsed groups', () => {
    it('selects nothing for a group whose children are not projected', () => {
      // A collapsed group has no visible children to stand for. Selecting the
      // hidden ones would put rows in a basket the trader cannot see.
      const { selection, tree } = setup();
      tree.collapseAll();

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1']);
    });
  });

  describe('nesting', () => {
    it('selects every descendant, not just direct children', () => {
      const nested: Bond[] = [
        bond('root'),
        bond('mid', 'root'),
        bond('leaf1', 'mid'),
        bond('leaf2', 'mid'),
      ];
      const { selection } = setup({}, nested);

      selection.setRowSelected('root', true);

      expect(selected(selection)).toEqual(['leaf1', 'leaf2']);
    });

    it('makes an intermediate group reflect its own subtree', () => {
      const nested: Bond[] = [
        bond('root'),
        bond('mid', 'root'),
        bond('leaf1', 'mid'),
        bond('leaf2', 'mid'),
      ];
      const { selection } = setup({}, nested);

      selection.setRowSelected('leaf1', true);

      expect(selection.getRowState('mid')).toBe('indeterminate');
      expect(selection.getRowState('root')).toBe('indeterminate');
    });
  });

  describe('selectAll and the header', () => {
    it('selects every leaf but no heading', () => {
      const { selection } = setup();

      selection.selectAll();

      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c', 'g2-a', 'g2-b']);
    });

    it('reports every group as checked afterwards', () => {
      const { selection } = setup();

      selection.selectAll();

      expect(selection.getRowState('g1')).toBe('checked');
      expect(selection.getRowState('g2')).toBe('checked');
    });
  });

  describe('groupSelectsChildren: false', () => {
    it('makes a group an independently selectable row', () => {
      const { selection } = setup({ groupSelectsChildren: false });

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1']);
    });

    it('leaves a group unaffected by its children', () => {
      const { selection } = setup({ groupSelectsChildren: false });

      selection.setRowSelected('g1-a', true);

      expect(selection.getRowState('g1')).toBe('unchecked');
    });
  });

  describe('isSelectable', () => {
    it('excludes a row from its parent, so the parent still reaches checked', () => {
      const { selection } = setup({ isSelectable: (rowId) => rowId !== 'g1-b' });

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1-a', 'g1-c']);
      expect(selection.getRowState('g1')).toBe('checked');
    });

    it('makes a row with no selectable leaves uninteractive', () => {
      const { selection } = setup({ isSelectable: () => false });

      expect(selection.isRowSelectable('g1')).toBe(false);
      expect(selection.isRowSelectable('g1-a')).toBe(false);
    });
  });

  describe('without a tree module', () => {
    it('behaves exactly as a flat grid, every row its own leaf', () => {
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData([bond('a'), bond('b')]);
      const selection = new SelectionModule<Bond>();
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => [],
        dispatch: () => {},
      });
      registry.register(selection);
      registry.start();
      pipeline.projector.rows.get();

      selection.setRowSelected('a', true);

      expect(selection.getSelectedRows()).toEqual(['a']);
      expect(selection.getRowState('a')).toBe('checked');
    });
  });
});
