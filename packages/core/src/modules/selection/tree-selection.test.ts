import { describe, expect, it } from 'vite-plus/test';
import { resolveColumns } from '../../columns/resolve-columns.js';
import { GridPipeline } from '../../pipeline/grid-pipeline.js';
import { ModuleRegistry } from '../module-registry.js';
import { TreeModule } from '../tree/tree-module.js';
import { SelectionModule, type SelectionModuleOptions } from './selection-module.js';
import { TreeSelectionModule } from './tree/tree-selection-module.js';

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

const setup = (
  options: SelectionModuleOptions & { groupSelectsChildren?: boolean } = {},
  rows = data,
) => {
  const { groupSelectsChildren, ...selectionOptions } = options;
  const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
  pipeline.store.setRowData(rows);
  const selection = new SelectionModule<Bond>(selectionOptions);
  const group = new TreeSelectionModule<Bond>({
    getParentId: (row) => row.parentId,
    ...(groupSelectsChildren === undefined
      ? {}
      : { scope: groupSelectsChildren ? ('filteredChildren' as const) : ('self' as const) }),
  });
  const tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId, defaultExpanded: true });
  const registry = new ModuleRegistry<Bond>({
    pipeline,
    getColumns: () => resolveColumns<Bond>([{ field: 'instrument' }]),
    dispatch: () => {},
  });
  registry.register(tree);
  registry.register(selection);
  registry.register(group);
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
    it('selects the children of a collapsed group it has seen before', () => {
      const { selection, tree } = setup();
      tree.collapseAll();

      selection.setRowSelected('g1', true);

      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c']);
      expect(selection.getRowState('g1')).toBe('checked');
    });

    it('selects the children of a group never opened, which the data knows about', () => {
      // Collapsed from the outset, so nothing has ever drawn its children. The
      // hierarchy comes from the data, so that makes no difference.
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData(data);
      const selection = new SelectionModule<Bond>();
      const group = new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId });
      const tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId });
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => resolveColumns<Bond>([{ field: 'instrument' }]),
        dispatch: () => {},
      });
      registry.register(tree);
      registry.register(selection);
      registry.register(group);
      registry.start();
      pipeline.projector.rows.get();

      selection.setRowSelected('g1', true);

      expect(selection.getSelectedRows()).toEqual(['g1-a', 'g1-b', 'g1-c']);
      expect(selection.getRowState('g1')).toBe('checked');
      // Never the category's own id, which is not an instrument.
      expect(selection.getSelectedRows()).not.toContain('g1');
    });

    it('resolves that group to its children once they are first revealed', () => {
      const pipeline = new GridPipeline<Bond>({ getRowId: (d) => d.id });
      pipeline.store.setRowData(data);
      const selection = new SelectionModule<Bond>();
      const group = new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId });
      const tree = new TreeModule<Bond>({ getParentId: (d) => d.parentId });
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => resolveColumns<Bond>([{ field: 'instrument' }]),
        dispatch: () => {},
      });
      registry.register(tree);
      registry.register(selection);
      registry.register(group);
      registry.start();
      pipeline.projector.rows.get();
      selection.setRowSelected('g1', true);

      tree.expandAll();
      pipeline.projector.rows.get();

      expect([...selection.getSelectedRows()].sort()).toEqual(['g1-a', 'g1-b', 'g1-c']);
      expect(selection.getRowState('g1')).toBe('checked');
    });

    it('keeps the selection when the group is expanded again', () => {
      // The reported bug: the group showed as selected, then on expanding both
      // it and its children read as unselected — the selection silently lost.
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      selection.setRowSelected('g1', true);

      tree.expandAll();
      pipeline.projector.rows.get();

      expect(selection.getRowState('g1')).toBe('checked');
      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c']);
    });

    it('marks the revealed children as selected', () => {
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      selection.setRowSelected('g1', true);

      tree.expandAll();
      pipeline.projector.rows.get();

      for (const child of ['g1-a', 'g1-b', 'g1-c']) {
        expect(selection.getRowState(child), child).toBe('checked');
      }
    });

    it('leaves other groups alone through the round trip', () => {
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      selection.setRowSelected('g1', true);

      tree.expandAll();
      pipeline.projector.rows.get();

      expect(selection.getRowState('g2')).toBe('unchecked');
      expect(selected(selection)).not.toContain('g2-a');
    });

    it('lets a child be deselected after the group was selected while collapsed', () => {
      // The group covers its children, so removing one has to break the group
      // apart and keep the siblings rather than letting the row spring back.
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      selection.setRowSelected('g1', true);
      tree.expandAll();
      pipeline.projector.rows.get();

      selection.setRowSelected('g1-b', false);

      expect(selected(selection)).toEqual(['g1-a', 'g1-c']);
      expect(selection.getRowState('g1')).toBe('indeterminate');
      expect(selection.getRowState('g1-b')).toBe('unchecked');
    });

    it('collapsing again keeps the group reading as selected', () => {
      const { selection, tree, pipeline } = setup();
      selection.setRowSelected('g1', true);
      pipeline.projector.rows.get();

      tree.collapseAll();
      pipeline.projector.rows.get();

      expect(selection.getRowState('g1')).toBe('checked');
    });

    it('a partly selected group still reads as indeterminate once collapsed', () => {
      const { selection, tree, pipeline } = setup();
      selection.setRowSelected('g1-a', true);
      pipeline.projector.rows.get();

      tree.collapseAll();
      pipeline.projector.rows.get();

      // Its children are hidden, but one of them is selected, so neither
      // checked nor unchecked would be honest.
      expect(selection.getRowState('g1')).toBe('indeterminate');
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

  describe('the header while collapsed', () => {
    const headerState = (selection: SelectionModule<Bond>) => {
      const slot = selection.headerSlot({
        column: { colId: 'flow-selection', headerName: '', width: 28, index: 0 },
      } as never);
      // The template's bound properties carry the tri-state.
      const values = (slot as unknown as { values: unknown[] }).values;
      return { checked: values[0] as boolean, indeterminate: values[1] as boolean };
    };

    it('shows indeterminate when only some groups are selected', () => {
      // With groups collapsed each group is itself a projected leaf, so counting
      // projected leaves reported a selection of instruments as nothing at all.
      const { selection, tree, pipeline } = setup();
      selection.setRowSelected('g1', true);
      pipeline.projector.rows.get();

      tree.collapseAll();
      pipeline.projector.rows.get();

      expect(headerState(selection)).toEqual({ checked: false, indeterminate: true });
    });

    it('shows checked when every group is selected', () => {
      const { selection, tree, pipeline } = setup();
      selection.selectAll();
      pipeline.projector.rows.get();

      tree.collapseAll();
      pipeline.projector.rows.get();

      expect(headerState(selection)).toEqual({ checked: true, indeterminate: false });
    });

    it('shows unchecked when nothing is selected', () => {
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      pipeline.projector.rows.get();

      expect(headerState(selection)).toEqual({ checked: false, indeterminate: false });
    });

    it('selects every instrument when ticked while collapsed', () => {
      const { selection, tree, pipeline } = setup();
      tree.collapseAll();
      pipeline.projector.rows.get();

      selection.selectAll();

      expect(selected(selection)).toEqual(['g1-a', 'g1-b', 'g1-c', 'g2-a', 'g2-b']);
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

    it('leaves the children unselected when the group is selected', () => {
      // The whole point of the option, and it was broken: ancestor resolution
      // applied regardless of mode, so every child of a selected group read as
      // checked while the selection itself contained only the group.
      const { selection } = setup({ groupSelectsChildren: false });

      selection.setRowSelected('g1', true);

      for (const child of ['g1-a', 'g1-b', 'g1-c']) {
        expect(selection.getRowState(child), child).toBe('unchecked');
      }
      expect(selection.getSelectedCount()).toBe(1);
    });

    it('leaves a group unaffected by its children', () => {
      const { selection } = setup({ groupSelectsChildren: false });

      selection.setRowSelected('g1-a', true);

      expect(selection.getRowState('g1')).toBe('unchecked');
    });

    it('never reports a group as indeterminate', () => {
      // A group stands only for itself here, so it is either selected or not.
      const { selection } = setup({ groupSelectsChildren: false });

      selection.setRowSelected('g1-a', true);
      selection.setRowSelected('g1-b', true);

      expect(selection.getRowState('g1')).toBe('unchecked');
    });

    it('selects groups and rows alike with selectAll', () => {
      const { selection } = setup({ groupSelectsChildren: false });

      selection.selectAll();

      expect(selected(selection)).toEqual(['g1', 'g1-a', 'g1-b', 'g1-c', 'g2', 'g2-a', 'g2-b']);
    });

    it('deselecting a child does not disturb the group', () => {
      const { selection } = setup({ groupSelectsChildren: false });
      selection.selectAll();

      selection.setRowSelected('g1-a', false);

      expect(selection.getRowState('g1')).toBe('checked');
      expect(selection.getRowState('g1-a')).toBe('unchecked');
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
      const group = new TreeSelectionModule<Bond>({ getParentId: (bond) => bond.parentId });
      const registry = new ModuleRegistry<Bond>({
        pipeline,
        getColumns: () => [],
        dispatch: () => {},
      });
      registry.register(selection);
      registry.register(group);
      registry.start();
      pipeline.projector.rows.get();

      selection.setRowSelected('a', true);

      expect(selection.getSelectedRows()).toEqual(['a']);
      expect(selection.getRowState('a')).toBe('checked');
    });
  });
});
